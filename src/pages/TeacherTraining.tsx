import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { collection, doc, onSnapshot, setDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { ChevronLeft, LogOut, Plus, Trash2, Edit2, Save, X, Award, Download } from 'lucide-react';
import { useTeacherAuth } from '../utils/teacherAuth';
import TeacherLoginGate from '../components/TeacherLoginGate';

const BRAND = '#FF6A01';

interface TrainingRecord {
  id: string;
  teacherName: string;
  topic: string;            // หัวข้อการอบรม
  organizer: string;        // หน่วยงานจัดการอบรม
  startDate: string;
  endDate: string;
  hours: number;            // จำนวนชั่วโมง
  location: string;
  category: 'PA' | 'วPA' | 'พัฒนาวิชาชีพ' | 'IT' | 'อื่น ๆ';
  certificateUrl?: string;
  budget?: number;          // งบประมาณ
  note?: string;
  createdAt: number;
  createdBy: string;
}

const CATEGORIES: TrainingRecord['category'][] = ['PA', 'วPA', 'พัฒนาวิชาชีพ', 'IT', 'อื่น ๆ'];

export default function TeacherTrainingPage() {
  const auth = useTeacherAuth();
  if (!auth.authed) return <TeacherLoginGate title="🎓 ระบบบันทึกข้อมูลการอบรมครู" />;
  return <App userName={auth.name} onLogout={auth.logout} />;
}

function App({ userName, onLogout }: { userName: string; onLogout: () => void }) {
  const [items, setItems] = useState<TrainingRecord[]>([]);
  const [editing, setEditing] = useState<TrainingRecord | null>(null);
  const [filter, setFilter] = useState<string>('');
  const [yearFilter, setYearFilter] = useState<string>('');

  useEffect(() => {
    return onSnapshot(query(collection(db, 'teacher_trainings'), orderBy('startDate', 'desc')), snap => {
      const arr: TrainingRecord[] = [];
      snap.forEach(d => arr.push({ id: d.id, ...(d.data() as any) }));
      setItems(arr);
    });
  }, []);

  const teachers = useMemo(() => Array.from(new Set(items.map(i => i.teacherName))).filter(Boolean).sort(), [items]);
  const years = useMemo(() => {
    const ys = new Set<string>();
    items.forEach(i => { if (i.startDate) ys.add(String(Number(i.startDate.slice(0, 4)) + 543)); });
    return Array.from(ys).sort().reverse();
  }, [items]);

  const filtered = items.filter(i =>
    (!filter || i.teacherName === filter) &&
    (!yearFilter || (i.startDate && String(Number(i.startDate.slice(0, 4)) + 543) === yearFilter))
  );

  const totalHours = filtered.reduce((s, x) => s + (x.hours || 0), 0);

  const create = () => {
    const today = todayStr();
    setEditing({
      id: `train_${Date.now()}`, teacherName: '', topic: '', organizer: '',
      startDate: today, endDate: today, hours: 0, location: '', category: 'PA',
      certificateUrl: '', budget: 0, note: '', createdAt: Date.now(), createdBy: userName,
    });
  };

  const save = async (t: TrainingRecord) => {
    try {
      const clean: any = { ...t };
      if (!clean.certificateUrl) delete clean.certificateUrl;
      if (!clean.note) delete clean.note;
      if (!clean.budget) delete clean.budget;
      await setDoc(doc(db, 'teacher_trainings', t.id), clean);
      setEditing(null);
    } catch (e: any) { alert('❌ ' + (e?.message || e)); }
  };

  const del = async (t: TrainingRecord) => {
    if (!confirm(`ลบข้อมูล "${t.topic}"?`)) return;
    try { await deleteDoc(doc(db, 'teacher_trainings', t.id)); }
    catch (e: any) { alert('❌ ' + (e?.message || e)); }
  };

  const exportCsv = () => {
    const rows = [['ชื่อครู', 'หัวข้อ', 'หน่วยงาน', 'ประเภท', 'วันที่เริ่ม', 'วันที่สิ้นสุด', 'จำนวนชั่วโมง', 'สถานที่', 'งบประมาณ', 'หมายเหตุ']];
    filtered.forEach(t => rows.push([
      t.teacherName, t.topic, t.organizer, t.category,
      t.startDate, t.endDate, String(t.hours || 0), t.location || '',
      String(t.budget || 0), t.note || '',
    ]));
    const csv = '﻿' + rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `ข้อมูลการอบรม_${filter || 'ทั้งหมด'}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#FFF7ED' }}>
      <header style={{ background: 'linear-gradient(135deg,#FF6A01,#FB923C)', color: 'white', padding: '1.2rem 1.25rem' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Link to="/" style={lnk}><ChevronLeft size={16} />หน้าหลัก</Link>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 900 }}>🎓 ระบบบันทึกข้อมูลการอบรมครู</div>
            <div style={{ fontSize: '0.78rem', opacity: 0.9 }}>โรงเรียนบ้านคลองมดแดง · {userName}</div>
          </div>
          <button onClick={onLogout} style={btnLogout}><LogOut size={12} />ออกจากระบบ</button>
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '1.25rem' }}>
        {/* Filters + actions */}
        <div style={{ background: 'white', borderRadius: 12, padding: '1rem', marginBottom: 14,
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 10 }}>
          <div>
            <label style={lbl}>ครูผู้เข้าอบรม</label>
            <select value={filter} onChange={e => setFilter(e.target.value)} style={inp}>
              <option value="">— ทุกคน —</option>
              {teachers.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>ปีการศึกษา</label>
            <select value={yearFilter} onChange={e => setYearFilter(e.target.value)} style={inp}>
              <option value="">— ทุกปี —</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
            <button onClick={create} style={btnPrimary}><Plus size={14} /> เพิ่มข้อมูลอบรม</button>
            <button onClick={exportCsv} style={btnSecondary}><Download size={14} /> Export CSV</button>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
          <Stat label="📋 จำนวนรายการ" value={filtered.length} color="#3B82F6" />
          <Stat label="⏱️ ชั่วโมงรวม" value={totalHours} color="#10B981" />
          <Stat label="👨‍🏫 ครู" value={filter ? 1 : teachers.length} color={BRAND} />
        </div>

        {filtered.length === 0 ? (
          <Empty msg="ยังไม่มีข้อมูล — กดปุ่ม 'เพิ่มข้อมูลอบรม' เพื่อเริ่ม" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(t => (
              <div key={t.id} style={{ background: 'white', borderRadius: 12, padding: '14px 16px', borderLeft: `5px solid ${catColor(t.category)}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                  <span style={{ background: catColor(t.category) + '22', color: catColor(t.category), padding: '2px 10px', borderRadius: 999, fontSize: '0.78rem', fontWeight: 800 }}>{t.category}</span>
                  <span style={{ background: '#FFEDD5', color: '#7C2D12', padding: '2px 10px', borderRadius: 999, fontSize: '0.78rem', fontWeight: 700 }}>⏱️ {t.hours} ชั่วโมง</span>
                  <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                    <button onClick={() => setEditing(t)} style={btnSm}><Edit2 size={12} /></button>
                    <button onClick={() => del(t)} style={{ ...btnSm, color: '#DC2626' }}><Trash2 size={12} /></button>
                  </span>
                </div>
                <div style={{ fontWeight: 900, fontSize: '1.05rem', color: '#0F172A' }}>{t.topic}</div>
                <div style={{ fontSize: '0.85rem', color: '#475569', marginBottom: 8 }}>
                  👤 {t.teacherName} · จัดโดย <b>{t.organizer}</b>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 8, fontSize: '0.85rem', color: '#64748B' }}>
                  <div>📅 {fmtThai(t.startDate)}{t.endDate !== t.startDate && ` - ${fmtThai(t.endDate)}`}</div>
                  <div>📍 {t.location || '-'}</div>
                  {!!t.budget && <div>💰 {t.budget.toLocaleString('th-TH')} บาท</div>}
                </div>
                {t.certificateUrl && (
                  <div style={{ marginTop: 8 }}>
                    <a href={t.certificateUrl} target="_blank" rel="noreferrer"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#FEF3C7', color: '#92400E', padding: '4px 12px', borderRadius: 999, fontSize: '0.78rem', fontWeight: 700, textDecoration: 'none' }}>
                      <Award size={12} /> ดูเกียรติบัตร
                    </a>
                  </div>
                )}
                {t.note && <div style={{ marginTop: 8, fontSize: '0.85rem', color: '#64748B' }}>💬 {t.note}</div>}
              </div>
            ))}
          </div>
        )}

        {editing && <Editor item={editing} onSave={save} onCancel={() => setEditing(null)} />}
      </main>
    </div>
  );
}

function Editor({ item, onSave, onCancel }: { item: TrainingRecord; onSave: (t: TrainingRecord) => void; onCancel: () => void }) {
  const [t, setT] = useState(item);
  return (
    <div onClick={onCancel} style={modalBg}>
      <div onClick={e => e.stopPropagation()} style={modalBox}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          <h5 style={{ margin: 0, fontWeight: 900, flex: 1 }}>✏️ ข้อมูลการอบรม</h5>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={22} /></button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
          <div><label style={lbl}>ชื่อครู *</label><input value={t.teacherName} onChange={e => setT({ ...t, teacherName: e.target.value })} style={inp} /></div>
          <div><label style={lbl}>ประเภท</label>
            <select value={t.category} onChange={e => setT({ ...t, category: e.target.value as any })} style={inp}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={lbl}>หัวข้อการอบรม *</label>
            <input value={t.topic} onChange={e => setT({ ...t, topic: e.target.value })} style={inp} />
          </div>
          <div><label style={lbl}>หน่วยงานจัดการอบรม *</label><input value={t.organizer} onChange={e => setT({ ...t, organizer: e.target.value })} style={inp} /></div>
          <div><label style={lbl}>สถานที่</label><input value={t.location} onChange={e => setT({ ...t, location: e.target.value })} style={inp} /></div>
          <div><label style={lbl}>วันที่เริ่ม *</label><input type="date" value={t.startDate} onChange={e => setT({ ...t, startDate: e.target.value })} style={inp} /></div>
          <div><label style={lbl}>วันที่สิ้นสุด *</label><input type="date" value={t.endDate} onChange={e => setT({ ...t, endDate: e.target.value })} style={inp} /></div>
          <div><label style={lbl}>จำนวนชั่วโมง *</label><input type="number" value={t.hours} onChange={e => setT({ ...t, hours: Number(e.target.value) || 0 })} style={inp} /></div>
          <div><label style={lbl}>งบประมาณ (บาท)</label><input type="number" value={t.budget || ''} onChange={e => setT({ ...t, budget: Number(e.target.value) || 0 })} style={inp} /></div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={lbl}>ลิงก์เกียรติบัตร (Google Drive)</label>
            <input value={t.certificateUrl || ''} onChange={e => setT({ ...t, certificateUrl: e.target.value })} placeholder="https://drive.google.com/..." style={inp} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={lbl}>หมายเหตุ</label>
            <textarea value={t.note || ''} onChange={e => setT({ ...t, note: e.target.value })} rows={2} style={{ ...inp, resize: 'vertical' }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={btnSecondary}>ยกเลิก</button>
          <button onClick={() => onSave(t)} disabled={!t.teacherName || !t.topic || !t.organizer}
            style={{ ...btnPrimary, opacity: (!t.teacherName || !t.topic || !t.organizer) ? 0.4 : 1 }}>
            <Save size={14} /> บันทึก
          </button>
        </div>
      </div>
    </div>
  );
}

const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const fmtThai = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']; return `${d} ${months[m - 1]} ${y + 543}`; };
const catColor = (c: TrainingRecord['category']) => ({ 'PA': '#3B82F6', 'วPA': '#A855F7', 'พัฒนาวิชาชีพ': '#10B981', 'IT': '#F59E0B', 'อื่น ๆ': '#64748B' }[c] || '#64748B');

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return <div style={{ background: 'white', padding: '10px 14px', borderRadius: 10, textAlign: 'center', borderTop: `3px solid ${color}` }}>
    <div style={{ fontSize: '1.6rem', fontWeight: 900, color }}>{value}</div>
    <div style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 700 }}>{label}</div>
  </div>;
}
function Empty({ msg }: { msg: string }) {
  return <div style={{ background: 'white', padding: '3rem', textAlign: 'center', color: '#94A3B8', borderRadius: 12 }}>{msg}</div>;
}

const lnk: React.CSSProperties = { color: 'white', display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontSize: '0.85rem', opacity: 0.9 };
const inp: React.CSSProperties = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: '0.9rem' };
const lbl: React.CSSProperties = { display: 'block', fontSize: '0.78rem', color: '#64748B', marginBottom: 4, fontWeight: 700 };
const btnPrimary: React.CSSProperties = { background: BRAND, color: 'white', border: 'none', borderRadius: 8, padding: '8px 14px', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const btnSecondary: React.CSSProperties = { background: 'white', color: '#475569', border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 14px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const btnSm: React.CSSProperties = { background: '#F1F5F9', border: 'none', borderRadius: 6, padding: '6px 10px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, color: '#475569' };
const btnLogout: React.CSSProperties = { background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.4)', padding: '6px 12px', borderRadius: 8, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 };
const modalBg: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' };
const modalBox: React.CSSProperties = { background: 'white', borderRadius: 16, maxWidth: 700, width: '100%', maxHeight: '90vh', overflow: 'auto', padding: '1.5rem' };
