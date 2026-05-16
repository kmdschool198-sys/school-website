import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, LogOut, Search } from 'lucide-react';
import { useTeacherAuth } from '../utils/teacherAuth';
import TeacherLoginGate from '../components/TeacherLoginGate';

interface AppCard {
  to: string;
  title: string;
  icon: string;       // emoji
  search: string;     // text inside search box
  bg: string;         // pastel bg color
}

const APPS: AppCard[] = [
  // Row 1 — Logs
  { to: '/teacher-log/milk', title: 'บันทึกการดื่มนม', icon: '🥛', search: 'ดื่มนม', bg: '#F3E8FF' },
  { to: '/teacher-log/plc', title: 'บันทึก PLC', icon: '👥', search: 'ประชุม PLC', bg: '#A855F7' },
  { to: '/teacher-log/media', title: 'ระบบบันทึกการใช้สื่อ', icon: '📚', search: 'การใช้สื่อ', bg: '#FEF3C7' },
  { to: '/teacher-log/saving', title: 'ระบบออมเงิน', icon: '💰', search: 'ออมเงิน', bg: '#FCE7F3' },

  // Row 2 — Core teaching
  { to: '/teacher-training', title: 'ระบบเก็บเกียรติบัตรออนไลน์', icon: '🎖️', search: 'เกียรติบัตรครู', bg: '#DCFCE7' },
  { to: '/attendance', title: 'ระบบเช็คชื่อ', icon: '✅', search: 'เช็คนักเรียน', bg: '#FCE7F3' },
  { to: '/teacher-log/lesson-plan', title: 'ระบบส่งแผนการสอน', icon: '📋', search: 'ส่งแผนการสอน', bg: '#E2E8F0' },
  { to: '/attendance?tab=school', title: 'สถิติการมาเรียน', icon: '📈', search: 'สถิติรายวัน', bg: '#DBEAFE' },

  // Row 3 — Additional
  { to: '/teacher-log/remedial', title: 'ระบบบันทึก การสอนซ่อมเสริม', icon: '👨‍🏫', search: 'สอนซ่อมเสริม', bg: '#FCE7F3' },
  { to: '/teacher-log/project', title: 'ระบบรายงานโครงการ', icon: '📊', search: 'ติดตามโครงการ', bg: '#FCE7F3' },
  { to: '/teacher-log/body-metrics', title: 'ระบบบันทึกน้ำหนัก ส่วนสูง และค่า BMI นักเรียน', icon: '⚖️', search: 'น้ำหนักส่วนสูง', bg: '#FCE7F3' },
  { to: '/teacher-leave', title: 'แบบฟอร์มลาออนไลน์', icon: '📝', search: 'ลาออนไลน์', bg: '#FEF3C7' },

  // Row 4 — Activities + Results
  { to: '/club-attendance', title: 'เช็คชื่อชุมนุม/ลูกเสือ', icon: '🎯', search: 'ชุมนุม-ลูกเสือ', bg: '#DCFCE7' },
  { to: '/results', title: 'ประกาศผลสอบนักเรียน', icon: '🏆', search: 'ผลสอบนักเรียน', bg: '#FEF3C7' },
];

export default function TeacherHubPage() {
  const auth = useTeacherAuth();
  if (!auth.authed) return <TeacherLoginGate title="🏫 ศูนย์รวมระบบครู" subtitle="เข้าระบบครั้งเดียว ใช้ได้ทุกระบบ" />;
  return <Hub userName={auth.name} onLogout={auth.logout} />;
}

function Hub({ userName, onLogout }: { userName: string; onLogout: () => void }) {
  useEffect(() => { document.title = '🏫 Teacher Hub — โรงเรียนบ้านคลองมดแดง'; }, []);

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg,#FFF7ED 0%,#FFFFFF 100%)' }}>
      {/* Header */}
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
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 14,
        }}>
          {APPS.map(app => <AppCardView key={app.to} app={app} />)}
        </div>

        <div style={{ marginTop: 30, padding: '14px 18px', background: '#FFF7ED', borderLeft: '4px solid #FF6A01', borderRadius: 10, color: '#7C2D12', fontSize: '0.85rem' }}>
          💡 <b>เคล็ดลับ:</b> ใช้บัญชีเดียวเข้าได้ทุกระบบ — login ครั้งเดียวที่นี่แล้วใช้งานต่อได้เลยทุกหน้า
        </div>
      </main>
    </div>
  );
}

function AppCardView({ app }: { app: AppCard }) {
  return (
    <Link to={app.to} style={{ textDecoration: 'none' }}>
      <div style={{
        background: 'white', borderRadius: 18, overflow: 'hidden',
        boxShadow: '0 4px 14px rgba(0,0,0,0.06)',
        transition: 'transform 0.2s, box-shadow 0.2s',
        cursor: 'pointer', height: '100%',
        display: 'flex', flexDirection: 'column',
      }}
        onMouseOver={e => {
          e.currentTarget.style.transform = 'translateY(-4px)';
          e.currentTarget.style.boxShadow = '0 14px 28px rgba(0,0,0,0.12)';
        }}
        onMouseOut={e => {
          e.currentTarget.style.transform = '';
          e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.06)';
        }}>
        {/* Top: pastel area with icon + search */}
        <div style={{
          background: app.bg, padding: '1.25rem 1rem 1rem',
          minHeight: 150, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', position: 'relative',
        }}>
          {/* sparkle decorations */}
          <span style={{ position: 'absolute', top: 8, left: 8, fontSize: '0.85rem' }}>✨</span>
          <span style={{ position: 'absolute', top: 8, right: 8, fontSize: '0.85rem' }}>🌸</span>
          {/* Big icon */}
          <div style={{ fontSize: '3.5rem', lineHeight: 1, marginBottom: 10 }}>{app.icon}</div>
          {/* Fake search box */}
          <div style={{
            background: 'rgba(255,255,255,0.92)', borderRadius: 999,
            padding: '4px 10px 4px 14px', display: 'inline-flex', alignItems: 'center', gap: 6,
            border: '1px solid rgba(0,0,0,0.06)', color: '#0F172A',
            fontSize: '0.78rem', fontWeight: 700, maxWidth: '100%',
          }}>
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{app.search}</span>
            <Search size={11} />
          </div>
        </div>
        {/* Bottom: title */}
        <div style={{
          background: 'white', padding: '12px 14px', flex: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ fontWeight: 900, color: '#0F172A', textAlign: 'center', fontSize: '0.92rem', lineHeight: 1.3 }}>
            {app.title}
          </div>
        </div>
      </div>
    </Link>
  );
}

const lnk: React.CSSProperties = { color: 'white', display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontSize: '0.85rem', opacity: 0.9 };
const btnLogout: React.CSSProperties = { background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.4)', padding: '6px 12px', borderRadius: 8, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 };
