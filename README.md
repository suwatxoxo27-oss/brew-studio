# Brew Studio ☕

ระบบจัดการสูตรเครื่องดื่มสำหรับร้านกาแฟ — Owner Dashboard + Staff Recipe Book

## Features

- 🔐 **Firebase Authentication** — Owner login ด้วย email/password จริง
- 🛡️ **Firestore Security Rules** — แยก role owner/staff อย่างชัดเจน
- 📸 **Firebase Storage** — รูปเมนูเก็บแยก ไม่บวม Firestore
- 📱 **PWA Ready** — Staff ใช้งานแบบ offline ได้
- 🎨 **Modular Code** — แยกไฟล์ชัดเจน maintain ง่าย
- 🔄 **Realtime Sync** — Owner แก้เมนู staff เห็นทันที

## Project Structure

```
brew-studio/
├── public/                  # Static assets
│   └── manifest.json        # PWA manifest
├── src/
│   ├── shared/
│   │   ├── firebase.js      # Firebase init + auth helpers
│   │   ├── db.js            # Firestore CRUD operations
│   │   ├── storage.js       # Image upload to Cloud Storage
│   │   ├── styles.css       # Shared design tokens + base styles
│   │   └── utils.js         # Sanitize, toast, helpers
│   ├── owner/
│   │   ├── index.html       # Owner dashboard
│   │   ├── app.js           # Owner app logic
│   │   └── styles.css       # Owner-specific styles
│   ├── staff/
│   │   ├── index.html       # Staff recipe viewer
│   │   ├── app.js           # Staff app logic
│   │   └── styles.css       # Staff-specific styles
│   └── components/
│       ├── menu-card.js     # Reusable menu card
│       ├── category-tabs.js # Category tab bar
│       ├── image-upload.js  # Image upload with preview
│       ├── modal.js         # Bottom sheet modal
│       └── toast.js         # Toast notifications
├── firebase/
│   └── firestore.rules      # Security rules
├── firestore.rules           # Deployed rules
├── firebase.json             # Firebase hosting config
└── README.md
```

## Setup

### 1. Firebase Project

```bash
npm install -g firebase-tools
firebase login
firebase init  # เลือก Firestore, Storage, Hosting
```

### 2. Firebase Console Setup

- เปิด Authentication → Email/Password provider
- สร้าง user สำหรับ owner ใน Firebase Console
- Deploy security rules: `firebase deploy --only firestore:rules`

### 3. Config

แก้ไข `src/shared/firebase.js` ใส่ Firebase config ของคุณ

### 4. Deploy

```bash
firebase deploy
```

## Security Model

| Role    | Auth Method       | Firestore Access              |
|---------|-------------------|-------------------------------|
| Owner   | Email/Password    | Read/Write ทุก collection     |
| Staff   | Shop PIN (local)  | Read-only menus + categories  |

## Data Model

```
shops/{shopId}
  ├── name, logo, hero text, staffPin (hashed)
  └── ownerId (uid)

menus/{menuId}
  ├── name, description, note, imageUrl
  ├── ingredients[], steps[]
  ├── categoryId, shopId
  └── createdAt, updatedAt

categories/{catId}
  ├── name, emoji, order
  └── shopId

access_logs/{logId}
  ├── staffName, shopId
  └── timestamp
```
