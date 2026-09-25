import test from 'node:test';
import assert from 'node:assert/strict';
import { createFeature, connectRequests, healthDescription } from './browser.mjs';
import { controls, submitEvent, deferred } from '../../shared/browser-test-support.mjs';
import { recordInput } from '../../shared/browser-runtime.mjs';

test('Super Admin sees request creation and editing while active execution stays locked', () => {
  const feature = createFeature(), admin = { owner: false, superAdmin: true };
  assert.equal(feature.canCreate(admin), true);
  assert.equal(feature.canEdit(admin, { status: 'queued' }), true);
  assert.equal(feature.canEdit(admin, { status: 'in_progress' }), false);
  assert.equal(feature.canCreate({ owner: false, superAdmin: false }), false);
});

test('retired agent hides health and performs no polling while preserving manual Requests', async () => {
  const context = requestContext(async () => { throw new Error('Retired agent must not fetch health'); });
  context.me.processorConnected = false;
  const controller = connectRequests(context);
  controller.sectionChanged(); controller.initialized(); await controller.loadHealth();
  assert.equal(context.$('processor').hidden, true);
  assert.match(createFeature().notice(context.me, { status: 'queued' }, true), /tracked manually/);
  assert.equal(createFeature().canCreate(context.me), true);
});

function scopeEditor(record = { kind: 'request', region_id: 'yolo-solano' }) {
  const feature = createFeature(), context = controls(), fields = feature.fields(record);
  feature.configureEditor({ ...context, record, values: fields });
  for (const [id, value] of Object.entries(fields)) {
    if (typeof value === 'boolean') context.$(id).checked = value;
    else context.$(id).value = value;
  }
  const input = () => recordInput(Object.fromEntries(Object.entries(fields).map(([id, value]) =>
    [id, typeof value === 'boolean' ? context.$(id).checked : context.$(id).value])), 'request', feature, record.id ? record : null);
  return { ...context, feature, input };
}

test('switching a new website request to HQ clears both envelope and family scope before saving', () => {
  const { $, input } = scopeEditor();
  assert.equal($('region').value, 'all');
  assert.equal($('regionField').hidden, true);
  $('requestTarget').value = 'website'; $('requestTarget').onchange();
  assert.equal($('regionField').hidden, false);
  assert.equal($('requestScopeOption').hidden, true);
  $('region').value = 'yolo-solano'; $('org').value = 'family:American Legion';
  $('requestTarget').value = 'headquarters'; $('requestTarget').onchange();
  assert.equal($('requestScopeSummary').textContent, 'Entire HQ');
  assert.equal($('regionField').hidden, true);
  assert.equal($('organizationScopeField').hidden, true);
  assert.equal($('requestLimitScope').checked, false);
  const saved = input();
  assert.equal(saved.kind, 'request'); assert.equal(saved.status, 'queued');
  assert.equal(saved.region_id, 'all'); assert.equal(saved.organization_id, null);
  assert.deepEqual(saved.payload, { target: 'headquarters' });
});

test('HQ scope can be explicitly limited and removing the limit clears a specific organization', () => {
  const { $, input, feature } = scopeEditor();
  $('requestTarget').value = 'headquarters'; $('requestTarget').onchange();
  $('requestLimitScope').checked = true; $('requestLimitScope').onchange();
  assert.equal($('regionField').hidden, false);
  assert.equal($('organizationScopeField').hidden, false);
  $('region').value = 'yolo-solano'; $('org').value = 'synthetic-organization';
  assert.equal(input().organization_id, 'synthetic-organization');
  assert.equal(input().region_id, 'yolo-solano');
  $('requestLimitScope').checked = false; $('requestLimitScope').onchange();
  assert.equal(input().region_id, 'all'); assert.equal(input().organization_id, null);
  assert.equal($('requestScopeSummary').hidden, false);
  assert.deepEqual(feature.payload({ requestTarget: 'headquarters', requestLimitScope: false, org: 'family:VFW' },
    { retained: true, organization_scope: { type: 'VFW' } }), { retained: true, target: 'headquarters' });
});

test('Let Chat decide has optional scope and Public website always shows scope fields', () => {
  const { $, input } = scopeEditor();
  assert.equal($('requestTarget').value, 'decide');
  assert.equal($('requestScopeOption').hidden, false);
  assert.equal($('requestLimitScope').checked, false);
  $('requestLimitScope').checked = true; $('requestLimitScope').onchange();
  $('region').value = 'sacramento'; $('org').value = 'family:VFW';
  assert.deepEqual(input().payload, { target: 'decide', organization_scope: { type: 'VFW' } });
  $('requestTarget').value = 'website'; $('requestTarget').onchange();
  assert.equal($('regionField').hidden, false);
  assert.equal($('requestScopeOption').hidden, true);
  assert.equal(input().region_id, 'sacramento');
  $('requestTarget').value = 'decide'; $('requestTarget').onchange();
  assert.equal($('requestLimitScope').checked, true);
  $('requestLimitScope').checked = false; $('requestLimitScope').onchange();
  assert.deepEqual(input().payload, { target: 'decide' });
  assert.equal(input().region_id, 'all');
});

test('reopening and retargeting an existing request preserves its saved scope and version', () => {
  const record = { id: 'saved-request', kind: 'request', region_id: 'yolo-solano', organization_id: null,
    status: 'needs_input', version: 4, payload: { target: 'website', organization_scope: { type: 'American Legion' } } };
  const { $, input } = scopeEditor(record);
  $('requestTarget').value = 'headquarters'; $('requestTarget').onchange();
  assert.equal($('requestLimitScope').disabled, true);
  assert.equal($('requestLimitScope').checked, true);
  assert.equal($('regionField').hidden, false);
  assert.equal(input().region_id, record.region_id);
  assert.deepEqual(input().payload.organization_scope, record.payload.organization_scope);
  assert.equal(input().version, 4);
  const entireHQ = scopeEditor({ ...record, region_id: 'all', payload: { target: 'headquarters' } });
  assert.equal(entireHQ.$('regionField').hidden, true);
  assert.equal(entireHQ.input().region_id, 'all');
});

test('leaving Requests restores shared scope controls for other editors and preserves health lifecycle', () => {
  const context = requestContext(async () => ({})), controller = connectRequests(context);
  context.$('regionField').hidden = true; context.$('organizationScopeField').hidden = true;
  context.tab = 'event'; controller.sectionChanged();
  assert.equal(context.$('regionField').hidden, false);
  assert.equal(context.$('organizationScopeField').hidden, false);
  assert.equal(context.$('processor').hidden, true);
});

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
