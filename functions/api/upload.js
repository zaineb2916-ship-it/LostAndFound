
import { json, fail, getUser } from "./_utils.js";

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

function detectImageType(bytes) {
  // JPEG
  if (
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "jpg";
  }

  // PNG
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "png";
  }

  // WEBP
  if (
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return "webp";
  }

  return null;
}

export async function onRequestPost({ request, env }) {
  try {
    const user = await getUser(request, env);

    if (!user) {
      return fail("يرجى تسجيل الدخول أولاً.", 401);
    }

    const privateKey = env.IMAGEKIT_PRIVATE_KEY;

    if (!privateKey) {
      return fail("إعداد رفع الصور غير مكتمل على الخادم.", 500);
    }

    const form = await request.formData();
    const file = form.get("image");

    if (!file || typeof file.arrayBuffer !== "function") {
      return fail("يرجى اختيار صورة.");
    }

    if (file.size === 0) {
      return fail("الملف المحدد فارغ.");
    }

    if (file.size > MAX_SIZE) {
      return fail("حجم الصورة يجب ألا يتجاوز 5 ميجابايت.");
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const extension = detectImageType(bytes);

    if (!extension) {
      return fail("نوع الصورة غير مدعوم. استخدمي JPG أو PNG أو WEBP.");
    }

    const fileName = `lost-found-${crypto.randomUUID()}.${extension}`;

    const uploadForm = new FormData();

    uploadForm.append(
      "file",
      new Blob([bytes], { type: file.type }),
      fileName
    );

    uploadForm.append("fileName", fileName);
    uploadForm.append("folder", "/lostandfound");
    uploadForm.append("useUniqueFileName", "true");

    const authorization = btoa(`${privateKey}:`);

    const response = await fetch(
      "https://upload.imagekit.io/api/v1/files/upload",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${authorization}`
        },
        body: uploadForm
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error("ImageKit upload error:", result);
      return fail("تعذر رفع الصورة إلى ImageKit. تحققي من إعدادات الخدمة.", 502);
    }

    if (!result.url) {
      return fail("لم يرجع ImageKit رابط الصورة.", 502);
    }

    return json({
      ok: true,
      image_url: result.url
    });

  } catch (error) {
    console.error("Upload error:", error);
    return fail("حدث خطأ أثناء رفع الصورة.", 500);
  }
}
