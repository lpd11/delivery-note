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
    return `
      <div class="bill-card" onclick="location.href='print.html?billId=${encodeURIComponent(b.billId)}'">
        <div class="bc-main">
          <div class="bc-shop">
            <span class="badge ${isReceipt ? 'badge-receipt' : 'badge-delivery'}">${isReceipt ? 'ใบเสร็จ' : 'ใบส่งของ'}</span>
            ${escapeHtml(b.shopName || '-')}
          </div>
          <div class="bc-meta">เลขที่ ${escapeHtml(b.billId)} · ${thaiShortDate(b.date)} · ${b.itemCount || 0} รายการ</div>
        </div>
        <div class="bc-amt">${formatCurrency(b.totalAmount)}</div>
      </div>`;
  }).join('');
}

function errorState(msg) {
  return `<div class="empty-state"><div class="em">⚠️</div>โหลดไม่สำเร็จ<br><small>${escapeHtml(msg)}</small></div>`;
}
function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
