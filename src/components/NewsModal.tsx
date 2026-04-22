import { useEffect } from 'react';
import { getDrivePreviewUrl } from '../utils/imageUtils';
import DriveImage from './DriveImage';
import { X, Calendar, Tag, Image as ImageIcon, ExternalLink, FileText, Globe, Video } from 'lucide-react';

export interface NewsItem {
  id: string;
  title: string;
  content: string;
  date: string;
  category?: string;
  imageUrl?: string;
  imageType?: 'image' | 'pdf';
  albumUrl?: string;
  tiktokUrl?: string;
  websiteUrl?: string;
  documentUrl?: string;
}

interface Props {
  post: NewsItem | null;
  onClose: () => void;
}

export default function NewsModal({ post, onClose }: Props) {
  useEffect(() => {
    if (!post) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [post, onClose]);

  if (!post) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9997,
        background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1.5rem', animation: 'fadeIn 0.25s ease',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'white', borderRadius: '28px',
          maxWidth: post.imageUrl ? '1100px' : '640px', width: '100%',
          maxHeight: '92vh', overflow: 'hidden', position: 'relative',
          boxShadow: '0 30px 80px rgba(255,106,1,0.25)',
          animation: 'modalIn 0.35s cubic-bezier(0.4,0,0.2,1)',
          display: 'grid',
          gridTemplateColumns: post.imageUrl ? 'minmax(0, 1.1fr) minmax(0, 1fr)' : '1fr',
        }}
      >
        <button onClick={onClose} aria-label="ปิด" style={{
          position: 'absolute', top: '16px', right: '16px', zIndex: 5,
          background: 'rgba(255,255,255,0.95)', border: 'none', borderRadius: '50%',
          width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 20px rgba(0,0,0,0.15)', cursor: 'pointer',
        }}>
          <X size={22} color="#FF6A01" />
        </button>

        {post.imageUrl && (
          <div style={{
            background: '#FFF7ED',
            display: 'flex', alignItems: post.imageType === 'pdf' ? 'stretch' : 'flex-start', justifyContent: 'center',
            padding: post.imageType === 'pdf' ? '0' : '1.5rem', overflowY: post.imageType === 'pdf' ? 'hidden' : 'auto',
          }}>
            {post.imageType === 'pdf' ? (
              <iframe
                src={getDrivePreviewUrl(post.imageUrl)}
                width="100%"
                height="100%"
                style={{ border: 'none' }}
                title="PDF Content"
              />
            ) : (
              <DriveImage
                src={post.imageUrl}
                alt={post.title}
                style={{ width: '100%', height: 'auto', objectFit: 'contain', borderRadius: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.08)', display: 'block' }}
              />
            )}
          </div>
        )}

        <div style={{ padding: '2.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '1.25rem' }}>
            {post.category && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#FFF7ED', color: '#FF6A01', padding: '6px 14px', borderRadius: '50px', fontSize: '0.78rem', fontWeight: 800 }}>
                <Tag size={12} /> {post.category}
              </span>
            )}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#F1F5F9', color: '#475569', padding: '6px 14px', borderRadius: '50px', fontSize: '0.78rem', fontWeight: 700 }}>
              <Calendar size={12} /> {post.date}
            </span>
          </div>

          <h2 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#0F172A', lineHeight: 1.25, marginBottom: '1.5rem' }}>
            {post.title}
          </h2>

          {post.content && (
            <p style={{ fontSize: '1rem', color: '#334155', lineHeight: 1.85, whiteSpace: 'pre-wrap', marginBottom: '2rem' }}>
              {post.content}
            </p>
          )}

          {post.albumUrl && (
            <div style={{ marginTop: '1rem', background: '#FFF7ED', padding: '1.5rem', borderRadius: '24px', border: '1px solid #FFEDD5', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ background: 'white', color: '#FF6A01', padding: '10px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(255,106,1,0.1)' }}>
                  <ImageIcon size={22} />
                </div>
                <div>
                  <h5 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#1e293b' }}>ภาพกิจกรรมเพิ่มเติม</h5>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>รับชมภาพทั้งหมดผ่านอัลบั้ม Google Photos</p>
                </div>
              </div>
              <a href={post.albumUrl} target="_blank" rel="noopener noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                  background: 'linear-gradient(135deg,#FF6A01,#FB923C)', color: 'white',
                  padding: '1rem', borderRadius: '14px', fontWeight: 800, fontSize: '1rem',
                  textDecoration: 'none', boxShadow: '0 8px 20px rgba(255,106,1,0.25)',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={e => e.currentTarget.style.transform='scale(1.02)'}
                onMouseOut={e => e.currentTarget.style.transform='scale(1)'}
              >
                ดูอัลบั้มภาพบน Google Photos <ExternalLink size={16} />
              </a>
            </div>
          )}

          {post.imageType === 'pdf' && post.imageUrl && (
            <a href={post.imageUrl} target="_blank" rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '10px',
                background: '#F1F5F9', color: '#475569',
                padding: '0.9rem 1.6rem', borderRadius: '14px', fontWeight: 800, fontSize: '0.95rem',
                textDecoration: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                alignSelf: 'flex-start', marginTop: '1rem'
              }}>
              <FileText size={18} /> เปิดไฟล์ PDF ในหน้าต่างใหม่ <ExternalLink size={14} />
            </a>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '1rem' }}>
            {post.tiktokUrl && post.tiktokUrl.trim() !== '' && (
              <a href={post.tiktokUrl} target="_blank" rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '8px',
                  background: '#000000', color: 'white',
                  padding: '0.7rem 1.2rem', borderRadius: '12px', fontWeight: 700, fontSize: '0.85rem',
                  textDecoration: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}>
                <Video size={16} /> TikTok
              </a>
            )}
            {post.websiteUrl && post.websiteUrl.trim() !== '' && (
              <a href={post.websiteUrl} target="_blank" rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '8px',
                  background: '#3B82F6', color: 'white',
                  padding: '0.7rem 1.2rem', borderRadius: '12px', fontWeight: 700, fontSize: '0.85rem',
                  textDecoration: 'none', boxShadow: '0 4px 12px rgba(59,130,246,0.2)'
                }}>
                <Globe size={16} /> ไปยังเว็บไซต์
              </a>
            )}
            {post.documentUrl && post.documentUrl.trim() !== '' && (
              <a href={post.documentUrl} target="_blank" rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '8px',
                  background: '#10B981', color: 'white',
                  padding: '0.7rem 1.2rem', borderRadius: '12px', fontWeight: 700, fontSize: '0.85rem',
                  textDecoration: 'none', boxShadow: '0 4px 12px rgba(16,185,129,0.2)'
                }}>
                <FileText size={16} /> เอกสารแนบ
              </a>
            )}
          </div>

          <div style={{ marginTop: 'auto', paddingTop: '1.5rem', borderTop: '1px solid #FFEDD5', textAlign: 'right' }}>
            <button onClick={onClose} style={{
              background: 'transparent', color: '#FF6A01', border: '2px solid #FF6A01',
              padding: '0.6rem 1.6rem', borderRadius: '12px', fontWeight: 700, cursor: 'pointer',
            }}>
              ปิดหน้าต่าง
            </button>
          </div>
        </div>

        <style>{`
          @keyframes modalIn { from { opacity: 0; transform: translateY(20px) scale(0.97); } to { opacity: 1; transform: none; } }
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        `}</style>
      </div>
    </div>
  );
}
