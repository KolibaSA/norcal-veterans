import {publicOrganizationRecord} from '../modules/organizations/public.mjs';
import {publicEventRecord} from '../modules/events/public.mjs';
const serializers = { organization: publicOrganizationRecord, event: publicEventRecord };
export function publicPayload(r) {
 try {
  if (!r || typeof r.id !== 'string' || !/^[-_a-zA-Z0-9]{1,120}$/.test(r.id) || typeof r.title !== 'string' || typeof r.body !== 'string') return null;
  const p = typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload;
  if (!p || typeof p !== 'object' || Array.isArray(p)) return null;
  return Object.hasOwn(serializers, r.kind) ? serializers[r.kind](r, p) : null;
 } catch { return null; }
}
export async function norcalPublicData(db) {
  if (!db) throw new Error('Public storage is unavailable.');
  const rows = (await db.prepare("SELECT id,kind,title,body,status,organization_id,payload FROM records WHERE kind IN ('organization','event') AND status='published'").all()).results;
  const serialized = rows.map(row => ({ kind: row.kind, payload: publicPayload(row) }));
  const invalidCount = serialized.filter(row => !row.payload).length;
  if (invalidCount) console.warn(JSON.stringify({ event: 'public_content_rows_excluded', count: invalidCount }));
  return {
    records: serialized.filter(row => row.kind === 'organization' && row.payload).map(row => row.payload),
    events: serialized.filter(row => row.kind === 'event' && row.payload).map(row => row.payload)
  };
}
