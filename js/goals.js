// ===== Goals =====
function renderGoals() {
  const list = DB.getGoals();
  const grid = document.getElementById('goalGrid');
  const empty = document.getElementById('goalEmpty');

  if (list.length === 0) {
    grid.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  grid.innerHTML = list.map(g => {
    const target = Number(g.target || 0);
    const current = Number(g.current || 0);
    const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
    const remain = Math.max(0, target - current);

    let timeText = '';
    if (g.deadline) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dl = new Date(g.deadline);
      const days = Math.ceil((dl - today) / 86400000);
      if (days > 0) {
        const perDay = remain / days;
        timeText = `เหลือ ${days} วัน · ออม ${fmt.money(perDay)}/วัน`;
      } else if (days === 0) {
        timeText = 'ถึงกำหนดวันนี้';
      } else {
        timeText = `เลยกำหนด ${Math.abs(days)} วัน`;
      }
    }

    return `
      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px">
          <div style="display: flex; align-items: center; gap: 12px">
            <div style="font-size: 2rem">${g.icon || '🎯'}</div>
            <div>
              <div style="font-size: 1.15rem; font-weight: 600">${g.name}</div>
              ${g.deadline ? `<div style="font-size: 0.82rem; color: var(--text-muted)">📅 ${fmt.date(g.deadline)}</div>` : ''}
            </div>
          </div>
          <div class="row-actions">
            <button class="icon-btn" onclick="addProgress('${g.id}')" title="บันทึกเงินออม">💰</button>
            <button class="icon-btn" onclick="editGoal('${g.id}')">✏️</button>
            <button class="icon-btn danger" onclick="delGoal('${g.id}')">🗑️</button>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: end; margin-top: 12px">
          <div>
            <div style="font-size: 0.8rem; color: var(--text-muted)">ปัจจุบัน</div>
            <div style="font-size: 1.3rem; font-weight: 700">${fmt.money(current)}</div>
          </div>
          <div style="text-align: right">
            <div style="font-size: 0.8rem; color: var(--text-muted)">เป้าหมาย</div>
            <div style="font-size: 1rem; color: var(--text-muted)">${fmt.money(target)}</div>
          </div>
        </div>

        <div class="progress"><div style="width: ${pct}%"></div></div>
        <div class="goal-meta">
          <span>${pct.toFixed(1)}% บรรลุแล้ว</span>
          <span>เหลืออีก ${fmt.money(remain)}</span>
        </div>
        ${timeText ? `<div style="margin-top: 10px; padding: 8px 12px; background: var(--bg); border-radius: 6px; font-size: 0.85rem; color: var(--text-muted)">⏱️ ${timeText}</div>` : ''}
        ${g.note ? `<div style="margin-top: 10px; font-size: 0.85rem; color: var(--text-muted)">${g.note}</div>` : ''}
      </div>
    `;
  }).join('');
}

function openGoalModal() {
  document.getElementById('goalModalTitle').textContent = 'เพิ่มเป้าหมาย';
  ['gId','gName','gTarget','gDeadline','gIcon','gNote'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('gCurrent').value = '0';
  document.getElementById('goalModal').classList.add('open');
}
function closeGoalModal() { document.getElementById('goalModal').classList.remove('open'); }

function editGoal(id) {
  const g = DB.getGoals().find(x => x.id === id);
  if (!g) return;
  document.getElementById('goalModalTitle').textContent = 'แก้ไขเป้าหมาย';
  document.getElementById('gId').value = g.id;
  document.getElementById('gName').value = g.name || '';
  document.getElementById('gTarget').value = g.target || '';
  document.getElementById('gCurrent').value = g.current || 0;
  document.getElementById('gDeadline').value = g.deadline || '';
  document.getElementById('gIcon').value = g.icon || '';
  document.getElementById('gNote').value = g.note || '';
  document.getElementById('goalModal').classList.add('open');
}

function saveGoal() {
  const data = {
    name: document.getElementById('gName').value.trim(),
    target: Number(document.getElementById('gTarget').value) || 0,
    current: Number(document.getElementById('gCurrent').value) || 0,
    deadline: document.getElementById('gDeadline').value,
    icon: document.getElementById('gIcon').value.trim(),
    note: document.getElementById('gNote').value.trim(),
  };
  if (!data.name) { toast('กรุณาใส่ชื่อเป้าหมาย', 'error'); return; }
  if (data.target <= 0) { toast('กรุณาใส่ยอดเป้าหมาย', 'error'); return; }
  const id = document.getElementById('gId').value;
  if (id) { DB.updateGoal(id, data); toast('แก้ไขแล้ว'); }
  else { DB.addGoal(data); toast('เพิ่มเป้าหมายแล้ว'); }
  closeGoalModal();
  renderGoals();
}

function addProgress(id) {
  const g = DB.getGoals().find(x => x.id === id);
  if (!g) return;
  const input = prompt(`บันทึกเงินออมเพิ่มสำหรับ "${g.name}"\n(ใส่จำนวนเงิน บาท)`, '0');
  if (input === null) return;
  const amount = Number(input);
  if (isNaN(amount)) { toast('จำนวนเงินไม่ถูกต้อง', 'error'); return; }
  DB.updateGoal(id, { current: Number(g.current || 0) + amount });
  toast(`บันทึกเพิ่ม ${fmt.money(amount)} แล้ว`);
  renderGoals();
}

function delGoal(id) {
  if (!confirm('ลบเป้าหมายนี้?')) return;
  DB.deleteGoal(id);
  toast('ลบแล้ว');
  renderGoals();
}

mountLayout('goals');
renderGoals();
