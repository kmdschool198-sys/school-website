import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, LogOut, Pin, PinOff } from 'lucide-react';
import { useTeacherAuth } from '../utils/teacherAuth';
import TeacherLoginGate from '../components/TeacherLoginGate';

interface AppCard {
  id: string;
  to: string;
  title: string;
  icon: string;
  search: string;
  bg: string;
}

const PIN_STORAGE_KEY = 'kmd_teacher_hub_pinned_apps_v1';

const STUDENT_APPS: AppCard[] = [
  { id: 'class-dashboard', to: '/class-dashboard', title: 'แดชบอร์ดรายชั้นเรียน', icon: '📊', search: 'ภาพรวมทั้งชั้น', bg: '#FFEDD5' },
  { id: 'attendance', to: '/attendance', title: 'ระบบเช็คชื่อนักเรียน', icon: '✅', search: 'เช็คนักเรียน', bg: '#FCE7F3' },
  { id: 'manage-roster', to: '/manage-roster', title: 'จัดการรายชื่อนักเรียน', icon: '👥', search: 'รายชื่อ-CSV', bg: '#E9D5FF' },
  { id: 'club-attendance', to: '/club-attendance', title: 'เช็คชื่อชุมนุม-ลูกเสือ', icon: '🎯', search: 'ชุมนุม-ลูกเสือ', bg: '#DCFCE7' },
  { id: 'manage-clubs', to: '/manage-clubs', title: 'จัดการชุมนุม-สมาชิก', icon: '⚙️', search: 'สร้างชุมนุม', bg: '#D1FAE5' },
  { id: 'milk-report', to: '/milk-report', title: 'รายงานการดื่มนม', icon: '🥛', search: 'ดื่มนม', bg: '#DBEAFE' },
  { id: 'brush-log', to: '/brush-log', title: 'บันทึกการแปรงฟัน', icon: '🪥', search: 'แปรงฟัน', bg: '#CFFAFE' },
  { id: 'saving', to: '/saving', title: 'ระบบออมเงิน', icon: '💰', search: 'ออมเงิน', bg: '#FCE7F3' },
  { id: 'body-metrics', to: '/body-metrics', title: 'น้ำหนัก-ส่วนสูง-BMI', icon: '⚖️', search: 'น้ำหนักส่วนสูง', bg: '#FCE7F3' },
  { id: 'school-stats-report', to: '/school-stats-report', title: 'รายงานสรุปสถิติประจำเดือน', icon: '📈', search: 'สถิติประจำเดือน', bg: '#FFF7ED' },
];

export default function TeacherHubPage() {
  const auth = useTeacherAuth();
  if (!auth.authed) {
    return <TeacherLoginGate title="🏫 ศูนย์รวมระบบครู" subtitle="เข้าสู่ระบบครั้งเดียว ใช้ได้ทุกระบบ" />;
  }
  return <Hub userName={auth.name} onLogout={auth.logout} />;
}

function Hub({ userName, onLogout }: { userName: string; onLogout: () => void }) {
  const [pinnedIds, setPinnedIds] = useState<string[]>(readPinnedIds);

  useEffect(() => {
    localStorage.setItem(PIN_STORAGE_KEY, JSON.stringify(pinnedIds));
  }, [pinnedIds]);

  const apps = useMemo(() => {
    return STUDENT_APPS
      .map((app, index) => ({ app, index }))
      .sort((a, b) => {
        const pinA = pinnedIds.indexOf(a.app.id);
        const pinB = pinnedIds.indexOf(b.app.id);
        const aPinned = pinA !== -1;
        const bPinned = pinB !== -1;
        if (aPinned && bPinned) return pinA - pinB;
        if (aPinned) return -1;
        if (bPinned) return 1;
        return a.index - b.index;
      })
      .map(item => item.app);
  }, [pinnedIds]);

  const togglePin = (id: string) => {
    setPinnedIds(current => current.includes(id)
      ? current.filter(item => item !== id)
      : [id, ...current]);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg,#FFF7ED 0%,#FFFFFF 100%)' }}>
      <header style={{ background: 'linear-gradient(135deg,#FF6A01,#FB923C)', color: 'white', padding: '1.5rem 1.25rem 2rem', boxShadow: '0 8px 24px rgba(255,106,1,0.25)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
            <Link to="/" style={lnk}><ChevronLeft size={16} />หน้าหลัก</Link>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: '0.78rem', opacity: 0.9, fontWeight: 700, letterSpacing: 2 }}>TEACHER HUB</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>🏫 ศูนย์รวมระบบครู</div>
              <div style={{ fontSize: '0.85rem', opacity: 0.95 }}>โรงเรียนบ้านคลองมดแดง · ยินดีต้อนรับ <b>{userName}</b></div>
            </div>
            <button onClick={onLogout} style={btnLogout}><LogOut size={12} />ออกจากระบบ</button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: '-1.5rem auto 3rem', padding: '0 1.25rem' }}>
        <SectionHeader
          icon="👨‍🎓"
          title="ระบบที่ทำงานกับนักเรียน"
          subtitle="เช็คชื่อ / ชุมนุม / นม-แปรงฟัน / น้ำหนัก / ออมเงิน / รายงานสถิติ"
          color="#0EA5E9"
        />
        <div style={grid}>
          {apps.map(app => (
            <AppCardView
              key={app.id}
              app={app}
              pinned={pinnedIds.includes(app.id)}
              onTogglePin={togglePin}
            />
          ))}
        </div>

        <div style={{ marginTop: 30, padding: '14px 18px', background: '#FFF7ED', borderLeft: '4px solid #FF6A01', borderRadius: 10, color: '#7C2D12', fontSize: '0.85rem' }}>
          💡 <b>เคล็ดลับ:</b> กดหมุดเพื่อพินงานที่ใช้บ่อยขึ้นด้านหน้า และเข้าแต่ละระบบเพื่อดาวน์โหลด CSV รายเดือน/รายปี
        </div>
      </main>
    </div>
  );
}

function SectionHeader({ icon, title, subtitle, color }: { icon: string; title: string; subtitle: string; color: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', marginBottom: 12, marginTop: 18,
      background: 'white', borderRadius: 14, borderLeft: `5px solid ${color}`,
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
    }}>
      <span style={{ fontSize: '2rem' }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 900, color: '#0F172A', fontSize: '1.05rem' }}>{title}</div>
        <div style={{ fontSize: '0.78rem', color: '#64748B' }}>{subtitle}</div>
      </div>
    </div>
  );
}

function AppCardView({
  app,
  pinned,
  onTogglePin,
}: {
  app: AppCard;
  pinned: boolean;
  onTogglePin: (id: string) => void;
}) {
  return (
    <div
      style={{
        background: 'white',
        borderRadius: 18,
        overflow: 'hidden',
        boxShadow: pinned ? '0 12px 30px rgba(255,106,1,0.18)' : '0 4px 14px rgba(0,0,0,0.06)',
        border: pinned ? '2px solid #FF6A01' : '1px solid rgba(0,0,0,0.02)',
        transition: 'transform 0.2s, box-shadow 0.2s',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
      onMouseOver={e => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = '0 14px 28px rgba(0,0,0,0.12)';
      }}
      onMouseOut={e => {
        e.currentTarget.style.transform = '';
        e.currentTarget.style.boxShadow = pinned ? '0 12px 30px rgba(255,106,1,0.18)' : '0 4px 14px rgba(0,0,0,0.06)';
      }}
    >
      <div style={{
        background: app.bg,
        padding: '1.25rem 1rem 1rem',
        minHeight: 150,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}>
        <span style={{ position: 'absolute', top: 8, left: 8, fontSize: '0.85rem' }}>✨</span>
        <div style={cardActions}>
          <button
            type="button"
            onClick={() => onTogglePin(app.id)}
            title={pinned ? 'เลิกพินงานนี้' : 'พินงานนี้'}
            aria-label={pinned ? 'เลิกพินงานนี้' : 'พินงานนี้'}
            style={{ ...iconButton, background: pinned ? '#FF6A01' : 'rgba(255,255,255,0.92)', color: pinned ? 'white' : '#0F172A' }}
          >
            {pinned ? <PinOff size={14} /> : <Pin size={14} />}
          </button>
        </div>
        <Link to={app.to} style={cardLink}>
          <div style={{ fontSize: '3.5rem', lineHeight: 1 }}>{app.icon}</div>
        </Link>
      </div>
      <Link to={app.to} style={titleLink}>
        <div style={{ fontWeight: 900, color: '#0F172A', textAlign: 'center', fontSize: '0.92rem', lineHeight: 1.3 }}>
          {app.title}
        </div>
      </Link>
    </div>
  );
}

function readPinnedIds() {
  try {
    const raw = localStorage.getItem(PIN_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

const grid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
  gap: 14,
};

const lnk: CSSProperties = { color: 'white', display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontSize: '0.85rem', opacity: 0.9 };
const btnLogout: CSSProperties = { background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.4)', padding: '6px 12px', borderRadius: 8, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 };
const cardLink: CSSProperties = { color: 'inherit', textDecoration: 'none', width: '100%', minHeight: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' };
const titleLink: CSSProperties = { background: 'white', padding: '12px 14px', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' };
const cardActions: CSSProperties = { position: 'absolute', top: 8, right: 8, zIndex: 2, display: 'flex', gap: 6 };
const iconButton: CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: 999,
  border: '1px solid rgba(0,0,0,0.08)',
  background: 'rgba(255,255,255,0.92)',
  color: '#0F172A',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  boxShadow: '0 3px 10px rgba(15,23,42,0.08)',
};
