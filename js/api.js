/**
 * บ้านกัปตัน — API BRIDGE TO GOOGLE APPS SCRIPT
 *
 * วิธีใช้:
 * - Deploy Apps Script เป็น Web App แล้ววาง URL ที่ API_URL ด้านล่าง
 * - ถ้า URL ยังเป็น placeholder ('YOUR_...') แอปจะรันใน "MOCK MODE"
 *   ใช้ localStorage เป็นฐานข้อมูลจำลอง ทดสอบได้ทันทีโดยไม่ต้องต่อ backend
 */

const API_URL = 'https://script.google.com/macros/s/AKfycbxs1CmzcF-LkkAy1JnwZ0ysVWGoogZ6n7g6cDdvXMUXcGJyKG62G-Eh2RkTh0fAVbzw/exec';

const isMockMode = !API_URL || API_URL.startsWith('YOUR_');

if (isMockMode) {
  console.log('🚀 MOCK MODE (localStorage) — ยังไม่ได้ต่อ Google Sheet');
  initMockDatabase();
} else {
  console.log('📡 LIVE MODE — ต่อ Google Sheet');
}

// ==========================================
// CACHE รายการบิล (stale-while-revalidate) — ซ่อน cold start ของ Apps Script
// ==========================================
const _BILLS_CACHE_KEY = 'bk_bills_cache';
const _BILLS_CACHE_TTL = 2 * 60 * 1000; // 2 นาที

function getBillsCache() {
  try {
    const raw = localStorage.getItem(_BILLS_CACHE_KEY);
    if (!raw) return null;
    const e = JSON.parse(raw);
    return e && e.data ? e.data : null;
  } catch (e) { return null; }
}
function isBillsCacheFresh() {
  try {
    const raw = localStorage.getItem(_BILLS_CACHE_KEY);
    if (!raw) return false;
    const e = JSON.parse(raw);
    return e && (Date.now() - e.ts) <= _BILLS_CACHE_TTL;
  } catch (e) { return false; }
}
function setBillsCache(data) {
  try { localStorage.setItem(_BILLS_CACHE_KEY, JSON.stringify({ data, ts: Date.now() })); }
  catch (e) { console.warn('bills cache write failed', e); }
}
function invalidateBillsCache() {
  localStorage.removeItem(_BILLS_CACHE_KEY);
}

// ==========================================
// CORE REQUEST
// ==========================================
async function apiRequest(action, method = 'GET', silent = false) {
  if (isMockMode) return await mockApiRequest(action, method);

  let url = API_URL;
  const options = {
    method,
    headers: { 'Content-Type': 'text/plain' } // เลี่ยง CORS preflight ของ Apps Script
  };

  if (method === 'GET') {
    const clean = {};
    for (const k in action) {
      const v = action[k];
      if (v !== undefined && v !== null && v !== '') clean[k] = v;
    }
    clean._t = Date.now();
    url = `${API_URL}?${new URLSearchParams(clean).toString()}`;
  } else {
    options.body = JSON.stringify(action);
  }

  // GET เป็น idempotent → retry ได้ (กัน cold start ของ Apps Script ที่ครั้งแรกมักพลาด HTTP 404/5xx)
  // POST (บันทึกบิล) ไม่ retry เพื่อกันบันทึกซ้ำ
  const maxAttempts = method === 'GET' ? 3 : 1;
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, options);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Unknown API Error');
      return json.data;
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, 700 * attempt)); // หน่วง 0.7s, 1.4s แล้วลองใหม่
      }
    }
  }
  // ไม่ใช้ alert() แล้ว — ทุกหน้าที่เรียก API จับ error เองและขึ้น toast/ข้อความในหน้า
  // (alert เด้งซ้ำและน่าตกใจ ทั้งที่บางกรณี POST บันทึกสำเร็จแล้วแต่คำตอบหายระหว่างทาง)
  console.error('API Call Failed:', lastErr);
  throw lastErr;
}

// ==========================================
// EXPOSED API
// ==========================================
async function getSettings()        { return apiRequest({ action: 'getSettings' }); }
async function saveSettings(data)    { return apiRequest({ action: 'saveSettings', data }, 'POST'); }

async function getShops()            { return apiRequest({ action: 'getShops' }); }
async function addShop(data)         { return apiRequest({ action: 'addShop', data }, 'POST'); }

async function getProducts()         { return apiRequest({ action: 'getProducts' }); }

async function getBills(silent)      { return apiRequest({ action: 'getBills' }, 'GET', silent); }
async function getBill(billId)       { return apiRequest({ action: 'getBill', billId }); }
async function saveBill(data)        { return apiRequest({ action: 'saveBill', data }, 'POST'); }
async function updateBill(data)      { return apiRequest({ action: 'updateBill', data }, 'POST'); }
async function voidBill(billId)      { return apiRequest({ action: 'voidBill', billId }, 'POST'); }
async function unvoidBill(billId)    { return apiRequest({ action: 'unvoidBill', billId }, 'POST'); }
async function deleteBill(billId)    { return apiRequest({ action: 'deleteBill', billId }, 'POST'); }

// ==========================================
// MOCK DATABASE (localStorage)
// ==========================================
function initMockDatabase() {
  const seed = (key, val) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(val)); };

  seed('mock_settings', {
    storeName: 'บ้านกัปตัน',
    tagline: 'ขนมโฮมเมด · เบเกอรี่',
    phone: '08X-XXX-XXXX',
    logoBase64: ''
  });

  seed('mock_shops', [
    { shopId: 'SH-1', name: 'ร้านกาแฟ มุมสุข', phone: '', address: '', taxId: '' },
    { shopId: 'SH-2', name: 'ร้านของฝาก ริมทาง', phone: '', address: '', taxId: '' }
  ]);

  seed('mock_products', [
    { productId: 'PD-1', name: 'คุกกี้เนยสด (กล่อง 12 ชิ้น)', defaultPrice: 120 },
    { productId: 'PD-2', name: 'บราวนี่หน้ากรอบ', defaultPrice: 35 },
    { productId: 'PD-3', name: 'ชีสเค้กเลมอน (ชิ้น)', defaultPrice: 45 },
    { productId: 'PD-4', name: 'บันไส้ครีมคัสตาร์ด', defaultPrice: 15 }
  ]);

  seed('mock_bills', []);       // [{billId,docType,date,shopId,shopName,totalAmount,itemCount,createdAt}]
  seed('mock_bill_items', []);  // [{billId,lineNo,productName,qty,unitPrice,amount}]
  seed('mock_bill_seq', 0);
}

async function mockApiRequest(action, method) {
  await new Promise(r => setTimeout(r, 150)); // จำลอง latency
  const get = (k) => JSON.parse(localStorage.getItem(k));
  const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const name = action.action;

  switch (name) {
    case 'getSettings':
      return get('mock_settings');

    case 'saveSettings': {
      set('mock_settings', { ...get('mock_settings'), ...action.data });
      return { success: true };
    }

    case 'getShops':
      return get('mock_shops');

    case 'addShop': {
      const shops = get('mock_shops');
      const d = action.data;
      let existing = shops.find(s => s.name.trim() === String(d.name).trim());
      if (existing) return { shopId: existing.shopId };
      const shopId = 'SH-' + Date.now();
      shops.push({ shopId, name: d.name, phone: d.phone || '', address: d.address || '' });
      set('mock_shops', shops);
      return { shopId };
    }

    case 'getProducts':
      return get('mock_products');

    case 'getBills': {
      const bills = get('mock_bills').map(b => ({ ...b, status: b.status === 'voided' ? 'voided' : 'active' }));
      return bills.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    case 'getBill': {
      const found = get('mock_bills').find(b => b.billId === action.billId);
      if (!found) throw new Error('ไม่พบบิล');
      const bill = { ...found, status: found.status === 'voided' ? 'voided' : 'active' };
      const items = get('mock_bill_items').filter(i => i.billId === action.billId)
        .sort((a, b) => a.lineNo - b.lineNo);
      return { bill, items };
    }

    case 'saveBill': {
      const d = action.data;
      const bills = get('mock_bills');
      const billItems = get('mock_bill_items');
      const shops = get('mock_shops');
      const products = get('mock_products');

      // เลขบิลรันนิ่ง: <พ.ศ.2หลัก><เดือน>-<seq 3หลัก>
      let seq = get('mock_bill_seq') + 1;
      set('mock_bill_seq', seq);
      const now = new Date();
      const yy = String((now.getFullYear() + 543)).slice(-2);
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const billId = `${yy}${mm}-${String(seq).padStart(3, '0')}`;

      // เพิ่ม/อัปเดตร้าน (จำ address/taxId ไว้เติมอัตโนมัติครั้งหน้า)
      let shopId = d.shopId || '';
      if (d.shopName) {
        const nm = d.shopName.trim();
        let sh = shops.find(s => s.name.trim() === nm);
        if (!sh) { sh = { shopId: 'SH-' + Date.now(), name: nm, phone: '', address: '', taxId: '' }; shops.push(sh); }
        if (d.shopAddress) sh.address = d.shopAddress;
        if (d.shopTaxId) sh.taxId = d.shopTaxId;
        shopId = sh.shopId;
        set('mock_shops', shops);
      }

      // upsert สินค้า + อัปเดตราคาล่าสุด
      (d.items || []).forEach(it => {
        if (!it.productName) return;
        const p = products.find(x => x.name.trim() === it.productName.trim());
        if (p) { p.defaultPrice = Number(it.unitPrice) || p.defaultPrice; }
        else { products.push({ productId: 'PD-' + Date.now() + Math.floor(Math.random() * 999), name: it.productName.trim(), defaultPrice: Number(it.unitPrice) || 0 }); }
      });
      set('mock_products', products);

      const total = (d.items || []).reduce((s, it) => s + (Number(it.amount) || 0), 0);
      bills.push({
        billId, docType: d.docType || 'delivery', date: d.date,
        shopId, shopName: d.shopName || '', shopAddress: d.shopAddress || '', shopTaxId: d.shopTaxId || '',
        totalAmount: total, itemCount: (d.items || []).length, createdAt: now.toISOString(), status: 'active'
      });
      set('mock_bills', bills);

      (d.items || []).forEach((it, idx) => {
        billItems.push({
          billId, lineNo: idx + 1, productName: it.productName,
          qty: Number(it.qty) || 0, unitPrice: Number(it.unitPrice) || 0, amount: Number(it.amount) || 0
        });
      });
      set('mock_bill_items', billItems);

      return { billId };
    }

    case 'updateBill': {
      const d = action.data;
      const bills = get('mock_bills');
      const bill = bills.find(b => b.billId === d.billId);
      if (!bill) throw new Error('ไม่พบบิล ' + d.billId);
      if (bill.status === 'voided') throw new Error('บิล ' + d.billId + ' ถูกยกเลิกแล้ว แก้ไขไม่ได้');

      // จำร้าน/ที่อยู่/เลขภาษี + ราคาสินค้าล่าสุด เหมือนตอนสร้างบิล
      const shops = get('mock_shops');
      if (d.shopName) {
        const nm = d.shopName.trim();
        let sh = shops.find(s => s.name.trim() === nm);
        if (!sh) { sh = { shopId: 'SH-' + Date.now(), name: nm, phone: '', address: '', taxId: '' }; shops.push(sh); }
        if (d.shopAddress) sh.address = d.shopAddress;
        if (d.shopTaxId) sh.taxId = d.shopTaxId;
        bill.shopId = sh.shopId;
        set('mock_shops', shops);
      }
      const products = get('mock_products');
      (d.items || []).forEach(it => {
        if (!it.productName) return;
        const p = products.find(x => x.name.trim() === it.productName.trim());
        if (p) { p.defaultPrice = Number(it.unitPrice) || p.defaultPrice; }
        else { products.push({ productId: 'PD-' + Date.now() + Math.floor(Math.random() * 999), name: it.productName.trim(), defaultPrice: Number(it.unitPrice) || 0 }); }
      });
      set('mock_products', products);

      bill.docType = d.docType || 'delivery';
      bill.date = d.date;
      bill.shopName = d.shopName || '';
      bill.shopAddress = d.shopAddress || '';
      bill.shopTaxId = d.shopTaxId || '';
      bill.totalAmount = (d.items || []).reduce((s, it) => s + (Number(it.amount) || 0), 0);
      bill.itemCount = (d.items || []).length;
      bill.updatedAt = new Date().toISOString();
      set('mock_bills', bills);

      // เขียนรายการใหม่ทั้งชุด (ลบของเดิมก่อน)
      const kept = get('mock_bill_items').filter(i => i.billId !== d.billId);
      (d.items || []).forEach((it, idx) => {
        kept.push({
          billId: d.billId, lineNo: idx + 1, productName: it.productName,
          qty: Number(it.qty) || 0, unitPrice: Number(it.unitPrice) || 0, amount: Number(it.amount) || 0
        });
      });
      set('mock_bill_items', kept);

      return { billId: d.billId };
    }

    case 'voidBill':
    case 'unvoidBill': {
      const bills = get('mock_bills');
      const bill = bills.find(b => b.billId === action.billId);
      if (!bill) throw new Error('ไม่พบบิล ' + action.billId);
      if (name === 'voidBill') { bill.status = 'voided'; bill.voidedAt = new Date().toISOString(); }
      else { bill.status = 'active'; bill.voidedAt = ''; }
      set('mock_bills', bills);
      return { success: true, billId: action.billId };
    }

    case 'deleteBill': {
      set('mock_bills', get('mock_bills').filter(b => b.billId !== action.billId));
      set('mock_bill_items', get('mock_bill_items').filter(i => i.billId !== action.billId));
      return { success: true };
    }

    default:
      throw new Error('Mock action not implemented: ' + name);
  }
}
