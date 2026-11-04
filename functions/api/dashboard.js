import {json,fail,getUser} from "./_utils.js";
export async function onRequestGet({request,env}){const user=await getUser(request,env);if(!user)return fail("يرجى تسجيل الدخول أولاً.",401);const [items,incomingClaims,myClaims]=await Promise.all([
env.DB.prepare("SELECT i.*,c.name AS category_name FROM Items i LEFT JOIN Categories c ON c.id=i.category_id WHERE i.user_id=? ORDER BY i.created_at DESC").bind(user.id).all(),
env.DB.prepare("SELECT c.id,c.message,c.status,c.created_at,i.title AS item_title,u.name AS claimant_name FROM Claims c JOIN Items i ON i.id=c.item_id JOIN Users u ON u.id=c.user_id WHERE i.user_id=? ORDER BY c.created_at DESC").bind(user.id).all(),
env.DB.prepare("SELECT c.id,c.message,c.status,c.created_at,i.title AS item_title,u.name AS owner_name FROM Claims c JOIN Items i ON i.id=c.item_id JOIN Users u ON u.id=i.user_id WHERE c.user_id=? ORDER BY c.created_at DESC").bind(user.id).all()
]);return json({user,items:items.results||[],incomingClaims:incomingClaims.results||[],myClaims:myClaims.results||[]})}
