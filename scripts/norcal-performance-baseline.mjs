// Local synthetic measurements only. No remote bindings or production records.
import { DatabaseSync } from 'node:sqlite';
import { performance } from 'node:perf_hooks';
import { readFileSync, readdirSync } from 'node:fs';
import worker from '../src/norcal-worker.mjs';
import { cachedPublicResponse } from '../src/app/public-cache.mjs';
import { rebuildPublicOccurrences } from '../src/app/public-occurrence-index.mjs';

const db = new DatabaseSync(':memory:');
const migrations = new URL('../migrations/legacy/', import.meta.url);
for (const file of readdirSync(migrations).filter(name => /^\d{4}_.+\.sql$/.test(name)).sort()) db.exec(readFileSync(new URL(file, migrations), 'utf8'));
const put = db.prepare("INSERT INTO records(id,kind,title,body,region_id,organization_id,status,payload,created_by,created_at,updated_at,mutation_id) VALUES(?,?,?,?,?,?,'published',?,'synthetic@example.test','2026-01-01','2026-01-01',?)");
const regions = ['yolo-solano', 'synthetic-north', 'synthetic-south'];
db.exec('BEGIN');
for (let i=0; i<450; i++) {
  const id=`synthetic-org-${i}`, region=regions[i%regions.length];
  put.run(id,'organization',`Synthetic Organization ${i}`,'Fictional public description.',region,null,JSON.stringify({city:'Davis',location_county:'Yolo',organization_type:'VFW'}),id);
}
for (let i=0; i<2400; i++) {
  const id=`synthetic-event-${i}`, org=`synthetic-org-${i%450}`, region=regions[i%regions.length];
  const year=2020+(i%10), date=`${year}-11-${String(i%27+1).padStart(2,'0')}T20:00:00.000Z`;
  const payload={start_at:date,city:'Davis',venue:'Fictional venue',additional_occurrences:i%10===0?[{start_at:'2031-11-02T20:00:00.000Z'}]:[]};
  put.run(id,'event',`Synthetic Event ${i}`,'Fictional public event.',region,org,JSON.stringify(payload),id);
}
db.exec('COMMIT');
let metrics={queries:0,rowsReturned:0};
const DB={prepare(sql){let values=[];return {bind(...args){values=args;return this;},async first(){metrics.queries++;const row=db.prepare(sql).get(...values)||null;metrics.rowsReturned+=row?1:0;return row;},async all(){metrics.queries++;const results=db.prepare(sql).all(...values);metrics.rowsReturned+=results.length;return {results};},async run(){const statement=db.prepare(sql);if(statement.columns().length){metrics.queries++;const results=statement.all(...values);metrics.rowsReturned+=results.length;return {results,meta:{changes:0}};}const result=statement.run(...values);return {meta:{changes:Number(result.changes)}};}};},async batch(statements){db.exec('BEGIN');try{const results=[];for(const statement of statements)results.push(await statement.run());db.exec('COMMIT');return results;}catch(error){db.exec('ROLLBACK');throw error;}}};
const cacheEntries=new Map();
const cache={async match(key){return cacheEntries.get(key.url)?.clone();},async put(key,value){cacheEntries.set(key.url,value);}};
const env={DB,CF_VERSION_METADATA:{id:'synthetic-performance-baseline'}};
const paths=['/yolo-solano','/events','/events?past_year=2025','/organizations/synthetic-org-1','/events/synthetic-event-1','/privacy'];
async function sample(path, cached) {
  metrics={queries:0,rowsReturned:0};
  const req=new Request('https://synthetic.example.test'+path), start=performance.now();
  const render=()=>worker.fetch(req,{DB});
  const response=cached?await cachedPublicResponse(req,env,undefined,render,{cache}):await render();
  const bytes=(await response.arrayBuffer()).byteLength;
  return {status:response.status,cache:response.headers.get('X-NorCal-Cache'),queries:metrics.queries,rowsReturned:metrics.rowsReturned,bytes,elapsedMs:Number((performance.now()-start).toFixed(2))};
}
try {
  if (process.argv.includes('--indexed')) {
    for (;;) {
      const result = await rebuildPublicOccurrences(DB,100);
      if (!result.examined) break;
      if (!result.completed) throw new Error('Synthetic occurrence backfill made no progress.');
    }
  }
  const results=[];
  for (const path of paths) {
    const uncached=await sample(path,false);
    await sample(path,true);
    const cached=await sample(path,true);
    results.push({path,uncached,cached});
  }
  const queryPlan=db.prepare("EXPLAIN QUERY PLAN SELECT id FROM records WHERE kind='event' AND status='published'").all().map(row=>row.detail);
  console.log(JSON.stringify({fixture:{regions:regions.length,organizations:450,events:2400,years:'2020-2029 plus recurring 2031 dates'},results,queryPlan,limitations:'Single in-memory run. rowsReturned counts rows delivered to the Worker, not database rows scanned. Elapsed times are local and not a load test or production capacity estimate.'},null,2));
} finally {db.close();}
