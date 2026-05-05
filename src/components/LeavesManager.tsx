import { useState, useEffect, useMemo } from 'react';
import { collection, doc, onSnapshot, setDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Trash2, CheckCircle2, XCircle, Download } from 'lucide-react';

interface LeaveRequest {
  id: string;
  teacherName: string;
  position: string;
  type: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  contact: string;
  substitute?: string;
  status: 'รออนุมัติ' | 'อนุมัติ' | 'ไม่อนุมัติ';
  approverNote?: string;
  createdAt: number;
}

export default function LeavesManager() {
  const [items, setItems] = useState<LeaveRequest[]>([]);
  const [filter, setFilter] = useState<string>('');

  useEffect(() => {
    return onSnapshot(query(collection(db, 'teacher_leaves'), orderBy('createdAt', 'desc')), snap => {
      const arr: LeaveRequest[] = [];
      snap.forEach(d => arr.push({ id: d.id, ...(d.data() as any) }));
      setItems(arr);
    });
  }, []);

  const teachers = useMemo(() => Array.from(new Set(items.map(i => i.teacherName))).filter(Boolean).sort(), [items]);
  const filtered = items.filter(i => !filter || i.teacherName === filter);

  const approve = async (l: LeaveRequest) => {
    const note = prompt('หมายเหตุ (ถ้ามี):') || '';
    try { await setDoc(doc(db, 'teacher_leaves', l.id), { ...l, status: 'อนุมัติ', approverNote: note }); }
    catch (e: any) { alert('❌ ' + (e?.message || e)); }
  };
  const reject = async (l: LeaveRequest) => {
    const note = prompt('เหตุผลที่ไม่อนุมัติ:') || '';
    try { await setDoc(doc(db, 'teacher_leaves', l.id), { ...l, status: 'ไม่อนุมัติ', approverNote: note }); }
    catch (e: any) { alert('❌ ' + (e?.message || e)); }
  };
  const del = async (l: LeaveRequest) => {
    if (!confirm(`ลบใบลาของ ${l.teacherName}?`)) return;
    try { await deleteDoc(doc(db, 'teacher_leaves', l.id)); }
    catch (e: any) { alert('❌ ' + (e?.message || e)); }
  };

  const exportCsv = () => {
    const rows = [['วันที่ขอ', 'ชื่อครู', 'ประเภท', 'เริ่ม', 'สิ้นสุด', 'จำนวนวัน', 'เหตุผล', 'ผู้สอนแทน', 'สถานะ', 'หมายเหตุ']];
    filtered.forEach(l => rows.push([
      new Date(l.createdAt).toLocaleDateString('th-TH'),
      l.teacherName, l.type, l.startDate, l.endDate, String(l.days),
      l.reason, l.substitute || '', l.status, l.approverNote || '',
    ]));
    const csv = '﻿' + rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'ใบลา.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const pending = items.filter(i => i.status === 'รออนุมัติ').length;

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14, alignItems: 'center' }}>
        <h6 style={{ margin: 0, fontWeight: 800, flex: 1 }}>📝 ใบลาครูทั้งหมด ({items.length})</h6>
        <select value={filter} onChange={e => setFilter(e.target.value)} style={inp}>
          <option value="">— ทุกครู —</option>
          {teachers.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <button onClick={exportCsv} style={btnSecondary}><Download size={14} /> CSV</button>
      </div>

      {pending > 0 && (
        <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', color: '#92400E', padding: '10px 14px', borderRadius: 10, marginBottom: 14, fontWeight: 700 }}>
          ⚠️ มีใบลารออนุมัติ <b>{pending}</b> ใบ
        </div>
      )}

      {filtered.length === 0 ? (
        <Empty msg="ยังไม่มีใบลา" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(l => {
            const sc = l.status === 'อนุมัติ' ? '#10B981' : l.status === 'ไม่อนุมัติ' ? '#EF4444' : '#F59E0B';
            return (
              <div key={l.id} style={{ background: 'white', borderRadius: 10, padding: '12px 14px', borderLeft: `5px solid ${sc}` }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ background: sc + '22', color: sc, padding: '2px 10px', borderRadius: 999, fontSize: '0.78rem', fontWeight: 800 }}>{l.status}</span>
                  <span style={{ background: '#FFEDD5', color: '#7C2D12', padding: '2px 10px', borderRadius: 999, fontSize: '0.78rem', fontWeight: 700 }}>{l.type}</span>
                  <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#94A3B8' }}>{new Date(l.createdAt).toLocaleString('th-TH')}</span>
                </div>
                <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{l.teacherName} <span style={{ color: '#64748B', fontSize: '0.85rem', fontWeight: 400 }}>({l.position || '-'})</span></div>
                <div style={{ fontSize: '0.85rem', color: '#475569', margin: '4px 0' }}>
                  📅 {l.startDate} → {l.endDate} <b>({l.days} วัน)</b> · 📞 {l.contact || '-'} · ผู้สอนแทน: {l.substitute || '-'}
                </div>
                <div style={{ fontSize: '0.85rem', background: '#F8FAFC', padding: '6px 10px', borderRadius: 6 }}>{l.reason}</div>
                {l.approverNote && <div style={{ fontSize: '0.78rem', color: '#92400E', marginTop: 6 }}>💬 {l.approverNote}</div>}
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  {l.status === 'รออนุมัติ' && (
                    <>
                      <button onClick={() => approve(l)} style={{ ...btnSm, background: '#10B981', color: 'white' }}><CheckCircle2 size={12} /> อนุมัติ</button>
                      <button onClick={() => reject(l)} style={{ ...btnSm, background: '#EF4444', color: 'white' }}><XCircle size={12} /> ไม่อนุมัติ</button>
                    </>
                  )}
                  <button onClick={() => del(l)} style={{ ...btnSm, color: '#DC2626', marginLeft: 'auto' }}><Trash2 size={12} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div style={{ background: 'white', padding: '3rem', textAlign: 'center', color: '#94A3B8', borderRadius: 12 }}>{msg}</div>;
}
const inp: React.CSSProperties = { padding: '8px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: '0.85rem', minWidth: 160 };
const btnSecondary: React.CSSProperties = { background: 'white', color: '#475569', border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 14px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const btnSm: React.CSSProperties = { background: '#F1F5F9', border: 'none', borderRadius: 6, padding: '6px 10px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, color: '#475569' };
