import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {records,sources,types} from '../src/data.mjs';
import {filterRecords,render,escapeHtml} from '../src/site.mjs';
import worker from '../dist/worker.mjs';
import {publicExtension} from '../src/public-tools.mjs';
import {brandLogos} from '../src/logos.mjs';
test('logo gallery keeps every organization reachable with accessible post and location labels',async()=>{
 const html=render(new URL('https://test/')).html;
 assert.ok(html.includes('Veteran Organizations'));
 assert.ok(html.includes('Veteran Non-Profits & Programs'));
 assert.ok(!html.includes('class="org-card"'));
 for(const r of records){assert.ok(html.includes(`href="/organizations/${r.id}"`),r.id);assert.ok(html.includes(escapeHtml(r.verified_name+' — '+(r.city||r.location_county+' County'))),r.id);}
 for(const logo of Object.values(brandLogos)){const response=await worker.fetch(new Request('https://test'+logo.src));assert.equal(response.status,200,logo.src);assert.match(response.headers.get('Content-Type'),/^image\//);assert.ok((await response.arrayBuffer()).byteLength>100);}
 const solano=render(new URL('https://test/?place=Solano+County')).html;
 assert.ok(solano.includes('/organizations/rememberavet'));
 const remember=render(new URL('https://test/organizations/rememberavet')).html;
 assert.ok(remember.includes('Mailing address (not a visitor office)'));assert.ok(!remember.includes('Open address in Maps'));
 const equine=render(new URL('https://test/organizations/little-reata-veterans')).html;
 assert.ok(equine.includes('Veterans Equine Therapy (VETs)'));
 assert.ok(!equine.includes('Little Reata Stables — Veterans Equine Program'));
 assert.ok(equine.includes('nonprofit organization supporting veterans through equine-assisted therapy'));
 assert.ok(equine.includes('https://www.veteransequinetherapy.com/'));
 assert.ok(equine.includes('vets@veteransequinetherapy.com'));
 assert.ok(equine.includes('530-867-5150'));
 assert.ok(brandLogos['little-reata-veterans']);
 assert.ok(!brandLogos['wild-horse-farms']);
 assert.ok(!html.includes('Wild Horse Farms'));
 assert.equal(render(new URL('https://test/organizations/wild-horse-farms')).status,404);
 assert.ok(!records.some(r=>r.id==='wild-horse-farms'));
 assert.ok(!sources.some(s=>s.id.startsWith('wild-horse-farms')));
 const vetRecord=records.find(r=>r.id==='little-reata-veterans');
 assert.equal(vetRecord.display_name_update.method,'authenticated_project_update');
 assert.equal(vetRecord.organization_confirmed_at,null);
 assert.equal(vetRecord.entity_kind,'organization');
 assert.equal(vetRecord.address,null);
 assert.equal(vetRecord.meeting_schedule,null);
 assert.ok(vetRecord.source_ids.some(id=>sources.some(s=>s.id===id&&s.url==='https://www.veteransequinetherapy.com/')));
 for(const flag of ['current_intake_unconfirmed','schedule_unconfirmed','visit_location_unconfirmed'])assert.ok(vetRecord.missing_data_flags.includes(flag));
  });
 test('VFW 8151 cards preserve meeting listings and organization isolation',()=>{
  const source=records.find(r=>r.id==='vfw-ca-8762');
  const vfw={...source,id:'vfw-ca-8151',verified_name:'Dixon VFW Post 8151'};
  const meetings=Array.from({length:12},(_,index)=>({id:`vfw8151-meeting-${index+1}`,title:'Dixon VFW Post 8151 monthly meeting',description:'Social begins at 6:30 p.m.; meeting begins at 7 p.m.',organization_id:'vfw-ca-8151',kind:'Organization meeting',status:'published',start_at:`2027-${String(index+1).padStart(2,'0')}-20T03:00:00Z`,venue:'Olde Vets Hall',organizer:'Dixon VFW Post 8151',county:'Solano',city:'Dixon',audience:'Contact the post for attendance details.'}));
  const page=render(new URL('https://test/organizations/vfw-ca-8151'),[vfw],meetings);
  assert.equal(page.status,200);assert.ok(page.html.includes('id="upcoming-events"'));assert.ok(!page.html.includes('id="calendar"'));assert.equal((page.html.match(/class="panel event-card"/g)||[]).length,12);assert.ok(!page.html.includes('href="/events/vfw8151-meeting-'));
  assert.equal(publicExtension(new URL('https://test/events/vfw8151-meeting-1'),meetings,[vfw]),null);
  const other=render(new URL('https://test/organizations/vfw-ca-8762'),[source],meetings);
  assert.ok(other.html.includes('id="upcoming-events"'));assert.ok(!other.html.includes('id="calendar"'));assert.ok(other.html.includes('No upcoming events are currently published'));
 });
test('source records are unique, auditable and have no invented confirmation',()=>{
 assert.equal(new Set(records.map(r=>r.id)).size,records.length);
 for(const r of records){assert.ok(r.verified_name);assert.ok(r.source_ids.length||r.missing_data_flags.includes('public_source_withheld_for_privacy'),'Source must be linked or explicitly withheld for privacy: '+r.id);assert.equal(r.organization_confirmed_at,null);assert.equal(r.verification_method,'public_source_review');for(const id of r.source_ids)assert.ok(sources.some(s=>s.id===id));for(const o of r.officers){assert.equal(o.term_verified,false);assert.ok(sources.some(s=>s.id===o.source_id));}assert.ok(!r.address||r.address.type!=='residential');}
 for(const t of types)assert.ok(records.some(r=>r.organization_type===t));
});
test('combined county/type search and same-city ranking',()=>{
 const result=filterRecords(new URLSearchParams({type:'VFW',place:'Vacaville'}));assert.equal(result.length,5);assert.equal(result[0].id,'vfw-ca-7244');assert.ok(result.every(r=>r.location_county==='Solano'&&r.organization_type==='VFW'));
 assert.equal(filterRecords(new URLSearchParams({type:'DAV',place:'Yolo County'})).length,0);
 assert.equal(filterRecords(new URLSearchParams({q:'8762'}))[0].id,'vfw-ca-8762');
});
test('invalid, empty and injection input stays safe',()=>{
 const p=render(new URL('https://test/?q='+encodeURIComponent('<script>alert(1)</script>')));assert.ok(!p.html.includes('<script>alert(1)</script>'));assert.ok(p.html.includes('No matching organizations'));
 assert.equal(render(new URL('https://test/organizations/missing')).status,404);
 assert.equal(escapeHtml('"<a>'),'&quot;&lt;a&gt;');
});
test('each profile has its own metadata, source links and term caveat',()=>{
 for(const r of records){const p=render(new URL('https://test/organizations/'+r.id));assert.equal(p.status,200);assert.ok(p.html.includes(escapeHtml(r.verified_name)));assert.ok(p.html.includes('Sources for this profile'));assert.ok(!p.html.includes('property="og:image"'));if(r.officers.length)assert.ok(p.html.includes('current terms have not been confirmed'));}
});
test('American Legion profiles use the simple profile with Legion family styling',()=>{
 const legion=records.filter(r=>r.organization_type==='American Legion');
 const styles=readFileSync(new URL('../public/styles.css',import.meta.url),'utf8');
 assert.ok(styles.includes("url('/american-legion-background.png')"));
 assert.ok(legion.length>=5);
 for(const r of legion){
  const page=render(new URL('https://test/organizations/'+r.id));
  assert.equal(page.status,200,r.id);
  assert.ok(page.html.includes('class="wrap detail-page legion-profile"'),r.id);
  assert.ok(page.html.includes('class="profile-heading branded-profile-heading"'),r.id);
  assert.ok(page.html.includes('class="profile-brand-logo"'),r.id);
  for(const phrase of ['Upcoming events','Plan your visit','Activities &amp; member information','Sources for this profile','Submit an update'])assert.ok(page.html.includes(phrase),r.id+' '+phrase);
  assert.ok(!page.html.includes('class="org-site legion-site"'),r.id);
 }
});
test('Yolo-Solano is the first NorCal Veterans regional experience',async()=>{
 for(const path of ['/','/yolo-solano']){
  const page=render(new URL('https://test'+path));
  assert.equal(page.status,200);
  for(const phrase of ['NorCal Veterans','regional-hero','Find your people.','UPCOMING IN OUR REGION','FEATURED CONNECTIONS','THE FULL YOLO-SOLANO DIRECTORY','OFFICIAL COUNTY SUPPORT','BUILD THE NETWORK WITH US'])assert.ok(page.html.includes(phrase),phrase);
  assert.ok(page.html.includes('/published-assets/norcal-veterans.png?v=logo-20260913-1'));
  assert.ok(page.html.includes('/ysv-logo.png?v=logo-20260913-1'));
 }
 const logo=await worker.fetch(new Request('https://test/published-assets/norcal-veterans.png'));
 assert.equal(logo.status,200);
 assert.equal(logo.headers.get('Content-Type'),'image/png');
 assert.ok((await logo.arrayBuffer()).byteLength>100);
});
test('Detachment 627 uses the simple profile with its branding and content',()=>{
 for(const path of ['/mcl-yolo','/organizations/mcl-yolo']){
  const page=render(new URL('https://test'+path));
  assert.equal(page.status,200);
  for(const phrase of ['Detachment 627','Upcoming events','id="photos"','id="officers"','Plan your visit','Activities &amp; member information','Sources for this profile','Submit an update'])assert.ok(page.html.includes(phrase),phrase);
  assert.ok(page.html.includes('class="wrap detail-page mcl-profile"'));
  assert.ok(page.html.includes('class="profile-brand-logo"'));
  assert.ok(!page.html.includes('class="org-site mcl-site"'));
  assert.ok(page.html.includes('href="https://www.mclnational.org/"'));
  assert.ok(page.html.includes('/hq?org=mcl-yolo#photos'));
  const canonical=path==='/mcl-yolo'?'/mcl-yolo':'/organizations/mcl-yolo';
  assert.ok(page.html.includes(`<link rel="canonical" href="https://www.norcalveterans.org${canonical}">`));
  assert.ok(!page.html.includes('mailto:'));
  assert.ok(!page.html.includes('tel:'));
 }
});
test('resources page provides local and official help across the requested categories',()=>{
 const page=render(new URL('https://test/resources'));
 assert.equal(page.status,200);
 for(const heading of ['Start with a local benefits counselor','VA disability and claims','Education and training','Employment and careers','Housing and homelessness','Mental health and connection'])assert.ok(page.html.includes(heading),heading);
 for(const url of ['https://www.yolocounty.gov/government/general-government-departments/health-human-services/adults/veterans-service-office','https://www.solanocounty.gov/government/veterans-services','https://www.va.gov/disability/','https://www.va.gov/education/','https://edd.ca.gov/en/jobs_and_training/services_for_veterans/','https://www.va.gov/housing-assistance/','https://www.veteranscrisisline.net/'])assert.ok(page.html.includes(url),url);
 assert.ok(page.html.includes('call <a href="tel:988">988</a> and press 1'));
});
test('submission desk and unknown mutation routes stay separate',async()=>{
 const page=publicExtension(new URL('https://test/for-organizations'),[]);assert.ok(page.html.includes('Submit for review'));assert.ok(!page.html.includes('type="password"'));
 assert.equal((await worker.fetch(new Request('https://test/api/profile',{method:'POST'}))).status,405);
 assert.equal((await worker.fetch(new Request('https://test/missing'))).status,404);
});
test('all deliverable routes/assets respond with expected content and headers',async()=>{
 for(const url of ['/','/mcl-yolo','/about','/resources','/for-organizations','/data.json','/styles.css','/app.js','/og.png','/favicon.svg','/norcal-hero-table.png','/norcal-hero-seals.png','/american-legion-background.png','/health']){const r=await worker.fetch(new Request('https://test'+url));assert.equal(r.status,200,url);}
 const image=await worker.fetch(new Request('https://test/og.png'));const bytes=new Uint8Array(await image.arrayBuffer());assert.equal(bytes[0],137);assert.equal(bytes[1],80);
 const main=await worker.fetch(new Request('https://test/'));assert.ok(main.headers.get('Content-Security-Policy').includes("form-action 'self'"));
});
