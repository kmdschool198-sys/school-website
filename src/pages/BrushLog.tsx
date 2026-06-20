// ─── Brush Report: auto-derived from attendance, same as MilkReport ───
import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { collection, doc, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { TIMETABLE_BACKUP } from '../data/timetableData';
import { ChevronLeft, LogOut, Download, Sparkles } from 'lucide-react';
import { useTeacherAuth } from '../utils/teacherAuth';
import TeacherLoginGate from '../components/TeacherLoginGate';
import QuickDate from '../components/QuickDate';
import { downloadCsvReport, makeSectionedReportRows, monthLabel, yearLabel, daysInMonth, THAI_MONTHS_FULL } from '../utils/csvReport';

const COLOR = '#06B6D4';
const KG = [{ id: 'kg_a2_1', label: 'อ.2/1' }, { id: 'kg_a3_1', label: 'อ.3/1' }];

interface Student { id: string; code?: string; name: string; }
interface ClassRoster { classId: string; label: string; students: Student[]; }
interface AttDoc { classId: string; date: string; records: Record<string, { status: string; noBrush?: boolean }>; }
type CsvPeriod = 'month' | 'year';
type CsvScope = 'all' | string;

export default function BrushReportPage() {
  const auth = useTeacherAuth();
  if (!auth.authed) return <TeacherLoginGate title="🪥 รายงานการแปรงฟัน" subtitle="ดึงข้อมูลจากการเช็คชื่ออัตโนมัติ" />;
  return <App userName={auth.name} onLogout={auth.logout} />;
}

function App({ userName, onLogout }: { userName: string; onLogout: () => void }) {
  const [classes, setClasses] = useState<ClassRoster[]>([]);
  const [date, setDate] = useState(todayStr());
  const [csvPeriod, setCsvPeriod] = useState<CsvPeriod>('month');
  const [csvScope, setCsvScope] = useState<CsvScope>('all');
  const [allDocs, setAllDocs] = useState<AttDoc[]>([]);

  useEffect(() => {
    return onSnapshot(doc(db, 'config', 'attendance_classes'), snap => {
      if (snap.exists()) {
        const d = snap.data() as { classes: ClassRoster[] };
        if (d.classes?.length) setClasses(d.classes);
      }
    });
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, 'attendance'));
        const arr: AttDoc[] = [];
        snap.forEach(d => arr.push(d.data() as AttDoc));
        setAllDocs(arr);
      } catch (e) { console.error(e); }
    })();
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

  const totalStudents = availableClasses.reduce((s, c) => s + c.students.length, 0);
  const month = date.slice(0, 7);
  const year = date.slice(0, 4);

  const dayDocs = useMemo(() => allDocs.filter(d => d.date === date), [allDocs, date]);
  const dayPerClass = useMemo(() => availableClasses.map(c => {
    const doc = dayDocs.find(d => d.classId === c.id);
    let p = 0;
    if (doc) Object.values(doc.records || {}).forEach((r: any) => { if (r.status === 'present' && !r.noBrush) p++; });
    return { c, brush: p, checked: !!doc };
  }), [availableClasses, dayDocs]);

  const dayTotal = dayPerClass.reduce((s, x) => s + x.brush, 0);

  const monthPerClass = useMemo(() => availableClasses.map(c => {
    const docs = allDocs.filter(d => d.classId === c.id && d.date.startsWith(month));
    let totalBrush = 0;
    const days = new Set<string>();
    docs.forEach(d => {
      days.add(d.date);
      Object.values(d.records || {}).forEach((r: any) => { if (r.status === 'present' && !r.noBrush) totalBrush++; });
    });
    return { c, totalBrush, days: days.size };
  }), [availableClasses, allDocs, month]);

  const historyDates = useMemo(() => {
    const dates = Array.from(new Set(allDocs.map(d => d.date))).sort().reverse();
    return dates.slice(0, 30);
  }, [allDocs]);

  const exportCsv = () => {
    const targetClasses = csvScope === 'all'
      ? availableClasses
      : availableClasses.filter(c => c.id === csvScope);
    const sections = targetClasses.map(classItem => {
      const classDocs = allDocs.filter(docItem => docItem.classId === classItem.id);
      const rows = csvPeriod === 'month'
        ? classItem.students.map((student, index) => {
          let totalBrush = 0;
          let totalNoBrush = 0;
          const dailyMarks = daysInMonth(month).map(dayNumber => {
            const dateText = `${month}-${String(dayNumber).padStart(2, '0')}`;
            const docItem = classDocs.find(d => d.date === dateText);
            const record = docItem?.records?.[student.id];
            if (!record) return '';
            const didBrush = record.status === 'present' && !record.noBrush;
            if (didBrush) {
              totalBrush++;
              return '✓';
            }
            totalNoBrush++;
            return '✗';
          });

          return [
            String(index + 1),
            student.code || '-',
            student.name,
            ...dailyMarks,
            String(totalBrush),
            String(totalNoBrush),
          ];
        })
        : classItem.students.map((student, index) => {
          const row = [String(index + 1), student.code || '-', student.name];
          let totalBrush = 0;
          let totalDays = 0;
          THAI_MONTHS_FULL.forEach((_, monthIndex) => {
            const prefix = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
            let monthBrush = 0;
            let monthDays = 0;
            classDocs.filter(docItem => docItem.date.startsWith(prefix)).forEach(docItem => {
              const record = docItem.records?.[student.id];
              if (!record) return;
              monthDays++;
              if (record.status === 'present' && !record.noBrush) monthBrush++;
            });
            totalBrush += monthBrush;
            totalDays += monthDays;
            row.push(monthDays ? `${monthBrush}/${monthDays}` : '-');
          });
          row.push(String(totalBrush), String(totalDays));
          return row;
        });

      return {
        title: `ชั้น ${classItem.label}`,
        headers: csvPeriod === 'month'
          ? ['ที่', 'รหัส', 'ชื่อ-สกุล', ...daysInMonth(month).map(String), 'รวมแปรง', 'รวมไม่แปรง']
          : ['ที่', 'รหัส', 'ชื่อ-สกุล', ...THAI_MONTHS_FULL.map(m => `${m} (แปรง/ทั้งหมด)`), 'รวมแปรง', 'จำนวนวันที่มีข้อมูล'],
        rows: rows.length ? rows : [['-', '-', 'ยังไม่มีรายชื่อนักเรียน']],
      };
    });
    const reportRows = makeSectionedReportRows({
      title: 'รายงานการแปรงฟัน โรงเรียนบ้านคลองมดแดง',
      subtitle: csvPeriod === 'month' ? `รายเดือน ${monthLabel(month)}` : `รายปี ${yearLabel(year)}`,
      meta: [['ขอบเขต', csvScope === 'all' ? 'ทุกชั้น' : `ชั้น ${targetClasses[0]?.label || '-'}`], ['ผู้ส่งออก', userName], ['วันที่สร้างไฟล์', new Date().toLocaleString('th-TH')]],
      sections,
      footerRows: [['คำอธิบาย', csvPeriod === 'month' ? '✓ = แปรงฟัน, ✗ = ไม่แปรง/ขาด/ลา, ช่องว่าง = ยังไม่มีข้อมูล' : 'ช่องรายปีแสดงจำนวนแปรง/จำนวนวันที่มีข้อมูล']],
    });
    downloadCsvReport(`รายงานแปรงฟัน_${csvScope === 'all' ? 'ทุกชั้น' : targetClasses[0]?.label || 'ชั้น'}_${csvPeriod === 'month' ? `รายเดือน_${month}` : `รายปี_${year}`}`, reportRows);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#FFF7ED' }}>
      <header style={{ background: `linear-gradient(135deg,${COLOR},#22D3EE)`, color: 'white', padding: '1.2rem 1.25rem' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Link to="/teacher-hub" style={lnk}><ChevronLeft size={16} />Hub</Link>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 900 }}>🪥 รายงานการแปรงฟัน</div>
            <div style={{ fontSize: '0.78rem', opacity: 0.9 }}>ดึงจากการเช็คชื่ออัตโนมัติ · {userName}</div>
          </div>
          <Link to="/print-form/brush" style={{ ...btnLogout, textDecoration: 'none' }}>🖨️ พิมพ์ฟอร์ม</Link>
          <Link to="/milk-report" style={{ ...btnLogout, textDecoration: 'none' }}>🥛 → นม</Link>
          <button onClick={onLogout} style={btnLogout}><LogOut size={12} />ออก</button>
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '1.25rem' }}>
        <div style={{ background: '#CFFAFE', border: '1px solid #67E8F9', color: '#0E7490', borderRadius: 10, padding: '12px 16px', marginBottom: 14, display: 'flex', gap: 10, alignItems: 'center' }}>
          <Sparkles size={20} />
          <div style={{ fontSize: '0.88rem' }}>นักเรียนที่ <b>"มาเรียน"</b> = ได้แปรงฟันโดยปริยาย (ดึงจากระบบเช็คชื่อ)</div>
        </div>

        <div style={{ background: 'white', borderRadius: 12, padding: '1rem', marginBottom: 14, display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <QuickDate value={date} onChange={setDate} color={COLOR} />
          <div>
            <label style={lbl}>ช่วง CSV</label>
            <select value={csvPeriod} onChange={e => setCsvPeriod(e.target.value as CsvPeriod)} style={inp}>
              <option value="month">รายเดือน ({monthLabel(month)})</option>
              <option value="year">รายปี ({yearLabel(year)})</option>
            </select>
          </div>
          <div>
            <label style={lbl}>ขอบเขต CSV</label>
            <select value={csvScope} onChange={e => setCsvScope(e.target.value)} style={inp}>
              <option value="all">ทุกชั้น</option>
              {availableClasses.map(c => <option key={c.id} value={c.id}>ชั้น {c.label}</option>)}
            </select>
          </div>
          <button onClick={exportCsv} style={{ ...btnPrimary, background: COLOR }}><Download size={14} /> โหลด CSV</button>
        </div>

        <div style={{ background: `linear-gradient(135deg,${COLOR},#22D3EE)`, color: 'white', borderRadius: 14, padding: '1.25rem', marginBottom: 14 }}>
          <div style={{ fontSize: '0.85rem', opacity: 0.9, fontWeight: 700, letterSpacing: 1 }}>📊 สรุปวันที่ {fmtThai(date)}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginTop: 12 }}>
            <BigStat label="นักเรียนทั้งหมด" value={totalStudents} color="#FCD34D" />
            <BigStat label="🪥 ได้แปรงฟัน" value={dayTotal} color="#10B981" />
            <BigStat label="%" value={totalStudents ? Math.round((dayTotal / totalStudents) * 100) + '%' : '-'} color="#A7F3D0" />
          </div>
        </div>

        <div style={{ background: 'white', borderRadius: 12, padding: '1rem', marginBottom: 14 }}>
          <h6 style={{ fontWeight: 800, color: '#0F172A', marginBottom: 12 }}>📋 แยกตามชั้น</h6>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ background: '#F1F5F9' }}>
                <th style={th}>ชั้น</th><th style={th}>นักเรียน</th><th style={th}>🪥 แปรงฟัน</th><th style={th}>%</th><th style={th}>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {dayPerClass.map(x => {
                const pct = x.c.students.length ? Math.round((x.brush / x.c.students.length) * 100) : 0;
                return (
                  <tr key={x.c.id} style={{ borderBottom: '1px solid #FFF7ED' }}>
                    <td style={{ ...td, textAlign: 'left', fontWeight: 700 }}>{x.c.label}</td>
                    <td style={td}>{x.c.students.length}</td>
                    <td style={{ ...td, color: COLOR, fontWeight: 800 }}>{x.brush}</td>
                    <td style={{ ...td, fontWeight: 700 }}>{x.checked ? `${pct}%` : '-'}</td>
                    <td style={td}>{x.checked
                      ? <span style={{ background: '#CFFAFE', color: '#0E7490', padding: '2px 8px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700 }}>✓</span>
                      : <span style={{ background: '#F1F5F9', color: '#94A3B8', padding: '2px 8px', borderRadius: 999, fontSize: '0.72rem' }}>⏳</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ background: 'white', borderRadius: 12, padding: '1rem', marginBottom: 14 }}>
          <h6 style={{ fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>📅 สรุปเดือน {month}</h6>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem', marginTop: 10 }}>
            <thead>
              <tr style={{ background: '#F1F5F9' }}>
                <th style={th}>ชั้น</th><th style={th}>วันที่เช็ค</th><th style={th}>🪥 รวมครั้ง</th><th style={th}>เฉลี่ย/วัน</th>
              </tr>
            </thead>
            <tbody>
              {monthPerClass.map(x => (
                <tr key={x.c.id} style={{ borderBottom: '1px solid #FFF7ED' }}>
                  <td style={{ ...td, textAlign: 'left', fontWeight: 700 }}>{x.c.label}</td>
                  <td style={td}>{x.days}</td>
                  <td style={{ ...td, color: COLOR, fontWeight: 800 }}>{x.totalBrush}</td>
                  <td style={td}>{x.days ? Math.round(x.totalBrush / x.days) : 0}</td>
                </tr>
              ))}
              <tr style={{ background: '#FFF7ED', fontWeight: 900 }}>
                <td style={{ ...td, textAlign: 'left' }}>รวมทั้งหมด</td>
                <td style={td}>—</td>
                <td style={{ ...td, color: COLOR }}>{monthPerClass.reduce((s, x) => s + x.totalBrush, 0)}</td>
                <td style={td}>—</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style={{ background: 'white', borderRadius: 12, padding: '1rem' }}>
          <h6 style={{ fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>🗓️ ย้อนประวัติ (30 วันล่าสุด)</h6>
          <p style={{ fontSize: '0.78rem', color: '#94A3B8', marginBottom: 12 }}>คลิกวันที่เพื่อดูรายงานของวันนั้น</p>
          {historyDates.length === 0 ? (
            <div style={{ padding: '1rem', textAlign: 'center', color: '#94A3B8' }}>ยังไม่มีประวัติ</div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {historyDates.map(d => {
                let total = 0;
                allDocs.filter(x => x.date === d).forEach(x => {
                  Object.values(x.records || {}).forEach((r: any) => { if (r.status === 'present' && !r.noBrush) total++; });
                });
                return (
                  <button key={d} onClick={() => setDate(d)} style={{
                    padding: '8px 12px', borderRadius: 8, border: d === date ? `2px solid ${COLOR}` : '1px solid #E2E8F0',
                    background: d === date ? '#CFFAFE' : 'white', cursor: 'pointer', textAlign: 'left',
                  }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0F172A' }}>{fmtThai(d)}</div>
                    <div style={{ fontSize: '0.72rem', color: COLOR, fontWeight: 700 }}>🪥 {total}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function BigStat({ label, value, color }: { label: string; value: any; color: string }) {
  return <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: '0.75rem', borderLeft: `4px solid ${color}` }}>
    <div style={{ fontSize: '0.78rem', opacity: 0.9, fontWeight: 700 }}>{label}</div>
    <div style={{ fontSize: '2rem', fontWeight: 900, color, marginTop: 4 }}>{value}</div>
  </div>;
}

const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const fmtThai = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']; return `${d} ${months[m - 1]} ${y + 543}`; };

const lnk: React.CSSProperties = { color: 'white', display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontSize: '0.85rem', opacity: 0.9 };
const inp: React.CSSProperties = { padding: '8px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: '0.9rem', minWidth: 190 };
const lbl: React.CSSProperties = { display: 'block', fontSize: '0.75rem', color: '#64748B', marginBottom: 4, fontWeight: 800 };
const btnPrimary: React.CSSProperties = { background: '#FF6A01', color: 'white', border: 'none', borderRadius: 8, padding: '8px 14px', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const btnLogout: React.CSSProperties = { background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.4)', padding: '6px 12px', borderRadius: 8, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 };
const th: React.CSSProperties = { padding: '10px 12px', fontWeight: 800, fontSize: '0.8rem', textAlign: 'center' };
const td: React.CSSProperties = { padding: '8px 10px', textAlign: 'center' };
