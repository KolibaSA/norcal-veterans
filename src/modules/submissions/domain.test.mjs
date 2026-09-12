import test from 'node:test';
import assert from 'node:assert/strict';
import { recordDefinition } from './domain.mjs';

test("Submission review retains the original contribution and review metadata", () => {
  const payload = {"category":"program","source_url":"https://example.test/program","custom":{"detail":"keep"}};
  assert.deepEqual(recordDefinition.validate(payload), payload);
  assert.throws(() => recordDefinition.validate({"tags":["valid",""]}), /invalid entry/);
});
