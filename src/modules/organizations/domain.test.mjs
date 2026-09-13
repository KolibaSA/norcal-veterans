import test from 'node:test';
import assert from 'node:assert/strict';
import { validateOrganization } from './domain.mjs';

test('Organizations preserves custom categories while publication requires county and organization type', () => {
  const content = { organization_type: 'Local mutual aid', location_county: 'Yolo', custom_notes: 'Retain existing metadata' };
  assert.deepEqual(validateOrganization(content, { status: 'published', isNew: true }), content);
  assert.throws(() => validateOrganization({}, { status: 'published', isNew: true }), /type and county/);
  assert.throws(() => validateOrganization({ ...content, address: { type: 'home', text: 'Private home' } }), /Residential and personal/);
});

test('Organizations source evidence cannot impersonate a reviewer or invent source references', () => {
  assert.throws(() => validateOrganization({ source_ids: ['unregistered-source'] }), /existing source references/);
  assert.throws(() => validateOrganization({ reviewed_by: 'someone@example.com' }), /recorded by the server/);
  const stored = { source_ids: ['historical-source'], address: { type: 'historical-withheld' } };
  assert.deepEqual(validateOrganization(stored, { previousPayload: stored }), stored);
});

test('Post 8151 meeting plans require valid monthly dates and ordered labeled times', () => {
  const meeting = { month: 1, date: '2027-01-21', title: 'January meeting', notes: '',
    time_1: '18:00', label_1: 'Social hour', time_2: '19:00', label_2: 'Post meeting', time_3: '20:00', label_3: 'Social time' };
  const content = { id: 'vfw-ca-8151', meeting_plans: [{ year: 2027, meetings: [meeting] }] };
  assert.deepEqual(validateOrganization(content), content);
  assert.throws(() => validateOrganization({ ...content, id: 'vfw-ca-other' }), /only for VFW Post 8151/);
  assert.throws(() => validateOrganization({ ...content, meeting_plans: [{ year: 2027, meetings: [{ ...meeting, date: '2027-02-18' }] }] }), /January must use a date/);
  assert.throws(() => validateOrganization({ ...content, meeting_plans: [{ year: 2027, meetings: [{ ...meeting, time_2: '17:00' }] }] }), /earliest to latest/);
  assert.throws(() => validateOrganization({ ...content, meeting_plans: [{ year: 2027, meetings: [{ ...meeting, label_1: '' }] }] }), /label for every time/);
});
