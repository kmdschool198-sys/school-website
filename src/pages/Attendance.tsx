import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { doc, onSnapshot, setDoc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { TIMETABLE_BACKUP } from '../data/timetableData';
import {
  Check, X as XIcon, Clock, Save, Download,
  Users, BarChart3, Calendar, ChevronLeft, AlertCircle, LogOut, Plus, Trash2, Edit2,
} from 'lucide-react';
import { useTeacherAuth } from '../utils/teacherAuth';
import TeacherLoginGate from '../components/TeacherLoginGate';

type Status = 'present' | 'absent' | 'leave';
interface Student { id: string; code?: string; name: string; emoji?: string; }
interface AttDoc {
  classId: string;
  date: string; // YYYY-MM-DD
  records: Record<string, { status: Status; note?: string }>;
  updatedAt?: number;
}
interface ClassRoster { classId: string; label: string; students: Student[]; }

const STATUS_COLORS: Record<Status, string> = {
  present: '#FF6A01',  // school orange
  absent: '#EF4444',
  leave: '#F59E0B',
};
const BRAND = '#FF6A01';
const BRAND_DARK = '#7C2D12';
const STATUS_LABELS: Record<Status, string> = {
  present: 'มาเรียน', absent: 'ขาด', leave: 'ลา',
};

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const fmtThai = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  return `${d} ${months[m - 1]} ${y + 543}`;
};

const KG_ROOMS = [
  { id: 'kg_a2_1', label: 'อ.2/1' },
  { id: 'kg_a3_1', label: 'อ.3/1' },
];

const seedClasses = (): ClassRoster[] => {
  const profile = (TIMETABLE_BACKUP as any).profiles[Object.keys((TIMETABLE_BACKUP as any).profiles)[0]];
  const rooms = profile.data.rooms as Array<{ id: string; label: string }>;
  return [...KG_ROOMS, ...rooms].map(r => ({ classId: r.id, label: r.label, students: [] }));
};

type Tab = 'check' | 'summary' | 'stats' | 'history' | 'school';

export default function Attendance() {
  const auth = useTeacherAuth();
  if (!auth.authed) return <TeacherLoginGate title="📋 ระบบเช็คชื่อนักเรียน" />;
  return <AttendanceApp role={auth.role} onLogout={auth.logout} />;
}

function AttendanceApp({ role, onLogout }: { role: 'teacher' | 'super'; onLogout: () => void }) {
  const isSuper = role === 'super';
  const today = todayStr();
  const [classes, setClasses] = useState<ClassRoster[]>(seedClasses);
  const [classId, setClassId] = useState<string>('');
  const [date, setDate] = useState<string>(todayStr());
  const [records, setRecords] = useState<AttDoc['records']>({});
  const [tab, setTab] = useState<Tab>('check');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [history, setHistory] = useState<AttDoc[]>([]); // for stats
  const [todayDocs, setTodayDocs] = useState<Set<string>>(new Set()); // classIds checked today

  // Load class roster from Firestore (subscribe)
  useEffect(() => {
    return onSnapshot(doc(db, 'config', 'attendance_classes'), snap => {
      if (snap.exists()) {
        const d = snap.data() as { classes: ClassRoster[] };
        if (d.classes?.length) setClasses(d.classes);
      }
    });
  }, []);

  useEffect(() => {
    if (!classId && classes.length) setClassId(classes[0].classId);
  }, [classes]);

  // Load attendance for current date
  useEffect(() => {
    if (!classId) return;
    const id = `${classId}_${date}`;
    return onSnapshot(doc(db, 'attendance', id), snap => {
      setRecords(snap.exists() ? (snap.data() as AttDoc).records || {} : {});
    });
  }, [classId, date]);

  // Track which classes have been checked today (refresh on save)
  useEffect(() => {
    (async () => {
      try {
        const q = query(collection(db, 'attendance'), where('date', '==', today));
        const snap = await getDocs(q);
        const ids = new Set<string>();
        snap.forEach(d => {
          const data = d.data() as AttDoc;
          // Only count as "checked" if at least one student has a status
          if (data.records && Object.keys(data.records).length > 0) ids.add(data.classId);
        });
        setTodayDocs(ids);
      } catch (e) { console.error(e); }
    })();
  }, [savedAt, today]);

  // Load all history for this class (for stats)
  useEffect(() => {
    if (!classId) return;
    (async () => {
      try {
        const q = query(collection(db, 'attendance'), where('classId', '==', classId));
        const snap = await getDocs(q);
        const docs: AttDoc[] = [];
        snap.forEach(d => docs.push(d.data() as AttDoc));
        setHistory(docs);
      } catch (e) { console.error(e); }
    })();
  }, [classId, savedAt]);

  const currentClass = classes.find(c => c.classId === classId);
  const students = currentClass?.students || [];

  const setStatus = (sid: string, status: Status) => {
    setRecords(r => ({ ...r, [sid]: { ...r[sid], status } }));
  };
  const setNote = (sid: string, note: string) => {
    setRecords(r => ({ ...r, [sid]: { ...(r[sid] || { status: 'present' }), note } }));
  };
  const markAll = (status: Status) => {
    const r: AttDoc['records'] = {};
    students.forEach(s => {
      const note = records[s.id]?.note;
      r[s.id] = note ? { status, note } : { status };
    });
    setRecords(r);
  };

  // Strip undefined values before sending to Firestore
  const cleanRecords = (recs: AttDoc['records']): AttDoc['records'] => {
    const out: AttDoc['records'] = {};
    for (const [k, v] of Object.entries(recs)) {
      const item: any = { status: v.status };
      if (v.note !== undefined && v.note !== '') item.note = v.note;
      out[k] = item;
    }
    return out;
  };
  const clearAll = () => setRecords({});

  const save = async () => {
    if (!classId) return;
    setSaving(true);
    try {
      const id = `${classId}_${date}`;
      await setDoc(doc(db, 'attendance', id), {
        classId, date, records: cleanRecords(records), updatedAt: Date.now(),
      });
      setSavedAt(new Date());
    } catch (e: any) {
      alert('❌ บันทึกไม่สำเร็จ: ' + (e?.message || e));
    } finally {
      setSaving(false);
    }
  };

  const counts = useMemo(() => {
    const c = { present: 0, absent: 0, leave: 0, untracked: 0 };
    students.forEach(s => {
      const st = records[s.id]?.status;
      if (st) c[st]++; else c.untracked++;
    });
    return c;
  }, [records, students]);

  const total = students.length;
  const pct = total ? Math.round((counts.present / total) * 100) : 0;

  // Stats: per-student attendance rate over history
  const studentRates = useMemo(() => {
    return students.map(s => {
      let p = 0, a = 0, l = 0;
      history.forEach(h => {
        const r = h.records?.[s.id];
        if (!r) return;
        if (r.status === 'present') p++;
        else if (r.status === 'absent') a++;
        else if (r.status === 'leave') l++;
      });
      const tot = p + a + l;
      return { ...s, p, a, l, tot, rate: tot ? Math.round((p / tot) * 100) : 0 };
    });
  }, [students, history]);

  const dailyStats = useMemo(() => {
    return [...history]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-14)
      .map(h => {
        let p = 0, a = 0, l = 0;
        Object.values(h.records || {}).forEach(r => {
          if (r.status === 'present') p++;
          else if (r.status === 'absent') a++;
          else if (r.status === 'leave') l++;
        });
        return { date: h.date, p, a, l };
      });
  }, [history]);

  // Super-only: delete an entire day's record
  const deleteDay = async (targetDate: string) => {
    if (!classId) return;
    if (!confirm(`ลบประวัติเช็คชื่อของ ${fmtThai(targetDate)} ทั้งหมด?\n\nการลบนี้ไม่สามารถย้อนกลับได้!`)) return;
    try {
      await deleteDoc(doc(db, 'attendance', `${classId}_${targetDate}`));
      setHistory(h => h.filter(x => x.date !== targetDate));
      if (date === targetDate) setRecords({});
      alert('✅ ลบเรียบร้อย');
    } catch (e: any) {
      alert('❌ ลบไม่สำเร็จ: ' + (e?.message || e));
    }
  };

  // Super-only: create blank record for a chosen date (then jump to edit)
  const addNewDay = async () => {
    if (!classId) return;
    const inp = prompt('เพิ่มประวัติของวันที่ (YYYY-MM-DD):', todayStr());
    if (!inp) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(inp)) { alert('รูปแบบไม่ถูกต้อง — ต้องเป็น YYYY-MM-DD'); return; }
    if (history.some(h => h.date === inp)) {
      if (!confirm('วันนี้มีข้อมูลอยู่แล้ว — เปิดเพื่อแก้ไข?')) return;
      setDate(inp);
      setTab('check');
      return;
    }
    try {
      await setDoc(doc(db, 'attendance', `${classId}_${inp}`), {
        classId, date: inp, records: {}, updatedAt: Date.now(),
      });
      setHistory(h => [...h, { classId, date: inp, records: {}, updatedAt: Date.now() }]);
      setDate(inp);
      setTab('check');
    } catch (e: any) {
      alert('❌ เพิ่มไม่สำเร็จ: ' + (e?.message || e));
    }
  };

  const exportCsv = () => {
    const rows = [['รหัส', 'ชื่อ', 'สถานะ', 'หมายเหตุ']];
    students.forEach(s => {
      const r = records[s.id];
      rows.push([s.code || '', s.name, r ? STATUS_LABELS[r.status] : '-', r?.note || '']);
    });
    const csv = '\ufeff' + rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `เช็คชื่อ_${currentClass?.label}_${date}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#FFF7ED' }}>
      {/* Header */}
      <header style={{
        background: 'linear-gradient(135deg,#FF6A01,#FB923C)', color: 'white',
        padding: '1.2rem 1.25rem', boxShadow: '0 4px 20px rgba(255,106,1,0.3)',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Link to="/teacher-hub" style={{ color: 'white', display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontSize: '0.85rem', opacity: 0.9 }}>
            <ChevronLeft size={16} />🏫 Hub
          </Link>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 900 }}>📋 ระบบเช็คชื่อนักเรียนออนไลน์</div>
            <div style={{ fontSize: '0.78rem', opacity: 0.9 }}>โรงเรียนบ้านคลองมดแดง</div>
          </div>
          {isSuper && (
            <span style={{
              background: 'rgba(255,255,255,0.25)', color: 'white', padding: '4px 10px',
              borderRadius: 999, fontSize: '0.72rem', fontWeight: 800,
              border: '1px solid rgba(255,255,255,0.4)',
            }}>👑 jameskmd</span>
          )}
          <Link to="/print-form/attendance" style={{
            background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.4)',
            padding: '6px 12px', borderRadius: 8, fontWeight: 700, fontSize: '0.8rem',
            display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none',
          }}>🖨️ พิมพ์ฟอร์ม</Link>
          <button onClick={onLogout} style={{
            background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.4)',
            padding: '6px 12px', borderRadius: 8, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
            <LogOut size={12} />ออกจากระบบ
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '1.25rem' }}>
        {/* Today's check-in status banner */}
        {(() => {
          const pending = classes.filter(c => !todayDocs.has(c.classId));
          const done = classes.length - pending.length;
          if (classes.length === 0) return null;
          const allDone = pending.length === 0;
          return (
            <div style={{
              background: allDone ? '#DCFCE7' : '#FEF3C7',
              border: `1px solid ${allDone ? '#86EFAC' : '#FDE68A'}`,
              borderRadius: 12, padding: '12px 14px', marginBottom: 14,
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: pending.length ? 8 : 0,
              }}>
                <span style={{ fontSize: '1.4rem' }}>{allDone ? '✅' : '⚠️'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 900, color: allDone ? '#166534' : '#92400E', fontSize: '0.95rem' }}>
                    {allDone
                      ? `เช็คชื่อครบทุกชั้นแล้ววันนี้ (${done}/${classes.length})`
                      : `ยังไม่ได้เช็คชื่อ ${pending.length} ชั้นวันนี้ — เช็คแล้ว ${done}/${classes.length}`}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748B' }}>{fmtThai(today)}</div>
                </div>
              </div>
              {pending.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {pending.map(c => (
                    <button key={c.classId} onClick={() => { setClassId(c.classId); setDate(today); setTab('check'); }}
                      style={{
                        background: 'white', border: '1px solid #FDE68A', color: '#92400E',
                        padding: '4px 10px', borderRadius: 999, fontSize: '0.78rem', fontWeight: 800,
                        cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
                      }}>
                      📋 {c.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* Filters */}
        <div style={{
          background: 'white', borderRadius: 14, padding: '1rem',
          marginBottom: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12,
        }}>
          <div>
            <label style={lbl}>เลือกชั้นเรียน</label>
            <select value={classId} onChange={e => setClassId(e.target.value)} style={inp}>
              {classes.map(c => <option key={c.classId} value={c.classId}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>
              วันที่เช็คชื่อ {!isSuper && date !== today && <span style={{ color: '#EF4444', fontSize: '0.7rem' }}>(อ่านอย่างเดียว)</span>}
            </label>
            <input type="date" value={date} max={isSuper ? undefined : today}
              onChange={e => setDate(e.target.value)} style={inp} />
            <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: 4 }}>
              {fmtThai(date)}
              {isSuper && <span style={{ color: '#7C2D12', fontWeight: 700, marginLeft: 8 }}>👑 ผู้ดูแลระบบ — แก้ไขย้อนหลังได้</span>}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, overflowX: 'auto' }}>
          {([
            ['check', <Users size={14} />, 'เช็คชื่อ'],
            ['summary', <Calendar size={14} />, 'สรุป'],
            ['stats', <BarChart3 size={14} />, 'สถิติ'],
            ['school', <BarChart3 size={14} />, '🏫 ทั้งโรงเรียน'],
            ...(isSuper ? [['history', <Calendar size={14} />, '🗓️ ประวัติย้อนหลัง']] : []),
          ] as any[]).map(([k, ic, l]: any) => (
            <button key={k} onClick={() => setTab(k)} style={{
              ...tabBtn, whiteSpace: 'nowrap',
              background: tab === k ? BRAND : 'white',
              color: tab === k ? 'white' : '#475569',
            }}>{ic}{l}</button>
          ))}
        </div>

        {/* CHECK TAB */}
        {tab === 'check' && (
          <>
            {/* Read-only banner for normal users on past dates */}
            {!isSuper && date !== today && (
              <div style={{
                background: '#FEF3C7', border: '1px solid #FDE68A', color: '#92400E',
                padding: '10px 14px', borderRadius: 10, marginBottom: 12,
                fontSize: '0.85rem', fontWeight: 700,
              }}>
                🔒 โหมดอ่านอย่างเดียว — แก้ไขย้อนหลังต้องเข้าโดยผู้ดูแลระบบ ({fmtThai(date)})
              </div>
            )}

            {/* Quick actions */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <button onClick={() => markAll('present')} disabled={!isSuper && date !== today}
                style={{ ...quickBtn, background: BRAND, opacity: (!isSuper && date !== today) ? 0.4 : 1 }}>
                ✓ มาทั้งหมด
              </button>
              <button onClick={clearAll} disabled={!isSuper && date !== today}
                style={{ ...quickBtn, background: '#EF4444', opacity: (!isSuper && date !== today) ? 0.4 : 1 }}>
                ↺ ล้างทั้งหมด
              </button>
              <button onClick={save} disabled={saving || (!isSuper && date !== today)}
                style={{ ...quickBtn, background: '#0F172A', marginLeft: 'auto', opacity: (!isSuper && date !== today) ? 0.4 : 1 }}>
                <Save size={14} style={{ marginRight: 4 }} />{saving ? 'กำลังบันทึก…' : 'บันทึกข้อมูล'}
              </button>
              {savedAt && <span style={{ fontSize: '0.72rem', color: BRAND, fontWeight: 700 }}>✓ {savedAt.toLocaleTimeString('th-TH')}</span>}
            </div>

            {/* Mini summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 14 }}>
              <Stat label="มา" value={counts.present} color={STATUS_COLORS.present} />
              <Stat label="ขาด" value={counts.absent} color={STATUS_COLORS.absent} />
              <Stat label="ลา" value={counts.leave} color={STATUS_COLORS.leave} />
              <Stat label="ยังไม่เช็ค" value={counts.untracked} color="#94A3B8" />
            </div>

            {/* Student list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {students.map((s, i) => {
                const r = records[s.id];
                const st = r?.status;
                return (
                  <div key={s.id} style={{
                    background: 'white', borderRadius: 12, padding: '12px 14px',
                    display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                    borderLeft: st ? `4px solid ${STATUS_COLORS[st]}` : '4px solid #E2E8F0',
                  }}>
                    <span style={{ fontWeight: 800, color: '#94A3B8', minWidth: 24 }}>{i + 1}</span>
                    <span style={{ fontSize: '1.6rem' }}>{s.emoji || '🧒'}</span>
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>{s.code}</div>
                      <div style={{ fontWeight: 700, color: '#0F172A' }}>{s.name}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {(['present', 'absent', 'leave'] as Status[]).map(status => (
                        <button key={status} onClick={() => setStatus(s.id, status)}
                          disabled={!isSuper && date !== today}
                          style={{
                          padding: '8px 12px', borderRadius: 10, border: 'none',
                          cursor: (!isSuper && date !== today) ? 'not-allowed' : 'pointer',
                          fontWeight: 800, fontSize: '0.78rem',
                          background: st === status ? STATUS_COLORS[status] : '#F1F5F9',
                          color: st === status ? 'white' : '#64748B',
                          opacity: (!isSuper && date !== today) ? 0.5 : 1,
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                        }}>
                          {status === 'present' ? <Check size={12} /> : status === 'absent' ? <XIcon size={12} /> : <Clock size={12} />}
                          {STATUS_LABELS[status]}
                        </button>
                      ))}
                    </div>
                    <input
                      placeholder="หมายเหตุ..."
                      value={r?.note || ''}
                      readOnly={!isSuper && date !== today}
                      onChange={e => setNote(s.id, e.target.value)}
                      style={{ ...inp, maxWidth: 180, fontSize: '0.78rem' }}
                    />
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* SUMMARY TAB */}
        {tab === 'summary' && (
          <div>
            <div style={{
              background: 'linear-gradient(135deg,#0F172A,#1E3A8A)', color: 'white',
              padding: '1.5rem', borderRadius: 18, marginBottom: 14, textAlign: 'center',
            }}>
              <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>อัตราการเข้าเรียนวันนี้</div>
              <div style={{ fontSize: '3rem', fontWeight: 900, marginTop: 4 }}>{pct}%</div>
              <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>{counts.present} จาก {total} คน</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10, marginBottom: 14 }}>
              <BigStat label="มาเรียน" value={counts.present} color={STATUS_COLORS.present} />
              <BigStat label="ขาดเรียน" value={counts.absent} color={STATUS_COLORS.absent} />
              <BigStat label="ลา" value={counts.leave} color={STATUS_COLORS.leave} />
            </div>

            <div style={{ background: 'white', borderRadius: 14, padding: '1rem', marginBottom: 14 }}>
              <h6 style={{ fontWeight: 800, color: '#0F172A', marginBottom: 12 }}>นักเรียนที่ขาด/ลา วันนี้</h6>
              {students.filter(s => records[s.id] && records[s.id].status !== 'present').length === 0 ? (
                <div style={{ color: '#94A3B8', fontSize: '0.85rem' }}>ไม่มี ✓</div>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {students.filter(s => records[s.id] && records[s.id].status !== 'present').map(s => {
                    const r = records[s.id];
                    return (
                      <li key={s.id} style={{
                        padding: '8px 12px', borderLeft: `3px solid ${STATUS_COLORS[r.status]}`,
                        background: '#FFF7ED', marginBottom: 6, borderRadius: 6,
                      }}>
                        <span style={{ fontWeight: 700 }}>{s.name}</span> ·{' '}
                        <span style={{ color: STATUS_COLORS[r.status], fontWeight: 700 }}>{STATUS_LABELS[r.status]}</span>
                        {r.note && <span style={{ color: '#64748B', fontSize: '0.8rem' }}> — {r.note}</span>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <button onClick={exportCsv} style={{
              background: BRAND, color: 'white', padding: '10px 16px', borderRadius: 10,
              border: 'none', fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              <Download size={14} />ดาวน์โหลด CSV
            </button>
          </div>
        )}

        {/* STATS TAB */}
        {tab === 'stats' && (
          <div>
            <div style={{ background: 'white', borderRadius: 14, padding: '1rem', marginBottom: 14 }}>
              <h6 style={{ fontWeight: 800, color: '#0F172A', marginBottom: 12 }}>สถิติการเข้าเรียน 14 วันล่าสุด</h6>
              {dailyStats.length === 0 ? (
                <div style={{ color: '#94A3B8', fontSize: '0.85rem' }}>ยังไม่มีข้อมูล</div>
              ) : (
                <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', minHeight: 180, overflowX: 'auto', paddingBottom: 30, position: 'relative' }}>
                  {dailyStats.map(d => {
                    const tot = d.p + d.a + d.l || 1;
                    const max = Math.max(...dailyStats.map(x => x.p + x.a + x.l), 1);
                    const h = ((d.p + d.a + d.l) / max) * 150;
                    return (
                      <div key={d.date} style={{ minWidth: 50, textAlign: 'center' }}>
                        <div style={{ height: h, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', borderRadius: '6px 6px 0 0', overflow: 'hidden' }}>
                          {d.l > 0 && <div style={{ background: STATUS_COLORS.leave, height: `${(d.l / tot) * 100}%` }} />}
                          {d.a > 0 && <div style={{ background: STATUS_COLORS.absent, height: `${(d.a / tot) * 100}%` }} />}
                          {d.p > 0 && <div style={{ background: STATUS_COLORS.present, height: `${(d.p / tot) * 100}%` }} />}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: '#64748B', marginTop: 4, transform: 'rotate(-30deg)', transformOrigin: 'top left', whiteSpace: 'nowrap' }}>
                          {fmtThai(d.date).split(' ').slice(0, 2).join(' ')}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <Legend />
            </div>

            <div style={{ background: 'white', borderRadius: 14, padding: '1rem' }}>
              <h6 style={{ fontWeight: 800, color: '#0F172A', marginBottom: 12 }}>อัตราการเข้าเรียนของนักเรียน</h6>
              {studentRates.filter(s => s.tot > 0).length === 0 ? (
                <div style={{ color: '#94A3B8', fontSize: '0.85rem' }}>ยังไม่มีประวัติ — เริ่มเช็คชื่อก่อน</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {studentRates.map(s => (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ minWidth: 160, fontSize: '0.8rem', fontWeight: 700, color: '#0F172A' }}>{s.name}</span>
                      <div style={{ flex: 1, height: 18, background: '#F1F5F9', borderRadius: 9, overflow: 'hidden' }}>
                        <div style={{
                          width: `${s.rate}%`, height: '100%',
                          background: s.rate >= 80 ? STATUS_COLORS.present : s.rate >= 60 ? STATUS_COLORS.leave : STATUS_COLORS.absent,
                        }} />
                      </div>
                      <span style={{ minWidth: 50, fontSize: '0.85rem', fontWeight: 800, color: '#0F172A', textAlign: 'right' }}>{s.rate}%</span>
                      <span style={{ minWidth: 90, fontSize: '0.7rem', color: '#94A3B8' }}>
                        {s.p}/{s.tot} วัน
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {studentRates.some(s => s.rate < 60 && s.tot > 0) && (
              <div style={{
                marginTop: 14, padding: '12px 14px', background: '#FEF3C7',
                borderRadius: 10, borderLeft: '4px solid #F59E0B', display: 'flex', gap: 10,
              }}>
                <AlertCircle size={20} color="#B45309" style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 800, color: '#B45309' }}>นักเรียนที่ควรติดตาม (เข้าเรียน &lt; 60%)</div>
                  <div style={{ fontSize: '0.85rem', color: '#7C2D12', marginTop: 4 }}>
                    {studentRates.filter(s => s.rate < 60 && s.tot > 0).map(s => s.name).join(', ')}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SCHOOL-WIDE TAB */}
        {tab === 'school' && (
          <SchoolStats classes={classes} onJump={(cid) => { setClassId(cid); setTab('check'); }} />
        )}

        {/* HISTORY TAB — super only */}
        {tab === 'history' && isSuper && (
          <div style={{ background: 'white', borderRadius: 14, padding: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
              <h6 style={{ fontWeight: 800, color: '#0F172A', margin: 0, flex: 1 }}>
                🗓️ ประวัติการเช็คชื่อย้อนหลัง — {currentClass?.label}
              </h6>
              <button onClick={addNewDay} style={{
                background: BRAND, color: 'white', border: 'none', borderRadius: 10,
                padding: '8px 14px', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}>
                <Plus size={14} /> เพิ่มวันใหม่
              </button>
            </div>
            <p style={{ color: '#64748B', fontSize: '0.8rem', marginBottom: 14 }}>
              {history.length} วัน — กด ✏️ เพื่อแก้ไข, 🗑️ เพื่อลบ
            </p>
            {history.length === 0 ? (
              <div style={{ color: '#94A3B8', fontSize: '0.85rem', padding: '2rem', textAlign: 'center' }}>
                ยังไม่มีประวัติของชั้นนี้
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 10 }}>
                {[...history].sort((a, b) => b.date.localeCompare(a.date)).map(h => {
                  let p = 0, a = 0, l = 0;
                  Object.values(h.records || {}).forEach(r => {
                    if (r.status === 'present') p++;
                    else if (r.status === 'absent') a++;
                    else if (r.status === 'leave') l++;
                  });
                  const tot = p + a + l;
                  const isSel = h.date === date;
                  return (
                    <div key={h.date} style={{
                      padding: '12px 14px', borderRadius: 12,
                      border: isSel ? `2px solid ${BRAND}` : '1px solid #FFEDD5',
                      background: isSel ? '#FFF7ED' : 'white',
                    }}>
                      <div style={{ fontSize: '0.7rem', color: '#94A3B8', fontWeight: 700 }}>{h.date}</div>
                      <div style={{ fontWeight: 900, color: BRAND_DARK, marginBottom: 6 }}>{fmtThai(h.date)}</div>
                      <div style={{ display: 'flex', gap: 8, fontSize: '0.75rem', fontWeight: 700, marginBottom: 8 }}>
                        <span style={{ color: STATUS_COLORS.present }}>มา {p}</span>
                        <span style={{ color: STATUS_COLORS.absent }}>ขาด {a}</span>
                        <span style={{ color: STATUS_COLORS.leave }}>ลา {l}</span>
                        <span style={{ color: '#94A3B8', marginLeft: 'auto' }}>{tot} คน</span>
                      </div>
                      {h.updatedAt && (
                        <div style={{ fontSize: '0.65rem', color: '#94A3B8', marginBottom: 8 }}>
                          แก้ไขล่าสุด: {new Date(h.updatedAt).toLocaleString('th-TH')}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => { setDate(h.date); setTab('check'); }} style={{
                          flex: 1, background: BRAND, color: 'white', border: 'none', borderRadius: 8,
                          padding: '6px 10px', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer',
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                        }}>
                          <Edit2 size={12} /> แก้ไข
                        </button>
                        <button onClick={() => deleteDay(h.date)} style={{
                          background: 'white', color: '#DC2626', border: '1px solid #FECACA',
                          borderRadius: 8, padding: '6px 10px', fontWeight: 800, fontSize: '0.78rem',
                          cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
                        }}>
                          <Trash2 size={12} /> ลบ
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

const Stat = ({ label, value, color }: { label: string; value: number; color: string }) => (
  <div style={{ background: 'white', padding: 10, borderRadius: 10, textAlign: 'center', borderTop: `3px solid ${color}` }}>
    <div style={{ fontSize: '1.5rem', fontWeight: 900, color }}>{value}</div>
    <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700 }}>{label}</div>
  </div>
);

const BigStat = ({ label, value, color }: { label: string; value: number; color: string }) => (
  <div style={{ background: 'white', padding: '1rem', borderRadius: 14, borderLeft: `4px solid ${color}` }}>
    <div style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 700 }}>{label}</div>
    <div style={{ fontSize: '2rem', fontWeight: 900, color, marginTop: 4 }}>{value}</div>
  </div>
);

const Legend = () => (
  <div style={{ display: 'flex', gap: 14, marginTop: 8, fontSize: '0.78rem' }}>
    {(['present', 'absent', 'leave'] as Status[]).map(s => (
      <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <span style={{ width: 12, height: 12, background: STATUS_COLORS[s], borderRadius: 3 }} />
        {STATUS_LABELS[s]}
      </span>
    ))}
  </div>
);

// ════════════════════════════════════════════════════════════════
// SCHOOL-WIDE STATISTICS
// ════════════════════════════════════════════════════════════════
function SchoolStats({ classes, onJump }: { classes: ClassRoster[]; onJump: (cid: string) => void }) {
  const [allDocs, setAllDocs] = useState<AttDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const snap = await getDocs(collection(db, 'attendance'));
        const arr: AttDoc[] = [];
        snap.forEach(d => arr.push(d.data() as AttDoc));
        setAllDocs(arr);
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, []);

  const today = todayStr();
  const totalStudents = classes.reduce((s, c) => s + c.students.length, 0);

  // ─── Per-class stats over all history ───
  const classRates = useMemo(() => {
    return classes.map(c => {
      const docs = allDocs.filter(d => d.classId === c.classId);
      let p = 0, a = 0, l = 0, days = 0;
      docs.forEach(d => {
        const recs = Object.values(d.records || {});
        if (recs.length === 0) return;
        days++;
        recs.forEach(r => {
          if (r.status === 'present') p++;
          else if (r.status === 'absent') a++;
          else if (r.status === 'leave') l++;
        });
      });
      const tot = p + a + l;
      const rate = tot ? Math.round((p / tot) * 100) : 0;
      return { c, p, a, l, tot, rate, days };
    }).sort((x, y) => y.rate - x.rate);
  }, [classes, allDocs]);

  // ─── Today's attendance per class ───
  const todayPerClass = useMemo(() => {
    const map = new Map<string, AttDoc>();
    allDocs.filter(d => d.date === today).forEach(d => map.set(d.classId, d));
    return classes.map(c => {
      const doc = map.get(c.classId);
      if (!doc) return { c, status: 'pending' as const, p: 0, a: 0, l: 0 };
      let p = 0, a = 0, l = 0;
      Object.values(doc.records || {}).forEach(r => {
        if (r.status === 'present') p++;
        else if (r.status === 'absent') a++;
        else if (r.status === 'leave') l++;
      });
      return { c, status: 'done' as const, p, a, l };
    });
  }, [classes, allDocs, today]);

  // ─── 30-day trend (whole school) ───
  const trend = useMemo(() => {
    const byDate: Record<string, { p: number; a: number; l: number }> = {};
    allDocs.forEach(d => {
      if (!byDate[d.date]) byDate[d.date] = { p: 0, a: 0, l: 0 };
      Object.values(d.records || {}).forEach(r => {
        if (r.status === 'present') byDate[d.date].p++;
        else if (r.status === 'absent') byDate[d.date].a++;
        else if (r.status === 'leave') byDate[d.date].l++;
      });
    });
    return Object.entries(byDate)
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30);
  }, [allDocs]);

  // ─── Top absentees school-wide ───
  const absentees = useMemo(() => {
    const map: Record<string, { sid: string; name: string; classLabel: string; absent: number; total: number }> = {};
    classes.forEach(c => {
      c.students.forEach(s => {
        map[s.id] = { sid: s.id, name: s.name, classLabel: c.label, absent: 0, total: 0 };
      });
    });
    allDocs.forEach(d => {
      Object.entries(d.records || {}).forEach(([sid, r]) => {
        if (!map[sid]) return;
        map[sid].total++;
        if (r.status === 'absent') map[sid].absent++;
      });
    });
    return Object.values(map)
      .filter(s => s.absent > 0)
      .sort((a, b) => b.absent - a.absent)
      .slice(0, 15);
  }, [classes, allDocs]);

  // ─── Today's whole-school summary ───
  const todayDone = todayPerClass.filter(x => x.status === 'done');
  const todayP = todayDone.reduce((s, x) => s + x.p, 0);
  const todayA = todayDone.reduce((s, x) => s + x.a, 0);
  const todayL = todayDone.reduce((s, x) => s + x.l, 0);
  const todayTot = todayP + todayA + todayL;
  const todayPct = todayTot ? Math.round((todayP / todayTot) * 100) : 0;

  if (loading) return (
    <div style={{ background: 'white', padding: '3rem', textAlign: 'center', color: '#94A3B8', borderRadius: 14 }}>
      ⏳ กำลังโหลดข้อมูลทั้งโรงเรียน...
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Today summary */}
      <div style={{
        background: 'linear-gradient(135deg,#0F172A,#1E3A8A)', color: 'white',
        borderRadius: 14, padding: '1.25rem',
      }}>
        <div style={{ fontSize: '0.85rem', opacity: 0.85, fontWeight: 700, letterSpacing: 1 }}>📊 ภาพรวมวันนี้ — {fmtThai(today)}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginTop: 12 }}>
          <BigStat label="นักเรียนทั้งโรงเรียน" value={totalStudents} color="#60A5FA" />
          <BigStat label="มาเรียน" value={todayP} color="#FF6A01" />
          <BigStat label="ขาด" value={todayA} color="#EF4444" />
          <BigStat label="ลา" value={todayL} color="#F59E0B" />
          <BigStat label={`% มาเรียน`} value={todayPct} color="#10B981" />
        </div>
        <div style={{ marginTop: 10, fontSize: '0.85rem', opacity: 0.9 }}>
          เช็คชื่อแล้ว <b>{todayDone.length}/{classes.length}</b> ชั้น ·
          ยังไม่ได้เช็ค <b>{classes.length - todayDone.length}</b> ชั้น
        </div>
      </div>

      {/* Today per class */}
      <div style={{ background: 'white', borderRadius: 14, padding: '1rem' }}>
        <h6 style={{ fontWeight: 800, color: '#0F172A', marginBottom: 12 }}>
          📋 สถานะวันนี้แยกตามชั้น (คลิกเพื่อไปเช็ค)
        </h6>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 8 }}>
          {todayPerClass.map(x => {
            const tot = x.p + x.a + x.l;
            const pct = tot ? Math.round((x.p / tot) * 100) : 0;
            return (
              <button key={x.c.classId} onClick={() => onJump(x.c.classId)} style={{
                background: x.status === 'done' ? '#FFF7ED' : '#F1F5F9',
                border: x.status === 'done' ? `2px solid ${BRAND}` : '2px dashed #CBD5E1',
                borderRadius: 10, padding: '10px 12px', textAlign: 'left',
                cursor: 'pointer',
              }}>
                <div style={{ fontWeight: 900, color: '#0F172A', marginBottom: 4 }}>{x.c.label}</div>
                {x.status === 'done' ? (
                  <>
                    <div style={{ fontSize: '0.78rem', color: '#7C2D12' }}>
                      มา <b style={{ color: BRAND }}>{x.p}</b> · ขาด <b style={{ color: '#EF4444' }}>{x.a}</b> · ลา <b style={{ color: '#F59E0B' }}>{x.l}</b>
                    </div>
                    <div style={{ marginTop: 4, height: 6, background: '#FFEDD5', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: BRAND }} />
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#94A3B8', marginTop: 2 }}>{pct}% มาเรียน</div>
                  </>
                ) : (
                  <div style={{ fontSize: '0.78rem', color: '#94A3B8' }}>⏳ ยังไม่เช็คชื่อวันนี้</div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 30-day trend chart */}
      <div style={{ background: 'white', borderRadius: 14, padding: '1rem' }}>
        <h6 style={{ fontWeight: 800, color: '#0F172A', marginBottom: 12 }}>📈 แนวโน้มการมาเรียน 30 วันล่าสุด (ทั้งโรงเรียน)</h6>
        {trend.length === 0 ? (
          <div style={{ color: '#94A3B8', fontSize: '0.85rem' }}>ยังไม่มีข้อมูล</div>
        ) : (
          <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', minHeight: 200, paddingBottom: 30, overflowX: 'auto' }}>
            {trend.map(d => {
              const tot = d.p + d.a + d.l || 1;
              const max = Math.max(...trend.map(x => x.p + x.a + x.l), 1);
              const h = ((d.p + d.a + d.l) / max) * 170;
              return (
                <div key={d.date} style={{ minWidth: 30, textAlign: 'center' }}>
                  <div style={{ height: h, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', borderRadius: '4px 4px 0 0', overflow: 'hidden' }}>
                    {d.l > 0 && <div title={`ลา ${d.l}`} style={{ background: STATUS_COLORS.leave, height: `${(d.l / tot) * 100}%` }} />}
                    {d.a > 0 && <div title={`ขาด ${d.a}`} style={{ background: STATUS_COLORS.absent, height: `${(d.a / tot) * 100}%` }} />}
                    {d.p > 0 && <div title={`มา ${d.p}`} style={{ background: STATUS_COLORS.present, height: `${(d.p / tot) * 100}%` }} />}
                  </div>
                  <div style={{ fontSize: '0.6rem', color: '#64748B', marginTop: 4, transform: 'rotate(-45deg)', transformOrigin: 'top left', whiteSpace: 'nowrap' }}>
                    {d.date.slice(5)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <Legend />
      </div>

      {/* Class ranking */}
      <div style={{ background: 'white', borderRadius: 14, padding: '1rem' }}>
        <h6 style={{ fontWeight: 800, color: '#0F172A', marginBottom: 12 }}>🏆 อัตราการมาเรียนแยกตามชั้น (จากประวัติทั้งหมด)</h6>
        {classRates.filter(r => r.tot > 0).length === 0 ? (
          <div style={{ color: '#94A3B8', fontSize: '0.85rem' }}>ยังไม่มีประวัติ — เริ่มเช็คชื่อก่อน</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {classRates.filter(r => r.tot > 0).map((r, i) => (
              <div key={r.c.classId} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ minWidth: 30, fontWeight: 900, color: i < 3 ? '#FF6A01' : '#94A3B8' }}>{i + 1}</span>
                <span style={{ minWidth: 80, fontWeight: 700, color: '#0F172A' }}>{r.c.label}</span>
                <div style={{ flex: 1, height: 18, background: '#F1F5F9', borderRadius: 9, overflow: 'hidden' }}>
                  <div style={{
                    width: `${r.rate}%`, height: '100%',
                    background: r.rate >= 90 ? STATUS_COLORS.present : r.rate >= 70 ? STATUS_COLORS.leave : STATUS_COLORS.absent,
                  }} />
                </div>
                <span style={{ minWidth: 45, fontWeight: 800, color: '#0F172A', textAlign: 'right' }}>{r.rate}%</span>
                <span style={{ minWidth: 90, fontSize: '0.75rem', color: '#94A3B8' }}>{r.days} วันบันทึก</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top absentees */}
      {absentees.length > 0 && (
        <div style={{ background: 'white', borderRadius: 14, padding: '1rem' }}>
          <h6 style={{ fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>⚠️ นักเรียนที่ขาดเรียนสูงสุด (ทั้งโรงเรียน)</h6>
          <p style={{ fontSize: '0.78rem', color: '#94A3B8', marginBottom: 12 }}>นับจากประวัติทั้งหมด · แสดง 15 อันดับ</p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#FFF7ED' }}>
                  <th style={{ padding: 8, textAlign: 'center' }}>#</th>
                  <th style={{ padding: 8, textAlign: 'left' }}>ชื่อ-สกุล</th>
                  <th style={{ padding: 8 }}>ชั้น</th>
                  <th style={{ padding: 8 }}>ขาด (วัน)</th>
                  <th style={{ padding: 8 }}>จากทั้งหมด</th>
                  <th style={{ padding: 8 }}>%</th>
                </tr>
              </thead>
              <tbody>
                {absentees.map((s, i) => {
                  const pct = s.total ? Math.round((s.absent / s.total) * 100) : 0;
                  return (
                    <tr key={s.sid} style={{ borderBottom: '1px solid #FFF7ED' }}>
                      <td style={{ padding: 8, textAlign: 'center', fontWeight: 800, color: i < 3 ? '#EF4444' : '#94A3B8' }}>{i + 1}</td>
                      <td style={{ padding: 8, fontWeight: 700 }}>{s.name}</td>
                      <td style={{ padding: 8, textAlign: 'center' }}>{s.classLabel}</td>
                      <td style={{ padding: 8, textAlign: 'center', fontWeight: 800, color: '#EF4444' }}>{s.absent}</td>
                      <td style={{ padding: 8, textAlign: 'center', color: '#64748B' }}>{s.total}</td>
                      <td style={{ padding: 8, textAlign: 'center', fontWeight: 800, color: pct >= 30 ? '#EF4444' : '#F59E0B' }}>{pct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

const lbl: React.CSSProperties = { fontSize: '0.78rem', fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 4 };
const inp: React.CSSProperties = { width: '100%', padding: '8px 12px', borderRadius: 10, border: '1px solid #E2E8F0', fontSize: '0.9rem' };
const tabBtn: React.CSSProperties = { padding: '8px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: 6 };
const quickBtn: React.CSSProperties = { padding: '8px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: '0.8rem', color: 'white', display: 'inline-flex', alignItems: 'center' };
