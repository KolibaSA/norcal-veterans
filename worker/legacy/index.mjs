import {vfwProfile} from './vfw-profile.mjs';
import {verifyIdentity,permitted} from './auth.mjs';
import headquarters from './hq-template.mjs';
import {publicPayload,publicDetail} from './public.mjs';
const KINDS=['request','task','organization','event','coordination','library','submission'];
const STATUSES={request:['queued','in_progress','needs_input','completed','closed'],task:['open','in_progress','completed','closed'],organization:['draft','published','archived'],event:['draft','published','archived'],coordination:['draft','active','archived'],library:['draft','ready','archived'],submission:['pending','reviewed','rejected']};
const json=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const stmt=(e,s,...v)=>e.DB.prepare(s).bind(...v);
const list=async(e,s,...v)=>(await stmt(e,s,...v).all()).results;
const clean=(v,max)=>typeof v==='string'?v.trim().slice(0,max):'';
const fail=(message,status=400)=>json({error:message},status);
async function body(req,max=100000){const text=await req.text();if(text.length>max)throw Error('TOO_LARGE');return JSON.parse(text)}
const audit=(e,user,action,id,mutation)=>stmt(e,'INSERT INTO audit(id,actor,action,record_id,created_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM records WHERE id=? AND mutation_id=?)',crypto.randomUUID(),user.email,action,id,new Date().toISOString(),id,mutation);
function validPayload(kind,p){if(!p||typeof p!=='object'||Array.isArray(p))return false;if(kind==='event')return typeof p.start_at==='string'&&Number.isFinite(Date.parse(p.start_at))&&typeof p.venue==='string'&&!!p.venue.trim();return true}
export default {async fetch(req,env){const url=new URL(req.url),path=url.pathname;
 try{
 // Temporary launch routing: preserve filters, and allow a future regional home.
 if(path==='/' && ['www.norcalveterans.org','norcalveterans.org'].includes(url.hostname) && ['GET','HEAD'].includes(req.method)){url.pathname='/yolo-solano';return new Response(null,{status:302,headers:{Location:url.toString(),'Cache-Control':'no-store'}})}
 const detail=path.match(/^\/(organizations|events)\/([^/]+)\/?$/);
 if(detail&&env.DB){const kind=detail[1]==='organizations'?'organization':'event';const r=await stmt(env,"SELECT * FROM records WHERE id=? AND kind=? AND status='published'",decodeURIComponent(detail[2]),kind).first();if(!r)return new Response('This listing is not available.',{status:404});if(r.id==='vfw-ca-8151'&&kind==='organization'){const events=await list(env,"SELECT * FROM records WHERE kind='event' AND status='published' AND (organization_id=? OR json_extract(payload,'$.organization_id')=?)",r.id,r.id);return vfwProfile(r,events)}return publicDetail(r)}
 if(path==='/api/directory'){if(!env.DB)return fail('Directory database is not connected.',503);const rows=await list(env,"SELECT id,kind,title,body,status,payload FROM records WHERE kind IN ('organization','event') AND status='published'");return json(rows.map(r=>({id:r.id,kind:r.kind,payload:publicPayload(r)})))}
 if(path==='/api/submissions'&&req.method==='POST'){
 if(!env.DB)return fail('Submissions are not available yet.',503);if(req.headers.get('Origin')!==url.origin)return fail('Please use the website form.',403);
 const x=await body(req,15000),title=clean(x.title,200),detail=clean(x.body,10000);if(!title||!detail)return fail('Add a title and description.');if(x.website)return json({saved:true});
 const ip=req.headers.get('CF-Connecting-IP')||'unknown',hour=new Date().toISOString().slice(0,13);const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ip+hour)))).map(v=>v.toString(16).padStart(2,'0')).join('');
 const limited=await stmt(env,'INSERT INTO submission_limits(bucket,count) VALUES(?,1) ON CONFLICT(bucket) DO UPDATE SET count=count+1 RETURNING count',hour+':'+hash).first();if(limited.count>5)return fail('Please try again later.',429);
 await stmt(env,'DELETE FROM submission_limits WHERE bucket < ?',new Date(Date.now()-48*3600000).toISOString().slice(0,13)).run();
 const id=crypto.randomUUID(),now=new Date().toISOString();await stmt(env,"INSERT INTO records(id,kind,title,body,region_id,status,payload,created_by,created_at,updated_at,mutation_id) VALUES(?,'submission',?,?,'yolo-solano','pending','{}','public',?,?,?)",id,title,detail,now,now,id).run();return json({saved:true,id},201)
 }
 if(path.startsWith('/hq')||path.startsWith('/api/hq')){
 let user;try{user=await verifyIdentity(req,env)}catch(e){return fail(e.message==='AUTH_NOT_CONFIGURED'?'Headquarters sign-in is being configured. Private records are locked.':'Sign in through the headquarters Cloudflare Access page.',e.message==='AUTH_NOT_CONFIGURED'?503:401)}
 if(!env.DB)return fail('Headquarters database is not connected.',503);
 const grants=user.owner?[]:await list(env,'SELECT * FROM grants WHERE email=?',user.email);if(!user.owner&&!grants.length)return fail('Your account has no headquarters assignment.',403);
 if(path==='/hq'||path==='/hq/')return new Response(headquarters,{headers:{'Content-Type':'text/html;charset=utf-8','Cache-Control':'private, no-store','Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",'X-Content-Type-Options':'nosniff'}});
 if(req.method!=='GET'&&req.headers.get('Origin')!==url.origin)return fail('Request origin rejected.',403);
 if(path==='/api/hq/me')return json({...user,grants,uploads:!!env.FILES,processorConnected:false});
 if(path==='/api/hq/records'&&req.method==='GET'){const kind=url.searchParams.get('kind');if(!KINDS.includes(kind))return fail('Unknown section.');const rows=await list(env,'SELECT * FROM records WHERE kind=? ORDER BY updated_at DESC LIMIT 500',kind);return json(rows.filter(r=>permitted(user,grants,r)).map(r=>({...r,payload:JSON.parse(r.payload)})))}
 if(path==='/api/hq/records'&&req.method==='POST'){
 const x=await body(req),kind=x.kind,title=clean(x.title,200),region=clean(x.region_id,80),org=clean(x.organization_id,120)||null;
 if(!KINDS.includes(kind)||!title||!region||!STATUSES[kind].includes(x.status)||!validPayload(kind,x.payload||{}))return fail('Check the title, region, status, and event date/venue.');
 const id=crypto.randomUUID(),recordOrg=kind==='organization'?id:org;
 if(!permitted(user,grants,{region_id:region,organization_id:recordOrg},x.status==='published'?'publish':'write'))return fail('This record is outside your assignment.',403);
 const now=new Date().toISOString(),mutation=crypto.randomUUID();await env.DB.batch([stmt(env,'INSERT INTO records(id,kind,title,body,region_id,organization_id,status,payload,created_by,created_at,updated_at,mutation_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',id,kind,title,clean(x.body,20000),region,recordOrg,x.status,JSON.stringify(x.payload||{}),user.email,now,now,mutation),audit(env,user,'create',id,mutation)]);return json({id},201)
 }
 const match=path.match(/^\/api\/hq\/records\/([^/]+)$/);
 if(match&&req.method==='PUT'){
 const id=match[1],r=await stmt(env,'SELECT * FROM records WHERE id=?',id).first();if(!r||!permitted(user,grants,r,'write'))return fail('Record unavailable.',404);
 const x=await body(req);if(!clean(x.title,200)||!STATUSES[r.kind].includes(x.status)||!validPayload(r.kind,x.payload||{}))return fail('Check the record fields.');
 if(x.status==='published'&&!permitted(user,grants,r,'publish'))return fail('Publishing requires an administrator.',403);
 if(!Number.isInteger(x.version))return fail('Reload this record before saving.');
 const mutation=crypto.randomUUID();const results=await env.DB.batch([stmt(env,'UPDATE records SET title=?,body=?,status=?,payload=?,updated_at=?,version=version+1,mutation_id=? WHERE id=? AND version=?',clean(x.title,200),clean(x.body,20000),x.status,JSON.stringify(x.payload||{}),new Date().toISOString(),mutation,id,x.version),audit(env,user,'update',id,mutation)]);if(results[0].meta.changes!==1)return fail('Someone changed this record. Reload before saving.',409);return json({saved:true})
 }
 if(path==='/api/hq/access'){
 if(!user.owner)return fail('Only the platform owner manages access.',403);
 if(req.method==='GET')return json(await list(env,'SELECT * FROM grants ORDER BY email'));
 if(req.method==='POST'){const x=await body(req),email=clean(x.email,250).toLowerCase(),role=x.role,region=clean(x.region_id,80)||null,org=clean(x.organization_id,120)||null;if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)||!['region_admin','organization_admin','editor'].includes(role)||!!region===!!org||(role==='region_admin'&&!region)||(role==='organization_admin'&&!org))return fail('Choose one valid region or organization assignment.');if(org&&!await stmt(env,"SELECT id FROM records WHERE id=? AND kind='organization'",org).first())return fail('Choose an existing organization.');const id=crypto.randomUUID();await env.DB.batch([stmt(env,'INSERT INTO grants(id,email,role,region_id,organization_id) VALUES(?,?,?,?,?)',id,email,role,region,org),stmt(env,'INSERT INTO audit(id,actor,action,record_id,created_at) VALUES(?,?,?,?,?)',crypto.randomUUID(),user.email,'grant',id,new Date().toISOString())]);return json({id},201)}
 }
 const access=path.match(/^\/api\/hq\/access\/([^/]+)$/);if(access&&req.method==='DELETE'){if(!user.owner)return fail('Owner access required.',403);await env.DB.batch([stmt(env,'DELETE FROM grants WHERE id=?',access[1]),stmt(env,'INSERT INTO audit(id,actor,action,record_id,created_at) VALUES(?,?,?,?,?)',crypto.randomUUID(),user.email,'revoke',access[1],new Date().toISOString())]);return json({revoked:true})}
 if(path==='/api/hq/audit'){if(!user.owner)return fail('Owner access required.',403);return json(await list(env,'SELECT * FROM audit ORDER BY created_at DESC LIMIT 200'))}
 if(path==='/api/hq/export'){if(!user.owner)return fail('Owner access required.',403);return json({exported_at:new Date().toISOString(),records:await list(env,'SELECT * FROM records'),grants:await list(env,'SELECT * FROM grants'),audit:await list(env,'SELECT * FROM audit'),attachments:await list(env,'SELECT * FROM attachments'),note:'Attachment bytes must be backed up separately from R2.'})}
 if(path==='/api/hq/attachments'&&req.method==='POST'){
 if(!env.FILES)return fail('Attachment storage is not connected yet.',503);const len=Number(req.headers.get('Content-Length'));if(!len||len>11*1024*1024)return fail('Choose a file smaller than 10 MB.',413);const f=await req.formData(),file=f.get('file'),id=clean(f.get('record_id'),120),r=await stmt(env,'SELECT * FROM records WHERE id=?',id).first();if(!r||!permitted(user,grants,r,'write'))return fail('Record unavailable.',404);if(!file||typeof file==='string'||file.size>10*1024*1024)return fail('Choose a file smaller than 10 MB.',413);const aid=crypto.randomUUID(),key=id+'/'+aid;await env.FILES.put(key,file.stream());try{await env.DB.batch([stmt(env,'INSERT INTO attachments(id,record_id,filename,content_type,size,object_key,created_by,created_at) VALUES(?,?,?,?,?,?,?,?)',aid,id,file.name.slice(0,200),file.type,file.size,key,user.email,new Date().toISOString()),stmt(env,'INSERT INTO audit(id,actor,action,record_id,created_at) VALUES(?,?,?,?,?)',crypto.randomUUID(),user.email,'attachment',id,new Date().toISOString())])}catch(e){await env.FILES.delete(key);throw e}return json({id:aid},201)
 }
 if(path==='/api/hq/attachments'&&req.method==='GET'){const id=url.searchParams.get('record_id'),r=await stmt(env,'SELECT * FROM records WHERE id=?',id).first();if(!r||!permitted(user,grants,r))return fail('Record unavailable.',404);return json(await list(env,'SELECT id,filename,size FROM attachments WHERE record_id=?',id))}
 const attachment=path.match(/^\/api\/hq\/attachments\/([^/]+)$/);if(attachment&&req.method==='GET'){const a=await stmt(env,'SELECT * FROM attachments WHERE id=?',attachment[1]).first();const r=a&&await stmt(env,'SELECT * FROM records WHERE id=?',a.record_id).first();if(!r||!permitted(user,grants,r))return fail('File unavailable.',404);const object=env.FILES&&await env.FILES.get(a.object_key);if(!object)return fail('File unavailable.',404);return new Response(object.body,{headers:{'Content-Type':'application/octet-stream','Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(a.filename),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}})}
 return fail('Not found.',404);
 }
 return env.ASSETS.fetch(req);
 }catch(e){return fail(e.message==='TOO_LARGE'?'Request is too large.':e instanceof SyntaxError?'Invalid request.':'The request could not be completed. Please retry.',e.message==='TOO_LARGE'?413:e instanceof SyntaxError?400:500)}
}};
