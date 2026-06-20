import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { collection, doc, onSnapshot, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { TIMETABLE_BACKUP } from '../data/timetableData';
import { ChevronLeft, LogOut, Printer, Download, Sparkles, Calendar, Users, CheckCircle } from 'lucide-react';
import { useTeacherAuth } from '../utils/teacherAuth';
import TeacherLoginGate from '../components/TeacherLoginGate';
import { PageLoading } from '../components/PageState';
import { downloadCsvReport, makeReportRows } from '../utils/csvReport';

const COLOR = '#FF6A01';
const KG = [{ id: 'kg_a2_1', label: 'อ.2/1' }, { id: 'kg_a3_1', label: 'อ.3/1' }];

interface Student { id: string; code?: string; name: string; }
interface ClassRoster { classId: string; label: string; students: Student[]; }
interface AttDoc { classId: string; date: string; records: Record<string, { status: string }>; }

const THAI_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

export default function SchoolStatsReportPage() {
  const auth = useTeacherAuth();
  if (!auth.authed) return <TeacherLoginGate title="📊 รายงานสถิติประจำเดือนเสนอ ผอ." subtitle="สรุปข้อมูลการมาเรียน ดื่มนม แปรงฟัน ทั้งโรงเรียน" />;
  return <App userName={auth.name} onLogout={auth.logout} />;
}

function App({ userName, onLogout }: { userName: string; onLogout: () => void }) {
  const [classes, setClasses] = useState<ClassRoster[]>([]);
  const [month, setMonth] = useState(thisMonthStr());
  const [attendanceDocs, setAttendanceDocs] = useState<AttDoc[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch class rosters
  useEffect(() => {
    return onSnapshot(doc(db, 'config', 'attendance_classes'), snap => {
      if (snap.exists()) {
        const d = snap.data() as { classes: ClassRoster[] };
        if (d.classes?.length) setClasses(d.classes);
      }
    });
  }, []);

  // Fetch attendance docs for the selected month
  useEffect(() => {
    if (!month) return;
    setLoading(true);
    const start = `${month}-01`;
    const end = `${month}-31`; // safe end range for Firestore string comparison
    
    const q = query(
      collection(db, 'attendance'),
      where('date', '>=', start),
      where('date', '<=', end)
    );

    getDocs(q)
      .then(snap => {
        const arr: AttDoc[] = [];
        snap.forEach(d => arr.push(d.data() as AttDoc));
        setAttendanceDocs(arr);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching attendance docs:', err);
        setLoading(false);
      });
  }, [month]);

  // Determine available classes from timetable & config
  const availableClasses = useMemo(() => {
    try {
      const profile = (TIMETABLE_BACKUP as any).profiles[Object.keys((TIMETABLE_BACKUP as any).profiles)[0]];
      const rooms = profile.data.rooms as Array<{ id: string; label: string }>;
      const all = [...KG, ...rooms];
      return all.map(r => {
        const c = classes.find(x => x.classId === r.id);
        return { id: r.id, label: r.label, students: c?.students || [] };
      });
    } catch {
      return classes.map(c => ({ id: c.classId, label: c.label, students: c.students }));
    }
  }, [classes]);

  // Calculations per class
  const classStats = useMemo(() => {
    return availableClasses.map(c => {
      const classDocs = attendanceDocs.filter(d => d.classId === c.id);
      const studentCount = c.students.length;
      const checkedDays = classDocs.length;
      
      let totalPresent = 0;
      let totalAbsent = 0;
      let totalLeave = 0;
      let totalMilk = 0;
      let totalBrush = 0;

      classDocs.forEach(d => {
        Object.values(d.records || {}).forEach((r: any) => {
          if (r.status === 'present') {
            totalPresent++;
            if (!r.noMilk) totalMilk++;
            if (!r.noBrush) totalBrush++;
          }
          else if (r.status === 'absent') totalAbsent++;
          else if (r.status === 'leave') totalLeave++;
        });
      });

      const totalCheckedRecords = totalPresent + totalAbsent + totalLeave;
      const attRate = totalCheckedRecords ? Math.round((totalPresent / totalCheckedRecords) * 100) : 0;
      const avgPresent = checkedDays ? Math.round((totalPresent / checkedDays) * 10) / 10 : 0;

      return {
        classId: c.id,
        label: c.label,
        studentCount,
        checkedDays,
        totalPresent,
        avgPresent,
        attRate,
        totalMilk,
        totalBrush
      };
    });
  }, [availableClasses, attendanceDocs]);

  // School-wide summaries
  const schoolSummary = useMemo(() => {
    const totalStudents = classStats.reduce((s, x) => s + x.studentCount, 0);
    const totalMilk = classStats.reduce((s, x) => s + x.totalMilk, 0);
    const totalBrush = classStats.reduce((s, x) => s + x.totalBrush, 0);
    
    // Weighted attendance rate
    let totalCheckedDays = 0;
    let sumAttRates = 0;
    classStats.forEach(x => {
      if (x.checkedDays > 0) {
        totalCheckedDays++;
        sumAttRates += x.attRate;
      }
    });
    const avgAttRate = totalCheckedDays ? Math.round(sumAttRates / totalCheckedDays) : 0;
    const avgDays = classStats.length ? Math.round((classStats.reduce((s, x) => s + x.checkedDays, 0) / classStats.length) * 10) / 10 : 0;

    return {
      totalStudents,
      avgDays,
      avgAttRate,
      totalMilk,
      totalBrush
    };
  }, [classStats]);

  const [yearStr, monStr] = month.split('-');
  const yearNum = Number(yearStr);
  const monthNum = Number(monStr);

  const exportCsv = () => {
    const rows = classStats.map(x => [
        x.label,
        String(x.studentCount),
        String(x.checkedDays),
        String(x.avgPresent),
        `${x.attRate}%`,
        String(x.totalMilk),
        String(x.totalBrush)
      ]);
    const reportRows = makeReportRows({
      title: 'สรุปรายงานสถิติประจำเดือน โรงเรียนบ้านคลองมดแดง',
      subtitle: `ประจำเดือน ${THAI_MONTHS[monthNum - 1]} พ.ศ. ${yearNum + 543}`,
      meta: [['ผู้ส่งออก', userName], ['วันที่สร้างไฟล์', new Date().toLocaleString('th-TH')]],
      headers: ['ชั้น', 'จำนวนนักเรียน', 'วันทำการเช็คชื่อ', 'มาเรียนเฉลี่ย/วัน', 'อัตราการมาเรียน (%)', 'การดื่มนมรวม (กล่อง)', 'การแปรงฟันรวม (ครั้ง)'],
      rows,
      footerRows: [[
        'สรุปภาพรวมโรงเรียน',
        String(schoolSummary.totalStudents),
        String(schoolSummary.avgDays),
        '—',
        `${schoolSummary.avgAttRate}%`,
        String(schoolSummary.totalMilk),
        String(schoolSummary.totalBrush)
      ]],
    });
    downloadCsvReport(`รายงานสถิติประจำเดือน_${month}`, reportRows);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#FFF7ED' }}>
      {/* Header (No-print Toolbar) */}
      <header className="no-print" style={{ background: `linear-gradient(135deg,${COLOR},#FB923C)`, color: 'white', padding: '1.2rem 1.25rem' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Link to="/teacher-hub" style={lnk}><ChevronLeft size={16} />Hub</Link>
          <div style={{ flex: 1, minWidth: 250 }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 900 }}>📊 รายงานสถิติภาพรวมประจำเดือน</div>
            <div style={{ fontSize: '0.78rem', opacity: 0.9 }}>จัดเตรียมพิมพ์เสนอ ผอ. · {userName}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={inp} />
            <button onClick={() => window.print()} style={btnPrint}>
              <Printer size={15} /> พิมพ์รายงาน
            </button>
            <button onClick={exportCsv} style={{ ...btnPrint, color: '#16A34A', border: '1px solid #16A34A' }}>
              <Download size={15} /> ส่งออก CSV
            </button>
            <button onClick={onLogout} style={btnLogout}><LogOut size={12} />ออก</button>
          </div>
        </div>
      </header>

      {/* Main content Dashboard (No-print) */}
      <main className="no-print" style={{ maxWidth: 1200, margin: '0 auto', padding: '1.25rem' }}>
        {/* Sparkle Banner */}
        <div style={{ background: '#FFEDD5', border: '1px solid #FDBA74', color: '#C2410C', borderRadius: 10, padding: '12px 16px', marginBottom: 14, display: 'flex', gap: 10, alignItems: 'center' }}>
          <Sparkles size={20} />
          <div style={{ fontSize: '0.88rem' }}>สถิติของแต่ละวันจะคำนวณจากยอดที่มีการบันทึกการเช็คชื่อมาเรียน โดยยอดดื่มนมและการแปรงฟันจะนับตามจำนวนวันที่มาเรียนจริง</div>
        </div>

        {/* School Summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 16 }}>
          <StatCard label="นักเรียนทั้งหมด" value={schoolSummary.totalStudents} icon={<Users size={24} />} color="#FF6A01" />
          <StatCard label="มาเรียนเฉลี่ยทั้งโรงเรียน" value={`${schoolSummary.avgAttRate}%`} icon={<CheckCircle size={24} />} color="#10B981" />
          <StatCard label="ยอดรวมการแจกนม" value={`${schoolSummary.totalMilk} กล่อง`} icon="🥛" color="#3B82F6" />
          <StatCard label="ยอดรวมการแปรงฟัน" value={`${schoolSummary.totalBrush} ครั้ง`} icon="🪥" color="#06B6D4" />
        </div>

        {/* Detailed Table */}
        <div style={{ background: 'white', borderRadius: 14, padding: '1.25rem', boxShadow: '0 4px 14px rgba(0,0,0,0.04)' }}>
          <h6 style={{ fontWeight: 800, color: '#0F172A', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Calendar size={18} color={COLOR} />
            สรุปข้อมูลสถิติแยกตามชั้นเรียน ประจำเดือน {THAI_MONTHS[monthNum - 1]} พ.ศ. {yearNum + 543}
          </h6>
          
          {loading ? (
            <PageLoading compact title="กำลังโหลดสถิติ" message="กำลังอ่านข้อมูลเช็คชื่อของเดือนนี้" />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0' }}>
                    <th style={thCol}>ชั้นเรียน</th>
                    <th style={thCol}>จำนวนนักเรียน</th>
                    <th style={thCol}>วันทำการเช็คชื่อ</th>
                    <th style={thCol}>มาเรียนเฉลี่ย/วัน</th>
                    <th style={thCol}>อัตราการมาเรียน</th>
                    <th style={thCol}>🥛 ยอดรวมดื่มนม</th>
                    <th style={thCol}>🪥 ยอดรวมแปรงฟัน</th>
                  </tr>
                </thead>
                <tbody>
                  {classStats.map((x, i) => (
                    <tr key={x.classId} style={{ borderBottom: '1px solid #FFF7ED', background: i % 2 ? 'white' : '#FFFBF5' }}>
                      <td style={{ ...tdCell, fontWeight: 800, textAlign: 'left' }}>{x.label}</td>
                      <td style={tdCell}>{x.studentCount} คน</td>
                      <td style={tdCell}>{x.checkedDays} วัน</td>
                      <td style={tdCell}>{x.avgPresent} คน</td>
                      <td style={{ ...tdCell, fontWeight: 700, color: x.attRate >= 80 ? '#10B981' : '#EF4444' }}>{x.attRate}%</td>
                      <td style={{ ...tdCell, color: '#3B82F6', fontWeight: 700 }}>{x.totalMilk} กล่อง</td>
                      <td style={{ ...tdCell, color: '#06B6D4', fontWeight: 700 }}>{x.totalBrush} ครั้ง</td>
                    </tr>
                  ))}
                  <tr style={{ background: '#FFF7ED', fontWeight: 900, borderTop: '2px solid #FDBA74' }}>
                    <td style={{ ...tdCell, textAlign: 'left' }}>รวมทั้งหมด (เฉลี่ย)</td>
                    <td style={tdCell}>{schoolSummary.totalStudents} คน</td>
                    <td style={tdCell}>—</td>
                    <td style={tdCell}>—</td>
                    <td style={{ ...tdCell, color: COLOR }}>{schoolSummary.avgAttRate}%</td>
                    <td style={{ ...tdCell, color: '#3B82F6' }}>{schoolSummary.totalMilk} กล่อง</td>
                    <td style={{ ...tdCell, color: '#06B6D4' }}>{schoolSummary.totalBrush} ครั้ง</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Printable Report Layout (shown only during print) */}
      <div className="print-area" style={{ display: 'none', background: 'white', fontFamily: 'Sarabun, sans-serif' }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontWeight: 800, fontSize: '20px', lineHeight: 1.5 }}>รายงานสรุปข้อมูลสถิตินักเรียนประจำเดือน</div>
          <div style={{ fontWeight: 700, fontSize: '16px', lineHeight: 1.5 }}>ประจำเดือน {THAI_MONTHS[monthNum - 1]} พ.ศ. {yearNum + 543}</div>
          <div style={{ fontSize: '14px', marginTop: 4 }}>โรงเรียนบ้านคลองมดแดง สำนักงานเขตพื้นที่การศึกษาประถมศึกษา</div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', marginTop: 15 }}>
          <thead>
            <tr>
              <th style={printTh}>ที่</th>
              <th style={printTh}>ชั้นเรียน</th>
              <th style={printTh}>จำนวนนักเรียน (คน)</th>
              <th style={printTh}>วันทำการสอน (วัน)</th>
              <th style={printTh}>มาเรียนเฉลี่ย (คน/วัน)</th>
              <th style={printTh}>ร้อยละการมาเรียน</th>
              <th style={printTh}>นมที่ได้รับ (กล่อง)</th>
              <th style={printTh}>แปรงฟัน (ครั้ง)</th>
            </tr>
          </thead>
          <tbody>
            {classStats.map((x, i) => (
              <tr key={x.classId}>
                <td style={{ ...printTd, textAlign: 'center' }}>{i + 1}</td>
                <td style={printTd}>{x.label}</td>
                <td style={{ ...printTd, textAlign: 'center' }}>{x.studentCount}</td>
                <td style={{ ...printTd, textAlign: 'center' }}>{x.checkedDays}</td>
                <td style={{ ...printTd, textAlign: 'center' }}>{x.avgPresent}</td>
                <td style={{ ...printTd, textAlign: 'center' }}>{x.attRate}%</td>
                <td style={{ ...printTd, textAlign: 'center' }}>{x.totalMilk}</td>
                <td style={{ ...printTd, textAlign: 'center' }}>{x.totalBrush}</td>
              </tr>
            ))}
            <tr style={{ fontWeight: 'bold', background: '#F8FAFC' }}>
              <td colSpan={2} style={printTd}>สรุปผลรวมเฉลี่ย</td>
              <td style={{ ...printTd, textAlign: 'center' }}>{schoolSummary.totalStudents}</td>
              <td style={{ ...printTd, textAlign: 'center' }}>—</td>
              <td style={{ ...printTd, textAlign: 'center' }}>—</td>
              <td style={{ ...printTd, textAlign: 'center' }}>{schoolSummary.avgAttRate}%</td>
              <td style={{ ...printTd, textAlign: 'center' }}>{schoolSummary.totalMilk}</td>
              <td style={{ ...printTd, textAlign: 'center' }}>{schoolSummary.totalBrush}</td>
            </tr>
          </tbody>
        </table>

        {/* Signatures block */}
        <div style={{ marginTop: 60, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, textAlign: 'center', fontSize: '13px' }}>
          <div>
            <p>ลงชื่อ .............................................................. ผู้รายงาน</p>
            <p style={{ marginTop: 8 }}>( .............................................................. )</p>
            <p style={{ marginTop: 8 }}>ครูผู้บันทึกสรุปข้อมูล</p>
          </div>
          <div>
            <p>ลงชื่อ .............................................................. ผู้อนุมัติ</p>
            <p style={{ marginTop: 8 }}>( .............................................................. )</p>
            <p style={{ marginTop: 8 }}>ผู้อำนวยการสถานศึกษา โรงเรียนบ้านคลองมดแดง</p>
          </div>
        </div>
      </div>

      {/* Styled JSX/CSS for Printing & Layout */}
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 15mm 12mm 15mm 12mm; }
          body { background: white !important; }
          .no-print { display: none !important; }
          .print-area { display: block !important; }
        }
      `}</style>
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: any; icon: any; color: string }) {
  return (
    <div style={{
      background: 'white', borderRadius: 14, padding: '1.2rem',
      display: 'flex', alignItems: 'center', gap: 14,
      boxShadow: '0 4px 10px rgba(0,0,0,0.02)',
      borderLeft: `4px solid ${color}`,
      transition: 'transform 0.2s',
    }}
      onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
      onMouseOut={e => e.currentTarget.style.transform = ''}>
      <div style={{
        background: color + '15', color, width: 48, height: 48,
        borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: typeof icon === 'string' ? '1.8rem' : 'inherit'
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 700 }}>{label}</div>
        <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0F172A', marginTop: 2 }}>{value}</div>
      </div>
    </div>
  );
}

function thisMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const lnk: React.CSSProperties = { color: 'white', display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontSize: '0.85rem', opacity: 0.9 };
const inp: React.CSSProperties = { padding: '6px 10px', borderRadius: 8, border: 'none', fontSize: '0.85rem', fontWeight: 700, color: '#0F172A' };
const btnPrint: React.CSSProperties = { background: 'white', color: '#7C2D12', border: 'none', borderRadius: 8, padding: '8px 12px', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 };
const btnLogout: React.CSSProperties = { background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.4)', padding: '6px 12px', borderRadius: 8, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 };

const thCol: React.CSSProperties = { padding: '10px 12px', fontWeight: 800, fontSize: '0.85rem', textAlign: 'center', color: '#475569', whiteSpace: 'nowrap' };
const tdCell: React.CSSProperties = { padding: '10px 12px', textAlign: 'center', color: '#334155' };

const printTh: React.CSSProperties = { border: '1px solid #1E293B', padding: '6px 4px', background: '#F1F5F9', fontWeight: 'bold' };
const printTd: React.CSSProperties = { border: '1px solid #1E293B', padding: '6px 6px' };
