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
  context.api = async (path, options) => { calls.push({ path, options }); return [{ id: 'grant-a', email: '<owner>', role: 'editor', region_id: 'yolo-solano' }]; };
  await connectAccess(context).render({ isCurrent: () => true });
  assert.match(context.$('content').innerHTML, /&lt;owner&gt;/);
  context.$('email').value = 'editor@example.org'; context.$('role').value = 'organization_admin';
  context.$('scopeType').value = 'organization'; context.$('scopeValue').value = 'org-existing';
  await context.$('grant').onsubmit(submitEvent());
  const call = calls.find(value => value.options?.method === 'POST');
  assert.equal(call.path, 'access');
  assert.deepEqual(JSON.parse(call.options.body), { email: 'editor@example.org', role: 'organization_admin', organization_id: 'org-existing' });
});

test('access response from an abandoned tab cannot replace current content', async () => {
  const context = { ...controls(), me: { owner: true }, api: async () => [], message() {}, loadSection() {} };
  context.$('content').innerHTML = 'Current feature';
  await connectAccess(context).render({ isCurrent: () => false });
  assert.equal(context.$('content').innerHTML, 'Current feature');
});
