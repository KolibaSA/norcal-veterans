import test from 'node:test';
import assert from 'node:assert/strict';
import { handleAccessRoute } from './server.mjs';

test('Access administration rejects scoped identities and cross-origin writes before touching grants', async () => {
  const path = '/api/hq/access';
  assert.equal((await handleAccessRoute(new Request('https://hq.test' + path), {}, { owner: false }, path)).status, 403);
  const req = new Request('https://hq.test' + path, { method: 'POST', headers: { Origin: 'https://foreign.test' }, body: '{}' });
  assert.equal((await handleAccessRoute(req, {}, { owner: true }, path)).status, 403);
});

test('Access validates mutually exclusive assignments without writing to the database', async () => {
  const path = '/api/hq/access';
  for (const body of [
    { email: 'editor@example.com', role: 'editor' },
    { email: 'editor@example.com', role: 'editor', region_id: 'yolo-solano', organization_id: 'organization' },
    { email: 'editor@example.com', role: 'organization_admin', region_id: 'yolo-solano' }
  ]) {
    const req = new Request('https://hq.test' + path, { method: 'POST', headers: { Origin: 'https://hq.test' }, body: JSON.stringify(body) });
    assert.equal((await handleAccessRoute(req, {}, { owner: true }, path)).status, 400);
  }
});
