import test from 'node:test';
import assert from 'node:assert/strict';
import { handleAttachments } from './server.mjs';
import { createDatabase, seedRecord } from '../../shared/testing/database.mjs';

test('Attachments retain scoped private listing and recovery downloads while uploads stay unavailable', async t => {
  const DB = createDatabase(t), recordId = seedRecord(DB);
  DB.raw.prepare("INSERT INTO attachments(id,record_id,filename,content_type,size,object_key,created_by,created_at) VALUES('file',?,'synthetic.txt','text/plain',9,'private-object','owner@example.com','2026-09-12T00:00:00Z')").run(recordId);
  const env = { DB, FILES: { async get(key) { assert.equal(key, 'private-object'); return { body: 'Synthetic' }; } } };
  const owner = { owner: true }, scoped = { owner: false, email: 'editor@example.com' };
  const grants = [{ email: scoped.email, role: 'editor', region_id: 'another-region' }];
  const read = async (path, user, assignments = []) => {
    const req = new Request('https://hq.test' + path);
    return handleAttachments(req, env, user, assignments, new URL(req.url));
  };
  const list = await read('/api/hq/attachments?record_id=' + recordId, owner);
  assert.deepEqual(await list.json(), [{ id: 'file', filename: 'synthetic.txt', size: 9 }]);
  assert.equal((await read('/api/hq/attachments/file', scoped, grants)).status, 404);
  const download = await read('/api/hq/attachments/file', owner);
  assert.equal(await download.text(), 'Synthetic');
  assert.equal(download.headers.get('Cache-Control'), 'private, no-store');
  assert.match(download.headers.get('Content-Disposition'), /attachment/);
  const req = new Request('https://hq.test/api/hq/attachments', { method: 'POST' });
  assert.equal((await handleAttachments(req, env, owner, [], new URL(req.url))).status, 503);
});
