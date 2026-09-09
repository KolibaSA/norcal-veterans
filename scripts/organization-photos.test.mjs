import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {cleanOrganizationPhoto,organizationPhotoAction,organizationPhotoCollaborationAction,readOrganizationPhoto} from '../src/organization-photos.mjs';
import {hqFetch,snapshot} from '../src/hq.mjs';
import {verifyBackup} from './verify-backup.mjs';
import {publicData} from '../src/storage.mjs';
import {records} from '../src/data.mjs';

const ORG='vfw-ca-8762',OTHER='vfw-ca-7244',REP='representative@example.test',ADMIN='smartzgraphics@yahoo.com',HQ='https://hq.example.test',NOW='2026-09-03T05:30:00.000Z';
const PNG=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7L8AAAAASUVORK5CYII=','base64'));
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
class Bucket{
 constructor(){this.objects=new Map();}async put(key,value){this.objects.set(key,value);return {key};}async get(key){const value=this.objects.get(key);return value===undefined?null:{size:Buffer.byteLength(value),json:async()=>JSON.parse(value)};}async delete(key){this.objects.delete(key);}
}
function setup(t){const db=new DB();t.after(()=>db.sqlite.close());return {DB:db,ATTACHMENTS:new Bucket(),OWNER_EMAIL:ADMIN,ACCESS_AUD:'aud'};}
function upload(extra={},bytes=PNG,type='image/png',headers={}){const form=new FormData();for(const[name,value]of Object.entries({action:'photo_upload',org_id:ORG,caption:'Our public meeting hall',alt_text:'A public meeting hall exterior',credit:'Organization photo',source_url:'https://example.org/',rights:'yes',...extra}))form.set(name,String(value));form.set('photo',new Blob([bytes],{type}),'photo.png');return new Request(HQ+'/organization/photos',{method:'POST',headers:{Origin:HQ,'Sec-Fetch-Site':'same-origin',...headers},body:form});}
function edit(row,extra={}){return new Request(HQ+'/organization/photos',{method:'POST',headers:{Origin:HQ,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({action:'photo_edit',org_id:row.org_id,id:row.id,version:String(row.version),caption:row.caption,alt_text:row.alt_text,credit:row.credit,source_url:row.source_url,rights:'yes',...extra})});}
const saved=env=>env.DB.one('SELECT * FROM organization_photos LIMIT 1');
const request=id=>new Request('https://public.example.test/organization-photos/'+id);
const collaborate=values=>new Request(HQ+'/organization/photo-collaboration',{method:'POST',headers:{Origin:HQ,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(values)});

test('albums, organization presence and owner approval are published without private actors',async t=>{
 const env=setup(t),otherPrincipal={email:'other@example.test',isAdmin:false,memberships:[{email:'other@example.test',org_id:OTHER,status:'active'}]};
 env.DB.sqlite.prepare('INSERT INTO organization_editors(id,email,org_id,display_name,status,version,created_by,created_at,updated_at,activated_at) VALUES (?,?,?,?,?,?,?,?,?,?)').run('other-membership',otherPrincipal.email,OTHER,'Other','active',1,ADMIN,NOW,NOW,NOW);
 await organizationPhotoCollaborationAction(collaborate({action:'album_add',org_id:ORG,name:'Community Service',description:'Neighbors working together.'}),env,principal);
 const album=env.DB.one('SELECT * FROM organization_photo_albums');assert.equal(album.name,'Community Service');
 await organizationPhotoAction(upload({album_id:album.id}),env,principal);const photo=saved(env);
 let presence=env.DB.sqlite.prepare('SELECT org_id,status FROM organization_photo_presence').all();assert.equal(presence.length,1);assert.equal(presence[0].org_id,ORG);assert.equal(presence[0].status,'approved');
 await organizationPhotoCollaborationAction(collaborate({action:'photo_presence_request',photo_id:photo.id,org_id:OTHER}),env,otherPrincipal);
 const pending=env.DB.one("SELECT * FROM organization_photo_presence WHERE org_id=?",OTHER);assert.equal(pending.status,'pending');
 let published=await publicData(env.DB,records);let publicPhoto=published.records.find(row=>row.id===ORG).photos[0];assert.equal(publicPhoto.album.name,'Community Service');assert.deepEqual(publicPhoto.present_organizations.map(row=>row.id),[ORG]);assert.equal(JSON.stringify(publicPhoto).includes('requested_by'),false);
 await organizationPhotoCollaborationAction(collaborate({action:'photo_presence_approve',org_id:ORG,id:pending.id,version:String(pending.version)}),env,principal);
 published=await publicData(env.DB,records);publicPhoto=published.records.find(row=>row.id===ORG).photos[0];assert.deepEqual(new Set(publicPhoto.present_organizations.map(row=>row.id)),new Set([ORG,OTHER]));
});

test('representative publishes a photo, sees editor controls, edits and removes it with verified audit attribution',async t=>{
 const env=setup(t);const result=await organizationPhotoAction(upload(),env,principal);assert.equal(result.status,303);assert.ok(result.headers.get('Location').endsWith('#photos'));let row=saved(env);assert.equal(row.uploaded_by,REP);assert.equal(row.content_type,'image/png');assert.equal(row.byte_size,PNG.length);assert.equal(row.version,1);
 const image=await readOrganizationPhoto(request(row.id),env,row.id);assert.equal(image.status,200);assert.equal(image.headers.get('Content-Type'),'image/png');assert.equal(image.headers.get('Cache-Control'),'no-store');assert.deepEqual(new Uint8Array(await image.arrayBuffer()),PNG);
 const page=await hqFetch(new Request(HQ+'/organization?org='+ORG),env,{access:{aud:'aud',getIdentity:async()=>({email:REP})}},{});const html=await page.text();assert.equal(page.status,200);assert.ok(html.includes('id="photos"'));assert.ok(html.includes('Publish photo'));assert.ok(html.includes('https://yolo-county-veterans.smartzgraphics.workers.dev/organization-photos/'+row.id));assert.ok(!html.includes('organization-photos/'+ORG+'/'));
 await organizationPhotoAction(edit(row,{caption:'An updated public caption'}),env,principal);assert.equal(saved(env).caption,'An updated public caption');assert.equal(saved(env).version,2);
 await assert.rejects(organizationPhotoAction(edit(row,{caption:'Stale overwrite'}),env,principal));row=saved(env);
 await organizationPhotoAction(edit(row,{action:'photo_remove'}),env,principal);assert.equal(saved(env),undefined);assert.equal((await readOrganizationPhoto(request(row.id),env,row.id)).status,404);assert.ok(env.ATTACHMENTS.objects.has(row.object_key),'Removed originals remain private for prior backups.');
 const audit=env.DB.sqlite.prepare('SELECT actor,action FROM audit').all();assert.equal(audit.length,3);assert.ok(audit.every(a=>a.actor===REP));
});

test('publication rejects foreign organization, CSRF, missing rights, invalid images and excessive size without storing data',async t=>{
 const env=setup(t);
 for(const req of [upload({org_id:OTHER}),upload({},PNG,'image/png',{Origin:'https://evil.test'}),upload({rights:''}),upload({},new TextEncoder().encode('<svg onload="alert(1)"></svg>'),'image/png'),upload({},new Uint8Array(5*1024*1024+1),'image/png')])await assert.rejects(organizationPhotoAction(req,env,principal));
 assert.equal(saved(env),undefined);assert.equal(env.ATTACHMENTS.objects.size,0);
});

test('write-time revocation prevents upload and removes only the new orphan object',async t=>{
 const env=setup(t);env.ATTACHMENTS.objects.set('requests/private-document','KEEP');env.DB.beforeBatch=()=>env.DB.sqlite.prepare("UPDATE organization_editors SET status='revoked'").run();
 await assert.rejects(organizationPhotoAction(upload(),env,principal));assert.equal(saved(env),undefined);assert.deepEqual([...env.ATTACHMENTS.objects.keys()],['requests/private-document']);assert.equal(env.DB.one('SELECT count(*) n FROM audit').n,0);
});

test('live revocation also prevents editing and removal from a stale organization session',async t=>{
 const env=setup(t);await organizationPhotoAction(upload(),env,principal);const row=saved(env);env.DB.sqlite.prepare("UPDATE organization_editors SET status='revoked'").run();
 await assert.rejects(organizationPhotoAction(edit(row,{caption:'Changed'}),env,principal));await assert.rejects(organizationPhotoAction(edit(row,{action:'photo_remove'}),env,principal));assert.equal(saved(env).version,1);assert.equal(saved(env).caption,row.caption);assert.equal(env.DB.one('SELECT count(*) n FROM audit').n,1);
});

test('gallery limit is enforced inside the insert and a failed thirteenth upload leaves no object or audit',async t=>{
 const env=setup(t);for(let i=0;i<12;i++)await organizationPhotoAction(upload({caption:'Photo '+i}),env,principal);await assert.rejects(organizationPhotoAction(upload(),env,principal));assert.equal(env.DB.one('SELECT count(*) n FROM organization_photos').n,12);assert.equal(env.ATTACHMENTS.objects.size,12);assert.equal(env.DB.one('SELECT count(*) n FROM audit').n,12);
});

test('public image handler cannot address request files, escaped object keys or corrupted gallery originals',async t=>{
 const env=setup(t);env.ATTACHMENTS.objects.set('requests/private-document','PRIVATE');
 for(const id of ['requests/private-document','../private-document','unknown'])assert.equal((await readOrganizationPhoto(request(id),env,id)).status,404);
 await organizationPhotoAction(upload(),env,principal);const row=saved(env);env.DB.sqlite.prepare('UPDATE organization_photos SET object_key=? WHERE id=?').run('requests/private-document',row.id);assert.equal((await readOrganizationPhoto(request(row.id),env,row.id)).status,404);
 env.DB.sqlite.prepare('UPDATE organization_photos SET object_key=? WHERE id=?').run(row.object_key,row.id);const envelope=JSON.parse(env.ATTACHMENTS.objects.get(row.object_key));envelope.base64=Buffer.alloc(row.byte_size).toString('base64');env.ATTACHMENTS.objects.set(row.object_key,JSON.stringify(envelope));assert.equal((await readOrganizationPhoto(request(row.id),env,row.id)).status,404);
});

test('PNG metadata is removed while original image chunks are preserved; false signatures and MIME mismatches fail',()=>{
 const payload=Buffer.from('GPS private camera note'),chunk=Buffer.alloc(payload.length+12);chunk.writeUInt32BE(payload.length,0);chunk.write('tEXt',4);payload.copy(chunk,8);const input=Buffer.concat([PNG.subarray(0,33),chunk,PNG.subarray(33)]);const cleaned=cleanOrganizationPhoto(input,'image/png');assert.deepEqual(cleaned.bytes,PNG);assert.ok(!Buffer.from(cleaned.bytes).includes(payload));
 assert.throws(()=>cleanOrganizationPhoto(PNG,'image/jpeg'));assert.throws(()=>cleanOrganizationPhoto(PNG.subarray(0,20),'image/png'));
});

test('JPEG strips metadata before and between image scans and drops trailing bytes',()=>{
 const segment=(marker,payload)=>Buffer.concat([Buffer.from([255,marker,(payload.length+2)>>8,(payload.length+2)&255]),payload]);
 const frame=segment(192,Buffer.from([8,0,1,0,1,1,1,17,0])),scan=segment(218,Buffer.from([1,1,0,0,63,0]));
 const original=Buffer.concat([Buffer.from([255,216]),segment(225,Buffer.from('private GPS location')),frame,scan,Buffer.from([1,2,255,0,3]),segment(254,Buffer.from('private camera note')),scan,Buffer.from([4,5,255,217]),Buffer.from('trailing private notes')]);
 const expected=Buffer.concat([Buffer.from([255,216]),frame,scan,Buffer.from([1,2,255,0,3]),scan,Buffer.from([4,5,255,217])]);
 assert.deepEqual(cleanOrganizationPhoto(original,'image/jpeg').bytes,new Uint8Array(expected));
});

test('phone JPEG orientation survives without preserving GPS, camera or other EXIF metadata',()=>{
 const segment=(marker,payload)=>Buffer.concat([Buffer.from([255,marker,(payload.length+2)>>8,(payload.length+2)&255]),payload]);
 const frame=segment(192,Buffer.from([8,0,1,0,1,1,1,17,0])),scan=segment(218,Buffer.from([1,1,0,0,63,0]));
 for(const little of [true,false])for(const orientation of [1,6,8,9]){
  const tiff=Buffer.alloc(100),view=new DataView(tiff.buffer,tiff.byteOffset,tiff.length);tiff.write(little?'II':'MM',0);view.setUint16(2,42,little);view.setUint32(4,8,little);view.setUint16(8,3,little);
  view.setUint16(10,274,little);view.setUint16(12,3,little);view.setUint32(14,1,little);view.setUint16(18,orientation,little);
  view.setUint16(22,271,little);view.setUint16(24,2,little);view.setUint32(26,14,little);view.setUint32(30,50,little);
  view.setUint16(34,34853,little);view.setUint16(36,4,little);view.setUint32(38,1,little);view.setUint32(42,70,little);tiff.write('PRIVATE CAMERA',50);tiff.write('PRIVATE GPS',70);
  const input=Buffer.concat([Buffer.from([255,216]),segment(225,Buffer.concat([Buffer.from('Exif\0\0'),tiff])),frame,scan,Buffer.from([1,2,255,217])]);
  const cleaned=Buffer.from(cleanOrganizationPhoto(input,'image/jpeg').bytes);assert.ok(!cleaned.includes('PRIVATE'));
  if(orientation<=8){assert.equal(cleaned.indexOf('Exif\0\0'),6);const out=cleaned.subarray(12,38);assert.equal(out.readUInt16LE(8),1);assert.equal(out.readUInt16LE(10),274);assert.equal(out.readUInt16LE(18),orientation);assert.equal(cleaned.length,2+36+frame.length+scan.length+4);}
  else assert.equal(cleaned.indexOf('Exif\0\0'),-1);
 }
});

test('schema-7 restore includes gallery metadata and schema-4 backups remain compatible',async t=>{
 const env=setup(t);await organizationPhotoAction(upload(),env,principal);const data={schema_version:7,exported_at:NOW,...await snapshot(env.DB)};const directory=mkdtempSync(join(tmpdir(),'ycv-photos-')),file=join(directory,'snapshot.json');t.after(()=>rmSync(directory,{recursive:true,force:true}));writeFileSync(file,JSON.stringify(data));const report=verifyBackup(file);assert.equal(report.result,'passed');assert.equal(report.rows_by_table.organization_photos,1);
 delete data.organization_photos;writeFileSync(file,JSON.stringify(data));assert.throws(()=>verifyBackup(file),/missing table array organization_photos/);data.schema_version=4;writeFileSync(file,JSON.stringify(data));assert.equal(verifyBackup(file).result,'passed');
});

