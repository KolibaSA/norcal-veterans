import test from 'node:test';
import assert from 'node:assert/strict';
import { connectAttachments } from './browser.mjs';
import { controls, submitEvent } from '../../shared/browser-test-support.mjs';

test('attachment upload UI respects configured storage and record edit permission', () => {
  const context = { ...controls(), editing: null, me: { uploads: false }, api: async () => [], message() {} };
  const controller = connectAttachments(context);
  controller.editorOpened(null, { editable: true });
  assert.equal(context.$('fileForm').hidden, true); assert.equal(context.$('storageNote').hidden, false);
  context.me.uploads = true;
  controller.editorOpened(null, { editable: false });
  assert.equal(context.$('fileForm').hidden, true);
});

test('oversized attachment never reaches the API', async () => {
  let sent = false, notice;
  const context = { ...controls(), editing: { id: 'record-a' }, me: { uploads: true }, api: async () => { sent = true; }, message: text => { notice = text; } };
  connectAttachments(context); context.$('file').files = [{ size: 10 * 1024 * 1024 + 1 }];
  await context.$('fileForm').onsubmit(submitEvent());
  assert.equal(sent, false); assert.match(notice, /smaller than 10 MB/);
});

test('synthetic attachment uses multipart transport and retains the record ID', async () => {
  const calls = [], context = { ...controls(), editing: { id: 'record-a' }, me: { uploads: true }, message() {} };
  context.api = async (path, options) => { calls.push({ path, options }); return []; };
  connectAttachments(context);
  context.$('file').files = [new File(['synthetic'], 'fixture.txt', { type: 'text/plain' })];
  await context.$('fileForm').onsubmit(submitEvent());
  assert.equal(calls[0].path, 'attachments'); assert.equal(calls[0].options.body.get('record_id'), 'record-a');
  assert.equal(calls[0].options.body.get('file').name, 'fixture.txt');
  assert.equal(calls[1].path, 'attachments?record_id=record-a');
});
