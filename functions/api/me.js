import {json,fail,getUser} from "./_utils.js";
export async function onRequestGet({request,env}){const user=await getUser(request,env);return user?json({user}):fail("يرجى تسجيل الدخول أولاً.",401)}
