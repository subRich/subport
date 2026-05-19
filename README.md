# My Portfolio · Personal Finance Tracker

เว็บส่วนตัวสำหรับติดตามรายรับ-รายจ่าย, การลงทุน (หุ้น + ออปชัน), และเป้าหมายการเงิน — ทำงานได้ทั้ง PC และมือถือ พร้อม cloud sync ผ่าน Firebase

## Features

- 👤 **About Me** — ประวัติ, ทักษะ, การศึกษา, รูปโปรไฟล์
- 📊 **Dashboard** — กราฟวงกลม/เส้น/พาย สรุปรายรับรายจ่ายและพอร์ต
- 💰 **รายรับ-รายจ่าย** — บันทึก, แก้ไข, ลบ, import/export Excel
- 📈 **การลงทุน** — หุ้น + ออปชัน, P/L ในสกุล USD และ THB, sync ราคา realtime จาก Yahoo
- 🎯 **เป้าหมาย** — progress bar + คำนวณเงินออม/วัน
- 🌓 **Dark/Light theme**
- 📱 **PWA** — ติดตั้งเป็นแอปบนมือถือได้
- ☁️ **Cloud sync** — Firestore sync ระหว่าง PC ↔ มือถือ
- 💾 **Offline support** — ใช้ได้แม้ไม่มีเน็ต

## Deployment

### 1. GitHub Pages

```bash
git remote add origin https://github.com/<USERNAME>/<REPO>.git
git branch -M main
git push -u origin main
```

จากนั้นใน GitHub: **Settings → Pages → Source: `main` branch / root → Save**

URL: `https://<USERNAME>.github.io/<REPO>/`

### 2. Firebase (Cloud Sync)

1. ไปที่ [console.firebase.google.com](https://console.firebase.google.com) → **Add project**
2. **Build → Firestore Database → Create database** → Production mode
3. **Build → Authentication → Sign-in method** → Enable **Anonymous**
4. **Project settings → Your apps → Web (`</>`)** → คัดลอก config
5. แก้ไข `js/firebase-config.js` ใส่ค่าจาก config
6. ตั้ง Firestore Rules (Rules tab):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

7. Commit + push อีกครั้ง

### 3. ติดตั้งบนมือถือ

- เปิด URL บน Chrome/Safari มือถือ
- **Chrome:** เมนู → "Add to Home Screen"
- **Safari:** Share → "Add to Home Screen"
- ไอคอนจะขึ้นในหน้าจอเหมือนแอป

## Workflow (Claude integrations)

ผู้ดูแลข้อมูลใช้ Claude Code บน PC สำหรับ:

| คำสั่ง | ผลลัพธ์ |
|---|---|
| `อัพเดท` | ดึงราคาหุ้นล่าสุดจาก Yahoo |
| `อัพเดทออปชัน` | ดึงราคา option chain จาก Yahoo via Chrome |
| `อัพเดทข้อมูลการลงทุน` | อ่าน Excel การลงทุน.xlsx → sync |
| `อัพเดทรายรับรายจ่าย` | อ่าน Excel รายรับรายจ่าย.xlsx → sync |
| `อัพเดททั้งหมด` | ทุกอย่างพร้อมกัน |

## Tech Stack

- HTML + CSS + Vanilla JS (no framework)
- Chart.js (กราฟ)
- SheetJS (อ่าน/เขียน Excel)
- Firebase Firestore (cloud sync)
- Service Worker (offline)
- PowerShell + Excel COM (sync จาก Claude บน PC)

## Privacy

- ข้อมูลการเงินส่วนตัวเก็บใน Firestore ใต้ user UID (anonymous)
- Firestore rules อนุญาตเฉพาะ owner เท่านั้น
- ไฟล์ Excel ในเครื่อง PC ไม่ commit ขึ้น GitHub (`.gitignore`)
