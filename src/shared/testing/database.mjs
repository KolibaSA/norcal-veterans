// Synthetic in-memory D1 adapter for focused module tests. Never imported by the Worker.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';

export function createDatabase(t) {
  const raw = new DatabaseSync(':memory:');
  const directory = new URL('../../../migrations/legacy/', import.meta.url);
  for (const name of readdirSync(directory).filter(name => name.endsWith('.sql')).sort()) raw.exec(readFileSync(new URL(name, directory), 'utf8'));
  t.after(() => raw.close());
  return {
    raw,
    prepare(sql) {
      let values = [];
      return {
        bind(...args) { values = args; return this; },
        async first() { return raw.prepare(sql).get(...values) || null; },
        async all() { return { results: raw.prepare(sql).all(...values) }; },
        async run() {
          const statement = raw.prepare(sql);
          if (statement.columns().length) {
            const results = statement.all(...values);
            return { results, meta: { changes: /\bRETURNING\b/i.test(sql) ? results.length : 0 } };
          }
          return { results: [], meta: { changes: Number(statement.run(...values).changes) } };
        }
      };
    },
    async batch(statements) {
      raw.exec('BEGIN');
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        raw.exec('COMMIT');
        return results;
      } catch (error) { raw.exec('ROLLBACK'); throw error; }
    }
  };
}

export function seedRecord(DB, { id = 'synthetic-record', kind = 'task', payload = {}, region = 'yolo-solano' } = {}) {
  DB.raw.prepare(`INSERT INTO records(id,kind,title,body,region_id,status,payload,created_by,created_at,updated_at,mutation_id)
    VALUES(?,?,?,'Private synthetic content',?,'draft',?,'owner@example.com','2026-09-12T00:00:00Z','2026-09-12T00:00:00Z',?)`)
    .run(id, kind, 'Synthetic record', region, JSON.stringify(payload), 'seed-' + id);
  DB.raw.prepare("INSERT INTO audit(id,actor,action,record_id,created_at) VALUES(?,'owner@example.com','create',?,'2026-09-12T00:00:00Z')").run('audit-' + id, id);
  return id;
}
