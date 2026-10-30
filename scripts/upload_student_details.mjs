// Upload PDPA-protected DMC student details (citizen ID, address, guardians, health) to Firestore
// student_details/dmc_2569. firestore.rules lets only signed-in staff read it, so the data never
// ships in the public JS bundle. Source file: private/dmc_student_details_2569.json (gitignored).
//
// Usage: npm run upload:student-details            (dry run: prints counts only)
//        npm run upload:student-details -- --write (writes to Firestore)
import fs from 'node:fs';
import path from 'node:path';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const root = process.cwd();
const sourceFile = path.join(root, 'private', 'dmc_student_details_2569.json');
const write = process.argv.includes('--write');

loadEnvFile('.env');
loadEnvFile('.env.local');

if (!fs.existsSync(sourceFile)) {
  fail(`ไม่พบไฟล์ข้อมูลนักเรียน: ${sourceFile}`);
}
const students = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));
const count = Object.keys(students).length;
console.log(`พบข้อมูลนักเรียน ${count} คน`);

if (!write) {
  console.log('Dry run: ยังไม่ได้เขียนขึ้น Firestore (เพิ่ม -- --write เพื่ออัปโหลดจริง)');
  process.exit(0);
}

const projectId = process.env.VITE_FIREBASE_PROJECT_ID || 'web-site-kmd';
if (!getApps().length) {
  initializeApp({ credential: cert(loadServiceAccount()), projectId });
}

await getFirestore().collection('student_details').doc('dmc_2569').set({
  source: 'DMC 1/2569',
  students,
  updatedAt: FieldValue.serverTimestamp(),
});
console.log(`อัปโหลด student_details/dmc_2569 แล้ว (${count} คน)`);

function loadEnvFile(fileName) {
  const filePath = path.join(root, fileName);
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx < 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function loadServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  }

  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    return JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8'));
  }

  const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credentialPath) {
    fail('กรุณาระบุ GOOGLE_APPLICATION_CREDENTIALS ใน .env.local ให้ชี้ไปที่ service account JSON');
  }

  const resolved = path.resolve(root, credentialPath);
  if (!fs.existsSync(resolved)) {
    fail(`ไม่พบ service account JSON: ${resolved}`);
  }

  return JSON.parse(fs.readFileSync(resolved, 'utf8'));
}

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}
