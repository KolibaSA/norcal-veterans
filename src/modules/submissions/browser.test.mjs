import test from 'node:test';
import assert from 'node:assert/strict';
import { submissionDraft, connectSubmissions } from './browser.mjs';
import { controls } from '../../shared/browser-test-support.mjs';

test('submission conversion transfers only public description and provenance into an unpublished draft', () => {
  const record = { id: 'intake-a', title: 'Program lead', body: 'Private contact details', region_id: 'yolo-solano', organization_id: 'org-a', payload: { email: 'private@example.org' } };
  for (const kind of ['event', 'organization']) {
    const draft = submissionDraft(record, kind);
    assert.equal(draft.status, 'draft'); assert.equal(draft.body, '');
    assert.equal(draft.payload.intake_submission_id, 'intake-a'); assert.equal(draft.payload.email, undefined);
    assert.equal(draft.organization_id, kind === 'event' ? 'org-a' : null);
  }
  assert.throws(() => submissionDraft(record, 'request'), /Choose an event or organization/);
});

test('draft preparation honors unsaved-change guard and uses shell composition without saving', async () => {
  const context = { ...controls(), editing: { id: 'source', title: '<Source>', body: '<private>' }, permitLeave: () => false, message() {} };
  const drafts = []; context.openDraft = async (...args) => drafts.push(args);
  const controller = connectSubmissions(context);
  await context.$('draftEvent').onclick(); assert.equal(drafts.length, 0);
  context.permitLeave = () => true;
  // A fresh controller receives the changed guard (dependencies are immutable per connection).
  connectSubmissions(context);
  await context.$('draftEvent').onclick(); assert.equal(drafts[0][0], 'event');
  controller.editorOpened(null, { source: context.editing });
  assert.match(context.$('submissionSource').innerHTML, /&lt;private&gt;/);
  assert.doesNotMatch(context.$('submissionSource').innerHTML, /<private>/);
});
