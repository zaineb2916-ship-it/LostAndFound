import {json} from "./_utils.js";
export async function onRequestGet({env}){const {results=[]}=await env.DB.prepare("SELECT id,name FROM Categories ORDER BY name").all();return json({categories:results})}
