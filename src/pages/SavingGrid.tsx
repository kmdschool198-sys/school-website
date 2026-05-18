import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { collection, doc, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { TIMETABLE_BACKUP } from '../data/timetableData';
import { ChevronLeft, LogOut, Download } from 'lucide-react';
import { useTeacherAuth } from '../utils/teacherAuth';
import TeacherLoginGate from '../components/TeacherLoginGate';
import QuickDate from '../components/QuickDate';

const COLOR = '#10B981';
const KG = [{ id: 'kg_a2_1', label: 'อ.2/1' }, { id: 'kg_a3_1', label: 'อ.3/1' }];

interface Student { id: string; code?: string; name: string; emoji?: string; }
interface ClassRoster { classId: string; label: string; students: Student[]; }
interface LogEntry { id: string; classLabel?: string; studentName?: string; studentId?: string; amount?: number; date?: string; }

export default function SavingGridPage() {
  const auth = useTeacherAuth();
  if (!auth.authed) return <TeacherLoginGate title="💰 บันทึกออมเงินนักเรียน" subtitle="กรอกในตาราง · บันทึกอัตโนมัติ" />;
  return <App userName={auth.name} onLogout={auth.logout} />;
}

function App({ userName, onLogout }: { userName: string; onLogout: () => void }) {
  const [classes, setClasses] = useState<ClassRoster[]>([]);
  const [classId, setClassId] = useState('');
  const [date, setDate] = useState(todayStr());
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    return onSnapshot(doc(db, 'config', 'attendance_classes'), snap => {
      if (snap.exists()) {
        const d = snap.data() as { classes: ClassRoster[] };
        if (d.classes?.length) setClasses(d.classes);
      }
    });
  }, []);

  useEffect(() => {
    return onSnapshot(collection(db, 'log_saving'), snap => {
      const arr: LogEntry[] = [];
      snap.forEach(d => arr.push({ id: d.id, ...(d.data() as any) }));
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

  // Match by id OR name (handles old data without studentId)
  const matches = (l: LogEntry, s: Student) =>
    (l.classLabel === current?.label || !l.classLabel) &&
    (l.studentId === s.id || (l.studentName && l.studentName.trim() === s.name.trim()));

  const findEntry = (s: Student) => logs.find(l => matches(l, s) && l.date === date);

  const balanceOf = (s: Student) => logs
    .filter(l => matches(l, s))
    .reduce((sum, l) => sum + (Number(l.amount) || 0), 0);

  const updateAmount = async (s: Student, amount: number | undefined) => {
    if (!current) return;
    const existing = findEntry(s);
    const id = existing?.id || `sv_${classId}_${date}_${s.id}`;
    if (!amount || amount === 0) {
      if (existing) {
        try { await deleteDoc(doc(db, 'log_saving', existing.id)); } catch (e: any) { alert('❌ ' + (e?.message || e)); }
      }
      return;
    }
    try {
      await setDoc(doc(db, 'log_saving', id), {
        id, classLabel: current.label, studentId: s.id, studentCode: s.code || s.id,
        studentName: s.name, amount, date, teacherName: userName, createdAt: Date.now(),
      });
      setSavedAt(new Date());
    } catch (e: any) { alert('❌ ' + (e?.message || e)); }
  };

  const todayTotal = students.reduce((s, st) => s + (findEntry(st)?.amount || 0), 0);
  const allTimeTotal = students.reduce((s, st) => s + balanceOf(st), 0);
  const filledCount = students.filter(s => findEntry(s)).length;

  const exportCsv = () => {
    if (!current) return;
    const rows = [['เลขที่', 'รหัส', 'ชื่อ', `วันนี้ (${date})`, 'ยอดสะสม']];
    students.forEach((s, i) => rows.push([
      String(i + 1), s.code || '', s.name,
      String(findEntry(s)?.amount || 0), String(balanceOf(s)),
    ]));
    const csv = '﻿' + rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `ออมเงิน_${current.label}_${date}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#FFF7ED' }}>
      <header style={{ background: `linear-gradient(135deg,${COLOR},#34D399)`, color: 'white', padding: '1.2rem 1.25rem' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Link to="/teacher-hub" style={lnk}><ChevronLeft size={16} />Hub</Link>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 900 }}>💰 บันทึกออมเงินนักเรียน</div>
            <div style={{ fontSize: '0.78rem', opacity: 0.9 }}>กรอกในตาราง · บันทึกอัตโนมัติ · {userName}</div>
          </div>
          <button onClick={onLogout} style={btnLogout}><LogOut size={12} />ออก</button>
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '1.25rem' }}>
        <div style={{ background: 'white', borderRadius: 12, padding: '1rem', marginBottom: 14, display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={lbl}>ชั้นเรียน</label>
            <select value={classId} onChange={e => setClassId(e.target.value)} style={inp}>
              {availableClasses.map(c => <option key={c.id} value={c.id}>{c.label} ({c.students.length} คน)</option>)}
            </select>
          </div>
          <QuickDate value={date} onChange={setDate} color={COLOR} />
          <button onClick={exportCsv} style={{ ...btnSecondary, background: COLOR, color: 'white', border: 'none' }}>
            <Download size={14} /> CSV
          </button>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
          <Stat label="ออมวันนี้" value={`${todayTotal.toLocaleString('th-TH')} ฿`} color={COLOR} sub={`${filledCount}/${students.length} คน`} />
          <Stat label="ยอดสะสมห้องนี้" value={`${allTimeTotal.toLocaleString('th-TH')} ฿`} color="#3B82F6" />
          <Stat label="เฉลี่ยต่อคน" value={`${students.length ? Math.round(allTimeTotal / students.length).toLocaleString('th-TH') : 0} ฿`} color="#A855F7" />
        </div>

        {savedAt && <div style={{ fontSize: '0.78rem', color: '#10B981', fontWeight: 700, marginBottom: 8 }}>✓ บันทึกล่าสุด: {savedAt.toLocaleTimeString('th-TH')}</div>}

        {students.length === 0 ? (
          <div style={{ background: 'white', padding: '3rem', textAlign: 'center', color: '#94A3B8', borderRadius: 12 }}>
            ยังไม่มีรายชื่อในชั้นนี้
          </div>
        ) : (
          <div style={{ background: 'white', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ background: 'linear-gradient(135deg,#0F172A,#1E3A8A)', color: 'white' }}>
                    <th style={th}>#</th>
                    <th style={th}>รหัส</th>
                    <th style={{ ...th, textAlign: 'left', minWidth: 200 }}>ชื่อ-สกุล</th>
                    <th style={th}>💰 ออมวันนี้ (฿)</th>
                    <th style={th}>📊 ยอดสะสม (฿)</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s, i) => {
                    const e = findEntry(s);
                    const bal = balanceOf(s);
                    return (
                      <tr key={s.id} style={{ borderBottom: '1px solid #FFF7ED', background: i % 2 ? 'white' : '#FFFBF5' }}>
                        <td style={td}>{i + 1}</td>
                        <td style={{ ...td, fontSize: '0.78rem' }}>{s.code}</td>
                        <td style={{ ...td, textAlign: 'left', fontWeight: 700 }}>{s.emoji} {s.name}</td>
                        <td style={td}>
                          <input type="number" min={0} step={1}
                            defaultValue={e?.amount ?? ''}
                            onBlur={ev => updateAmount(s, ev.target.value === '' ? undefined : Number(ev.target.value))}
                            placeholder="0"
                            style={{ ...inpNum, width: 90, fontWeight: 800, color: e?.amount ? COLOR : '#94A3B8' }} />
                        </td>
                        <td style={{ ...td, fontWeight: 800, color: bal > 0 ? '#3B82F6' : '#94A3B8' }}>
                          {bal.toLocaleString('th-TH')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#FFF7ED', fontWeight: 900 }}>
                    <td colSpan={3} style={{ ...td, textAlign: 'right' }}>รวมห้องนี้</td>
                    <td style={{ ...td, color: COLOR, fontSize: '1rem' }}>{todayTotal.toLocaleString('th-TH')}</td>
                    <td style={{ ...td, color: '#3B82F6', fontSize: '1rem' }}>{allTimeTotal.toLocaleString('th-TH')}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div style={{ padding: '10px 14px', background: '#FFF7ED', fontSize: '0.78rem', color: '#7C2D12' }}>
              💡 กรอกจำนวนเงิน → กด Tab/ออกจากช่อง = <b>บันทึกอัตโนมัติ</b> · กรอก 0 หรือลบค่า = ลบรายการ
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

function Stat({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return <div style={{ background: 'white', padding: 12, borderRadius: 10, textAlign: 'center', borderTop: `3px solid ${color}` }}>
    <div style={{ fontSize: '1.4rem', fontWeight: 900, color }}>{value}</div>
    <div style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 700 }}>{label}</div>
    {sub && <div style={{ fontSize: '0.7rem', color: '#94A3B8' }}>{sub}</div>}
  </div>;
}

const lnk: React.CSSProperties = { color: 'white', display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontSize: '0.85rem', opacity: 0.9 };
const inp: React.CSSProperties = { padding: '8px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: '0.9rem' };
const inpNum: React.CSSProperties = { padding: '6px 10px', borderRadius: 6, border: '1px solid #E2E8F0', fontSize: '0.9rem', textAlign: 'center' };
const lbl: React.CSSProperties = { display: 'block', fontSize: '0.78rem', color: '#64748B', marginBottom: 4, fontWeight: 700 };
const btnLogout: React.CSSProperties = { background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.4)', padding: '6px 12px', borderRadius: 8, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 };
const btnSecondary: React.CSSProperties = { background: 'white', color: '#475569', border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 14px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const th: React.CSSProperties = { padding: '10px 12px', fontWeight: 800, fontSize: '0.8rem', textAlign: 'center' };
const td: React.CSSProperties = { padding: '8px 10px', textAlign: 'center' };
