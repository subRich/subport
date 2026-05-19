// ===== Transactions Page =====
const DEFAULT_CATS = ['อาหาร', 'เดินทาง', 'ที่อยู่อาศัย', 'สาธารณูปโภค', 'ช้อปปิ้ง', 'สุขภาพ', 'บันเทิง', 'การศึกษา', 'เงินเดือน', 'โบนัส', 'ดอกเบี้ย', 'อื่นๆ'];

function getCategories() {
  const txs = DB.getTransactions();
  const set = new Set(DEFAULT_CATS);
  txs.forEach(t => t.category && set.add(t.category));
  return [...set];
}

function refreshCategoryInputs() {
  const cats = getCategories();
  document.getElementById('catList').innerHTML = cats.map(c => `<option value="${c}">`).join('');
  const filter = document.getElementById('filterCat');
  const cur = filter.value;
  filter.innerHTML = '<option value="">ทั้งหมด</option>' + cats.map(c => `<option value="${c}">${c}</option>`).join('');
  filter.value = cur;
}

function getFilteredTxs() {
  const month = document.getElementById('filterMonth').value;
  const type = document.getElementById('filterType').value;
  const cat = document.getElementById('filterCat').value;
  const q = document.getElementById('filterSearch').value.trim().toLowerCase();
  return DB.getTransactions().filter(t => {
    if (month && !t.date.startsWith(month)) return false;
    if (type && t.type !== type) return false;
    if (cat && t.category !== cat) return false;
    if (q && !(t.note || '').toLowerCase().includes(q) && !(t.category || '').toLowerCase().includes(q)) return false;
    return true;
  }).sort((a, b) => b.date.localeCompare(a.date));
}

function render() {
  refreshCategoryInputs();
  const list = getFilteredTxs();
  const tbody = document.getElementById('tbody');
  const empty = document.getElementById('emptyState');

  if (list.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
  } else {
    empty.style.display = 'none';
    tbody.innerHTML = list.map(t => `
      <tr>
        <td>${fmt.date(t.date)}</td>
        <td><span class="badge ${t.type}">${t.type === 'income' ? 'รายรับ' : 'รายจ่าย'}</span></td>
        <td><span class="badge cat">${t.category || '-'}</span></td>
        <td style="color: var(--text-muted)">${t.note || '-'}</td>
        <td style="text-align: right; font-weight: 600; color: ${t.type === 'income' ? 'var(--success)' : 'var(--danger)'}">
          ${t.type === 'income' ? '+' : '-'}${fmt.money(t.amount)}
        </td>
        <td>
          <div class="row-actions">
            <button class="icon-btn" title="แก้ไข" onclick="editTx('${t.id}')">✏️</button>
            <button class="icon-btn danger" title="ลบ" onclick="deleteTx('${t.id}')">🗑️</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  // Summary based on current filter
  const income = list.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount || 0), 0);
  const expense = list.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount || 0), 0);
  const balance = income - expense;
  document.getElementById('summary').innerHTML = `
    <div class="stat income"><div class="label">รายรับรวม</div><div class="value pos">${fmt.money(income)}</div><div class="sub">${list.filter(t=>t.type==='income').length} รายการ</div></div>
    <div class="stat expense"><div class="label">รายจ่ายรวม</div><div class="value neg">${fmt.money(expense)}</div><div class="sub">${list.filter(t=>t.type==='expense').length} รายการ</div></div>
    <div class="stat balance"><div class="label">คงเหลือสุทธิ</div><div class="value ${balance >= 0 ? 'pos' : 'neg'}">${fmt.money(balance)}</div><div class="sub">รวมทั้งสิ้น ${list.length} รายการ</div></div>
  `;
}

// ===== Modal =====
function openModal() {
  document.getElementById('modalTitle').textContent = 'เพิ่มรายการ';
  document.getElementById('tId').value = '';
  document.getElementById('tDate').value = new Date().toISOString().slice(0, 10);
  document.getElementById('tType').value = 'expense';
  document.getElementById('tCategory').value = '';
  document.getElementById('tAmount').value = '';
  document.getElementById('tNote').value = '';
  refreshCategoryInputs();
  document.getElementById('txModal').classList.add('open');
}
function closeModal() {
  document.getElementById('txModal').classList.remove('open');
}
function editTx(id) {
  const t = DB.getTransactions().find(x => x.id === id);
  if (!t) return;
  document.getElementById('modalTitle').textContent = 'แก้ไขรายการ';
  document.getElementById('tId').value = t.id;
  document.getElementById('tDate').value = t.date;
  document.getElementById('tType').value = t.type;
  document.getElementById('tCategory').value = t.category || '';
  document.getElementById('tAmount').value = t.amount;
  document.getElementById('tNote').value = t.note || '';
  refreshCategoryInputs();
  document.getElementById('txModal').classList.add('open');
}
function saveTx() {
  const data = {
    date: document.getElementById('tDate').value,
    type: document.getElementById('tType').value,
    category: document.getElementById('tCategory').value.trim() || 'อื่นๆ',
    amount: Number(document.getElementById('tAmount').value) || 0,
    note: document.getElementById('tNote').value.trim(),
  };
  if (!data.date) { toast('กรุณาเลือกวันที่', 'error'); return; }
  if (data.amount <= 0) { toast('กรุณาใส่จำนวนเงิน', 'error'); return; }
  const id = document.getElementById('tId').value;
  if (id) {
    DB.updateTransaction(id, data);
    toast('แก้ไขรายการแล้ว');
  } else {
    DB.addTransaction(data);
    toast('เพิ่มรายการแล้ว');
  }
  closeModal();
  render();
}
function deleteTx(id) {
  if (!confirm('ลบรายการนี้?')) return;
  DB.deleteTransaction(id);
  toast('ลบแล้ว');
  render();
}

// ===== Import / Export Excel =====
document.getElementById('xlsxInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const wb = XLSX.read(ev.target.result, { type: 'array', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
      let added = 0;
      rows.forEach(r => {
        // Try common Thai/English headers
        const date = r['วันที่'] || r['date'] || r['Date'] || r['DATE'];
        const type = r['ประเภท'] || r['type'] || r['Type'];
        const cat = r['หมวดหมู่'] || r['หมวด'] || r['category'] || r['Category'];
        const amount = r['จำนวน'] || r['จำนวนเงิน'] || r['amount'] || r['Amount'] || r['ยอด'];
        const note = r['บันทึก'] || r['หมายเหตุ'] || r['note'] || r['Note'] || r['รายละเอียด'];
        if (!date || !amount) return;

        let dStr = '';
        if (date instanceof Date) dStr = date.toISOString().slice(0, 10);
        else dStr = String(date).slice(0, 10);

        let typeVal = String(type || '').toLowerCase();
        if (typeVal.includes('รับ') || typeVal === 'income') typeVal = 'income';
        else typeVal = 'expense';

        DB.addTransaction({
          date: dStr,
          type: typeVal,
          category: String(cat || 'อื่นๆ').trim(),
          amount: Number(amount) || 0,
          note: String(note || '').trim(),
        });
        added++;
      });
      toast(`นำเข้า ${added} รายการสำเร็จ`);
      render();
    } catch (err) {
      console.error(err);
      toast('อ่านไฟล์ไม่สำเร็จ', 'error');
    }
    e.target.value = '';
  };
  reader.readAsArrayBuffer(file);
});

function exportXlsx() {
  const list = getFilteredTxs();
  if (list.length === 0) { toast('ไม่มีข้อมูลให้ส่งออก', 'error'); return; }
  const data = list.map(t => ({
    'วันที่': t.date,
    'ประเภท': t.type === 'income' ? 'รายรับ' : 'รายจ่าย',
    'หมวดหมู่': t.category,
    'จำนวนเงิน': Number(t.amount),
    'บันทึก': t.note || '',
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'รายรับรายจ่าย');
  XLSX.writeFile(wb, `transactions-${new Date().toISOString().slice(0,10)}.xlsx`);
  toast('ส่งออกแล้ว');
}

// ===== Sync from Excel (รายรับรายจ่าย.xlsx as master) =====
function syncFromExcel() {
  const data = window.TRANSACTIONS_DATA;
  if (!data || !Array.isArray(data.transactions)) return;

  const existing = DB.getTransactions();
  // Keep web-only entries (those without 'xlsx_' prefix in id) + replace all Excel entries
  const webOnly = existing.filter(t => !String(t.id || '').startsWith('xlsx_'));
  const fromExcel = data.transactions.map(t => ({ ...t, id: t.id || `xlsx_${crypto.randomUUID()}` }));
  const merged = [...webOnly, ...fromExcel];
  DB.saveTransactions(merged);
  if (fromExcel.length > 0) {
    const when = data.lastUpdated ? new Date(data.lastUpdated).toLocaleString('th-TH') : '-';
    console.log(`[Excel sync] โหลด ${fromExcel.length} รายการ จาก ${data.source || 'Excel'} (${when})`);
  }
}

// ===== Init =====
['filterMonth', 'filterType', 'filterCat', 'filterSearch'].forEach(id => {
  document.getElementById(id).addEventListener('input', render);
});

mountLayout('transactions');
syncFromExcel();
render();
