import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker, { norcalPublicData } from '../src/norcal-worker.mjs';
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
    const path=new URL(request.url).pathname;
    const type=path.endsWith('.jpg')?'image/jpeg':path.endsWith('.svg')?'image/svg+xml':'image/png';
    try { return new Response(readFileSync(new URL('../public'+path, import.meta.url)),{headers:{'Content-Type':type}}); }
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
    const homeHtml=await home.text();
    assert.match(homeHtml,/Find your people/);
    assert.match(homeHtml,/published-assets\/norcal-veterans\.png\?v=logo-20260913-1/);
    assert.match(homeHtml,/ysv-logo\.png\?v=logo-20260913-1/);
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

test('HQ event assignments reach the matching organization calendar with legacy payload fallback',async()=>{
  const env=setup(),[first,second]=records;
  try {
    const insert=env.sqlite.prepare("INSERT INTO records(id,kind,title,region_id,organization_id,status,payload,created_by,created_at,updated_at,mutation_id) VALUES(?,'event',?,'yolo-solano',?,'published',?,'owner','2026-09-12','2026-09-12',?)");
    const payload={start_at:'2026-10-04T10:00:00-07:00',venue:'Public hall',organization_id:second.id};
    insert.run('hq-assigned-event','HQ assigned event',first.id,JSON.stringify(payload),'hq-assigned-event');
    insert.run('payload-assigned-event','Earlier assigned event',null,JSON.stringify(payload),'payload-assigned-event');
    const live=await norcalPublicData(env.DB);
    assert.equal(live.events.find(event=>event.id==='hq-assigned-event').organization_id,first.id);
    assert.equal(live.events.find(event=>event.id==='payload-assigned-event').organization_id,second.id);
    for(const [record,included,excluded] of [[first,'HQ assigned event','Earlier assigned event'],[second,'Earlier assigned event','HQ assigned event']]){
      const response=await worker.fetch(new Request('https://www.norcalveterans.org/organizations/'+record.id+'?month=2026-10'),env);
      assert.equal(response.status,200);
      const html=await response.text();
      assert.ok(html.includes(included));
      assert.ok(!html.includes(excluded));
    }
  } finally {env.sqlite.close();}
});

test('public profiles direct contributions to review instead of unavailable photo and officer editors',async()=>{
  const env=setup();
  try {
    for(const path of ['/organizations/'+records[0].id,'/mcl-yolo']){
      const response=await worker.fetch(new Request('https://www.norcalveterans.org'+path),env);
      assert.equal(response.status,200);
      const html=await response.text();
      assert.match(html,/Ask about contributing photos/);
      assert.match(html,/Suggest a profile update/);
      assert.match(html,/href="\/for-organizations\?org=/);
      assert.doesNotMatch(html,/href="\/hq\?org=|Add photos →|Add or update officer profiles|can add photos, create albums|can add public photos, officer profiles/);
      if(path==='/mcl-yolo')assert.match(html,/href="\/hq\?tab=organization"/);
    }
  } finally {env.sqlite.close();}
});

test('regional home images resolve to complete bundled images and health identifies this release',async()=>{
  const env=setup();
  try {
    const response=await worker.fetch(new Request('https://www.norcalveterans.org/yolo-solano'),env);
    assert.equal(response.status,200);
    const html=await response.text();
    assert.doesNotMatch(html,/seed-photo-rememberavet|seed-photo-little-reata-veterans|Horses in a sunlit/);
    const imagePaths=[...new Set([...html.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)].map(match=>match[1]))];
    assert.ok(imagePaths.includes('/norcal-hero-table.png'));
    assert.ok(imagePaths.includes('/norcal-hero-seals.png'));
    const legion=await worker.fetch(new Request('https://www.norcalveterans.org/organizations/legion-ca-208'),env);
    assert.equal(legion.status,200);
    const legionHtml=await legion.text();
    assert.match(legionHtml,/class="wrap detail-page legion-profile"/);
    const styles=readFileSync(new URL('../public/styles.css',import.meta.url),'utf8');
    assert.match(styles,/american-legion-background\.png/);
    for(const path of imagePaths){
      assert.ok(path.startsWith('/'),path);
      const image=await worker.fetch(new Request(new URL(path,'https://www.norcalveterans.org')),env);
      assert.equal(image.status,200,path);
      assert.match(image.headers.get('Content-Type'),/^image\//,path);
      const bytes=Buffer.from(await image.arrayBuffer());
      assert.ok(bytes.length>128,path+' should not be a truncated placeholder');
      assert.deepEqual(bytes,readFileSync(new URL('../public'+new URL(path,'https://site.test').pathname,import.meta.url)),path);
      assert.ok(bytes.subarray(0,3).equals(Buffer.from([0xff,0xd8,0xff]))||bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||(bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP')||/<svg\b/.test(bytes.toString('utf8')),path+' must contain image bytes');
    }
    const health=await worker.fetch(new Request('https://www.norcalveterans.org/health'),env);
    assert.equal((await health.json()).release,'hq-hardening-20260912');
  } finally {env.sqlite.close();}
});

test('contribution choices and event hosts use live organizations on first load and validation errors',async()=>{
  const env=setup();
  try {
    const insert=env.sqlite.prepare("INSERT INTO records(id,kind,title,region_id,organization_id,status,payload,created_by,created_at,updated_at,mutation_id) VALUES(?,?,?,'yolo-solano',?,'published',?,'owner','2026-09-12','2026-09-12',?)");
    insert.run('new-live-organization','organization','New live organization','new-live-organization','{}','new-live-organization');
    insert.run('new-live-event','event','New live event','new-live-organization',JSON.stringify({start_at:'2026-10-04T10:00:00-07:00',venue:'Public hall'}),'new-live-event');
    env.sqlite.prepare("UPDATE records SET status='archived' WHERE id=?").run(records[0].id);
    const checks=[['/share','GET'],['/for-organizations','GET'],['/speaker-submissions','POST'],['/submit','POST']];
    for(const [path,method] of checks){
      const options=method==='GET'?{}:{method,headers:{Origin:'https://www.norcalveterans.org','Content-Type':'application/x-www-form-urlencoded','CF-Connecting-IP':'192.0.2.1'},body:new URLSearchParams({})};
      const response=await worker.fetch(new Request('https://www.norcalveterans.org'+path,options),env);
      assert.equal(response.status,method==='GET'?200:400,path);
      const html=await response.text();
      assert.match(html,/New live organization/,path);
      assert.ok(html.includes('value="new-live-organization"'),path);
      assert.ok(!html.includes('value="'+records[0].id+'"'),path);
    }
    const event=await worker.fetch(new Request('https://www.norcalveterans.org/events/new-live-event'),env);
    assert.equal(event.status,200);
    assert.match(await event.text(),/href="\/organizations\/new-live-organization"/);
  } finally {env.sqlite.close();}
});
