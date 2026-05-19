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
      const { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged, browserLocalPersistence, setPersistence } = await import('https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js');

      this.app = initializeApp(window.FIREBASE_CONFIG);
      this.db = getFirestore(this.app);
      this.auth = getAuth(this.app);
      await setPersistence(this.auth, browserLocalPersistence);
      this._sdk = { doc, setDoc, getDoc, onSnapshot, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged };

      // Handle redirect result on mobile
      try { await getRedirectResult(this.auth); } catch (e) { console.warn('[Firebase] Redirect result:', e.message); }

      // Wait for auth state (don't auto-signin — wait for user button click)
      const user = await new Promise((resolve) => {
        const unsub = onAuthStateChanged(this.auth, (u) => { unsub(); resolve(u); });
      });

      this._renderAuthUI(user);

      if (user) {
        this.uid = user.uid;
        this.initialized = true;
        this.enabled = true;
        console.log('[Firebase] Signed in:', user.email || user.uid);
        this._readyResolve(true);
        await this.pullAll();
        this._setupListeners();
        // Re-render UI on auth changes
        onAuthStateChanged(this.auth, (u) => this._renderAuthUI(u));
      } else {
        console.log('[Firebase] Not signed in — click Sign in button');
        this._readyResolve(false);
        // Listen for sign-in
        onAuthStateChanged(this.auth, (u) => {
          this._renderAuthUI(u);
          if (u && !this.uid) {
            this.uid = u.uid;
            this.initialized = true;
            this.enabled = true;
            this.pullAll();
            this._setupListeners();
          }
        });
      }
      return true;
    } catch (e) {
      console.warn('[Firebase] Init failed:', e.message);
      this._readyResolve(false);
      return false;
    }
  },

  async signIn() {
    if (!this.auth) return;
    const provider = new this._sdk.GoogleAuthProvider();
    const isMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent);
    try {
      if (isMobile) {
        await this._sdk.signInWithRedirect(this.auth, provider);
      } else {
        await this._sdk.signInWithPopup(this.auth, provider);
      }
    } catch (e) {
      console.warn('[Firebase] Sign-in error:', e.message);
      if (typeof toast === 'function') toast('Sign-in failed: ' + e.message, 'error');
    }
  },

  async signOut() {
    if (!this.auth) return;
    await this._sdk.signOut(this.auth);
    location.reload();
  },

  _renderAuthUI(user) {
    let box = document.getElementById('fbAuthBox');
    if (!box) {
      box = document.createElement('div');
      box.id = 'fbAuthBox';
      box.style.cssText = 'position:fixed;top:12px;right:12px;z-index:1000;background:var(--bg-card,#1e293b);border:1px solid var(--border,#334155);border-radius:8px;padding:6px 10px;font-size:0.82rem;display:flex;align-items:center;gap:8px;box-shadow:0 4px 12px rgba(0,0,0,0.25)';
      document.body.appendChild(box);
    }
    if (user) {
      const initial = (user.displayName || user.email || '?').charAt(0).toUpperCase();
      box.innerHTML = `<div style="width:24px;height:24px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#ec4899);color:white;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:0.75rem">${initial}</div><span style="color:var(--text-muted,#94a3b8)">${user.email || 'signed in'}</span><button onclick="FBSync.signOut()" style="background:transparent;border:1px solid var(--border,#334155);color:var(--text-muted,#94a3b8);padding:3px 8px;border-radius:6px;cursor:pointer;font-size:0.75rem">ออก</button>`;
    } else {
      box.innerHTML = `<button onclick="FBSync.signIn()" style="background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;border:none;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:0.82rem;font-weight:500">🔐 Sign in (Sync)</button>`;
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

// Expose to global scope (script is type=module, so vars don't auto-attach to window)
window.FBSync = FBSync;

// Auto-init
FBSync.init();
