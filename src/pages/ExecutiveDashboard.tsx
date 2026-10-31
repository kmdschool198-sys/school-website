// แดชบอร์ดผู้บริหาร: ภาพรวมนักเรียนรายวัน การดูแลช่วยเหลือนักเรียน และวิชาการ
// Reads the same collections the teacher pages write (no data of its own):
//   attendance/{classId_date}, config/behavior_logs, config/home_visits,
//   log_body_metrics, student_details (staff-only), config/academic_data_2569
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Printer } from 'lucide-react';
import SmartSchoolLayout from '../components/SmartSchoolLayout';
import TeacherLoginGate from '../components/TeacherLoginGate';
import { useTeacherAuth } from '../utils/teacherAuth';
import { useSchoolRoster } from '../utils/useSchoolRoster';
import { useSchoolDays } from '../utils/useSchoolDays';
import { useAcademicData } from '../utils/academicStorage';
import { calculateStudentGPA } from '../data/academicData';
import { resolveSchoolDay } from '../data/schoolCalendar';
import { bmiInterpretation } from '../utils/bmi';
import { sameStudent } from '../utils/studentKey';
import type { BehaviorLogEntry } from './BehaviorPage';
import type { HomeVisitRecord } from './HomeVisitPage';
import { OfficialDocument, OfficialHeader, SignatureBlock } from '../components/print/Official';
import { DIRECTOR_SIGNER, officialTh, officialTd, officialTdLeft, SHADE } from '../components/print/officialStyles';
import { thaiDateLong, todayIso } from '../utils/dates';

interface AttRecord { status: string; noMilk?: boolean; noBrush?: boolean; noLunch?: boolean }
interface AttDoc { classId: string; date: string; records: Record<string, AttRecord> }
interface BodyLog { studentId?: string; studentCode?: string; studentName?: string; bmi?: number; date?: string }

const LOW_BEHAVIOR_SCORE = 80;   // ต่ำกว่านี้ต้องติดตาม (คะแนนเริ่มต้น 100)
const LOW_GPA = 1.5;             // กลุ่มเสี่ยงด้านการเรียน

export default function ExecutiveDashboard() {
  const auth = useTeacherAuth();
  if (!auth.authed) return <TeacherLoginGate title="📊 แดชบอร์ดผู้บริหาร" subtitle="ภาพรวมนักเรียนรายวัน การดูแลช่วยเหลือ และวิชาการ" />;
  return <Dashboard />;
}

function Dashboard() {
  const [date, setDate] = useState(todayIso());
  const { classes } = useSchoolRoster();
  const { holidays, schoolDays } = useSchoolDays();
  const { classesData } = useAcademicData();
  const [attDocs, setAttDocs] = useState<AttDoc[]>([]);
  const [behaviorLogs, setBehaviorLogs] = useState<BehaviorLogEntry[]>([]);
  const [visits, setVisits] = useState<Record<string, HomeVisitRecord>>({});
  const [bodyLogs, setBodyLogs] = useState<BodyLog[]>([]);

  useEffect(() => onSnapshot(query(collection(db, 'attendance'), where('date', '==', date)), snap => {
    const arr: AttDoc[] = [];
    snap.forEach(d => arr.push(d.data() as AttDoc));
    setAttDocs(arr);
  }, () => setAttDocs([])), [date]);

  useEffect(() => onSnapshot(doc(db, 'config', 'behavior_logs'), snap => {
    setBehaviorLogs(Array.isArray(snap.data()?.logs) ? snap.data()!.logs : []);
  }, () => setBehaviorLogs([])), []);

  useEffect(() => onSnapshot(doc(db, 'config', 'home_visits'), snap => {
    setVisits((snap.data()?.records as Record<string, HomeVisitRecord>) || {});
  }, () => setVisits({})), []);

  useEffect(() => onSnapshot(collection(db, 'log_body_metrics'), snap => {
    const arr: BodyLog[] = [];
    snap.forEach(d => arr.push(d.data() as BodyLog));
    setBodyLogs(arr);
  }, () => setBodyLogs([])), []);

  const day = resolveSchoolDay(date, schoolDays, holidays);

  // ── นักเรียนรายวัน ──
  const daily = useMemo(() => classes.map(c => {
    const att = attDocs.find(a => a.classId === c.id);
    const recs = att?.records || {};
    let present = 0, absent = 0, leave = 0, lunch = 0, milk = 0, brush = 0;
    c.students.forEach(s => {
      const r = recs[s.id];
      const st = r?.status || 'present';
      if (st === 'absent') absent++;
      else if (st === 'leave') leave++;
      else {
        present++;
        if (!r?.noLunch) lunch++;
        if (!r?.noMilk) milk++;
        if (!r?.noBrush) brush++;
      }
    });
    return { id: c.id, label: c.label, total: c.totalCount, checked: !!att, present, absent, leave, lunch, milk, brush };
  }), [classes, attDocs]);
  const dailyTotal = daily.reduce((t, r) => ({
    total: t.total + r.total, checkedTotal: t.checkedTotal + (r.checked ? r.total : 0), present: t.present + (r.checked ? r.present : 0), absent: t.absent + r.absent, leave: t.leave + r.leave,
    lunch: t.lunch + (r.checked ? r.lunch : 0), milk: t.milk + (r.checked ? r.milk : 0), brush: t.brush + (r.checked ? r.brush : 0),
  }), { total: 0, checkedTotal: 0, present: 0, absent: 0, leave: 0, lunch: 0, milk: 0, brush: 0 });
  const notChecked = daily.filter(r => !r.checked).map(r => r.label);

  // ── ดูแลช่วยเหลือ ──
  const allStudents = useMemo(() => classes.flatMap(c => c.students.map(s => ({ ...s, classLabel: c.label }))), [classes]);
  const care = useMemo(() => {
    const scoreOf = (s: { id: string; code?: string; name: string }) => behaviorLogs.filter(l => sameStudent(l, s))
      .reduce((n, l) => n + (l.type === 'add' ? l.points : -l.points), 100);
    const lowBehavior = allStudents.map(s => ({ s, score: scoreOf(s) })).filter(x => x.score < LOW_BEHAVIOR_SCORE);
    const visitList = Object.values(visits);
    const visited = visitList.filter(v => v.visited).length;
    const poor = visitList.filter(v => v.economicStatus !== 'ปกติ').length;
    const scholarship = visitList.filter(v => v.scholarshipNeed).length;
    const sortedBody = [...bodyLogs].filter(l => l.bmi).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const bmiFlags = allStudents.map(s => ({ s, bmi: sortedBody.find(l => sameStudent(l, s))?.bmi ?? s.bmi }))
      .filter(x => x.bmi && bmiInterpretation(x.bmi) !== 'สมส่วน');
    return { lowBehavior, visited, poor, scholarship, bmiFlags };
  }, [allStudents, behaviorLogs, visits, bodyLogs]);

  // ── วิชาการ ──
  const academic = useMemo(() => {
    const perClass = classesData.map(c => {
      const gpas = c.students.map(st => ({ st, gpa: calculateStudentGPA(st, c.subjects).gpa })).filter(x => x.gpa > 0);
      const avg = gpas.length ? gpas.reduce((n, x) => n + x.gpa, 0) / gpas.length : 0;
      return { label: c.shortName || c.className, count: gpas.length, avg, risk: gpas.filter(x => x.gpa < LOW_GPA) };
    });
    const graded = perClass.filter(c => c.count);
    const all = graded.reduce((n, c) => n + c.avg * c.count, 0);
    const n = graded.reduce((k, c) => k + c.count, 0);
    return { perClass, schoolAvg: n ? all / n : 0, riskCount: perClass.reduce((k, c) => k + c.risk.length, 0) };
  }, [classesData]);

  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '-');

  return (
    <SmartSchoolLayout pageTitle="แดชบอร์ดผู้บริหาร">
      <div className="no-print" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
        <span style={{ fontWeight: 800, color: day.open ? '#047857' : '#B45309' }}>{day.open ? 'วันเปิดเรียน' : `วันหยุด: ${day.label}`}</span>
        <button onClick={() => window.print()} style={printBtn}><Printer size={16} /> พิมพ์รายงานสรุป</button>
      </div>

      <div className="no-print" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 16 }}>
        <Stat label="มาเรียนวันนี้" value={`${dailyTotal.present}/${dailyTotal.checkedTotal}`} sub={pct(dailyTotal.present, dailyTotal.checkedTotal)} />
        <Stat label="ขาด / ลา" value={`${dailyTotal.absent} / ${dailyTotal.leave}`} sub="คน" />
        <Stat label="ชั้นที่ยังไม่เช็คชื่อ" value={String(notChecked.length)} sub={notChecked.join(', ') || 'ครบทุกชั้น'} warn={notChecked.length > 0 && day.open} />
        <Stat label="ความประพฤติต่ำกว่า 80" value={String(care.lowBehavior.length)} sub="คน ต้องติดตาม" warn={care.lowBehavior.length > 0} />
        <Stat label="เยี่ยมบ้านแล้ว" value={`${care.visited}/${allStudents.length}`} sub={pct(care.visited, allStudents.length)} />
        <Stat label="GPA เฉลี่ยทั้งโรงเรียน" value={academic.schoolAvg ? academic.schoolAvg.toFixed(2) : '-'} sub={`กลุ่มเสี่ยง ${academic.riskCount} คน`} />
      </div>

      <OfficialDocument style={paper}>
        <OfficialHeader title="รายงานสรุปข้อมูลนักเรียนสำหรับผู้บริหาร" lines={[`ประจำวันที่ ${thaiDateLong(date)}${day.open ? '' : ` (${day.label})`}`]} />

        <h4 style={sectionTitle}>1. ข้อมูลนักเรียนรายวัน</h4>
        <table style={{ fontSize: '14pt' }}>
          <thead>
            <tr>
              <th style={officialTh}>ชั้น</th><th style={officialTh}>นักเรียน</th><th style={officialTh}>มา</th>
              <th style={officialTh}>ขาด</th><th style={officialTh}>ลา</th><th style={officialTh}>อาหารกลางวัน</th>
              <th style={officialTh}>ดื่มนม</th><th style={officialTh}>แปรงฟัน</th><th style={officialTh}>หมายเหตุ</th>
            </tr>
          </thead>
          <tbody>
            {daily.map(r => (
              <tr key={r.id}>
                <td style={officialTd}>{r.label}</td><td style={officialTd}>{r.total}</td>
                <td style={officialTd}>{r.checked ? r.present : '-'}</td><td style={officialTd}>{r.checked ? r.absent : '-'}</td>
                <td style={officialTd}>{r.checked ? r.leave : '-'}</td><td style={officialTd}>{r.checked ? r.lunch : '-'}</td>
                <td style={officialTd}>{r.checked ? r.milk : '-'}</td><td style={officialTd}>{r.checked ? r.brush : '-'}</td>
                <td style={officialTd}>{r.checked ? '' : 'ยังไม่เช็คชื่อ'}</td>
              </tr>
            ))}
            <tr className="shade" style={{ background: SHADE, fontWeight: 700 }}>
              <td style={officialTd}>รวม</td><td style={officialTd}>{dailyTotal.total}</td><td style={officialTd}>{dailyTotal.present}</td>
              <td style={officialTd}>{dailyTotal.absent}</td><td style={officialTd}>{dailyTotal.leave}</td><td style={officialTd}>{dailyTotal.lunch}</td>
              <td style={officialTd}>{dailyTotal.milk}</td><td style={officialTd}>{dailyTotal.brush}</td>
              <td style={officialTd}>มาเรียน {pct(dailyTotal.present, dailyTotal.checkedTotal)}</td>
            </tr>
          </tbody>
        </table>

        <h4 style={sectionTitle}>2. การดูแลช่วยเหลือนักเรียน</h4>
        <table style={{ fontSize: '14pt' }}>
          <tbody>
            <tr><td style={officialTdLeft}>เยี่ยมบ้านนักเรียนแล้ว</td><td style={{ ...officialTd, width: '30%' }}>{care.visited} จาก {allStudents.length} คน ({pct(care.visited, allStudents.length)})</td></tr>
            <tr><td style={officialTdLeft}>นักเรียนยากจน / ยากจนพิเศษ (จากการเยี่ยมบ้าน)</td><td style={officialTd}>{care.poor} คน</td></tr>
            <tr><td style={officialTdLeft}>นักเรียนที่ควรได้รับทุนการศึกษา</td><td style={officialTd}>{care.scholarship} คน</td></tr>
            <tr><td style={officialTdLeft}>คะแนนความประพฤติต่ำกว่า {LOW_BEHAVIOR_SCORE} คะแนน</td><td style={officialTd}>{care.lowBehavior.length} คน</td></tr>
            <tr><td style={officialTdLeft}>ภาวะโภชนาการไม่สมส่วน (ค่า BMI ล่าสุด เกณฑ์เดียวกับแบบบันทึกน้ำหนัก-ส่วนสูง)</td><td style={officialTd}>{care.bmiFlags.length} คน</td></tr>
          </tbody>
        </table>
        {care.lowBehavior.length > 0 && (
          <table style={{ fontSize: '13pt', marginTop: 6 }}>
            <thead><tr><th style={officialTh}>ที่</th><th style={officialTh}>ชื่อ - สกุล</th><th style={officialTh}>ชั้น</th><th style={officialTh}>คะแนนความประพฤติ</th></tr></thead>
            <tbody>
              {care.lowBehavior.map((x, i) => (
                <tr key={x.s.id}><td style={officialTd}>{i + 1}</td><td style={officialTdLeft}>{x.s.name}</td><td style={officialTd}>{x.s.classLabel}</td><td style={officialTd}>{x.score}</td></tr>
              ))}
            </tbody>
          </table>
        )}

        <h4 style={sectionTitle}>3. วิชาการ</h4>
        <table style={{ fontSize: '14pt' }}>
          <thead><tr><th style={officialTh}>ชั้น</th><th style={officialTh}>นักเรียนที่มีผลการเรียน</th><th style={officialTh}>GPA เฉลี่ย</th><th style={officialTh}>กลุ่มเสี่ยง (GPA ต่ำกว่า {LOW_GPA})</th></tr></thead>
          <tbody>
            {academic.perClass.map(c => (
              <tr key={c.label}><td style={officialTd}>{c.label}</td><td style={officialTd}>{c.count}</td><td style={officialTd}>{c.count ? c.avg.toFixed(2) : '-'}</td><td style={officialTd}>{c.risk.length}</td></tr>
            ))}
            <tr className="shade" style={{ background: SHADE, fontWeight: 700 }}>
              <td style={officialTd}>เฉลี่ยทั้งโรงเรียน</td><td style={officialTd}></td>
              <td style={officialTd}>{academic.schoolAvg ? academic.schoolAvg.toFixed(2) : '-'}</td><td style={officialTd}>{academic.riskCount}</td>
            </tr>
          </tbody>
        </table>
        <div className="no-print" style={{ marginTop: 6 }}>
          วิเคราะห์รายกลุ่มสาระและรายวิชาเพิ่มเติม: <Link to="/academic-summary">สรุปผลสัมฤทธิ์ 8 กลุ่มสาระ</Link>
        </div>

        <SignatureBlock signers={[{ role: 'ผู้รายงาน' }, DIRECTOR_SIGNER]} />
      </OfficialDocument>

      <style>{`@media print { @page { size: A4 portrait; margin: 15mm 15mm 15mm 20mm; } .print-area { padding: 0 !important; } }`}</style>
    </SmartSchoolLayout>
  );
}

function Stat({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div style={{ background: 'white', borderRadius: 12, padding: '12px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderLeft: `4px solid ${warn ? '#DC2626' : '#7C3AED'}` }}>
      <div style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 900, color: warn ? '#B91C1C' : '#0F172A' }}>{value}</div>
      {sub && <div style={{ fontSize: '0.78rem', color: '#64748B' }}>{sub}</div>}
    </div>
  );
}

const paper: React.CSSProperties = { background: 'white', maxWidth: '210mm', margin: '0 auto', padding: '15mm 15mm 15mm 20mm', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' };
const sectionTitle: React.CSSProperties = { fontSize: '16pt', fontWeight: 700, margin: '12pt 0 4pt' };
const inputStyle: React.CSSProperties = { padding: '7px 10px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.9rem' };
const printBtn: React.CSSProperties = { background: '#7C3AED', color: 'white', border: 'none', borderRadius: 8, padding: '8px 14px', fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
