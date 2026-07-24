/**
 * บ้านกัปตัน — GOOGLE APPS SCRIPT API (ออกใบส่งของ / ใบเสร็จ)
 *
 * วิธี Deploy:
 * 1. สร้าง Google Sheet เปล่า → Extensions > Apps Script → วางโค้ดนี้
 * 2. Deploy > New deployment > type: Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 3. คัดลอก Web App URL ไปวางที่ js/api.js (ตัวแปร API_URL)
 * (ชีตทั้ง 5 จะถูกสร้างให้อัตโนมัติเมื่อเรียกใช้ครั้งแรก)
 */

const SS_ID = SpreadsheetApp.getActiveSpreadsheet().getId();

// ==========================================
// ROUTERS
// ==========================================
function doGet(e) {
  return handle_(() => {
    const action = e.parameter.action;
    switch (action) {
      case 'getSettings': return getSettings_();
      case 'getShops':    return getShops_();
      case 'getProducts': return getProducts_();
      case 'getBills':    return getBills_();
      case 'getBill':     return getBill_(e.parameter.billId);
      default: throw new Error('Invalid GET action: ' + action);
    }
  });
}

function doPost(e) {
  return handle_(() => {
    const body = JSON.parse(e.postData.contents);
    switch (body.action) {
      case 'saveSettings': return saveSettings_(body.data);
      case 'addShop':      return addShop_(body.data);
      case 'saveBill':     return saveBill_(body.data);
      case 'deleteBill':   return deleteBill_(body.billId);
      default: throw new Error('Invalid POST action: ' + body.action);
    }
  });
}

function handle_(fn) {
  let result;
  try { result = { success: true, data: fn() }; }
  catch (err) { result = { success: false, error: err.toString() }; }
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ==========================================
// SHEET CORE
// ==========================================
const HEADERS = {
  'Settings':  ['storeName', 'tagline', 'phone', 'logoBase64'],
  'Shops':     ['shopId', 'name', 'phone', 'address', 'taxId', 'createdAt'],
  'Products':  ['productId', 'name', 'defaultPrice'],
  'Bills':     ['billId', 'docType', 'date', 'shopId', 'shopName', 'shopAddress', 'shopTaxId', 'totalAmount', 'itemCount', 'createdAt'],
  'BillItems': ['billId', 'lineNo', 'productName', 'qty', 'unitPrice', 'amount']
};

function sheet_(name) {
  const ss = SpreadsheetApp.openById(SS_ID);
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(HEADERS[name]);
    sh.getRange(1, 1, 1, HEADERS[name].length).setFontWeight('bold').setBackground('#CDEBE3');
    if (name === 'Settings') {
      sh.appendRow(['บ้านกัปตัน', 'ขนมโฮมเมด · เบเกอรี่', '', '']);
    }
  } else if (HEADERS[name]) {
    ensureColumns_(sh, HEADERS[name]); // migrate ชีตเดิมให้มีคอลัมน์ใหม่
  }
  return sh;
}

/** เพิ่ม header คอลัมน์ที่ยังไม่มี (ต่อท้าย) — รองรับสคีมาใหม่บนชีตเดิม */
function ensureColumns_(sh, headers) {
  const lastCol = sh.getLastColumn();
  const current = lastCol > 0 ? sh.getRange(1, 1, 1, lastCol).getValues()[0] : [];
  const missing = headers.filter(h => current.indexOf(h) === -1);
  if (missing.length > 0) {
    sh.getRange(1, current.length + 1, 1, missing.length).setValues([missing])
      .setFontWeight('bold').setBackground('#CDEBE3');
  }
}

/** เพิ่มแถวโดยจับคู่ค่าตาม header (ไม่พึ่งลำดับคอลัมน์คงที่ — ปลอดภัยเมื่อสคีมาเปลี่ยน) */
function appendByHeader_(sh, obj) {
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const row = headers.map(h => (obj[h] !== undefined && obj[h] !== null) ? obj[h] : '');
  sh.appendRow(row);
}

function rows_(sh) {
  const values = sh.getDataRange().getValues();
  if (values.length <= 1) return [];
  const headers = values[0];
  const out = [];
  for (let i = 1; i < values.length; i++) {
    const row = {};
    for (let j = 0; j < headers.length; j++) row[headers[j]] = values[i][j];
    row._rowNum = i + 1;
    out.push(row);
  }
  return out;
}

function dateStr_(v) {
  if (v instanceof Date) {
    return Utilities.formatDate(v, 'GMT+7', 'yyyy-MM-dd');
  }
  return v ? String(v) : '';
}

// ==========================================
// SETTINGS (แถวเดียว)
// ==========================================
function getSettings_() {
  const sh = sheet_('Settings');
  const r = rows_(sh)[0];
  if (!r) return { storeName: 'บ้านกัปตัน', tagline: 'ขนมโฮมเมด · เบเกอรี่', phone: '', logoBase64: '' };
  return { storeName: r.storeName, tagline: r.tagline, phone: r.phone, logoBase64: r.logoBase64 };
}

function saveSettings_(data) {
  const sh = sheet_('Settings');
  const row = [data.storeName || 'บ้านกัปตัน', data.tagline || '', data.phone || '', data.logoBase64 || ''];
  if (sh.getLastRow() < 2) sh.appendRow(row);
  else sh.getRange(2, 1, 1, row.length).setValues([row]);
  return { success: true };
}

// ==========================================
// SHOPS
// ==========================================
function getShops_() {
  return rows_(sheet_('Shops')).map(r => ({ shopId: r.shopId, name: r.name, phone: r.phone, address: r.address, taxId: r.taxId }));
}

/** หาร้านตามชื่อ: มีอยู่แล้ว → อัปเดต address/taxId/phone (เฉพาะที่ส่งมา); ไม่มี → สร้างใหม่ */
function upsertShop_(data) {
  const sh = sheet_('Shops');
  const name = String(data.name || '').trim();
  const existing = rows_(sh).find(r => String(r.name).trim() === name);
  if (existing) {
    const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    const setIf = (key, val) => {
      if (val === undefined || val === null || val === '') return;
      const col = headers.indexOf(key) + 1;
      if (col > 0) sh.getRange(existing._rowNum, col).setValue(val);
    };
    setIf('address', data.address);
    setIf('taxId', data.taxId);
    setIf('phone', data.phone);
    return { shopId: existing.shopId };
  }
  const shopId = 'SH-' + new Date().getTime();
  appendByHeader_(sh, { shopId, name, phone: data.phone || '', address: data.address || '', taxId: data.taxId || '', createdAt: new Date() });
  return { shopId: shopId };
}

function addShop_(data) { return upsertShop_(data); }

// ==========================================
// PRODUCTS
// ==========================================
function getProducts_() {
  return rows_(sheet_('Products')).map(r => ({ productId: r.productId, name: r.name, defaultPrice: Number(r.defaultPrice) || 0 }));
}

/** เพิ่มสินค้าใหม่ / อัปเดตราคาล่าสุด */
function upsertProducts_(items) {
  const sh = sheet_('Products');
  const existing = rows_(sh);
  items.forEach(it => {
    const nm = String(it.productName || '').trim();
    if (!nm) return;
    const found = existing.find(r => String(r.name).trim() === nm);
    if (found) {
      if (Number(it.unitPrice) > 0) sh.getRange(found._rowNum, 3).setValue(Number(it.unitPrice));
    } else {
      const pid = 'PD-' + new Date().getTime() + '-' + Math.floor(Math.random() * 999);
      sh.appendRow([pid, nm, Number(it.unitPrice) || 0]);
      existing.push({ name: nm, _rowNum: sh.getLastRow() });
    }
  });
}

// ==========================================
// BILLS
// ==========================================
function nextBillId_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const props = PropertiesService.getScriptProperties();
    const seq = (Number(props.getProperty('BILL_SEQ')) || 0) + 1;
    props.setProperty('BILL_SEQ', String(seq));
    const now = new Date();
    const yy = String(now.getFullYear() + 543).slice(-2); // พ.ศ. 2 หลัก
    const mm = ('0' + (now.getMonth() + 1)).slice(-2);
    return yy + mm + '-' + ('00' + seq).slice(-3);
  } finally {
    lock.releaseLock();
  }
}

function saveBill_(data) {
  const items = data.items || [];
  const billId = nextBillId_();

  // เพิ่มร้านถ้ายังไม่มี
  let shopId = data.shopId || '';
  if (data.shopName) {
    shopId = upsertShop_({ name: data.shopName, address: data.shopAddress, taxId: data.shopTaxId }).shopId;
  }

  upsertProducts_(items);

  const total = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
  appendByHeader_(sheet_('Bills'), {
    billId: billId, docType: data.docType || 'delivery', date: data.date || '', shopId: shopId,
    shopName: data.shopName || '', shopAddress: data.shopAddress || '', shopTaxId: data.shopTaxId || '',
    totalAmount: total, itemCount: items.length, createdAt: new Date()
  });

  const itemSheet = sheet_('BillItems');
  items.forEach((it, idx) => {
    appendByHeader_(itemSheet, { billId: billId, lineNo: idx + 1, productName: it.productName, qty: Number(it.qty) || 0, unitPrice: Number(it.unitPrice) || 0, amount: Number(it.amount) || 0 });
  });

  return { billId: billId };
}

function getBills_() {
  return rows_(sheet_('Bills')).map(r => ({
    billId: r.billId, docType: r.docType, date: dateStr_(r.date),
    shopName: r.shopName, totalAmount: Number(r.totalAmount) || 0,
    itemCount: Number(r.itemCount) || 0, createdAt: r.createdAt
  })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function getBill_(billId) {
  const bill = rows_(sheet_('Bills')).find(r => String(r.billId) === String(billId));
  if (!bill) throw new Error('ไม่พบบิล ' + billId);
  const items = rows_(sheet_('BillItems'))
    .filter(r => String(r.billId) === String(billId))
    .sort((a, b) => Number(a.lineNo) - Number(b.lineNo))
    .map(r => ({ productName: r.productName, qty: Number(r.qty) || 0, unitPrice: Number(r.unitPrice) || 0, amount: Number(r.amount) || 0 }));
  return {
    bill: {
      billId: bill.billId, docType: bill.docType, date: dateStr_(bill.date),
      shopName: bill.shopName, shopAddress: bill.shopAddress || '', shopTaxId: bill.shopTaxId || '',
      totalAmount: Number(bill.totalAmount) || 0
    },
    items: items
  };
}

function deleteBill_(billId) {
  const bSheet = sheet_('Bills');
  const b = rows_(bSheet).find(r => String(r.billId) === String(billId));
  if (b) bSheet.deleteRow(b._rowNum);
  const iSheet = sheet_('BillItems');
  rows_(iSheet).filter(r => String(r.billId) === String(billId))
    .sort((a, b) => b._rowNum - a._rowNum)
    .forEach(r => iSheet.deleteRow(r._rowNum));
  return { success: true };
}

// ==========================================
// SETUP (รันครั้งเดียวใน editor เพื่อสร้างชีตล่วงหน้าได้ ถ้าต้องการ)
// ==========================================
function setup() {
  ['Settings', 'Shops', 'Products', 'Bills', 'BillItems'].forEach(sheet_);
}
