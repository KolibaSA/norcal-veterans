import {getOwner,field,safeURL} from './storage.mjs';
import {records} from './data.mjs';
import {getOrganizationMemberships} from './organization-access.mjs';
import {assertPublicProfilePrivacy} from './public-privacy.mjs';

export async function getHQPrincipal(request,env,ctx){
 const admin=await getOwner(request,env,ctx);
 if(admin)return {email:admin,isAdmin:true,memberships:[]};
 if(!env.DB||!env.OWNER_EMAIL||!env.ACCESS_AUD||!ctx?.access||ctx.access.aud!==env.ACCESS_AUD)return null;
 const identity=await ctx.access.getIdentity();
 const email=typeof identity?.email==='string'?identity.email.trim().toLowerCase():'';
 if(!email||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return null;
 const memberships=await getOrganizationMemberships(env.DB,email);
 return memberships.length?{email,isAdmin:false,memberships}:null;
}

export async function organizationProfileAction(form,db,principal){
 if(field(form,'action',60)!=='organization_profile_publish')throw new Error('Unknown organization action.');
 const orgId=field(form,'org_id',100,true),version=field(form,'version',50),actor=principal?.email;
 if(!actor||!records.some(r=>r.id===orgId))throw new Error('Choose an organization you manage.');
 if(!principal.isAdmin&&!principal.memberships?.some(m=>m.org_id===orgId&&m.status==='active'&&m.email===actor.toLowerCase()))throw new Error('You do not have access to update this organization.');
 if(form.get('reviewed')!=='yes')throw new Error('Confirm that you are authorized to publish these public organization details.');
 const source=safeURL(field(form,'source_url',2000),true),email=field(form,'email',254);
 if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Enter a valid public email address.');
 const body=JSON.stringify({meeting_schedule:field(form,'meeting_schedule',700)||null,member_information:field(form,'member_information',1800,true),phone:field(form,'phone',80),email,website:safeURL(field(form,'website',2000))});
 assertPublicProfilePrivacy({...JSON.parse(body),source_url:source});
 const now=new Date().toISOString();
 // Recheck the live assignment in the write itself: revocation wins even after
 // the page or the platform session was opened. No client role is accepted.
 const scope="(?=1 OR EXISTS(SELECT 1 FROM organization_editors WHERE email=? AND org_id=? AND status='active'))";
 const scopeArgs=[principal.isAdmin?1:0,actor.toLowerCase(),orgId];
 const statement=version?
  db.prepare(`UPDATE profile_updates SET body_json=?,source_url=?,reviewed_at=? WHERE org_id=? AND reviewed_at=? AND ${scope} RETURNING org_id`).bind(body,source,now,orgId,version,...scopeArgs):
  db.prepare(`INSERT INTO profile_updates(org_id,body_json,source_url,reviewed_at) SELECT ?,?,?,? WHERE ${scope} RETURNING org_id`).bind(orgId,body,source,now,...scopeArgs);
 const out=await db.batch([statement,db.prepare("INSERT INTO audit(id,actor,action,record_id,created_at) SELECT ?,?,'organization_profile_publish',?,? WHERE changes()>0").bind(crypto.randomUUID(),actor,orgId,now)]);
 if(out[0]?.results?.length!==1)throw new Error('Your access or this page changed. Reload it before publishing.');
 return '/organization?org='+encodeURIComponent(orgId)+'&saved=1';
}
