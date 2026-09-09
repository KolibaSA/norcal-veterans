import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Send each returned array as ONE atomic D1 batch through the authenticated
// Cloudflare connector. No credential is stored or accepted by this helper.
export const LEASE_MINUTES = 45;
export const REQUESTERS = ['smartzgraphics@yahoo.com', 'sterling.koliba@gmail.com'];
const allowed = "lower(requested_by) IN ('smartzgraphics@yahoo.com','sterling.koliba@gmail.com')";
const query = (sql, ...params) => ({ sql, params });
const required = (value, name, limit = 180) => {
  if (typeof value !== 'string' || !value.trim() || value.length > limit) throw new Error(`${name} is required (maximum ${limit} characters).`);
  return value.trim();
};
const timestamp = value => {
  const date = new Date(value ?? Date.now());
  if (!Number.isFinite(date.getTime())) throw new Error('now must be a valid timestamp.');
  return date.toISOString();
};
const context = input => {
  const now = timestamp(input.now);
  return { now, until: new Date(Date.parse(now) + LEASE_MINUTES * 60000).toISOString(), runId: required(input.runId, 'runId') };
};
const ownership = input => {
  const c = context(input);
  if (!Number.isSafeInteger(input.version) || input.version < 1) throw new Error('An exact positive integer version is required.');
  return { ...c, id: required(input.id, 'id'), version: input.version };
};
const owns = `id=? AND version=? AND status='in_progress' AND claim_token=? AND claim_until>? AND ${allowed}
 AND EXISTS(SELECT 1 FROM request_processor WHERE id='main' AND lock_token=? AND lock_until>?)`;
const ownerParams = c => [c.id, c.version, c.runId, c.now, c.runId, c.now];
const history = (c, kind, body, action) => [
  query("INSERT INTO work_request_messages(id,request_id,actor,kind,body,created_at) SELECT ?,?,'Chat',?,?,? WHERE changes()=1", randomUUID(), c.id, kind, body, c.now),
  query("INSERT INTO audit(id,actor,action,record_id,created_at) SELECT ?,'Chat',?,?,? WHERE changes()=1", randomUUID(), action, c.id, c.now)
];

export function healthSQL(input = {}) {
  const now = timestamp(input.now);
  return [
    query("UPDATE request_processor SET last_checked_at=? WHERE id='main'", now),
    query(`SELECT
      COALESCE(SUM(CASE WHEN ${allowed} AND (status='queued' OR (status='in_progress' AND (claim_until IS NULL OR claim_until<=?))) THEN 1 ELSE 0 END),0) AS queued,
      COALESCE(SUM(CASE WHEN ${allowed} AND status='in_progress' AND claim_until>? THEN 1 ELSE 0 END),0) AS working,
      COALESCE(SUM(CASE WHEN ${allowed} AND status='needs_input' THEN 1 ELSE 0 END),0) AS needs_input,
      COALESCE(SUM(CASE WHEN ${allowed} AND status='done' THEN 1 ELSE 0 END),0) AS done,
      COALESCE(SUM(CASE WHEN NOT (${allowed}) AND status IN ('queued','in_progress') THEN 1 ELSE 0 END),0) AS ignored_unverified
      FROM work_requests`, now, now),
    query("SELECT * FROM request_processor WHERE id='main'")
  ];
}

export function acquireSQL(input) {
  const c = context(input);
  return [query(`UPDATE request_processor SET lock_token=?,lock_until=?,last_checked_at=?
    WHERE id='main' AND (lock_token IS NULL OR lock_until IS NULL OR lock_until<=?)
    AND NOT EXISTS(SELECT 1 FROM work_requests WHERE status='in_progress' AND claim_until>?)
    RETURNING *`, c.runId, c.until, c.now, c.now, c.now)];
}

export function claimSQL(input) {
  const c = context(input), body = 'Chat has started working on this request.';
  return [
    query(`UPDATE work_requests SET status='in_progress',claim_token=?,claim_until=?,last_actor='Chat',
      result=?,suggestion='',result_url='',version=version+1,updated_at=?
      WHERE id=(SELECT id FROM work_requests WHERE ${allowed}
        AND (status='queued' OR (status='in_progress' AND (claim_until IS NULL OR claim_until<=?)))
        ORDER BY created_at,id LIMIT 1)
      AND EXISTS(SELECT 1 FROM request_processor WHERE id='main' AND lock_token=? AND lock_until>?)
      AND NOT EXISTS(SELECT 1 FROM work_requests WHERE status='in_progress' AND claim_until>?)
      RETURNING *`, c.runId, c.until, body, c.now, c.now, c.runId, c.now, c.now),
    query(`INSERT INTO work_request_messages(id,request_id,actor,kind,body,created_at)
      SELECT ?,id,'Chat','update',?,? FROM work_requests WHERE claim_token=? AND status='in_progress' AND changes()=1`, randomUUID(), body, c.now, c.runId),
    query(`INSERT INTO audit(id,actor,action,record_id,created_at)
      SELECT ?,'Chat','work_request_started',id,? FROM work_requests WHERE claim_token=? AND status='in_progress' AND changes()=1`, randomUUID(), c.now, c.runId),
    query("UPDATE request_processor SET last_checked_at=?,lock_until=? WHERE id='main' AND lock_token=? AND changes()=1", c.now, c.until, c.runId),
    query(`SELECT m.* FROM work_request_messages m JOIN work_requests r ON r.id=m.request_id
      WHERE r.claim_token=? AND r.status='in_progress' ORDER BY m.created_at,m.id`, c.runId)
  ];
}

export function renewSQL(input) {
  const c = ownership(input);
  return [
    query(`UPDATE work_requests SET claim_until=?,updated_at=? WHERE ${owns} RETURNING *`, c.until, c.now, ...ownerParams(c)),
    query("UPDATE request_processor SET lock_until=?,last_checked_at=? WHERE id='main' AND lock_token=? AND changes()=1", c.until, c.now, c.runId)
  ];
}

export function progressSQL(input) {
  const c = ownership(input), result = required(input.result, 'result', 12000);
  return [
    query(`UPDATE work_requests SET result=?,last_actor='Chat',version=version+1,updated_at=? WHERE ${owns} RETURNING *`, result, c.now, ...ownerParams(c)),
    ...history(c, 'update', result, 'work_request_progress'),
    query("UPDATE request_processor SET last_checked_at=? WHERE id='main' AND lock_token=? AND changes()=1", c.now, c.runId)
  ];
}

export function finishSQL(input) {
  const c = ownership(input), status = input.status;
  if (!['done', 'needs_input'].includes(status)) throw new Error('Finish status must be done or needs_input.');
  const result = required(input.result, 'result', 12000);
  const suggestion = status === 'needs_input' ? required(input.suggestion, 'A concrete suggestion', 6000) : '';
  let resultUrl = '';
  if (input.resultUrl) {
    const url = new URL(required(input.resultUrl, 'resultUrl', 2048));
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('resultUrl must be an HTTPS URL without credentials.');
    resultUrl = url.href;
  }
  const body = status === 'needs_input' ? `${result}\n\nSuggested next step: ${suggestion}` : result;
  return [
    query(`UPDATE work_requests SET status=?,result=?,suggestion=?,result_url=?,last_actor='Chat',
      version=version+1,claim_token=NULL,claim_until=NULL,updated_at=? WHERE ${owns} RETURNING *`,
      status, result, suggestion, resultUrl, c.now, ...ownerParams(c)),
    ...history(c, status === 'done' ? 'completed' : 'question', body, `work_request_${status}`),
    query("UPDATE request_processor SET lock_token=NULL,lock_until=NULL,last_checked_at=? WHERE id='main' AND lock_token=? AND changes()=1", c.now, c.runId)
  ];
}

// Use after an empty claim or a stale human reply. An actively owned request must
// finish first; another run's lock can never be released by this operation.
export function releaseSQL(input) {
  const c = context(input);
  return [query(`UPDATE request_processor SET lock_token=NULL,lock_until=NULL,last_checked_at=?
    WHERE id='main' AND lock_token=?
    AND NOT EXISTS(SELECT 1 FROM work_requests WHERE status='in_progress' AND claim_token=? AND claim_until>?)
    RETURNING *`, c.now, c.runId, c.runId, c.now)];
}

export function operationSQL(input) {
  const builders = { health: healthSQL, acquire: acquireSQL, claim: claimSQL, renew: renewSQL, progress: progressSQL, finish: finishSQL, release: releaseSQL };
  if (!builders[input.operation]) throw new Error('Unknown processor operation.');
  return builders[input.operation](input);
}

// Check the FIRST statement, not a later SELECT or history insert. On a stale
// claim, stop work and reread the request before making any external changes.
export function assertApplied(results) {
  // RETURNING identifies the exact row; D1 meta.changes can include other writes
  // from revision triggers and is not a reliable one-row assertion.
  if (results?.[0]?.results?.length !== 1) throw new Error('Processor ownership changed or the queue is busy. No request mutation was applied.');
  return results[0].results[0];
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  if (!process.argv[2]) throw new Error('Usage: node scripts/request-processor.mjs operation.json');
  const input = JSON.parse(await readFile(resolve(process.argv[2]), 'utf8'));
  process.stdout.write(JSON.stringify({ batch: operationSQL(input) }, null, 2) + '\n');
}
