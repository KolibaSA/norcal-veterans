import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { healthSQL, acquireSQL, claimSQL, renewSQL, progressSQL, finishSQL, releaseSQL, operationSQL, assertApplied } from './request-processor.mjs';
import { workRequestAction } from '../src/work-requests.mjs';

const NOW = '2026-09-03T00:00:00.000Z', AARON = 'smartzgraphics@yahoo.com', STERLING = 'sterling.koliba@gmail.com';
class D1 {
  constructor() {
    this.sqlite = new DatabaseSync(':memory:');
    for (const file of ['0001_hq.sql', '0002_work_requests.sql']) this.sqlite.exec(readFileSync(new URL(`../migrations/${file}`, import.meta.url), 'utf8'));
  }
  execute({sql, params = []}) {
    const s = this.sqlite.prepare(sql);
    if (s.columns().length) return {results: s.all(...params).map(x => ({...x})), meta: {changes: Number(this.one('SELECT changes() AS n').n)}};
    return {results: [], meta: {changes: Number(s.run(...params).changes)}};
  }
  batch(queries) {
    this.sqlite.exec('BEGIN IMMEDIATE');
    try { const result = queries.map(q => this.execute(q)); this.sqlite.exec('COMMIT'); return result; }
    catch (error) { this.sqlite.exec('ROLLBACK'); throw error; }
  }
  prepare(sql) {
    const statement = params => ({sql, params, all: async () => this.execute({sql, params})});
    return {...statement([]), bind: (...params) => statement(params)};
  }
  one(sql, ...params) { return this.sqlite.prepare(sql).get(...params); }
  seed(id = 'a', by = AARON, date = NOW) {
    this.execute({sql: 'INSERT INTO work_requests(id,target,title,details,requested_by,last_actor,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)', params: [id, 'website', `Request ${id}`, 'Make the requested improvement.', by, by, date, date]});
  }
}
const dbFor = t => { const db = new D1(); t.after(() => db.sqlite.close()); return db; };
const owned = (db, runId = 'run-one', now = NOW) => {
  assertApplied(db.batch(acquireSQL({runId, now})));
  return assertApplied(db.batch(claimSQL({runId, now})));
};
const historyCount = db => db.one('SELECT count(*) AS n FROM work_request_messages').n;

test('Health is compact, records the check and excludes unverified request identities', t => {
  const db = dbFor(t); db.seed(); db.seed('b', 'public@example.test');
  const result = db.batch(healthSQL({now: NOW}));
  assert.deepEqual(result[1].results[0], {queued: 1, working: 0, needs_input: 0, done: 0, ignored_unverified: 1});
  assert.equal(result[2].results[0].last_checked_at, NOW);
});

test('Global ownership prevents concurrent claims and serves verified requests FIFO', t => {
  const db = dbFor(t); db.seed('unverified', 'public@example.test', '2026-01-01T00:00:00.000Z'); db.seed('second', AARON); db.seed('first', STERLING.toUpperCase(), '2026-08-31T00:00:00.000Z');
  const first = owned(db);
  assert.equal(first.id, 'first'); assert.equal(first.version, 2);
  assert.throws(() => assertApplied(db.batch(acquireSQL({runId: 'other', now: NOW}))), /ownership/);
  assert.throws(() => assertApplied(db.batch(claimSQL({runId: 'run-one', now: NOW}))), /ownership/);
  assert.throws(() => assertApplied(db.batch(releaseSQL({runId: 'run-one', now: NOW}))), /ownership/);
  assert.equal(db.one("SELECT status FROM work_requests WHERE id='second'").status, 'queued');
  assert.equal(historyCount(db), 1);
  assert.equal(db.one("SELECT count(*) AS n FROM audit WHERE actor='Chat'").n, 1);
});

test('Renewal extends both leases without changing the human-visible request version', t => {
  const db = dbFor(t); db.seed(); const request = owned(db);
  const renewed = assertApplied(db.batch(renewSQL({id: request.id, version: request.version, runId: 'run-one', now: '2026-09-03T00:20:00.000Z'})));
  assert.equal(renewed.version, request.version);
  assert.equal(renewed.claim_until, '2026-09-03T01:05:00.000Z');
  assert.equal(db.one('SELECT lock_until FROM request_processor').lock_until, renewed.claim_until);
  assert.equal(historyCount(db), 1);
});

test('Expired work can be reclaimed; the old processor can neither finish nor release the new owner', t => {
  const db = dbFor(t); db.seed(); const original = owned(db);
  const later = '2026-09-03T00:46:00.000Z', reclaimed = owned(db, 'run-two', later);
  assert.equal(reclaimed.id, original.id); assert.equal(reclaimed.version, original.version + 1);
  const before = historyCount(db);
  assert.throws(() => assertApplied(db.batch(finishSQL({id: original.id, version: original.version, runId: 'run-one', now: later, status: 'done', result: 'Stale answer'}))), /ownership/);
  assert.throws(() => assertApplied(db.batch(releaseSQL({runId: 'run-one', now: later}))), /ownership/);
  assert.equal(historyCount(db), before);
  assert.equal(db.one('SELECT lock_token FROM request_processor').lock_token, 'run-two');
});

test('A real HQ human reply invalidates stale completion, progress and renewal atomically', async t => {
  const db = dbFor(t); db.seed(); const request = owned(db);
  await workRequestAction(new URLSearchParams({action: 'work_reply', id: request.id, version: String(request.version), reply: 'Please use the revised wording instead.'}), db, AARON);
  const before = historyCount(db), current = db.one('SELECT * FROM work_requests');
  const input = {id: request.id, version: request.version, runId: 'run-one', now: NOW};
  for (const sql of [finishSQL({...input, status: 'done', result: 'Outdated work'}), progressSQL({...input, result: 'Outdated progress'}), renewSQL(input)]) {
    assert.throws(() => assertApplied(db.batch(sql)), /ownership/);
  }
  assert.equal(historyCount(db), before);
  assert.equal(db.one('SELECT result FROM work_requests').result, current.result);
  assert.equal(db.one('SELECT status FROM work_requests').status, 'queued');
  assert.equal(db.one("SELECT body FROM work_request_messages WHERE kind='reply'").body, 'Please use the revised wording instead.');
  assertApplied(db.batch(releaseSQL({runId: 'run-one', now: NOW})));
  assert.equal(db.one('SELECT lock_token FROM request_processor').lock_token, null);
});

test('A concrete suggestion survives approval, requeues and completes with full history', async t => {
  const db = dbFor(t); db.seed(); const first = owned(db);
  const paused = assertApplied(db.batch(finishSQL({id: first.id, version: first.version, runId: 'run-one', now: NOW, status: 'needs_input', result: 'Which heading should I use?', suggestion: 'Use Upcoming veteran events.'})));
  assert.equal(paused.status, 'needs_input'); assert.equal(db.one('SELECT lock_token FROM request_processor').lock_token, null);
  await workRequestAction(new URLSearchParams({action: 'work_approve', id: first.id, version: String(paused.version)}), db, STERLING);
  assert.match(db.one("SELECT body FROM work_request_messages WHERE kind='approval'").body, /Yes, do that: Use Upcoming veteran events/);
  const second = owned(db, 'run-two');
  const progress = assertApplied(db.batch(progressSQL({id: second.id, version: second.version, runId: 'run-two', now: NOW, result: 'The heading is updated; checking the live page.'})));
  const done = assertApplied(db.batch(finishSQL({id: progress.id, version: progress.version, runId: 'run-two', now: NOW, status: 'done', result: 'Updated the heading and verified the live page.', resultUrl: 'https://yolo-county-veterans.smartzgraphics.workers.dev/'})));
  assert.equal(done.status, 'done'); assert.equal(done.claim_token, null); assert.match(done.result_url, /^https:/);
  assert.equal(db.one("SELECT count(*) AS n FROM work_request_messages WHERE kind='question'").n, 1);
  assert.equal(db.one("SELECT count(*) AS n FROM work_request_messages WHERE kind='completed'").n, 1);
  assert.ok(db.one("SELECT count(*) AS n FROM revisions WHERE entity='work_request'").n >= 5);
});

test('Validation rejects incomplete outcomes and unsafe URLs before generating SQL', () => {
  const input = {id: 'a', version: 2, runId: 'one', now: NOW};
  assert.throws(() => finishSQL({...input, status: 'needs_input', result: 'Choose something'}), /suggestion/);
  assert.throws(() => finishSQL({...input, status: 'done', result: ' '}), /result/);
  assert.throws(() => finishSQL({...input, status: 'done', result: 'Finished', resultUrl: 'javascript:alert(1)'}), /HTTPS/);
  assert.throws(() => finishSQL({...input, status: 'done', result: 'Finished', resultUrl: 'https://secret:password@example.org'}), /HTTPS/);
  assert.throws(() => progressSQL({...input, version: '2', result: 'Progress'}), /integer/);
  assert.throws(() => operationSQL({operation: 'unknown'}), /Unknown/);
});

test('A failed history write rolls back the entire claim and its audit', t => {
  const db = dbFor(t); db.seed(); assertApplied(db.batch(acquireSQL({runId: 'one', now: NOW})));
  const sql = claimSQL({runId: 'one', now: NOW});
  sql[1] = {sql: "INSERT INTO work_request_messages(id,request_id,actor,kind,body,created_at) VALUES ('bad','a','Chat','invalid','No',?)", params: [NOW]};
  assert.throws(() => db.batch(sql), /CHECK constraint/);
  assert.equal(db.one('SELECT status FROM work_requests').status, 'queued');
  assert.equal(historyCount(db), 0); assert.equal(db.one('SELECT count(*) AS n FROM audit').n, 0);
});
