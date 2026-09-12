import { json, readJson, field } from '../../shared/server-http.mjs';
import { statement as stmt, rows as list } from '../../shared/server-storage.mjs';
const fail = (message, status = 400) => json({ error: message }, status);

export async function handleAccessRoute(req, env, user, path) {
  if (!['GET', 'HEAD'].includes(req.method) && req.headers.get('Origin') !== new URL(req.url).origin) return fail('Request origin rejected.', 403);
  if (!user.owner) return fail('Only the platform owner manages access.', 403);
  if (path === '/api/hq/access' && req.method === 'GET') return json(await list(env, 'SELECT * FROM grants ORDER BY email'));
  if (path === '/api/hq/access' && req.method === 'POST') {
    const x = await readJson(req), email = field(x.email, 'Email', 250, true).toLowerCase();
    const role = x.role, region = field(x.region_id, 'Region', 80) || null, org = field(x.organization_id, 'Organization', 120) || null;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !['region_admin', 'organization_admin', 'editor'].includes(role) ||
      !!region === !!org || (role === 'region_admin' && !region) || (role === 'organization_admin' && !org)) {
      return fail('Choose one valid region or organization assignment.');
    }
    if (org && !await stmt(env, "SELECT id FROM records WHERE id=? AND kind='organization'", org).first()) return fail('Choose an existing organization.');
    const id = crypto.randomUUID();
    await env.DB.batch([
      stmt(env, 'INSERT INTO grants(id,email,role,region_id,organization_id) VALUES(?,?,?,?,?)', id, email, role, region, org),
      stmt(env, 'INSERT INTO audit(id,actor,action,record_id,created_at) VALUES(?,?,?,?,?)', crypto.randomUUID(), user.email, 'grant', id, new Date().toISOString())
    ]);
    return json({ id }, 201);
  }
  const match = path.match(/^\/api\/hq\/access\/([^/]+)$/);
  if (match && req.method === 'DELETE') {
    await env.DB.batch([
      stmt(env, 'DELETE FROM grants WHERE id=?', match[1]),
      stmt(env, 'INSERT INTO audit(id,actor,action,record_id,created_at) VALUES(?,?,?,?,?)', crypto.randomUUID(), user.email, 'revoke', match[1], new Date().toISOString())
    ]);
    return json({ revoked: true });
  }
  return fail('Not found.', 404);
}
