import { useState, useEffect, useMemo } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { collection, doc, onSnapshot, setDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { ChevronLeft, LogOut, Plus, Trash2, Edit2, Save, X, Download, ExternalLink } from 'lucide-react';
import { useTeacherAuth } from '../utils/teacherAuth';
import TeacherLoginGate from '../components/TeacherLoginGate';
import { TEACHER_LOGS, type LogConfig, type LogField } from '../data/teacherLogs';

type LogEntry = Record<string, any> & {
  id: string;
  createdAt: number;
  createdBy: string;
};

export default function TeacherLogPage() {
  const { type } = useParams<{ type: string }>();
  const config = type ? TEACHER_LOGS[type] : null;
  if (!config) return <Navigate to="/teacher-hub" replace />;
  return <Wrapper config={config} />;
}

function Wrapper({ config }: { config: LogConfig }) {
  const auth = useTeacherAuth();
  if (!auth.authed) return <TeacherLoginGate title={`${config.emoji} ${config.title}`} />;
  return <App config={config} userName={auth.name} onLogout={auth.logout} />;
}

function App({ config, userName, onLogout }: { config: LogConfig; userName: string; onLogout: () => void }) {
  const [items, setItems] = useState<LogEntry[]>([]);
  const [editing, setEditing] = useState<LogEntry | null>(null);
  const [filterTeacher, setFilterTeacher] = useState('');

  useEffect(() => {
    return onSnapshot(query(collection(db, config.collection), orderBy('createdAt', 'desc')), snap => {
      const arr: LogEntry[] = [];
      snap.forEach(d => arr.push({ id: d.id, ...(d.data() as any) }));
      setItems(arr);
    });
  }, [config.collection]);

  const teachers = useMemo(() =>
    Array.from(new Set(items.map(i => i.teacherName).filter(Boolean))).sort()
  , [items]);

  const filtered = items.filter(i => !filterTeacher || i.teacherName === filterTeacher);

  const create = () => {
    const init: any = { id: `${config.type}_${Date.now()}`, createdAt: Date.now(), createdBy: userName };
    config.fields.forEach(f => {
      if (f.key === 'teacherName') init[f.key] = userName;
      else if (f.key === 'date') init[f.key] = todayStr();
      else init[f.key] = '';
    });
    setEditing(init);
  };

  const save = async (e: LogEntry) => {
    try {
      // Auto BMI for body-metrics
      if (config.type === 'body-metrics' && e.weight && e.height) {
        const m = Number(e.height) / 100;
        e.bmi = Math.round((Number(e.weight) / (m * m)) * 10) / 10;
      }
      const clean: any = {};
      for (const [k, v] of Object.entries(e)) {
        if (v != null && v !== '') clean[k] = v;
      }
      await setDoc(doc(db, config.collection, e.id), clean);
      setEditing(null);
    } catch (err: any) { alert('❌ ' + (err?.message || err)); }
  };

  const del = async (e: LogEntry) => {
    if (!confirm('ลบรายการนี้?')) return;
    try { await deleteDoc(doc(db, config.collection, e.id)); }
    catch (err: any) { alert('❌ ' + (err?.message || err)); }
  };

  const exportCsv = () => {
    const cols = config.fields.map(f => f.key);
    const labels = config.fields.map(f => f.label);
    const rows = [labels];
    filtered.forEach(e => rows.push(cols.map(c => String(e[c] ?? ''))));
    const csv = '﻿' + rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${config.title}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#FFF7ED' }}>
      <header style={{ background: `linear-gradient(135deg,${config.color},${config.color}dd)`, color: 'white', padding: '1.2rem 1.25rem' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Link to="/teacher-hub" style={lnk}><ChevronLeft size={16} />Hub</Link>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 900 }}>{config.emoji} {config.title}</div>
            <div style={{ fontSize: '0.78rem', opacity: 0.9 }}>{config.description} · {userName}</div>
          </div>
          <button onClick={onLogout} style={btnLogout}><LogOut size={12} />ออก</button>
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          <h6 style={{ margin: 0, flex: 1, fontWeight: 800 }}>📋 ทั้งหมด {filtered.length} รายการ</h6>
          {teachers.length > 1 && (
            <select value={filterTeacher} onChange={e => setFilterTeacher(e.target.value)} style={inp}>
              <option value="">— ทุกครู —</option>
              {teachers.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
          <button onClick={exportCsv} style={btnSecondary}><Download size={14} /> CSV</button>
          <button onClick={create} style={{ ...btnPrimary, background: config.color }}>
            <Plus size={14} /> เพิ่มใหม่
          </button>
        </div>

        {filtered.length === 0 ? (
          <div style={{ background: 'white', padding: '3rem', textAlign: 'center', color: '#94A3B8', borderRadius: 12 }}>
            ยังไม่มีรายการ — กด "เพิ่มใหม่" เพื่อบันทึก
          </div>
        ) : (
          <div style={{ background: 'white', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: 'linear-gradient(135deg,#0F172A,#1E3A8A)', color: 'white' }}>
                    {config.listColumns.map(c => (
                      <th key={c.key} style={th}>{c.label}</th>
                    ))}
                    <th style={th}></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e, i) => (
                    <tr key={e.id} style={{ borderBottom: '1px solid #FFF7ED', background: i % 2 ? 'white' : '#FFFBF5' }}>
                      {config.listColumns.map(c => (
                        <td key={c.key} style={td}>{String(e[c.key] ?? '-')}</td>
                      ))}
                      <td style={td}>
                        <button onClick={() => setEditing(e)} style={btnIcon}><Edit2 size={14} /></button>
                        <button onClick={() => del(e)} style={{ ...btnIcon, color: '#DC2626' }}><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {editing && <Editor config={config} item={editing} onSave={save} onCancel={() => setEditing(null)} />}
      </main>
    </div>
  );
}

function Editor({ config, item, onSave, onCancel }: {
  config: LogConfig; item: LogEntry; onSave: (e: LogEntry) => void; onCancel: () => void;
}) {
  const [e, setE] = useState(item);
  const isValid = config.fields.every(f => !f.required || (e[f.key] != null && e[f.key] !== ''));

  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div onClick={ev => ev.stopPropagation()} style={{ background: 'white', borderRadius: 16, maxWidth: 700, width: '100%', maxHeight: '92vh', overflow: 'auto', padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
          <h5 style={{ margin: 0, fontWeight: 900, flex: 1 }}>{config.emoji} {config.title}</h5>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={22} /></button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
          {config.fields.map(f => (
            <Field key={f.key} f={f} value={e[f.key]} onChange={v => setE({ ...e, [f.key]: v })} fullWidth={f.type === 'textarea' || f.type === 'url'} />
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={btnSecondary}>ยกเลิก</button>
          <button onClick={() => onSave(e)} disabled={!isValid}
            style={{ ...btnPrimary, background: config.color, opacity: isValid ? 1 : 0.4 }}>
            <Save size={14} /> บันทึก
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ f, value, onChange, fullWidth }: {
  f: LogField; value: any; onChange: (v: any) => void; fullWidth?: boolean;
}) {
  const wrap = (children: React.ReactNode) => (
    <div style={{ gridColumn: fullWidth ? '1 / -1' : 'auto' }}>
      <label style={lbl}>{f.label}{f.required && ' *'}</label>
      {children}
      {f.type === 'url' && value && (
        <a href={value} target="_blank" rel="noreferrer" style={{ fontSize: '0.75rem', color: '#FF6A01', display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
          <ExternalLink size={11} />เปิดลิงก์ทดสอบ
        </a>
      )}
    </div>
  );

  if (f.type === 'textarea') return wrap(
    <textarea value={value || ''} onChange={ev => onChange(ev.target.value)} rows={3}
      placeholder={f.placeholder} style={{ ...inp, resize: 'vertical' }} />
  );
  if (f.type === 'select') return wrap(
    <select value={value || ''} onChange={ev => onChange(ev.target.value)} style={inp}>
      <option value="">— เลือก —</option>
      {(f.options || []).map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
  if (f.type === 'number') return wrap(
    <input type="number" value={value ?? ''} onChange={ev => onChange(ev.target.value === '' ? '' : Number(ev.target.value))}
      placeholder={f.placeholder} style={inp} />
  );
  if (f.type === 'date') return wrap(
    <input type="date" value={value || ''} onChange={ev => onChange(ev.target.value)} style={inp} />
  );
  return wrap(
    <input type={f.type} value={value || ''} onChange={ev => onChange(ev.target.value)}
      placeholder={f.placeholder} style={inp} />
  );
}

const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

const lnk: React.CSSProperties = { color: 'white', display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontSize: '0.85rem', opacity: 0.9 };
const inp: React.CSSProperties = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: '0.9rem' };
const lbl: React.CSSProperties = { display: 'block', fontSize: '0.78rem', color: '#64748B', marginBottom: 4, fontWeight: 700 };
const btnPrimary: React.CSSProperties = { background: '#FF6A01', color: 'white', border: 'none', borderRadius: 8, padding: '8px 14px', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const btnSecondary: React.CSSProperties = { background: 'white', color: '#475569', border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 14px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const btnLogout: React.CSSProperties = { background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.4)', padding: '6px 12px', borderRadius: 8, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 };
const btnIcon: React.CSSProperties = { background: 'transparent', border: 'none', cursor: 'pointer', padding: 6, color: '#64748B' };
const th: React.CSSProperties = { padding: '10px 12px', fontWeight: 800, fontSize: '0.78rem', textAlign: 'center', whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '8px 10px', textAlign: 'center' };
