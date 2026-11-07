// หน้ากำหนดวันเปิด-ปิดโรงเรียน
// ครูกดที่วันไหนก็สลับสถานะวันนั้นได้ ใช้แทนการเดาจาก "ไม่มีเช็คชื่อ = วันหยุด"
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { ChevronLeft, ChevronRight, LogOut, RotateCcw, CalendarDays } from 'lucide-react';
import { db } from '../firebase';
import { useTeacherAuth } from '../utils/teacherAuth';
import TeacherLoginGate from '../components/TeacherLoginGate';
import AdminOnly from '../components/AdminOnly';
import { toast } from '../components/GlobalToast';
import {
  SCHOOL_CALENDAR_COLLECTION,
  resolveSchoolDay,
  type SchoolDayOverride,
} from '../data/schoolCalendar';

const COLOR = '#0EA5E9';
const THAI_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const THAI_DAYS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

export default function SchoolCalendarPage() {
  const auth = useTeacherAuth();
  if (!auth.authed) {
    return <TeacherLoginGate title="🗓️ ปฏิทินเปิด-ปิดโรงเรียน" subtitle="กำหนดวันเรียนชดเชยและวันปิดกรณีพิเศษ" />;
  }
  return <AdminOnly role={auth.role} title="ปฏิทินเปิด-ปิดโรงเรียน"><App userName={auth.name} onLogout={auth.logout} /></AdminOnly>;
}

function App({ userName, onLogout }: { userName: string; onLogout: () => void }) {
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const [overrides, setOverrides] = useState<Record<string, SchoolDayOverride>>({});
  const [holidays, setHolidays] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');

  useEffect(() => {
    return onSnapshot(collection(db, SCHOOL_CALENDAR_COLLECTION), snap => {
      const map: Record<string, SchoolDayOverride> = {};
      snap.forEach(d => { map[d.id] = { date: d.id, ...(d.data() as Omit<SchoolDayOverride, 'date'>) }; });
      setOverrides(map);
    });
  }, []);

  useEffect(() => {
    return onSnapshot(collection(db, 'activities'), snap => {
      const map: Record<string, string> = {};
      snap.forEach(d => {
        const a = d.data() as { isHoliday?: boolean; date?: string; title?: string };
        if (a.isHoliday && a.date) map[a.date] = a.title || 'วันหยุด';
      });
      setHolidays(map);
    });
  }, []);

  const [year, mon] = month.split('-').map(Number);
  const daysInMonth = new Date(year, mon, 0).getDate();
  const firstDow = new Date(year, mon - 1, 1).getDay();

  const stats = useMemo(() => {
    let open = 0, closed = 0, special = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${month}-${String(d).padStart(2, '0')}`;
      const r = resolveSchoolDay(date, overrides, holidays);
      if (r.open) open++; else closed++;
      if (r.reason === 'override') special++;
    }
    return { open, closed, special };
  }, [month, overrides, holidays, daysInMonth]);

  const toggle = async (date: string) => {
    const current = resolveSchoolDay(date, overrides, holidays);
    setBusy(date);
    try {
      if (overrides[date]) {
        // มีการกำหนดไว้แล้ว → กดซ้ำเพื่อคืนค่าเป็นปกติ
        await deleteDoc(doc(db, SCHOOL_CALENDAR_COLLECTION, date));
        toast.info(`คืนค่า ${thaiDate(date)} เป็นค่าปกติแล้ว`);
      } else {
        const payload: Omit<SchoolDayOverride, 'date'> = {
          open: !current.open,
          note: !current.open ? 'เปิดเรียนกรณีพิเศษ' : 'ปิดเรียนกรณีพิเศษ',
          teacherName: userName,
          updatedAt: Date.now(),
        };
        await setDoc(doc(db, SCHOOL_CALENDAR_COLLECTION, date), payload);
        toast.success(`${thaiDate(date)} → ${payload.open ? 'เปิดเรียน' : 'ปิดเรียน'}`);
      }
    } catch (error: any) {
      toast.error('บันทึกไม่สำเร็จ: ' + (error?.message || error));
    } finally {
      setBusy('');
    }
  };

  const shiftMonth = (delta: number) => {
    const d = new Date(year, mon - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F0F9FF' }}>
      <header style={{ background: `linear-gradient(135deg,${COLOR},#38BDF8)`, color: 'white', padding: '1.2rem 1.25rem' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Link to="/teacher-hub" style={lnk}><ChevronLeft size={16} />Hub</Link>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 900 }}>🗓️ ปฏิทินเปิด-ปิดโรงเรียน</div>
            <div style={{ fontSize: '0.78rem', opacity: 0.9 }}>ระบบเช็คชื่อและแบบฟอร์มทุกใบใช้ปฏิทินนี้ · {userName}</div>
          </div>
          <button onClick={onLogout} style={btnGhost}><LogOut size={12} />ออก</button>
        </div>
      </header>

      <main style={{ maxWidth: 1000, margin: '0 auto', padding: '1.25rem' }}>
        <div style={{
          background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 12,
          padding: '12px 16px', marginBottom: 16, color: '#1E40AF', fontSize: '0.86rem', lineHeight: 1.7,
        }}>
          <b>กดที่วันไหนเพื่อสลับเปิด/ปิดวันนั้น</b> — กดซ้ำอีกครั้งเพื่อคืนค่าเป็นปกติ<br />
          ใช้เมื่อ <b>เปิดเรียนชดเชยวันเสาร์</b> หรือ <b>ปิดเรียนกะทันหัน</b> ระบบจะได้ไม่แจ้งว่าลืมเช็คชื่อ
          และแบบฟอร์มรายเดือนจะระบายช่องให้ถูกต้อง
        </div>

        <div style={{ background: 'white', borderRadius: 14, padding: '1.1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            <button onClick={() => shiftMonth(-1)} style={navBtn}><ChevronLeft size={16} /></button>
            <div style={{ fontWeight: 900, fontSize: '1.1rem', minWidth: 180, textAlign: 'center' }}>
              {THAI_MONTHS[mon - 1]} {year + 543}
            </div>
            <button onClick={() => shiftMonth(1)} style={navBtn}><ChevronRight size={16} /></button>
            <div style={{ flex: 1 }} />
            <div style={{ fontSize: '0.82rem', color: '#475569' }}>
              เปิดเรียน <b style={{ color: '#059669' }}>{stats.open}</b> วัน ·
              ปิด <b style={{ color: '#DC2626' }}>{stats.closed}</b> วัน
              {stats.special > 0 && <> · กำหนดเอง <b style={{ color: '#1D4ED8' }}>{stats.special}</b></>}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6, marginBottom: 6 }}>
            {THAI_DAYS.map(d => (
              <div key={d} style={{ textAlign: 'center', fontWeight: 800, fontSize: '0.78rem', color: '#64748B', padding: '4px 0' }}>{d}</div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6 }}>
            {Array.from({ length: firstDow }).map((_, i) => <div key={`pad${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const date = `${month}-${String(day).padStart(2, '0')}`;
              const r = resolveSchoolDay(date, overrides, holidays);
              const isOverride = r.reason === 'override';

              let bg = 'white', fg = '#0F172A', border = '1px solid #E2E8F0';
              if (isOverride && r.open) { bg = '#DBEAFE'; fg = '#1E40AF'; border = '2px solid #3B82F6'; }
              else if (isOverride && !r.open) { bg = '#FEE2E2'; fg = '#991B1B'; border = '2px solid #EF4444'; }
              else if (r.reason === 'holiday') { bg = '#FED7AA'; fg = '#7C2D12'; }
              else if (r.reason === 'weekend') { bg = '#FEF2F2'; fg = '#FCA5A5'; }

              return (
                <button
                  key={date}
                  onClick={() => toggle(date)}
                  disabled={busy === date}
                  title={r.label}
                  style={{
                    aspectRatio: '1', borderRadius: 10, border, background: bg, color: fg,
                    cursor: 'pointer', fontWeight: 800, fontSize: '0.9rem',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: 2, padding: 2, opacity: busy === date ? 0.5 : 1,
                  }}
                >
                  <span>{day}</span>
                  {isOverride && (
                    <span style={{ fontSize: '0.55rem', fontWeight: 700, lineHeight: 1 }}>
                      {r.open ? 'เปิด' : 'ปิด'}
                    </span>
                  )}
                  {r.reason === 'holiday' && (
                    <span style={{ fontSize: '0.5rem', lineHeight: 1, opacity: 0.85 }}>หยุด</span>
                  )}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 16, fontSize: '0.78rem', color: '#475569' }}>
            <Legend bg="white" border="1px solid #E2E8F0" text="วันเรียนปกติ" />
            <Legend bg="#FEF2F2" text="เสาร์-อาทิตย์" />
            <Legend bg="#FED7AA" text="วันหยุด (จากปฏิทินกิจกรรม)" />
            <Legend bg="#DBEAFE" border="2px solid #3B82F6" text="เปิดเรียนกรณีพิเศษ" />
            <Legend bg="#FEE2E2" border="2px solid #EF4444" text="ปิดเรียนกรณีพิเศษ" />
          </div>
        </div>

        {Object.keys(overrides).filter(d => d.startsWith(month)).length > 0 && (
          <div style={{ background: 'white', borderRadius: 14, padding: '1.1rem', marginTop: 14 }}>
            <div style={{ fontWeight: 900, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
              <CalendarDays size={16} color={COLOR} />วันที่กำหนดเองในเดือนนี้
            </div>
            {Object.values(overrides)
              .filter(o => o.date.startsWith(month))
              .sort((a, b) => a.date.localeCompare(b.date))
              .map(o => (
                <div key={o.date} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
                  borderRadius: 9, background: o.open ? '#EFF6FF' : '#FEF2F2', marginBottom: 6,
                }}>
                  <span style={{ fontWeight: 800, minWidth: 120 }}>{thaiDate(o.date)}</span>
                  <span style={{
                    padding: '2px 10px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 800,
                    background: o.open ? '#3B82F6' : '#EF4444', color: 'white',
                  }}>
                    {o.open ? 'เปิดเรียน' : 'ปิดเรียน'}
                  </span>
                  <span style={{ flex: 1, fontSize: '0.82rem', color: '#475569' }}>{o.note}</span>
                  <button onClick={() => toggle(o.date)} style={{
                    border: 'none', background: 'transparent', cursor: 'pointer',
                    color: '#64748B', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.78rem',
                  }}>
                    <RotateCcw size={13} />คืนค่า
                  </button>
                </div>
              ))}
          </div>
        )}
      </main>
    </div>
  );
}

function Legend({ bg, border, text }: { bg: string; border?: string; text: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 16, height: 16, borderRadius: 5, background: bg, border: border || '1px solid #E2E8F0' }} />
      {text}
    </span>
  );
}

function thaiDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  return `${d} ${months[m - 1]} ${y + 543}`;
}

const lnk: React.CSSProperties = { color: 'white', display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontSize: '0.85rem', opacity: 0.9 };
const btnGhost: React.CSSProperties = { background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.4)', padding: '6px 12px', borderRadius: 8, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 };
const navBtn: React.CSSProperties = { width: 34, height: 34, borderRadius: 9, border: '1px solid #E2E8F0', background: 'white', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' };
