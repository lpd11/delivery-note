/**
 * บ้านกัปตัน — หน้าออกบิล (index.html)
 * เลือกประเภท / ร้าน / รายการ + คำนวณยอด + บันทึก
 */

let docType = 'delivery';
let productPriceMap = {}; // ชื่อสินค้า -> ราคาล่าสุด (เติมราคาให้อัตโนมัติ)
let shopInfoMap = {};     // ชื่อร้าน -> {address, taxId} (เติมอัตโนมัติเมื่อเลือกร้านเดิม)

document.addEventListener('DOMContentLoaded', init);

async function init() {
  document.getElementById('bill-date').value = getTodayDateString();

  // toggle ประเภทเอกสาร (โชว์ช่องที่อยู่/เลขภาษีเฉพาะใบเสร็จ)
  document.getElementById('doc-toggle').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    docType = btn.dataset.type;
    document.querySelectorAll('#doc-toggle button').forEach(b => b.classList.toggle('active', b === btn));
    document.getElementById('receipt-fields').hidden = (docType !== 'receipt');
  });

  document.getElementById('btn-add-item').addEventListener('click', () => addItemRow());
  document.getElementById('btn-save').addEventListener('click', saveCurrentBill);

  // เลือก/พิมพ์ร้านที่เคยมี -> เติมที่อยู่/เลขภาษีให้อัตโนมัติ
  document.getElementById('shop').addEventListener('change', autofillShopInfo);

  addItemRow(); // แถวแรก

  // โหลดร้าน + สินค้า (ไม่บล็อกการกรอก)
  loadShopsAndProducts();
}

function autofillShopInfo() {
  const key = document.getElementById('shop').value.trim();
  const info = shopInfoMap[key];
  if (!info) return;
  if (info.address) document.getElementById('cust-address').value = info.address;
  if (info.taxId) document.getElementById('cust-taxid').value = info.taxId;
}

async function loadShopsAndProducts() {
  try {
    const [shops, products] = await Promise.all([getShops(), getProducts()]);
    const shopList = document.getElementById('shops-list');
    shopList.innerHTML = (shops || []).map(s => `<option value="${escapeHtml(s.name)}">`).join('');
    shopInfoMap = {};
    (shops || []).forEach(s => { shopInfoMap[s.name.trim()] = { address: s.address || '', taxId: s.taxId || '' }; });

    const prodList = document.getElementById('products-list');
    prodList.innerHTML = (products || []).map(p => `<option value="${escapeHtml(p.name)}">`).join('');
    productPriceMap = {};
    (products || []).forEach(p => { productPriceMap[p.name.trim()] = Number(p.defaultPrice) || 0; });
  } catch (e) {
    // ทำงานต่อได้แม้โหลดไม่ได้ (พิมพ์เองได้)
    console.warn('load shops/products failed', e);
  }
}

function addItemRow(data) {
  const container = document.getElementById('items-container');
  const row = document.createElement('div');
  row.className = 'item-row';
  row.innerHTML = `
    <input type="text" class="name" list="products-list" placeholder="ชื่อสินค้า" autocomplete="off" value="${data ? escapeAttr(data.productName) : ''}">
    <input type="number" class="qty" inputmode="decimal" placeholder="จำนวน" min="0" step="any" value="${data ? data.qty : ''}">
    <input type="number" class="price" inputmode="decimal" placeholder="ราคา/หน่วย" min="0" step="any" value="${data ? data.unitPrice : ''}">
    <span class="amount">0.00</span>
    <button type="button" class="del" title="ลบรายการ">×</button>
  `;
  container.appendChild(row);

  const nameEl = row.querySelector('.name');
  const qtyEl = row.querySelector('.qty');
  const priceEl = row.querySelector('.price');

  // เลือกสินค้าที่เคยมี -> เติมราคาให้ ถ้ายังไม่กรอกราคา
  nameEl.addEventListener('change', () => {
    const key = nameEl.value.trim();
    if (productPriceMap[key] != null && !priceEl.value) {
      priceEl.value = productPriceMap[key];
      recalc();
    }
  });

  qtyEl.addEventListener('input', recalc);
  priceEl.addEventListener('input', recalc);
  row.querySelector('.del').addEventListener('click', () => {
    if (document.querySelectorAll('.item-row').length <= 1) {
      // เหลือแถวเดียว: เคลียร์แทนการลบ
      nameEl.value = ''; qtyEl.value = ''; priceEl.value = '';
      recalc();
      return;
    }
    row.remove();
    recalc();
  });

  recalc();
}

function recalc() {
  let grand = 0;
  document.querySelectorAll('.item-row').forEach(row => {
    const qty = parseFloat(row.querySelector('.qty').value) || 0;
    const price = parseFloat(row.querySelector('.price').value) || 0;
    const amt = qty * price;
    row.querySelector('.amount').textContent = formatMoney(amt);
    grand += amt;
  });
  document.getElementById('grand-total').textContent = formatCurrency(grand);
}

function collectItems() {
  const items = [];
  document.querySelectorAll('.item-row').forEach(row => {
    const productName = row.querySelector('.name').value.trim();
    const qty = parseFloat(row.querySelector('.qty').value) || 0;
    const unitPrice = parseFloat(row.querySelector('.price').value) || 0;
    if (!productName && qty === 0 && unitPrice === 0) return; // ข้ามแถวว่าง
    items.push({ productName, qty, unitPrice, amount: qty * unitPrice });
  });
  return items;
}

async function saveCurrentBill() {
  const shopName = document.getElementById('shop').value.trim();
  const date = document.getElementById('bill-date').value;
  const items = collectItems();

  if (!shopName) { toast('กรุณาใส่ชื่อร้านค้า', 'error'); document.getElementById('shop').focus(); return; }
  if (items.length === 0) { toast('กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ', 'error'); return; }
  const bad = items.find(it => !it.productName || it.qty <= 0 || it.unitPrice < 0);
  if (bad) { toast('กรอกชื่อสินค้าและจำนวนให้ครบทุกรายการ', 'error'); return; }

  const total = items.reduce((s, it) => s + it.amount, 0);
  // ที่อยู่/เลขภาษี เก็บเฉพาะใบเสร็จ
  const shopAddress = docType === 'receipt' ? document.getElementById('cust-address').value.trim() : '';
  const shopTaxId = docType === 'receipt' ? document.getElementById('cust-taxid').value.trim() : '';

  showLoading('กำลังบันทึก...');
  try {
    const res = await saveBill({ docType, date, shopName, shopAddress, shopTaxId, items, totalAmount: total });
    invalidateBillsCache();
    hideLoading();
    // ไปหน้าพิมพ์
    location.href = `print.html?billId=${encodeURIComponent(res.billId)}`;
  } catch (e) {
    hideLoading();
    toast('บันทึกไม่สำเร็จ: ' + e.message, 'error');
  }
}

// ---------- utils ----------
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }
