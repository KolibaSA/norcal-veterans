import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {dataset} from '../src/data.mjs';
import {brandLogos} from '../src/logos.mjs';
import {bundleJavaScript,expandHeadquartersMarkup,expandHeadquartersStyles} from './build-support.mjs';
const root=path.resolve(import.meta.dirname,'..');
// The embedded NorCal HQ is served as a module; keep it generated from its HTML source.
const [hqSource,hqStyleSource,hqScript]=await Promise.all([
 fs.readFile(path.join(root,'worker/legacy/hq.html'),'utf8'),
 fs.readFile(path.join(root,'worker/legacy/hq.css'),'utf8'),
 bundleJavaScript({entryPoints:['worker/legacy/hq-client.mjs']})
]);
const [hqMarkup,hqStyles]=await Promise.all([expandHeadquartersMarkup(hqSource),expandHeadquartersStyles(hqStyleSource)]);
if(!hqMarkup.includes('<!-- HQ_STYLES -->')||!hqMarkup.includes('<!-- HQ_SCRIPT -->'))throw new Error('HQ asset placeholders are missing.');
if(/<\/script/i.test(hqScript))throw new Error('HQ client contains a closing script tag.');
const headquarters=hqMarkup.replace('<!-- HQ_STYLES -->',()=>'<style>'+hqStyles+'</style>').replace('<!-- HQ_SCRIPT -->',()=>'<script type="module">'+hqScript+'</script>');
const scriptHash='sha256-'+createHash('sha256').update(hqScript).digest('base64');
await fs.writeFile(path.join(root,'worker','legacy','hq-template.mjs'),'export default '+JSON.stringify(headquarters)+';\nexport const scriptHash='+JSON.stringify(scriptHash)+';\n');
const assets={};
for(const [name,type] of [['styles.css','text/css; charset=utf-8'],['app.js','application/javascript; charset=utf-8'],['hq.js','application/javascript; charset=utf-8'],['favicon.svg','image/svg+xml']]){
 const bytes=await fs.readFile(path.join(root,'public',name));assets['/'+name]={type,base64:bytes.toString('base64')};
}
for(const [name,type] of [['ysv-logo.png','image/png'],['og.png','image/png'],['norcal-hero-table.png','image/png'],['norcal-hero-seals.png','image/png'],['american-legion-background.png','image/png']]){
 const bytes=(await fs.readFile(path.join(root,'public',name)));assets['/'+name]={type,base64:bytes.toString('base64')};
}
const usedLogoPaths=new Set(Object.values(brandLogos).map(logo=>logo.src));
for(const name of await fs.readdir(path.join(root,'public','logos'))){
 if(!usedLogoPaths.has('/logos/'+name))continue;
 const ext=path.extname(name).toLowerCase(),type={'.png':'image/png','.svg':'image/svg+xml','.jpg':'image/jpeg'}[ext];if(!type)continue;
 const bytes=(await fs.readFile(path.join(root,'public','logos',name)));assets['/logos/'+name]={type,base64:bytes.toString('base64')};
}
// Preserve the imported application as regression fixtures. Real module
// bundling follows compatibility exports and keeps each module's helpers scoped.
const publicRuntime=`
const assets=${JSON.stringify(assets)};
export default {async fetch(request,env={}){
 const url=new URL(request.url),head=request.method==='HEAD';
 if(request.method==='POST'&&url.pathname==='/submit'){
  try{await submitIntake(request,env.DB,records.map(r=>r.id));return redirect('/for-organizations?received=1');}
  catch(err){const message=/D1_|SQLITE|database/i.test(err.message)?'The submission desk is temporarily unavailable. Please try again later.':err.message;return responseHTML(submissionPage(new URL('/for-organizations',url),{error:message}),400,true);}
 }
 if(request.method==='POST'&&url.pathname==='/speaker-submissions'){
  try{await submitSpeakerSubmission(request,env.DB,records.map(r=>r.id));return redirect('/share?received=1');}
  catch(err){const message=/D1_|SQLITE|database/i.test(err.message)?'The introduction desk is temporarily unavailable. Please try again later.':err.message;return responseHTML(speakerSubmissionPage(new URL('/share',url),records,{error:message}),400,true);}
 }
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed.',{status:405,headers:{...securityHeaders,Allow:'GET, HEAD'}});
 const publishedAsset=await readPublishedRequestAsset(request,env,url.pathname);if(publishedAsset)return publishedAsset;
 const staticAsset=await readStaticAsset(request,env,url.pathname);if(staticAsset)return staticAsset;
 if(url.pathname.startsWith('/organization-photos/'))return await readOrganizationPhoto(request,env,url.pathname.slice('/organization-photos/'.length));
 if(assets[url.pathname]){const a=assets[url.pathname];return new Response(head?null:Uint8Array.from(atob(a.base64),c=>c.charCodeAt(0)),{headers:{...securityHeaders,'Content-Type':a.type,'Cache-Control':'public, max-age=3600'}});}
 if(url.pathname==='/health')return new Response(head?null:JSON.stringify({status:'ok',project:'Yolo Solano Veterans',records:records.length,version:'0.2.0'}),{headers:{...securityHeaders,'Content-Type':'application/json','Cache-Control':'no-store'}});
 try{
  const live=await publicData(env.DB,records,seedEvents);
  if(url.pathname==='/data.json')return new Response(head?null:JSON.stringify({...dataset,records:live.records.map(({officer_profiles,...record})=>record),events:live.events,memorial_services:memorialServices},null,2),{headers:{...securityHeaders,'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=30'}});
  if(url.pathname==='/events.ics'){const events=url.searchParams.has('event')?live.events.filter(e=>e.id===url.searchParams.get('event')):upcomingEvents(live.events);return new Response(head?null:eventCalendar(events),{headers:{...securityHeaders,'Content-Type':'text/calendar; charset=utf-8','Content-Disposition':'attachment; filename="yolo-solano-veterans.ics"','Cache-Control':'public, max-age=30'}});}
  const page=publicExtension(url,live.events)||render(url,live.records,live.events);return responseHTML(head?'':page.html,page.status);
 }catch{return responseHTML(shell('Temporarily unavailable | Yolo Solano Veterans','Please try again soon.','<section class="wrap about-page"><h1>We will be back shortly.</h1><p>The directory service is temporarily unavailable. Please try again in a few minutes.</p></section>'),503,true);}
}};
`;
const hqAssets=Object.fromEntries(Object.entries(assets).filter(([name])=>['/styles.css','/favicon.svg','/hq.js'].includes(name)));
const hqRuntime=`\nconst hqAssets=${JSON.stringify(hqAssets)};\nexport default {fetch(request,env,ctx){return hqFetch(request,env,ctx,hqAssets);}};\n`;
const publicImports=`
import {dataset,records} from './src/data.mjs';
import {seedEvents} from './src/research-additions.mjs';
import {render,shell} from './src/site.mjs';
import {submitIntake,redirect,responseHTML,securityHeaders,readStaticAsset,publicData} from './src/storage.mjs';
import {readPublishedRequestAsset} from './src/published-request-assets.mjs';
import {readOrganizationPhoto} from './src/organization-photos.mjs';
import {submitSpeakerSubmission,speakerSubmissionPage} from './src/speaker-submissions.mjs';
import {submissionPage,upcomingEvents,eventCalendar,publicExtension} from './src/public-tools.mjs';
import {memorialServices} from './src/memorial-day.mjs';
`;
const [publicCode,hqCode]=await Promise.all([
 bundleJavaScript({stdin:{contents:publicImports+publicRuntime,resolveDir:root,sourcefile:'imported-public-entry.mjs'}}),
 bundleJavaScript({stdin:{contents:"import {hqFetch} from './src/hq.mjs';\n"+hqRuntime,resolveDir:root,sourcefile:'imported-hq-entry.mjs'}})
]);
await fs.mkdir(path.join(root,'dist'),{recursive:true});
await fs.writeFile(path.join(root,'dist/worker.mjs'),publicCode);
await fs.writeFile(path.join(root,'dist/hq-worker.mjs'),hqCode);
await fs.writeFile(path.join(root,'dist/directory.json'),JSON.stringify(dataset,null,2));
console.log(JSON.stringify({status:'built',records:dataset.records.length,sources:dataset.sources.length,publicBytes:Buffer.byteLength(publicCode),hqBytes:Buffer.byteLength(hqCode)}));

