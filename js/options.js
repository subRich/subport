// ===== Options Page =====
function renderOpt() {
  const all = DB.getInvestments();
  const opts = all.filter(x => x.type === 'ออปชัน');
  const tbody = document.getElementById('optBody');
  const empty = document.getElementById('optEmpty');
  const rate = getUsdThb();

  let totalValueThb = 0, totalCostThb = 0;

  if (opts.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
  } else {
    empty.style.display = 'none';
    tbody.innerHTML = opts.map(x => {
      const qty = Number(x.quantity || 0);
      const buy = Number(x.buyPrice || 0);
      const cur = Number(x.currentPrice || 0);
      const cost = qty * buy;
      const value = qty * cur;
      const pl = value - cost;
      const plPct = cost > 0 ? (pl / cost) * 100 : 0;
      const isUsd = isUsdInvestment(x);
      const fx = isUsd ? rate : 1;
      totalValueThb += value * fx;
      totalCostThb += cost * fx;

      // Parse details from name "RDW Call $20"
      const m = (x.name || '').match(/^(\S+)\s+(Call|Put)\s+\$?([\d.]+)$/);
      const underlying = m ? m[1] : x.name;
      const optType = m ? m[2] : '?';
      const strike = m ? '$' + m[3] : '-';

      // Parse expiry + greeks from note
      const expiryMatch = (x.note || '').match(/หมดอายุ\s+([^·]+)/);
      const expiry = expiryMatch ? expiryMatch[1].trim() : '-';
      const contractsMatch = (x.note || '').match(/(\d+)\s+สัญญา/);
      const contracts = contractsMatch ? contractsMatch[1] : Math.round(qty / 100);
      const ivMatch = (x.note || '').match(/IV\s+([\d.]+)/);
      const deltaMatch = (x.note || '').match(/Δ([\d.\-]+)/);
      const thetaMatch = (x.note || '').match(/Θ([\d.\-]+)/);
      const beMatch = (x.note || '').match(/BE\s+\$?([\d.]+)/);

      const plColor = pl >= 0 ? 'var(--success)' : 'var(--danger)';
      const optTypeColor = optType === 'Call' ? 'var(--success)' : 'var(--danger)';

      return `
        <tr>
          <td>
            <div style="font-weight: 600">${underlying} <span style="color:${optTypeColor}; font-size:0.85rem">${optType}</span></div>
            ${beMatch ? `<div style="font-size: 0.75rem; color: var(--text-muted)">BE $${beMatch[1]}</div>` : ''}
          </td>
          <td style="font-weight:600">${strike}</td>
          <td style="font-size: 0.88rem">${expiry}</td>
          <td style="text-align: right">${contracts}</td>
          <td style="text-align: right">${fmt.usd(buy)}</td>
          <td style="text-align: right; font-weight:600">${fmt.usd(cur)}</td>
          <td style="text-align: right; font-weight:600">
            ${fmt.usd(value)}
            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight:400">${fmt.thb(value * fx)}</div>
          </td>
          <td style="text-align: right; color: ${plColor}; font-weight: 600">
            ${pl >= 0 ? '+' : ''}${fmt.usd(pl)}
            <div style="font-size: 0.78rem; font-weight: 400">${pl >= 0 ? '+' : ''}${plPct.toFixed(2)}%</div>
            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 400">${pl >= 0 ? '+' : ''}${fmt.thb(pl * fx)}</div>
          </td>
          <td style="text-align: right; font-size: 0.78rem; color: var(--text-muted); white-space: nowrap;">
            ${ivMatch ? `IV ${ivMatch[1]}%<br>` : ''}
            ${deltaMatch ? `Δ ${deltaMatch[1]}<br>` : ''}
            ${thetaMatch ? `Θ ${thetaMatch[1]}` : ''}
          </td>
        </tr>
      `;
    }).join('');
  }

  const totalPLThb = totalValueThb - totalCostThb;
  const totalPct = totalCostThb > 0 ? (totalPLThb / totalCostThb) * 100 : 0;

  document.getElementById('optStats').innerHTML = `
    <div class="stat invest">
      <div class="label">มูลค่ารวม</div>
      <div class="value">${fmt.thb(totalValueThb)}</div>
      <div class="sub">≈ ${fmt.usd(totalValueThb / rate)}</div>
    </div>
    <div class="stat balance">
      <div class="label">ต้นทุนรวม</div>
      <div class="value">${fmt.thb(totalCostThb)}</div>
      <div class="sub">≈ ${fmt.usd(totalCostThb / rate)}</div>
    </div>
    <div class="stat ${totalPLThb >= 0 ? 'income' : 'expense'}">
      <div class="label">กำไร/ขาดทุน</div>
      <div class="value ${totalPLThb >= 0 ? 'pos' : 'neg'}">${totalPLThb >= 0 ? '+' : ''}${fmt.thb(totalPLThb)}</div>
      <div class="sub">${totalPLThb >= 0 ? '+' : ''}${totalPct.toFixed(2)}%</div>
    </div>
    <div class="stat">
      <div class="label">สัญญา</div>
      <div class="value">${opts.reduce((s, x) => s + Math.round(Number(x.quantity || 0) / 100), 0)}</div>
      <div class="sub">${opts.length} positions</div>
    </div>
  `;

  // Show last sync time from stocks.js
  const data = window.STOCKS_DATA;
  if (data && data.lastUpdated) {
    const when = new Date(data.lastUpdated).toLocaleString('th-TH');
    document.getElementById('optLastSync').innerHTML = `🕐 ราคาล่าสุด: <b>${when}</b> · ${data.source || 'Yahoo Finance'} · USD/THB ${rate}`;
  }
}

mountLayout('options');
renderOpt();
