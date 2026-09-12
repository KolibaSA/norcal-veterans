import test from 'node:test';
import assert from 'node:assert/strict';
import { recordDefinition } from './domain.mjs';

test("Project Work keeps assignment and due dates with a private task", () => {
  const payload = {"assigned_to":"owner@example.com","due_at":"2026-10-01T16:00:00Z","custom":{"detail":"keep"}};
  assert.deepEqual(recordDefinition.validate(payload), payload);
  assert.throws(() => recordDefinition.validate({"due_at":"2026-10-01T09:00"}), /explicit timezone/);
});
