/**
 * Brew Studio — Firestore Database Operations
 * 
 * แยก collection ชัดเจน — ไม่ยัดทุกอย่างใน doc เดียว
 */

import {
  collection, doc, addDoc, setDoc, getDoc, getDocs,
  updateDoc, deleteDoc, onSnapshot, query, where, orderBy,
  serverTimestamp, limit,
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { db } from "./firebase.js";

// ══════════════════════════════════════
// SHOP
// ══════════════════════════════════════

/**
 * Create or update shop profile
 */
async function saveShop(shopId, data) {
  const ref = doc(db, "shops", shopId);
  await setDoc(ref, { ...data, updatedAt: serverTimestamp() }, { merge: true });

  // Also save public-facing data (readable by staff without auth)
  const publicData = {
    name: data.name || "",
    logoUrl: data.logoUrl || "",
    hero: data.hero || {},
    staffPin: data.staffPin || "",
    updatedAt: serverTimestamp(),
  };
  await setDoc(doc(db, "shops_public", shopId), publicData, { merge: true });
}

async function getShop(shopId) {
  const snap = await getDoc(doc(db, "shops", shopId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

async function getShopPublic(shopId) {
  const snap = await getDoc(doc(db, "shops_public", shopId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

function watchShopPublic(shopId, callback) {
  return onSnapshot(doc(db, "shops_public", shopId), (snap) => {
    if (snap.exists()) callback({ id: snap.id, ...snap.data() });
  });
}

/**
 * Get the shop owned by this user
 */
async function getMyShop(uid) {
  const q = query(collection(db, "shops"), where("ownerId", "==", uid), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

// ══════════════════════════════════════
// MENUS
// ══════════════════════════════════════

async function addMenu(menuData) {
  const ref = await addDoc(collection(db, "menus"), {
    ...menuData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

async function updateMenu(menuId, menuData) {
  await updateDoc(doc(db, "menus", menuId), {
    ...menuData,
    updatedAt: serverTimestamp(),
  });
}

async function deleteMenu(menuId) {
  await deleteDoc(doc(db, "menus", menuId));
}

function watchMenus(shopId, callback) {
  const q = query(
    collection(db, "menus"),
    where("shopId", "==", shopId),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, (snap) => {
    const menus = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(menus);
  });
}

// ══════════════════════════════════════
// CATEGORIES
// ══════════════════════════════════════

async function addCategory(catData) {
  const ref = await addDoc(collection(db, "categories"), {
    ...catData,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

async function updateCategory(catId, catData) {
  await updateDoc(doc(db, "categories", catId), catData);
}

async function deleteCategory(catId) {
  await deleteDoc(doc(db, "categories", catId));
}

function watchCategories(shopId, callback) {
  const q = query(
    collection(db, "categories"),
    where("shopId", "==", shopId),
    orderBy("name")
  );
  return onSnapshot(q, (snap) => {
    const cats = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(cats);
  });
}

// ══════════════════════════════════════
// ACCESS LOGS
// ══════════════════════════════════════

async function addAccessLog(shopId, staffName) {
  await addDoc(collection(db, "access_logs"), {
    shopId,
    staffName,
    timestamp: serverTimestamp(),
  });
}

function watchAccessLogs(shopId, callback, maxItems = 100) {
  const q = query(
    collection(db, "access_logs"),
    where("shopId", "==", shopId),
    orderBy("timestamp", "desc"),
    limit(maxItems)
  );
  return onSnapshot(q, (snap) => {
    const logs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(logs);
  });
}

async function clearAccessLogs(shopId) {
  const q = query(collection(db, "access_logs"), where("shopId", "==", shopId));
  const snap = await getDocs(q);
  const batch = [];
  for (const d of snap.docs) {
    batch.push(deleteDoc(doc(db, "access_logs", d.id)));
  }
  await Promise.all(batch);
}

export {
  saveShop, getShop, getShopPublic, watchShopPublic, getMyShop,
  addMenu, updateMenu, deleteMenu, watchMenus,
  addCategory, updateCategory, deleteCategory, watchCategories,
  addAccessLog, watchAccessLogs, clearAccessLogs,
};
