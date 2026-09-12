import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRequestRoute } from './server.mjs';
import { recordDefinition, redactPayload, stripEditorCredentials } from './domain.mjs';

const owner = { owner: true, email: 'owner@example.com' };
const env = { OWNER_EMAIL: owner.email };
const comment = (headers, body = '{}') => new Request('https://hq.test/api/hq/requests/r/comments', { method: 'POST', headers, body });

test('Requests rejects writes outside the owner and same-origin boundary before database access', async () => {
  assert.equal((await handleRequestRoute(comment({ Origin: 'https://elsewhere.test' }), env, owner)).status, 403);
  assert.equal((await handleRequestRoute(comment({}), env, owner)).status, 403);
  assert.equal((await handleRequestRoute(comment({ Origin: 'https://hq.test' }), env, { ...owner, owner: false })).status, 403);
  assert.equal((await handleRequestRoute(comment({ Origin: 'https://hq.test' }), env, { owner: true, email: 'another@example.com' })).status, 403);
});

test('Requests bounds a chunked body at its supported interface, without a caller-supplied JSON parser', async () => {
  let cancelled = false, reads = 0;
  const body = new ReadableStream({
    pull(controller) { reads++; controller.enqueue(new Uint8Array(60000)); },
    cancel() { cancelled = true; }
  }, { highWaterMark: 0 });
  const req = new Request('https://hq.test/api/hq/requests/r/comments', { method: 'POST', duplex: 'half', headers: { Origin: 'https://hq.test' }, body });
  const context = { ...env, DB: { prepare() { return { bind() { return this; }, async first() { return { id: 'r', version: 1 }; } }; } } };
  await assert.rejects(() => handleRequestRoute(req, context, owner), error => error.status === 413);
  assert.equal(cancelled, true);
  assert.equal(reads, 2);
});

test('Requests records approval for the next exact revision and retains the existing execution metadata', () => {
  const prior = { norcal_hq_agent: { state: 'completed', run_id: 'existing' } };
  const next = recordDefinition.authorizePayload({}, { previous: prior, status: 'queued', version: 7, user: owner });
  assert.deepEqual(next.request_approval, { approved_by: owner.email, approved_version: 7 });
  assert.deepEqual(next.norcal_hq_agent, prior.norcal_hq_agent);
  assert.throws(() => recordDefinition.authorizeSave({ user: { owner: false } }), error => error.status === 403);
});

test('Requests exposes distinct editor sanitization and display redaction policies without discarding run state', () => {
  const payload = { useful: 'keep', request_approval: { approved_version: 1 }, norcal_hq_agent: { claim_token: 'private-token', run_id: 'run', state: 'completed' } };
  assert.deepEqual(stripEditorCredentials(structuredClone(payload)), { useful: 'keep' });
  assert.deepEqual(redactPayload(structuredClone(payload)), { useful: 'keep', norcal_hq_agent: { run_id: 'run', state: 'completed' } });
});
