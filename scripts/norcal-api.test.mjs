import test from 'node:test';
import assert from 'node:assert/strict';
import { db, envBase, req, token } from './legacy-test-helpers.mjs';
import worker from '../src/norcal-worker.mjs';
import { readJson } from '../worker/legacy/http.mjs';
import { claimSQL, TARGET } from './norcal-hq-agent.mjs';

const owner = envBase.OWNER_EMAIL;
const requestInput = { kind: 'request', title: 'Requested website change', body: 'Original approved instructions.', region_id: 'yolo-solano', status: 'queued', payload: {} };
const taskInput = { kind: 'task', title: 'Private task', body: 'Original task description.', region_id: 'yolo-solano', status: 'open', payload: {} };
const makeEnv = t => ({ ...envBase, DB: db(t) });
async function create(env, input = requestInput) {
  const response = await req(env, '/api/hq/records', env.OWNER_EMAIL, 'POST', input);
  assert.equal(response.status, 201, JSON.stringify(await response.clone().json()));
  return (await response.json()).id;
}
async function grant(env, email, region = 'yolo-solano') {
  const response = await req(env, '/api/hq/access', env.OWNER_EMAIL, 'POST', { email, role: 'editor', region_id: region });
  assert.equal(response.status, 201);
}
function streamedRequest(parts, headers = {}) {
  let position = 0, cancelled = false;
  const body = new ReadableStream({
    pull(controller) { if (position === parts.length) controller.close(); else controller.enqueue(parts[position++]); },
    cancel() { cancelled = true; }
  }, { highWaterMark: 0 });
  return { request: new Request('https://site.test/api/submissions', { method: 'POST', duplex: 'half', headers: { Origin: 'https://site.test', 'CF-Connecting-IP': '192.0.2.40', 'Content-Type': 'application/json', ...headers }, body }), get cancelled() { return cancelled; }, get reads() { return position; } };
}

test('anonymous JSON upload is cancelled at the byte limit without buffering the rest or storing a submission', async t => {
  const env = makeEnv(t);
  const stream = streamedRequest([new Uint8Array(10000), new Uint8Array(10000), new Uint8Array(10000)]);
  const response = await worker.fetch(stream.request, env);
  assert.equal(response.status, 413); assert.equal(stream.cancelled, true); assert.equal(stream.reads, 2);
  assert.equal(env.DB.raw.prepare('SELECT count(*) n FROM records').get().n, 0);
  assert.equal(env.DB.raw.prepare('SELECT count(*) n FROM submission_limits').get().n, 0);
  const announced = streamedRequest([new Uint8Array(1)], { 'Content-Length': '15001' });
  assert.equal((await worker.fetch(announced.request, env)).status, 413);
  assert.equal(announced.cancelled, true); assert.equal(announced.reads, 0);
});

test('JSON limit counts UTF-8 bytes, accepts split multibyte characters, and rejects invalid encodings and shapes', async () => {
  const bytes = new TextEncoder().encode('{"s":"é"}');
  assert.equal(bytes.length, 10);
  const tooLarge = streamedRequest([bytes]);
  await assert.rejects(() => readJson(tooLarge.request, 9), error => error.status === 413);
  const split = streamedRequest([...bytes].map(byte => new Uint8Array([byte])));
  assert.deepEqual(await readJson(split.request, 10), { s: 'é' });
  for (const body of [new Uint8Array([0xff]), new TextEncoder().encode('null'), new TextEncoder().encode('[]')]) {
    await assert.rejects(() => readJson(streamedRequest([body]).request), error => error.status === 400);
  }
});

test('request approval and execution credentials come only from the server and scoped editors cannot authorize work', async t => {
  const env = makeEnv(t);
  const id = await create(env, { ...requestInput, payload: { request_approval: { approved_by: 'attacker@example.com', approved_version: 99 }, norcal_hq_agent: { claim_token: 'forged-token', state: 'in_progress' } } });
  const raw = env.DB.raw.prepare('SELECT * FROM records WHERE id=?').get(id);
  assert.deepEqual(JSON.parse(raw.payload).request_approval, { approved_by: owner, approved_version: 1 });
  assert.equal(JSON.parse(raw.payload).norcal_hq_agent, undefined);
  const record = await (await req(env, '/api/hq/records/' + id, owner)).json();
  assert.equal(record.payload.request_approval, undefined); assert.equal(record.mutation_id, undefined);
  await grant(env, 'editor@example.com');
  assert.equal((await req(env, '/api/hq/records/' + id, 'editor@example.com', 'PUT', { ...record, body: 'Malicious replacement' })).status, 403);
  assert.equal((await req(env, '/api/hq/records', 'editor@example.com', 'POST', requestInput)).status, 403);
  assert.equal((await req(env, '/api/hq/records', owner, 'POST', { ...requestInput, status: 'in_progress' })).status, 409);
  assert.equal(env.DB.raw.prepare('SELECT body FROM records WHERE id=?').get(id).body, requestInput.body);
});

test('an agent claim racing an owner PUT cannot overwrite the approved execution snapshot', async t => {
  const env = { ...makeEnv(t), OWNER_EMAIL: TARGET.owner };
  const id = await create(env);
  const record = await (await req(env, '/api/hq/records/' + id, TARGET.owner)).json();
  env.DB.beforeBatch = async statements => {
    if (!statements[0].sql.startsWith('UPDATE records')) return;
    env.DB.beforeBatch = null;
    env.DB.raw.exec('BEGIN');
    env.DB.raw.exec(claimSQL({ id, version: 1, token: 'race-test-private-token', now: '2026-09-12T19:00:00Z' }).join(';') + ';');
    env.DB.raw.exec('COMMIT');
  };
  const response = await req(env, '/api/hq/records/' + id, TARGET.owner, 'PUT', { ...record, body: 'Concurrent changed instructions' });
  assert.equal(response.status, 409);
  const saved = env.DB.raw.prepare('SELECT * FROM records WHERE id=?').get(id);
  assert.equal(saved.status, 'in_progress'); assert.equal(saved.version, 2); assert.equal(saved.body, requestInput.body);
  const execution = JSON.parse(env.DB.raw.prepare('SELECT snapshot FROM request_runs WHERE request_id=?').get(id).snapshot);
  assert.equal(execution.body, requestInput.body);
  const visible = await (await req(env, '/api/hq/records/' + id, TARGET.owner)).json();
  assert.doesNotMatch(JSON.stringify(visible), /race-test-private-token/);
  assert.equal((await req(env, '/api/hq/records/' + id, TARGET.owner, 'PUT', { ...visible, status: 'queued' })).status, 409);
  assert.equal((await req(env, '/api/hq/requests/' + id + '/comments', TARGET.owner, 'POST', { expected_version: 2, body: 'Keep the execution instructions unchanged.' })).status, 201);
  assert.equal(env.DB.raw.prepare('SELECT version FROM records WHERE id=?').get(id).version, 2);
});

test('owner requeue approval tracks the exact edited version and stale approvals cannot be supplied', async t => {
  const env = makeEnv(t), id = await create(env);
  const record = await (await req(env, '/api/hq/records/' + id, owner)).json();
  assert.equal((await req(env, '/api/hq/records/' + id, owner, 'PUT', { ...record, body: 'Explicit new owner instructions', payload: { request_approval: { approved_by: 'someone@example.com', approved_version: 1 } } })).status, 200);
  let saved = env.DB.raw.prepare('SELECT * FROM records WHERE id=?').get(id);
  assert.deepEqual(JSON.parse(saved.payload).request_approval, { approved_by: owner, approved_version: 2 });
  assert.equal((await req(env, '/api/hq/records/' + id, owner, 'PUT', { ...record, status: 'closed' })).status, 409);
  const latest = await (await req(env, '/api/hq/records/' + id, owner)).json();
  assert.equal((await req(env, '/api/hq/records/' + id, owner, 'PUT', { ...latest, status: 'closed' })).status, 200);
  saved = env.DB.raw.prepare('SELECT * FROM records WHERE id=?').get(id);
  assert.equal(JSON.parse(saved.payload).request_approval, undefined);
});

test('assignment filtering happens before the list limit and direct record links enforce scope', async t => {
  const env = makeEnv(t); await grant(env, 'editor@example.com');
  const id = await create(env, taskInput);
  const insert = env.DB.raw.prepare("INSERT INTO records(id,kind,title,body,region_id,status,payload,created_by,created_at,updated_at,mutation_id) VALUES(?,'task','Other region task','','other','open','{}',?,'2020-01-01','2099-01-01',?)");
  for (let index = 0; index < 600; index++) insert.run('other-' + index, owner, 'other-mutation-' + index);
  const response = await req(env, '/api/hq/records?kind=task', 'editor@example.com');
  const records = await response.json(); assert.equal(records.length, 1); assert.equal(records[0].id, id);
  assert.equal((await req(env, '/api/hq/records/' + id, 'editor@example.com')).status, 200);
  assert.equal((await req(env, '/api/hq/records/other-0', 'editor@example.com')).status, 404);
  assert.equal((await req(env, '/api/hq/records/other-0/history', 'editor@example.com')).status, 404);
});

test('record history preserves versions, rejects unauthorized reads and rolls back with failed audit', async t => {
  const env = makeEnv(t), id = await create(env, taskInput);
  let record = await (await req(env, '/api/hq/records/' + id, owner)).json();
  assert.equal((await req(env, '/api/hq/records/' + id, owner, 'PUT', { ...record, body: 'Version two' })).status, 200);
  const history = await (await req(env, '/api/hq/records/' + id + '/history', owner)).json();
  assert.deepEqual(history.map(item => item.version), [2, 1]);
  assert.equal(history[0].record.body, 'Version two'); assert.equal(history[1].record.body, taskInput.body);
  assert.ok(history.every(item => item.actor === owner));
  assert.throws(() => env.DB.raw.exec("UPDATE record_revisions SET actor='changed'"), /immutable/i);
  assert.throws(() => env.DB.raw.exec('DELETE FROM record_revisions'), /append-only/i);
  await grant(env, 'outsider@example.com', 'other');
  assert.equal((await req(env, '/api/hq/records/' + id + '/history', 'outsider@example.com')).status, 404);
  record = await (await req(env, '/api/hq/records/' + id, owner)).json();
  const beforeAudit = env.DB.raw.prepare('SELECT count(*) n FROM audit').get().n;
  env.DB.raw.exec("CREATE TRIGGER reject_audit BEFORE INSERT ON audit BEGIN SELECT RAISE(ABORT,'injected audit failure containing private data'); END");
  const response = await req(env, '/api/hq/records/' + id, owner, 'PUT', { ...record, body: 'Must roll back' });
  assert.equal(response.status, 500); assert.doesNotMatch(JSON.stringify(await response.json()), /private data|injected audit/);
  assert.equal(env.DB.raw.prepare('SELECT body FROM records WHERE id=?').get(id).body, 'Version two');
  assert.equal(env.DB.raw.prepare('SELECT count(*) n FROM audit').get().n, beforeAudit);
  assert.equal(env.DB.raw.prepare('SELECT count(*) n FROM record_revisions WHERE record_id=?').get(id).n, 2);
});

test('owner backup exports every active table as one snapshot while all private endpoints reject unsigned access', async t => {
  const env = makeEnv(t); await create(env);
  const response = await req(env, '/api/hq/export', owner);
  assert.equal(response.status, 200); assert.match(response.headers.get('Content-Disposition'), /attachment/);
  const backup = await response.json(); assert.equal(backup.schema, 3);
  for (const table of ['records', 'grants', 'audit', 'attachments', 'request_runs', 'request_entries', 'hq_agent_health', 'record_revisions']) assert.ok(Array.isArray(backup[table]), table);
  assert.equal(backup.records.length, 1); assert.equal(backup.record_revisions.length, 1);
  await grant(env, 'editor@example.com');
  assert.equal((await req(env, '/api/hq/export', 'editor@example.com')).status, 403);
  for (const path of ['/hq', '/api/hq/me', '/api/hq/agent-health', '/api/hq/export', '/api/hq/records?kind=request', '/api/hq/requests/missing/history']) {
    assert.equal((await worker.fetch(new Request('https://site.test' + path), env)).status, 401, path);
  }
});

test('request recovery endpoints enforce same-origin writes in addition to authenticated owner identity', async t => {
  const env = makeEnv(t), id = await create(env);
  const response = await req(env, '/api/hq/requests/' + id + '/comments', owner, 'POST', { expected_version: 1, body: 'Cross-origin comment' }, 'https://attacker.test');
  assert.equal(response.status, 403);
  assert.equal(env.DB.raw.prepare('SELECT count(*) n FROM request_entries').get().n, 0);
  const headers = { Origin: 'https://site.test', 'Cf-Access-Jwt-Assertion': await token(owner) };
  assert.equal((await worker.fetch(new Request('https://site.test/api/hq/requests/' + id + '/history', { method: 'DELETE', headers }), env)).status, 405);
});
