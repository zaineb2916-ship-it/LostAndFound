const COOKIE = "laf_session";
const ITERATIONS = 210000;
const enc = new TextEncoder();
const b64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const unb64 = (s) => Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/")+"===".slice((s.length+3)%4)),c=>c.charCodeAt(0));
export function json(data,status=200,headers={}){return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",...headers}})}
export function fail(message,status=400){return json({error:message},status)}
export async function body(request){try{return await request.json()}catch{return null}}
export function cookie(request){return (request.headers.get("Cookie")||"").split(";").map(x=>x.trim()).find(x=>x.startsWith(COOKIE+"="))?.slice(COOKIE.length+1)||null}
async function hmac(secret,data){const key=await crypto.subtle.importKey("raw",enc.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign","verify"]);return new Uint8Array(await crypto.subtle.sign("HMAC",key,enc.encode(data)))}
export async function makeSession(user,secret){const payload=b64(enc.encode(JSON.stringify({id:user.id,name:user.name,email:user.email,exp:Date.now()+7*24*60*60*1000})));return payload+"."+b64(await hmac(secret,payload))}
export async function getUser(request,env){const token=cookie(request);if(!token||!env.SESSION_SECRET)return null;const [payload,sig,...rest]=token.split(".");if(!payload||!sig||rest.length)return null;try{const expected=await hmac(env.SESSION_SECRET,payload);const actual=unb64(sig);if(expected.length!==actual.length)return null;const key=await crypto.subtle.importKey("raw",enc.encode(env.SESSION_SECRET),{name:"HMAC",hash:"SHA-256"},false,["verify"]);const valid=await crypto.subtle.verify("HMAC",key,actual,enc.encode(payload));if(!valid)return null;const u=JSON.parse(new TextDecoder().decode(unb64(payload)));if(!u.id||u.exp<Date.now())return null;return u}catch{return null}}
export function sessionCookie(token){return `${COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`}
export function clearCookie(){return `${COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`}
export async function hashPassword(password){const salt=crypto.getRandomValues(new Uint8Array(16));const key=await crypto.subtle.importKey("raw",enc.encode(password),"PBKDF2",false,["deriveBits"]);const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt,iterations:ITERATIONS,hash:"SHA-256"},key,256);return `pbkdf2$${ITERATIONS}$${b64(salt)}$${b64(bits)}`}
export async function verifyPassword(password,stored){try{const [scheme,it,salt,hash]=stored.split("$");if(scheme!=="pbkdf2")return false;const key=await crypto.subtle.importKey("raw",enc.encode(password),"PBKDF2",false,["deriveBits"]);const bits=new Uint8Array(await crypto.subtle.deriveBits({name:"PBKDF2",salt:unb64(salt),iterations:Number(it),hash:"SHA-256"},key,256));const a=b64(bits),b=hash;if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0}catch{return false}}
export const requiredSecret = env => !!env.SESSION_SECRET && env.SESSION_SECRET.length>=32;
