/**
 * บ้านกัปตัน — ตั้งค่าหัวบิล (settings.html)
 * โลโก้: อ่านไฟล์ -> ย่อขนาดด้วย canvas -> เก็บเป็น base64 (กัน cell ใหญ่เกิน)
 */
let logoBase64 = '';        // '' = ใช้รูปเริ่มต้น (icon.svg)
const LOGO_MAX = 256;       // px ด้านที่ยาวสุดหลังย่อ
const CELL_LIMIT = 45000;   // เผื่อ limit เซลล์ Google Sheet (~50,000 ตัวอักษร)

document.addEventListener('DOMContentLoaded', init);

async function init() {
  document.getElementById('btn-upload').addEventListener('click', () => document.getElementById('logo-file').click());
  document.getElementById('logo-file').addEventListener('change', onLogoPicked);
  document.getElementById('btn-remove-logo').addEventListener('click', () => {
    logoBase64 = '';
    document.getElementById('logo-img').src = 'icon.svg';
    toast('จะใช้รูปโลโก้เริ่มต้น (กดบันทึกเพื่อยืนยัน)');
  });
  document.getElementById('btn-save').addEventListener('click', save);

  showLoading('กำลังโหลดการตั้งค่า...');
  try {
    const s = await getSettings();
    if (s) {
      document.getElementById('storeName').value = s.storeName || '';
      document.getElementById('tagline').value = s.tagline || '';
      document.getElementById('phone').value = s.phone || '';
      if (s.logoBase64) { logoBase64 = s.logoBase64; document.getElementById('logo-img').src = s.logoBase64; }
    }
  } catch (e) {
    toast('โหลดการตั้งค่าไม่สำเร็จ', 'error');
  } finally {
    hideLoading();
  }
}

function onLogoPicked(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = new Image();
    img.onload = () => {
      logoBase64 = encodeLogo(img);
      document.getElementById('logo-img').src = logoBase64;
      toast('อัปโหลดรูปแล้ว (กดบันทึกเพื่อยืนยัน)');
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

/**
 * ย่อ + เข้ารหัสโลโก้ให้ base64 ไม่เกินลิมิตเซลล์ Sheet
 * ลอง PNG (รักษาความโปร่งใส) ก่อน ถ้าใหญ่ไปค่อยลด → JPEG → ย่อขนาดเพิ่ม
 */
function encodeLogo(img) {
  let dim = LOGO_MAX;
  for (let attempt = 0; attempt < 4; attempt++) {
    const scale = Math.min(1, dim / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(img, 0, 0, w, h);

    const png = canvas.toDataURL('image/png');
    if (png.length <= CELL_LIMIT) return png;

    // PNG ใหญ่ไป → ลอง JPEG (เล็กกว่ามากสำหรับรูปมีพื้นหลัง)
    for (const q of [0.85, 0.7, 0.55]) {
      const jpg = canvas.toDataURL('image/jpeg', q);
      if (jpg.length <= CELL_LIMIT) return jpg;
    }
    dim = Math.round(dim * 0.75); // ยังใหญ่ → ย่อขนาดลงอีกแล้ววนใหม่
  }
  // ทางสุดท้าย: JPEG เล็กสุด
  const c = document.createElement('canvas');
  c.width = 120; c.height = 120;
  c.getContext('2d').drawImage(img, 0, 0, 120, 120);
  return c.toDataURL('image/jpeg', 0.6);
}

async function save() {
  const data = {
    storeName: document.getElementById('storeName').value.trim() || 'บ้านกัปตัน',
    tagline: document.getElementById('tagline').value.trim(),
    phone: document.getElementById('phone').value.trim(),
    logoBase64: logoBase64
  };
  showLoading('กำลังบันทึก...');
  try {
    await saveSettings(data);
    hideLoading();
    toast('บันทึกการตั้งค่าเรียบร้อย ✓');
  } catch (e) {
    hideLoading();
    toast('บันทึกไม่สำเร็จ: ' + e.message, 'error');
  }
}
