import test from 'node:test';
import assert from 'node:assert/strict';
import { validateEvent } from './domain.mjs';

test('Events converts date-only entries to Pacific midnight and clears an end time', () => {
  const event = validateEvent({ starts_local: '2026-07-04', date_only: true, end_at: '2026-07-05T01:00:00Z', venue: 'Public hall' });
  assert.equal(event.start_at, '2026-07-04T07:00:00.000Z');
  assert.equal(event.end_at, null);
  assert.equal(event.starts_local, undefined);
});

test('Events rejects impossible or ambiguous Pacific times but preserves a previously exact instant', () => {
  const event = { venue: 'Public hall', starts_local: '2026-03-08T02:30' };
  assert.throws(() => validateEvent(event), /does not exist/);
  const fall = { ...event, starts_local: '2026-11-01T01:30' };
  assert.throws(() => validateEvent(fall), /occurs twice/);
  assert.equal(validateEvent(fall, { previousPayload: { start_at: '2026-11-01T09:30:00Z' } }).start_at, '2026-11-01T09:30:00.000Z');
});
