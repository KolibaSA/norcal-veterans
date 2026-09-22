import test from 'node:test';
import assert from 'node:assert/strict';
import { createFeature, organizationPayload, loadScopeOptions } from './browser.mjs';
import { controls } from '../../shared/browser-test-support.mjs';
import { VFW_8151_ID } from './meeting-plans.mjs';

test('organization editing retains evidence and private imported data without inventing verification', () => {
  const record = { title: 'Synthetic organization', payload: {
    source_ids: ['source-a'], organization_confirmed_at: '2026-09-01T16:30:00Z',
    address: { text: 'PO Box 1', type: 'mailing', map_eligible: false }, imported: { keep: true }
  } };
  const fields = createFeature().fields(record); fields.mapEligible = true;
  const result = organizationPayload(fields, record.payload);
  assert.equal(result.address.map_eligible, false); assert.equal(result.last_verified_date, null);
  assert.equal(result.organization_confirmed_at, record.payload.organization_confirmed_at);
  assert.deepEqual(result.source_ids, ['source-a']); assert.deepEqual(result.imported, { keep: true });
  assert.notEqual(result.imported, record.payload.imported);
});

test('organization relationships save and reopen using the parent organization ID', () => {
  const fields = createFeature().fields({ payload: { relationship_type: 'auxiliary', affiliated_with_id: 'legion-ca-208' } });
  assert.equal(fields.relationshipType, 'auxiliary'); assert.equal(fields.affiliatedWith, 'legion-ca-208');
  const result = organizationPayload({ ...fields, relationshipType: 'sons', affiliatedWith: 'legion-ca-208' }, {});
  assert.equal(result.relationship_type, 'sons'); assert.equal(result.affiliated_with_id, 'legion-ca-208');
  const independent = organizationPayload({ ...fields, relationshipType: 'independent', affiliatedWith: 'legion-ca-208' }, result);
  assert.equal(independent.relationship_type, 'independent'); assert.equal(independent.affiliated_with_id, null);
});

test('organization scope choices use escaped public labels and their existing stable IDs', async () => {
  const { $ } = controls(), paths = [];
  await loadScopeOptions(async path => { paths.push(path); return [{ id: 'org-"x', title: '<Example>' }]; }, $('org'));
  assert.deepEqual(paths, ['records?kind=organization']);
  assert.match($('org').innerHTML, /org-&quot;x/); assert.match($('org').innerHTML, /&lt;Example&gt;/);
  assert.doesNotMatch($('org').innerHTML, /<Example>/);
});

test('only VFW Post 8151 maps the twelve-month planner and multiple labeled times', () => {
  const post = { id: VFW_8151_ID, title: 'Dixon VFW Post 8151', payload: { id: VFW_8151_ID, meeting_plans: [{ year: 2027, meetings: [{
    month: 1, date: '2027-01-21', title: 'January meeting', notes: 'Monthly gathering.',
    time_1: '18:00', label_1: 'Social hour', time_2: '19:00', label_2: 'Post meeting', time_3: '20:00', label_3: 'Social time'
  }] }] } };
  const fields = createFeature().fields(post);
  assert.equal(fields.meetingPlannerOrganization, VFW_8151_ID);
  assert.equal(fields.meetingDate1, '2027-01-21'); assert.equal(fields.meetingLabel1_3, 'Social time');
  fields.meetingLabel1_2 = 'Business meeting';
  const payload = organizationPayload(fields, post.payload);
  assert.equal(payload.meeting_plans[0].meetings[0].label_2, 'Business meeting');
  const other = createFeature().fields({ id: 'vfw-ca-other', payload: {} });
  assert.equal(other.meetingPlannerOrganization, '');
  assert.equal(organizationPayload(other, {}).meeting_plans, undefined);
});
