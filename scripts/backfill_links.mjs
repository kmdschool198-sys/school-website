// Fill missing link fields in existing records so every system joins on ids. Additive only:
// it sets fields that are empty and never deletes or overwrites a non-empty value.
//   - config/attendance_classes: student `code` that is empty, from the DMC file when the name matches
//   - log_saving / log_body_metrics: `studentId` that is empty, from the roster by student code
// Run npm run backup:firestore first.
//
// Usage: npm run backfill:links            (dry run: prints what would change)
//        npm run backfill:links -- --write (writes)
import fs from 'node:fs';
import path from 'node:path';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const root = process.cwd();
const write = process.argv.includes('--write');
loadEnvFile('.env');
loadEnvFile('.env.local');
if (!getApps().length) {
  initializeApp({ credential: cert(loadServiceAccount()), projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'web-site-kmd' });
}
const db = getFirestore();

const PREFIXES = /^(เด็กชาย|เด็กหญิง|ด\.ช\.|ด\.ญ\.|นางสาว|นาย|นาง|น\.ส\.)\s*/;
const norm = name => (name || '').replace(/\s+/g, ' ').trim().replace(PREFIXES, '').replace(/\s+/g, '');

// DMC roster (names and codes only) from the app source
const src = fs.readFileSync(path.join(root, 'src/data/dmcStudentMaster.ts'), 'utf8');
const marker = 'DMC_STUDENTS_MASTER: DmcStudentMaster[] = ';
const start = src.indexOf(marker) + marker.length;
const dmc = JSON.parse(src.slice(start, src.indexOf('\n];', start) + 2));
const dmcByName = new Map(dmc.map(s => [norm(s.name), s.code]));

// 1. roster codes
const rosterRef = db.collection('config').doc('attendance_classes');
const roster = (await rosterRef.get()).data();
let codeFills = 0;
for (const cls of roster.classes || []) {
  for (const st of cls.students || []) {
    const code = String(st.code ?? '').trim();
    if (code && code !== '-') continue;
    const found = dmcByName.get(norm(st.name));
    if (found) {
      console.log(`roster ${cls.label}: ${st.name} code "${st.code ?? ''}" -> "${found}"`);
      st.code = found;
      codeFills++;
    } else {
      console.log(`roster ${cls.label}: ${st.name} has no code and no DMC name match (left as is)`);
    }
  }
}

// student code -> roster student id
const idByCode = new Map();
for (const cls of roster.classes || []) for (const st of cls.students || []) if (st.code) idByCode.set(String(st.code), st.id);

// 2. log studentId
const logFills = [];
for (const col of ['log_saving', 'log_body_metrics']) {
  const snap = await db.collection(col).get();
  for (const d of snap.docs) {
    const data = d.data();
    if (data.studentId) continue;
    const id = idByCode.get(String(data.studentCode || '').replace(/^student_/, ''));
    if (id) logFills.push({ ref: d.ref, studentId: id, label: `${col}/${d.id} (${data.studentName || data.studentCode})` });
    else console.log(`${col}/${d.id}: no roster match for code "${data.studentCode}" (left as is)`);
  }
}
logFills.forEach(f => console.log(`${f.label} studentId -> ${f.studentId}`));

console.log(`\nสรุป: เติมเลขประจำตัวในรายชื่อ ${codeFills} คน, เติม studentId ในบันทึก ${logFills.length} รายการ`);
if (!write) {
  console.log('Dry run: ยังไม่ได้เขียน (เพิ่ม -- --write เพื่อบันทึกจริง)');
  process.exit(0);
}
if (codeFills) await rosterRef.update({ classes: roster.classes });
for (const f of logFills) await f.ref.update({ studentId: f.studentId });
console.log('บันทึกแล้ว');

function loadEnvFile(fileName) {
  const filePath = path.join(root, fileName);
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx < 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!process.env[key]) process.env[key] = value;
  }
}

function loadServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    return JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8'));
  }
  const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credentialPath) fail('กรุณาระบุ GOOGLE_APPLICATION_CREDENTIALS ใน .env.local ให้ชี้ไปที่ service account JSON');
  const resolved = path.resolve(root, credentialPath);
  if (!fs.existsSync(resolved)) fail(`ไม่พบ service account JSON: ${resolved}`);
  return JSON.parse(fs.readFileSync(resolved, 'utf8'));
}

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}
