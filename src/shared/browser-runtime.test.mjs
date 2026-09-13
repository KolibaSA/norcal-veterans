import test from 'node:test';
import assert from 'node:assert/strict';
import { recordInput } from './browser-runtime.mjs';
import { createFeature } from '../modules/requests/browser.mjs';

test('new request form sends the selected section and status', () => {
  const feature = createFeature();
  const input = recordInput({
    recordTitle: 'Logo locations',
    recordBody: 'Swap the NorCal Vets and Yolo Solano logos.',
    recordStatus: 'queued',
    region: 'all',
    org: '',
    requestTarget: 'decide'
  }, 'request', feature);

  assert.equal(input.kind, 'request');
  assert.equal(input.status, 'queued');
  assert.equal(input.region_id, 'all');
  assert.equal(input.organization_id, null);
  assert.equal(input.payload.target, 'decide');
  assert.equal(feature.openSavedAfterCreate, false);
});
