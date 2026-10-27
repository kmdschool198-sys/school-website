import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useSchoolRoster } from '../utils/useSchoolRoster';
import { findDmcStudent } from '../data/dmcStudentMaster';
import { ChevronLeft, Printer } from 'lucide-react';
import { useTeacherAuth } from '../utils/teacherAuth';
import TeacherLoginGate from '../components/TeacherLoginGate';

const THAI_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const DIRECTOR_NAME = 'นายปรัชญา ปรางค์ชัยภูมิ';

function getBmiInterpretation(bmi?: number): string {
  if (!bmi || bmi <= 0) return '-';
  if (bmi < 16) return 'ผอมมาก';
  if (bmi < 18.5) return 'ค่อนข้างผอม';
  if (bmi < 23) return 'สมส่วน';
  if (bmi < 25) return 'ท้วม';
  return 'เริ่มอ้วน';
}

export default function BodyMetricsPrintPage() {
  const auth = useTeacherAuth();
  if (!auth.authed) return <TeacherLoginGate title="🖨️ พิมพ์แบบบันทึกน้ำหนัก-ส่วนสูงราชการ" />;
  return <App />;
}

function App() {
  const { classes: availableClasses } = useSchoolRoster();
  const [classId, setClassId] = useState('');
  const [term, setTerm] = useState<1 | 2>(1);
  const [year, setYear] = useState(2569);
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    return onSnapshot(collection(db, 'log_body_metrics'), snap => {
      const arr: any[] = [];
      snap.forEach(d => arr.push(d.data()));
      setLogs(arr);
    });
  }, []);

  useEffect(() => {
    if (!classId && availableClasses.length) setClassId(availableClasses[0].id);
  }, [availableClasses, classId]);

  const current = availableClasses.find(c => c.id === classId);
  const students = current?.students || [];

  // Term months — 1 = พ.ค.-ต.ค. (5-10), 2 = พ.ย.-เม.ย. (11-12, 1-4)
  const termMonths: number[] = term === 1 ? [5, 6, 7, 8, 9, 10] : [11, 12, 1, 2, 3, 4];

  // For each student × month → latest measurement (fallback to DMC baseline on first month of term)
  const getMeasurement = (studentCode: string | undefined, studentName: string, classLabel: string, m: number) => {
    const ceYear = year - 543;
    const effectiveYear = (term === 2 && m <= 4) ? ceYear + 1 : ceYear;
    const monthStr = String(m).padStart(2, '0');
    const yrStr = String(effectiveYear);
    const matches = logs.filter(l =>
      (l.classLabel === classLabel || !l.classLabel) &&
      (l.studentName === studentName || (l.studentName && studentName.includes(l.studentName.slice(-15)))) &&
      l.date && l.date.startsWith(`${yrStr}-${monthStr}`)
    );
    if (matches.length > 0) {
      const latest = matches.sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0];
      return { weight: latest.weight || '', height: latest.height || '', bmi: latest.bmi };
    }
    if ((term === 1 && m === 5) || (term === 2 && m === 11)) {
      const dmc = findDmcStudent(studentCode, studentName);
      if (dmc) return { weight: dmc.weight || '', height: dmc.height || '', bmi: dmc.bmi };
    }
    return { weight: '', height: '', bmi: undefined };
  };

  return (
    <div style={{ minHeight: '100vh', background: '#FFF7ED' }}>
      <header className="no-print" style={{ background: 'linear-gradient(135deg,#BE185D,#EC4899)', color: 'white', padding: '1.2rem 1.25rem' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Link to="/body-metrics" style={lnk}><ChevronLeft size={16} />กลับหน้าบันทึก</Link>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: '1.2rem', fontWeight: 900 }}>🖨️ แบบบันทึกน้ำหนัก-ส่วนสูงและภาวะโภชนาการ (ฟอร์มราชการ)</div>
            <div style={{ fontSize: '0.78rem', opacity: 0.9 }}>พิมพ์รายภาคเรียน · A4 แนวนอน · โรงเรียนบ้านคลองมดแดง</div>
          </div>
          <select value={classId} onChange={e => setClassId(e.target.value)} style={inp}>
            {availableClasses.map(c => <option key={c.id} value={c.id}>{c.label} ({c.students.length} คน)</option>)}
          </select>
          <select value={term} onChange={e => setTerm(Number(e.target.value) as 1 | 2)} style={inp}>
            <option value={1}>ภาคเรียนที่ 1</option>
            <option value={2}>ภาคเรียนที่ 2</option>
          </select>
          <input type="number" value={year} onChange={e => setYear(Number(e.target.value))} style={{ ...inp, width: 86 }} />
          <button onClick={() => window.print()} style={btnPrint}><Printer size={16} /> สั่งพิมพ์ A4</button>
        </div>
      </header>

      <div className="print-area" style={{
        background: 'white', maxWidth: '297mm', margin: '14px auto',
        padding: '10mm 12mm', boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        fontFamily: "'Sarabun', sans-serif", color: '#000',
      }}>
        {/* Official Header */}
        <div style={{ textAlign: 'center', marginBottom: 10 }}>
          <img
            src={`${import.meta.env.BASE_URL}images/school-logo.png`}
            alt="ตราโรงเรียน"
            style={{ width: 46, height: 46, objectFit: 'contain', marginBottom: 2 }}
          />
          <div style={{ fontWeight: 900, fontSize: '13.5pt', lineHeight: 1.25 }}>
            แบบบันทึกน้ำหนัก - ส่วนสูง และเฝ้าระวังภาวะโภชนาการนักเรียน
          </div>
          <div style={{ fontWeight: 800, fontSize: '11pt', lineHeight: 1.3 }}>
            โรงเรียนบ้านคลองมดแดง &nbsp; สำนักงานเขตพื้นที่การศึกษาประถมศึกษากำแพงเพชร เขต 2
          </div>
          <div style={{ fontSize: '10.5pt', marginTop: 2 }}>
            ระดับชั้น <b>{current?.fullClassName || current?.label || '-'}</b> &nbsp;·&nbsp;
            ภาคเรียนที่ <b>{term}</b> ปีการศึกษา <b>{year}</b> &nbsp;·&nbsp;
            จำนวนนักเรียน <b>{students.length}</b> คน (ชาย {current?.maleCount || 0} / หญิง {current?.femaleCount || 0})
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9.5pt' }}>
          <thead>
            <tr style={{ background: '#F1F5F9' }}>
              <th rowSpan={2} style={{ ...th, width: '3.5%' }}>เลขที่</th>
              <th rowSpan={2} style={{ ...th, width: '7.5%' }}>รหัสประจำตัว</th>
              <th rowSpan={2} style={{ ...th, width: '21%', textAlign: 'left', paddingLeft: 6 }}>ชื่อ - นามสกุล</th>
              {termMonths.map(m => (
                <th key={m} colSpan={2} style={th}>{THAI_MONTHS[m - 1]}</th>
              ))}
              <th rowSpan={2} style={{ ...th, width: '6%' }}>BMI</th>
              <th rowSpan={2} style={{ ...th, width: '9%' }}>แปลผลภาวะ<br />โภชนาการ</th>
            </tr>
            <tr style={{ background: '#F8FAFC' }}>
              {termMonths.map(m => [
                <th key={`w${m}`} style={{ ...th, fontSize: '8pt' }}>นน.<br />(กก.)</th>,
                <th key={`h${m}`} style={{ ...th, fontSize: '8pt' }}>สส.<br />(ซม.)</th>,
              ])}
            </tr>
          </thead>
          <tbody>
            {students.map((s, i) => {
              // Latest available BMI in the term or DMC baseline
              const dmc = findDmcStudent(s.code, s.name);
              let latestBmi = s.bmi ?? dmc?.bmi;
              termMonths.forEach(m => {
                const mes = getMeasurement(s.code, s.name, current?.label || '', m);
                if (mes.bmi) latestBmi = mes.bmi;
                else if (mes.weight && mes.height) {
                  latestBmi = Math.round((Number(mes.weight) / Math.pow(Number(mes.height) / 100, 2)) * 10) / 10;
                }
              });

              return (
                <tr key={s.id}>
                  <td style={td}>{i + 1}</td>
                  <td style={td}>{s.code || '-'}</td>
                  <td style={{ ...td, textAlign: 'left', paddingLeft: 6 }}>{s.name}</td>
                  {termMonths.map(m => {
                    const mes = getMeasurement(s.code, s.name, current?.label || '', m);
                    return [
                      <td key={`w${m}`} style={td}>{mes.weight || ''}</td>,
                      <td key={`h${m}`} style={td}>{mes.height || ''}</td>,
                    ];
                  })}
                  <td style={{ ...td, fontWeight: 700 }}>{latestBmi || '-'}</td>
                  <td style={td}>{getBmiInterpretation(latestBmi)}</td>
                </tr>
              );
            })}
            {students.length === 0 && (
              <tr>
                <td colSpan={termMonths.length * 2 + 5} style={{ ...td, padding: 24, color: '#94A3B8' }}>
                  ยังไม่มีรายชื่อนักเรียน
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div style={{ marginTop: 22, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 30, textAlign: 'center', fontSize: '10.5pt' }}>
          <div>
            <div>ลงชื่อ ....................................................... ครูประจำชั้น/ผู้บันทึก</div>
            <div style={{ marginTop: 4 }}>({current?.homeroomTeacher || '.......................................................'})</div>
            <div style={{ marginTop: 2 }}>ครูประจำชั้น {current?.label}</div>
          </div>
          <div>
            <div>ลงชื่อ ....................................................... ผู้รับรองข้อมูล</div>
            <div style={{ marginTop: 4 }}>({DIRECTOR_NAME})</div>
            <div style={{ marginTop: 2 }}>ผู้อำนวยการโรงเรียนบ้านคลองมดแดง</div>
          </div>
        </div>
      </div>

      <style>{`@media print {
        @page { size: A4 landscape; margin: 8mm; }
        body { background: white !important; }
        .no-print { display: none !important; }
        .print-area { box-shadow: none !important; margin: 0 !important; padding: 2mm !important; max-width: 100% !important; }
      }`}</style>
    </div>
  );
}

const lnk: React.CSSProperties = { color: 'white', display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontSize: '0.85rem', opacity: 0.9 };
const inp: React.CSSProperties = { padding: '6px 10px', borderRadius: 8, border: 'none', fontSize: '0.85rem', fontWeight: 700 };
const btnPrint: React.CSSProperties = { background: 'white', color: '#7C2D12', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const th: React.CSSProperties = { border: '1px solid #000', padding: '4px 2px', fontSize: '9pt', textAlign: 'center', fontWeight: 800 };
const td: React.CSSProperties = { border: '1px solid #000', padding: '3px 2px', textAlign: 'center', fontSize: '9.5pt' };
