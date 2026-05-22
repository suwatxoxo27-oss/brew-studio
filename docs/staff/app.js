/**
 * Brew Studio — Staff App Logic
 * 
 * PIN login → recipe browser with realtime sync
 * ไม่ต้อง Firebase Auth — ใช้ PIN จาก shops_public
 */

import { getShopPublic, watchShopPublic, watchMenus, watchCategories, addAccessLog } from "../shared/db.js";
import { escapeHtml, showToast } from "../shared/utils.js";

// ══════════════════════════════════════
// STATE
// ══════════════════════════════════════

const state = {
  shopId: null,
  shop: {},
  menus: [],
  categories: [],
  activeCat: null,
  pinBuffer: "",
  pinLength: 4,
  isAuthenticated: false,
  staffName: "",
};

const unsubs = [];

// ══════════════════════════════════════
// INIT — Get shopId from URL
// ══════════════════════════════════════

(async function init() {
  const params = new URLSearchParams(window.location.search);
  state.shopId = params.get("shop");

  if (!state.shopId) {
    document.getElementById("pinError").textContent = "ลิงก์ไม่ถูกต้อง — ขาด ?shop=ID";
    return;
  }

  // Load shop public data
  try {
    const shop = await getShopPublic(state.shopId);
    if (!shop) {
      document.getElementById("pinError").textContent = "ไม่พบร้านค้านี้";
      return;
    }
    state.shop = shop;
    state.pinLength = (shop.staffPin || "1234").length;
    updatePinDots();
    updateBranding();

    // Watch for branding changes
    unsubs.push(
      watchShopPublic(state.shopId, (data) => {
        state.shop = data;
        updateBranding();
      })
    );
  } catch (err) {
    console.error(err);
    document.getElementById("pinError").textContent = "เกิดข้อผิดพลาด";
  }
})();

function updateBranding() {
  const name = state.shop.name || "Brew";
  const logoUrl = state.shop.logoUrl || "";

  // PIN screen
  document.getElementById("pinBrand").textContent = name + " ✦";
  const pinLogo = document.getElementById("pinLogo");
  if (logoUrl) {
    pinLogo.src = logoUrl;
    pinLogo.classList.add("pin-logo--show");
  }

  // App screen
  if (state.isAuthenticated) {
    document.getElementById("heroBrand").textContent = name + " ✦";
    const heroLogo = document.getElementById("heroLogo");
    if (logoUrl) {
      heroLogo.src = logoUrl;
      heroLogo.classList.add("hero__logo--show");
    }

    const hero = state.shop.hero || {};
    document.getElementById("heroGreet").textContent = hero.greet || "สวัสดีวันนี้ ☀️";
    document.getElementById("heroLine1").textContent = hero.line1 || "เมนู";
    document.getElementById("heroLine1b").textContent = hero.line1b || "ทั้งหมด";
    document.getElementById("heroLine2").textContent = hero.line2 || "ของเรา";
  }
}

// ══════════════════════════════════════
// PIN INPUT
// ══════════════════════════════════════

function updatePinDots() {
  const container = document.getElementById("pinDots");
  container.innerHTML = "";
  for (let i = 0; i < state.pinLength; i++) {
    const dot = document.createElement("span");
    dot.className = `pin-dot${i < state.pinBuffer.length ? " pin-dot--filled" : ""}`;
    container.appendChild(dot);
  }
}

window.pressKey = function (key) {
  if (state.pinBuffer.length >= state.pinLength) return;
  state.pinBuffer += key;
  updatePinDots();

  if (state.pinBuffer.length === state.pinLength) {
    checkPin();
  }
};

window.pressDelete = function () {
  state.pinBuffer = state.pinBuffer.slice(0, -1);
  updatePinDots();
  document.getElementById("pinError").textContent = "";
};

function checkPin() {
  const correctPin = state.shop.staffPin || "1234";
  if (state.pinBuffer === correctPin) {
    // Show name input
    document.getElementById("numpad").style.display = "none";
    document.getElementById("pinDots").style.display = "none";
    document.getElementById("pinError").textContent = "";
    document.querySelector(".pin-heading").textContent = "PIN ถูกต้อง ✓";
    document.getElementById("pinNameWrap").style.display = "block";
    setTimeout(() => document.getElementById("staffNameInput").focus(), 300);
  } else {
    // Wrong PIN
    document.getElementById("pinError").textContent = "PIN ไม่ถูกต้อง";
    document.querySelectorAll(".pin-dot").forEach((d) => d.classList.add("pin-dot--wrong"));
    setTimeout(() => {
      state.pinBuffer = "";
      updatePinDots();
    }, 400);
  }
}

window.submitStaffName = async function () {
  const name = document.getElementById("staffNameInput").value.trim();
  if (!name) {
    showToast("กรุณาใส่ชื่อ", "error");
    return;
  }
  state.staffName = name;
  state.isAuthenticated = true;

  // Log access
  try {
    await addAccessLog(state.shopId, name);
  } catch (e) {
    console.warn("Could not log access:", e);
  }

  enterApp();
};

// ══════════════════════════════════════
// ENTER APP
// ══════════════════════════════════════

function enterApp() {
  document.getElementById("pinScreen").style.display = "none";
  document.getElementById("staffApp").style.display = "block";
  updateBranding();

  // Subscribe to realtime data
  unsubs.push(
    watchMenus(state.shopId, (menus) => {
      state.menus = menus;
      staffRenderMenus();
    })
  );

  unsubs.push(
    watchCategories(state.shopId, (cats) => {
      state.categories = cats;
      renderCategoryChips();
      staffRenderMenus();
    })
  );
}

// ══════════════════════════════════════
// RENDER CATEGORIES
// ══════════════════════════════════════

function renderCategoryChips() {
  const bar = document.getElementById("staffCatBar");
  let html = `<button class="staff-cat-chip${!state.activeCat ? " staff-cat-chip--active" : ""}" onclick="staffFilterCat(null)">
    ทั้งหมด
  </button>`;

  state.categories.forEach((cat) => {
    const active = state.activeCat === cat.id;
    html += `<button class="staff-cat-chip${active ? " staff-cat-chip--active" : ""}" onclick="staffFilterCat('${cat.id}')">
      ${escapeHtml(cat.emoji || "")} ${escapeHtml(cat.name)}
    </button>`;
  });

  bar.innerHTML = html;
}

window.staffFilterCat = function (catId) {
  state.activeCat = catId;
  renderCategoryChips();
  staffRenderMenus();
};

// ══════════════════════════════════════
// RENDER MENU GRID
// ══════════════════════════════════════

window.staffRenderMenus = function () {
  const grid = document.getElementById("staffGrid");
  const search = (document.getElementById("staffSearch")?.value || "").toLowerCase().trim();

  let filtered = state.menus;

  if (state.activeCat) {
    filtered = filtered.filter((m) => m.categoryId === state.activeCat);
  }

  if (search) {
    filtered = filtered.filter(
      (m) =>
        (m.name || "").toLowerCase().includes(search) ||
        (m.description || "").toLowerCase().includes(search)
    );
  }

  if (filtered.length === 0) {
    grid.innerHTML = `<div class="staff-empty">${search ? "🔍 ไม่พบเมนูที่ค้นหา" : "☕ ยังไม่มีเมนู"}</div>`;
    return;
  }

  grid.innerHTML = filtered
    .map((m, i) => {
      const cat = state.categories.find((c) => c.id === m.categoryId);
      const catLabel = cat ? `${cat.emoji || ""} ${cat.name}` : "";
      const hasImage = m.imageUrl || m.image;
      const imgSrc = m.imageUrl || m.image || "";
      return `
      <div class="staff-card" style="animation-delay:${i * 40}ms" onclick="openRecipe('${m.id}')">
        <div class="staff-card__image">
          <img class="staff-card__img${hasImage ? " staff-card__img--show" : ""}" 
               src="${escapeHtml(imgSrc)}" alt="${escapeHtml(m.name)}" loading="lazy"
               onerror="this.classList.remove('staff-card__img--show')">
          <div class="staff-card__placeholder" style="${hasImage ? "display:none" : ""}">☕</div>
          <div class="staff-card__gradient"></div>
          ${catLabel ? `<span class="staff-card__cat">${escapeHtml(catLabel)}</span>` : ""}
        </div>
        <div class="staff-card__body">
          <div class="staff-card__name">${escapeHtml(m.name)}</div>
          ${m.description ? `<div class="staff-card__desc">${escapeHtml(m.description)}</div>` : ""}
        </div>
      </div>`;
    })
    .join("");
};

// ══════════════════════════════════════
// RECIPE DETAIL
// ══════════════════════════════════════

window.openRecipe = function (menuId) {
  const m = state.menus.find((x) => x.id === menuId);
  if (!m) return;

  const cat = state.categories.find((c) => c.id === m.categoryId);
  const modal = document.getElementById("recipeModal");

  // Image
  const imgWrap = document.getElementById("recipeImageWrap");
  const imgSrc = m.imageUrl || m.image || "";
  if (imgSrc) {
    document.getElementById("recipeImage").src = imgSrc;
    imgWrap.classList.add("recipe-image-wrap--show");
  } else {
    imgWrap.classList.remove("recipe-image-wrap--show");
  }

  // Text
  document.getElementById("recipeCategory").textContent = cat ? `${cat.emoji || ""} ${cat.name}` : "";
  document.getElementById("recipeName").textContent = m.name || "";
  document.getElementById("recipeDesc").textContent = m.description || "";

  // Ingredients
  const ings = m.ingredients || [];
  const ingSection = document.getElementById("ingredientsSection");
  if (ings.length) {
    ingSection.style.display = "block";
    document.getElementById("recipeIngredients").innerHTML = ings
      .map(
        (ing) => `
        <li>
          <span class="recipe-ing-name">${escapeHtml(ing.name)}</span>
          <span class="recipe-ing-amount">${escapeHtml(String(ing.amount || ""))} ${escapeHtml(ing.unit || "")}</span>
        </li>`
      )
      .join("");
  } else {
    ingSection.style.display = "none";
  }

  // Steps
  const steps = m.steps || [];
  const stepsSection = document.getElementById("stepsSection");
  if (steps.length) {
    stepsSection.style.display = "block";
    document.getElementById("recipeSteps").innerHTML = steps
      .map((s) => `<li>${escapeHtml(typeof s === "string" ? s : s.text || "")}</li>`)
      .join("");
  } else {
    stepsSection.style.display = "none";
  }

  // Note
  const noteEl = document.getElementById("recipeNote");
  if (m.note) {
    noteEl.style.display = "block";
    document.getElementById("recipeNoteText").textContent = m.note;
  } else {
    noteEl.style.display = "none";
  }

  modal.classList.add("overlay--open");
};

window.closeRecipe = function () {
  document.getElementById("recipeModal").classList.remove("overlay--open");
};

// ══════════════════════════════════════
// LOGOUT
// ══════════════════════════════════════

window.staffLogout = function () {
  unsubs.forEach((fn) => fn());
  unsubs.length = 0;
  state.isAuthenticated = false;
  state.pinBuffer = "";
  state.menus = [];
  state.categories = [];

  document.getElementById("staffApp").style.display = "none";
  document.getElementById("pinScreen").style.display = "flex";

  // Reset PIN screen
  document.getElementById("numpad").style.display = "grid";
  document.getElementById("pinDots").style.display = "flex";
  document.getElementById("pinNameWrap").style.display = "none";
  document.querySelector(".pin-heading").textContent = "ใส่ PIN เพื่อดูสูตร";
  updatePinDots();
};
