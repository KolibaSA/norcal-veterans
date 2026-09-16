import {publicOrganizationRecord,publicMeetingPlanEvents} from '../modules/organizations/public.mjs';
import {publicEventRecord,sanitizePublicEvent} from '../modules/events/public.mjs';
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
  const organizations=serialized.filter(row => row.kind === 'organization' && row.payload).map(row => row.payload);
  const planned=[];
  for(const row of rows.filter(row=>row.kind==='organization')){
    const organization=organizations.find(entry=>entry.id===row.id);if(!organization)continue;
    try{planned.push(...publicMeetingPlanEvents(row,JSON.parse(row.payload),organization).map(sanitizePublicEvent).filter(Boolean));}catch{/* A malformed private plan cannot disable public content. */}
  }
  const plannedIds=new Set(planned.map(event=>event.id));
  const events=serialized.filter(row => row.kind === 'event' && row.payload).map(row => row.payload).filter(event=>!plannedIds.has(event.id)).concat(planned);
  try {
    const invitationTable=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='organization_event_invitations'").first();
    if(invitationTable){
      const accepted=(await db.prepare("SELECT event_id,recipient_org_id FROM organization_event_invitations WHERE status='accepted' ORDER BY decision_at,created_at,id").all()).results;
      const byEvent=new Map();
      for(const row of accepted){const ids=byEvent.get(row.event_id)||[];if(!ids.includes(row.recipient_org_id))ids.push(row.recipient_org_id);byEvent.set(row.event_id,ids);}
      for(const event of events)event.accepted_organization_ids=[...new Set([...(event.accepted_organization_ids||[]),...(byEvent.get(event.id)||[])])].slice(0,24);
    }
  }catch{/* Older isolated databases may not contain the collaboration tables. */}
  events.sort((a,b)=>String(a.start_at).localeCompare(String(b.start_at))||a.id.localeCompare(b.id));
  return { records: organizations, events };
}
