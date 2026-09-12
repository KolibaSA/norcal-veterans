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
