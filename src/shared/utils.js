/**
 * Brew Studio — Shared Utilities
 * 
 * Input sanitization, formatting, toast notifications
 */

// ══════════════════════════════════════
// SANITIZATION (ป้องกัน XSS)
// ══════════════════════════════════════

const escapeMap = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/**
 * Escape HTML entities — ใช้ก่อน render ข้อมูลจาก user เสมอ
 */
function escapeHtml(str) {
  if (typeof str !== "string") return "";
  return str.replace(/[&<>"']/g, (c) => escapeMap[c]);
}

/**
 * Sanitize text input — trim + limit length
 */
function sanitizeText(str, maxLength = 500) {
  if (typeof str !== "string") return "";
  return str.trim().slice(0, maxLength);
}

// ══════════════════════════════════════
// TOAST NOTIFICATIONS
// ══════════════════════════════════════

let toastTimeout = null;

/**
 * Show toast notification
 * @param {string} message
 * @param {'success'|'error'|'info'} type
 */
function showToast(message, type = "success") {
  let el = document.getElementById("brew-toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "brew-toast";
    el.className = "brew-toast";
    document.body.appendChild(el);
  }

  el.textContent = message;
  el.className = `brew-toast brew-toast--${type} brew-toast--show`;

  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    el.classList.remove("brew-toast--show");
  }, 2500);
}

// ══════════════════════════════════════
// DATE/TIME FORMATTING
// ══════════════════════════════════════

/**
 * Format Firestore timestamp to Thai locale
 */
function formatDate(timestamp) {
  if (!timestamp) return "";
  const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return d.toLocaleDateString("th-TH", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(timestamp) {
  if (!timestamp) return "";
  const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return d.toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateTime(timestamp) {
  return `${formatDate(timestamp)} · ${formatTime(timestamp)}`;
}

/**
 * Check if timestamp is today
 */
function isToday(timestamp) {
  if (!timestamp) return false;
  const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

/**
 * Check if timestamp is within last N days
 */
function isWithinDays(timestamp, days) {
  if (!timestamp) return false;
  const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const cutoff = new Date(Date.now() - days * 86400000);
  return d >= cutoff;
}

// ══════════════════════════════════════
// MISC
// ══════════════════════════════════════

/**
 * Debounce function
 */
function debounce(fn, ms = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/**
 * Generate simple ID
 */
function generateId(prefix = "") {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export {
  escapeHtml, sanitizeText,
  showToast,
  formatDate, formatTime, formatDateTime, isToday, isWithinDays,
  debounce, generateId,
};
