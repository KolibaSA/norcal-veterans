import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { db } from '../../scripts/legacy-test-helpers.mjs';
import worker from '../norcal-worker.mjs';
import { cachedPublicResponse, PUBLIC_CACHE_SECONDS } from './public-cache.mjs';

const origin = 'https://www.norcalveterans.org';
function memoryCache() {
  const entries = new Map();
  return { entries, async match(key) { return entries.get(key.url)?.clone(); }, async put(key, value) { entries.set(key.url, value); } };
}
function fixture(t) {
  const DB = db(t), cache = memoryCache(), queries = [];
  const prepare = DB.prepare.bind(DB);
  DB.prepare = sql => { queries.push(sql); return prepare(sql); };
  const env = { DB, CF_VERSION_METADATA: { id: 'release-one' } };
  const add = (id, kind = 'event', status = 'published') => DB.raw.prepare("INSERT INTO records(id,kind,title,body,region_id,status,payload,created_by,created_at,updated_at,mutation_id) VALUES(?,?,?,'Fictional public description','yolo-solano',?,?,'test@example.test','2026-01-01','2026-01-01',?)")
    .run(id, kind, id, status, JSON.stringify(kind === 'event' ? { start_at: '2099-01-01T20:00:00Z', city: 'Davis', venue: 'Fictional hall' } : {city:'Davis'}), id);
  const revision = () => DB.raw.prepare('SELECT revision FROM public_cache_state WHERE id=1').get().revision;
  const request = async (path = '/events', options = {}, overrides = {}) => {
    const req = new Request(origin + path, options), environment = {...env, ...overrides};
    return cachedPublicResponse(req, environment, undefined,
      () => worker.fetch(req, {...environment, CF_VERSION_METADATA: undefined}), {cache});
  };
  return { DB, cache, queries, env, add, revision, request };
}

test('repeated public reads reuse rendered output with only one indexed revision read per hit', async t => {
  const f = fixture(t);
  f.add('published-event'); f.add('PRIVATE_DRAFT', 'event', 'draft'); f.add('PRIVATE_REQUEST', 'request', 'queued');
  const first = await f.request();
  assert.equal(first.headers.get('X-NorCal-Cache'), 'MISS');
  const body = await first.text();
  assert.match(body, /published-event/); assert.doesNotMatch(body, /PRIVATE_DRAFT|PRIVATE_REQUEST/);
  f.queries.length = 0;
  for (let i = 0; i < 10; i++) {
    const hit = await f.request();
    assert.equal(hit.headers.get('X-NorCal-Cache'), 'HIT');
    assert.equal(await hit.text(), body);
    assert.equal(hit.headers.get('Cache-Control'), 'no-cache, max-age=0, must-revalidate');
    assert.equal(hit.headers.has('X-NorCal-Cache-Expires'), false);
  }
  assert.deepEqual(f.queries, Array(10).fill('SELECT revision FROM public_cache_state WHERE id=1'));
});

test('cache keys keep region, filters, archive year, page, host and deployed version distinct', async t => {
  const f = fixture(t); f.add('davis-event');
  for (const path of ['/events', '/events?city=Davis', '/events?city=Dixon', '/events?past_year=2025', '/events?past_year=2026', '/events?region=north', '/events?region=south', '/events?page=1', '/events?page=2', '/locations/davis', '/locations/dixon']) {
    await f.request(path);
  }
  // Location routes may return 404 for unsupported slugs and are never stored.
  assert.equal(f.cache.entries.size, 9);
  assert.doesNotMatch(await (await f.request('/events?city=Dixon')).text(), /davis-event/);
  await f.request('/events?city=Davis&page=2');
  assert.equal((await f.request('/events?page=2&city=Davis')).headers.get('X-NorCal-Cache'), 'HIT');
  assert.equal((await f.request('/events', {}, {CF_VERSION_METADATA:{id:'release-two'}})).headers.get('X-NorCal-Cache'), 'MISS');
  const req = new Request('https://staging.example.test/events');
  const result = await cachedPublicResponse(req, f.env, undefined, async () => new Response('staging'), {cache:f.cache});
  assert.equal(result.headers.get('X-NorCal-Cache'), 'MISS');
});

test('publish, edit, withdraw, republish and delete invalidate every public variant', async t => {
  const f = fixture(t); f.add('event', 'event', 'draft');
  assert.equal(f.revision(), 0);
  await f.request(); await f.request('/events?city=Davis');
  f.DB.raw.exec("UPDATE records SET status='published' WHERE id='event'");
  assert.equal(f.revision(), 1);
  assert.match(await (await f.request()).text(), /View details for event/);
  assert.equal((await f.request('/events?city=Davis')).headers.get('X-NorCal-Cache'), 'MISS');
  f.DB.raw.exec("UPDATE records SET title='Changed public title' WHERE id='event'");
  assert.match(await (await f.request()).text(), /Changed public title/);
  f.DB.raw.exec("UPDATE records SET status='draft' WHERE id='event'");
  assert.doesNotMatch(await (await f.request()).text(), /Changed public title/);
  f.DB.raw.exec("UPDATE records SET status='published' WHERE id='event'");
  assert.match(await (await f.request()).text(), /Changed public title/);
  f.DB.raw.exec("DELETE FROM records WHERE id='event'");
  assert.doesNotMatch(await (await f.request()).text(), /Changed public title/);
  assert.equal(f.revision(), 5);
});

test('organization and accepted participant changes invalidate, including deletion and transaction rollback', async t => {
  const f = fixture(t); f.add('event'); f.add('partner','organization');
  f.DB.raw.exec("INSERT INTO organization_event_invitations(id,event_id,recipient_org_id,status,created_by,created_at,updated_at,mutation_id) VALUES('invite','event','partner','pending','test','2026','2026','invite')");
  const before = f.revision();
  await f.request('/events/event');
  f.DB.raw.exec("UPDATE organization_event_invitations SET status='accepted' WHERE id='invite'");
  assert.equal(f.revision(), before + 1);
  const accepted = await f.request('/events/event');
  assert.equal(accepted.headers.get('X-NorCal-Cache'), 'MISS');
  assert.match(await accepted.text(), /Organizations going/);
  f.DB.raw.exec("UPDATE records SET title='New partner name' WHERE id='partner'");
  assert.match(await (await f.request('/events/event')).text(), /New partner name/);
  f.DB.raw.exec("UPDATE organization_event_invitations SET status='withdrawn' WHERE id='invite'");
  assert.doesNotMatch(await (await f.request('/events/event')).text(), /Organizations going/);
  f.DB.raw.exec("UPDATE organization_event_invitations SET status='accepted' WHERE id='invite'");
  const checkpoint = f.revision();
  f.DB.raw.exec("BEGIN; UPDATE records SET title='Rolled back' WHERE id='partner'; ROLLBACK");
  assert.equal(f.revision(), checkpoint);
  f.DB.raw.exec("DELETE FROM organization_event_invitations WHERE id='invite'");
  assert.equal(f.revision(), checkpoint + 1);
});

test('time-sensitive pages expire without a content edit and slow renders cannot extend freshness', async () => {
  const cache = memoryCache(), env = { CF_VERSION_METADATA:{id:'version'}, DB:{prepare:()=>({first:async()=>({revision:0})})} };
  let time = 1_000_000, rendered = 0;
  const req = new Request(origin+'/events');
  const read = () => cachedPublicResponse(req, env, undefined, async () => new Response('render-'+(++rendered)), {cache,now:()=>time});
  assert.equal(await (await read()).text(), 'render-1');
  time += PUBLIC_CACHE_SECONDS * 1000 - 1;
  assert.equal((await read()).headers.get('X-NorCal-Cache'), 'HIT');
  time++;
  assert.equal(await (await read()).text(), 'render-2');
  cache.entries.clear();
  await cachedPublicResponse(req, env, undefined, async () => { time += 31_000; return new Response('slow'); }, {cache,now:()=>time});
  assert.equal(cache.entries.size, 0);
});

test('private routes, forms, writes and credential-bearing reads bypass public cache', async t => {
  const f = fixture(t);
  const paths = ['/hq','/hq/sign-in','/api/hq/records','/health','/share','/for-organizations','/submit','/speaker-submissions','/unknown','/assets/file.png'];
  for (const path of paths) {
    const response = await cachedPublicResponse(new Request(origin+path), f.env, undefined, async () => new Response('private',{headers:{'Cache-Control':'no-store'}}), {cache:f.cache});
    assert.equal(response.headers.has('X-NorCal-Cache'), false, path);
  }
  for (const options of [{method:'POST'}, {headers:{Cookie:'session=private'}}, {headers:{Authorization:'Bearer private'}}, {headers:{'Cf-Access-Jwt-Assertion':'private'}}, {headers:{Range:'bytes=0-2'}}, {headers:{'Cache-Control':'no-cache'}}]) {
    await cachedPublicResponse(new Request(origin+'/events',options), f.env, undefined, async()=>new Response('private'), {cache:f.cache});
  }
  assert.equal(f.cache.entries.size, 0); assert.equal(f.queries.length, 0);
});

test('errors, redirects, cookies, private responses and varying output are never cached', async t => {
  const f = fixture(t);
  for (const options of [{status:404},{status:503},{status:302,headers:{Location:'/hq'}},{headers:{'Set-Cookie':'session=private'}},{headers:{'Cache-Control':'private, no-store'}},{headers:{Vary:'Accept-Language'}}]) {
    const result = await cachedPublicResponse(new Request(origin+'/events'), f.env, undefined, async()=>new Response('output',options), {cache:f.cache});
    assert.equal(result.headers.get('X-NorCal-Cache'),'BYPASS');
    if (options.headers?.['Cache-Control']) assert.equal(result.headers.get('Cache-Control'),'private, no-store');
  }
  assert.equal(f.cache.entries.size,0);
});

test('HEAD reuses GET without storing an empty GET response; static hits do not read D1', async t => {
  const f = fixture(t);
  await f.request('/privacy',{method:'HEAD'});
  assert.equal(f.cache.entries.size,0);
  const get = await f.request('/privacy'); assert.match(await get.text(),/Privacy Notice/);
  const head = await f.request('/privacy',{method:'HEAD'});
  assert.equal(head.headers.get('X-NorCal-Cache'),'HIT'); assert.equal(await head.text(),'');
  assert.equal(f.queries.length,0);
});

test('cache and revision outages fall back to fresh rendering; background write failures are handled', async t => {
  const f = fixture(t), req = new Request(origin+'/events'), warnings=[];
  t.mock.method(console,'warn', message=>warnings.push(message));
  let renders=0;
  const render=async()=>new Response('fresh-'+(++renders));
  const broken = {prepare(){throw new Error('PRIVATE_DATABASE_ERROR');}};
  assert.equal(await (await cachedPublicResponse(req,{...f.env,DB:broken},undefined,render,{cache:f.cache})).text(),'fresh-1');
  assert.equal(await (await cachedPublicResponse(req,f.env,undefined,render,{cache:{match(){throw new Error('private');}}})).text(),'fresh-2');
  const work=[];
  const response=await cachedPublicResponse(req,f.env,{waitUntil(promise){work.push(promise);}},render,{cache:{match:async()=>undefined,put:async()=>{throw new Error('private');}}});
  await Promise.all(work);
  assert.equal(await response.text(),'fresh-3');
  assert.equal(warnings.length,3); assert.doesNotMatch(warnings.join(''),/PRIVATE_DATABASE_ERROR|private/);
});

test('cache migration preserves existing records, revisions and invitations and adds only cache metadata', () => {
  const raw=new DatabaseSync(':memory:'), directory=new URL('../../migrations/legacy/',import.meta.url);
  try {
    for(const name of readdirSync(directory).filter(name=>name.endsWith('.sql')&&name<'0008').sort()) raw.exec(readFileSync(new URL(name,directory),'utf8'));
    raw.exec("INSERT INTO records(id,kind,title,region_id,status,payload,created_by,created_at,updated_at,mutation_id) VALUES('preserved','organization','Preserved','yolo-solano','published','{}','test','2026','2026','preserved')");
    raw.exec("INSERT INTO records(id,kind,title,region_id,status,payload,created_by,created_at,updated_at,mutation_id) VALUES('event','event','Preserved event','yolo-solano','published','{}','test','2026','2026','event')");
    raw.exec("INSERT INTO record_revisions(id,record_id,version,actor,action,created_at,snapshot) VALUES('revision','preserved',1,'test','create','2026','{}')");
    raw.exec("INSERT INTO organization_event_invitations(id,event_id,recipient_org_id,status,created_by,created_at,updated_at,mutation_id) VALUES('invitation','event','preserved','accepted','test','2026','2026','invitation')");
    const before=raw.prepare('SELECT * FROM records').all();
    const history=raw.prepare('SELECT * FROM record_revisions').all();
    const invitations=raw.prepare('SELECT * FROM organization_event_invitations').all();
    raw.exec(readFileSync(new URL('0008_public_cache.sql',directory),'utf8'));
    assert.deepEqual(raw.prepare('SELECT * FROM records').all(),before);
    assert.deepEqual(raw.prepare('SELECT * FROM record_revisions').all(),history);
    assert.deepEqual(raw.prepare('SELECT * FROM organization_event_invitations').all(),invitations);
    assert.equal(raw.prepare('SELECT revision FROM public_cache_state').get().revision,0);
    assert.equal(raw.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
    assert.deepEqual(raw.prepare('PRAGMA foreign_key_check').all(),[]);
  } finally {raw.close();}
});
