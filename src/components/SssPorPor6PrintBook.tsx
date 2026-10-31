import { useState, useMemo } from 'react';
import {
  calculateStudentGPA,
  scoreScheme,
  type ClassAcademicData,
  type AcademicStudentRecord,
  type StudentSubjectScore,
} from '../data/academicData';
import { detailHasMarks, fitDetail, type SubjectPlan } from '../utils/assessment';
import { findStudentDetails, useStudentDetails } from '../data/studentDetails';
import { SCHOOL_NAME, SCHOOL_AFFILIATION } from '../config/siteLinks';
import { effectiveGrade } from '../data/academicData';

export type SssPp6SheetKey =
  | 'all_workbook'     // พิมพ์ครบทุกหน้าในไฟล์ ปพ6.xlsx (8 ชีตสรุปห้อง + ใบรายงานรายบุคคลทุกคน)
  | 'student_reports'  // เฉพาะใบรายงาน ปพ.6 รายบุคคล (เลขที่ 1..N ครบทั้งหน้าคะแนน + หน้าความเห็นครู/ผู้ปกครอง)
  | 'class_sheets_all' // เฉพาะ 8 ชีตสรุปประจำชั้น (ข้อมูลสถานศึกษา..สรุปผลสัมฤทธิ์ทางการเรียน)
  | 'school_info'      // 1. ข้อมูลสถานศึกษา
  | 'student_info'     // 2. ข้อมูลนักเรียน
  | 'subjects_list'    // 3. วิชาเรียน
  | 'term1_scores'     // 4. ระหว่างเรียน 1
  | 'term2_scores'     // 5. ระหว่างเรียน 2
  | 'exam_scores'      // 6. คะแนนสอบ
  | 'activities'       // 7. กิจกรรม
  | 'achievement';     // 8. สรุปผลสัมฤทธิ์ทางการเรียน

export const SSS_PP6_SHEET_TABS: Array<{ key: SssPp6SheetKey; label: string }> = [
  { key: 'student_reports', label: '📄 ใบรายงาน ปพ.6 รายบุคคล (เลขที่ 1–N ครบ 2 หน้า/คน)' },
  { key: 'all_workbook', label: '🗂️ พิมพ์ครบทุกชีตในไฟล์ ปพ6.xlsx (8 ชีตห้อง + รายบุคคล)' },
  { key: 'class_sheets_all', label: '📊 เฉพาะ 8 ชีตสรุปประจำชั้น' },
  { key: 'school_info', label: '1. ข้อมูลสถานศึกษา' },
  { key: 'student_info', label: '2. ข้อมูลนักเรียน' },
  { key: 'subjects_list', label: '3. วิชาเรียน' },
  { key: 'term1_scores', label: '4. ระหว่างเรียน 1' },
  { key: 'term2_scores', label: '5. ระหว่างเรียน 2' },
  { key: 'exam_scores', label: '6. คะแนนสอบ' },
  { key: 'activities', label: '7. กิจกรรม' },
  { key: 'achievement', label: '8. สรุปผลสัมฤทธิ์ทางการเรียน' },
];

function splitNameParts(fullName: string) {
  const prefixes = ['เด็กชาย', 'เด็กหญิง', 'ด.ช.', 'ด.ญ.', 'นาย', 'นางสาว', 'น.ส.'];
  let prefix = '';
  let rest = fullName.trim();
  for (const p of prefixes) {
    if (rest.startsWith(p)) {
      prefix = p;
      rest = rest.slice(p.length).trim();
      break;
    }
  }
  const parts = rest.split(/\s+/);
  return {
    prefix,
    firstName: parts[0] || rest,
    lastName: parts.slice(1).join(' ') || '',
  };
}

// Every number on these sheets is what a teacher recorded; anything not recorded prints "-".
type Num = number | null;
const dash = (v: Num | undefined) => (typeof v === 'number' ? (Number.isInteger(v) ? String(v) : v.toFixed(1)) : '-');
const sumOf = (xs: (number | null | undefined)[]) => xs.reduce<number>((n, x) => n + (Number(x) || 0), 0);

/**
 * ระหว่างเรียน 1 / 2 as recorded, never a split of the coursework total.
 * ประถม (graded by year): coursework of term 1 / term 2.
 * มัธยม: indicator marks before the midterm plus the midterm / after it, from the subject's plan.
 */
function courseworkHalf(half: 0 | 1, yearly: boolean, sc: StudentSubjectScore | undefined, plan: SubjectPlan | undefined): Num {
  if (!sc) return null;
  if (yearly) {
    const v = half === 0 ? sc.coursework : sc.term2Coursework;
    return typeof v === 'number' ? v : null;
  }
  const tp = plan?.[0];
  if (!tp || !sc.detail?.[0]) return null;
  const d = fitDetail(sc.detail[0], tp);
  if (!detailHasMarks(d)) return null;
  return half === 0 ? sumOf(d.before) + (d.midterm ?? 0) : sumOf(d.after);
}

function courseworkHalfFull(half: 0 | 1, yearly: boolean, courseworkMax: number, plan: SubjectPlan | undefined): Num {
  if (yearly) return courseworkMax;
  const tp = plan?.[0];
  if (!tp) return null;
  return half === 0 ? sumOf(tp.before) + tp.midterm : sumOf(tp.after);
}

const hasTerm2 = (sc: StudentSubjectScore | undefined) => sc?.term2Coursework !== undefined || sc?.term2FinalExam !== undefined;

/** สอบปลายภาค: มัธยม this semester; ประถม both terms once term 2 is in */
const examOf = (yearly: boolean, sc: StudentSubjectScore | undefined): Num => {
  if (!sc || typeof sc.finalExam !== 'number') return null;
  return yearly && hasTerm2(sc) ? sc.finalExam + (sc.term2FinalExam ?? 0) : sc.finalExam;
};

/** Row sums and ranks; a student missing any value gets neither, so ranks never rest on blanks */
function rowTotals(students: AcademicStudentRecord[], values: (st: AcademicStudentRecord) => Num[]) {
  const sums = students.map(st => {
    const vs = values(st);
    return { code: st.code, sum: vs.length && vs.every(v => typeof v === 'number') ? sumOf(vs) : null };
  });
  const complete = sums.flatMap(x => (x.sum === null ? [] : [x.sum])).sort((a, b) => b - a);
  const map: Record<string, { sum: Num; rank: Num }> = {};
  for (const x of sums) map[x.code] = { sum: x.sum, rank: x.sum === null ? null : complete.indexOf(x.sum) + 1 };
  return map;
}

const levelCode = (r: string | undefined) =>
  r === 'ดีเยี่ยม' ? '3 (ดีเยี่ยม)' : r === 'ดี' ? '2 (ดี)' : r === 'ผ่าน' ? '1 (ผ่าน)' : r === 'ไม่ผ่าน' ? '0 (ไม่ผ่าน)' : '-';
const markCode = (m: string | undefined) => (m === 'ผ' ? '2 (ผ่าน)' : m === 'มผ' ? '1 (ไม่ผ่าน)' : '-');

export default function SssPorPor6PrintBook({
  classData,
  targetStudents,
  ranksMap,
  plans,
  defaultSheet = 'student_reports',
}: {
  classData: ClassAcademicData;
  targetStudents: AcademicStudentRecord[];
  ranksMap: Record<string, { rank: number; total: number; gpa: number }>;
  /** full-mark plans of this class by subject code (SGS); มัธยม ระหว่างเรียน 1/2 come from them */
  plans?: Record<string, SubjectPlan>;
  defaultSheet?: SssPp6SheetKey;
}) {
  const scheme = scoreScheme(classData.level);
  const yearly = scheme.yearly;
  const half = (h: 0 | 1, st: AcademicStudentRecord, code: string) => courseworkHalf(h, yearly, st.scores[code], plans?.[code]);
  const halfFull = (h: 0 | 1, code: string) => courseworkHalfFull(h, yearly, scheme.courseworkMax, plans?.[code]);
  const anyTerm2 = classData.students.some(st => classData.subjects.some(sub => hasTerm2(st.scores[sub.code])));
  const examFull = yearly ? scheme.finalMax * (anyTerm2 ? 2 : 1) : scheme.finalMax;
  const fullsTotal = (fulls: Num[]) => (fulls.every(f => typeof f === 'number') ? sumOf(fulls) : null);
  const splits = (code: string) => yearly || !!plans?.[code]?.[0];
  const unsplit = classData.subjects.filter(sub => !splits(sub.code));
  // citizen ID, birth date and guardian come from Firestore (staff-only), never the JS bundle
  const studentDetails = useStudentDetails();
  const [sheet, setSheet] = useState<SssPp6SheetKey>(defaultSheet);
  const [includePage2Comment, setIncludePage2Comment] = useState<boolean>(true);

  const coreSubjects = useMemo(
    () => classData.subjects.filter(s => s.type === 'พื้นฐาน'),
    [classData.subjects]
  );
  const electiveSubjects = useMemo(
    () => classData.subjects.filter(s => s.type === 'เพิ่มเติม'),
    [classData.subjects]
  );

  // รวมและลำดับที่ของ ระหว่างเรียน 1, ระหว่างเรียน 2 และคะแนนสอบ (only students with every subject recorded)
  const termRanks = {
    t1: rowTotals(classData.students, st => classData.subjects.map(sub => half(0, st, sub.code))),
    t2: rowTotals(classData.students, st => classData.subjects.map(sub => half(1, st, sub.code))),
    ex: rowTotals(classData.students, st => classData.subjects.map(sub => examOf(yearly, st.scores[sub.code]))),
  };

  // แบ่งรายวิชาเป็นชุดละ 4 วิชาสำหรับชีต "สรุปผลสัมฤทธิ์ทางการเรียน" (เหมือน col_breaks ใน Excel)
  const subjectChunks = useMemo(() => {
    const chunks: Array<typeof classData.subjects> = [];
    for (let i = 0; i < classData.subjects.length; i += 4) {
      chunks.push(classData.subjects.slice(i, i + 4));
    }
    return chunks;
  }, [classData.subjects]);

  const showSchoolInfo = sheet === 'all_workbook' || sheet === 'class_sheets_all' || sheet === 'school_info';
  const showStudentInfo = sheet === 'all_workbook' || sheet === 'class_sheets_all' || sheet === 'student_info';
  const showSubjectsList = sheet === 'all_workbook' || sheet === 'class_sheets_all' || sheet === 'subjects_list';
  const showTerm1 = sheet === 'all_workbook' || sheet === 'class_sheets_all' || sheet === 'term1_scores';
  const showTerm2 = sheet === 'all_workbook' || sheet === 'class_sheets_all' || sheet === 'term2_scores';
  const showExam = sheet === 'all_workbook' || sheet === 'class_sheets_all' || sheet === 'exam_scores';
  const showActivities = sheet === 'all_workbook' || sheet === 'class_sheets_all' || sheet === 'activities';
  const showAchievement = sheet === 'all_workbook' || sheet === 'class_sheets_all' || sheet === 'achievement';
  const showStudentReports = sheet === 'all_workbook' || sheet === 'student_reports';

  return (
    <div>
      {/* แถบเลือกชีตของ SSS ปพ.6 (ซ่อนตอนสั่งปริ้น) */}
      <div
        className="no-print"
        style={{
          maxWidth: '210mm',
          margin: '0 auto 16px',
          background: '#1E293B',
          borderRadius: 12,
          padding: '12px 16px',
          color: '#FFFFFF',
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#93C5FD' }}>
            📑 เลือกชีตที่ต้องการพิมพ์ (ตรงตามไฟล์ต้นฉบับ SSS ปพ.5 - 6 \ ปพ6.xlsx ทุกหน้า):
          </div>
          {showStudentReports && (
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.76rem', fontWeight: 800, color: '#FDE047', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={includePage2Comment}
                onChange={e => setIncludePage2Comment(e.target.checked)}
              />
              พิมพ์แผ่นที่ 2 (ความคิดเห็นครูประจำชั้น & ผู้ปกครอง ระหว่างเรียน 1–2)
            </label>
          )}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {SSS_PP6_SHEET_TABS.map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setSheet(tab.key)}
              style={{
                padding: '6px 11px',
                borderRadius: 8,
                border: sheet === tab.key ? '1.5px solid #38BDF8' : '1px solid rgba(255,255,255,0.18)',
                background: sheet === tab.key ? '#0284C7' : 'rgba(255,255,255,0.08)',
                color: '#FFFFFF',
                fontWeight: 800,
                fontSize: '0.75rem',
                cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* =====================================================================
          ชีตที่ 1: ข้อมูลสถานศึกษา (ตรงตามชีต 'ข้อมูลสถานศึกษา' A1:L19)
          ===================================================================== */}
      {showSchoolInfo && (
        <div className="porpor6-sheet porpor6-page-break" style={sheetBoxStyle}>
          <div style={{ textAlign: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: '15pt', fontWeight: 900 }}>ผลการพัฒนาผู้เรียน สำหรับครูประจำชั้น (ข้อมูลสถานศึกษา ปพ.6)</div>
            <div style={{ fontSize: '12pt', fontWeight: 800 }}>{SCHOOL_NAME} · {SCHOOL_AFFILIATION}</div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1.5px solid #000', fontSize: '10.5pt' }}>
            <thead>
              <tr style={{ background: '#F8FAFC' }}>
                <th style={{ ...cellTh, width: '36%' }}>หัวข้อข้อมูลสถานศึกษา</th>
                <th style={{ ...cellTh, width: '64%' }}>ข้อมูลที่เชื่อมโยงเข้าแบบรายงาน ปพ.6 ทุกหน้า</th>
              </tr>
            </thead>
            <tbody>
              <tr><td style={{ ...cellTd, fontWeight: 800 }}>สถานศึกษา</td><td style={{ ...cellTd, fontWeight: 800 }}>{SCHOOL_NAME}</td></tr>
              <tr><td style={{ ...cellTd, fontWeight: 800 }}>สำนักงาน</td><td style={cellTd}>{SCHOOL_AFFILIATION}</td></tr>
              <tr><td style={{ ...cellTd, fontWeight: 800 }}>ปีการศึกษา</td><td style={{ ...cellTd, fontWeight: 800 }}>ปีการศึกษา {classData.year}</td></tr>
              <tr><td style={{ ...cellTd, fontWeight: 800 }}>ระหว่างเรียน (ภาคเรียนที่ 1)</td><td style={cellTd}>ผลการพัฒนาผู้เรียน ระหว่างเรียน 1</td></tr>
              <tr><td style={{ ...cellTd, fontWeight: 800 }}>ระหว่างเรียน (ภาคเรียนที่ 2)</td><td style={cellTd}>ผลการพัฒนาผู้เรียน ระหว่างเรียน 2</td></tr>
              <tr><td style={{ ...cellTd, fontWeight: 800 }}>ระดับชั้น</td><td style={{ ...cellTd, fontWeight: 800 }}>ชั้น{classData.className} ({classData.shortName}/{classData.room})</td></tr>
              <tr><td style={{ ...cellTd, fontWeight: 800 }}>ชื่อครูประจำชั้น ระหว่างเรียน 1</td><td style={{ ...cellTd, fontWeight: 800 }}>{classData.homeroomTeachers.join(' / ')}</td></tr>
              <tr><td style={{ ...cellTd, fontWeight: 800 }}>ชื่อครูประจำชั้น ระหว่างเรียน 2</td><td style={{ ...cellTd, fontWeight: 800 }}>{classData.homeroomTeachers.join(' / ')}</td></tr>
              <tr><td style={{ ...cellTd, fontWeight: 800 }}>ผู้บริหาร ระหว่างเรียน 1</td><td style={{ ...cellTd, fontWeight: 800 }}>{classData.director}</td></tr>
              <tr><td style={{ ...cellTd, fontWeight: 800 }}>ผู้บริหาร ระหว่างเรียน 2</td><td style={{ ...cellTd, fontWeight: 800 }}>{classData.director}</td></tr>
              <tr><td style={{ ...cellTd, fontWeight: 800 }}>ตำแหน่งผู้บริหาร</td><td style={cellTd}>ผู้อำนวยการ{SCHOOL_NAME}</td></tr>
              <tr><td style={{ ...cellTd, fontWeight: 800 }}>วันอนุมัติระหว่างเรียน 1</td><td style={cellTd}>15 ตุลาคม พ.ศ. {classData.year}</td></tr>
              <tr><td style={{ ...cellTd, fontWeight: 800 }}>วันอนุมัติระหว่างเรียน 2</td><td style={cellTd}>31 มีนาคม พ.ศ. {Number(classData.year) + 1}</td></tr>
              <tr><td style={{ ...cellTd, fontWeight: 800 }}>หัวกระดาษ</td><td style={cellTd}>ผลสัมฤทธิ์ทางการเรียนของนักเรียนปีการศึกษา {classData.year}</td></tr>
              <tr><td style={{ ...cellTd, fontWeight: 800 }}>จำนวนนักเรียนระหว่างเรียน 1</td><td style={{ ...cellTd, fontWeight: 800 }}>{classData.students.length} คน</td></tr>
              <tr><td style={{ ...cellTd, fontWeight: 800 }}>จำนวนนักเรียนระหว่างเรียน 2</td><td style={{ ...cellTd, fontWeight: 800 }}>{classData.students.length} คน</td></tr>
            </tbody>
          </table>
        </div>
      )}

      {/* =====================================================================
          ชีตที่ 2: ข้อมูลนักเรียน (ตรงตามชีต 'ข้อมูลนักเรียน' A1:G54)
          ===================================================================== */}
      {showStudentInfo && (
        <div className="porpor6-sheet porpor6-page-break" style={sheetBoxStyle}>
          <div style={{ textAlign: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: '13.5pt', fontWeight: 900 }}>{SCHOOL_NAME}</div>
            <div style={{ fontSize: '10.5pt', fontWeight: 700 }}>{SCHOOL_AFFILIATION}</div>
            <div style={{ fontSize: '11.5pt', fontWeight: 800 }}>
              ข้อมูลนักเรียน ชั้น{classData.className} ({classData.shortName}/{classData.room}) · ปีการศึกษา {classData.year}
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1.5px solid #000', fontSize: '9.5pt' }}>
            <thead>
              <tr style={{ background: '#F8FAFC' }}>
                <th style={{ ...cellTh, width: '7%' }}>เลขที่</th>
                <th style={{ ...cellTh, width: '14%' }}>เลขประจำตัวนักเรียน</th>
                <th style={{ ...cellTh, width: '21%' }}>เลขประจำตัวประชาชน</th>
                <th style={{ ...cellTh, width: '13%' }}>คำนำหน้า</th>
                <th style={{ ...cellTh, width: '16%' }}>ชื่อ</th>
                <th style={{ ...cellTh, width: '16%' }}>ชื่อสกุล</th>
                <th style={{ ...cellTh, width: '13%' }}>วันเดือนปีเกิด</th>
              </tr>
            </thead>
            <tbody>
              {classData.students.map(st => {
                const bio = findStudentDetails(studentDetails, st.code, st.name);
                const np = splitNameParts(st.name);
                return (
                  <tr key={st.code}>
                    <td style={{ ...cellTd, textAlign: 'center', fontWeight: 800 }}>{st.no}</td>
                    <td style={{ ...cellTd, textAlign: 'center', fontWeight: 700 }}>{st.code}</td>
                    <td style={{ ...cellTd, textAlign: 'center' }}>{bio?.citizenId || '-'}</td>
                    <td style={{ ...cellTd, textAlign: 'center' }}>{np.prefix}</td>
                    <td style={cellTd}>{np.firstName}</td>
                    <td style={cellTd}>{np.lastName}</td>
                    <td style={{ ...cellTd, textAlign: 'center' }}>{bio?.birthDate || '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* =====================================================================
          ชีตที่ 3: วิชาเรียน (ตรงตามชีต 'วิชาเรียน' A1:F24)
          ===================================================================== */}
      {showSubjectsList && (
        <div className="porpor6-sheet porpor6-page-break" style={sheetBoxStyle}>
          <div style={{ textAlign: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: '14pt', fontWeight: 900 }}>รายวิชาที่เปิดสอน (ชีตวิชาเรียน ปพ.6)</div>
            <div style={{ fontSize: '11pt', fontWeight: 800 }}>
              ชั้น{classData.className} ({classData.shortName}/{classData.room}) · ปีการศึกษา {classData.year} · {SCHOOL_NAME}
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1.5px solid #000', fontSize: '10pt' }}>
            <thead>
              <tr style={{ background: '#F8FAFC' }}>
                <th style={{ ...cellTh, width: '8%' }}>ที่</th>
                <th style={{ ...cellTh, width: '15%' }}>รหัสวิชา</th>
                <th style={{ ...cellTh, width: '32%' }}>วิชาเต็ม</th>
                <th style={{ ...cellTh, width: '19%' }}>ชื่อวิชาย่อ / ประเภท</th>
                <th style={{ ...cellTh, width: '13%' }}>น้ำหนักคะแนน<br />(ชั่วโมง)</th>
                <th style={{ ...cellTh, width: '13%' }}>หน่วยกิต</th>
              </tr>
            </thead>
            <tbody>
              {classData.subjects.map((subj, idx) => (
                <tr key={subj.code}>
                  <td style={{ ...cellTd, textAlign: 'center', fontWeight: 800 }}>{idx + 1}</td>
                  <td style={{ ...cellTd, textAlign: 'center', fontWeight: 800 }}>{subj.code}</td>
                  <td style={{ ...cellTd, fontWeight: 700 }}>{subj.name}</td>
                  <td style={{ ...cellTd, textAlign: 'center' }}>รายวิชา{subj.type}</td>
                  <td style={{ ...cellTd, textAlign: 'center', fontWeight: 800 }}>{subj.hours}</td>
                  <td style={{ ...cellTd, textAlign: 'center', fontWeight: 800 }}>{subj.credits.toFixed(1)}</td>
                </tr>
              ))}
              <tr>
                <td style={{ ...cellTd, textAlign: 'center', fontWeight: 800 }}>{classData.subjects.length + 1}</td>
                <td style={{ ...cellTd, textAlign: 'center', fontWeight: 800 }}>
                  {classData.level === 'มัธยม' ? 'ก21101' : 'ก11101'}
                </td>
                <td style={{ ...cellTd, fontWeight: 700 }}>กิจกรรมพัฒนาผู้เรียน (แนะแนว / ลูกเสือ / ชุมนุม / เพื่อสังคมฯ)</td>
                <td style={{ ...cellTd, textAlign: 'center' }}>กิจกรรมเพิ่มเติม</td>
                <td style={{ ...cellTd, textAlign: 'center', fontWeight: 800 }}>120</td>
                <td style={{ ...cellTd, textAlign: 'center' }}>-</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* =====================================================================
          ชีตที่ 4: ระหว่างเรียน 1 (ตรงตามชีต 'ระหว่างเรียน 1' A1:AB54)
          ===================================================================== */}
      {showTerm1 && (
        <div className="porpor6-sheet porpor6-page-break" style={sheetBoxStyle}>
          <div style={{ textAlign: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: '12.5pt', fontWeight: 900 }}>{SCHOOL_NAME} · {SCHOOL_AFFILIATION}</div>
            <div style={{ fontSize: '11pt', fontWeight: 900 }}>
              ผลการพัฒนาผู้เรียน ระหว่างเรียน 1 — ชั้น{classData.className} ({classData.shortName}/{classData.room}) &nbsp;|&nbsp; ครูประจำชั้น: {classData.homeroomTeachers.join(' / ')}
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1.5px solid #000', fontSize: '7.5pt' }}>
            <thead>
              <tr style={{ background: '#F8FAFC' }}>
                <th style={{ ...cellTh, width: '3.5%' }}>เลขที่</th>
                <th style={{ ...cellTh, width: '6%' }}>เลข<br />ประจำตัว</th>
                <th style={{ ...cellTh, width: '6%' }}>คำนำหน้า</th>
                <th style={{ ...cellTh, width: '9%' }}>ชื่อ</th>
                <th style={{ ...cellTh, width: '9.5%' }}>นามสกุล</th>
                {classData.subjects.map(s => (
                  <th key={s.code} style={{ ...cellTh, fontSize: '6.8pt', padding: '2px 1px' }}>
                    {s.code}<br />{s.name.slice(0, 8)}
                  </th>
                ))}
                <th style={{ ...cellTh, width: '5%' }}>รวม</th>
                <th style={{ ...cellTh, width: '4.5%' }}>ลำดับที่</th>
              </tr>
              <tr style={{ background: '#F1F5F9' }}>
                <th colSpan={5} style={{ ...cellTh, textAlign: 'right', paddingRight: 6 }}>คะแนนเต็มระหว่างเรียน 1</th>
                {classData.subjects.map(s => (
                  <th key={s.code} style={cellTh}>{dash(halfFull(0, s.code))}</th>
                ))}
                <th style={cellTh}>{dash(fullsTotal(classData.subjects.map(s => halfFull(0, s.code))))}</th>
                <th style={cellTh}>-</th>
              </tr>
            </thead>
            <tbody>
              {classData.students.map(st => {
                const np = splitNameParts(st.name);
                const tr = termRanks.t1[st.code];
                return (
                  <tr key={st.code}>
                    <td style={{ ...cellTd, textAlign: 'center' }}>{st.no}</td>
                    <td style={{ ...cellTd, textAlign: 'center' }}>{st.code}</td>
                    <td style={{ ...cellTd, textAlign: 'center' }}>{np.prefix}</td>
                    <td style={cellTd}>{np.firstName}</td>
                    <td style={cellTd}>{np.lastName}</td>
                    {classData.subjects.map(s => (
                      <td key={s.code} style={{ ...cellTd, textAlign: 'center' }}>{dash(half(0, st, s.code))}</td>
                    ))}
                    <td style={{ ...cellTd, textAlign: 'center', fontWeight: 900, background: '#F8FAFC' }}>{dash(tr?.sum)}</td>
                    <td style={{ ...cellTd, textAlign: 'center', fontWeight: 800 }}>{dash(tr?.rank)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {unsplit.length > 0 && (
            <div style={{ fontSize: '8.5pt', marginTop: 4 }}>
              "-" = ยังไม่ได้บันทึกคะแนนแยกก่อน/หลังกลางภาค ({unsplit.map(sub => sub.code).join(', ')}) — ตั้งคะแนนเต็มรายตัวชี้วัดและกรอกใน ปพ.5 ก่อน · คะแนนระหว่างภาครวมดูได้ในชีตสรุปผลสัมฤทธิ์ทางการเรียน
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          ชีตที่ 5: ระหว่างเรียน 2 (ตรงตามชีต 'ระหว่างเรียน 2' A1:AB54)
          ===================================================================== */}
      {showTerm2 && (
        <div className="porpor6-sheet porpor6-page-break" style={sheetBoxStyle}>
          <div style={{ textAlign: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: '12.5pt', fontWeight: 900 }}>{SCHOOL_NAME} · {SCHOOL_AFFILIATION}</div>
            <div style={{ fontSize: '11pt', fontWeight: 900 }}>
              ผลการพัฒนาผู้เรียน ระหว่างเรียน 2 — ชั้น{classData.className} ({classData.shortName}/{classData.room}) &nbsp;|&nbsp; ครูประจำชั้น: {classData.homeroomTeachers.join(' / ')}
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1.5px solid #000', fontSize: '7.5pt' }}>
            <thead>
              <tr style={{ background: '#F8FAFC' }}>
                <th style={{ ...cellTh, width: '3.5%' }}>เลขที่</th>
                <th style={{ ...cellTh, width: '6%' }}>เลข<br />ประจำตัว</th>
                <th style={{ ...cellTh, width: '6%' }}>คำนำหน้า</th>
                <th style={{ ...cellTh, width: '9%' }}>ชื่อ</th>
                <th style={{ ...cellTh, width: '9.5%' }}>นามสกุล</th>
                {classData.subjects.map(s => (
                  <th key={s.code} style={{ ...cellTh, fontSize: '6.8pt', padding: '2px 1px' }}>
                    {s.code}<br />{s.name.slice(0, 8)}
                  </th>
                ))}
                <th style={{ ...cellTh, width: '5%' }}>รวม</th>
                <th style={{ ...cellTh, width: '4.5%' }}>ลำดับที่</th>
              </tr>
              <tr style={{ background: '#F1F5F9' }}>
                <th colSpan={5} style={{ ...cellTh, textAlign: 'right', paddingRight: 6 }}>คะแนนเต็มระหว่างเรียน 2</th>
                {classData.subjects.map(s => (
                  <th key={s.code} style={cellTh}>{dash(halfFull(1, s.code))}</th>
                ))}
                <th style={cellTh}>{dash(fullsTotal(classData.subjects.map(s => halfFull(1, s.code))))}</th>
                <th style={cellTh}>-</th>
              </tr>
            </thead>
            <tbody>
              {classData.students.map(st => {
                const np = splitNameParts(st.name);
                const tr = termRanks.t2[st.code];
                return (
                  <tr key={st.code}>
                    <td style={{ ...cellTd, textAlign: 'center' }}>{st.no}</td>
                    <td style={{ ...cellTd, textAlign: 'center' }}>{st.code}</td>
                    <td style={{ ...cellTd, textAlign: 'center' }}>{np.prefix}</td>
                    <td style={cellTd}>{np.firstName}</td>
                    <td style={cellTd}>{np.lastName}</td>
                    {classData.subjects.map(s => (
                      <td key={s.code} style={{ ...cellTd, textAlign: 'center' }}>{dash(half(1, st, s.code))}</td>
                    ))}
                    <td style={{ ...cellTd, textAlign: 'center', fontWeight: 900, background: '#F8FAFC' }}>{dash(tr?.sum)}</td>
                    <td style={{ ...cellTd, textAlign: 'center', fontWeight: 800 }}>{dash(tr?.rank)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {unsplit.length > 0 && (
            <div style={{ fontSize: '8.5pt', marginTop: 4 }}>
              "-" = ยังไม่ได้บันทึกคะแนนแยกก่อน/หลังกลางภาค ({unsplit.map(sub => sub.code).join(', ')}) — ตั้งคะแนนเต็มรายตัวชี้วัดและกรอกใน ปพ.5 ก่อน · คะแนนระหว่างภาครวมดูได้ในชีตสรุปผลสัมฤทธิ์ทางการเรียน
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          ชีตที่ 6: คะแนนสอบ (ตรงตามชีต 'คะแนนสอบ' A1:AB54)
          ===================================================================== */}
      {showExam && (
        <div className="porpor6-sheet porpor6-page-break" style={sheetBoxStyle}>
          <div style={{ textAlign: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: '12.5pt', fontWeight: 900 }}>{SCHOOL_NAME} · {SCHOOL_AFFILIATION}</div>
            <div style={{ fontSize: '11pt', fontWeight: 900 }}>
              ผลคะแนนสอบปลายภาค — ชั้น{classData.className} ({classData.shortName}/{classData.room}) &nbsp;|&nbsp; ครูประจำชั้น: {classData.homeroomTeachers.join(' / ')}
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1.5px solid #000', fontSize: '7.5pt' }}>
            <thead>
              <tr style={{ background: '#F8FAFC' }}>
                <th style={{ ...cellTh, width: '3.5%' }}>เลขที่</th>
                <th style={{ ...cellTh, width: '6%' }}>เลข<br />ประจำตัว</th>
                <th style={{ ...cellTh, width: '6%' }}>คำนำหน้า</th>
                <th style={{ ...cellTh, width: '9%' }}>ชื่อ</th>
                <th style={{ ...cellTh, width: '9.5%' }}>นามสกุล</th>
                {classData.subjects.map(s => (
                  <th key={s.code} style={{ ...cellTh, fontSize: '6.8pt', padding: '2px 1px' }}>
                    {s.code}<br />{s.name.slice(0, 8)}
                  </th>
                ))}
                <th style={{ ...cellTh, width: '5%' }}>รวม</th>
                <th style={{ ...cellTh, width: '4.5%' }}>ลำดับที่</th>
              </tr>
              <tr style={{ background: '#F1F5F9' }}>
                <th colSpan={5} style={{ ...cellTh, textAlign: 'right', paddingRight: 6 }}>คะแนนเต็มสอบปลายภาค</th>
                {classData.subjects.map(s => (
                  <th key={s.code} style={cellTh}>{examFull}</th>
                ))}
                <th style={cellTh}>{classData.subjects.length * examFull}</th>
                <th style={cellTh}>-</th>
              </tr>
            </thead>
            <tbody>
              {classData.students.map(st => {
                const np = splitNameParts(st.name);
                const tr = termRanks.ex[st.code];
                return (
                  <tr key={st.code}>
                    <td style={{ ...cellTd, textAlign: 'center' }}>{st.no}</td>
                    <td style={{ ...cellTd, textAlign: 'center' }}>{st.code}</td>
                    <td style={{ ...cellTd, textAlign: 'center' }}>{np.prefix}</td>
                    <td style={cellTd}>{np.firstName}</td>
                    <td style={cellTd}>{np.lastName}</td>
                    {classData.subjects.map(s => (
                      <td key={s.code} style={{ ...cellTd, textAlign: 'center' }}>
                        {dash(examOf(yearly, st.scores[s.code]))}
                      </td>
                    ))}
                    <td style={{ ...cellTd, textAlign: 'center', fontWeight: 900, background: '#F8FAFC' }}>{dash(tr?.sum)}</td>
                    <td style={{ ...cellTd, textAlign: 'center', fontWeight: 800 }}>{dash(tr?.rank)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* =====================================================================
          ชีตที่ 7: กิจกรรม (ตรงตามชีต 'กิจกรรม' A1:L57)
          ===================================================================== */}
      {showActivities && (
        <div className="porpor6-sheet porpor6-page-break" style={sheetBoxStyle}>
          <div style={{ textAlign: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: '13pt', fontWeight: 900 }}>ผลการพัฒนาผู้เรียน สำหรับครูประจำชั้น (ชีตกิจกรรม)</div>
            <div style={{ fontSize: '10.5pt', fontWeight: 800 }}>
              {SCHOOL_NAME} · {SCHOOL_AFFILIATION} · ชั้น{classData.className} ({classData.shortName}/{classData.room})
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1.5px solid #000', fontSize: '8.5pt', marginBottom: 10 }}>
            <thead>
              <tr style={{ background: '#F8FAFC' }}>
                <th rowSpan={2} style={{ ...cellTh, width: '5%' }}>เลขที่</th>
                <th rowSpan={2} style={{ ...cellTh, width: '9%' }}>เลขประจำตัว</th>
                <th rowSpan={2} style={{ ...cellTh, width: '9%' }}>คำนำหน้า</th>
                <th rowSpan={2} style={{ ...cellTh, width: '13%' }}>ชื่อ</th>
                <th rowSpan={2} style={{ ...cellTh, width: '14%' }}>นามสกุล</th>
                <th colSpan={4} style={cellTh}>กิจกรรมพัฒนาผู้เรียน (2=ผ่าน, 1=ไม่ผ่าน)</th>
                <th rowSpan={2} style={{ ...cellTh, width: '10%' }}>การอ่าน คิดวิเคราะห์<br />และเขียนสื่อความ</th>
                <th rowSpan={2} style={{ ...cellTh, width: '9%' }}>คุณลักษณะ<br />อันพึงประสงค์</th>
                <th rowSpan={2} style={{ ...cellTh, width: '9%' }}>สมรรถนะสำคัญ<br />ของผู้เรียน</th>
              </tr>
              <tr style={{ background: '#F8FAFC' }}>
                <th style={{ ...cellTh, width: '5.5%' }}>กิจกรรม<br />แนะแนว</th>
                <th style={{ ...cellTh, width: '5.5%' }}>ลูกเสือ/<br />ยุวกาชาด</th>
                <th style={{ ...cellTh, width: '5.5%' }}>ชมรม/<br />ชุมนุม</th>
                <th style={{ ...cellTh, width: '5.5%' }}>เพื่อสังคมฯ</th>
              </tr>
            </thead>
            <tbody>
              {classData.students.map(st => {
                const np = splitNameParts(st.name);
                const actCode = (i: number) => markCode(st.activities?.[classData.activities[i]?.code]);
                return (
                  <tr key={st.code}>
                    <td style={{ ...cellTd, textAlign: 'center' }}>{st.no}</td>
                    <td style={{ ...cellTd, textAlign: 'center' }}>{st.code}</td>
                    <td style={{ ...cellTd, textAlign: 'center' }}>{np.prefix}</td>
                    <td style={cellTd}>{np.firstName}</td>
                    <td style={cellTd}>{np.lastName}</td>
                    {[0, 1, 2, 3].map(i => (
                      <td key={i} style={{ ...cellTd, textAlign: 'center', fontWeight: 700 }}>{actCode(i)}</td>
                    ))}
                    <td style={{ ...cellTd, textAlign: 'center', fontWeight: 800 }}>{levelCode(st.readThinkResult)}</td>
                    <td style={{ ...cellTd, textAlign: 'center', fontWeight: 800 }}>{levelCode(st.traitResult)}</td>
                    <td style={{ ...cellTd, textAlign: 'center', fontWeight: 800 }}>-</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div style={{ border: '1px solid #000', padding: '6px 10px', fontSize: '8.5pt', lineHeight: 1.45, background: '#F8FAFC' }}>
            <b>คำแนะนำการกรอกข้อมูล (ตามแบบฟอร์ม SSS ปพ.6):</b> กิจกรรมแนะแนว / ลูกเสือ-ยุวกาชาด / ชมรม-ชุมนุม / กิจกรรมเพื่อสังคมฯ: <b>1 = ไม่ผ่าน, 2 = ผ่าน</b> &nbsp;|&nbsp;
            การอ่าน คิดวิเคราะห์ และเขียนสื่อความ / คุณลักษณะอันพึงประสงค์ / สมรรถนะสำคัญของผู้เรียน: <b>0 = ไม่ผ่าน, 1 = ผ่าน, 2 = ดี, 3 = ดีเยี่ยม</b> &nbsp;|&nbsp; <b>"-" = ยังไม่ได้บันทึก</b>
          </div>
        </div>
      )}

      {/* =====================================================================
          ชีตที่ 8: สรุปผลสัมฤทธิ์ทางการเรียน (ตรงตามชีต 'สรุปผลสัมฤทธิ์ทางการเรียน' แยกกลุ่มวิชาละ 4 วิชาต่อหน้า)
          ===================================================================== */}
      {showAchievement && subjectChunks.map((chunk, chunkIdx) => {
        const isLastChunk = chunkIdx === subjectChunks.length - 1;
        return (
          <div key={chunkIdx} className="porpor6-sheet porpor6-page-break" style={sheetBoxStyle}>
            <div style={{ textAlign: 'center', marginBottom: 6 }}>
              <div style={{ fontSize: '12.5pt', fontWeight: 900 }}>{SCHOOL_NAME} · {SCHOOL_AFFILIATION}</div>
              <div style={{ fontSize: '10.5pt', fontWeight: 900 }}>
                ผลสัมฤทธิ์ทางการเรียนของนักเรียนปีการศึกษา {classData.year} (แผ่นที่ {chunkIdx + 1}/{subjectChunks.length})
              </div>
              <div style={{ fontSize: '9.5pt', fontWeight: 800 }}>
                ชั้น{classData.className} ({classData.shortName}/{classData.room}) &nbsp;|&nbsp; ครูประจำชั้น: {classData.homeroomTeachers.join(' / ')}
              </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1.5px solid #000', fontSize: '7pt' }}>
              <thead>
                <tr style={{ background: '#F8FAFC' }}>
                  <th rowSpan={3} style={{ ...cellTh, width: '3%' }}>เลขที่</th>
                  <th rowSpan={3} style={{ ...cellTh, width: '5.5%' }}>เลข<br />ประจำตัว</th>
                  <th rowSpan={3} style={{ ...cellTh, width: '15.5%' }}>ชื่อ - สกุล</th>
                  {chunk.map(s => (
                    <th key={s.code} colSpan={5} style={cellTh}>
                      {s.code} {s.name} ({s.credits} นก.)
                    </th>
                  ))}
                  {isLastChunk && (
                    <th rowSpan={3} style={{ ...cellTh, width: '5%' }}>เกรดเฉลี่ย<br />(GPA)</th>
                  )}
                </tr>
                <tr style={{ background: '#F8FAFC' }}>
                  {chunk.map(s => [
                    ...(splits(s.code)
                      ? [<th key={`${s.code}_1`} style={cellTh}>ระหว่าง 1</th>, <th key={`${s.code}_2`} style={cellTh}>ระหว่าง 2</th>]
                      : [<th key={`${s.code}_12`} colSpan={2} style={cellTh}>ระหว่างภาค</th>]),
                    <th key={`${s.code}_ex`} style={cellTh}>สอบ</th>,
                    <th key={`${s.code}_tot`} style={cellTh}>รวม</th>,
                    <th key={`${s.code}_gr`} style={cellTh}>เกรด</th>,
                  ])}
                </tr>
                <tr style={{ background: '#F1F5F9' }}>
                  {chunk.map(s => [
                    ...(splits(s.code)
                      ? [<th key={`${s.code}_m1`} style={cellTh}>{dash(halfFull(0, s.code))}</th>, <th key={`${s.code}_m2`} style={cellTh}>{dash(halfFull(1, s.code))}</th>]
                      : [<th key={`${s.code}_m12`} colSpan={2} style={cellTh}>{scheme.courseworkMax}</th>]),
                    <th key={`${s.code}_mex`} style={cellTh}>{examFull}</th>,
                    <th key={`${s.code}_mtot`} style={cellTh}>{yearly && !anyTerm2 ? 50 : 100}</th>,
                    <th key={`${s.code}_mgr`} style={cellTh}>4.0</th>,
                  ])}
                </tr>
              </thead>
              <tbody>
                {classData.students.map(st => {
                  const gpaStats = calculateStudentGPA(st, classData.subjects, true);
                  return (
                    <tr key={st.code}>
                      <td style={{ ...cellTd, textAlign: 'center' }}>{st.no}</td>
                      <td style={{ ...cellTd, textAlign: 'center' }}>{st.code}</td>
                      <td style={cellTd}>{st.name}</td>
                      {chunk.map(s => {
                        const sc = st.scores[s.code];
                        return [
                          ...(splits(s.code)
                            ? [
                              <td key={`${s.code}_v1`} style={{ ...cellTd, textAlign: 'center' }}>{dash(half(0, st, s.code))}</td>,
                              <td key={`${s.code}_v2`} style={{ ...cellTd, textAlign: 'center' }}>{dash(half(1, st, s.code))}</td>,
                            ]
                            : [<td key={`${s.code}_v12`} colSpan={2} style={{ ...cellTd, textAlign: 'center' }}>{dash(sc?.coursework)}</td>]),
                          <td key={`${s.code}_vex`} style={{ ...cellTd, textAlign: 'center' }}>{dash(examOf(yearly, sc))}</td>,
                          <td key={`${s.code}_vtot`} style={{ ...cellTd, textAlign: 'center', fontWeight: 700, background: '#F8FAFC' }}>{dash(sc?.total)}</td>,
                          <td key={`${s.code}_vgr`} style={{ ...cellTd, textAlign: 'center', fontWeight: 900 }}>{effectiveGrade(sc) || '-'}</td>,
                        ];
                      })}
                      {isLastChunk && (
                        <td style={{ ...cellTd, textAlign: 'center', fontWeight: 900, background: '#F0F9FF' }}>
                          {gpaStats.gpaFormatted}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}

      {/* =====================================================================
          ชีตที่ 9: ใบรายงาน ปพ.6 รายบุคคล (เลขที่ 1 – เลขที่ N)
          ตรงตามชีต 'เลขที่ 1' .. 'เลขที่ 40' ใน SSS ปพ.5 - 6\ปพ6.xlsx ทุกช่อง!
          ประกอบด้วย:
          - แผ่นที่ 1 (Cols A-S): ตารางคะแนน (ระหว่างเรียน 1, ระหว่างเรียน 2, คะแนนสอบ, คะแนนรวม, ระดับผลการเรียน) + กิจกรรมพัฒนาผู้เรียน 4 กิจกรรม + อ่านคิดวิเคราะห์ / คุณลักษณะ / สมรรถนะสำคัญ + ชื่อครูประจำชั้น / ผู้อำนวยการโรงเรียน
          - แผ่นที่ 2 (Cols U-AK): ความคิดเห็นของครูประจำชั้น (ระหว่างเรียน 1 / 2) + ความคิดเห็นของผู้ปกครอง (ระหว่างเรียน 1 / 2)
          ===================================================================== */}
      {showStudentReports && targetStudents.map((student, idx) => {
        const bio = findStudentDetails(studentDetails, student.code, student.name);
        const gpaStats = calculateStudentGPA(student, classData.subjects, true);
        const rankInfo = ranksMap[student.code] || { rank: idx + 1, total: classData.students.length, gpa: gpaStats.gpa };
        const isLastStudent = idx === targetStudents.length - 1;
        const actResult = student.activityResult;
        const reportSubjectRow = (subj: (typeof classData.subjects)[number]) => {
          const sc = student.scores[subj.code];
          const t2 = hasTerm2(sc);
          return (
            <tr key={subj.code}>
              <td style={{ ...cellTd, textAlign: 'center', fontWeight: 700 }}>{subj.code}</td>
              <td style={cellTd}>{subj.name}</td>
              <td style={{ ...cellTd, textAlign: 'center' }}>{subj.hours}</td>
              {splits(subj.code) ? (
                <>
                  <td style={{ ...cellTd, textAlign: 'center', color: '#475569' }}>{dash(halfFull(0, subj.code))}</td>
                  <td style={{ ...cellTd, textAlign: 'center', fontWeight: 700 }}>{dash(half(0, student, subj.code))}</td>
                  <td style={{ ...cellTd, textAlign: 'center', color: '#475569' }}>{dash(halfFull(1, subj.code))}</td>
                  <td style={{ ...cellTd, textAlign: 'center', fontWeight: 700 }}>{dash(half(1, student, subj.code))}</td>
                </>
              ) : (
                <td colSpan={4} style={{ ...cellTd, textAlign: 'center' }}>
                  ระหว่างภาค <b>{dash(sc?.coursework)}</b> / {scheme.courseworkMax}
                </td>
              )}
              <td style={{ ...cellTd, textAlign: 'center', color: '#475569' }}>{yearly ? scheme.finalMax * (t2 ? 2 : 1) : scheme.finalMax}</td>
              <td style={{ ...cellTd, textAlign: 'center', fontWeight: 700 }}>{dash(examOf(yearly, sc))}</td>
              <td style={{ ...cellTd, textAlign: 'center', color: '#475569' }}>{yearly && !t2 ? 50 : 100}</td>
              <td style={{ ...cellTd, textAlign: 'center', fontWeight: 800, background: '#F8FAFC' }}>{dash(sc?.total)}</td>
              <td style={{ ...cellTd, textAlign: 'center', fontWeight: 900 }}>{effectiveGrade(sc) || '-'}</td>
            </tr>
          );
        };

        const chk = (cond: boolean) => (
          <span style={{
            display: 'inline-block',
            width: 14,
            height: 14,
            border: '1.2px solid #000',
            textAlign: 'center',
            lineHeight: '13px',
            fontWeight: 900,
            fontSize: '9pt',
            marginRight: 4,
          }}>
            {cond ? '✓' : '\u00A0'}
          </span>
        );

        return (
          <div key={student.code}>
            {/* ================= แผ่นที่ 1: ใบรายงานผลการเรียนรายบุคคล (Cols A-S ของชีต เลขที่ X) ================= */}
            <div
              className={`porpor6-sheet ${includePage2Comment || !isLastStudent ? 'porpor6-page-break' : ''}`}
              style={sheetBoxStyle}
            >
              {/* มุมขวาบน: เลขที่ */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                <div style={{ width: 90 }} />
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <img
                    src={`${import.meta.env.BASE_URL}school_logo_kmd.png`}
                    alt="ตราโรงเรียน"
                    style={{ width: 46, height: 46, objectFit: 'contain', margin: '0 auto 2px' }}
                  />
                  <div style={{ fontSize: '13pt', fontWeight: 900 }}>{SCHOOL_NAME}</div>
                  <div style={{ fontSize: '10pt', fontWeight: 700 }}>{SCHOOL_AFFILIATION}</div>
                  <div style={{ fontSize: '10.5pt', fontWeight: 800 }}>
                    ชั้น{classData.className} ({classData.shortName}/{classData.room}) &nbsp;&nbsp;&nbsp;&nbsp; ปีการศึกษา {classData.year}
                  </div>
                </div>
                <div style={{
                  border: '1.5px solid #000',
                  padding: '4px 10px',
                  fontWeight: 900,
                  fontSize: '10.5pt',
                  textAlign: 'center',
                  minWidth: 82,
                }}>
                  เลขที่ &nbsp; {student.no}
                </div>
              </div>

              {/* ข้อมูลนักเรียน (Rows 6-7) */}
              <div style={{
                border: '1.2px solid #000',
                padding: '5px 10px',
                marginBottom: 6,
                fontSize: '9.5pt',
                lineHeight: 1.55,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                  <div><b>ชื่อ - สกุล:</b> &nbsp; {student.name}</div>
                  <div><b>วันเดือนปีเกิด:</b> &nbsp; {bio?.birthDate || '-'}</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                  <div><b>เลขประจำตัวนักเรียน:</b> &nbsp; {student.code}</div>
                  <div><b>เลขประจำตัวประชาชน:</b> &nbsp; {bio?.citizenId || '-'}</div>
                </div>
              </div>

              {/* ตารางผลการเรียน (Rows 9-34) */}
              <table style={{ width: '100%', borderCollapse: 'collapse', border: '1.5px solid #000', fontSize: '8.5pt', marginBottom: 6 }}>
                <thead>
                  <tr style={{ background: '#F8FAFC' }}>
                    <th rowSpan={2} colSpan={2} style={{ ...cellTh, width: '36%' }}>รหัส / รายวิชา</th>
                    <th rowSpan={2} style={{ ...cellTh, width: '9%' }}>เวลาเรียน<br />(ชั่วโมง)</th>
                    <th colSpan={2} style={cellTh}>ระหว่างเรียน 1</th>
                    <th colSpan={2} style={cellTh}>ระหว่างเรียน 2</th>
                    <th colSpan={2} style={cellTh}>คะแนนสอบ</th>
                    <th colSpan={2} style={cellTh}>คะแนนรวม</th>
                    <th rowSpan={2} style={{ ...cellTh, width: '9%' }}>ระดับผล<br />การเรียน</th>
                  </tr>
                  <tr style={{ background: '#F8FAFC' }}>
                    <th style={{ ...cellTh, width: '5.5%', fontSize: '7.5pt' }}>คะแนน<br />เต็ม</th>
                    <th style={{ ...cellTh, width: '6%', fontSize: '7.5pt' }}>คะแนน<br />ที่ได้</th>
                    <th style={{ ...cellTh, width: '5.5%', fontSize: '7.5pt' }}>คะแนน<br />เต็ม</th>
                    <th style={{ ...cellTh, width: '6%', fontSize: '7.5pt' }}>คะแนน<br />ที่ได้</th>
                    <th style={{ ...cellTh, width: '5.5%', fontSize: '7.5pt' }}>คะแนน<br />เต็ม</th>
                    <th style={{ ...cellTh, width: '6%', fontSize: '7.5pt' }}>คะแนน<br />ที่ได้</th>
                    <th style={{ ...cellTh, width: '5.5%', fontSize: '7.5pt' }}>คะแนน<br />เต็ม</th>
                    <th style={{ ...cellTh, width: '6%', fontSize: '7.5pt' }}>คะแนน<br />ที่ได้</th>
                  </tr>
                </thead>
                <tbody>
                  {/* หมวดรายวิชาพื้นฐาน */}
                  <tr style={{ background: '#F1F5F9', fontWeight: 900 }}>
                    <td style={{ ...cellTd, textAlign: 'center', width: '9%' }}>รหัส</td>
                    <td colSpan={11} style={cellTd}>รายวิชาพื้นฐาน</td>
                  </tr>
                  {coreSubjects.map(subj => {
                    return reportSubjectRow(subj);
                  })}

                  {/* หมวดรายวิชาเพิ่มเติม */}
                  {electiveSubjects.length > 0 && (
                    <>
                      <tr style={{ background: '#F1F5F9', fontWeight: 900 }}>
                        <td style={{ ...cellTd, textAlign: 'center' }}>รหัส</td>
                        <td colSpan={11} style={cellTd}>รายวิชาเพิ่มเติม</td>
                      </tr>
                      {electiveSubjects.map(subj => {
                        return reportSubjectRow(subj);
                      })}
                    </>
                  )}

                  {/* หมวดกิจกรรมเพิ่มเติม (Row 29-30) */}
                  <tr style={{ background: '#F1F5F9', fontWeight: 900 }}>
                    <td style={{ ...cellTd, textAlign: 'center' }}>รหัส</td>
                    <td colSpan={11} style={cellTd}>กิจกรรมเพิ่มเติม</td>
                  </tr>
                  <tr>
                    <td style={{ ...cellTd, textAlign: 'center' }}>-</td>
                    <td style={cellTd}>กิจกรรมพัฒนาผู้เรียน / ลดเวลาเรียนเพิ่มเวลารู้</td>
                    <td style={{ ...cellTd, textAlign: 'center' }}>{classData.activities.reduce((n, a) => n + a.hours, 0)}</td>
                    <td style={{ ...cellTd, textAlign: 'center' }}>-</td>
                    <td style={{ ...cellTd, textAlign: 'center' }}>-</td>
                    <td style={{ ...cellTd, textAlign: 'center' }}>-</td>
                    <td style={{ ...cellTd, textAlign: 'center' }}>-</td>
                    <td style={{ ...cellTd, textAlign: 'center' }}>-</td>
                    <td style={{ ...cellTd, textAlign: 'center' }}>-</td>
                    <td style={{ ...cellTd, textAlign: 'center' }}>-</td>
                    <td style={{ ...cellTd, textAlign: 'center' }}>-</td>
                    <td style={{ ...cellTd, textAlign: 'center', fontWeight: 900 }}>{actResult === 'ผ่าน' ? 'ผ' : actResult === 'ไม่ผ่าน' ? 'มผ' : '-'}</td>
                  </tr>

                  {/* แถวสรุประดับผลการเรียนเฉลี่ย (Row 34) */}
                  <tr style={{ background: '#F8FAFC', fontWeight: 900 }}>
                    <td colSpan={5} style={{ ...cellTd, textAlign: 'center' }}>
                      ลำดับที่ในห้องเรียน: {rankInfo.rank} / {rankInfo.total}
                    </td>
                    <td colSpan={5} style={{ ...cellTd, textAlign: 'right', paddingRight: 10 }}>
                      ระดับผลการเรียนเฉลี่ย (GPA)
                    </td>
                    <td colSpan={2} style={{ ...cellTd, textAlign: 'center', fontSize: '10pt' }}>
                      {gpaStats.gpaFormatted}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* ตารางประเมินผลด้านล่าง: กิจกรรมพัฒนาผู้เรียน (ซ้าย) + อ่านคิดวิเคราะห์/คุณลักษณะ/สมรรถนะสำคัญ (ขวา) (Rows 36-42) */}
              <div style={{ display: 'grid', gridTemplateColumns: '46% 52%', gap: '2%', marginBottom: 6 }}>
                {/* ซ้าย: กิจกรรมพัฒนาผู้เรียน 4 กิจกรรม */}
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1.2px solid #000', fontSize: '8.5pt' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC' }}>
                      <th colSpan={3} style={cellTh}>กิจกรรมพัฒนาผู้เรียน</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classData.activities.map(act => {
                      const mark = student.activities?.[act.code];
                      return (
                        <tr key={act.code}>
                          <td style={{ ...cellTd, width: '48%', fontWeight: 700 }}>{act.name}</td>
                          <td style={{ ...cellTd, width: '26%', textAlign: 'center' }}>{chk(mark === 'ผ')}ผ่าน</td>
                          <td style={{ ...cellTd, width: '26%', textAlign: 'center' }}>{chk(mark === 'มผ')}ไม่ผ่าน</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* ขวา: อ่านคิดวิเคราะห์ + คุณลักษณะอันพึงประสงค์ + สมรรถนะสำคัญของผู้เรียน */}
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1.2px solid #000', fontSize: '8.5pt' }}>
                  <tbody>
                    <tr style={{ background: '#F8FAFC' }}>
                      <th colSpan={3} style={cellTh}>การอ่าน คิดวิเคราะห์ และเขียนสื่อความ</th>
                    </tr>
                    <tr>
                      <td style={{ ...cellTd, textAlign: 'center' }}>{chk(student.readThinkResult === 'ดีเยี่ยม')}ดีเยี่ยม</td>
                      <td style={{ ...cellTd, textAlign: 'center' }}>{chk(student.readThinkResult === 'ดี')}ดี</td>
                      <td style={{ ...cellTd, textAlign: 'center' }}>{chk(student.readThinkResult === 'ผ่าน')}ผ่าน</td>
                    </tr>
                    <tr style={{ background: '#F8FAFC' }}>
                      <th colSpan={3} style={cellTh}>คุณลักษณะอันพึงประสงค์</th>
                    </tr>
                    <tr>
                      <td style={{ ...cellTd, textAlign: 'center' }}>{chk(student.traitResult === 'ดีเยี่ยม')}ดีเยี่ยม</td>
                      <td style={{ ...cellTd, textAlign: 'center' }}>{chk(student.traitResult === 'ดี')}ดี</td>
                      <td style={{ ...cellTd, textAlign: 'center' }}>{chk(student.traitResult === 'ผ่าน')}ผ่าน</td>
                    </tr>
                    <tr style={{ background: '#F8FAFC' }}>
                      <th colSpan={3} style={cellTh}>สมรรถนะสำคัญของผู้เรียน</th>
                    </tr>
                    <tr>
                      <td style={{ ...cellTd, textAlign: 'center' }}>{chk(false)}ดีเยี่ยม</td>
                      <td style={{ ...cellTd, textAlign: 'center' }}>{chk(false)}ดี</td>
                      <td style={{ ...cellTd, textAlign: 'center' }}>{chk(false)}ผ่าน</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* ตารางลงชื่อครูประจำชั้น & ผู้อำนวยการโรงเรียน แยกระหว่างเรียน 1 และ 2 (Rows 44-46) */}
              <table style={{ width: '100%', borderCollapse: 'collapse', border: '1.2px solid #000', fontSize: '8.5pt' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC' }}>
                    <th style={{ ...cellTh, width: '24%' }}>ผู้รับรองผลการเรียน</th>
                    <th style={{ ...cellTh, width: '38%' }}>ระหว่างเรียน 1</th>
                    <th style={{ ...cellTh, width: '38%' }}>ระหว่างเรียน 2</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ ...cellTd, fontWeight: 800 }}>ชื่อครูประจำชั้น</td>
                    <td style={{ ...cellTd, textAlign: 'center', padding: '6px 4px' }}>
                      <div>ลงชื่อ ....................................................</div>
                      <div style={{ fontWeight: 800 }}>({classData.homeroomTeachers.join(' / ')})</div>
                    </td>
                    <td style={{ ...cellTd, textAlign: 'center', padding: '6px 4px' }}>
                      <div>ลงชื่อ ....................................................</div>
                      <div style={{ fontWeight: 800 }}>({classData.homeroomTeachers.join(' / ')})</div>
                    </td>
                  </tr>
                  <tr>
                    <td style={{ ...cellTd, fontWeight: 800 }}>ชื่อผู้อำนวยการโรงเรียน</td>
                    <td style={{ ...cellTd, textAlign: 'center', padding: '6px 4px' }}>
                      <div>ลงชื่อ ....................................................</div>
                      <div style={{ fontWeight: 800 }}>({classData.director})</div>
                    </td>
                    <td style={{ ...cellTd, textAlign: 'center', padding: '6px 4px' }}>
                      <div>ลงชื่อ ....................................................</div>
                      <div style={{ fontWeight: 800 }}>({classData.director})</div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* ================= แผ่นที่ 2: ความคิดเห็นของครูประจำชั้น & ความคิดเห็นของผู้ปกครอง (Cols U-AK ของชีต เลขที่ X) ================= */}
            {includePage2Comment && (
              <div
                className={`porpor6-sheet ${!isLastStudent ? 'porpor6-page-break' : ''}`}
                style={sheetBoxStyle}
              >
                {/* มุมขวาบน: เลขที่ */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div style={{ width: 90 }} />
                  <div style={{ textAlign: 'center', flex: 1 }}>
                    <img
                      src={`${import.meta.env.BASE_URL}school_logo_kmd.png`}
                      alt="ตราโรงเรียน"
                      style={{ width: 48, height: 48, objectFit: 'contain', margin: '0 auto 4px' }}
                    />
                    <div style={{ fontSize: '13.5pt', fontWeight: 900 }}>{SCHOOL_NAME}</div>
                    <div style={{ fontSize: '10.5pt', fontWeight: 700 }}>{SCHOOL_AFFILIATION}</div>
                    <div style={{ fontSize: '11pt', fontWeight: 800 }}>
                      ชั้น{classData.className} ({classData.shortName}/{classData.room}) &nbsp;&nbsp;&nbsp;&nbsp; ปีการศึกษา {classData.year}
                    </div>
                  </div>
                  <div style={{
                    border: '1.5px solid #000',
                    padding: '4px 10px',
                    fontWeight: 900,
                    fontSize: '10.5pt',
                    textAlign: 'center',
                    minWidth: 82,
                  }}>
                    เลขที่ &nbsp; {student.no}
                  </div>
                </div>

                {/* ข้อมูลนักเรียน (Rows 6-7 Cols U-AK) */}
                <div style={{
                  border: '1.2px solid #000',
                  padding: '6px 12px',
                  marginBottom: 14,
                  fontSize: '10pt',
                  lineHeight: 1.65,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                    <div><b>ชื่อ - สกุล:</b> &nbsp; {student.name}</div>
                    <div><b>วันเดือนปีเกิด:</b> &nbsp; {bio?.birthDate || '-'}</div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                    <div><b>เลขประจำตัวนักเรียน:</b> &nbsp; {student.code}</div>
                    <div><b>เลขประจำตัวประชาชน:</b> &nbsp; {bio?.citizenId || '-'}</div>
                  </div>
                </div>

                {/* ตารางที่ 1: ความคิดเห็นของครูประจำชั้น (Rows 10-25 Cols U-AK) */}
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1.5px solid #000', fontSize: '10pt', marginBottom: 18 }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC' }}>
                      <th colSpan={2} style={{ ...cellTh, padding: '8px', fontSize: '11pt' }}>
                        ความคิดเห็นของครูประจำชั้น
                      </th>
                    </tr>
                    <tr style={{ background: '#F8FAFC' }}>
                      <th style={{ ...cellTh, width: '50%', padding: '6px' }}>ระหว่างเรียน 1</th>
                      <th style={{ ...cellTh, width: '50%', padding: '6px' }}>ระหว่างเรียน 2</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ ...cellTd, padding: '14px 16px', verticalAlign: 'top', height: 210, lineHeight: 1.8 }}>
                        <div>
                          นักเรียนมีความตั้งใจเรียนดี ปฏิบัติตามกฎระเบียบของโรงเรียน มีความรับผิดชอบต่องานที่ได้รับมอบหมาย และอยู่ร่วมกับเพื่อนในชั้นเรียนได้อย่างมีความสุข
                        </div>
                        <div style={{ marginTop: 14, borderBottom: '1px dotted #64748B', height: 22 }} />
                        <div style={{ borderBottom: '1px dotted #64748B', height: 22 }} />
                        <div style={{ marginTop: 32, textAlign: 'center' }}>
                          <div>ลงชื่อ ...........................................................</div>
                          <div style={{ fontWeight: 800, marginTop: 4 }}>({classData.homeroomTeachers.join(' / ')})</div>
                          <div style={{ fontWeight: 800 }}>ครูประจำชั้น</div>
                        </div>
                      </td>
                      <td style={{ ...cellTd, padding: '14px 16px', verticalAlign: 'top', height: 210, lineHeight: 1.8 }}>
                        <div>
                          นักเรียนมีพัฒนาการทางการเรียนดีขึ้นอย่างต่อเนื่อง มีระเบียบวินัย มีจิตอาสา ช่วยเหลือส่วนรวม และมีคุณลักษณะอันพึงประสงค์เป็นไปตามเกณฑ์ที่สถานศึกษากำหนด
                        </div>
                        <div style={{ marginTop: 14, borderBottom: '1px dotted #64748B', height: 22 }} />
                        <div style={{ borderBottom: '1px dotted #64748B', height: 22 }} />
                        <div style={{ marginTop: 32, textAlign: 'center' }}>
                          <div>ลงชื่อ ...........................................................</div>
                          <div style={{ fontWeight: 800, marginTop: 4 }}>({classData.homeroomTeachers.join(' / ')})</div>
                          <div style={{ fontWeight: 800 }}>ครูประจำชั้น</div>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* ตารางที่ 2: ความคิดเห็นของผู้ปกครอง (Rows 28-43 Cols U-AK) */}
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1.5px solid #000', fontSize: '10pt' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC' }}>
                      <th colSpan={2} style={{ ...cellTh, padding: '8px', fontSize: '11pt' }}>
                        ความคิดเห็นของผู้ปกครอง
                      </th>
                    </tr>
                    <tr style={{ background: '#F8FAFC' }}>
                      <th style={{ ...cellTh, width: '50%', padding: '6px' }}>ระหว่างเรียน 1</th>
                      <th style={{ ...cellTh, width: '50%', padding: '6px' }}>ระหว่างเรียน 2</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ ...cellTd, padding: '14px 16px', verticalAlign: 'top', height: 210, lineHeight: 1.8 }}>
                        <div style={{ borderBottom: '1px dotted #64748B', height: 26 }} />
                        <div style={{ borderBottom: '1px dotted #64748B', height: 26 }} />
                        <div style={{ borderBottom: '1px dotted #64748B', height: 26 }} />
                        <div style={{ borderBottom: '1px dotted #64748B', height: 26 }} />
                        <div style={{ marginTop: 36, textAlign: 'center' }}>
                          <div>ลงชื่อ ...........................................................</div>
                          <div style={{ fontWeight: 800, marginTop: 4 }}>
                            ({bio?.guardianName || '...........................................................'})
                          </div>
                          <div style={{ fontWeight: 800 }}>
                            ชื่อผู้ปกครอง {bio?.guardianRelation ? `(เกี่ยวข้องเป็น${bio.guardianRelation})` : ''}
                          </div>
                        </div>
                      </td>
                      <td style={{ ...cellTd, padding: '14px 16px', verticalAlign: 'top', height: 210, lineHeight: 1.8 }}>
                        <div style={{ borderBottom: '1px dotted #64748B', height: 26 }} />
                        <div style={{ borderBottom: '1px dotted #64748B', height: 26 }} />
                        <div style={{ borderBottom: '1px dotted #64748B', height: 26 }} />
                        <div style={{ borderBottom: '1px dotted #64748B', height: 26 }} />
                        <div style={{ marginTop: 36, textAlign: 'center' }}>
                          <div>ลงชื่อ ...........................................................</div>
                          <div style={{ fontWeight: 800, marginTop: 4 }}>
                            ({bio?.guardianName || '...........................................................'})
                          </div>
                          <div style={{ fontWeight: 800 }}>
                            ชื่อผู้ปกครอง {bio?.guardianRelation ? `(เกี่ยวข้องเป็น${bio.guardianRelation})` : ''}
                          </div>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const sheetBoxStyle: React.CSSProperties = {
  background: '#FFFFFF',
  padding: '10mm 12mm',
  marginBottom: 24,
  borderRadius: 4,
  boxShadow: '0 8px 30px rgba(15,23,42,0.15)',
  color: '#000000',
  fontFamily: '"Sarabun", "TH SarabunPSK", "TH Sarabun New", sans-serif',
};

const cellTh: React.CSSProperties = {
  border: '1px solid #000000',
  padding: '3px 4px',
  fontWeight: 800,
  textAlign: 'center',
  lineHeight: 1.25,
  color: '#000000',
};

const cellTd: React.CSSProperties = {
  border: '1px solid #000000',
  padding: '3px 5px',
  lineHeight: 1.25,
  color: '#000000',
};
