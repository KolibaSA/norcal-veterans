export const statement = (env, sql, ...values) => env.DB.prepare(sql).bind(...values);
export const rows = async (env, sql, ...values) => (await statement(env, sql, ...values).all()).results;

export function audit(env, user, action, id, mutation) {
  return statement(env, `INSERT INTO audit(id,actor,action,record_id,created_at)
    SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM records WHERE id=? AND mutation_id=?)`,
  crypto.randomUUID(), user.email, action, id, new Date().toISOString(), id, mutation);
}

export function visibleRecord(row) {
  const record = { ...row };
  try { record.payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : structuredClone(row.payload || {}); }
  catch { record.payload = {}; record.invalid_payload = true; }
  if (!record.payload || typeof record.payload !== 'object' || Array.isArray(record.payload)) {
    record.payload = {}; record.invalid_payload = true;
  }
  if (record.payload.norcal_hq_agent) delete record.payload.norcal_hq_agent.claim_token;
  delete record.payload.request_approval;
  delete record.mutation_id;
  return record;
}

export function readScope(user, grants) {
  if (user.owner) return { sql: '1', values: [] };
  const terms = [], values = [];
  for (const grant of grants) {
    if (grant.email !== user.email) continue;
    if (grant.region_id) { terms.push('region_id=?'); values.push(grant.region_id); }
    else if (grant.organization_id) { terms.push('organization_id=?'); values.push(grant.organization_id); }
  }
  return { sql: terms.length ? '(' + terms.join(' OR ') + ')' : '0', values };
}
