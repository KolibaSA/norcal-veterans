import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {programSubmission} from './domain.mjs';
import {speakerSubmissionPage,shareProgramPage} from './public.mjs';

const organizations = [{id:'fixture-org',verified_name:'Synthetic Veterans & Partners',city:'Dixon',location_county:'Solano'}];
const input = overrides => new URLSearchParams({consent:'yes',presenter_name:'Synthetic presenter',phone:'555-0100',
  email:'private@example.test',organization_name:'Synthetic program',organization_description:'Program description',topic:'Meeting topic',org_id:'fixture-org',...overrides});

test('program form keeps recipient selection private and preserves the review record contract', () => {
  const form = input(); form.append('org_id','fixture-org');
  const result = programSubmission(form,organizations), body=JSON.parse(result.body);
  assert.equal(result.title,'Program introduction: Synthetic program');
  assert.deepEqual(body.organizations,['fixture-org']);
  assert.equal(body.kind,'speaker'); assert.equal(body.email,'private@example.test');
  assert.equal(result.status,undefined); assert.equal(result.approval,undefined);
  assert.deepEqual(JSON.parse(programSubmission(input({all_orgs:'yes',org_id:'unknown'}),organizations).body).organizations,['fixture-org']);
});

test('program form rejects missing consent, invalid recipients, invalid email and oversized names', () => {
  for (const [change,pattern] of [[{consent:''},/permission/],[{org_id:'unlisted'},/Choose organizations/],
    [{email:'not-an-email'},/email address/],[{organization_name:'x'.repeat(151)},/too long/]]) {
    assert.throws(()=>programSubmission(input(change),organizations),pattern);
  }
  assert.throws(()=>programSubmission(input({all_orgs:'yes'}),[]),/Choose organizations/);
});

test('program page preserves existing markup and makes private review explicit', () => {
  const url=new URL('https://site.test/share');
  const html=speakerSubmissionPage(url,organizations);
  assert.equal(createHash('sha256').update(html).digest('hex'),'a6d4cd60c34b0b7a07b003fdb8a75cca271a5a553cae7daf7de1bb502e56400c');
  const active=shareProgramPage(url,organizations,{received:true});
  assert.match(active,/saved in the private review queue/);
  assert.match(active,/Nothing is published automatically/);
  assert.doesNotMatch(active,/Each selected organization sees/);
  assert.match(shareProgramPage(url,organizations,{error:'<bad>'}),/&lt;bad&gt;/);
});
