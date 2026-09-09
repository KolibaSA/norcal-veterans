import {redirect} from './storage.mjs';
import {workRequestAction} from './work-requests.mjs';

const attachmentMaxFile=10*1024*1024,attachmentMaxBody=11*1024*1024,attachmentMaxTotal=250*1024*1024;
const attachmentTypes={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif',svg:'image/svg+xml',pdf:'application/pdf',txt:'text/plain',csv:'text/csv',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation',zip:'application/zip'};
const attachmentIdOK=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(id);
const attachmentPrivateHeaders={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow','Content-Security-Policy':"default-src 'none'; sandbox",'X-Frame-Options':'DENY'};

function attachmentBase64(buffer){
 const bytes=new Uint8Array(buffer);let binary='';
 for(let offset=0;offset<bytes.length;offset+=32768)binary+=String.fromCharCode(...bytes.subarray(offset,offset+32768));
 return btoa(binary);
}

function attachmentText(form,name,max,required=false){
 const entries=form.getAll(name);
 if(entries.length>1||entries.some(value=>typeof value!=='string'))throw new Error('Invalid attachment form. Please reload the request.');
 const value=(entries[0]||'').trim();
 if(value.length>max||value.includes('\u0000')||(required&&!value))throw new Error(`Please provide a valid ${name.replaceAll('_',' ')}.`);
 return value;
}

async function attachmentForm(request,mode='existing'){
 if(request.method!=='POST')throw new Error('Use the request attachment form to upload a file.');
 if(request.headers.get('Origin')!==new URL(request.url).origin||request.headers.get('Sec-Fetch-Site')==='cross-site')throw new Error('Please submit this form from its original HQ page.');
 const contentType=request.headers.get('Content-Type')||'';
 if(!/^multipart\/form-data\s*;/i.test(contentType))throw new Error('Use the attachment form to choose a file.');
 const declared=Number(request.headers.get('Content-Length'));
 if(Number.isFinite(declared)&&declared>attachmentMaxBody)throw new Error('Choose a file no larger than 10 MB.');
 const reader=request.body?.getReader();
 if(!reader)throw new Error('Please choose a file.');
 let size=0;const chunks=[];
 try{
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>attachmentMaxBody){await reader.cancel();throw new Error('Choose a file no larger than 10 MB.');}chunks.push(value);}
 }finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;
 for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 let form;try{form=await new Response(bytes,{headers:{'Content-Type':contentType}}).formData();}catch{throw new Error('The attachment form could not be read. Please choose the file again.');}
 let fileCount=0;
 const allowed=mode==='create'?['action','id','details','target','title','file','note']:['request_id','version','file','note'];
 for(const [name,value] of form){if(!allowed.includes(name))throw new Error('Invalid attachment form.');if(typeof value!=='string')fileCount++;}
 const files=form.getAll('file');
 if(mode==='create'){
  if(fileCount>1||files.length>1||files.some(file=>typeof file==='string'))throw new Error('Choose one file at a time.');
  const file=files[0]&&typeof files[0].arrayBuffer==='function'&&files[0].size?files[0]:null;
  return {form,file};
 }
 if(fileCount!==1||files.length!==1||typeof files[0]==='string'||typeof files[0].arrayBuffer!=='function')throw new Error('Choose one file at a time.');
 return {form,file:files[0]};
}

function attachmentFilename(input){
 const base=String(input).replaceAll('\\','/').split('/').pop().normalize('NFC');
 const ext=base.split('.').pop().toLowerCase();
 if(!base.includes('.')||!Object.hasOwn(attachmentTypes,ext))throw new Error('Choose PNG, JPG, WebP, GIF, SVG, PDF, TXT, CSV, Word, Excel, PowerPoint, or ZIP.');
 const cleaned=base.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069<>:"/\\|?*]/g,'_').replace(/^[.\s]+|[.\s]+$/g,'');
 const stem=Array.from(cleaned.slice(0,-ext.length-1)).slice(0,150).join('')||'file';
 return {filename:`${stem}.${ext}`,contentType:attachmentTypes[ext]};
}

async function attachmentCleanup(bucket,key,id){
 try{await bucket.delete(key);}catch{
  // Never remove other uploads. This random key identifies the orphan for retry.
  console.error(JSON.stringify({event:'request_attachment_cleanup_pending',attachment_id:id,object_key:key}));
 }
}

export async function uploadRequestAttachment(request,env,actor){
 if(!env.DB||!env.ATTACHMENTS)throw new Error('File uploads are temporarily unavailable. Your request is still saved.');
 const {form,file}=await attachmentForm(request);
 const requestId=attachmentText(form,'request_id',100,true),version=Number(attachmentText(form,'version',30,true)),note=attachmentText(form,'note',2000);
 if(!attachmentIdOK(requestId)||!Number.isSafeInteger(version)||version<1)throw new Error('Reload the request before uploading.');
 if(file.size<1||file.size>attachmentMaxFile)throw new Error('Choose a nonempty file no larger than 10 MB.');
 const {filename,contentType}=attachmentFilename(file.name);
 const current=(await env.DB.prepare('SELECT id,version FROM work_requests WHERE id=? AND version=?').bind(requestId,version).all()).results;
 if(current.length!==1)throw new Error('This request changed. Reload it before uploading the file.');
 const total=(await env.DB.prepare('SELECT COALESCE(SUM(byte_size),0) AS total FROM work_request_attachments').all()).results[0]?.total||0;
 if(Number(total)+file.size>attachmentMaxTotal)throw new Error('HQ attachment storage is full. Ask Chat to help organize the files before adding more.');
 const bytes=await file.arrayBuffer();
 if(bytes.byteLength!==file.size||bytes.byteLength>attachmentMaxFile)throw new Error('The file could not be read safely. Please choose it again.');
 const digest=await crypto.subtle.digest('SHA-256',bytes),sha256=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
 const id=crypto.randomUUID(),key=`requests/${requestId}/${id}`,now=new Date().toISOString();
 const nextActive=new Date(Date.now()+60*60*1000).toISOString(),body=`Attached ${filename} (${bytes.byteLength} bytes).${note?'\n\n'+note:''}`;
 const destination=`/?tab=requests&view=all#request-${requestId}`;
 try{
  // A JSON envelope makes the exact file retrievable through the authenticated
  // processor connector, which exposes JSON but does not expose raw binary.
  const envelope=JSON.stringify({schema_version:1,base64:attachmentBase64(bytes),byte_size:bytes.byteLength,sha256});
  // The connector treats application/json as a Cloudflare API response envelope.
  // text/plain preserves this JSON document verbatim for lossless processor reads.
  const stored=await env.ATTACHMENTS.put(key,envelope,{httpMetadata:{contentType:'text/plain'},customMetadata:{attachment_id:id,sha256}});
  if(!stored)throw new Error('Attachment storage did not accept the file.');
 }catch(error){await attachmentCleanup(env.ATTACHMENTS,key,id);throw new Error('The file could not be stored. Please try again; your request is unchanged.');}
 let out;
 try{
  // D1 batches are atomic. The first statement owns this exact request version;
  // changes() gates each subsequent write and the storage cap is checked inside it.
  out=await env.DB.batch([
   env.DB.prepare("UPDATE work_requests SET status='queued',suggestion='',last_actor=?,version=version+1,claim_token=NULL,claim_until=NULL,updated_at=? WHERE id=? AND version=? AND (SELECT COALESCE(SUM(byte_size),0) FROM work_request_attachments)+?<=? RETURNING id").bind(actor,now,requestId,version,bytes.byteLength,attachmentMaxTotal),
   env.DB.prepare('INSERT INTO work_request_attachments(id,request_id,object_key,filename,content_type,byte_size,sha256,uploaded_by,created_at) SELECT ?,?,?,?,?,?,?,?,? WHERE changes()>0').bind(id,requestId,key,filename,contentType,bytes.byteLength,sha256,actor,now),
   env.DB.prepare("INSERT INTO work_request_messages(id,request_id,actor,kind,body,created_at) SELECT ?,?,?,'reply',?,? WHERE changes()>0").bind(crypto.randomUUID(),requestId,actor,body,now),
   env.DB.prepare("INSERT INTO audit(id,actor,action,record_id,created_at) SELECT ?,?,'work_attachment_upload',?,? WHERE changes()>0").bind(crypto.randomUUID(),actor,requestId,now),
   env.DB.prepare("UPDATE request_processor SET last_activity_at=?,active_until=? WHERE id='main' AND changes()>0").bind(now,nextActive)
  ]);
 }catch(error){
  // A transport failure can occur after commit. Check before deleting a file that
  // might already be linked to the request; preserve uncertain objects for repair.
  let saved;
  try{saved=(await env.DB.prepare('SELECT id FROM work_request_attachments WHERE id=? AND object_key=?').bind(id,key).all()).results;}
  catch{console.error(JSON.stringify({event:'request_attachment_commit_unknown',attachment_id:id,object_key:key}));throw new Error('The upload status could not be confirmed. Refresh this request before trying again.');}
  if(saved.length===1)return redirect(destination);
  await attachmentCleanup(env.ATTACHMENTS,key,id);
  throw new Error('The file could not be attached. Please reload the request and try again.');
 }
 if(out[0]?.results?.length!==1){await attachmentCleanup(env.ATTACHMENTS,key,id);throw new Error('This request changed or attachment storage filled while uploading. Reload it before trying again.');}
 return redirect(destination);
}

export async function createWorkRequestWithAttachment(request,env,actor){
 if(!env.DB||!env.ATTACHMENTS)throw new Error('The request desk is temporarily unavailable. Please try again later.');
 const {form,file}=await attachmentForm(request,'create');
 const id=attachmentText(form,'id',100,true);
 if(!attachmentIdOK(id))throw new Error('Reload Requests before submitting.');
 await workRequestAction(form,env.DB,actor);
 if(!file)return redirect(`/?tab=requests&view=active#request-${id}`);
 const upload=new FormData();upload.set('request_id',id);upload.set('version','1');upload.set('file',file);
 const note=attachmentText(form,'note',2000);if(note)upload.set('note',note);
 const origin=new URL(request.url).origin;
 const forwarded=new Request(origin+'/attachments',{method:'POST',headers:{Origin:origin,'Sec-Fetch-Site':'same-origin'},body:upload});
 try{await uploadRequestAttachment(forwarded,env,actor);}
 catch(error){throw new Error(`Your request was saved, but its file was not attached. Open the request and try Upload file to Chat. ${error.message}`);}
 return redirect(`/?tab=requests&view=active#request-${id}`);
}

export async function downloadRequestAttachment(request,env,id){
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed.',{status:405,headers:{...attachmentPrivateHeaders,Allow:'GET, HEAD'}});
 const missing=()=>new Response('Attachment not found.',{status:404,headers:attachmentPrivateHeaders});
 if(!attachmentIdOK(id)||!env.DB||!env.ATTACHMENTS)return missing();
 const row=(await env.DB.prepare('SELECT id,object_key,filename,byte_size,sha256 FROM work_request_attachments WHERE id=?').bind(id).all()).results[0];
 if(!row)return missing();
 const object=await env.ATTACHMENTS.get(row.object_key);if(!object)return missing();
 if(!Number.isSafeInteger(row.byte_size)||row.byte_size<1||row.byte_size>attachmentMaxFile||object.size>4*Math.ceil(attachmentMaxFile/3)+1024)throw new Error('This attachment could not be verified. Please ask Chat to check it.');
 let bytes;
 try{
  const envelope=await object.json();
  if(envelope.schema_version!==1||envelope.byte_size!==row.byte_size||envelope.sha256!==row.sha256||typeof envelope.base64!=='string'||envelope.base64.length!==4*Math.ceil(row.byte_size/3))throw new Error('Invalid file envelope.');
  const decoded=atob(envelope.base64);
  if(decoded.length!==row.byte_size)throw new Error('Invalid file size.');
  bytes=Uint8Array.from(decoded,c=>c.charCodeAt(0));
  const digest=await crypto.subtle.digest('SHA-256',bytes),sha256=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
  if(sha256!==row.sha256)throw new Error('Invalid file checksum.');
 }catch{throw new Error('This attachment could not be verified. Please ask Chat to check it.');}
 const filename=String(row.filename).replace(/[\r\n\u0000]/g,'_');
 const fallback=filename.replace(/[^a-zA-Z0-9._ -]/g,'_').slice(0,180)||'attachment';
 const encoded=encodeURIComponent(filename).replace(/[!'()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase());
 const headers={...attachmentPrivateHeaders,'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`,'Content-Length':String(bytes.byteLength)};
 return new Response(request.method==='HEAD'?null:bytes,{headers});
}

