import {field,choice} from './storage.mjs';
import {records} from './data.mjs';

const organizationEditorIdOK=id=>/^[a-zA-Z0-9_-]{1,100}$/.test(id);
function organizationEditorEmail(value){
 const email=String(value||'').trim().toLowerCase();
 // Keep an exact mailbox identity; do not remove dots or plus-address suffixes.
 if(email.length>254||!(/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/.test(email))||email.startsWith('.')||email.includes('..')||email.includes('.@'))throw new Error('Enter the representative’s complete email address.');
 return email;
}
function organizationEditorVersion(form){
 const version=Number(field(form,'version',30,true));
 if(!Number.isSafeInteger(version)||version<1)throw new Error('Reload organization access before changing this assignment.');
 return version;
}

// These complete records are private. Call this only after the full-admin gate.
export async function organizationAccessData(db){
 return (await db.prepare('SELECT * FROM organization_editors ORDER BY email,org_id').all()).results;
}

// Call for a platform-verified email, never a user-supplied email header or form.
export async function getOrganizationMemberships(db,email){
 if(!db)return [];
 let normalized;try{normalized=organizationEditorEmail(email);}catch{return [];}
 return (await db.prepare("SELECT * FROM organization_editors WHERE email=? AND status='active' ORDER BY org_id").bind(normalized).all()).results;
}

// The HQ caller verifies admin authority and CSRF before invoking this action.
// Workers do not change Cloudflare Access policies: activation is a tracked request.
export async function organizationAccessAction(form,db,actor){
 if(!db)throw new Error('Organization access is temporarily unavailable.');
 const action=choice(field(form,'action',50),['org_access_grant','org_access_revoke']);
 const now=new Date().toISOString();
 if(action==='org_access_revoke'){
  const id=field(form,'id',100,true),version=organizationEditorVersion(form);
  if(!organizationEditorIdOK(id))throw new Error('Choose a valid organization assignment.');
  const out=await db.batch([
   db.prepare("UPDATE organization_editors SET status='revoked',version=version+1,updated_at=? WHERE id=? AND version=? AND status IN ('pending','active') RETURNING id").bind(now,id,version),
   db.prepare("INSERT INTO audit(id,actor,action,record_id,created_at) SELECT ?,?,'org_access_revoke',?,? WHERE changes()>0").bind(crypto.randomUUID(),actor,id,now)
  ]);
  if(out[0]?.results?.length!==1)throw new Error('This assignment changed or was already revoked. Reload organization access.');
  return 'access';
 }

 const suppliedId=field(form,'id',100),suppliedEmail=field(form,'email',254),suppliedOrg=field(form,'org_id',100);
 let existing,email,orgId;
 if(suppliedId){
  if(!organizationEditorIdOK(suppliedId))throw new Error('Choose a valid organization assignment.');
  existing=(await db.prepare('SELECT * FROM organization_editors WHERE id=?').bind(suppliedId).all()).results[0];
  if(!existing)throw new Error('This assignment no longer exists. Reload organization access.');
  email=organizationEditorEmail(suppliedEmail||existing.email);orgId=suppliedOrg||existing.org_id;
  if(email!==existing.email||orgId!==existing.org_id)throw new Error('Create a separate assignment to change the email or organization.');
 }else{
  email=organizationEditorEmail(suppliedEmail);orgId=suppliedOrg;
  existing=(await db.prepare('SELECT * FROM organization_editors WHERE email=? AND org_id=?').bind(email,orgId).all()).results[0];
 }
 const organization=records.find(record=>record.id===orgId);
 if(!organization)throw new Error('Choose an organization from the directory.');
 if(existing&&existing.status!=='revoked')throw new Error(existing.status==='active'?'This representative already has access to that organization.':'Activation is already queued for this representative and organization.');
 const displayName=field(form,'display_name',120)||existing?.display_name||'';
 const id=existing?.id||crypto.randomUUID(),previousVersion=existing?organizationEditorVersion(form):null,nextVersion=existing?previousVersion+1:1;
 if(existing&&existing.version!==previousVersion)throw new Error('This assignment changed. Reload organization access before granting it again.');
 const activationId=crypto.randomUUID();
 const details=`${actor} designated ${displayName||email} to edit only ${organization.verified_name}.\n\nRepresentative email: ${email}\nOrganization ID: ${orgId}\nMembership ID: ${id}\nMembership version: ${nextVersion}\n\nActivate this exact representative’s organization sign-in. Keep the assignment pending until the current Cloudflare Access email allowlist admits this exact email. Before changing access, verify that this membership is still pending at the version above; a revoked or changed assignment must not be activated. Preserve Aaron and Sterling’s full access and any other existing assignments. After the sign-in setup is verified, mark this membership active with an activation timestamp using its current version guard.\n\nThis assignment permits editing this organization’s own public profile only. It does not grant access to other organizations, shared HQ requests, attachments, private notes, membership administration, or backups. Record the completed access instructions in this request. No invitation email is requested.`;
 const membership=existing?
  db.prepare("UPDATE organization_editors SET status='pending',display_name=?,version=version+1,updated_at=?,activated_at=NULL WHERE id=? AND email=? AND org_id=? AND status='revoked' AND version=? RETURNING id").bind(displayName,now,id,email,orgId,previousVersion):
  db.prepare("INSERT OR IGNORE INTO organization_editors(id,email,org_id,display_name,status,version,created_by,created_at,updated_at,activated_at) VALUES (?,?,?,?,'pending',1,?,?,?,NULL) RETURNING id").bind(id,email,orgId,displayName,actor,now,now);
 const out=await db.batch([
  membership,
  db.prepare("INSERT INTO work_requests(id,target,title,details,requested_by,last_actor,status,created_at,updated_at) SELECT ?,'headquarters','Activate organization representative sign-in',?,?,?,'queued',?,? WHERE changes()>0").bind(activationId,details,actor,actor,now,now),
  db.prepare("INSERT INTO work_request_messages(id,request_id,actor,kind,body,created_at) SELECT ?,?,?,'request',?,? WHERE changes()>0").bind(crypto.randomUUID(),activationId,actor,details,now),
  db.prepare("INSERT INTO audit(id,actor,action,record_id,created_at) SELECT ?,?,'org_access_grant',?,? WHERE changes()>0").bind(crypto.randomUUID(),actor,id,now),
  db.prepare("INSERT INTO audit(id,actor,action,record_id,created_at) SELECT ?,?,'work_create',?,? WHERE changes()>0").bind(crypto.randomUUID(),actor,activationId,now),
  db.prepare("UPDATE request_processor SET last_activity_at=?,active_until=? WHERE id='main' AND changes()>0").bind(now,new Date(Date.now()+60*60*1000).toISOString())
 ]);
 if(out[0]?.results?.length!==1)throw new Error('This assignment changed or was already received. Reload organization access before trying again.');
 return 'access';
}
