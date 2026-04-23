import { useState, useEffect } from 'react';
import { GraduationCap } from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import DriveImage from './DriveImage';

export default function Footer() {
  const [info, setInfo] = useState({
    name: 'โรงเรียนบ้านคลองมดแดง',
    motto: '',
    address: '198 ม.3 ต.โป่งน้ำร้อน อ.คลองลาน จ.กำแพงเพชร 62180',
    phone: '',
    facebook: 'โรงเรียนบ้านคลองมดแดง',
    logoUrl: ''
  });

  useEffect(() => {
    return onSnapshot(doc(db, 'config', 'school_info'), (snap) => {
      if (snap.exists()) setInfo(snap.data() as any);
    });
  }, []);

  return (
    <footer className="footer" id="contact">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <a href="/" className="logo-link" style={{ marginBottom: '1.5rem', display: 'inline-flex' }}>
              {info.logoUrl ? (
                <DriveImage src={info.logoUrl} alt="logo" style={{ height: '40px', marginRight: '10px' }} />
              ) : (
                <GraduationCap size={32} />
              )}
              <span>{info.name}</span>
            </a>
            <p className="footer-desc">
              {info.motto || 'การศึกษาปฐมวัย และ ขั้นพื้นฐานที่มุ่งเน้นการพัฒนาทักษะชีวิตคู่ความรู้'}
            </p>
            <div className="social-links">
              <a href="https://web.facebook.com/BnKhlngMddang" target="_blank" rel="noreferrer" className="social-link" title="Facebook" style={{ background: '#1877F2', color: '#fff' }}>FB</a>
              <a href="https://www.tiktok.com/@kmdschool198" target="_blank" rel="noreferrer" className="social-link" title="TikTok" style={{ background: '#000', color: '#fff' }}>TT</a>
              <a href="https://www.youtube.com/@KMDSchool" target="_blank" rel="noreferrer" className="social-link" title="YouTube" style={{ background: '#FF0000', color: '#fff' }}>YT</a>
              <a href="https://drive.google.com/drive/folders/1hhSsvlvoW5BoqokbraAb7JNneVwDtMb2" target="_blank" rel="noreferrer" className="social-link" title="Google Drive">GD</a>
            </div>
          </div>

          <div>
            <h4 className="footer-col-title">ลิงก์หน่วยงานราชการ</h4>
            <div className="footer-links">
              <a href="https://www.moe.go.th/" target="_blank" rel="noreferrer" className="footer-link">กระทรวงศึกษาธิการ</a>
              <a href="https://www.obec.go.th/" target="_blank" rel="noreferrer" className="footer-link">สำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน (สพฐ.)</a>
              <a href="https://www.ksp.or.th/" target="_blank" rel="noreferrer" className="footer-link">คุรุสภา</a>
            </div>
          </div>

          <div>
            <h4 className="footer-col-title">การประเมิน</h4>
            <div className="footer-links">
              <a href="#" className="footer-link">รายงานการพัฒนาคุณภาพ (SAR)</a>
              <a href="#" className="footer-link">เอกสารการประเมินปฐมวัย</a>
              <a href="#" className="footer-link">เอกสารการประเมินขั้นพื้นฐาน</a>
            </div>
          </div>

          <div>
            <h4 className="footer-col-title">ติดต่อเรา</h4>
            <div className="footer-links">
              <span className="footer-link">{info.address}</span>
              <span className="footer-link">โทร: {info.phone || '055-xxx-xxx'}</span>
              <span className="footer-link">Facebook: {info.facebook}</span>
            </div>
          </div>
        </div>
        
        <div className="footer-bottom">
          &copy; {new Date().getFullYear()} EduBright School. All rights reserved. Designed with modern minimalist approach.
        </div>
      </div>
    </footer>
  );
}
