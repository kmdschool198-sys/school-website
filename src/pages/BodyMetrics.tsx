import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { TIMETABLE_BACKUP } from '../data/timetableData';
import { ChevronLeft, LogOut, Save, Download } from 'lucide-react';
import { useTeacherAuth } from '../utils/teacherAuth';
import TeacherLoginGate from '../components/TeacherLoginGate';

const BRAND = '#FF6A01';
const KG = [{ id: 'kg_a2_1', label: 'อ.2/1' }, { id: 'kg_a3_1', label: 'อ.3/1' }];

interface Student { id: string; code?: string; name: string; emoji?: string; }
interface ClassRoster { classId: string; label: string; students: Student[]; }

interface BodyMetricRecord {
  studentId: string;
  weight?: number;       // กก.
  height?: number;       // ซม.
  bmi?: number;
  status?: string;       // ผอม / สมส่วน / ท้วม / อ้วน
  note?: string;
}

interface BodyMetricDoc {
  classId: string;
  term: string;          // เช่น "1/2569"
  records: Record<string, BodyMetricRecord>;
  updatedAt?: number;
}

export default function BodyMetricsPage() {
  const auth = useTeacherAuth();
  if (!auth.authed) return <TeacherLoginGate title="⚖️ ระบบบันทึกน้ำหนัก-ส่วนสูง" />;
  return <App userName={auth.name} onLogout={auth.logout} />;
}

function App({ userName, onLogout }: { userName: string; onLogout: () => void }) {
  const [classes, setClasses] = useState<ClassRoster[]>([]);
  const [classId, setClassId] = useState('');
  const [term, setTerm] = useState(currentTerm());
  const [records, setRecords] = useState<Record<string, BodyMetricRecord>>({});
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

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
        const fromCloud = classes.find(c => c.classId === r.id);
        return { id: r.id, label: r.label, students: fromCloud?.students || [] };
      });
    } catch { return []; }
  }, [classes]);

  useEffect(() => {
    if (!classId && availableClasses.length) setClassId(availableClasses[0].id);
  }, [availableClasses]);

  // Load records for current class+term
  useEffect(() => {
    if (!classId) return;
    return onSnapshot(doc(db, 'body_metrics', `${classId}_${term}`), snap => {
      if (snap.exists()) {
        const d = snap.data() as BodyMetricDoc;
        setRecords(d.records || {});
      } else {
        setRecords({});
      }
    });
  }, [classId, term]);

  const currentClass = availableClasses.find(c => c.id === classId);
  const students = currentClass?.students || [];

  const updateMetric = (sid: string, patch: Partial<BodyMetricRecord>) => {
    setRecords(r => {
      const cur = r[sid] || { studentId: sid };
      const next = { ...cur, ...patch };
      // Auto BMI
      if (next.weight && next.height && next.height > 0) {
        const m = next.height / 100;
        next.bmi = Math.round((next.weight / (m * m)) * 10) / 10;
      } else {
        delete next.bmi;
      }
      return { ...r, [sid]: next };
    });
  };

  const cleanRecords = (recs: typeof records) => {
    const out: typeof records = {};
    for (const [k, v] of Object.entries(recs)) {
      const item: any = { studentId: v.studentId };
      if (v.weight) item.weight = v.weight;
      if (v.height) item.height = v.height;
      if (v.bmi) item.bmi = v.bmi;
      if (v.status) item.status = v.status;
      if (v.note) item.note = v.note;
      out[k] = item;
    }
    return out;
  };

  const save = async () => {
    if (!classId) return;
    setSaving(true);
    try {
      await setDoc(doc(db, 'body_metrics', `${classId}_${term}`), {
        classId, term, records: cleanRecords(records), updatedAt: Date.now(),
      });
      setSavedAt(new Date());
    } catch (e: any) { alert('❌ ' + (e?.message || e)); }
    setSaving(false);
  };

  const exportCsv = () => {
    if (!currentClass) return;
    const rows = [['เลขที่', 'รหัส', 'ชื่อ-สกุล', 'น้ำหนัก (กก.)', 'ส่วนสูง (ซม.)', 'BMI', 'สถานะ', 'หมายเหตุ']];
    students.forEach((s, i) => {
      const r = records[s.id] || {};
      rows.push([
        String(i + 1), s.code || '', s.name,
        String(r.weight || ''), String(r.height || ''), String(r.bmi || ''),
        r.status || '', r.note || '',
      ]);
    });
    const csv = '﻿' + rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `น้ำหนักส่วนสูง_${currentClass.label}_${term}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#FFF7ED' }}>
      <header style={{ background: 'linear-gradient(135deg,#FF6A01,#FB923C)', color: 'white', padding: '1.2rem 1.25rem' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Link to="/" style={lnk}><ChevronLeft size={16} />หน้าหลัก</Link>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 900 }}>⚖️ ระบบบันทึกน้ำหนัก-ส่วนสูง</div>
            <div style={{ fontSize: '0.78rem', opacity: 0.9 }}>โรงเรียนบ้านคลองมดแดง · {userName}</div>
          </div>
          <button onClick={onLogout} style={btnLogout}><LogOut size={12} />ออกจากระบบ</button>
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '1.25rem' }}>
        <div style={{ background: 'white', borderRadius: 12, padding: '1rem', marginBottom: 14,
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 10 }}>
          <div>
            <label style={lbl}>ชั้นเรียน</label>
            <select value={classId} onChange={e => setClassId(e.target.value)} style={inp}>
              {availableClasses.map(c => <option key={c.id} value={c.id}>{c.label} ({c.students.length} คน)</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>ภาคเรียน / ปีการศึกษา</label>
            <input value={term} onChange={e => setTerm(e.target.value)} placeholder="เช่น 1/2569" style={inp} />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
            <button onClick={save} disabled={saving} style={btnPrimary}>
              <Save size={14} /> {saving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
            </button>
            <button onClick={exportCsv} style={btnSecondary}><Download size={14} /> CSV</button>
          </div>
        </div>

        {savedAt && <div style={{ fontSize: '0.78rem', color: '#10B981', fontWeight: 700, marginBottom: 10 }}>
          ✓ บันทึกล่าสุด: {savedAt.toLocaleTimeString('th-TH')}
        </div>}

        {students.length === 0 ? (
          <div style={{ background: 'white', padding: '3rem', textAlign: 'center', color: '#94A3B8', borderRadius: 12 }}>
            ยังไม่มีรายชื่อนักเรียนในชั้นนี้ — เพิ่มในหน้า Admin ก่อน
          </div>
        ) : (
          <div style={{ background: 'white', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: 'linear-gradient(135deg,#0F172A,#1E3A8A)', color: 'white' }}>
                    <th style={th}>#</th>
                    <th style={th}>รหัส</th>
                    <th style={{ ...th, textAlign: 'left', minWidth: 200 }}>ชื่อ-สกุล</th>
                    <th style={th}>น้ำหนัก (กก.)</th>
                    <th style={th}>ส่วนสูง (ซม.)</th>
                    <th style={th}>BMI</th>
                    <th style={th}>สถานะ</th>
                    <th style={th}>หมายเหตุ</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s, i) => {
                    const r = records[s.id] || {} as BodyMetricRecord;
                    const bmi = r.bmi;
                    return (
                      <tr key={s.id} style={{ borderBottom: '1px solid #FFF7ED', background: i % 2 ? 'white' : '#FFFBF5' }}>
                        <td style={td}>{i + 1}</td>
                        <td style={{ ...td, fontSize: '0.78rem' }}>{s.code}</td>
                        <td style={{ ...td, textAlign: 'left', fontWeight: 700 }}>{s.emoji} {s.name}</td>
                        <td style={td}>
                          <input type="number" min={0} max={200} step="0.1" value={r.weight ?? ''}
                            onChange={e => updateMetric(s.id, { weight: e.target.value === '' ? undefined : Number(e.target.value) })}
                            style={inpNum} />
                        </td>
                        <td style={td}>
                          <input type="number" min={0} max={250} step="0.1" value={r.height ?? ''}
                            onChange={e => updateMetric(s.id, { height: e.target.value === '' ? undefined : Number(e.target.value) })}
                            style={inpNum} />
                        </td>
                        <td style={{ ...td, fontWeight: 800, color: bmi ? bmiColor(bmi) : '#94A3B8' }}>
                          {bmi || '-'}
                        </td>
                        <td style={td}>
                          <select value={r.status || ''} onChange={e => updateMetric(s.id, { status: e.target.value || undefined })}
                            style={{ ...inpNum, width: 100 }}>
                            <option value="">—</option>
                            <option value="ผอม">ผอม</option>
                            <option value="ค่อนข้างผอม">ค่อนข้างผอม</option>
                            <option value="สมส่วน">สมส่วน</option>
                            <option value="ท้วม">ท้วม</option>
                            <option value="อ้วน">อ้วน</option>
                          </select>
                        </td>
                        <td style={td}>
                          <input value={r.note || ''} onChange={e => updateMetric(s.id, { note: e.target.value || undefined })}
                            style={{ ...inpNum, width: 120 }} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div style={{ marginTop: 10, padding: '8px 14px', background: '#FFF7ED', borderRadius: 8, fontSize: '0.78rem', color: '#7C2D12' }}>
          💡 BMI คำนวณอัตโนมัติจากน้ำหนัก/ส่วนสูง · กดปุ่ม "บันทึกข้อมูล" ก่อนปิดหน้า
        </div>
      </main>
    </div>
  );
}

function currentTerm(): string {
  const d = new Date();
  const y = d.getFullYear() + 543;
  const m = d.getMonth() + 1;
  return `${m >= 5 && m <= 10 ? 1 : 2}/${y}`;
}
function bmiColor(b: number): string {
  if (b < 16) return '#EF4444';     // ผอมมาก
  if (b < 18.5) return '#F59E0B';   // ผอม
  if (b < 25) return '#10B981';     // ปกติ
  if (b < 30) return '#F59E0B';     // อ้วน
  return '#EF4444';                  // อ้วนมาก
}

const lnk: React.CSSProperties = { color: 'white', display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontSize: '0.85rem', opacity: 0.9 };
const inp: React.CSSProperties = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: '0.9rem' };
const inpNum: React.CSSProperties = { width: 80, padding: '4px 8px', borderRadius: 6, border: '1px solid #E2E8F0', fontSize: '0.85rem', textAlign: 'center' };
const lbl: React.CSSProperties = { display: 'block', fontSize: '0.78rem', color: '#64748B', marginBottom: 4, fontWeight: 700 };
const btnPrimary: React.CSSProperties = { background: BRAND, color: 'white', border: 'none', borderRadius: 8, padding: '8px 14px', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const btnSecondary: React.CSSProperties = { background: 'white', color: '#475569', border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 14px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const btnLogout: React.CSSProperties = { background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.4)', padding: '6px 12px', borderRadius: 8, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 };
const th: React.CSSProperties = { padding: '10px 12px', fontWeight: 800, fontSize: '0.8rem', textAlign: 'center' };
const td: React.CSSProperties = { padding: '6px 10px', textAlign: 'center' };
