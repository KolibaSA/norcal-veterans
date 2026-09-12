import test from 'node:test';
import assert from 'node:assert/strict';
import { handleHistoryRoute } from './server.mjs';
import { createDatabase, seedRecord } from '../../shared/testing/database.mjs';

test('History applies record scope and redacts request approval and claim credentials in immutable snapshots', async t => {
  const DB = createDatabase(t), id = seedRecord(DB, { kind: 'request', payload: { useful: 'keep', request_approval: { approved_by: 'owner@example.com', approved_version: 1 }, norcal_hq_agent: { claim_token: 'synthetic-secret', run_id: 'run' } } });
  const req = new Request(`https://hq.test/api/hq/records/${id}/history`);
  const owner = { owner: true, email: 'owner@example.com' };
  const response = await handleHistoryRoute(req, { DB }, owner, []);
  assert.equal(response.status, 200);
  const revisions = await response.json();
  assert.equal(revisions.length, 1);
  assert.deepEqual(revisions[0].record.payload, { useful: 'keep', norcal_hq_agent: { run_id: 'run' } });
  assert.equal(revisions[0].record.mutation_id, undefined);
  const scoped = { owner: false, email: 'editor@example.com' };
  const grants = [{ email: scoped.email, role: 'editor', region_id: 'another-region' }];
  assert.equal((await handleHistoryRoute(req, { DB }, scoped, grants)).status, 404);
  assert.equal((await handleHistoryRoute(new Request('https://hq.test/api/hq/audit'), { DB }, scoped, grants)).status, 403);
});
