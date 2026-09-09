import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

// This checker never opens a persistent database or connects to production.
export const backupTables = [
  'tasks', 'requests', 'events', 'profile_updates', 'coordination', 'audit',
  'revisions', 'work_requests', 'work_request_messages', 'request_processor',
  'work_request_attachments', 'organization_editors', 'organization_photos',
  'organization_officers', 'organization_photo_albums', 'organization_photo_presence',
  'speaker_submissions', 'speaker_submission_recipients',
  'organization_meeting_plans', 'organization_meetings',
  'organization_event_invitations',
];
const temporaryTables = new Set(['intake_limits']);
const identifier = value => '"' + value.replaceAll('"', '""') + '"';
const fail = message => { throw new Error(message); };
const canonicalRows = (rows, columns) => rows.map(row => JSON.stringify(columns.map(key => row[key]))).sort();

export function verifyBackup(snapshotPath) {
  const source = readFileSync(snapshotPath);
  const snapshot = JSON.parse(source.toString('utf8').replace(/^\uFEFF/, ''));
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) fail('Backup must be a JSON object.');
  const schemaVersion = Number(snapshot.schema_version ?? 2);
  if (![2, 3, 4, 5, 6, 7, 8, 9, 10, 11].includes(schemaVersion)) fail('Unsupported backup schema version; expected 2 through 11.');
  const tableVersion = {work_request_attachments:3,organization_editors:4,organization_photos:5,organization_officers:6,organization_photo_albums:7,organization_photo_presence:7,speaker_submissions:8,speaker_submission_recipients:8,organization_meeting_plans:9,organization_meetings:9,organization_event_invitations:10};
  const snapshotTables = backupTables.filter(table => (tableVersion[table] ?? 2) <= schemaVersion);
  for (const table of snapshotTables) {
    if (!Array.isArray(snapshot[table])) fail(`Incomplete backup: missing table array ${table}. Export a fresh complete snapshot.`);
  }

  const migrationsPath = new URL('../migrations/', import.meta.url);
  const migrations = readdirSync(migrationsPath).filter(name => /^\d+.*\.sql$/.test(name) && Number.parseInt(name, 10) <= schemaVersion).sort();
  if (!migrations.length) fail('No schema migrations were found.');
  const database = new DatabaseSync(':memory:');
  try {
    for (const name of migrations) database.exec(readFileSync(new URL(name, migrationsPath), 'utf8'));
    const schemaTables = database.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(row => row.name);
    for (const table of schemaTables) {
      if (!snapshotTables.includes(table) && !temporaryTables.has(table)) fail(`Backup checker needs an explicit export rule for new table ${table}.`);
    }
    for (const table of snapshotTables) {
      if (!schemaTables.includes(table)) fail(`Backup table ${table} is missing from the current schema.`);
    }

    // Schema migrations seed processor state and can add history triggers. Remove
    // those temporary seed rows and suspend triggers while replaying saved rows.
    const triggers = database.prepare("SELECT name,sql FROM sqlite_schema WHERE type='trigger' ORDER BY name").all();
    database.exec('PRAGMA foreign_keys=OFF');
    database.exec('BEGIN');
    try {
      for (const trigger of triggers) database.exec(`DROP TRIGGER ${identifier(trigger.name)}`);
      for (const table of [...schemaTables].reverse()) database.exec(`DELETE FROM ${identifier(table)}`);
      for (const table of snapshotTables) {
        const columns = database.prepare(`PRAGMA table_info(${identifier(table)})`).all().map(row => row.name);
        const insert = database.prepare(`INSERT INTO ${identifier(table)} (${columns.map(identifier).join(',')}) VALUES (${columns.map(() => '?').join(',')})`);
        for (const row of snapshot[table]) {
          if (!row || typeof row !== 'object' || Array.isArray(row)) fail(`Invalid row in ${table}.`);
          if (Object.keys(row).length !== columns.length || columns.some(key => !Object.hasOwn(row, key))) fail(`Column mismatch in ${table}.`);
          for (const key of columns) {
            const value = row[key];
            if (value !== null && typeof value !== 'string' && !(typeof value === 'number' && Number.isFinite(value))) fail(`Invalid saved value type in ${table}.${key}.`);
          }
          insert.run(...columns.map(key => row[key]));
        }
      }
      for (const trigger of triggers) database.exec(trigger.sql);
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
    database.exec('PRAGMA foreign_keys=ON');

    const rowsByTable = {};
    for (const table of snapshotTables) {
      const columns = database.prepare(`PRAGMA table_info(${identifier(table)})`).all().map(row => row.name);
      const restored = database.prepare(`SELECT * FROM ${identifier(table)}`).all();
      if (JSON.stringify(canonicalRows(restored, columns)) !== JSON.stringify(canonicalRows(snapshot[table], columns))) fail(`Restored rows do not match ${table}.`);
      rowsByTable[table] = restored.length;
      if (columns.includes('body_json')) {
        for (const row of restored) {
          try { JSON.parse(row.body_json); } catch { fail(`Unreadable saved JSON in ${table}.`); }
        }
      }
    }
    const integrity = database.prepare('PRAGMA integrity_check').all();
    if (integrity.length !== 1 || Object.values(integrity[0])[0] !== 'ok') fail('Restored database failed its integrity check.');
    if (database.prepare('PRAGMA foreign_key_check').all().length) fail('Restored data has a broken reference between tables.');
    const restoredTriggers = database.prepare("SELECT name,sql FROM sqlite_schema WHERE type='trigger' ORDER BY name").all();
    if (JSON.stringify(restoredTriggers) !== JSON.stringify(triggers)) fail('History triggers were not restored exactly.');

    return {
      result: 'passed', checked_at: new Date().toISOString(), snapshot: resolve(snapshotPath),
      snapshot_sha256: createHash('sha256').update(source).digest('hex'),
      exported_at: snapshot.exported_at ?? null, schema_version: snapshot.schema_version ?? null,
      migrations, rows_by_table: rowsByTable,
      total_rows: Object.values(rowsByTable).reduce((sum, count) => sum + count, 0),
      integrity: 'ok', references: 'ok', history_triggers_restored: triggers.length,
      empty_tables: snapshotTables.filter(table => rowsByTable[table] === 0),
      omitted_temporary_tables: [...temporaryTables],
      isolation: 'new in-memory database; no production connection or write',
      limitation: 'This verifies local reconstruction of the supplied snapshot. Attachment and organization photo rows contain metadata only; R2 file bytes require a separate private backup and SHA-256 verification. Preserve historical originals referenced by earlier backups even after a gallery removal. Empty tables have no saved rows to compare. It does not perform a Cloudflare restore or establish a scheduled backup.',
    };
  } finally {
    database.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
    console.log('Usage: node scripts/verify-backup.mjs SNAPSHOT.json [--report REPORT.json]\nRestores all saved tables in an isolated in-memory database and verifies exact rows, integrity, references and history triggers.');
  } else if (!(args.length === 1 || args.length === 3 && args[1] === '--report')) {
    console.error('Usage: node scripts/verify-backup.mjs SNAPSHOT.json [--report REPORT.json]');
    process.exitCode = 2;
  } else {
    try {
      const report = verifyBackup(args[0]);
      const output = JSON.stringify(report, null, 2) + '\n';
      if (args[2]) {
        if (resolve(args[2]) === resolve(args[0])) fail('The report path must not overwrite the backup.');
        writeFileSync(args[2], output, { flag: 'wx' });
      }
      console.log(output);
    } catch (error) {
      console.error('Backup verification failed: ' + error.message);
      process.exitCode = 1;
    }
  }
}

