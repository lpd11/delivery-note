/**
 * บ้านกัปตัน — ออกใบส่งของ / ใบเสร็จ
 * SHARED UTILITIES (ใช้ร่วมทุกหน้า)
 */

// ==========================================
// วันที่แบบไทย
// ==========================================
const TH_MONTH_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

/** วันนี้ในรูปแบบ YYYY-MM-DD (สำหรับ input[type=date]) */
function getTodayDateString() {
  const t = new Date();
  const y = t.getFullYear();
  const m = String(t.getMonth() + 1).padStart(2, '0');
  const d = String(t.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** "24 ก.ค. 2569" (พ.ศ.) */
function thaiShortDate(dateStr) {
  const d = dateStr ? new Date(dateStr) : new Date();
  if (isNaN(d.getTime())) return dateStr || '';
  return `${d.getDate()} ${TH_MONTH_SHORT[d.getMonth()]} ${d.getFullYear() + 543}`;
}

/** "24/07/2569" */
function thaiSlashDate(dateStr) {
  const d = dateStr ? new Date(dateStr) : new Date();
  if (isNaN(d.getTime())) return dateStr || '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear() + 543}`;
}

// ==========================================
// ตัวเลข / เงิน
// ==========================================

/** 1234.5 -> "1,234.50" (ไม่มีสัญลักษณ์เงิน — สำหรับตาราง) */
function formatMoney(v) {
  const n = Number(v);
  if (isNaN(n)) return '0.00';
  return n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** 1234.5 -> "฿1,234.50" */
function formatCurrency(v) {
  const n = Number(v);
  if (isNaN(n)) return '฿0.00';
  return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(n);
}

// ==========================================
// จำนวนเงินเป็นตัวอักษรไทย (บาทถ้วน / สตางค์)
// ==========================================
const _BT_D = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
const _BT_P = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน'];

function _readIntTh(n) {
  n = Math.floor(n);
  if (n === 0) return '';
  if (n > 999999) {
    const m = Math.floor(n / 1000000), r = n % 1000000;
    return _readIntTh(m) + 'ล้าน' + (r > 0 ? _readIntTh(r) : '');
  }
  let s = '';
  const str = String(n), len = str.length;
  for (let i = 0; i < len; i++) {
    const d = +str[i], p = len - i - 1;
    if (d === 0) continue;
    if (p === 1 && d === 1) s += 'สิบ';
    else if (p === 1 && d === 2) s += 'ยี่สิบ';
    else if (p === 0 && d === 1 && len > 1) s += 'เอ็ด';
    else s += _BT_D[d] + _BT_P[p];
  }
  return s;
}

/** แปลงจำนวนเงิน -> "หนึ่งร้อยยี่สิบห้าบาทถ้วน" / "...บาทห้าสิบสตางค์" */
function bahtText(num) {
  num = Math.round((Number(num) || 0) * 100) / 100;
  const b = Math.floor(num), st = Math.round((num - b) * 100);
  if (b === 0 && st === 0) return 'ศูนย์บาทถ้วน';
  let s = '';
  if (b > 0) s += _readIntTh(b) + 'บาท';
  s += st > 0 ? _readIntTh(st) + 'สตางค์' : (b > 0 ? 'ถ้วน' : '');
  return s;
}

// ==========================================
// URL param
// ==========================================
function getUrlParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

// ==========================================
// Loading overlay
// ==========================================
function setupLoadingElements() {
  if (document.querySelector('.loading-overlay')) return;
  const loader = document.createElement('div');
  loader.className = 'loading-overlay';
  loader.innerHTML = `<div class="spinner"></div><div class="loading-text">กำลังโหลด...</div>`;
  document.body.appendChild(loader);
}
function showLoading(text) {
  setupLoadingElements();
  const loader = document.querySelector('.loading-overlay');
  if (loader) {
    loader.querySelector('.loading-text').textContent = text || 'กำลังโหลด...';
    loader.classList.add('active');
  }
}
function hideLoading() {
  const loader = document.querySelector('.loading-overlay');
  if (loader) loader.classList.remove('active');
}

// ==========================================
// Toast แจ้งเตือนสั้นๆ
// ==========================================
function toast(msg, type) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.remove('toast-error', 'toast-ok');
  el.classList.add(type === 'error' ? 'toast-error' : 'toast-ok', 'show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2600);
}

// ==========================================
// PWA service worker (ทำงานเฉพาะบน http/https — ข้ามตอนเปิดไฟล์ file://)
// ==========================================
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW register failed', err));
  });
}
