// One-off repair after the roster was saved with the built-in class ids (p1_1 ... m3_1) instead of
// the saved ones (mnnbhd8o...), around 3-4 Nov 2569. Puts every class back on its original id so the
// attendance / homeroom history since May matches again:
//   1. roster: class ids back to the original id; students added since get that prefix too
//   2. attendance and homeroom written under a built-in id move to the original id. Where the same
//      class and day already exists (days teachers entered twice), the first entry wins on any
//      student marked differently, students only in the second entry are added, and the
//      differences are listed so teachers can check them.
// Every touched document is saved to private/backups/ first. Dry run unless --write.
//
// Usage: node scripts/repair_roster_class_ids.mjs [--write]
import fs from 'node:fs';
import path from 'node:path';
import { adminDb } from './lib/adminApp.mjs';

const WRITE = process.argv.includes('--write');
const ORIGINAL = { // label -> id the history is keyed by
  'ป.1/1': 'mnnbhd8om45cr', 'ป.2/1': 'mnnbhd8ofiyyb', 'ป.3/1': 'mnnbhd8onrgma', 'ป.4/1': 'mnnbhd8on7ezz',
  'ป.5/1': 'mnnbhd8o4kr0l', 'ป.6/1': 'mnnbhd8ofr96k', 'ม.1/1': 'mnnbhd8of8yjf', 'ม.2/1': 'mnnbhd8oqp1am',
  'ม.3/1': 'mnnbhd8o0bky9',
};

const db = adminDb();
const rosterRef = db.doc('config/attendance_classes');
const roster = (await rosterRef.get()).data();

const idMap = {}; // built-in id -> original id
for (const c of roster.classes) {
  const orig = ORIGINAL[c.label];
  if (orig && c.classId !== orig) idMap[c.classId] = orig;
}
if (!Object.keys(idMap).length) {
  console.log('roster already uses the original class ids — nothing to do');
  process.exit(0);
}
console.log('class ids to restore:', Object.entries(idMap).map(([a, b]) => `${a} -> ${b}`).join(', '));

const renameKey = key => {
  for (const [from, to] of Object.entries(idMap)) if (key.startsWith(`${from}_`)) return `${to}_${key.slice(from.length + 1)}`;
  return key;
};

const backup = { roster: roster, attendance: {}, homeroom: {} };
const writes = []; // [ref, data|null]
const conflicts = [];

// 1. roster
const fixedRoster = {
  ...roster,
  classes: roster.classes.map(c => (idMap[c.classId]
    ? { ...c, classId: idMap[c.classId], students: (c.students || []).map(s => ({ ...s, id: renameKey(s.id) })) }
    : c)),
  updatedAt: Date.now(),
};
const renamedStudents = roster.classes.flatMap(c => (c.students || []).filter(s => renameKey(s.id) !== s.id).map(s => `${c.label} ${s.name}`));
writes.push([rosterRef, fixedRoster]);

// 2. attendance + homeroom
for (const col of ['attendance', 'homeroom']) {
  for (const [from, to] of Object.entries(idMap)) {
    const snap = await db.collection(col).where('classId', '==', from).get();
    for (const d of snap.docs) {
      const data = d.data();
      const date = data.date || d.id.slice(from.length + 1);
      const targetRef = db.doc(`${col}/${to}_${date}`);
      const target = await targetRef.get();
      backup[col][d.id] = data;
      if (target.exists) backup[col][targetRef.id] = target.data();

      let merged;
      if (col === 'attendance') {
        const moved = Object.fromEntries(Object.entries(data.records || {}).map(([k, v]) => [renameKey(k), v]));
        if (target.exists) {
          const first = target.data().records || {};
          for (const [k, v] of Object.entries(moved)) {
            if (first[k] && first[k].status !== v.status) conflicts.push(`${date} ${k.split('_').pop()}: first ${first[k].status}, second ${v.status}`);
          }
          merged = { ...target.data(), records: { ...moved, ...first }, classId: to };
        } else {
          merged = { ...data, records: moved, classId: to };
        }
      } else {
        // homeroom: keep the first log if one exists, otherwise move this one
        merged = target.exists ? { ...data, ...target.data(), classId: to, id: targetRef.id } : { ...data, classId: to, id: targetRef.id };
      }
      writes.push([targetRef, merged]);
      writes.push([d.ref, null]);
    }
  }
}

const moves = writes.filter(([, v]) => v === null).length;
console.log(`roster: ${Object.keys(idMap).length} classes back to their original id; students re-keyed: ${renamedStudents.join(', ') || 'none'}`);
console.log(`documents moved to the original id: ${moves} (attendance ${Object.keys(backup.attendance).length ? '' : ''}${writes.filter(([r, v]) => v === null && r.path.startsWith('attendance/')).length}, homeroom ${writes.filter(([r, v]) => v === null && r.path.startsWith('homeroom/')).length})`);
console.log(`students marked differently on a day entered twice (first entry kept): ${conflicts.length}`);
conflicts.forEach(c => console.log('   ' + c));

if (!WRITE) {
  console.log('\ndry run — nothing written. Run with --write to apply.');
  process.exit(0);
}

const dir = path.join(process.cwd(), 'private', 'backups');
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, `roster-class-id-repair-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
fs.writeFileSync(file, JSON.stringify(backup, null, 1));
console.log('backup:', file);

for (let i = 0; i < writes.length; i += 400) {
  const batch = db.batch();
  for (const [ref, data] of writes.slice(i, i + 400)) data === null ? batch.delete(ref) : batch.set(ref, data);
  await batch.commit();
}
console.log(`written: ${writes.length} operations`);
process.exit(0);
