// ===== Firebase Configuration =====
// แทนที่ค่าด้านล่างด้วย config จาก Firebase Console
// (Project Settings → General → Your apps → Web app → Config)
//
// ถ้ายังไม่ได้ตั้งค่า — ตัวแปรจะเป็น null และระบบทำงานด้วย localStorage อย่างเดียว

window.FIREBASE_CONFIG = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

// ตั้งเป็น null ถ้ายังไม่ได้กรอก (ป้องกัน Firebase init แล้ว fail)
if (!window.FIREBASE_CONFIG.apiKey) {
  window.FIREBASE_CONFIG = null;
}
