
const LANG_KEY = "laf_lang";

function currentLang() {
  return localStorage.getItem(LANG_KEY) || "ar";
}

function applyLanguage(lang) {
  localStorage.setItem(LANG_KEY, lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";

  document.querySelectorAll("[data-ar][data-en]").forEach(el => {
    el.textContent = el.dataset[lang];
  });

  const b = document.getElementById("langBtn");
  if (b) b.textContent = lang === "ar" ? "EN" : "عربي";
}

document.addEventListener("DOMContentLoaded", () => {
  applyLanguage(currentLang());

  const b = document.getElementById("langBtn");

  if (b) {
    b.addEventListener("click", () => {
      applyLanguage(currentLang() === "ar" ? "en" : "ar");
    });
  }
});

const t = (ar, en) => currentLang() === "ar" ? ar : en;

// API: قراءة الاستجابة وإظهار تفاصيل الأخطاء
async function api(url, options = {}) {
  const r = await fetch(url, {
    ...options,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const raw = await r.text();
  let data = {};

  try {
    data = JSON.parse(raw);
  } catch {
    const title = raw.match(/<title[^>]*>(.*?)<\/title>/is);
    const heading = raw.match(/<h2[^>]*>(.*?)<\/h2>/is);

    const detail = heading?.[1]
      ?.replace(/<[^>]*>/g, "")
      .trim();

    throw new Error(
      `HTTP ${r.status}: ${
        detail || title?.[1] || "استجابة غير صالحة من الخادم"
      }`
    );
  }

  if (!r.ok) {
    throw new Error(
      data.error || data.message || `HTTP ${r.status}`
    );
  }

  return data;
}

function showMessage(el, msg, ok = false) {
  if (!el) return;

  el.textContent = msg;
  el.className = "form-message" + (ok ? " success" : "");
}

function bindAuthForm(id, url, next) {
  const form = document.getElementById(id);
  if (!form) return;

  form.addEventListener("submit", async e => {
    e.preventDefault();

    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;

    const msg = document.getElementById("formMessage");

    showMessage(msg, t("جارٍ المعالجة...", "Please wait..."));

    try {
      const body = Object.fromEntries(
        new FormData(form).entries()
      );

      await api(url, {
        method: "POST",
        body: JSON.stringify(body)
      });

      showMessage(
        msg,
        t("تم بنجاح. جارٍ تحويلك...", "Success. Redirecting..."),
        true
      );

      location.href = next;

    } catch (err) {
      console.error("Registration/API error:", err);
      showMessage(msg, err.message);

    } finally {
      btn.disabled = false;
    }
  });
}

async function requireLogin() {
  try {
    await api("/api/me");
  } catch {
    location.href = "login.html";
  }
}

async function loadCategories() {
  const s = document.getElementById("categorySelect");
  if (!s) return;

  try {
    const d = await api("/api/categories");

    for (const c of d.categories) {
      const o = document.createElement("option");
      o.value = c.id;
      o.textContent = c.name;
      s.appendChild(o);
    }
  } catch (e) {
    console.error(e);
  }
}

function bindReportForm() {
  const f = document.getElementById("reportForm");
  if (!f) return;

  f.addEventListener("submit", async e => {
    e.preventDefault();

    const b = f.querySelector("button");
    b.disabled = true;

    const msg = document.getElementById("formMessage");

    try {
      const x = Object.fromEntries(
        new FormData(f).entries()
      );

      x.category_id = x.category_id || null;

      await api("/api/items", {
        method: "POST",
        body: JSON.stringify(x)
      });

      showMessage(
        msg,
        t("تم نشر البلاغ بنجاح.", "Report published successfully."),
        true
      );

      f.reset();

      setTimeout(() => {
        location.href = "dashboard.html";
      }, 900);

    } catch (err) {
      showMessage(msg, err.message);

    } finally {
      b.disabled = false;
    }
  });
}

function esc(v = "") {
  return String(v).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

function itemCard(item, owner = false) {
  const found = item.item_type === "found";
  const title = esc(item.title);
  const desc = esc(item.description || "");
  const loc = esc(item.location || "");

  const image = item.image_url
    ? `<img class="item-image" src="${esc(item.image_url)}" alt="" loading="lazy" onerror="this.style.display='none'">`
    : "";

  return `
    <article class="item-card">
      ${image}
      <span class="tag ${found ? "" : "lost"}">
        ${found ? t("غرض موجود", "Found") : t("غرض مفقود", "Lost")}
      </span>
      <h3>${title}</h3>
      <p>${desc || t("لا يوجد وصف إضافي.", "No additional description.")}</p>
      <div class="item-meta">
        <span>⌖ ${loc || t("الموقع غير محدد", "Location not specified")}</span>
        <span>${new Date(item.created_at).toLocaleDateString(currentLang() === "ar" ? "ar" : "en")}</span>
      </div>
      ${
        owner
          ? `<p class="muted">${t("الحالة: ", "Status: ")}${esc(item.status)}</p>`
          : `<button class="btn btn-outline" onclick="makeClaim(${Number(item.id)})">${t("طلب استرجاع", "Request return")}</button>`
      }
    </article>
  `;
}

async function loadPublicItems() {
  const grid = document.getElementById("itemsGrid");
  if (!grid) return;

  try {
    const d = await api("/api/items");

    grid.innerHTML = d.items.length
      ? d.items.map(x => itemCard(x)).join("")
      : `<div class="empty">${t("لا توجد بلاغات منشورة حالياً.", "No reports have been posted yet.")}</div>`;

  } catch (e) {
    grid.innerHTML = `<div class="empty">${esc(e.message)}</div>`;
  }
}

async function makeClaim(id) {
  if (!confirm(t(
    "هل تريد إرسال طلب استرجاع لهذا الغرض؟",
    "Send a return request for this item?"
  ))) return;

  const message = prompt(t(
    "اكتب رسالة توضح سبب مطالبتك بالغرض (اختياري):",
    "Add a short message to support your claim (optional):"
  )) || "";

  try {
    await api("/api/claims", {
      method: "POST",
      body: JSON.stringify({ item_id: id, message })
    });

    alert(t("تم إرسال طلبك.", "Your request has been sent."));

  } catch (e) {
    alert(e.message);
  }
}

async function loadDashboard() {
  try {
    const d = await api("/api/dashboard");

    document.getElementById("userName").textContent = d.user.name;

    document.getElementById("myItems").innerHTML = d.items.length
      ? d.items.map(x => itemCard(x, true)).join("")
      : `<div class="empty">${t("لم تضف أي بلاغ بعد.", "You have not posted any reports yet.")}</div>`;

    renderClaims("incomingClaims", d.incomingClaims, true);
    renderClaims("myClaims", d.myClaims, false);

  } catch (e) {
    location.href = "login.html";
  }
}

function renderClaims(id, claims, incoming) {
  const el = document.getElementById(id);
  if (!el) return;

  if (!claims.length) {
    el.innerHTML = `<div class="empty">${t("لا توجد طلبات حالياً.", "No requests yet.")}</div>`;
    return;
  }

  el.innerHTML = claims.map(c => `
    <div class="claim-row">
      <div>
        <strong>${esc(c.item_title)}</strong>
        <p>
          ${
            incoming
              ? t("من: ", "From: ") + esc(c.claimant_name)
              : t("إلى: ", "To: ") + esc(c.owner_name)
          }
          · ${esc(c.message || "")}
        </p>
        <span class="tag">${esc(c.status)}</span>
      </div>
      ${
        incoming
          ? `<div class="claim-actions">
              <button class="btn btn-outline btn-small" onclick="updateClaim(${Number(c.id)},'accepted')">${t("قبول", "Accept")}</button>
              <button class="btn btn-outline btn-small" onclick="updateClaim(${Number(c.id)},'rejected')">${t("رفض", "Decline")}</button>
            </div>`
          : ""
      }
    </div>
  `).join("");
}

async function updateClaim(id, status) {
  try {
    await api("/api/claims", {
      method: "PATCH",
      body: JSON.stringify({ claim_id: id, status })
    });

    loadDashboard();

  } catch (e) {
    alert(e.message);
  }
}

async function logout() {
  try {
    await api("/api/logout", {
      method: "POST",
      body: "{}"
    });
  } finally {
    location.href = "index.html";
  }
}
