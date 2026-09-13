import test from 'node:test';
import assert from 'node:assert/strict';
import {eventDetail,eventCalendar,eventsPagePublic,sanitizePublicEvent} from './public.mjs';
test('event detail works independently with optional supplied organization choices',()=>{
  const event=sanitizePublicEvent({id:'synthetic-event',title:'Synthetic event',description:'Synthetic content',
    start_at:'2030-01-15T18:00:00-08:00',venue:'Synthetic public hall',status:'published',organization_id:'synthetic-host'});
  const standalone=eventDetail(event);
  assert.match(standalone,/Synthetic event/);assert.doesNotMatch(standalone,/View related organization/);
  assert.match(eventDetail(event,[{id:'synthetic-host'}]),/href="\/organizations\/synthetic-host"/);
});

test('VFW 8151 monthly meetings stay listed without detail-page links',()=>{
  const meeting=sanitizePublicEvent({id:'organization-meeting-vfw-ca-8151-2030-01',title:'Dixon VFW Post 8151 monthly meeting',description:'Social begins at 6:30 p.m.; meeting begins at 7 p.m.',start_at:'2030-01-18T03:00:00Z',venue:'Olde Vets Hall',status:'published',organization_id:'vfw-ca-8151',kind:'Organization meeting',organizer:'Dixon VFW Post 8151',county:'Solano',city:'Dixon',audience:'Contact the post for attendance details.'});
  const html=eventsPagePublic(new URL('https://test/events?month=2030-01'),[meeting]);
  assert.match(html,/Dixon VFW Post 8151 monthly meeting/);assert.doesNotMatch(html,/href="\/events\/organization-meeting-vfw-ca-8151-2030-01"/);
  assert.doesNotMatch(eventCalendar([meeting]),/URL:https:\/\/www\.norcalveterans\.org\/events\/organization-meeting-vfw-ca-8151-2030-01/);
});
