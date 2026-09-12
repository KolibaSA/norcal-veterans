import {canonicalDate,canonicalInstant} from './validation.mjs';
export function isRosterURL(value){
 let decoded=String(value||'');try{decoded=decodeURIComponent(decoded);}catch{/* Check the literal value too. */}
 return /(?:roster|post[-_]?officers|\/officers(?:[/?#.]|$)|post-detail)/i.test(decoded);
}
export const isObject=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
export const publicText=(value,max=2000)=>typeof value==='string'?value.slice(0,max):'';
export const publicStrings=value=>Array.isArray(value)?value.filter(item=>typeof item==='string').slice(0,50).map(item=>item.slice(0,200)):[];
export function publicURL(value){try{if(typeof value!=='string'||value.length>2000||isRosterURL(value))return '';const u=new URL(value);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:'';}catch{return '';}}
export const privacyReviewDate=value=>{try{const date=canonicalDate(value);return date<=new Date().toISOString().slice(0,10)?date:null;}catch{return null;}};
export const publicInstant=value=>{try{return canonicalInstant(value);}catch{return null;}};
