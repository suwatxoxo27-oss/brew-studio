/**
 * Brew Studio — Firebase Configuration & Auth
 * 
 * แก้ firebaseConfig ให้ตรงกับ project ของคุณ
 * ⚠️ อย่า commit API key ตรงๆ — ใช้ environment variable ใน production
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-storage.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

// ── Firebase Config ──
// TODO: ย้ายไปเป็น environment config ก่อน deploy production
const firebaseConfig = {
  apiKey: "AIzaSyBZGuYoCi4zU1Zdz4lnCJRYM6y4zzJZAcs",
  authDomain: "yp-coffeex.firebaseapp.com",
  projectId: "yp-coffeex",
  storageBucket: "yp-coffeex.firebasestorage.app",
  messagingSenderId: "353142577223",
  appId: "1:353142577223:web:2311a01754601976d03962",
};

// ── Initialize ──
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);

// ── Auth Helpers ──

/**
 * Login owner with email/password
 * @param {string} email
 * @param {string} password
 * @returns {Promise<import('firebase/auth').UserCredential>}
 */
async function loginOwner(email, password) {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return { success: true, user: cred.user };
  } catch (error) {
    const messages = {
      "auth/invalid-email": "อีเมลไม่ถูกต้อง",
      "auth/user-not-found": "ไม่พบบัญชีนี้",
      "auth/wrong-password": "รหัสผ่านไม่ถูกต้อง",
      "auth/invalid-credential": "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
      "auth/too-many-requests": "ลองมากเกินไป กรุณารอสักครู่",
    };
    return {
      success: false,
      error: messages[error.code] || `เข้าสู่ระบบไม่สำเร็จ (${error.code})`,
    };
  }
}

/**
 * Logout
 */
async function logoutOwner() {
  await signOut(auth);
}

/**
 * Watch auth state changes
 * @param {function} callback - receives (user | null)
 */
function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

/**
 * Get current user
 */
function getCurrentUser() {
  return auth.currentUser;
}

export { db, storage, auth, loginOwner, logoutOwner, onAuthChange, getCurrentUser };
