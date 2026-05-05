import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Check, X as XIcon, Clock, Save, Download, ChevronLeft, LogOut, Users } from 'lucide-react';
import type { Club, ClubAttendanceDoc, AttStatus } from '../data/clubs';
import { useTeacherAuth } from '../utils/teacherAuth';
import TeacherLoginGate from '../components/TeacherLoginGate';

const BRAND = '#FF6A01';
const STATUS_COLORS: Record<AttStatus, string> = { present: BRAND, absent: '#EF4444', leave: '#F59E0B' };
const STATUS_LABELS: Record<AttStatus, string> = { present: 'มา', absent: 'ขาด', leave: 'ลา' };

export default function ClubAttendancePage() {
  const auth = useTeacherAuth();
  if (!auth.authed) return <TeacherLoginGate title="🎯 เช็คชื่อชุมนุม / กิจกรรม / ลูกเสือ" />;
  return <App userName={auth.name} onLogout={auth.logout} />;
}

function App({ userName, onLogout }: { userName: string; onLogout: () => void }) {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [clubId, setClubId] = useState('');
  const [date, setDate] = useState(todayStr());
  const [records, setRecords] = useState<ClubAttendanceDoc['records']>({});
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    return onSnapshot(collection(db, 'clubs'), snap => {
      const arr: Club[] = [];
      snap.forEach(d => arr.push({ id: d.id, ...(d.data() as any) }));
      arr.sort((a, b) => a.name.localeCompare(b.name, 'th'));
      setClubs(arr);
    });
  }, []);

  useEffect(() => {
    if (!clubId && clubs.length) setClubId(clubs[0].id);
  }, [clubs]);

  useEffect(() => {
    if (!clubId) return;
    return onSnapshot(doc(db, 'club_attendance', `${clubId}_${date}`), snap => {
      if (snap.exists()) setRecords((snap.data() as ClubAttendanceDoc).records || {});
      else setRecords({});
    });
  }, [clubId, date]);

  const currentClub = clubs.find(c => c.id === clubId);
  const members = currentClub?.members || [];

  const counts = useMemo(() => {
    const c = { present: 0, absent: 0, leave: 0, untracked: 0 };
    members.forEach(m => {
      const st = records[m.studentId]?.status;
      if (st) c[st]++; else c.untracked++;
    });
    return c;
  }, [records, members]);

  const setStatus = (sid: string, status: AttStatus) => {
    setRecords(r => ({ ...r, [sid]: { ...(r[sid] || {}), status } }));
  };
  const setNote = (sid: string, note: string) => {
    setRecords(r => ({ ...r, [sid]: { ...(r[sid] || { status: 'present' }), note } }));
  };
  const markAll = (status: AttStatus) => {
    const r: ClubAttendanceDoc['records'] = {};
    members.forEach(m => {
      const note = records[m.studentId]?.note;
      r[m.studentId] = note ? { status, note } : { status };
    });
    setRecords(r);
  };
  const clearAll = () => setRecords({});

  const cleanRecords = (recs: ClubAttendanceDoc['records']) => {
    const out: ClubAttendanceDoc['records'] = {};
    for (const [k, v] of Object.entries(recs)) {
      const item: any = { status: v.status };
      if (v.note) item.note = v.note;
      out[k] = item;
    }
    return out;
  };

  const save = async () => {
    if (!clubId) return;
    setSaving(true);
    try {
      await setDoc(doc(db, 'club_attendance', `${clubId}_${date}`), {
        clubId, date, records: cleanRecords(records), updatedAt: Date.now(),
      });
      setSavedAt(new Date());
    } catch (e: any) { alert('❌ ' + (e?.message || e)); }
    setSaving(false);
  };

  const exportCsv = () => {
    if (!currentClub) return;
    const rows = [['ที่', 'รหัส', 'ชื่อ-สกุล', 'ชั้น', 'สถานะ', 'หมายเหตุ']];
    members.forEach((m, i) => {
      const r = records[m.studentId];
      rows.push([
        String(i + 1), m.code, m.name, m.classLabel,
        r ? STATUS_LABELS[r.status] : '-',
        r?.note || '',
      ]);
    });
    const csv = '﻿' + rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `เช็คชื่อ_${currentClub.name}_${date}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#FFF7ED' }}>
      <header style={{ background: 'linear-gradient(135deg,#FF6A01,#FB923C)', color: 'white', padding: '1.2rem 1.25rem' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Link to="/" style={lnk}><ChevronLeft size={16} />หน้าหลัก</Link>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 900 }}>🎯 เช็คชื่อชุมนุม / กิจกรรม / ลูกเสือ</div>
            <div style={{ fontSize: '0.78rem', opacity: 0.9 }}>โรงเรียนบ้านคลองมดแดง · {userName}</div>
          </div>
          <button onClick={onLogout} style={btnLogout}><LogOut size={12} />ออกจากระบบ</button>
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '1.25rem' }}>
        {/* Club + date pickers */}
        <div style={{ background: 'white', borderRadius: 12, padding: '1rem', marginBottom: 14,
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 10 }}>
          <div>
            <label style={lbl}>เลือกชุมนุม / กิจกรรม</label>
            {clubs.length === 0 ? (
              <div style={{ padding: '8px 12px', background: '#FEF3C7', borderRadius: 8, color: '#92400E', fontSize: '0.85rem' }}>
                ⚠️ ยังไม่มีชุมนุม — สร้างที่หน้า Admin → "ชุมนุม-กิจกรรม" ก่อน
              </div>
            ) : (
              <select value={clubId} onChange={e => setClubId(e.target.value)} style={inp}>
                {clubs.map(c => <option key={c.id} value={c.id}>{c.type} · {c.name} ({c.members.length} คน)</option>)}
              </select>
            )}
          </div>
          <div>
            <label style={lbl}>วันที่เช็คชื่อ</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inp} />
            <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: 4 }}>{fmtThai(date)}</div>
          </div>
        </div>

        {!currentClub ? null : (
          <>
            <div style={{ background: 'white', borderRadius: 12, padding: '12px 14px', marginBottom: 12 }}>
              <div style={{ fontSize: '0.78rem', color: '#7C2D12', fontWeight: 700, letterSpacing: 1 }}>
                {currentClub.type}
              </div>
              <div style={{ fontWeight: 900, fontSize: '1.1rem', color: '#0F172A' }}>{currentClub.name}</div>
              <div style={{ fontSize: '0.85rem', color: '#64748B' }}>
                👨‍🏫 ครูที่ปรึกษา: <b>{currentClub.advisor}</b> · <Users size={12} style={{ verticalAlign: 'middle' }} /> {members.length} คน
              </div>
              {currentClub.description && <div style={{ fontSize: '0.85rem', color: '#475569', marginTop: 4 }}>{currentClub.description}</div>}
            </div>

            {/* Quick actions */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <button onClick={() => markAll('present')} style={{ ...quickBtn, background: BRAND }}>✓ มาทั้งหมด</button>
              <button onClick={clearAll} style={{ ...quickBtn, background: '#EF4444' }}>↺ ล้างทั้งหมด</button>
              <button onClick={save} disabled={saving} style={{ ...quickBtn, background: '#0F172A', marginLeft: 'auto' }}>
                <Save size={14} style={{ marginRight: 4 }} />{saving ? 'กำลังบันทึก…' : 'บันทึกข้อมูล'}
              </button>
              <button onClick={exportCsv} style={{ ...quickBtn, background: '#10B981' }}>
                <Download size={14} style={{ marginRight: 4 }} />CSV
              </button>
              {savedAt && <span style={{ fontSize: '0.72rem', color: BRAND, fontWeight: 700 }}>✓ {savedAt.toLocaleTimeString('th-TH')}</span>}
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 14 }}>
              <Stat label="มา" value={counts.present} color={STATUS_COLORS.present} />
              <Stat label="ขาด" value={counts.absent} color={STATUS_COLORS.absent} />
              <Stat label="ลา" value={counts.leave} color={STATUS_COLORS.leave} />
              <Stat label="ยังไม่เช็ค" value={counts.untracked} color="#94A3B8" />
            </div>

            {/* Member list */}
            {members.length === 0 ? (
              <div style={{ background: 'white', padding: '3rem', textAlign: 'center', color: '#94A3B8', borderRadius: 12 }}>
                ชุมนุมนี้ยังไม่มีสมาชิก — เพิ่มสมาชิกที่หน้า Admin
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {members.map((m, i) => {
                  const r = records[m.studentId];
                  const st = r?.status;
                  return (
                    <div key={m.studentId} style={{
                      background: 'white', borderRadius: 12, padding: '12px 14px',
                      display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                      borderLeft: st ? `4px solid ${STATUS_COLORS[st]}` : '4px solid #E2E8F0',
                    }}>
                      <span style={{ fontWeight: 800, color: '#94A3B8', minWidth: 24 }}>{i + 1}</span>
                      <div style={{ flex: 1, minWidth: 180 }}>
                        <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>{m.code} · {m.classLabel}</div>
                        <div style={{ fontWeight: 700, color: '#0F172A' }}>{m.name}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {(['present', 'absent', 'leave'] as AttStatus[]).map(status => (
                          <button key={status} onClick={() => setStatus(m.studentId, status)} style={{
                            padding: '8px 12px', borderRadius: 10, border: 'none', cursor: 'pointer',
                            fontWeight: 800, fontSize: '0.78rem',
                            background: st === status ? STATUS_COLORS[status] : '#F1F5F9',
                            color: st === status ? 'white' : '#64748B',
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                          }}>
                            {status === 'present' ? <Check size={12} /> : status === 'absent' ? <XIcon size={12} /> : <Clock size={12} />}
                            {STATUS_LABELS[status]}
                          </button>
                        ))}
                      </div>
                      <input placeholder="หมายเหตุ..." value={r?.note || ''}
                        onChange={e => setNote(m.studentId, e.target.value)}
                        style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #E2E8F0', fontSize: '0.78rem', maxWidth: 180 }} />
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const fmtThai = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']; return `${d} ${months[m - 1]} ${y + 543}`; };

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return <div style={{ background: 'white', padding: 10, borderRadius: 10, textAlign: 'center', borderTop: `3px solid ${color}` }}>
    <div style={{ fontSize: '1.5rem', fontWeight: 900, color }}>{value}</div>
    <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700 }}>{label}</div>
  </div>;
}

const lnk: React.CSSProperties = { color: 'white', display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontSize: '0.85rem', opacity: 0.9 };
const inp: React.CSSProperties = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: '0.9rem' };
const lbl: React.CSSProperties = { display: 'block', fontSize: '0.78rem', color: '#64748B', marginBottom: 4, fontWeight: 700 };
const btnLogout: React.CSSProperties = { background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.4)', padding: '6px 12px', borderRadius: 8, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 };
const quickBtn: React.CSSProperties = { padding: '8px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: '0.8rem', color: 'white', display: 'inline-flex', alignItems: 'center' };
