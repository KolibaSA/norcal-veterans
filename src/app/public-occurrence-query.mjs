// These queries are used only after the region's dirty queue is empty. The
// public serializer remains the authority for every returned record.
const columns = 'r.id,r.kind,r.title,r.body,r.region_id,r.organization_id,r.status,r.payload';

export async function occurrenceIndexReady(db, region) {
  const row = await db.prepare(`SELECT 1 AS dirty FROM public_occurrence_dirty d
    JOIN records r ON r.id=d.source_record_id WHERE r.region_id=? LIMIT 1`).bind(region).first();
  return !row;
}

export async function queryPublicEventPage(db, { region, city = '', now = Date.now(), year = null, page = 1, pageSize = 25 }) {
  if (typeof region !== 'string' || !region || !Number.isSafeInteger(page) || page < 1 || page > 100000 ||
      !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100 || !Number.isFinite(now)) throw new TypeError('Invalid event query.');
  if (year !== null && !/^\d{4}$/.test(String(year))) throw new TypeError('Invalid archive year.');
  if (year === null) {
    // Future dates use a start-ordered index. Active occurrences use exact
    // temporal buckets, avoiding a scan of expired history or later dates.
    const instant = new Date(now).toISOString(), limit = page * pageSize + 1;
    const cityClause = city ? ' AND o.city=?' : '';
    const common = `o.region_id=?${cityClause} AND o.listable=1
      AND NOT EXISTS (SELECT 1 FROM public_occurrences earlier
        WHERE earlier.source_record_id=o.source_record_id AND earlier.listable=1 AND earlier.start_at>?
        AND (earlier.start_at<o.start_at OR (earlier.start_at=o.start_at AND earlier.occurrence_index<o.occurrence_index)))`;
    const args = city ? [region,city,now] : [region,now];
    const index = city ? 'idx_public_occurrences_city_start' : 'idx_public_occurrences_region_start';
    const futureSelect = `SELECT o.source_record_id AS id,o.start_at AS occurrence_start FROM public_occurrences o INDEXED BY ${index} WHERE ${common}`;
    const windowIndex=city?'idx_public_windows_city':'idx_public_windows_region';
    const activeSelect=`SELECT w.source_record_id AS id,w.start_at AS occurrence_start
      FROM public_occurrence_windows w INDEXED BY ${windowIndex}
      WHERE w.region_id=?${city?' AND w.city=?':''}
      AND NOT EXISTS (SELECT 1 FROM public_occurrences earlier WHERE earlier.source_record_id=w.source_record_id AND earlier.visible_through_ms>=?
        AND (earlier.start_at<w.start_at OR (earlier.start_at=w.start_at AND earlier.occurrence_index<w.occurrence_index)))`;
    const branches=Array.from({length:49},(_,level)=>db.prepare(`${activeSelect} AND w.window_level=? AND w.window_bucket=? ORDER BY w.start_at,w.source_record_id LIMIT ?`).bind(...args,level,Math.floor(now/(2**level)),limit));
    const [ongoing, future] = await Promise.all([
      db.batch(branches),
      db.prepare(`${futureSelect} AND o.start_at>? ORDER BY o.start_at,o.source_record_id LIMIT ?`).bind(...(city?[region,city,instant]:[region,instant]),instant,limit*2).all()
    ]);
    const compare=(a,b)=>a<b?-1:a>b?1:0;
    const ordered = [...ongoing.flatMap(result=>result.results),...future.results].sort((a,b)=>compare(a.occurrence_start,b.occurrence_start)||compare(a.id,b.id));
    const seen=new Set(), combined=ordered.filter(row=>{if(seen.has(row.id))return false;seen.add(row.id);return true;});
    const offset=(page-1)*pageSize, rows=combined.slice(offset,offset+pageSize+1);
    const selected=rows.slice(0,pageSize), found=[];
    for(let i=0;i<selected.length;i+=80) {
      const ids=selected.slice(i,i+80).map(row=>row.id);
      found.push(...(await db.prepare(`SELECT ${columns} FROM records r WHERE r.status='published' AND r.id IN (${ids.map(()=>'?').join(',')})`).bind(...ids).all()).results);
    }
    const byId=new Map(found.map(row=>[row.id,row]));
    return {rows:selected.map(row=>byId.get(row.id)).filter(Boolean),page,hasMore:rows.length>pageSize};
  }
  const conditions = ["o.region_id=?", "r.status='published'", "r.kind='event'", "o.source_record_id=o.event_id", "COALESCE(json_extract(CASE WHEN json_valid(r.payload) THEN r.payload ELSE '{}' END,'$.kind'),'') <> 'Organization meeting'"];
  const args = [region];
  if (city) { conditions.push('o.city=?'); args.push(city); }
  if (year !== null) {
    conditions.push('o.pacific_day>=?', 'o.pacific_day<?', 'o.visible_through_ms<?');
    args.push(`${year}-01-01`,`${Number(year)+1}-01-01`,now);
  } else { conditions.push('o.visible_through_ms>=?'); args.push(now); }
  const order = year !== null ? 'MAX(o.start_at) DESC' : 'MIN(o.start_at) ASC';
  const sql = `SELECT ${columns} FROM public_occurrences o JOIN records r ON r.id=o.source_record_id
    WHERE ${conditions.join(' AND ')} GROUP BY r.id ORDER BY ${order},r.id ASC LIMIT ? OFFSET ?`;
  const rows = (await db.prepare(sql).bind(...args,pageSize+1,(page-1)*pageSize).all()).results;
  return { rows: rows.slice(0,pageSize), page, hasMore: rows.length > pageSize };
}

export async function publicArchiveYears(db, { region, city = '', now = Date.now() }) {
  const values = [region,now], cityClause = city ? ' AND o.city=?' : '';
  if (city) values.push(city);
  const results = (await db.prepare(`SELECT DISTINCT substr(o.pacific_day,1,4) AS year FROM public_occurrences o
    JOIN records r ON r.id=o.source_record_id
    WHERE o.region_id=? AND o.visible_through_ms<?${cityClause} AND o.source_record_id=o.event_id
    AND r.kind='event' AND r.status='published' AND COALESCE(json_extract(CASE WHEN json_valid(r.payload) THEN r.payload ELSE '{}' END,'$.kind'),'') <> 'Organization meeting'
    ORDER BY year DESC`).bind(...values).all()).results;
  return results.map(row=>row.year).filter(year=>/^\d{4}$/.test(year));
}
