import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { collection, doc, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { TIMETABLE_BACKUP } from '../data/timetableData';
import { ChevronLeft, LogOut, Printer } from 'lucide-react';
import { useTeacherAuth } from '../utils/teacherAuth';
import TeacherLoginGate from '../components/TeacherLoginGate';

const COLOR = '#EC4899';
const KG = [{ id: 'kg_a2_1', label: 'อ.2/1' }, { id: 'kg_a3_1', label: 'อ.3/1' }];
const THAI_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

interface Student { id: string; code?: string; name: string; emoji?: string; }
interface ClassRoster { classId: string; label: string; students: Student[]; }
interface LogEntry { id: string; classLabel?: string; studentName?: string; studentId?: string; weight?: number; height?: number; bmi?: number; date?: string; }

export default function BodyMetricsGridPage() {
  const auth = useTeacherAuth();
  if (!auth.authed) return <TeacherLoginGate title="⚖️ บันทึกน้ำหนัก-ส่วนสูง" subtitle="กรอกในตารางต่อชั้น+เดือน" />;
  return <App userName={auth.name} onLogout={auth.logout} />;
}

function App({ userName, onLogout }: { userName: string; onLogout: () => void }) {
  const [classes, setClasses] = useState<ClassRoster[]>([]);
  const [classId, setClassId] = useState('');
  const [month, setMonth] = useState(thisMonth());
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
    return onSnapshot(collection(db, 'log_body_metrics'), snap => {
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

  // Find existing log entry for a student in this month (match by id OR name as fallback)
  const findEntry = (s: Student): LogEntry | undefined => {
    return logs.find(l =>
      l.date?.startsWith(month) &&
      (l.classLabel === current?.label || !l.classLabel) &&
      (l.studentId === s.id || (l.studentName && l.studentName.trim() === s.name.trim()))
    );
  };

  const updateMetric = async (s: Student, patch: { weight?: number; height?: number }) => {
    if (!current) return;
    const existing = findEntry(s);
    const id = existing?.id || `bm_${classId}_${month}_${s.id}`;
    const weight = patch.weight !== undefined ? patch.weight : existing?.weight;
    const height = patch.height !== undefined ? patch.height : existing?.height;
    const bmi = (weight && height && height > 0) ? Math.round((weight / Math.pow(height / 100, 2)) * 10) / 10 : undefined;
    const docData: any = {
      id, classLabel: current.label, studentId: s.id, studentCode: s.code || s.id,
      studentName: s.name, date: `${month}-15`, teacherName: userName,
      createdAt: existing ? (existing as any).createdAt || Date.now() : Date.now(),
    };
    if (weight !== undefined && weight !== null) docData.weight = weight;
    if (height !== undefined && height !== null) docData.height = height;
    if (bmi !== undefined) docData.bmi = bmi;
    try {
      // Remove undefined values
      if (weight == null && height == null) {
        // delete the entry
        if (existing) await deleteDoc(doc(db, 'log_body_metrics', existing.id));
      } else {
        await setDoc(doc(db, 'log_body_metrics', id), docData);
        setSavedAt(new Date());
      }
    } catch (e: any) { alert('❌ ' + (e?.message || e)); }
  };

  const filledCount = students.filter(s => findEntry(s)).length;
  const [yr, mn] = month.split('-').map(Number);

  return (
    <div style={{ minHeight: '100vh', background: '#FFF7ED' }}>
      <header style={{ background: `linear-gradient(135deg,${COLOR},#F472B6)`, color: 'white', padding: '1.2rem 1.25rem' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Link to="/teacher-hub" style={lnk}><ChevronLeft size={16} />Hub</Link>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 900 }}>⚖️ บันทึกน้ำหนัก-ส่วนสูง</div>
            <div style={{ fontSize: '0.78rem', opacity: 0.9 }}>กรอกในตาราง · บันทึกอัตโนมัติ · {userName}</div>
          </div>
          <Link to="/print-body-metrics" style={{ ...btnLogout, textDecoration: 'none' }}>
            <Printer size={12} /> พิมพ์ฟอร์ม
          </Link>
          <button onClick={onLogout} style={btnLogout}><LogOut size={12} />ออก</button>
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '1.25rem' }}>
        {/* Filters */}
        <div style={{ background: 'white', borderRadius: 12, padding: '1rem', marginBottom: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 10 }}>
          <div>
            <label style={lbl}>ชั้นเรียน</label>
            <select value={classId} onChange={e => setClassId(e.target.value)} style={inp}>
              {availableClasses.map(c => <option key={c.id} value={c.id}>{c.label} ({c.students.length} คน)</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>เดือน</label>
            <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={inp} />
            <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: 4 }}>
              📅 {THAI_MONTHS[mn - 1]} พ.ศ.{yr + 543}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ background: '#FFF7ED', borderRadius: 8, padding: '10px 14px', fontSize: '0.85rem', color: '#7C2D12', flex: 1 }}>
              ✏️ กรอกแล้ว <b>{filledCount}/{students.length}</b> คน
              {savedAt && <span style={{ color: '#10B981', marginLeft: 8 }}>✓ บันทึก {savedAt.toLocaleTimeString('th-TH')}</span>}
            </div>
          </div>
        </div>

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
                    <th style={th}>น้ำหนัก (กก.)</th>
                    <th style={th}>ส่วนสูง (ซม.)</th>
                    <th style={th}>BMI</th>
                    <th style={th}>สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s, i) => {
                    const e = findEntry(s);
                    const bmi = e?.bmi;
                    return (
                      <tr key={s.id} style={{ borderBottom: '1px solid #FFF7ED', background: i % 2 ? 'white' : '#FFFBF5' }}>
                        <td style={td}>{i + 1}</td>
                        <td style={{ ...td, fontSize: '0.78rem' }}>{s.code}</td>
                        <td style={{ ...td, textAlign: 'left', fontWeight: 700 }}>{s.emoji} {s.name}</td>
                        <td style={td}>
                          <input type="number" min={0} max={200} step="0.1"
                            defaultValue={e?.weight ?? ''}
                            onBlur={ev => {
                              const v = ev.target.value;
                              updateMetric(s, { weight: v === '' ? undefined : Number(v) });
                            }}
                            style={inpNum} />
                        </td>
                        <td style={td}>
                          <input type="number" min={0} max={250} step="0.1"
                            defaultValue={e?.height ?? ''}
                            onBlur={ev => {
                              const v = ev.target.value;
                              updateMetric(s, { height: v === '' ? undefined : Number(v) });
                            }}
                            style={inpNum} />
                        </td>
                        <td style={{ ...td, fontWeight: 800, color: bmi ? bmiColor(bmi) : '#94A3B8' }}>
                          {bmi || '-'}
                        </td>
                        <td style={td}>
                          {bmi && <span style={{ background: bmiColor(bmi) + '22', color: bmiColor(bmi), padding: '2px 8px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700 }}>{bmiStatus(bmi)}</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '10px 14px', background: '#FFF7ED', fontSize: '0.78rem', color: '#7C2D12' }}>
              💡 กรอกตัวเลข → กดออกจากช่อง = <b>บันทึกอัตโนมัติ</b> · BMI คำนวณให้เอง · ลบค่าทั้งสอง = ลบรายการ
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function thisMonth() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
function bmiColor(b: number) {
  if (b < 16) return '#EF4444'; if (b < 18.5) return '#F59E0B';
  if (b < 25) return '#10B981'; if (b < 30) return '#F59E0B'; return '#EF4444';
}
function bmiStatus(b: number) {
  if (b < 16) return 'ผอมมาก'; if (b < 18.5) return 'ผอม';
  if (b < 25) return 'สมส่วน'; if (b < 30) return 'ท้วม'; return 'อ้วน';
}

const lnk: React.CSSProperties = { color: 'white', display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontSize: '0.85rem', opacity: 0.9 };
const inp: React.CSSProperties = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: '0.9rem' };
const inpNum: React.CSSProperties = { width: 80, padding: '4px 8px', borderRadius: 6, border: '1px solid #E2E8F0', fontSize: '0.85rem', textAlign: 'center' };
const lbl: React.CSSProperties = { display: 'block', fontSize: '0.78rem', color: '#64748B', marginBottom: 4, fontWeight: 700 };
const btnLogout: React.CSSProperties = { background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.4)', padding: '6px 12px', borderRadius: 8, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 };
const th: React.CSSProperties = { padding: '10px 12px', fontWeight: 800, fontSize: '0.8rem', textAlign: 'center' };
const td: React.CSSProperties = { padding: '8px 10px', textAlign: 'center' };
