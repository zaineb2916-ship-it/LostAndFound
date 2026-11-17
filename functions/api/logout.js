
import {
  json,
  clearCookie
} from "./_utils.js";

export async function onRequestPost() {
  try {
    return json(
      { ok: true },
      200,
      {
        "Set-Cookie": clearCookie()
      }
    );

  } catch (error) {
    console.error("LOGOUT ERROR:", error?.message);

    return json(
      { error: "تعذر تسجيل الخروج حالياً." },
      500
    );
  }
}
