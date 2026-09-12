import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker, { norcalPublicData } from '../src/norcal-worker.mjs';
import { records } from '../src/data.mjs';
import { seedEvents } from '../src/research-additions.mjs';
import { eventCalendar, upcomingEvents } from '../src/public-tools.mjs';
import { canonicalInstant, pacificToInstant, validateRecordPayload } from '../worker/legacy/validation.mjs';
import { publicPayload } from '../worker/legacy/public.mjs';

const organization={organization_type:'Veterans nonprofit',location_county:'Solano',city:'Dixon',service_categories:['Community'],service_area:{counties:['Solano'],cities:['Dixon'],notes:'Local community'},public_contacts:{website:'https://example.org/'}};
const event={start_at:'2027-01-15T18:00:00-08:00',venue:'Public hall',county:'Solano',city:'Dixon',date_only:false};
function setup(t) {
 const sqlite=new DatabaseSync(':memory:');
 sqlite.exec(readFileSync(new URL('../migrations/legacy/0001_headquarters.sql',import.meta.url),'utf8'));
 t.after(()=>sqlite.close());
 const insert=(id,kind,payload,title='Community connection')=>sqlite.prepare("INSERT INTO records(id,kind,title,body,region_id,status,payload,created_by,created_at,updated_at,mutation_id) VALUES(?,?,?,'Public description','yolo-solano','published',?,'owner','2026-09-12','2026-09-12',?)").run(id,kind,title,typeof payload==='string'?payload:JSON.stringify(payload),id);
 const DB={prepare(sql){let args=[];return {bind(...values){args=values;return this;},async all(){return {results:sqlite.prepare(sql).all(...args)};},async first(){return sqlite.prepare(sql).get(...args)||null;}};}};
 return {DB,insert};
}

test('active content validation rejects malformed nested values and field lengths',()=>{
 for(const patch of [{service_categories:'Community'},{source_ids:{}},{missing_data_flags:123},{service_area:{counties:'Solano'}},{public_contacts:'phone'},{address:{type:'residential',text:'Private home'}},{address:{type:'meeting_venue',text:123}},{event_information:[]},{reviewed_update:{reviewed_at:'broken',source_url:'https://example.org/'}},{photos:{}},{city:'x'.repeat(121)}])assert.throws(()=>validateRecordPayload('organization',{...organization,...patch}),JSON.stringify(patch));
 assert.throws(()=>validateRecordPayload('organization',{...organization,public_contacts:{website:'javascript:alert(1)'}}));
 assert.throws(()=>validateRecordPayload('organization',{...organization,public_contacts:{website:'https://example.org/officers'}}));
 assert.throws(()=>validateRecordPayload('organization',{city:'Dixon'},{status:'published',isNew:true}),/type and county/);
 assert.equal(validateRecordPayload('organization',organization,{status:'published',isNew:true}).location_county,'Solano');
});

test('canonical event time validation handles winter, summer, DST gaps, folds and rescheduling',()=>{
 assert.equal(pacificToInstant('2027-01-15T18:00'),'2027-01-16T02:00:00.000Z');
 assert.equal(pacificToInstant('2027-07-15T18:00'),'2027-07-16T01:00:00.000Z');
 assert.throws(()=>pacificToInstant('2027-03-14T02:30'),/does not exist/);
 assert.throws(()=>pacificToInstant('2026-11-01T01:30'),/occurs twice/);
 assert.equal(pacificToInstant('2026-11-01T01:30',{previousInstant:'2026-11-01T01:30:00-08:00'}),'2026-11-01T09:30:00.000Z');
 for(const value of ['January 15 2027','2027-02-30T12:00:00-08:00','2027-01-15T18:00','2027-01-15T25:00:00Z','2027-01-15T18:00:00+14:30'])assert.throws(()=>canonicalInstant(value),value);
 assert.throws(()=>validateRecordPayload('event',{...event,end_at:'2026-11-10T18:00:00-08:00'}),/on or after/);
 const moved=validateRecordPayload('event',{...event,end_at:'2026-11-10T18:00:00-08:00',starts_local:'2027-01-15T18:00',ends_local:''});
 assert.equal(moved.end_at,null);assert.equal(moved.start_at,'2027-01-16T02:00:00.000Z');assert.equal(moved.date_only,false);assert.equal(Object.hasOwn(moved,'starts_local'),false);
 const day=validateRecordPayload('event',{...event,starts_local:'2027-01-15',date_only:true,end_at:event.start_at});
 assert.equal(day.start_at,'2027-01-15T08:00:00.000Z');assert.equal(day.end_at,null);
 assert.match(eventCalendar([{...day,id:'day',title:'Date confirmed',status:'published'}]),/DTSTART;VALUE=DATE:20270115/);
 assert.throws(()=>validateRecordPayload('event',{...event,start_at:'2027-01-15T00:00:00Z',date_only:true}),/Pacific midnight/);
});

test('source review records require evidence and reviewer identity is server controlled',()=>{
 assert.throws(()=>validateRecordPayload('event',{...event,source_checked:'2026-09-02'}),/requires.*URL/);
 assert.throws(()=>validateRecordPayload('event',{...event,source_url:'https://example.org/',source_checked:'2026-02-30'}),/does not exist/);
 assert.throws(()=>validateRecordPayload('organization',{...organization,last_verified_date:'2026-09-02'}),/source/);
 assert.throws(()=>validateRecordPayload('organization',{...organization,organization_confirmed_at:'2026-09-02T12:00:00Z'}),/confirmation source/);
 assert.throws(()=>validateRecordPayload('organization',{...organization,reviewed_by:'invented@example.org'}),/server/);
 const reviewed=validateRecordPayload('organization',{...organization,last_verified_date:'2026-09-02',review_source_url:'https://example.org/evidence'},{actorEmail:'owner@example.org'});
 assert.equal(reviewed.reviewed_by,'owner@example.org');assert.match(reviewed.review_recorded_at,/^\d{4}-/);
 const serialized=publicPayload({id:'new',kind:'organization',title:'New organization',body:'Public information',payload:JSON.stringify(reviewed)});
 assert.equal(Object.hasOwn(serialized,'reviewed_by'),false);assert.equal(serialized.last_verified_date,'2026-09-02');
 const legacy={...event,source_checked:'2026-09-02',source_url:''};
 assert.doesNotThrow(()=>validateRecordPayload('event',legacy,{previousPayload:legacy}));
 assert.equal(publicPayload({id:'legacy',kind:'event',title:'Legacy event',body:'Public information',status:'published',payload:JSON.stringify(legacy)}).source_checked,null);
});

test('existing imported organization and event records remain valid without inventing new review evidence',()=>{
 for(const record of records)assert.doesNotThrow(()=>validateRecordPayload('organization',record,{status:'published',previousPayload:record}),record.id);
 for(const record of seedEvents)assert.doesNotThrow(()=>validateRecordPayload('event',record,{status:'published',previousPayload:record}),record.id);
});

test('all active public endpoints remove private nested fields through the same serializer',async t=>{
 const env=setup(t);
 env.insert('private-address','organization',{...organization,address:{type:'residential',text:'HOME_SENTINEL',private_notes:'ADDRESS_SENTINEL'},service_area:{counties:['Solano'],cities:[],notes:'Public area',private_notes:'AREA_SENTINEL'},public_contacts:{website:'https://example.org/',private_notes:'CONTACT_SENTINEL'},event_information:{text:'Public event',private_notes:'EVENT_SENTINEL'},reviewed_update:{reviewed_at:'2026-09-02T12:00:00Z',source_url:'https://example.org/',private_notes:'REVIEW_SENTINEL'},private_notes:'TOP_SENTINEL'});
 let canonical;
 for(const path of ['/data.json','/api/directory','/yolo-solano?place=Solano+County','/organizations/private-address']){
  const response=await worker.fetch(new Request('https://site.test'+path),env);assert.equal(response.status,200,path);
  const body=await response.text();assert.doesNotMatch(body,/HOME_SENTINEL|ADDRESS_SENTINEL|AREA_SENTINEL|CONTACT_SENTINEL|EVENT_SENTINEL|REVIEW_SENTINEL|TOP_SENTINEL/,path);
  if(path==='/data.json')canonical=JSON.parse(body).records[0];
  if(path==='/api/directory')assert.deepEqual(JSON.parse(body)[0].payload,canonical);
 }
});

test('one broken stored row cannot disable the public directory, pages or calendar export',async t=>{
 const env=setup(t);
 env.insert('new-org','organization',organization,'New Dixon connection');
 env.insert('broken-json','organization','{broken json');
 env.insert('broken-fields','organization',{...organization,service_categories:123,source_ids:42,missing_data_flags:{},service_area:{counties:'Solano'}});
 env.insert('good-event','event',event,'Good event');
 env.insert('bad-event','event',{...event,start_at:'January 15 2027'},'Broken event');
 for(const path of ['/yolo-solano','/events','/events.ics','/api/directory','/data.json','/organizations/broken-fields']){
  const response=await worker.fetch(new Request('https://site.test'+path),env);assert.equal(response.status,200,path);assert.doesNotMatch(await response.text(),/Broken event/);
 }
 const data=await norcalPublicData(env.DB);assert.deepEqual(data.events.map(row=>row.id),['good-event']);
 assert.equal(upcomingEvents([{...event,status:'published',start_at:'not a date'}]).length,0);
});

test('custom organization categories remain visible and county filtering finds the new listing',async t=>{
 const env=setup(t);env.insert('new-org','organization',{...organization,organization_type:'Local veterans network'},'New Dixon connection');
 for(const path of ['/yolo-solano','/yolo-solano?place=Solano+County','/yolo-solano?type=Local+veterans+network']){
  const response=await worker.fetch(new Request('https://site.test'+path),env);assert.equal(response.status,200);
  const html=await response.text();assert.match(html,/href="\/organizations\/new-org"/);assert.match(html,/More Veteran Organizations/);
 }
 const response=await worker.fetch(new Request('https://site.test/yolo-solano?place=Yolo+County'),env);assert.doesNotMatch(await response.text(),/href="\/organizations\/new-org"/);
});

test('new published content is labeled unverified and profile review dates come from each record',async t=>{
 const env=setup(t);env.insert('new-org','organization',organization);env.insert('new-event','event',event);
 for(const path of ['/organizations/new-org','/events/new-event']){
  const response=await worker.fetch(new Request('https://site.test'+path),env);assert.equal(response.status,200);
  const html=await response.text();assert.match(html,/Verification pending/);assert.doesNotMatch(html,/Published source checked|Sources checked <strong>September 2/);
 }
 env.insert('reviewed-org','organization',{...organization,last_verified_date:'2026-09-05',review_source_url:'https://example.org/evidence'});
 const response=await worker.fetch(new Request('https://site.test/organizations/reviewed-org'),env);
 assert.match(await response.text(),/Public sources reviewed <strong>2026-09-05<\/strong>/);
});
