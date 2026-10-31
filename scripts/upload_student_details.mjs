// Upload PDPA-protected DMC student details (citizen ID, address, guardians, health) to Firestore
// student_details/dmc_2569. firestore.rules lets only signed-in staff read it, so the data never
// ships in the public JS bundle. Source file: private/dmc_student_details_2569.json (gitignored).
//
// Usage: npm run upload:student-details            (dry run: prints counts only)
//        npm run upload:student-details -- --write (writes to Firestore)
import fs from 'node:fs';
import path from 'node:path';
import { adminDb, fail } from './lib/adminApp.mjs';
import { FieldValue } from 'firebase-admin/firestore';

const root = process.cwd();
const sourceFile = path.join(root, 'private', 'dmc_student_details_2569.json');
const write = process.argv.includes('--write');

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

await adminDb().collection('student_details').doc('dmc_2569').set({
  source: 'DMC 1/2569',
  students,
  updatedAt: FieldValue.serverTimestamp(),
});
console.log(`อัปโหลด student_details/dmc_2569 แล้ว (${count} คน)`);
