import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../../scripts/legacy-test-helpers.mjs';
import { rebuildPublicOccurrences } from './public-occurrence-index.mjs';
import { occurrenceIndexReady, queryPublicEventPage, publicArchiveYears } from './public-occurrence-query.mjs';

const now=Date.parse('2026-06-01T12:00:00Z');

test('ordered queries match the complete reference across overlapping, ongoing and future occurrences',async t=>{
 const DB=db(t), insert=DB.raw.prepare("INSERT INTO records(id,kind,title,body,region_id,status,payload,created_by,created_at,updated_at,mutation_id) VALUES(?,'event',?,'Fictional event','region-a','published',?,'test','2020','2020',?)");
 for(let i=0;i<180;i++) {
  const start=now+(i%40-20)*3600000, end=start+(i%9+1)*3600000, id='mixed-'+String(i).padStart(3,'0');
  insert.run(id,id,JSON.stringify({venue:'Fictional venue',city:i%2?'Davis':'Dixon',start_at:new Date(start).toISOString(),end_at:i%3?new Date(end).toISOString():null,
   additional_occurrences:[{start_at:new Date(start+86400000).toISOString(),end_at:new Date(end+86400000).toISOString()}]}),id);
 }
 while((await rebuildPublicOccurrences(DB,100)).examined){}
 for(const time of [now-86400000,now,now+86400000,now+172800000])for(const city of ['', 'Davis']) {
  const reference=DB.raw.prepare(`SELECT source_record_id AS id FROM public_occurrences WHERE region_id='region-a' AND visible_through_ms>=?${city?' AND city=?':''} GROUP BY source_record_id ORDER BY MIN(start_at),source_record_id`).all(...(city?[time,city]:[time])).map(row=>row.id);
  for(let page=1;page<=3;page++) {
   const found=await queryPublicEventPage(DB,{region:'region-a',city,now:time,page});
   assert.deepEqual(found.rows.map(row=>row.id),reference.slice((page-1)*25,page*25));
   assert.equal(found.hasMore,reference.length>page*25);
  }
 }
});
test('indexed pages select the correct region, city, past year and later occurrences',async t=>{
 const DB=db(t), insert=DB.raw.prepare("INSERT INTO records(id,kind,title,body,region_id,status,payload,created_by,created_at,updated_at,mutation_id) VALUES(?,'event',?,'Fictional event',?,'published',?,'test','2020','2020',?)");
 for(let i=0;i<60;i++){
  const id='event-'+String(i).padStart(2,'0'), region=i<55?'region-a':'region-b';
  const payload={venue:'Fictional venue',city:i%2?'Davis':'Dixon',start_at:`2025-01-${String(i%27+1).padStart(2,'0')}T20:00:00Z`,additional_occurrences:[{start_at:`2027-01-${String(i%27+1).padStart(2,'0')}T20:00:00Z`}]};
  insert.run(id,id,region,JSON.stringify(payload),id);
 }
 assert.equal(await occurrenceIndexReady(DB,'region-a'),false);
 while((await rebuildPublicOccurrences(DB,100)).examined){}
 assert.equal(await occurrenceIndexReady(DB,'region-a'),true);
 const first=await queryPublicEventPage(DB,{region:'region-a',now}), second=await queryPublicEventPage(DB,{region:'region-a',now,page:2});
 assert.equal(first.rows.length,25);assert.equal(first.hasMore,true);assert.equal(second.rows.length,25);
 assert.ok(first.rows.every(row=>row.region_id==='region-a' && !second.rows.some(other=>other.id===row.id)));
 const filtered=await queryPublicEventPage(DB,{region:'region-a',city:'Davis',now});
 assert.equal(filtered.rows.length,25);assert.equal(filtered.hasMore,true);
 const archive=await queryPublicEventPage(DB,{region:'region-a',year:'2025',now});
 assert.equal(archive.rows.length,25);assert.equal(archive.hasMore,true);
 assert.deepEqual(await publicArchiveYears(DB,{region:'region-a',now}),['2025']);
 const other=await queryPublicEventPage(DB,{region:'region-b',now});assert.equal(other.rows.length,5);
 DB.raw.prepare("UPDATE records SET mutation_id='changed' WHERE id='event-01'").run();
 assert.equal(await occurrenceIndexReady(DB,'region-a'),false);
 assert.equal(await occurrenceIndexReady(DB,'region-b'),true);
});
