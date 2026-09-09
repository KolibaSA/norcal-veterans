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
 const keys=['id','verified_name','organization_type','entity_kind','city','location_county','service_area','hours','meeting_schedule','timezone','service_categories','audience','eligibility','event_information','referral_notes','partnership_notes','member_information','source_ids','last_verified_date','verification_method','organization_confirmed_at','confidence','missing_data_flags','display_name_update','reviewed_update'];
 const out=Object.fromEntries(keys.filter(k=>Object.hasOwn(record,k)).map(k=>[k,record[k]]));
 const address=record.address;
 out.address=address&&['meeting_venue','service_office','program_venue','mailing'].includes(address.type)?{text:address.text,type:address.type,map_eligible:address.map_eligible===true}:null;
 const contacts=record.public_contacts||{};
 out.public_contacts={phone:contacts.phone||null,email:contacts.email||null,website:isRosterURL(contacts.website)?null:contacts.website||null};
 out.officers=[];out.officers_status='not_published_for_privacy';
 if(Array.isArray(record.photos))out.photos=record.photos.slice(0,12).map(sanitizePublicPhoto).filter(Boolean);
 return out;
}

