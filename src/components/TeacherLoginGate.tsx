import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Lock, ShieldCheck } from 'lucide-react';
import { signInTeacher, signInTeacherWithGoogle } from '../utils/teacherAuth';

export default function TeacherLoginGate({ title, subtitle, onSuccess }: {
  title: string; subtitle?: string; onSuccess?: () => void;
}) {
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      await signInTeacher(u, p);
      onSuccess?.();
    } catch (error: any) {
      console.error('Teacher login failed', error);
      setErr(friendlyAuthError(error, 'บัญชี Firebase Auth ยังไม่พร้อม หรือชื่อผู้ใช้/รหัสผ่านไม่ถูกต้อง'));
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async () => {
    setErr('');
    setGoogleLoading(true);
    try {
      await signInTeacherWithGoogle();
      onSuccess?.();
    } catch (error: any) {
      console.error('Teacher Google login failed', error);
      setErr(friendlyAuthError(error, 'เข้าสู่ระบบด้วย Google ไม่สำเร็จ'));
    } finally {
      setGoogleLoading(false);
    }
  };

  const busy = loading || googleLoading;

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
            {err}
          </div>
        )}

        <button
          type="button"
          onClick={loginWithGoogle}
          disabled={busy}
          style={{
            width: '100%', padding: 12, borderRadius: 10, border: '1px solid #E2E8F0',
            cursor: busy ? 'wait' : 'pointer', background: 'white', color: '#0F172A',
            fontWeight: 800, fontSize: '0.95rem', display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: 8, boxShadow: '0 3px 10px rgba(15,23,42,0.06)',
            opacity: busy ? 0.75 : 1,
          }}
        >
          <ShieldCheck size={18} />
          {googleLoading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบด้วย Google'}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0', color: '#94A3B8', fontSize: '0.75rem' }}>
          <span style={{ flex: 1, height: 1, background: '#E2E8F0' }} />
          <span>หรือใช้รหัสผ่าน</span>
          <span style={{ flex: 1, height: 1, background: '#E2E8F0' }} />
        </div>

        <input value={u} onChange={e => setU(e.target.value)} placeholder="ชื่อผู้ใช้หรืออีเมล" required autoFocus
          autoComplete="username"
          disabled={busy}
          style={{ width: '100%', padding: 12, borderRadius: 10, border: '1px solid #E2E8F0', marginBottom: 10, fontSize: '0.95rem' }} />
        <input type="password" value={p} onChange={e => setP(e.target.value)} placeholder="รหัสผ่าน" required
          autoComplete="current-password"
          disabled={busy}
          style={{ width: '100%', padding: 12, borderRadius: 10, border: '1px solid #E2E8F0', marginBottom: 16, fontSize: '0.95rem' }} />
        <button type="submit" disabled={busy} style={{
          width: '100%', padding: 12, borderRadius: 10, border: 'none',
          cursor: busy ? 'wait' : 'pointer',
          background: 'linear-gradient(135deg,#FF6A01,#FB923C)', color: 'white',
          fontWeight: 800, fontSize: '0.95rem', opacity: busy ? 0.8 : 1,
        }}>{loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}</button>
        <Link to="/" style={{ display: 'block', textAlign: 'center', marginTop: 12, color: '#94A3B8', fontSize: '0.8rem', textDecoration: 'none' }}>
          ← กลับหน้าหลัก
        </Link>
        <div style={{ marginTop: 12, padding: 10, background: '#F1F5F9', borderRadius: 8, fontSize: '0.7rem', color: '#64748B', textAlign: 'center' }}>
          ใช้บัญชี Google/Firebase Auth ของโรงเรียน และตรวจสิทธิ์ซ้ำจากรายชื่อครูใน Firestore Rules
        </div>
      </form>
    </div>
  );
}

function friendlyAuthError(error: any, fallback: string) {
  const code = String(error?.code || '');
  const message = String(error?.message || '');
  if (code === 'auth/unauthorized-domain' || message.includes('auth/unauthorized-domain')) {
    return 'Firebase ยังไม่อนุญาต domain นี้สำหรับ Google Login: ให้เปิดผ่าน http://localhost:5173 หรือเพิ่ม 127.0.0.1 ใน Firebase Auth > Settings > Authorized domains';
  }
  return message || fallback;
}
