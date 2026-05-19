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

function renderDailySnapshot() {
  const el = document.getElementById('dailySnapshot');
  if (!el) return;
  const data = window.SNAPSHOTS_DATA;
  if (!data || !data.snapshots || data.snapshots.length === 0) {
    el.innerHTML = '<div class="empty"><div class="empty-icon">📅</div>ยังไม่มี snapshot — รอ cron รันเช้า/เย็น</div>';
    return;
  }

  const snaps = [...data.snapshots].sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  const latest = snaps[0];
  const prev = snaps[1] || null;
  const rate = latest.usdThb || 32.61;

  const totalValueUsd = (latest.stocksValueUsd || 0) + (latest.optionsValueUsd || 0);
  const totalCostUsd = (latest.stocksCostUsd || 0) + (latest.optionsCostUsd || 0);
  const totalPlUsd = totalValueUsd - totalCostUsd;
  const totalPlPct = totalCostUsd > 0 ? (totalPlUsd / totalCostUsd) * 100 : 0;

  let deltaHtml = '';
  if (prev) {
    const prevValueUsd = (prev.stocksValueUsd || 0) + (prev.optionsValueUsd || 0);
    const deltaUsd = totalValueUsd - prevValueUsd;
    const deltaPct = prevValueUsd > 0 ? (deltaUsd / prevValueUsd) * 100 : 0;
    const deltaColor = deltaUsd >= 0 ? 'var(--success)' : 'var(--danger)';
    const arrow = deltaUsd >= 0 ? '▲' : '▼';
    deltaHtml = `
      <div style="margin-top: 8px; font-size: 0.92rem; color: ${deltaColor}">
        ${arrow} ${deltaUsd >= 0 ? '+' : ''}${fmt.usd(deltaUsd)} (${deltaUsd >= 0 ? '+' : ''}${deltaPct.toFixed(2)}%) จาก ${prev.date} ${prev.time}
      </div>`;
  }

  const stocksPL = (latest.stocksValueUsd || 0) - (latest.stocksCostUsd || 0);
  const optionsPL = (latest.optionsValueUsd || 0) - (latest.optionsCostUsd || 0);

  el.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: end; flex-wrap: wrap; gap: 12px;">
      <div>
        <div style="color: var(--text-muted); font-size: 0.88rem;">มูลค่าพอร์ตรวม · ${latest.date} ${latest.time} (${latest.slot})</div>
        <div style="font-size: 2rem; font-weight: 700;">${fmt.thb(totalValueUsd * rate)}</div>
        <div style="color: var(--text-muted); font-size: 0.92rem;">≈ ${fmt.usd(totalValueUsd)}</div>
        ${deltaHtml}
      </div>
      <div style="text-align: right;">
        <div style="font-size: 0.85rem; color: var(--text-muted);">P/L รวมตั้งแต่ซื้อ</div>
        <div style="font-size: 1.3rem; font-weight: 700; color: ${totalPlUsd >= 0 ? 'var(--success)' : 'var(--danger)'}">
          ${totalPlUsd >= 0 ? '+' : ''}${fmt.thb(totalPlUsd * rate)}
        </div>
        <div style="font-size: 0.85rem; color: var(--text-muted);">${totalPlUsd >= 0 ? '+' : ''}${totalPlPct.toFixed(2)}% · ${totalPlUsd >= 0 ? '+' : ''}${fmt.usd(totalPlUsd)}</div>
      </div>
    </div>

    <div class="grid grid-2" style="margin-top: 16px; gap: 12px;">
      <div style="padding: 12px 14px; background: var(--bg); border-radius: 8px;">
        <div style="font-size: 0.82rem; color: var(--text-muted);">📈 หุ้น</div>
        <div style="font-weight: 600;">${fmt.thb((latest.stocksValueUsd || 0) * rate)}</div>
        <div style="font-size: 0.85rem; color: ${stocksPL >= 0 ? 'var(--success)' : 'var(--danger)'}">${stocksPL >= 0 ? '+' : ''}${fmt.usd(stocksPL)}</div>
      </div>
      <div style="padding: 12px 14px; background: var(--bg); border-radius: 8px;">
        <div style="font-size: 0.82rem; color: var(--text-muted);">🎲 ออปชัน</div>
        <div style="font-weight: 600;">${fmt.thb((latest.optionsValueUsd || 0) * rate)}</div>
        <div style="font-size: 0.85rem; color: ${optionsPL >= 0 ? 'var(--success)' : 'var(--danger)'}">${optionsPL >= 0 ? '+' : ''}${fmt.usd(optionsPL)}</div>
      </div>
    </div>

    <details style="margin-top: 14px;">
      <summary style="cursor: pointer; color: var(--text-muted); font-size: 0.88rem;">📜 History (${snaps.length} snapshots)</summary>
      <div class="table-wrap" style="margin-top: 10px;">
        <table>
          <thead><tr><th>วัน-เวลา</th><th>Slot</th><th style="text-align:right">มูลค่า (THB)</th><th style="text-align:right">P/L</th></tr></thead>
          <tbody>
            ${snaps.map(s => {
              const v = ((s.stocksValueUsd || 0) + (s.optionsValueUsd || 0)) * (s.usdThb || 32.61);
              const c = ((s.stocksCostUsd || 0) + (s.optionsCostUsd || 0)) * (s.usdThb || 32.61);
              const pl = v - c;
              const slotIcon = s.slot === 'morning' ? '🌅' : '🌆';
              return `<tr>
                <td>${s.date} ${s.time}</td>
                <td>${slotIcon} ${s.slot}</td>
                <td style="text-align:right">${fmt.thb(v)}</td>
                <td style="text-align:right; color: ${pl >= 0 ? 'var(--success)' : 'var(--danger)'}">${pl >= 0 ? '+' : ''}${fmt.thb(pl)}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </details>
  `;
}

let _newsFilter = 'ALL';
function renderNews() {
  const data = window.NEWS_DATA;
  const listEl = document.getElementById('newsList');
  const filterEl = document.getElementById('newsFilter');
  if (!listEl) return;
  if (!data || !data.days) {
    listEl.innerHTML = '<div class="empty"><div class="empty-icon">📰</div>ยังไม่มีข่าว — สั่ง "อัพเดทข่าว" ในแชท</div>';
    return;
  }
  const tickerColors = { RDW:'#6366f1', ENPH:'#10b981', CPER:'#f59e0b', SOUN:'#ec4899' };
  const allTickers = new Set();
  data.days.forEach(d => (d.items || []).forEach(n => allTickers.add(n.ticker)));
  const tickers = [...allTickers].sort();

  filterEl.innerHTML = ['ALL', ...tickers].map(t => {
    const active = t === _newsFilter;
    const bg = active ? (tickerColors[t] || 'var(--primary)') : 'var(--bg)';
    const fg = active ? 'white' : 'var(--text-muted)';
    return `<button onclick="_newsFilter='${t}';renderNews()" style="background:${bg};color:${fg};border:1px solid var(--border);padding:5px 14px;border-radius:16px;cursor:pointer;font-size:0.85rem;font-family:inherit">${t === 'ALL' ? 'ทั้งหมด' : t}</button>`;
  }).join('');

  // Group by day, filter by ticker
  const filteredDays = data.days.map(d => ({
    ...d,
    items: (d.items || []).filter(n => _newsFilter === 'ALL' || n.ticker === _newsFilter),
  })).filter(d => d.items.length > 0);

  if (filteredDays.length === 0) {
    listEl.innerHTML = '<div class="empty"><div class="empty-icon">📰</div>ไม่มีข่าวสำหรับ ' + _newsFilter + '</div>';
    return;
  }

  listEl.innerHTML = filteredDays.map(d => `
    <div style="margin-bottom: 18px;">
      <div style="display:flex; align-items:baseline; gap:10px; padding: 6px 0; border-bottom: 2px solid var(--border); margin-bottom: 8px;">
        <span style="font-weight: 600; font-size: 1rem;">📅 ${d.label}</span>
        <span style="color: var(--text-muted); font-size: 0.82rem;">${d.date}</span>
      </div>
      ${d.items.map(n => {
        const color = tickerColors[n.ticker] || 'var(--primary)';
        const hasDetail = !!n.detail;
        const detailHtml = hasDetail ? n.detail.replace(/\n/g, '<br>') : '<i style="color:var(--text-muted)">รายละเอียดยังไม่ได้แปล — สั่ง "อัพเดทข่าวเต็ม" ในแชทเพื่อให้ Claude แปล</i>';
        return `
          <details style="padding: 10px 14px; border-bottom: 1px solid var(--border);">
            <summary style="cursor: pointer; list-style: none; outline: none;">
              <div style="display:flex; align-items:center; gap:10px; margin-bottom: 4px; flex-wrap:wrap;">
                <span style="background:${color}22; color:${color}; padding:2px 10px; border-radius:10px; font-size:0.72rem; font-weight:600;">${n.ticker}</span>
                <span style="color: var(--text-muted); font-size: 0.78rem;">${n.source || ''}</span>
                <span style="color: var(--text-muted); font-size: 0.75rem; margin-left: auto;">${hasDetail ? '📖 มีรายละเอียด' : '⏳ ยังไม่มีรายละเอียด'} ▾</span>
              </div>
              <div style="line-height: 1.5; font-weight: 500;">${n.summary}</div>
            </summary>
            <div style="margin-top: 12px; padding: 14px; background: var(--bg); border-radius: 8px; line-height: 1.7; font-size: 0.95rem;">
              ${detailHtml}
              ${n.href ? `<div style="margin-top: 12px; font-size: 0.78rem;"><a href="${n.href}" target="_blank" rel="noopener" style="color: var(--text-muted);">🔗 อ่านต้นฉบับ (อังกฤษ)</a></div>` : ''}
            </div>
          </details>
        `;
      }).join('')}
    </div>
  `).join('');

  const ts = data.lastUpdated ? new Date(data.lastUpdated).toLocaleString('th-TH') : '-';
  listEl.insertAdjacentHTML('beforeend', `<div style="padding: 10px 0; font-size: 0.78rem; color: var(--text-muted); text-align: center;">🕐 อัปเดต ${ts} · ${data.source}</div>`);
}

function renderAll() {
  renderStats();
  renderDailySnapshot();
  renderNews();
  renderCategoryChart();
  renderTrendChart();
  renderInvestChart();
  renderRecent();
}

mountLayout('dashboard');
renderAll();
