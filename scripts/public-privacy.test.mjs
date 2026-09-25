import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {records,sources,dataset} from '../src/data.mjs';
import {render} from '../src/site.mjs';
import {publicData} from '../src/storage.mjs';
import {sanitizePublicRecord,assertPublicProfilePrivacy} from '../src/public-privacy.mjs';
import {hqAction} from '../src/hq.mjs';
import {organizationProfileAction} from '../src/organization-profile.mjs';
import publicWorker from '../dist/worker.mjs';

const HQ='https://hq.example.test',ADMIN='smartzgraphics@yahoo.com',ORG='vfw-ca-8762';
const PRIVATE='PRIVATE_MEMBER_METADATA_SENTINEL';
const removedNames=['Sterling Koliba','Wayne Holland','Lindsay Remer','Marty De Venuta','Bob Bell','William Lower','Mark Almeida','Jeffrey L Jewell','John Fashing','Jim Wheeler','Gary Hill','Arvell Howell','Faye Jenkens-Bellow','Greg Young','Wayne A Holland','Marty Welch','Jeremy Paul','Gary L Ritchie','Richard Gamoras','Raymond E Hart','Paul Del Rosario','Richard (Ric) Deems'];
const removedContacts=['707-365-0919','707-365-9570','707-643-7074','707-389-9175','707-246-0919','707-745-1769','707-249-5853','707-365-8384','vacavillelegionpost165@gmail.com','alpost208@aol.com'];
const removedSourceURLs=['https://vfwca.org/di/vfw/v2/postroster.asp','https://vfw8151.org/di/vfw/v2/default.asp?pid=122927','https://post178rvca.org/post-officers','https://calegion.org/district-5/','https://www.cadav84.org/about-who-we-are'];
const assertNoImportedPersonalData=text=>{for(const value of [...removedNames,...removedContacts,...removedSourceURLs])assert.ok(!text.includes(value),'Unexpected imported personal data or roster source: '+value);assert.ok(!/mylegion\.org[^"<>\s]*Post-Detail/i.test(text));};
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
 async batch(statements){this.sqlite.exec('BEGIN IMMEDIATE');try{const result=statements.map(s=>s.execute());this.sqlite.exec('COMMIT');return result;}catch(error){this.sqlite.exec('ROLLBACK');throw error;}}
}
function database(t){const db=new D1();t.after(()=>db.sqlite.close());return db;}
function form(values){const f=new FormData();for(const[k,v]of Object.entries(values))f.set(k,String(v));return f;}
const profile=(extra={})=>({action:'profile_publish',org_id:ORG,version:'',meeting_schedule:'Second Wednesday, 6:30 p.m.',member_information:'Public meetings and community volunteering.',phone:'916-371-7245',email:'office@example.org',website:'https://example.org/',source_url:'https://example.org/about',reviewed:'yes',...extra});
const post=values=>new Request(HQ+'/action',{method:'POST',headers:{Origin:HQ,'Sec-Fetch-Site':'same-origin','Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(values)});

test('current public records and source exports omit imported officers, direct contacts and roster links',()=>{
 assertNoImportedPersonalData(JSON.stringify(dataset));
 for(const record of records){assert.equal(record.officers?.length??0,0,record.id);assert.notEqual(record.address?.type,'residential');for(const id of record.source_ids)assert.ok(sources.some(source=>source.id===id),record.id+' has missing source '+id);}
 for(const source of sources)assert.ok(!/postroster|post-officers|\/officers(?:[/?#]|$)|post-detail/i.test(source.url),source.url);
});

test('every public organization page remains reachable without an officer listing or imported personal data',()=>{
 for(const record of records){const page=render(new URL('https://test/organizations/'+record.id));assert.equal(page.status,200,record.id);assertNoImportedPersonalData(page.html);assert.ok(!page.html.includes('Listed officers'));assert.ok(!page.html.includes('Officer source'));}
 for(const path of ['/','/about']){const page=render(new URL('https://test'+path));assert.equal(page.status,200);const html=path==='/'?page.html.replace('Contact Sterling Koliba at <a href="mailto:sterling.koliba@gmail.com">sterling.koliba@gmail.com</a>.',''):page.html;assertNoImportedPersonalData(html);}
 const county=render(new URL('https://test/organizations/vso-solano')).html;assert.ok(county.includes('707-784-6590'));assert.ok(county.includes('675 Texas Street'));
 const postPage=render(new URL('https://test/organizations/'+ORG)).html;assert.ok(postPage.includes('916-371-7245'));assert.ok(postPage.includes('905 Drever Street'));
});

test('record sanitation removes private nested fields and residential locations while retaining public organizational channels',()=>{
 const base=records.find(record=>record.id===ORG);
 const unsafe={...base,officers:[{name:PRIVATE,phone:'private direct phone'}],members:[{name:PRIVATE}],member_roster:[PRIVATE],organization_editors:[PRIVATE],private_notes:PRIVATE,address:{type:'residential',text:PRIVATE,map_eligible:true},public_contacts:{...base.public_contacts,home_phone:PRIVATE,personal_email:PRIVATE,private_notes:PRIVATE}};
 const cleaned=sanitizePublicRecord(unsafe);assert.ok(!JSON.stringify(cleaned).includes(PRIVATE));assert.equal(cleaned.officers?.length??0,0);assert.ok(!cleaned.address||cleaned.address.type!=='residential');assert.equal(cleaned.public_contacts.phone,base.public_contacts.phone);assert.equal(cleaned.public_contacts.website,base.public_contacts.website);assert.equal(cleaned.id,base.id);
});

test('runtime publication sanitizes base records even when no database is configured',async()=>{
 const unsafe={...records.find(record=>record.id===ORG),officers:[{name:PRIVATE}],member_roster:[PRIVATE],private_notes:PRIVATE};
 const result=await publicData(null,[unsafe],[]);assert.ok(!JSON.stringify(result).includes(PRIVATE));assert.equal(result.records[0].id,ORG);
});

test('unsafe legacy profile corrections are withheld and private organization memberships stay private',async t=>{
 const db=database(t),base=records.find(record=>record.id===ORG);
 db.sqlite.prepare('INSERT INTO profile_updates(org_id,body_json,source_url,reviewed_at) VALUES (?,?,?,?)').run(ORG,JSON.stringify({meeting_schedule:'Member roster: '+PRIVATE,member_information:'Personal home address: '+PRIVATE,phone:'private direct phone',email:'private@example.test',website:'https://example.org/member-roster'}),'https://vfwca.org/di/vfw/v2/postroster.asp','2026-09-02T12:00:00.000Z');
 db.sqlite.prepare("INSERT INTO organization_editors(id,email,org_id,display_name,status,version,created_by,created_at,updated_at) VALUES ('private-editor','private-representative@example.test',?,?,'active',1,?,?,?)").run(ORG,PRIVATE,ADMIN,'2026-09-02T12:00:00.000Z','2026-09-02T12:00:00.000Z');
 const result=await publicData(db,records,[]),json=JSON.stringify(result);assert.ok(!json.includes(PRIVATE));assert.ok(!json.includes('private-representative@example.test'));assert.ok(!json.includes('organization_editors'));assert.ok(!json.includes('member-roster'));assert.equal(result.records.find(record=>record.id===ORG).public_contacts.phone,base.public_contacts.phone);
});

test('administrator and representative publication both reject roster links and explicit personal-address content',async t=>{
 const db=database(t),principal={email:ADMIN,isAdmin:true,memberships:[]};
 const prohibited=[{source_url:'https://vfwca.org/di/vfw/v2/postroster.asp'},{website:'https://example.org/member-roster'},{source_url:'https://post178rvca.org/post-officers'},{source_url:'https://example.org/officers'},{source_url:'https://mylegion.org/PersonifyEbusiness/Post-Detail?post=123'},{member_information:'Member roster: '+PRIVATE},{member_information:'Personal home address: '+PRIVATE}];
 for(const bad of prohibited){assert.throws(()=>assertPublicProfilePrivacy(profile(bad)));await assert.rejects(hqAction(post(profile(bad)),db,ADMIN));await assert.rejects(organizationProfileAction(form({...profile(bad),action:'organization_profile_publish'}),db,principal));}
 assert.equal(db.sqlite.prepare('SELECT count(*) n FROM profile_updates').get().n,0);assert.equal(db.sqlite.prepare('SELECT count(*) n FROM audit').get().n,0);
});

test('ordinary organizational contact updates remain publishable',async t=>{
 const db=database(t);assert.doesNotThrow(()=>assertPublicProfilePrivacy(profile()));await hqAction(post(profile()),db,ADMIN);
 const result=await publicData(db,records,[]),record=result.records.find(record=>record.id===ORG);assert.equal(record.public_contacts.phone,'916-371-7245');assert.equal(record.public_contacts.email,'office@example.org');assert.equal(record.member_information,'Public meetings and community volunteering.');
});

test('built public data and profile routes apply the same privacy boundary',async t=>{
 const db=database(t),env={DB:db};
 for(const path of ['/data.json','/about','/organizations/vfw-ca-8151','/organizations/dav-ca-84']){const response=await publicWorker.fetch(new Request('https://test'+path),env);assert.equal(response.status,200,path);assertNoImportedPersonalData(await response.text());}
 const response=await publicWorker.fetch(new Request('https://test/data.json'),env);const json=await response.json();assert.equal(json.records.length,records.length);assert.ok(json.records.some(record=>record.id===ORG));
});

test('organization photo galleries retain safe sources through repeated sanitation and exclude private metadata',()=>{
 const base=records.find(record=>record.id===ORG);
 const record={...base,photos:[{id:'public-photo',image_url:'https://images.example.org/hall.jpg',caption:'Our public meeting hall',alt_text:'Exterior of the public hall',credit:'Organization website',source_url:'https://example.org/photos',license:'Rights retained by source',uploaded_by:PRIVATE,object_key:PRIVATE,sha256:PRIVATE},{id:'unsafe-photo',image_url:'javascript:alert(1)',caption:'Invalid'},{id:'roster-photo',image_url:'https://example.org/member-roster.png'}]};
 const clean=sanitizePublicRecord(sanitizePublicRecord(record));assert.equal(clean.photos.length,1);assert.equal(clean.photos[0].src,'https://images.example.org/hall.jpg');assert.ok(!JSON.stringify(clean).includes(PRIVATE));
 const page=render(new URL('https://test/organizations/'+ORG),[clean]);assert.ok(page.html.includes('id="photos"'));assert.ok(page.html.includes('src="https://images.example.org/hall.jpg"'));assert.ok(page.html.includes('Photo source'));assert.ok(page.html.includes('Add photos'));assert.ok(!page.html.includes(PRIVATE));assert.ok(!page.html.includes('javascript:'));assert.ok(page.html.includes('referrerpolicy="no-referrer"'));
});

test('all organization pages offer photos and a sign-in path even before their first image',()=>{
 for(const record of records){const page=render(new URL('https://test/organizations/'+record.id));assert.ok(page.html.includes('id="photos"'),record.id);assert.ok(page.html.includes('/hq?org='+record.id+'#photos'),record.id);assert.ok(page.html.includes('Authorized representatives can add photos'));}
});

test('published gallery joins the correct organization and exports source and license without uploader identity',async t=>{
 const db=database(t);
 db.sqlite.prepare('INSERT INTO organization_photos(id,org_id,image_url,caption,alt_text,credit,source_url,license,license_url,uploaded_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run('licensed-hall',ORG,'https://images.example.org/hall.jpg','Our hall','The hall exterior','Photographer','https://example.org/hall','CC BY 4.0','https://creativecommons.org/licenses/by/4.0/',PRIVATE,'2026-09-03T05:00:00Z','2026-09-03T05:00:00Z');
 const response=await publicWorker.fetch(new Request('https://test/data.json'),{DB:db});assert.equal(response.status,200);const data=await response.json();const photo=data.records.find(r=>r.id===ORG).photos[0];assert.equal(photo.src,'https://images.example.org/hall.jpg');assert.equal(photo.license_url,'https://creativecommons.org/licenses/by/4.0/');assert.ok(!JSON.stringify(data).includes(PRIVATE));assert.ok(data.records.filter(r=>r.id!==ORG).every(r=>r.photos.length===0));
 const page=await publicWorker.fetch(new Request('https://test/organizations/'+ORG),{DB:db});const html=await page.text();assert.equal(page.status,200);assert.ok(html.includes('href="https://creativecommons.org/licenses/by/4.0/"'));assert.ok(html.includes('Our hall'));assert.ok(!html.includes(PRIVATE));
});
