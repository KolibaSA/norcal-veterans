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

test('Events accepts only safe HTTPS event image URLs', () => {
  const base={start_at:'2030-01-15T18:00:00-08:00',venue:'Public hall'};
  assert.equal(validateEvent({...base,image_url:'https://images.example.org/event.jpg'}).image_url,'https://images.example.org/event.jpg');
  assert.throws(()=>validateEvent({...base,image_url:'http://images.example.org/event.jpg'}),/valid HTTPS event image URL/);
});

test('Events validates optional volunteer and donation actions', () => {
  const base={start_at:'2030-01-15T18:00:00-08:00',venue:'Public hall'};
  const event=validateEvent({...base,volunteer_enabled:true,volunteer_url:'https://example.org/volunteer',donate_enabled:true,donate_url:'https://example.org/donate'});
  assert.equal(event.volunteer_url,'https://example.org/volunteer');assert.equal(event.donate_url,'https://example.org/donate');
  assert.throws(()=>validateEvent({...base,volunteer_enabled:'yes'}),/volunteer option must be true or false/);
  assert.throws(()=>validateEvent({...base,donate_url:'http://example.org/donate'}),/valid HTTPS donation URL/);
});

test('Events validates and derives additional occurrences from the first date and time', () => {
  const timed=validateEvent({starts_local:'2026-11-07T10:00',ends_local:'2026-11-07T12:00',additional_dates:['2026-11-11','2026-11-08'],venue:'Public hall'});
  assert.deepEqual(timed.additional_occurrences,[
    {start_at:'2026-11-08T18:00:00.000Z',end_at:'2026-11-08T20:00:00.000Z'},
    {start_at:'2026-11-11T18:00:00.000Z',end_at:'2026-11-11T20:00:00.000Z'}
  ]);
  assert.equal(timed.additional_dates,undefined);
  const dayOnly=validateEvent({starts_local:'2026-11-07',date_only:true,additional_dates:['2026-11-08'],venue:'Public hall'});
  assert.deepEqual(dayOnly.additional_occurrences,[{start_at:'2026-11-08T08:00:00.000Z',end_at:null}]);
  assert.throws(()=>validateEvent({starts_local:'2026-11-07',date_only:true,additional_dates:['2026-11-07'],venue:'Public hall'}),/after the first event date/);
  assert.throws(()=>validateEvent({starts_local:'2026-11-07',date_only:true,additional_dates:['2026-02-30'],venue:'Public hall'}),/does not exist/);
});
