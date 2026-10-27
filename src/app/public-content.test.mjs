import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../../scripts/legacy-test-helpers.mjs';
import worker from '../norcal-worker.mjs';
import { publicDataForRequest, norcalPublicData, publicPayload } from './public-content.mjs';
import { upcomingEvents } from '../modules/events/public.mjs';

test('public serializer excludes unknown and inherited object-property record kinds',()=>{
  for(const kind of ['request','submission','constructor','toString','__proto__','hasOwnProperty']) {
    assert.equal(publicPayload({id:'private-fixture',kind,title:'Private title',body:'Private body',payload:{secret:'private-sentinel'}}),null,kind);
  }
});

const origin = 'https://site.test';
const now = Date.parse('2026-10-25T19:00:00Z');
function setup(t) {
  const DB = db(t), queries = [];
  const prepare = DB.prepare.bind(DB);
  DB.prepare = sql => {
    const statement = prepare(sql), all = statement.all.bind(statement);
    statement.all = async () => {
      const result = await all();
      queries.push({ sql, ids: result.results.map(row => row.id), rows: result.results.length });
      return result;
    };
    return statement;
  };
  const insert = DB.raw.prepare('INSERT INTO records(id,kind,title,body,region_id,organization_id,status,payload,created_by,created_at,updated_at,mutation_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)');
  const add = (id, kind, payload = {}, { status = 'published', organizationId = null, region = 'yolo-solano' } = {}) => {
    insert.run(id, kind, id, 'Public description for '+id, region, organizationId, status, JSON.stringify(payload), 'synthetic@example.test', '2026-01-01', '2026-01-01', id);
  };
  const event = (id, start = '2026-11-01T19:00:00Z', payload = {}, scope = {}) => add(id, 'event', { start_at: start, venue: 'Fictional hall', city: 'Davis', ...payload }, scope);
  return { DB, queries, add, event };
}
const request = (DB, path) => publicDataForRequest(DB, new URL(path, origin), now);

test('static public pages and unknown routes do not read directory storage', async () => {
  const DB = { prepare() { throw new Error('Unexpected database read'); } };
  for (const path of ['/privacy','/resources','/about','/memorial-day','/missing-page']) {
    const response = await worker.fetch(new Request(origin + path), { DB });
    assert.equal(response.status, path === '/missing-page' ? 404 : 200, path);
  }
});

test('profile and event detail reads stay focused and retain accepted participant names', async t => {
  const { DB, add, event, queries } = setup(t);
  for (const id of ['host','partner','unrelated']) add(id, 'organization', { city: 'Davis' });
  event('own-event', undefined, {}, { organizationId: 'host' });
  event('legacy-event', undefined, { organization_id: 'host' });
  event('unrelated-event', undefined, {}, { organizationId: 'unrelated' });
  event('draft-event', undefined, {}, { organizationId: 'host', status: 'draft' });
  DB.raw.prepare("INSERT INTO organization_event_invitations(id,event_id,recipient_org_id,status,created_by,created_at,updated_at,mutation_id) VALUES('invite','own-event','partner','accepted','synthetic@example.test','2026-01-01','2026-01-01','invite')").run();
  const profile = await request(DB, '/organizations/host');
  assert.deepEqual(profile.events.map(event => event.id).sort(), ['legacy-event','own-event']);
  assert.deepEqual(profile.records.map(record => record.id).sort(), ['host','partner']);
  assert.ok(queries.every(query => !query.ids.includes('unrelated') && !query.ids.includes('unrelated-event')));
  queries.length = 0;
  const detail = await request(DB, '/events/own-event');
  assert.deepEqual(detail.events.map(event => event.id), ['own-event']);
  assert.deepEqual(detail.records.map(record => record.id).sort(), ['host','partner']);
  assert.ok(queries.every(query => !query.ids.includes('legacy-event')));
  const html = await (await worker.fetch(new Request(origin+'/events/own-event'), { DB })).text();
  assert.match(html, /Organizations going/); assert.match(html, /href="\/organizations\/partner"/);
  assert.deepEqual((await request(DB, '/events/draft-event')).events, []);
});

test('default events avoid historical payloads; explicit archives, details and exports retain history', async t => {
  const { DB, add, event, queries } = setup(t);
  add('host','organization',{city:'Davis'});
  event('future', undefined, {}, { organizationId: 'host' });
  for (let index = 0; index < 2000; index++) {
    event('past-'+index, '2020-06-01T12:00:00Z', {}, { region: 'synthetic-region-'+index%10 });
  }
  const data = await request(DB, '/events');
  assert.deepEqual(data.events.map(event => event.id), ['future']);
  assert.ok(queries.reduce((total, query) => total + query.rows, 0) <= 3);
  assert.ok(queries.every(query => !query.ids.some(id => id?.startsWith('past-'))));
  const archive = await request(DB, '/events?past_year=2020');
  assert.equal(archive.events.length, 2001);
  assert.deepEqual((await request(DB, '/events/past-1')).events.map(event => event.id), ['past-1']);
  assert.equal((await norcalPublicData(DB)).events.length, 2001);
  assert.equal((await request(DB, '/sitemap.xml')).events.length, 2001);
});

test('upcoming query preserves recurring, ongoing, date-only and DST boundaries', async t => {
  const { DB, event } = setup(t);
  event('recurring', '2020-01-01T12:00:00Z', { additional_occurrences: [{start_at:'2026-11-01T12:00:00Z'}] });
  event('ongoing', '2026-10-01T12:00:00Z', {end_at:'2026-11-01T12:00:00Z'});
  event('grace', '2026-10-25T12:00:00Z');
  event('date-only', '2026-10-25T07:00:00Z', {date_only:true});
  event('old', '2020-01-01T12:00:00Z');
  event('bad-array', '2020-01-01T12:00:00Z', {additional_occurrences:['bad', null, 3, {start_at:'2026-11-01T12:00:00Z'}]});
  event('canonical-occurrences', '2020-01-01T12:00:00Z', {occurrences:[{start_at:'2026-11-01T12:00:00Z'}]});
  DB.raw.prepare("UPDATE records SET payload='{invalid' WHERE id='old'").run();
  const complete = await norcalPublicData(DB);
  const filtered = await request(DB, '/events');
  assert.deepEqual(upcomingEvents(filtered.events,now), upcomingEvents(complete.events,now));
  event('long-day', '2026-11-01T07:00:00Z', {date_only:true});
  const dstNow = Date.parse('2026-11-02T07:59:00Z');
  const dst = await publicDataForRequest(DB, new URL('/events',origin), dstNow);
  assert.ok(upcomingEvents(dst.events,dstNow).some(event => event.id === 'long-day'));
});

test('contribution forms read published organizations without their schedules or events', async t => {
  const { DB, add, event, queries } = setup(t);
  add('host','organization',{city:'Davis'});
  add('private','organization',{}, {status:'draft'});
  event('future');
  const data = await request(DB,'/for-organizations');
  assert.deepEqual(data.records.map(record => record.id), ['host']);
  assert.deepEqual(data.events, []);
  assert.equal(queries.length, 1);
});
