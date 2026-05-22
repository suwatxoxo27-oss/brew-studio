/**
 * Brew Studio — Firestore Database Operations
 * Simplified queries (no composite indexes needed)
 */

import {
  collection, doc, addDoc, setDoc, getDoc, getDocs,
  updateDoc, deleteDoc, onSnapshot, query, where,
  serverTimestamp, limit,
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { db } from "./firebase.js";

// ══════════════════════════════════════
// SHOP
// ══════════════════════════════════════

async function saveShop(shopId, data) {
  const ref = doc(db, "shops", shopId);
  await setDoc(ref, { ...data, updatedAt: serverTimestamp() }, { merge: true });
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

async function getMyShop(uid) {
  const q = query(collection(db, "shops"), where("ownerId", "==", uid), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

// ══════════════════════════════════════
// MENUS — no orderBy, sort in JS
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
    where("shopId", "==", shopId)
  );
  return onSnapshot(q, (snap) => {
    const menus = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    menus.sort((a, b) => {
      const ta = a.createdAt?.seconds || 0;
      const tb = b.createdAt?.seconds || 0;
      return tb - ta;
    });
    callback(menus);
  }, (err) => { console.error('watchMenus error:', err); callback([]); });
}

// ══════════════════════════════════════
// CATEGORIES — no orderBy, sort in JS
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
    where("shopId", "==", shopId)
  );
  return onSnapshot(q, (snap) => {
    const cats = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    cats.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    callback(cats);
  }, (err) => { console.error('watchCategories error:', err); callback([]); });
}

// ══════════════════════════════════════
// ACCESS LOGS — no orderBy, sort in JS
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
    where("shopId", "==", shopId)
  );
  return onSnapshot(q, (snap) => {
    const logs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    logs.sort((a, b) => {
      const ta = a.timestamp?.seconds || 0;
      const tb = b.timestamp?.seconds || 0;
      return tb - ta;
    });
    callback(logs.slice(0, maxItems));
  }, (err) => { console.error('watchAccessLogs error:', err); callback([]); });
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
