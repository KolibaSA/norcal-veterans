import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../../scripts/legacy-test-helpers.mjs';
import { rebuildPublicOccurrences } from './public-occurrence-index.mjs';

function insert(DB,id,kind,payload,status='published') {
  DB.raw.prepare("INSERT INTO records(id,kind,title,body,region_id,organization_id,status,payload,created_by,created_at,updated_at,mutation_id) VALUES(?,?,?,'Fictional description','fictional-region',? ,?,?, 'test','2026','2026',?)")
    .run(id,kind,'Fictional '+id,kind==='event'?'fictional-host':null,status,JSON.stringify(payload),'mutation-'+id);
}
const dates={start_at:'2020-01-01T19:00:00Z',venue:'Fictional venue',city:'Davis',additional_occurrences:[{start_at:'2030-01-01T19:00:00Z'}]};
const indexed=DB=>DB.raw.prepare('SELECT event_id,start_at,region_id FROM public_occurrences ORDER BY event_id,start_at').all();
const dirty=DB=>DB.raw.prepare('SELECT source_record_id FROM public_occurrence_dirty ORDER BY source_record_id').all();
const windowCount=DB=>DB.raw.prepare('SELECT count(*) AS count FROM public_occurrence_windows').get().count;

test('derived index follows publish, edit, withdrawal and deletion',async t=>{
  const DB=db(t);insert(DB,'event-1','event',dates,'draft');
  assert.deepEqual(await rebuildPublicOccurrences(DB),{examined:1,completed:1});assert.deepEqual(indexed(DB),[]);
  DB.raw.prepare("UPDATE records SET status='published',mutation_id='publish' WHERE id='event-1'").run();
  await rebuildPublicOccurrences(DB);
  assert.ok(windowCount(DB)>0);
  assert.deepEqual(indexed(DB).map(row=>row.start_at),['2020-01-01T19:00:00.000Z','2030-01-01T19:00:00.000Z']);
  assert.ok(indexed(DB).every(row=>row.region_id==='fictional-region'));assert.deepEqual(dirty(DB),[]);
  DB.raw.prepare("UPDATE records SET payload=?,mutation_id='edit' WHERE id='event-1'").run(JSON.stringify({...dates,start_at:'2035-01-01T19:00:00Z',additional_occurrences:[]}));
  assert.equal(dirty(DB).length,1);await rebuildPublicOccurrences(DB);assert.deepEqual(indexed(DB).map(row=>row.start_at),['2035-01-01T19:00:00.000Z']);
  DB.raw.prepare("UPDATE records SET status='draft',mutation_id='withdraw' WHERE id='event-1'").run();await rebuildPublicOccurrences(DB);assert.deepEqual(indexed(DB),[]);assert.equal(windowCount(DB),0);
  DB.raw.prepare("UPDATE records SET status='published',mutation_id='republish' WHERE id='event-1'").run();await rebuildPublicOccurrences(DB);
  DB.raw.prepare("DELETE FROM records WHERE id='event-1'").run();assert.deepEqual(indexed(DB),[]);assert.deepEqual(dirty(DB),[]);
  assert.equal(windowCount(DB),0);
});

test('a concurrent edit keeps the source dirty until its new version is indexed',async t=>{
  const DB=db(t);insert(DB,'event-1','event',dates);
  DB.beforeBatch=async()=>{DB.beforeBatch=null;DB.raw.prepare("UPDATE records SET payload=?,mutation_id='newer' WHERE id='event-1'").run(JSON.stringify({...dates,start_at:'2038-01-01T19:00:00Z',additional_occurrences:[]}));};
  assert.deepEqual(await rebuildPublicOccurrences(DB),{examined:1,completed:0});
  assert.equal(dirty(DB).length,1);assert.deepEqual(indexed(DB),[]);
  assert.deepEqual(await rebuildPublicOccurrences(DB),{examined:1,completed:1});
  assert.deepEqual(indexed(DB).map(row=>row.start_at),['2038-01-01T19:00:00.000Z']);
});

test('planner records create and update their own derived meetings',async t=>{
  const DB=db(t);
  const payload={city:'Dixon',location_county:'Solano',organization_type:'VFW',meeting_plans:[{year:2027,meetings:[{month:1,date:'2027-01-21',title:'Fictional meeting',time_1:'18:00',label_1:'Meeting'}]}]};
  insert(DB,'vfw-ca-8151','organization',payload);
  await rebuildPublicOccurrences(DB);
  assert.equal(windowCount(DB),0);
  assert.equal(indexed(DB)[0].event_id,'organization-meeting-vfw-ca-8151-2027-01');
  assert.equal(indexed(DB)[0].start_at,'2027-01-22T02:00:00.000Z');
  payload.meeting_plans[0].meetings[0].date='2027-01-28';
  DB.raw.prepare("UPDATE records SET payload=?,mutation_id='changed' WHERE id='vfw-ca-8151'").run(JSON.stringify(payload));
  await rebuildPublicOccurrences(DB);assert.equal(indexed(DB)[0].start_at,'2027-01-29T02:00:00.000Z');
});

test('corrupt and unpublished records do not create public occurrences',async t=>{
  const DB=db(t);insert(DB,'bad','event',dates);insert(DB,'draft','event',dates,'draft');
  DB.raw.prepare("UPDATE records SET payload='{bad',mutation_id='corrupt' WHERE id='bad'").run();
  await rebuildPublicOccurrences(DB);assert.deepEqual(indexed(DB),[]);assert.deepEqual(dirty(DB),[]);
});

test('HQ saves automatically rebuild the changed event index and failed saves leave it intact',async t=>{
  const DB=db(t);
  const {handleRecordRoute}=await import('./hq-records.mjs');
  const env={DB}, user={email:'owner@example.test',owner:true}, origin='https://site.test';
  const call=async(path,method,input)=>handleRecordRoute(new Request(origin+path,{method,headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(input)}),env,user,[]);
  const input={kind:'event',title:'Synthetic event',body:'Fictional event description',region_id:'fictional-region',status:'published',payload:{start_at:'2030-01-01T19:00:00Z',venue:'Fictional venue'}};
  const created=await call('/api/hq/records','POST',input);
  assert.equal(created.status,201,await created.clone().text());
  const {id,version}=await created.json();
  assert.equal(indexed(DB)[0].event_id,id);assert.deepEqual(dirty(DB),[]);
  const updated=await call('/api/hq/records/'+id,'PUT',{...input,version,payload:{...input.payload,start_at:'2035-01-01T19:00:00Z'}});
  assert.equal(updated.status,200,await updated.clone().text());
  assert.equal(indexed(DB)[0].start_at,'2035-01-01T19:00:00.000Z');
  const stale=await call('/api/hq/records/'+id,'PUT',{...input,version});
  assert.equal(stale.status,409);assert.equal(indexed(DB)[0].start_at,'2035-01-01T19:00:00.000Z');
});
