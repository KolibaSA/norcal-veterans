import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {eventCalendar,publicExtension,upcomingEvents} from '../src/public-tools.mjs';
import {hqAction,hqFetch} from '../src/hq.mjs';

const HQ='https://hq.example.test',ACTOR='owner@example.test';
const NOTE='Dates and table locations supplied by Sterling on September 2, 2026. Hours to be confirmed.';
const event=(extra={})=>({id:'poppy',title:'Buddy Poppy table',status:'published',organization_id:'vfw-ca-8151',organizer:'Dixon VFW Post 8151',kind:'Volunteering',county:'Solano',city:'Dixon',venue:'Dixon community table',start_at:'2026-11-07T00:00:00-08:00',end_at:null,date_only:true,audience:'Community members welcome.',description:'Visit the Buddy Poppy table.',source_kind:'project_team',source_note:NOTE,source_url:'https://vfw8151.org/',...extra});
class Statement{
 constructor(db,sql,args=[]){this.db=db;this.sql=sql;this.args=args;}
 bind(...args){return new Statement(this.db,this.sql,args);}
 execute(){const q=this.db.sqlite.prepare(this.sql);if(q.columns().length)return {results:q.all(...this.args).map(r=>({...r})),meta:{changes:Number(this.db.sqlite.prepare('SELECT changes() n').get().n)}};return {results:[],meta:{changes:Number(q.run(...this.args).changes)}};}
 async all(){return this.execute();}
 async run(){return this.execute();}
}
function database(t){const sqlite=new DatabaseSync(':memory:');for(const name of readdirSync(new URL('../migrations/',import.meta.url)).filter(n=>/^\d+.*\.sql$/.test(n)).sort())sqlite.exec(readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8'));t.after(()=>sqlite.close());return {sqlite,prepare(sql){return new Statement(this,sql);},async batch(statements){sqlite.exec('BEGIN');try{const results=statements.map(s=>s.execute());sqlite.exec('COMMIT');return results;}catch(error){sqlite.exec('ROLLBACK');throw error;}}};}
function post(values){return new Request(HQ+'/action',{method:'POST',headers:{Origin:HQ,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(values)});}
const form=(extra={})=>({action:'event_save',id:'poppy',title:'Buddy Poppy table',org_id:'vfw-ca-8151',organizer:'Dixon VFW Post 8151',kind:'Volunteering',county:'Solano',city:'Dixon',venue:'Dixon community table',date_only:'yes',event_date:'2026-11-07',start_at:'',end_at:'',audience:'Community members welcome.',description:'Visit the Buddy Poppy table.',source_kind:'project_team',source_note:NOTE,source_url:'https://vfw8151.org/',...extra});
const saved=db=>{const row=db.sqlite.prepare("SELECT * FROM events WHERE id='poppy'").get();return {...row,body:JSON.parse(row.body_json)};};

test('date-only calendar exports exact local dates through month/year and DST boundaries',()=>{
 for(const [start,end] of [['2026-11-07','20261108'],['2026-11-30','20261201'],['2026-12-31','20270101']]){
  const ics=eventCalendar([event({start_at:start+'T00:00:00-08:00'})]).replace(/\r\n /g,'');
  assert.ok(ics.includes('DTSTART;VALUE=DATE:'+start.replaceAll('-','')));
  assert.ok(ics.includes('DTEND;VALUE=DATE:'+end));
  assert.ok(ics.includes('SUMMARY:Buddy Poppy table — Time to be confirmed'));
  assert.ok(ics.includes('Time to be confirmed.'));assert.ok(!ics.includes('DTSTART:'));
 }
 const dst=event({start_at:'2026-11-01T00:00:00-07:00'});
 assert.equal(upcomingEvents([dst],Date.parse('2026-11-01T23:59:59-08:00')).length,1);
 assert.equal(upcomingEvents([dst],Date.parse('2026-11-02T00:00:00-08:00')).length,0);
 const timed=eventCalendar([event({date_only:false,start_at:'2026-11-07T10:00:00-08:00',end_at:'2026-11-07T12:00:00-08:00'})]);
 assert.ok(timed.includes('DTSTART:20261107T180000Z'));assert.ok(timed.includes('DTEND:20261107T200000Z'));assert.ok(!timed.includes('VALUE=DATE'));
});
test('date-only public pages show no invented time and clearly identify project-team provenance',()=>{
 const future=event({start_at:'2099-11-07T00:00:00-08:00'});
 for(const path of ['/events','/events/poppy']){
  const html=publicExtension(new URL(HQ+path),[future]).html;
  assert.match(html,/Time to be confirmed/);assert.doesNotMatch(html,/12:00|00:00|All.day/i);
  if(path.endsWith('poppy')){assert.ok(html.includes(NOTE));assert.match(html,/Project team update/);assert.doesNotMatch(html,/Published source checked/);}
 }
 const checked=publicExtension(new URL(HQ+'/events/poppy'),[event({date_only:false,source_kind:undefined,source_checked:'2026-09-02',start_at:'2099-11-07T10:00:00-08:00'})]).html;
 assert.match(checked,/Published source checked/);assert.match(checked,/10:00 AM/);
});
test('HQ edits preserve date-only state and team source while rejecting mixed date/time input',async t=>{
 const db=database(t);await hqAction(post(form()),db,ACTOR);
 assert.equal(saved(db).body.start_at,'2026-11-07T00:00:00-08:00');assert.equal(saved(db).body.end_at,null);
 const input=form({version:saved(db).updated_at,title:'Updated table'});delete input.source_kind;delete input.source_note;
 await hqAction(post(input),db,ACTOR);
 assert.equal(saved(db).body.source_kind,'project_team');assert.equal(saved(db).body.source_note,NOTE);assert.equal(saved(db).body.date_only,true);
 const page=await (await hqFetch(new Request(HQ+'/?tab=events&event=poppy'),{DB:db,OWNER_EMAIL:ACTOR,ACCESS_AUD:'test'},{access:{aud:'test',getIdentity:async()=>({email:ACTOR})}},{})).text();
 assert.match(page,/name="date_only" value="yes" checked/);assert.match(page,/Time to be confirmed/);assert.doesNotMatch(page,/2026-11-07T00:00/);
 for(const extra of [{end_at:'2026-11-07T12:00:00-08:00'},{start_at:'2026-11-07T10:00:00-08:00'},{event_date:'2026-02-30'},{date_only:'TRUE'}]){
  await assert.rejects(hqAction(post(form({version:saved(db).updated_at,...extra})),db,ACTOR));
 }
 const summer=form({id:'summer',event_date:'2026-07-15'});await hqAction(post(summer),db,ACTOR);
 assert.equal(JSON.parse(db.sqlite.prepare("SELECT body_json FROM events WHERE id='summer'").get().body_json).start_at,'2026-07-15T00:00:00-07:00');
 await hqAction(post(form({version:saved(db).updated_at,date_only:'',event_date:'',start_at:'2026-11-07T10:00:00-08:00',end_at:'2026-11-07T12:00:00-08:00'})),db,ACTOR);
 assert.equal(saved(db).body.date_only,undefined);assert.equal(saved(db).body.end_at,'2026-11-07T12:00:00-08:00');
});
