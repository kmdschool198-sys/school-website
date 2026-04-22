import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { collection, query, orderBy, where, onSnapshot, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { 
  ChevronRight, 
  Home as HomeIcon, 
  Calendar,
  Image as ImageIcon
} from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import '../App.css';
import { sidebarMenus, pageContent } from '../data/pageContent';
import { getDirectImageUrl, DEFAULT_PLACEHOLDER, getDrivePreviewUrl } from '../utils/imageUtils';
import { FileText, ExternalLink, Video, Globe } from 'lucide-react';

function ContentPage() {
  const { slug } = useParams<{ slug: string }>();
  const activeSlug = slug || '';
  const [firePersonnel, setFirePersonnel] = useState<any[]>([]);
  const [firebasePosts, setFirebasePosts] = useState<any[]>([]);
  const [dynamicPage, setDynamicPage] = useState<{title?: string, content?: string, bannerUrl?: string, blocks?: any[]} | null>(null);

  useEffect(() => {
    let unsubPosts: any = null;
    let unsubPers: any = null;
    let unsubPage: any = null;

    // Dynamic Page Content snapshot
    unsubPage = onSnapshot(doc(db, 'pages', activeSlug), (snapshot) => {
      if (snapshot.exists()) {
        setDynamicPage(snapshot.data() as any);
      } else {
        setDynamicPage(null);
      }
    });

    // News snapshot
    if (activeSlug === 'pr-news' || activeSlug === 'e-newsletter' || activeSlug === 'school-awards') {
      const catMap: Record<string, string> = {
        'pr-news': 'ข่าวประชาสัมพันธ์',
        'e-newsletter': 'จดหมายข่าว',
        'school-awards': 'ผลงานรางวัล'
      };
      
      const q = query(
        collection(db, 'posts'), 
        where('category', '==', catMap[activeSlug]),
        orderBy('date', 'desc')
      );

      unsubPosts = onSnapshot(q, (snapshot) => {
        const results: any[] = [];
        snapshot.forEach(doc => results.push({ id: doc.id, ...doc.data() }));
        setFirebasePosts(results);
      }, (err) => {
        console.error("Posts snapshot error:", err);
      });
    }

    // Personnel snapshot logic (Category mapping)
    const slugToCat: Record<string, string> = {
      'directors': 'director',
      'board': 'board',
      'teachers': 'teacher',
      'academic-affairs': 'academic',
      'budget': 'budget',
      'personnel': 'personnel',
      'general-affairs': 'general',
      'support': 'support'
    };

    const targetCat = slugToCat[activeSlug];
    if (targetCat) {
      const q = query(collection(db, 'personnel'), where('category', '==', targetCat));
      unsubPers = onSnapshot(q, (snapshot) => {
        const results: any[] = [];
        snapshot.forEach(doc => results.push({ id: doc.id, ...doc.data() }));
        results.sort((a, b) => (a.order || 0) - (b.order || 0));
        setFirePersonnel(results);
      });
    } else {
      setFirePersonnel([]);
    }

    window.scrollTo(0, 0);
    return () => {
      if (unsubPosts) unsubPosts();
      if (unsubPers) unsubPers();
      if (unsubPage) unsubPage();
    };
  }, [activeSlug]);
  
  // Find which category this route belongs to
  let catKey = Object.keys(sidebarMenus)[0]; 
  Object.entries(sidebarMenus).forEach(([key, val]) => {
    if (val.links.some(l => {
      const fullPath = l.path.startsWith('/') ? l.path : `/page/${l.path}`;
      const currentFullPath = location.pathname;
      return fullPath === currentFullPath || l.path === activeSlug;
    })) {
      catKey = key;
    }
  });
  
  const currentSidebar = sidebarMenus[catKey];
  const staticData = pageContent[activeSlug] || {
    title: 'กำลังอัปเดตข้อมูล',
    subtitle: 'โรงเรียนบ้านคลองมดแดง',
    type: 'text',
    content: 'ขออภัย กำลังอยู่ระหว่างการปรับปรุงเนื้อหาในส่วนนี้'
  };

  const data = {
    ...staticData,
    title: dynamicPage?.title || staticData.title,
    content: dynamicPage?.content || staticData.content
  };

  const renderFormattedText = (text: string) => {
    const lines = text.split('\n');
    const elements: any[] = [];
    let listBuffer: string[] = [];

    const flushList = (key: string) => {
      if (listBuffer.length === 0) return;
      const items = [...listBuffer];
      listBuffer = [];
      elements.push(
        <ul key={key} style={{ listStyle: 'none', padding: 0, margin: '0.5rem 0 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {items.map((item, idx) => (
            <li key={idx} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', background: '#FFFBF5', padding: '0.75rem 1rem', borderRadius: '12px', borderLeft: '3px solid #FB923C' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#FF6A01', marginTop: '0.6rem', flexShrink: 0 }} />
              <span style={{ color: '#334155', lineHeight: 1.75, fontSize: '1rem' }}>{item}</span>
            </li>
          ))}
        </ul>
      );
    };

    lines.forEach((line, i) => {
      const trimmed = line.trim();
      if (!trimmed) {
        flushList(`fl-${i}`);
        return;
      }

      // Bullet list: starts with - or •
      if (/^[-•]\s+/.test(trimmed)) {
        listBuffer.push(trimmed.replace(/^[-•]\s+/, ''));
        return;
      }
      flushList(`fl-${i}`);

      // Section header: "X)" or "X." alone (no colon → pure section title)
      const isPureNumberedHeader = /^[๐-๙๑๒๓๔๕๖๗๘๙0-9]+[\.\)]\s*[^\:]*$/.test(trimmed) && !trimmed.includes(':') && trimmed.length < 80;
      if (isPureNumberedHeader && /^[๐-๙๑๒๓๔๕๖๗๘๙0-9]+[\.\)]/.test(trimmed)) {
        elements.push(
          <h3 key={i} style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0F172A', marginTop: '2rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ width: '8px', height: '28px', background: 'linear-gradient(180deg,#FF6A01,#FB923C)', borderRadius: '4px' }} />
            {trimmed}
          </h3>
        );
        return;
      }

      // "X) Label: value"  OR  "Label: value"  → info card
      if (trimmed.includes(':')) {
        const idx = trimmed.indexOf(':');
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        elements.push(
          <div key={i} style={{
            display: 'grid', gridTemplateColumns: 'minmax(160px, 220px) 1fr', gap: '1rem',
            padding: '0.9rem 1.25rem', marginBottom: '0.6rem',
            background: 'linear-gradient(135deg,#FFFFFF,#FFF7ED)',
            borderRadius: '14px', border: '1px solid #FFEDD5',
            transition: 'transform 0.2s ease',
          }}>
            <span style={{ fontWeight: 800, color: '#C2410C', fontSize: '0.95rem' }}>{key}</span>
            <span style={{ color: '#334155', fontSize: '1rem', lineHeight: 1.7 }}>{val}</span>
          </div>
        );
        return;
      }

      // Plain paragraph
      elements.push(
        <p key={i} style={{ marginBottom: '1rem', color: '#334155', lineHeight: 1.9, fontSize: '1.05rem', textAlign: 'justify', textIndent: '1.5rem' }}>{trimmed}</p>
      );
    });

    flushList('fl-end');
    return elements;
  };

  const renderBlocks = (blocks: any[]) => (
    <div className="animate-fade-in d-flex flex-column gap-3">
      {blocks.map((b, i) => {
        if (b.type === 'heading') {
          return <h3 key={b.id || i} style={{ fontSize: '1.5rem', fontWeight: 800, color: '#FF6A01', marginTop: '1.5rem', paddingLeft: '1rem', borderLeft: '4px solid #FF6A01' }}>{b.text}</h3>;
        }
        if (b.type === 'paragraph') {
          return <p key={b.id || i} style={{ color: '#334155', lineHeight: 1.9, fontSize: '1.05rem', textAlign: 'justify', whiteSpace: 'pre-wrap', margin: 0 }}>{b.text}</p>;
        }
        if (b.type === 'image') {
          const isPdf = b.url?.toLowerCase().includes('.pdf') || b.fileType === 'pdf';
          return (
            <figure key={b.id || i} style={{ margin: '1.5rem 0', textAlign: 'center' }}>
              {isPdf ? (
                <div style={{ height: '500px', width: '100%', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 15px 40px rgba(0,0,0,0.1)' }}>
                  <iframe src={getDrivePreviewUrl(b.url)} width="100%" height="100%" style={{ border: 'none' }} title="PDF Content" />
                </div>
              ) : (
                <img src={getDirectImageUrl(b.url)} alt={b.caption || ''} style={{ maxWidth: '100%', borderRadius: '20px', boxShadow: '0 15px 40px rgba(255,106,1,0.12)' }} onError={e => (e.currentTarget.src = DEFAULT_PLACEHOLDER)} />
              )}
              {b.caption && <figcaption style={{ marginTop: '0.75rem', fontSize: '0.9rem', color: '#64748b', fontStyle: 'italic' }}>{b.caption}</figcaption>}
            </figure>
          );
        }
        if (b.type === 'divider') {
          return <hr key={b.id || i} style={{ border: 0, borderTop: '2px dashed #FFEDD5', margin: '1.5rem 0' }} />;
        }
        return null;
      })}
    </div>
  );

  const renderContent = () => {
    if (dynamicPage?.blocks && dynamicPage.blocks.length > 0) {
      return renderBlocks(dynamicPage.blocks);
    }
    if (data.type === 'text') {
      return <div className="animate-fade-in">{renderFormattedText(data.content)}</div>;
    }

    if (data.type === 'personnel' || data.type === 'personnel-groups') {
      const displayPersonnel = firePersonnel.length > 0 ? firePersonnel : (data.personnelData || []);
      const head = displayPersonnel.find(p => p.isHead);
      const others = displayPersonnel.filter(p => !p.isHead);

      const renderPersonCard = (person: any, isBig = false) => (
        <div key={person.id || person.name} style={{ 
          background: 'white', borderRadius: '24px', overflow: 'hidden', 
          boxShadow: '0 4px 20px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9',
          textAlign: 'center', transition: 'all 0.3s ease'
        }}>
          <div style={{ height: isBig ? '450px' : '320px', background: '#f8fafc', overflow: 'hidden' }}>
            <img src={getDirectImageUrl(person.image || person.imageUrl)} alt={person.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => e.currentTarget.src = DEFAULT_PLACEHOLDER} />
          </div>
          <div style={{ padding: '1.5rem' }}>
            <h4 style={{ fontSize: isBig ? '1.4rem' : '1.1rem', fontWeight: 800, color: '#1e293b', marginBottom: '0.4rem' }}>{person.name}</h4>
            <p style={{ fontSize: '0.9rem', color: '#FF6A01', fontWeight: 700, margin: 0 }}>{person.position}</p>
          </div>
        </div>
      );

      return (
        <div className="animate-fade-in">
          {head && (
            <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
               <div style={{ display: 'inline-block', padding: '0.5rem 2rem', background: '#FFF7ED', color: '#C2410C', borderRadius: '50px', fontSize: '0.85rem', fontWeight: 800, marginBottom: '2rem', border: '1px solid #FFEDD5' }}>หัวหน้าส่วนงาน</div>
               <div style={{ maxWidth: '400px', margin: '0 auto' }}>{renderPersonCard(head, true)}</div>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '2rem' }}>
            {(others.length > 0 ? others : displayPersonnel).map(person => renderPersonCard(person))}
          </div>
        </div>
      );
    }

    if (data.type === 'news') {
      return (
        <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '2rem' }}>
          {firebasePosts.map((post) => (
            <div key={post.id} style={{ background: 'white', borderRadius: '24px', overflow: 'hidden', border: '1px solid #f1f5f9', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
               <div style={{ height: '200px', background: '#f8fafc' }}>
                  <img src={getDirectImageUrl(post.imageUrl)} alt={post.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => e.currentTarget.src = DEFAULT_PLACEHOLDER} />
               </div>
               <div style={{ padding: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '0.8rem', marginBottom: '0.8rem' }}>
                    <Calendar size={14} /> {post.date}
                  </div>
                  <h4 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '1rem', color: '#1e293b', lineHeight: 1.4 }}>{post.title}</h4>
                  <p style={{ fontSize: '0.9rem', color: '#64748b', lineHeight: 1.6, marginBottom: '1.5rem' }}>{post.content.substring(0, 90)}...</p>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <Link to="#" style={{ color: '#FF6A01', fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}>
                      อ่านรายละเอียด <ChevronRight size={16} />
                    </Link>
                    {post.imageType === 'pdf' && (
                      <a href={post.imageUrl} target="_blank" rel="noreferrer" style={{ color: '#64748b', fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}>
                        <FileText size={16} /> ดู PDF <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '1rem' }}>
                    {post.albumUrl && post.albumUrl.trim() !== '' && (
                      <div style={{ color: '#FF6A01', fontSize: '0.8rem', textDecoration: 'none', background: '#FFF7ED', padding: '4px 8px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px', border: '1px solid #FFEDD5' }}>
                        <ImageIcon size={14} /> อัลบั้มภาพ
                      </div>
                    )}
                    {post.tiktokUrl && post.tiktokUrl.trim() !== '' && (
                      <a href={post.tiktokUrl} target="_blank" rel="noreferrer" style={{ color: '#000', fontSize: '0.8rem', textDecoration: 'none', background: '#f1f5f9', padding: '4px 8px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Video size={14} /> TikTok
                      </a>
                    )}
                    {post.websiteUrl && post.websiteUrl.trim() !== '' && (
                      <a href={post.websiteUrl} target="_blank" rel="noreferrer" style={{ color: '#3B82F6', fontSize: '0.8rem', textDecoration: 'none', background: '#f1f5f9', padding: '4px 8px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Globe size={14} /> เว็บไซต์
                      </a>
                    )}
                    {post.documentUrl && post.documentUrl.trim() !== '' && (
                      <a href={post.documentUrl} target="_blank" rel="noreferrer" style={{ color: '#10B981', fontSize: '0.8rem', textDecoration: 'none', background: '#f1f5f9', padding: '4px 8px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <FileText size={14} /> เอกสาร
                      </a>
                    )}
                  </div>
               </div>
            </div>
          ))}
          {firebasePosts.length === 0 && (
            <div style={{ textAlign: 'center', gridColumn: '1 / -1', padding: '4rem', background: '#f8fafc', borderRadius: '24px' }}>
              <p style={{ color: '#94a3b8', fontSize: '1.1rem' }}>ไม่พบข้อมูลในหมวดหมู่นี้</p>
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <div style={{ backgroundColor: '#F8FAFC', minHeight: '100vh' }}>
      <Header />

      {/* Hero Banner Area */}
      <section style={{ height: '350px', background: dynamicPage?.bannerUrl ? `linear-gradient(135deg, rgba(255,106,1,0.85), rgba(251,146,60,0.7)), url(${getDirectImageUrl(dynamicPage.bannerUrl)}) center/cover` : 'linear-gradient(135deg, #FF6A01 0%, #FB923C 100%)', display: 'flex', alignItems: 'center', position: 'relative', overflow: 'hidden' }}>
        {!dynamicPage?.bannerUrl && (
          <div style={{ position: 'absolute', opacity: 0.15, right: '-50px', bottom: '-50px', transform: 'rotate(-15deg)' }}>
             <GraduationCap size={400} color="white" />
          </div>
        )}
        <div className="container" style={{ position: 'relative', zIndex: 10 }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'rgba(255,255,255,0.8)', fontSize: '0.9rem', marginBottom: '1rem', fontWeight: 600 }}>
             <HomeIcon size={16} /> <ChevronRight size={14} /> {catKey}
           </div>
           <h1 style={{ color: 'white', fontSize: '3.5rem', fontWeight: 900, marginBottom: '0', letterSpacing: '-1px' }}>{data.title}</h1>
           <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '1.2rem', marginTop: '1rem' }}>{data.subtitle}</p>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="container" style={{ marginTop: '-4rem', paddingBottom: '8rem', position: 'relative', zIndex: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 320px) 1fr', gap: '3rem', alignItems: 'start' }}>
          
          {/* MWIT Style Sidebar */}
          <aside style={{ position: 'sticky', top: '100px' }}>
            <div style={{ background: 'white', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 10px 20px rgba(0,0,0,0.03)', border: '1px solid #f1f5f9' }}>
               <div style={{ padding: '2rem', background: '#FF6A01', color: 'white' }}>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>{catKey}</h3>
               </div>
               <div style={{ padding: '1rem 0' }}>
                  {currentSidebar.links.map(link => (
                    <Link 
                      key={link.path} 
                      to={link.path.startsWith('/') ? link.path : `/page/${link.path}`} 
                      style={{ 
                        display: 'flex', alignItems: 'center', gap: '12px', padding: '1rem 2rem', 
                        textDecoration: 'none', 
                        color: (activeSlug === link.path || (link.path.startsWith('/') && location.pathname === link.path)) ? '#FF6A01' : '#64748b',
                        fontWeight: (activeSlug === link.path || (link.path.startsWith('/') && location.pathname === link.path)) ? 700 : 500,
                        background: (activeSlug === link.path || (link.path.startsWith('/') && location.pathname === link.path)) ? '#FFF7ED' : 'transparent',
                        borderLeft: (activeSlug === link.path || (link.path.startsWith('/') && location.pathname === link.path)) ? '4px solid #FF6A01' : '4px solid transparent',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseOver={e => { if (activeSlug !== link.path) e.currentTarget.style.color='#FF6A01'; }}
                      onMouseOut={e => { if (activeSlug !== link.path) e.currentTarget.style.color='#64748b'; }}
                    >
                      {link.label}
                    </Link>
                  ))}
               </div>
            </div>

            <div style={{ marginTop: '2rem', padding: '2rem', background: 'linear-gradient(to bottom right, #FFFFFF, #FFF7ED)', borderRadius: '24px', border: '1px solid #FFEDD5', textAlign: 'center' }}>
               <h5 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#C2410C', marginBottom: '0.8rem' }}>ติดต่อสอบถาม</h5>
               <p style={{ fontSize: '0.85rem', color: '#9a3412', lineHeight: 1.6, margin: 0 }}>
                 ฝ่ายบริหารงานโรงเรียน<br />โทร: 055-xxx-xxx
               </p>
            </div>
          </aside>

          {/* Premium Content Card */}
          <section style={{ background: 'white', padding: '4rem', borderRadius: '32px', boxShadow: '0 10px 30px rgba(0,0,0,0.02)', border: '1px solid #f1f5f9', minHeight: '600px' }}>
             {/* Dynamic Content */}
             {renderContent()}
          </section>

        </div>
      </main>

      <Footer />
      
      {/* Premium Specific CSS Effects */}
      <style>{`
        .animate-fade-in {
          animation: pageIn 0.6s ease-out forwards;
        }
        @keyframes pageIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

const GraduationCap = ({ size, color }: { size: number, color: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
);

export default ContentPage;
