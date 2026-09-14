import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {organizationOfficerAction,organizationOfficerRows} from '../src/organization-officers.mjs';
import {publicData} from '../src/storage.mjs';
import {render} from '../src/site.mjs';
import {records} from '../src/data.mjs';
import {hqFetch,snapshot} from '../src/hq.mjs';
import publicWorker from '../dist/worker.mjs';
import {verifyBackup} from './verify-backup.mjs';

const ORG='vfw-ca-8762',OTHER='vfw-ca-7244',REP='representative@example.test',ADMIN='smartzgraphics@yahoo.com',HQ='https://hq.example.test',PUBLIC='https://public.example.test',NOW='2026-09-04T00:45:00.000Z';
const principal={email:REP,isAdmin:false,memberships:[{email:REP,org_id:ORG,status:'active'}]};
const schema=readdirSync(new URL('../migrations/',import.meta.url)).filter(name=>/^\d+.*\.sql$/.test(name)).sort().map(name=>readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8')).join('\n');
class Statement{
 constructor(db,sql,values=[]){Object.assign(this,{db,sql,values});}bind(...values){return new Statement(this.db,this.sql,values);}
 execute(){const q=this.db.sqlite.prepare(this.sql);let results=[];if(q.columns().length)results=q.all(...this.values).map(row=>({...row}));else q.run(...this.values);return {success:true,results,meta:{changes:Number(this.db.sqlite.prepare('SELECT changes() n').get().n)}};}
 async all(){return this.execute();}async run(){return this.execute();}
}
class DB{
 constructor(){this.sqlite=new DatabaseSync(':memory:');this.sqlite.exec(schema);this.sqlite.prepare('INSERT INTO organization_editors(id,email,org_id,display_name,status,version,created_by,created_at,updated_at,activated_at) VALUES (?,?,?,?,?,?,?,?,?,?)').run('membership',REP,ORG,'Representative','active',1,ADMIN,NOW,NOW,NOW);}
 prepare(sql){return new Statement(this,sql);}one(sql,...values){return this.sqlite.prepare(sql).get(...values);}
 async batch(statements){if(this.beforeBatch){const hook=this.beforeBatch;this.beforeBatch=null;hook();}this.sqlite.exec('BEGIN');try{const out=statements.map(s=>s.execute());this.sqlite.exec('COMMIT');return out;}catch(error){this.sqlite.exec('ROLLBACK');throw error;}}
}
function setup(t){const db=new DB();t.after(()=>db.sqlite.close());return db;}
function post(values,origin=HQ){return new Request(HQ+'/organization/officers',{method:'POST',headers:{Origin:origin,'Sec-Fetch-Site':'same-origin','Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(values)});}
const add=(extra={},origin=HQ)=>post({action:'officer_add',org_id:ORG,public_name:'Jordan Rivera',title:'Post Commander',bio:'Jordan supports local veterans and coordinates community service projects.',photo_id:'',consent:'yes',...extra},origin);
const saved=db=>db.one('SELECT * FROM organization_officers LIMIT 1');

test('active representative publishes, edits and removes a voluntary officer profile with verified audit history',async t=>{
 const db=setup(t);let response=await organizationOfficerAction(add(),{DB:db},principal);assert.equal(response.status,303);assert.ok(response.headers.get('Location').endsWith('#officers'));let row=saved(db);assert.equal(row.public_name,'Jordan Rivera');assert.equal(row.consent_attested_by,REP);assert.equal(row.created_by,REP);assert.equal(row.version,1);
 response=await organizationOfficerAction(post({action:'officer_edit',org_id:ORG,id:row.id,version:'1',public_name:row.public_name,title:'Senior Vice Commander',bio:row.bio,photo_id:'',consent:'yes'}),{DB:db},principal);assert.equal(response.status,303);row=saved(db);assert.equal(row.title,'Senior Vice Commander');assert.equal(row.version,2);
 await assert.rejects(organizationOfficerAction(post({action:'officer_edit',org_id:ORG,id:row.id,version:'1',public_name:row.public_name,title:'Stale',bio:row.bio,photo_id:'',consent:'yes'}),{DB:db},principal));
 response=await organizationOfficerAction(post({action:'officer_remove',org_id:ORG,id:row.id,version:'2'}),{DB:db},principal);assert.equal(response.status,303);assert.equal(saved(db),undefined);assert.equal(db.one("SELECT count(*) n FROM revisions WHERE entity='organization_officer'").n,2);assert.deepEqual(db.sqlite.prepare('SELECT actor,action FROM audit ORDER BY created_at').all().map(x=>x.actor),[REP,REP,REP]);
});

test('public organization page renders consented profiles and optional approved gallery photos without bulk JSON exposure',async t=>{
 const db=setup(t);db.sqlite.prepare("INSERT INTO organization_photos(id,org_id,image_url,caption,alt_text,uploaded_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)").run('approved-portrait',ORG,'https://example.org/portrait.jpg','Approved portrait','Approved officer portrait',REP,NOW,NOW);
 await organizationOfficerAction(add({photo_id:'approved-portrait'}),{DB:db},principal);
 const live=await publicData(db,records),record=live.records.find(r=>r.id===ORG);assert.equal(record.officer_profiles.length,1);assert.equal(record.officer_profiles[0].photo.src,'https://example.org/portrait.jpg');assert.ok(!JSON.stringify(record.officer_profiles[0]).includes(REP));
 const html=render(new URL(PUBLIC+'/organizations/'+ORG),live.records).html;assert.match(html,/id="officers"/);assert.match(html,/Jordan Rivera/);assert.match(html,/Senior|Post Commander/);assert.match(html,/not a complete officer roster/);
 const json=await (await publicWorker.fetch(new Request(PUBLIC+'/data.json'),{DB:db})).text();assert.ok(!json.includes('Jordan Rivera'));assert.ok(!json.includes('officer_profiles'));
});

test('every organization gets an officer empty state without the removed shortcut; private editor gets consent-first controls',async t=>{
 const db=setup(t),live=await publicData(db,records);
 for(const record of live.records){const html=render(new URL(PUBLIC+'/organizations/'+record.id),live.records).html;assert.doesNotMatch(html,/href="#officers"/);assert.match(html,/No officer profiles have been provided for publication/);}
 const page=await hqFetch(new Request(HQ+'/organization?org='+ORG),{DB:db,OWNER_EMAIL:ADMIN,ACCESS_AUD:'aud'},{access:{aud:'aud',getIdentity:async()=>({email:REP})}},{}),html=await page.text();assert.equal(page.status,200);assert.match(html,/id="officers"/);assert.match(html,/Add an officer profile/);assert.match(html,/agreed to public display/);
});

test('officer writes reject missing consent, contact details, addresses, foreign photos, CSRF and write-time revocation',async t=>{
 const db=setup(t);db.sqlite.prepare("INSERT INTO organization_photos(id,org_id,image_url,caption,alt_text,uploaded_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)").run('foreign-photo',OTHER,'https://example.org/portrait.jpg','','Portrait',ADMIN,NOW,NOW);
 for(const req of [add({consent:''}),add({bio:'Call 916-555-1212 or email private@example.org.'}),add({bio:'Lives at 123 Main Street, Davis, CA 95616.'}),add({photo_id:'foreign-photo'}),add({},'https://evil.test'),add({org_id:OTHER})])await assert.rejects(organizationOfficerAction(req,{DB:db},principal));
 assert.equal(saved(db),undefined);assert.equal(db.one('SELECT count(*) n FROM audit').n,0);
 db.beforeBatch=()=>db.sqlite.prepare("UPDATE organization_editors SET status='revoked'").run();await assert.rejects(organizationOfficerAction(add(),{DB:db},principal));assert.equal(saved(db),undefined);assert.equal(db.one('SELECT count(*) n FROM audit').n,0);
});

test('schema-6 restore includes officer profiles and schema-5 backups remain compatible',async t=>{
 const db=setup(t);await organizationOfficerAction(add(),{DB:db},principal);const data={schema_version:6,exported_at:NOW,...await snapshot(db)},directory=mkdtempSync(join(tmpdir(),'ycv-officers-')),file=join(directory,'snapshot.json');t.after(()=>rmSync(directory,{recursive:true,force:true}));writeFileSync(file,JSON.stringify(data));let report=verifyBackup(file);assert.equal(report.result,'passed');assert.equal(report.rows_by_table.organization_officers,1);
 delete data.organization_officers;writeFileSync(file,JSON.stringify(data));assert.throws(()=>verifyBackup(file),/missing table array organization_officers/);data.schema_version=5;writeFileSync(file,JSON.stringify(data));report=verifyBackup(file);assert.equal(report.result,'passed');
});
