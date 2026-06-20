// Print-friendly monthly form (official school form layout)
// Supports types: attendance / milk / brush — all derived from attendance collection
import { useState, useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { collection, doc, onSnapshot, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { TIMETABLE_BACKUP } from '../data/timetableData';
import { ChevronLeft, Printer, Calendar, Download } from 'lucide-react';
import { useTeacherAuth } from '../utils/teacherAuth';
import TeacherLoginGate from '../components/TeacherLoginGate';
import { downloadCsvReport, makeSectionedReportRows, monthLabel, yearLabel } from '../utils/csvReport';

const KG = [{ id: 'kg_a2_1', label: 'อ.2/1' }, { id: 'kg_a3_1', label: 'อ.3/1' }];

interface Student { id: string; code?: string; name: string; }
interface ClassRoster { classId: string; label: string; students: Student[]; }
interface AttDoc { classId: string; date: string; records: Record<string, { status: string; noMilk?: boolean; noBrush?: boolean }>; }

type FormType = 'attendance' | 'milk' | 'brush';
type CsvPeriod = 'month' | 'year';
type CsvScope = 'class' | 'all';
const FORM_INFO: Record<FormType, { title: string; mark: string; missMark: string; legendDesc: string }> = {
  attendance: { title: 'แบบบันทึกการเข้าเรียน', mark: '✓', missMark: '✗', legendDesc: '✓ = มา · ✗ = ขาด · ล = ลา · / = วันหยุด' },
  milk: { title: 'แบบบันทึกการดื่มนม', mark: '✓', missMark: '−', legendDesc: '✓ = ดื่มนม · − = ไม่ได้รับ (ขาดเรียน/ลา) · / = วันหยุด' },
  brush: { title: 'แบบบันทึกการแปรงฟัน', mark: '✓', missMark: '✗', legendDesc: '✓ = แปรงฟัน · ✗ = ไม่ได้แปรง (ขาดเรียน/ลา) · / = วันหยุด' },
};

const THAI_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

export default function MonthlyFormPrintPage() {
  const auth = useTeacherAuth();
  if (!auth.authed) return <TeacherLoginGate title="🖨️ พิมพ์ฟอร์มรายเดือน" />;
  return <App />;
}

function App() {
  const { type = 'attendance' } = useParams<{ type: FormType }>();
  const formType = (type === 'milk' || type === 'brush' || type === 'attendance') ? type : 'attendance';
  const info = FORM_INFO[formType];

  const [classes, setClasses] = useState<ClassRoster[]>([]);
  const [classId, setClassId] = useState('');
  const [month, setMonth] = useState(thisMonth());
  const [csvPeriod, setCsvPeriod] = useState<CsvPeriod>('month');
  const [csvScope, setCsvScope] = useState<CsvScope>('class');
  const [docs, setDocs] = useState<AttDoc[]>([]);
  const [holidays, setHolidays] = useState<Record<string, string>>({}); // date → name

  useEffect(() => {
    return onSnapshot(doc(db, 'config', 'attendance_classes'), snap => {
      if (snap.exists()) {
        const d = snap.data() as { classes: ClassRoster[] };
        if (d.classes?.length) setClasses(d.classes);
      }
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

  useEffect(() => {
    if (!classId) return;
    (async () => {
      const snap = await getDocs(query(collection(db, 'attendance'), where('classId', '==', classId)));
      const arr: AttDoc[] = [];
      snap.forEach(d => arr.push(d.data() as AttDoc));
      setDocs(arr);
    })();
  }, [classId]);

  // Load holidays from activities collection (where isHoliday=true)
  useEffect(() => {
    return onSnapshot(collection(db, 'activities'), snap => {
      const map: Record<string, string> = {};
      snap.forEach(d => {
        const a = d.data() as any;
        if (a.isHoliday && a.date) map[a.date] = a.title || 'วันหยุด';
      });
      setHolidays(map);
    });
  }, []);

  const current = availableClasses.find(c => c.id === classId);
  const students = current?.students || [];

  // Build daily map for the month
  const [yearStr, monStr] = month.split('-');
  const year = Number(yearStr);
  const monthNum = Number(monStr);
  const daysInMonth = new Date(year, monthNum, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // For each student × day → status
  const didTarget = (rec: { status: string; noMilk?: boolean; noBrush?: boolean }) => {
    if (rec.status !== 'present') return false;
    if (formType === 'milk') return !rec.noMilk;
    if (formType === 'brush') return !rec.noBrush;
    return true;
  };

  const statusFor = (studentId: string, day: number): string => {
    const dateStr = `${yearStr}-${monStr}-${String(day).padStart(2, '0')}`;
    const dt = new Date(`${dateStr}T00:00:00`);
    const isWeekend = dt.getDay() === 0 || dt.getDay() === 6;
    const isHoliday = !!holidays[dateStr];
    const doc = docs.find(d => d.date === dateStr);
    if (!doc) return (isWeekend || isHoliday) ? '/' : '';
    const rec = doc.records?.[studentId];
    if (!rec) return (isWeekend || isHoliday) ? '/' : '';
    if (rec.status === 'present') return didTarget(rec) ? info.mark : info.missMark;
    if (rec.status === 'absent') return info.missMark;
    if (rec.status === 'leave') return formType === 'attendance' ? 'ล' : info.missMark;
    return '';
  };

  // Summary per student for the month
  const summaryFor = (studentId: string) => {
    let present = 0, absent = 0, leave = 0, totalDays = 0;
    days.forEach(d => {
      const dateStr = `${yearStr}-${monStr}-${String(d).padStart(2, '0')}`;
      const doc = docs.find(x => x.date === dateStr);
      if (!doc) return;
      const rec = doc.records?.[studentId];
      if (!rec) return;
      totalDays++;
      if (didTarget(rec)) present++;
      else if (rec.status === 'absent') absent++;
      else if (rec.status === 'leave') leave++;
    });
    return { present, absent, leave, totalDays };
  };

  const exportCsv = async () => {
    if (!current) return;
    const docsForCsv = csvScope === 'all'
      ? await loadDocsForCsv()
      : docs;
    const targetClasses = csvScope === 'all' ? availableClasses : [current];

    const statusForDocs = (sourceDocs: AttDoc[], studentId: string, day: number): string => {
      const dateStr = `${yearStr}-${monStr}-${String(day).padStart(2, '0')}`;
      const dt = new Date(`${dateStr}T00:00:00`);
      const isWeekend = dt.getDay() === 0 || dt.getDay() === 6;
      const isHoliday = !!holidays[dateStr];
      const doc = sourceDocs.find(d => d.date === dateStr);
      if (!doc) return (isWeekend || isHoliday) ? '/' : '';
      const rec = doc.records?.[studentId];
      if (!rec) return (isWeekend || isHoliday) ? '/' : '';
      if (rec.status === 'present') return didTarget(rec) ? info.mark : info.missMark;
      if (rec.status === 'absent') return info.missMark;
      if (rec.status === 'leave') return formType === 'attendance' ? 'ล' : info.missMark;
      return '';
    };

    const summaryForDocs = (sourceDocs: AttDoc[], studentId: string) => {
      let present = 0, totalDays = 0;
      days.forEach(d => {
        const dateStr = `${yearStr}-${monStr}-${String(d).padStart(2, '0')}`;
        const doc = sourceDocs.find(x => x.date === dateStr);
        const rec = doc?.records?.[studentId];
        if (!rec) return;
        totalDays++;
        if (didTarget(rec)) present++;
      });
      return { present, totalDays };
    };

    const sections = targetClasses.map(classItem => {
      const classDocs = docsForCsv.filter(docItem => docItem.classId === classItem.id);
      const rows = csvPeriod === 'month'
        ? classItem.students.map((s, i) => {
        const row = [String(i + 1), s.code || '', s.name];
        days.forEach(d => row.push(statusForDocs(classDocs, s.id, d) || '-'));
        const sum = summaryForDocs(classDocs, s.id);
        row.push(formType === 'attendance' ? `${sum.present}/${sum.totalDays}` : `${sum.present} ครั้ง`);
        return row;
      })
        : classItem.students.map((s, i) => {
        const row = [String(i + 1), s.code || '', s.name];
        let yearPresent = 0;
        let yearTotal = 0;
        THAI_MONTHS.forEach((_, idx) => {
          const prefix = `${yearStr}-${String(idx + 1).padStart(2, '0')}`;
          let monthPresent = 0;
          let monthTotal = 0;
          classDocs.filter(d => d.date.startsWith(prefix)).forEach(docItem => {
            const rec = docItem.records?.[s.id];
            if (!rec) return;
            monthTotal++;
            if (didTarget(rec)) monthPresent++;
          });
          yearPresent += monthPresent;
          yearTotal += monthTotal;
          row.push(monthTotal ? `${monthPresent}/${monthTotal}` : '-');
        });
        row.push(formType === 'attendance' ? `${yearPresent}/${yearTotal}` : `${yearPresent} ครั้ง`);
        return row;
      });

      return {
        title: `ชั้น ${classItem.label}`,
        headers: csvPeriod === 'month'
          ? ['ที่', 'รหัส', 'ชื่อ-สกุล', ...days.map(String), 'สรุปผล']
          : ['ที่', 'รหัส', 'ชื่อ-สกุล', ...THAI_MONTHS.map(m => `${m} (ได้/ทั้งหมด)`), 'สรุปผล'],
        rows: rows.length ? rows : [['-', '-', 'ยังไม่มีรายชื่อนักเรียน']],
      };
    });

    const reportRows = makeSectionedReportRows({
      title: `${info.title} โรงเรียนบ้านคลองมดแดง`,
      subtitle: csvPeriod === 'month' ? `รายเดือน ${monthLabel(month)}` : `รายปี ${yearLabel(yearStr)}`,
      meta: [['ขอบเขต', csvScope === 'all' ? 'ทุกชั้น' : `ชั้น ${current.label}`], ['วันที่สร้างไฟล์', new Date().toLocaleString('th-TH')]],
      sections,
      footerRows: [['คำอธิบาย', csvPeriod === 'month' ? info.legendDesc : 'ช่องรายปีแสดงจำนวนที่ทำได้/จำนวนวันที่มีข้อมูล']],
    });
    downloadCsvReport(`รายงาน_${info.title}_${csvScope === 'all' ? 'ทุกชั้น' : current.label}_${csvPeriod === 'month' ? `รายเดือน_${month}` : `รายปี_${yearStr}`}`, reportRows);
  };

  const loadDocsForCsv = async () => {
    const start = csvPeriod === 'month' ? `${month}-01` : `${yearStr}-01-01`;
    const end = csvPeriod === 'month' ? `${month}-31` : `${yearStr}-12-31`;
    const snap = await getDocs(query(collection(db, 'attendance'), where('date', '>=', start), where('date', '<=', end)));
    const arr: AttDoc[] = [];
    snap.forEach(d => arr.push(d.data() as AttDoc));
    return arr;
  };

  return (
    <div style={{ minHeight: '100vh', background: '#FFF7ED' }}>
      {/* No-print toolbar */}
      <header className="no-print" style={{ background: 'linear-gradient(135deg,#FF6A01,#FB923C)', color: 'white', padding: '1.2rem 1.25rem' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Link to="/teacher-hub" style={lnk}><ChevronLeft size={16} />Hub</Link>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: '1.2rem', fontWeight: 900 }}>🖨️ {info.title} (รายเดือน)</div>
            <div style={{ fontSize: '0.78rem', opacity: 0.9 }}>พิมพ์ตามแบบฟอร์มราชการ A4 แนวนอน</div>
          </div>
          <select value={classId} onChange={e => setClassId(e.target.value)} style={inp}>
            {availableClasses.map(c => <option key={c.id} value={c.id}>{c.label} ({c.students.length} คน)</option>)}
          </select>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
            <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={inp} />
            <span style={{ fontSize: '0.72rem', opacity: 0.95, fontWeight: 700, color: '#FCD34D' }}>
              📅 {THAI_MONTHS[monthNum - 1]} พ.ศ.{year + 543}
            </span>
          </div>
          <select value={csvPeriod} onChange={e => setCsvPeriod(e.target.value as CsvPeriod)} style={inp}>
            <option value="month">CSV รายเดือน</option>
            <option value="year">CSV รายปี</option>
          </select>
          <select value={csvScope} onChange={e => setCsvScope(e.target.value as CsvScope)} style={inp}>
            <option value="class">CSV ห้องนี้</option>
            <option value="all">CSV ทุกชั้น</option>
          </select>
          <button onClick={exportCsv} style={btnCsv}>
            <Download size={16} /> โหลด CSV
          </button>
          <button onClick={() => window.print()} style={btnPrint}>
            <Printer size={16} /> พิมพ์
          </button>
        </div>
      </header>

      {/* Print area */}
      <div className="print-area" style={{ background: 'white', maxWidth: '297mm', margin: '14px auto', padding: '10mm 12mm', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
        {/* Form header */}
        <div style={{ textAlign: 'center', marginBottom: 10 }}>
          <div style={{ fontWeight: 900, fontSize: '1.1rem' }}>{info.title}</div>
          <div style={{ fontSize: '0.95rem' }}>โรงเรียนบ้านคลองมดแดง</div>
          <div style={{ fontSize: '0.9rem' }}>
            ชั้น <b>{current?.label || '-'}</b> ·
            ประจำเดือน <b>{THAI_MONTHS[monthNum - 1]} พ.ศ. {year + 543}</b>
          </div>
        </div>

        {/* Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', tableLayout: 'fixed' }}>
          <thead>
            <tr style={{ background: '#F1F5F9' }}>
              <th style={{ ...th, width: '4%' }}>ที่</th>
              <th style={{ ...th, width: '20%', textAlign: 'left', paddingLeft: 6 }}>ชื่อ-สกุล</th>
              {days.map(d => {
                const dateStr = `${yearStr}-${monStr}-${String(d).padStart(2, '0')}`;
                const dt = new Date(year, monthNum - 1, d);
                const isWeekend = dt.getDay() === 0 || dt.getDay() === 6;
                const holiday = holidays[dateStr];
                const dayName = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'][dt.getDay()];
                return (
                  <th key={d} title={holiday || ''} style={{
                    ...th, width: `${66 / daysInMonth}%`,
                    background: holiday ? '#FED7AA' : (isWeekend ? '#FEE2E2' : '#F1F5F9'),
                    color: holiday ? '#7C2D12' : (isWeekend ? '#991B1B' : '#0F172A'),
                  }}>
                    <div>{d}</div>
                    <div style={{ fontSize: '8px', fontWeight: 600 }}>{dayName}</div>
                  </th>
                );
              })}
              <th style={{ ...th, width: '10%', background: '#FFEDD5' }}>สรุปผล</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s, i) => {
              const sum = summaryFor(s.id);
              return (
                <tr key={s.id}>
                  <td style={td}>{i + 1}</td>
                  <td style={{ ...td, textAlign: 'left', paddingLeft: 6, fontSize: '11px' }}>{s.name}</td>
                  {days.map(d => {
                    const status = statusFor(s.id, d);
                    const dateStr = `${yearStr}-${monStr}-${String(d).padStart(2, '0')}`;
                    const dt = new Date(year, monthNum - 1, d);
                    const isWeekend = dt.getDay() === 0 || dt.getDay() === 6;
                    const isHoliday = !!holidays[dateStr];
                    let color = '#0F172A';
                    if (status === info.missMark || status === '−') color = '#DC2626';
                    else if (status === 'ล') color = '#D97706';
                    else if (status === '/') color = '#94A3B8';
                    else if (status === info.mark) color = '#16A34A';
                    return (
                      <td key={d} title={holidays[dateStr] || ''} style={{
                        ...td,
                        background: isHoliday ? '#FED7AA' : (isWeekend ? '#FEF2F2' : (status ? 'white' : '#FAFAFA')),
                        color, fontWeight: status ? 800 : 400, fontSize: '11px',
                      }}>{status}</td>
                    );
                  })}
                  <td style={{ ...td, background: '#FFFBEB', fontSize: '10px' }}>
                    {formType === 'attendance'
                      ? `${sum.present}/${sum.totalDays}`
                      : `${sum.present} ครั้ง`}
                  </td>
                </tr>
              );
            })}
            {students.length === 0 && (
              <tr><td colSpan={daysInMonth + 3} style={{ ...td, padding: 30, color: '#94A3B8' }}>ยังไม่มีรายชื่อ</td></tr>
            )}
          </tbody>
        </table>

        {/* Holidays list */}
        {(() => {
          const monthHolidays = Object.entries(holidays).filter(([d]) => d.startsWith(month));
          if (monthHolidays.length === 0) return null;
          return (
            <div style={{ marginTop: 6, fontSize: '10px', color: '#7C2D12', background: '#FED7AA', padding: '4px 8px', borderRadius: 4 }}>
              <b>🗓️ วันหยุดในเดือนนี้:</b> {monthHolidays
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([d, name]) => `${Number(d.split('-')[2])} ${name}`)
                .join(' · ')}
            </div>
          );
        })()}

        {/* Legend */}
        <div style={{ marginTop: 8, fontSize: '10px', color: '#475569', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div><Calendar size={11} style={{ verticalAlign: 'middle' }} /> {info.legendDesc}</div>
          <div>
            <span style={{ background: '#FEE2E2', padding: '0 6px', marginRight: 4 }}>⬛</span> เสาร์-อาทิตย์ ·
            <span style={{ background: '#FED7AA', padding: '0 6px', marginLeft: 6, marginRight: 4 }}>⬛</span> วันหยุดราชการ
          </div>
          <div>จำนวนนักเรียน: <b>{students.length}</b> คน</div>
        </div>

        {/* Signature */}
        <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 30, textAlign: 'center', fontSize: '11px' }}>
          <div>
            <div style={{ borderTop: '1px dashed #94A3B8', marginTop: 30, paddingTop: 4 }}>
              ลงชื่อ ........................................ ครูประจำชั้น
            </div>
          </div>
          <div>
            <div style={{ borderTop: '1px dashed #94A3B8', marginTop: 30, paddingTop: 4 }}>
              ลงชื่อ ........................................ ผู้อำนวยการสถานศึกษา
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 8mm; }
          body { background: white !important; }
          .no-print { display: none !important; }
          .print-area { box-shadow: none !important; margin: 0 !important; padding: 4mm !important; max-width: 100% !important; }
        }
      `}</style>
    </div>
  );
}

function thisMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const lnk: React.CSSProperties = { color: 'white', display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontSize: '0.85rem', opacity: 0.9 };
const inp: React.CSSProperties = { padding: '6px 10px', borderRadius: 8, border: 'none', fontSize: '0.85rem', fontWeight: 700 };
const btnPrint: React.CSSProperties = { background: 'white', color: '#7C2D12', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const btnCsv: React.CSSProperties = { background: 'white', color: '#15803D', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const th: React.CSSProperties = { border: '1px solid #94A3B8', padding: '4px 2px', fontSize: '11px', textAlign: 'center', fontWeight: 800 };
const td: React.CSSProperties = { border: '1px solid #CBD5E1', padding: '3px 2px', textAlign: 'center' };
