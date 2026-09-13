// Active HQ authentication, page delivery and compatibility route composition.
// Feature behavior lives behind src/modules interfaces; this is not an editor or business-rule module.
import { verifyIdentity, resolvePrivileges } from '../../src/shared/server-auth.mjs';
import headquarters, { scriptHash } from './hq-template.mjs';
import { publicPayload } from './public.mjs';
import { contentMetadata } from '../../src/app/content-metadata.mjs';
import { handleRecordRoute } from '../../src/app/hq-records.mjs';
import { handleRequestRoute } from '../../src/modules/requests/server.mjs';
import { handleAccessRoute } from '../../src/modules/access/server.mjs';
import { handleHistoryRoute } from '../../src/modules/history/server.mjs';
import { handleBackupRoute } from '../../src/modules/backup/server.mjs';
import { handleAttachments } from '../../src/modules/attachments/server.mjs';
import { handleSubmission } from '../../src/modules/submissions/server.mjs';
import { HTTPError, json, logFailure } from '../../src/shared/server-http.mjs';
import { rows as list } from '../../src/shared/server-storage.mjs';

const fail = (message, status = 400) => json({ error: message }, status);

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
        return await handleSubmission(req, env, url);
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
      user = resolvePrivileges(user, grants);
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
      const requestRoute = await handleRequestRoute(req, env, user);
      if (requestRoute) return requestRoute;
      const recordRoute = await handleRecordRoute(req, env, user, grants, url);
      if (recordRoute) return recordRoute;
      const historyRoute = await handleHistoryRoute(req, env, user, grants, path);
      if (historyRoute) return historyRoute;
      if (path === '/api/hq/access' || path.startsWith('/api/hq/access/')) return await handleAccessRoute(req, env, user, path);
      const backupRoute = await handleBackupRoute(req, env, user, path);
      if (backupRoute) return backupRoute;
      if (path === '/api/hq/attachments' || path.startsWith('/api/hq/attachments/')) return await handleAttachments(req, env, user, grants, url);
      return fail('Not found.', 404);
    } catch (error) {
      if (error instanceof HTTPError || (Number.isInteger(error.status) && error.status >= 400 && error.status < 500)) return fail(error.message, error.status);
      logFailure(requestId, operation);
      return json({ error: 'The request could not be completed. Please retry.', request_id: requestId }, 500, { 'X-Request-ID': requestId });
    }
  }
};
