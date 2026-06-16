import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, doc, onSnapshot, setDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { ChevronLeft, LogOut, Plus, Trash2, Edit2, Save, X } from 'lucide-react';
import { useTeacherAuth, type Role } from '../utils/teacherAuth';
import TeacherLoginGate from '../components/TeacherLoginGate';

const BRAND = '#FF6A01';

interface LeaveRequest {
  id: string;
  teacherName: string;       // ผู้ขอลา
  position: string;          // ตำแหน่ง
  type: 'ลาป่วย' | 'ลากิจ' | 'ลาคลอด' | 'ลาพักผ่อน' | 'อื่น ๆ';
  startDate: string;         // YYYY-MM-DD
  endDate: string;
  days: number;
  reason: string;
  contact: string;
  substitute?: string;       // ผู้สอนแทน
  status: 'รออนุมัติ' | 'อนุมัติ' | 'ไม่อนุมัติ';
  approverNote?: string;
  createdAt: number;
  createdBy: string;
}

const TYPES: LeaveRequest['type'][] = ['ลาป่วย', 'ลากิจ', 'ลาคลอด', 'ลาพักผ่อน', 'อื่น ๆ'];

export default function TeacherLeavePage() {
  const auth = useTeacherAuth();
  if (!auth.authed) return <TeacherLoginGate title="📝 แบบฟอร์มลาออนไลน์ครู" />;
  return <App role={auth.role} userName={auth.name} onLogout={auth.logout} />;
}

function App({ role, userName, onLogout }: { role: Role; userName: string; onLogout: () => void }) {
  const [items, setItems] = useState<LeaveRequest[]>([]);
  const [editing, setEditing] = useState<LeaveRequest | null>(null);
  const isSuper = role === 'super' || role === 'admin';

  useEffect(() => {
    return onSnapshot(query(collection(db, 'teacher_leaves'), orderBy('createdAt', 'desc')), snap => {
      const arr: LeaveRequest[] = [];
      snap.forEach(d => arr.push({ id: d.id, ...(d.data() as any) }));
      setItems(arr);
    });
  }, []);

  const create = () => {
    const today = todayStr();
    setEditing({
      id: `leave_${Date.now()}`, teacherName: '', position: '', type: 'ลาป่วย',
      startDate: today, endDate: today, days: 1, reason: '', contact: '',
      substitute: '', status: 'รออนุมัติ', createdAt: Date.now(), createdBy: userName,
    });
  };

  const save = async (l: LeaveRequest) => {
    try {
      const days = computeDays(l.startDate, l.endDate);
      await setDoc(doc(db, 'teacher_leaves', l.id), { ...l, days });
      setEditing(null);
    } catch (e: any) { alert('❌ ' + (e?.message || e)); }
  };

  const updateStatus = async (l: LeaveRequest, status: LeaveRequest['status'], approverNote = '') => {
    try { await setDoc(doc(db, 'teacher_leaves', l.id), { ...l, status, approverNote }); }
    catch (e: any) { alert('❌ ' + (e?.message || e)); }
  };

  const del = async (l: LeaveRequest) => {
    if (!confirm(`ลบใบลาของ ${l.teacherName}?`)) return;
    try { await deleteDoc(doc(db, 'teacher_leaves', l.id)); }
    catch (e: any) { alert('❌ ' + (e?.message || e)); }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#FFF7ED' }}>
      <header style={{ background: 'linear-gradient(135deg,#FF6A01,#FB923C)', color: 'white', padding: '1.2rem 1.25rem' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Link to="/" style={lnk}><ChevronLeft size={16} />หน้าหลัก</Link>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 900 }}>📝 แบบฟอร์มลาออนไลน์ครู</div>
            <div style={{ fontSize: '0.78rem', opacity: 0.9 }}>โรงเรียนบ้านคลองมดแดง · {userName}</div>
          </div>
          {isSuper && <span style={superBadge}>👑 ผู้อนุมัติ</span>}
          <button onClick={onLogout} style={btnLogout}><LogOut size={12} />ออกจากระบบ</button>
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          <h6 style={{ margin: 0, flex: 1, fontWeight: 800, color: '#0F172A' }}>📋 ใบลาทั้งหมด ({items.length})</h6>
          <button onClick={create} style={btnPrimary}><Plus size={14} /> ขอลาใหม่</button>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 14 }}>
          <Stat label="รออนุมัติ" value={items.filter(i => i.status === 'รออนุมัติ').length} color="#F59E0B" />
          <Stat label="อนุมัติแล้ว" value={items.filter(i => i.status === 'อนุมัติ').length} color="#10B981" />
          <Stat label="ไม่อนุมัติ" value={items.filter(i => i.status === 'ไม่อนุมัติ').length} color="#EF4444" />
          <Stat label="รวมทั้งหมด" value={items.length} color="#0F172A" />
        </div>

        {items.length === 0 ? (
          <Empty msg="ยังไม่มีใบลา — กดปุ่ม 'ขอลาใหม่' เพื่อเริ่มต้น" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {items.map(l => <LeaveCard key={l.id} leave={l} isSuper={isSuper}
              onEdit={() => setEditing(l)} onDelete={() => del(l)} onUpdate={updateStatus} />)}
          </div>
        )}

        {editing && <Editor item={editing} onSave={save} onCancel={() => setEditing(null)} />}
      </main>
    </div>
  );
}

function LeaveCard({ leave, isSuper, onEdit, onDelete, onUpdate }: {
  leave: LeaveRequest; isSuper: boolean;
  onEdit: () => void; onDelete: () => void;
  onUpdate: (l: LeaveRequest, s: LeaveRequest['status'], note?: string) => void;
}) {
  const sc = leave.status === 'อนุมัติ' ? '#10B981' : leave.status === 'ไม่อนุมัติ' ? '#EF4444' : '#F59E0B';
  return (
    <div style={{ background: 'white', borderRadius: 12, padding: '14px 16px', borderLeft: `5px solid ${sc}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
        <span style={{ ...statusBadge, background: sc + '22', color: sc }}>{leave.status}</span>
        <span style={{ background: '#FFEDD5', color: '#7C2D12', padding: '2px 10px', borderRadius: 999, fontSize: '0.78rem', fontWeight: 700 }}>{leave.type}</span>
        <span style={{ fontSize: '0.75rem', color: '#94A3B8', marginLeft: 'auto' }}>
          {new Date(leave.createdAt).toLocaleString('th-TH')}
        </span>
      </div>
      <div style={{ fontWeight: 900, fontSize: '1rem', color: '#0F172A' }}>{leave.teacherName}</div>
      <div style={{ fontSize: '0.85rem', color: '#64748B', marginBottom: 8 }}>{leave.position} · ติดต่อ: {leave.contact || '-'}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 8, marginBottom: 8, fontSize: '0.85rem' }}>
        <div><b>ตั้งแต่:</b> {fmtThai(leave.startDate)}</div>
        <div><b>ถึง:</b> {fmtThai(leave.endDate)}</div>
        <div><b>จำนวน:</b> {leave.days} วัน</div>
        <div><b>ผู้สอนแทน:</b> {leave.substitute || '-'}</div>
      </div>
      <div style={{ background: '#F8FAFC', padding: '8px 12px', borderRadius: 8, fontSize: '0.85rem' }}>
        <b>เหตุผล:</b> {leave.reason}
      </div>
      {leave.approverNote && (
        <div style={{ marginTop: 8, background: '#FEF3C7', padding: '8px 12px', borderRadius: 8, fontSize: '0.85rem', color: '#92400E' }}>
          💬 <b>หมายเหตุผู้อนุมัติ:</b> {leave.approverNote}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
        <button onClick={onEdit} style={btnSm}><Edit2 size={12} /> แก้ไข</button>
        {isSuper && leave.status === 'รออนุมัติ' && (
          <>
            <button onClick={() => {
              const note = prompt('หมายเหตุ (ถ้ามี):') || '';
              onUpdate(leave, 'อนุมัติ', note);
            }} style={{ ...btnSm, background: '#10B981', color: 'white' }}>✓ อนุมัติ</button>
            <button onClick={() => {
              const note = prompt('เหตุผลที่ไม่อนุมัติ:') || '';
              onUpdate(leave, 'ไม่อนุมัติ', note);
            }} style={{ ...btnSm, background: '#EF4444', color: 'white' }}>✗ ไม่อนุมัติ</button>
          </>
        )}
        <button onClick={onDelete} style={{ ...btnSm, color: '#DC2626', marginLeft: 'auto' }}><Trash2 size={12} /></button>
      </div>
    </div>
  );
}

function Editor({ item, onSave, onCancel }: { item: LeaveRequest; onSave: (l: LeaveRequest) => void; onCancel: () => void }) {
  const [l, setL] = useState(item);
  const days = computeDays(l.startDate, l.endDate);
  return (
    <div onClick={onCancel} style={modalBg}>
      <div onClick={e => e.stopPropagation()} style={modalBox}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          <h5 style={{ margin: 0, fontWeight: 900, flex: 1 }}>✏️ แบบฟอร์มขอลา</h5>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={22} /></button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
          <div><label style={lbl}>ชื่อ-สกุล *</label><input value={l.teacherName} onChange={e => setL({ ...l, teacherName: e.target.value })} style={inp} /></div>
          <div><label style={lbl}>ตำแหน่ง</label><input value={l.position} onChange={e => setL({ ...l, position: e.target.value })} placeholder="เช่น ครู คศ.1" style={inp} /></div>
          <div><label style={lbl}>ประเภทการลา</label>
            <select value={l.type} onChange={e => setL({ ...l, type: e.target.value as any })} style={inp}>
              {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div><label style={lbl}>เบอร์ติดต่อ</label><input value={l.contact} onChange={e => setL({ ...l, contact: e.target.value })} style={inp} /></div>
          <div><label style={lbl}>วันที่เริ่มลา *</label><input type="date" value={l.startDate} onChange={e => setL({ ...l, startDate: e.target.value })} style={inp} /></div>
          <div><label style={lbl}>วันที่สิ้นสุด *</label><input type="date" value={l.endDate} onChange={e => setL({ ...l, endDate: e.target.value })} style={inp} /></div>
          <div style={{ gridColumn: '1 / -1', padding: 8, background: '#FFF7ED', borderRadius: 6, fontSize: '0.85rem', color: '#7C2D12', fontWeight: 700 }}>
            📅 จำนวนวันลา: <b>{days} วัน</b>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={lbl}>เหตุผลการลา *</label>
            <textarea value={l.reason} onChange={e => setL({ ...l, reason: e.target.value })} rows={3} style={{ ...inp, resize: 'vertical' }} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={lbl}>ครูผู้สอนแทน</label>
            <input value={l.substitute || ''} onChange={e => setL({ ...l, substitute: e.target.value })} placeholder="ชื่อครูผู้สอนแทนระหว่างลา" style={inp} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={btnSecondary}>ยกเลิก</button>
          <button onClick={() => onSave(l)} disabled={!l.teacherName || !l.reason}
            style={{ ...btnPrimary, opacity: (!l.teacherName || !l.reason) ? 0.4 : 1 }}>
            <Save size={14} /> ส่งใบลา
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── helpers + styles ─────────────────────────────
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const fmtThai = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']; return `${d} ${months[m - 1]} ${y + 543}`; };
const computeDays = (s: string, e: string) => { try { const a = new Date(s); const b = new Date(e); return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86400000) + 1); } catch { return 1; } };

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
const btnSecondary: React.CSSProperties = { background: 'white', color: '#475569', border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 14px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' };
const btnSm: React.CSSProperties = { background: '#F1F5F9', border: 'none', borderRadius: 6, padding: '6px 10px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, color: '#475569' };
const btnLogout: React.CSSProperties = { background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.4)', padding: '6px 12px', borderRadius: 8, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 };
const superBadge: React.CSSProperties = { background: 'rgba(255,255,255,0.25)', color: 'white', padding: '4px 10px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 800, border: '1px solid rgba(255,255,255,0.4)' };
const statusBadge: React.CSSProperties = { padding: '2px 10px', borderRadius: 999, fontSize: '0.78rem', fontWeight: 800 };
const modalBg: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' };
const modalBox: React.CSSProperties = { background: 'white', borderRadius: 16, maxWidth: 600, width: '100%', maxHeight: '90vh', overflow: 'auto', padding: '1.5rem' };
