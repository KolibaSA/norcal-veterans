import test from 'node:test';
import assert from 'node:assert/strict';
import { createFeature } from './browser.mjs';
import { controls } from '../../shared/browser-test-support.mjs';

test('overview composes injected feature lists and counts only open work', async () => {
  const context = { ...controls(), api() {}, navigate() {} };
  const sources = [
    { list: async () => [{ status: 'queued', body: 'private instructions' }, { status: 'cancelled' }, { status: 'completed' }] },
    { list: async () => [{ status: 'open' }, { status: 'in_progress' }, { status: 'closed' }] },
    { list: async () => [{}, {}, {}] }
  ];
  await createFeature(sources).connect(context).render({ isCurrent: () => true });
  assert.match(context.$('content').innerHTML, /<b>1<\/b>Open requests/);
  assert.match(context.$('content').innerHTML, /<b>2<\/b>Project items/);
  assert.match(context.$('content').innerHTML, /<b>3<\/b>Organization profiles/);
  assert.doesNotMatch(context.$('content').innerHTML, /private instructions/);
});

test('an abandoned overview does not overwrite a newly selected section', async () => {
  const context = { ...controls(), api() {}, navigate() {} }; context.$('content').innerHTML = 'Current section';
  await createFeature([1, 2, 3].map(() => ({ list: async () => [] }))).connect(context).render({ isCurrent: () => false });
  assert.equal(context.$('content').innerHTML, 'Current section');
});
