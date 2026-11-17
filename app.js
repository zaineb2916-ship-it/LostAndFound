
const LANG_KEY = "laf_lang";

function currentLang() {
  return localStorage.getItem(LANG_KEY) || "ar";
}

function t(ar, en) {
  return currentLang() === "ar" ? ar : en;
}

function applyLanguage(lang) {
  localStorage.setItem(LANG_KEY, lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";

  document.querySelectorAll("[data-ar][data-en]").forEach(el => {
    el.textContent = el.dataset[lang];
  });

  document.querySelectorAll("[data-ar-placeholder][data-en-placeholder]")
    .forEach(el => {
      el.placeholder = lang === "ar"
        ? el.dataset.arPlaceholder
        : el.dataset.enPlaceholder;
    });

  const button = document.getElementById("langBtn");
  if (button) button.textContent = lang === "ar" ? "EN" : "عربي";

  if (typeof renderPublicItems === "function") {
    renderPublicItems();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  applyLanguage(currentLang());

  const langButton = document.getElementById("langBtn");

  if (langButton) {
    langButton.addEventListener("click", () => {
      applyLanguage(currentLang() === "ar" ? "en" : "ar");
    });
  }

  // ربط البحث مباشرة عند تحميل الصفحة
  const searchInput = document.getElementById("reportSearch");

  if (searchInput) {
    searchInput.addEventListener("input", renderPublicItems);
  }

  // تحميل البلاغات من هنا أيضاً إذا كانت الصفحة الرئيسية
  if (document.getElementById("itemsGrid")) {
    loadPublicItems();
  }
});

async function api(url, options = {}) {
  const headers = { ...(options.headers || {}) };

  if (!(options.body instanceof FormData) && options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url, {
    ...options,
    credentials: "same-origin",
    headers
  });

  const raw = await response.text();
  let data = {};

  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(`HTTP ${response.status}: استجابة غير صالحة من الخادم`);
  }

  if (!response.ok) {
    throw new Error(data.error || data.message || `HTTP ${response.status}`);
  }

  return data;
}

function showMessage(el, message, success = false) {
  if (!el) return;
  el.textContent = message;
  el.className = "form-message" + (success ? " success" : "");
}

function bindAuthForm(id, url, next) {
  const form = document.getElementById(id);
  if (!form) return;

  form.addEventListener("submit", async event => {
    event.preventDefault();

    const button = form.querySelector("button[type=submit]");
    const message = document.getElementById("formMessage");

    if (button) button.disabled = true;
    showMessage(message, t("جارٍ المعالجة...", "Please wait..."));

    try {
      const body = Object.fromEntries(new FormData(form).entries());

      await api(url, {
        method: "POST",
        body: JSON.stringify(body)
      });

      showMessage(
        message,
        t("تم بنجاح. جارٍ تحويلك...", "Success. Redirecting..."),
        true
      );

      location.href = next;
    } catch (error) {
      console.error(error);
      showMessage(message, error.message);
    } finally {
      if (button) button.disabled = false;
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
  const select = document.getElementById("categorySelect");
  if (!select) return;

  try {
    const data = await api("/api/categories");

    for (const category of data.categories || []) {
      const option = document.createElement("option");
      option.value = category.id;
      option.textContent = category.name;
      select.appendChild(option);
    }
  } catch (error) {
    console.error(error);
  }
}

function bindImagePreview() {
  const input = document.getElementById("imageInput");
  const preview = document.getElementById("imagePreview");

  if (!input || !preview) return;

  input.addEventListener("change", () => {
    preview.replaceChildren();

    const file = input.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      input.value = "";
      showMessage(
        document.getElementById("formMessage"),
        t("حجم الصورة يجب ألا يتجاوز 5 ميجابايت.", "Image must not exceed 5 MB.")
      );
      return;
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      input.value = "";
      showMessage(
        document.getElementById("formMessage"),
        t("نوع الصورة غير مدعوم.", "Unsupported image type.")
      );
      return;
    }

    const image = document.createElement("img");
    const objectUrl = URL.createObjectURL(file);

    image.src = objectUrl;
    image.alt = t("معاينة الصورة", "Image preview");
    image.style.maxWidth = "100%";
    image.style.maxHeight = "220px";
    image.style.marginTop = "12px";
    image.style.borderRadius = "12px";

    image.onload = () => URL.revokeObjectURL(objectUrl);
    preview.appendChild(image);
  });
}

function bindReportForm() {
  const form = document.getElementById("reportForm");
  if (!form) return;

  bindImagePreview();

  form.addEventListener("submit", async event => {
    event.preventDefault();

    const button = form.querySelector("button[type=submit]");
    const message = document.getElementById("formMessage");

    if (button) button.disabled = true;

    try {
      const formData = new FormData(form);
      const imageFile = formData.get("image");
      let imageUrl = null;

      if (imageFile && imageFile.size > 0) {
        showMessage(message, t("جارٍ رفع الصورة...", "Uploading image..."));

        const uploadData = new FormData();
        uploadData.append("image", imageFile);

        const uploadResult = await api("/api/upload", {
          method: "POST",
          body: uploadData
        });

        if (!uploadResult.image_url) {
          throw new Error(t("لم يتم استلام رابط الصورة.", "Image URL was not returned."));
        }

        imageUrl = uploadResult.image_url;
      }

      const itemData = Object.fromEntries(formData.entries());

      delete itemData.image;
      itemData.image_url = imageUrl;
      itemData.category_id = itemData.category_id || null;

      showMessage(message, t("جارٍ نشر البلاغ...", "Publishing report..."));

      await api("/api/items", {
        method: "POST",
        body: JSON.stringify(itemData)
      });

      showMessage(
        message,
        t("تم نشر البلاغ بنجاح.", "Report published successfully."),
        true
      );

      form.reset();

      const preview = document.getElementById("imagePreview");
      if (preview) preview.replaceChildren();

      setTimeout(() => {
        location.href = "dashboard.html";
      }, 1200);
    } catch (error) {
      console.error(error);
      showMessage(message, error.message);
    } finally {
      if (button) button.disabled = false;
    }
  });
}

function esc(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

// توحيد النص العربي لتسهيل البحث
function normalizeSearch(value = "") {
  return String(value)
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim();
}

function itemCard(item, owner = false) {
  const found = item.item_type === "found";
  const title = esc(item.title);
  const description = esc(item.description || "");
  const locationText = esc(item.location || "");

  const image = item.image_url
    ? `<img class="item-image" src="${esc(item.image_url)}" alt="${title}" loading="lazy" onerror="this.style.display='none'">`
    : `<div class="item-image-placeholder">⌕</div>`;

  let dateText = "";

  if (item.created_at) {
    const date = new Date(item.created_at);
    if (!Number.isNaN(date.getTime())) {
      dateText = date.toLocaleDateString(
        currentLang() === "ar" ? "ar" : "en"
      );
    }
  }

  return `
    <article class="item-card">
      ${image}

      <div class="item-card-content">
        <span class="tag ${found ? "found" : "lost"}">
          ${found ? t("غرض موجود", "Found item") : t("غرض مفقود", "Lost item")}
        </span>

        <h3>${title}</h3>

        <p class="item-description">
          ${description || t("لا يوجد وصف إضافي.", "No additional description.")}
        </p>

        <div class="item-meta">
          <span>⌖ ${locationText || t("الموقع غير محدد", "Location not specified")}</span>
          <span>${dateText}</span>
        </div>

        ${
          owner
            ? `<p class="muted">${t("الحالة: ", "Status: ")}${esc(item.status)}</p>`
            : `<button class="btn btn-outline claim-button" onclick="makeClaim(${Number(item.id)})">${t("طلب استرجاع", "Request return")}</button>`
        }
      </div>
    </article>
  `;
}

// بيانات الصفحة الرئيسية
let publicItems = [];
let publicFilter = "all";

function renderPublicItems() {
  const grid = document.getElementById("itemsGrid");
  if (!grid) return;

  const searchInput = document.getElementById("reportSearch");
  const searchText = normalizeSearch(searchInput ? searchInput.value : "");

  const filtered = publicItems.filter(item => {
    const matchesType =
      publicFilter === "all" || item.item_type === publicFilter;

    const searchableText = normalizeSearch([
      item.title,
      item.description,
      item.location,
      item.category_name,
      item.owner_name
    ].filter(Boolean).join(" "));

    return matchesType && searchableText.includes(searchText);
  });

  if (filtered.length) {
    grid.innerHTML = filtered.map(item => itemCard(item)).join("");
  } else {
    grid.innerHTML = `
      <div class="empty">
        <span class="empty-icon">⌕</span>
        <strong>${t("لم نعثر على نتائج", "No results found")}</strong>
        <p>${t("جرّبي كلمة بحث أخرى أو غيّري التصنيف.", "Try another search term or change the filter.")}</p>
        <button type="button" class="btn btn-outline" onclick="clearPublicSearch()">
          ${t("مسح البحث", "Clear search")}
        </button>
      </div>
    `;
  }

  document.querySelectorAll(".filter-btn").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.filter === publicFilter
    );
  });

  const count = document.getElementById("resultsCount");
  if (count) {
    count.textContent = t(
      `عدد النتائج: ${filtered.length}`,
      `Results: ${filtered.length}`
    );
  }
}

function filterPublicItems(type) {
  if (!["all", "lost", "found"].includes(type)) return;

  publicFilter = type;
  renderPublicItems();
}

function clearPublicSearch() {
  const input = document.getElementById("reportSearch");
  if (input) input.value = "";

  publicFilter = "all";
  renderPublicItems();
}

async function loadPublicItems() {
  const grid = document.getElementById("itemsGrid");
  if (!grid) return;

  grid.innerHTML = `
    <div class="loading-state">
      ${t("جارٍ تحميل البلاغات...", "Loading reports...")}
    </div>
  `;

  try {
    const data = await api("/api/items");
    publicItems = Array.isArray(data.items) ? data.items : [];
    renderPublicItems();
  } catch (error) {
    console.error("Loading public items failed:", error);

    grid.innerHTML = `
      <div class="empty">
        ${t("تعذر تحميل البلاغات. يرجى تحديث الصفحة.", "Could not load reports. Please refresh the page.")}
        <p>${esc(error.message)}</p>
        <button class="btn btn-outline" onclick="loadPublicItems()">
          ${t("إعادة المحاولة", "Try again")}
        </button>
      </div>
    `;
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
  } catch (error) {
    alert(error.message);
  }
}

async function loadDashboard() {
  try {
    const data = await api("/api/dashboard");

    const userName = document.getElementById("userName");
    const myItems = document.getElementById("myItems");

    if (userName) userName.textContent = data.user.name;

    if (myItems) {
      myItems.innerHTML = data.items.length
        ? data.items.map(item => itemCard(item, true)).join("")
        : `<div class="empty">${t("لم تضف أي بلاغ بعد.", "You have not posted any reports yet.")}</div>`;
    }

    renderClaims("incomingClaims", data.incomingClaims || [], true);
    renderClaims("myClaims", data.myClaims || [], false);
  } catch (error) {
    location.href = "login.html";
  }
}

function renderClaims(id, claims, incoming) {
  const element = document.getElementById(id);
  if (!element) return;

  if (!claims.length) {
    element.innerHTML = `
      <div class="empty">
        ${t("لا توجد طلبات حالياً.", "No requests yet.")}
      </div>
    `;
    return;
  }

  element.innerHTML = claims.map(claim => `
    <div class="claim-row">
      <div>
        <strong>${esc(claim.item_title)}</strong>
        <p>
          ${
            incoming
              ? t("من: ", "From: ") + esc(claim.claimant_name)
              : t("إلى: ", "To: ") + esc(claim.owner_name)
          }
          · ${esc(claim.message || "")}
        </p>
        <span class="tag">${esc(claim.status)}</span>
      </div>

      ${
        incoming
          ? `<div class="claim-actions">
              <button class="btn btn-outline btn-small" onclick="updateClaim(${Number(claim.id)}, 'accepted')">${t("قبول", "Accept")}</button>
              <button class="btn btn-outline btn-small" onclick="updateClaim(${Number(claim.id)}, 'rejected')">${t("رفض", "Decline")}</button>
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
  } catch (error) {
    alert(error.message);
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
