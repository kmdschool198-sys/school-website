import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { collection, doc, onSnapshot, setDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { TIMETABLE_BACKUP } from '../data/timetableData';
import {
  ChevronLeft, LogOut, Save, Printer, CalendarDays, PenLine, ListChecks,
  Trash2, Users, Plus, Check,
} from 'lucide-react';
import { useTeacherAuth } from '../utils/teacherAuth';
import TeacherLoginGate from '../components/TeacherLoginGate';
import QuickDate from '../components/QuickDate';
import { toast } from '../components/GlobalToast';
import type { HomeroomDoc } from '../data/homeroom';
import { HOMEROOM_TOPICS, COMMON_PROBLEMS, COMMON_SOLUTIONS, homeroomDocId } from '../data/homeroom';
import {
  SCHOOL_CALENDAR_COLLECTION,
  resolveSchoolDay,
  type SchoolDayOverride,
} from '../data/schoolCalendar';

const COLOR = '#7C3AED';
const KG = [{ id: 'kg_a2_1', label: 'อ.2/1' }, { id: 'kg_a3_1', label: 'อ.3/1' }];
const THAI_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const THAI_DAYS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

interface Student { id: string; code?: string; name: string; }
interface ClassRoster { classId: string; label: string; students: Student[]; }
interface AttDoc { classId: string; date: string; records: Record<string, { status: string }>; }

type Tab = 'entry' | 'calendar' | 'report';

export default function HomeroomPage() {
  const auth = useTeacherAuth();
  if (!auth.authed) return <TeacherLoginGate title="🏫 บันทึกกิจกรรมโฮมรูม" subtitle="บันทึกรายวัน · ดูปฏิทิน · พิมพ์แบบสรุป" />;
  return <App userName={auth.name} onLogout={auth.logout} />;
}

function App({ userName, onLogout }: { userName: string; onLogout: () => void }) {
  const [classes, setClasses] = useState<ClassRoster[]>([]);
  const [classId, setClassId] = useState('');
  const [date, setDate] = useState(todayStr());
  const [tab, setTab] = useState<Tab>('entry');
  const [logs, setLogs] = useState<HomeroomDoc[]>([]);
  const [attDocs, setAttDocs] = useState<AttDoc[]>([]);
  const [holidays, setHolidays] = useState<Record<string, string>>({});
  const [schoolDays, setSchoolDays] = useState<Record<string, SchoolDayOverride>>({});
  const [saving, setSaving] = useState(false);

  // form fields
  const [topic, setTopic] = useState('');
  const [problems, setProblems] = useState('');
  const [solutions, setSolutions] = useState('');
  const [suggestions, setSuggestions] = useState('');

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

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, 'attendance'));
        const arr: AttDoc[] = [];
        snap.forEach(d => arr.push(d.data() as AttDoc));
        setAttDocs(arr);
      } catch (e) { console.error(e); }
    })();
  }, []);

  useEffect(() => {
    return onSnapshot(collection(db, 'activities'), snap => {
      const map: Record<string, string> = {};
      snap.forEach(d => {
        const a = d.data() as any;
        if (a.isHoliday && a.date) map[a.date] = a.title || 'วันหยุด';
      });
      setHolidays(map);
    });
  }, []);

  useEffect(() => {
    return onSnapshot(collection(db, SCHOOL_CALENDAR_COLLECTION), snap => {
      const map: Record<string, SchoolDayOverride> = {};
      snap.forEach(d => { map[d.id] = { date: d.id, ...(d.data() as Omit<SchoolDayOverride, 'date'>) }; });
      setSchoolDays(map);
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

  // ── attendance count for the selected day (auto) ──
  const attForDay = useMemo(() => {
    const d = attDocs.find(x => x.classId === classId && x.date === date);
    if (!d) return null;
    let present = 0, absent = 0, leave = 0;
    Object.values(d.records || {}).forEach(r => {
      if (r.status === 'present') present++;
      else if (r.status === 'absent') absent++;
      else if (r.status === 'leave') leave++;
    });
    return { present, absent, leave, total: present + absent + leave };
  }, [attDocs, classId, date]);

  // ── load existing log into the form when class/date changes ──
  const existing = useMemo(
    () => logs.find(l => l.classId === classId && l.date === date),
    [logs, classId, date],
  );

  useEffect(() => {
    setTopic(existing?.topic || '');
    setProblems(existing?.problems || '');
    setSolutions(existing?.solutions || '');
    setSuggestions(existing?.suggestions || '');
  }, [existing?.id, classId, date]);

  const save = async () => {
    if (!classId || !current) return;
    if (!topic.trim()) { toast.warn('กรุณาเลือกหรือพิมพ์หัวข้อโฮมรูมก่อน'); return; }
    setSaving(true);
    try {
      const payload: HomeroomDoc = {
        id: homeroomDocId(classId, date),
        classId, className: current.label, date,
        topic: topic.trim(),
        problems: problems.trim(),
        solutions: solutions.trim(),
        teacherName: userName,
        updatedAt: Date.now(),
      };
      if (suggestions.trim()) payload.suggestions = suggestions.trim();
      if (attForDay) {
        payload.presentCount = attForDay.present;
        payload.totalCount = current.students.length;
      }
      await setDoc(doc(db, 'homeroom', payload.id), payload);
      toast.success('บันทึกโฮมรูมเรียบร้อย');
    } catch (e: any) {
      toast.error('บันทึกไม่สำเร็จ: ' + (e?.message || e));
    }
    setSaving(false);
  };

  const removeLog = async (log: HomeroomDoc) => {
    if (!confirm(`ลบบันทึกโฮมรูมวันที่ ${fmtThai(log.date)}?`)) return;
    try {
      await deleteDoc(doc(db, 'homeroom', log.id));
      toast.success('ลบแล้ว');
    } catch (e: any) { toast.error(e?.message || String(e)); }
  };

  const classLogs = useMemo(
    () => logs.filter(l => l.classId === classId).sort((a, b) => b.date.localeCompare(a.date)),
    [logs, classId],
  );

  return (
    <div style={{ minHeight: '100vh', background: '#FFF7ED' }}>
      <header style={{ background: `linear-gradient(135deg,${COLOR},#A78BFA)`, color: 'white', padding: '1.2rem 1.25rem' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Link to="/teacher-hub" style={lnk}><ChevronLeft size={16} />Hub</Link>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 900 }}>🏫 บันทึกกิจกรรมโฮมรูม</div>
            <div style={{ fontSize: '0.78rem', opacity: 0.9 }}>จำนวนนักเรียนดึงจากระบบเช็คชื่อ · {userName}</div>
          </div>
          <Link to="/print-homeroom" style={{ ...btnGhost, textDecoration: 'none' }}>
            <Printer size={12} /> พิมพ์แบบสรุป
          </Link>
          <button onClick={onLogout} style={btnGhost}><LogOut size={12} />ออก</button>
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '1.25rem' }}>
        {/* class picker */}
        <div style={{ background: 'white', borderRadius: 12, padding: '1rem', marginBottom: 14 }}>
          <label style={lbl}>ชั้นเรียน</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
            {availableClasses.map(c => (
              <button key={c.id} onClick={() => setClassId(c.id)} style={{
                padding: '8px 14px', borderRadius: 10, cursor: 'pointer', fontWeight: 800, fontSize: '0.86rem',
                background: classId === c.id ? COLOR : 'white',
                color: classId === c.id ? 'white' : '#475569',
                border: classId === c.id ? 'none' : '1px solid #E2E8F0',
              }}>{c.label}</button>
            ))}
          </div>
        </div>

        {/* tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
          {([
            ['entry', <PenLine size={14} key="e" />, 'บันทึกโฮมรูม'],
            ['calendar', <CalendarDays size={14} key="c" />, 'ปฏิทินการบันทึก'],
            ['report', <ListChecks size={14} key="r" />, `รายงาน (${classLogs.length})`],
          ] as const).map(([k, ic, label]) => (
            <button key={k} onClick={() => setTab(k as Tab)} style={{
              padding: '9px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
              fontWeight: 800, fontSize: '0.86rem', display: 'inline-flex', alignItems: 'center', gap: 6,
              background: tab === k ? COLOR : 'white', color: tab === k ? 'white' : '#475569',
              boxShadow: tab === k ? '0 4px 10px rgba(124,58,237,0.3)' : '0 1px 3px rgba(0,0,0,0.05)',
            }}>{ic}{label}</button>
          ))}
        </div>

        {tab === 'entry' && (
          <EntryForm
            date={date} setDate={setDate}
            attForDay={attForDay} totalStudents={current?.students.length || 0}
            topic={topic} setTopic={setTopic}
            problems={problems} setProblems={setProblems}
            solutions={solutions} setSolutions={setSolutions}
            suggestions={suggestions} setSuggestions={setSuggestions}
            existing={existing} saving={saving} onSave={save}
          />
        )}

        {tab === 'calendar' && (
          <CalendarView
            logs={classLogs} holidays={holidays} schoolDays={schoolDays}
            onPick={(d) => { setDate(d); setTab('entry'); }}
          />
        )}

        {tab === 'report' && (
          <ReportView logs={classLogs} onPick={(d) => { setDate(d); setTab('entry'); }} onDelete={removeLog} />
        )}
      </main>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
function EntryForm({
  date, setDate, attForDay, totalStudents,
  topic, setTopic, problems, setProblems, solutions, setSolutions,
  suggestions, setSuggestions, existing, saving, onSave,
}: any) {
  const appendTo = (cur: string, add: string, set: (v: string) => void) => {
    const next = cur.trim() ? `${cur.trim()}\n${add}` : add;
    set(next);
  };

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {/* date + attendance summary */}
      <div style={{ background: 'white', borderRadius: 12, padding: '1rem', display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <QuickDate value={date} onChange={setDate} color={COLOR} label="วันที่โฮมรูม" />
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ ...lbl, marginBottom: 6 }}>
            <Users size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            จำนวนนักเรียน (ดึงจากระบบเช็คชื่ออัตโนมัติ)
          </div>
          {attForDay ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
              <MiniStat label="เข้าโฮมรูม" value={attForDay.present} color="#10B981" />
              <MiniStat label="ขาด" value={attForDay.absent} color="#EF4444" />
              <MiniStat label="ลา" value={attForDay.leave} color="#F59E0B" />
              <MiniStat label="ทั้งหมด" value={totalStudents} color="#0F172A" />
            </div>
          ) : (
            <div style={{ background: '#FEF3C7', color: '#92400E', padding: '10px 14px', borderRadius: 8, fontSize: '0.85rem' }}>
              ⚠️ ยังไม่ได้เช็คชื่อวันนี้ — <Link to="/attendance" style={{ color: '#92400E', fontWeight: 800 }}>ไปเช็คชื่อก่อน</Link> แล้วจำนวนจะขึ้นเอง
            </div>
          )}
        </div>
      </div>

      {/* topic */}
      <div style={{ background: 'white', borderRadius: 12, padding: '1rem' }}>
        <label style={lbl}>หัวข้อ/เรื่องที่พูดคุย *</label>
        <select
          value={HOMEROOM_TOPICS.includes(topic) ? topic : ''}
          onChange={e => e.target.value && setTopic(e.target.value)}
          style={{ ...inp, marginBottom: 8 }}
        >
          <option value="">— เลือกหัวข้อที่ใช้บ่อย —</option>
          {HOMEROOM_TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <input
          value={topic}
          onChange={e => setTopic(e.target.value)}
          placeholder="หรือพิมพ์หัวข้อเอง"
          style={inp}
        />
      </div>

      {/* problems */}
      <PickerField
        label="1. ปัญหาของนักเรียนในการจัดกิจกรรมโฮมรูม"
        value={problems} setValue={setProblems}
        presets={COMMON_PROBLEMS} onPick={(v: string) => appendTo(problems, v, setProblems)}
        placeholder="พิมพ์ปัญหาที่พบ หรือกดเลือกจากรายการด้านล่าง (แต่ละข้อขึ้นบรรทัดใหม่)"
      />

      {/* solutions */}
      <PickerField
        label="2. แนวทางแก้ไขปัญหาของครูที่ปรึกษา"
        value={solutions} setValue={setSolutions}
        presets={COMMON_SOLUTIONS} onPick={(v: string) => appendTo(solutions, v, setSolutions)}
        placeholder="พิมพ์แนวทางแก้ไข หรือกดเลือกจากรายการด้านล่าง"
      />

      {/* suggestions */}
      <div style={{ background: 'white', borderRadius: 12, padding: '1rem' }}>
        <label style={lbl}>3. ข้อเสนอแนะ</label>
        <textarea value={suggestions} onChange={e => setSuggestions(e.target.value)} rows={3}
          placeholder="ข้อเสนอแนะเพิ่มเติม (ถ้ามี)" style={{ ...inp, resize: 'vertical' }} />
      </div>

      {/* save */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={onSave} disabled={saving} style={{
          background: COLOR, color: 'white', border: 'none', borderRadius: 10,
          padding: '12px 22px', fontWeight: 900, fontSize: '0.95rem',
          cursor: saving ? 'wait' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8,
        }}>
          <Save size={16} /> {saving ? 'กำลังบันทึก…' : existing ? 'อัปเดตบันทึก' : 'บันทึกโฮมรูม'}
        </button>
        {existing && (
          <span style={{ fontSize: '0.82rem', color: '#10B981', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Check size={14} /> มีบันทึกของวันนี้แล้ว (แก้ไขแล้วกดอัปเดต)
          </span>
        )}
      </div>
    </div>
  );
}

function PickerField({ label, value, setValue, presets, onPick, placeholder }: any) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ background: 'white', borderRadius: 12, padding: '1rem' }}>
      <label style={lbl}>{label}</label>
      <textarea value={value} onChange={e => setValue(e.target.value)} rows={4}
        placeholder={placeholder} style={{ ...inp, resize: 'vertical', marginBottom: 8 }} />
      <button onClick={() => setOpen(o => !o)} style={{
        background: '#F1F5F9', border: 'none', borderRadius: 8, padding: '7px 12px',
        fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer', color: '#475569',
        display: 'inline-flex', alignItems: 'center', gap: 6,
      }}>
        <Plus size={13} /> {open ? 'ซ่อนรายการสำเร็จรูป' : 'เลือกจากรายการที่ใช้บ่อย'}
      </button>
      {open && (
        <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
          {presets.map((p: string) => (
            <button key={p} onClick={() => onPick(p)} style={{
              textAlign: 'left', background: '#FFF7ED', border: '1px solid #FFEDD5',
              borderRadius: 8, padding: '9px 12px', fontSize: '0.84rem', cursor: 'pointer',
              color: '#7C2D12', lineHeight: 1.5,
            }}>+ {p}</button>
          ))}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
function CalendarView({ logs, holidays, schoolDays, onPick }: {
  logs: HomeroomDoc[];
  holidays: Record<string, string>;
  schoolDays: Record<string, SchoolDayOverride>;
  onPick: (d: string) => void;
}) {
  const now = new Date();
  const [ym, setYm] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const [y, m] = ym.split('-').map(Number);

  const recorded = useMemo(() => new Set(logs.map(l => l.date)), [logs]);

  const daysInMonth = new Date(y, m, 0).getDate();
  const firstDow = new Date(y, m - 1, 1).getDay();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const iso = (d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const todayIso = todayStr();

  // นับเฉพาะวันที่โรงเรียนเปิดจริงตามปฏิทินเปิด-ปิด (รวมวันเรียนชดเชยเสาร์อาทิตย์)
  let missing = 0, done = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const s = iso(d);
    if (!resolveSchoolDay(s, schoolDays, holidays).open || s > todayIso) continue;
    if (recorded.has(s)) done++; else missing++;
  }

  const shift = (n: number) => {
    const d = new Date(y, m - 1 + n, 1);
    setYm(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  return (
    <div style={{ background: 'white', borderRadius: 12, padding: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <button onClick={() => shift(-1)} style={navBtn}>‹</button>
        <div style={{ fontWeight: 900, fontSize: '1.05rem', color: '#0F172A', minWidth: 160, textAlign: 'center' }}>
          {THAI_MONTHS[m - 1]} {y + 543}
        </div>
        <button onClick={() => shift(1)} style={navBtn}>›</button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ background: '#DCFCE7', color: '#166534', padding: '4px 12px', borderRadius: 999, fontWeight: 800, fontSize: '0.8rem' }}>
            ✓ บันทึกแล้ว {done} วัน
          </span>
          <span style={{ background: missing > 0 ? '#FEE2E2' : '#F1F5F9', color: missing > 0 ? '#991B1B' : '#94A3B8', padding: '4px 12px', borderRadius: 999, fontWeight: 800, fontSize: '0.8rem' }}>
            ⚠ ยังไม่บันทึก {missing} วัน
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 6 }}>
        {THAI_DAYS.map((d, i) => (
          <div key={d} style={{ textAlign: 'center', fontWeight: 800, fontSize: '0.78rem', color: i === 0 || i === 6 ? '#EF4444' : '#64748B', padding: 4 }}>
            {d}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />;
          const s = iso(d);
          const day = resolveSchoolDay(s, schoolDays, holidays);
          const has = recorded.has(s);
          const future = s > todayIso;
          const isToday = s === todayIso;

          let bg = '#F8FAFC', color = '#94A3B8', label = '';
          if (has) { bg = '#DCFCE7'; color = '#166534'; label = '✓'; }
          else if (day.reason === 'override' && day.open) { bg = future ? '#EFF6FF' : '#FEE2E2'; color = future ? '#1E40AF' : '#991B1B'; label = future ? 'เปิด' : '—'; }
          else if (!day.open && day.reason === 'override') { bg = '#DBEAFE'; color = '#1E40AF'; label = 'ปิด'; }
          else if (day.reason === 'holiday') { bg = '#FED7AA'; color = '#7C2D12'; label = 'หยุด'; }
          else if (day.reason === 'weekend') { bg = '#FEF2F2'; color = '#FCA5A5'; }
          else if (!future) { bg = '#FEE2E2'; color = '#991B1B'; label = '—'; }

          return (
            <button key={i} onClick={() => onPick(s)} title={day.label + (has ? ' · มีบันทึก' : day.open ? ' · ยังไม่บันทึก' : '')} style={{
              aspectRatio: '1', borderRadius: 10, cursor: 'pointer',
              background: bg, color,
              border: isToday ? `2px solid ${COLOR}` : '1px solid transparent',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: '0.85rem', padding: 2,
            }}>
              <span>{d}</span>
              {label && <span style={{ fontSize: '0.62rem', fontWeight: 700 }}>{label}</span>}
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 12, display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: '0.76rem', color: '#64748B' }}>
        <Legend color="#DCFCE7" text="บันทึกแล้ว" />
        <Legend color="#FEE2E2" text="ยังไม่บันทึก" />
        <Legend color="#FED7AA" text="วันหยุดราชการ" />
        <Legend color="#FEF2F2" text="เสาร์-อาทิตย์" />
        <span style={{ marginLeft: 'auto' }}>💡 คลิกวันที่เพื่อไปบันทึก</span>
      </div>
    </div>
  );
}

function Legend({ color, text }: { color: string; text: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 14, height: 14, borderRadius: 4, background: color, border: '1px solid rgba(0,0,0,0.06)' }} />
      {text}
    </span>
  );
}

// ════════════════════════════════════════════════════════════════
function ReportView({ logs, onPick, onDelete }: {
  logs: HomeroomDoc[]; onPick: (d: string) => void; onDelete: (l: HomeroomDoc) => void;
}) {
  if (logs.length === 0) {
    return (
      <div style={{ background: 'white', padding: '3rem', textAlign: 'center', color: '#94A3B8', borderRadius: 12 }}>
        ยังไม่มีบันทึกโฮมรูมของชั้นนี้
      </div>
    );
  }
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {logs.map(l => (
        <div key={l.id} style={{ background: 'white', borderRadius: 12, padding: '1rem', borderLeft: `5px solid ${COLOR}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
            <span style={{ background: '#EDE9FE', color: '#5B21B6', padding: '3px 12px', borderRadius: 999, fontWeight: 800, fontSize: '0.8rem' }}>
              {fmtThai(l.date)}
            </span>
            {l.presentCount != null && (
              <span style={{ background: '#DCFCE7', color: '#166534', padding: '3px 12px', borderRadius: 999, fontWeight: 800, fontSize: '0.78rem' }}>
                👥 เข้าโฮมรูม {l.presentCount}{l.totalCount ? `/${l.totalCount}` : ''} คน
              </span>
            )}
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <button onClick={() => onPick(l.date)} style={smBtn}>แก้ไข</button>
              <button onClick={() => onDelete(l)} style={{ ...smBtn, color: '#DC2626' }}><Trash2 size={13} /></button>
            </span>
          </div>
          <div style={{ fontWeight: 900, color: '#0F172A', marginBottom: 6 }}>{l.topic}</div>
          {l.problems && <Block title="ปัญหา" text={l.problems} />}
          {l.solutions && <Block title="แนวทางแก้ไข" text={l.solutions} />}
          {l.suggestions && <Block title="ข้อเสนอแนะ" text={l.suggestions} />}
          <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: 8 }}>
            ครูผู้บันทึก: {l.teacherName}
          </div>
        </div>
      ))}
    </div>
  );
}

function Block({ title, text }: { title: string; text: string }) {
  return (
    <div style={{ marginTop: 6, background: '#F8FAFC', borderRadius: 8, padding: '8px 12px' }}>
      <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#64748B', marginBottom: 2 }}>{title}</div>
      <div style={{ fontSize: '0.86rem', color: '#334155', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{text}</div>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: '#F8FAFC', borderRadius: 8, padding: '8px 6px', textAlign: 'center', borderTop: `3px solid ${color}` }}>
      <div style={{ fontSize: '1.3rem', fontWeight: 900, color }}>{value}</div>
      <div style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 700 }}>{label}</div>
    </div>
  );
}

const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const fmtThai = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  return `${d} ${months[m - 1]} ${y + 543}`;
};

const lnk: React.CSSProperties = { color: 'white', display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontSize: '0.85rem', opacity: 0.9 };
const inp: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: '0.92rem' };
const lbl: React.CSSProperties = { display: 'block', fontSize: '0.8rem', color: '#64748B', marginBottom: 6, fontWeight: 800 };
const btnGhost: React.CSSProperties = { background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.4)', padding: '6px 12px', borderRadius: 8, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 };
const navBtn: React.CSSProperties = { width: 36, height: 36, borderRadius: 10, border: '1px solid #E2E8F0', background: 'white', cursor: 'pointer', fontWeight: 900, fontSize: '1.1rem', color: COLOR };
const smBtn: React.CSSProperties = { background: '#F1F5F9', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: '0.76rem', fontWeight: 800, cursor: 'pointer', color: '#475569', display: 'inline-flex', alignItems: 'center', gap: 4 };
