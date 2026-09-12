import test from 'node:test';
import assert from 'node:assert/strict';
import { connectHistory } from './browser.mjs';
import { controls, deferred } from '../../shared/browser-test-support.mjs';

test('audit rendering escapes saved actors and record IDs', async () => {
  const context = { ...controls(), api: async () => [{ actor: '<owner>', record_id: '<record>', action: 'record.updated' }] };
  await connectHistory(context).render({ isCurrent: () => true });
  assert.match(context.$('content').innerHTML, /&lt;owner&gt;/); assert.match(context.$('content').innerHTML, /&lt;record&gt;/);
  assert.doesNotMatch(context.$('content').innerHTML, /<owner>|<record>/);
});

test('revision results are scoped to the still-open record', async () => {
  const response = deferred(), context = { ...controls(), editing: { id: 'old' }, api: () => response.promise };
  connectHistory(context).editorOpened({ id: 'old' });
  context.editing = { id: 'new' }; context.$('revisions').innerHTML = 'Current revisions';
  response.resolve([{ record: { title: 'Stale', body: 'Stale' } }]);
  await response.promise; await Promise.resolve();
  assert.equal(context.$('revisions').innerHTML, 'Current revisions');
});
