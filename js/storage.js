// ===== Storage Layer =====
const DB = {
  KEYS: {
    profile: 'pf_profile',
    transactions: 'pf_transactions',
    investments: 'pf_investments',
    goals: 'pf_goals',
    theme: 'pf_theme',
  },

  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
  },
  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },

  // Profile
  getProfile() {
    return this.get(this.KEYS.profile, {
      name: 'ร.ต. สกุลทรัพย์ ทองเรือง',
      role: 'นายทหารสัญญาบัตร · กองทัพบก',
      bio: 'นักเรียนเตรียมทหารรุ่นที่ 62 · นักเรียนนายร้อย จปร. รุ่นที่ 73 มุ่งพัฒนาตนเองทั้งด้านการทหาร การเงินส่วนบุคคล และการลงทุนเพื่ออนาคต',
      email: '',
      phone: '',
      location: '',
      avatar: 'assets/profile.jpg',
      skills: ['ผู้นำหน่วย', 'การวางแผน', 'การเงินส่วนบุคคล', 'การลงทุน', 'ระเบียบวินัย'],
      education: [
        'โรงเรียนเตรียมทหาร รุ่นที่ 62 (ตท.62)',
        'โรงเรียนนายร้อยพระจุลจอมเกล้า รุ่นที่ 73 (จปร.73)',
      ],
      experience: [
        'นายทหารสัญญาบัตร — กองทัพบก',
      ],
    });
  },
  saveProfile(p) { this.set(this.KEYS.profile, p); },

  // Transactions
  getTransactions() { return this.get(this.KEYS.transactions, []); },
  saveTransactions(list) { this.set(this.KEYS.transactions, list); },
  addTransaction(t) {
    const list = this.getTransactions();
    list.push({ ...t, id: t.id || crypto.randomUUID() });
    this.saveTransactions(list);
  },
  updateTransaction(id, patch) {
    const list = this.getTransactions().map(t => t.id === id ? { ...t, ...patch } : t);
    this.saveTransactions(list);
  },
  deleteTransaction(id) {
    this.saveTransactions(this.getTransactions().filter(t => t.id !== id));
  },

  // Investments
  getInvestments() { return this.get(this.KEYS.investments, []); },
  saveInvestments(list) { this.set(this.KEYS.investments, list); },
  addInvestment(i) {
    const list = this.getInvestments();
    list.push({ ...i, id: i.id || crypto.randomUUID() });
    this.saveInvestments(list);
  },
  updateInvestment(id, patch) {
    const list = this.getInvestments().map(x => x.id === id ? { ...x, ...patch } : x);
    this.saveInvestments(list);
  },
  deleteInvestment(id) {
    this.saveInvestments(this.getInvestments().filter(x => x.id !== id));
  },

  // Goals
  getGoals() { return this.get(this.KEYS.goals, []); },
  saveGoals(list) { this.set(this.KEYS.goals, list); },
  addGoal(g) {
    const list = this.getGoals();
    list.push({ ...g, id: g.id || crypto.randomUUID() });
    this.saveGoals(list);
  },
  updateGoal(id, patch) {
    const list = this.getGoals().map(g => g.id === id ? { ...g, ...patch } : g);
    this.saveGoals(list);
  },
  deleteGoal(id) {
    this.saveGoals(this.getGoals().filter(g => g.id !== id));
  },

  // Bulk
  exportAll() {
    return {
      profile: this.getProfile(),
      transactions: this.getTransactions(),
      investments: this.getInvestments(),
      goals: this.getGoals(),
      exportedAt: new Date().toISOString(),
    };
  },
  importAll(data) {
    if (data.profile) this.saveProfile(data.profile);
    if (data.transactions) this.saveTransactions(data.transactions);
    if (data.investments) this.saveInvestments(data.investments);
    if (data.goals) this.saveGoals(data.goals);
  },
  clearAll() {
    Object.values(this.KEYS).forEach(k => localStorage.removeItem(k));
  },
};

// ===== Utilities =====
const fmt = {
  money(n) {
    const v = Number(n) || 0;
    return v.toLocaleString('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 });
  },
  thb(n, d = 0) {
    const v = Number(n) || 0;
    return '฿' + v.toLocaleString('th-TH', { minimumFractionDigits: d, maximumFractionDigits: d });
  },
  usd(n, d = 2) {
    const v = Number(n) || 0;
    return '$' + v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  },
  num(n, d = 2) {
    return (Number(n) || 0).toLocaleString('th-TH', { maximumFractionDigits: d });
  },
  date(d) {
    if (!d) return '-';
    const date = new Date(d);
    if (isNaN(date)) return d;
    return date.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
  },
  pct(n) {
    return `${(Number(n) || 0).toFixed(2)}%`;
  },
};

// USD <-> THB conversion using rate from window.STOCKS_DATA.usdThb (fallback 32.54)
function getUsdThb() {
  return (window.STOCKS_DATA && Number(window.STOCKS_DATA.usdThb)) || 32.54;
}
function isUsdInvestment(item) {
  if (item.currency === 'USD') return true;
  if (item.currency === 'THB') return false;
  // Auto-detect: if ticker appears in stocks.js → USD
  if (window.STOCKS_DATA && (window.STOCKS_DATA.stocks || []).some(s => s.ticker === item.name)) return true;
  return false;
}

// ===== Theme =====
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem(DB.KEYS.theme, t);
  const btn = document.querySelector('.theme-toggle');
  if (btn) btn.textContent = t === 'light' ? '🌙 โหมดมืด' : '☀️ โหมดสว่าง';
}
function toggleTheme() {
  const cur = localStorage.getItem(DB.KEYS.theme) || 'dark';
  applyTheme(cur === 'dark' ? 'light' : 'dark');
}
(function initTheme() {
  applyTheme(localStorage.getItem(DB.KEYS.theme) || 'dark');
})();

// ===== Toast =====
function toast(msg, type = 'success') {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.remove('error');
  if (type === 'error') el.classList.add('error');
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2500);
}

// ===== Sidebar component (re-used) =====
function renderSidebar(active) {
  const items = [
    { id: 'about', label: '👤 เกี่ยวกับฉัน', href: 'index.html' },
    { id: 'dashboard', label: '📊 แดชบอร์ด', href: 'dashboard.html' },
    { id: 'transactions', label: '💰 รายรับ-รายจ่าย', href: 'transactions.html' },
    { id: 'investments', label: '📈 หุ้น', href: 'investments.html' },
    { id: 'options', label: '🎲 ออปชัน', href: 'options.html' },
    { id: 'goals', label: '🎯 เป้าหมาย', href: 'goals.html' },
  ];
  return `
    <aside class="sidebar">
      <div class="brand">💼 My Portfolio</div>
      <nav>
        ${items.map(i => `<a href="${i.href}" class="${i.id === active ? 'active' : ''}">${i.label}</a>`).join('')}
      </nav>
      <button class="theme-toggle" onclick="toggleTheme()">🌙 โหมดมืด</button>
    </aside>
  `;
}

function mountLayout(activePage) {
  const root = document.getElementById('app');
  if (!root) return;
  const main = root.innerHTML;
  root.innerHTML = renderSidebar(activePage) + `<main class="main"><button class="menu-btn" onclick="document.querySelector('.sidebar').classList.toggle('open')">☰ เมนู</button>${main}</main>`;
  applyTheme(localStorage.getItem(DB.KEYS.theme) || 'dark');
}
