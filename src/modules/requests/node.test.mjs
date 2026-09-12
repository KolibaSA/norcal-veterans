import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { TARGET, sqlText, verifyConfig, statusSQL, claimSQL, finishSQL, inspectStatus, runOperation, parseArgs } from './node.mjs';
import { handleRequestRoute } from './server.mjs';

const NOW = '2026-09-12T17:00:00.000Z';
const config = JSON.parse(readFileSync(new URL('../../../wrangler.jsonc', import.meta.url), 'utf8'));
// Split generated SQL while preserving semicolons and escaped quotes inside data.
function statements(sql) {
  const result = []; let start = 0, quoted = false;
  for (let i = 0; i < sql.length; i++) {
    if (sql[i] === "'") {
      if (quoted && sql[i + 1] === "'") i++;
      else quoted = !quoted;
    } else if (!quoted && sql[i] === ';') {
      if (sql.slice(start, i).trim()) result.push(sql.slice(start, i));
      start = i + 1;
    }
  }
  if (sql.slice(start).trim()) result.push(sql.slice(start));
  return result;
}
function fixture(t) {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../../../migrations/legacy/0001_headquarters.sql', import.meta.url), 'utf8'));
  db.exec(readFileSync(new URL('../../../migrations/legacy/0002_request_runs.sql', import.meta.url), 'utf8'));
  const root = mkdtempSync(resolve(tmpdir(), 'norcal-hq-agent-'));
  writeFileSync(resolve(root, 'wrangler.jsonc'), JSON.stringify(config));
  writeFileSync(resolve(root, '.gitignore'), '.data/\n');
  t.after(() => { db.close(); rmSync(root, { recursive: true, force: true }); });
  const batch = queries => {
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = (Array.isArray(queries) ? queries : statements(queries)).map(sql => {
        const statement = db.prepare(sql);
        const results = statement.columns().length ? statement.all().map(row => ({ ...row })) : (statement.run(), []);
        return { success: true, results };
      });
      db.exec('COMMIT'); return result;
    } catch (cause) { db.exec('ROLLBACK'); throw cause; }
  };
  const seed = (id, values = {}) => {
    const row = { kind: 'request', title: 'Requested website update', body: 'Keep this original request.', region: 'yolo-solano',
      status: 'queued', payload: JSON.stringify({existing:'keep',request_approval:{approved_by:TARGET.owner,approved_version:1}}), owner: TARGET.owner, date: NOW, version: 1, ...values };
    db.prepare('INSERT INTO records(id,kind,title,body,region_id,status,payload,created_by,created_at,updated_at,version,mutation_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)')
      .run(id, row.kind, row.title, row.body, row.region, row.status, row.payload, row.owner, row.date, row.date, row.version, 'original-' + id);
  };
  let sequence = 0;
  const deps = { root, query: batch, now: () => NOW, uuid: () => 'test-random-' + ++sequence };
  const one = id => ({ ...db.prepare('SELECT * FROM records WHERE id=?').get(id) });
  const auditCount = () => db.prepare('SELECT count(*) AS n FROM audit').get().n;
  const claim = (id, overrides = {}) => batch(claimSQL({ id, version: 1, token: 'claim-' + id, now: NOW, ...overrides }));
  const finish = (id, overrides = {}) => batch(finishSQL({ id, version: 2, token: 'claim-' + id, mutation: 'finish-' + id,
    now: NOW, status: 'completed', report: 'Implemented and verified the requested change.', ...overrides }));
  const activePath = resolve(root, '.data/norcal-hq-agent/active-claim.json');
  const run = (command, options = {}) => runOperation(command, options, deps);
  const reportFile = resolve(root, 'report.txt');
  writeFileSync(reportFile, 'Implemented and verified the requested change.');
  const finishOptions = (id = 'a') => ({ id, expectedVersion: 2, status: 'completed', reportFile });
  const DB = { prepare(sql) { let args = []; return { bind(...values) { args = values; return this; }, async first() { return db.prepare(sql).get(...args) || null; }, async all() { return {results:db.prepare(sql).all(...args)}; }, async run() { const result = db.prepare(sql).run(...args); return {meta:{changes:Number(result.changes)}}; } }; }, async batch(stmts) { db.exec('BEGIN'); try { const result = []; for (const stmt of stmts) result.push(await stmt.run()); db.exec('COMMIT'); return result; } catch(cause) { db.exec('ROLLBACK'); throw cause; } } };
  const api = (path, body, owner = true) => handleRequestRoute(new Request('https://hq.test/api/hq/' + path, { method:body ? 'POST' : 'GET', headers:{'Content-Type':'application/json',Origin:'https://hq.test'}, body:body ? JSON.stringify(body) : undefined }), {DB,OWNER_EMAIL:TARGET.owner,HQ_REQUEST_AGENT_ENABLED:'true'}, {owner,email:owner?TARGET.owner:'scoped@example.com'});
  return { db, batch, seed, one, auditCount, claim, finish, root, deps, run, activePath, reportFile, finishOptions, api };
}

test('claims only the oldest exact-owner queued request, preserving unrelated payload and body', t => {
  const f = fixture(t);
  f.seed('foreign', { owner: 'public', date: '2020-01-01' });
  f.seed('uppercase', { owner: TARGET.owner.toUpperCase(), date: '2020-01-01' });
  f.seed('task', { kind: 'task', date: '2020-01-01' });
  f.seed('later', { date: '2027-01-01' }); f.seed('first');
  const result = f.claim('first')[0].results[0];
  assert.equal(result.status, 'in_progress'); assert.equal(result.version, 2);
  assert.equal(result.body, 'Keep this original request.');
  assert.equal(JSON.parse(result.payload).existing, 'keep');
  assert.equal(f.auditCount(), 1);
  assert.equal(f.one('foreign').status, 'queued'); assert.equal(f.one('later').status, 'queued');
  assert.equal(f.db.prepare('SELECT actor FROM audit').get().actor, 'Codex NorCal HQ agent');
});

test('an owner request in progress blocks claims forever, including an old interrupted request', t => {
  const f = fixture(t); f.seed('old', { status: 'in_progress', date: '2000-01-01' }); f.seed('a');
  assert.equal(f.claim('a')[0].results.length, 0); assert.equal(f.auditCount(), 0);
  assert.equal(f.run('status').status, 'blocked'); assert.equal(f.run('claim').status, 'blocked');
  assert.equal(existsSync(f.activePath), false);
});

test('claim compares exact candidate version and oldest position before mutation', t => {
  const f = fixture(t); f.seed('a'); f.seed('b', { date: '2028-01-01' });
  assert.equal(f.claim('a', { version: 2 })[0].results.length, 0);
  assert.equal(f.claim('b')[0].results.length, 0);
  f.claim('a'); assert.equal(f.claim('b')[0].results.length, 0);
  assert.equal(f.auditCount(), 1);
});

test('finish saves separate plain text, safely escapes SQL-shaped text, and preserves original content', t => {
  const f = fixture(t); f.seed('a'); f.claim('a');
  const report = "Owner's update; '); DELETE FROM records; --\n$(Get-Secret) `literal` <script>alert(1)</script>";
  const result = f.finish('a', { report })[0].results[0];
  assert.equal(result.body, 'Keep this original request.');
  assert.equal(f.db.prepare('SELECT body FROM request_entries').get().body, report); assert.equal(result.status, 'completed'); assert.equal(result.version, 3);
  assert.equal(JSON.parse(result.payload).existing, 'keep'); assert.equal(f.auditCount(), 2);
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM records').get().n, 1);
  assert.equal(f.claim('a', { version: 3 })[0].results.length, 0);
});

test('finish rejects wrong token, stale version, wrong ID, nonowner and changed request state', t => {
  const f = fixture(t); f.seed('a'); f.claim('a');
  for (const values of [{ token: 'wrong' }, { version: 1 }, { id: 'missing' }]) {
    assert.equal(f.finish('a', values)[0].results.length, 0);
  }
  f.db.prepare('UPDATE records SET created_by=? WHERE id=?').run('someone-else', 'a');
  assert.equal(f.finish('a')[0].results.length, 0);
  f.db.prepare("UPDATE records SET created_by=?,status='queued' WHERE id=?").run(TARGET.owner, 'a');
  assert.equal(f.finish('a')[0].results.length, 0); assert.equal(f.auditCount(), 1);
});

test('needs_input does not automatically requeue; completed requests never repeat', t => {
  const f = fixture(t); f.seed('a'); f.seed('b', { date: '2028-01-01' }); f.claim('a');
  f.finish('a', { status: 'needs_input', report: 'Please provide the exact event date in HQ and set this request to queued.' });
  assert.equal(f.claim('a', { version: 3 })[0].results.length, 0);
  f.claim('b'); f.finish('b');
  const status = inspectStatus(f.batch(statusSQL()), null);
  assert.equal(status.status, 'idle'); assert.equal(status.counts.needs_input, 1); assert.equal(status.counts.completed, 1);
});

test('audit failure rolls back the complete claim batch', t => {
  const f = fixture(t); f.seed('a');
  f.db.exec("CREATE TRIGGER fail_audit BEFORE INSERT ON audit BEGIN SELECT RAISE(ABORT,'audit unavailable'); END");
  assert.throws(() => f.claim('a'), /audit unavailable/);
  assert.equal(f.one('a').status, 'queued'); assert.equal(f.one('a').version, 1); assert.equal(f.auditCount(), 0);
});

test('a maximum-length original request finishes with its result stored separately', t => {
  const f = fixture(t); f.seed('a', { body: 'x'.repeat(20000) }); f.claim('a');
  assert.equal(f.finish('a')[0].results.length, 1);
  assert.equal(f.one('a').body.length, 20000); assert.equal(f.one('a').status, 'completed'); assert.equal(f.auditCount(), 2);
});

test('target and CLI validation reject overrides, unsupported statuses, and unsafe values', () => {
  assert.equal(verifyConfig(config), TARGET);
  for (const change of [{ name: 'headquarters' }, { account_id: 'other' }, { vars: { OWNER_EMAIL: 'other@example.com' } },
    { d1_databases: [{ ...config.d1_databases[0], database_id: 'wrong' }] }]) {
    assert.throws(() => verifyConfig({ ...config, ...change }), /Target mismatch/);
  }
  assert.throws(() => parseArgs(['claim', '--account', 'other']), /no options/);
  assert.throws(() => parseArgs(['finish', '--status', 'completed']), /requires/);
  assert.throws(() => finishSQL({ id: 'a', version: 2, token: 'x', mutation: 'm', status: 'queued', report: 'x' }), /completed or needs_input/);
  assert.throws(() => sqlText('contains\0nul'), /NUL/);
  assert.throws(() => claimSQL({ id: 'a', version: '1', token: 'x' }), /integer/);
  assert.deepEqual(parseArgs(['--help']), { help: true });
});

test('CLI persists a private claim, resumes it without another transition, and finishes exactly once', t => {
  const f = fixture(t); f.seed('a');
  assert.equal(f.run('status').status, 'ready'); assert.equal(existsSync(f.activePath), false);
  const claimed = f.run('claim'); assert.equal(claimed.status, 'resume'); assert.equal(claimed.request.id, 'a');
  assert.equal(claimed.request.payload.norcal_hq_agent.claim_token, undefined); assert.equal(claimed.request.mutation_id, undefined);
  assert.equal(JSON.parse(readFileSync(f.activePath)).phase, 'claimed');
  assert.equal(f.run('claim').status, 'resume'); assert.equal(f.auditCount(), 1);
  assert.equal(f.run('finish', f.finishOptions()).status, 'completed'); assert.equal(existsSync(f.activePath), false);
  assert.equal(f.run('claim').status, 'idle'); assert.equal(f.auditCount(), 2);
});

test('lost claim response preserves matching interrupted work and does not claim twice', t => {
  const f = fixture(t); f.seed('a'); let interrupted = true;
  f.deps.query = sql => {
    const result = f.batch(sql);
    if (interrupted && sql.startsWith('UPDATE records')) { interrupted = false; throw new Error('simulated connection loss'); }
    return result;
  };
  assert.throws(() => f.run('claim'), /connection loss/);
  assert.equal(JSON.parse(readFileSync(f.activePath)).phase, 'claiming');
  assert.equal(f.run('status').status, 'resume'); assert.equal(f.run('claim').status, 'resume'); assert.equal(f.auditCount(), 1);
});

test('failure before a claim is applied retries only the same persisted candidate', t => {
  const f = fixture(t); f.seed('a'); let interrupted = true;
  f.deps.query = sql => {
    if (interrupted && sql.startsWith('UPDATE records')) { interrupted = false; throw new Error('before sending'); }
    return f.batch(sql);
  };
  assert.throws(() => f.run('claim'), /before sending/);
  assert.equal(f.run('status').status, 'pending_claim'); assert.equal(f.run('claim').status, 'resume'); assert.equal(f.auditCount(), 1);
});

test('an owner edit before claim acquisition retires only the unused candidate without wedging the queue', t => {
  const f=fixture(t);f.seed('a');let racing=true;
  f.deps.query=sql=>{if(racing&&sql.startsWith('UPDATE records')){racing=false;f.db.exec("UPDATE records SET version=2,body='Updated queued instructions',payload=json_set(payload,'$.request_approval.approved_version',2) WHERE id='a'");}return f.batch(sql);};
  assert.throws(()=>f.run('claim'),/did not apply/);
  assert.equal(f.db.prepare('SELECT count(*) n FROM request_runs').get().n,0);
  assert.equal(f.run('status').status,'claim_superseded');
  assert.equal(f.run('claim').status,'claim_superseded');assert.equal(existsSync(f.activePath),false);
  assert.equal(f.one('a').status,'queued');assert.equal(f.run('claim').execution.body,'Updated queued instructions');
});

test('lost finish response recovers completion without appending the report or doing work again', t => {
  const f = fixture(t); f.seed('a'); f.run('claim'); let interrupted = true;
  f.deps.query = sql => {
    const result = f.batch(sql);
    if (interrupted && sql.startsWith('UPDATE records')) { interrupted = false; throw new Error('lost finish response'); }
    return result;
  };
  assert.throws(() => f.run('finish', f.finishOptions()), /lost finish response/);
  assert.equal(f.run('status').status, 'finished'); const body = f.one('a').body;
  assert.throws(() => f.run('finish', { ...f.finishOptions(), id: 'wrong' }), /match/);
  assert.equal(existsSync(f.activePath), true);
  assert.equal(f.run('finish', f.finishOptions()).status, 'already_finished');
  assert.equal(f.one('a').body, body); assert.equal(f.auditCount(), 2); assert.equal(existsSync(f.activePath), false);
});

test('a later owner edit cannot erase proof that an interrupted finish already succeeded', t => {
  const f=fixture(t);f.seed('a');f.run('claim');let interrupted=true;
  f.deps.query=sql=>{const result=f.batch(sql);if(interrupted&&sql.startsWith('UPDATE records')){interrupted=false;throw Error('lost response');}return result;};
  assert.throws(()=>f.run('finish',f.finishOptions()),/lost response/);
  f.db.exec("UPDATE records SET version=version+1,body='New owner instructions',mutation_id='new-owner-edit' WHERE id='a'");
  assert.equal(f.run('status').status,'finished');
  assert.equal(f.run('finish',f.finishOptions()).status,'already_finished');
  assert.equal(f.one('a').body,'New owner instructions');
  assert.equal(f.db.prepare('SELECT count(*) n FROM request_entries').get().n,1);
  assert.throws(()=>f.db.exec("UPDATE request_runs SET state='in_progress'"),/immutable/);
});

test('pending finish retries the saved report and prevents silently changing its contents', t => {
  const f = fixture(t); f.seed('a'); f.run('claim'); let interrupted = true;
  f.deps.query = sql => {
    if (interrupted && sql.startsWith('UPDATE records')) { interrupted = false; throw new Error('before finish'); }
    return f.batch(sql);
  };
  assert.throws(() => f.run('finish', f.finishOptions()), /before finish/);
  assert.equal(f.run('status').status, 'pending_finish');
  assert.equal(f.run('claim').status, 'pending_finish');
  writeFileSync(f.reportFile, 'Different report');
  assert.throws(() => f.run('finish', f.finishOptions()), /same status and report/);
  writeFileSync(f.reportFile, 'Implemented and verified the requested change.');
  assert.equal(f.run('finish', f.finishOptions()).status, 'completed'); assert.equal(f.auditCount(), 2);
});

test('a human edit invalidates the saved version and fails closed without clearing its claim', t => {
  const f = fixture(t); f.seed('a'); f.run('claim');
  f.db.exec("UPDATE records SET version=version+1,body='Human changed the requested work' WHERE id='a'");
  for (const command of ['status', 'claim', 'finish']) assert.throws(() => f.run(command, f.finishOptions()), /no longer matches/);
  assert.equal(existsSync(f.activePath), true); assert.equal(f.auditCount(), 1);
});

test('CLI completes a full-size request without modifying its body or losing its result', t => {
  const f = fixture(t); f.seed('a', { body: 'x'.repeat(20000) }); f.run('claim');
  assert.equal(f.run('finish', f.finishOptions()).status, 'completed');
  assert.equal(f.one('a').body.length, 20000); assert.equal(existsSync(f.activePath),false);
  assert.equal(f.db.prepare("SELECT count(*) AS n FROM request_entries WHERE kind='result'").get().n,1);
});

test('claim executes only owner-approved current instructions and preserves an immutable snapshot', t => {
  const f=fixture(t); f.seed('unapproved',{payload:'{}',date:'2000-01-01'}); f.seed('a');
  assert.equal(f.claim('unapproved')[0].results.length,0);
  const claimed=f.run('claim'); assert.equal(claimed.request.id,'a');
  assert.equal(claimed.execution.body,'Keep this original request.');
  assert.equal(claimed.execution.payload.norcal_hq_agent,undefined);
  assert.equal(claimed.execution.payload.request_approval.approved_version,1);
  assert.throws(()=>f.db.exec("UPDATE request_runs SET snapshot='{}'"),/immutable/);
  f.db.exec("UPDATE records SET version=version+1,body='A changed instruction' WHERE id='a'");
  assert.throws(()=>f.run('status'),/no longer matches/);
  assert.equal(JSON.parse(f.db.prepare('SELECT snapshot FROM request_runs').get().snapshot).body,'Keep this original request.');
});

test('comments are owner-only, append-only and do not invalidate active instructions', async t => {
  const f=fixture(t);f.seed('a');f.run('claim');
  assert.equal((await f.api('requests/a/comments',{expected_version:2,body:'Owner context'},false)).status,403);
  assert.equal((await f.api('requests/a/comments',{expected_version:1,body:'stale'})).status,409);
  assert.equal((await f.api('requests/a/comments',{expected_version:2,body:'Owner context'})).status,201);
  assert.equal(f.one('a').version,2);assert.equal(f.run('status').status,'resume');
  assert.throws(()=>f.db.exec("UPDATE request_entries SET body='changed'"),/append-only/);
  assert.throws(()=>f.db.exec('DELETE FROM request_entries'),/append-only/);
  const history=await (await f.api('requests/a/history')).json();
  assert.equal(history.entries[0].body,'Owner context');assert.equal(history.active_run.claim_token,undefined);
});

test('owner can reconcile an edited execution using exact current state; local claim retires without replay', async t => {
  const f=fixture(t);f.seed('a');f.seed('b',{date:'2028-01-01'});f.run('claim');
  f.db.exec("UPDATE records SET version=version+1,body='Owner edit during execution' WHERE id='a'");
  const history=await (await f.api('requests/a/history')).json();
  const input={expected_version:3,expected_status:'in_progress',expected_run_id:history.active_run.id,status:'completed',note:'Reviewed the deployed change: it is complete. Do not repeat it.'};
  assert.equal((await f.api('requests/a/reconcile',input,false)).status,403);
  assert.equal((await f.api('requests/a/reconcile',{...input,expected_version:2})).status,409);
  assert.equal((await f.api('requests/a/reconcile',{...input,expected_run_id:'another-run'})).status,409);
  assert.equal((await f.api('requests/a/reconcile',input)).status,200);
  assert.equal((await f.api('requests/a/reconcile',input)).status,409);
  assert.equal(f.run('status').status,'reconciled');
  assert.equal(f.run('claim').status,'reconciled');assert.equal(existsSync(f.activePath),false);
  assert.equal(f.one('b').status,'queued');assert.equal(f.one('a').body,'Owner edit during execution');
  assert.equal(f.run('claim').request.id,'b');
});

test('legacy orphan executions can be explicitly cancelled without requeueing', async t => {
  const f=fixture(t);f.seed('a',{status:'in_progress'});
  assert.equal(f.run('status').status,'blocked');
  const input={expected_version:1,expected_status:'in_progress',expected_run_id:null,status:'cancelled',note:'Inspected prior effects; no work should continue.'};
  assert.equal((await f.api('requests/a/reconcile',input)).status,200);
  assert.equal(f.one('a').status,'cancelled');assert.equal(f.run('claim').status,'idle');
  assert.equal(f.db.prepare('SELECT kind FROM request_entries').get().kind,'reconciliation');
});

test('an execution stranded by a status edit still blocks new work until explicit reconciliation', async t => {
  const f=fixture(t);f.seed('a');f.seed('b',{date:'2028-01-01'});f.claim('a');
  f.db.exec("UPDATE records SET status='needs_input',version=version+1 WHERE id='a'");
  assert.equal(f.run('status').status,'blocked');
  const history=await(await f.api('requests/a/history')).json();
  assert.equal((await f.api('requests/a/reconcile',{expected_version:3,expected_status:'needs_input',expected_run_id:history.active_run.id,status:'cancelled',note:'Reviewed and cancelled the interrupted job.'})).status,200);
  assert.equal(f.run('claim').request.id,'b');
});

test('reconciliation audit failure rolls back record, execution and note together', async t => {
  const f=fixture(t);f.seed('a');f.run('claim');
  const run=f.db.prepare('SELECT id FROM request_runs').get();
  f.db.exec("CREATE TRIGGER fail_reconcile_audit BEFORE INSERT ON audit BEGIN SELECT RAISE(ABORT,'audit unavailable'); END");
  await assert.rejects(()=>f.api('requests/a/reconcile',{expected_version:2,expected_status:'in_progress',expected_run_id:run.id,status:'cancelled',note:'Stop work.'}),/audit unavailable/);
  assert.equal(f.one('a').status,'in_progress');assert.equal(f.db.prepare('SELECT state FROM request_runs').get().state,'in_progress');
  assert.equal(f.db.prepare('SELECT count(*) n FROM request_entries').get().n,0);
});

test('check records real health while status remains read-only and errors are sanitized', async t => {
  const f=fixture(t);f.seed('a');f.run('status');
  assert.equal(f.db.prepare('SELECT count(*) n FROM hq_agent_health').get().n,0);
  assert.equal(f.run('check').status,'ready');
  let health=await (await f.api('agent-health')).json();
  assert.equal(health.last_successful_check,NOW);assert.equal(health.queued,1);
  f.run('claim');health=await (await f.api('agent-health')).json();assert.equal(health.current_request_id,'a');
  f.db.exec("UPDATE records SET version=version+1 WHERE id='a'");
  assert.throws(()=>f.run('check'),/no longer matches/);
  health=await (await f.api('agent-health')).json();assert.equal(health.state,'error');assert.equal(health.last_successful_check,NOW);
  assert.ok(health.last_error);assert.doesNotMatch(JSON.stringify(health),/claim_token|test-random/);
  assert.equal((await f.api('agent-health',undefined,false)).status,403);
});

test('a health write failure never hides a confirmed finish or reopens completed work', t => {
  const f=fixture(t);f.seed('a');f.run('claim');
  f.deps.query=sql=>{if(sql.startsWith('INSERT INTO hq_agent_health'))throw Error('health transport failed');return f.batch(sql);};
  const result=f.run('finish',f.finishOptions());
  assert.equal(result.status,'completed');assert.ok(result.health_warning);
  assert.equal(existsSync(f.activePath),false);assert.equal(f.run('status').status,'idle');
  assert.equal(f.db.prepare("SELECT count(*) n FROM request_entries WHERE kind='result'").get().n,1);
});

test('malformed owner payload and multiple active owner requests fail closed', t => {
  const f = fixture(t); f.seed('a', { payload: 'not json', status: 'in_progress' });
  f.seed('b', { status: 'in_progress' });
  assert.throws(() => f.run('status'), /Multiple owner requests/);
  f.db.exec("DELETE FROM records WHERE id='b'");
  assert.equal(f.run('status').status, 'blocked');
});
