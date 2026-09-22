import test from 'node:test';
import assert from 'node:assert/strict';
import { createFeature, eventDateList, eventFields, eventPayload, pacificInput, updateDateFields } from './browser.mjs';
import { controls } from '../../shared/browser-test-support.mjs';

test('event form preserves Pacific day boundaries and unknown payload evidence', () => {
  const record = { title: 'Winter meeting', body: 'Public details', payload: { start_at: '2026-12-04T02:00:00Z', end_at: '2026-12-04T04:00:00Z', image_url:'https://images.example.org/winter.jpg', volunteer_enabled:true, volunteer_url:'https://example.org/volunteer', donate_enabled:true, donate_url:'https://example.org/donate', provenance: { verified: false } } };
  const fields = createFeature().fields(record), result = eventPayload(fields, record.payload);
  assert.equal(fields.start, '2026-12-03T18:00'); assert.equal(fields.end, '2026-12-03T20:00');
  assert.equal(result.starts_local, '2026-12-03T18:00');
  assert.equal(fields.eventImage,'https://images.example.org/winter.jpg');assert.equal(result.image_url,fields.eventImage);
  assert.equal(fields.eventVolunteer,true);assert.equal(result.volunteer_url,'https://example.org/volunteer');
  assert.equal(fields.eventDonate,true);assert.equal(result.donate_url,'https://example.org/donate');
  assert.deepEqual(result.provenance, { verified: false });
  assert.equal(pacificInput('2026-07-12T19:30:00Z'), '2026-07-12T12:30');
  assert.equal(pacificInput('invalid'), '');
});

test('date-only transitions preserve the displayed day and omit an old timed ending', () => {
  const { $ } = controls();
  $('dateOnly').checked = true; $('start').value = '2026-11-11T12:00'; $('end').value = '2026-11-11T14:00';
  updateDateFields($);
  assert.equal($('start').type, 'date'); assert.equal($('start').value, '2026-11-11'); assert.equal($('end').disabled, true);
  const fields = eventFields({ payload: { date_only: true, start_at: '2026-11-11', end_at: '2026-11-11T22:00:00Z' } });
  assert.equal(eventPayload(fields).ends_local, '');
  $('dateOnly').checked = false; updateDateFields($);
  assert.equal($('start').value, '2026-11-11T00:00'); assert.equal($('end').disabled, false);
});

test('event editor enables required controls only while its feature is active', () => {
  const { $ } = controls(), feature = createFeature();
  const controller = feature.connect({ $ });
  feature.configureEditor({ $, values: { dateOnly: true } });
  assert.equal($('start').required, true); assert.equal($('venue').required, true);
  controller.resetEditor();
  assert.equal($('start').required, false); assert.equal($('venue').required, false);
});

test('event form stores sorted additional dates on one event record', () => {
  const fields = eventFields({payload:{start_at:'2026-11-07T18:00:00-08:00',additional_occurrences:[
    {start_at:'2026-11-11T18:00:00-08:00',end_at:null},{start_at:'2026-11-08T18:00:00-08:00',end_at:null}
  ]}});
  assert.equal(fields.additionalDates,'2026-11-08,2026-11-11');
  const payload=eventPayload({...fields,additionalDate:'2026-11-15',recordTitle:'Fundraiser',recordBody:'Details',venue:'Public hall'});
  assert.deepEqual(payload.additional_dates,['2026-11-08','2026-11-11','2026-11-15']);
  assert.deepEqual(eventDateList('2026-11-11,2026-11-08,2026-11-11,not-a-date'),['2026-11-08','2026-11-11']);
});

test('event editor offers confirmed deletion only for an editable saved event', async t => {
  const { $ }=controls(),record={id:'event-a',title:'Community event',version:4};
  let request,notice='',reloads=0;
  const originalWindow=globalThis.window;globalThis.window={confirm:()=>true};t.after(()=>{globalThis.window=originalWindow;});
  const context={$,editing:record,message:value=>{notice=value;},loadSection:async()=>{reloads++;},api:async(path,options)=>{request={path,options};}};
  const controller=createFeature().connect(context);
  controller.editorOpened(record,{editable:true});assert.equal($('deleteEventSection').hidden,false);
  await $('deleteEvent').onclick();
  assert.equal(request.path,'records/event-a');assert.equal(request.options.method,'DELETE');assert.deepEqual(JSON.parse(request.options.body),{version:4});
  assert.equal(notice,'Event deleted.');assert.equal(reloads,1);
  controller.editorOpened(record,{editable:false});assert.equal($('deleteEventSection').hidden,true);
  controller.resetEditor();assert.equal($('deleteEventSection').hidden,true);
});
