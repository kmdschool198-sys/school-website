// One-off move of the ปพ.5 / ปพ.6 scores that used to be bundled in src/data/academicData.ts
// into Firestore config/academic_scores_2569, in the shape academicScores.ts describes:
//   scores.{classId}.{studentCode}.{subjectCode} = StudentSubjectScore
//   evaluations.{classId}.{studentCode}          = { traitResult, readThinkResult, activityResult, activities }
//
// The write is a single setDoc(..., { merge: true }), so a cell a teacher has already entered is
// never touched: the script stops instead if the document already holds scores (pass --force to
// merge anyway, which keeps existing cells and only fills in the missing ones).
//
// Usage: npm run migrate:academic-scores [-- --dry-run] [-- --force]
import fs from 'node:fs';
import path from 'node:path';
import { adminDb, fail } from './lib/adminApp.mjs';

const root = process.cwd();
const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const force = args.has('--force');

const SOURCE = 'src/data/academicData.ts';
const DOC_PATH = 'config/academic_scores_2569';
const FIRESTORE_DOC_LIMIT = 1048576; // 1 MiB per document

/** The bundled class data, read straight out of the TypeScript file (it is a plain JSON array). */
function readBundledClasses() {
  const src = fs.readFileSync(path.join(root, SOURCE), 'utf8');
  const marker = 'export const INITIAL_ACADEMIC_DATA';
  const start = src.indexOf(marker);
  if (start < 0) fail(`ไม่พบ ${marker} ใน ${SOURCE}`);
  const from = src.indexOf('= [', start) + 2;
  const to = src.indexOf('\n];', from);
  if (to < 0) fail(`อ่านอาร์เรย์ ${marker} ไม่สำเร็จ`);
  return JSON.parse(src.slice(from, to + 2));
}

/** Firestore rejects undefined; fields that were never entered are simply left out. */
function withoutUndefined(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

function buildWrite(classes) {
  const scores = {};
  const evaluations = {};
  let cells = 0;
  let students = 0;
  for (const cls of classes) {
    for (const st of cls.students || []) {
      const entered = Object.entries(st.scores || {});
      if (entered.length) {
        scores[cls.classId] ??= {};
        scores[cls.classId][st.code] = Object.fromEntries(
          entered.map(([code, score]) => [code, withoutUndefined(score)]),
        );
        cells += entered.length;
      }
      const evaluation = withoutUndefined({
        traitResult: st.traitResult,
        readThinkResult: st.readThinkResult,
        activityResult: st.activityResult,
        activities: st.activities,
      });
      if (Object.keys(evaluation).length) {
        evaluations[cls.classId] ??= {};
        evaluations[cls.classId][st.code] = evaluation;
        students++;
      }
    }
  }
  return { scores, evaluations, cells, students };
}

const classes = readBundledClasses();
const { scores, evaluations, cells, students } = buildWrite(classes);
for (const cls of classes) {
  const perClass = Object.values(scores[cls.classId] || {}).reduce((n, s) => n + Object.keys(s).length, 0);
  console.log(`${cls.classId} ${cls.shortName}: ${(cls.students || []).length} คน, ${perClass} ช่องคะแนน`);
}
console.log(`รวม ${cells} ช่องคะแนน, ${students} คนมีผลการประเมิน`);

const payload = { scores, evaluations, updatedAt: Date.now(), migratedFrom: SOURCE };
const bytes = Buffer.byteLength(JSON.stringify(payload), 'utf8');
console.log(`ขนาดที่จะเขียน ~${(bytes / 1024).toFixed(1)} KiB (ลิมิตเอกสารละ ${FIRESTORE_DOC_LIMIT / 1024} KiB)`);
if (bytes > FIRESTORE_DOC_LIMIT * 0.9) fail('ข้อมูลใหญ่เกิน 90% ของลิมิตเอกสาร ต้องแยกเอกสารรายห้องก่อน');

const db = adminDb();
const ref = db.doc(DOC_PATH);
const before = await ref.get();
const existing = before.exists ? (before.data().scores || {}) : {};
const existingCells = Object.values(existing).reduce(
  (n, cls) => n + Object.values(cls).reduce((m, s) => m + Object.keys(s).length, 0), 0,
);
if (existingCells && !force) {
  fail(`${DOC_PATH} มีคะแนนอยู่แล้ว ${existingCells} ช่อง — ครูกรอกไปแล้ว ถ้าตั้งใจจะเติมของเก่าเข้าไปด้วยให้ใส่ --force`);
}
if (existingCells) console.log(`คำเตือน: เอกสารมีคะแนนอยู่แล้ว ${existingCells} ช่อง จะ merge โดยไม่ลบของเดิม`);

if (dryRun) {
  console.log('--dry-run: ไม่ได้เขียนอะไรลง Firestore');
  process.exit(0);
}

await ref.set(payload, { merge: true });

// Read back and confirm every cell landed
const after = (await ref.get()).data() || {};
let written = 0;
let mismatch = 0;
for (const [classId, byStudent] of Object.entries(scores)) {
  for (const [code, bySubject] of Object.entries(byStudent)) {
    for (const [subject, score] of Object.entries(bySubject)) {
      const live = after.scores?.[classId]?.[code]?.[subject];
      if (!live) { mismatch++; continue; }
      written++;
      if (live.total !== score.total || live.grade !== score.grade) mismatch++;
    }
  }
}
console.log(`เขียนแล้ว ${written}/${cells} ช่อง, ไม่ตรง ${mismatch} ช่อง`);
if (mismatch) fail('ข้อมูลที่อ่านกลับมาไม่ตรงกับต้นทาง');
console.log(`ย้ายคะแนนขึ้น ${DOC_PATH} เรียบร้อย`);
process.exit(0);
