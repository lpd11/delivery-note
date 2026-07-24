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

  try {
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

    const res = await fetch(url, options);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Unknown API Error');
    return json.data;
  } catch (err) {
    console.error('API Call Failed:', err);
    if (!silent) alert('เชื่อมต่อฐานข้อมูลล้มเหลว: ' + err.message);
    throw err;
  }
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
      const bills = get('mock_bills');
      return [...bills].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    case 'getBill': {
      const bill = get('mock_bills').find(b => b.billId === action.billId);
      if (!bill) throw new Error('ไม่พบบิล');
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
        totalAmount: total, itemCount: (d.items || []).length, createdAt: now.toISOString()
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

    case 'deleteBill': {
      set('mock_bills', get('mock_bills').filter(b => b.billId !== action.billId));
      set('mock_bill_items', get('mock_bill_items').filter(i => i.billId !== action.billId));
      return { success: true };
    }

    default:
      throw new Error('Mock action not implemented: ' + name);
  }
}
