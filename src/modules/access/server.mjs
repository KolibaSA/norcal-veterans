import { isPlatformAdmin } from '../../shared/permissions.mjs';
import { json, readJson, field } from '../../shared/server-http.mjs';
import { statement as stmt, rows as list } from '../../shared/server-storage.mjs';
import { clerkClient } from '../../shared/clerk-auth.mjs';
const fail = (message, status = 400) => json({ error: message }, status);

export async function handleAccessRoute(req, env, user, path) {
  if (!['GET', 'HEAD'].includes(req.method) && req.headers.get('Origin') !== new URL(req.url).origin) return fail('Request origin rejected.', 403);
  if (!isPlatformAdmin(user)) return fail('Only the platform owner or a Super Admin manages access.', 403);
  const invite = path.match(/^\/api\/hq\/access\/([^/]+)\/invite$/);
  if (invite && req.method === 'POST') {
    if (env.HQ_AUTH_PROVIDER !== 'clerk') return fail('Invitations are not configured.', 503);
    const grant = await stmt(env, 'SELECT * FROM grants WHERE id=?', invite[1]).first();
    if (!grant) return fail('This assignment no longer exists.', 404);
    const recent = await stmt(env, "SELECT id FROM audit WHERE action='invite' AND record_id=? AND created_at>? LIMIT 1", grant.id, new Date(Date.now() - 60000).toISOString()).first();
    if (recent) return fail('An invitation was just sent. Please wait a minute before trying again.', 429);
    const client = clerkClient(env);
    try {
      const existing = await client.users.getUserList({ emailAddress: [grant.email], limit: 1 });
      if (existing.data.length) return json({ status: 'registered', message: 'This person already has an account and can sign in to HQ.' });
      const pending = await client.invitations.getInvitationList({ query: grant.email, status: 'pending', limit: 100 });
      if (pending.data.some(item => item.emailAddress.toLowerCase() === grant.email.toLowerCase())) return json({ status: 'pending', message: 'An invitation is already pending. Ask the person to check spam or junk.' });
      // Permissions are always resolved from grants, never invitation metadata.
      await client.invitations.createInvitation({ emailAddress: grant.email, redirectUrl: new URL('/hq/sign-up', req.url).href, expiresInDays: 7 });
    } catch { return fail('The invitation could not be sent. The assignment is saved; please try again later.', 502); }
    await stmt(env, 'INSERT INTO audit(id,actor,action,record_id,created_at) VALUES(?,?,?,?,?)', crypto.randomUUID(), user.email, 'invite', grant.id, new Date().toISOString()).run();
    return json({ status: 'invited', message: 'Invitation sent. Ask the person to check spam or junk if it does not arrive.' });
  }
  if (path === '/api/hq/access' && req.method === 'GET') return json(await list(env, 'SELECT * FROM grants ORDER BY email'));
  if (path === '/api/hq/access' && req.method === 'POST') {
    const x = await readJson(req), email = field(x.email, 'Email', 250, true).toLowerCase();
    const role = x.role, region = field(x.region_id, 'Region', 80) || null, org = field(x.organization_id, 'Organization', 120) || null;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !['super_admin', 'region_admin', 'organization_admin', 'editor'].includes(role) ||
      (role === 'super_admin' ? !!region || !!org : !!region === !!org) || (role === 'region_admin' && !region) || (role === 'organization_admin' && !org)) {
      return fail('Choose Super Admin with no scope, or one valid region or organization assignment.');
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
