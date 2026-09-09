import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../src/norcal-worker.mjs';
import { records } from '../src/data.mjs';
import { seedEvents } from '../src/research-additions.mjs';

function setup() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../migrations/legacy/0001_headquarters.sql', import.meta.url), 'utf8'));
  const insert = sqlite.prepare("INSERT INTO records(id,kind,title,body,region_id,status,payload,created_by,created_at,updated_at,mutation_id) VALUES(?,?,?,?,'yolo-solano',?,?,'owner','2026-09-09','2026-09-09',?)");
  for (const record of records) insert.run(record.id,'organization',record.verified_name,record.member_information||'','published',JSON.stringify(record),record.id);
  for (const event of seedEvents) insert.run(event.id,'event',event.title,event.description||'','published',JSON.stringify(event),event.id);
  insert.run('private-request','request','PRIVATE_SENTINEL','Private contact and request','queued','{}','private-request');
  insert.run('draft-org','organization','DRAFT_SENTINEL','Unpublished organization','draft','{}','draft-org');
  const DB = { prepare(sql) { let values=[]; return {
    bind(...args){values=args;return this;},
    async first(){return sqlite.prepare(sql).get(...values)||null;},
    async all(){return {results:sqlite.prepare(sql).all(...values)};},
    async run(){return {meta:{changes:sqlite.prepare(sql).run(...values).changes}};}
  };}};
  const ASSETS = { async fetch(request) {
    try { return new Response(readFileSync(new URL('../public'+new URL(request.url).pathname, import.meta.url)),{headers:{'Content-Type':'image/png'}}); }
    catch { return new Response('Not found',{status:404}); }
  }};
  return { sqlite, DB, ASSETS };
}

test('replacement renders the existing published directory, events and profiles without private data',async()=>{
  const env=setup();
  try {
    for(const path of ['/regions','/yolo-solano','/events','/resources','/share','/about','/for-organizations','/data.json','/events.ics',...records.map(r=>'/organizations/'+r.id)]) {
      const response=await worker.fetch(new Request('https://www.norcalveterans.org'+path),env);
      assert.equal(response.status,200,path);
      const text=await response.text();
      assert.doesNotMatch(text,/PRIVATE_SENTINEL|DRAFT_SENTINEL/);
      assert.doesNotMatch(text,/yolo-county-veterans-hq\.smartzgraphics/);
    }
    const root=await worker.fetch(new Request('https://www.norcalveterans.org/?place=Davis'),env);
    assert.equal(root.status,302);
    assert.equal(root.headers.get('Location'),'https://www.norcalveterans.org/yolo-solano?place=Davis');
    const home=await worker.fetch(new Request('https://www.norcalveterans.org/yolo-solano'),env);
    assert.match(await home.text(),/Find your people/);
    const denied=await worker.fetch(new Request('https://www.norcalveterans.org/hq'),env);
    assert.equal(denied.status,503);
  } finally {env.sqlite.close();}
});

test('logos are complete source files and submissions stay in the existing private review queue',async()=>{
  const env=setup();
  try {
    for(const path of ['/ysv-logo.png','/published-assets/norcal-veterans.png','/published-assets/vbc-yolo-solano.png','/logos/vfw.png']) {
      const response=await worker.fetch(new Request('https://www.norcalveterans.org'+path),env);
      assert.deepEqual(Buffer.from(await response.arrayBuffer()),readFileSync(new URL('../public'+path,import.meta.url)),path);
    }
    const headers={Origin:'https://www.norcalveterans.org','Content-Type':'application/x-www-form-urlencoded','CF-Connecting-IP':'192.0.2.1'};
    const data={kind:'profile',org_id:records[0].id,title:'Meeting update',details:'Please review this meeting update.',sender_name:'Private sender',sender_email:'private@example.com',privacy:'yes'};
    const response=await worker.fetch(new Request('https://www.norcalveterans.org/submit',{method:'POST',headers,body:new URLSearchParams(data)}),env);
    assert.equal(response.status,303);
    const row=env.sqlite.prepare("SELECT * FROM records WHERE kind='submission'").get();
    assert.equal(row.status,'pending');
    assert.match(row.body,/private@example.com/);
    const publicData=await worker.fetch(new Request('https://www.norcalveterans.org/data.json'),env);
    assert.doesNotMatch(await publicData.text(),/private@example.com|Private sender/);
    const rejected=await worker.fetch(new Request('https://www.norcalveterans.org/submit',{method:'POST',headers:{...headers,Origin:'https://other.example'},body:new URLSearchParams(data)}),env);
    assert.equal(rejected.status,400);
    assert.equal(env.sqlite.prepare("SELECT COUNT(*) AS n FROM records WHERE kind='submission'").get().n,1);
  } finally {env.sqlite.close();}
});
