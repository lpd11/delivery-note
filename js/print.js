/**
 * บ้านกัปตัน — หน้าพิมพ์ A4 (print.html)
 * ดึงบิล + ตั้งค่าหัวบิล แล้วเรนเดอร์ตามประเภท (ใบส่งของ / ใบเสร็จ)
 */
document.addEventListener('DOMContentLoaded', () => { initSize(); render(); });

// จำนวนแถวขั้นต่ำในตาราง (เติมแถวว่างให้ใบดูเต็ม) — A5 น้อยกว่าเพราะพื้นที่ครึ่งแผ่น
const MIN_ROWS = 6;
const MIN_ROWS_A5 = 3;
let curItems = [];

/** เติมแถวรายการ + แถวว่างตามขนาดกระดาษปัจจุบัน (เรียกซ้ำได้เมื่อสลับ A4/A5) */
function fillItems() {
  const items = curItems;
  const min = document.body.classList.contains('size-a5') ? MIN_ROWS_A5 : MIN_ROWS;
  const rows = items.map((it, i) => `
    <tr>
      <td class="c-no">${i + 1}</td>
      <td>${escapeHtml(it.productName)}</td>
      <td class="c-qty">${trimNum(it.qty)}</td>
      <td class="c-price">${formatMoney(it.unitPrice)}</td>
      <td class="c-amt">${formatMoney(it.amount)}</td>
    </tr>`);
  for (let i = items.length; i < min; i++) {
    rows.push(`<tr class="empty-cell"><td class="c-no"></td><td></td><td></td><td></td><td></td></tr>`);
  }
  document.getElementById('doc-items').innerHTML = rows.join('');
}

// ==========================================
// เลือกขนาดพิมพ์ A4 (เต็มแผ่น) / A5 (ครึ่งแผ่นบน A4 แนวนอน)
// ==========================================
function initSize() {
  const saved = localStorage.getItem('bk_paper_size') || 'a4';
  document.getElementById('size-toggle').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (btn) applySize(btn.dataset.size);
  });
  applySize(saved);
}

function applySize(size) {
  if (size !== 'a5') size = 'a4';
  localStorage.setItem('bk_paper_size', size);
  document.body.classList.toggle('size-a5', size === 'a5');
  document.querySelectorAll('#size-toggle button').forEach(b => b.classList.toggle('active', b.dataset.size === size));

  // A4 และ A5 ใช้กระดาษ "แนวตั้ง" เหมือนกัน (ไม่ต้องหมุน!) — A5 แค่ย่อบิลเป็นแนวนอนไว้ครึ่งบน
  document.getElementById('page-style').textContent = '@page{size:A4;margin:0;}';

  document.getElementById('size-hint').textContent = (size === 'a5')
    ? 'A5: พิมพ์กระดาษ A4 แนวตั้งตามปกติ (ไม่ต้องหมุน) บิลจะอยู่ครึ่งบน — ตัดตามเส้นแนวนอนได้ใบเล็ก'
    : '';

  fillItems();  // ปรับจำนวนแถวว่างให้พอดีขนาด
  fitPaper();
}

async function render() {
  const billId = getUrlParam('billId');
  if (!billId) { document.getElementById('party-shop').textContent = 'ไม่พบเลขที่บิล'; return; }

  showLoading('กำลังเตรียมเอกสาร...');
  try {
    const [{ bill, items }, settings] = await Promise.all([getBill(billId), getSettings().catch(() => null)]);
    applySettings(settings);
    applyBill(bill, items);
    fitPaper();
  } catch (e) {
    document.getElementById('party-shop').textContent = 'โหลดบิลไม่สำเร็จ: ' + e.message;
  } finally {
    hideLoading();
  }
}

/** ย่อกระดาษ A4 (210mm) ให้พอดีความกว้างจอมือถือ — พรีวิวเหมือน PDF ทั้งหน้า ไม่ตัดคำ/ล้นขอบ */
function fitPaper() {
  const paper = document.getElementById('paper');
  const stage = document.querySelector('.doc-stage');
  if (!paper || !stage) return;
  paper.style.zoom = '1';
  const cs = getComputedStyle(stage);
  const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
  const avail = stage.clientWidth - padX;
  const pw = paper.offsetWidth; // ความกว้าง A4 จริง (~794px)
  if (pw > avail + 1) paper.style.zoom = avail / pw;
}
window.addEventListener('resize', fitPaper);

function applySettings(s) {
  if (!s) return;
  if (s.storeName) document.getElementById('biz-name').textContent = s.storeName;
  document.getElementById('biz-tag').textContent = s.tagline || '';
  document.getElementById('biz-tel').textContent = s.phone ? ('โทร. ' + s.phone) : '';
  if (s.logoBase64) document.getElementById('biz-logo').src = s.logoBase64;
}

function applyBill(bill, items) {
  const isReceipt = bill.docType === 'receipt';
  const stage = document.getElementById('doc-stage');
  stage.setAttribute('data-doc', bill.docType || 'delivery');
  document.title = `${isReceipt ? 'ใบเสร็จรับเงิน' : 'ใบส่งของ'} ${bill.billId} — บ้านกัปตัน`;

  document.getElementById('doc-title').textContent = isReceipt ? 'ใบเสร็จรับเงิน' : 'ใบส่งของ';
  document.getElementById('party-label').textContent = isReceipt ? 'ได้รับเงินจาก' : 'ส่งให้ร้าน';
  document.getElementById('party-shop').textContent = bill.shopName || '-';
  document.getElementById('doc-no').textContent = bill.billId || '-';
  document.getElementById('doc-date').textContent = thaiShortDate(bill.date);

  // ที่อยู่ + เลขประจำตัวผู้เสียภาษี (เฉพาะใบเสร็จ — เว้นบรรทัดว่างไว้เขียนมือได้ถ้าไม่กรอก)
  const addrRow = document.getElementById('party-address-row');
  const taxRow = document.getElementById('party-taxid-row');
  addrRow.hidden = !isReceipt;
  taxRow.hidden = !isReceipt;
  if (isReceipt) {
    document.getElementById('party-address').textContent = (bill.shopAddress || '').replace(/\r?\n/g, ' ') || ' ';
    document.getElementById('party-taxid').textContent = bill.shopTaxId || ' ';
  }

  // รายการ (เติมแถวว่างตามขนาด — A5 น้อยกว่าเพื่อให้พอดีครึ่งแผ่น)
  curItems = items || [];
  fillItems();

  // ยอดรวม
  const total = Number(bill.totalAmount) || (items || []).reduce((s, it) => s + (Number(it.amount) || 0), 0);
  document.getElementById('tot-amt').textContent = formatMoney(total);
  document.getElementById('tot-words').innerHTML = isReceipt ? `( ${bahtText(total)} )` : '';

  // ช่องเซ็น
  document.getElementById('signs').innerHTML = isReceipt ? signsReceipt() : signsDelivery();
}

function signBox(role) {
  return `
    <div class="sign">
      <div class="line"></div>
      <div class="role">${role}</div>
      <div class="paren">( .................................. )</div>
      <div class="date">วันที่ ......./......./..........</div>
    </div>`;
}
function signsDelivery() {
  return signBox('ผู้ส่งสินค้า') + signBox('ผู้รับสินค้า');
}
function signsReceipt() {
  return signBox('ผู้ส่งของ') + signBox('ผู้รับเงิน');
}

// ---------- utils ----------
function trimNum(v) {
  const n = Number(v);
  if (isNaN(n)) return v;
  return Number.isInteger(n) ? String(n) : n.toLocaleString('th-TH', { maximumFractionDigits: 2 });
}
function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
