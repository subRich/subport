// ===== Dashboard =====
const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#14b8a6', '#f97316', '#a855f7', '#06b6d4', '#84cc16'];

function getTextColor() {
  return getComputedStyle(document.documentElement).getPropertyValue('--text').trim();
}
function getMutedColor() {
  return getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim();
}

function renderStats() {
  const txs = DB.getTransactions();
  const inv = DB.getInvestments();
  const now = new Date();
  const monthTxs = txs.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const income = monthTxs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount || 0), 0);
  const expense = monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount || 0), 0);
  const balance = income - expense;
  const rate = getUsdThb();
  const toThb = (item, raw) => isUsdInvestment(item) ? raw * rate : raw;
  const invValue = inv.reduce((s, x) => s + toThb(x, Number(x.quantity || 0) * Number(x.currentPrice || 0)), 0);
  const invCost = inv.reduce((s, x) => s + toThb(x, Number(x.quantity || 0) * Number(x.buyPrice || 0)), 0);
  const invPL = invValue - invCost;

  document.getElementById('stats').innerHTML = `
    <div class="stat income">
      <div class="label">รายรับเดือนนี้</div>
      <div class="value pos">${fmt.money(income)}</div>
      <div class="sub">${monthTxs.filter(t=>t.type==='income').length} รายการ</div>
    </div>
    <div class="stat expense">
      <div class="label">รายจ่ายเดือนนี้</div>
      <div class="value neg">${fmt.money(expense)}</div>
      <div class="sub">${monthTxs.filter(t=>t.type==='expense').length} รายการ</div>
    </div>
    <div class="stat balance">
      <div class="label">คงเหลือสุทธิ</div>
      <div class="value ${balance >= 0 ? 'pos' : 'neg'}">${fmt.money(balance)}</div>
      <div class="sub">${income > 0 ? fmt.pct((balance/income)*100) + ' จากรายรับ' : '—'}</div>
    </div>
    <div class="stat invest">
      <div class="label">มูลค่าการลงทุน</div>
      <div class="value">${fmt.money(invValue)}</div>
      <div class="sub ${invPL >= 0 ? '' : ''}" style="color: ${invPL >= 0 ? 'var(--success)' : 'var(--danger)'}">${invPL >= 0 ? '+' : ''}${fmt.money(invPL)}</div>
    </div>
  `;
}

let catChart, trendChart, investChart;

function renderCategoryChart() {
  const ctx = document.getElementById('catChart');
  const txs = DB.getTransactions();
  const now = new Date();
  const monthExp = txs.filter(t => t.type === 'expense' && new Date(t.date).getMonth() === now.getMonth() && new Date(t.date).getFullYear() === now.getFullYear());

  const groups = {};
  monthExp.forEach(t => {
    const c = t.category || 'อื่นๆ';
    groups[c] = (groups[c] || 0) + Number(t.amount || 0);
  });
  const labels = Object.keys(groups);
  const data = Object.values(groups);

  if (catChart) catChart.destroy();
  if (labels.length === 0) {
    ctx.parentElement.innerHTML = '<div class="empty"><div class="empty-icon">📊</div>ยังไม่มีรายจ่ายเดือนนี้</div>';
    return;
  }
  catChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data, backgroundColor: COLORS, borderWidth: 0 }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { color: getTextColor(), font: { family: 'Prompt' } } },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.label}: ${fmt.money(ctx.parsed)} (${((ctx.parsed/data.reduce((a,b)=>a+b,0))*100).toFixed(1)}%)`,
          },
        },
      },
    },
  });
}

function renderTrendChart() {
  const ctx = document.getElementById('trendChart');
  const txs = DB.getTransactions();
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`,
      label: d.toLocaleDateString('th-TH', { month: 'short', year: '2-digit' }),
    });
  }
  const income = months.map(m => txs.filter(t => t.type === 'income' && t.date.startsWith(m.key)).reduce((s, t) => s + Number(t.amount || 0), 0));
  const expense = months.map(m => txs.filter(t => t.type === 'expense' && t.date.startsWith(m.key)).reduce((s, t) => s + Number(t.amount || 0), 0));

  if (trendChart) trendChart.destroy();
  trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: months.map(m => m.label),
      datasets: [
        { label: 'รายรับ', data: income, borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', tension: 0.3, fill: true },
        { label: 'รายจ่าย', data: expense, borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)', tension: 0.3, fill: true },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: getTextColor(), font: { family: 'Prompt' } } } },
      scales: {
        x: { ticks: { color: getMutedColor() }, grid: { color: 'rgba(148,163,184,0.1)' } },
        y: { ticks: { color: getMutedColor(), callback: v => fmt.money(v) }, grid: { color: 'rgba(148,163,184,0.1)' } },
      },
    },
  });
}

function renderInvestChart() {
  const ctx = document.getElementById('investChart');
  const inv = DB.getInvestments();
  if (inv.length === 0) {
    ctx.parentElement.innerHTML = '<div class="empty"><div class="empty-icon">📈</div>ยังไม่มีการลงทุน</div>';
    return;
  }
  const rate = getUsdThb();
  const labels = inv.map(x => x.name);
  const data = inv.map(x => {
    const raw = Number(x.quantity || 0) * Number(x.currentPrice || 0);
    return isUsdInvestment(x) ? raw * rate : raw;
  });

  if (investChart) investChart.destroy();
  investChart = new Chart(ctx, {
    type: 'pie',
    data: { labels, datasets: [{ data, backgroundColor: COLORS, borderWidth: 0 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { color: getTextColor(), font: { family: 'Prompt' } } },
        tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${fmt.money(ctx.parsed)}` } },
      },
    },
  });
}

function renderRecent() {
  const recent = DB.getTransactions().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const el = document.getElementById('recentList');
  if (recent.length === 0) {
    el.innerHTML = '<div class="empty"><div class="empty-icon">📒</div>ยังไม่มีรายการ</div>';
    return;
  }
  el.innerHTML = recent.map(t => `
    <div style="display:flex; justify-content:space-between; align-items:center; padding: 12px 0; border-bottom: 1px solid var(--border)">
      <div>
        <div style="font-weight: 500">${t.category || '-'}</div>
        <div style="font-size: 0.82rem; color: var(--text-muted)">${fmt.date(t.date)} · ${t.note || ''}</div>
      </div>
      <div style="font-weight: 600; color: ${t.type === 'income' ? 'var(--success)' : 'var(--danger)'}">
        ${t.type === 'income' ? '+' : '-'}${fmt.money(t.amount)}
      </div>
    </div>
  `).join('');
}

function renderAll() {
  renderStats();
  renderCategoryChart();
  renderTrendChart();
  renderInvestChart();
  renderRecent();
}

mountLayout('dashboard');
renderAll();
