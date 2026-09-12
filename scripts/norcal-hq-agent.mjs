import { randomUUID, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, unlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// This helper transports queue state. Request text is data, never executable code.
export const TARGET = Object.freeze({
  worker: 'norcal-veterans', account: '7a3b9bb1a94bac5dea646e821afa9aa6',
  database: '3133f3c9-0e2b-4012-9069-024c00e31d00', databaseName: 'norcal-veterans',
  owner: 'sterling.koliba@gmail.com'
});
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ACTOR = 'Codex NorCal HQ agent';
const KEY = '$.norcal_hq_agent';
const owned = `kind='request' AND created_by=${sqlText(TARGET.owner)}`;
const approved = `json_extract(payload,'$.request_approval.approved_by')=${sqlText(TARGET.owner)} AND json_extract(payload,'$.request_approval.approved_version')=version`;
const tokenAt = `json_extract(payload,'${KEY}.claim_token')`;
const hash = text => createHash('sha256').update(text).digest('hex');
const error = message => { throw new Error(message); };
const textValue = (value, name, limit = 200) => {
  if (typeof value !== 'string' || !value.trim() || value.includes('\0') || value.length > limit) error(`Invalid ${name}.`);
  return value;
};
const versionValue = value => {
  if (!Number.isSafeInteger(value) || value < 1) error('Expected version must be an exact positive integer.');
  return value;
};
const iso = value => {
  const date = new Date(value ?? Date.now());
  if (!Number.isFinite(date.getTime())) error('Invalid timestamp.');
  return date.toISOString();
};
export function sqlText(value) {
  if (typeof value !== 'string' || value.includes('\0')) throw new Error('SQL values must be text without NUL.');
  return "'" + value.replaceAll("'", "''") + "'";
}
export function verifyConfig(config) {
  const db = config.d1_databases;
  if (config.name !== TARGET.worker || config.main !== 'src/norcal-worker.mjs' ||
      config.account_id !== TARGET.account || config.vars?.OWNER_EMAIL !== TARGET.owner ||
      !Array.isArray(db) || db.length !== 1 || db[0].binding !== 'DB' ||
      db[0].database_name !== TARGET.databaseName || db[0].database_id !== TARGET.database) {
    error('Target mismatch: this helper only operates the pinned NorCal Worker, owner, account and D1 database.');
  }
  return TARGET;
}

export function statusSQL(localId) {
  return [
    `SELECT count(CASE WHEN created_by=${sqlText(TARGET.owner)} AND status='queued' THEN 1 END) AS queued,
      count(CASE WHEN created_by=${sqlText(TARGET.owner)} AND status='in_progress' THEN 1 END) AS in_progress,
      count(CASE WHEN created_by=${sqlText(TARGET.owner)} AND status='needs_input' THEN 1 END) AS needs_input,
      count(CASE WHEN created_by=${sqlText(TARGET.owner)} AND status='completed' THEN 1 END) AS completed,
      count(CASE WHEN created_by=${sqlText(TARGET.owner)} AND status='queued' AND NOT COALESCE((${approved}),0) THEN 1 END) AS awaiting_approval,
      count(CASE WHEN created_by<>${sqlText(TARGET.owner)} AND status IN ('queued','in_progress') THEN 1 END) AS ignored_other_authors
      FROM records WHERE kind='request'`,
    `SELECT id,title,created_at,version FROM records WHERE ${owned} AND status='queued' AND ${approved} ORDER BY created_at,id LIMIT 1`,
    `SELECT * FROM records WHERE ${owned} AND (status='in_progress' OR EXISTS(SELECT 1 FROM request_runs WHERE request_id=records.id AND state='in_progress')) ORDER BY created_at,id`,
    localId ? `SELECT *,EXISTS(SELECT 1 FROM request_entries WHERE request_id=records.id AND kind='reconciliation' AND mutation_id=records.mutation_id) AS owner_reconciled FROM records WHERE ${owned} AND id=${sqlText(textValue(localId, 'claim id'))}` : 'SELECT * FROM records WHERE 0',
    localId ? `SELECT * FROM request_runs WHERE request_id=${sqlText(localId)} ORDER BY claimed_at,id` : 'SELECT * FROM request_runs WHERE 0'
  ];
}
const auditSQL = (id, mutation, action, now) => `INSERT INTO audit(id,actor,action,record_id,created_at)
  SELECT ${sqlText(mutation)},${sqlText(ACTOR)},${sqlText(action)},id,${sqlText(now)} FROM records
  WHERE ${owned} AND id=${sqlText(id)} AND mutation_id=${sqlText(mutation)}
  AND NOT EXISTS(SELECT 1 FROM audit WHERE id=${sqlText(mutation)})`;
const transitionResult = (id, mutation) => `SELECT * FROM records WHERE ${owned} AND id=${sqlText(id)}
  AND mutation_id=${sqlText(mutation)} AND EXISTS(SELECT 1 FROM audit WHERE id=${sqlText(mutation)})`;
export function claimSQL(input) {
  const id = textValue(input.id, 'id'), version = versionValue(input.version);
  const token = textValue(input.token, 'claim token'), now = iso(input.now);
  const runId = textValue(input.runId ?? hash(token), 'execution id');
  const metadata = JSON.stringify({ claim_token: token, run_id: runId, claimed_at: now, claimed_version: version + 1, state: 'in_progress' });
  return [
    `UPDATE records SET status='in_progress',version=version+1,updated_at=${sqlText(now)},mutation_id=${sqlText(token)},
      payload=json_set(payload,'${KEY}',json(${sqlText(metadata)}))
      WHERE ${owned} AND id=${sqlText(id)} AND version=${version} AND status='queued'
      AND json_valid(payload) AND json_type(payload)='object'
      AND ${approved}
      AND id=(SELECT id FROM records WHERE ${owned} AND status='queued' AND ${approved} ORDER BY created_at,id LIMIT 1)
      AND NOT EXISTS(SELECT 1 FROM records WHERE ${owned} AND status='in_progress')
      AND NOT EXISTS(SELECT 1 FROM request_runs WHERE state='in_progress') RETURNING *`,
    `INSERT INTO request_runs(id,request_id,claim_token,request_version,claimed_version,snapshot,state,claimed_at)
      SELECT ${sqlText(runId)},id,${sqlText(token)},${version},${version + 1},
        json_object('id',id,'title',title,'body',body,'region_id',region_id,'organization_id',organization_id,
          'created_by',created_by,'version',${version},'payload',json_remove(payload,'${KEY}')),'in_progress',${sqlText(now)}
      FROM records WHERE ${owned} AND id=${sqlText(id)} AND mutation_id=${sqlText(token)}
      AND NOT EXISTS(SELECT 1 FROM request_runs WHERE id=${sqlText(runId)})`,
    auditSQL(id, token, 'norcal_agent_claimed', now), transitionResult(id, token)
  ];
}
export function finishSQL(input) {
  const id = textValue(input.id, 'id'), version = versionValue(input.version);
  const token = textValue(input.token, 'claim token'), mutation = textValue(input.mutation, 'mutation id');
  const now = iso(input.now), report = textValue(input.report, 'plain-text report (1–12000 characters)', 12000);
  if (!['completed', 'needs_input'].includes(input.status)) error('Finish status must be completed or needs_input.');
  return [
    `UPDATE records SET status=${sqlText(input.status)},version=version+1,
      updated_at=${sqlText(now)},mutation_id=${sqlText(mutation)},
      payload=json_set(payload,'${KEY}.state',${sqlText(input.status)},'${KEY}.finished_at',${sqlText(now)},
        '${KEY}.report_sha256',${sqlText(hash(report))})
      WHERE ${owned} AND id=${sqlText(id)} AND version=${version} AND status='in_progress'
      AND json_valid(payload) AND ${tokenAt}=${sqlText(token)}
      AND EXISTS(SELECT 1 FROM request_runs WHERE request_id=${sqlText(id)} AND claim_token=${sqlText(token)}
        AND claimed_version=${version} AND state='in_progress') RETURNING *`,
    `UPDATE request_runs SET state=${sqlText(input.status)},finished_at=${sqlText(now)},finish_mutation=${sqlText(mutation)},report_sha256=${sqlText(hash(report))}
      WHERE request_id=${sqlText(id)} AND claim_token=${sqlText(token)} AND claimed_version=${version} AND state='in_progress'
      AND EXISTS(SELECT 1 FROM records WHERE id=${sqlText(id)} AND mutation_id=${sqlText(mutation)})`,
    `INSERT INTO request_entries(id,request_id,run_id,kind,body,actor,status,created_at,mutation_id)
      SELECT ${sqlText(mutation)},request_id,id,'result',${sqlText(report)},${sqlText(ACTOR)},${sqlText(input.status)},${sqlText(now)},${sqlText(mutation)}
      FROM request_runs WHERE request_id=${sqlText(id)} AND finish_mutation=${sqlText(mutation)}
      AND NOT EXISTS(SELECT 1 FROM request_entries WHERE mutation_id=${sqlText(mutation)})`,
    auditSQL(id, mutation, `norcal_agent_${input.status}`, now), transitionResult(id, mutation)
  ];
}

function parseRow(row) {
  if (!row) return null;
  let payload;
  try { payload = JSON.parse(row.payload); } catch { error('Malformed request payload; stop and inspect HQ.'); }
  if (!payload || Array.isArray(payload) || typeof payload !== 'object') error('Request payload must be an object.');
  return { ...row, payload };
}
function publicClaim(claim) {
  return claim && { id: claim.id, expected_version: claim.version, phase: claim.phase,
    claimed_at: claim.claimed_at, ...(claim.finish ? { pending_finish: {
      status: claim.finish.status, report_file: claim.finish.report_file, report_sha256: claim.finish.report_sha256
    } } : {}) };
}
function visibleRow(row) {
  if (!row) return undefined;
  const result = parseRow(row);
  if (result.payload.norcal_hq_agent) {
    result.payload = { ...result.payload, norcal_hq_agent: { ...result.payload.norcal_hq_agent } };
    delete result.payload.norcal_hq_agent.claim_token;
  }
  // mutation_id is also the token immediately after a claim.
  delete result.mutation_id;
  return result;
}
export function inspectStatus(results, claim) {
  if (!Array.isArray(results) || results.length !== 5 || results.some(r => !Array.isArray(r.results))) error('Unexpected queue response.');
  const [stats, queued, working, selected, runs] = results.map(r => r.results);
  const output = { target: TARGET.worker, counts: stats[0], next: queued[0] ?? null };
  if (working.length > 1) error('Multiple owner requests are in progress. Stop and reconcile HQ before processing.');
  if (!claim) return { ...output, status: working.length ? 'blocked' : queued.length ? 'ready' : 'idle',
    ...(working.length ? { reason: 'An owner request is already in progress without this local claim. Never reclaim it automatically.', blocked_id: working[0].id } : {}) };
  const row = parseRow(selected[0]), metadata = row?.payload.norcal_hq_agent;
  const same = metadata?.claim_token === claim.token;
  const run = runs.find(value => value.claim_token === claim.token);
  if ((run?.reconciled_by && run.state !== 'in_progress') || (!run && same && row.owner_reconciled && metadata.reconciled_by)) {
    return { ...output, status: 'reconciled', active_claim: publicClaim(claim),
      reconciliation: { run_id: run?.id ?? null, status: run?.state ?? row.status, actor: run?.reconciled_by ?? metadata.reconciled_by, finished_at: run?.finished_at ?? metadata.finished_at },
      reason: 'The owner explicitly reconciled this execution. Retire the local claim without doing or repeating its work.' };
  }
  if (claim.phase === 'claiming' && row?.status === 'queued' && row.version === claim.base_version && !working.length) {
    return { ...output, status: 'pending_claim', active_claim: publicClaim(claim), reason: 'Run claim to retry the same guarded claim; no request work has started.' };
  }
  if (claim.phase === 'claiming' && !run && !same) {
    return { ...output, status: 'claim_superseded', active_claim: publicClaim(claim),
      reason: 'The candidate changed before this claim acquired an execution. No execution exists for its token. Retire the unused local claim without doing work.' };
  }
  if (same && run?.state === 'in_progress' && row.status === 'in_progress' && row.version === claim.version && working[0]?.id === claim.id) {
    return { ...output, status: claim.phase === 'finishing' ? 'pending_finish' : 'resume',
      active_claim: publicClaim(claim), request: visibleRow(selected[0]), execution: JSON.parse(run.snapshot), run_id: run.id };
  }
  // The immutable execution outcome survives later owner edits/requeueing. Its
  // exact mutation and report digest prove the interrupted finish succeeded.
  if (claim.phase === 'finishing' && run?.state === claim.finish.status &&
      run.finish_mutation === claim.finish.mutation && run.report_sha256 === claim.finish.report_sha256 && !run.reconciled_by) {
    return { ...output, status: 'finished', active_claim: publicClaim(claim), request: visibleRow(selected[0]) };
  }
  error('Local claim no longer matches the HQ request ID, version, status, token or execution snapshot. Stop; use the owner reconciliation action in HQ after reviewing prior work.');
}

export function healthSQL(state, now, failed = false) {
  const timestamp = sqlText(iso(now));
  const allowed = ['ready','idle','blocked','resume','pending_claim','pending_finish','finished','reconciled','claim_superseded','completed','needs_input','already_finished'];
  const status = failed ? 'error' : allowed.includes(state.status) ? state.status : 'unknown';
  const message = failed ? 'Queue check failed. Inspect the local runner and reconcile any conflicting execution before proceeding.' : null;
  return `INSERT INTO hq_agent_health(id,last_successful_check,current_request_id,queued,state,last_error,last_error_at,updated_at)
    VALUES(1,${failed ? 'NULL' : timestamp},(SELECT id FROM records WHERE ${owned} AND status='in_progress' ORDER BY created_at,id LIMIT 1),
      (SELECT count(*) FROM records WHERE ${owned} AND status='queued'),${sqlText(status)},${message ? sqlText(message) : 'NULL'},${failed ? timestamp : 'NULL'},${timestamp})
    ON CONFLICT(id) DO UPDATE SET last_successful_check=${failed ? 'hq_agent_health.last_successful_check' : 'excluded.last_successful_check'},
      current_request_id=excluded.current_request_id,queued=excluded.queued,state=excluded.state,
      last_error=excluded.last_error,last_error_at=excluded.last_error_at,updated_at=excluded.updated_at`;
}

export function wranglerQuery(sql, root = ROOT) {
  const cli = resolve(root, 'node_modules/wrangler/bin/wrangler.js');
  const args = [cli, 'd1', 'execute', TARGET.databaseName, '--config', resolve(root, 'wrangler.jsonc'), '--remote', '--json', '--command', sql];
  // Leave headroom under Windows CreateProcess's command-line limit, including quoting.
  if (args.reduce((n, arg) => n + arg.length + (arg.match(/["\\]/g)?.length ?? 0) + 3, 0) > 30000) error('Query exceeds the safe argument length; shorten the report.');
  let raw;
  try {
    raw = execFileSync(process.execPath, args, {
      cwd: root, encoding: 'utf8', timeout: 120000, maxBuffer: 4 * 1024 * 1024, windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, WRANGLER_SEND_METRICS: 'false',
        ...(process.platform === 'win32' ? { NODE_USE_SYSTEM_CA: '1' } : {}) }
    });
  } catch {
    // exec errors embed argv and captured output: never expose them or credentials.
    error('Wrangler query failed or its outcome is uncertain. Existing claim was preserved. Check the authenticated Wrangler connection, then run status before retrying.');
  }
  let results;
  try { results = JSON.parse(raw); } catch { error('Wrangler returned an unreadable response. Run status before retrying.'); }
  if (!Array.isArray(results) || results.some(r => r.success === false || !Array.isArray(r.results))) error('Wrangler did not confirm the query. Run status before retrying.');
  return results;
}
function loadClaim(path) {
  if (!existsSync(path)) return null;
  let claim;
  try { claim = JSON.parse(readFileSync(path, 'utf8')); } catch { error('Local active claim is unreadable; do not replace it.'); }
  if (Object.keys(TARGET).some(key => claim.target?.[key] !== TARGET[key]) ||
      !['claiming', 'claimed', 'finishing'].includes(claim.phase)) error('Local claim target or phase is invalid.');
  textValue(claim.id, 'saved claim id'); textValue(claim.token, 'saved claim token');
  versionValue(claim.version); versionValue(claim.base_version);
  if (claim.version !== claim.base_version + 1) error('Local claim version is invalid.');
  if (claim.phase === 'finishing' && (!claim.finish || !['completed', 'needs_input'].includes(claim.finish.status))) error('Local pending finish is invalid.');
  return claim;
}
function saveClaim(path, claim, exclusive = false) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  if (exclusive) return writeFileSync(path, JSON.stringify(claim, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  const temp = path + '.' + randomUUID() + '.tmp';
  writeFileSync(temp, JSON.stringify(claim, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  renameSync(temp, path);
}
function withLock(directory, fn) {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const path = resolve(directory, 'operation.lock');
  if (existsSync(path)) {
    let pid;
    try { pid = JSON.parse(readFileSync(path, 'utf8')).pid; } catch { error('Local operation lock is unreadable.'); }
    if (!Number.isSafeInteger(pid) || pid <= 0) error('Local operation lock is invalid.');
    let gone = false;
    try { process.kill(pid, 0); } catch (cause) { gone = cause.code === 'ESRCH'; }
    if (!gone) error('Another local queue operation is active; try on the next heartbeat.');
    unlinkSync(path); // Only a dead local process lock is removed; never its request claim.
  }
  writeFileSync(path, JSON.stringify({ pid: process.pid }), { flag: 'wx', mode: 0o600 });
  try { return fn(); } finally { unlinkSync(path); }
}

export function runOperation(command, options = {}, dependencies = {}) {
  const root = dependencies.root ?? ROOT;
  verifyConfig(JSON.parse(readFileSync(resolve(root, 'wrangler.jsonc'), 'utf8')));
  if (!readFileSync(resolve(root, '.gitignore'), 'utf8').split(/\r?\n/).includes('.data/')) error('Private .data/ storage must remain ignored by Git.');
  const query = dependencies.query ?? (sql => wranglerQuery(sql, root));
  const now = () => iso(dependencies.now?.());
  const uuid = dependencies.uuid ?? randomUUID;
  const directory = resolve(root, '.data/norcal-hq-agent'), path = resolve(directory, 'active-claim.json');
  const snapshot = claim => inspectStatus(query(statusSQL(claim?.id).join(';\n') + ';'), claim);
  if (command === 'status') return snapshot(loadClaim(path));
  if (!['check', 'claim', 'finish'].includes(command)) error('Unknown command. Use --help.');
  try {
  const result = withLock(directory, () => {
    let claim = loadClaim(path), state = snapshot(claim);
    if (command === 'check') return state;
    if (command === 'finish' && claim && (options.id !== claim.id || versionValue(options.expectedVersion) !== claim.version)) {
      error('Finish ID and expected version must match the saved active claim exactly.');
    }
    if (state.status === 'finished') {
      unlinkSync(path); claim = null;
      if (command === 'finish') return { status: 'already_finished', request: state.request };
      state = snapshot(null);
    }
    if (['reconciled', 'claim_superseded'].includes(state.status)) {
      const archive = resolve(directory, 'retired');
      mkdirSync(archive, { recursive: true, mode: 0o700 });
      renameSync(path, resolve(archive, `${claim.id}-${hash(claim.token)}.json`));
      // Return without claiming anything. The next heartbeat may take new work.
      return { status: state.status, reconciliation: state.reconciliation, reason: state.reason };
    }
    if (command === 'claim') {
      if (['resume', 'pending_finish', 'blocked', 'idle'].includes(state.status)) return state;
      if (!claim) {
        claim = { target: TARGET, id: state.next.id, base_version: state.next.version, version: state.next.version + 1,
          token: uuid(), run_id: uuid(), claimed_at: now(), phase: 'claiming' };
        saveClaim(path, claim, true); // Persist before sending: a lost response can be resumed safely.
      }
      const results = query(claimSQL({ id: claim.id, version: claim.base_version, token: claim.token, runId: claim.run_id, now: claim.claimed_at }).join(';\n') + ';');
      if (results.at(-1)?.results?.length !== 1) error('Claim did not apply; local claim was retained. Run status and stop on a mismatch.');
      claim.phase = 'claimed'; saveClaim(path, claim);
      return snapshot(claim);
    }
    if (!claim || !['resume', 'pending_finish'].includes(state.status)) error('No matching active claim is available to finish.');
    if (options.id !== claim.id || versionValue(options.expectedVersion) !== claim.version) error('Finish ID and expected version must match the saved active claim exactly.');
    const reportPath = resolve(root, textValue(options.reportFile, 'report file path', 2000));
    const report = readFileSync(reportPath, 'utf8');
    textValue(report, 'plain-text report (1–12000 characters)', 12000);
    if (!['completed', 'needs_input'].includes(options.status)) error('Finish status must be completed or needs_input.');
    if (claim.phase === 'finishing') {
      if (claim.finish.status !== options.status || claim.finish.report_sha256 !== hash(report)) error('Pending finish must use the same status and report; do not repeat the completed work.');
    } else {
      claim.phase = 'finishing';
      claim.finish = { status: options.status, mutation: uuid(), at: now(), report_file: reportPath, report_sha256: hash(report) };
      saveClaim(path, claim);
    }
    const results = query(finishSQL({ id: claim.id, version: claim.version, token: claim.token, mutation: claim.finish.mutation,
      status: claim.finish.status, now: claim.finish.at, report }).join(';\n') + ';');
    if (results.at(-1)?.results?.length !== 1) error('Finish did not apply; local claim was retained. Stop and run status.');
    const verified = snapshot(claim);
    if (verified.status !== 'finished') error('Finish was not confirmed. Local claim was retained.');
    unlinkSync(path);
    return { status: options.status, request: verified.request };
  });
  try { query(healthSQL(result, now()) + ';'); }
  catch (cause) {
    if (command === 'check') throw cause;
    // A telemetry failure cannot turn a confirmed completion into an ambiguous
    // operation after its local claim was safely retired.
    return { ...result, health_warning: 'The queue operation succeeded, but its health update was not confirmed.' };
  }
  return result;
  } catch (cause) {
    // Health is best effort on failure; never replace the actual error, leak its
    // text remotely, or discard the durable claim when connectivity is uncertain.
    try { query(healthSQL({}, now(), true) + ';'); } catch {}
    throw cause;
  }
}

const HELP = `NorCal HQ request queue (existing authenticated Wrangler login required)

  node scripts/norcal-hq-agent.mjs status
  node scripts/norcal-hq-agent.mjs check
  node scripts/norcal-hq-agent.mjs claim
  node scripts/norcal-hq-agent.mjs finish --id REQUEST_ID --expected-version N --status completed|needs_input --report-file PATH

status is read-only and returns JSON. check records a real successful poll in HQ.
claim atomically takes the oldest queued request approved at its exact current
revision by the configured owner and saves immutable execution instructions.
Only one owner request may be
in progress. Interrupted matching claims resume; they never expire or reclaim.
finish saves a separate append-only plain-text result and audits the change.
The helper never interprets or executes request text, publishes, or sends messages.

Claims are private local state in ignored .data/norcal-hq-agent/active-claim.json.
Never delete a mismatched claim or repeat work to resolve an uncertain response.
Use status first. pending_finish means retry the saved report, not the work.
reconciled means the owner closed an execution after reviewing prior effects;
claim archives that local claim without replaying work or claiming another item.
claim_superseded means a concurrent edit prevented acquisition; claim archives
only that unused local candidate after confirming no execution exists for it.
No credentials, alternative accounts, database overrides or shell commands are accepted.
`;
export function parseArgs(args) {
  if (!args.length || args[0] === '--help' || args[0] === 'help') return { help: true };
  const [command, ...rest] = args;
  if (!['status', 'check', 'claim', 'finish'].includes(command)) error('Unknown command. Use --help.');
  if (command !== 'finish' && rest.length) error('status, check and claim take no options.');
  const names = { '--id': 'id', '--expected-version': 'expectedVersion', '--status': 'status', '--report-file': 'reportFile' }, options = {};
  for (let i = 0; i < rest.length; i += 2) {
    const key = names[rest[i]], value = rest[i + 1];
    if (!key || !value || Object.hasOwn(options, key)) error('Invalid or repeated option. Use --help.');
    options[key] = key === 'expectedVersion' ? (/^[1-9]\d*$/.test(value) ? Number(value) : NaN) : value;
  }
  if (command === 'finish' && Object.keys(options).length !== 4) error('finish requires --id, --expected-version, --status and --report-file.');
  return { command, options };
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const input = parseArgs(process.argv.slice(2));
    process.stdout.write(input.help ? HELP : JSON.stringify(runOperation(input.command, input.options), null, 2) + '\n');
  } catch (cause) {
    process.stderr.write(JSON.stringify({ status: 'error', error: cause.message }) + '\n');
    process.exitCode = 1;
  }
}
