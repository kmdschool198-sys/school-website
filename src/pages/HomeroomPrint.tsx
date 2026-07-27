import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { TIMETABLE_BACKUP } from '../data/timetableData';
import { ChevronLeft, Printer } from 'lucide-react';
import { useTeacherAuth } from '../utils/teacherAuth';
import TeacherLoginGate from '../components/TeacherLoginGate';
import type { HomeroomDoc } from '../data/homeroom';
import { termOfDate, academicYearOfDate } from '../data/homeroom';

const KG = [{ id: 'kg_a2_1', label: 'อ.2/1' }, { id: 'kg_a3_1', label: 'อ.3/1' }];

interface ClassRoster { classId: string; label: string; students: any[] }

export default function HomeroomPrintPage() {
  const auth = useTeacherAuth();
  if (!auth.authed) return <TeacherLoginGate title="🖨️ พิมพ์แบบสรุปโฮมรูม" />;
  return <App />;
}

function App() {
  const now = new Date();
  const nowIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  const [classes, setClasses] = useState<ClassRoster[]>([]);
  const [classId, setClassId] = useState('');
  const [term, setTerm] = useState<1 | 2>(termOfDate(nowIso));
  const [year, setYear] = useState(academicYearOfDate(nowIso));
  const [logs, setLogs] = useState<HomeroomDoc[]>([]);
  const [extra, setExtra] = useState('');

  useEffect(() => {
    return onSnapshot(doc(db, 'config', 'attendance_classes'), snap => {
      if (snap.exists()) {
        const d = snap.data() as { classes: ClassRoster[] };
        if (d.classes?.length) setClasses(d.classes);
      }
    });
  }, []);

  useEffect(() => {
    return onSnapshot(collection(db, 'homeroom'), snap => {
      const arr: HomeroomDoc[] = [];
      snap.forEach(d => arr.push({ id: d.id, ...(d.data() as any) }));
      setLogs(arr);
    });
  }, []);

  const availableClasses = useMemo(() => {
    try {
      const profile = (TIMETABLE_BACKUP as any).profiles[Object.keys((TIMETABLE_BACKUP as any).profiles)[0]];
      const rooms = profile.data.rooms as Array<{ id: string; label: string }>;
      return [...KG, ...rooms].map(r => {
        const c = classes.find(x => x.classId === r.id);
        return { id: r.id, label: r.label, students: c?.students || [] };
      });
    } catch { return classes.map(c => ({ id: c.classId, label: c.label, students: c.students })); }
  }, [classes]);

  useEffect(() => {
    if (!classId && availableClasses.length) setClassId(availableClasses[0].id);
  }, [availableClasses]);

  const current = availableClasses.find(c => c.id === classId);

  // Logs for this class + term + academic year
  const termLogs = useMemo(() => logs.filter(l =>
    l.classId === classId &&
    termOfDate(l.date) === term &&
    academicYearOfDate(l.date) === year
  ).sort((a, b) => a.date.localeCompare(b.date)), [logs, classId, term, year]);

  // Collect unique, non-empty lines from a field across all logs
  const collect = (field: 'problems' | 'solutions' | 'suggestions') => {
    const seen = new Set<string>();
    const out: string[] = [];
    termLogs.forEach(l => {
      (l[field] || '').split('\n').forEach(line => {
        const t = line.trim().replace(/^[-•*]\s*/, '');
        if (!t) return;
        const key = t.replace(/\s+/g, '');
        if (seen.has(key)) return;
        seen.add(key);
        out.push(t);
      });
    });
    return out;
  };

  const problems = useMemo(() => collect('problems'), [termLogs]);
  const solutions = useMemo(() => collect('solutions'), [termLogs]);
  const suggestions = useMemo(() => collect('suggestions'), [termLogs]);

  const gradeLabel = (current?.label || '').split('/')[0];
  const roomLabel = (current?.label || '').split('/')[1] || '';
  const levelWord = gradeLabel.startsWith('อ.') ? 'ชั้นอนุบาลปีที่'
    : gradeLabel.startsWith('ม.') ? 'ชั้นมัธยมศึกษาปีที่'
    : 'ชั้นประถมศึกษาปีที่';
  const gradeNum = gradeLabel.replace(/[^0-9]/g, '');

  return (
    <div style={{ minHeight: '100vh', background: '#FFF7ED' }}>
      <header className="no-print" style={{ background: 'linear-gradient(135deg,#7C3AED,#A78BFA)', color: 'white', padding: '1.2rem 1.25rem' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Link to="/homeroom" style={lnk}><ChevronLeft size={16} />กลับ</Link>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: '1.2rem', fontWeight: 900 }}>🖨️ สรุปปัญหาและข้อเสนอแนะ (โฮมรูม)</div>
            <div style={{ fontSize: '0.78rem', opacity: 0.9 }}>
              รวมจากบันทึกรายวัน {termLogs.length} ครั้ง · A4 แนวตั้ง
            </div>
          </div>
          <select value={classId} onChange={e => setClassId(e.target.value)} style={ctl}>
            {availableClasses.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <select value={term} onChange={e => setTerm(Number(e.target.value) as 1 | 2)} style={ctl}>
            <option value={1}>ภาคเรียนที่ 1</option>
            <option value={2}>ภาคเรียนที่ 2</option>
          </select>
          <input type="number" value={year} onChange={e => setYear(Number(e.target.value))} style={{ ...ctl, width: 86 }} />
          <button onClick={() => window.print()} style={btnPrint}><Printer size={16} /> พิมพ์</button>
        </div>
      </header>

      {/* extra suggestion box (not printed as input) */}
      <div className="no-print" style={{ maxWidth: 820, margin: '14px auto 0', padding: '0 1rem' }}>
        <div style={{ background: 'white', borderRadius: 12, padding: '1rem' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#64748B', marginBottom: 6 }}>
            ข้อเสนอแนะเพิ่มเติมสำหรับแบบสรุปนี้ (จะแสดงในข้อ 3 ต่อท้าย)
          </label>
          <textarea value={extra} onChange={e => setExtra(e.target.value)} rows={3}
            placeholder="พิมพ์ข้อเสนอแนะสรุปภาพรวมของภาคเรียนนี้"
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: '0.92rem', resize: 'vertical' }} />
        </div>
      </div>

      {/* ── Printable A4 ── */}
      <div className="print-area" style={{
        background: 'white', maxWidth: '210mm', margin: '14px auto',
        padding: '18mm 20mm', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', minHeight: '297mm',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div style={{
            display: 'inline-block', background: '#B2DFDB', color: '#0F172A',
            padding: '6px 18px', borderRadius: 6, fontWeight: 800, fontSize: '1rem',
          }}>
            สรุปปัญหาของนักเรียน และข้อเสนอแนะในการจัดกิจกรรมโฮมรูม
          </div>
          <div style={{ marginTop: 10, fontSize: '1rem' }}>ภาคเรียนที่ {term} ปีการศึกษา {year}</div>
          <div style={{ fontSize: '1rem' }}>
            {levelWord} {gradeNum || '.........'}{roomLabel ? `/${roomLabel}` : '/.........'}
          </div>
          <div style={{ fontSize: '1rem' }}>โรงเรียนบ้านคลองมดแดง</div>
        </div>

        <Section title="1. ปัญหาของนักเรียนในการจัดกิจกรรมโฮมรูม" items={problems} prefix="1" />
        <Section title="2. แนวทางแก้ไขปัญหาของครูที่ปรึกษา" items={solutions} prefix="2" />

        <div style={{ marginTop: 18 }}>
          <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: 8 }}>3. ข้อเสนอแนะ</div>
          {suggestions.length === 0 && !extra.trim() ? (
            <div style={{ color: '#94A3B8', paddingLeft: '2rem' }}>—</div>
          ) : (
            <div style={{ paddingLeft: '2rem', lineHeight: 1.9, textIndent: '2rem' }}>
              {suggestions.map((s, i) => <div key={i} style={{ marginBottom: 6 }}>{s}</div>)}
              {extra.trim() && <div style={{ whiteSpace: 'pre-wrap' }}>{extra.trim()}</div>}
            </div>
          )}
        </div>

        {/* signature — ครูที่ปรึกษาเท่านั้น */}
        <div style={{ marginTop: 70, textAlign: 'center', fontSize: '0.95rem' }}>
          <div>ลงชื่อ ................................................ ครูที่ปรึกษา</div>
          <div style={{ marginTop: 6 }}>(………………………………………………….)</div>
        </div>

        {termLogs.length === 0 && (
          <div className="no-print" style={{
            marginTop: 24, padding: '12px 14px', background: '#FEF3C7',
            color: '#92400E', borderRadius: 8, fontSize: '0.85rem',
          }}>
            ⚠️ ยังไม่มีบันทึกโฮมรูมของชั้นนี้ในภาคเรียนที่ {term} ปีการศึกษา {year} —
            ไป <Link to="/homeroom" style={{ color: '#92400E', fontWeight: 800 }}>บันทึกโฮมรูม</Link> ก่อน
            แล้วข้อ 1–3 จะรวมให้อัตโนมัติ
          </div>
        )}
      </div>

      <style>{`@media print {
        @page { size: A4 portrait; margin: 0; }
        body { background: white !important; }
        .no-print { display: none !important; }
        .print-area { box-shadow: none !important; margin: 0 !important; }
      }`}</style>
    </div>
  );
}

function Section({ title, items, prefix }: { title: string; items: string[]; prefix: string }) {
  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: 8 }}>{title}</div>
      {items.length === 0 ? (
        <div style={{ color: '#94A3B8', paddingLeft: '2rem' }}>—</div>
      ) : (
        <div style={{ paddingLeft: '2rem' }}>
          {items.map((t, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, lineHeight: 1.85 }}>
              <span style={{ flexShrink: 0, fontWeight: 700 }}>{prefix}.{i + 1}</span>
              <span>{t}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const lnk: React.CSSProperties = { color: 'white', display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontSize: '0.85rem', opacity: 0.9 };
const ctl: React.CSSProperties = { padding: '7px 10px', borderRadius: 8, border: 'none', fontSize: '0.85rem', fontWeight: 700 };
const btnPrint: React.CSSProperties = { background: 'white', color: '#5B21B6', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 900, fontSize: '0.9rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
