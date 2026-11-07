// ผลการเรียนรายบุคคล: a class's whole year at a glance, one student's year (both terms), and the
// student's earlier years. Reads the same data as ปพ.5 / ปพ.6 (no data of its own):
//   this year  -> useAcademicData() (class structure + config/academic_scores_2569)
//   past years -> config/academic_scores_{year}, found by student code
import { useEffect, useMemo, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Printer } from 'lucide-react';
import SmartSchoolLayout from '../components/SmartSchoolLayout';
import TeacherLoginGate from '../components/TeacherLoginGate';
import { useTeacherAuth } from '../utils/teacherAuth';
import { useAcademicData } from '../utils/academicStorage';
import { scoreScheme, type ClassAcademicData, type StudentSubjectScore } from '../data/academicData';
import { findStudentInYear, gpaOf, yearRows, yearsBack, type SubjectRow } from '../utils/studentRecord';
import { activityOverall, itemsLevel, LEVEL_LABELS } from '../utils/assessment';
import { OfficialDocument, OfficialHeader, SignatureBlock } from '../components/print/Official';
import { DIRECTOR_SIGNER, officialTd, officialTdLeft, officialTh, SHADE } from '../components/print/officialStyles';
import { useStaffScope } from '../utils/staffScope';
import type { Role } from '../utils/teacherAuth';

const YEARS_TO_LOOK_BACK = 6; // ม.3 has at most 9 school years here; 6 covers ป.1 -> ป.6 / ม.1 -> ม.3

type SavedYear = Record<string, Record<string, Record<string, StudentSubjectScore>>>;

export default function StudentRecordPage() {
  const auth = useTeacherAuth();
  if (!auth.authed) return <TeacherLoginGate title="ผลการเรียนรายบุคคล" subtitle="รายปี · รายคน · ย้อนหลัง" />;
  return <StudentRecord auth={auth} />;
}

function StudentRecord({ auth }: { auth: { role: Role; name: string; authed: boolean } }) {
  const { classesData: allClasses, loaded } = useAcademicData();
  // a teacher sees the classes they are homeroom teacher of or teach a subject in; admins see all
  const staffScope = useStaffScope(auth, allClasses);
  const classesData = useMemo(() => staffScope.isAdmin ? allClasses : allClasses.filter(c =>
    staffScope.canManageClass(c) || c.subjects.some(s => staffScope.canEditSubject(s.teacher))), [allClasses, staffScope]);
  const [classId, setClassId] = useState('');
  const [studentCode, setStudentCode] = useState('');
  const cls = classesData.find(c => c.classId === classId) || classesData[0];
  const student = cls?.students.find(s => s.code === studentCode);

  // earlier years: one score document per year, read once
  const [pastYears, setPastYears] = useState<{ year: string; saved: SavedYear }[]>([]);
  const currentYear = cls?.year || '2569';
  useEffect(() => {
    let cancelled = false;
    Promise.all(yearsBack(currentYear, YEARS_TO_LOOK_BACK).map(async year => {
      const snap = await getDoc(doc(db, 'config', `academic_scores_${year}`)).catch(() => null);
      return snap?.exists() ? { year, saved: (snap.data().scores || {}) as SavedYear } : null;
    })).then(list => { if (!cancelled) setPastYears(list.filter((x): x is { year: string; saved: SavedYear } => !!x)); });
    return () => { cancelled = true; };
  }, [currentYear]);

  if (!cls) return <SmartSchoolLayout pageTitle="ผลการเรียนรายบุคคล"><p>กำลังโหลด…</p></SmartSchoolLayout>;

  const classSummary = cls.students.map(st => {
    const rows = yearRows(cls, st);
    return { st, t1: gpaOf(rows.filter(r => r.term === '1')), t2: gpaOf(rows.filter(r => r.term === '2')), year: gpaOf(rows) };
  });
  const hasTerm2Subjects = cls.level === 'มัธยม' && cls.subjects.some(s => (s.semester || cls.semester) === '2');

  return (
    <SmartSchoolLayout pageTitle="ผลการเรียนรายบุคคล">
      <div className="no-print" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 14 }}>
        <label style={label}>ชั้น
          <select value={cls.classId} onChange={e => { setClassId(e.target.value); setStudentCode(''); }} style={input}>
            {classesData.map(c => <option key={c.classId} value={c.classId}>{c.className} ({c.shortName})</option>)}
          </select>
        </label>
        <label style={label}>นักเรียน
          <select value={studentCode} onChange={e => setStudentCode(e.target.value)} style={{ ...input, minWidth: 260 }}>
            <option value="">— ทั้งห้อง (สรุปรายปี) —</option>
            {cls.students.map(s => <option key={s.code} value={s.code}>{s.no}. {s.name}</option>)}
          </select>
        </label>
        {student && <button type="button" onClick={() => window.print()} style={printBtn}><Printer size={16} /> พิมพ์</button>}
        {!loaded && <span style={{ color: '#475569' }}>กำลังโหลดคะแนน…</span>}
      </div>

      {!student ? (
        <section className="no-print" style={card}>
          <h2 style={h2}>สรุปผลการเรียนทั้งปี — {cls.className} ปีการศึกษา {cls.year}</h2>
          <p style={muted}>
            เกรดเฉลี่ยนับเฉพาะวิชาที่มีผลแล้ว{cls.level === 'ประถม' ? ' (ประถมตัดเกรดเมื่อครบ 2 ภาคเรียน)' : ''} · คลิกชื่อเพื่อดูรายคน
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table style={table}>
              <thead><tr style={{ background: '#F1F5F9' }}>
                <th style={th}>เลขที่</th><th style={{ ...th, textAlign: 'left' }}>ชื่อ-สกุล</th>
                {cls.level === 'มัธยม' && <><th style={th}>เกรดเฉลี่ยภาค 1</th><th style={th}>เกรดเฉลี่ยภาค 2</th></>}
                <th style={th}>เกรดเฉลี่ยทั้งปี</th><th style={th}>วิชาที่ยังรอผล</th>
              </tr></thead>
              <tbody>
                {classSummary.map(({ st, t1, t2, year }) => (
                  <tr key={st.code} style={{ borderBottom: '1px solid #E2E8F0' }}>
                    <td style={td}>{st.no}</td>
                    <td style={{ ...td, textAlign: 'left' }}>
                      <button type="button" onClick={() => setStudentCode(st.code)} style={linkBtn}>{st.name}</button>
                    </td>
                    {cls.level === 'มัธยม' && <><td style={td}>{fmt(t1.gpa)}</td><td style={td}>{hasTerm2Subjects ? fmt(t2.gpa) : '-'}</td></>}
                    <td style={{ ...td, fontWeight: 900 }}>{fmt(year.gpa)}</td>
                    <td style={{ ...td, color: year.pending ? '#B45309' : '#475569' }}>{year.pending || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {cls.level === 'มัธยม' && !hasTerm2Subjects && (
            <p style={{ ...muted, marginTop: 10 }}>ยังไม่มีรายวิชาภาคเรียนที่ 2 ของชั้นนี้ในระบบ — เมื่อเพิ่มแล้วจะแสดงเกรดเฉลี่ยภาค 2 และทั้งปีอัตโนมัติ</p>
          )}
        </section>
      ) : (
        <StudentYear cls={cls} studentCode={student.code} hasTerm2Subjects={hasTerm2Subjects} pastYears={pastYears} />
      )}
    </SmartSchoolLayout>
  );
}

function StudentYear({ cls, studentCode, hasTerm2Subjects, pastYears }: {
  cls: ClassAcademicData;
  studentCode: string;
  hasTerm2Subjects: boolean;
  pastYears: { year: string; saved: SavedYear }[];
}) {
  const st = cls.students.find(s => s.code === studentCode)!;
  const scheme = scoreScheme(cls.level);
  const rows = yearRows(cls, st);
  const year = gpaOf(rows);
  const history = pastYears.map(y => ({ year: y.year, found: findStudentInYear(y.saved, studentCode) })).filter(h => h.found);

  const traitLevels = rows.map(r => r.score && (itemsLevel(r.score.traitItems) ?? r.score.traitScore)).filter((x): x is number => typeof x === 'number');
  const readLevels = rows.map(r => r.score && (itemsLevel(r.score.readItems) ?? r.score.readThinkScore)).filter((x): x is number => typeof x === 'number');
  const level = (xs: number[]) => (xs.length ? LEVEL_LABELS[Math.min(...xs)] : '-');
  const activities = activityOverall(st.activities, cls.activities.map(a => a.code)) ?? (st.activities ? 'ยังบันทึกไม่ครบ' : '-');

  const termTable = (title: string, list: SubjectRow[], note?: string) => (
    <>
      <h4 style={sectionTitle}>{title}</h4>
      {list.length === 0 ? <p style={{ fontSize: '14pt' }}>{note}</p> : (
        <table style={{ fontSize: '13pt' }}>
          <thead><tr>
            <th style={officialTh}>รหัสวิชา</th><th style={officialTh}>รายวิชา</th><th style={officialTh}>{scheme.weightLabel}</th>
            {scheme.yearly
              ? <><th style={officialTh}>ภาค 1 (50)</th><th style={officialTh}>ภาค 2 (50)</th><th style={officialTh}>รวม (100)</th></>
              : <><th style={officialTh}>ระหว่างเรียน ({scheme.courseworkMax})</th><th style={officialTh}>ปลายภาค ({scheme.finalMax})</th><th style={officialTh}>รวม (100)</th></>}
            <th style={officialTh}>ผลการเรียน</th><th style={officialTh}>ผลการแก้ตัว</th>
          </tr></thead>
          <tbody>
            {list.map(r => {
              const sc = r.score;
              const hasT2 = sc && (sc.term2Coursework !== undefined || sc.term2FinalExam !== undefined);
              return (
                <tr key={r.subject.code}>
                  <td style={officialTd}>{r.subject.code}</td>
                  <td style={officialTdLeft}>{r.subject.name}</td>
                  <td style={officialTd}>{r.subject.credits}</td>
                  {scheme.yearly ? <>
                    <td style={officialTd}>{sc ? sc.coursework + sc.finalExam : ''}</td>
                    <td style={officialTd}>{hasT2 ? (sc!.term2Coursework ?? 0) + (sc!.term2FinalExam ?? 0) : ''}</td>
                    <td style={officialTd}>{hasT2 ? sc!.total : ''}</td>
                  </> : <>
                    <td style={officialTd}>{sc?.coursework ?? ''}</td>
                    <td style={officialTd}>{sc?.finalExam ?? ''}</td>
                    <td style={officialTd}>{sc?.total ?? ''}</td>
                  </>}
                  <td style={officialTd}>{sc?.grade || (scheme.yearly ? 'รอภาค 2' : '')}</td>
                  <td style={officialTd}>{sc?.remedial?.grade ?? ''}</td>
                </tr>
              );
            })}
            <tr className="shade" style={{ background: SHADE, fontWeight: 700 }}>
              <td style={officialTd} colSpan={3}>เกรดเฉลี่ย</td>
              <td style={officialTd} colSpan={5}>{fmt(gpaOf(list).gpa)}{gpaOf(list).pending ? ` (รอผล ${gpaOf(list).pending} วิชา)` : ''}</td>
            </tr>
          </tbody>
        </table>
      )}
    </>
  );

  return (
    <OfficialDocument style={paper}>
      <OfficialHeader
        title={`ผลการเรียนรายบุคคล ปีการศึกษา ${cls.year}`}
        lines={[`${st.name}  เลขประจำตัว ${st.code}  ชั้น${cls.className}  เลขที่ ${st.no}`]}
      />

      {scheme.yearly
        ? termTable('ผลการเรียนทั้งปี (ภาคเรียนที่ 1 และ 2)', rows)
        : <>
          {termTable('ภาคเรียนที่ 1', rows.filter(r => r.term === '1'))}
          {termTable('ภาคเรียนที่ 2', rows.filter(r => r.term === '2'), hasTerm2Subjects ? '' : 'ยังไม่มีรายวิชาภาคเรียนที่ 2 ในระบบ')}
        </>}

      <h4 style={sectionTitle}>สรุปทั้งปี</h4>
      <table style={{ fontSize: '13pt' }}>
        <tbody>
          <tr><td style={officialTdLeft}>เกรดเฉลี่ยทั้งปี</td><td style={officialTd}>{fmt(year.gpa)}{year.pending ? ` (รอผล ${year.pending} วิชา)` : ''}</td></tr>
          <tr><td style={officialTdLeft}>คุณลักษณะอันพึงประสงค์ (ระดับต่ำสุดของทุกวิชา)</td><td style={officialTd}>{level(traitLevels)}</td></tr>
          <tr><td style={officialTdLeft}>การอ่าน คิด วิเคราะห์ และเขียน (ระดับต่ำสุดของทุกวิชา)</td><td style={officialTd}>{level(readLevels)}</td></tr>
          <tr><td style={officialTdLeft}>กิจกรรมพัฒนาผู้เรียน</td><td style={officialTd}>{activities}</td></tr>
        </tbody>
      </table>

      <h4 style={sectionTitle}>ผลการเรียนย้อนหลัง</h4>
      {history.length === 0 ? (
        <p style={{ fontSize: '14pt' }}>ยังไม่มีผลการเรียนปีก่อนหน้าในระบบ (ระบบเริ่มเก็บปีการศึกษา {cls.year})</p>
      ) : history.map(h => (
        <div key={h.year} style={{ marginBottom: 8 }}>
          <div style={{ fontSize: '14pt', fontWeight: 700 }}>ปีการศึกษา {h.year} (ชั้น {h.found!.classId})</div>
          <table style={{ fontSize: '13pt' }}>
            <thead><tr><th style={officialTh}>รหัสวิชา</th><th style={officialTh}>คะแนนรวม</th><th style={officialTh}>ผลการเรียน</th></tr></thead>
            <tbody>
              {Object.entries(h.found!.scores).map(([code, sc]) => (
                <tr key={code}><td style={officialTd}>{code}</td><td style={officialTd}>{sc.total}</td><td style={officialTd}>{sc.remedial?.grade || sc.grade}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      <SignatureBlock signers={[{ role: 'ครูประจำชั้น', name: cls.homeroomTeachers[0] }, DIRECTOR_SIGNER]} />
      <style>{`@media print { @page { size: A4 portrait; margin: 15mm 15mm 15mm 20mm; } .print-area { padding: 0 !important; box-shadow: none !important; } }`}</style>
    </OfficialDocument>
  );
}

const fmt = (gpa: number | null) => (gpa === null ? '-' : gpa.toFixed(2));

const card: React.CSSProperties = { background: 'white', borderRadius: 12, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' };
const h2: React.CSSProperties = { fontSize: '1.05rem', fontWeight: 900, color: '#0F172A', margin: 0 };
const muted: React.CSSProperties = { fontSize: '0.85rem', color: '#475569', margin: '4px 0 10px' };
const label: React.CSSProperties = { display: 'grid', gap: 4, fontSize: '0.8rem', fontWeight: 800, color: '#334155' };
const input: React.CSSProperties = { padding: '7px 10px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.9rem' };
const printBtn: React.CSSProperties = { background: '#0F172A', color: 'white', border: 'none', borderRadius: 8, padding: '8px 14px', fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const linkBtn: React.CSSProperties = { background: 'none', border: 0, padding: 0, color: '#C2410C', fontWeight: 800, cursor: 'pointer', textAlign: 'left' };
const table: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' };
const th: React.CSSProperties = { padding: '8px 10px', fontWeight: 800, textAlign: 'center', fontSize: '0.82rem' };
const td: React.CSSProperties = { padding: '7px 10px', textAlign: 'center' };
const paper: React.CSSProperties = { background: 'white', maxWidth: '210mm', margin: '0 auto', padding: '15mm 15mm 15mm 20mm', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' };
const sectionTitle: React.CSSProperties = { fontSize: '16pt', fontWeight: 700, margin: '12pt 0 4pt' };
