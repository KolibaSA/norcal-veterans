// Local synthetic browser QA only. This file is never part of the Worker graph.
// It deliberately has no Cloudflare configuration, credential or network client.
import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { dirname, extname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { webcrypto } from 'node:crypto';

const HOST = '127.0.0.1';
const PORT = 8790;
const ORIGIN = `http://${HOST}:${PORT}`;
const OWNER = 'qa-owner@example.test';
const TEAM = 'norcal-synthetic-fixture.cloudflareaccess.com';
const ISSUER = `https://${TEAM}`;
const CERT_URL = `${ISSUER}/cdn-cgi/access/certs`;
const AUDIENCE = 'synthetic-local-browser-fixture-only';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = realpathSync(resolve(ROOT, 'public'));

// The bind address and port cannot be changed by flags or environment variables.
if (process.argv.length !== 2) throw new Error('No options are accepted. This synthetic fixture binds only to http://127.0.0.1:8790.');

const sqlite = new DatabaseSync(':memory:');
sqlite.exec('PRAGMA foreign_keys=ON');
for (const migration of readdirSync(resolve(ROOT, 'migrations/legacy')).filter(name => /^\d{4}_.+\.sql$/.test(name)).sort()) {
  sqlite.exec(readFileSync(resolve(ROOT, 'migrations/legacy', migration), 'utf8'));
}
class FixtureStatement {
  constructor(sql, args = []) { this.sql = sql; this.args = args; }
  bind(...args) { return new FixtureStatement(this.sql, args); }
  execute() {
    const statement = sqlite.prepare(this.sql);
    if (statement.columns().length) {
      const results = statement.all(...this.args).map(row => ({ ...row }));
      const changes = /^\s*(?:SELECT|PRAGMA|EXPLAIN)\b/i.test(this.sql) ? 0 : Number(sqlite.prepare('SELECT changes() AS n').get().n);
      return { results, success: true, meta: { changes } };
    }
    return { results: [], success: true, meta: { changes: Number(statement.run(...this.args).changes) } };
  }
  async all() { return this.execute(); }
  async run() { return this.execute(); }
  async first(column) { const row = this.execute().results[0] ?? null; return column && row ? row[column] : row; }
}
const DB = {
  prepare(sql) { return new FixtureStatement(sql); },
  async batch(statements) {
    sqlite.exec('BEGIN');
    try { const results = statements.map(statement => statement.execute()); sqlite.exec('COMMIT'); return results; }
    catch (error) { sqlite.exec('ROLLBACK'); throw error; }
  }
};

const keys = await webcrypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, false, ['sign', 'verify']);
const publicKey = await webcrypto.subtle.exportKey('jwk', keys.publicKey);
publicKey.kid = 'synthetic-local-qa';
const base64 = value => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url');
async function identityToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = base64({ alg: 'RS256', kid: publicKey.kid });
  const claims = base64({ sub: 'synthetic-local-qa-owner', email: OWNER, iss: ISSUER, aud: [AUDIENCE], nbf: now - 5, exp: now + 600 });
  const signature = await webcrypto.subtle.sign('RSASSA-PKCS1-v1_5', keys.privateKey, new TextEncoder().encode(header + '.' + claims));
  return header + '.' + claims + '.' + Buffer.from(signature).toString('base64url');
}
const originalFetch = globalThis.fetch;
globalThis.fetch = async input => {
  const url = input instanceof Request ? input.url : String(input);
  if (url !== CERT_URL) throw new Error('Synthetic QA blocks every outbound network request.');
  return Response.json({ keys: [publicKey] });
};
const { default: worker } = await import('../src/norcal-worker.mjs');

const ASSETS = {
  async fetch(request) {
    try {
      const pathname = decodeURIComponent(new URL(request.url).pathname);
      if (pathname.includes('\0')) return new Response('Invalid asset path.', { status: 400 });
      const path = resolve(PUBLIC, '.' + pathname);
      const relation = relative(PUBLIC, path);
      if (relation.startsWith('..') || isAbsolute(relation)) return new Response('Not found.', { status: 404 });
      const actualPath = realpathSync(path);
      const actualRelation = relative(PUBLIC, actualPath);
      if (actualRelation.startsWith('..') || isAbsolute(actualRelation) || !statSync(actualPath).isFile()) return new Response('Not found.', { status: 404 });
      const type = { '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon' }[extname(actualPath)] || 'application/octet-stream';
      return new Response(readFileSync(actualPath), { headers: { 'Content-Type': type } });
    } catch { return new Response('Not found.', { status: 404 }); }
  }
};
const env = { DB, ASSETS, ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUDIENCE, OWNER_EMAIL: OWNER, HQ_REQUEST_AGENT_ENABLED: 'true' };
async function createRecord(record) {
  const response = await worker.fetch(new Request(ORIGIN + '/api/hq/records', { method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'application/json', 'Cf-Access-Jwt-Assertion': await identityToken() }, body: JSON.stringify(record) }), env);
  if (response.status !== 201) throw new Error('Synthetic seed rejected: ' + await response.text());
  return (await response.json()).id;
}
const organizationId = await createRecord({ kind: 'organization', title: 'Synthetic QA Veterans Network', body: 'Synthetic browser test information. This is not a real organization.', region_id: 'yolo-solano', status: 'published', payload: { organization_type: 'Veterans nonprofit', location_county: 'Solano', city: 'Dixon', service_categories: ['Synthetic QA'], public_contacts: { website: 'https://example.test/qa-organization', email: 'public-qa@example.test' }, address: { type: 'meeting_venue', text: 'Synthetic QA public hall', map_eligible: false } } });
const eventId = await createRecord({ kind: 'event', title: 'Synthetic QA winter community event', body: 'Synthetic event for date, publication and calendar testing.', region_id: 'yolo-solano', organization_id: organizationId, status: 'published', payload: { starts_local: '2027-01-15T18:00', ends_local: '2027-01-15T20:00', date_only: false, venue: 'Synthetic QA public hall', city: 'Dixon', county: 'Solano', organizer: 'Synthetic QA Veterans Network' } });
const requestId = await createRecord({ kind: 'request', title: 'Synthetic QA queued request', body: 'Synthetic task for exercising comments, revisions and queue display. This server never runs an agent.', region_id: 'yolo-solano', status: 'queued', payload: {} });
const orphanId = 'synthetic-qa-orphan-request';
const now = new Date().toISOString();
sqlite.prepare("INSERT INTO records(id,kind,title,body,region_id,status,payload,created_by,created_at,updated_at,mutation_id) VALUES(?,'request','Synthetic QA interrupted request','Synthetic legacy in-progress record with no durable execution. Use owner reconciliation only in this local fixture.','yolo-solano','in_progress','{}',?,?,?,?)").run(orphanId, OWNER, now, now, orphanId);
sqlite.prepare("INSERT INTO audit(id,actor,action,record_id,created_at) VALUES(?,?,'synthetic_seed',?,?)").run('synthetic-orphan-audit', OWNER, orphanId, now);
const submissionResponse = await worker.fetch(new Request(ORIGIN + '/api/submissions', { method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.55' }, body: JSON.stringify({ title: 'Synthetic QA submitted profile update', body: JSON.stringify({ kind: 'profile', orgId: organizationId, name: 'Synthetic QA Sender', email: 'private-reply-qa@example.test', details: 'Synthetic proposed public meeting update for the review form.', source: 'https://example.test/synthetic-source' }) }) }), env);
if (submissionResponse.status !== 201) throw new Error('Synthetic public submission could not be seeded.');
const submissionId = (await submissionResponse.json()).id;
sqlite.prepare("INSERT INTO hq_agent_health(id,last_successful_check,current_request_id,queued,state,last_error,last_error_at,updated_at) VALUES(1,?,?,1,'blocked','Synthetic QA: interrupted request awaits owner reconciliation.',?,?)").run(now, orphanId, now, now);

const ids = { organizationId, eventId, requestId, orphanId, submissionId };
const banner = '<aside role="status" style="padding:10px 4%;background:#fff4b8;color:#332700;border-bottom:2px solid #b88700;font:15px Arial,sans-serif"><strong>Synthetic QA — LOCAL ONLY.</strong> Automatic fixture sign-in; all records and identities are invented, all changes stay in memory, and no real request agent is running.</aside>';
const server = createServer(async (incoming, outgoing) => {
  try {
    if (incoming.headers.host !== `${HOST}:${PORT}` || (incoming.headers.origin && incoming.headers.origin !== ORIGIN)) {
      outgoing.writeHead(403, { 'Content-Type': 'text/plain' }); outgoing.end('Only the exact local synthetic fixture origin is allowed.'); return;
    }
    const url = new URL(incoming.url, ORIGIN);
    if (url.origin !== ORIGIN) { outgoing.writeHead(400); outgoing.end('Invalid fixture URL.'); return; }
    if (url.pathname === '/__fixture/status') {
      if (incoming.method !== 'GET') { outgoing.writeHead(405); outgoing.end(); return; }
      outgoing.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      outgoing.end(JSON.stringify({ fixture: 'Synthetic QA local only', ids, counts: sqlite.prepare('SELECT kind,status,COUNT(*) AS count FROM records GROUP BY kind,status ORDER BY kind,status').all(), runs: sqlite.prepare('SELECT state,COUNT(*) AS count FROM request_runs GROUP BY state').all(), entries: sqlite.prepare('SELECT kind,COUNT(*) AS count FROM request_entries GROUP BY kind').all() })); return;
    }
    const headers = new Headers();
    for (const [name, value] of Object.entries(incoming.headers)) if (value !== undefined && !['connection', 'host', 'transfer-encoding', 'cf-access-jwt-assertion'].includes(name)) headers.set(name, Array.isArray(value) ? value.join(', ') : value);
    headers.set('Cf-Access-Jwt-Assertion', await identityToken());
    const method = incoming.method || 'GET';
    const request = new Request(url, { method, headers, ...(!['GET', 'HEAD'].includes(method) ? { body: Readable.toWeb(incoming), duplex: 'half' } : {}) });
    let response = await worker.fetch(request, env, { waitUntil(promise) { Promise.resolve(promise).catch(() => {}); } });
    if (response.headers.get('Content-Type')?.includes('text/html')) {
      const html = (await response.text()).replace('<body>', '<body>' + banner).replace('<title>', '<title>Synthetic QA | ');
      const updatedHeaders = new Headers(response.headers); updatedHeaders.delete('Content-Length'); updatedHeaders.set('Cache-Control', 'no-store');
      response = new Response(html, { status: response.status, headers: updatedHeaders });
    }
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    if (response.body && method !== 'HEAD') Readable.fromWeb(response.body).pipe(outgoing);
    else outgoing.end();
  } catch (error) {
    console.error(JSON.stringify({ fixture: 'Synthetic QA', error: error.message }));
    if (!outgoing.headersSent) outgoing.writeHead(500, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
    outgoing.end('Synthetic QA fixture failed; inspect its local terminal.');
  }
});
server.headersTimeout = 15000;
server.requestTimeout = 30000;
server.on('error', error => { console.error(JSON.stringify({ fixture: 'Synthetic QA', error: error.message })); process.exitCode = 1; sqlite.close(); globalThis.fetch = originalFetch; });
await new Promise((ready, reject) => { server.once('error', reject); server.listen(PORT, HOST, ready); });
console.log(JSON.stringify({ status: 'ready', fixture: 'Synthetic QA — local in-memory data only', url: ORIGIN + '/hq', statusUrl: ORIGIN + '/__fixture/status', ids }));
function close() { server.close(() => { sqlite.close(); globalThis.fetch = originalFetch; }); server.closeAllConnections(); }
process.once('SIGINT', close);
process.once('SIGTERM', close);
