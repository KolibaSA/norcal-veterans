import { recordDefinitions, visibleRecord } from './record-definitions.mjs';
import { deleteRecord, saveRecord, listRecords, summarizeRecords, findRecord } from '../shared/server-records.mjs';
import { organizationScopeOptions } from '../modules/organizations/server.mjs';
import { readJson, json } from '../shared/server-http.mjs';
import { rebuildPublicOccurrences } from './public-occurrence-index.mjs';

const definitionFor = kind => Object.hasOwn(recordDefinitions, kind) ? recordDefinitions[kind] : null;
const fail = (message, status = 400) => json({ error: message }, status);

async function updateOccurrenceIndex(response, env, kind, existingId = null) {
  if (!response.ok || (kind !== 'event' && existingId !== 'vfw-ca-8151')) return response;
  try {
    const id = existingId || (await response.clone().json()).id;
    await rebuildPublicOccurrences(env.DB, 1, id);
  } catch {
    // The change was already committed. The dirty marker remains available for
    // retry; never report a failed save or expose database error details.
    console.warn(JSON.stringify({ event: 'public_occurrence_sync_pending' }));
  }
  return response;
}

// Compatibility dispatcher for the existing endpoint. Accepts the shell's
// authenticated identity and assignments; it does not contain feature rules.
export async function handleRecordRoute(req, env, user, grants, url = new URL(req.url)) {
  const path = url.pathname;
  if ((path === '/api/hq/records' || /^\/api\/hq\/records\/[^/]+$/.test(path)) && !['GET', 'HEAD'].includes(req.method) && req.headers.get('Origin') !== url.origin) return fail('Request origin rejected.', 403);
  if (path === '/api/hq/records' && req.method === 'GET') {
    const definition = definitionFor(url.searchParams.get('kind'));
    if (!definition) return fail('Unknown section.');
    if (definition.kind === 'organization' && url.searchParams.get('scope_options') === '1') return json(await organizationScopeOptions(env,user,grants,{query:url.searchParams.get('q'),page:Number(url.searchParams.get('page') || 1),ids:url.searchParams.getAll('id'),includeFamilies:url.searchParams.get('families') === '1'}));
    if (url.searchParams.get('summary') === '1') return json(await summarizeRecords(env,user,grants,definition));
    const options = url.searchParams.has('page') ? { page: url.searchParams.get('page'), query: url.searchParams.get('q'), status: url.searchParams.get('status') } : null;
    return json(await listRecords(env, user, grants, definition, options));
  }
  if (path === '/api/hq/records' && req.method === 'POST') {
    const input = await readJson(req), definition = definitionFor(input.kind);
    if (!definition) return fail('Choose a valid section and status.');
    return updateOccurrenceIndex(await saveRecord(input, env, user, grants, definition), env, definition.kind);
  }
  const match = path.match(/^\/api\/hq\/records\/([^/]+)$/);
  if (match && ['GET', 'PUT', 'DELETE'].includes(req.method)) {
    const record = await findRecord(env, user, grants, match[1], req.method === 'PUT' ? 'write' : 'read');
    if (!record) return fail('Record unavailable.', 404);
    if (req.method === 'GET') return json(visibleRecord(record));
    const definition = definitionFor(record.kind);
    if (!definition) return fail('Choose a valid section and status.');
    if (req.method === 'DELETE') return deleteRecord(await readJson(req), env, user, grants, definition, record);
    return updateOccurrenceIndex(await saveRecord(await readJson(req), env, user, grants, definition, record), env, definition.kind, record.id);
  }
  return null;
}
