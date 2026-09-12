import { verifyIdentity, permitted } from './auth.mjs';
import headquarters, { scriptHash } from './hq-template.mjs';
import { publicPayload } from './public.mjs';
import { validateRecordPayload, contentMetadata } from './validation.mjs';
import { handleRequestRoute } from './requests.mjs';
import { HTTPError, json, readJson, field, logFailure } from './http.mjs';
import { statement as stmt, rows as list, audit, visibleRecord, readScope } from './storage.mjs';

const KINDS = ['request', 'task', 'organization', 'event', 'coordination', 'library', 'submission'];
const STATUSES = {
  request: ['queued', 'in_progress', 'needs_input', 'completed', 'closed', 'cancelled'],
  task: ['open', 'in_progress', 'completed', 'closed'],
  organization: ['draft', 'published', 'archived'], event: ['draft', 'published', 'archived'],
  coordination: ['draft', 'active', 'archived'], library: ['draft', 'ready', 'archived'],
  submission: ['pending', 'reviewed', 'rejected']
};
const fail = (message, status = 400) => json({ error: message }, status);

function payloadForSave(kind, input, previous, status, version, user, isNew) {
  let payload;
  try { payload = validateRecordPayload(kind, input || {}, { status, previousPayload: previous, isNew, actorEmail: user.email }); }
  catch (error) { throw new HTTPError(error.message); }
  // Execution credentials/approval are never accepted from an editor's JSON.
  delete payload.request_approval;
  delete payload.norcal_hq_agent;
  if (kind === 'request') {
    if (previous?.norcal_hq_agent) payload.norcal_hq_agent = previous.norcal_hq_agent;
    if (status === 'queued') payload.request_approval = { approved_by: user.email, approved_version: version };
  }
  return payload;
}

async function saveRecord(req, env, user, grants, existing = null) {
  const x = await readJson(req);
  const kind = existing?.kind || x.kind;
  if (!KINDS.includes(kind) || !STATUSES[kind].includes(x.status)) return fail('Choose a valid section and status.');
  if (kind === 'request' && !user.owner) return fail('Only the owner can approve or change executable requests.', 403);
  const id = existing?.id || crypto.randomUUID();
  const region = existing?.region_id || field(x.region_id, 'Region', 80, true);
  const org = existing?.organization_id ?? (kind === 'organization' ? id : field(x.organization_id, 'Organization', 120) || null);
  const scope = existing || { region_id: region, organization_id: org };
  if (!permitted(user, grants, scope, x.status === 'published' ? 'publish' : 'write')) {
    return fail('This record is outside your assignment or requires publishing permission.', 403);
  }
  if (existing && (!Number.isInteger(x.version) || x.version !== existing.version)) {
    return fail('Someone changed this record. Your draft is preserved; compare it with the latest version.', 409);
  }
  if (kind === 'request') {
    const active = existing && await stmt(env, "SELECT id FROM request_runs WHERE request_id=? AND state='in_progress'", id).first();
    if (x.status === 'in_progress' || existing?.status === 'in_progress' || active) {
      return fail('In-progress instructions are locked. Add a comment or use Resolve stalled request after checking the work.', 409);
    }
  }
  const title = field(x.title, 'Title', 200, true), body = field(x.body, 'Description', 20000);
  let previous = null;
  if (existing) {
    try { previous = JSON.parse(existing.payload); } catch { previous = {}; }
  }
  const version = existing ? existing.version + 1 : 1;
  const payload = payloadForSave(kind, x.payload, previous, x.status, version, user, !existing);
  const now = new Date().toISOString(), mutation = crypto.randomUUID();
  let change;
  if (!existing) {
    change = stmt(env, `INSERT INTO records(id,kind,title,body,region_id,organization_id,status,payload,created_by,created_at,updated_at,mutation_id)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`, id, kind, title, body, region, org, x.status, JSON.stringify(payload), user.email, now, now, mutation);
  } else {
    // Guard the immutable execution input again inside the write, not only above.
    change = stmt(env, `UPDATE records SET title=?,body=?,status=?,payload=?,updated_at=?,version=version+1,mutation_id=?
      WHERE id=? AND version=? AND (kind<>'request' OR (status<>'in_progress' AND NOT EXISTS(
        SELECT 1 FROM request_runs WHERE request_id=records.id AND state='in_progress')))`,
    title, body, x.status, JSON.stringify(payload), now, mutation, id, x.version);
  }
  const result = await env.DB.batch([change, audit(env, user, existing ? 'update' : 'create', id, mutation)]);
  if (result[0].meta.changes !== 1) return fail('This record changed while saving. Compare your draft with the latest version.', 409);
  return json({ id, saved: true, version }, existing ? 200 : 201);
}

async function submissions(req, env, url) {
  if (!env.DB) return fail('Submissions are not available yet.', 503);
  if (req.headers.get('Origin') !== url.origin) return fail('Please use the website form.', 403);
  const x = await readJson(req, 15000);
  const title = field(x.title, 'Title', 200, true), detail = field(x.body, 'Description', 10000, true);
  if (x.website) return json({ saved: true });
  const ip = req.headers.get('CF-Connecting-IP');
  if (!ip) return fail('Submission could not be verified.', 403);
  const hour = new Date().toISOString().slice(0, 13);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip + hour));
  const hash = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
  const limited = await stmt(env, `INSERT INTO submission_limits(bucket,count) VALUES(?,1)
    ON CONFLICT(bucket) DO UPDATE SET count=count+1 RETURNING count`, hour + ':' + hash).first();
  if (limited.count > 5) return fail('Please try again later.', 429);
  await stmt(env, 'DELETE FROM submission_limits WHERE bucket < ?', new Date(Date.now() - 48 * 3600000).toISOString().slice(0, 13)).run();
  const id = crypto.randomUUID(), now = new Date().toISOString();
  await stmt(env, `INSERT INTO records(id,kind,title,body,region_id,status,payload,created_by,created_at,updated_at,mutation_id)
    VALUES(?,'submission',?,?,'yolo-solano','pending','{}','public',?,?,?)`, id, title, detail, now, now, id).run();
  return json({ saved: true, id }, 201);
}

async function accessRoute(req, env, user, path) {
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

async function attachments(req, env, user, grants, url) {
  const path = url.pathname;
  if (path === '/api/hq/attachments' && req.method === 'POST') {
    // The active project intentionally has no upload binding. Retain private
    // download support for recovery; enabling uploads needs its own implementation.
    return fail('Attachment uploads are not enabled for this project.', 503);
  }
  if (path === '/api/hq/attachments' && req.method === 'GET') {
    const id = url.searchParams.get('record_id');
    const record = await stmt(env, 'SELECT * FROM records WHERE id=?', id).first();
    if (!record || !permitted(user, grants, record)) return fail('Record unavailable.', 404);
    return json(await list(env, 'SELECT id,filename,size FROM attachments WHERE record_id=?', id));
  }
  const match = path.match(/^\/api\/hq\/attachments\/([^/]+)$/);
  if (match && req.method === 'GET') {
    const file = await stmt(env, 'SELECT * FROM attachments WHERE id=?', match[1]).first();
    const record = file && await stmt(env, 'SELECT * FROM records WHERE id=?', file.record_id).first();
    if (!record || !permitted(user, grants, record)) return fail('File unavailable.', 404);
    const object = env.FILES && await env.FILES.get(file.object_key);
    if (!object) return fail('File unavailable.', 404);
    return new Response(object.body, { headers: { 'Content-Type': 'application/octet-stream',
      'Content-Disposition': "attachment; filename*=UTF-8''" + encodeURIComponent(file.filename),
      'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
  }
  return fail('Not found.', 404);
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url), path = url.pathname, requestId = crypto.randomUUID();
    let operation = 'route';
    try {
      if (path === '/api/directory' && ['GET', 'HEAD'].includes(req.method)) {
        if (!env.DB) return fail('Directory database is not connected.', 503);
        const records = await list(env, "SELECT id,kind,title,body,status,organization_id,payload FROM records WHERE kind IN ('organization','event') AND status='published'");
        const output = [];
        for (const record of records) {
          try {
            const payload = publicPayload(record);
            if (payload) output.push({ id: record.id, kind: record.kind, payload });
          } catch { logFailure(requestId, 'public_record_omitted', 422); }
        }
        return json(output);
      }
      if (path === '/api/submissions' && req.method === 'POST') {
        operation = 'public_submission';
        return await submissions(req, env, url);
      }
      if (!(path === '/hq' || path.startsWith('/hq/') || path.startsWith('/api/hq/'))) return fail('Not found.', 404);

      operation = 'authentication';
      let user;
      try { user = await verifyIdentity(req, env); }
      catch (error) {
        return fail(error.message === 'AUTH_NOT_CONFIGURED' ? 'Headquarters sign-in is being configured. Private records are locked.' :
          'Sign in through the headquarters Cloudflare Access page.', error.message === 'AUTH_NOT_CONFIGURED' ? 503 : 401);
      }
      if (!env.DB) return fail('Headquarters database is not connected.', 503);
      const grants = user.owner ? [] : await list(env, 'SELECT * FROM grants WHERE email=?', user.email);
      if (!user.owner && !grants.length) return fail('Your account has no headquarters assignment.', 403);
      if ((path === '/hq' || path === '/hq/') && ['GET', 'HEAD'].includes(req.method)) {
        return new Response(req.method === 'HEAD' ? null : headquarters, { headers: {
          'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'private, no-store',
          'Content-Security-Policy': `default-src 'self'; script-src 'self' '${scriptHash}'; style-src 'self' 'unsafe-inline'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`,
          'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin'
        } });
      }
      if (!['GET', 'HEAD'].includes(req.method) && req.headers.get('Origin') !== url.origin) return fail('Request origin rejected.', 403);
      operation = 'headquarters';
      if (path === '/api/hq/me' && req.method === 'GET') return json({ ...user, grants, uploads: false, processorConnected: env.HQ_REQUEST_AGENT_ENABLED === 'true' });
      if (path === '/api/hq/content-metadata' && req.method === 'GET') return json(contentMetadata);
      const requestRoute = await handleRequestRoute(req, env, user, { readJson, json, isOwner: user.owner });
      if (requestRoute) return requestRoute;
      if (path === '/api/hq/records' && req.method === 'GET') {
        const kind = url.searchParams.get('kind');
        if (!KINDS.includes(kind)) return fail('Unknown section.');
        const scope = readScope(user, grants);
        return json((await list(env, 'SELECT * FROM records WHERE kind=? AND ' + scope.sql + ' ORDER BY updated_at DESC,id DESC LIMIT 500', kind, ...scope.values)).map(visibleRecord));
      }
      if (path === '/api/hq/records' && req.method === 'POST') return await saveRecord(req, env, user, grants);
      const history = path.match(/^\/api\/hq\/records\/([^/]+)\/history$/);
      if (history && req.method === 'GET') {
        const record = await stmt(env, 'SELECT * FROM records WHERE id=?', history[1]).first();
        if (!record || !permitted(user, grants, record)) return fail('Record unavailable.', 404);
        return json((await list(env, 'SELECT * FROM record_revisions WHERE record_id=? ORDER BY version DESC LIMIT 100', record.id))
          .map(({ snapshot, ...revision }) => ({ ...revision, record: visibleRecord(JSON.parse(snapshot)) })));
      }
      const match = path.match(/^\/api\/hq\/records\/([^/]+)$/);
      if (match && ['GET', 'PUT'].includes(req.method)) {
        const record = await stmt(env, 'SELECT * FROM records WHERE id=?', match[1]).first();
        if (!record || !permitted(user, grants, record, req.method === 'PUT' ? 'write' : 'read')) return fail('Record unavailable.', 404);
        return req.method === 'GET' ? json(visibleRecord(record)) : await saveRecord(req, env, user, grants, record);
      }
      if (path === '/api/hq/access' || path.startsWith('/api/hq/access/')) return await accessRoute(req, env, user, path);
      if (path === '/api/hq/audit' && req.method === 'GET') {
        if (!user.owner) return fail('Owner access required.', 403);
        return json(await list(env, 'SELECT * FROM audit ORDER BY created_at DESC LIMIT 200'));
      }
      if (path === '/api/hq/export' && req.method === 'GET') {
        if (!user.owner) return fail('Owner access required.', 403);
        const tables = ['records', 'grants', 'audit', 'attachments', 'request_runs', 'request_entries', 'hq_agent_health', 'record_revisions'];
        const results = await env.DB.batch(tables.map(table => stmt(env, 'SELECT * FROM ' + table)));
        return json({ schema: 3, exported_at: new Date().toISOString(), ...Object.fromEntries(tables.map((table, i) => [table, results[i].results])),
          note: 'Private logical snapshot. Use the documented D1 SQL export and restore verification for disaster recovery.' }, 200,
        { 'Content-Disposition': 'attachment; filename="norcal-headquarters-backup.json"' });
      }
      if (path === '/api/hq/attachments' || path.startsWith('/api/hq/attachments/')) return await attachments(req, env, user, grants, url);
      return fail('Not found.', 404);
    } catch (error) {
      if (error instanceof HTTPError || (Number.isInteger(error.status) && error.status >= 400 && error.status < 500)) return fail(error.message, error.status);
      logFailure(requestId, operation);
      return json({ error: 'The request could not be completed. Please retry.', request_id: requestId }, 500, { 'X-Request-ID': requestId });
    }
  }
};
