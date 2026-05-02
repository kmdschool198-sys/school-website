// One-shot: read xls roster and upload to Firestore config/attendance_classes
const XLSX = require('xlsx');
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyDMQ21IocDvKkkgb-3HnHlz9OF4Nc-q7jk",
  authDomain: "web-site-kmd.firebaseapp.com",
  projectId: "web-site-kmd",
  storageBucket: "web-site-kmd.firebasestorage.app",
  messagingSenderId: "1084529861236",
  appId: "1:1084529861236:web:e05c9ba62099c9ff036721"
};

// Map sheet name -> {classId, label}. Use real room IDs from timetableData where available,
// synthetic IDs for kindergarten (which has no timetable rooms yet).
const CLASS_MAP = {
  'อ.2':  { classId: 'kg_a2_1',         label: 'อ.2/1' },
  'อ.3':  { classId: 'kg_a3_1',         label: 'อ.3/1' },
  'ป.1':  { classId: 'mnnbhd8om45cr',   label: 'ป.1/1' },
  'ป.2':  { classId: 'mnnbhd8ofiyyb',   label: 'ป.2/1' },
  'ป.3':  { classId: 'mnnbhd8onrgma',   label: 'ป.3/1' },
  'ป.4':  { classId: 'mnnbhd8on7ezz',   label: 'ป.4/1' },
  'ป.5':  { classId: 'mnnbhd8o4kr0l',   label: 'ป.5/1' },
  'ป.6':  { classId: 'mnnbhd8ofr96k',   label: 'ป.6/1' },
  'ม.1':  { classId: 'mnnbhd8of8yjf',   label: 'ม.1/1' },
  'ม.2':  { classId: 'mnnbhd8oqp1am',   label: 'ม.2/1' },
  'ม.3':  { classId: 'mnnbhd8o0bky9',   label: 'ม.3/1' },
};

const FILE = 'C:/Users/KruJames/Downloads/รายชื่อนักเรียน-บ้านคลองมดแดง-1-2569-22-เม.ย.2569-ไม่เป็นทางการ.xls';

function parseSheet(ws, classId) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  // Find header row containing "เลขที่"
  const hdr = rows.findIndex(r => r && r.some(c => String(c||'').includes('เลขที่')));
  if (hdr < 0) return [];
  const data = rows.slice(hdr + 1);
  const students = [];
  for (const r of data) {
    if (!r || r.length < 4) continue;
    const no = r[0];
    if (no == null || no === '') continue;
    const code = r[1] != null ? String(r[1]).trim() : '';
    const prefix = String(r[2] || '').trim();
    const fname = String(r[3] || '').trim();
    const lname = String(r[4] || '').trim();
    if (!fname && !lname) continue;
    const fullName = `${prefix}${fname} ${lname}`.trim();
    const isFemale = prefix.includes('หญิง');
    const emoji = isFemale ? '👧' : '👦';
    students.push({
      id: `${classId}_${code || 'n' + no}`,
      code,
      name: fullName,
      emoji,
    });
  }
  return students;
}

(async () => {
  const wb = XLSX.readFile(FILE);
  const classes = [];
  for (const [sheetName, meta] of Object.entries(CLASS_MAP)) {
    const ws = wb.Sheets[sheetName];
    if (!ws) { console.log('SKIP (no sheet):', sheetName); continue; }
    const students = parseSheet(ws, meta.classId);
    console.log(`${sheetName} -> ${meta.label} (${meta.classId}): ${students.length} students`);
    classes.push({ classId: meta.classId, label: meta.label, students });
  }
  const total = classes.reduce((s, c) => s + c.students.length, 0);
  console.log(`\nTOTAL: ${total} students across ${classes.length} classes`);

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  await setDoc(doc(db, 'config', 'attendance_classes'), { classes, updatedAt: Date.now() });
  console.log('✓ Uploaded to Firestore: config/attendance_classes');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
