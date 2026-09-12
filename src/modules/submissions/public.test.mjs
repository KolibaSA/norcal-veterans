import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {organizationSubmission,submissionPage} from './public.mjs';
const organizations=[{id:'fixture-org',verified_name:'Synthetic Veterans & Partners',city:'Dixon',location_county:'Solano'}];
const input=overrides=>new URLSearchParams({privacy:'yes',kind:'profile',org_id:'fixture-org',sender_name:'Private sender',
  sender_email:'private@example.test',title:'Profile correction',details:'Public detail',...overrides});

test('organization contribution keeps sender details in its review body',()=>{
  const row=organizationSubmission(input(),organizations);
  assert.equal(row.title,'Profile correction');
  assert.deepEqual(JSON.parse(row.body),{kind:'profile',orgId:'fixture-org',name:'Private sender',email:'private@example.test',details:'Public detail',source:''});
  assert.equal(row.status,undefined);
});
test('contribution checks public-information consent and selected live organization',()=>{
  assert.throws(()=>organizationSubmission(input({privacy:''}),organizations),/public organization information/);
  assert.throws(()=>organizationSubmission(input({org_id:'unknown'}),organizations),/Choose an organization/);
  assert.throws(()=>organizationSubmission(input({kind:'grant_admin'}),organizations),/valid option/);
  assert.equal(JSON.parse(organizationSubmission(input({org_id:''}),organizations).body).orgId,'');
});
test('contribution form markup remains byte-equivalent to the pre-refactor baseline',()=>{
  const html=submissionPage(new URL('https://site.test/for-organizations'),{organizations});
  assert.equal(createHash('sha256').update(html).digest('hex'),'667e267b27da1daa4427621f8211553283eb05f75cab4405369f80b9dd7abac2');
});
