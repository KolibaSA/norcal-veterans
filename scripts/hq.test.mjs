import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { getOwner, publicData, submitIntake, pacificDate } from '../src/storage.mjs';
import { hqAction, hqFetch } from '../src/hq.mjs';
import { publicExtension, eventCalendar } from '../src/public-tools.mjs';
import publicWorker from '../dist/worker.mjs';
import hqWorker from '../dist/hq-worker.mjs';

const migration = readdirSync(new URL('../migrations/', import.meta.url)).filter(name=>/^\d+.*\.sql$/.test(name)).sort().map(name=>readFileSync(new URL('../migrations/'+name, import.meta.url), 'utf8')).join('\n');
const OWNER = 'owner@example.test';
const AUD = 'test-access-application';
const HQ = 'https://hq.example.test';
const PUBLIC = 'https://public.example.test';
const ORG = 'vfw-ca-8762';
const PAST_VERSION = '2025-01-01T00:00:00.000Z';
const PRIVATE = 'PRIVATE_QUEUE_SENTINEL_DO_NOT_PUBLISH';

// Execute real SQLite, including constraints, triggers, changes() and rollback.
// This adapter covers the D1 surface used by the application, not its SQL logic.
class D1Statement {
  constructor(db, sql, values = []) { this.db = db; this.sql = sql; this.values = values; }
  bind(...values) { return new D1Statement(this.db, this.sql, values); }
  execute() {
    const statement = this.db.sqlite.prepare(this.sql);
    let results = [], changes;
    if (statement.columns().length) {
      results = statement.all(...this.values).map(row => ({ ...row }));
      changes = Number(this.db.sqlite.prepare('SELECT changes() AS n').get().n);
    } else {
      changes = Number(statement.run(...this.values).changes);
    }
    return { results, success: true, meta: { changes } };
  }
  async all() { return this.execute(); }
  async run() { return this.execute(); }
}

class SQLiteD1 {
  constructor() { this.sqlite = new DatabaseSync(':memory:'); this.sqlite.exec(migration); }
  prepare(sql) { return new D1Statement(this, sql); }
  async batch(statements) {
    this.sqlite.exec('BEGIN IMMEDIATE');
    try {
      const results = statements.map(statement => statement.execute());
      this.sqlite.exec('COMMIT');
      return results;
    } catch (error) {
      this.sqlite.exec('ROLLBACK');
      throw error;
    }
  }
  one(sql, ...values) { return this.sqlite.prepare(sql).get(...values); }
  close() { this.sqlite.close(); }
}

function database(t) { const db = new SQLiteD1(); t.after(() => db.close()); return db; }
function env(db, extra = {}) { return { DB: db, OWNER_EMAIL: OWNER, ACCESS_AUD: AUD, ...extra }; }
function access(email = OWNER, aud = AUD) { return { access: { aud, getIdentity: async () => ({ email }) } }; }
function get(path = '/', origin = HQ, headers = {}) { return new Request(origin + path, { headers }); }
function post(path, values, origin = HQ, overrides = {}) {
  const headers = new Headers({ 'Content-Type': 'application/x-www-form-urlencoded', Origin: origin, 'Sec-Fetch-Site': 'same-origin', 'CF-Connecting-IP': '192.0.2.10' });
  for (const [name, value] of Object.entries(overrides)) { if (value === null) headers.delete(name); else headers.set(name, value); }
  return new Request(origin + path, { method: 'POST', headers, body: new URLSearchParams(values) });
}
const intake = (extra = {}) => ({ kind: 'profile', org_id: ORG, title: 'Meeting correction', details: PRIVATE, sender_name: 'Private Submitter', sender_email: 'private-contact@example.test', source_url: 'https://example.org/post', privacy: 'yes', website_check: '', ...extra });
const eventForm = (extra = {}) => ({ action: 'event_save', id: 'test-event', title: 'Source-reviewed community gathering', org_id: ORG, organizer: 'Local veteran organization', kind: 'Community event', county: 'Yolo', city: 'West Sacramento', venue: '905 Drever Street, West Sacramento, CA', start_at: '2099-07-15T10:00:00-07:00', end_at: '2099-07-15T12:00:00-07:00', audience: 'Public; confirm registration with the organizer.', description: 'Meet local organizations.', source_url: 'https://example.org/event', time_note: '', ...extra });
const eventVersion = db => db.one('SELECT updated_at FROM events WHERE id=?', 'test-event').updated_at;
const count = (db, table) => Number(db.one(`SELECT count(*) AS n FROM ${table}`).n);
const tick = () => new Promise(resolve => setTimeout(resolve, 3));

test('work requests record verified identity, remain separate/private, and prevent double submission', async t => {
 const db=database(t),editor='sterling@example.test',settings=env(db,{HQ_EDITOR_EMAILS:editor});
 const values={action:'work_create',id:'new-work',target:'website',details:PRIVATE,title:'Improve calendar',requested_by:OWNER};
 const saved=await hqWorker.fetch(post('/action',values),settings,access(editor));
 assert.equal(saved.status,303);
 assert.equal(db.one('SELECT requested_by FROM work_requests').requested_by,editor);
 assert.equal(count(db,'requests'),0); assert.equal(count(db,'tasks'),0);
 assert.equal(count(db,'work_request_messages'),1);
 assert.equal((await hqWorker.fetch(post('/action',values),settings,access(editor))).status,400);
 assert.equal(count(db,'work_requests'),1); assert.equal(count(db,'work_request_messages'),1);
 assert.equal(db.one('SELECT last_activity_at FROM request_processor').last_activity_at,db.one('SELECT created_at FROM work_requests').created_at);
 const page=await (await hqWorker.fetch(get(),settings,access(editor))).text();
 assert.match(page,/What would you like me to do/); assert.match(page,/Queued for Chat/);
 assert.ok(page.includes(PRIVATE));
 assert.ok(!(await (await publicWorker.fetch(get('/data.json',PUBLIC),settings)).text()).includes(PRIVATE));
 assert.equal((await hqWorker.fetch(post('/action',{...values,id:'forged'}),settings,access('outsider@example.test'))).status,403);
});

test('accepting a suggestion preserves the exact decision and a later reply invalidates work in flight',async t=>{
 const db=database(t);
 await hqAction(post('/action',{action:'work_create',id:'decision',target:'headquarters',details:'Simplify the dashboard'}),db,OWNER);
 await db.prepare("UPDATE work_requests SET status='needs_input',suggestion=?,result=?,version=2 WHERE id='decision'").bind('Use an events-first home page.','Which audience should the home page serve?').run();
 const page=await (await hqWorker.fetch(get('/?tab=requests'),env(db),access())).text();
 assert.match(page,/Yes, do that/);assert.match(page,/Or tell me what you would prefer/);
 await hqAction(post('/action',{action:'work_approve',id:'decision',version:'2'}),db,OWNER);
 assert.equal(db.one('SELECT status FROM work_requests').status,'queued');
 assert.equal(db.one("SELECT body FROM work_request_messages WHERE kind='approval'").body,'Yes, do that: Use an events-first home page.');
 await assert.rejects(hqAction(post('/action',{action:'work_approve',id:'decision',version:'2'}),db,OWNER),/suggestion changed/i);
 await db.prepare("UPDATE work_requests SET status='in_progress',claim_token='old-run',claim_until='2099-01-01T00:00:00.000Z' WHERE id='decision'").run();
 await hqAction(post('/action',{action:'work_reply',id:'decision',version:'3',reply:'Actually, put Requests first.'}),db,OWNER);
 const row=db.one('SELECT * FROM work_requests');
 assert.equal(row.version,4);assert.equal(row.status,'queued');assert.equal(row.claim_token,null);assert.equal(row.suggestion,'');
 assert.equal(count(db,'work_request_messages'),3);
});

test('work request forms reject CSRF, stale replies, oversized text and escape markup',async t=>{
 const db=database(t),values={action:'work_create',id:'escape',target:'decide',details:'<script>alert(1)</script>'};
 await assert.rejects(hqAction(post('/action',values,HQ,{Origin:'https://evil.test'}),db,OWNER),/original page/);
 await assert.rejects(hqAction(post('/action',{...values,details:'x'.repeat(6001)}),db,OWNER),/too long/);
 await hqAction(post('/action',values),db,OWNER);
 const page=await (await hqWorker.fetch(get(),env(db),access())).text();
 assert.ok(!page.includes('<script>alert(1)</script>'));assert.match(page,/&lt;script&gt;/);
 await assert.rejects(hqAction(post('/action',{action:'work_reply',id:'escape',version:'0',reply:'Stale'}),db,OWNER),/Reload/);
 assert.equal(count(db,'work_request_messages'),1);
});

test('Shared HQ verifies each editor and records requests under authenticated identity', async t => {
 const db=database(t),editor='sterling@example.test',settings=env(db,{HQ_EDITOR_EMAILS:editor});
 assert.equal(await getOwner(get(),settings,access(editor)),editor);
 assert.equal(await getOwner(get(),settings,access('outsider@example.test')),null);
 assert.equal(await getOwner(get(),settings,access(editor,'wrong-app')),null);
 const res=await hqFetch(post('/action',{action:'request_create',kind:'other',title:'A shared request',details:'Please review our next event.',sender_email:OWNER}),settings,access(editor),{});
 assert.equal(res.status,303);
 assert.equal(db.one('SELECT sender_email FROM requests').sender_email,editor);
 assert.equal(db.one("SELECT actor FROM audit WHERE action='request_create'").actor,editor);
 const page=await (await hqFetch(get('/?tab=review'),settings,access(OWNER),{})).text();
 assert.match(page,/Submitted while signed in as: sterling@example.test/);
 assert.match(page,/Signed in: owner@example.test/);
 await submitIntake(post('/submit',intake({sender_email:editor}),PUBLIC),db,[ORG]);
 const updated=await (await hqFetch(get('/?tab=review'),settings,access(editor),{})).text();
 assert.match(updated,/Public submission · contact identity not verified/);
});

test('D1 adapter rolls back a failed batch and preserves SQLite changes() semantics', async t => {
  const db = database(t);
  await assert.rejects(db.batch([
    db.prepare('INSERT INTO tasks(id,title,category,created_at,updated_at) VALUES (?,?,?,?,?)').bind('duplicate', 'First', 'Test', PAST_VERSION, PAST_VERSION),
    db.prepare('INSERT INTO tasks(id,title,category,created_at,updated_at) VALUES (?,?,?,?,?)').bind('duplicate', 'Second', 'Test', PAST_VERSION, PAST_VERSION)
  ]), /UNIQUE|constraint/i);
  assert.equal(count(db, 'tasks'), 0);
  const result = await db.batch([
    db.prepare('INSERT INTO intake_limits(bucket,count,expires_at) VALUES (?,1,?) RETURNING count').bind('adapter', '2099-01-01'),
    db.prepare('SELECT changes() AS n')
  ]);
  assert.equal(result[0].meta.changes, 1);
  assert.equal(result[0].results[0].count, 1);
  assert.equal(result[1].results[0].n, 1);
});

test('HQ denies missing identity, wrong audience, wrong owner and spoofed headers even with a database', async t => {
  const db = database(t);
  const spoofedHeaders = { 'Cf-Access-Authenticated-User-Email': OWNER, 'Cf-Access-Jwt-Assertion': 'attacker-controlled.jwt', 'X-Forwarded-Email': OWNER };
  const cases = [undefined, {}, access(OWNER, 'wrong-application'), access('outsider@example.test'), { access: { aud: AUD, getIdentity: async () => ({}) } }];
  for (const ctx of cases) {
    assert.equal(await getOwner(get('/', HQ, spoofedHeaders), env(db), ctx), null);
    for (const path of ['/', '/export.json']) {
      const response = await hqWorker.fetch(get(path, HQ, spoofedHeaders), env(db), ctx);
      assert.equal(response.status, 403, path);
      assert.equal(response.headers.get('Cache-Control'), 'no-store');
      assert.ok(!(await response.text()).includes(PRIVATE));
    }
    const write = await hqWorker.fetch(post('/action', { action: 'task_create', title: 'Unauthorized task', priority: 'normal' }, HQ, spoofedHeaders), env(db), ctx);
    assert.equal(write.status, 403);
  }
  for (const settings of [env(db, { OWNER_EMAIL: '' }), env(db, { ACCESS_AUD: '' })]) {
    assert.equal((await hqWorker.fetch(get(), settings, access())).status, 403);
  }
  assert.equal(count(db, 'tasks'), 0);
  assert.equal(count(db, 'audit'), 0);
});

test('matching platform owner and audience can read and write HQ', async t => {
  const db = database(t);
  assert.equal(await getOwner(get(), env(db), access(OWNER.toUpperCase())), OWNER.toUpperCase());
  assert.equal((await hqFetch(get(), env(db), access(), {})).status, 200);
  const response = await hqWorker.fetch(post('/action', { action: 'task_create', title: 'Verify a post contact', priority: 'high', category: 'Research', notes: PRIVATE }), env(db), access());
  assert.equal(response.status, 303);
  assert.match(response.headers.get('Location'), /tab=tasks/);
  assert.equal(count(db, 'tasks'), 1);
  assert.equal(db.one('SELECT actor FROM audit').actor, OWNER);
});

test('CSRF attempts cannot write public intake or authenticated HQ records', async t => {
  const db = database(t);
  for (const headers of [{ Origin: 'https://attacker.example' }, { Origin: null }, { 'Sec-Fetch-Site': 'cross-site' }]) {
    await assert.rejects(submitIntake(post('/submit', intake(), PUBLIC, headers), db, [ORG]), /original page/i);
    const publicResponse = await publicWorker.fetch(post('/submit', intake(), PUBLIC, headers), env(db));
    assert.equal(publicResponse.status, 400);
    const privateResponse = await hqWorker.fetch(post('/action', { action: 'task_create', title: 'CSRF task', priority: 'normal' }, HQ, headers), env(db), access());
    assert.equal(privateResponse.status, 400);
  }
  assert.equal(count(db, 'requests'), 0);
  assert.equal(count(db, 'tasks'), 0);
  assert.equal(count(db, 'audit'), 0);
});

test('submitted proposals and reply contacts stay private, including after review status changes', async t => {
  const db = database(t);
  const response = await publicWorker.fetch(post('/submit', intake(), PUBLIC), env(db));
  assert.equal(response.status, 303);
  const saved = db.one('SELECT * FROM requests');
  assert.equal(saved.status, 'pending');
  assert.equal(saved.sender_email, 'private-contact@example.test');
  assert.equal((await publicData(db, [], [])).events.length, 0);
  await hqAction(post('/action', { action: 'request_status', id: saved.id, version: saved.updated_at, status: 'reviewed' }), db, OWNER);
  assert.equal(db.one('SELECT status FROM requests').status, 'reviewed');
  for (const path of ['/data.json', '/', '/organizations/' + ORG, '/events', '/events.ics']) {
    const page = await publicWorker.fetch(get(path, PUBLIC), env(db));
    assert.equal(page.status, 200, path);
    const body = await page.text();
    for (const privateValue of [PRIVATE, 'Private Submitter', saved.sender_email]) assert.ok(!body.includes(privateValue), `${path} exposed ${privateValue}`);
  }
});

test('rejected submissions from a saturated IP do not spend the shared daily quota', async t => {
  const db = database(t);
  for (let i = 0; i < 5; i++) await submitIntake(post('/submit', intake({ title: 'Accepted ' + i }), PUBLIC), db, [ORG]);
  const global = () => Number(db.one("SELECT count FROM intake_limits WHERE bucket LIKE 'global:%'").count);
  assert.equal(global(), 5);
  for (let i = 0; i < 20; i++) await assert.rejects(submitIntake(post('/submit', intake({ title: 'Rejected ' + i }), PUBLIC), db, [ORG]), /limit/i);
  assert.equal(global(), 5, 'rejections must not drain capacity for other submitters');
  assert.equal(count(db, 'requests'), 5);
  await submitIntake(post('/submit', intake({ title: 'Another household' }), PUBLIC, { 'CF-Connecting-IP': '192.0.2.11' }), db, [ORG]);
  assert.equal(global(), 6);
  assert.equal(count(db, 'requests'), 6);
});

test('event publication lifecycle controls page, JSON and calendar visibility', async t => {
  const db = database(t);
  await hqAction(post('/action', eventForm()), db, OWNER);
  assert.equal(db.one('SELECT status FROM events').status, 'draft');
  assert.deepEqual((await publicData(db, [], [])).events, []);
  assert.equal((await publicWorker.fetch(get('/events/test-event', PUBLIC), env(db))).status, 404);
  await assert.rejects(hqAction(post('/action', { action: 'event_status', id: 'test-event', version: eventVersion(db), status: 'published' }), db, OWNER), /source review/i);
  assert.equal(db.one('SELECT status FROM events').status, 'draft');
  await tick();
  await hqAction(post('/action', { action: 'event_status', id: 'test-event', version: eventVersion(db), status: 'published', reviewed: 'yes' }), db, OWNER);
  let events = (await publicData(db, [], [])).events;
  assert.equal(events.length, 1);
  assert.match(events[0].source_checked, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(publicExtension(new URL(PUBLIC + '/events/test-event'), events).status, 200);
  assert.equal((await publicWorker.fetch(get('/events/test-event', PUBLIC), env(db))).status, 200);
  assert.ok(eventCalendar(events).includes('UID:test-event@'));
  assert.ok((await (await publicWorker.fetch(get('/events.ics', PUBLIC), env(db))).text()).includes('UID:test-event@'));
  assert.ok((await (await publicWorker.fetch(get('/data.json', PUBLIC), env(db))).json()).events.some(v => v.id === 'test-event'));
  await tick();
  await hqAction(post('/action', { action: 'event_status', id: 'test-event', version: eventVersion(db), status: 'archived' }), db, OWNER);
  events = (await publicData(db, [], [])).events;
  assert.deepEqual(events, []);
  assert.equal(publicExtension(new URL(PUBLIC + '/events/test-event'), events), null);
  assert.equal((await publicWorker.fetch(get('/events/test-event', PUBLIC), env(db))).status, 404);
  assert.ok(!(await (await publicWorker.fetch(get('/events.ics?event=test-event', PUBLIC), env(db))).text()).includes('UID:test-event@'));
  assert.ok(!(await (await publicWorker.fetch(get('/data.json', PUBLIC), env(db))).json()).events.some(v => v.id === 'test-event'));
  assert.equal(count(db, 'revisions'), 2, 'both publication transitions preserve prior event revisions');
});

test('editing a published event returns it to draft until separately reviewed again', async t => {
  const db = database(t);
  await hqAction(post('/action', eventForm()), db, OWNER);
  await tick();
  await hqAction(post('/action', { action: 'event_status', id: 'test-event', version: eventVersion(db), status: 'published', reviewed: 'yes' }), db, OWNER);
  await tick();
  await hqAction(post('/action', eventForm({ version: eventVersion(db), title: 'Changed date, awaiting review' })), db, OWNER);
  assert.equal(db.one('SELECT status FROM events').status, 'draft');
  assert.deepEqual((await publicData(db, [], [])).events, []);
  assert.equal((await publicWorker.fetch(get('/events/test-event', PUBLIC), env(db))).status, 404);
});

test('impossible dates, wrong Pacific offsets and invalid end times cannot be saved', async t => {
  const db = database(t);
  for (const invalid of ['2026-02-30T10:00:00-08:00', '2026-07-15T10:00:00-08:00', '2026-01-15T10:00:00-07:00', '2026-03-08T02:30:00-08:00', '2026-09-15T10:00:00Z']) {
    assert.throws(() => pacificDate(invalid), /date|offset|Pacific/i, invalid);
    await assert.rejects(hqAction(post('/action', eventForm({ start_at: invalid, end_at: '' })), db, OWNER), /date|offset|Pacific/i);
  }
  assert.equal(pacificDate('2026-07-15T10:00:00-07:00'), '2026-07-15T10:00:00-07:00');
  assert.equal(pacificDate('2026-01-15T10:00:00-08:00'), '2026-01-15T10:00:00-08:00');
  await assert.rejects(hqAction(post('/action', eventForm({ end_at: '2099-07-15T09:00:00-07:00' })), db, OWNER), /end must follow/i);
  assert.equal(count(db, 'events'), 0);
  assert.equal(count(db, 'audit'), 0);
});

test('optimistic versions reject stale writes without new audit records or revisions', async t => {
  const db = database(t);
  await db.prepare('INSERT INTO tasks(id,title,category,created_at,updated_at) VALUES (?,?,?,?,?)').bind('versioned-task', 'Contact a partner', 'Research', PAST_VERSION, PAST_VERSION).run();
  await hqAction(post('/action', { action: 'task_status', id: 'versioned-task', version: PAST_VERSION, status: 'in_progress' }), db, OWNER);
  const task = db.one('SELECT * FROM tasks');
  await assert.rejects(hqAction(post('/action', { action: 'task_status', id: task.id, version: PAST_VERSION, status: 'done' }), db, OWNER), /changed in another session/i);
  assert.equal(db.one('SELECT status FROM tasks').status, 'in_progress');
  assert.equal(count(db, 'audit'), 1);
  const event = { ...eventForm(), id: 'versioned-event', organization_id: ORG };
  await db.prepare('INSERT INTO events(id,body_json,status,created_at,updated_at) VALUES (?,?,?,?,?)').bind(event.id, JSON.stringify(event), 'draft', PAST_VERSION, PAST_VERSION).run();
  await hqAction(post('/action', { action: 'event_status', id: event.id, version: PAST_VERSION, status: 'published', reviewed: 'yes' }), db, OWNER);
  const auditBefore = count(db, 'audit'), revisionsBefore = count(db, 'revisions');
  const rejected = await hqWorker.fetch(post('/action', { action: 'event_status', id: event.id, version: PAST_VERSION, status: 'archived' }), env(db), access());
  assert.equal(rejected.status, 400);
  assert.equal(db.one('SELECT status FROM events WHERE id=?', event.id).status, 'published');
  assert.equal(count(db, 'audit'), auditBefore);
  assert.equal(count(db, 'revisions'), revisionsBefore);
});

test('public event and reviewed-profile output escapes stored markup; script URLs are rejected', async t => {
  const db = database(t);
  const attack = '<img src=x onerror="alert(98765)">';
  await assert.rejects(hqAction(post('/action', eventForm({ source_url: 'javascript:alert(98765)' })), db, OWNER), /HTTPS/i);
  await hqAction(post('/action', eventForm({ title: attack, organizer: attack, venue: attack, audience: attack, description: attack, time_note: attack })), db, OWNER);
  await tick();
  await hqAction(post('/action', { action: 'event_status', id: 'test-event', version: eventVersion(db), status: 'published', reviewed: 'yes' }), db, OWNER);
  await hqAction(post('/action', { action: 'profile_publish', org_id: ORG, reviewed: 'yes', member_information: attack, meeting_schedule: attack, phone: '', email: '', website: 'https://example.org/', source_url: 'https://example.org/source' }), db, OWNER);
  for (const path of ['/events', '/events/test-event', '/organizations/' + ORG]) {
    const response = await publicWorker.fetch(get(path, PUBLIC), env(db));
    assert.equal(response.status, 200, path);
    const html = await response.text();
    assert.ok(!html.includes(attack), path + ' contains executable markup');
    assert.ok(html.includes('&lt;img'), path + ' lost the text instead of escaping it');
  }
  const first = db.one('SELECT reviewed_at FROM profile_updates WHERE org_id=?', ORG).reviewed_at;
  await tick();
  const profile = { action: 'profile_publish', org_id: ORG, version: first, reviewed: 'yes', member_information: 'Second reviewed description', website: 'https://example.org/', source_url: 'https://example.org/source' };
  await hqAction(post('/action', profile), db, OWNER);
  const before = count(db, 'audit');
  await assert.rejects(hqAction(post('/action', { ...profile, member_information: 'Stale overwrite' }), db, OWNER), /changed in another session/i);
  assert.equal(JSON.parse(db.one('SELECT body_json FROM profile_updates').body_json).member_information, 'Second reviewed description');
  assert.equal(count(db, 'audit'), before);
});

test('private backup requires the owner, is never public, and uses non-cacheable download headers', async t => {
  const db = database(t);
  await submitIntake(post('/submit', intake(), PUBLIC), db, [ORG]);
  await hqAction(post('/action', { action: 'coord_create', kind: 'history', title: 'Private meeting notes', notes: PRIVATE, next_step: 'Owner follow-up' }), db, OWNER);
  const backup = await hqWorker.fetch(get('/export.json'), env(db), access());
  assert.equal(backup.status, 200);
  assert.equal(backup.headers.get('Cache-Control'), 'no-store');
  assert.match(backup.headers.get('X-Robots-Tag'), /noindex/i);
  assert.match(backup.headers.get('Content-Disposition'), /attachment.*\.json/i);
  const data = await backup.json();
  assert.equal(data.requests[0].sender_email, 'private-contact@example.test');
  assert.equal(data.coordination[0].notes, PRIVATE);
  assert.ok(Array.isArray(data.revisions));
  for (const ctx of [undefined, access('outsider@example.test'), access(OWNER, 'wrong-application')]) {
    const denied = await hqWorker.fetch(get('/export.json'), env(db), ctx);
    assert.equal(denied.status, 403);
    assert.ok(!(await denied.text()).includes(PRIVATE));
  }
  for (const path of ['/export.json', '/hq/export.json']) {
    const response = await publicWorker.fetch(get(path, PUBLIC), env(db));
    assert.equal(response.status, 404);
    assert.ok(!(await response.text()).includes(PRIVATE));
  }
  const publicJSON = await (await publicWorker.fetch(get('/data.json', PUBLIC), env(db))).text();
  assert.ok(!publicJSON.includes(PRIVATE));
  assert.ok(!publicJSON.includes('private-contact@example.test'));
});
