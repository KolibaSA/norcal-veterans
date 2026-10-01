import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/norcal-worker.mjs';
import { db, envBase } from './legacy-test-helpers.mjs';

const site = 'https://www.norcalveterans.org';
const send = (path, env, method = 'GET', host = site) => worker.fetch(new Request(host + path, { method }), env);

test('canonical public redirects leave the root temporary and consolidate profile URLs', async () => {
  const root = await send('/', envBase);
  assert.equal(root.status, 302);
  assert.equal(root.headers.get('Location'), site + '/yolo-solano');
  const bare = await send('/organizations/legion-ca-77?source=local', envBase, 'GET', 'https://norcalveterans.org');
  assert.equal(bare.status, 301);
  assert.equal(bare.headers.get('Location'), site + '/organizations/legion-ca-77?source=local');
  const mcl = await send('/mcl-yolo', envBase);
  assert.equal(mcl.status, 301);
  assert.equal(mcl.headers.get('Location'), site + '/organizations/mcl-yolo');
  const bareMcl = await send('/mcl-yolo', envBase, 'GET', 'https://norcalveterans.org');
  assert.equal(bareMcl.status, 301);
  assert.equal(bareMcl.headers.get('Location'), site + '/organizations/mcl-yolo');
});

test('public sitemap uses published database records and staging never advertises production sitemap', async t => {
  const DB = db(t), env = { ...envBase, DB };
  const insert = DB.raw.prepare(`INSERT INTO records
    (id,kind,title,body,region_id,organization_id,status,payload,created_by,created_at,updated_at,mutation_id)
    VALUES(?,?,?,?,?,?,?,?,?,'2026-09-01','2026-09-01',?)`);
  insert.run('legion-ca-77','organization','Yolo American Legion Post 77','Public profile','yolo-solano','legion-ca-77','published','{}','owner@example.com','seed-org');
  insert.run('draft-org','organization','Draft organization','Draft profile','yolo-solano','draft-org','draft','{}','owner@example.com','seed-draft');
  insert.run('army-navy','event','Army-Navy Watch Party','Watch the game.','yolo-solano','legion-ca-77','published',
    JSON.stringify({start_at:'2026-12-12T23:00:00Z',venue:'Legion hall'}),'owner@example.com','seed-event');
  insert.run('draft-event','event','Private event','Private draft','yolo-solano','legion-ca-77','draft',
    JSON.stringify({start_at:'2026-12-12T23:00:00Z',venue:'Legion hall'}),'owner@example.com','seed-private-event');
  const response = await send('/sitemap.xml', env);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('Content-Type'), /application\/xml/);
  const xml = await response.text();
  assert.match(xml, /\/organizations\/legion-ca-77<\/loc>/);
  assert.match(xml, /\/events\/army-navy<\/loc>/);
  assert.doesNotMatch(xml, /draft-org|draft-event|\/hq|\/api\//);
  assert.equal((await send('/sitemap.xml', env, 'HEAD')).status, 200);
  assert.equal(await (await send('/sitemap.xml', env, 'HEAD')).text(), '');
  const robots = await send('/robots.txt', env);
  assert.equal(robots.status, 200);
  assert.match(await robots.text(), /Sitemap: https:\/\/www\.norcalveterans\.org\/sitemap\.xml/);
  const staging = { ...env, STAGING: 'true' };
  const stagingRobots = await send('/robots.txt', staging, 'GET', 'https://norcal-veterans-staging.sterling-koliba.workers.dev');
  assert.match(stagingRobots.headers.get('X-Robots-Tag'), /noindex/);
  assert.doesNotMatch(await stagingRobots.text(), /Sitemap:/);
});
