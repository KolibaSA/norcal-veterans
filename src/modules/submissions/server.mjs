import { json, readJson, field } from '../../shared/server-http.mjs';
import { statement as stmt } from '../../shared/server-storage.mjs';
const fail = (message, status = 400) => json({ error: message }, status);

export async function handleSubmission(req, env, url) {
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
