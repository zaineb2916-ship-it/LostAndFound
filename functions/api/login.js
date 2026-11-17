
import {
  json,
  fail,
  body,
  verifyPassword,
  makeSession,
  sessionCookie,
  requiredSecret
} from "./_utils.js";

export async function onRequestPost({ request, env }) {
  try {
    // 1. Check secret
    if (!requiredSecret(env)) {
      return fail("إعداد SESSION_SECRET غير مكتمل.", 500);
    }

    // 2. Check database
    if (!env.DB) {
      throw new Error("D1 binding DB is missing");
    }

    // 3. Read request body
    const d = await body(request);

    if (
      !d ||
      typeof d.email !== "string" ||
      typeof d.password !== "string"
    ) {
      return fail("أدخل البريد الإلكتروني وكلمة المرور.");
    }

    const email = d.email.trim().toLowerCase();
    const password = d.password;

    // 4. Validate input
    if (
      !email ||
      email.length > 190 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      password.length < 8 ||
      password.length > 128
    ) {
      return fail(
        "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
        401
      );
    }

    // 5. Find user
    const user = await env.DB
      .prepare(
        "SELECT id, name, email, password FROM Users WHERE email = ?"
      )
      .bind(email)
      .first();

    // 6. Verify password
    if (
      !user ||
      !(await verifyPassword(password, user.password))
    ) {
      return fail(
        "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
        401
      );
    }

    // 7. Prepare safe user data
    const safe = {
      id: user.id,
      name: user.name,
      email: user.email
    };

    // 8. Create session
    const token = await makeSession(
      safe,
      env.SESSION_SECRET
    );

    // 9. Return response
    return json(
      { user: safe },
      200,
      {
        "Set-Cookie": sessionCookie(token)
      }
    );

  } catch (error) {
    console.error("LOGIN ERROR:", error?.message);

    return fail(
      "تعذر تسجيل الدخول حالياً. يرجى المحاولة لاحقاً.",
      500
    );
  }
}
