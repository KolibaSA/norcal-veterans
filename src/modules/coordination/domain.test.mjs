import test from 'node:test';
import assert from 'node:assert/strict';
import { recordDefinition } from './domain.mjs';

test("Coordination retains organization links and private planning metadata", () => {
  const payload = {"organization_ids":["org-a","org-b"],"custom":{"detail":"keep"}};
  assert.deepEqual(recordDefinition.validate(payload), payload);
  assert.throws(() => recordDefinition.validate({"organization_ids":["org-a",42]}), /invalid entry/);
});
