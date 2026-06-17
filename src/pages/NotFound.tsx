import { ArrowLeft, Home, Search, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';

export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', background: '#FFF7ED' }}>
      <Header />
      <main style={{ padding: '8rem 1rem 4rem' }}>
        <section
          style={{
            maxWidth: 760,
            margin: '0 auto',
            background: 'white',
            borderRadius: 24,
            padding: 'clamp(2rem, 5vw, 3rem)',
            textAlign: 'center',
            border: '1px solid #FFEDD5',
            boxShadow: '0 24px 70px rgba(15,23,42,0.10)',
          }}
        >
          <div
            style={{
              width: 86,
              height: 86,
              borderRadius: '50%',
              margin: '0 auto 1.25rem',
              background: 'linear-gradient(135deg,#FFF7ED,#FFEDD5)',
              color: '#FF6A01',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Search size={40} />
          </div>
          <div style={{ color: '#FF6A01', fontWeight: 900, letterSpacing: 2, fontSize: '0.78rem' }}>
            404 NOT FOUND
          </div>
          <h1 style={{ margin: '0.6rem 0 0.8rem', color: '#0F172A', fontSize: 'clamp(2rem, 6vw, 3rem)', fontWeight: 950 }}>
            ไม่พบหน้าที่ต้องการ
          </h1>
          <p style={{ color: '#64748B', lineHeight: 1.8, margin: '0 auto 1.8rem', maxWidth: 540 }}>
            ลิงก์นี้อาจถูกย้าย เปลี่ยนชื่อ หรือยังไม่ได้เผยแพร่ ลองกลับหน้าแรกหรือเข้าศูนย์รวมระบบครูเพื่อเลือกเมนูใหม่
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
            <Link to="/" style={primaryLink}>
              <Home size={17} /> กลับหน้าแรก
            </Link>
            <Link to="/teacher-hub" style={secondaryLink}>
              <ArrowLeft size={17} /> ระบบครู
            </Link>
            <Link to="/privacy" style={secondaryLink}>
              <ShieldCheck size={17} /> Privacy / PDPA
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

const primaryLink: React.CSSProperties = {
  background: 'linear-gradient(135deg,#FF6A01,#FB923C)',
  color: 'white',
  padding: '0.9rem 1.25rem',
  borderRadius: 12,
  fontWeight: 900,
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
};

const secondaryLink: React.CSSProperties = {
  background: '#F8FAFC',
  color: '#0F172A',
  padding: '0.9rem 1.25rem',
  borderRadius: 12,
  fontWeight: 800,
  textDecoration: 'none',
  border: '1px solid #E2E8F0',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
};
