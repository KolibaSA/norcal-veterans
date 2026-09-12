// This helper transports queue state. Request text is data, never executable code.
export const TARGET = Object.freeze({
  worker: 'norcal-veterans', account: '7a3b9bb1a94bac5dea646e821afa9aa6',
  database: '3133f3c9-0e2b-4012-9069-024c00e31d00', databaseName: 'norcal-veterans',
  owner: 'sterling.koliba@gmail.com'
});

// Hashing is injected by the runtime adapter; this policy has no Node dependencies.
export function createAgentPolicy({ hash }) {
const ACTOR = 'Codex NorCal HQ agent';
const KEY = '$.norcal_hq_agent';
const owned = `kind='request' AND created_by=${sqlText(TARGET.owner)}`;
const approved = `json_extract(payload,'$.request_approval.approved_by')=${sqlText(TARGET.owner)} AND json_extract(payload,'$.request_approval.approved_version')=version`;
const tokenAt = `json_extract(payload,'${KEY}.claim_token')`;
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
function sqlText(value) {
  if (typeof value !== 'string' || value.includes('\0')) throw new Error('SQL values must be text without NUL.');
  return "'" + value.replaceAll("'", "''") + "'";
}
function verifyConfig(config) {
  const db = config.d1_databases;
  if (config.name !== TARGET.worker || config.main !== 'src/norcal-worker.mjs' ||
      config.account_id !== TARGET.account || config.vars?.OWNER_EMAIL !== TARGET.owner ||
      !Array.isArray(db) || db.length !== 1 || db[0].binding !== 'DB' ||
      db[0].database_name !== TARGET.databaseName || db[0].database_id !== TARGET.database) {
    error('Target mismatch: this helper only operates the pinned NorCal Worker, owner, account and D1 database.');
  }
  return TARGET;
}

function statusSQL(localId) {
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
function claimSQL(input) {
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
function finishSQL(input) {
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
function inspectStatus(results, claim) {
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

function healthSQL(state, now, failed = false) {
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

  return { sqlText, verifyConfig, statusSQL, claimSQL, finishSQL, inspectStatus, healthSQL, error, textValue, versionValue, iso };
}
