/**
 * Brew Studio — Owner App Logic
 * 
 * ทุก function ที่ใช้ใน HTML อยู่ใน window scope
 * แยก concerns ชัดเจน: auth, data, render, modal
 */

import { loginOwner, logoutOwner, onAuthChange, getCurrentUser } from "../shared/firebase.js";
import {
  saveShop, getMyShop, getShop,
  addMenu, updateMenu, deleteMenu, watchMenus,
  addCategory, updateCategory, deleteCategory, watchCategories,
  addAccessLog, watchAccessLogs, clearAccessLogs,
} from "../shared/db.js";
import { uploadMenuImage, uploadLogo } from "../shared/storage.js";
import { escapeHtml, sanitizeText, showToast, formatDateTime, isToday, isWithinDays, debounce } from "../shared/utils.js";

// ══════════════════════════════════════
// STATE
// ══════════════════════════════════════

const state = {
  user: null,
  shopId: null,
  shop: {},
  menus: [],
  categories: [],
  logs: [],
  activeTab: "menu",
  activeCat: null,        // null = all
  editingMenuId: null,     // null = new, string = editing
  deleteTargetId: null,
  selectedImageFile: null,
  selectedLogoFile: null,
};

// Unsubscribe watchers
const unsubs = [];

// ══════════════════════════════════════
// AUTH
// ══════════════════════════════════════

onAuthChange(async (user) => {
  if (user) {
    state.user = user;
    await initApp();
  } else {
    state.user = null;
    showLogin();
  }
});

async function initApp() {
  showApp();
  updateSyncBar("syncing", "กำลังโหลดข้อมูล...");

  try {
    // Find or create shop for this owner
    let shop = await getMyShop(state.user.uid);
    if (!shop) {
      // First time — create default shop
      const defaultId = state.user.uid.slice(0, 8);
      await saveShop(defaultId, {
        name: "Brew",
        ownerId: state.user.uid,
        staffPin: "1234",
        hero: {
          greet: "สวัสดีวันนี้ ☀️",
          line1: "เมนู",
          line1b: "ทั้งหมด",
          line2: "ของเรา",
        },
        logoUrl: "",
      });
      shop = await getMyShop(state.user.uid);
    }

    state.shopId = shop.id;
    state.shop = shop;
    updateBrandDisplay();
    updateSettingsDisplay();

    // Subscribe to realtime data
    unsubs.push(
      watchMenus(state.shopId, (menus) => {
        state.menus = menus;
        renderMenus();
        updateSyncBar("connected", "เชื่อมต่อแล้ว · Realtime");
      })
    );

    unsubs.push(
      watchCategories(state.shopId, (cats) => {
        state.categories = cats;
        renderCategoryTabs();
        renderMenus();
        renderCategoryList();
        updateSyncBar("connected", "เชื่อมต่อแล้ว · Realtime");
      })
    );

    unsubs.push(
      watchAccessLogs(state.shopId, (logs) => {
        state.logs = logs;
        renderLogs();
      })
    );

    // Force initial sync bar update
    updateSyncBar("connected", "เชื่อมต่อแล้ว · Realtime");
  } catch (err) {
    console.error("Init error:", err);
    updateSyncBar("error", "เกิดข้อผิดพลาด — กรุณาลอง refresh");
    showToast("เกิดข้อผิดพลาดในการโหลดข้อมูล", "error");
  }
}

function showLogin() {
  document.getElementById("loginScreen").style.display = "flex";
  document.getElementById("app").style.display = "none";
}

function showApp() {
  document.getElementById("loginScreen").style.display = "none";
  document.getElementById("app").style.display = "block";
}

window.handleLogin = async function () {
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  const errEl = document.getElementById("loginError");

  if (!email || !password) {
    errEl.textContent = "กรุณากรอกข้อมูลให้ครบ";
    return;
  }

  const btn = document.getElementById("loginBtn");
  btn.disabled = true;
  btn.textContent = "กำลังเข้าสู่ระบบ...";

  const result = await loginOwner(email, password);
  if (!result.success) {
    errEl.textContent = result.error;
    btn.disabled = false;
    btn.textContent = "เข้าสู่ระบบ";
  }
};

window.handleLogout = async function () {
  // Clean up watchers
  unsubs.forEach((fn) => fn());
  unsubs.length = 0;
  await logoutOwner();
};

// ══════════════════════════════════════
// SYNC BAR
// ══════════════════════════════════════

function updateSyncBar(status, text) {
  const bar = document.getElementById("syncBar");
  const textEl = document.getElementById("syncText");
  bar.className = `sync-bar${status === "syncing" ? " sync-bar--syncing" : status === "error" ? " sync-bar--error" : ""}`;
  textEl.textContent = text;
}

// ══════════════════════════════════════
// TAB NAVIGATION
// ══════════════════════════════════════

window.switchTab = function (tab) {
  state.activeTab = tab;

  // Update tab buttons
  document.querySelectorAll(".tab").forEach((t) => {
    t.classList.toggle("tab--active", t.dataset.tab === tab);
  });

  // Show/hide pages
  document.querySelectorAll(".page").forEach((p) => p.classList.remove("page--active"));
  const pageMap = { menu: "pageMenu", log: "pageLog", settings: "pageSettings" };
  document.getElementById(pageMap[tab]).classList.add("page--active");

  // FAB only on menu tab
  const fabEl = document.getElementById("fab");
  if (fabEl) fabEl.style.display = tab === "menu" ? "flex" : "none";
};

// ══════════════════════════════════════
// RENDER: CATEGORIES
// ══════════════════════════════════════

function renderCategoryTabs() {
  const bar = document.getElementById("catBar");
  const allCount = state.menus.length;

  let html = `<button class="cat-tab${!state.activeCat ? " cat-tab--active" : ""}" onclick="filterCategory(null)">
    ทั้งหมด <span class="cat-tab__count">${allCount}</span>
  </button>`;

  state.categories.forEach((cat) => {
    const count = state.menus.filter((m) => m.categoryId === cat.id).length;
    const active = state.activeCat === cat.id;
    html += `<button class="cat-tab${active ? " cat-tab--active" : ""}" onclick="filterCategory('${cat.id}')">
      ${escapeHtml(cat.emoji || "")} ${escapeHtml(cat.name)} <span class="cat-tab__count">${count}</span>
    </button>`;
  });

  bar.innerHTML = html;
}

window.filterCategory = function (catId) {
  state.activeCat = catId;
  renderCategoryTabs();
  renderMenus();
};

// ══════════════════════════════════════
// RENDER: MENU GRID
// ══════════════════════════════════════

window.renderMenus = function () {
  const grid = document.getElementById("menuGrid");
  const search = (document.getElementById("searchInput")?.value || "").toLowerCase().trim();

  let filtered = state.menus;

  // Filter by category
  if (state.activeCat) {
    filtered = filtered.filter((m) => m.categoryId === state.activeCat);
  }

  // Filter by search
  if (search) {
    filtered = filtered.filter(
      (m) =>
        (m.name || "").toLowerCase().includes(search) ||
        (m.description || "").toLowerCase().includes(search)
    );
  }

  // Update header
  document.getElementById("sectionCount").textContent = `${filtered.length} เมนู`;

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="menu-empty">
        <div class="menu-empty__icon">${search ? "🔍" : "☕"}</div>
        <div class="menu-empty__text">${
          search ? "ไม่พบเมนูที่ค้นหา" : "ยังไม่มีเมนู — กด ＋ เพื่อเพิ่ม"
        }</div>
      </div>`;
    return;
  }

  grid.innerHTML = filtered
    .map((m, i) => {
      const cat = state.categories.find((c) => c.id === m.categoryId);
      const catLabel = cat ? `${cat.emoji || ""} ${cat.name}` : "";
      const hasImage = m.imageUrl || m.image;
      const imgSrc = m.imageUrl || m.image || "";
      return `
      <div class="menu-card" style="animation-delay:${i * 40}ms" onclick="openMenuModal('${m.id}')">
        <div class="menu-card__image">
          <img class="menu-card__img${hasImage ? " menu-card__img--show" : ""}" 
               src="${escapeHtml(imgSrc)}" alt="${escapeHtml(m.name)}" loading="lazy"
               onerror="this.classList.remove('menu-card__img--show');this.nextElementSibling.classList.remove('menu-card__placeholder--gone')">
          <div class="menu-card__placeholder${hasImage ? " menu-card__placeholder--gone" : ""}">☕</div>
          <div class="menu-card__gradient"></div>
          ${catLabel ? `<span class="menu-card__category">${escapeHtml(catLabel)}</span>` : ""}
          <div class="menu-card__actions">
            <button class="menu-card__action-btn menu-card__action-btn--edit" onclick="event.stopPropagation();openMenuModal('${m.id}')" title="แก้ไข">✎</button>
            <button class="menu-card__action-btn menu-card__action-btn--delete" onclick="event.stopPropagation();confirmDeleteMenu('${m.id}','${escapeHtml(m.name)}')" title="ลบ">✕</button>
          </div>
        </div>
        <div class="menu-card__body">
          <div class="menu-card__name">${escapeHtml(m.name)}</div>
          ${m.description ? `<div class="menu-card__desc">${escapeHtml(m.description)}</div>` : ""}
        </div>
      </div>`;
    })
    .join("");
};

// ══════════════════════════════════════
// RENDER: LOG
// ══════════════════════════════════════

function renderLogs() {
  const list = document.getElementById("logList");

  // Stats
  const todayCount = state.logs.filter((l) => isToday(l.timestamp)).length;
  const weekCount = state.logs.filter((l) => isWithinDays(l.timestamp, 7)).length;
  document.getElementById("statToday").textContent = todayCount;
  document.getElementById("statWeek").textContent = weekCount;
  document.getElementById("statTotal").textContent = state.logs.length;

  if (state.logs.length === 0) {
    list.innerHTML = '<div class="log-empty">📋 ยังไม่มีบันทึก</div>';
    return;
  }

  list.innerHTML = state.logs
    .map(
      (log, i) => `
      <div class="log-item" style="animation-delay:${i * 30}ms">
        <div class="log-item__avatar">${escapeHtml((log.staffName || "?")[0])}</div>
        <div class="log-item__body">
          <div class="log-item__name">${escapeHtml(log.staffName || "ไม่ทราบชื่อ")}</div>
          <div class="log-item__time">${formatDateTime(log.timestamp)}</div>
        </div>
        <div class="log-item__status">✓</div>
      </div>`
    )
    .join("");
}

// ══════════════════════════════════════
// MENU MODAL
// ══════════════════════════════════════

window.openMenuModal = function (menuId) {
  state.editingMenuId = menuId === -1 ? null : menuId;
  state.selectedImageFile = null;

  const modal = document.getElementById("menuModal");
  const title = document.getElementById("menuModalTitle");
  const clearBtn = document.getElementById("imageClearBtn");

  // Populate category dropdown
  const catSelect = document.getElementById("menuCategory");
  catSelect.innerHTML =
    '<option value="">ไม่ระบุ</option>' +
    state.categories.map((c) => `<option value="${c.id}">${c.emoji || ""} ${c.name}</option>`).join("");

  if (menuId && menuId !== -1) {
    // Editing existing
    const m = state.menus.find((x) => x.id === menuId);
    if (!m) return;
    title.textContent = "แก้ไขเมนู";
    document.getElementById("menuName").value = m.name || "";
    document.getElementById("menuDesc").value = m.description || "";
    document.getElementById("menuNote").value = m.note || "";
    catSelect.value = m.categoryId || "";

    // Image
    const imgSrc = m.imageUrl || m.image || "";
    setImagePreview(imgSrc);
    document.getElementById("imageUrl").value = m.imageUrl && !m.image ? m.imageUrl : "";

    // Ingredients
    renderIngredients(m.ingredients || []);

    // Steps
    renderSteps(m.steps || []);
  } else {
    // New menu
    title.textContent = "เพิ่มเมนูใหม่";
    document.getElementById("menuName").value = "";
    document.getElementById("menuDesc").value = "";
    document.getElementById("menuNote").value = "";
    document.getElementById("imageUrl").value = "";
    catSelect.value = "";
    clearImagePreview();
    renderIngredients([]);
    renderSteps([]);
  }

  modal.classList.add("overlay--open");
};

window.closeMenuModal = function () {
  document.getElementById("menuModal").classList.remove("overlay--open");
};

// Image handling
function setImagePreview(src) {
  const el = document.getElementById("imagePreview");
  const zone = document.getElementById("imageZone");
  const clearBtn = document.getElementById("imageClearBtn");
  if (src) {
    el.src = src;
    el.classList.add("image-zone__preview--show");
    zone.classList.add("image-zone--has-image");
    clearBtn.style.display = "block";
  } else {
    clearImagePreview();
  }
}

function clearImagePreview() {
  const el = document.getElementById("imagePreview");
  const zone = document.getElementById("imageZone");
  const clearBtn = document.getElementById("imageClearBtn");
  el.src = "";
  el.classList.remove("image-zone__preview--show");
  zone.classList.remove("image-zone--has-image");
  clearBtn.style.display = "none";
}

window.clearImage = function () {
  state.selectedImageFile = null;
  document.getElementById("imageInput").value = "";
  document.getElementById("imageUrl").value = "";
  clearImagePreview();
};

window.handleImageSelect = function (e) {
  const file = e.target.files[0];
  if (!file) return;
  state.selectedImageFile = file;
  const reader = new FileReader();
  reader.onload = (ev) => setImagePreview(ev.target.result);
  reader.readAsDataURL(file);
};

window.handleImageUrl = function (url) {
  if (url) setImagePreview(url);
  else clearImagePreview();
  state.selectedImageFile = null;
};

// Ingredient rows
function renderIngredients(items) {
  const container = document.getElementById("ingredientsList");
  if (!items || items.length === 0) items = [{ name: "", amount: "", unit: "" }];
  container.innerHTML = items
    .map(
      (ing, i) => `
    <div class="ingredient-row">
      <input class="input" placeholder="ส่วนผสม" value="${escapeHtml(ing.name || "")}" data-field="name">
      <input class="input" placeholder="ปริมาณ" value="${escapeHtml(String(ing.amount || ""))}" data-field="amount">
      <input class="input" placeholder="หน่วย" value="${escapeHtml(ing.unit || "")}" data-field="unit">
      <button class="btn-remove" onclick="this.closest('.ingredient-row').remove()">✕</button>
    </div>`
    )
    .join("");
}

window.addIngredientRow = function () {
  const container = document.getElementById("ingredientsList");
  const row = document.createElement("div");
  row.className = "ingredient-row";
  row.innerHTML = `
    <input class="input" placeholder="ส่วนผสม" data-field="name">
    <input class="input" placeholder="ปริมาณ" data-field="amount">
    <input class="input" placeholder="หน่วย" data-field="unit">
    <button class="btn-remove" onclick="this.closest('.ingredient-row').remove()">✕</button>`;
  container.appendChild(row);
  row.querySelector('input[data-field="name"]').focus();
};

// Step rows
function renderSteps(items) {
  const container = document.getElementById("stepsList");
  if (!items || items.length === 0) items = [""];
  container.innerHTML = items
    .map(
      (step, i) => `
    <div class="step-row">
      <div class="step-row__number">${i + 1}</div>
      <textarea class="input" placeholder="ขั้นตอน...">${escapeHtml(typeof step === "string" ? step : step.text || "")}</textarea>
      <button class="btn-remove" style="margin-top:10px" onclick="this.closest('.step-row').remove();reNumberSteps()">✕</button>
    </div>`
    )
    .join("");
}

window.addStepRow = function () {
  const container = document.getElementById("stepsList");
  const count = container.querySelectorAll(".step-row").length;
  const row = document.createElement("div");
  row.className = "step-row";
  row.innerHTML = `
    <div class="step-row__number">${count + 1}</div>
    <textarea class="input" placeholder="ขั้นตอน..."></textarea>
    <button class="btn-remove" style="margin-top:10px" onclick="this.closest('.step-row').remove();reNumberSteps()">✕</button>`;
  container.appendChild(row);
  row.querySelector("textarea").focus();
};

window.reNumberSteps = function () {
  document.querySelectorAll("#stepsList .step-row__number").forEach((el, i) => {
    el.textContent = i + 1;
  });
};

// Save menu
window.saveMenu = async function () {
  const name = sanitizeText(document.getElementById("menuName").value, 200);
  if (!name) {
    showToast("กรุณาใส่ชื่อเมนู", "error");
    return;
  }

  const description = sanitizeText(document.getElementById("menuDesc").value, 500);
  const note = sanitizeText(document.getElementById("menuNote").value, 1000);
  const categoryId = document.getElementById("menuCategory").value;

  // Gather ingredients
  const ingredients = [];
  document.querySelectorAll("#ingredientsList .ingredient-row").forEach((row) => {
    const n = row.querySelector('[data-field="name"]').value.trim();
    const a = row.querySelector('[data-field="amount"]').value.trim();
    const u = row.querySelector('[data-field="unit"]').value.trim();
    if (n) ingredients.push({ name: n, amount: a, unit: u });
  });

  // Gather steps
  const steps = [];
  document.querySelectorAll("#stepsList textarea").forEach((ta) => {
    const t = ta.value.trim();
    if (t) steps.push(t);
  });

  try {
    let imageUrl = "";

    // Handle image
    if (state.selectedImageFile) {
      // Upload to storage
      const tempId = state.editingMenuId || Date.now().toString();
      showToast("กำลังอัปโหลดรูปภาพ...", "info");
      imageUrl = await uploadMenuImage(state.shopId, tempId, state.selectedImageFile);
    } else {
      // Check URL input
      imageUrl = document.getElementById("imageUrl").value.trim();
    }

    // Keep existing image if no new one
    if (!imageUrl && state.editingMenuId) {
      const existing = state.menus.find((m) => m.id === state.editingMenuId);
      if (existing) imageUrl = existing.imageUrl || existing.image || "";
    }

    // Check if image was cleared
    const imgPreview = document.getElementById("imagePreview");
    if (!imgPreview.classList.contains("image-zone__preview--show")) {
      imageUrl = "";
    }

    const menuData = {
      name,
      description,
      note,
      categoryId,
      ingredients,
      steps,
      imageUrl,
      shopId: state.shopId,
    };

    if (state.editingMenuId) {
      await updateMenu(state.editingMenuId, menuData);
      showToast("อัปเดตเมนูสำเร็จ ✓");
    } else {
      await addMenu(menuData);
      showToast("เพิ่มเมนูสำเร็จ ✓");
    }

    closeMenuModal();
  } catch (err) {
    console.error("Save menu error:", err);
    showToast("บันทึกไม่สำเร็จ: " + err.message, "error");
  }
};

// ══════════════════════════════════════
// DELETE MENU
// ══════════════════════════════════════

window.confirmDeleteMenu = function (id, name) {
  state.deleteTargetId = id;
  document.getElementById("confirmText").textContent = `"${name}" จะถูกลบถาวร`;
  document.getElementById("confirmOverlay").classList.add("confirm-overlay--open");
};

window.closeConfirm = function () {
  document.getElementById("confirmOverlay").classList.remove("confirm-overlay--open");
  state.deleteTargetId = null;
};

window.confirmDelete = async function () {
  if (!state.deleteTargetId) return;
  try {
    await deleteMenu(state.deleteTargetId);
    showToast("ลบเมนูสำเร็จ");
  } catch (err) {
    showToast("ลบไม่สำเร็จ", "error");
  }
  closeConfirm();
};

// ══════════════════════════════════════
// CATEGORY MODAL
// ══════════════════════════════════════

function renderCategoryList() {
  const list = document.getElementById("catList");
  if (!list) return;
  list.innerHTML = state.categories
    .map((cat) => {
      const count = state.menus.filter((m) => m.categoryId === cat.id).length;
      return `
      <li class="cat-list__item">
        <span class="cat-list__emoji">${escapeHtml(cat.emoji || "")}</span>
        <span class="cat-list__name">${escapeHtml(cat.name)}</span>
        <span class="cat-list__count">${count} เมนู</span>
        <button class="btn-remove" onclick="handleDeleteCategory('${cat.id}')">✕</button>
      </li>`;
    })
    .join("");
}

window.openCategoryModal = function () {
  renderCategoryList();
  document.getElementById("categoryModal").classList.add("overlay--open");
};

window.closeCategoryModal = function () {
  document.getElementById("categoryModal").classList.remove("overlay--open");
};

window.addNewCategory = async function () {
  const name = sanitizeText(document.getElementById("newCatName").value, 100);
  const emoji = document.getElementById("newCatEmoji").value.trim();
  if (!name) {
    showToast("กรุณาใส่ชื่อหมวดหมู่", "error");
    return;
  }
  try {
    await addCategory({ name, emoji, shopId: state.shopId, order: state.categories.length });
    document.getElementById("newCatName").value = "";
    showToast("เพิ่มหมวดหมู่สำเร็จ ✓");
  } catch (err) {
    showToast("เพิ่มไม่สำเร็จ", "error");
  }
};

window.handleDeleteCategory = async function (catId) {
  if (!confirm("ลบหมวดหมู่นี้?")) return;
  try {
    await deleteCategory(catId);
    showToast("ลบหมวดหมู่สำเร็จ");
  } catch (err) {
    showToast("ลบไม่สำเร็จ", "error");
  }
};

// ══════════════════════════════════════
// SETTINGS MODALS
// ══════════════════════════════════════

// -- Branding --
window.openBrandingModal = function () {
  document.getElementById("brandNameInput").value = state.shop.name || "";
  const logo = state.shop.logoUrl || "";
  if (logo) {
    document.getElementById("logoPreview").src = logo;
    document.getElementById("logoPreview").classList.add("logo-zone__preview--show");
    document.getElementById("logoZone").classList.add("logo-zone--has-image");
  }
  document.getElementById("brandingModal").classList.add("overlay--open");
};

window.closeBrandingModal = function () {
  document.getElementById("brandingModal").classList.remove("overlay--open");
};

window.handleLogoSelect = function (e) {
  const file = e.target.files[0];
  if (!file) return;
  state.selectedLogoFile = file;
  const reader = new FileReader();
  reader.onload = (ev) => {
    document.getElementById("logoPreview").src = ev.target.result;
    document.getElementById("logoPreview").classList.add("logo-zone__preview--show");
    document.getElementById("logoZone").classList.add("logo-zone--has-image");
  };
  reader.readAsDataURL(file);
};

window.saveBranding = async function () {
  const name = sanitizeText(document.getElementById("brandNameInput").value, 100);
  if (!name) {
    showToast("กรุณาใส่ชื่อร้าน", "error");
    return;
  }
  try {
    let logoUrl = state.shop.logoUrl || "";
    if (state.selectedLogoFile) {
      showToast("กำลังอัปโหลดโลโก้...", "info");
      logoUrl = await uploadLogo(state.shopId, state.selectedLogoFile);
      state.selectedLogoFile = null;
    } else {
      const urlInput = document.getElementById("logoUrl").value.trim();
      if (urlInput) logoUrl = urlInput;
    }

    state.shop.name = name;
    state.shop.logoUrl = logoUrl;
    await saveShop(state.shopId, { ...state.shop });

    updateBrandDisplay();
    updateSettingsDisplay();
    closeBrandingModal();
    showToast("บันทึกแบรนด์สำเร็จ ✓");
  } catch (err) {
    showToast("บันทึกไม่สำเร็จ", "error");
  }
};

// -- Hero Text --
window.openHeroModal = function () {
  const hero = state.shop.hero || {};
  document.getElementById("heroGreet").value = hero.greet || "";
  document.getElementById("heroLine1").value = hero.line1 || "";
  document.getElementById("heroLine1b").value = hero.line1b || "";
  document.getElementById("heroLine2").value = hero.line2 || "";
  document.getElementById("heroModal").classList.add("overlay--open");
};

window.closeHeroModal = function () {
  document.getElementById("heroModal").classList.remove("overlay--open");
};

window.saveHero = async function () {
  const hero = {
    greet: sanitizeText(document.getElementById("heroGreet").value, 100),
    line1: sanitizeText(document.getElementById("heroLine1").value, 50),
    line1b: sanitizeText(document.getElementById("heroLine1b").value, 50),
    line2: sanitizeText(document.getElementById("heroLine2").value, 50),
  };
  try {
    state.shop.hero = hero;
    await saveShop(state.shopId, { ...state.shop });
    updateSettingsDisplay();
    closeHeroModal();
    showToast("บันทึกข้อความสำเร็จ ✓");
  } catch (err) {
    showToast("บันทึกไม่สำเร็จ", "error");
  }
};

// -- PIN --
window.openPinModal = function () {
  document.getElementById("newPinInput").value = "";
  document.getElementById("confirmPinInput").value = "";
  document.getElementById("pinModal").classList.add("overlay--open");
};

window.closePinModal = function () {
  document.getElementById("pinModal").classList.remove("overlay--open");
};

window.savePin = async function () {
  const pin = document.getElementById("newPinInput").value;
  const confirm = document.getElementById("confirmPinInput").value;

  if (!/^\d{4,8}$/.test(pin)) {
    showToast("PIN ต้องเป็นตัวเลข 4-8 หลัก", "error");
    return;
  }
  if (pin !== confirm) {
    showToast("PIN ไม่ตรงกัน", "error");
    return;
  }

  try {
    state.shop.staffPin = pin;
    await saveShop(state.shopId, { ...state.shop });
    updateSettingsDisplay();
    closePinModal();
    showToast("เปลี่ยน PIN สำเร็จ ✓");
  } catch (err) {
    showToast("บันทึกไม่สำเร็จ", "error");
  }
};

window.sharePin = function () {
  const pin = state.shop.staffPin || "1234";
  navigator.clipboard.writeText(pin).then(() => showToast("คัดลอก PIN แล้ว"));
};

// ══════════════════════════════════════
// DISPLAY HELPERS
// ══════════════════════════════════════

function updateBrandDisplay() {
  const logo = document.getElementById("navLogo");
  const brand = document.getElementById("navBrand");
  if (state.shop.logoUrl) {
    logo.src = state.shop.logoUrl;
    logo.classList.add("nav-logo--show");
  } else {
    logo.classList.remove("nav-logo--show");
  }
  brand.textContent = (state.shop.name || "Brew") + " ✦";
}

function updateSettingsDisplay() {
  document.getElementById("brandingSub").textContent = state.shop.name || "Brew";
  const hero = state.shop.hero || {};
  document.getElementById("heroSub").textContent = hero.greet || "สวัสดีวันนี้ ☀️";
  document.getElementById("pinSub").textContent = (state.shop.staffPin || "1234").replace(/./g, "•");
}

// ══════════════════════════════════════
// ACCESS LOG ACTIONS
// ══════════════════════════════════════

window.handleClearLogs = async function () {
  if (!confirm("ล้างบันทึกทั้งหมด?")) return;
  try {
    await clearAccessLogs(state.shopId);
    showToast("ล้างบันทึกสำเร็จ");
  } catch (err) {
    showToast("ล้างไม่สำเร็จ", "error");
  }
};

// ══════════════════════════════════════
// STAFF LINK
// ══════════════════════════════════════

window.copyStaffLink = function () {
  const base = window.location.origin + window.location.pathname.replace(/\/owner\/.*$/, '');
  const link = `${base}/staff/index.html?shop=${state.shopId}`;
  document.getElementById("staffLinkText").textContent = link;
  navigator.clipboard.writeText(link).then(() => showToast("คัดลอกลิงก์แล้ว ✓")).catch(() => {
    // Fallback for non-HTTPS
    showToast("ลิงก์: " + link);
  });
};

// ══════════════════════════════════════
// OVERLAY BACKDROP CLICK
// ══════════════════════════════════════

document.querySelectorAll('.overlay').forEach(ov => {
  ov.addEventListener('click', (e) => {
    if (e.target === ov) ov.classList.remove('overlay--open');
  });
});

// Search debounce
const searchEl = document.getElementById('searchInput');
if (searchEl) {
  searchEl.addEventListener('input', debounce(() => renderMenus(), 200));
}
