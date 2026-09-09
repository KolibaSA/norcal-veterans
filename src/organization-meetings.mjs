import {escapeHtml} from './site.mjs';
import {field,formData,pacificDate,redirect} from './storage.mjs';

const meetingMonthNames=['January','February','March','April','May','June','July','August','September','October','November','December'];
const meetingHidden=(name,value)=>`<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">`;
const meetingLocalDate=(date,time)=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw new Error('Use a valid date and time.');for(const offset of ['-07:00','-08:00']){try{return pacificDate(date+'T'+time+':00'+offset);}catch{}}throw new Error('Use a valid Pacific date and time.');};

export async function organizationMeetingRows(db,orgIds){
 if(!orgIds.length)return {plans:[],meetings:[]};const marks=orgIds.map(()=>'?').join(',');
 const [plans,meetings]=await Promise.all([db.prepare(`SELECT * FROM organization_meeting_plans WHERE org_id IN (${marks}) ORDER BY year`).bind(...orgIds).all(),db.prepare(`SELECT * FROM organization_meetings WHERE org_id IN (${marks}) ORDER BY year,month`).bind(...orgIds).all()]);
 return {plans:plans.results,meetings:meetings.results};
}

export async function organizationMeetingAction(request,env,principal,records){
 const f=await formData(request),action=field(f,'action',40,true);if(action!=='meeting_plan_save')throw new Error('Choose a valid meeting-plan action.');
 const orgId=field(f,'org_id',100,true),year=Number(field(f,'year',4,true)),planVersion=Number(field(f,'plan_version',20,true)),actor=String(principal.email||'').toLowerCase(),record=records.find(r=>r.id===orgId),now=new Date().toISOString();
 if(!record||!Number.isInteger(year)||year<2026||year>new Date().getUTCFullYear()+4||!Number.isSafeInteger(planVersion)||planVersion<0)throw new Error('Choose a valid organization and planning year.');
 const member="EXISTS(SELECT 1 FROM organization_editors WHERE email=? AND org_id=? AND status='active')",admin=principal.isAdmin===true;
 const first=planVersion===0?(admin?env.DB.prepare('INSERT INTO organization_meeting_plans(org_id,year,version,updated_by,updated_at) SELECT ?,?,1,?,? WHERE NOT EXISTS(SELECT 1 FROM organization_meeting_plans WHERE org_id=? AND year=?) RETURNING *').bind(orgId,year,actor,now,orgId,year):env.DB.prepare(`INSERT INTO organization_meeting_plans(org_id,year,version,updated_by,updated_at) SELECT ?,?,1,?,? WHERE ${member} AND NOT EXISTS(SELECT 1 FROM organization_meeting_plans WHERE org_id=? AND year=?) RETURNING *`).bind(orgId,year,actor,now,actor,orgId,orgId,year)):(admin?env.DB.prepare('UPDATE organization_meeting_plans SET version=version+1,updated_by=?,updated_at=? WHERE org_id=? AND year=? AND version=? RETURNING *').bind(actor,now,orgId,year,planVersion):env.DB.prepare(`UPDATE organization_meeting_plans SET version=version+1,updated_by=?,updated_at=? WHERE org_id=? AND year=? AND version=? AND ${member} RETURNING *`).bind(actor,now,orgId,year,planVersion,actor,orgId));
 const nextVersion=planVersion+1,guard='EXISTS(SELECT 1 FROM organization_meeting_plans WHERE org_id=? AND year=? AND version=? AND updated_by=? AND updated_at=?)',statements=[first];
 for(let month=1;month<=12;month++){
  const date=field(f,'date_'+month,10),time=field(f,'time_'+month,5),title=field(f,'title_'+month,180),notes=field(f,'notes_'+month,1800);
  if(!date&&!time&&!title&&!notes){statements.push(env.DB.prepare(`DELETE FROM organization_meetings WHERE org_id=? AND year=? AND month=? AND ${guard}`).bind(orgId,year,month,orgId,year,nextVersion,actor,now));continue;}
  if(!date||!time)throw new Error(meetingMonthNames[month-1]+' needs both a date and time.');meetingLocalDate(date,time);if(Number(date.slice(0,4))!==year||Number(date.slice(5,7))!==month)throw new Error(meetingMonthNames[month-1]+' must use a date in that month.');
  const finalTitle=title||record.verified_name+' monthly meeting',id=crypto.randomUUID();
  statements.push(env.DB.prepare(`INSERT INTO organization_meetings(id,org_id,year,month,event_date,start_time,title,notes,created_by,created_at,updated_by,updated_at,version) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,1 WHERE ${guard} ON CONFLICT(org_id,year,month) DO UPDATE SET event_date=excluded.event_date,start_time=excluded.start_time,title=excluded.title,notes=excluded.notes,updated_by=excluded.updated_by,updated_at=excluded.updated_at,version=organization_meetings.version+1 WHERE ${guard}`).bind(id,orgId,year,month,date,time,finalTitle,notes,actor,now,actor,now,orgId,year,nextVersion,actor,now,orgId,year,nextVersion,actor,now));
 }
 statements.push(env.DB.prepare(`INSERT INTO audit(id,actor,action,record_id,created_at) SELECT ?,?,'meeting_plan_save',?,? WHERE ${guard}`).bind(crypto.randomUUID(),actor,orgId+'-'+year,now,orgId,year,nextVersion,actor,now));
 const out=await env.DB.batch(statements);if(out[0].results.length!==1)throw new Error('This meeting plan changed in another session. Reload it before saving.');
 return redirect('/organization?org='+encodeURIComponent(orgId)+'&meeting_year='+year+'&meetingsaved=1#meeting-plan');
}

export function organizationMeetingPlanner(orgId,data,url){
 const e=escapeHtml,current=new Date().getUTCFullYear(),fallback=new Date().getUTCMonth()>=8?current+1:current,requested=Number(url.searchParams.get('meeting_year')),year=Number.isInteger(requested)&&requested>=current-1&&requested<=current+3?requested:fallback,plan=data.plans.find(p=>p.org_id===orgId&&p.year===year),rows=data.meetings.filter(m=>m.org_id===orgId&&m.year===year),byMonth=new Map(rows.map(r=>[r.month,r])),options=[];for(let y=current-1;y<=current+3;y++)options.push(`<option value="${y}" ${y===year?'selected':''}>${y}</option>`);
 const months=meetingMonthNames.map((name,index)=>{const month=index+1,row=byMonth.get(month);return `<fieldset class="meeting-month"><legend>${name}</legend><div class="two-up"><label>Date<input type="date" name="date_${month}" value="${e(row?.event_date||'')}"></label><label>Time<input type="time" name="time_${month}" value="${e(row?.start_time||'')}"></label></div><label>Meeting title<input name="title_${month}" maxlength="180" value="${e(row?.title||'') }" placeholder="Monthly meeting"></label><label>Meeting notes<textarea name="notes_${month}" maxlength="1800" rows="2" placeholder="Special guest, holiday meal, program or other note">${e(row?.notes||'')}</textarea></label></fieldset>`;}).join('');
 return `<section id="meeting-plan" class="organization-meeting-plan"><div class="section-heading"><div><span class="eyebrow">YEARLY MEETING PLANNER</span><h2>Plan your meetings</h2></div><span class="result-count">${rows.length} of 12 months planned</span></div>${url.searchParams.has('meetingsaved')?'<p class="preview-banner" role="status">Your yearly meeting plan is published on the calendars.</p>':''}<p>Select each meeting date and time, then add notes such as a special guest, a holiday party or a featured program. Saved meetings appear on your organization calendar and the community calendar.</p><form class="panel inline-form" method="get" action="/organization">${meetingHidden('org',orgId)}<label>Planning year<select name="meeting_year">${options.join('')}</select></label><button class="button outline">Open year</button></form><form class="edit-form meeting-plan-grid" method="post" action="/organization/meetings">${meetingHidden('action','meeting_plan_save')}${meetingHidden('org_id',orgId)}${meetingHidden('year',year)}${meetingHidden('plan_version',plan?.version||0)}${months}<button class="button meeting-plan-save">Save and publish ${year} meeting plan →</button></form></section>`;
}

