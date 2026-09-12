import { permitted, readScope } from './server-auth.mjs';
import { HTTPError, json, field } from './server-http.mjs';
import { statement as stmt, rows, audit, visibleRecord } from './server-storage.mjs';

const fail = (message, status = 400) => json({ error: message }, status);

// Shared persistence for the existing records schema. Feature definitions own
// statuses, content validation, scope defaults and any guarded save policy.
export async function saveRecord(input, env, user, grants, definition, existing = null) {
  if (typeof definition.sanitizePayload !== 'function') throw new TypeError('A server-owned payload policy is required.');
  const kind = definition.kind;
  if (!definition.statuses.includes(input.status)) return fail('Choose a valid section and status.');
  const id = existing?.id || crypto.randomUUID();
  definition.authorizeSave?.({ env, user, existing, status: input.status, id });
  const region = existing?.region_id || field(input.region_id, 'Region', 80, true);
  const org = existing?.organization_id ?? (definition.organizationId?.(id) || field(input.organization_id, 'Organization', 120) || null);
  const scope = existing || { region_id: region, organization_id: org };
  if (!permitted(user, grants, scope, input.status === 'published' ? 'publish' : 'write')) {
    return fail('This record is outside your assignment or requires publishing permission.', 403);
  }
  if (existing && (!Number.isInteger(input.version) || input.version !== existing.version)) {
    return fail('Someone changed this record. Your draft is preserved; compare it with the latest version.', 409);
  }
  await definition.beforeSave?.({ env, user, existing, status: input.status, id });
  const title = field(input.title, 'Title', 200, true), body = field(input.body, 'Description', 20000);
  let previous = null;
  if (existing) {
    try { previous = JSON.parse(existing.payload); } catch { previous = {}; }
  }
  const version = existing ? existing.version + 1 : 1;
  let payload;
  try {
    payload = definition.validate(input.payload || {}, { status: input.status, previousPayload: previous, isNew: !existing, actorEmail: user.email });
  } catch (error) { throw new HTTPError(error.message); }
  payload = definition.sanitizePayload(payload);
  payload = definition.authorizePayload?.(payload, { previous, status: input.status, version, user }) || payload;
  const now = new Date().toISOString(), mutation = crypto.randomUUID();
  let change;
  if (!existing) {
    change = stmt(env, `INSERT INTO records(id,kind,title,body,region_id,organization_id,status,payload,created_by,created_at,updated_at,mutation_id)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`, id, kind, title, body, region, org, input.status, JSON.stringify(payload), user.email, now, now, mutation);
  } else {
    change = stmt(env, `UPDATE records SET title=?,body=?,status=?,payload=?,updated_at=?,version=version+1,mutation_id=?
      WHERE id=? AND version=?${definition.updateGuard || ''}`,
    title, body, input.status, JSON.stringify(payload), now, mutation, id, input.version);
  }
  const result = await env.DB.batch([change, audit(env, user, existing ? 'update' : 'create', id, mutation)]);
  if (result[0].meta.changes !== 1) return fail('This record changed while saving. Compare your draft with the latest version.', 409);
  return json({ id, saved: true, version }, existing ? 200 : 201);
}

export async function listRecords(env, user, grants, definition) {
  const scope = readScope(user, grants);
  return (await rows(env, 'SELECT * FROM records WHERE kind=? AND ' + scope.sql + ' ORDER BY updated_at DESC,id DESC LIMIT 500', definition.kind, ...scope.values)).map(record => visibleRecord(record, definition.redactPayload));
}

export async function findRecord(env, user, grants, id, action = 'read') {
  const record = await stmt(env, 'SELECT * FROM records WHERE id=?', id).first();
  return record && permitted(user, grants, record, action) ? record : null;
}
