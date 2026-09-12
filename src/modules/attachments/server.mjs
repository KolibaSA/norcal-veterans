import { json } from '../../shared/server-http.mjs';
import { statement as stmt, rows as list } from '../../shared/server-storage.mjs';
import { permitted } from '../../shared/server-auth.mjs';
const fail = (message, status = 400) => json({ error: message }, status);

export async function handleAttachments(req, env, user, grants, url) {
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
