// Share toolbar for news/announcements — LINE, Facebook, copy link, QR, native share
import { useState, useEffect } from 'react';
import { Link2, QrCode, Check, Share2, X, Download } from 'lucide-react';
import QRCode from 'qrcode';
import { toast } from './GlobalToast';
import { SCHOOL_NAME } from '../config/siteLinks';

type Props = {
  /** Absolute or relative URL to share. Defaults to current page URL. */
  url?: string;
  /** Text shown when sharing (post title). */
  title?: string;
  /** Compact mode = icon-only buttons */
  compact?: boolean;
};

const LineIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.64.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
  </svg>
);
const FacebookIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c5.05-.5 9-4.76 9-9.95z" />
  </svg>
);

export default function ShareBar({ url, title = '', compact = false }: Props) {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [qrData, setQrData] = useState('');

  const shareUrl = url
    ? (url.startsWith('http') ? url : `${window.location.origin}${url}`)
    : window.location.href;

  const shareText = title ? `${title} — ${SCHOOL_NAME}` : SCHOOL_NAME;

  useEffect(() => {
    if (!showQr) return;
    QRCode.toDataURL(shareUrl, { width: 480, margin: 2, color: { dark: '#0F172A', light: '#FFFFFF' } })
      .then(setQrData)
      .catch(err => console.error('QR generation failed', err));
  }, [showQr, shareUrl]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success('คัดลอกลิงก์แล้ว');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for browsers without clipboard permission
      const input = document.createElement('input');
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      toast.success('คัดลอกลิงก์แล้ว');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shareLine = () => {
    window.open(
      `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`,
      '_blank', 'noopener,width=600,height=600',
    );
  };

  const shareFacebook = () => {
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
      '_blank', 'noopener,width=600,height=600',
    );
  };

  const nativeShare = async () => {
    if (!navigator.share) return;
    try {
      await navigator.share({ title: shareText, text: shareText, url: shareUrl });
    } catch {
      /* user cancelled */
    }
  };

  const downloadQr = () => {
    if (!qrData) return;
    const a = document.createElement('a');
    a.href = qrData;
    a.download = `qr_${(title || 'kmd').replace(/[^\w฀-๿]+/g, '_').slice(0, 40)}.png`;
    a.click();
  };

  const hasNativeShare = typeof navigator !== 'undefined' && !!navigator.share;

  return (
    <>
      <div style={{
        display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
        padding: compact ? 0 : '12px 14px',
        background: compact ? 'transparent' : '#FFF7ED',
        borderRadius: compact ? 0 : 12,
        border: compact ? 'none' : '1px solid #FFEDD5',
      }}>
        {!compact && (
          <span style={{ fontWeight: 800, color: '#7C2D12', fontSize: '0.85rem', marginRight: 2 }}>
            📣 แชร์ข่าวนี้:
          </span>
        )}

        <button onClick={shareLine} title="แชร์ทาง LINE" style={btn('#06C755')}>
          <LineIcon size={16} />{!compact && 'LINE'}
        </button>

        <button onClick={shareFacebook} title="แชร์ทาง Facebook" style={btn('#1877F2')}>
          <FacebookIcon size={16} />{!compact && 'Facebook'}
        </button>

        <button onClick={copyLink} title="คัดลอกลิงก์" style={btn(copied ? '#10B981' : '#64748B')}>
          {copied ? <Check size={16} /> : <Link2 size={16} />}
          {!compact && (copied ? 'คัดลอกแล้ว' : 'คัดลอกลิงก์')}
        </button>

        <button onClick={() => setShowQr(true)} title="สร้าง QR Code" style={btn('#7C3AED')}>
          <QrCode size={16} />{!compact && 'QR Code'}
        </button>

        {hasNativeShare && (
          <button onClick={nativeShare} title="แชร์" style={btn('#FF6A01')}>
            <Share2 size={16} />{!compact && 'แชร์อื่นๆ'}
          </button>
        )}
      </div>

      {/* QR modal */}
      {showQr && (
        <div
          onClick={() => setShowQr(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.65)',
            backdropFilter: 'blur(4px)', zIndex: 99998,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
          }}
        >
          <div onClick={e => e.stopPropagation()} style={{
            background: 'white', borderRadius: 20, padding: '1.5rem',
            maxWidth: 360, width: '100%', textAlign: 'center', position: 'relative',
          }}>
            <button onClick={() => setShowQr(false)} aria-label="ปิด" style={{
              position: 'absolute', top: 12, right: 12, background: '#FFF7ED',
              border: 'none', borderRadius: '50%', width: 34, height: 34,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <X size={18} color="#FF6A01" />
            </button>

            <div style={{ fontWeight: 900, color: '#0F172A', marginBottom: 4 }}>📱 สแกนเพื่อเปิด</div>
            {title && (
              <div style={{ fontSize: '0.85rem', color: '#64748B', marginBottom: 14, lineHeight: 1.5 }}>
                {title}
              </div>
            )}

            {qrData ? (
              <img src={qrData} alt="QR Code" style={{ width: '100%', maxWidth: 260, borderRadius: 12 }} />
            ) : (
              <div style={{ padding: '3rem', color: '#94A3B8' }}>กำลังสร้าง QR…</div>
            )}

            <div style={{
              marginTop: 12, padding: '8px 10px', background: '#F8FAFC', borderRadius: 8,
              fontSize: '0.72rem', color: '#64748B', wordBreak: 'break-all',
            }}>
              {shareUrl}
            </div>

            <button onClick={downloadQr} disabled={!qrData} style={{
              marginTop: 12, width: '100%', padding: '10px', borderRadius: 10, border: 'none',
              background: 'linear-gradient(135deg,#FF6A01,#FB923C)', color: 'white',
              fontWeight: 800, cursor: qrData ? 'pointer' : 'wait',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <Download size={16} /> ดาวน์โหลด QR (PNG)
            </button>
            <div style={{ marginTop: 8, fontSize: '0.72rem', color: '#94A3B8' }}>
              ใช้ติดบอร์ด · แนบในจดหมายข่าว · ส่งให้ผู้ปกครอง
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const btn = (color: string): React.CSSProperties => ({
  background: color, color: 'white', border: 'none', borderRadius: 8,
  padding: '8px 12px', fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 38,
});
