import {sanitizePublicRecord,assertPublicProfilePrivacy} from './public-privacy.mjs';
import {organizationOfficerRows,sanitizePublicOfficer} from './organization-officers.mjs';
// Public output is assembled from explicit public fields. Private tables never feed the directory.
export const hqOrigin='https://yolo-county-veterans-hq.smartzgraphics.workers.dev';
export const securityHeaders={'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'strict-origin-when-cross-origin','Permissions-Policy':'camera=(), microphone=(), geolocation=()','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"};
export function safeURL(value,required=false){
 const text=String(value||'').trim(); if(!text&&!required)return '';
 let u;try{u=new URL(text);}catch{throw new Error('Use a complete https:// source or website link.');}
 if(u.protocol!=='https:'||u.username||u.password||u.href.length>2000)throw new Error('Links must use HTTPS without a username or password.');
 return u.href;
}
export function field(form,key,max=500,required=false){const s=String(form.get(key)||'').trim();if(s.length>max||s.includes('\u0000'))throw new Error(`${key.replaceAll('_',' ')} is too long or invalid.`);if(required&&!s)throw new Error(`Please provide ${key.replaceAll('_',' ')}.`);return s;}
export function choice(value,choices){if(!choices.includes(value))throw new Error('Choose a valid option.');return value;}
export function pacificDate(value){
 if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d)?-0[78]:00$/.test(value)||!Number.isFinite(Date.parse(value)))throw new Error('Use a valid ISO date with a -07:00 or -08:00 offset.');
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value)).map(p=>[p.type,p.value]));
 const actual=`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
 const input=value.slice(0,-6);if(actual!==(input.length===16?input+':00':input))throw new Error('That date or Pacific-time offset is incorrect. Check the calendar date and daylight-saving time.');
 return value;
}
export async function formData(request){
 const url=new URL(request.url);
 if(request.headers.get('Origin')!==url.origin||request.headers.get('Sec-Fetch-Site')==='cross-site')throw new Error('Please submit this form from its original page.');
 if(!request.headers.get('Content-Type')?.startsWith('application/x-www-form-urlencoded'))throw new Error('Unsupported form format.');
 const reader=request.body?.getReader();if(!reader)throw new Error('Empty form.');let size=0,chunks=[];
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>24000){await reader.cancel();throw new Error('This submission is too large.');}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 return new URLSearchParams(new TextDecoder().decode(bytes));
}
export async function publicData(db,baseRecords,baseEvents=[]){
 baseRecords=baseRecords.map(sanitizePublicRecord);
 if(!db)return {records:baseRecords,events:baseEvents};
 const [updates,eventRows,photoRows,officerRows,albumRows,presenceRows,meetingRows]=await Promise.all([db.prepare('SELECT org_id, body_json, source_url, reviewed_at FROM profile_updates').all(),db.prepare("SELECT id, body_json, status FROM events WHERE status = 'published'").all(),db.prepare('SELECT id,org_id,image_url,caption,alt_text,credit,source_url,license,license_url,album_id FROM organization_photos ORDER BY created_at,id').all(),organizationOfficerRows(db),db.prepare('SELECT id,org_id,name,description FROM organization_photo_albums ORDER BY created_at,id').all(),db.prepare("SELECT photo_id,org_id FROM organization_photo_presence WHERE status='approved' ORDER BY requested_at,id").all(),db.prepare('SELECT id,org_id,event_date,start_time,title,notes FROM organization_meetings ORDER BY event_date,id').all()]);
 const byId=new Map(updates.results.map(r=>[r.org_id,r]));
 const merged=baseRecords.map(r=>{const row=byId.get(r.id);if(!row)return r;const p=JSON.parse(row.body_json);try{assertPublicProfilePrivacy({...p,source_url:row.source_url});}catch{return r;}return sanitizePublicRecord({...r,meeting_schedule:p.meeting_schedule,member_information:p.member_information,public_contacts:{phone:p.phone||null,email:p.email||null,website:p.website||null},reviewed_update:{source_url:row.source_url,reviewed_at:row.reviewed_at}});});
 const names=new Map(merged.map(record=>[record.id,record.verified_name]));
 const publicPhotos=photoRows.results.map(photo=>{const album=albumRows.results.find(row=>row.id===photo.album_id&&row.org_id===photo.org_id);return {...photo,album:album?{id:album.id,name:album.name,description:album.description}:null,present_organizations:presenceRows.results.filter(row=>row.photo_id===photo.id&&names.has(row.org_id)).map(row=>({id:row.org_id,name:names.get(row.org_id)}))};});
 const meetingEvents=meetingRows.results.map(row=>{const org=merged.find(r=>r.id===row.org_id);if(!org)return null;let start_at='';for(const offset of ['-07:00','-08:00']){try{start_at=pacificDate(row.event_date+'T'+row.start_time+':00'+offset);break;}catch{}}if(!start_at)return null;return {id:'organization-meeting-'+row.id,title:row.title,organization_id:row.org_id,organizer:org.verified_name,kind:'Organization meeting',county:org.location_county,city:org.city||'',venue:org.address?.text||'Contact the organization for the meeting location.',start_at,end_at:null,audience:org.audience||'Contact the organization for attendance details.',description:row.notes||'Monthly organization meeting.',source_url:org.public_contacts?.website||'',source_checked:null,time_note:'Published by an authorized organization representative.',source_kind:'project_team',source_note:'Published from the organization yearly meeting planner.',status:'published'};}).filter(Boolean);
 return {records:merged.map(r=>({...sanitizePublicRecord({...r,photos:publicPhotos.filter(p=>p.org_id===r.id)}),officer_profiles:officerRows.filter(o=>o.org_id===r.id).map(sanitizePublicOfficer).filter(Boolean)})),events:[...eventRows.results.map(row=>({...JSON.parse(row.body_json),id:row.id,status:'published'})),...meetingEvents]};
}
export async function submitIntake(request,db,validIds){
 if(!db)throw new Error('The submission desk is temporarily unavailable. Please try again later.');
 const f=await formData(request);if(field(f,'website_check'))throw new Error('Submission could not be accepted.');
 if(f.get('privacy')!=='yes')throw new Error('Please confirm that your message contains public organization information only.');
 const kind=choice(field(f,'kind'),['profile','event','claim','other']),org_id=field(f,'org_id',100)||null;
 if(org_id&&!validIds.includes(org_id))throw new Error('Choose an organization from the list.');
 const title=field(f,'title',180,true),details=field(f,'details',6000,true),sender_name=field(f,'sender_name',120,true),sender_email=field(f,'sender_email',254,true),source_url=safeURL(field(f,'source_url',2000));
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sender_email))throw new Error('Please enter a valid contact email.');
 const now=new Date().toISOString(),hour=now.slice(0,13),ip=request.headers.get('CF-Connecting-IP');
 if(!ip)throw new Error('Submission could not be verified. Please try again.');
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ip+'|'+hour));
 const bucket=hour+':'+Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
 const expiry=new Date(Date.now()+86400000).toISOString();
 const checks=await db.batch([
 db.prepare('DELETE FROM intake_limits WHERE expires_at < ?').bind(now),
 db.prepare('INSERT INTO intake_limits(bucket,count,expires_at) VALUES (?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=count+1 WHERE count<5 RETURNING count').bind(bucket,expiry),
 db.prepare('INSERT INTO intake_limits(bucket,count,expires_at) SELECT ?,1,? WHERE changes()>0 ON CONFLICT(bucket) DO UPDATE SET count=count+1 WHERE count<500 RETURNING count').bind('global:'+now.slice(0,10),expiry)]);
 if(!checks[1].results.length||!checks[2].results.length)throw new Error('The submission limit has been reached. Please try again tomorrow.');
 const id=crypto.randomUUID();
 await db.prepare('INSERT INTO requests(id,kind,org_id,title,details,sender_name,sender_email,source_url,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(id,kind,org_id,title,details,sender_name,sender_email,source_url,now,now).run();return id;
}
export async function getOwner(request,env,ctx){
 // Only platform-provided identity is trusted; user-controlled email/JWT headers are ignored.
 if(!env.OWNER_EMAIL||!env.ACCESS_AUD||!ctx?.access||ctx.access.aud!==env.ACCESS_AUD)return null;
 const identity=await ctx.access.getIdentity();
 const allowed=[env.OWNER_EMAIL,...String(env.HQ_EDITOR_EMAILS||'').split(',')].map(x=>x.trim().toLowerCase()).filter(Boolean);
 return identity?.email&&allowed.includes(identity.email.toLowerCase())?identity.email:null;
}
export const responseHTML=(html,status=200,privatePage=false)=>new Response(html,{status,headers:{...securityHeaders,'Content-Type':'text/html; charset=utf-8','Cache-Control':privatePage?'no-store':'public, max-age=30',...(privatePage?{'X-Robots-Tag':'noindex, nofollow'}:{})}});
export const redirect=path=>new Response(null,{status:303,headers:{Location:path,'Cache-Control':'no-store'}});

const staticAssetParts={
 '/ysv-logo.png':3,'/og.png':1,'/logos/veterans-equine-therapy.jpg':1,'/logos/vfw.png':1,
 '/logos/american-legion.png':1,'/logos/dav.svg':1,'/logos/marine-corps-league.png':1,
 '/logos/toys-for-tots.svg':1,'/logos/rememberavet.png':1
};
const staticAssetTypes={'.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'};
export async function readStaticAsset(request,env,path){
 const count=staticAssetParts[path];if(!count||!env.ATTACHMENTS)return null;
 const pieces=[];for(let i=0;i<count;i++){const object=await env.ATTACHMENTS.get('public-static'+path+'.b64.'+i);if(!object)return null;pieces.push(await object.text());}
 const base64=pieces.join(''),bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0)),ext=path.slice(path.lastIndexOf('.'));
 return new Response(request.method==='HEAD'?null:bytes,{headers:{...securityHeaders,'Content-Type':staticAssetTypes[ext]||'application/octet-stream','Cache-Control':'public, max-age=86400, immutable'}});
}

