import test from 'node:test';
import assert from 'node:assert/strict';
import { createFeature } from './browser.mjs';

test('coordination keeps its drafts and record lifecycle separate from another screen instance', () => {
  const feature = createFeature(), another = createFeature();
  feature.state.filter.query = 'Synthetic search'; feature.state.rows.push({ id: 'fixture' });
  assert.equal(another.state.filter.query, ''); assert.deepEqual(another.state.rows, []);
  const record = { title: 'Fixture', body: 'Private work', payload: { imported: { preserved: true } } };
  const fields = feature.fields(record);
  assert.equal(fields.recordStatus, 'draft');
  assert.equal(fields.recordBody, 'Private work');
  assert.equal(feature.statusesFor({ owner: true }, record).includes('active'), true);
  const result = feature.payload(fields, record.payload);
  assert.deepEqual(result, record.payload); assert.notEqual(result.imported, record.payload.imported);
});

test('coordination record reads use its own kind without scanning other features', async () => {
  const feature = createFeature(), paths = [];
  const records = [{ id: 'synthetic', status: 'draft' }];
  assert.deepEqual(await feature.list(async path => { paths.push(path); return records; }), records);
  assert.deepEqual(paths, ['records?kind=' + feature.kind]);
});
