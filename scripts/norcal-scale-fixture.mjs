// Generates fictional staging-only SQL. It never connects to a database.
// Usage: node scripts/norcal-scale-fixture.mjs START COUNT > /tmp/fixture.sql
import { publicEventRecord } from '../src/modules/events/public.mjs';
import { publicOccurrenceRows, occurrenceWindows } from '../src/app/public-occurrences.mjs';

const [start,count]=process.argv.slice(2).map(Number);
if (!Number.isInteger(start)||!Number.isInteger(count)||start<0||count<1||count>10000) throw new Error('Supply a start index and a count from 1 to 10000.');
const now=Date.parse('2026-10-27T12:00:00.000Z'), prefix='scale-fixes-20261027-',creator='scale-fixes-20261027@synthetic.invalid';
const quote=value=>"'"+String(value).replaceAll("'","''")+"'";
const fields={
 records:['id','kind','title','body','region_id','organization_id','status','payload','created_by','created_at','updated_at','mutation_id'],
 public_occurrences:['source_record_id','event_id','occurrence_index','region_id','organization_id','city','start_at','end_at','pacific_day','visible_through_ms','listable'],
 public_occurrence_windows:['source_record_id','event_id','occurrence_index','region_id','city','start_at','window_level','window_bucket']
};
function emit(table,rows) {
 for(let i=0;i<rows.length;i+=100) {
  const keys=fields[table];
  const sql=`INSERT INTO ${table}(${keys.join(',')}) SELECT ${keys.map(key=>`json_extract(value,'$.${key}')`).join(',')} FROM json_each(${quote(JSON.stringify(rows.slice(i,i+100)))});`;
  if(Buffer.byteLength(sql)>95000)throw new Error('Synthetic statement exceeds its safe SQL size.');
  process.stdout.write(sql+'\n');
 }
}
for(let i=start;i<start+count;i+=25) {
 const records=[],occurrences=[],windows=[];
 for(let n=i;n<Math.min(i+25,start+count);n++) {
  const id=prefix+String(n).padStart(5,'0'),region=n%5===4?'synthetic-other':'yolo-solano';
  const time=n%4===0?now-86400000:n%4===1?now+86400000+n*3600000:now-10*365*86400000;
  const payload={venue:'Fictional test hall',city:n%2?'Davis':'Dixon',start_at:new Date(time).toISOString(),end_at:new Date(time+(n%4===0?3*86400000:2*3600000)).toISOString()};
  if(n%4===3)payload.additional_occurrences=[{start_at:new Date(now+2*86400000+n*3600000).toISOString()}];
  const record={id,kind:'event',title:`Fictional scale event ${n}`,body:'Fictional staging test. No real event.',region_id:region,organization_id:null,status:'published',payload:JSON.stringify(payload),created_by:creator,created_at:'2026-01-01',updated_at:'2026-01-01',mutation_id:id};
  records.push(record);
  const projected=publicOccurrenceRows(publicEventRecord(record,payload),region);
  occurrences.push(...projected.map((row,occurrence_index)=>({...row,source_record_id:id,occurrence_index})));
  windows.push(...occurrenceWindows(projected).map(row=>({...row,source_record_id:id})));
 }
 emit('records',records);emit('public_occurrences',occurrences);emit('public_occurrence_windows',windows);
}
process.stdout.write(`DELETE FROM public_occurrence_dirty WHERE source_record_id IN (SELECT id FROM records WHERE id LIKE ${quote(prefix+'%')} AND created_by=${quote(creator)});\n`);
