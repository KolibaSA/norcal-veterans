import test from 'node:test';import assert from 'node:assert/strict';
import {verifyIdentity,permitted} from '../worker/legacy/auth.mjs';
import {b64,envBase,token,db,req} from './legacy-test-helpers.mjs';
import headquarters,{scriptHash} from '../worker/legacy/hq-template.mjs';
import worker from '../src/norcal-worker.mjs';
test('JWT validation rejects absent, expired, wrong audience and forged identity',async()=>{await assert.rejects(()=>verifyIdentity(new Request('https://site.test'),envBase));for(const override of [{exp:1},{aud:['other']},{iss:'https://attacker.test'}]){const t=await token('owner@example.com',override);await assert.rejects(()=>verifyIdentity(new Request('https://site.test',{headers:{'Cf-Access-Jwt-Assertion':t}}),envBase))}const good=await token('owner@example.com');const parts=good.split('.');parts[1]=b64({email:'attacker@example.com'});await assert.rejects(()=>verifyIdentity(new Request('https://site.test',{headers:{'Cf-Access-Jwt-Assertion':parts.join('.')}}),envBase));assert.equal((await verifyIdentity(new Request('https://site.test',{headers:{'Cf-Access-Jwt-Assertion':good}}),envBase)).owner,true)});
test('Region/organization assignments do not cross scopes; editor cannot publish',()=>{const u={email:'editor@example.com'},r={region_id:'a',organization_id:'org-a'};assert.equal(permitted(u,[{email:u.email,role:'region_admin',region_id:'b'}],r,'write'),false);assert.equal(permitted(u,[{email:u.email,role:'organization_admin',organization_id:'org-b'}],r),false);assert.equal(permitted(u,[{email:u.email,role:'editor',region_id:'a'}],r,'publish'),false);assert.equal(permitted(u,[{email:u.email,role:'editor',region_id:'a'}],r,'write'),true)});
test('Saved records persist, concurrent edits conflict, drafts stay private, scope revocation takes effect',async()=>{const env={...envBase,DB:db()};let r=await req(env,'/api/hq/records','owner@example.com','POST',{kind:'organization',title:'Example organization',body:'Original',region_id:'a',status:'draft',payload:{city:'Davis'}});assert.equal(r.status,201);const {id}=await r.json();r=await req(env,'/api/hq/records?kind=organization','owner@example.com');let [record]=await r.json();assert.equal(record.title,'Example organization');r=await worker.fetch(new Request('https://site.test/api/directory'),env);assert.equal((await r.json()).length,0);r=await req(env,'/api/hq/records/'+id,'owner@example.com','PUT',{...record,status:'published',body:'Updated'});assert.equal(r.status,200);r=await req(env,'/api/hq/records/'+id,'owner@example.com','PUT',{...record,body:'Stale'});assert.equal(r.status,409);r=await worker.fetch(new Request('https://site.test/api/directory'),env);assert.equal((await r.json())[0].payload.member_information,'Updated');r=await req(env,'/api/hq/access','owner@example.com','POST',{email:'regional@example.com',role:'region_admin',region_id:'b'});const grant=await r.json();r=await req(env,'/api/hq/records?kind=organization','regional@example.com');assert.deepEqual(await r.json(),[]);r=await req(env,'/api/hq/records/'+id,'regional@example.com','PUT',{...record,title:'Attack'});assert.equal(r.status,404);r=await req(env,'/api/hq/export','regional@example.com');assert.equal(r.status,403);r=await req(env,'/api/hq/access/'+grant.id,'owner@example.com','DELETE');assert.equal(r.status,200);r=await req(env,'/api/hq/me','regional@example.com');assert.equal(r.status,403);r=await req(env,'/api/hq/audit','owner@example.com');assert.equal((await r.json()).filter(a=>a.action==='update').length,1);r=await req(env,'/api/hq/records','owner@example.com','POST',{kind:'task'},'https://attacker.test');assert.equal(r.status,403)});
test('Unconfigured headquarters is closed; submissions are reviewed and rate-limited',async()=>{let r=await worker.fetch(new Request('https://site.test/hq'),{});assert.equal(r.status,503);const env={DB:db()};for(let n=0;n<6;n++){r=await worker.fetch(new Request('https://site.test/api/submissions',{method:'POST',headers:{Origin:'https://site.test','Content-Type':'application/json','CF-Connecting-IP':'192.0.2.1'},body:JSON.stringify({title:'Community program',body:'Please review'})}),env);assert.equal(r.status,n<5?201:429)}r=await worker.fetch(new Request('https://site.test/api/directory'),env);assert.deepEqual(await r.json(),[])});

test('organization creation checks its stored scope and retains legitimate scoped event creation',async()=>{
  const env={...envBase,DB:db()};
  const organization={kind:'organization',title:'Assigned organization',body:'Public organization',region_id:'a',status:'published',payload:{city:'Davis',organization_type:'VFW',location_county:'Yolo'}};
  let response=await req(env,'/api/hq/records','owner@example.com','POST',organization);
  assert.equal(response.status,201);
  const {id}=await response.json();
  for(const [email,role] of [['org-admin@example.com','organization_admin'],['org-editor@example.com','editor']]){
    response=await req(env,'/api/hq/access','owner@example.com','POST',{email,role,organization_id:id});
    assert.equal(response.status,201);
    for(const status of ['draft','published']){
      response=await req(env,'/api/hq/records',email,'POST',{...organization,title:'Outside assignment',organization_id:id,status});
      assert.equal(response.status,403,role+' cannot create a new organization with an existing organization grant');
    }
  }
  response=await req(env,'/api/hq/records','org-admin@example.com','POST',{kind:'event',title:'Assigned organization event',region_id:'a',organization_id:id,status:'published',payload:{start_at:'2026-10-04T10:00:00-07:00',venue:'Public hall'}});
  assert.equal(response.status,201);
  response=await req(env,'/api/hq/access','owner@example.com','POST',{email:'region-admin@example.com',role:'region_admin',region_id:'a'});
  assert.equal(response.status,201);
  response=await req(env,'/api/hq/records','region-admin@example.com','POST',{...organization,title:'New organization within assigned region'});
  assert.equal(response.status,201);
  const created=await response.json();
  response=await req(env,'/api/hq/records?kind=organization','region-admin@example.com');
  const organizations=await response.json();
  assert.equal(organizations.length,2);
  assert.equal(organizations.find(record=>record.id===created.id).organization_id,created.id);
  response=await req(env,'/api/hq/records','region-admin@example.com','POST',{...organization,region_id:'b'});
  assert.equal(response.status,403);
});

test('event deletion is event-only, confirmed by version, permission checked and historically audited',async t=>{
  const env={...envBase,DB:db(t)},owner=envBase.OWNER_EMAIL,input={kind:'event',title:'Deletable event',body:'Public details',region_id:'a',status:'published',payload:{start_at:'2027-01-10T18:00:00-08:00',venue:'Public hall'}};
  let response=await req(env,'/api/hq/records',owner,'POST',input);assert.equal(response.status,201);const {id}=await response.json();
  const record=await (await req(env,'/api/hq/records/'+id,owner)).json();
  assert.equal((await req(env,'/api/hq/records/'+id,owner,'DELETE',{version:record.version},'https://attacker.test')).status,403);
  assert.equal((await req(env,'/api/hq/records/'+id,owner,'DELETE',{version:record.version-1})).status,409);
  await req(env,'/api/hq/access',owner,'POST',{email:'editor@example.com',role:'editor',region_id:'a'});
  assert.equal((await req(env,'/api/hq/records/'+id,'editor@example.com','DELETE',{version:record.version})).status,403);
  env.DB.raw.prepare('INSERT INTO attachments VALUES(?,?,?,?,?,?,?,?)').run('event-file',id,'details.txt','text/plain',4,'events/details.txt',owner,'2026-09-21T00:00:00Z');
  assert.equal((await req(env,'/api/hq/records/'+id,owner,'DELETE',{version:record.version})).status,409);
  env.DB.raw.prepare('DELETE FROM attachments WHERE id=?').run('event-file');
  response=await req(env,'/api/hq/records/'+id,owner,'DELETE',{version:record.version});assert.equal(response.status,200);assert.equal((await response.json()).deleted,true);
  assert.equal(env.DB.raw.prepare('SELECT count(*) n FROM records WHERE id=?').get(id).n,0);
  assert.deepEqual(env.DB.raw.prepare('SELECT action FROM audit WHERE record_id=? ORDER BY created_at,id').all(id).map(row=>row.action),['create','delete']);
  const revisions=env.DB.raw.prepare('SELECT version,action FROM record_revisions WHERE record_id=? ORDER BY version').all(id);assert.deepEqual(revisions.map(row=>[row.version,row.action]),[[1,'create'],[2,'delete']]);
  assert.equal((await req(env,'/api/hq/records/'+id,owner)).status,404);
  response=await req(env,'/api/hq/records',owner,'POST',{kind:'task',title:'Private task',region_id:'a',status:'open',payload:{}});const task=await response.json();
  assert.equal((await req(env,'/api/hq/records/'+task.id,owner,'DELETE',{version:1})).status,405);
});

test('embedded HQ reports configured request processing and serves its generated CSP-protected template',async()=>{
  const env={...envBase,DB:db()};
  let response=await req(env,'/api/hq/me','owner@example.com');
  const identity=await response.json();
  assert.equal(identity.processorConnected,false);
  const configured=await req({...env,HQ_REQUEST_AGENT_ENABLED:'true'},'/api/hq/me','owner@example.com');
  assert.equal((await configured.json()).processorConnected,true);
  response=await req(env,'/hq','owner@example.com');
  assert.equal(response.status,200);
  const html=await response.text();
  assert.equal(html,headquarters);
  assert.ok(response.headers.get('Content-Security-Policy').includes(scriptHash));
  assert.doesNotMatch(response.headers.get('Content-Security-Policy').split(';').find(value=>value.trim().startsWith('script-src')),/unsafe-inline/);
  assert.doesNotMatch(html,/every 10 minutes|your Mac is awake/);
  response=await req(env,'/api/hq/records','owner@example.com','POST',{kind:'request',title:'Website update',body:'Please review this change.',region_id:'yolo-solano',status:'queued',payload:{}});
  assert.equal(response.status,201);
});
