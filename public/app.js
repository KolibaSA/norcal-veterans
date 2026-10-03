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
 const updateCity=city=>{
  if(!cityOptions.has(city)||!citySection||!cityGrid)return false;
  safeWrite('localStorage',cityKey,city);
  const region=regionForCity(city);if(region)safeWrite('localStorage',regionKey,region);
  if(citySelect)citySelect.value=city;
  const description=citySection.querySelector('[data-city-description]');if(description)description.textContent=`Public organization profiles in ${city}.`;
  const sourceTiles=Array.from(document.querySelectorAll('.regional-directory .logo-tile[data-organization-city]')).filter(tile=>tile.dataset.organizationCity===city);
  cityGrid.replaceChildren(...sourceTiles.map(tile=>tile.cloneNode(true)));
  if(!sourceTiles.length){const empty=document.createElement('p');empty.className='city-nearby-empty';empty.textContent=`No public organization profiles are listed in ${city} yet. Browse the full regional directory below.`;cityGrid.append(empty);}
  citySection.hidden=false;
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
{
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const reveal=[...document.querySelectorAll('[data-reveal]')];
 if(reduced||!('IntersectionObserver' in window))reveal.forEach(item=>item.classList.add('is-visible'));
 else{
  const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target);}}),{rootMargin:'0px 0px -8% 0px',threshold:.08});
  reveal.forEach(item=>observer.observe(item));
 }
}
