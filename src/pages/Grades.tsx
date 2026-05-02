import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  collection, doc, onSnapshot, setDoc, deleteDoc, getDocs, query, where,
} from 'firebase/firestore';
import { db } from '../firebase';
import { TIMETABLE_BACKUP } from '../data/timetableData';
import {
  ChevronLeft, BookOpen, ClipboardList, Plus, Trash2, Save, LogOut, Lock,
  FileText, Edit2,
} from 'lucide-react';
import {
  Subject, GradeEntry, LEARNING_GROUPS, LearningGroup,
  computeGrade, gradeText, gradeColor, totalScore,
} from '../data/grades';

const AUTH_KEY = 'grades_auth_v1';
const ROLE_KEY = 'grades_role_v1';
type Role = 'teacher' | 'super';
const ACCOUNTS: Record<string, { pass: string; role: Role; name: string }> = {
  adminkmd:  { pass: '12345678kmd', role: 'teacher', name: 'ครูประจำชั้น' },
  jameskmd:  { pass: '12345678kmd', role: 'super',   name: 'ผู้ดูแลระบบ' },
};

const BRAND = '#FF6A01';
const KG_ROOMS = [
  { id: 'kg_a2_1', label: 'อ.2/1' },
  { id: 'kg_a3_1', label: 'อ.3/1' },
];

interface Student { id: string; code?: string; name: string; emoji?: string; }
interface ClassRoster { classId: string; label: string; students: Student[]; }

const seedClasses = (): ClassRoster[] => {
  const profile = (TIMETABLE_BACKUP as any).profiles[Object.keys((TIMETABLE_BACKUP as any).profiles)[0]];
  const rooms = profile.data.rooms as Array<{ id: string; label: string }>;
  return [...KG_ROOMS, ...rooms].map(r => ({ classId: r.id, label: r.label, students: [] }));
};

type Tab = 'subjects' | 'entry' | 'pp5' | 'pp6';

// ════════════════════════════════════════════════════════════════
function LoginGate({ onPass }: { onPass: (r: Role, name: string) => void }) {
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [err, setErr] = useState(false);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const acc = ACCOUNTS[u.trim()];
    if (acc && acc.pass === p) {
      sessionStorage.setItem(AUTH_KEY, '1');
      sessionStorage.setItem(ROLE_KEY, acc.role);
      onPass(acc.role, acc.name);
    } else setErr(true);
  };
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg,#FF6A01,#FFD400)', padding: '1.5rem' }}>
      <form onSubmit={submit} style={{ background: 'white', borderRadius: 24, padding: '2rem', maxWidth: 400, width: '100%',
        boxShadow: '0 30px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#FFEDD5',
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', color: BRAND }}>
          <Lock size={28} />
        </div>
        <h3 style={{ textAlign: 'center', fontWeight: 900, color: '#0F172A', margin: '0 0 4px' }}>📚 ระบบเกรด ปพ.5/ปพ.6</h3>
        <p style={{ textAlign: 'center', color: '#64748B', fontSize: '0.85rem', marginBottom: 20 }}>เข้าสู่ระบบสำหรับครู</p>
        {err && <div style={{ background: '#FEE2E2', color: '#DC2626', padding: '8px 12px', borderRadius: 8, fontSize: '0.85rem', marginBottom: 12, textAlign: 'center' }}>❌ ผิดพลาด</div>}
        <input value={u} onChange={e => setU(e.target.value)} placeholder="ชื่อผู้ใช้"
          style={inp} required autoFocus />
        <input type="password" value={p} onChange={e => setP(e.target.value)} placeholder="รหัสผ่าน"
          style={{ ...inp, marginTop: 10 }} required />
        <button type="submit" style={{ width: '100%', padding: 12, marginTop: 16, borderRadius: 10, border: 'none', cursor: 'pointer',
          background: 'linear-gradient(135deg,#FF6A01,#FB923C)', color: 'white', fontWeight: 800, fontSize: '0.95rem' }}>เข้าสู่ระบบ</button>
        <Link to="/" style={{ display: 'block', textAlign: 'center', marginTop: 12, color: '#94A3B8', fontSize: '0.8rem', textDecoration: 'none' }}>← กลับหน้าหลัก</Link>
      </form>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
export default function GradesPage() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem(AUTH_KEY) === '1');
  const [role, setRole] = useState<Role>(() => (sessionStorage.getItem(ROLE_KEY) as Role) || 'teacher');
  const [name, setName] = useState('ครู');
  if (!authed) return <LoginGate onPass={(r, n) => { setRole(r); setName(n); setAuthed(true); }} />;
  return <GradesApp role={role} userName={name} onLogout={() => {
    sessionStorage.removeItem(AUTH_KEY); sessionStorage.removeItem(ROLE_KEY); setAuthed(false);
  }} />;
}

// ════════════════════════════════════════════════════════════════
function GradesApp({ role, userName, onLogout }: { role: Role; userName: string; onLogout: () => void }) {
  const [classes, setClasses] = useState<ClassRoster[]>(seedClasses);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [grades, setGrades] = useState<Record<string, GradeEntry>>({});
  const [tab, setTab] = useState<Tab>('subjects');
  const [classId, setClassId] = useState<string>('');
  const [subjectId, setSubjectId] = useState<string>('');
  const isSuper = role === 'super';

  // Load class roster
  useEffect(() => {
    return onSnapshot(doc(db, 'config', 'attendance_classes'), snap => {
      if (snap.exists()) {
        const d = snap.data() as { classes: ClassRoster[] };
        if (d.classes?.length) setClasses(d.classes);
      }
    });
  }, []);

  // Load subjects
  useEffect(() => {
    return onSnapshot(collection(db, 'subjects'), snap => {
      const arr: Subject[] = [];
      snap.forEach(d => arr.push({ id: d.id, ...(d.data() as any) }));
      setSubjects(arr);
    });
  }, []);

  useEffect(() => {
    if (!classId && classes.length) setClassId(classes[0].classId);
  }, [classes]);

  // Load grades for selected subject
  useEffect(() => {
    if (!subjectId) { setGrades({}); return; }
    (async () => {
      try {
        const snap = await getDocs(query(collection(db, 'grades'), where('subjectId', '==', subjectId)));
        const map: Record<string, GradeEntry> = {};
        snap.forEach(d => {
          const g = d.data() as GradeEntry;
          map[g.studentId] = g;
        });
        setGrades(map);
      } catch (e) { console.error(e); }
    })();
  }, [subjectId]);

  const currentClass = classes.find(c => c.classId === classId);
  const subjectsForClass = useMemo(() => subjects.filter(s => s.classId === classId), [subjects, classId]);
  const currentSubject = subjects.find(s => s.id === subjectId);

  return (
    <div style={{ minHeight: '100vh', background: '#FFF7ED' }}>
      <header style={{ background: 'linear-gradient(135deg,#FF6A01,#FB923C)', color: 'white',
        padding: '1.2rem 1.25rem', boxShadow: '0 4px 20px rgba(255,106,1,0.3)' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Link to="/" style={{ color: 'white', display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontSize: '0.85rem', opacity: 0.9 }}>
            <ChevronLeft size={16} />หน้าหลัก
          </Link>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 900 }}>📚 ระบบบันทึกผลการเรียน ปพ.5 / ปพ.6</div>
            <div style={{ fontSize: '0.78rem', opacity: 0.9 }}>โรงเรียนบ้านคลองมดแดง · {userName}</div>
          </div>
          {isSuper && (
            <span style={{ background: 'rgba(255,255,255,0.25)', color: 'white', padding: '4px 10px',
              borderRadius: 999, fontSize: '0.72rem', fontWeight: 800, border: '1px solid rgba(255,255,255,0.4)' }}>👑 super</span>
          )}
          <button onClick={onLogout} style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.4)',
            padding: '6px 12px', borderRadius: 8, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <LogOut size={12} />ออกจากระบบ
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 1400, margin: '0 auto', padding: '1.25rem' }}>
        {/* Class + subject pickers */}
        <div style={{ background: 'white', borderRadius: 14, padding: '1rem', marginBottom: 14,
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
          <div>
            <label style={lbl}>เลือกชั้นเรียน</label>
            <select value={classId} onChange={e => { setClassId(e.target.value); setSubjectId(''); }} style={inp}>
              {classes.map(c => <option key={c.classId} value={c.classId}>{c.label} ({c.students.length} คน)</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>เลือกรายวิชา ({subjectsForClass.length} วิชา)</label>
            <select value={subjectId} onChange={e => setSubjectId(e.target.value)} style={inp}>
              <option value="">— เลือกรายวิชา —</option>
              {subjectsForClass.map(s => <option key={s.id} value={s.id}>{s.code} {s.name}</option>)}
            </select>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, overflowX: 'auto' }}>
          {([
            ['subjects', <BookOpen size={14} />, 'จัดการรายวิชา'],
            ['entry', <Edit2 size={14} />, 'กรอกคะแนน'],
            ['pp5', <ClipboardList size={14} />, '📋 ปพ.5'],
            ['pp6', <FileText size={14} />, '📄 ปพ.6'],
          ] as const).map(([k, ic, l]) => (
            <button key={k} onClick={() => setTab(k as Tab)} style={{
              padding: '8px 16px', border: 'none', borderRadius: 10, fontWeight: 800, cursor: 'pointer',
              fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
              background: tab === k ? BRAND : 'white', color: tab === k ? 'white' : '#475569',
            }}>{ic}{l}</button>
          ))}
        </div>

        {tab === 'subjects' && currentClass && (
          <SubjectManager classId={classId} className={currentClass.label} subjects={subjectsForClass} />
        )}
        {tab === 'entry' && currentSubject && currentClass && (
          <GradeEntryTable subject={currentSubject} students={currentClass.students}
            grades={grades} setGrades={setGrades} userName={userName} />
        )}
        {tab === 'entry' && !currentSubject && (
          <Empty msg="กรุณาเลือกรายวิชาก่อน" />
        )}
        {tab === 'pp5' && currentSubject && currentClass && (
          <PP5Report subject={currentSubject} students={currentClass.students} grades={grades} className={currentClass.label} />
        )}
        {tab === 'pp5' && !currentSubject && <Empty msg="กรุณาเลือกรายวิชาก่อน" />}
        {tab === 'pp6' && currentClass && (
          <PP6Report classId={classId} students={currentClass.students} subjects={subjectsForClass} className={currentClass.label} />
        )}
      </main>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
function SubjectManager({ classId, className, subjects }: {
  classId: string; className: string; subjects: Subject[];
}) {
  const [editing, setEditing] = useState<Subject | null>(null);

  const add = () => {
    setEditing({
      id: `sub_${Date.now()}`, classId, code: '', name: '',
      group: 'ภาษาไทย', credits: 1, teacherName: '', type: 'พื้นฐาน',
      weightBetween1: 25, weightBetween2: 25, weightMidterm: 20, weightFinal: 30,
      year: '2569',
    });
  };

  const save = async (s: Subject) => {
    try {
      await setDoc(doc(db, 'subjects', s.id), s);
      setEditing(null);
    } catch (e: any) { alert('❌ บันทึกไม่สำเร็จ: ' + (e?.message || e)); }
  };

  const del = async (s: Subject) => {
    if (!confirm(`ลบรายวิชา "${s.name}"?`)) return;
    try {
      await deleteDoc(doc(db, 'subjects', s.id));
    } catch (e: any) { alert('❌ ลบไม่สำเร็จ: ' + (e?.message || e)); }
  };

  return (
    <div style={{ background: 'white', borderRadius: 14, padding: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <h6 style={{ fontWeight: 800, color: '#0F172A', margin: 0, flex: 1 }}>
          📚 รายวิชา — {className}
        </h6>
        <button onClick={add} style={btnPrimary}><Plus size={14} /> เพิ่มรายวิชา</button>
      </div>

      {subjects.length === 0 ? (
        <Empty msg="ยังไม่มีรายวิชา — กดปุ่ม 'เพิ่มรายวิชา' เพื่อเริ่ม" />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={tbl}>
            <thead>
              <tr style={tblHead}>
                <th>รหัส</th><th>ชื่อวิชา</th><th>กลุ่มสาระ</th><th>ประเภท</th>
                <th>หน่วย</th><th>ครูผู้สอน</th><th>คะแนนเก็บ</th><th></th>
              </tr>
            </thead>
            <tbody>
              {subjects.map(s => (
                <tr key={s.id} style={{ borderBottom: '1px solid #FFF7ED' }}>
                  <td style={td}><b>{s.code}</b></td>
                  <td style={td}>{s.name}</td>
                  <td style={td}><small>{s.group}</small></td>
                  <td style={td}><span style={{
                    background: s.type === 'พื้นฐาน' ? '#DBEAFE' : '#FEF3C7',
                    color: s.type === 'พื้นฐาน' ? '#1E40AF' : '#92400E',
                    padding: '2px 8px', borderRadius: 999, fontSize: '0.75rem', fontWeight: 700,
                  }}>{s.type}</span></td>
                  <td style={td}>{s.credits}</td>
                  <td style={td}>{s.teacherName}</td>
                  <td style={td}><small>{s.weightBetween1}+{s.weightBetween2}+{s.weightMidterm}+{s.weightFinal}={s.weightBetween1+s.weightBetween2+s.weightMidterm+s.weightFinal}</small></td>
                  <td style={td}>
                    <button onClick={() => setEditing(s)} style={btnSmall}><Edit2 size={12} /></button>
                    <button onClick={() => del(s)} style={{ ...btnSmall, color: '#DC2626' }}><Trash2 size={12} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && <SubjectEditor subject={editing} onSave={save} onCancel={() => setEditing(null)} />}
    </div>
  );
}

function SubjectEditor({ subject, onSave, onCancel }: {
  subject: Subject; onSave: (s: Subject) => void; onCancel: () => void;
}) {
  const [s, setS] = useState(subject);
  const totalWeight = s.weightBetween1 + s.weightBetween2 + s.weightMidterm + s.weightFinal;
  const valid = s.code && s.name && s.teacherName && totalWeight === 100;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'white', borderRadius: 16, maxWidth: 600, width: '100%', padding: '1.5rem',
        maxHeight: '90vh', overflow: 'auto',
      }}>
        <h5 style={{ fontWeight: 900, marginBottom: 16 }}>✏️ แก้ไขรายวิชา</h5>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
          <div><label style={lbl}>รหัสวิชา *</label><input value={s.code} onChange={e => setS({ ...s, code: e.target.value })} placeholder="เช่น ว11101" style={inp} /></div>
          <div><label style={lbl}>ชื่อวิชา *</label><input value={s.name} onChange={e => setS({ ...s, name: e.target.value })} placeholder="เช่น วิทยาศาสตร์" style={inp} /></div>
          <div><label style={lbl}>กลุ่มสาระ</label>
            <select value={s.group} onChange={e => setS({ ...s, group: e.target.value as LearningGroup })} style={inp}>
              {LEARNING_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div><label style={lbl}>ประเภท</label>
            <select value={s.type} onChange={e => setS({ ...s, type: e.target.value as any })} style={inp}>
              <option value="พื้นฐาน">พื้นฐาน</option>
              <option value="เพิ่มเติม">เพิ่มเติม</option>
            </select>
          </div>
          <div><label style={lbl}>หน่วยน้ำหนัก/หน่วยกิต</label><input type="number" step="0.5" value={s.credits} onChange={e => setS({ ...s, credits: +e.target.value })} style={inp} /></div>
          <div><label style={lbl}>ปีการศึกษา</label><input value={s.year} onChange={e => setS({ ...s, year: e.target.value })} style={inp} /></div>
          <div style={{ gridColumn: '1 / -1' }}><label style={lbl}>ครูผู้สอน *</label><input value={s.teacherName} onChange={e => setS({ ...s, teacherName: e.target.value })} placeholder="ชื่อ-สกุลครู" style={inp} /></div>

          <div style={{ gridColumn: '1 / -1', marginTop: 8 }}>
            <div style={{ ...lbl, display: 'flex', justifyContent: 'space-between' }}>
              <span>การถ่วงน้ำหนักคะแนน (รวม = 100)</span>
              <span style={{ color: totalWeight === 100 ? '#10B981' : '#EF4444', fontWeight: 800 }}>รวม: {totalWeight}</span>
            </div>
          </div>
          <div><label style={lbl}>ระหว่างเรียน 1</label><input type="number" value={s.weightBetween1} onChange={e => setS({ ...s, weightBetween1: +e.target.value })} style={inp} /></div>
          <div><label style={lbl}>ระหว่างเรียน 2</label><input type="number" value={s.weightBetween2} onChange={e => setS({ ...s, weightBetween2: +e.target.value })} style={inp} /></div>
          <div><label style={lbl}>กลางภาค</label><input type="number" value={s.weightMidterm} onChange={e => setS({ ...s, weightMidterm: +e.target.value })} style={inp} /></div>
          <div><label style={lbl}>ปลายภาค</label><input type="number" value={s.weightFinal} onChange={e => setS({ ...s, weightFinal: +e.target.value })} style={inp} /></div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={btnSecondary}>ยกเลิก</button>
          <button onClick={() => onSave(s)} disabled={!valid} style={{ ...btnPrimary, opacity: valid ? 1 : 0.4 }}>
            <Save size={14} /> บันทึก
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
function GradeEntryTable({ subject, students, grades, setGrades, userName }: {
  subject: Subject; students: Student[];
  grades: Record<string, GradeEntry>; setGrades: React.Dispatch<React.SetStateAction<Record<string, GradeEntry>>>;
  userName: string;
}) {
  const [saving, setSaving] = useState<string | null>(null);

  const update = async (sid: string, patch: Partial<GradeEntry>) => {
    const prev = grades[sid] || { subjectId: subject.id, studentId: sid, classId: subject.classId };
    const next = { ...prev, ...patch, updatedAt: Date.now(), updatedBy: userName };
    setGrades(g => ({ ...g, [sid]: next }));
    setSaving(sid);
    try {
      await setDoc(doc(db, 'grades', `${subject.id}_${sid}`), next);
    } catch (e: any) { alert('❌ บันทึกไม่สำเร็จ: ' + (e?.message || e)); }
    setSaving(null);
  };

  if (students.length === 0) {
    return <Empty msg="ยังไม่มีรายชื่อนักเรียนในชั้นนี้ — เพิ่มรายชื่อในหน้า Admin > รายชื่อ-เช็คชื่อ" />;
  }

  return (
    <div style={{ background: 'white', borderRadius: 14, padding: '1rem' }}>
      <div style={{ marginBottom: 12, padding: '12px 14px', background: '#FFF7ED', borderRadius: 10, fontSize: '0.85rem' }}>
        <b style={{ color: '#7C2D12' }}>{subject.code} {subject.name}</b> · {subject.group} · ครู {subject.teacherName}
        <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: 4 }}>
          คะแนนเก็บ: {subject.weightBetween1} + {subject.weightBetween2} + {subject.weightMidterm} + {subject.weightFinal} = 100
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={tbl}>
          <thead>
            <tr style={tblHead}>
              <th rowSpan={2}>#</th>
              <th rowSpan={2}>รหัส</th>
              <th rowSpan={2} style={{ minWidth: 180 }}>ชื่อ-สกุล</th>
              <th colSpan={4}>คะแนนเก็บ</th>
              <th rowSpan={2}>รวม<br/>(100)</th>
              <th rowSpan={2}>เกรด</th>
              <th rowSpan={2}>กิจกรรม</th>
              <th rowSpan={2}>หมายเหตุ</th>
            </tr>
            <tr style={tblHead}>
              <th>กลาง 1<br/>({subject.weightBetween1})</th>
              <th>กลาง 2<br/>({subject.weightBetween2})</th>
              <th>กลางภาค<br/>({subject.weightMidterm})</th>
              <th>ปลายภาค<br/>({subject.weightFinal})</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s, i) => {
              const g = grades[s.id] || { subjectId: subject.id, studentId: s.id, classId: subject.classId } as GradeEntry;
              const total = totalScore(g);
              const grade = computeGrade(total);
              return (
                <tr key={s.id} style={{ borderBottom: '1px solid #FFF7ED', background: saving === s.id ? '#FFFBEB' : 'white' }}>
                  <td style={td}>{i + 1}</td>
                  <td style={td}><small>{s.code}</small></td>
                  <td style={td}>{s.emoji} {s.name}</td>
                  <td style={td}><ScoreInput value={g.between1} max={subject.weightBetween1} onChange={v => update(s.id, { between1: v })} /></td>
                  <td style={td}><ScoreInput value={g.between2} max={subject.weightBetween2} onChange={v => update(s.id, { between2: v })} /></td>
                  <td style={td}><ScoreInput value={g.midterm} max={subject.weightMidterm} onChange={v => update(s.id, { midterm: v })} /></td>
                  <td style={td}><ScoreInput value={g.final} max={subject.weightFinal} onChange={v => update(s.id, { final: v })} /></td>
                  <td style={{ ...td, fontWeight: 800 }}>{total.toFixed(1)}</td>
                  <td style={{ ...td, fontWeight: 900, color: gradeColor(grade) }}>{gradeText(grade)}</td>
                  <td style={td}>
                    <select value={g.activity || ''} onChange={e => update(s.id, { activity: e.target.value as any || undefined })}
                      style={{ ...inpSm, color: g.activity === 'ผ่าน' ? '#10B981' : g.activity === 'ไม่ผ่าน' ? '#EF4444' : '#64748B' }}>
                      <option value="">—</option>
                      <option value="ผ่าน">ผ่าน</option>
                      <option value="ไม่ผ่าน">ไม่ผ่าน</option>
                    </select>
                  </td>
                  <td style={td}><input value={g.note || ''} onChange={e => update(s.id, { note: e.target.value })} style={{ ...inpSm, minWidth: 100 }} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 8, fontSize: '0.75rem', color: '#94A3B8' }}>
        💾 บันทึกอัตโนมัติเมื่อแก้ไข · เกณฑ์: 80↑=4, 75↑=3.5, 70↑=3, 65↑=2.5, 60↑=2, 55↑=1.5, 50↑=1, ต่ำกว่า=0
      </div>
    </div>
  );
}

function ScoreInput({ value, max, onChange }: { value?: number; max: number; onChange: (v: number | undefined) => void }) {
  return (
    <input type="number" min={0} max={max} step="0.5"
      value={value ?? ''}
      onChange={e => onChange(e.target.value === '' ? undefined : Math.min(max, Math.max(0, +e.target.value)))}
      style={{ ...inpSm, width: 60, textAlign: 'center', color: (value ?? -1) > max ? '#EF4444' : '#0F172A' }}
    />
  );
}

// ════════════════════════════════════════════════════════════════
// ปพ.5 PRINT PREVIEW (Phase 2 placeholder — basic version now)
function PP5Report({ subject, students, grades, className }: {
  subject: Subject; students: Student[]; grades: Record<string, GradeEntry>; className: string;
}) {
  const print = () => window.print();
  return (
    <div style={{ background: 'white', borderRadius: 14, padding: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, alignItems: 'center', flexWrap: 'wrap', gap: 8 }} className="no-print">
        <h6 style={{ fontWeight: 800, margin: 0 }}>📋 ปพ.5 — แบบบันทึกผลการเรียนประจำรายวิชา</h6>
        <button onClick={print} style={btnPrimary}>🖨️ พิมพ์</button>
      </div>
      <div className="pp5-print" style={{ fontSize: '0.85rem' }}>
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <h4 style={{ fontWeight: 900, margin: 0 }}>แบบบันทึกผลการเรียนประจำรายวิชา (ปพ.5)</h4>
          <div>โรงเรียนบ้านคลองมดแดง · ปีการศึกษา {subject.year}</div>
          <div>กลุ่มสาระ {subject.group} · รายวิชา {subject.code} {subject.name} · ชั้น {className}</div>
          <div>ครูผู้สอน: {subject.teacherName}</div>
        </div>
        <table style={{ ...tbl, fontSize: '0.78rem' }}>
          <thead>
            <tr style={tblHead}>
              <th>เลขที่</th><th>เลขประจำตัว</th><th>ชื่อ-สกุล</th>
              <th>กลาง 1<br/>({subject.weightBetween1})</th>
              <th>กลาง 2<br/>({subject.weightBetween2})</th>
              <th>กลางภาค<br/>({subject.weightMidterm})</th>
              <th>ปลายภาค<br/>({subject.weightFinal})</th>
              <th>รวม</th><th>เกรด</th><th>กิจกรรม</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s, i) => {
              const g = grades[s.id] || { subjectId: subject.id, studentId: s.id, classId: subject.classId } as GradeEntry;
              const total = totalScore(g);
              const grade = computeGrade(total);
              return (
                <tr key={s.id}>
                  <td style={td}>{i + 1}</td>
                  <td style={td}>{s.code}</td>
                  <td style={{ ...td, textAlign: 'left' }}>{s.name}</td>
                  <td style={td}>{g.between1 ?? '-'}</td>
                  <td style={td}>{g.between2 ?? '-'}</td>
                  <td style={td}>{g.midterm ?? '-'}</td>
                  <td style={td}>{g.final ?? '-'}</td>
                  <td style={{ ...td, fontWeight: 700 }}>{total.toFixed(1)}</td>
                  <td style={{ ...td, fontWeight: 900, color: gradeColor(grade) }}>{gradeText(grade)}</td>
                  <td style={td}>{g.activity || '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, fontSize: '0.78rem' }}>
          <Stat label="จำนวนนักเรียน" value={String(students.length)} />
          <Stat label="ผ่าน (ได้ 1+)" value={String(students.filter(s => computeGrade(totalScore(grades[s.id] || {} as any)) >= 1).length)} />
          <Stat label="ไม่ผ่าน (0)" value={String(students.filter(s => computeGrade(totalScore(grades[s.id] || {} as any)) === 0).length)} />
          <Stat label="ค่าเฉลี่ย" value={(students.reduce((sum, s) => sum + computeGrade(totalScore(grades[s.id] || {} as any)), 0) / Math.max(students.length, 1)).toFixed(2)} />
        </div>

        <div style={{ marginTop: 30, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, textAlign: 'center', fontSize: '0.85rem' }}>
          <div>
            <div style={{ borderTop: '1px dashed #94A3B8', marginTop: 50, paddingTop: 6 }}>
              ลงชื่อ ........................ ครูผู้สอน<br/>({subject.teacherName})
            </div>
          </div>
          <div>
            <div style={{ borderTop: '1px dashed #94A3B8', marginTop: 50, paddingTop: 6 }}>
              ลงชื่อ ........................ ผู้บริหารสถานศึกษา
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 1cm; }
          body > *:not(.pp5-print-portal):not(script):not(style) { display: none !important; }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// ปพ.6 (per-student summary, requires loading grades from ALL subjects)
function PP6Report({ classId, students, subjects, className }: {
  classId: string; students: Student[]; subjects: Subject[]; className: string;
}) {
  const [studentId, setStudentId] = useState<string>(students[0]?.id || '');
  const [allGrades, setAllGrades] = useState<Record<string, GradeEntry>>({});

  useEffect(() => {
    if (!studentId) return;
    (async () => {
      try {
        const snap = await getDocs(query(collection(db, 'grades'), where('classId', '==', classId)));
        const map: Record<string, GradeEntry> = {};
        snap.forEach(d => {
          const g = d.data() as GradeEntry;
          if (g.studentId === studentId) map[g.subjectId] = g;
        });
        setAllGrades(map);
      } catch (e) { console.error(e); }
    })();
  }, [studentId, classId]);

  const student = students.find(s => s.id === studentId);
  const print = () => window.print();

  if (students.length === 0) return <Empty msg="ยังไม่มีรายชื่อนักเรียนในชั้นนี้" />;

  // Compute GPA
  let totalCredits = 0, totalPoints = 0;
  subjects.forEach(sub => {
    const g = allGrades[sub.id];
    if (g) {
      const grade = computeGrade(totalScore(g));
      totalCredits += sub.credits;
      totalPoints += grade * sub.credits;
    }
  });
  const gpa = totalCredits ? totalPoints / totalCredits : 0;

  return (
    <div style={{ background: 'white', borderRadius: 14, padding: '1.5rem' }}>
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <h6 style={{ fontWeight: 800, margin: 0 }}>📄 ปพ.6 — รายงานผลการพัฒนาคุณภาพผู้เรียน</h6>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={studentId} onChange={e => setStudentId(e.target.value)} style={inp}>
            {students.map((s, i) => <option key={s.id} value={s.id}>เลขที่ {i + 1} · {s.name}</option>)}
          </select>
          <button onClick={print} style={btnPrimary}>🖨️ พิมพ์</button>
        </div>
      </div>

      {student && (
        <div className="pp6-print" style={{ fontSize: '0.85rem' }}>
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <h4 style={{ fontWeight: 900, margin: 0 }}>รายงานผลการพัฒนาคุณภาพผู้เรียน (ปพ.6)</h4>
            <div>โรงเรียนบ้านคลองมดแดง</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, marginBottom: 16, padding: '10px 14px', background: '#FFF7ED', borderRadius: 8 }}>
            <div><b>ชื่อ-สกุล:</b> {student.name}</div>
            <div><b>เลขประจำตัว:</b> {student.code}</div>
            <div><b>ชั้น:</b> {className}</div>
            <div><b>ปีการศึกษา:</b> {subjects[0]?.year || '2569'}</div>
          </div>

          <table style={tbl}>
            <thead>
              <tr style={tblHead}>
                <th>รหัสวิชา</th><th>ชื่อวิชา</th><th>กลุ่มสาระ</th><th>หน่วย</th>
                <th>คะแนน</th><th>เกรด</th><th>กิจกรรม</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map(sub => {
                const g = allGrades[sub.id];
                const total = g ? totalScore(g) : 0;
                const grade = computeGrade(total);
                return (
                  <tr key={sub.id} style={{ borderBottom: '1px solid #FFF7ED' }}>
                    <td style={td}>{sub.code}</td>
                    <td style={{ ...td, textAlign: 'left' }}>{sub.name}</td>
                    <td style={td}><small>{sub.group}</small></td>
                    <td style={td}>{sub.credits}</td>
                    <td style={td}>{g ? total.toFixed(1) : '-'}</td>
                    <td style={{ ...td, fontWeight: 900, color: gradeColor(grade) }}>{g ? gradeText(grade) : '-'}</td>
                    <td style={td}>{g?.activity || '-'}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: '#FFF7ED', fontWeight: 900 }}>
                <td colSpan={3} style={{ ...td, textAlign: 'right' }}>เกรดเฉลี่ย (GPA)</td>
                <td style={td}>{totalCredits.toFixed(1)}</td>
                <td style={td}></td>
                <td style={{ ...td, color: gradeColor(gpa as any) }}>{gpa.toFixed(2)}</td>
                <td style={td}></td>
              </tr>
            </tfoot>
          </table>

          <div style={{ marginTop: 30, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, textAlign: 'center', fontSize: '0.85rem' }}>
            <div>
              <div style={{ borderTop: '1px dashed #94A3B8', marginTop: 50, paddingTop: 6 }}>
                ลงชื่อ ........................ ครูประจำชั้น
              </div>
            </div>
            <div>
              <div style={{ borderTop: '1px dashed #94A3B8', marginTop: 50, paddingTop: 6 }}>
                ลงชื่อ ........................ ผู้บริหารสถานศึกษา
              </div>
            </div>
          </div>
        </div>
      )}
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 1cm; }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Helpers / styles
function Empty({ msg }: { msg: string }) {
  return <div style={{ background: 'white', padding: '3rem', textAlign: 'center', color: '#94A3B8', borderRadius: 14 }}>{msg}</div>;
}
function Stat({ label, value }: { label: string; value: string }) {
  return <div style={{ background: '#FFF7ED', padding: 10, borderRadius: 8, textAlign: 'center', borderTop: '3px solid #FF6A01' }}>
    <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#0F172A' }}>{value}</div>
    <div style={{ fontSize: '0.72rem', color: '#64748B' }}>{label}</div>
  </div>;
}

const lbl: React.CSSProperties = { display: 'block', fontSize: '0.78rem', color: '#64748B', marginBottom: 4, fontWeight: 700 };
const inp: React.CSSProperties = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: '0.9rem', background: 'white' };
const inpSm: React.CSSProperties = { padding: '4px 8px', borderRadius: 6, border: '1px solid #E2E8F0', fontSize: '0.85rem', background: 'white' };
const btnPrimary: React.CSSProperties = { background: BRAND, color: 'white', border: 'none', borderRadius: 8, padding: '8px 14px', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const btnSecondary: React.CSSProperties = { background: 'white', color: '#475569', border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 14px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' };
const btnSmall: React.CSSProperties = { background: 'transparent', border: 'none', cursor: 'pointer', padding: 6, color: '#64748B' };
const tbl: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' };
const tblHead: React.CSSProperties = { background: 'linear-gradient(135deg,#0F172A,#1E3A8A)', color: 'white' };
const td: React.CSSProperties = { padding: '8px 10px', textAlign: 'center', borderBottom: '1px solid #FFF7ED' };

// Header cells
const _ = `
  th { padding: 10px 12px; font-weight: 800; font-size: 0.8rem; }
`;
// Inject minimal th styles
if (typeof document !== 'undefined' && !document.getElementById('grades-styles')) {
  const s = document.createElement('style');
  s.id = 'grades-styles';
  s.textContent = '.grades-tbl th { padding: 10px 12px; font-weight: 800; font-size: 0.8rem; }' + _;
  document.head.appendChild(s);
}
