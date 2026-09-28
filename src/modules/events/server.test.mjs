import test from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase } from '../../shared/testing/database.mjs';
import { norcalPublicData } from '../../app/public-content.mjs';
import { eventsPagePublic, eventDetail } from './public.mjs';
import { handleInvitationRoute } from './server.mjs';
import { recordDefinition } from './domain.mjs';
import { handleRecordRoute } from '../../app/hq-records.mjs';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

const origin = 'https://example.test';
const owner = { email: 'owner@example.test', owner: true };
const host = { email: 'host@example.test', owner: false };
const vfw = { email: 'vfw@example.test', owner: false };
const mcl = { email: 'mcl@example.test', owner: false };
const grant = (email, organization_id) => ({ email, organization_id, region_id: null, role: 'organization_admin' });
const hostGrant = grant(host.email, 'legion-ca-77');
const vfwGrant = grant(vfw.email, 'vfw-ca-8151');
const mclGrant = grant(mcl.email, 'mcl-yolo');
const org = (DB, id, title) => DB.raw.prepare(`INSERT INTO records
  (id,kind,title,body,region_id,status,payload,created_by,created_at,updated_at,mutation_id)
  VALUES(?,'organization',?,'', 'yolo-solano','published','{}','owner@example.test','2026-09-01','2026-09-01',?)`)
  .run(id, title, 'seed-' + id);
function seed(DB) {
  org(DB, 'legion-ca-77', 'Yolo American Legion Post 77');
  org(DB, 'vfw-ca-8151', 'Dixon VFW Post 8151');
  org(DB, 'mcl-yolo', 'Marine Corps League - Yolo County Detachment 627');
  DB.raw.prepare(`INSERT INTO records
    (id,kind,title,body,region_id,organization_id,status,payload,created_by,created_at,updated_at,mutation_id)
    VALUES(?,'event',?,'Watch the game together.','yolo-solano','legion-ca-77','published',?,'owner@example.test','2026-09-01','2026-09-01','seed-event')`)
    .run('legion-77-army-navy-2026', 'Army-Navy Game Watch Party', JSON.stringify({
      start_at: '2099-12-12T23:00:00Z', venue: 'American Legion Post 77, Woodland, CA', city: 'Woodland', county: 'Yolo',
      organizer: 'Yolo American Legion Post 77', audience: 'Veterans and families' }));
}
async function request(DB, user, grants, input = null, eventId = '') {
  const url = origin + '/api/hq/event-invitations' + (eventId ? '?event_id=' + eventId : '');
  const req = new Request(url, input ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) } : {});
  const response = await handleInvitationRoute(req, { DB }, user, grants);
  return { status: response.status, body: await response.json() };
}
const action = (recipient_org_id, action, extra = {}) => ({ event_id: 'legion-77-army-navy-2026', recipient_org_id, action, ...extra });

test('invitations stay private until recipients say Going, then update card and details', async t => {
  const DB = createDatabase(t); seed(DB);
  const inviteVfw = await request(DB, host, [hostGrant], action('vfw-ca-8151', 'invite'));
  const inviteMcl = await request(DB, host, [hostGrant], action('mcl-yolo', 'invite'));
  assert.equal(inviteVfw.status, 200); assert.equal(inviteMcl.status, 200);
  assert.equal((await request(DB, host, [hostGrant], action('vfw-ca-8151', 'invite'))).status, 409);
  assert.equal((await request(DB, vfw, [vfwGrant], action('vfw-ca-8151', 'respond', { response: 'accepted', version: 8 }))).status, 409);
  let live = await norcalPublicData(DB);
  let html = eventsPagePublic(new URL(origin + '/events'), live.events, live.records);
  assert.doesNotMatch(html, /Going:/);
  assert.equal((await request(DB, host, [hostGrant], action('vfw-ca-8151', 'respond', { response: 'accepted', version: 1 }))).status, 403);
  assert.equal((await request(DB, mcl, [mclGrant], action('vfw-ca-8151', 'respond', { response: 'accepted', version: 1 }))).status, 403);
  assert.equal((await request(DB, vfw, [vfwGrant], action('vfw-ca-8151', 'respond', { response: 'accepted', version: 1 }))).status, 200);
  assert.equal((await request(DB, mcl, [mclGrant], action('mcl-yolo', 'respond', { response: 'accepted', version: 1 }))).status, 200);
  live = await norcalPublicData(DB);
  html = eventsPagePublic(new URL(origin + '/events'), live.events, live.records);
  assert.match(html, /Going:.*Dixon VFW Post 8151.*Marine Corps League - Yolo County Detachment 627/s);
  assert.match(eventDetail(live.events[0], live.records), /Organizations going.*Dixon VFW Post 8151.*Marine Corps League - Yolo County Detachment 627/s);
  assert.equal((await request(DB, vfw, [vfwGrant], action('mcl-yolo', 'respond', { response: 'declined', version: 2 }))).status, 403);
  assert.equal((await request(DB, vfw, [vfwGrant], action('vfw-ca-8151', 'respond', { response: 'declined', version: 2 }))).status, 200);
  live = await norcalPublicData(DB);
  assert.deepEqual(live.events[0].accepted_organization_ids, ['mcl-yolo']);
  assert.equal((await request(DB, host, [hostGrant], action('mcl-yolo', 'withdraw', { version: 2 }))).status, 200);
  live = await norcalPublicData(DB);
  assert.deepEqual(live.events[0].accepted_organization_ids, []);
  DB.raw.prepare("UPDATE records SET status='draft' WHERE id='legion-77-army-navy-2026'").run();
  assert.equal((await norcalPublicData(DB)).events.some(event => event.id === 'legion-77-army-navy-2026'), false);
  DB.raw.prepare("DELETE FROM records WHERE id='legion-77-army-navy-2026'").run();
  assert.equal(DB.raw.prepare('SELECT COUNT(*) AS n FROM organization_event_invitations').get().n, 0);
});

test('scope, offline confirmation, and canonical participant data are enforced', async t => {
  const DB = createDatabase(t); seed(DB);
  const regionAdmin = { email: 'region@example.test', owner: false };
  const regionGrant = { email: regionAdmin.email, organization_id: null, region_id: 'yolo-solano', role: 'region_admin' };
  assert.equal((await request(DB, regionAdmin, [regionGrant], action('vfw-ca-8151', 'invite'))).status, 403);
  assert.equal((await request(DB, vfw, [vfwGrant], action('mcl-yolo', 'invite'))).status, 403);
  assert.equal((await request(DB, host, [hostGrant], action('legion-ca-77', 'invite'))).status, 400);
  DB.raw.prepare(`INSERT INTO records(id,kind,title,body,region_id,status,payload,created_by,created_at,updated_at,mutation_id)
    VALUES('other-region-org','organization','Other region','', 'sacramento','published','{}','owner@example.test','2026-09-01','2026-09-01','seed-other')`).run();
  assert.equal((await request(DB, host, [hostGrant], action('other-region-org', 'invite'))).status, 400);
  assert.equal((await request(DB, host, [hostGrant], action('vfw-ca-8151', 'invite'))).status, 200);
  assert.equal((await request(DB, owner, [], action('vfw-ca-8151', 'respond', { response: 'accepted', version: 1 }))).status, 400);
  assert.equal((await request(DB, owner, [], action('vfw-ca-8151', 'respond', { response: 'accepted', version: 1, note: 'Confirmed by the post commander.' }))).status, 200);
  const invite = DB.raw.prepare("SELECT decision_note FROM organization_event_invitations WHERE event_id='legion-77-army-navy-2026'").get();
  assert.equal(invite.decision_note, 'Confirmed by the post commander.');
  assert.equal(DB.raw.prepare("SELECT count(*) AS n FROM audit WHERE action LIKE 'event_accepted:%:offline'").get().n, 1);
  assert.equal((await request(DB, vfw, [vfwGrant], null, 'legion-77-army-navy-2026')).body.invitations.length, 1);
  assert.equal((await request(DB, mcl, [mclGrant], null, 'legion-77-army-navy-2026')).status, 404);
  assert.equal((await request(DB, host, [hostGrant], null, 'legion-77-army-navy-2026')).body.can_invite, true);
  assert.deepEqual(recordDefinition.authorizePayload({ accepted_organization_ids: ['mcl-yolo'], venue: 'Hall' }), { venue: 'Hall' });
});

test('a newly created host event can invite, while the host cannot answer for the recipient', async t => {
  const DB = createDatabase(t); seed(DB);
  const req = new Request(origin + '/api/hq/records', { method: 'POST', headers: {
    Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'event',
    title: 'New host event', body: 'A new community event.', region_id: 'yolo-solano',
    organization_id: 'legion-ca-77', status: 'draft', payload: {
      start_at: '2099-12-13T23:00:00Z', venue: 'American Legion Post 77, Woodland, CA',
      accepted_organization_ids: ['vfw-ca-8151'] } }) });
  const saved = await handleRecordRoute(req, { DB }, host, [hostGrant]);
  assert.equal(saved.status, 201);
  const { id } = await saved.json();
  assert.ok(id);
  assert.equal(DB.raw.prepare('SELECT payload FROM records WHERE id=?').get(id).payload.includes('accepted_organization_ids'), false);
  assert.equal((await request(DB, host, [hostGrant], { event_id: id, recipient_org_id: 'vfw-ca-8151', action: 'invite' })).status, 200);
  assert.equal((await request(DB, host, [hostGrant], { event_id: id, recipient_org_id: 'vfw-ca-8151', action: 'respond', response: 'accepted', version: 1 })).status, 403);
  assert.equal((await request(DB, vfw, [vfwGrant], { event_id: id, recipient_org_id: 'vfw-ca-8151', action: 'respond', response: 'accepted', version: 1 })).status, 200);
  assert.equal((await norcalPublicData(DB)).events.some(event => event.id === id), false);
});

test('additive migration preserves existing accepted organizations as canonical invitations', () => {
  const raw = new DatabaseSync(':memory:');
  try {
    for (let n = 1; n <= 6; n++) {
      const name = ['0001_headquarters.sql','0002_request_runs.sql','0003_record_revisions.sql',
        '0004_vfw_8151_meeting_plan.sql','0005_super_admin.sql','0006_clerk_identities.sql'][n - 1];
      raw.exec(readFileSync(new URL('../../../migrations/legacy/' + name, import.meta.url), 'utf8'));
    }
    const insert = raw.prepare(`INSERT INTO records(id,kind,title,body,region_id,organization_id,status,payload,created_by,created_at,updated_at,mutation_id)
      VALUES(?,?,?,'','yolo-solano',?,'published',?,'owner@example.test','2026-09-01','2026-09-01',?)`);
    insert.run('legion-ca-77','organization','Legion 77',null,'{}','seed-1');
    insert.run('vfw-ca-8151','organization','VFW 8151',null,'{}','seed-2');
    insert.run('legion-77-army-navy-2026','event','Watch party','legion-ca-77',
      JSON.stringify({ accepted_organization_ids: ['vfw-ca-8151'] }), 'seed-3');
    raw.exec(readFileSync(new URL('../../../migrations/legacy/0007_event_invitations.sql', import.meta.url), 'utf8'));
    const rows = raw.prepare('SELECT recipient_org_id,status FROM organization_event_invitations').all();
    assert.deepEqual(rows.map(row => ({ ...row })), [{ recipient_org_id: 'vfw-ca-8151', status: 'accepted' }]);
    assert.deepEqual(raw.prepare('PRAGMA foreign_key_check').all(), []);
  } finally { raw.close(); }
});
