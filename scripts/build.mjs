import fs from 'node:fs/promises';
import path from 'node:path';
import {dataset} from '../src/data.mjs';
import {brandLogos} from '../src/logos.mjs';
const root=path.resolve(import.meta.dirname,'..');
// The embedded NorCal HQ is served as a module; keep it generated from its HTML source.
const headquarters=await fs.readFile(path.join(root,'worker','legacy','hq.html'),'utf8');
await fs.writeFile(path.join(root,'worker','legacy','hq-template.mjs'),'export default '+JSON.stringify(headquarters)+';\n');
const assets={};
for(const [name,type] of [['styles.css','text/css; charset=utf-8'],['app.js','application/javascript; charset=utf-8'],['hq.js','application/javascript; charset=utf-8'],['favicon.svg','image/svg+xml']]){
 const bytes=await fs.readFile(path.join(root,'public',name));assets['/'+name]={type,base64:bytes.toString('base64')};
}
for(const [name,type] of [['ysv-logo.png','image/png'],['og.png','image/png']]){
 const bytes=(await fs.readFile(path.join(root,'public',name)));assets['/'+name]={type,base64:bytes.toString('base64')};
}
const usedLogoPaths=new Set(Object.values(brandLogos).map(logo=>logo.src));
for(const name of await fs.readdir(path.join(root,'public','logos'))){
 if(!usedLogoPaths.has('/logos/'+name))continue;
 const ext=path.extname(name).toLowerCase(),type={'.png':'image/png','.svg':'image/svg+xml','.jpg':'image/jpeg'}[ext];if(!type)continue;
 const bytes=(await fs.readFile(path.join(root,'public','logos',name)));assets['/logos/'+name]={type,base64:bytes.toString('base64')};
}
async function source(name){return (await fs.readFile(path.join(root,'src',name),'utf8')).replace(/^import .*;\r?\n/gm,'').replace(/^export \{dataset\};?\r?\n?/gm,'').replace(/^export /gm,'');}
const shared=(await Promise.all(['public-privacy.mjs','buddy-poppy-events.mjs','research-additions.mjs','data.mjs','logos.mjs','organization-links.mjs','public-calendar.mjs','resources.mjs','site.mjs','storage.mjs','published-request-assets.mjs','speaker-submissions.mjs','organization-meetings.mjs','event-collaboration.mjs','organization-photos.mjs','organization-officers.mjs'].map(source))).join('\n');
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
const publicCode=shared+'\n'+await source('memorial-day.mjs')+'\n'+await source('public-tools.mjs')+'\n'+publicRuntime;
const hqCode=shared+'\n'+await source('hq-library.mjs')+'\n'+await source('work-requests.mjs')+'\n'+await source('request-attachments.mjs')+'\n'+await source('organization-access.mjs')+'\n'+await source('organization-pages.mjs')+'\n'+await source('organization-profile.mjs')+'\n'+await source('hq.mjs')+'\n'+hqRuntime;
await fs.mkdir(path.join(root,'dist'),{recursive:true});
await fs.writeFile(path.join(root,'dist/worker.mjs'),publicCode);
await fs.writeFile(path.join(root,'dist/hq-worker.mjs'),hqCode);
await fs.writeFile(path.join(root,'dist/directory.json'),JSON.stringify(dataset,null,2));
console.log(JSON.stringify({status:'built',records:dataset.records.length,sources:dataset.sources.length,publicBytes:Buffer.byteLength(publicCode),hqBytes:Buffer.byteLength(hqCode)}));

