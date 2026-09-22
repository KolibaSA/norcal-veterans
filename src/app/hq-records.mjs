import { recordDefinitions, visibleRecord } from './record-definitions.mjs';
import { deleteRecord, saveRecord, listRecords, findRecord } from '../shared/server-records.mjs';
import { readJson, json } from '../shared/server-http.mjs';

const definitionFor = kind => Object.hasOwn(recordDefinitions, kind) ? recordDefinitions[kind] : null;
const fail = (message, status = 400) => json({ error: message }, status);

// Compatibility dispatcher for the existing endpoint. Accepts the shell's
// authenticated identity and assignments; it does not contain feature rules.
export async function handleRecordRoute(req, env, user, grants, url = new URL(req.url)) {
  const path = url.pathname;
  if ((path === '/api/hq/records' || /^\/api\/hq\/records\/[^/]+$/.test(path)) && !['GET', 'HEAD'].includes(req.method) && req.headers.get('Origin') !== url.origin) return fail('Request origin rejected.', 403);
  if (path === '/api/hq/records' && req.method === 'GET') {
    const definition = definitionFor(url.searchParams.get('kind'));
    if (!definition) return fail('Unknown section.');
    return json(await listRecords(env, user, grants, definition));
  }
  if (path === '/api/hq/records' && req.method === 'POST') {
    const input = await readJson(req), definition = definitionFor(input.kind);
    if (!definition) return fail('Choose a valid section and status.');
    return saveRecord(input, env, user, grants, definition);
  }
  const match = path.match(/^\/api\/hq\/records\/([^/]+)$/);
  if (match && ['GET', 'PUT', 'DELETE'].includes(req.method)) {
    const record = await findRecord(env, user, grants, match[1], req.method === 'PUT' ? 'write' : 'read');
    if (!record) return fail('Record unavailable.', 404);
    if (req.method === 'GET') return json(visibleRecord(record));
    const definition = definitionFor(record.kind);
    if (!definition) return fail('Choose a valid section and status.');
    if (req.method === 'DELETE') return deleteRecord(await readJson(req), env, user, grants, definition, record);
    return saveRecord(await readJson(req), env, user, grants, definition, record);
  }
  return null;
}
