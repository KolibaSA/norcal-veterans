import test from 'node:test';
import assert from 'node:assert/strict';
import { db, envBase, req } from '../../scripts/legacy-test-helpers.mjs';

test('HQ paginates and searches older records within the authenticated assignment', async t => {
  const DB=db(t), env={...envBase,DB};
  const add=DB.raw.prepare("INSERT INTO records(id,kind,title,body,region_id,status,payload,created_by,created_at,updated_at,mutation_id) VALUES(?,'task',?,? ,?,'open','{}','synthetic@example.test','2026-01-01',?,?)");
  for(let i=0;i<540;i++) {
    const id='task-'+String(i).padStart(3,'0');
    add.run(id,i===0?'Older unique%literal':'Fictional task '+i,'Fictional text',i%2?'region-b':'region-a',`2026-01-${String(i%27+1).padStart(2,'0')}T00:00:00Z`,id);
  }
  DB.raw.prepare("INSERT INTO grants(id,email,role,region_id) VALUES('grant','editor@example.test','editor','region-a')").run();
  const call=path=>req(env,path,'editor@example.test');
  const summary=await (await call('/api/hq/records?kind=task&summary=1')).json();
  assert.deepEqual(summary.counts,{open:270});
  const ownerSummary=await (await req(env,'/api/hq/records?kind=task&summary=1','owner@example.com')).json();
  assert.deepEqual(ownerSummary.counts,{open:540});
  const first=await (await call('/api/hq/records?kind=task&page=1')).json();
  const second=await (await call('/api/hq/records?kind=task&page=2')).json();
  assert.equal(first.records.length,25);assert.equal(first.hasMore,true);assert.equal(second.page,2);
  assert.ok([...first.records,...second.records].every(row=>row.region_id==='region-a'));
  assert.ok(first.records.every(row=>!second.records.some(other=>other.id===row.id)));
  const older=await (await call('/api/hq/records?kind=task&page=1&q=unique%25literal')).json();
  assert.deepEqual(older.records.map(row=>row.id),['task-000']);
  const ownerOlder=await (await req(env,'/api/hq/records?kind=task&page=1&q=unique%25literal','owner@example.com')).json();
  assert.deepEqual(ownerOlder.records.map(row=>row.id),['task-000']);
  const literal=await (await call('/api/hq/records?kind=task&page=1&q=%25')).json();
  assert.deepEqual(literal.records.map(row=>row.id),['task-000']);
  const scoped=await (await call('/api/hq/records?kind=task&page=1&q=Fictional%20task%201')).json();
  assert.ok(scoped.records.length>0 && scoped.records.every(row=>row.region_id==='region-a'));
  const forbidden=await (await call('/api/hq/records?kind=task&page=1&q=Fictional%20task%201&status=closed')).json();
  assert.deepEqual(forbidden.records,[]);
  assert.equal((await call('/api/hq/records?kind=task&page=0')).status,400);
  assert.equal((await call('/api/hq/records?kind=task&page=1&status=bogus')).status,400);
});

test('organization picker searches beyond 500 while enforcing read assignments', async t => {
  const DB=db(t), env={...envBase,DB};
  const add=DB.raw.prepare("INSERT INTO records(id,kind,title,body,region_id,organization_id,status,payload,created_by,created_at,updated_at,mutation_id) VALUES(?,'organization',?,'',?,?,'draft',?,'test','2026','2026',?)");
  for(let i=0;i<650;i++) { const id='org-'+String(i).padStart(3,'0'); add.run(id,`Fictional organization ${String(i).padStart(3,'0')}`,i%2?'region-b':'region-a',id,JSON.stringify({organization_type:'Veterans'}),id); }
  DB.raw.prepare("INSERT INTO grants(id,email,role,region_id) VALUES('grant','editor@example.test','editor','region-a')").run();
  const call=(query,email='editor@example.test')=>req(env,'/api/hq/records?kind=organization&scope_options=1&'+query,email);
  const first=await (await call('page=1&families=1')).json();
  assert.equal(first.organizations.length,25);assert.equal(first.hasMore,true);assert.deepEqual(first.families,['Veterans']);
  assert.ok(first.organizations.every(org=>Number(org.id.slice(-3))%2===0));
  const found=await (await call('q=organization%20648')).json();
  assert.deepEqual(found.organizations.map(org=>org.id),['org-648']);
  const denied=await (await call('q=organization%20649&id=org-649')).json();
  assert.deepEqual(denied.organizations,[]);assert.deepEqual(denied.selected,[]);
  const saved=await (await call('id=org-648')).json();
  assert.deepEqual(saved.selected.map(org=>org.id),['org-648']);
  const owner=await (await call('q=organization%20649','owner@example.com')).json();
  assert.deepEqual(owner.organizations.map(org=>org.id),['org-649']);
});

test('HQ long literal searches retain the complete query and permission scope',async t=>{
 const DB=db(t),env={...envBase,DB};
 const insert=DB.raw.prepare("INSERT INTO records(id,kind,title,body,region_id,status,payload,created_by,created_at,updated_at,mutation_id) VALUES(?,'task','Search fixture',?,?,'open','{}','test','2026','2026',?)");
 DB.raw.prepare("INSERT INTO grants(id,email,role,region_id) VALUES('grant','editor@example.test','editor','region-a')").run();
 const queries=['a'.repeat(49),'shared prefix '.repeat(5)+'expected','é'.repeat(30),'%_\\'.repeat(25),'x'.repeat(200)];
 for(const [index,query] of queries.entries()){
  const id='long-'+index;
  insert.run(id,query,'region-a',id);
  insert.run(id+'-partial',query.slice(0,-1)+'!','region-a',id+'-partial');
  insert.run(id+'-other',query,'region-b',id+'-other');
  const params=new URLSearchParams({kind:'task',page:'1',q:query});
  const response=await req(env,'/api/hq/records?'+params,'editor@example.test');
  assert.equal(response.status,200);
  assert.deepEqual((await response.json()).records.map(row=>row.id),[id],query);
 }
});
