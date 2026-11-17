
import {
  json,
  fail,
  getUser,
  requiredSecret
} from "./_utils.js";

export async function onRequestGet({ request, env }) {
  try {
    // Check session secret
    if (!requiredSecret(env)) {
      return fail("إعداد SESSION_SECRET غير مكتمل.", 500);
    }

    // Verify current user
    const user = await getUser(request, env);

    if (!user) {
      return fail("يرجى تسجيل الدخول أولاً.", 401);
    }

    // Return authenticated user
    return json({ user });

  } catch (error) {
    console.error("ME API ERROR:", error?.message);

    return fail(
      "تعذر التحقق من جلسة المستخدم حالياً.",
      500
    );
  }
}
