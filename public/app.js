// Progressive enhancement only: native GET forms work without JavaScript.
document.documentElement.classList.add('js');
document.querySelectorAll('form:not([data-city-form])').forEach(form => form.addEventListener('submit', () => {
 const button=form.querySelector('button[type="submit"]');
 if(button){button.setAttribute('aria-busy','true');button.textContent='Loading…';}
}));
window.addEventListener('pageshow', () => document.querySelectorAll('button[aria-busy]').forEach(button=>{
 button.removeAttribute('aria-busy');button.textContent=button.closest('[role="search"]')?'Find organizations →':'Preview';
}));

const officerDetails=document.getElementById('officers');
const openOfficerDetails=()=>{if(officerDetails?.tagName==='DETAILS')officerDetails.open=true;};
document.querySelectorAll('a[href="#officers"]').forEach(link=>link.addEventListener('click',openOfficerDetails));
if(location.hash==='#officers')openOfficerDetails();
window.addEventListener('hashchange',()=>{if(location.hash==='#officers')openOfficerDetails();});

document.querySelectorAll('.branded-profile-heading').forEach(hero=>{
 const name=hero.querySelector('h1')?.textContent||'';
 const match=name.match(/\b(?:post|detachment|chapter|unit)\s*(?:no\.?\s*)?#?\s*([a-z]?\d+[a-z-]*)\b/i);
 if(match)hero.dataset.profileMark=match[1];
});

if(location.pathname==='/'||location.pathname==='/yolo-solano'){
 const dialog=document.getElementById('city-welcome'),cityForm=document.querySelector('[data-city-form]'),citySelect=cityForm?.elements.city,citySection=document.querySelector('[data-city-section]'),cityGrid=document.querySelector('[data-city-grid]');
 const cityKey='norcal-veterans-city',regionKey='norcal-veterans-region',skipKey='norcal-veterans-city-skip';
 const cityOptions=new Set(Array.from(citySelect?.options||[]).map(option=>option.value).filter(Boolean));
 const regionByCity={Woodland:'yolo-solano',Davis:'yolo-solano','West Sacramento':'yolo-solano',Winters:'yolo-solano',Benicia:'yolo-solano',Dixon:'yolo-solano',Fairfield:'yolo-solano','Rio Vista':'yolo-solano','Suisun City':'yolo-solano',Vacaville:'yolo-solano',Vallejo:'yolo-solano','Travis AFB':'yolo-solano',Cordelia:'yolo-solano'};
 const regionForCity=city=>cityOptions.has(city)?(regionByCity[city]||''):'';
 const safeRead=(kind,key)=>{try{return window[kind].getItem(key)||'';}catch{return '';}};
 const safeWrite=(kind,key,value)=>{try{window[kind].setItem(key,value);}catch{}};
 let citySequence=0,loadedCity=new URLSearchParams(location.search).get('city')||'';
 const updateCity=async city=>{
  if(!cityOptions.has(city)||!citySection||!cityGrid)return false;
  safeWrite('localStorage',cityKey,city);
  const region=regionForCity(city);if(region)safeWrite('localStorage',regionKey,region);
  if(citySelect)citySelect.value=city;
  const description=citySection.querySelector('[data-city-description]');if(description)description.textContent=`Public organization profiles in ${city}.`;
  citySection.hidden=false;
  const sequence=++citySequence;
  if(loadedCity!==city){
   const url=new URL(location.href);url.searchParams.set('city',city);url.hash='';
   cityGrid.setAttribute('aria-busy','true');
   try{
    const response=await fetch(url,{credentials:'omit'});if(!response.ok)throw new Error('City unavailable');
    const page=new DOMParser().parseFromString(await response.text(),'text/html'),replacement=page.querySelector('[data-city-grid]');
    if(!replacement)throw new Error('City unavailable');
    if(sequence===citySequence){cityGrid.replaceChildren(...Array.from(replacement.childNodes).map(node=>document.importNode(node,true)));loadedCity=city;}
   }catch{
    if(sequence===citySequence){const link=document.createElement('a');link.href=url.href;link.textContent='Open organizations near '+city;cityGrid.replaceChildren(link);loadedCity='';}
   }finally{if(sequence===citySequence)cityGrid.removeAttribute('aria-busy');}
  }else cityGrid.removeAttribute('aria-busy');
  return true;
 };
 const requestedCity=new URLSearchParams(location.search).get('city'),savedCity=safeRead('localStorage',cityKey),initialCity=cityOptions.has(requestedCity)?requestedCity:(cityOptions.has(savedCity)?savedCity:'');
 if(initialCity)updateCity(initialCity);
 else safeWrite('localStorage',regionKey,'yolo-solano');
 cityForm?.addEventListener('submit',event=>{
  const city=citySelect?.value||'';
  if(!cityOptions.has(city))return;
  event.preventDefault();updateCity(city);dialog?.close();safeWrite('sessionStorage',skipKey,'1');
 });
 document.querySelectorAll('[data-city-change]').forEach(button=>button.addEventListener('click',()=>dialog?.showModal()));
 document.querySelectorAll('[data-city-skip]').forEach(button=>button.addEventListener('click',()=>{safeWrite('sessionStorage',skipKey,'1');dialog?.close();}));
 if(dialog&&!initialCity&&!safeRead('sessionStorage',skipKey))try{dialog.showModal();}catch{}
}
// Populate a continuous directory from bounded regional queries. Native links
// remain available when JavaScript is unavailable; visitors using JS never
// need to move between directory pages.
{
 const directory=document.querySelector('[data-directory-autoload]');
 const results=directory?.querySelector('[data-directory-results]');
 const navigation=directory?.querySelector('[data-directory-pages]');
 const status=directory?.querySelector('[data-directory-status]');
 const count=directory?.querySelector('[data-directory-count]');
 const place=directory?.querySelector('[name="place"]')?.value||'';
 let next=navigation?.querySelector('[data-directory-next]')?.href,loading=false;
 const seen=new Set(Array.from(results?.querySelectorAll('[data-organization-id]')||[]).map(card=>card.dataset.organizationId));
 const order=(a,b)=>Number(a.dataset.directoryOrder)-Number(b.dataset.directoryOrder)||(a.getAttribute('aria-label')||'').localeCompare(b.getAttribute('aria-label')||'');
 const merge=page=>{
  const incoming=page.querySelector('[data-directory-results]');
  if(!incoming)throw new Error('Directory unavailable');
  for(const category of incoming.querySelectorAll('.logo-category')){
   let target=Array.from(results.children).find(node=>node.id===category.id);
   if(!target){target=document.importNode(category,true);target.querySelectorAll('.logo-type-group').forEach(node=>node.remove());results.append(target);}
   for(const group of category.querySelectorAll('.logo-type-group')){
    let destination=Array.from(target.querySelectorAll('.logo-type-group')).find(node=>node.dataset.organizationType===group.dataset.organizationType);
    if(!destination){destination=document.importNode(group,true);destination.querySelector('.logo-grid').replaceChildren();target.append(destination);}
    const grid=destination.querySelector('.logo-grid');
    for(const card of group.querySelectorAll('[data-organization-id]'))if(!seen.has(card.dataset.organizationId)){
     seen.add(card.dataset.organizationId);grid.append(document.importNode(card,true));
    }
    grid.append(...Array.from(grid.children).sort((a,b)=>Number(b.dataset.organizationCity===place)-Number(a.dataset.organizationCity===place)||(a.dataset.organizationCity||'').localeCompare(b.dataset.organizationCity||'')||(a.dataset.organizationName||'').localeCompare(b.dataset.organizationName||'')));
    const n=grid.children.length;destination.querySelector('.logo-type-heading span').textContent=`${n} ${n===1?'connection':'connections'}`;
   }
   target.append(...Array.from(target.querySelectorAll('.logo-type-group')).sort(order));
  }
  results.append(...Array.from(results.children).sort(order));
  if(count)count.textContent=`${seen.size} ${seen.size===1?'organization':'organizations'}`;
 };
 const load=async()=>{
  if(!results||!next||loading)return;
  loading=true;navigation.hidden=true;status.replaceChildren();status.textContent='Loading all organizations…';results.setAttribute('aria-busy','true');
  const visited=new Set();
  try{
   while(next){
    const url=new URL(next,location.href);
    if(url.origin!==location.origin||visited.has(url.href))throw new Error('Directory unavailable');
    visited.add(url.href);
    const response=await fetch(url,{credentials:'omit'});if(!response.ok)throw new Error('Directory unavailable');
    const page=new DOMParser().parseFromString(await response.text(),'text/html');
    merge(page);next=page.querySelector('[data-directory-pages] [data-directory-next]')?.href;
   }
   navigation.remove();status.textContent='';
  }catch{
   status.textContent='Some organizations could not load. ';
   const retry=document.createElement('button');retry.type='button';retry.className='button outline';retry.textContent='Try again';retry.addEventListener('click',load);status.append(retry);
  }finally{loading=false;results.removeAttribute('aria-busy');}
 };
 if(next)load();
}
// Enhance archive pagination while keeping its normal links usable without JS.
document.addEventListener('click',async event=>{
 const link=event.target.closest?.('a[data-archive-more]');
 if(!link||event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
 if(link.dataset.loading){event.preventDefault();return;}
 const archive=link.closest('#past-events'),grid=archive?.querySelector('.event-card-grid');
 if(!grid)return;
 event.preventDefault();link.dataset.loading='true';link.setAttribute('aria-busy','true');
 try{
  const response=await fetch(link.href,{credentials:'omit'});
  if(!response.ok)throw new Error('Archive unavailable');
  const page=new DOMParser().parseFromString(await response.text(),'text/html');
  const additional=page.querySelector('#past-events .event-card-grid');
  if(!additional)throw new Error('Archive unavailable');
  grid.append(...Array.from(additional.children).map(node=>document.importNode(node,true)));
  const note=archive.querySelector('.results-note');
  if(note)note.textContent=note.textContent.replace(/^\d+ past listings/,grid.children.length+' past listings');
  const next=page.querySelector('#past-events a[data-archive-more]');
  if(next)link.replaceWith(document.importNode(next,true));else link.remove();
 }catch{link.textContent='Open the next page';delete link.dataset.archiveMore;}
 finally{link.removeAttribute('aria-busy');delete link.dataset.loading;}
});
{
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const reveal=[...document.querySelectorAll('[data-reveal]')];
 if(reduced||!('IntersectionObserver' in window))reveal.forEach(item=>item.classList.add('is-visible'));
 else{
  const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target);}}),{rootMargin:'0px 0px -8% 0px',threshold:.08});
  reveal.forEach(item=>observer.observe(item));
 }
}
// Load the event archive only after its disclosure is opened. The ordinary
// link and GET form remain usable without JavaScript or if the request fails.
{
 const archive=document.querySelector('[data-archive-url]');
 let loading=false,loaded=false;
 archive?.addEventListener('toggle',async()=>{
  if(!archive.open||loading||loaded)return;
  const content=archive.querySelector('[data-archive-content]');
  const status=archive.querySelector('[data-archive-status]');
  loading=true;content.setAttribute('aria-busy','true');status.textContent='Loading past events…';
  try{
   const response=await fetch(archive.dataset.archiveUrl,{credentials:'omit'});
   if(!response.ok)throw new Error('Archive unavailable');
   const page=new DOMParser().parseFromString(await response.text(),'text/html');
   const replacement=page.querySelector('#past-events [data-archive-content]');
   if(!replacement)throw new Error('Archive unavailable');
   content.replaceChildren(...Array.from(replacement.childNodes).map(node=>document.importNode(node,true)));
   loaded=true;
  }catch{
   status.textContent='Past events could not load. Use the link below to try again.';
  }finally{
   loading=false;content.removeAttribute('aria-busy');
  }
 });
}
