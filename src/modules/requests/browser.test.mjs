import test from 'node:test';
import assert from 'node:assert/strict';
import { createFeature, connectRequests, healthDescription } from './browser.mjs';
import { controls, submitEvent, deferred } from '../../shared/browser-test-support.mjs';

function requestContext(api) {
  return { ...controls(), api, me: { owner: true }, tab: 'request',
    editing: { id: 'request-a', version: 4, status: 'queued', body: 'Unchanged executable instructions' },
    message() {}, permitLeave: () => true, openRecord() {}, loadSection() {}, itemURL: (_kind, id) => '/hq?item=' + id, markClean() {} };
}

test('request editing and queue authorization retain exact owner/run boundaries', () => {
  const feature = createFeature();
  assert.equal(feature.canEdit({ owner: false }, { status: 'queued' }), false);
  assert.equal(feature.canEdit({ owner: true }, { status: 'in_progress' }), false);
  assert.equal(feature.canEdit({ owner: true }, { status: 'needs_input' }), true);
  assert.equal(feature.statusesFor({ owner: true }, { status: 'queued' }).includes('in_progress'), false);
  assert.equal(feature.statusesFor({ owner: true }, { status: 'in_progress' }).includes('in_progress'), true);
  assert.match(feature.notice({}, { status: 'queued' }, true), /authorizes the agent/);
});

test('request editor captures target and organization-family scope without changing envelope scope', () => {
  const feature = createFeature();
  assert.equal(feature.openNewOnLoad, true);
  const fields = feature.fields({ kind: 'request', region_id: 'all', organization_id: null, status: 'queued',
    payload: { target: 'website', organization_scope: { type: 'VFW' } } });
  assert.equal(fields.requestTarget, 'website');
  assert.equal(fields.org, 'family:VFW');
  fields.requestTarget = 'headquarters';
  fields.org = 'family:American Legion';
  const payload = feature.payload(fields, { retained: true });
  assert.equal(payload.target, 'headquarters');
  assert.deepEqual(payload.organization_scope, { type: 'American Legion' });
  assert.equal(payload.retained, true);
  assert.equal(feature.organizationId(fields), null);
});

test('comments use the current activity revision and never rewrite instructions', async () => {
  const calls = [], activity = { version: 9, status: 'in_progress', entries: [{ kind: 'comment', body: '<img src=x onerror=alert(1)>', actor: '<owner>' }] };
  const context = requestContext(async (path, options) => { calls.push({ path, options }); return activity; });
  const controller = connectRequests(context), original = structuredClone(context.editing);
  await controller.loadActivity();
  context.$('commentBody').value = 'Owner clarification';
  await context.$('commentForm').onsubmit(submitEvent());
  const write = calls.find(call => call.options?.method === 'POST');
  assert.equal(write.path, 'requests/request-a/comments');
  assert.deepEqual(JSON.parse(write.options.body), { body: 'Owner clarification', expected_version: 9 });
  assert.deepEqual(context.editing, original);
  assert.match(context.$('activity').innerHTML, /&lt;img/);
  assert.doesNotMatch(context.$('activity').innerHTML, /<img/);
});

test('reconciliation binds the refreshed version, status and active run without replaying work', async () => {
  const calls = [], activity = { version: 10, status: 'in_progress', active_run: { id: 'run-current' }, entries: [] };
  const context = requestContext(async (path, options) => { calls.push({ path, options }); return activity; });
  let reopened;
  context.loadSection = async options => { reopened = options; };
  const controller = connectRequests(context);
  await controller.loadActivity();
  context.$('reconcileStatus').value = 'completed'; context.$('reconcileNote').value = 'Verified synthetic result.';
  await context.$('reconcileForm').onsubmit(submitEvent());
  const write = calls.find(call => call.options?.method === 'POST');
  assert.equal(write.path, 'requests/request-a/reconcile');
  assert.deepEqual(JSON.parse(write.options.body), { expected_version: 10, expected_status: 'in_progress', expected_run_id: 'run-current', status: 'completed', note: 'Verified synthetic result.' });
  assert.deepEqual(reopened, { item: 'request-a' });
});

test('late activity response cannot overwrite another opened request or its unsaved comment', async () => {
  const response = deferred(), context = requestContext(() => response.promise);
  const controller = connectRequests(context), pending = controller.loadActivity();
  context.editing = { id: 'request-b', version: 2, status: 'queued' };
  context.$('activity').innerHTML = 'Current request activity'; context.$('commentBody').value = 'Unsaved comment';
  response.resolve({ version: 10, status: 'completed', entries: [{ body: 'Old result' }] });
  await pending;
  assert.equal(context.$('activity').innerHTML, 'Current request activity');
  assert.equal(context.$('commentBody').value, 'Unsaved comment');
  assert.equal(controller.dirty(), true);
});

test('agent health stays owner-scoped and reports stale checks truthfully', async () => {
  let requests = 0;
  const context = requestContext(async () => { requests++; }); context.me.owner = false;
  await connectRequests(context).loadHealth();
  assert.equal(requests, 0);
  assert.match(context.$('processor').textContent, /platform owner/);
  assert.match(healthDescription({ configured: true, last_successful_check: '2026-09-12T19:00:00Z' }, Date.parse('2026-09-12T20:00:00Z')), /not checked recently/);
});
