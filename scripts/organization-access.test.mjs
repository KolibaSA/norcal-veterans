import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,mkdtempSync,writeFileSync,rmSync,rmdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {hqFetch} from '../src/hq.mjs';
import {getHQPrincipal,organizationProfileAction} from '../src/organization-profile.mjs';
import {organizationAccessAction,getOrganizationMemberships} from '../src/organization-access.mjs';
import {publicData} from '../src/storage.mjs';
import {records} from '../src/data.mjs';
import {backupTables,verifyBackup} from './verify-backup.mjs';

const HQ='https://hq.example.test',ADMIN='smartzgraphics@yahoo.com',SECOND_ADMIN='sterling.koliba@gmail.com',REP='representative@example.test',AUD='test-access-app';
const ORG='vfw-ca-8762',OTHER='vfw-ca-7244',STAMP='2026-09-02T12:00:00.000Z',PRIVATE='PRIVATE_ORGANIZATION_REPRESENTATIVE_MEMBERSHIP';
const migration=readdirSync(new URL('../migrations/',import.meta.url)).filter(name=>/^\d+.*\.sql$/.test(name)).sort().map(name=>readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8')).join('\n');
class Statement{
 constructor(db,sql,values=[]){this.db=db;this.sql=sql;this.values=values;}
 bind(...values){return new Statement(this.db,this.sql,values);}
 execute(){const q=this.db.sqlite.prepare(this.sql);let results=[],changes;if(q.columns().length){results=q.all(...this.values).map(row=>({...row}));changes=Number(this.db.sqlite.prepare('SELECT changes() n').get().n);}else changes=Number(q.run(...this.values).changes);return {success:true,results,meta:{changes}};}
 async all(){return this.execute();}async run(){return this.execute();}async first(){return this.execute().results[0]??null;}
}
class D1{
 constructor(){this.sqlite=new DatabaseSync(':memory:');this.sqlite.exec(migration);}
 prepare(sql){return new Statement(this,sql);}
 async batch(statements){if(this.beforeBatch){const hook=this.beforeBatch;this.beforeBatch=null;await hook();}this.sqlite.exec('BEGIN IMMEDIATE');try{const result=statements.map(s=>s.execute());this.sqlite.exec('COMMIT');return result;}catch(error){this.sqlite.exec('ROLLBACK');throw error;}}
 one(sql,...values){return this.sqlite.prepare(sql).get(...values);}
 all(sql,...values){return this.sqlite.prepare(sql).all(...values).map(row=>({...row}));}
}
function setup(t){const db=new D1();t.after(()=>db.sqlite.close());return {db,env:{DB:db,OWNER_EMAIL:ADMIN,HQ_EDITOR_EMAILS:SECOND_ADMIN,ACCESS_AUD:AUD}};}
function member(db,{email=REP,org=ORG,status='active',id='assigned-member',version=1}={}){db.sqlite.prepare('INSERT INTO organization_editors(id,email,org_id,display_name,status,version,created_by,created_at,updated_at,activated_at) VALUES (?,?,?,?,?,?,?,?,?,?)').run(id,email,org,PRIVATE,status,version,ADMIN,STAMP,STAMP,status==='active'?STAMP:null);}
const access=(email=REP,aud=AUD)=>({access:{aud,getIdentity:async()=>({email})}});
const get=(path='/',headers={})=>new Request(HQ+path,{headers});
function form(values){const f=new FormData();for(const[key,value]of Object.entries(values))f.set(key,String(value));return f;}
function post(path,values,headers={}){const h=new Headers({Origin:HQ,'Sec-Fetch-Site':'same-origin','Content-Type':'application/x-www-form-urlencoded',...headers});for(const[k,v]of Object.entries(headers))if(v===null)h.delete(k);return new Request(HQ+path,{method:'POST',headers:h,body:new URLSearchParams(values)});}
const profile=(extra={})=>({action:'organization_profile_publish',org_id:ORG,version:'',meeting_schedule:'Second Wednesday at 6:30 p.m.',member_information:'A welcoming local group for veterans and their families.',phone:'916-555-0100',email:'public@example.test',website:'https://example.org/',source_url:'https://example.org/about',reviewed:'yes',...extra});
const count=(db,table)=>Number(db.one(`SELECT count(*) n FROM ${table}`).n);
const stored=db=>db.one('SELECT * FROM profile_updates WHERE org_id=?',ORG);

test('principal requires platform identity, correct audience and active assigned membership',async t=>{
 const {db,env}=setup(t);member(db);
 const p=await getHQPrincipal(get(),env,access());assert.equal(p.email,REP);assert.equal(p.isAdmin,false);assert.equal(p.memberships.length,1);assert.equal(p.memberships[0].org_id,ORG);
 const spoof={'Cf-Access-Authenticated-User-Email':REP,'Cf-Access-Jwt-Assertion':'forged.jwt','X-Forwarded-Email':REP};
 for(const ctx of [undefined,{},access(REP,'wrong-audience'),access('outsider@example.test')])assert.equal(await getHQPrincipal(get('/',spoof),env,ctx),null);
 for(const status of ['pending','revoked']){db.sqlite.prepare('UPDATE organization_editors SET status=?').run(status);assert.equal(await getHQPrincipal(get(),env,access()),null);assert.deepEqual(await getOrganizationMemberships(db,REP),[]);}
});

test('both project administrators retain full access without an organization membership',async t=>{
 const {db,env}=setup(t);
 for(const email of [ADMIN,SECOND_ADMIN]){const p=await getHQPrincipal(get(),env,access(email));assert.equal(p.isAdmin,true);assert.equal(p.email,email);assert.equal((await hqFetch(get('/?tab=requests'),env,access(email),{})).status,200);assert.equal((await hqFetch(get('/export.json'),env,access(email),{})).status,200);}
 assert.equal(count(db,'organization_editors'),0);
});

test('representatives see their own portal but cannot access another organization or private HQ routes',async t=>{
 const {db,env}=setup(t);member(db);
 const root=await hqFetch(get('/'),env,access(),{});assert.equal(root.status,303);assert.equal(root.headers.get('Location'),'/organization');
 const own=await hqFetch(get('/organization?org='+ORG),env,access(),{});assert.equal(own.status,200);assert.equal(own.headers.get('Cache-Control'),'no-store');assert.ok((await own.text()).includes('West Sacramento'));
 for(const path of ['/organization?org='+OTHER,'/?tab=requests','/?tab=access','/export.json','/request-state','/attachments/private-file']){const response=await hqFetch(get(path),env,access(),{});assert.equal(response.status,403,path);assert.ok(!(await response.text()).includes(PRIVATE));}
 for(const path of ['/action','/attachments'])assert.equal((await hqFetch(post(path,{action:'task_create',title:'Unauthorized private task'}),env,access(),{})).status,403,path);
 assert.equal(count(db,'tasks'),0);assert.equal(count(db,'audit'),0);
});

test('own-page publication uses verified attribution and never exposes membership metadata publicly',async t=>{
 const {db,env}=setup(t);member(db);
 const response=await hqFetch(post('/organization/action',profile(),{'Cf-Access-Authenticated-User-Email':ADMIN}),env,access(),{});assert.equal(response.status,303);
 const update=stored(db);assert.equal(JSON.parse(update.body_json).phone,'916-555-0100');assert.equal(db.one('SELECT actor FROM audit').actor,REP);
 const publicResult=JSON.stringify(await publicData(db,records,[]));assert.ok(publicResult.includes('A welcoming local group'));assert.ok(!publicResult.includes(PRIVATE));assert.ok(!publicResult.includes(REP));assert.ok(!publicResult.includes('organization_editors'));
});

test('scope tampering cannot publish another page or use the administrator action',async t=>{
 const {db,env}=setup(t);member(db);
 const principal=await getHQPrincipal(get(),env,access());
 await assert.rejects(organizationProfileAction(form(profile({org_id:OTHER})),db,principal));
 const response=await hqFetch(post('/organization/action',profile({org_id:OTHER})),env,access(),{});assert.ok(response.status>=400);
 assert.equal((await hqFetch(post('/action',{...profile({org_id:OTHER}),action:'profile_publish'}),env,access(),{})).status,403);
 assert.equal(count(db,'profile_updates'),0);assert.equal(count(db,'audit'),0);
});

test('publication rejects CSRF, missing confirmation, unsafe source URLs and stale profile versions',async t=>{
 const {db,env}=setup(t);member(db);
 for(const headers of [{Origin:'https://evil.test'},{Origin:null},{'Sec-Fetch-Site':'cross-site'}])assert.ok((await hqFetch(post('/organization/action',profile(),headers),env,access(),{})).status>=400);
 for(const extra of [{reviewed:''},{source_url:'javascript:alert(1)'},{source_url:''}])assert.ok((await hqFetch(post('/organization/action',profile(extra)),env,access(),{})).status>=400);
 assert.equal(count(db,'profile_updates'),0);assert.equal(count(db,'audit'),0);
 assert.equal((await hqFetch(post('/organization/action',profile()),env,access(),{})).status,303);
 const version=stored(db).reviewed_at;
 assert.ok((await hqFetch(post('/organization/action',profile({phone:'916-555-0199'})),env,access(),{})).status>=400,'A second blank-version save must not overwrite an existing profile.');
 assert.ok((await hqFetch(post('/organization/action',profile({version:'1999-01-01T00:00:00.000Z',phone:'916-555-0199'})),env,access(),{})).status>=400);
 assert.equal(stored(db).reviewed_at,version);assert.equal(JSON.parse(stored(db).body_json).phone,'916-555-0100');assert.equal(count(db,'audit'),1);
});

test('revocation between identity lookup and the write prevents publication inside SQL',async t=>{
 const {db,env}=setup(t);member(db);const principal=await getHQPrincipal(get(),env,access());
 db.beforeBatch=()=>db.sqlite.prepare("UPDATE organization_editors SET status='revoked',version=version+1 WHERE email=?").run(REP);
 await assert.rejects(organizationProfileAction(form(profile()),db,principal));
 assert.equal(count(db,'profile_updates'),0);assert.equal(count(db,'audit'),0);
 assert.equal((await hqFetch(get('/organization'),env,access(),{})).status,403);
});

test('write-time revocation also protects a previously published profile from stale sessions',async t=>{
 const {db,env}=setup(t);member(db);const principal=await getHQPrincipal(get(),env,access());
 await organizationProfileAction(form(profile()),db,principal);const before=stored(db);
 db.beforeBatch=()=>db.sqlite.prepare("UPDATE organization_editors SET status='revoked',version=version+1 WHERE email=?").run(REP);
 await assert.rejects(organizationProfileAction(form(profile({version:before.reviewed_at,phone:'916-555-0199'})),db,principal));
 assert.equal(stored(db).body_json,before.body_json);assert.equal(count(db,'audit'),1);
});

test('admin grant stays pending and creates a tracked activation request; revoke is immediate and versioned',async t=>{
 const {db}=setup(t);
 await organizationAccessAction(form({action:'org_access_grant',email:' REPRESENTATIVE@EXAMPLE.TEST ',org_id:ORG,display_name:PRIVATE}),db,ADMIN);
 let row=db.one('SELECT * FROM organization_editors');assert.equal(row.email,REP);assert.equal(row.status,'pending');assert.equal(row.org_id,ORG);assert.deepEqual(await getOrganizationMemberships(db,REP),[]);
 const request=db.one('SELECT * FROM work_requests');assert.equal(request.requested_by,ADMIN);assert.equal(request.status,'queued');assert.ok((request.title+' '+request.details).includes(REP));assert.ok((request.title+' '+request.details).includes(ORG));assert.equal(count(db,'work_request_messages'),1);assert.ok(db.one('SELECT last_activity_at FROM request_processor').last_activity_at);
 await assert.rejects(organizationAccessAction(form({action:'org_access_grant',email:REP,org_id:ORG}),db,ADMIN));assert.equal(count(db,'work_requests'),1);
 db.sqlite.prepare("UPDATE organization_editors SET status='active',version=version+1,activated_at=? WHERE id=?").run(STAMP,row.id);row=db.one('SELECT * FROM organization_editors');
 await assert.rejects(organizationAccessAction(form({action:'org_access_revoke',id:row.id,version:row.version-1}),db,ADMIN));assert.equal(db.one('SELECT status FROM organization_editors').status,'active');
 await organizationAccessAction(form({action:'org_access_revoke',id:row.id,version:row.version}),db,ADMIN);assert.equal(db.one('SELECT status FROM organization_editors').status,'revoked');assert.deepEqual(await getOrganizationMemberships(db,REP),[]);
});

test('admin publication is not limited to assigned organization pages',async t=>{
 const {db,env}=setup(t);const principal=await getHQPrincipal(get(),env,access(SECOND_ADMIN));
 await organizationProfileAction(form(profile({org_id:OTHER})),db,principal);
 assert.ok(db.one('SELECT * FROM profile_updates WHERE org_id=?',OTHER));assert.equal(db.one('SELECT actor FROM audit').actor,SECOND_ADMIN);
});

test('schema-4 backup preserves private organization memberships and older snapshots remain compatible',t=>{
 const {db}=setup(t);member(db);
 const directory=mkdtempSync(join(tmpdir(),'ycv-access-')),file=join(directory,'snapshot.json');t.after(()=>{rmSync(file,{force:true});rmdirSync(directory);});
 const snapshot={schema_version:4,exported_at:new Date().toISOString(),...Object.fromEntries(backupTables.map(table=>[table,db.all('SELECT * FROM '+table)]))};
 writeFileSync(file,JSON.stringify(snapshot));const report=verifyBackup(file);assert.equal(report.result,'passed');assert.equal(report.rows_by_table.organization_editors,1);
 delete snapshot.organization_editors;writeFileSync(file,JSON.stringify(snapshot));assert.throws(()=>verifyBackup(file),/missing table array organization_editors/);
 snapshot.schema_version=3;writeFileSync(file,JSON.stringify(snapshot));assert.equal(verifyBackup(file).result,'passed');
 snapshot.schema_version=2;delete snapshot.work_request_attachments;writeFileSync(file,JSON.stringify(snapshot));assert.equal(verifyBackup(file).result,'passed');
});
