import test from 'node:test';
import assert from 'node:assert/strict';
import { handleBackupRoute } from './server.mjs';
import { createDatabase, seedRecord } from '../../shared/testing/database.mjs';

test('Backup preserves the private logical schema and every recovery table in memory behind owner access', async t => {
  const DB = createDatabase(t);
  seedRecord(DB, { payload: { private_recovery_value: 'synthetic-only' } });
  const req = new Request('https://hq.test/api/hq/export');
  assert.equal((await handleBackupRoute(req, { DB }, { owner: false })).status, 403);
  const response = await handleBackupRoute(req, { DB }, { owner: true });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  assert.match(response.headers.get('Content-Disposition'), /norcal-headquarters-backup.json/);
  const backup = await response.json();
  assert.equal(backup.schema, 3);
  for (const table of ['records', 'grants', 'audit', 'attachments', 'request_runs', 'request_entries', 'hq_agent_health', 'record_revisions']) assert.ok(Array.isArray(backup[table]), table);
  assert.equal(JSON.parse(backup.records[0].payload).private_recovery_value, 'synthetic-only');
  assert.equal(backup.record_revisions.length, 1);
});
