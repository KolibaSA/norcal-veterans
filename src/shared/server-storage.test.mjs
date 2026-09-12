import test from 'node:test';
import assert from 'node:assert/strict';
import { visibleRecord } from './server-storage.mjs';

test('Shared record serialization requires an explicit security policy and supplies it a decoded copy', () => {
  const row = { id: 'r', mutation_id: 'internal', payload: { useful: 'keep', secret: 'private' } };
  assert.throws(() => visibleRecord(row), /redaction policy is required/);
  const result = visibleRecord(row, payload => { delete payload.secret; return payload; });
  assert.deepEqual(result, { id: 'r', payload: { useful: 'keep' } });
  assert.equal(row.payload.secret, 'private');
});
