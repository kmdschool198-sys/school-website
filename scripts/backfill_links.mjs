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
import { adminDb } from './lib/adminApp.mjs';

const root = process.cwd();
const write = process.argv.includes('--write');
const db = adminDb();

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
