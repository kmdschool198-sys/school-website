import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  GraduationCap, MapPin, Phone, Mail, ExternalLink,
  Calendar as CalendarIcon, ClipboardList, BookOpen, ChevronRight,
} from 'lucide-react';

// Brand icons (lucide doesn't ship these in older versions)
const FacebookIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c5.05-.5 9-4.76 9-9.95z" />
  </svg>
);
const YoutubeIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1c.5-1.9.5-5.8.5-5.8s0-3.9-.5-5.8zM9.6 15.6V8.4l6.3 3.6-6.3 3.6z" />
  </svg>
);
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import DriveImage from './DriveImage';

// TikTok icon (lucide doesn't have one)
const TikTokIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43V8.86a8.16 8.16 0 0 0 4.77 1.52V6.93a4.85 4.85 0 0 1-1.84-.24z" />
  </svg>
);

export default function Footer() {
  const [info, setInfo] = useState({
    name: 'โรงเรียนบ้านคลองมดแดง',
    motto: 'การศึกษาปฐมวัย และ ขั้นพื้นฐานที่มุ่งเน้นการพัฒนาทักษะชีวิตคู่ความรู้',
    address: '198 ม.3 ต.โป่งน้ำร้อน อ.คลองลาน จ.กำแพงเพชร 62180',
    phone: '055-xxx-xxx',
    email: '',
    facebook: 'โรงเรียนบ้านคลองมดแดง',
    logoUrl: '',
  });

  useEffect(() => {
    return onSnapshot(doc(db, 'config', 'school_info'), snap => {
      if (snap.exists()) setInfo(prev => ({ ...prev, ...(snap.data() as any) }));
    });
  }, []);

  const year = new Date().getFullYear();
  const beYear = year + 543;

  return (
    <footer style={{
      background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #7C2D12 100%)',
      color: '#E2E8F0', position: 'relative', overflow: 'hidden',
    }} id="contact">
      {/* Decorative blobs */}
      <div style={{
        position: 'absolute', top: -100, right: -100, width: 400, height: 400,
        borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,106,1,0.15), transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: -150, left: -150, width: 500, height: 500,
        borderRadius: '50%', background: 'radial-gradient(circle, rgba(251,146,60,0.1), transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div className="container" style={{ position: 'relative', zIndex: 1, padding: '4rem 1rem 1.5rem' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '2.5rem', marginBottom: '2.5rem',
        }}>
          {/* Brand */}
          <div>
            <Link to="/" style={{
              display: 'inline-flex', alignItems: 'center', gap: 12,
              textDecoration: 'none', color: 'white', marginBottom: '1rem',
            }}>
              {info.logoUrl ? (
                <DriveImage src={info.logoUrl} alt="logo" style={{ height: 48, width: 48, borderRadius: 12, background: 'white', padding: 4 }} />
              ) : (
                <div style={{
                  width: 48, height: 48, borderRadius: 12,
                  background: 'linear-gradient(135deg,#FF6A01,#FB923C)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <GraduationCap size={26} color="white" />
                </div>
              )}
              <div>
                <div style={{ fontWeight: 900, fontSize: '1.05rem', lineHeight: 1.2 }}>{info.name}</div>
                <div style={{ fontSize: '0.7rem', color: '#FB923C', fontWeight: 700, letterSpacing: 1 }}>BAN KHLONG MOD DAENG SCHOOL</div>
              </div>
            </Link>
            <p style={{ fontSize: '0.88rem', lineHeight: 1.7, color: '#CBD5E1', marginBottom: '1.25rem' }}>
              {info.motto}
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <SocialBtn href="https://web.facebook.com/BnKhlngMddang" label="Facebook" color="#1877F2"><FacebookIcon size={18} /></SocialBtn>
              <SocialBtn href="https://www.tiktok.com/@kmdschool198" label="TikTok" color="#000"><TikTokIcon size={18} /></SocialBtn>
              <SocialBtn href="https://www.youtube.com/@KMDSchool" label="YouTube" color="#FF0000"><YoutubeIcon size={18} /></SocialBtn>
            </div>
          </div>

          {/* Quick links — internal */}
          <div>
            <FooterTitle icon={<BookOpen size={16} />}>เมนูลัด</FooterTitle>
            <FooterCol>
              <FooterRouterLink to="/calendar" icon={<CalendarIcon size={13} />}>ปฏิทินโรงเรียน</FooterRouterLink>
              <FooterRouterLink to="/page/timetable" icon={<ClipboardList size={13} />}>ตารางสอน-ตารางเรียน</FooterRouterLink>
              <FooterRouterLink to="/attendance" icon={<ClipboardList size={13} />}>ระบบเช็คชื่อนักเรียน</FooterRouterLink>
              <FooterRouterLink to="/page/personnel" icon={<BookOpen size={13} />}>บุคลากร</FooterRouterLink>
              <FooterRouterLink to="/page/about" icon={<BookOpen size={13} />}>เกี่ยวกับโรงเรียน</FooterRouterLink>
            </FooterCol>
          </div>

          {/* Government links */}
          <div>
            <FooterTitle icon={<ExternalLink size={16} />}>หน่วยงานราชการ</FooterTitle>
            <FooterCol>
              <FooterExt href="https://www.moe.go.th/">กระทรวงศึกษาธิการ</FooterExt>
              <FooterExt href="https://www.obec.go.th/">สพฐ.</FooterExt>
              <FooterExt href="https://www.kpt2.go.th/">สพป.กำแพงเพชร เขต 2</FooterExt>
              <FooterExt href="https://www.ksp.or.th/">คุรุสภา</FooterExt>
              <FooterExt href="https://otpc.in.th/">กองทุนเพื่อความเสมอภาค</FooterExt>
            </FooterCol>
          </div>

          {/* Contact */}
          <div>
            <FooterTitle icon={<MapPin size={16} />}>ติดต่อโรงเรียน</FooterTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: '0.85rem' }}>
              <ContactRow icon={<MapPin size={14} />}>
                {info.address}
              </ContactRow>
              <ContactRow icon={<Phone size={14} />}>
                <a href={`tel:${info.phone}`} style={contactLink}>{info.phone || '055-xxx-xxx'}</a>
              </ContactRow>
              {info.email && (
                <ContactRow icon={<Mail size={14} />}>
                  <a href={`mailto:${info.email}`} style={contactLink}>{info.email}</a>
                </ContactRow>
              )}
              <ContactRow icon={<FacebookIcon size={14} />}>
                <a href="https://web.facebook.com/BnKhlngMddang" target="_blank" rel="noreferrer" style={contactLink}>
                  {info.facebook}
                </a>
              </ContactRow>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{
          paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexWrap: 'wrap', gap: 12, fontSize: '0.78rem', color: '#94A3B8',
        }}>
          <div>
            © {beYear} {info.name}. สงวนลิขสิทธิ์ทุกประการ
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <Link to="/admin" style={{ color: '#94A3B8', textDecoration: 'none' }}>เข้าสู่ระบบผู้ดูแล</Link>
            <span style={{ color: '#475569' }}>•</span>
            <span>Powered by Firebase + React</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

const contactLink: React.CSSProperties = {
  color: '#E2E8F0', textDecoration: 'none', transition: 'color 0.2s',
};

function SocialBtn({ href, label, color, children }: { href: string; label: string; color: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" title={label} aria-label={label}
      style={{
        width: 38, height: 38, borderRadius: 10, background: 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.12)', color: '#fff',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.2s ease', textDecoration: 'none',
      }}
      onMouseOver={e => {
        e.currentTarget.style.background = color;
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.borderColor = color;
      }}
      onMouseOut={e => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
      }}>
      {children}
    </a>
  );
}

function FooterTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h4 style={{
      fontSize: '0.95rem', fontWeight: 800, marginBottom: '1.1rem',
      color: 'white', display: 'inline-flex', alignItems: 'center', gap: 8,
    }}>
      <span style={{ color: '#FB923C' }}>{icon}</span>
      {children}
    </h4>
  );
}

function FooterCol({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.85rem' }}>{children}</div>;
}

function FooterRouterLink({ to, icon, children }: { to: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link to={to} style={{
      color: '#CBD5E1', textDecoration: 'none', display: 'inline-flex',
      alignItems: 'center', gap: 6, transition: 'color 0.2s',
    }}
      onMouseOver={e => (e.currentTarget.style.color = '#FB923C')}
      onMouseOut={e => (e.currentTarget.style.color = '#CBD5E1')}>
      {icon && <span style={{ color: '#FB923C', opacity: 0.7 }}>{icon}</span>}
      {children}
    </Link>
  );
}

function FooterExt({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" style={{
      color: '#CBD5E1', textDecoration: 'none', display: 'inline-flex',
      alignItems: 'center', gap: 6, transition: 'color 0.2s',
    }}
      onMouseOver={e => (e.currentTarget.style.color = '#FB923C')}
      onMouseOut={e => (e.currentTarget.style.color = '#CBD5E1')}>
      <ChevronRight size={12} style={{ color: '#FB923C', opacity: 0.7 }} />
      {children}
    </a>
  );
}

function ContactRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', color: '#CBD5E1', lineHeight: 1.6 }}>
      <span style={{
        color: '#FB923C', flexShrink: 0, marginTop: 2,
        background: 'rgba(251,146,60,0.15)', padding: 6, borderRadius: 8,
      }}>{icon}</span>
      <span style={{ flex: 1 }}>{children}</span>
    </div>
  );
}
