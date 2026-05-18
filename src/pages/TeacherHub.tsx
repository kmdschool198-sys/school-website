import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, LogOut, Search } from 'lucide-react';
import { useTeacherAuth } from '../utils/teacherAuth';
import TeacherLoginGate from '../components/TeacherLoginGate';

interface AppCard {
  to: string;
  title: string;
  icon: string;
  search: string;
  bg: string;
}

// ─── หมวด 1: ระบบเกี่ยวกับนักเรียน (สำหรับครูประจำชั้น/ผู้สอน) ───
const STUDENT_APPS: AppCard[] = [
  { to: '/class-dashboard', title: 'แดชบอร์ดรายชั้นเรียน ⭐', icon: '📊', search: 'ภาพรวมทั้งชั้น', bg: '#FFEDD5' },
  { to: '/attendance', title: 'ระบบเช็คชื่อนักเรียน', icon: '✅', search: 'เช็คนักเรียน', bg: '#FCE7F3' },
  { to: '/manage-roster', title: 'จัดการรายชื่อนักเรียน', icon: '👥', search: 'รายชื่อ-CSV', bg: '#E9D5FF' },
  { to: '/club-attendance', title: 'เช็คชื่อชุมนุม-ลูกเสือ', icon: '🎯', search: 'ชุมนุม-ลูกเสือ', bg: '#DCFCE7' },
  { to: '/manage-clubs', title: 'จัดการชุมนุม-สมาชิก', icon: '⚙️', search: 'สร้างชุมนุม', bg: '#D1FAE5' },
  { to: '/milk-report', title: 'รายงานการดื่มนม (อัตโนมัติ)', icon: '🥛', search: 'ดื่มนม', bg: '#DBEAFE' },
  { to: '/brush-log', title: 'บันทึกการแปรงฟัน', icon: '🪥', search: 'แปรงฟัน', bg: '#CFFAFE' },
  { to: '/results', title: 'ประกาศผลสอบนักเรียน', icon: '🏆', search: 'ผลสอบ', bg: '#FEF3C7' },
  { to: '/manage-results', title: 'จัดการ/กรอกผลสอบ', icon: '✏️', search: 'กรอกคะแนน', bg: '#FED7AA' },
  { to: '/saving', title: 'ระบบออมเงิน', icon: '💰', search: 'ออมเงิน', bg: '#FCE7F3' },
  { to: '/body-metrics', title: 'น้ำหนัก-ส่วนสูง-BMI', icon: '⚖️', search: 'น้ำหนักส่วนสูง', bg: '#FCE7F3' },
  { to: '/print-body-metrics', title: 'พิมพ์ฟอร์มน้ำหนัก-ส่วนสูง', icon: '🖨️', search: 'พิมพ์น้ำหนัก', bg: '#FCE7F3' },
  { to: '/print-club', title: 'พิมพ์ฟอร์มชุมนุม', icon: '🖨️', search: 'พิมพ์ชุมนุม', bg: '#DCFCE7' },
  { to: '/teacher-log/remedial', title: 'บันทึกการสอนซ่อมเสริม', icon: '👨‍🏫', search: 'สอนซ่อมเสริม', bg: '#FCE7F3' },
];

// ─── หมวด 2: ระบบรายงานส่วนตัวของครู (สำหรับครูแต่ละคน) ───
const TEACHER_APPS: AppCard[] = [
  { to: '/teacher-training', title: 'เกียรติบัตร / อบรมครู', icon: '🎖️', search: 'เกียรติบัตรครู', bg: '#DCFCE7' },
  { to: '/teacher-log/lesson-plan', title: 'ส่งแผนการสอน', icon: '📋', search: 'ส่งแผนการสอน', bg: '#E2E8F0' },
  { to: '/teacher-log/media', title: 'บันทึกการใช้สื่อ', icon: '📚', search: 'การใช้สื่อ', bg: '#FEF3C7' },
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
        {/* Section 1: Student-facing */}
        <SectionHeader
          icon="👨‍🎓"
          title="ระบบที่ทำงานกับนักเรียน"
          subtitle="เช็คชื่อ / ชุมนุม / ผลสอบ / น้ำหนัก / ออมเงิน / สอนซ่อม"
          color="#0EA5E9"
        />
        <div style={grid}>
          {STUDENT_APPS.map(a => <AppCardView key={a.to} app={a} />)}
        </div>

        {/* Section 2: Personal teacher */}
        <SectionHeader
          icon="👨‍🏫"
          title="ระบบรายงานส่วนตัวของครู"
          subtitle="ลา / อบรม / PLC / แผนการสอน / โครงการ / สื่อ"
          color="#A855F7"
        />
        <div style={grid}>
          {TEACHER_APPS.map(a => <AppCardView key={a.to} app={a} />)}
        </div>

        <div style={{ marginTop: 30, padding: '14px 18px', background: '#FFF7ED', borderLeft: '4px solid #FF6A01', borderRadius: 10, color: '#7C2D12', fontSize: '0.85rem' }}>
          💡 <b>เคล็ดลับ:</b> ใช้บัญชีเดียวเข้าได้ทุกระบบ — login ครั้งเดียวที่นี่แล้วใช้งานต่อได้เลยทุกหน้า
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
        <div style={{
          background: app.bg, padding: '1.25rem 1rem 1rem',
          minHeight: 150, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', position: 'relative',
        }}>
          <span style={{ position: 'absolute', top: 8, left: 8, fontSize: '0.85rem' }}>✨</span>
          <span style={{ position: 'absolute', top: 8, right: 8, fontSize: '0.85rem' }}>🌸</span>
          <div style={{ fontSize: '3.5rem', lineHeight: 1, marginBottom: 10 }}>{app.icon}</div>
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

const grid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
  gap: 14,
};
const lnk: React.CSSProperties = { color: 'white', display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontSize: '0.85rem', opacity: 0.9 };
const btnLogout: React.CSSProperties = { background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.4)', padding: '6px 12px', borderRadius: 8, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 };
