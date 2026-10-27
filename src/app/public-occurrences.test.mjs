import test from 'node:test';
import assert from 'node:assert/strict';
import { publicOccurrenceRows, occurrenceWindows } from './public-occurrences.mjs';
import { publicMeetingPlanEvents } from '../modules/organizations/public.mjs';

const base={id:'fictional-event',title:'Fictional event',venue:'Fictional venue',status:'published',city:'Davis',organization_id:'host',start_at:'2020-01-01T19:00:00Z'};

test('visibility buckets cover exact inclusive bounds without overlapping or expanding with event duration',()=>{
  for(const [start,end] of [[-10001,20007],[0,0],[1,100000000000000],[1770000000123,1770000000999]]) {
    const windows=occurrenceWindows([{start_at:new Date(start).toISOString(),visible_through_ms:end}]);
    assert.ok(windows.length<=98);
    let next=start;
    for(const item of windows) { const lo=item.window_bucket*2**item.window_level; assert.equal(lo,next); next=lo+2**item.window_level; }
    assert.equal(next,end+1);
    for(const instant of [start-1,start,end,end+1]) {
      const matches=windows.filter(w=>Math.floor(instant/(2**w.window_level))===w.window_bucket).length;
      assert.equal(matches,instant>=start && instant<=end?1:0);
    }
  }
});

test('occurrence projection preserves later dates, deduplicates, and uses the envelope region',()=>{
  const rows=publicOccurrenceRows({...base,region_id:'untrusted',additional_occurrences:[
    {start_at:'2030-11-03T19:00:00Z'}, {start_at:'2030-11-03T19:00:00Z'}, {start_at:'invalid'}
  ]},'synthetic-region');
  assert.deepEqual(rows.map(row=>row.start_at),['2020-01-01T19:00:00.000Z','2030-11-03T19:00:00.000Z']);
  assert.ok(rows.every(row=>row.region_id==='synthetic-region' && row.organization_id==='host'));
  assert.equal(rows[1].visible_through_ms,Date.parse('2030-11-04T19:00:00Z'));
});

test('date-only visibility follows 23-hour and 25-hour Pacific days',()=>{
  const spring=publicOccurrenceRows({...base,date_only:true,start_at:'2026-03-08T08:00:00Z'},'r')[0];
  const fall=publicOccurrenceRows({...base,date_only:true,start_at:'2026-11-01T07:00:00Z'},'r')[0];
  assert.equal(new Date(spring.visible_through_ms).toISOString(),'2026-03-09T06:59:59.999Z');
  assert.equal(new Date(fall.visible_through_ms).toISOString(),'2026-11-02T07:59:59.999Z');
});

test('long-running events, drafts and malformed dates follow public serialization',()=>{
  const long=publicOccurrenceRows({...base,end_at:'2030-01-01T19:00:00Z'},'r');
  assert.equal(long[0].visible_through_ms,Date.parse('2030-01-01T19:00:00Z'));
  assert.deepEqual(publicOccurrenceRows({...base,status:'draft'},'r'),[]);
  assert.deepEqual(publicOccurrenceRows({...base,start_at:'broken'},'r'),[]);
  assert.throws(()=>publicOccurrenceRows(base,''),/region/);
});

test('meeting planner events retain their stable identifier and Pacific time',()=>{
  const row={id:'vfw-ca-8151'}, payload={meeting_plans:[{year:2027,meetings:[{month:1,date:'2027-01-21',title:'Fictional meeting',time_1:'18:00',label_1:'Meeting'}]}]};
  const organization={verified_name:'Fictional post',location_county:'Solano',city:'Dixon'};
  const meeting=publicMeetingPlanEvents(row,payload,organization)[0];
  const occurrence=publicOccurrenceRows(meeting,'yolo-solano')[0];
  assert.equal(occurrence.event_id,'organization-meeting-vfw-ca-8151-2027-01');
  assert.equal(occurrence.start_at,'2027-01-22T02:00:00.000Z');
  assert.equal(occurrence.pacific_day,'2027-01-21');
});
