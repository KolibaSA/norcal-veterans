const publishedAssets={
 '/published-assets/vbc-yolo-solano.png':{
  key:'requests/618eb41a-a8cf-4cf3-87cc-def5105082c2/1c661dd2-54fd-46b0-a443-b19c97b76a2e',
  type:'image/png',size:1469913,
  sha256:'924d0e9cb9c8fdd6e15abd7c62e3db400f2b441cdf7653336f8310a826e2959a'
 },
 '/published-assets/norcal-veterans.png':{
  key:'requests/a5d549f1-1dca-4ba3-8564-3e5a933ef8c2/fc4c8d5e-24c9-4445-8878-7668e6c08915',
  type:'image/png',size:1481060,
  sha256:'4435dcb967330a0a74ebc58e28f34540da0087f7d61bfa989b9124ed5768b771'
 }
};
const headers={'X-Content-Type-Options':'nosniff','Cache-Control':'public, max-age=86400, immutable'};
const hex=bytes=>Array.from(new Uint8Array(bytes),byte=>byte.toString(16).padStart(2,'0')).join('');
export async function readPublishedRequestAsset(request,env,path){
 const asset=publishedAssets[path];if(!asset)return null;
 const fallback=()=>{const png=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Wl5sAAAAASUVORK5CYII='),c=>c.charCodeAt(0)),bytes=new Uint8Array(128);bytes.set(png);return new Response(request.method==='HEAD'?null:bytes,{headers:{...headers,'Content-Type':'image/png','Content-Length':String(bytes.length)}});};
 if(!env.ATTACHMENTS)return fallback();
 const object=await env.ATTACHMENTS.get(asset.key);if(!object)return fallback();
 try{
  const envelope=await object.json();
  if(envelope.schema_version!==1||envelope.byte_size!==asset.size||envelope.sha256!==asset.sha256||typeof envelope.base64!=='string'||envelope.base64.length!==4*Math.ceil(asset.size/3))return null;
  const decoded=atob(envelope.base64);if(decoded.length!==asset.size)return null;
  const bytes=Uint8Array.from(decoded,c=>c.charCodeAt(0));if(hex(await crypto.subtle.digest('SHA-256',bytes))!==asset.sha256)return null;
  return new Response(request.method==='HEAD'?null:bytes,{headers:{...headers,'Content-Type':asset.type,'Content-Length':String(asset.size)}});
 }catch{return fallback();}
}
