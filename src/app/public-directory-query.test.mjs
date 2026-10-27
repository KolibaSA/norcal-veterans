import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../../scripts/legacy-test-helpers.mjs';
import { queryPublicDirectory, queryNearbyOrganizations } from './public-directory-query.mjs';

test('directory queries page and filter published organizations in the selected region', async t=>{
 const DB=db(t),insert=DB.raw.prepare("INSERT INTO records(id,kind,title,body,region_id,status,payload,created_by,created_at,updated_at,mutation_id) VALUES(?,'organization',?,'Fictional community',?, ?,?,'test','2026','2026',?)");
 for(let i=0;i<72;i++){
  const id='org-'+String(i).padStart(2,'0'),payload={organization_type:i%2?'VFW':'DAV',city:i%2?'Davis':'Dixon',location_county:'Yolo',service_categories:i===0?['Unique resource']:[],relationship_type:'independent'};
  insert.run(id,'Organization '+String(i).padStart(2,'0'),i<66?'yolo-solano':'other-region','published',JSON.stringify(payload),id);
 }
 insert.run('private','Private','yolo-solano','draft',JSON.stringify({city:'Davis',organization_type:'VFW'}),'private');
 const query=path=>queryPublicDirectory(DB,new URL(path,'https://site.test'));
 const first=await query('/yolo-solano'),second=await query('/yolo-solano?org_page=2'),third=await query('/yolo-solano?org_page=3');
 assert.equal(first.rows.length,25);assert.equal(second.rows.length,25);assert.equal(third.rows.length,16);assert.equal(third.hasMore,false);
 assert.equal(new Set([...first.rows,...second.rows,...third.rows].map(row=>row.id)).size,66);
 assert.ok(first.rows.every(row=>row.region_id==='yolo-solano'));
 const type=await query('/yolo-solano?type=VFW');assert.ok(type.rows.every(row=>JSON.parse(row.payload).organization_type==='VFW'));
 const result=await query('/yolo-solano?q=unique%20resource');assert.deepEqual(result.rows.map(row=>row.id),['org-00']);
 const nearby=await queryNearbyOrganizations(DB,'yolo-solano','Davis');assert.equal(nearby.length,25);assert.ok(nearby.every(row=>row.region_id==='yolo-solano'));
});
