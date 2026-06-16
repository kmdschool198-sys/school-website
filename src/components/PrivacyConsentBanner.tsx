import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, X } from 'lucide-react';

const STORAGE_KEY = 'kmd_privacy_notice_v1';

export default function PrivacyConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(localStorage.getItem(STORAGE_KEY) !== 'accepted');
  }, []);

  const accept = () => {
    localStorage.setItem(STORAGE_KEY, 'accepted');
    setVisible(false);
  };

  const dismiss = () => {
    sessionStorage.setItem(STORAGE_KEY, 'dismissed');
    setVisible(false);
  };

  if (!visible || sessionStorage.getItem(STORAGE_KEY) === 'dismissed') return null;

  return (
    <div style={{
      position: 'fixed',
      left: 16,
      right: 16,
      bottom: 16,
      zIndex: 1200,
      display: 'flex',
      justifyContent: 'center',
      pointerEvents: 'none',
    }}>
      <div style={{
        width: 'min(960px, 100%)',
        background: '#0F172A',
        color: '#E2E8F0',
        borderRadius: 12,
        border: '1px solid rgba(255,255,255,0.12)',
        boxShadow: '0 18px 50px rgba(15,23,42,0.28)',
        padding: '14px',
        display: 'grid',
        gridTemplateColumns: 'auto minmax(0, 1fr) auto',
        gap: 12,
        alignItems: 'center',
        pointerEvents: 'auto',
      }}>
        <div style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          background: 'rgba(255,106,1,0.18)',
          color: '#FB923C',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <ShieldCheck size={20} />
        </div>
        <div>
          <div style={{ fontWeight: 900, marginBottom: 2 }}>ประกาศการใช้ข้อมูลและบริการภายนอก</div>
          <div style={{ fontSize: '0.84rem', lineHeight: 1.55, color: '#CBD5E1' }}>
            เว็บไซต์ใช้ Firebase และอาจแสดงลิงก์/สื่อจาก Google Drive, Google Photos, Google Maps, YouTube, TikTok และ Facebook เพื่อให้บริการโรงเรียน
            <Link to="/privacy" style={{ color: '#FDBA74', fontWeight: 800, marginLeft: 6, textDecoration: 'none' }}>
              อ่านนโยบาย
            </Link>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={accept} style={{
            border: 'none',
            borderRadius: 8,
            background: '#FF6A01',
            color: 'white',
            fontWeight: 900,
            padding: '9px 12px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}>
            รับทราบ
          </button>
          <button onClick={dismiss} aria-label="ปิดประกาศ" style={{
            width: 36,
            height: 36,
            border: '1px solid rgba(255,255,255,0.16)',
            borderRadius: 8,
            background: 'transparent',
            color: '#CBD5E1',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <X size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
