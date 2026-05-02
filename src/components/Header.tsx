import { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { sidebarMenus } from '../data/pageContent';

import DriveImage from './DriveImage';

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
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

  return (
    <header className={`header ${isScrolled ? 'scrolled' : ''}`}>
      <div className="container nav-container">
        <Link to="/" className="logo-link" style={{ display: 'flex', alignItems: 'center', gap: '14px', textDecoration: 'none' }}>
          <div style={{
            width: '58px', height: '58px', borderRadius: '50%',
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
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
            <span style={{ fontSize: '1.15rem', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.3px' }}>
              {schoolInfo.name}
            </span>
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#FF6A01', letterSpacing: '1.5px', textTransform: 'uppercase', marginTop: '2px' }}>
              Ban Klong Mod Daeng School
            </span>
          </div>
        </Link>

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
      </div>
    </header>
  );
}

