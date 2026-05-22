/**
 * Brew Studio — Image Storage
 * 
 * อัปโหลดรูปไป Firebase Storage แทนการเก็บ base64 ใน Firestore
 * - Resize ก่อนอัป (ลด bandwidth)
 * - รองรับทั้ง menu images และ logo
 */

import {
  ref, uploadBytes, getDownloadURL, deleteObject,
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-storage.js";
import { storage } from "./firebase.js";

/**
 * Compress image before upload
 * @param {File} file 
 * @param {object} options
 * @returns {Promise<Blob>}
 */
function compressImage(file, { maxWidth = 800, maxHeight = 1000, quality = 0.8 } = {}) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.onload = () => {
        let { width, height } = img;

        // Scale down if needed
        if (width > maxWidth) {
          height = height * (maxWidth / width);
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = width * (maxHeight / height);
          height = maxHeight;
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Failed to compress image"));
          },
          "image/jpeg",
          quality
        );
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

/**
 * Upload menu image
 * @param {string} shopId
 * @param {string} menuId
 * @param {File} file
 * @returns {Promise<string>} download URL
 */
async function uploadMenuImage(shopId, menuId, file) {
  const blob = await compressImage(file, {
    maxWidth: 600,
    maxHeight: 800,
    quality: 0.75,
  });

  const path = `shops/${shopId}/menus/${menuId}_${Date.now()}.jpg`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob, { contentType: "image/jpeg" });
  return getDownloadURL(storageRef);
}

/**
 * Upload shop logo
 * @param {string} shopId
 * @param {File} file
 * @returns {Promise<string>} download URL
 */
async function uploadLogo(shopId, file) {
  const blob = await compressImage(file, {
    maxWidth: 400,
    maxHeight: 400,
    quality: 0.85,
  });

  const path = `shops/${shopId}/logo_${Date.now()}.jpg`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob, { contentType: "image/jpeg" });
  return getDownloadURL(storageRef);
}

/**
 * Delete image from storage
 * @param {string} imageUrl — full download URL
 */
async function deleteImage(imageUrl) {
  if (!imageUrl || !imageUrl.includes("firebasestorage")) return;
  try {
    const storageRef = ref(storage, imageUrl);
    await deleteObject(storageRef);
  } catch (e) {
    // Image might already be deleted — that's okay
    console.warn("Could not delete image:", e.message);
  }
}

export { compressImage, uploadMenuImage, uploadLogo, deleteImage };
