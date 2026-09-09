const bytes=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
export async function verifyIdentity(request,env){
 if(!env.ACCESS_TEAM_DOMAIN||!env.ACCESS_AUD||!env.OWNER_EMAIL)throw new Error('AUTH_NOT_CONFIGURED');
 const issuer='https://'+env.ACCESS_TEAM_DOMAIN;
 if(!/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(env.ACCESS_TEAM_DOMAIN))throw new Error('AUTH_NOT_CONFIGURED');
 const token=request.headers.get('Cf-Access-Jwt-Assertion');if(!token)throw new Error('UNAUTHORIZED');
 try{const [a,b,c,...rest]=token.split('.');if(rest.length||!c)throw Error();const head=JSON.parse(new TextDecoder().decode(bytes(a))),claims=JSON.parse(new TextDecoder().decode(bytes(b)));
 const now=Date.now()/1000;if(head.alg!=='RS256'||!head.kid||claims.iss!==issuer||!Array.isArray(claims.aud)||!claims.aud.includes(env.ACCESS_AUD)||typeof claims.exp!=='number'||claims.exp<=now||typeof claims.nbf!=='number'||claims.nbf>now+30||typeof claims.email!=='string'||!claims.email.includes('@')||!claims.sub)throw Error();
 const res=await fetch(issuer+'/cdn-cgi/access/certs',{cf:{cacheTtl:300,cacheEverything:true}});if(!res.ok)throw Error();const {keys}=await res.json();const jwk=keys.find(k=>k.kid===head.kid&&k.kty==='RSA');if(!jwk)throw Error();const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,bytes(c),new TextEncoder().encode(a+'.'+b)))throw Error();return {id:claims.sub,email:claims.email.toLowerCase(),owner:claims.email.toLowerCase()===env.OWNER_EMAIL.toLowerCase()};
 }catch{throw new Error('UNAUTHORIZED')}
}
export function permitted(user,grants,record,action='read'){
 if(user.owner)return true;
 return grants.some(g=>{
 if(g.email!==user.email)return false;
 const scope=(g.region_id&&g.region_id===record.region_id)||(g.organization_id&&g.organization_id===record.organization_id);
 if(!scope)return false;
 if(g.role==='region_admin')return !!g.region_id&&g.region_id===record.region_id;
 if(g.role==='organization_admin')return !!g.organization_id&&g.organization_id===record.organization_id;
 return g.role==='editor'&&action!=='publish'&&action!=='grant';
 });
}
