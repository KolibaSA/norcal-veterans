import { canonicalDate, canonicalInstant, contentMetadata } from '../worker/legacy/validation.mjs';
// Only organization information belongs in public output. A public web source
// does not establish consent to republish a person's contact details.
export function isRosterURL(value){
 let decoded=String(value||'');try{decoded=decodeURIComponent(decoded);}catch{/* Check the literal value too. */}
 return /(?:roster|post[-_]?officers|\/officers(?:[/?#.]|$)|post-detail)/i.test(decoded);
}
export function assertPublicProfilePrivacy(values){
 if([values.website,values.source_url].some(isRosterURL))throw new Error('Use an organization website or public notice, not a roster or officer directory containing personal information.');
 const text=[values.member_information,values.meeting_schedule].filter(Boolean).join('\n');
 if(/\b(?:member(?:ship)?|post|officer)\s+rosters?\b|\b(?:home|residential|personal)\s+(?:address|phone|mobile|email)\b/i.test(text))throw new Error('Publish organization information only. Remove rosters and personal contact details.');
}
export function sanitizePublicPhoto(photo){
 if(!photo||!/^[-_a-zA-Z0-9]{1,100}$/.test(String(photo.id||'')))return null;
 const publicURL=value=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!isRosterURL(u.href)?u.href:'';}catch{return '';}};
 const rawImageURL=photo.image_url||(typeof photo.src==='string'&&photo.src.startsWith('https://')?photo.src:'');
 const imageURL=rawImageURL?publicURL(rawImageURL):'';
 if(rawImageURL&&!imageURL)return null;
 const sourceURL=publicURL(photo.source_url);
 const src=imageURL||'/organization-photos/'+encodeURIComponent(photo.id);
 const safeId=value=>/^[-_a-zA-Z0-9]{1,100}$/.test(String(value||''));
 const album=photo.album&&safeId(photo.album.id)?{id:String(photo.album.id),name:String(photo.album.name||'').slice(0,100),description:String(photo.album.description||'').slice(0,500)}:null;
 const present_organizations=Array.isArray(photo.present_organizations)?photo.present_organizations.slice(0,12).filter(item=>safeId(item?.id)&&item?.name).map(item=>({id:String(item.id),name:String(item.name).slice(0,180)})):[];
 return {id:String(photo.id),src,caption:String(photo.caption||'').slice(0,500),alt_text:String(photo.alt_text||photo.caption||'Organization photo').slice(0,300),credit:String(photo.credit||'').slice(0,200),source_url:sourceURL,license:String(photo.license||'').slice(0,160),license_url:publicURL(photo.license_url),album,present_organizations};
}
export function sanitizePublicRecord(record){
 const out={};
 for(const name of ['id','verified_name','organization_type','entity_kind','city','location_county','hours','meeting_schedule','timezone','audience','eligibility','referral_notes','partnership_notes','member_information','verification_method','confidence'])out[name]=publicText(record?.[name],name==='member_information'?20000:4000);
 out.organization_type ||= 'Other veteran organization';
 for(const name of ['service_categories','source_ids','missing_data_flags'])out[name]=publicStrings(record?.[name]);
 const area=record?.service_area;
 out.service_area=isObject(area)?{counties:publicStrings(area.counties),cities:publicStrings(area.cities),notes:publicText(area.notes,4000)}:null;
 const address=record?.address;
 out.address=isObject(address)&&contentMetadata.addressTypes.includes(address.type)&&typeof address.text==='string'?{text:publicText(address.text,1000),type:address.type,map_eligible:address.map_eligible===true&&address.type!=='mailing'}:null;
 const contacts=isObject(record?.public_contacts)?record.public_contacts:{};
 out.public_contacts={phone:publicText(contacts.phone,80)||null,email:publicText(contacts.email,254)||null,website:publicURL(contacts.website)||null};
 const info=record?.event_information;
 out.event_information=isObject(info)?{text:publicText(info.text,4000),status:publicText(info.status,80),source_id:publicText(info.source_id,200)}:null;
 out.last_verified_date=privacyReviewDate(record?.last_verified_date);
 out.organization_confirmed_at=publicInstant(record?.organization_confirmed_at);
 out.review_source_url=publicURL(record?.review_source_url);
 out.confirmation_source_url=publicURL(record?.confirmation_source_url);
 const correction=record?.reviewed_update;
 out.reviewed_update=isObject(correction)&&publicInstant(correction.reviewed_at)&&publicURL(correction.source_url)?{reviewed_at:publicInstant(correction.reviewed_at),source_url:publicURL(correction.source_url)}:null;
 const update=record?.display_name_update;
 out.display_name_update=isObject(update)&&privacyReviewDate(update.date)?{date:privacyReviewDate(update.date),method:publicText(update.method,100),scope:publicText(update.scope,2000)}:null;
 out.officers=[];out.officers_status='not_published_for_privacy';
 if(Array.isArray(record?.photos))out.photos=record.photos.slice(0,12).map(sanitizePublicPhoto).filter(Boolean);
 return out;
}

const isObject=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const publicText=(value,max=2000)=>typeof value==='string'?value.slice(0,max):'';
const publicStrings=value=>Array.isArray(value)?value.filter(item=>typeof item==='string').slice(0,50).map(item=>item.slice(0,200)):[];
export function publicURL(value){try{if(typeof value!=='string'||value.length>2000||isRosterURL(value))return '';const u=new URL(value);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:'';}catch{return '';}}
const privacyReviewDate=value=>{try{const date=canonicalDate(value);return date<=new Date().toISOString().slice(0,10)?date:null;}catch{return null;}};
const publicInstant=value=>{try{return canonicalInstant(value);}catch{return null;}};

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
 out.source_url=publicURL(record.source_url);out.source_checked=out.source_url?privacyReviewDate(record.source_checked):null;
 out.source_kind=['public_source','project_team'].includes(record.source_kind)?record.source_kind:'public_source';
 out.status=['published','draft','archived'].includes(record.status)?record.status:'draft';
 return out;
}
