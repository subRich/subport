// ===== Firebase Sync Layer =====
// Bi-directional sync between localStorage and Firestore.
// When user adds/edits/deletes on either device, changes propagate via Firestore.
//
// SETUP:
// 1. Create Firebase project at https://console.firebase.google.com
// 2. Enable Firestore Database (Production mode + add rules below)
// 3. Enable Authentication → Anonymous sign-in
// 4. Add Web app → copy config → paste into firebase-config.js
// 5. Firestore rules:
//    rules_version = '2';
//    service cloud.firestore {
//      match /databases/{database}/documents {
//        match /users/{userId}/{document=**} {
//          allow read, write: if request.auth != null && request.auth.uid == userId;
//        }
//      }
//    }

const FBSync = {
  app: null,
  db: null,
  auth: null,
  uid: null,
  initialized: false,
  enabled: false,
  ready: new Promise(() => {}),
  _readyResolve: null,
  listeners: [],

  async init() {
    this.ready = new Promise(res => { this._readyResolve = res; });

    if (typeof window.FIREBASE_CONFIG !== 'object' || !window.FIREBASE_CONFIG.apiKey) {
      console.warn('[Firebase] No config found — running in localStorage-only mode.');
      this._readyResolve(false);
      return false;
    }

    try {
      const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js');
      const { getFirestore, doc, setDoc, getDoc, onSnapshot } = await import('https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js');
      const { getAuth, signInAnonymously, onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js');

      this.app = initializeApp(window.FIREBASE_CONFIG);
      this.db = getFirestore(this.app);
      this.auth = getAuth(this.app);
      this._sdk = { doc, setDoc, getDoc, onSnapshot, signInAnonymously, onAuthStateChanged };

      const user = await new Promise((resolve, reject) => {
        onAuthStateChanged(this.auth, async (u) => {
          if (u) { resolve(u); }
          else {
            try { const cred = await signInAnonymously(this.auth); resolve(cred.user); }
            catch (e) { reject(e); }
          }
        });
      });

      this.uid = user.uid;
      this.initialized = true;
      this.enabled = true;
      console.log('[Firebase] Signed in:', this.uid);
      this._readyResolve(true);

      // Pull from cloud on init (cloud wins on conflict, last-write semantics)
      await this.pullAll();
      this._setupListeners();
      return true;
    } catch (e) {
      console.warn('[Firebase] Init failed:', e.message);
      this._readyResolve(false);
      return false;
    }
  },

  _docRef(collection) {
    if (!this.uid) return null;
    return this._sdk.doc(this.db, 'users', this.uid, 'data', collection);
  },

  async pullAll() {
    if (!this.enabled) return;
    const collections = ['profile', 'transactions', 'investments', 'goals'];
    for (const col of collections) {
      try {
        const snap = await this._sdk.getDoc(this._docRef(col));
        if (snap.exists()) {
          const cloud = snap.data();
          const key = DB.KEYS[col];
          // Heuristic: cloud has data → sync to local
          if (col === 'profile') {
            DB.saveProfile(cloud.value || cloud);
          } else if (Array.isArray(cloud.value)) {
            localStorage.setItem(key, JSON.stringify(cloud.value));
          }
        }
      } catch (e) {
        console.warn(`[Firebase] pull ${col} failed:`, e.message);
      }
    }
    // Trigger re-render
    window.dispatchEvent(new Event('firebase-pulled'));
  },

  async push(collection, value) {
    if (!this.enabled) return;
    try {
      await this._sdk.setDoc(this._docRef(collection), {
        value,
        updatedAt: new Date().toISOString(),
        device: navigator.userAgent.includes('Mobi') ? 'mobile' : 'desktop',
      });
    } catch (e) {
      console.warn(`[Firebase] push ${collection} failed:`, e.message);
    }
  },

  _setupListeners() {
    const collections = ['profile', 'transactions', 'investments', 'goals'];
    for (const col of collections) {
      const unsub = this._sdk.onSnapshot(this._docRef(col), (snap) => {
        if (!snap.exists()) return;
        if (snap.metadata.hasPendingWrites) return; // skip self-writes
        const cloud = snap.data();
        const key = DB.KEYS[col];
        if (col === 'profile') {
          localStorage.setItem(key, JSON.stringify(cloud.value || cloud));
        } else if (Array.isArray(cloud.value)) {
          localStorage.setItem(key, JSON.stringify(cloud.value));
        }
        window.dispatchEvent(new Event('firebase-pulled'));
      });
      this.listeners.push(unsub);
    }
  },
};

// Hook into DB writes — push to Firestore after every save
(function wrapDB() {
  if (typeof DB === 'undefined') return;
  const wrap = (key, methodName) => {
    const original = DB[methodName].bind(DB);
    DB[methodName] = function (value) {
      original(value);
      FBSync.push(key, value);
    };
  };
  wrap('profile', 'saveProfile');
  wrap('transactions', 'saveTransactions');
  wrap('investments', 'saveInvestments');
  wrap('goals', 'saveGoals');
})();

// Auto-init
FBSync.init();
