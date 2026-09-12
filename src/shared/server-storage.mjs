export const statement = (env, sql, ...values) => env.DB.prepare(sql).bind(...values);
export const rows = async (env, sql, ...values) => (await statement(env, sql, ...values).all()).results;

export function audit(env, user, action, id, mutation) {
  return statement(env, `INSERT INTO audit(id,actor,action,record_id,created_at)
    SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM records WHERE id=? AND mutation_id=?)`,
  crypto.randomUUID(), user.email, action, id, new Date().toISOString(), id, mutation);
}

// Serialization requires an explicit payload policy supplied by the application
// or consuming feature. There is deliberately no permissive default.
export function visibleRecord(row, redactPayload) {
  if (typeof redactPayload !== 'function') throw new TypeError('A record redaction policy is required.');
  const record = { ...row };
  try { record.payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : structuredClone(row.payload || {}); }
  catch { record.payload = {}; record.invalid_payload = true; }
  if (!record.payload || typeof record.payload !== 'object' || Array.isArray(record.payload)) {
    record.payload = {}; record.invalid_payload = true;
  }
  record.payload = redactPayload(record.payload);
  delete record.mutation_id;
  return record;
}
