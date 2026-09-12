import test from 'node:test';
import assert from 'node:assert/strict';
import {submitPublicForm} from './public-intake.mjs';
const fields={consent:'yes',presenter_name:'Synthetic presenter',phone:'555-0100',email:'private@example.test',
  organization_name:'Synthetic program',organization_description:'Program description',topic:'Meeting topic',org_id:'fixture-org'};
const organizations=[{id:'fixture-org'}];
const request=(overrides={},headers={})=>new Request('https://site.test/speaker-submissions',{method:'POST',
  headers:{Origin:'https://site.test','CF-Connecting-IP':'192.0.2.1','Content-Type':'application/x-www-form-urlencoded',...headers},body:new URLSearchParams({...fields,...overrides})});
test('program workflow forwards only the review contract through the existing protected intake route',async()=>{
  let saved;
  const response=await submitPublicForm(request(),{},organizations,async forwarded=>{saved=forwarded;return Response.json({id:'synthetic'},{status:201});});
  assert.equal(response.status,303);assert.equal(response.headers.get('Location'),'/share?received=1');
  assert.equal(new URL(saved.url).pathname,'/api/submissions');assert.equal(saved.headers.get('Origin'),'https://site.test');
  assert.equal(saved.headers.get('CF-Connecting-IP'),'192.0.2.1');
  assert.deepEqual(Object.keys(await saved.json()),['title','body']);
});
test('program workflow rejects cross-origin and honeypot input before any review write',async()=>{
  let writes=0;const save=async()=>{writes++;return Response.json({});};
  await assert.rejects(()=>submitPublicForm(request({},{Origin:'https://elsewhere.test'}),{},organizations,save),/original page/);
  await assert.rejects(()=>submitPublicForm(request({website_check:'spam'}),{},organizations,save),/could not be accepted/);
  assert.equal(writes,0);
});
