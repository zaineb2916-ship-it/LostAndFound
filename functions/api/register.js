
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
    // 1. Check session secret
    stage = "check_secret";

    if (!requiredSecret(env)) {
      return fail("إعداد SESSION_SECRET غير مكتمل.", 500);
    }

    // 2. Check database
    stage = "check_database";

    if (!env.DB) {
      throw new Error("D1 binding DB is missing");
    }

    // 3. Read request body
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

    // 4. Validate name
    if (name.length < 2 || name.length > 100) {
      return fail("الاسم يجب أن يكون بين حرفين و100 حرف.");
    }

    // 5. Validate email
    if (
      email.length > 190 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return fail("البريد الإلكتروني غير صالح.");
    }

    // 6. Validate password
    if (password.length < 8 || password.length > 128) {
      return fail("كلمة المرور يجب أن تكون 8 أحرف على الأقل.");
    }

    // 7. Check existing account
    stage = "check_existing_user";

    const exists = await env.DB
      .prepare("SELECT id FROM Users WHERE email = ?")
      .bind(email)
      .first();

    if (exists) {
      return fail("هذا البريد مسجل مسبقاً.", 409);
    }

    // 8. Hash password
    stage = "hash_password";

    const hash = await hashPassword(password);

    // 9. Insert user
    stage = "insert_user";

    const result = await env.DB
      .prepare(
        "INSERT INTO Users (name, email, password) VALUES (?, ?, ?)"
      )
      .bind(name, email, hash)
      .run();

    if (!result.success || !result.meta?.last_row_id) {
      throw new Error("User insertion failed");
    }

    // 10. Create session
    stage = "create_session";

    const user = {
      id: result.meta.last_row_id,
      name,
      email
    };

    const token = await makeSession(
      user,
      env.SESSION_SECRET
    );

    // 11. Return response
    stage = "send_response";

    return json(
      { user },
      201,
      {
        "Set-Cookie": sessionCookie(token)
      }
    );

  } catch (error) {
    console.error("REGISTER ERROR:", {
      stage,
      message: error?.message
    });

    if (
      stage === "insert_user" &&
      /unique constraint/i.test(error?.message || "")
    ) {
      return fail("هذا البريد مسجل مسبقاً.", 409);
    }

    return fail(
      "تعذر إنشاء الحساب حالياً. يرجى المحاولة لاحقاً.",
      500
    );
  }
}
