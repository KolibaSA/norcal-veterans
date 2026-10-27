import { records as legacyRecords, places } from '../data.mjs';
import { organizationMetadata } from '../modules/organizations/domain.mjs';

const safe = "CASE WHEN json_valid(r.payload) THEN r.payload ELSE '{}' END";
const literal = value => "'"+String(value).replaceAll("'","''")+"'";
// Imported records can omit fields that the public serializer fills from the
// source catalog. Embed that fixed, public fallback in SQL before pagination.
function field(name, defaultValue = '') {
  const cases = legacyRecords.filter(row=>row[name] != null).map(row=>`WHEN ${literal(row.id)} THEN ${literal(row[name])}`).join(' ');
  return `COALESCE(CASE WHEN json_type(${safe},'$.${name}') IS NULL THEN CASE r.id ${cases} ELSE NULL END ELSE json_extract(${safe},'$.${name}') END,${literal(defaultValue)})`;
}
const city=field('city'), county=field('location_county'), type=field('organization_type','Other veteran organization');
const relation=`json_extract(${safe},'$.relationship_type')`, parent=`json_extract(${safe},'$.affiliated_with_id')`;
const independent=`(${relation} NOT IN ('auxiliary','sons') OR ${relation} IS NULL OR typeof(${parent})<>'text' OR length(${parent}) NOT BETWEEN 1 AND 120 OR ${parent} GLOB '*[^-a-zA-Z0-9_]*')`;
const columns='r.id,r.kind,r.title,r.body,r.region_id,r.organization_id,r.status,r.payload';
const regionWhere="r.kind='organization' AND r.status='published' AND r.region_id=?";

export async function queryPublicDirectory(db,url,region='yolo-solano') {
  const typesResult=(await db.prepare(`SELECT DISTINCT ${type} AS name FROM records r WHERE ${regionWhere} ORDER BY name`).bind(region).all()).results;
  const types=[...new Set([...organizationMetadata.organizationTypes,...typesResult.map(row=>row.name).filter(Boolean)])];
  const params=url.searchParams, selectedType=types.includes(params.get('type'))?params.get('type'):'', place=Object.hasOwn(places,params.get('place'))?params.get('place'):'All locations', locationCounty=places[place];
  const text=(params.get('q')||'').trim().toLowerCase().slice(0,200), rawPage=params.get('org_page');
  const page=/^\d{1,5}$/.test(rawPage||'')&&Number(rawPage)>0?Number(rawPage):1;
  const conditions=[regionWhere], values=[region];
  if(!text) conditions.push(independent);
  if(selectedType){conditions.push(`${type}=?`);values.push(selectedType);}
  if(locationCounty){
    conditions.push(`(${county}=? OR EXISTS(SELECT 1 FROM json_each(CASE WHEN json_type(${safe},'$.service_area.counties')='array' THEN json_extract(${safe},'$.service_area.counties') ELSE '[]' END) c WHERE c.value=?))`);
    values.push(locationCounty,locationCounty);
  }
  if(text){
    const categories=`COALESCE((SELECT group_concat(value,' ') FROM json_each(CASE WHEN json_type(${safe},'$.service_categories')='array' THEN json_extract(${safe},'$.service_categories') ELSE '[]' END) WHERE type='text'),'')`;
    conditions.push(`lower(r.title || ' ' || ${city} || ' ' || ${county} || ' ' || r.body || ' ' || ${categories}) LIKE ? ESCAPE '\\'`);
    values.push('%'+text.replace(/[\\%_]/g,'\\$&')+'%');
  }
  const result=(await db.prepare(`SELECT ${columns} FROM records r WHERE ${conditions.join(' AND ')} ORDER BY CASE WHEN ${city}=? THEN 0 ELSE 1 END,r.title COLLATE NOCASE,r.id LIMIT 26 OFFSET ?`).bind(...values,place,(page-1)*25).all()).results;
  return {rows:result.slice(0,25),page,hasMore:result.length>25,types};
}

export async function queryNearbyOrganizations(db,region,selectedCity) {
  if (!selectedCity || !Object.hasOwn(places,selectedCity) || selectedCity==='All locations' || selectedCity.endsWith('County') || selectedCity.includes('unincorporated')) return [];
  return (await db.prepare(`SELECT ${columns} FROM records r WHERE ${regionWhere} AND ${city}=? AND ${independent} ORDER BY r.title COLLATE NOCASE,r.id LIMIT 25`).bind(region,selectedCity).all()).results;
}
