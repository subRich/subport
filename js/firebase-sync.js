// ===== Firebase Sync Layer — Vault Mode (no auth) =====
// แต่ละ user มี vault ID ยาวๆ ในรูป URL — ?v=<random-32-chars>
// ทุก device ที่ใช้ URL เดียวกัน → sync ข้อมูลกัน
// ไม่ต้อง login — vault ID = key
//
// SETUP Firestore Rules:
//   rules_version = '2';
//   service cloud.firestore {
//     match /databases/{database}/documents {
//       match /vaults/{vaultId}/{document=**} {
//         allow read, write: if vaultId.size() >= 24;
//       }
//     }
//   }

const FBSync = {
  app: null,
  db: null,
  vaultId: null,
  enabled: false,
  listeners: [],
  _suppressPush: false,
  _suppressUntil: 0,

  async init() {
    if (!window.FIREBASE_CONFIG || !window.FIREBASE_CONFIG.apiKey) {
      console.warn('[Vault] No Firebase config — localStorage-only mode');
      return false;
    }

    // 1. Determine vault ID — priority: URL > localStorage > new
    const url = new URL(location.href);
    let vaultId = url.searchParams.get('v');
    if (!vaultId) {
      vaultId = localStorage.getItem('pf_vault_id');
    }
    if (!vaultId) {
      vaultId = (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, '').slice(0, 32);
      console.log('[Vault] New vault created:', vaultId);
    }
    localStorage.setItem('pf_vault_id', vaultId);
    this.vaultId = vaultId;

    // Reflect in URL so it's shareable & bookmarkable
    if (url.searchParams.get('v') !== vaultId) {
      url.searchParams.set('v', vaultId);
      history.replaceState({}, '', url);
    }

    // 2. Init Firebase
    try {
      const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js');
      const { getFirestore, doc, setDoc, getDoc, onSnapshot } = await import('https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js');
      this.app = initializeApp(window.FIREBASE_CONFIG);
      this.db = getFirestore(this.app);
      this._sdk = { doc, setDoc, getDoc, onSnapshot };
      this.enabled = true;
      console.log('[Vault] Ready · vault:', vaultId.slice(0, 8) + '...');

      await this.pullAll();
      this._setupListeners();
      this._renderVaultUI();
      return true;
    } catch (e) {
      console.error('[Vault] Init failed:', e.message);
      this._renderVaultUI(e.message);
      return false;
    }
  },

  _docRef(collection) {
    if (!this.vaultId) return null;
    return this._sdk.doc(this.db, 'vaults', this.vaultId, 'data', collection);
  },

  async pullAll() {
    if (!this.enabled) return;
    const collections = ['profile', 'transactions', 'investments', 'goals'];
    let cloudHadAnything = false;
    this._suppressPush = true;  // don't bounce cloud→local→cloud
    this._suppressUntil = Date.now() + 1500;
    for (const col of collections) {
      try {
        const snap = await this._sdk.getDoc(this._docRef(col));
        if (snap.exists()) {
          cloudHadAnything = true;
          const cloud = snap.data();
          const key = DB.KEYS[col];
          if (col === 'profile' && (cloud.value || cloud.name)) {
            localStorage.setItem(key, JSON.stringify(cloud.value || cloud));
          } else if (Array.isArray(cloud.value)) {
            localStorage.setItem(key, JSON.stringify(cloud.value));
          }
        }
      } catch (e) {
        console.warn(`[Vault] pull ${col} failed:`, e.message);
      }
    }
    setTimeout(() => { this._suppressPush = false; }, 1500);
    window.dispatchEvent(new Event('firebase-pulled'));

    if (!cloudHadAnything) {
      console.log('[Vault] Cloud empty — pushing local');
      await this.pushAll();
    }
  },

  async pushAll() {
    if (!this.enabled) return;
    await this.push('profile', DB.getProfile());
    await this.push('transactions', DB.getTransactions());
    await this.push('investments', DB.getInvestments());
    await this.push('goals', DB.getGoals());
    if (typeof toast === 'function') toast('☁️ Sync ขึ้น cloud แล้ว');
  },

  async push(collection, value) {
    if (!this.enabled || this._suppressPush) return;
    try {
      await this._sdk.setDoc(this._docRef(collection), {
        value,
        updatedAt: new Date().toISOString(),
        device: navigator.userAgent.includes('Mobi') ? 'mobile' : 'desktop',
      });
      const count = Array.isArray(value) ? value.length : 1;
      console.log(`[Vault] ✅ pushed ${collection} (${count})`);
    } catch (e) {
      console.error(`[Vault] ❌ push ${collection}:`, e.code, e.message);
    }
  },

  _setupListeners() {
    const collections = ['profile', 'transactions', 'investments', 'goals'];
    for (const col of collections) {
      const unsub = this._sdk.onSnapshot(this._docRef(col), (snap) => {
        if (!snap.exists()) return;
        if (snap.metadata.hasPendingWrites) return;
        const cloud = snap.data();
        const key = DB.KEYS[col];
        this._suppressPush = true;
        this._suppressUntil = Date.now() + 1500;
        if (col === 'profile' && (cloud.value || cloud.name)) {
          localStorage.setItem(key, JSON.stringify(cloud.value || cloud));
        } else if (Array.isArray(cloud.value)) {
          localStorage.setItem(key, JSON.stringify(cloud.value));
        }
        setTimeout(() => { this._suppressPush = false; }, 1500);
        console.log(`[Vault] ⬇️ pulled ${col} from another device`);
        window.dispatchEvent(new Event('firebase-pulled'));
      });
      this.listeners.push(unsub);
    }
  },

  async copyShareUrl() {
    const url = new URL(location.origin + location.pathname);
    url.searchParams.set('v', this.vaultId);
    const u = url.toString();
    try {
      await navigator.clipboard.writeText(u);
      if (typeof toast === 'function') toast('📋 Copy URL แล้ว — เปิดบนมือถือ');
    } catch {
      prompt('Copy URL นี้:', u);
    }
  },

  _renderVaultUI(errMsg) {
    let box = document.getElementById('fbAuthBox');
    if (!box) {
      box = document.createElement('div');
      box.id = 'fbAuthBox';
      box.style.cssText = 'position:fixed;top:12px;right:12px;z-index:1000;background:var(--bg-card,#1e293b);border:1px solid var(--border,#334155);border-radius:8px;padding:8px 12px;font-size:0.82rem;display:flex;align-items:center;gap:8px;box-shadow:0 4px 12px rgba(0,0,0,0.25);max-width:calc(100vw - 24px)';
      document.body.appendChild(box);
    }
    if (errMsg) {
      box.innerHTML = `<span style="color:#ef4444">⚠️ Cloud sync ปิด: ${errMsg}</span>`;
      return;
    }
    const shortId = this.vaultId.slice(0, 6).toUpperCase();
    const btnStyle = 'background:transparent;border:1px solid var(--border,#334155);color:var(--text-muted,#94a3b8);padding:4px 10px;border-radius:6px;cursor:pointer;font-size:0.78rem;font-family:inherit';
    box.innerHTML = `
      <span style="color:var(--text-muted,#94a3b8)" title="Vault ID: ${this.vaultId}">📦 Vault <b style="color:var(--text,#f1f5f9)">${shortId}</b></span>
      <button onclick="FBSync.copyShareUrl()" style="${btnStyle}" title="Copy URL ไปแชร์มือถือ">📋 แชร์</button>
      <button onclick="FBSync.pushAll()" style="${btnStyle}" title="Push localStorage → Cloud">⬆️</button>
      <button onclick="FBSync.pullAll()" style="${btnStyle}" title="Pull Cloud → localStorage">⬇️</button>
    `;
  },
};

// Wrap DB.save* to auto-push
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

window.FBSync = FBSync;
FBSync.init();
