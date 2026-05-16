import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { collection, doc, onSnapshot, setDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { TIMETABLE_BACKUP } from '../data/timetableData';
import { ChevronLeft, LogOut, Save, Check } from 'lucide-react';
import { useTeacherAuth } from '../utils/teacherAuth';
import TeacherLoginGate from '../components/TeacherLoginGate';

const COLOR = '#06B6D4';
const KG = [{ id: 'kg_a2_1', label: 'อ.2/1' }, { id: 'kg_a3_1', label: 'อ.3/1' }];

interface Student { id: string; code?: string; name: string; emoji?: string; }
interface ClassRoster { classId: string; label: string; students: Student[]; }
interface BrushDoc { classId: string; date: string; brushed: Record<string, boolean>; updatedAt?: number; updatedBy?: string; }
interface AttDoc { classId: string; date: string; records: Record<string, { status: string }>; }

export default function BrushLogPage() {
  const auth = useTeacherAuth();
  if (!auth.authed) return <TeacherLoginGate title="🪥 บันทึกการแปรงฟัน" subtitle="บันทึกรายคน + ดูประวัติย้อนหลัง" />;
  return <App userName={auth.name} onLogout={auth.logout} />;
}

function App({ userName, onLogout }: { userName: string; onLogout: () => void }) {
  const [classes, setClasses] = useState<ClassRoster[]>([]);
  const [classId, setClassId] = useState('');
  const [date, setDate] = useState(todayStr());
  const [brushed, setBrushed] = useState<Record<string, boolean>>({});
  const [att, setAtt] = useState<Record<string, string>>({});  // sid → status
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [history, setHistory] = useState<BrushDoc[]>([]);

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

  // Load brush doc for current
  useEffect(() => {
    if (!classId) return;
    return onSnapshot(doc(db, 'brush_log', `${classId}_${date}`), snap => {
      if (snap.exists()) setBrushed((snap.data() as BrushDoc).brushed || {});
      else setBrushed({});
    });
  }, [classId, date]);

  // Load attendance for the day (to auto-default brushed = present)
  useEffect(() => {
    if (!classId) return;
    return onSnapshot(doc(db, 'attendance', `${classId}_${date}`), snap => {
      const map: Record<string, string> = {};
      if (snap.exists()) {
        const d = snap.data() as AttDoc;
        Object.entries(d.records || {}).forEach(([sid, r]) => { map[sid] = r.status; });
      }
      setAtt(map);
    });
  }, [classId, date]);

  // Load history for this class
  useEffect(() => {
    if (!classId) return;
    (async () => {
      try {
        const snap = await getDocs(collection(db, 'brush_log'));
        const arr: BrushDoc[] = [];
        snap.forEach(d => {
          const data = d.data() as BrushDoc;
          if (data.classId === classId) arr.push(data);
        });
        arr.sort((a, b) => b.date.localeCompare(a.date));
        setHistory(arr.slice(0, 30));
      } catch (e) { console.error(e); }
    })();
  }, [classId, savedAt]);

  const current = availableClasses.find(c => c.id === classId);
  const students = current?.students || [];

  const toggle = (sid: string) => setBrushed(b => ({ ...b, [sid]: !b[sid] }));
  const markAll = () => {
    const next: Record<string, boolean> = {};
    students.forEach(s => { next[s.id] = true; });
    setBrushed(next);
  };
  const markPresentOnly = () => {
    const next: Record<string, boolean> = {};
    students.forEach(s => { if (att[s.id] === 'present') next[s.id] = true; });
    setBrushed(next);
  };
  const clearAll = () => setBrushed({});

  const save = async () => {
    if (!classId) return;
    setSaving(true);
    try {
      const clean: Record<string, boolean> = {};
      Object.entries(brushed).forEach(([k, v]) => { if (v) clean[k] = true; });
      await setDoc(doc(db, 'brush_log', `${classId}_${date}`), {
        classId, date, brushed: clean, updatedAt: Date.now(), updatedBy: userName,
      });
      setSavedAt(new Date());
    } catch (e: any) { alert('❌ ' + (e?.message || e)); }
    setSaving(false);
  };

  const brushedCount = Object.values(brushed).filter(Boolean).length;
  const presentCount = Object.values(att).filter(s => s === 'present').length;

  return (
    <div style={{ minHeight: '100vh', background: '#FFF7ED' }}>
      <header style={{ background: `linear-gradient(135deg,${COLOR},#22D3EE)`, color: 'white', padding: '1.2rem 1.25rem' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Link to="/teacher-hub" style={lnk}><ChevronLeft size={16} />Hub</Link>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 900 }}>🪥 บันทึกการแปรงฟัน</div>
            <div style={{ fontSize: '0.78rem', opacity: 0.9 }}>เช็คทีละคน · ย้อนหลังได้ · {userName}</div>
          </div>
          <Link to="/milk-report" style={{ ...btnLogout, textDecoration: 'none' }}>🥛 → นม</Link>
          <button onClick={onLogout} style={btnLogout}><LogOut size={12} />ออก</button>
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '1.25rem' }}>
        {/* Class + Date pickers */}
        <div style={{ background: 'white', borderRadius: 12, padding: '1rem', marginBottom: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 10 }}>
          <div>
            <label style={lbl}>ชั้นเรียน</label>
            <select value={classId} onChange={e => setClassId(e.target.value)} style={inp}>
              {availableClasses.map(c => <option key={c.id} value={c.id}>{c.label} ({c.students.length})</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>วันที่</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inp} />
            <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: 4 }}>{fmtThai(date)}</div>
          </div>
        </div>

        {/* Quick actions */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
          <button onClick={markAll} style={{ ...quickBtn, background: '#10B981' }}>✓ แปรงครบทุกคน</button>
          <button onClick={markPresentOnly} style={{ ...quickBtn, background: COLOR }}>✓ แปรงเฉพาะที่มาเรียน</button>
          <button onClick={clearAll} style={{ ...quickBtn, background: '#EF4444' }}>↺ ล้าง</button>
          <button onClick={save} disabled={saving} style={{ ...quickBtn, background: '#0F172A', marginLeft: 'auto' }}>
            <Save size={14} /> {saving ? 'บันทึก...' : 'บันทึก'}
          </button>
          {savedAt && <span style={{ fontSize: '0.72rem', color: '#10B981', fontWeight: 700 }}>✓ {savedAt.toLocaleTimeString('th-TH')}</span>}
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 14 }}>
          <Stat label="🪥 แปรงแล้ว" value={brushedCount} color={COLOR} />
          <Stat label="✅ มาเรียน" value={presentCount} color="#10B981" />
          <Stat label="🚫 ไม่ได้แปรง" value={presentCount - brushedCount} color="#EF4444" />
        </div>

        {/* Student grid */}
        {students.length === 0 ? (
          <div style={{ background: 'white', padding: '3rem', textAlign: 'center', color: '#94A3B8', borderRadius: 12 }}>
            ยังไม่มีรายชื่อในชั้นนี้
          </div>
        ) : (
          <div style={{ background: 'white', borderRadius: 12, padding: '1rem', marginBottom: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 6 }}>
              {students.map((s, i) => {
                const isBrushed = brushed[s.id];
                const status = att[s.id];
                return (
                  <button key={s.id} onClick={() => toggle(s.id)} style={{
                    padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                    background: isBrushed ? '#CFFAFE' : 'white',
                    border: isBrushed ? `2px solid ${COLOR}` : '1px solid #E2E8F0',
                    textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <span style={{
                      width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                      background: isBrushed ? COLOR : 'white',
                      border: isBrushed ? 'none' : '2px solid #CBD5E1',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
                    }}>{isBrushed && <Check size={14} />}</span>
                    <span style={{ color: '#94A3B8', fontSize: '0.72rem', minWidth: 24 }}>{i + 1}</span>
                    <span style={{ fontSize: '1.1rem' }}>{s.emoji || '🧒'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.78rem', color: '#94A3B8' }}>{s.code}</div>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                    </div>
                    {status && status !== 'present' && (
                      <span style={{ fontSize: '0.65rem', background: status === 'absent' ? '#FEE2E2' : '#FEF3C7', color: status === 'absent' ? '#991B1B' : '#92400E', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>
                        {status === 'absent' ? 'ขาด' : 'ลา'}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* History */}
        <div style={{ background: 'white', borderRadius: 12, padding: '1rem' }}>
          <h6 style={{ fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>🗓️ ย้อนประวัติชั้น {current?.label} (30 ครั้งล่าสุด)</h6>
          <p style={{ fontSize: '0.78rem', color: '#94A3B8', marginBottom: 12 }}>คลิกเพื่อดูวันที่นั้น</p>
          {history.length === 0 ? (
            <div style={{ padding: '1rem', textAlign: 'center', color: '#94A3B8' }}>ยังไม่มีประวัติ</div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {history.map(h => {
                const count = Object.values(h.brushed || {}).filter(Boolean).length;
                return (
                  <button key={h.date} onClick={() => setDate(h.date)} style={{
                    padding: '8px 12px', borderRadius: 8,
                    border: h.date === date ? `2px solid ${COLOR}` : '1px solid #E2E8F0',
                    background: h.date === date ? '#CFFAFE' : 'white', cursor: 'pointer', textAlign: 'left',
                  }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0F172A' }}>{fmtThai(h.date)}</div>
                    <div style={{ fontSize: '0.72rem', color: COLOR, fontWeight: 700 }}>🪥 {count} คน</div>
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

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return <div style={{ background: 'white', padding: 10, borderRadius: 10, textAlign: 'center', borderTop: `3px solid ${color}` }}>
    <div style={{ fontSize: '1.5rem', fontWeight: 900, color }}>{value}</div>
    <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700 }}>{label}</div>
  </div>;
}

const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const fmtThai = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']; return `${d} ${months[m - 1]} ${y + 543}`; };

const lnk: React.CSSProperties = { color: 'white', display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontSize: '0.85rem', opacity: 0.9 };
const inp: React.CSSProperties = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: '0.9rem' };
const lbl: React.CSSProperties = { display: 'block', fontSize: '0.78rem', color: '#64748B', marginBottom: 4, fontWeight: 700 };
const btnLogout: React.CSSProperties = { background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.4)', padding: '6px 12px', borderRadius: 8, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 };
const quickBtn: React.CSSProperties = { padding: '8px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: '0.8rem', color: 'white', display: 'inline-flex', alignItems: 'center', gap: 4 };
