import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { TIMETABLE_BACKUP } from '../data/timetableData';
import { ChevronLeft, Printer } from 'lucide-react';
import { useTeacherAuth } from '../utils/teacherAuth';
import TeacherLoginGate from '../components/TeacherLoginGate';

const KG = [{ id: 'kg_a2_1', label: 'อ.2/1' }, { id: 'kg_a3_1', label: 'อ.3/1' }];
const THAI_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

interface Student { id: string; code?: string; name: string; }
interface ClassRoster { classId: string; label: string; students: Student[]; }

export default function BodyMetricsPrintPage() {
  const auth = useTeacherAuth();
  if (!auth.authed) return <TeacherLoginGate title="🖨️ พิมพ์แบบบันทึกน้ำหนัก-ส่วนสูง" />;
  return <App />;
}

function App() {
  const [classes, setClasses] = useState<ClassRoster[]>([]);
  const [classId, setClassId] = useState('');
  const [term, setTerm] = useState<1 | 2>(1);
  const [year, setYear] = useState(new Date().getFullYear() + 543);
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    return onSnapshot(doc(db, 'config', 'attendance_classes'), snap => {
      if (snap.exists()) {
        const d = snap.data() as { classes: ClassRoster[] };
        if (d.classes?.length) setClasses(d.classes);
      }
    });
  }, []);

  useEffect(() => {
    return onSnapshot(collection(db, 'log_body_metrics'), snap => {
      const arr: any[] = [];
      snap.forEach(d => arr.push(d.data()));
      setLogs(arr);
    });
  }, []);

  const availableClasses = useMemo(() => {
    try {
      const profile = (TIMETABLE_BACKUP as any).profiles[Object.keys((TIMETABLE_BACKUP as any).profiles)[0]];
      const rooms = profile.data.rooms as Array<{ id: string; label: string }>;
      const all = [...KG, ...rooms];
      return all.map(r => {
        const c = classes.find(x => x.classId === r.id);
        return { id: r.id, label: r.label, students: c?.students || [] };
      });
    } catch { return classes.map(c => ({ id: c.classId, label: c.label, students: c.students })); }
  }, [classes]);

  useEffect(() => {
    if (!classId && availableClasses.length) setClassId(availableClasses[0].id);
  }, [availableClasses]);

  const current = availableClasses.find(c => c.id === classId);
  const students = current?.students || [];

  // Term months — 1 = พ.ค.-ต.ค. (5-10), 2 = พ.ย.-เม.ย. (11-12, 1-4)
  const termMonths: number[] = term === 1 ? [5, 6, 7, 8, 9, 10] : [11, 12, 1, 2, 3, 4];

  // For each student × month → latest measurement
  const getMeasurement = (studentName: string, classLabel: string, m: number) => {
    const ceYear = year - 543;
    // For term 2 months 1-4, it's actually next CE year
    const effectiveYear = (term === 2 && m <= 4) ? ceYear + 1 : ceYear;
    const monthStr = String(m).padStart(2, '0');
    const yrStr = String(effectiveYear);
    // Find log entries matching: classLabel + studentName + date starts with YYYY-MM
    const matches = logs.filter(l =>
      (l.classLabel === classLabel || !l.classLabel) &&
      (l.studentName === studentName || (l.studentName && studentName.includes(l.studentName.slice(-15)))) &&
      l.date && l.date.startsWith(`${yrStr}-${monthStr}`)
    );
    // Take latest by date
    if (matches.length === 0) return { weight: '', height: '' };
    const latest = matches.sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0];
    return { weight: latest.weight || '', height: latest.height || '' };
  };

  return (
    <div style={{ minHeight: '100vh', background: '#FFF7ED' }}>
      <header className="no-print" style={{ background: 'linear-gradient(135deg,#EC4899,#F472B6)', color: 'white', padding: '1.2rem 1.25rem' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Link to="/teacher-hub" style={lnk}><ChevronLeft size={16} />Hub</Link>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: '1.2rem', fontWeight: 900 }}>🖨️ แบบบันทึกน้ำหนัก-ส่วนสูง</div>
            <div style={{ fontSize: '0.78rem', opacity: 0.9 }}>พิมพ์รายภาคเรียน · A4 แนวนอน</div>
          </div>
          <select value={classId} onChange={e => setClassId(e.target.value)} style={inp}>
            {availableClasses.map(c => <option key={c.id} value={c.id}>{c.label} ({c.students.length} คน)</option>)}
          </select>
          <select value={term} onChange={e => setTerm(Number(e.target.value) as 1 | 2)} style={inp}>
            <option value={1}>ภาคเรียนที่ 1</option>
            <option value={2}>ภาคเรียนที่ 2</option>
          </select>
          <input type="number" value={year} onChange={e => setYear(Number(e.target.value))} style={{ ...inp, width: 80 }} />
          <button onClick={() => window.print()} style={btnPrint}><Printer size={16} /> พิมพ์</button>
        </div>
      </header>

      <div className="print-area" style={{ background: 'white', maxWidth: '297mm', margin: '14px auto', padding: '10mm 12mm', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <div style={{ fontWeight: 900, fontSize: '1.1rem' }}>บันทึกน้ำหนัก-ส่วนสูงนักเรียน</div>
          <div style={{ fontSize: '0.95rem' }}>ภาคเรียนที่ <b>{term}</b> ปีการศึกษา <b>{year}</b></div>
          <div style={{ fontSize: '0.92rem' }}>ชั้น <b>{current?.label || '-'}</b> · โรงเรียนบ้านคลองมดแดง</div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
          <thead>
            <tr style={{ background: '#F1F5F9' }}>
              <th rowSpan={2} style={{ ...th, width: '4%' }}>ที่</th>
              <th rowSpan={2} style={{ ...th, width: '22%', textAlign: 'left', paddingLeft: 6 }}>ชื่อ-สกุล</th>
              {termMonths.map(m => (
                <th key={m} colSpan={2} style={th}>{THAI_MONTHS[m - 1]}</th>
              ))}
              <th rowSpan={2} style={{ ...th, width: '12%', background: '#FFEDD5' }}>บันทึก</th>
            </tr>
            <tr style={{ background: '#F8FAFC' }}>
              {termMonths.map(m => [
                <th key={`w${m}`} style={{ ...th, fontSize: '9px' }}>น้ำหนัก<br/>(กก.)</th>,
                <th key={`h${m}`} style={{ ...th, fontSize: '9px' }}>ส่วนสูง<br/>(ซม.)</th>,
              ])}
            </tr>
          </thead>
          <tbody>
            {students.map((s, i) => (
              <tr key={s.id}>
                <td style={td}>{i + 1}</td>
                <td style={{ ...td, textAlign: 'left', paddingLeft: 6 }}>{s.name}</td>
                {termMonths.map(m => {
                  const mes = getMeasurement(s.name, current?.label || '', m);
                  return [
                    <td key={`w${m}`} style={td}>{mes.weight || ''}</td>,
                    <td key={`h${m}`} style={td}>{mes.height || ''}</td>,
                  ];
                })}
                <td style={{ ...td, background: '#FFFBEB' }}></td>
              </tr>
            ))}
            {students.length === 0 && <tr><td colSpan={termMonths.length * 2 + 3} style={{ ...td, padding: 30, color: '#94A3B8' }}>ยังไม่มีรายชื่อ</td></tr>}
          </tbody>
        </table>

        <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 30, textAlign: 'center', fontSize: '11px' }}>
          <div><div style={{ borderTop: '1px dashed #94A3B8', marginTop: 30, paddingTop: 4 }}>ลงชื่อ ........................................ ครูประจำชั้น</div></div>
          <div><div style={{ borderTop: '1px dashed #94A3B8', marginTop: 30, paddingTop: 4 }}>ลงชื่อ ........................................ ผู้อำนวยการสถานศึกษา</div></div>
        </div>
      </div>

      <style>{`@media print {
        @page { size: A4 landscape; margin: 8mm; }
        body { background: white !important; }
        .no-print { display: none !important; }
        .print-area { box-shadow: none !important; margin: 0 !important; padding: 4mm !important; max-width: 100% !important; }
      }`}</style>
    </div>
  );
}

const lnk: React.CSSProperties = { color: 'white', display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontSize: '0.85rem', opacity: 0.9 };
const inp: React.CSSProperties = { padding: '6px 10px', borderRadius: 8, border: 'none', fontSize: '0.85rem', fontWeight: 700 };
const btnPrint: React.CSSProperties = { background: 'white', color: '#7C2D12', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const th: React.CSSProperties = { border: '1px solid #94A3B8', padding: '4px 2px', fontSize: '10px', textAlign: 'center', fontWeight: 800 };
const td: React.CSSProperties = { border: '1px solid #CBD5E1', padding: '3px 2px', textAlign: 'center', fontSize: '11px' };
