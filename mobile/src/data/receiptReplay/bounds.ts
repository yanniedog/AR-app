import { utf8ToBytes } from '@noble/hashes/utils';
import { canonical,hashText } from '../../lib/productTermsEngine/validation';
export const REPLAY_MAX_BYTES=8*1024*1024;
export function boundedReceiptJson(text:string):any {
 if(typeof text!=='string'||text.length>REPLAY_MAX_BYTES||utf8ToBytes(text).length>REPLAY_MAX_BYTES)throw Error('Receipt exceeds 8 MiB.');
 let depth=0,quoted=false,escaped=false,nodes=0;
 for(const c of text){if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;continue;}if(c==='"')quoted=true;else if(c==='{'||c==='['){if(++depth>64||++nodes>250000)throw Error('Receipt structure exceeds limits.');}else if(c==='}'||c===']')depth--;else if(c===','&&++nodes>250000)throw Error('Receipt structure exceeds limits.');}
 const value=JSON.parse(text);let count=0;function visit(v:any,d:number){if(++count>250000||d>64)throw Error('Receipt structure exceeds limits.');if(typeof v==='number'&&!Number.isFinite(v))throw Error('Invalid receipt number.');if(v&&typeof v==='object')for(const[k,c]of Object.entries(v)){if(['__proto__','prototype','constructor'].includes(k))throw Error('Unsafe receipt key.');visit(c,d+1);}}visit(value,0);return value;
}
export function digest(value:unknown,expected:unknown){if(typeof expected!=='string'||!/^[a-f0-9]{64}$/.test(expected)||hashText(canonical(value))!==expected)throw Error('Receipt input digest does not match.');}
export function keys(value:any,allowed:string[],required=allowed){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!allowed.includes(k))||required.some(k=>!Object.hasOwn(value,k)))throw Error('Unsupported receipt shape.');}
export function boundedInputs(value:unknown,activity=false){if(utf8ToBytes(canonical(value)).length>512*1024)throw Error('Receipt inputs exceed limit.');let nodes=0;function visit(v:any,depth:number){if(++nodes>(activity?16384:8192)||depth>16||typeof v==='string'&&v.length>16384)throw Error('Receipt input structure exceeds limits.');if(v&&typeof v==='object')Object.values(v).forEach(x=>visit(x,depth+1));}visit(value,0);}
