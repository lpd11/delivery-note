/**
 * บ้านกัปตัน — ประวัติบิล (history.html)
 * SWR: โชว์ cache ก่อน แล้ว refresh เบื้องหลัง + ค้นหา + กรองประเภท
 */
let allBills = [];
let currentFilter = 'all';
let searchTerm = '';

document.addEventListener('DOMContentLoaded', init);

async function init() {
  document.getElementById('search').addEventListener('input', (e) => {
    searchTerm = e.target.value.trim().toLowerCase();
    renderList();
  });
  document.getElementById('filter-chips').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    currentFilter = chip.dataset.filter;
    document.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c === chip));
    renderList();
  });

  // ปุ่มแก้ไข / ยกเลิก / กู้คืน บนการ์ด (delegation — การ์ดถูกเรนเดอร์ใหม่ตลอด)
  document.getElementById('bill-list').addEventListener('click', onListClick);

  // 1) cache ก่อน (ทันที)
  const cached = getBillsCache();
  if (cached) { allBills = cached; renderList(); }
  else showLoading('กำลังโหลดประวัติ...');

  // 2) refresh ถ้า cache ไม่สด
  if (!isBillsCacheFresh()) {
    try {
      const fresh = await getBills(!!cached);
      allBills = fresh || [];
      setBillsCache(allBills);
      renderList();
    } catch (e) {
      if (!cached) document.getElementById('bill-list').innerHTML = errorState(e.message);
    }
  }
  hideLoading();
}

function renderList() {
  const list = document.getElementById('bill-list');
  let bills = allBills;

  if (currentFilter !== 'all') bills = bills.filter(b => (b.docType || 'delivery') === currentFilter);
  if (searchTerm) {
    bills = bills.filter(b =>
      String(b.shopName || '').toLowerCase().includes(searchTerm) ||
      String(b.billId || '').toLowerCase().includes(searchTerm)
    );
  }

  if (bills.length === 0) {
    list.innerHTML = `<div class="empty-state"><div class="em">🧾</div>${allBills.length === 0 ? 'ยังไม่มีบิล — ไปที่ "ออกบิล" เพื่อสร้างใบแรก' : 'ไม่พบบิลที่ค้นหา'}</div>`;
    return;
  }

  list.innerHTML = bills.map(b => {
    const isReceipt = (b.docType || 'delivery') === 'receipt';
    const voided = b.status === 'voided';
    const id = escapeHtml(b.billId);
    return `
      <div class="bill-card${voided ? ' voided' : ''}">
        <div class="bc-top" data-open="${encodeURIComponent(b.billId)}">
          <div class="bc-main">
            <div class="bc-shop">
              <span class="badge ${isReceipt ? 'badge-receipt' : 'badge-delivery'}">${isReceipt ? 'ใบเสร็จ' : 'ใบส่งของ'}</span>
              ${voided ? '<span class="badge badge-void">ยกเลิกแล้ว</span>' : ''}
              ${escapeHtml(b.shopName || '-')}
            </div>
            <div class="bc-meta">เลขที่ ${id} · ${thaiShortDate(b.date)} · ${b.itemCount || 0} รายการ</div>
          </div>
          <div class="bc-amt">${formatCurrency(b.totalAmount)}</div>
        </div>
        <div class="bc-actions">
          ${voided
            ? `<button type="button" class="mini" data-act="unvoid" data-id="${id}">↩️ กู้คืนบิล</button>`
            : `<button type="button" class="mini" data-act="edit" data-id="${id}">✏️ แก้ไข</button>
               <button type="button" class="mini mini-danger" data-act="void" data-id="${id}">🚫 ยกเลิกบิล</button>`}
        </div>
      </div>`;
  }).join('');
}

async function onListClick(e) {
  const btn = e.target.closest('button[data-act]');
  if (btn) {
    const billId = btn.dataset.id;
    if (btn.dataset.act === 'edit') { location.href = `index.html?billId=${encodeURIComponent(billId)}`; return; }
    if (btn.dataset.act === 'void') return void doVoid(billId, true);
    if (btn.dataset.act === 'unvoid') return void doVoid(billId, false);
    return;
  }
  const open = e.target.closest('[data-open]');
  if (open) location.href = `print.html?billId=${open.dataset.open}`;
}

/** ยกเลิก/กู้คืนบิล — ไม่ลบข้อมูลทิ้ง เลขบิลจึงไม่หายไปจากลำดับ */
async function doVoid(billId, isVoid) {
  const b = allBills.find(x => String(x.billId) === String(billId));
  const shop = b ? (b.shopName || '') : '';
  if (isVoid && !confirm(`ยกเลิกบิลเลขที่ ${billId}${shop ? ' (' + shop + ')' : ''}?\n\nบิลจะยังอยู่ในประวัติแต่พิมพ์ไม่ได้ กู้คืนภายหลังได้`)) return;

  showLoading(isVoid ? 'กำลังยกเลิกบิล...' : 'กำลังกู้คืนบิล...');
  try {
    if (isVoid) await voidBill(billId); else await unvoidBill(billId);
    if (b) b.status = isVoid ? 'voided' : 'active';
    setBillsCache(allBills);
    renderList();
    toast(isVoid ? `ยกเลิกบิล ${billId} แล้ว` : `กู้คืนบิล ${billId} แล้ว`);
  } catch (err) {
    // เหมือนหน้าออกบิล: คำตอบอาจหายกลางทางทั้งที่ทำสำเร็จแล้ว → เช็คสถานะจริงก่อนแจ้ง error
    const want = isVoid ? 'voided' : 'active';
    let real = null;
    try { real = (await getBill(billId)).bill.status; } catch (e2) { /* เช็คไม่ได้ */ }
    if (real === want) {
      if (b) b.status = want;
      setBillsCache(allBills);
      renderList();
      toast(isVoid ? `ยกเลิกบิล ${billId} แล้ว` : `กู้คืนบิล ${billId} แล้ว`);
    } else {
      toast('ทำรายการไม่สำเร็จ: ' + err.message, 'error');
    }
  } finally {
    hideLoading();
  }
}

function errorState(msg) {
  return `<div class="empty-state"><div class="em">⚠️</div>โหลดไม่สำเร็จ<br><small>${escapeHtml(msg)}</small></div>`;
}
function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
