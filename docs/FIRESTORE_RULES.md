# Firestore Security Rules — สำคัญ!

⚠️ Test mode หมดอายุ ~22 มิ.ย. 2026 — ต้อง deploy rules ก่อนหมดอายุ

## วิธี Deploy:
1. เปิด https://console.firebase.google.com → project yp-coffeex
2. ไปที่ Firestore Database → แท็บ **Rules**
3. ลบ rules เดิมทั้งหมด แล้ววาง rules ด้านล่างนี้แทน
4. กด **Publish**

## Rules:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isSignedIn() { return request.auth != null; }
    function isOwnerOf(shopId) {
      return isSignedIn() &&
        get(/databases/$(database)/documents/shops/$(shopId)).data.ownerId == request.auth.uid;
    }

    match /shops/{shopId} {
      allow read: if isSignedIn() && resource.data.ownerId == request.auth.uid;
      allow create: if isSignedIn() && request.resource.data.ownerId == request.auth.uid;
      allow update: if isOwnerOf(shopId);
    }

    match /shops_public/{shopId} {
      allow read: if true;
      allow write: if isOwnerOf(shopId);
    }

    match /menus/{menuId} {
      allow read: if true;
      allow create, update: if isSignedIn() && isOwnerOf(request.resource.data.shopId);
      allow delete: if isSignedIn() && isOwnerOf(resource.data.shopId);
    }

    match /categories/{catId} {
      allow read: if true;
      allow create: if isSignedIn() && isOwnerOf(request.resource.data.shopId);
      allow update, delete: if isSignedIn() && isOwnerOf(resource.data.shopId);
    }

    match /access_logs/{logId} {
      allow create: if true;
      allow read, delete: if isSignedIn() && isOwnerOf(resource.data.shopId);
    }
  }
}
```
