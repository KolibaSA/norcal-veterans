import { isPlatformAdmin } from '../../shared/permissions.mjs';
import { json } from '../../shared/server-http.mjs';
import { rows, visibleRecord } from '../../shared/server-storage.mjs';
import { findRecord } from '../../shared/server-records.mjs';
import { redactPayload } from '../requests/domain.mjs';

// Read-only audit and immutable revisions use the same scoped identity context
// as record reads. Request execution activity remains owned by Requests.
export async function handleHistoryRoute(req, env, user, grants, path = new URL(req.url).pathname) {
  const history = path.match(/^\/api\/hq\/records\/([^/]+)\/history$/);
  if (history && req.method === 'GET') {
    const record = await findRecord(env, user, grants, history[1]);
    if (!record) return json({ error: 'Record unavailable.' }, 404);
    return json((await rows(env, 'SELECT * FROM record_revisions WHERE record_id=? ORDER BY version DESC LIMIT 100', record.id))
      .map(({ snapshot, ...revision }) => ({ ...revision, record: visibleRecord(JSON.parse(snapshot), redactPayload) })));
  }
  if (path === '/api/hq/audit' && req.method === 'GET') {
    if (!isPlatformAdmin(user)) return json({ error: 'Platform owner or Super Admin access required.' }, 403);
    return json(await rows(env, 'SELECT * FROM audit ORDER BY created_at DESC LIMIT 200'));
  }
  return null;
}
