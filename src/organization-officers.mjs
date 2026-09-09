import {formData,redirect} from './storage.mjs';
import {records} from './data.mjs';
import {sanitizePublicPhoto} from './public-privacy.mjs';

const organizationOfficerLimit=20;
const organizationOfficerID=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(value);
const organizationOfficerScope="(?=1 OR EXISTS(SELECT 1 FROM organization_editors WHERE email=? AND org_id=? AND status='active'))";
function organizationOfficerText(form,name,max,required=false,multiline=false){
 const values=form.getAll(name);if(values.length>1||values.some(v=>typeof v!=='string'))throw new Error('Please reload the officer form and try again.');
 const value=(values[0]||'').trim();
 if(value.length>max||value.includes('\u0000')||(!multiline&&/[\r\n]/.test(value))||(required&&!value))throw new Error('Please provide a valid '+name.replaceAll('_',' ')+'.');
 return value;
}
function organizationOfficerPermission(principal,orgId){
 const email=String(principal?.email||'').trim().toLowerCase();
 if(!email||!records.some(r=>r.id===orgId)||(!principal.isAdmin&&!principal.memberships?.some(m=>m.org_id===orgId&&m.status==='active'&&String(m.email||'').trim().toLowerCase()===email)))throw new Error('You do not have access to update this organization.');
 return [principal.isAdmin?1:0,email,orgId];
}
function organizationOfficerPublicText(value){
 const contact=/(?:https?:\/\/|www\.|\b[^\s@]+@[^\s@]+\.[^\s@]+\b|(?:\+?1[\s.()-]*)?(?:\d[\s.()-]*){7,})/i;
 const address=/(?:\bP\.?\s*O\.?\s*Box\s+\d+\b|\b(?:lives?|resides?)\s+(?:at|on)\b|\b\d{1,6}\s+(?:[NSEW]\.?(?:\s+|$))?(?:[A-Z0-9.'-]+\s+){0,5}(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Court|Ct|Boulevard|Blvd|Way|Place|Pl|Terrace|Ter|Circle|Cir|Highway|Hwy)\b)/i;
 if(contact.test(value)||address.test(value))throw new Error('Officer profiles cannot include phone numbers, email addresses, links or addresses. Use the organization contact buttons instead.');
 return value;
}

export async function organizationOfficerRows(db,orgIds){
 if(!db||Array.isArray(orgIds)&&!orgIds.length)return [];
 const where=Array.isArray(orgIds)?' WHERE o.org_id IN ('+orgIds.map(()=>'?').join(',')+')':'';
 const sql='SELECT o.*,p.id AS selected_photo_id,p.image_url AS photo_image_url,p.alt_text AS photo_alt_text FROM organization_officers o LEFT JOIN organization_photos p ON p.id=o.photo_id AND p.org_id=o.org_id'+where+' ORDER BY o.created_at,o.id';
 return (await (Array.isArray(orgIds)?db.prepare(sql).bind(...orgIds):db.prepare(sql)).all()).results;
}

export function sanitizePublicOfficer(row){
 if(!row||!organizationOfficerID(String(row.id||'')))return null;
 let public_name=String(row.public_name||'').trim().slice(0,120),title=String(row.title||'').trim().slice(0,160),bio=String(row.bio||'').trim().slice(0,1200);
 if(!public_name||!title||!bio)return null;
 try{public_name=organizationOfficerPublicText(public_name);title=organizationOfficerPublicText(title);bio=organizationOfficerPublicText(bio);}catch{return null;}
 let photo=null;
 if(row.selected_photo_id){
  const safe=sanitizePublicPhoto({id:row.selected_photo_id,image_url:row.photo_image_url,alt_text:row.photo_alt_text||('Portrait of '+public_name)});
  if(safe)photo={src:safe.src,alt_text:safe.alt_text};
 }
 return {id:String(row.id),public_name,title,bio,photo};
}

export async function organizationOfficerAction(request,env,principal){
 if(request.method!=='POST'||!env.DB)throw new Error('Officer editing is temporarily unavailable.');
 const form=await formData(request),action=organizationOfficerText(form,'action',50,true),orgId=organizationOfficerText(form,'org_id',100,true),scope=organizationOfficerPermission(principal,orgId),actor=principal.email;
 if(!['officer_add','officer_edit','officer_remove'].includes(action))throw new Error('Choose a valid officer action.');
 const adding=action==='officer_add',id=adding?crypto.randomUUID():organizationOfficerText(form,'id',100,true),version=adding?1:Number(organizationOfficerText(form,'version',20,true));
 if(!organizationOfficerID(id)||!Number.isSafeInteger(version)||version<1)throw new Error('Reload this page before changing the officer profile.');
 const now=new Date().toISOString(),destination='/organization?org='+encodeURIComponent(orgId)+'&officersaved=1#officers';
 let statement;
 if(action==='officer_remove')statement=env.DB.prepare(`DELETE FROM organization_officers WHERE id=? AND org_id=? AND version=? AND ${organizationOfficerScope} RETURNING id`).bind(id,orgId,version,...scope);
 else{
  if(organizationOfficerText(form,'consent',10)!=='yes')throw new Error('Confirm the officer agreed to publication of this profile.');
  const publicName=organizationOfficerPublicText(organizationOfficerText(form,'public_name',120,true));
  const title=organizationOfficerPublicText(organizationOfficerText(form,'title',160,true));
  const bio=organizationOfficerPublicText(organizationOfficerText(form,'bio',1200,true,true));
  const photoId=organizationOfficerText(form,'photo_id',100)||null;
  if(photoId&&!organizationOfficerID(photoId))throw new Error('Choose a valid organization photo.');
  const photoGuard='(? IS NULL OR EXISTS(SELECT 1 FROM organization_photos WHERE id=? AND org_id=?))';
  if(adding)statement=env.DB.prepare(`INSERT INTO organization_officers(id,org_id,public_name,title,bio,photo_id,consent_scope,consent_attested_by,consent_attested_at,role_confirmed_at,created_by,created_at,updated_by,updated_at) SELECT ?,?,?,?,?,?,'public_name_title_bio_optional_photo',?,?,?,?,?,?,? WHERE ${organizationOfficerScope} AND ${photoGuard} AND (SELECT count(*) FROM organization_officers WHERE org_id=?)<? RETURNING id`).bind(id,orgId,publicName,title,bio,photoId,actor,now,now,actor,now,actor,now,...scope,photoId,photoId,orgId,orgId,organizationOfficerLimit);
  else statement=env.DB.prepare(`UPDATE organization_officers SET public_name=?,title=?,bio=?,photo_id=?,consent_scope='public_name_title_bio_optional_photo',consent_attested_by=?,consent_attested_at=?,role_confirmed_at=?,updated_by=?,updated_at=?,version=version+1 WHERE id=? AND org_id=? AND version=? AND ${organizationOfficerScope} AND ${photoGuard} RETURNING id`).bind(publicName,title,bio,photoId,actor,now,now,actor,now,id,orgId,version,...scope,photoId,photoId,orgId);
 }
 const out=await env.DB.batch([statement,env.DB.prepare('INSERT INTO audit(id,actor,action,record_id,created_at) SELECT ?,?,?,?,? WHERE changes()>0').bind(crypto.randomUUID(),actor,'organization_'+action,id,now)]);
 if(out[0]?.results?.length!==1)throw new Error('Your access or this officer profile changed, the selected photo is unavailable, or the organization already has 20 profiles. Reload the page before trying again.');
 return redirect(destination);
}
