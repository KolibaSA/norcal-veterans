import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,mkdtempSync,writeFileSync,rmSync,rmdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {uploadRequestAttachment,downloadRequestAttachment,createWorkRequestWithAttachment} from '../src/request-attachments.mjs';
import {hqFetch} from '../src/hq.mjs';
import {backupTables,verifyBackup} from './verify-backup.mjs';

const HQ='https://hq.example.test',AUTHOR='owner@example.test',EDITOR='sterling@example.test';
const REQUEST_ID='11111111-1111-4111-8111-111111111111';
const MIGRATIONS=readdirSync(new URL('../migrations/',import.meta.url)).filter(name=>/^\d+.*\.sql$/.test(name)).sort();
class Statement{
 constructor(db,sql,values=[]){this.db=db;this.sql=sql;this.values=values;}
 bind(...values){return new Statement(this.db,this.sql,values);}
 execute(){const q=this.db.sqlite.prepare(this.sql);const results=q.columns().length?q.all(...this.values).map(row=>({...row})):[];let changes;if(q.columns().length)changes=Number(this.db.sqlite.prepare('SELECT changes() n').get().n);else changes=Number(q.run(...this.values).changes);return {success:true,results,meta:{changes}};}
 async all(){return this.execute();}
 async run(){return this.execute();}
 async first(){return this.execute().results[0]??null;}
}
class D1{
 constructor(){this.sqlite=new DatabaseSync(':memory:');for(const name of MIGRATIONS)this.sqlite.exec(readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8'));}
 prepare(sql){return new Statement(this,sql);}
 async batch(statements){this.sqlite.exec('BEGIN IMMEDIATE');try{const results=statements.map(s=>s.execute());this.sqlite.exec('COMMIT');return results;}catch(error){this.sqlite.exec('ROLLBACK');throw error;}}
 one(sql,...values){return this.sqlite.prepare(sql).get(...values);}
 all(sql,...values){return this.sqlite.prepare(sql).all(...values).map(row=>({...row}));}
}
class R2{
 objects=new Map();puts=[];gets=[];deletes=[];
 async put(key,value,options){const bytes=new Uint8Array(await new Response(value).arrayBuffer());this.puts.push(key);this.objects.set(key,{bytes,options});if(this.afterPut)await this.afterPut(key);return {key};}
 async get(key){this.gets.push(key);const value=this.objects.get(key);if(!value)return null;return {key,size:value.bytes.byteLength,body:new Blob([value.bytes]).stream(),httpMetadata:value.options?.httpMetadata??{},arrayBuffer:async()=>value.bytes.slice().buffer,json:async()=>JSON.parse(Buffer.from(value.bytes).toString('utf8'))};}
 async delete(key){this.deletes.push(key);this.objects.delete(key);}
}
function setup(t){const db=new D1(),bucket=new R2();t.after(()=>db.sqlite.close());db.sqlite.prepare("INSERT INTO work_requests(id,target,title,details,requested_by,last_actor,status,version,claim_token,claim_until,created_at,updated_at) VALUES (?,'website','Use this artwork','Please update the artwork',?,?,'in_progress',7,'old-run','2099-01-01T00:00:00.000Z','2026-09-02T12:00:00.000Z','2026-09-02T12:00:00.000Z')").run(REQUEST_ID,AUTHOR,AUTHOR);return {db,bucket,env:{DB:db,ATTACHMENTS:bucket,OWNER_EMAIL:AUTHOR,HQ_EDITOR_EMAILS:EDITOR,ACCESS_AUD:'test-aud'}};}
function upload({filename='artwork.svg',contents='<svg>reference</svg>',type='image/svg+xml',version='7',id=REQUEST_ID,note='Use this reference.',headers={},extraFile=false}={}){const form=new FormData();form.set('request_id',id);form.set('version',version);form.set('file',new File([contents],filename,{type}));if(note!==null)form.set('note',note);if(extraFile)form.append('file',new File(['second'],'second.txt',{type:'text/plain'}));const h=new Headers({Origin:HQ,'Sec-Fetch-Site':'same-origin',...headers});for(const [key,value]of Object.entries(headers))if(value===null)h.delete(key);return new Request(HQ+'/attachments/upload',{method:'POST',headers:h,body:form});}
const count=(db,table)=>Number(db.one(`SELECT count(*) n FROM ${table}`).n);
const requestRow=db=>db.one('SELECT * FROM work_requests WHERE id=?',REQUEST_ID);
const access=email=>({access:{aud:'test-aud',getIdentity:async()=>({email})}});

test('a new request can include its first file in one submission',async t=>{
 const {db,bucket,env}=setup(t),id='33333333-3333-4333-8333-333333333333',form=new FormData();
 form.set('action','work_create');form.set('id',id);form.set('details','Add this logo to the organization profile.');form.set('target','website');form.set('title','Add organization logo');form.set('file',new File(['logo bytes'],'logo.png',{type:'image/png'}));form.set('note','Use this as the official chapter logo.');
 const response=await createWorkRequestWithAttachment(new Request(HQ+'/requests',{method:'POST',headers:{Origin:HQ,'Sec-Fetch-Site':'same-origin'},body:form}),env,EDITOR);
 assert.equal(response.status,303);assert.ok(response.headers.get('Location').includes(id));
 const row=db.one('SELECT * FROM work_requests WHERE id=?',id),attachment=db.one('SELECT * FROM work_request_attachments WHERE request_id=?',id);
 assert.equal(row.requested_by,EDITOR);assert.equal(row.status,'queued');assert.equal(row.version,2);assert.equal(attachment.filename,'logo.png');assert.equal(attachment.uploaded_by,EDITOR);assert.equal(bucket.objects.size,1);
 const messages=db.all('SELECT kind,body FROM work_request_messages WHERE request_id=? ORDER BY created_at,id',id);assert.equal(messages.length,2);assert.equal(messages[0].kind,'request');assert.equal(messages[1].kind,'reply');assert.match(messages[1].body,/official chapter logo/);
});

test('upload preserves bytes, verified attribution and history while requeuing an in-flight request',async t=>{
 const {db,bucket,env}=setup(t),contents='<svg><script>reference only</script></svg>';
 const response=await uploadRequestAttachment(upload({contents,headers:{'Cf-Access-Authenticated-User-Email':AUTHOR}}),env,EDITOR);
 assert.equal(response.status,303);assert.ok(response.headers.get('Location').includes(REQUEST_ID));
 const meta=db.one('SELECT * FROM work_request_attachments'),row=requestRow(db);
 assert.equal(meta.uploaded_by,EDITOR);assert.equal(meta.request_id,REQUEST_ID);assert.equal(meta.filename,'artwork.svg');
 assert.equal(meta.byte_size,Buffer.byteLength(contents));assert.equal(meta.sha256,createHash('sha256').update(contents).digest('hex'));
 assert.equal(bucket.objects.size,1);const envelope=JSON.parse(Buffer.from(bucket.objects.get(meta.object_key).bytes).toString('utf8'));assert.equal(envelope.schema_version,1);assert.equal(envelope.byte_size,meta.byte_size);assert.equal(envelope.sha256,meta.sha256);assert.equal(Buffer.from(envelope.base64,'base64').toString('utf8'),contents);
 assert.equal(bucket.objects.get(meta.object_key).options.httpMetadata.contentType,'text/plain','The private R2 connector must receive the envelope as unmodified JSON text.');
 assert.equal(row.requested_by,AUTHOR);assert.equal(row.last_actor,EDITOR);assert.equal(row.status,'queued');assert.equal(row.version,8);assert.equal(row.claim_token,null);assert.equal(row.claim_until,null);
 const messages=db.all('SELECT * FROM work_request_messages');assert.equal(messages.length,1);assert.equal(messages[0].actor,EDITOR);assert.match(messages[0].body,/artwork\.svg/);assert.match(messages[0].body,/Use this reference/);
 assert.equal(db.one('SELECT actor FROM audit').actor,EDITOR);assert.equal(count(db,'revisions'),1);
 const timing=db.one('SELECT * FROM request_processor');assert.equal(timing.last_activity_at,row.updated_at);assert.ok(timing.active_until>timing.last_activity_at);
});

test('attachment downloads use metadata IDs and force private non-executable download headers',async t=>{
 const {db,bucket,env}=setup(t),contents='<svg><script>alert(1)</script></svg>';
 await uploadRequestAttachment(upload({contents}),env,EDITOR);const meta=db.one('SELECT * FROM work_request_attachments');
 const response=await downloadRequestAttachment(new Request(HQ+'/attachments/'+meta.id),env,meta.id);
 assert.equal(response.status,200);assert.equal(response.headers.get('Content-Type'),'application/octet-stream');assert.equal(response.headers.get('Cache-Control'),'no-store');assert.equal(response.headers.get('X-Content-Type-Options'),'nosniff');assert.match(response.headers.get('Content-Disposition'),/^attachment;/);assert.equal(await response.text(),contents);
 const gets=bucket.gets.length;assert.equal((await downloadRequestAttachment(new Request(HQ+'/attachments/invalid'),env,meta.object_key)).status,404);assert.equal(bucket.gets.length,gets);
 assert.equal((await downloadRequestAttachment(new Request(HQ+'/attachments/missing'),env,'22222222-2222-4222-8222-222222222222')).status,404);
 bucket.objects.clear();assert.equal((await downloadRequestAttachment(new Request(HQ+'/attachments/'+meta.id),env,meta.id)).status,404);
});

test('HQ rejects missing or spoofed identity before reading or uploading attachment data',async t=>{
 const {bucket,env}=setup(t);
 for(const ctx of [undefined,{},access('outsider@example.test')]){
  const headers={'Cf-Access-Authenticated-User-Email':AUTHOR};
  assert.equal((await hqFetch(new Request(HQ+'/attachments/'+REQUEST_ID,{headers}),env,ctx,{})).status,403);
  assert.equal((await hqFetch(upload({headers}),env,ctx,{})).status,403);
 }
 assert.equal(bucket.gets.length,0);assert.equal(bucket.puts.length,0);
});

test('cross-origin, missing-origin and cross-site uploads cannot change the queue or object storage',async t=>{
 const {db,bucket,env}=setup(t);
 for(const headers of [{Origin:'https://evil.test'},{Origin:null},{'Sec-Fetch-Site':'cross-site'}])await assert.rejects(uploadRequestAttachment(upload({headers}),env,EDITOR));
 assert.equal(bucket.puts.length,0);assert.equal(count(db,'work_request_attachments'),0);assert.equal(requestRow(db).version,7);
});

test('disallowed files, excess files and notes fail without saving data',async t=>{
 const {db,bucket,env}=setup(t);
 for(const values of [{filename:'run.exe'},{filename:'page.html'},{extraFile:true},{note:'x'.repeat(2001)}])await assert.rejects(uploadRequestAttachment(upload(values),env,EDITOR));
 assert.equal(bucket.puts.length,0);assert.equal(count(db,'work_request_attachments'),0);assert.equal(requestRow(db).version,7);
});

test('file and actual streamed body limits reject oversized requests even with a misleading length header',async t=>{
 const {db,bucket,env}=setup(t);
 await assert.rejects(uploadRequestAttachment(upload({filename:'large.pdf',type:'application/pdf',contents:new Uint8Array(10*1024*1024+1)}),env,EDITOR));
 const oversized=new Request(HQ+'/attachments/upload',{method:'POST',headers:{Origin:HQ,'Sec-Fetch-Site':'same-origin','Content-Type':'multipart/form-data; boundary=x','Content-Length':'1'},body:new Uint8Array(11*1024*1024+1)});
 await assert.rejects(uploadRequestAttachment(oversized,env,EDITOR));
 assert.equal(bucket.puts.length,0);assert.equal(count(db,'work_request_attachments'),0);assert.equal(requestRow(db).version,7);
});

test('stale or unknown request references do not persist uploads',async t=>{
 const {db,bucket,env}=setup(t);
 await assert.rejects(uploadRequestAttachment(upload({version:'6'}),env,EDITOR));
 await assert.rejects(uploadRequestAttachment(upload({id:'22222222-2222-4222-8222-222222222222'}),env,EDITOR));
 assert.equal(bucket.objects.size,0);assert.equal(count(db,'work_request_attachments'),0);assert.equal(count(db,'audit'),0);assert.equal(requestRow(db).version,7);
});

test('a reply racing the object upload wins and the orphaned object is removed',async t=>{
 const {db,bucket,env}=setup(t);
 bucket.afterPut=async()=>{db.sqlite.prepare("UPDATE work_requests SET version=8,status='queued',last_actor=?,claim_token=NULL,claim_until=NULL WHERE id=?").run(AUTHOR,REQUEST_ID);};
 await assert.rejects(uploadRequestAttachment(upload(),env,EDITOR));
 assert.equal(bucket.objects.size,0);assert.equal(bucket.deletes.length,1);assert.equal(count(db,'work_request_attachments'),0);assert.equal(count(db,'audit'),0);assert.equal(count(db,'work_request_messages'),0);assert.equal(requestRow(db).version,8);assert.equal(requestRow(db).last_actor,AUTHOR);
});

test('a metadata transaction failure rolls back the queue and removes the stored object',async t=>{
 const {db,bucket,env}=setup(t);
 db.sqlite.exec("CREATE TRIGGER fail_attachment BEFORE INSERT ON work_request_attachments BEGIN SELECT RAISE(ABORT,'test metadata failure'); END;");
 await assert.rejects(uploadRequestAttachment(upload(),env,EDITOR));
 assert.equal(bucket.objects.size,0);assert.equal(bucket.deletes.length,1);assert.equal(count(db,'work_request_attachments'),0);assert.equal(count(db,'audit'),0);assert.equal(count(db,'work_request_messages'),0);assert.equal(requestRow(db).version,7);assert.equal(count(db,'revisions'),0);
});

test('a transport error after a successful metadata commit preserves the referenced object',async t=>{
 const {db,bucket,env}=setup(t),batch=db.batch.bind(db);db.batch=async statements=>{await batch(statements);throw new Error('Transport failed after commit');};
 const response=await uploadRequestAttachment(upload(),env,EDITOR);
 assert.equal(response.status,303);assert.equal(count(db,'work_request_attachments'),1);assert.equal(requestRow(db).version,8);assert.equal(bucket.objects.size,1);assert.equal(bucket.deletes.length,0);
});

test('download refuses a stored envelope whose contents fail the saved SHA-256',async t=>{
 const {db,bucket,env}=setup(t);await uploadRequestAttachment(upload({filename:'reference.txt',contents:'original',type:'text/plain'}),env,EDITOR);
 const meta=db.one('SELECT * FROM work_request_attachments'),object=bucket.objects.get(meta.object_key);const envelope=JSON.parse(Buffer.from(object.bytes).toString('utf8'));envelope.base64=Buffer.from('tampered').toString('base64');object.bytes=new TextEncoder().encode(JSON.stringify(envelope));
 const response=await downloadRequestAttachment(new Request(HQ+'/attachments/'+meta.id),env,meta.id).catch(()=>null);
 assert.ok(response===null||response.status>=400,'Corrupt file must never be returned as a successful download.');
});

test('schema-3 backup restores attachment metadata, rejects omissions and retains schema-2 compatibility',async t=>{
 const {db,env}=setup(t);await uploadRequestAttachment(upload({filename:'reference.txt',type:'text/plain'}),env,EDITOR);
 const directory=mkdtempSync(join(tmpdir(),'ycv-attachments-'));t.after(()=>{rmSync(join(directory,'snapshot.json'),{force:true});rmdirSync(directory);});
 const snapshot={schema_version:3,exported_at:new Date().toISOString(),...Object.fromEntries(backupTables.filter(table=>table!=='organization_editors').map(table=>[table,db.all('SELECT * FROM '+table)]))};
 const file=join(directory,'snapshot.json');writeFileSync(file,JSON.stringify(snapshot));
 const report=verifyBackup(file);assert.equal(report.result,'passed');assert.equal(report.rows_by_table.work_request_attachments,1);assert.match(report.limitation,/metadata only|metadata;|metadata|file bytes/);
 delete snapshot.work_request_attachments;writeFileSync(file,JSON.stringify(snapshot));assert.throws(()=>verifyBackup(file),/missing table array work_request_attachments/);
 snapshot.schema_version=2;writeFileSync(file,JSON.stringify(snapshot));const old=verifyBackup(file);assert.equal(old.result,'passed');assert.equal(old.schema_version,2);assert.ok(!old.migrations.some(name=>name.startsWith('0003')));
});

