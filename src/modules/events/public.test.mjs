import test from 'node:test';
import assert from 'node:assert/strict';
import {eventDetail,sanitizePublicEvent} from './public.mjs';
test('event detail works independently with optional supplied organization choices',()=>{
  const event=sanitizePublicEvent({id:'synthetic-event',title:'Synthetic event',description:'Synthetic content',
    start_at:'2030-01-15T18:00:00-08:00',venue:'Synthetic public hall',status:'published',organization_id:'synthetic-host'});
  const standalone=eventDetail(event);
  assert.match(standalone,/Synthetic event/);assert.doesNotMatch(standalone,/View related organization/);
  assert.match(eventDetail(event,[{id:'synthetic-host'}]),/href="\/organizations\/synthetic-host"/);
});
