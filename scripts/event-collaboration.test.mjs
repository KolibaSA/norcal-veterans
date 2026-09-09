import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {organizationEventCollaborationAction,organizationEventInvitationRows,organizationEventCollaboration} from '../src/event-collaboration.mjs';
import {records} from '../src/data.mjs';

const HQ='https://hq.example.test',ADMIN='smartzgraphics@yahoo.com',REP='representative@example.test',HOST='legion-ca-77',RECIPIENTS=['vfw-ca-8151','mcl-yolo','toys-yolo','vfw-ca-7143'];
const migration=readdirSync(new URL('../migrations/',import.meta.url)).filter(name=>/^\d+.*\.sql$/.test(name)).sort().map(name=>readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8')).join('\n');
class Statement{constructor(db,sql,values=[]){this.db=db;this.sql=sql;this.values=values;}bind(...values){return new Statement(this.db,this.sql,values);}execute(){const q=this.db.sqlite.prepare(this.sql);let results=[],changes;if(q.columns().length){results=q.all(...this.values).map(row=>({...row}));changes=Number(this.db.sqlite.prepare('SELECT changes() n').get().n);}else changes=Number(q.run(...this.values).changes);return {success:true,results,meta:{changes}};}async all(){return this.execute();}}
class D1{constructor(){this.sqlite=new DatabaseSync(':memory:');this.sqlite.exec(migration);}prepare(sql){return new Statement(this,sql);}async batch(statements){this.sqlite.exec('BEGIN IMMEDIATE');try{const out=statements.map(statement=>statement.execute());this.sqlite.exec('COMMIT');return out;}catch(error){this.sqlite.exec('ROLLBACK');throw error;}}one(sql,...values){return this.sqlite.prepare(sql).get(...values);}all(sql,...values){return this.sqlite.prepare(sql).all(...values).map(row=>({...row}));}}
const post=values=>new Request(HQ+'/organization/events',{method:'POST',headers:{Origin:HQ,'Sec-Fetch-Site':'same-origin','Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(values)});
const values=(extra={})=>({action:'organization_event_create',org_id:HOST,title:'Army-Navy Game Watch Party',event_date:'2026-12-12',event_time:'15:00',venue:'American Legion Post 77, 523 Bush Street, Woodland, CA 95695',audience:'Local veterans, families and community members; confirm attendance details with Post 77.',description:'Join Yolo American Legion Post 77 for an Army-Navy Game watch party.',confirmed:'yes',...extra});

test('an authorized organization publishes an event and sends private invitations',async t=>{
 const db=new D1();t.after(()=>db.sqlite.close());db.sqlite.prepare('INSERT INTO organization_editors(id,email,org_id,status,created_by,created_at,updated_at,activated_at) VALUES (?,?,?,?,?,?,?,?)').run('member',REP,HOST,'active',ADMIN,'2026-09-04','2026-09-04','2026-09-04');
 const params=new URLSearchParams(values());for(const id of RECIPIENTS)params.append('recipient_org_ids',id);const request=new Request(HQ+'/organization/events',{method:'POST',headers:{Origin:HQ,'Sec-Fetch-Site':'same-origin','Content-Type':'application/x-www-form-urlencoded'},body:params});
 const response=await organizationEventCollaborationAction(request,{DB:db},{email:REP,isAdmin:false,memberships:[{email:REP,org_id:HOST,status:'active'}]},records);assert.equal(response.status,303);
 const event=JSON.parse(db.one('SELECT body_json FROM events').body_json);assert.equal(event.start_at,'2026-12-12T15:00:00-08:00');assert.equal(event.organization_id,HOST);assert.equal(db.one('SELECT status FROM events').status,'published');assert.equal(Number(db.one('SELECT count(*) n FROM organization_event_invitations').n),4);
 const inbox=await organizationEventInvitationRows(db,[RECIPIENTS[0]]);assert.equal(inbox.length,1);const html=organizationEventCollaboration(RECIPIENTS[0],records,inbox);assert.ok(html.includes('Army-Navy Game Watch Party'));assert.ok(html.includes('Send response and feedback'));assert.ok(html.includes('Tentative'));
});

test('scope tampering and stale invitation decisions are rejected',async t=>{
 const db=new D1();t.after(()=>db.sqlite.close());
 await assert.rejects(organizationEventCollaborationAction(post({...values(),recipient_org_ids:RECIPIENTS[0]}),{DB:db},{email:REP,isAdmin:false,memberships:[]},records),/do not manage/);assert.equal(Number(db.one('SELECT count(*) n FROM events').n),0);
 const admin={email:ADMIN,isAdmin:true,memberships:[]},params=new URLSearchParams(values({recipient_org_ids:RECIPIENTS[0]}));await organizationEventCollaborationAction(new Request(HQ+'/organization/events',{method:'POST',headers:{Origin:HQ,'Sec-Fetch-Site':'same-origin','Content-Type':'application/x-www-form-urlencoded'},body:params}),{DB:db},admin,records);
 const invitation=db.one('SELECT * FROM organization_event_invitations');const decision={action:'organization_event_invitation_decide',org_id:RECIPIENTS[0],invitation_id:invitation.id,version:String(invitation.version),decision:'tentative',feedback:'We may attend and can confirm after our November meeting.'};await organizationEventCollaborationAction(post(decision),{DB:db},admin,records);const saved=db.one('SELECT status,feedback FROM organization_event_invitations');assert.equal(saved.status,'tentative');assert.equal(saved.feedback,'We may attend and can confirm after our November meeting.');await assert.rejects(organizationEventCollaborationAction(post(decision),{DB:db},admin,records),/changed/);
});

