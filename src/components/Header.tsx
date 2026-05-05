import { useState, useEffect } from 'react';
import { ChevronDown, Menu, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { sidebarMenus } from '../data/pageContent';

import DriveImage from './DriveImage';

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [schoolInfo, setSchoolInfo] = useState({
    name: 'โรงเรียนบ้านคลองมดแดง',
    logoUrl: ''
  });

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);

    const unsubscribe = onSnapshot(doc(db, 'config', 'school_info'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setSchoolInfo({
          name: data.name || 'โรงเรียนบ้านคลองมดแดง',
          logoUrl: data.logoUrl || ''
        });
      }
    });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      unsubscribe();
    };
  }, []);

  // Lock body scroll when mobile menu open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const closeMobile = () => { setMobileOpen(false); setOpenSection(null); };

  return (
    <header className={`header ${isScrolled ? 'scrolled' : ''}`}>
      <div className="container nav-container">
        <Link to="/" className="logo-link" style={{ display: 'flex', alignItems: 'center', gap: '14px', textDecoration: 'none', minWidth: 0, flex: 1 }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '50%',
            background: 'linear-gradient(135deg, #FFF7ED, #FFEDD5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '4px',
            boxShadow: '0 4px 14px rgba(255,106,1,0.25), inset 0 0 0 2px rgba(255,255,255,0.8)',
            flexShrink: 0,
          }}>
            <DriveImage
              src={schoolInfo.logoUrl || '/school_logo_kmd.png'}
              alt="logo"
              style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '50%' }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15, minWidth: 0 }}>
            <span style={{ fontSize: 'clamp(0.92rem, 3.5vw, 1.15rem)', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {schoolInfo.name}
            </span>
            <span style={{ fontSize: '0.62rem', fontWeight: 600, color: '#FF6A01', letterSpacing: '1.5px', textTransform: 'uppercase', marginTop: '2px', whiteSpace: 'nowrap' }}>
              Ban Klong Mod Daeng School
            </span>
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="nav-links">
          <Link to="/" className="nav-item">หน้าแรก</Link>

          {Object.entries(sidebarMenus).map(([title, menu]) => (
            <div key={title} className="dropdown">
              <span className="nav-item flex items-center gap-1 cursor-pointer">
                {title} <ChevronDown size={14} />
              </span>
              <div className="dropdown-content">
                {menu.links.map((link, idx) => {
                  const fullPath = link.path.startsWith('/') ? link.path : `/page/${link.path}`;
                  return (
                    <Link key={idx} to={fullPath} className="dropdown-item">
                      {link.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Mobile hamburger button */}
        <button
          className="mobile-menu-btn"
          onClick={() => setMobileOpen(o => !o)}
          aria-label="เมนู"
          style={{
            background: 'linear-gradient(135deg,#FF6A01,#FB923C)',
            color: 'white', border: 'none', borderRadius: 10,
            width: 42, height: 42, cursor: 'pointer',
            display: 'none', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(255,106,1,0.3)',
          }}>
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div onClick={closeMobile} style={{
            position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)',
            backdropFilter: 'blur(4px)', zIndex: 998,
          }} />
          <aside style={{
            position: 'fixed', top: 0, right: 0, bottom: 0,
            width: 'min(85vw, 340px)', background: 'white',
            zIndex: 999, boxShadow: '-10px 0 40px rgba(0,0,0,0.2)',
            overflowY: 'auto', display: 'flex', flexDirection: 'column',
          }}>
            {/* Drawer header */}
            <div style={{
              background: 'linear-gradient(135deg,#FF6A01,#FB923C)', color: 'white',
              padding: '1.25rem 1.25rem 1rem', display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%', background: 'white', padding: 4, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <DriveImage src={schoolInfo.logoUrl || '/school_logo_kmd.png'} alt="logo"
                  style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '50%' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 900, fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {schoolInfo.name}
                </div>
                <div style={{ fontSize: '0.7rem', opacity: 0.9, letterSpacing: 1 }}>เมนูทั้งหมด</div>
              </div>
              <button onClick={closeMobile} style={{
                background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8,
                width: 36, height: 36, color: 'white', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <X size={20} />
              </button>
            </div>

            {/* Drawer items */}
            <div style={{ padding: '0.5rem 0.75rem', flex: 1 }}>
              <Link to="/" onClick={closeMobile} style={mobItem}>
                🏠 <span style={{ fontWeight: 800 }}>หน้าแรก</span>
              </Link>

              {Object.entries(sidebarMenus).map(([title, menu]) => {
                const open = openSection === title;
                return (
                  <div key={title} style={{ marginTop: 4 }}>
                    <button
                      onClick={() => setOpenSection(open ? null : title)}
                      style={{
                        ...mobItem, width: '100%', textAlign: 'left',
                        background: open ? '#FFF7ED' : 'transparent',
                        border: 'none', cursor: 'pointer', justifyContent: 'space-between',
                      }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 800, color: '#0F172A' }}>
                        <span style={{ fontSize: '1.1rem' }}>{menu.icon}</span> {title}
                      </span>
                      <ChevronDown size={16} style={{
                        transform: open ? 'rotate(180deg)' : 'rotate(0)',
                        transition: 'transform 0.2s', color: '#FF6A01',
                      }} />
                    </button>
                    {open && (
                      <div style={{ paddingLeft: 14, marginTop: 4, marginBottom: 8 }}>
                        {menu.links.map((link, idx) => {
                          const fullPath = link.path.startsWith('/') ? link.path : `/page/${link.path}`;
                          return (
                            <Link key={idx} to={fullPath} onClick={closeMobile}
                              style={{
                                ...mobItem, fontSize: '0.9rem', padding: '10px 14px',
                                borderLeft: '3px solid #FFEDD5', color: '#475569',
                              }}>
                              {link.label}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ padding: '14px 18px', background: '#F8FAFC', fontSize: '0.72rem', color: '#94A3B8', textAlign: 'center' }}>
              © {new Date().getFullYear() + 543} โรงเรียนบ้านคลองมดแดง
            </div>
          </aside>
        </>
      )}
    </header>
  );
}

const mobItem: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10,
  padding: '12px 14px', borderRadius: 10,
  textDecoration: 'none', color: '#0F172A', fontSize: '0.95rem',
  transition: 'background 0.15s',
};
