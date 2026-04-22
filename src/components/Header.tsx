import { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

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

          <div className="dropdown">
            <span className="nav-item flex items-center gap-1 cursor-pointer">
              เกี่ยวกับโรงเรียน <ChevronDown size={14} />
            </span>
            <div className="dropdown-content">
              <Link to="/page/history" className="dropdown-item">ประวัติโรงเรียน</Link>
              <Link to="/page/vision" className="dropdown-item">วิสัยทัศน์ พันธกิจ</Link>
              <Link to="/page/symbols" className="dropdown-item">สัญลักษณ์ อัตลักษณ์</Link>
              <Link to="/page/song" className="dropdown-item">เพลงประจำโรงเรียน</Link>
              <Link to="/page/strategy" className="dropdown-item">ยุทธศาสตร์และจุดเน้น</Link>
              <Link to="/page/community" className="dropdown-item">สภาพชุมชนและบริบท</Link>
              <Link to="/page/campus" className="dropdown-item">อาคารสถานที่</Link>
              <Link to="/page/contact" className="dropdown-item">แผนที่และติดต่อ</Link>
            </div>
          </div>

          <div className="dropdown">
            <span className="nav-item flex items-center gap-1 cursor-pointer">
              บุคลากร <ChevronDown size={14} />
            </span>
            <div className="dropdown-content">
              <Link to="/page/directors" className="dropdown-item">ฝ่ายบริหาร</Link>
              <Link to="/personnel/teacher" className="dropdown-item">คณะครู</Link>
              <Link to="/personnel/support" className="dropdown-item">บุคลากรสายสนับสนุน</Link>
              <Link to="/page/board" className="dropdown-item">คณะกรรมการสถานศึกษา</Link>
            </div>
          </div>

          <div className="dropdown">
            <span className="nav-item flex items-center gap-1 cursor-pointer">
              การบริหารงาน <ChevronDown size={14} />
            </span>
            <div className="dropdown-content">
              <Link to="/page/academic-affairs" className="dropdown-item">กลุ่มงานวิชาการ</Link>
              <Link to="/page/budget" className="dropdown-item">กลุ่มงานงบประมาณ</Link>
              <Link to="/page/personnel" className="dropdown-item">กลุ่มงานบุคคล</Link>
              <Link to="/page/general-affairs" className="dropdown-item">กลุ่มงานทั่วไป</Link>
              <Link to="/page/student-affairs" className="dropdown-item">กลุ่มงานกิจการนักเรียน</Link>
            </div>
          </div>

          <div className="dropdown">
            <span className="nav-item flex items-center gap-1 cursor-pointer">
              สารสนเทศ <ChevronDown size={14} />
            </span>
            <div className="dropdown-content">
              <Link to="/page/students" className="dropdown-item">จำนวนนักเรียน</Link>
              <Link to="/page/assessment" className="dropdown-item">ผลการประเมินคุณภาพ</Link>
              <Link to="/page/sar" className="dropdown-item">รายงาน SAR</Link>
              <Link to="/page/school-awards" className="dropdown-item">ผลงานสถานศึกษา</Link>
            </div>
          </div>

          <div className="dropdown">
            <span className="nav-item flex items-center gap-1 cursor-pointer">
              ข่าวสาร <ChevronDown size={14} />
            </span>
            <div className="dropdown-content">
              <Link to="/page/pr-news" className="dropdown-item">ข่าวประชาสัมพันธ์</Link>
              <Link to="/page/e-newsletter" className="dropdown-item">จดหมายข่าว</Link>
              <Link to="/page/gallery" className="dropdown-item">ภาพกิจกรรม</Link>
              <Link to="/calendar" className="dropdown-item">ปฏิทินกิจกรรม</Link>
            </div>
          </div>

          <div className="dropdown">
            <span className="nav-item flex items-center gap-1 cursor-pointer">
              E-Service <ChevronDown size={14} />
            </span>
            <div className="dropdown-content">
              <Link to="/page/grades" className="dropdown-item">ตรวจสอบผลการเรียน</Link>
              <Link to="/page/admission" className="dropdown-item">รับสมัครนักเรียน</Link>
              <Link to="/page/e-document" className="dropdown-item">สารบรรณอิเล็กทรอนิกส์</Link>
            </div>
          </div>
        </nav>
      </div>
    </header>
  );
}
