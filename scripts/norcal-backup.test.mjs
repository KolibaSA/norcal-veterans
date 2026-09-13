import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { verifySQLBackup } from './norcal-backup.mjs';

const migration = name => readFileSync(new URL('../migrations/legacy/' + name, import.meta.url), 'utf8');
const base = migration('0001_headquarters.sql');
const requests = migration('0002_request_runs.sql');
const revisions = migration('0003_record_revisions.sql');
const syntheticRows = `
INSERT INTO records(id,kind,title,body,region_id,status,payload,created_by,created_at,updated_at,mutation_id)
VALUES('synthetic-backup-org','organization','Synthetic restore organization','Synthetic public text','yolo-solano','published','{"city":"Dixon"}','qa@example.test','2026-09-12','2026-09-12','synthetic-org-mutation');
INSERT INTO records(id,kind,title,body,region_id,status,payload,created_by,created_at,updated_at,mutation_id)
VALUES('synthetic-backup-request','request','Synthetic restore request','Synthetic private text','yolo-solano','queued','{}','qa@example.test','2026-09-12','2026-09-12','synthetic-request-mutation');
INSERT INTO audit(id,actor,action,record_id,created_at)
VALUES('synthetic-backup-audit','qa@example.test','create','synthetic-backup-org','2026-09-12');
`;

test('active HQ SQL restore verifies current schema and its revision baseline', () => {
  const result = verifySQLBackup(base + syntheticRows + requests + revisions, { upgradeCheck: true });
  assert.equal(result.integrity, 'ok');
  assert.equal(result.foreign_keys, 'ok');
  assert.equal(result.counts.records, 2);
  assert.equal(result.counts.audit, 1);
  assert.equal(result.counts.record_revisions, 2);
  assert.equal(result.counts.request_runs, 0);
  assert.deepEqual(result.upgrades_checked, ['0004_vfw_8151_meeting_plan.sql', '0005_super_admin.sql']);
});

test('active HQ restore rejects missing tables, invalid SQL and malformed record payloads', () => {
  assert.throws(() => verifySQLBackup(base + 'DROP TABLE attachments;'), /missing.*attachments/i);
  assert.throws(() => verifySQLBackup(base + 'THIS IS NOT A SQL BACKUP;'), /syntax/i);
  assert.throws(() => verifySQLBackup(base + syntheticRows + "UPDATE records SET payload='{broken' WHERE id='synthetic-backup-org';"), /malformed record versions or payloads/);
  assert.throws(() => verifySQLBackup(base + requests + 'DROP TABLE request_entries;', { upgradeCheck: true }), /missing table: request_entries/);
});

test('additive restore rehearsal preserves existing data counts and creates one baseline per record', () => {
  const sql = base + syntheticRows;
  const before = verifySQLBackup(sql);
  const upgraded = verifySQLBackup(sql, { upgradeCheck: true });
  for (const name of ['records', 'grants', 'audit', 'attachments', 'submission_limits']) assert.equal(upgraded.counts[name], before.counts[name], name);
  assert.deepEqual(upgraded.upgrades_checked, ['0002_request_runs.sql', '0003_record_revisions.sql', '0004_vfw_8151_meeting_plan.sql', '0005_super_admin.sql']);
  assert.equal(upgraded.counts.record_revisions, before.counts.records);
  assert.equal(upgraded.counts.request_runs, 0);
  assert.equal(upgraded.counts.request_entries, 0);
});
