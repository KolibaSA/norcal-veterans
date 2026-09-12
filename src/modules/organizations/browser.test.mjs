import test from 'node:test';
import assert from 'node:assert/strict';
import { createFeature, organizationPayload, loadScopeOptions } from './browser.mjs';
import { controls } from '../../shared/browser-test-support.mjs';

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

test('organization scope choices use escaped public labels and their existing stable IDs', async () => {
  const { $ } = controls(), paths = [];
  await loadScopeOptions(async path => { paths.push(path); return [{ id: 'org-"x', title: '<Example>' }]; }, $('org'));
  assert.deepEqual(paths, ['records?kind=organization']);
  assert.match($('org').innerHTML, /org-&quot;x/); assert.match($('org').innerHTML, /&lt;Example&gt;/);
  assert.doesNotMatch($('org').innerHTML, /<Example>/);
});
