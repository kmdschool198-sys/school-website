import { useState, useEffect, useMemo } from 'react';
import { collection, doc, onSnapshot, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Trash2, Download, Award } from 'lucide-react';

interface TrainingRecord {
  id: string;
  teacherName: string;
  topic: string;
  organizer: string;
  startDate: string;
  endDate: string;
  hours: number;
  location: string;
  category: string;
  certificateUrl?: string;
  budget?: number;
  note?: string;
  createdAt: number;
}

export default function TrainingsManager() {
  const [items, setItems] = useState<TrainingRecord[]>([]);
  const [teacherFilter, setTeacherFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');

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
    (!teacherFilter || i.teacherName === teacherFilter) &&
    (!yearFilter || (i.startDate && String(Number(i.startDate.slice(0, 4)) + 543) === yearFilter))
  );

  const totalHours = filtered.reduce((s, x) => s + (x.hours || 0), 0);
  const totalBudget = filtered.reduce((s, x) => s + (x.budget || 0), 0);

  const del = async (t: TrainingRecord) => {
    if (!confirm(`ลบ "${t.topic}"?`)) return;
    try { await deleteDoc(doc(db, 'teacher_trainings', t.id)); }
    catch (e: any) { alert('❌ ' + (e?.message || e)); }
  };

  const exportCsv = () => {
    const rows = [['ชื่อครู', 'หัวข้อ', 'หน่วยงาน', 'ประเภท', 'เริ่ม', 'สิ้นสุด', 'ชั่วโมง', 'สถานที่', 'งบประมาณ', 'เกียรติบัตร', 'หมายเหตุ']];
    filtered.forEach(t => rows.push([
      t.teacherName, t.topic, t.organizer, t.category,
      t.startDate, t.endDate, String(t.hours || 0), t.location || '',
      String(t.budget || 0), t.certificateUrl || '', t.note || '',
    ]));
    const csv = '﻿' + rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'ข้อมูลการอบรม.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14, alignItems: 'center' }}>
        <h6 style={{ margin: 0, fontWeight: 800, flex: 1 }}>🎓 ข้อมูลการอบรมครู ({items.length})</h6>
        <select value={teacherFilter} onChange={e => setTeacherFilter(e.target.value)} style={inp}>
          <option value="">— ทุกครู —</option>
          {teachers.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={yearFilter} onChange={e => setYearFilter(e.target.value)} style={inp}>
          <option value="">— ทุกปี —</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <button onClick={exportCsv} style={btnSecondary}><Download size={14} /> CSV</button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 14 }}>
        <Stat label="📋 รายการ" value={String(filtered.length)} color="#3B82F6" />
        <Stat label="⏱️ ชั่วโมงรวม" value={String(totalHours)} color="#10B981" />
        <Stat label="👨‍🏫 ครู" value={String(teacherFilter ? 1 : teachers.length)} color="#FF6A01" />
        <Stat label="💰 งบประมาณ" value={totalBudget.toLocaleString('th-TH')} color="#A855F7" />
      </div>

      {filtered.length === 0 ? (
        <Empty msg="ยังไม่มีข้อมูล" />
      ) : (
        <div style={{ background: 'white', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: 'linear-gradient(135deg,#0F172A,#1E3A8A)', color: 'white' }}>
                  <th style={th}>วันที่</th>
                  <th style={{ ...th, textAlign: 'left' }}>ครู</th>
                  <th style={{ ...th, textAlign: 'left' }}>หัวข้อ</th>
                  <th style={th}>ประเภท</th>
                  <th style={th}>ชั่วโมง</th>
                  <th style={th}>หน่วยงาน</th>
                  <th style={th}>เกียรติบัตร</th>
                  <th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => (
                  <tr key={t.id} style={{ borderBottom: '1px solid #FFF7ED' }}>
                    <td style={td}>{t.startDate}</td>
                    <td style={{ ...td, textAlign: 'left', fontWeight: 700 }}>{t.teacherName}</td>
                    <td style={{ ...td, textAlign: 'left' }}>{t.topic}</td>
                    <td style={td}>
                      <span style={{ background: catColor(t.category) + '22', color: catColor(t.category), padding: '2px 8px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700 }}>{t.category}</span>
                    </td>
                    <td style={td}><b>{t.hours}</b></td>
                    <td style={{ ...td, fontSize: '0.78rem' }}>{t.organizer}</td>
                    <td style={td}>
                      {t.certificateUrl
                        ? <a href={t.certificateUrl} target="_blank" rel="noreferrer" style={{ color: '#FF6A01', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Award size={12} /> ดู</a>
                        : '-'}
                    </td>
                    <td style={td}>
                      <button onClick={() => del(t)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626' }}><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

const catColor = (c: string) => ({ 'PA': '#3B82F6', 'วPA': '#A855F7', 'พัฒนาวิชาชีพ': '#10B981', 'IT': '#F59E0B' }[c] || '#64748B');

function Empty({ msg }: { msg: string }) {
  return <div style={{ background: 'white', padding: '3rem', textAlign: 'center', color: '#94A3B8', borderRadius: 12 }}>{msg}</div>;
}
function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return <div style={{ background: 'white', padding: '10px 14px', borderRadius: 10, textAlign: 'center', borderTop: `3px solid ${color}` }}>
    <div style={{ fontSize: '1.4rem', fontWeight: 900, color }}>{value}</div>
    <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700 }}>{label}</div>
  </div>;
}
const inp: React.CSSProperties = { padding: '8px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: '0.85rem', minWidth: 140 };
const btnSecondary: React.CSSProperties = { background: 'white', color: '#475569', border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 14px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const th: React.CSSProperties = { padding: '8px 10px', fontWeight: 800, fontSize: '0.78rem', textAlign: 'center', whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '8px 10px', textAlign: 'center' };
