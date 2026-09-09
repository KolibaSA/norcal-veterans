// This refreshes the page only when no form has been touched. It never calls an AI.
if ((new URLSearchParams(location.search).get('tab') || 'requests') === 'requests') {
 let dirty=false, previous=null;
 document.addEventListener('input',()=>{dirty=true;});
 async function check(){
  if(document.hidden)return;
  try{
   const response=await fetch('/request-state',{cache:'no-store'});
   if(!response.ok||!response.headers.get('content-type')?.includes('application/json'))return;
   const current=JSON.stringify(await response.json());
   if(previous&&previous!==current){
    if(!dirty){location.reload();return;}
    if(!document.querySelector('.request-updated')){
     const notice=document.createElement('p');notice.className='request-updated';notice.setAttribute('role','status');
     const link=document.createElement('a');link.href=location.href;link.textContent='New progress is available. Finish your message, then refresh.';
     notice.append(link);document.querySelector('main')?.prepend(notice);
    }
   }
   previous=current;
  }catch{/* The next check retries without disturbing a message being written. */}
 }
 check();setInterval(check,30000);
}
