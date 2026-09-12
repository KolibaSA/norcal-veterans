// Authenticated owner-only request history and explicit recovery. The caller must
// authenticate Access identity, reject cross-origin writes and bound readJson.
const response = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
const statement = (env, sql, ...values) => env.DB.prepare(sql).bind(...values);
const fail = (json, message, status = 400) => json({ error: message }, status);
const validText = (value, limit) => typeof value === 'string' && !!value.trim() && value.length <= limit && !value.includes('\0');
const safeRun = run => {
  const { claim_token, ...visible } = run;
  let snapshot;
  try {
    snapshot = JSON.parse(visible.snapshot);
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) throw Error('Invalid snapshot');
    delete snapshot.mutation_id;
    delete snapshot.claim_token;
    if (snapshot.payload && typeof snapshot.payload === 'object') delete snapshot.payload.norcal_hq_agent;
  } catch { snapshot = { invalid_snapshot: true }; }
  return { ...visible, snapshot };
};

export async function handleRequestRoute(req, env, user, { readJson = request => request.json(), json = response, isOwner = user.owner === true } = {}) {
  const path = new URL(req.url).pathname;
  const match = path.match(/^\/api\/hq\/requests\/([^/]+)\/(history|comments|reconcile)$/);
  if (!match && path !== '/api/hq/agent-health') return null;
  if (!isOwner || user.email !== env.OWNER_EMAIL) return fail(json, 'Only the platform owner manages request execution.', 403);
  if (path === '/api/hq/agent-health') {
    if (req.method !== 'GET') return fail(json, 'Method not allowed.', 405);
    const health = await statement(env, 'SELECT * FROM hq_agent_health WHERE id=1').first();
    const current = await statement(env, "SELECT id,title FROM records WHERE kind='request' AND created_by=? AND status='in_progress' ORDER BY created_at,id LIMIT 1", env.OWNER_EMAIL).first();
    return json({ configured: env.HQ_REQUEST_AGENT_ENABLED === 'true', ...(health || { last_successful_check: null, state: 'unknown', last_error: null, last_error_at: null }), current_request_id: current?.id || null, current_request_title: current?.title || null });
  }
  const [, id, action] = match;
  const record = await statement(env, "SELECT * FROM records WHERE id=? AND kind='request' AND created_by=?", id, env.OWNER_EMAIL).first();
  if (!record) return fail(json, 'Request unavailable.', 404);
  if (action === 'history') {
    if (req.method !== 'GET') return fail(json, 'Method not allowed.', 405);
    const runs = (await statement(env, 'SELECT * FROM request_runs WHERE request_id=? ORDER BY claimed_at,id', id).all()).results.map(safeRun);
    const entries = (await statement(env, 'SELECT * FROM request_entries WHERE request_id=? ORDER BY created_at,id', id).all()).results;
    return json({ request_id: id, version: record.version, status: record.status, runs, entries, active_run: runs.find(run => run.state === 'in_progress') || null });
  }
  if (req.method !== 'POST') return fail(json, 'Method not allowed.', 405);
  const input = await readJson(req);
  if (!input || !Number.isSafeInteger(input.expected_version) || input.expected_version < 1) return fail(json, 'An exact request version is required.');
  if (record.version !== input.expected_version) return fail(json, 'The request changed. Reload and review the current state.', 409);
  const mutation = crypto.randomUUID(), now = new Date().toISOString();
  if (action === 'comments') {
    if (!validText(input.body, 12000)) return fail(json, 'Add a comment of at most 12000 characters.');
    // Comments intentionally do not change the execution revision or instructions.
    const result = await env.DB.batch([
      statement(env, "INSERT INTO request_entries(id,request_id,kind,body,actor,created_at,mutation_id) SELECT ?,id,'comment',?,?,?,? FROM records WHERE id=? AND kind='request' AND created_by=? AND version=?", mutation, input.body.trim(), user.email, now, mutation, id, env.OWNER_EMAIL, input.expected_version),
      statement(env, "INSERT INTO audit(id,actor,action,record_id,created_at) SELECT ?,?,'request_comment',?,? WHERE EXISTS(SELECT 1 FROM request_entries WHERE mutation_id=?)", mutation, user.email, id, now, mutation)
    ]);
    return result[0].meta.changes === 1 ? json({ saved: true, id: mutation }, 201) : fail(json, 'The request changed. Reload before commenting.', 409);
  }
  if (!['completed', 'needs_input', 'cancelled'].includes(input.status) || !validText(input.note, 12000)) return fail(json, 'Choose completed, needs input or cancelled and explain what work occurred.');
  if (input.expected_status !== record.status || !Object.hasOwn(input, 'expected_run_id') || (input.expected_run_id !== null && !validText(input.expected_run_id, 200))) return fail(json, 'Review the current status and execution before reconciliation.', 409);
  const active = await statement(env, "SELECT id FROM request_runs WHERE request_id=? AND state='in_progress'", id).first();
  if ((active?.id || null) !== input.expected_run_id) return fail(json, 'The active execution changed. Reload before reconciling.', 409);
  // Allow recovery of pre-migration stranded requests, and mismatched revisions.
  // A terminal execution cannot be reconciled twice or put back in the queue here.
  if (!active && record.status !== 'in_progress') return fail(json, 'There is no active or stranded execution to reconcile.', 409);
  const desiredRun = input.expected_run_id;
  const result = await env.DB.batch([
    statement(env, "UPDATE records SET status=?,version=version+1,updated_at=?,mutation_id=?,payload=json_set(payload,'$.norcal_hq_agent.state',?,'$.norcal_hq_agent.finished_at',?,'$.norcal_hq_agent.reconciled_by',?) WHERE id=? AND kind='request' AND created_by=? AND version=? AND status=? AND ((? IS NULL AND NOT EXISTS(SELECT 1 FROM request_runs WHERE request_id=? AND state='in_progress')) OR EXISTS(SELECT 1 FROM request_runs WHERE id=? AND request_id=? AND state='in_progress'))", input.status, now, mutation, input.status, now, user.email, id, env.OWNER_EMAIL, input.expected_version, input.expected_status, desiredRun, id, desiredRun, id),
    statement(env, "UPDATE request_runs SET state=?,finished_at=?,finish_mutation=?,reconciled_by=? WHERE id=? AND request_id=? AND state='in_progress' AND EXISTS(SELECT 1 FROM records WHERE id=? AND mutation_id=?)", input.status, now, mutation, user.email, desiredRun, id, id, mutation),
    statement(env, "INSERT INTO request_entries(id,request_id,run_id,kind,body,actor,status,created_at,mutation_id) SELECT ?,id,?,'reconciliation',?,?,?,?,? FROM records WHERE id=? AND mutation_id=?", mutation, desiredRun, input.note.trim(), user.email, input.status, now, mutation, id, mutation),
    statement(env, "INSERT INTO audit(id,actor,action,record_id,created_at) SELECT ?,?,'request_reconciled',id,? FROM records WHERE id=? AND mutation_id=?", mutation, user.email, now, id, mutation)
  ]);
  return result[0].meta.changes === 1 ? json({ saved: true, status: input.status, version: input.expected_version + 1 }) : fail(json, 'The execution changed. Nothing was reconciled; reload and inspect.', 409);
}
