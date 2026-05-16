import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { collection, doc, onSnapshot, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { TIMETABLE_BACKUP } from '../data/timetableData';
import { ChevronLeft, LogOut, Download, Sparkles } from 'lucide-react';
import { useTeacherAuth } from '../utils/teacherAuth';
import TeacherLoginGate from '../components/TeacherLoginGate';

const BRAND = '#FF6A01';
const KG = [{ id: 'kg_a2_1', label: 'อ.2/1' }, { id: 'kg_a3_1', label: 'อ.3/1' }];

interface Student { id: string; code?: string; name: string; }
interface ClassRoster { classId: string; label: string; students: Student[]; }
interface AttDoc { classId: string; date: string; records: Record<string, { status: string; note?: string }>; }

export default function MilkBrushReportPage() {
  const auth = useTeacherAuth();
  if (!auth.authed) return <TeacherLoginGate title="🥛 รายงานนม-แปรงฟัน" subtitle="ดึงข้อมูลจากการเช็คชื่ออัตโนมัติ" />;
  return <App userName={auth.name} onLogout={auth.logout} />;
}

function App({ userName, onLogout }: { userName: string; onLogout: () => void }) {
  const [classes, setClasses] = useState<ClassRoster[]>([]);
  const [date, setDate] = useState(todayStr());
  const [todayDocs, setTodayDocs] = useState<AttDoc[]>([]);
  const [monthDocs, setMonthDocs] = useState<AttDoc[]>([]);
  const month = date.slice(0, 7); // YYYY-MM

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

  // Load today's attendance docs across all classes
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(query(collection(db, 'attendance'), where('date', '==', date)));
        const arr: AttDoc[] = [];
        snap.forEach(d => arr.push(d.data() as AttDoc));
        setTodayDocs(arr);
      } catch (e) { console.error(e); }
    })();
  }, [date]);

  // Load month docs for monthly summary
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, 'attendance'));
        const arr: AttDoc[] = [];
        snap.forEach(d => {
          const data = d.data() as AttDoc;
          if (data.date?.startsWith(month)) arr.push(data);
        });
        setMonthDocs(arr);
      } catch (e) { console.error(e); }
    })();
  }, [month]);

  // ─── Today per-class ───
  const todayPerClass = useMemo(() => {
    return availableClasses.map(c => {
      const doc = todayDocs.find(d => d.classId === c.id);
      let present = 0, absent = 0, leave = 0;
      if (doc) {
        Object.values(doc.records || {}).forEach(r => {
          if (r.status === 'present') present++;
          else if (r.status === 'absent') absent++;
          else if (r.status === 'leave') leave++;
        });
      }
      return { c, present, absent, leave, checked: !!doc };
    });
  }, [availableClasses, todayDocs]);

  const totalStudents = availableClasses.reduce((s, c) => s + c.students.length, 0);
  const totalPresent = todayPerClass.reduce((s, x) => s + x.present, 0);
  const totalAbsent = todayPerClass.reduce((s, x) => s + x.absent, 0);
  const totalLeave = todayPerClass.reduce((s, x) => s + x.leave, 0);

  // ─── Month summary per class ───
  const monthPerClass = useMemo(() => {
    return availableClasses.map(c => {
      const docs = monthDocs.filter(d => d.classId === c.id);
      let totalMilk = 0; // = total present across all days
      const daysChecked = new Set<string>();
      docs.forEach(d => {
        daysChecked.add(d.date);
        Object.values(d.records || {}).forEach(r => {
          if (r.status === 'present') totalMilk++;
        });
      });
      return { c, totalMilk, days: daysChecked.size };
    });
  }, [availableClasses, monthDocs]);

  const exportTodayCsv = () => {
    const rows = [['ชั้น', 'จำนวนนักเรียน', 'มาเรียน (ได้รับนม+แปรงฟัน)', 'ขาด', 'ลา', 'เช็คชื่อแล้ว']];
    todayPerClass.forEach(x => rows.push([
      x.c.label, String(x.c.students.length), String(x.present),
      String(x.absent), String(x.leave), x.checked ? '✓' : '-',
    ]));
    rows.push(['รวม', String(totalStudents), String(totalPresent), String(totalAbsent), String(totalLeave), '']);
    const csv = '﻿' + rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `รายงานนม-แปรงฟัน_${date}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#FFF7ED' }}>
      <header style={{ background: 'linear-gradient(135deg,#3B82F6,#60A5FA)', color: 'white', padding: '1.2rem 1.25rem' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Link to="/teacher-hub" style={lnk}><ChevronLeft size={16} />Hub</Link>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 900 }}>🥛 รายงานการดื่มนม / แปรงฟัน</div>
            <div style={{ fontSize: '0.78rem', opacity: 0.9 }}>ดึงจากการเช็คชื่ออัตโนมัติ · {userName}</div>
          </div>
          <button onClick={onLogout} style={btnLogout}><LogOut size={12} />ออก</button>
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '1.25rem' }}>
        {/* Info banner */}
        <div style={{ background: '#DBEAFE', border: '1px solid #93C5FD', color: '#1E40AF', borderRadius: 10, padding: '12px 16px', marginBottom: 14, display: 'flex', gap: 10, alignItems: 'center' }}>
          <Sparkles size={20} />
          <div style={{ fontSize: '0.88rem' }}>
            <b>ระบบนี้ดึงข้อมูลจาก "การเช็คชื่อนักเรียน" อัตโนมัติ</b> — นักเรียนที่ <b>"มาเรียน"</b> จะถูกนับว่า <b>ได้รับนม + แปรงฟัน</b> ครบทุกคนโดยปริยาย ไม่ต้องบันทึกซ้ำ
          </div>
        </div>

        {/* Date picker */}
        <div style={{ background: 'white', borderRadius: 12, padding: '1rem', marginBottom: 14, display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={lbl}>วันที่</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inp} />
            <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: 4 }}>{fmtThai(date)}</div>
          </div>
          <button onClick={exportTodayCsv} style={btnPrimary}><Download size={14} /> Export CSV</button>
        </div>

        {/* Today summary */}
        <div style={{ background: 'linear-gradient(135deg,#3B82F6,#60A5FA)', color: 'white', borderRadius: 14, padding: '1.25rem', marginBottom: 14 }}>
          <div style={{ fontSize: '0.85rem', opacity: 0.9, fontWeight: 700, letterSpacing: 1 }}>📊 ภาพรวมวันนี้</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginTop: 12 }}>
            <BigStat label="นักเรียนทั้งหมด" value={totalStudents} color="#FCD34D" />
            <BigStat label="🥛 ได้รับนม+แปรงฟัน" value={totalPresent} color="#10B981" />
            <BigStat label="ขาด" value={totalAbsent} color="#EF4444" />
            <BigStat label="ลา" value={totalLeave} color="#F59E0B" />
          </div>
        </div>

        {/* Per-class breakdown */}
        <div style={{ background: 'white', borderRadius: 12, padding: '1rem', marginBottom: 14 }}>
          <h6 style={{ fontWeight: 800, color: '#0F172A', marginBottom: 12 }}>📋 แยกตามชั้นเรียน — วันที่ {fmtThai(date)}</h6>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: '#F1F5F9' }}>
                  <th style={th}>ชั้น</th>
                  <th style={th}>จำนวนนักเรียน</th>
                  <th style={th}>🥛 ได้รับนม</th>
                  <th style={th}>ขาด</th>
                  <th style={th}>ลา</th>
                  <th style={th}>%ที่ได้รับ</th>
                  <th style={th}>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {todayPerClass.map(x => {
                  const pct = x.c.students.length ? Math.round((x.present / x.c.students.length) * 100) : 0;
                  return (
                    <tr key={x.c.id} style={{ borderBottom: '1px solid #FFF7ED' }}>
                      <td style={{ ...td, fontWeight: 700, textAlign: 'left' }}>{x.c.label}</td>
                      <td style={td}>{x.c.students.length}</td>
                      <td style={{ ...td, fontWeight: 800, color: '#10B981' }}>{x.present}</td>
                      <td style={{ ...td, color: '#EF4444' }}>{x.absent}</td>
                      <td style={{ ...td, color: '#F59E0B' }}>{x.leave}</td>
                      <td style={{ ...td, fontWeight: 800 }}>{x.checked ? `${pct}%` : '-'}</td>
                      <td style={td}>
                        {x.checked
                          ? <span style={{ background: '#DCFCE7', color: '#166534', padding: '2px 8px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700 }}>✓ เช็คแล้ว</span>
                          : <span style={{ background: '#F1F5F9', color: '#94A3B8', padding: '2px 8px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700 }}>⏳ ยังไม่เช็ค</span>}
                      </td>
                    </tr>
                  );
                })}
                <tr style={{ background: '#FFF7ED', fontWeight: 900 }}>
                  <td style={{ ...td, textAlign: 'left' }}>รวมทั้งโรงเรียน</td>
                  <td style={td}>{totalStudents}</td>
                  <td style={{ ...td, color: '#10B981' }}>{totalPresent}</td>
                  <td style={{ ...td, color: '#EF4444' }}>{totalAbsent}</td>
                  <td style={{ ...td, color: '#F59E0B' }}>{totalLeave}</td>
                  <td style={td}>—</td>
                  <td style={td}>{todayPerClass.filter(x => x.checked).length}/{todayPerClass.length}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Monthly summary */}
        <div style={{ background: 'white', borderRadius: 12, padding: '1rem' }}>
          <h6 style={{ fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>📅 สรุปรายเดือน — {month}</h6>
          <p style={{ fontSize: '0.78rem', color: '#94A3B8', marginBottom: 12 }}>จำนวนนมรวมที่แจกในเดือน คำนวณจาก จำนวนวันเช็คชื่อ × นักเรียนที่มา</p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: '#F1F5F9' }}>
                  <th style={th}>ชั้น</th>
                  <th style={th}>นักเรียนปัจจุบัน</th>
                  <th style={th}>วันที่เช็ค</th>
                  <th style={th}>🥛 นมรวม (กล่อง)</th>
                  <th style={th}>เฉลี่ย/วัน</th>
                </tr>
              </thead>
              <tbody>
                {monthPerClass.map(x => (
                  <tr key={x.c.id} style={{ borderBottom: '1px solid #FFF7ED' }}>
                    <td style={{ ...td, fontWeight: 700, textAlign: 'left' }}>{x.c.label}</td>
                    <td style={td}>{x.c.students.length}</td>
                    <td style={td}>{x.days}</td>
                    <td style={{ ...td, fontWeight: 800, color: '#10B981' }}>{x.totalMilk}</td>
                    <td style={td}>{x.days ? Math.round(x.totalMilk / x.days) : 0}</td>
                  </tr>
                ))}
                <tr style={{ background: '#FFF7ED', fontWeight: 900 }}>
                  <td style={{ ...td, textAlign: 'left' }}>รวมทั้งหมด</td>
                  <td style={td}>{totalStudents}</td>
                  <td style={td}>—</td>
                  <td style={{ ...td, color: '#10B981' }}>{monthPerClass.reduce((s, x) => s + x.totalMilk, 0)}</td>
                  <td style={td}>—</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

function BigStat({ label, value, color }: { label: string; value: number; color: string }) {
  return <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: '0.75rem', borderLeft: `4px solid ${color}` }}>
    <div style={{ fontSize: '0.78rem', opacity: 0.9, fontWeight: 700 }}>{label}</div>
    <div style={{ fontSize: '2rem', fontWeight: 900, color, marginTop: 4 }}>{value}</div>
  </div>;
}

const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const fmtThai = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']; return `${d} ${months[m - 1]} ${y + 543}`; };

const lnk: React.CSSProperties = { color: 'white', display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontSize: '0.85rem', opacity: 0.9 };
const inp: React.CSSProperties = { padding: '8px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: '0.9rem' };
const lbl: React.CSSProperties = { display: 'block', fontSize: '0.78rem', color: '#64748B', marginBottom: 4, fontWeight: 700 };
const btnPrimary: React.CSSProperties = { background: BRAND, color: 'white', border: 'none', borderRadius: 8, padding: '8px 14px', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const btnLogout: React.CSSProperties = { background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.4)', padding: '6px 12px', borderRadius: 8, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 };
const th: React.CSSProperties = { padding: '10px 12px', fontWeight: 800, fontSize: '0.8rem', textAlign: 'center' };
const td: React.CSSProperties = { padding: '8px 10px', textAlign: 'center' };
