import test from 'node:test';
import assert from 'node:assert/strict';
import { connectAccess } from './browser.mjs';
import { controls, submitEvent } from '../../shared/browser-test-support.mjs';

test('access administration refuses non-owners before requesting protected assignments', async () => {
  let calls = 0;
  const context = { ...controls(), me: { owner: false }, api: async () => { calls++; }, message() {}, loadSection() {} };
  await assert.rejects(connectAccess(context).render({ isCurrent: () => true }), /Only the platform owner/);
  assert.equal(calls, 0);
});

test('access assignment posts only the selected scope and retains escaped administrator labels', async () => {
  const calls = [], context = { ...controls(), me: { owner: true }, message() {}, loadSection() {} };
  context.$('org').dataset.organizationOptions = JSON.stringify([{ id: 'org-existing', title: '<Example>' }]);
  context.api = async (path, options) => { calls.push({ path, options }); return [{ id: 'grant-a', email: '<owner>', role: 'editor', region_id: 'yolo-solano' }]; };
  await connectAccess(context).render({ isCurrent: () => true });
  assert.match(context.$('content').innerHTML, /&lt;owner&gt;/);
  context.$('email').value = 'editor@example.org'; context.$('role').value = 'organization_admin';
  context.$('role').onchange(); context.$('scopeValue').value = 'org-existing';
  await context.$('grant').onsubmit(submitEvent());
  const call = calls.find(value => value.options?.method === 'POST');
  assert.equal(call.path, 'access');
  assert.deepEqual(JSON.parse(call.options.body), { email: 'editor@example.org', role: 'organization_admin', organization_id: 'org-existing' });
});

test('access assignment offers region and organization choices and binds role-required scope', async () => {
  const { $, elements } = controls(), context = { $, me: { owner: true }, message() {}, loadSection() {}, api: async () => [] };
  $('org').dataset.organizationOptions = JSON.stringify([{ id: 'org-a', title: 'Alpha & Sons' }]);
  $('role').value = 'region_admin'; $('scopeType').value = 'region';
  await connectAccess(context).render({ isCurrent: () => true });
  assert.match($('scopeValue').innerHTML, /Yolo-Solano/);
  assert.equal($('scopeType').disabled, true);
  $('role').value = 'editor'; $('role').onchange(); $('scopeType').value = 'organization'; $('scopeType').onchange();
  assert.equal($('scopeType').disabled, false);
  assert.match($('scopeValue').innerHTML, /Alpha &amp; Sons/);
  assert.ok(elements.has('scopeHelp'));
});

test('access response from an abandoned tab cannot replace current content', async () => {
  const context = { ...controls(), me: { owner: true }, api: async () => [], message() {}, loadSection() {} };
  context.$('content').innerHTML = 'Current feature';
  await connectAccess(context).render({ isCurrent: () => false });
  assert.equal(context.$('content').innerHTML, 'Current feature');
});

test('Super Admin uses global scope, posts no stale scope, and restores scoped editing', async () => {
  const calls = [], context = { ...controls(), me: { owner: false, superAdmin: true }, message() {}, loadSection() {} };
  context.api = async (path, options) => { calls.push({ path, options }); return [{ id: 'global', email: 'admin@example.test', role: 'super_admin' }]; };
  await connectAccess(context).render({ isCurrent: () => true });
  const { $ } = context;
  assert.match($('content').innerHTML, /Super Admin/);
  assert.match($('content').innerHTML, /All HQ, regions and organizations/);
  $('email').value = 'new-admin@example.test'; $('role').value = 'super_admin'; $('role').onchange();
  assert.equal($('scopeType').value, 'global');
  assert.equal($('scopeValue').disabled, true); assert.equal($('scopeValue').required, false);
  assert.match($('scopeHelp').textContent, /including other Super Admins/);
  await $('grant').onsubmit(submitEvent());
  assert.deepEqual(JSON.parse(calls.find(call => call.options?.method === 'POST').options.body), { email: 'new-admin@example.test', role: 'super_admin' });
  $('role').value = 'editor'; $('role').onchange();
  assert.equal($('scopeType').value, 'region');
  assert.equal($('scopeType').disabled, false); assert.equal($('scopeValue').disabled, false); assert.equal($('scopeValue').required, true);
});
