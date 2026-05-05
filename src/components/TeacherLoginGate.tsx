import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { setAuth, ACCOUNTS } from '../utils/teacherAuth';

export default function TeacherLoginGate({ title, subtitle, onSuccess }: {
  title: string; subtitle?: string; onSuccess?: () => void;
}) {
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [err, setErr] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const acc = ACCOUNTS[u.trim()];
    if (acc && acc.pass === p && setAuth(u.trim())) {
      onSuccess?.();
    } else {
      setErr(true);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg,#FF6A01,#FFD400)', padding: '1.5rem',
    }}>
      <form onSubmit={submit} style={{
        background: 'white', borderRadius: 24, padding: '2rem', maxWidth: 420, width: '100%',
        boxShadow: '0 30px 60px rgba(0,0,0,0.2)',
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%', background: '#FFEDD5',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 1rem', color: '#FF6A01',
        }}>
          <Lock size={28} />
        </div>
        <h3 style={{ textAlign: 'center', fontWeight: 900, color: '#0F172A', margin: '0 0 4px' }}>{title}</h3>
        <p style={{ textAlign: 'center', color: '#64748B', fontSize: '0.85rem', marginBottom: 18 }}>
          {subtitle || 'เข้าสู่ระบบสำหรับครูผู้สอน'}
        </p>
        {err && (
          <div style={{ background: '#FEE2E2', color: '#DC2626', padding: '8px 12px', borderRadius: 8, fontSize: '0.85rem', marginBottom: 12, textAlign: 'center' }}>
            ❌ ชื่อผู้ใช้/รหัสผ่านไม่ถูกต้อง
          </div>
        )}
        <input value={u} onChange={e => setU(e.target.value)} placeholder="ชื่อผู้ใช้" required autoFocus
          style={{ width: '100%', padding: 12, borderRadius: 10, border: '1px solid #E2E8F0', marginBottom: 10, fontSize: '0.95rem' }} />
        <input type="password" value={p} onChange={e => setP(e.target.value)} placeholder="รหัสผ่าน" required
          style={{ width: '100%', padding: 12, borderRadius: 10, border: '1px solid #E2E8F0', marginBottom: 16, fontSize: '0.95rem' }} />
        <button type="submit" style={{
          width: '100%', padding: 12, borderRadius: 10, border: 'none', cursor: 'pointer',
          background: 'linear-gradient(135deg,#FF6A01,#FB923C)', color: 'white',
          fontWeight: 800, fontSize: '0.95rem',
        }}>เข้าสู่ระบบ</button>
        <Link to="/" style={{ display: 'block', textAlign: 'center', marginTop: 12, color: '#94A3B8', fontSize: '0.8rem', textDecoration: 'none' }}>
          ← กลับหน้าหลัก
        </Link>
        <div style={{ marginTop: 12, padding: 10, background: '#F1F5F9', borderRadius: 8, fontSize: '0.7rem', color: '#64748B', textAlign: 'center' }}>
          🔐 เข้าระบบครั้งเดียว ใช้ได้กับทุกระบบ (เช็คชื่อ, ลา, อบรม, ฯลฯ)
        </div>
      </form>
    </div>
  );
}
