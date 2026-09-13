import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { db, req, envBase, token } from './legacy-test-helpers.mjs';
import worker from '../src/norcal-worker.mjs';

test('Super Admin grant has full HQ privileges, exact request approval and immediate revocation', async t => {
  const env = { ...envBase, DB: db(t) }, owner = env.OWNER_EMAIL, admin = 'admin@example.test';
  const grant = async (actor, email, role, scope = {}) => req(env, '/api/hq/access', actor, 'POST', { email, role, ...scope });
  const scoped = await grant(owner, admin, 'editor', { region_id: 'yolo-solano' });
  assert.equal(scoped.status, 201);
  assert.equal((await grant(admin, admin, 'super_admin')).status, 403);
  const forged = await token(admin, { owner: true, superAdmin: true, role: 'super_admin' });
  const forgedMe = await worker.fetch(new Request('https://site.test/api/hq/me', { headers: { 'Cf-Access-Jwt-Assertion': forged } }), env);
  assert.equal((await forgedMe.json()).superAdmin, false);
  for (const scope of [{ region_id: 'yolo-solano' }, { organization_id: 'fake' }]) assert.equal((await grant(owner, admin, 'super_admin', scope)).status, 400);
  const assigned = await grant(owner, admin.toUpperCase(), 'super_admin');
  assert.equal(assigned.status, 201); const { id: grantId } = await assigned.json();
  const identity = await (await req(env, '/api/hq/me', admin)).json();
  assert.equal(identity.owner, false); assert.equal(identity.superAdmin, true);
  for (const region of ['yolo-solano', 'sacramento']) {
    const response = await req(env, '/api/hq/records', admin, 'POST', { kind: 'organization', title: 'Synthetic ' + region, body: 'Synthetic public information', region_id: region, status: 'published', payload: { city: 'Davis', organization_type: 'VFW', location_county: 'Yolo' } });
    assert.equal(response.status, 201, await response.clone().text());
  }
  assert.equal((await (await req(env, '/api/hq/records?kind=organization', admin)).json()).length, 2);
  for (const path of ['access', 'audit', 'export', 'agent-health']) assert.equal((await req(env, '/api/hq/' + path, admin)).status, 200, path);
  const delegated = await grant(admin, 'another-admin@example.test', 'super_admin');
  assert.equal(delegated.status, 201);
  const created = await req(env, '/api/hq/records', admin, 'POST', { kind: 'request', title: 'Synthetic admin request', body: 'Synthetic instructions', region_id: 'all', status: 'queued', payload: { request_approval: { approved_by: owner, approved_version: 999 } } });
  assert.equal(created.status, 201); const { id: requestId } = await created.json();
  const row = env.DB.raw.prepare('SELECT * FROM records WHERE id=?').get(requestId);
  assert.deepEqual(JSON.parse(row.payload).request_approval, { approved_by: admin, approved_version: 1 });
  for (const actor of [admin, owner]) {
    assert.equal((await req(env, '/api/hq/requests/' + requestId + '/history', actor)).status, 200);
    assert.equal((await req(env, '/api/hq/requests/' + requestId + '/comments', actor, 'POST', { expected_version: 1, body: 'Synthetic comment' })).status, 201);
  }
  assert.equal((await req(env, '/api/hq/access/' + grantId, owner, 'DELETE')).status, 200);
  assert.equal((await (await req(env, '/api/hq/me', admin)).json()).superAdmin, false);
  for (const path of ['access', 'audit', 'export', 'agent-health', 'requests/' + requestId + '/history']) assert.equal((await req(env, '/api/hq/' + path, admin)).status, 403, path);
  assert.equal((await (await req(env, '/api/hq/records?kind=organization', admin)).json()).length, 1);
  assert.equal((await grant(admin, admin, 'super_admin')).status, 403);
  assert.equal((await (await req(env, '/api/hq/me', owner)).json()).owner, true);
  const audits = env.DB.raw.prepare("SELECT * FROM audit WHERE record_id=? ORDER BY created_at").all(grantId);
  assert.deepEqual(audits.map(row => row.action), ['grant', 'revoke']);
});

test('grant migration preserves all existing scoped assignments and enforces global-role constraints', t => {
  const raw = new DatabaseSync(':memory:'); t.after(() => raw.close());
  const migration = name => readFileSync(new URL('../migrations/legacy/' + name, import.meta.url), 'utf8');
  raw.exec(migration('0001_headquarters.sql'));
  raw.exec("INSERT INTO grants VALUES('regional','a@example.test','region_admin','yolo-solano',NULL),('org','b@example.test','organization_admin',NULL,'org-a'),('editor','c@example.test','editor','sacramento',NULL)");
  const before = raw.prepare('SELECT * FROM grants ORDER BY id').all();
  raw.exec(migration('0005_super_admin.sql'));
  assert.deepEqual(raw.prepare('SELECT * FROM grants ORDER BY id').all(), before);
  raw.exec("INSERT INTO grants VALUES('super','d@example.test','super_admin',NULL,NULL)");
  for (const values of ["'bad1','e@example.test','super_admin','region',NULL", "'bad2','e@example.test','editor',NULL,NULL", "'bad3','e@example.test','organization_admin','region',NULL"]) assert.throws(() => raw.exec('INSERT INTO grants VALUES(' + values + ')'), /CHECK/);
  assert.equal(raw.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
});
