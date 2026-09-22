import {publicText,publicStrings,publicURL,privacyReviewDate,publicInstant} from '../../shared/public-privacy.mjs';
export function publicEventRecord(row, payload) {
  return sanitizePublicEvent({ ...payload, id: row.id, title: row.title, description: row.body,
    status: row.status, organization_id: row.organization_id || payload.organization_id || null });
}
// Every anonymous event representation uses this whitelist. Broken stored dates
// are excluded individually so a corrupt row cannot disable the calendar.
export function sanitizePublicEvent(record){
 const start=publicInstant(record?.start_at),end=record?.end_at?publicInstant(record.end_at):null;
 if(!start||(record?.end_at&&!end)||(end&&Date.parse(end)<Date.parse(start)))return null;
 const out={};
 for(const name of ['id','title','description','city','county','venue','organizer','audience','time_note','kind','organization_id','source_note'])out[name]=publicText(record?.[name],name==='description'?20000:4000);
 if(!out.id||!out.title||!out.venue)return null;
 out.kind ||= 'Community event';
 out.start_at=start;out.date_only=record.date_only===true;out.end_at=out.date_only?null:end;
 const meetingTimes=Array.isArray(record.meeting_times)?record.meeting_times.slice(0,3).filter(entry=>entry&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(entry.time)&&typeof entry.label==='string'&&entry.label.trim()).map(entry=>({time:entry.time,label:publicText(entry.label,100)})):[];
 if(out.kind==='Organization meeting'&&meetingTimes.length)out.meeting_times=meetingTimes;
 out.source_url=publicURL(record.source_url);out.source_checked=out.source_url?privacyReviewDate(record.source_checked):null;
 out.image_url=publicURL(record.image_url);
 out.volunteer_enabled=record.volunteer_enabled===true;out.volunteer_url=out.volunteer_enabled?publicURL(record.volunteer_url):'';
 out.donate_enabled=record.donate_enabled===true;out.donate_url=out.donate_enabled?publicURL(record.donate_url):'';
 out.accepted_organization_ids=publicStrings(record.accepted_organization_ids).slice(0,24);
 out.source_kind=['public_source','project_team'].includes(record.source_kind)?record.source_kind:'public_source';
 out.status=['published','draft','archived'].includes(record.status)?record.status:'draft';
 return out;
}
