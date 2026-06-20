import { ExternalLink, MessageCircle } from 'lucide-react';

interface FacebookPostCardProps {
  url?: string;
  title?: string;
  compact?: boolean;
  preview?: boolean;
}

export default function FacebookPostCard({ url, title, compact = false, preview = false }: FacebookPostCardProps) {
  const cleanUrl = url?.trim();
  if (!cleanUrl) return null;

  if (preview) {
    return (
      <div style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(135deg,#1877F2,#60A5FA)',
      }}>
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: 900,
          fontSize: '4rem',
          opacity: 0.22,
        }}>
          f
        </div>
        <div style={{
          position: 'absolute',
          inset: '24px 24px 68px',
          zIndex: 1,
          borderRadius: 22,
          background: 'rgba(255,255,255,0.92)',
          boxShadow: '0 18px 50px rgba(15,23,42,0.18)',
          padding: '1.35rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#1877F2', fontWeight: 900 }}>
            <MessageCircle size={22} />
            Facebook
          </div>
          <div style={{
            color: '#0F172A',
            fontWeight: 900,
            fontSize: '1.08rem',
            lineHeight: 1.35,
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {title || 'โพสต์ประชาสัมพันธ์จากโรงเรียนบ้านคลองมดแดง'}
          </div>
        </div>
        <div style={{
          position: 'absolute',
          left: 14,
          right: 14,
          bottom: 14,
          zIndex: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'rgba(255,255,255,0.94)',
          color: '#1877F2',
          borderRadius: 999,
          padding: '8px 12px',
          fontWeight: 900,
          fontSize: '0.82rem',
          boxShadow: '0 8px 24px rgba(15,23,42,0.15)',
        }}>
          <MessageCircle size={15} />
          ดูโพสต์ Facebook
          <ExternalLink size={13} style={{ marginLeft: 'auto' }} />
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <a
        href={cleanUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={e => e.stopPropagation()}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          textDecoration: 'none',
          background: '#EFF6FF',
          color: '#1877F2',
          border: '1px solid #BFDBFE',
          borderRadius: 14,
          padding: '10px 12px',
          fontWeight: 800,
          fontSize: '0.86rem',
        }}
      >
        <MessageCircle size={16} />
        โพสต์ Facebook
        <ExternalLink size={13} style={{ marginLeft: 'auto' }} />
      </a>
    );
  }

  return (
    <div style={{
      background: '#F8FAFC',
      border: '1px solid #DBEAFE',
      borderRadius: 22,
      padding: '1rem',
      marginTop: '1rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div style={{
          width: 42,
          height: 42,
          borderRadius: 14,
          background: '#1877F2',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 900,
          fontSize: '1.4rem',
        }}>
          f
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: '#0F172A', fontWeight: 900 }}>โพสต์ Facebook</div>
          <div style={{ color: '#64748B', fontSize: '0.82rem' }}>{title || 'โรงเรียนบ้านคลองมดแดง'}</div>
        </div>
      </div>

      <div style={{
        background: 'linear-gradient(135deg,#EFF6FF,#FFFFFF)',
        borderRadius: 16,
        border: '1px solid #BFDBFE',
        padding: '1.25rem',
      }}>
        <div style={{ color: '#0F172A', fontWeight: 900, fontSize: '1rem', marginBottom: 6 }}>
          {title || 'โพสต์ประชาสัมพันธ์จากโรงเรียนบ้านคลองมดแดง'}
        </div>
        <div style={{ color: '#475569', fontSize: '0.9rem', lineHeight: 1.7 }}>
          เปิดดูรูปภาพ รายละเอียด และความคิดเห็นต่อได้บน Facebook
        </div>
      </div>

      <a
        href={cleanUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          marginTop: 12,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          background: '#1877F2',
          color: 'white',
          padding: '0.8rem 1.1rem',
          borderRadius: 12,
          fontWeight: 800,
          fontSize: '0.9rem',
          textDecoration: 'none',
        }}
      >
        เปิดโพสต์บน Facebook <ExternalLink size={15} />
      </a>
    </div>
  );
}
