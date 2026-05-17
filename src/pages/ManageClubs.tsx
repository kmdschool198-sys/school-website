// Teacher-accessible page to manage clubs (no admin login required)
import { Link } from 'react-router-dom';
import { ChevronLeft, LogOut } from 'lucide-react';
import { useTeacherAuth } from '../utils/teacherAuth';
import TeacherLoginGate from '../components/TeacherLoginGate';
import ClubsManager from '../components/ClubsManager';

export default function ManageClubsPage() {
  const auth = useTeacherAuth();
  if (!auth.authed) return <TeacherLoginGate title="🎯 จัดการชุมนุม / กิจกรรม / ลูกเสือ" />;
  return (
    <div style={{ minHeight: '100vh', background: '#FFF7ED' }}>
      <header style={{ background: 'linear-gradient(135deg,#10B981,#34D399)', color: 'white', padding: '1.2rem 1.25rem' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Link to="/teacher-hub" style={lnk}><ChevronLeft size={16} />Hub</Link>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 900 }}>🎯 จัดการชุมนุม / กิจกรรม / ลูกเสือ</div>
            <div style={{ fontSize: '0.78rem', opacity: 0.9 }}>สร้าง/แก้ไข/เพิ่มสมาชิก · {auth.name}</div>
          </div>
          <Link to="/club-attendance" style={{ ...btnLogout, textDecoration: 'none' }}>📋 เช็คชื่อ</Link>
          <button onClick={auth.logout} style={btnLogout}><LogOut size={12} />ออก</button>
        </div>
      </header>
      <main style={{ maxWidth: 1400, margin: '0 auto', padding: '1.25rem' }}>
        <ClubsManager />
      </main>
    </div>
  );
}

const lnk: React.CSSProperties = { color: 'white', display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontSize: '0.85rem', opacity: 0.9 };
const btnLogout: React.CSSProperties = { background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.4)', padding: '6px 12px', borderRadius: 8, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 };
