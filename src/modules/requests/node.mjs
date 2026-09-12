import { randomUUID, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, unlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { TARGET, createAgentPolicy } from './domain-agent.mjs';
export { TARGET };
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const hash = text => createHash('sha256').update(text).digest('hex');
const { error, textValue, versionValue, iso, ...policy } = createAgentPolicy({ hash });
export const { sqlText, verifyConfig, statusSQL, claimSQL, finishSQL, inspectStatus, healthSQL } = policy;

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

export const HELP = `NorCal HQ request queue (existing authenticated Wrangler login required)

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
