# บ้านกัปตัน — แอปออกใบส่งของ / ใบเสร็จ (CLAUDE.md)

## โปรเจกต์คืออะไร

แอปมือถือ (PWA) ให้ร้านขนม **"บ้านกัปตัน"** (แฟนของเจ้าของบัญชี) ออก **ใบส่งของ** และ **ใบเสร็จรับเงิน** แทนการเขียนมือ
เลือกร้าน + กรอกรายการ → บันทึกลง Google Sheet → พิมพ์เป็น A4 / บันทึก PDF → แชร์เข้า LINE
พร้อมจำร้านค้า/รายการขนม และเก็บประวัติบิลดูย้อนหลังได้

## ฟีเจอร์ทั้งหมด

- **เลือกประเภทเอกสารต่อบิล:** ใบส่งของ / ใบเสร็จรับเงิน (toggle บนสุด)
- **เลือกร้านค้า:** dropdown จำร้านเดิม + พิมพ์ร้านใหม่ได้ (บันทึกอัตโนมัติตอน save)
- **รายการสินค้า:** กด + เพิ่มได้, autocomplete ชื่อขนมที่เคยขาย, จำราคาล่าสุด, คูณ+รวมยอดอัตโนมัติ
- **ใบเสร็จ:** มี "จำนวนเงินเป็นตัวอักษรไทย" (…บาทถ้วน) + ช่อง **ที่อยู่ลูกค้า** + **เลขประจำตัวผู้เสียภาษี** (จำต่อร้าน เลือกร้านเดิมเติมให้อัตโนมัติ)
- **พิมพ์ A4:** ดีไซน์แบรนด์ (มิ้นต์/ครีม/เขียว) → Save as PDF → แชร์ LINE; ช่องเซ็นซ้าย-ขวา (ใบส่งของ: ผู้ส่ง/ผู้รับสินค้า, ใบเสร็จ: ผู้ส่งของ/ผู้รับเงิน)
- **ประวัติบิล:** ลิสต์ + ป้ายประเภท + ค้นชื่อร้าน/เลขบิล + กรองประเภท + แตะเพื่อพิมพ์ซ้ำ
- **ตั้งค่าหัวบิล:** ชื่อร้าน/คำโปรย/เบอร์ + อัปโหลดโลโก้ (ย่อ+เข้ารหัสอัตโนมัติ)
- **PWA:** Add to Home Screen, ใช้ offline ได้ (SW network-first)

## Stack

| ชั้น | เทคโนโลยี |
|---|---|
| Frontend | HTML/CSS/JS ล้วน (ไม่มี framework) — PWA |
| Backend | Google Apps Script (Web App) — `Code.gs` |
| Database | Google Sheets (5 ชีต) |
| Hosting | GitHub Pages → `https://lpd11.github.io/delivery-note/` |
| Deploy tool (backend) | clasp |

โครงสร้างยกแพตเทิร์นมาจาก `d:\APP\Car-Tracker` (api bridge + mock mode + SWR cache)

## โครงสร้างไฟล์

```
index.html      — ออกบิล (toggle ประเภท + เลือกร้าน + รายการ + คำนวณ)
history.html    — ประวัติบิล (ค้นหา + กรองประเภท + แตะเพื่อพิมพ์ซ้ำ)
settings.html   — ตั้งค่าหัวบิล (ชื่อร้าน/คำโปรย/เบอร์/โลโก้)
print.html      — พรีวิว A4 + สั่งพิมพ์ (?billId=...)
css/style.css   — UI บนจอ (โทนแบรนด์ มิ้นต์/ครีม/เขียว)
css/print.css   — เอกสาร A4 (พรีวิว + @media print)
js/app.js       — utils ร่วม: วันที่ไทย, เงิน, bahtText(), loading, toast, SW register
js/api.js       — API bridge + MOCK MODE + SWR cache (แก้ API_URL ที่นี่)
js/bill.js      — logic หน้าออกบิล
js/print.js     — เรนเดอร์เอกสารตามประเภท (ใบส่งของ/ใบเสร็จ)
js/history.js   — logic หน้าประวัติ
js/settings.js  — logic ตั้งค่า + ย่อ/เข้ารหัสโลโก้ (กัน cell เกินลิมิต)
Code.gs         — Apps Script backend (router + สคีมา)
appsscript.json — config (tz Asia/Bangkok, webapp ANYONE_ANONYMOUS)
icon.svg        — โลโก้/ไอคอน (บ้าน+เค้ก) — favicon + PWA icon
manifest.json   sw.js — PWA
```

## Google Sheets Schema (auto-create เมื่อเรียกครั้งแรก)

| ชีต | คอลัมน์ |
|---|---|
| `Settings`  | storeName, tagline, phone, logoBase64  *(แถวเดียว)* |
| `Shops`     | shopId, name, phone, address, taxId, createdAt |
| `Products`  | productId, name, defaultPrice |
| `Bills`     | billId, docType, date, shopId, shopName, shopAddress, shopTaxId, totalAmount, itemCount, createdAt |
| `BillItems` | billId, lineNo, productName, qty, unitPrice, amount |

- `docType` = `delivery` (ใบส่งของ) / `receipt` (ใบเสร็จ)
- เลขบิล `billId` รูปแบบ `<พ.ศ.2หลัก><เดือน>-<seq3>` เช่น `6907-001` (รันด้วย LockService + Script Property `BILL_SEQ`)

## MOCK MODE (ทดสอบได้ทันทีไม่ต้องต่อ backend)

ถ้า `API_URL` ใน `js/api.js` ยังเป็น `YOUR_APPS_SCRIPT_WEB_APP_URL` → แอปรันด้วย **localStorage**
มีข้อมูลตัวอย่าง (ร้าน 2, สินค้า 4, settings บ้านกัปตัน) ใช้ทดลองออกบิล/พิมพ์/ดูประวัติได้เลย
เปิดไฟล์ `index.html` ผ่าน `http://localhost` หรือเปิดตรงๆ ก็ได้ (SW จะทำงานเฉพาะบน http/https)

## วิธีต่อ Google Sheet จริง (Deploy backend)

1. สร้าง Google Sheet เปล่า 1 อัน (ชื่ออะไรก็ได้)
2. Extensions → Apps Script → ลบโค้ดเดิม วางเนื้อหา `Code.gs` → ตั้งชื่อโปรเจกต์
3. (ทางเลือก) รันฟังก์ชัน `setup` หนึ่งครั้งเพื่อสร้างชีตทั้ง 5 ล่วงหน้า
4. Deploy → New deployment → **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. คัดลอก **Web App URL** มาวางที่ `js/api.js` → `const API_URL = '...'`
6. push GitHub Pages

> อัปเดต backend ทีหลัง: `clasp push` แล้ว **Deploy → Manage deployments → แก้ deployment เดิม** (อย่าสร้างใหม่) เพื่อให้ URL คงที่

## Deploy frontend (GitHub Pages)

repo เดียวกับที่ตั้ง Pages ไว้ (`lpd11.github.io/delivery-note/`) — push โฟลเดอร์นี้ขึ้นไป
ต้องอัปเดต `scope`/`start_url` ใน `manifest.json` และ path ใน `sw.js` ให้ตรงกับ path ที่ deploy จริง

## จุดที่ต้องระวัง

- **โลโก้ base64**: ย่อ/เข้ารหัสฝั่ง client (`settings.js` → `encodeLogo`) ให้ ≤ 45,000 ตัวอักษร (กัน cell Sheet เกินลิมิต ~50,000) — ลอง PNG ก่อน ใหญ่ไปค่อย fallback JPEG/ย่อขนาด
- **หลังบันทึกบิลต้อง `invalidateBillsCache()`** ไม่งั้นหน้าประวัติโชว์ของเก่า (SWR cache)
- fetch ใช้ `Content-Type: text/plain` เท่านั้น (เลี่ยง CORS preflight ของ Apps Script)
- ความต่างของ 2 ประเภทเอกสาร (หัวเรื่อง/บรรทัดร้าน/ที่อยู่+เลขภาษี/ตัวอักษรเงิน/ช่องเซ็น) เรนเดอร์ด้วย JS ใน `print.js` — **ห้ามใช้ CSS `display:block` toggle ทับ `.signs{display:flex}`** (element ที่เป็น flex ให้คุมโชว์/ซ่อนด้วย `hidden` + `.xxx[hidden]{display:none}` ที่ specificity สูงพอ)
- **`print.html` ไม่ได้โหลด `style.css`** → print.css ต้องมี `box-sizing:border-box` (`.doc-stage *`) เอง ไม่งั้นแถวตาราง `height`+`padding` บวกกันทำให้แถวว่างสูงเกิน; และต้องมีสไตล์ `.loading-overlay` เองไม่งั้นข้อความ loading โผล่ค้าง
- **พิมพ์สีพื้นหลังไม่ออก** เป็นค่า default ของเบราว์เซอร์ → ต้องมี `print-color-adjust:exact` (ใส่ที่ `.paper` เป็น inherited) ไม่งั้นหัวตาราง/ยอดรวมสีหาย
- **แก้สคีมา Sheet:** เพิ่มคอลัมน์ใหม่ใน `HEADERS` แล้ว `sheet_()` จะ `ensureColumns_()` ต่อท้ายให้ชีตเดิมอัตโนมัติ; การเขียนแถวใช้ `appendByHeader_()` (จับคู่ตาม header ไม่พึ่งลำดับคอลัมน์) — **อย่าใช้ `appendRow([...])` แบบ positional** เพราะสคีมา migrate แล้วลำดับจะเพี้ยน
- manifest ใช้ไอคอน SVG — ใช้ Add to Home Screen ได้ ถ้าอยากให้ install prompt เต็มรูปแบบ ค่อยเพิ่ม PNG 192/512

## สถานะ (24 ก.ค. 2569 / 2026) — DEPLOY แล้ว ✅

- [x] Frontend ครบ 4 หน้า + พิมพ์ A4 2 ประเภท + bahtText ภาษาไทย
- [x] Backend `Code.gs` + สคีมา 5 ชีต
- [x] ทดสอบ mock mode ผ่าน (บันทึก/อ่าน/ลบ/upsert/คำนวณ/เรนเดอร์เอกสาร) ด้วย Node+jsdom
- [x] **Deploy backend จริง** — Apps Script bound Sheet + web app (URL อยู่ใน js/api.js), user authorize แล้ว, endpoint ตอบสด
- [x] **Deploy GitHub Pages** → https://lpd11.github.io/delivery-note/
- [ ] ทดสอบ saveBill สด (บิลจริงใบแรกเป็นตัวยืนยัน — เลี่ยงกินเลข 6907-001)
- [ ] ใส่โลโก้จริงของร้าน (ตอนนี้ใช้ไอคอนบ้าน+เค้กชั่วคราว) — อัปโหลดผ่านหน้า "ตั้งค่า"

### Resource IDs (บัญชี eliang11@gmail.com)
- Repo: `lpd11/delivery-note` (GitHub Pages: main /)
- Apps Script scriptId: `1j4G5g40eXkcf9-QvH7MZJKH5roqIFgkN4JiCwdA5_08Zbh11gSo-x1uO`
- Spreadsheet (DB): `1MJpgMKxYYIw3eSnUoLGeZgaEwqP5hCqtu_QDySaFonE`
- Web app deployment: `AKfycbxs1CmzcF-LkkAy1JnwZ0ysVWGoogZ6n7g6cDdvXMUXcGJyKG62G-Eh2RkTh0fAVbzw`
- redeploy backend: `clasp push --force` + `clasp create-deployment -i <deployment>` (redeploy ทับตัวเดิม — อย่าสร้างใหม่ URL จะเปลี่ยน)
- redeploy frontend: `git push origin main` → GitHub Pages build เอง ~1-2 นาที (ถ้าแก้ asset ให้ bump `CACHE` ใน `sw.js`)
- **`.clasp.json`/`.claspignore` ถูก gitignore** (ไม่ push ขึ้น repo) — เก็บไว้ในเครื่องสำหรับ clasp; `.claspignore` ตั้งให้ push เฉพาะ `Code.gs`+`appsscript.json` ไม่เอาไฟล์ frontend ขึ้น Apps Script

## Changelog — session 24 ก.ค. 2569 (2026)

สร้างเสร็จ + deploy จริง + ปรับตามฟีดแบ็กในเซสชันเดียว:

1. **สร้างแอปทั้งชุด** — 4 หน้า (index/history/settings/print) + backend Apps Script + สคีมา 5 ชีต, ยกโครง api bridge/mock/SWR cache จาก `d:\APP\Car-Tracker`
2. **ดีไซน์เอกสาร A4** — user รีวิว mockup แล้วอนุมัติ (โทนจากโลโก้บ้าน+เค้ก), เขียนหน้าพิมพ์ + `bahtText()` แปลงเลขเป็นตัวอักษรไทย (เทสต์ผ่าน Node+jsdom)
3. **Deploy** — `clasp create-script --type sheets` สร้าง Sheet+script, deploy web app, ใส่ URL ใน api.js; สร้าง repo `lpd11/delivery-note` + เปิด GitHub Pages; user authorize สิทธิ์ Apps Script เอง (จำเป็น กดแทนไม่ได้)
4. **แก้หน้าพิมพ์** (ฟีดแบ็ก) — สีพื้นหลังไม่พิมพ์ → `print-color-adjust:exact`; ข้อความ loading โผล่ค้าง → เพิ่มสไตล์ overlay ใน print.css
5. **เพิ่มที่อยู่ + เลขผู้เสียภาษีบนใบเสร็จ** — ฟอร์ม (เฉพาะ receipt) + autofill ต่อร้าน + แสดงใต้ชื่อลูกค้าบนเอกสาร; backend เพิ่มคอลัมน์ + migrate ชีตเดิม
6. **จัดตาราง** (ฟีดแบ็ก) — แถวสูงเท่ากันทุกแถว (`box-sizing` + `height` เดียว) + เส้นในสม่ำเสมอ กรอบนอก/ใต้หัว/เหนือยอดรวมเข้มขึ้น
