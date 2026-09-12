import { json } from '../../shared/server-http.mjs';
import { statement } from '../../shared/server-storage.mjs';

// Existing private logical-export endpoint; this refactor does not invoke it.
export async function handleBackupRoute(req, env, user, path = new URL(req.url).pathname) {
  if (path !== '/api/hq/export' || req.method !== 'GET') return null;
  if (!user.owner) return json({ error: 'Owner access required.' }, 403);
  const tables = ['records', 'grants', 'audit', 'attachments', 'request_runs', 'request_entries', 'hq_agent_health', 'record_revisions'];
  const results = await env.DB.batch(tables.map(table => statement(env, 'SELECT * FROM ' + table)));
  return json({ schema: 3, exported_at: new Date().toISOString(), ...Object.fromEntries(tables.map((table, i) => [table, results[i].results])),
    note: 'Private logical snapshot. Use the documented D1 SQL export and restore verification for disaster recovery.' }, 200,
  { 'Content-Disposition': 'attachment; filename="norcal-headquarters-backup.json"' });
}
