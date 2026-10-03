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
  assert.throws(()=>organizationSubmission(input({privacy:''}),organizations),/permission to submit/);
  assert.throws(()=>organizationSubmission(input({org_id:'unknown'}),organizations),/Choose an organization/);
  assert.throws(()=>organizationSubmission(input({kind:'grant_admin'}),organizations),/valid option/);
  assert.equal(JSON.parse(organizationSubmission(input({org_id:''}),organizations).body).orgId,'');
});
test('design suggestions stay private in the review queue and retain the selected organization',()=>{
  const row=organizationSubmission(input({kind:'design',title:'Improve event links',details:'Add the local calendar near each profile.'}),organizations);
  assert.deepEqual(JSON.parse(row.body),{kind:'design',orgId:'fixture-org',name:'Private sender',email:'private@example.test',details:'Add the local calendar near each profile.',source:''});
  const html=submissionPage(new URL('https://site.test/for-organizations?kind=design&org=fixture-org'),{organizations});
  assert.match(html,/Suggest a website design change/);
  assert.match(html,/value="design" selected/);
  assert.match(html,/Design suggestions are considered by the site team and will not be published as submitted/);
  assert.match(html,/option value="fixture-org" selected/);
});
test('contribution form markup matches the approved public shell',()=>{
  const html=submissionPage(new URL('https://site.test/for-organizations'),{organizations});
  assert.equal(createHash('sha256').update(html).digest('hex'),'24ac11ffa61703e57813b4fd873fbb4b768a54cf0d57043ee94f435cdfaa8408');
});
