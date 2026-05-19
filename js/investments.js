// ===== Investments =====
function renderInv() {
  // Exclude options — they live on options.html
  const list = DB.getInvestments().filter(x => x.type !== 'ออปชัน');
  const tbody = document.getElementById('invBody');
  const empty = document.getElementById('invEmpty');
  const rate = getUsdThb();

  let totalValueThb = 0, totalCostThb = 0;

  if (list.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
  } else {
    empty.style.display = 'none';
    tbody.innerHTML = list.map(x => {
      const qty = Number(x.quantity || 0);
      const buy = Number(x.buyPrice || 0);
      const cur = Number(x.currentPrice || 0);
      const cost = qty * buy;
      const value = qty * cur;
      const pl = value - cost;
      const plPct = cost > 0 ? (pl / cost) * 100 : 0;
      const isUsd = isUsdInvestment(x);
      const fx = isUsd ? rate : 1;
      const costThb = cost * fx;
      const valueThb = value * fx;
      const plThb = pl * fx;
      totalValueThb += valueThb;
      totalCostThb += costThb;
      const plColor = pl >= 0 ? 'var(--success)' : 'var(--danger)';
      const priceFmt = isUsd ? fmt.usd : (n) => fmt.thb(n, 2);
      const subThb = (thb) => isUsd ? `<div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 400">${fmt.thb(thb)}</div>` : '';
      return `
        <tr>
          <td>
            <div style="font-weight: 600">${x.name} ${isUsd ? '<span style="font-size:0.7rem; color:var(--text-muted)">USD</span>' : ''}</div>
            ${x.note ? `<div style="font-size: 0.78rem; color: var(--text-muted)">${x.note}</div>` : ''}
          </td>
          <td><span class="badge cat">${x.type || '-'}</span></td>
          <td style="text-align: right">${fmt.num(qty, 4)}</td>
          <td style="text-align: right">${priceFmt(buy)}</td>
          <td style="text-align: right">${priceFmt(cur)}</td>
          <td style="text-align: right; font-weight: 600">
            ${priceFmt(value)}
            ${subThb(valueThb)}
          </td>
          <td style="text-align: right; color: ${plColor}; font-weight: 600">
            ${pl >= 0 ? '+' : ''}${priceFmt(pl)}
            <div style="font-size: 0.78rem; font-weight: 400">${pl >= 0 ? '+' : ''}${plPct.toFixed(2)}%</div>
            ${isUsd ? `<div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 400">${plThb >= 0 ? '+' : ''}${fmt.thb(plThb)}</div>` : ''}
          </td>
          <td>
            <div class="row-actions">
              <button class="icon-btn" onclick="editInv('${x.id}')">✏️</button>
              <button class="icon-btn danger" onclick="delInv('${x.id}')">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  const totalPLThb = totalValueThb - totalCostThb;
  const totalPct = totalCostThb > 0 ? (totalPLThb / totalCostThb) * 100 : 0;
  const totalValueUsd = totalValueThb / rate;
  const totalCostUsd = totalCostThb / rate;
  const totalPLUsd = totalPLThb / rate;

  document.getElementById('invStats').innerHTML = `
    <div class="stat invest">
      <div class="label">มูลค่ารวม</div>
      <div class="value">${fmt.thb(totalValueThb)}</div>
      <div class="sub">≈ ${fmt.usd(totalValueUsd)}</div>
    </div>
    <div class="stat balance">
      <div class="label">ต้นทุนรวม</div>
      <div class="value">${fmt.thb(totalCostThb)}</div>
      <div class="sub">≈ ${fmt.usd(totalCostUsd)}</div>
    </div>
    <div class="stat ${totalPLThb >= 0 ? 'income' : 'expense'}">
      <div class="label">กำไร/ขาดทุน</div>
      <div class="value ${totalPLThb >= 0 ? 'pos' : 'neg'}">${totalPLThb >= 0 ? '+' : ''}${fmt.thb(totalPLThb)}</div>
      <div class="sub">${totalPLThb >= 0 ? '+' : ''}${totalPct.toFixed(2)}% · ${totalPLUsd >= 0 ? '+' : ''}${fmt.usd(totalPLUsd)}</div>
    </div>
    <div class="stat">
      <div class="label">จำนวนสินทรัพย์</div>
      <div class="value">${list.length}</div>
      <div class="sub">อัตราแลก: 1 USD = ฿${rate}</div>
    </div>
  `;
}

function openInvModal() {
  document.getElementById('invModalTitle').textContent = 'เพิ่มสินทรัพย์';
  ['iId','iName','iQty','iBuyPrice','iCurPrice','iBuyDate','iNote'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('iType').value = 'หุ้น';
  document.getElementById('invModal').classList.add('open');
}
function closeInvModal() { document.getElementById('invModal').classList.remove('open'); }

function editInv(id) {
  const x = DB.getInvestments().find(i => i.id === id);
  if (!x) return;
  document.getElementById('invModalTitle').textContent = 'แก้ไขสินทรัพย์';
  document.getElementById('iId').value = x.id;
  document.getElementById('iName').value = x.name || '';
  document.getElementById('iType').value = x.type || 'หุ้น';
  document.getElementById('iQty').value = x.quantity || '';
  document.getElementById('iBuyPrice').value = x.buyPrice || '';
  document.getElementById('iCurPrice').value = x.currentPrice || '';
  document.getElementById('iBuyDate').value = x.buyDate || '';
  document.getElementById('iNote').value = x.note || '';
  document.getElementById('invModal').classList.add('open');
}

function saveInv() {
  const data = {
    name: document.getElementById('iName').value.trim(),
    type: document.getElementById('iType').value,
    quantity: Number(document.getElementById('iQty').value) || 0,
    buyPrice: Number(document.getElementById('iBuyPrice').value) || 0,
    currentPrice: Number(document.getElementById('iCurPrice').value) || 0,
    buyDate: document.getElementById('iBuyDate').value,
    note: document.getElementById('iNote').value.trim(),
  };
  if (!data.name) { toast('กรุณาใส่ชื่อสินทรัพย์', 'error'); return; }
  if (data.quantity <= 0) { toast('กรุณาใส่จำนวน', 'error'); return; }
  const id = document.getElementById('iId').value;
  if (id) { DB.updateInvestment(id, data); toast('แก้ไขแล้ว'); }
  else { DB.addInvestment(data); toast('เพิ่มสินทรัพย์แล้ว'); }
  closeInvModal();
  renderInv();
}

function delInv(id) {
  if (!confirm('ลบสินทรัพย์นี้?')) return;
  DB.deleteInvestment(id);
  toast('ลบแล้ว');
  renderInv();
}

// ===== Watchlist sync (real-time prices managed by Claude) =====
async function syncWatchlist() {
  try {
    const data = window.STOCKS_DATA;
    if (!data) throw new Error('ไม่พบ stocks.js — ตรวจสอบว่าไฟล์ assets/stocks.js โหลดสำเร็จ');
    const list = DB.getInvestments();
    let updated = 0, added = 0;
    (data.stocks || []).forEach(s => {
      const existing = list.find(x => x.name === s.ticker);
      const fromExcel = s.quantity !== undefined && s.buyPrice !== undefined;
      if (existing) {
        let changed = false;
        if (Number(existing.currentPrice) !== Number(s.currentPrice)) {
          existing.currentPrice = Number(s.currentPrice);
          changed = true;
        }
        if (fromExcel) {
          if (Number(existing.quantity) !== Number(s.quantity)) {
            existing.quantity = Number(s.quantity);
            changed = true;
          }
          if (Number(existing.buyPrice) !== Number(s.buyPrice)) {
            existing.buyPrice = Number(s.buyPrice);
            changed = true;
          }
        }
        if (changed) {
          existing.note = `${s.name} · ซิงค์จาก Excel ${data.lastUpdated || ''}`;
          updated++;
        }
      } else {
        list.push({
          id: crypto.randomUUID(),
          name: s.ticker,
          type: 'หุ้น',
          currency: 'USD',
          quantity: fromExcel ? Number(s.quantity) : 0,
          buyPrice: fromExcel ? Number(s.buyPrice) : 0,
          currentPrice: Number(s.currentPrice),
          buyDate: '',
          note: `${s.name} · ${fromExcel ? 'ซิงค์จาก Excel' : 'เพิ่มจาก watchlist'} ${data.lastUpdated || ''}`,
        });
        added++;
      }
    });

    // Sync Options (each option has stable id like opt_RDW_C20_20270115)
    (data.options || []).forEach(o => {
      const expiryTh = o.expiry ? new Date(o.expiry).toLocaleDateString('th-TH', { year: '2-digit', month: 'short', day: 'numeric' }) : '';
      const displayName = `${o.underlying} ${o.optionType} $${o.strike}`;
      const noteText = `หมดอายุ ${expiryTh} · ${o.contracts} สัญญา · IV ${o.iv}% · Δ${o.delta} Θ${o.theta} · BE $${o.breakeven}`;
      const existing = list.find(x => x.id === o.id || x.name === displayName);
      if (existing) {
        let changed = false;
        if (Number(existing.currentPrice) !== Number(o.currentPrice)) { existing.currentPrice = Number(o.currentPrice); changed = true; }
        if (Number(existing.buyPrice) !== Number(o.buyPrice)) { existing.buyPrice = Number(o.buyPrice); changed = true; }
        if (Number(existing.quantity) !== Number(o.quantity)) { existing.quantity = Number(o.quantity); changed = true; }
        existing.note = noteText;
        existing.type = 'ออปชัน';
        existing.currency = 'USD';
        if (changed) updated++;
      } else {
        list.push({
          id: o.id,
          name: displayName,
          type: 'ออปชัน',
          currency: 'USD',
          quantity: Number(o.quantity),
          buyPrice: Number(o.buyPrice),
          currentPrice: Number(o.currentPrice),
          buyDate: '',
          note: noteText,
        });
        added++;
      }
    });
    if (updated > 0 || added > 0) {
      DB.saveInvestments(list);
      renderInv();
    }
    const lastBox = document.getElementById('lastSyncBox');
    if (lastBox) {
      const when = data.lastUpdated ? new Date(data.lastUpdated).toLocaleString('th-TH') : '-';
      lastBox.innerHTML = `🕐 ราคาล่าสุด: <b>${when}</b> · จาก <a href="https://finance.yahoo.com" target="_blank">Yahoo Finance</a>`;
    }
    if (added > 0 || updated > 0) toast(`ซิงค์ราคา: เพิ่ม ${added}, อัปเดต ${updated} รายการ`);
  } catch (err) {
    console.warn(err);
    const lastBox = document.getElementById('lastSyncBox');
    if (lastBox) lastBox.innerHTML = `⚠️ ดึง watchlist ไม่ได้: ${err.message}`;
  }
}

mountLayout('investments');
renderInv();
syncWatchlist();
