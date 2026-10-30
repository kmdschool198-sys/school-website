// Import the school's academic calendar (private/school_calendar_2569.json, made by
// parse_school_calendar.py) into school_calendar as open/close overrides. Only days that differ
// from the normal rule (Mon-Fri open, Sat-Sun closed) are written. Days a teacher already set in
// the app are never overwritten; a disagreement is listed for the teacher to check.
//
// Usage: npm run import:calendar            (dry run)
//        npm run import:calendar -- --write
import fs from 'node:fs';
import path from 'node:path';
import { adminDb } from './lib/adminApp.mjs';

const write = process.argv.includes('--write');
const days = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'private', 'school_calendar_2569.json'), 'utf8'));
const db = adminDb();
const col = db.collection('school_calendar');
const existing = new Map((await col.get()).docs.map(d => [d.id, d.data()]));

const toWrite = [];
let kept = 0;
for (const [date, d] of Object.entries(days).sort()) {
  const [y, m, dd] = date.split('-').map(Number);
  const weekday = new Date(y, m - 1, dd).getDay();
  const normallyOpen = weekday !== 0 && weekday !== 6;
  if (d.teaching === normallyOpen) continue;
  const note = d.note || (d.teaching ? 'เปิดเรียน (ตามปฏิทินโรงเรียน)' : (m === 10 || (m === 3 && dd >= 29) ? 'ปิดภาคเรียน' : 'ปิดเรียน (ตามปฏิทินโรงเรียน)'));
  const cur = existing.get(date);
  if (cur) {
    kept++;
    if (cur.open !== d.teaching) console.log(`ต่างกัน ${date}: ในระบบ ${cur.open ? 'เปิด' : 'ปิด'} / ปฏิทิน ${d.teaching ? 'เปิด' : 'ปิด'} (${note}) — คงค่าในระบบไว้`);
    continue;
  }
  toWrite.push({ date, open: d.teaching, note });
}
toWrite.forEach(t => console.log(`${t.date} ${t.open ? 'เปิด' : 'ปิด'} ${t.note}`));
console.log(`\nสรุป: เพิ่มใหม่ ${toWrite.length} วัน, มีในระบบแล้ว ${kept} วัน (ไม่แตะ)`);
if (!write) {
  console.log('Dry run: ยังไม่ได้เขียน (เพิ่ม -- --write เพื่อบันทึกจริง)');
  process.exit(0);
}
const batch = db.batch();
for (const t of toWrite) {
  batch.set(col.doc(t.date), { open: t.open, note: t.note, teacherName: 'นำเข้าจากปฏิทินโรงเรียน 2569', updatedAt: Date.now() });
}
await batch.commit();
console.log('บันทึกแล้ว');
