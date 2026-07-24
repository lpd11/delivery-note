/**
 * บ้านกัปตัน — หน้าพิมพ์ A4 (print.html)
 * ดึงบิล + ตั้งค่าหัวบิล แล้วเรนเดอร์ตามประเภท (ใบส่งของ / ใบเสร็จ)
 */
document.addEventListener('DOMContentLoaded', render);

// จำนวนแถวขั้นต่ำในตาราง (เติมแถวว่างให้ใบดูเต็ม)
const MIN_ROWS = 6;

async function render() {
  const billId = getUrlParam('billId');
  if (!billId) { document.getElementById('party-shop').textContent = 'ไม่พบเลขที่บิล'; return; }

  showLoading('กำลังเตรียมเอกสาร...');
  try {
    const [{ bill, items }, settings] = await Promise.all([getBill(billId), getSettings().catch(() => null)]);
    applySettings(settings);
    applyBill(bill, items);
  } catch (e) {
    document.getElementById('party-shop').textContent = 'โหลดบิลไม่สำเร็จ: ' + e.message;
  } finally {
    hideLoading();
  }
}

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

  // รายการ
  const tbody = document.getElementById('doc-items');
  const rows = (items || []).map((it, i) => `
    <tr>
      <td class="c-no">${i + 1}</td>
      <td>${escapeHtml(it.productName)}</td>
      <td class="c-qty">${trimNum(it.qty)}</td>
      <td class="c-price">${formatMoney(it.unitPrice)}</td>
      <td class="c-amt">${formatMoney(it.amount)}</td>
    </tr>`);
  // เติมแถวว่างให้ครบขั้นต่ำ
  for (let i = items.length; i < MIN_ROWS; i++) {
    rows.push(`<tr class="empty-cell"><td class="c-no"></td><td></td><td></td><td></td><td></td></tr>`);
  }
  tbody.innerHTML = rows.join('');

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
