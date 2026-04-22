
import { Image as ImageIcon, Link as LinkIcon, CheckCircle, AlertTriangle, ExternalLink } from 'lucide-react';
import { isGooglePhotosUrl } from '../utils/imageUtils';

interface GooglePhotosInputProps {
  value: string;
  onChange: (val: string) => void;
  label: string;
  placeholder?: string;
}

export default function GooglePhotosInput({
  value,
  onChange,
  label,
  placeholder
}: GooglePhotosInputProps) {
  const isValid = isGooglePhotosUrl(value);

  return (
    <div style={{ marginBottom: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>
          {label}
        </label>
        {value && isValid && (
          <span style={{ fontSize: '0.7rem', color: '#22C55E', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <CheckCircle size={12} /> Google Photos Verified
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>
            <LinkIcon size={16} />
          </div>
          <input
            type="text"
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder || 'วางลิงก์อัลบั้ม Google Photos...'}
            style={{
              width: '100%', padding: '12px 14px 12px 38px',
              borderRadius: '12px', fontSize: '0.9rem',
              border: value ? (isValid ? '2px solid #22C55E' : '2px solid #EF4444') : '1px solid #E2E8F0',
              background: 'white', transition: 'all 0.3s ease',
              outline: 'none',
            }}
          />
          {value && (
            <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)' }}>
              {isValid
                ? <CheckCircle size={16} color="#22C55E" />
                : <AlertTriangle size={16} color="#EF4444" />
              }
            </div>
          )}
        </div>
        {value && isValid && (
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: '0 16px', borderRadius: '12px', border: '1px solid #E2E8F0',
              background: '#FFF7ED',
              color: '#FF6A01',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
              fontSize: '0.8rem', fontWeight: 700, transition: 'all 0.2s ease',
              whiteSpace: 'nowrap', textDecoration: 'none'
            }}
          >
            <ExternalLink size={14} /> เปิดดูอัลบั้ม
          </a>
        )}
      </div>

      {value && !isValid && (
        <div style={{ marginTop: '6px', fontSize: '0.75rem', color: '#EF4444', fontWeight: 600 }}>
          รูปแบบลิงก์ไม่ถูกต้อง (ควรเป็น https://photos.app.goo.gl/... หรือ photos.google.com/share/...)
        </div>
      )}

      {/* Album Preview Card Simulation */}
      {value && isValid && (
        <div style={{
          marginTop: '12px', borderRadius: '16px', overflow: 'hidden',
          border: '2px solid #FFF7ED', background: 'linear-gradient(135deg, #FF6A01, #FB923C)',
          padding: '1.5rem', color: 'white', display: 'flex', alignItems: 'center', gap: '1rem'
        }}>
          <div style={{ background: 'rgba(255,255,255,0.2)', padding: '12px', borderRadius: '12px' }}>
            <ImageIcon size={24} color="white" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>Google Photos Album Detected</div>
            <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>รูปภาพจะถูกดึงจากลิงก์อัลบั้มนี้เพื่อแสดงผลในหน้า Gallery</div>
          </div>
        </div>
      )}
    </div>
  );
}
