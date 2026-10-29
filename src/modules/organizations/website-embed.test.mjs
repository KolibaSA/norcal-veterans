import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../../../public/assets/mcl-website.js',import.meta.url),'utf8');
function setup(){
 const messages=[],listeners={},frameListeners={},attributes={};
 const child={postMessage:(...args)=>messages.push(args)};
 const frame={src:'https://www.yolomarines.org/',contentWindow:child,style:{},setAttribute:(key,value)=>attributes[key]=value,addEventListener:(name,fn)=>frameListeners[name]=fn};
 const window={innerHeight:900,addEventListener:(name,fn)=>listeners[name]=fn};
 runInNewContext(source,{document:{querySelector:()=>frame},window,URL,requestAnimationFrame:fn=>fn()});
 return {messages,listeners,frameListeners,attributes,frame,child,window};
}
test('embedded website resizing rejects foreign windows, origins and invalid heights',()=>{
 const f=setup(),valid={type:'norcal:website:height',version:1,height:6000};
 for(const event of [
  {origin:'https://evil.test',source:f.child,data:valid},
  {origin:'https://www.yolomarines.org',source:{},data:valid},
  ...[NaN,Infinity,-1,0,199,60001,'6000'].map(height=>({origin:'https://www.yolomarines.org',source:f.child,data:{...valid,height}})),
  {origin:'https://www.yolomarines.org',source:f.child,data:{...valid,version:2}}
 ])f.listeners.message(event);
 assert.equal(f.frame.style.height,undefined);
 assert.equal(f.attributes.scrolling,undefined);
 f.listeners.message({origin:'https://www.yolomarines.org',source:f.child,data:valid});
 assert.equal(f.frame.style.height,'6000px');
 assert.equal(f.attributes.scrolling,'no');
 assert.equal(f.attributes['data-website-expanded'],'');
 f.listeners.message({origin:'https://www.yolomarines.org',source:f.child,data:{...valid,height:4200.2}});
 assert.equal(f.frame.style.height,'4201px');
});
test('website handshake supplies the parent viewport again after load and resizing',()=>{
 const f=setup();
 assert.equal(f.messages[0][1],'https://www.yolomarines.org');
 assert.equal(f.messages[0][0].viewportHeight,900);
 f.frameListeners.load();
 f.window.innerHeight=700;f.listeners.resize();
 assert.equal(f.messages.length,3);
 assert.equal(f.messages[2][0].viewportHeight,700);
 assert.equal(f.messages[2][0].type,'norcal:website:init');
});
