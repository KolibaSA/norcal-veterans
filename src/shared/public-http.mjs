export const securityHeaders={'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'strict-origin-when-cross-origin','Permissions-Policy':'camera=(), microphone=(), geolocation=()','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"};
export function safeURL(value,required=false){
 const text=String(value||'').trim(); if(!text&&!required)return '';
 let u;try{u=new URL(text);}catch{throw new Error('Use a complete https:// source or website link.');}
 if(u.protocol!=='https:'||u.username||u.password||u.href.length>2000)throw new Error('Links must use HTTPS without a username or password.');
 return u.href;
}
export function field(form,key,max=500,required=false){const s=String(form.get(key)||'').trim();if(s.length>max||s.includes('\u0000'))throw new Error(`${key.replaceAll('_',' ')} is too long or invalid.`);if(required&&!s)throw new Error(`Please provide ${key.replaceAll('_',' ')}.`);return s;}
export function choice(value,choices){if(!choices.includes(value))throw new Error('Choose a valid option.');return value;}
export async function formData(request){
 const url=new URL(request.url);
 if(request.headers.get('Origin')!==url.origin||request.headers.get('Sec-Fetch-Site')==='cross-site')throw new Error('Please submit this form from its original page.');
 if(!request.headers.get('Content-Type')?.startsWith('application/x-www-form-urlencoded'))throw new Error('Unsupported form format.');
 const reader=request.body?.getReader();if(!reader)throw new Error('Empty form.');let size=0,chunks=[];
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>24000){await reader.cancel();throw new Error('This submission is too large.');}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 return new URLSearchParams(new TextDecoder().decode(bytes));
}
export const responseHTML=(html,status=200,privatePage=false)=>new Response(html,{status,headers:{...securityHeaders,'Content-Type':'text/html; charset=utf-8','Cache-Control':privatePage?'no-store':'public, max-age=30',...(privatePage?{'X-Robots-Tag':'noindex, nofollow'}:{})}});
export const redirect=path=>new Response(null,{status:303,headers:{Location:path,'Cache-Control':'no-store'}});
