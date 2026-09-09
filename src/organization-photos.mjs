import {formData,safeURL,redirect} from './storage.mjs';
import {records} from './data.mjs';
import {assertPublicProfilePrivacy} from './public-privacy.mjs';

const organizationPhotoMax=5*1024*1024,organizationPhotoBodyMax=organizationPhotoMax+64*1024,organizationPhotoLimit=12;
const organizationPhotoID=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(value);
const organizationPhotoHeaders={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox",'X-Frame-Options':'DENY'};
const organizationPhotoScope="(?=1 OR EXISTS(SELECT 1 FROM organization_editors WHERE email=? AND org_id=? AND status='active'))";
const organizationPhotoSHA=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
function organizationPhotoBase64(bytes){let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(binary);}
function organizationPhotoText(form,name,max,required=false){const values=form.getAll(name);if(values.length>1||values.some(v=>typeof v!=='string'))throw new Error('Please reload the photo form and try again.');const value=(values[0]||'').trim();if(value.length>max||value.includes('\u0000')||(required&&!value))throw new Error('Please provide a valid '+name.replaceAll('_',' ')+'.');return value;}
function organizationPhotoPermission(principal,orgId){const email=String(principal?.email||'').toLowerCase();if(!email||!records.some(r=>r.id===orgId)||(!principal.isAdmin&&!principal.memberships?.some(m=>m.org_id===orgId&&m.status==='active'&&m.email.toLowerCase()===email)))throw new Error('You do not have access to update this organization.');return [principal.isAdmin?1:0,email,orgId];}
function organizationPhotoIDs(form,name,owner){
 const values=[...new Set(form.getAll(name).map(value=>typeof value==='string'?value.trim():'').filter(Boolean))];
 if(values.length>12||values.some(value=>!organizationPhotoID(value)||!records.some(record=>record.id===value)))throw new Error('Choose valid organizations for this photo.');
 return values.filter(value=>value!==owner);
}

// Read only IFD0's standard inline SHORT orientation. Never follow GPS, camera,
// thumbnail or arbitrary offset trees; rebuild a minimal metadata block instead.
function organizationPhotoOrientation(input){
 let bytes=input;if(bytes.length>=6&&bytes[0]===69&&bytes[1]===120&&bytes[2]===105&&bytes[3]===102&&bytes[4]===0&&bytes[5]===0)bytes=bytes.subarray(6);
 if(bytes.length<8)return null;const little=bytes[0]===73&&bytes[1]===73,big=bytes[0]===77&&bytes[1]===77;if(!little&&!big)return null;
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);if(view.getUint16(2,little)!==42)return null;const start=view.getUint32(4,little);if(start<8||start+2>bytes.length)return null;const count=view.getUint16(start,little);if(count>256||start+2+count*12+4>bytes.length)return null;
 for(let i=0;i<count;i++){const at=start+2+i*12;if(view.getUint16(at,little)!==274)continue;if(view.getUint16(at+2,little)!==3||view.getUint32(at+4,little)!==1)return null;const value=view.getUint16(at+8,little);return value>=1&&value<=8?value:null;}return null;
}
const organizationPhotoOrientationTIFF=value=>Uint8Array.from([73,73,42,0,8,0,0,0,1,0,18,1,3,0,1,0,0,0,value,0,0,0,0,0,0,0]);

// Remove embedded location/camera/comment metadata before publication. Pixel data
// is preserved; SVG and other executable formats are never accepted.
export function cleanOrganizationPhoto(input,declaredType){
 const bytes=input instanceof Uint8Array?input:new Uint8Array(input),pieces=[];
 if(bytes.length<12||bytes.length>organizationPhotoMax)throw new Error('Choose a JPG, PNG or WebP photo no larger than 5 MB.');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),ascii=(start,end)=>String.fromCharCode(...bytes.subarray(start,end));
 const invalid=()=>{throw new Error('This photo could not be read. Save it as a JPG, PNG or WebP image and try again.');};
 let type;
 if(bytes[0]===137&&ascii(1,4)==='PNG'&&bytes[4]===13&&bytes[5]===10&&bytes[6]===26&&bytes[7]===10){
  type='image/png';pieces.push(bytes.subarray(0,8));let cursor=8,ended=false,hasData=false,hasHeader=false;
  while(cursor+12<=bytes.length){const size=view.getUint32(cursor),kind=ascii(cursor+4,cursor+8),end=cursor+12+size;if(end>bytes.length)invalid();
   if(!hasHeader&&kind!=='IHDR')invalid();
   if(kind==='IHDR'){if(hasHeader||size!==13)invalid();const width=view.getUint32(cursor+8),height=view.getUint32(cursor+12);if(!width||!height||width*height>50000000)invalid();hasHeader=true;}
   if(kind==='IDAT')hasData=true;
   if(!['eXIf','tEXt','zTXt','iTXt','tIME'].includes(kind))pieces.push(bytes.subarray(cursor,end));
   cursor=end;if(kind==='IEND'){if(size!==0)invalid();ended=true;break;}
  }
  if(!ended||!hasData)invalid();
 }else if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255){
  type='image/jpeg';pieces.push(bytes.subarray(0,2));let cursor=2,scan=false,frame=false,ended=false,orientationSaved=false;
  while(cursor<bytes.length){const start=cursor;if(bytes[cursor++]!==255)invalid();while(bytes[cursor]===255)cursor++;const marker=bytes[cursor++];if(marker===217){pieces.push(bytes.subarray(start,cursor));ended=true;break;}if(marker===0||marker===216||cursor+2>bytes.length)invalid();const size=view.getUint16(cursor),end=cursor+size;if(size<2||end>bytes.length)invalid();
   if([192,193,194].includes(marker)){if(size<8)invalid();const height=view.getUint16(cursor+3),width=view.getUint16(cursor+5);if(!width||!height||width*height>50000000)invalid();frame=true;}
   if(marker===218){if(!frame)invalid();pieces.push(bytes.subarray(start,end));scan=true;cursor=end;const entropyStart=cursor;let found=false;
    while(cursor<bytes.length){if(bytes[cursor]!==255){cursor++;continue;}const markerStart=cursor;while(bytes[cursor]===255)cursor++;const next=bytes[cursor];if(next===0||next>=208&&next<=215){cursor++;continue;}pieces.push(bytes.subarray(entropyStart,markerStart));cursor=markerStart;found=true;break;}if(!found)invalid();continue;
   }
   if(marker===225&&!orientationSaved){const orientation=organizationPhotoOrientation(bytes.subarray(cursor+2,end));if(orientation){pieces.push(Uint8Array.from([255,225,0,34,69,120,105,102,0,0,...organizationPhotoOrientationTIFF(orientation)]));orientationSaved=true;}}
   if(![225,237,254].includes(marker))pieces.push(bytes.subarray(start,end));cursor=end;
  }
  if(!scan||!ended)invalid();
 }else if(ascii(0,4)==='RIFF'&&ascii(8,12)==='WEBP'){
  type='image/webp';if(view.getUint32(4,true)+8!==bytes.length)invalid();let cursor=12,hasImage=false;
  while(cursor+8<=bytes.length){const kind=ascii(cursor,cursor+4),size=view.getUint32(cursor+4,true),end=cursor+8+size+(size%2);if(end>bytes.length)invalid();if(kind==='VP8 '||kind==='VP8L')hasImage=true;
   if(!['EXIF','XMP '].includes(kind)){const chunk=bytes.slice(cursor,end);if(kind==='VP8X'){if(size!==10)invalid();chunk[8]&=~(8|4);}pieces.push(chunk);}cursor=end;
  }
  if(cursor!==bytes.length||!hasImage)invalid();const length=pieces.reduce((n,p)=>n+p.length,4),header=bytes.slice(0,12);new DataView(header.buffer).setUint32(4,length,true);pieces.unshift(header);
 }else invalid();
 if(declaredType&&declaredType!==type&&declaredType!=='application/octet-stream')invalid();
 const cleaned=new Uint8Array(pieces.reduce((n,p)=>n+p.length,0));let offset=0;for(const piece of pieces){cleaned.set(piece,offset);offset+=piece.length;}return {bytes:cleaned,contentType:type};
}

async function organizationPhotoMultipart(request){
 if(request.headers.get('Origin')!==new URL(request.url).origin||request.headers.get('Sec-Fetch-Site')==='cross-site')throw new Error('Please submit this form from its original organization page.');
 const type=request.headers.get('Content-Type')||'';if(!/^multipart\/form-data\s*;/i.test(type))throw new Error('Choose a photo using the upload form.');
 if(Number(request.headers.get('Content-Length'))>organizationPhotoBodyMax)throw new Error('Choose a photo no larger than 5 MB.');
 const reader=request.body?.getReader();if(!reader)throw new Error('Choose a photo.');const chunks=[];let length=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>organizationPhotoBodyMax){await reader.cancel();throw new Error('Choose a photo no larger than 5 MB.');}chunks.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}let form;try{form=await new Response(bytes,{headers:{'Content-Type':type}}).formData();}catch{throw new Error('Please choose the photo again.');}
 for(const [name]of form)if(!['action','org_id','photo','caption','alt_text','credit','source_url','rights','album_id','present_org_ids'].includes(name))throw new Error('Please reload the photo form and try again.');
 return form;
}

export async function organizationPhotoRows(db,orgIds){
 if(!db||Array.isArray(orgIds)&&!orgIds.length)return [];
 const sql='SELECT * FROM organization_photos'+(Array.isArray(orgIds)?' WHERE org_id IN ('+orgIds.map(()=>'?').join(',')+')':'')+' ORDER BY created_at,id';
 return (await (Array.isArray(orgIds)?db.prepare(sql).bind(...orgIds):db.prepare(sql)).all()).results;
}

export async function organizationPhotoAlbumRows(db,orgIds){
 if(!db||Array.isArray(orgIds)&&!orgIds.length)return [];
 const sql='SELECT * FROM organization_photo_albums'+(Array.isArray(orgIds)?' WHERE org_id IN ('+orgIds.map(()=>'?').join(',')+')':'')+' ORDER BY created_at,id';
 return (await (Array.isArray(orgIds)?db.prepare(sql).bind(...orgIds):db.prepare(sql)).all()).results;
}

export async function organizationPhotoPresenceRows(db,photoIds){
 if(!db||Array.isArray(photoIds)&&!photoIds.length)return [];
 const sql='SELECT * FROM organization_photo_presence'+(Array.isArray(photoIds)?' WHERE photo_id IN ('+photoIds.map(()=>'?').join(',')+')':'')+' ORDER BY requested_at,id';
 return (await (Array.isArray(photoIds)?db.prepare(sql).bind(...photoIds):db.prepare(sql)).all()).results;
}

export async function organizationPhotoAction(request,env,principal){
 if(request.method!=='POST'||!env.DB)throw new Error('Photo editing is temporarily unavailable.');
 const multipart=(request.headers.get('Content-Type')||'').startsWith('multipart/form-data');
 const form=multipart?await organizationPhotoMultipart(request):await formData(request),action=organizationPhotoText(form,'action',50,true),orgId=organizationPhotoText(form,'org_id',100,true),scope=organizationPhotoPermission(principal,orgId),actor=principal.email;
 const now=new Date().toISOString(),destination='/organization?org='+encodeURIComponent(orgId)+'&photosaved=1#photos';
 if(!['photo_upload','photo_edit','photo_remove'].includes(action))throw new Error('Choose a valid photo action.');
 if(action==='photo_upload'&&!multipart)throw new Error('Choose a photo using the upload form.');
 const id=action==='photo_upload'?crypto.randomUUID():organizationPhotoText(form,'id',100,true),version=action==='photo_upload'?1:Number(organizationPhotoText(form,'version',20,true));
 if(!organizationPhotoID(id)||!Number.isSafeInteger(version)||version<1)throw new Error('Reload this page before changing the photo.');
 let caption='',alt='',credit='',source='',albumId=null,presentOrgIds=[];
 if(action!=='photo_remove'){
  if(organizationPhotoText(form,'rights',10)!=='yes')throw new Error('Confirm permission to publish the photo and that it contains no private information.');
  caption=organizationPhotoText(form,'caption',500);alt=organizationPhotoText(form,'alt_text',300,true);credit=organizationPhotoText(form,'credit',200);source=safeURL(organizationPhotoText(form,'source_url',2000));albumId=organizationPhotoText(form,'album_id',100)||null;presentOrgIds=organizationPhotoIDs(form,'present_org_ids',orgId);
  if(albumId&&!organizationPhotoID(albumId))throw new Error('Choose a valid album.');
  assertPublicProfilePrivacy({member_information:[caption,alt,credit].join(' '),source_url:source});
 }
 let statement,key,bytes,sha256;
 if(action==='photo_upload'){
  if(!env.ATTACHMENTS)throw new Error('Photo uploads are temporarily unavailable.');
  const files=form.getAll('photo');if(files.length!==1||typeof files[0]==='string'||typeof files[0].arrayBuffer!=='function')throw new Error('Choose one photo at a time.');const file=files[0];
  if(file.size<1||file.size>organizationPhotoMax)throw new Error('Choose a photo no larger than 5 MB.');
  const cleaned=cleanOrganizationPhoto(await file.arrayBuffer(),file.type);bytes=cleaned.bytes;sha256=await organizationPhotoSHA(bytes);key='organization-photos/'+orgId+'/'+id;
  const envelope=JSON.stringify({schema_version:1,base64:organizationPhotoBase64(bytes),byte_size:bytes.length,sha256});
  const stored=await env.ATTACHMENTS.put(key,envelope,{httpMetadata:{contentType:'text/plain'},customMetadata:{photo_id:id,sha256}});if(!stored)throw new Error('The photo could not be stored. Please try again.');
  statement=env.DB.prepare(`INSERT INTO organization_photos(id,org_id,object_key,caption,alt_text,credit,source_url,license,content_type,byte_size,sha256,uploaded_by,created_at,updated_at,album_id) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE ${organizationPhotoScope} AND (? IS NULL OR EXISTS(SELECT 1 FROM organization_photo_albums WHERE id=? AND org_id=?)) AND (SELECT count(*) FROM organization_photos WHERE org_id=?)<? RETURNING id`).bind(id,orgId,key,caption,alt,credit,source,'Permission confirmed by uploader',cleaned.contentType,bytes.length,sha256,actor,now,now,albumId,...scope,albumId,albumId,orgId,orgId,organizationPhotoLimit);
 }else if(action==='photo_edit')statement=env.DB.prepare(`UPDATE organization_photos SET caption=?,alt_text=?,credit=?,source_url=?,album_id=?,updated_at=?,version=version+1 WHERE id=? AND org_id=? AND version=? AND ${organizationPhotoScope} AND (? IS NULL OR EXISTS(SELECT 1 FROM organization_photo_albums WHERE id=? AND org_id=?)) RETURNING id`).bind(caption,alt,credit,source,albumId,now,id,orgId,version,...scope,albumId,albumId,orgId);
 else statement=env.DB.prepare(`DELETE FROM organization_photos WHERE id=? AND org_id=? AND version=? AND ${organizationPhotoScope} RETURNING id`).bind(id,orgId,version,...scope);
 let out;
 const statements=[statement];
 if(action!=='photo_remove'){
  if(action==='photo_edit')statements.push(env.DB.prepare("DELETE FROM organization_photo_presence WHERE photo_id=? AND org_id!=? AND status='approved' AND EXISTS(SELECT 1 FROM organization_photos WHERE id=? AND org_id=? AND updated_at=?)").bind(id,orgId,id,orgId,now));
  const associations=[orgId,...presentOrgIds];
  for(const presentOrg of associations)statements.push(env.DB.prepare("INSERT INTO organization_photo_presence(id,photo_id,org_id,status,requested_by,requested_at,reviewed_by,reviewed_at) SELECT ?,?,?,'approved',?,?,?,? WHERE EXISTS(SELECT 1 FROM organization_photos WHERE id=? AND org_id=? AND updated_at=?) ON CONFLICT(photo_id,org_id) DO UPDATE SET status='approved',reviewed_by=excluded.reviewed_by,reviewed_at=excluded.reviewed_at,version=organization_photo_presence.version+1").bind(crypto.randomUUID(),id,presentOrg,actor,now,actor,now,id,orgId,now));
 }
 statements.push(action==='photo_remove'?env.DB.prepare('INSERT INTO audit(id,actor,action,record_id,created_at) SELECT ?,?,?,?,? WHERE changes()>0').bind(crypto.randomUUID(),actor,'organization_'+action,id,now):env.DB.prepare('INSERT INTO audit(id,actor,action,record_id,created_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM organization_photos WHERE id=? AND org_id=? AND updated_at=?)').bind(crypto.randomUUID(),actor,'organization_'+action,id,now,id,orgId,now));
 try{out=await env.DB.batch(statements);}
 catch(error){
  // A lost response can follow a committed upload; preserve uncertain originals.
  if(key){let saved;try{saved=(await env.DB.prepare('SELECT id FROM organization_photos WHERE id=? AND object_key=?').bind(id,key).all()).results;}catch{throw new Error('The upload status could not be confirmed. Reload the page before trying again.');}if(saved.length===1)return redirect(destination);try{await env.ATTACHMENTS.delete(key);}catch{}}
  throw error;
 }
 if(out[0]?.results?.length!==1){if(key)try{await env.ATTACHMENTS.delete(key);}catch{}throw new Error('Your access or this photo changed, or the gallery already has 12 photos. Reload the page before trying again.');}
 // Removed originals stay private in R2 so a previously verified backup remains
 // restorable. An absent metadata ID immediately stops public image delivery.
 return redirect(destination);
}

export async function organizationPhotoCollaborationAction(request,env,principal){
 if(request.method!=='POST'||!env.DB)throw new Error('Photo collaboration is temporarily unavailable.');
 const form=await formData(request),action=organizationPhotoText(form,'action',60,true),actor=String(principal?.email||'').toLowerCase(),now=new Date().toISOString();
 if(!actor)throw new Error('Sign in again before changing photo collaboration.');
 let statement,destination='/organization#photos',recordId='';
 if(['album_add','album_edit','album_remove'].includes(action)){
  const orgId=organizationPhotoText(form,'org_id',100,true),scope=organizationPhotoPermission(principal,orgId);destination='/organization?org='+encodeURIComponent(orgId)+'&photosaved=1#photo-albums';
  const id=action==='album_add'?crypto.randomUUID():organizationPhotoText(form,'id',100,true),version=action==='album_add'?1:Number(organizationPhotoText(form,'version',20,true));recordId=id;
  if(!organizationPhotoID(id)||!Number.isSafeInteger(version)||version<1)throw new Error('Reload this album before changing it.');
  if(action==='album_remove')statement=env.DB.prepare(`DELETE FROM organization_photo_albums WHERE id=? AND org_id=? AND version=? AND ${organizationPhotoScope} RETURNING id`).bind(id,orgId,version,...scope);
  else{
   const name=organizationPhotoText(form,'name',100,true),description=organizationPhotoText(form,'description',500);
   assertPublicProfilePrivacy({member_information:name+' '+description});
   if(action==='album_add')statement=env.DB.prepare(`INSERT INTO organization_photo_albums(id,org_id,name,description,created_by,created_at,updated_by,updated_at) SELECT ?,?,?,?,?,?,?,? WHERE ${organizationPhotoScope} AND (SELECT count(*) FROM organization_photo_albums WHERE org_id=?)<20 RETURNING id`).bind(id,orgId,name,description,actor,now,actor,now,...scope,orgId);
   else statement=env.DB.prepare(`UPDATE organization_photo_albums SET name=?,description=?,updated_by=?,updated_at=?,version=version+1 WHERE id=? AND org_id=? AND version=? AND ${organizationPhotoScope} RETURNING id`).bind(name,description,actor,now,id,orgId,version,...scope);
  }
 }else if(action==='photo_presence_request'){
  const photoId=organizationPhotoText(form,'photo_id',100,true),orgId=organizationPhotoText(form,'org_id',100,true),scope=organizationPhotoPermission(principal,orgId);recordId=crypto.randomUUID();destination='/photo-presence?photo='+encodeURIComponent(photoId)+'&saved=1';
  if(!organizationPhotoID(photoId))throw new Error('Choose a valid photo.');
  statement=env.DB.prepare(`INSERT INTO organization_photo_presence(id,photo_id,org_id,status,requested_by,requested_at) SELECT ?,?,?,'pending',?,? WHERE ${organizationPhotoScope} AND EXISTS(SELECT 1 FROM organization_photos WHERE id=? AND org_id!=?) ON CONFLICT(photo_id,org_id) DO NOTHING RETURNING id`).bind(recordId,photoId,orgId,actor,now,...scope,photoId,orgId);
 }else if(['photo_presence_approve','photo_presence_reject'].includes(action)){
  const orgId=organizationPhotoText(form,'org_id',100,true),scope=organizationPhotoPermission(principal,orgId),id=organizationPhotoText(form,'id',100,true),version=Number(organizationPhotoText(form,'version',20,true));recordId=id;destination='/organization?org='+encodeURIComponent(orgId)+'&photosaved=1#photos';
  if(!organizationPhotoID(id)||!Number.isSafeInteger(version)||version<1)throw new Error('Reload this photo request before changing it.');
  const ownership=`EXISTS(SELECT 1 FROM organization_photos p WHERE p.id=organization_photo_presence.photo_id AND p.org_id=?)`;
  if(action==='photo_presence_approve')statement=env.DB.prepare(`UPDATE organization_photo_presence SET status='approved',reviewed_by=?,reviewed_at=?,version=version+1 WHERE id=? AND version=? AND status='pending' AND ${ownership} AND ${organizationPhotoScope} RETURNING id`).bind(actor,now,id,version,orgId,...scope);
  else statement=env.DB.prepare(`DELETE FROM organization_photo_presence WHERE id=? AND version=? AND status='pending' AND ${ownership} AND ${organizationPhotoScope} RETURNING id`).bind(id,version,orgId,...scope);
 }else throw new Error('Choose a valid photo collaboration action.');
 const out=await env.DB.batch([statement,env.DB.prepare('INSERT INTO audit(id,actor,action,record_id,created_at) SELECT ?,?,?,?,? WHERE changes()>0').bind(crypto.randomUUID(),actor,'organization_'+action,recordId,now)]);
 if(out[0]?.results?.length!==1)throw new Error('Your access, album or photo request changed. Reload the page before trying again.');
 return redirect(destination);
}

// The caller may expose this GET route publicly. Only published metadata IDs
// resolve; clients can never name private request object keys or read attribution.
export async function readOrganizationPhoto(request,env,id){
 const missing=()=>new Response('Photo not found.',{status:404,headers:organizationPhotoHeaders});
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed.',{status:405,headers:{...organizationPhotoHeaders,Allow:'GET, HEAD'}});
 if(!organizationPhotoID(id)||!env.DB||!env.ATTACHMENTS)return missing();
 const row=(await env.DB.prepare('SELECT id,org_id,object_key,content_type,byte_size,sha256 FROM organization_photos WHERE id=?').bind(id).all()).results[0];
 if(!row||!row.object_key||!row.object_key.startsWith('organization-photos/'+row.org_id+'/')||!records.some(r=>r.id===row.org_id))return missing();
 if(!['image/jpeg','image/png','image/webp'].includes(row.content_type)||!Number.isSafeInteger(row.byte_size)||row.byte_size<1||row.byte_size>organizationPhotoMax)return missing();
 const object=await env.ATTACHMENTS.get(row.object_key);if(!object||object.size>4*Math.ceil(organizationPhotoMax/3)+1024)return missing();
 let bytes;try{const envelope=await object.json();if(envelope.schema_version!==1||envelope.byte_size!==row.byte_size||envelope.sha256!==row.sha256||typeof envelope.base64!=='string'||envelope.base64.length!==4*Math.ceil(row.byte_size/3))return missing();const raw=atob(envelope.base64);bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));if(bytes.length!==row.byte_size||await organizationPhotoSHA(bytes)!==row.sha256)return missing();}catch{return missing();}
 return new Response(request.method==='HEAD'?null:bytes,{headers:{...organizationPhotoHeaders,'Content-Type':row.content_type,'Content-Length':String(bytes.length),'Content-Disposition':'inline'}});
}

