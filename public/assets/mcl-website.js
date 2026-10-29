// The child website reports its natural content height. Only this frame and its
// exact origin can resize the embedded area; other windows/messages are ignored.
(() => {
 const frame=document.querySelector('.organization-website-frame');
 if(!frame)return;
 const origin=new URL(frame.src).origin;
 const connect=()=>frame.contentWindow?.postMessage({type:'norcal:website:init',version:1,viewportHeight:window.innerHeight},origin);
 window.addEventListener('message',event=>{
  if(event.origin!==origin||event.source!==frame.contentWindow)return;
  const data=event.data;
  if(data?.type!=='norcal:website:height'||data.version!==1||!Number.isFinite(data.height)||data.height<200||data.height>60000)return;
  frame.style.height=Math.ceil(data.height)+'px';
  frame.setAttribute('data-website-expanded','');
  frame.setAttribute('scrolling','no');
 });
 frame.addEventListener('load',connect);
 let pending=false;
 window.addEventListener('resize',()=>{
  if(pending)return;
  pending=true;
  requestAnimationFrame(()=>{pending=false;connect();});
 });
 connect();
})();
