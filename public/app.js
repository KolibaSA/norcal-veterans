// Progressive enhancement only: native GET forms work without JavaScript.
document.documentElement.classList.add('js');
document.querySelectorAll('form').forEach(form => form.addEventListener('submit', () => {
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

if(location.pathname==='/'||location.pathname==='/yolo-solano')try{localStorage.setItem('norcal-veterans-region','yolo-solano');}catch{}
{
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const reveal=[...document.querySelectorAll('[data-reveal]')];
 if(reduced||!('IntersectionObserver' in window))reveal.forEach(item=>item.classList.add('is-visible'));
 else{
  const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target);}}),{rootMargin:'0px 0px -8% 0px',threshold:.08});
  reveal.forEach(item=>observer.observe(item));
 }
}
