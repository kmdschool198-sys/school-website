// Teacher-accessible page to manage exam results announcements
import { Link } from 'react-router-dom';
import { ChevronLeft, LogOut } from 'lucide-react';
import { useTeacherAuth } from '../utils/teacherAuth';
import TeacherLoginGate from '../components/TeacherLoginGate';
import ResultsManager from '../components/ResultsManager';

export default function ManageResultsPage() {
  const auth = useTeacherAuth();
  if (!auth.authed) return <TeacherLoginGate title="🏆 จัดการประกาศผลสอบ" />;
  return (
    <div style={{ minHeight: '100vh', background: '#FFF7ED' }}>
      <header style={{ background: 'linear-gradient(135deg,#F59E0B,#FBBF24)', color: 'white', padding: '1.2rem 1.25rem' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Link to="/teacher-hub" style={lnk}><ChevronLeft size={16} />Hub</Link>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 900 }}>🏆 จัดการประกาศผลสอบ</div>
            <div style={{ fontSize: '0.78rem', opacity: 0.9 }}>สร้าง/กรอกคะแนน/เผยแพร่ · {auth.name}</div>
          </div>
          <Link to="/results" style={{ ...btnLogout, textDecoration: 'none' }}>👁️ ดูหน้าประกาศ</Link>
          <button onClick={auth.logout} style={btnLogout}><LogOut size={12} />ออก</button>
        </div>
      </header>
      <main style={{ maxWidth: 1400, margin: '0 auto', padding: '1.25rem' }}>
        <ResultsManager />
      </main>
    </div>
  );
}

const lnk: React.CSSProperties = { color: 'white', display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontSize: '0.85rem', opacity: 0.9 };
const btnLogout: React.CSSProperties = { background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.4)', padding: '6px 12px', borderRadius: 8, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 };
