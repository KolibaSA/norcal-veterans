import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { TARGET, sqlText, verifyConfig, statusSQL, claimSQL, finishSQL, inspectStatus, runOperation, parseArgs } from './norcal-hq-agent.mjs';

const NOW = '2026-09-12T17:00:00.000Z';
const config = JSON.parse(readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
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
  db.exec(readFileSync(new URL('../migrations/legacy/0001_headquarters.sql', import.meta.url), 'utf8'));
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
      status: 'queued', payload: '{"existing":"keep"}', owner: TARGET.owner, date: NOW, version: 1, ...values };
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
  return { db, batch, seed, one, auditCount, claim, finish, root, deps, run, activePath, reportFile, finishOptions };
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

test('finish appends plain text, safely escapes SQL-shaped text, and preserves original content', t => {
  const f = fixture(t); f.seed('a'); f.claim('a');
  const report = "Owner's update; '); DELETE FROM records; --\n$(Get-Secret) `literal` <script>alert(1)</script>";
  const result = f.finish('a', { report })[0].results[0];
  assert.ok(result.body.startsWith('Keep this original request.\n\n--- NorCal HQ agent report'));
  assert.ok(result.body.includes(report)); assert.equal(result.status, 'completed'); assert.equal(result.version, 3);
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

test('reports exceeding the editor cap fail without truncating request or completing it', t => {
  const f = fixture(t); f.seed('a', { body: 'x'.repeat(19980) }); f.claim('a');
  assert.equal(f.finish('a')[0].results.length, 0);
  assert.equal(f.one('a').body.length, 19980); assert.equal(f.one('a').status, 'in_progress'); assert.equal(f.auditCount(), 1);
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

test('CLI body cap is checked before preparing a pending finish, leaving original content intact', t => {
  const f = fixture(t); f.seed('a', { body: 'x'.repeat(19980) }); f.run('claim');
  assert.throws(() => f.run('finish', f.finishOptions()), /editor limit/);
  assert.equal(JSON.parse(readFileSync(f.activePath)).phase, 'claimed'); assert.equal(f.one('a').body.length, 19980);
});

test('malformed owner payload and multiple active owner requests fail closed', t => {
  const f = fixture(t); f.seed('a', { payload: 'not json', status: 'in_progress' });
  f.seed('b', { status: 'in_progress' });
  assert.throws(() => f.run('status'), /Multiple owner requests/);
  f.db.exec("DELETE FROM records WHERE id='b'");
  assert.equal(f.run('status').status, 'blocked');
});
