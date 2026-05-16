import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { collection, doc, onSnapshot, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { TIMETABLE_BACKUP } from '../data/timetableData';
import {
  ChevronLeft, LogOut, Users, Calendar, Award, Target,
  BookOpen, DollarSign, Activity, Sparkles,
} from 'lucide-react';
import { useTeacherAuth } from '../utils/teacherAuth';
import TeacherLoginGate from '../components/TeacherLoginGate';

const BRAND = '#FF6A01';
const KG = [{ id: 'kg_a2_1', label: 'อ.2/1' }, { id: 'kg_a3_1', label: 'อ.3/1' }];

interface Student { id: string; code?: string; name: string; emoji?: string; }
interface ClassRoster { classId: string; label: string; students: Student[]; }

export default function ClassDashboardPage() {
  const auth = useTeacherAuth();
  if (!auth.authed) return <TeacherLoginGate title="📊 แดชบอร์ดชั้นเรียน" subtitle="ดูภาพรวมทุกระบบของแต่ละชั้น" />;
  return <App userName={auth.name} onLogout={auth.logout} />;
}

function App({ userName, onLogout }: { userName: string; onLogout: () => void }) {
  const [classes, setClasses] = useState<ClassRoster[]>([]);
  const [classId, setClassId] = useState('');

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

  const cls = availableClasses.find(c => c.id === classId);

  return (
    <div style={{ minHeight: '100vh', background: '#FFF7ED' }}>
      <header style={{ background: 'linear-gradient(135deg,#0F172A,#1E3A8A)', color: 'white', padding: '1.2rem 1.25rem' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Link to="/teacher-hub" style={lnk}><ChevronLeft size={16} />Hub</Link>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: '0.78rem', opacity: 0.9, fontWeight: 700, letterSpacing: 2 }}>CLASS DASHBOARD</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 900 }}>📊 แดชบอร์ดรายชั้นเรียน</div>
            <div style={{ fontSize: '0.78rem', opacity: 0.9 }}>เลือกชั้น → ดูภาพรวมทุกระบบ · {userName}</div>
          </div>
          <button onClick={onLogout} style={btnLogout}><LogOut size={12} />ออก</button>
        </div>
      </header>

      <main style={{ maxWidth: 1400, margin: '0 auto', padding: '1.25rem' }}>
        {/* Class picker */}
        <div style={{ background: 'white', borderRadius: 14, padding: '1rem', marginBottom: 14 }}>
          <label style={lbl}>เลือกชั้นเรียน</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
            {availableClasses.map(c => (
              <button key={c.id} onClick={() => setClassId(c.id)} style={{
                padding: '8px 16px', borderRadius: 10, cursor: 'pointer',
                background: classId === c.id ? BRAND : 'white',
                color: classId === c.id ? 'white' : '#475569',
                fontWeight: 800, fontSize: '0.88rem',
                boxShadow: classId === c.id ? '0 4px 10px rgba(255,106,1,0.3)' : '0 1px 3px rgba(0,0,0,0.05)',
                border: classId === c.id ? 'none' : '1px solid #E2E8F0',
              }}>{c.label} <small style={{ opacity: 0.7 }}>({c.students.length})</small></button>
            ))}
          </div>
        </div>

        {cls && <Dashboard cls={cls} />}
      </main>
    </div>
  );
}

function Dashboard({ cls }: { cls: { id: string; label: string; students: Student[] } }) {
  const [attDocs, setAttDocs] = useState<any[]>([]);
  const [clubs, setClubs] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [logs, setLogs] = useState<Record<string, any[]>>({});

  const today = todayStr();
  const classLabel = cls.label;

  // Attendance
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(query(collection(db, 'attendance'), where('classId', '==', cls.id)));
        const arr: any[] = [];
        snap.forEach(d => arr.push(d.data()));
        setAttDocs(arr);
      } catch (e) { console.error(e); }
    })();
  }, [cls.id]);

  // Clubs (filter to those with members from this class)
  useEffect(() => {
    return onSnapshot(collection(db, 'clubs'), snap => {
      const arr: any[] = [];
      snap.forEach(d => {
        const data = { id: d.id, ...(d.data() as any) };
        const membersFromClass = (data.members || []).filter((m: any) => m.classLabel === classLabel);
        if (membersFromClass.length > 0) {
          arr.push({ ...data, _membersFromClass: membersFromClass });
        }
      });
      setClubs(arr);
    });
  }, [classLabel]);

  // Results
  useEffect(() => {
    return onSnapshot(collection(db, 'results'), snap => {
      const arr: any[] = [];
      snap.forEach(d => {
        const data = { id: d.id, ...(d.data() as any) };
        if (data.classId === cls.id) arr.push(data);
      });
      arr.sort((a, b) => b.publishedAt - a.publishedAt);
      setResults(arr);
    });
  }, [cls.id]);

  // Generic logs (filter by classLabel field if present) — student-facing only
  useEffect(() => {
    const types = ['saving', 'remedial', 'body_metrics'];
    const unsubs = types.map(t => onSnapshot(collection(db, `log_${t}`), snap => {
      const arr: any[] = [];
      snap.forEach(d => arr.push(d.data()));
      // Filter to entries for this class (if they have classLabel field)
      const filtered = arr.filter(x =>
        !x.classLabel || x.classLabel === classLabel || x.classLabel.includes(classLabel.split('/')[0])
      );
      setLogs(prev => ({ ...prev, [t]: filtered.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)) }));
    }));
    return () => unsubs.forEach(u => u());
  }, [classLabel]);

  // ─── Computed ───
  const todayAtt = attDocs.find(d => d.date === today);
  const todayCounts = useMemo(() => {
    if (!todayAtt) return null;
    let p = 0, a = 0, l = 0;
    Object.values(todayAtt.records || {}).forEach((r: any) => {
      if (r.status === 'present') p++;
      else if (r.status === 'absent') a++;
      else if (r.status === 'leave') l++;
    });
    return { p, a, l };
  }, [todayAtt]);

  const recentDays = useMemo(() => {
    return [...attDocs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);
  }, [attDocs]);

  const overallRate = useMemo(() => {
    let p = 0, t = 0;
    attDocs.forEach(d => {
      Object.values(d.records || {}).forEach((r: any) => {
        t++;
        if (r.status === 'present') p++;
      });
    });
    return t ? Math.round((p / t) * 100) : 0;
  }, [attDocs]);

  // Top absentees in this class
  const absentees = useMemo(() => {
    const map: Record<string, { sid: string; name: string; absent: number }> = {};
    cls.students.forEach(s => { map[s.id] = { sid: s.id, name: s.name, absent: 0 }; });
    attDocs.forEach(d => {
      Object.entries(d.records || {}).forEach(([sid, r]: [string, any]) => {
        if (map[sid] && r.status === 'absent') map[sid].absent++;
      });
    });
    return Object.values(map).filter(s => s.absent > 0).sort((a, b) => b.absent - a.absent).slice(0, 5);
  }, [cls.students, attDocs]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Class summary header */}
      <div style={{ background: `linear-gradient(135deg,${BRAND},#FB923C)`, color: 'white', borderRadius: 14, padding: '1.25rem' }}>
        <div style={{ fontSize: '0.78rem', opacity: 0.9, fontWeight: 700, letterSpacing: 2 }}>ภาพรวม</div>
        <h2 style={{ margin: '4px 0', fontWeight: 900 }}>🏫 ชั้น {cls.label}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginTop: 14 }}>
          <Stat label="👥 นักเรียนทั้งหมด" value={cls.students.length} color="#FCD34D" />
          <Stat label="✅ มาเรียนวันนี้" value={todayCounts?.p ?? '-'} color="#10B981" />
          <Stat label="❌ ขาด" value={todayCounts?.a ?? '-'} color="#FCA5A5" />
          <Stat label="📊 อัตรามาเรียนเฉลี่ย" value={`${overallRate}%`} color="#34D399" />
        </div>
      </div>

      {/* Two-column grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(360px,1fr))', gap: 14 }}>

        {/* Attendance recent */}
        <Card title="📋 การเช็คชื่อ 7 วันล่าสุด" icon={<Calendar size={18} />} link="/attendance">
          {recentDays.length === 0 ? <Empty msg="ยังไม่มีบันทึกการเช็คชื่อ" /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {recentDays.map(d => {
                let p = 0, a = 0, l = 0;
                Object.values(d.records || {}).forEach((r: any) => {
                  if (r.status === 'present') p++; else if (r.status === 'absent') a++; else if (r.status === 'leave') l++;
                });
                const tot = p + a + l;
                const pct = tot ? Math.round((p / tot) * 100) : 0;
                return (
                  <div key={d.date} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: '#FFF7ED', borderRadius: 8 }}>
                    <span style={{ minWidth: 90, fontSize: '0.82rem', fontWeight: 700 }}>{fmtThai(d.date)}</span>
                    <div style={{ flex: 1, display: 'flex', height: 16, borderRadius: 4, overflow: 'hidden', background: '#F1F5F9' }}>
                      {p > 0 && <div style={{ width: `${(p / tot) * 100}%`, background: BRAND }} />}
                      {a > 0 && <div style={{ width: `${(a / tot) * 100}%`, background: '#EF4444' }} />}
                      {l > 0 && <div style={{ width: `${(l / tot) * 100}%`, background: '#F59E0B' }} />}
                    </div>
                    <span style={{ fontWeight: 800, fontSize: '0.82rem', minWidth: 60, textAlign: 'right' }}>{pct}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Top absentees */}
        <Card title="⚠️ นักเรียนที่ขาดเรียนสูงสุด" icon={<Users size={18} />}>
          {absentees.length === 0 ? <Empty msg="ไม่มีนักเรียนขาดเรียน 🎉" /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {absentees.map((s, i) => (
                <div key={s.sid} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: '#FFF7ED', borderRadius: 8 }}>
                  <span style={{ fontWeight: 900, color: i < 2 ? '#EF4444' : '#94A3B8', minWidth: 24 }}>{i + 1}</span>
                  <span style={{ flex: 1, fontWeight: 700 }}>{s.name}</span>
                  <span style={{ background: '#FEE2E2', color: '#991B1B', padding: '2px 10px', borderRadius: 999, fontSize: '0.78rem', fontWeight: 800 }}>ขาด {s.absent} วัน</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Milk-brush today */}
        <Card title="🥛 นม-แปรงฟัน วันนี้" icon={<Sparkles size={18} />} link="/milk-brush-report">
          {todayCounts ? (
            <div style={{ background: '#DBEAFE', borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.85rem', color: '#1E40AF' }}>นักเรียนที่ได้รับนม+แปรงฟันวันนี้</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#1E40AF', margin: '6px 0' }}>{todayCounts.p}</div>
              <div style={{ fontSize: '0.78rem', color: '#1E40AF' }}>จากทั้งหมด {cls.students.length} คน</div>
            </div>
          ) : <Empty msg="ยังไม่ได้เช็คชื่อวันนี้" />}
        </Card>

        {/* Clubs */}
        <Card title={`🎯 ชุมนุม/กิจกรรม (${clubs.length})`} icon={<Target size={18} />} link="/club-attendance">
          {clubs.length === 0 ? <Empty msg="ยังไม่มีนักเรียนชั้นนี้ในชุมนุม" /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {clubs.slice(0, 5).map(c => (
                <div key={c.id} style={{ padding: '8px 10px', background: '#FFF7ED', borderRadius: 8 }}>
                  <div style={{ fontWeight: 800, color: '#0F172A' }}>{c.name}</div>
                  <div style={{ fontSize: '0.78rem', color: '#64748B' }}>
                    {c.type} · นักเรียนชั้นนี้ <b>{c._membersFromClass.length}</b> คน · ครู {c.advisor || '-'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Results */}
        <Card title={`🏆 ประกาศผลสอบ (${results.length})`} icon={<Award size={18} />} link="/results">
          {results.length === 0 ? <Empty msg="ยังไม่มีประกาศผลสอบของชั้นนี้" /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {results.slice(0, 3).map(r => (
                <div key={r.id} style={{ padding: '8px 10px', background: '#FFF7ED', borderRadius: 8 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 2 }}>
                    <span style={{ background: r.visible ? '#DCFCE7' : '#FEE2E2', color: r.visible ? '#166534' : '#991B1B', padding: '1px 8px', borderRadius: 999, fontSize: '0.7rem', fontWeight: 800 }}>
                      {r.visible ? '🟢 เผยแพร่' : '🔴 ซ่อน'}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: '#94A3B8' }}>{new Date(r.publishedAt).toLocaleDateString('th-TH')}</span>
                  </div>
                  <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '0.88rem' }}>{r.title}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{r.records?.length || 0} คน · {r.subjects?.length || 0} วิชา</div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Remedial */}
        <Card title={`👨‍🏫 สอนซ่อมเสริม (${logs.remedial?.length || 0})`} icon={<BookOpen size={18} />} link="/teacher-log/remedial">
          {(logs.remedial?.length || 0) === 0 ? <Empty msg="ยังไม่มีบันทึก" /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {logs.remedial.slice(0, 4).map((l: any) => (
                <div key={l.id} style={{ padding: '8px 10px', background: '#FFF7ED', borderRadius: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{l.topic}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{l.subject} · {l.date} · {l.hours} ชม.</div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Saving */}
        <Card title={`💰 ออมเงิน (${logs.saving?.length || 0} รายการ)`} icon={<DollarSign size={18} />} link="/teacher-log/saving">
          {(logs.saving?.length || 0) === 0 ? <Empty msg="ยังไม่มีบันทึก" /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {(() => {
                const total = logs.saving.reduce((s: number, x: any) => s + (Number(x.amount) || 0), 0);
                return (
                  <div style={{ padding: 10, background: '#DCFCE7', borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: '0.78rem', color: '#166534' }}>ยอดออมรวม</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#166534' }}>{total.toLocaleString('th-TH')} ฿</div>
                  </div>
                );
              })()}
              {logs.saving.slice(0, 3).map((l: any) => (
                <div key={l.id} style={{ padding: '6px 10px', background: '#FFF7ED', borderRadius: 6, fontSize: '0.78rem', display: 'flex', gap: 8 }}>
                  <span style={{ flex: 1 }}>{l.studentName}</span>
                  <span style={{ fontWeight: 800, color: '#10B981' }}>+{l.amount}฿</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Body metrics */}
        <Card title={`⚖️ น้ำหนัก-ส่วนสูง (${logs.body_metrics?.length || 0})`} icon={<Activity size={18} />} link="/teacher-log/body-metrics">
          {(logs.body_metrics?.length || 0) === 0 ? <Empty msg="ยังไม่มีบันทึก" /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {logs.body_metrics.slice(0, 5).map((l: any) => (
                <div key={l.id} style={{ padding: '8px 10px', background: '#FFF7ED', borderRadius: 8, display: 'flex', gap: 8, fontSize: '0.82rem' }}>
                  <span style={{ flex: 1, fontWeight: 700 }}>{l.studentName}</span>
                  <span>{l.weight}kg / {l.height}cm</span>
                  {l.bmi && <span style={{ background: '#FFEDD5', padding: '0 6px', borderRadius: 4 }}>BMI {l.bmi}</span>}
                </div>
              ))}
            </div>
          )}
        </Card>

      </div>
    </div>
  );
}

function Card({ title, icon, children, link }: { title: string; icon: React.ReactNode; children: React.ReactNode; link?: string }) {
  return (
    <div style={{ background: 'white', borderRadius: 12, padding: '1rem', border: '1px solid #FFEDD5' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ color: BRAND }}>{icon}</span>
        <h6 style={{ margin: 0, fontWeight: 800, color: '#0F172A', flex: 1, fontSize: '0.95rem' }}>{title}</h6>
        {link && <Link to={link} style={{ fontSize: '0.72rem', color: BRAND, textDecoration: 'none', fontWeight: 700 }}>เปิด →</Link>}
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: any; color: string }) {
  return <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: '0.75rem', borderLeft: `4px solid ${color}` }}>
    <div style={{ fontSize: '0.78rem', opacity: 0.9, fontWeight: 700 }}>{label}</div>
    <div style={{ fontSize: '2rem', fontWeight: 900, color, marginTop: 4 }}>{value}</div>
  </div>;
}

function Empty({ msg }: { msg: string }) {
  return <div style={{ padding: '1rem', textAlign: 'center', color: '#94A3B8', fontSize: '0.85rem' }}>{msg}</div>;
}

const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const fmtThai = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']; return `${d} ${months[m - 1]} ${y + 543}`; };

const lnk: React.CSSProperties = { color: 'white', display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontSize: '0.85rem', opacity: 0.9 };
const lbl: React.CSSProperties = { display: 'block', fontSize: '0.78rem', color: '#64748B', marginBottom: 4, fontWeight: 700 };
const btnLogout: React.CSSProperties = { background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.4)', padding: '6px 12px', borderRadius: 8, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 };
