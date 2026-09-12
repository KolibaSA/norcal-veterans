import test from 'node:test';
import assert from 'node:assert/strict';
import {
  pacificInput, fieldsForRecord, payloadForFields, canPublish, canEditRecord,
  filterRecords, itemURL, submissionDraft, healthDescription, esc
} from '../worker/legacy/hq-client.mjs';
import { validateRecordPayload } from '../worker/legacy/validation.mjs';

test('event editor displays Pacific wall time across summer, winter and UTC day boundaries', () => {
  assert.equal(pacificInput('2026-07-12T19:30:00.000Z'), '2026-07-12T12:30');
  assert.equal(pacificInput('2026-01-12T20:30:00.000Z'), '2026-01-12T12:30');
  assert.equal(pacificInput('2026-01-12T03:00:00.000Z'), '2026-01-11T19:00');
  assert.equal(pacificInput('2026-01-12T08:00:00.000Z'), '2026-01-12T00:00');
  assert.equal(pacificInput('2026-09-12', true), '2026-09-12');
  assert.equal(pacificInput('invalid'), '');
});

test('editing and saving winter event uses automatic Pacific conversion without moving it an hour', () => {
  const record = { kind: 'event', title: 'Winter gathering', body: 'Public information', status: 'published', payload: {
    start_at: '2026-12-04T02:00:00Z', end_at: '2026-12-04T04:00:00Z', venue: 'Community Hall',
    source_url: 'https://example.org/event', source_checked: '2026-09-12', custom_imported_field: 'preserve'
  } };
  const fields = fieldsForRecord(record);
  assert.equal(fields.start, '2026-12-03T18:00');
  assert.equal(fields.end, '2026-12-03T20:00');
  const candidate = payloadForFields('event', fields, record.payload);
  const saved = validateRecordPayload('event', candidate, { status: 'published', previousPayload: record.payload, isNew: false });
  assert.equal(saved.start_at, '2026-12-04T02:00:00.000Z');
  assert.equal(saved.end_at, '2026-12-04T04:00:00.000Z');
  assert.equal(candidate.custom_imported_field, 'preserve');
  assert.equal(candidate.source_checked, '2026-09-12');
});

test('date-only editor sends a date and deliberately clears a previous timed ending', () => {
  const record = { kind: 'event', title: 'Remembrance', body: '', status: 'draft', payload: { date_only: true, start_at: '2026-11-11', venue: 'Community venue', end_at: '2026-11-11T12:00:00Z' } };
  const fields = fieldsForRecord(record);
  const candidate = payloadForFields('event', fields, record.payload);
  assert.equal(candidate.starts_local, '2026-11-11');
  assert.equal(candidate.ends_local, '');
  const saved = validateRecordPayload('event', candidate, { status: 'draft', previousPayload: record.payload, isNew: false });
  assert.equal(saved.start_at, '2026-11-11T08:00:00.000Z');
  assert.equal(fieldsForRecord({ ...record, payload: saved }).start, '2026-11-11');
  assert.equal(saved.end_at, null);
});

test('organization form preserves provenance and unknown data without inventing review claims', () => {
  const record = { kind: 'organization', title: 'Local veterans', body: 'Public description', status: 'draft', payload: {
    organization_type: 'VFW', location_county: 'Yolo',
    address: { text: 'PO Box 1', type: 'mailing', map_eligible: false },
    source_ids: ['official-source'], reviewed_by: 'owner@example.org', review_recorded_at: '2026-09-12T18:00:00Z',
    organization_confirmed_at: '2026-09-01T16:30:00.000Z', confirmation_source_url: 'https://example.org/confirmation',
    private_import: { keep: true }
  } };
  const fields = fieldsForRecord(record);
  fields.mapEligible = true;
  const candidate = payloadForFields('organization', fields, record.payload);
  assert.equal(candidate.address.map_eligible, false);
  assert.equal(candidate.last_verified_date, null);
  assert.equal(candidate.organization_confirmed_at, record.payload.organization_confirmed_at);
  assert.deepEqual(candidate.source_ids, ['official-source']);
  assert.deepEqual(candidate.private_import, { keep: true });
  assert.equal(candidate.reviewed_by, 'owner@example.org');
  assert.equal(record.payload.address.map_eligible, false);
});

test('source review field requires source evidence through the server validator', () => {
  const fields = fieldsForRecord({ kind: 'event', title: 'Event', status: 'draft', payload: { start_at: '2026-10-10T19:00:00Z', venue: 'Hall' } });
  fields.sourceChecked = '2026-09-12';
  assert.throws(() => validateRecordPayload('event', payloadForFields('event', fields), { status: 'draft', isNew: true }), /source URL/i);
});

test('role-aware UI does not offer collaborator execution or editing of published content', () => {
  const editor = { email: 'editor@example.org', owner: false, grants: [{ email: 'editor@example.org', role: 'editor', region_id: 'yolo-solano' }] };
  const record = { kind: 'event', region_id: 'yolo-solano', status: 'published' };
  assert.equal(canPublish(editor, record), false);
  assert.equal(canEditRecord(editor, record), false);
  assert.equal(canEditRecord(editor, { ...record, status: 'draft' }), true);
  assert.equal(canEditRecord(editor, { kind: 'request', status: 'queued' }), false);
  assert.equal(canEditRecord({ owner: true }, { kind: 'request', status: 'in_progress' }), false);
  const admin = { ...editor, grants: [{ email: editor.email, role: 'region_admin', region_id: 'yolo-solano' }] };
  assert.equal(canPublish(admin, record), true);
  assert.equal(canPublish(admin, { ...record, region_id: 'north-bay' }), false);
});

test('submission draft preserves source link without copying private intake or marking it verified', () => {
  const intake = { id: 'submission-a', title: 'Community gathering', body: 'Private submitter contact and unreviewed claims', region_id: 'yolo-solano', payload: { email: 'submitter@example.org', phone: '555-1234' } };
  const draft = submissionDraft(intake, 'event');
  assert.equal(draft.status, 'draft');
  assert.equal(draft.body, '');
  assert.equal(draft.payload.intake_submission_id, intake.id);
  assert.equal(draft.payload.email, undefined);
  assert.equal(draft.payload.source_checked, undefined);
  assert.equal(draft.id, undefined);
});

test('search and status filters intersect, and direct item links encode identifiers safely', () => {
  const records = [{ title: 'Alpha', body: 'Volunteer', status: 'queued' }, { title: 'Beta', body: 'Volunteer', status: 'completed' }];
  assert.deepEqual(filterRecords(records, 'VOLUNTEER', 'queued'), [records[0]]);
  const url = new URL(itemURL('request', 'a&tab=access"', 'https://example.org'));
  assert.equal(url.searchParams.get('tab'), 'request');
  assert.equal(url.searchParams.get('item'), 'a&tab=access"');
  assert.equal(esc('<script>"&'), '&lt;script&gt;&quot;&amp;');
});

test('agent health distinguishes configured schedule from recent successful checks', () => {
  const now = Date.parse('2026-09-12T20:00:00Z');
  assert.match(healthDescription({ configured: true }, now), /first successful/);
  assert.match(healthDescription({ configured: true, last_successful_check: '2026-09-12T19:00:00Z' }, now), /not checked recently/);
  assert.match(healthDescription({ configured: true, last_successful_check: '2026-09-12T19:58:00Z', current_request_id: 'a' }, now), /active request/);
  assert.match(healthDescription({ configured: true, last_successful_check: '2026-09-12T19:58:00Z', last_error: 'Connection failure', last_error_at: '2026-09-12T19:59:00Z' }, now), /needs attention/);
});
