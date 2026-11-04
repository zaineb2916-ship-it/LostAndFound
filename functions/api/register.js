
import {
  json,
  fail,
  body,
  hashPassword,
  makeSession,
  sessionCookie,
  requiredSecret
} from "./_utils.js";

export async function onRequestPost({ request, env }) {
  let stage = "start";

  try {
    stage = "check_secret";

    if (!requiredSecret(env)) {
      return fail("إعداد SESSION_SECRET غير مكتمل.", 500);
    }

    stage = "read_body";

    const d = await body(request);

    if (
      !d ||
      typeof d.name !== "string" ||
      typeof d.email !== "string" ||
      typeof d.password !== "string"
    ) {
      return fail("يرجى إدخال جميع البيانات المطلوبة.");
    }

    const name = d.name.trim();
    const email = d.email.trim().toLowerCase();
    const password = d.password;

    if (name.length < 2 || name.length > 100) {
      return fail("الاسم يجب أن يكون بين حرفين و100 حرف.");
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 190) {
      return fail("البريد الإلكتروني غير صالح.");
    }

    if (password.length < 8 || password.length > 128) {
      return fail("كلمة المرور يجب أن تكون 8 أحرف على الأقل.");
    }

    stage = "check_database";

    if (!env.DB) {
      throw new Error("D1 binding DB is missing");
    }

    const exists = await env.DB
      .prepare("SELECT id FROM Users WHERE email = ?")
      .bind(email)
      .first();

    if (exists) {
      return fail("هذا البريد مسجل مسبقاً.", 409);
    }

    stage = "hash_password";

    const hash = await hashPassword(password);

    stage = "insert_user";

    const result = await env.DB
      .prepare(
        "INSERT INTO Users (name, email, password) VALUES (?, ?, ?)"
      )
      .bind(name, email, hash)
      .run();

    stage = "create_session";

    const user = {
      id: result.meta.last_row_id,
      name,
      email
    };

    const token = await makeSession(user, env.SESSION_SECRET);

    stage = "send_response";

    return json(
      { user },
      201,
      { "Set-Cookie": sessionCookie(token) }
    );

  } catch (error) {
    console.error("REGISTER ERROR:", {
      stage,
      message: error?.message,
      stack: error?.stack
    });

    return fail(
      "فشل التسجيل في المرحلة: " + stage,
      500
    );
  }
}
