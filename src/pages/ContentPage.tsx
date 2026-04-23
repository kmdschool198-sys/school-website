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
import { getDirectImageUrl, getDrivePreviewUrl } from '../utils/imageUtils';
import DriveImage from '../components/DriveImage';
import NewsModal, { type NewsItem } from '../components/NewsModal';
import { DEFAULT_STUDENTS } from '../data/defaultStudents';
import { BUILDINGS, STATUS_COLOR, CATEGORY_ICON } from '../data/buildings';
import Building3D from '../components/Building3D';
import CampusMap from '../components/CampusMap';
import { FileText, ExternalLink, Video, Globe } from 'lucide-react';

const thStyle: React.CSSProperties = { padding: '12px 14px', textAlign: 'left', fontWeight: 800, fontSize: '0.85rem', borderBottom: '2px solid #FFEDD5' };
const tdStyle: React.CSSProperties = { padding: '12px 14px', color: '#334155' };

const actionBtn = (color: string): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  padding: '14px 18px', borderRadius: 14, background: color, color: 'white',
  fontWeight: 800, textDecoration: 'none', fontSize: '0.92rem',
  boxShadow: `0 8px 20px ${color}40`, transition: 'transform .2s'
});

function InfoCard({ color, icon, title, children }: { color: string; icon: string; title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'white', borderRadius: 20, padding: '1.5rem', borderLeft: `5px solid ${color}`, boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
      <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>{icon}</div>
      <h5 style={{ fontWeight: 900, color: '#0F172A', marginBottom: 8, fontSize: '1rem' }}>{title}</h5>
      <div style={{ color: '#334155', fontSize: '0.92rem', lineHeight: 1.7 }}>{children}</div>
    </div>
  );
}

function ContentPage() {
  const { slug } = useParams<{ slug: string }>();
  const activeSlug = slug || '';
  const [firePersonnel, setFirePersonnel] = useState<any[]>([]);
  const [firebasePosts, setFirebasePosts] = useState<any[]>([]);
  const [studentsData, setStudentsData] = useState<{ title?: string; subtitle?: string; rows: any[] } | null>(null);
  const [dynamicPage, setDynamicPage] = useState<{title?: string, content?: string, bannerUrl?: string, blocks?: any[]} | null>(null);
  const [activePost, setActivePost] = useState<NewsItem | null>(null);
  const [mapMode, setMapMode] = useState<string>('hybrid');

  useEffect(() => {
    let unsubPosts: any = null;
    let unsubPers: any = null;
    let unsubPage: any = null;
    let unsubStu: any = null;

    if (activeSlug === 'students') {
      unsubStu = onSnapshot(doc(db, 'config', 'students_count'), snap => {
        if (snap.exists()) setStudentsData(snap.data() as any);
        else setStudentsData(null);
      });
    }

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

    // Gallery: pull all posts that have an albumUrl
    if (activeSlug === 'gallery') {
      const q = query(collection(db, 'posts'), orderBy('date', 'desc'));
      unsubPosts = onSnapshot(q, (snapshot) => {
        const results: any[] = [];
        snapshot.forEach(doc => {
          const d: any = { id: doc.id, ...doc.data() };
          if (d.albumUrl && d.albumUrl.trim() !== '') results.push(d);
        });
        setFirebasePosts(results);
      });
    }

    // Personnel snapshot logic (Category and WorkGroup mapping)
    const slugToFilter: Record<string, { field: string, value: string }> = {
      'directors': { field: 'category', value: 'director' },
      'board': { field: 'category', value: 'board' },
      'teacher': { field: 'category', value: 'teacher' }, // from /personnel/teacher
      'support': { field: 'category', value: 'support' }, // from /personnel/support
      'academic-affairs': { field: 'workGroup', value: 'academic' },
      'budget': { field: 'workGroup', value: 'budget' },
      'personnel': { field: 'workGroup', value: 'personnel' },
      'general-affairs': { field: 'workGroup', value: 'general' },
      'student-affairs': { field: 'workGroup', value: 'student' }
    };

    const filter = slugToFilter[activeSlug];
    if (filter) {
      const q = query(collection(db, 'personnel'), where(filter.field, '==', filter.value));
      unsubPers = onSnapshot(q, (snapshot) => {
        let results: any[] = [];
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
      if (unsubStu) unsubStu();
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
    if (!text || typeof text !== 'string') return null;
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

      // Major section header: "X. Title"  (top-level — strip the number, render as chapter)
      const majorMatch = /^([0-9]+)\.\s+(.+)$/.exec(trimmed);
      if (majorMatch && !trimmed.includes(':') && trimmed.length < 90) {
        const title = majorMatch[2].trim();
        elements.push(
          <div key={i} style={{
            marginTop: '2.5rem', marginBottom: '1.25rem',
            padding: '1.1rem 1.4rem',
            background: 'linear-gradient(135deg, #FF6A01 0%, #FB923C 100%)',
            color: 'white',
            borderRadius: '16px',
            boxShadow: '0 10px 28px rgba(255,106,1,0.25)',
            display: 'flex', alignItems: 'center', gap: '14px',
          }}>
            <span style={{
              width: 42, height: 42, borderRadius: '50%',
              background: 'rgba(255,255,255,0.22)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backdropFilter: 'blur(4px)',
              fontWeight: 900, fontSize: '1.1rem',
            }}>◆</span>
            <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900, letterSpacing: '0.3px' }}>{title}</h2>
          </div>
        );
        return;
      }

      // Sub-section header: "X) Title" (no colon)
      const subMatch = /^([0-9]+)\)\s+(.+)$/.exec(trimmed);
      if (subMatch && !trimmed.includes(':') && trimmed.length < 90) {
        const title = subMatch[2].trim();
        elements.push(
          <h3 key={i} style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0F172A', marginTop: '1.6rem', marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
            <span style={{ width: '6px', height: '22px', background: 'linear-gradient(180deg,#FF6A01,#FB923C)', borderRadius: '4px' }} />
            {title}
          </h3>
        );
        return;
      }

      // "X) Label: value"  OR  "Label: value"  → info card
      if (trimmed.includes(':')) {
        const idx = trimmed.indexOf(':');
        let key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        key = key.replace(/^[0-9]+[\.\)]\s*/, '');
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
                <DriveImage src={b.url} alt={b.caption || ''} style={{ maxWidth: '100%', borderRadius: '20px', boxShadow: '0 15px 40px rgba(255,106,1,0.12)' }} />
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

  const renderContactPage = () => {
    const SHORT = 'https://maps.app.goo.gl/GVXx3ctAPKZbzZmPA';
    const LAT = 16.4046183;
    const LNG = 99.237658;
    const LABEL = encodeURIComponent('โรงเรียนบ้านคลองมดแดง');
    const QUERY = `${LAT},${LNG}`;
    const mapModes: Record<string, { label: string; t: string; z: number }> = {
      hybrid: { label: 'ดาวเทียม + ป้ายชื่อ', t: 'h', z: 18 },
      satellite: { label: 'ดาวเทียม', t: 'k', z: 18 },
      map: { label: 'แผนที่ปกติ', t: 'm', z: 17 },
    };
    const buildSrc = (mode: string) => {
      const m = mapModes[mode];
      return `https://maps.google.com/maps?q=loc:${LAT},${LNG}(${LABEL})&t=${m.t}&z=${m.z}&hl=th&output=embed`;
    };
    return (
      <div className="animate-fade-in">
        {/* 3D-style map hero */}
        <div style={{ position: 'relative', borderRadius: 28, overflow: 'hidden', boxShadow: '0 30px 60px rgba(255,106,1,0.15)', border: '1px solid #FFEDD5', marginBottom: '2rem', background: '#0F172A' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', background: 'linear-gradient(90deg, rgba(255,106,1,0.95), rgba(251,146,60,0.95))', color: 'white' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 800 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#FFD400', boxShadow: '0 0 0 4px rgba(255,212,0,0.3)' }} />
              สถานที่ตั้งโรงเรียน · LIVE MAP
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {Object.entries(mapModes).map(([k, v]) => (
                <button key={k} onClick={() => setMapMode(k)} style={{
                  padding: '6px 14px', borderRadius: 50, border: 'none', cursor: 'pointer',
                  background: mapMode === k ? 'white' : 'rgba(255,255,255,0.18)',
                  color: mapMode === k ? '#FF6A01' : 'white',
                  fontWeight: 700, fontSize: '0.78rem', transition: 'all .25s'
                }}>{v.label}</button>
              ))}
            </div>
          </div>
          <iframe key={mapMode} src={buildSrc(mapMode)} width="100%" height="500" style={{ border: 0, display: 'block' }} loading="lazy" referrerPolicy="no-referrer-when-downgrade" title="School Map"></iframe>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: '2rem' }}>
          <a href={SHORT} target="_blank" rel="noreferrer" style={actionBtn('#FF6A01')}>
            <ExternalLink size={18} /> เปิดใน Google Maps
          </a>
          <a href={`https://www.google.com/maps/dir/?api=1&destination=${QUERY}`} target="_blank" rel="noreferrer" style={actionBtn('#3B82F6')}>
            🚗 ขอเส้นทาง (นำทาง)
          </a>
          <a href={`https://earth.google.com/web/search/${QUERY}`} target="_blank" rel="noreferrer" style={actionBtn('#10B981')}>
            🌍 ดูใน Google Earth (3D)
          </a>
          <a href={`https://www.google.com/maps/@?api=1&map_action=pano&query=${QUERY}`} target="_blank" rel="noreferrer" style={actionBtn('#A855F7')}>
            👁️ Street View
          </a>
        </div>

        {/* Info grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          <InfoCard color="#FF6A01" icon="📍" title="ที่ตั้ง">
            เลขที่ 198 หมู่ 3<br />
            ตำบลโป่งน้ำร้อน อำเภอคลองลาน<br />
            จังหวัดกำแพงเพชร 62180
          </InfoCard>
          <InfoCard color="#3B82F6" icon="🏫" title="สังกัด">
            สำนักงานเขตพื้นที่การศึกษา<br />
            ประถมศึกษากำแพงเพชร เขต 2<br />
            (สพป.กำแพงเพชร 2)
          </InfoCard>
          <InfoCard color="#10B981" icon="📚" title="ระดับชั้นที่เปิดสอน">
            อนุบาล 2 - มัธยมศึกษาปีที่ 3<br />
            <span style={{ fontSize: '0.85rem', color: '#64748B' }}>(โรงเรียนขยายโอกาสทางการศึกษา)</span>
          </InfoCard>
          <InfoCard color="#A855F7" icon="🏘️" title="เขตพื้นที่บริการ">
            6 หมู่บ้าน · หมู่ 3, 5, 7, 9, 10<br />
            ตำบลโป่งน้ำร้อน
          </InfoCard>
          <InfoCard color="#1877F2" icon="📘" title="Facebook">
            <a href="https://web.facebook.com/BnKhlngMddang" target="_blank" rel="noreferrer" style={{ color: '#1877F2', fontWeight: 700, textDecoration: 'none' }}>
              โรงเรียนบ้านคลองมดแดง →
            </a>
          </InfoCard>
          <InfoCard color="#000000" icon="🎵" title="TikTok">
            <a href="https://www.tiktok.com/@kmdschool198" target="_blank" rel="noreferrer" style={{ color: '#000000', fontWeight: 700, textDecoration: 'none' }}>
              @kmdschool198 →
            </a>
          </InfoCard>
          <InfoCard color="#FF0000" icon="▶️" title="YouTube">
            <a href="https://www.youtube.com/@KMDSchool" target="_blank" rel="noreferrer" style={{ color: '#FF0000', fontWeight: 700, textDecoration: 'none' }}>
              @KMDSchool →
            </a>
          </InfoCard>
          <InfoCard color="#F59E0B" icon="🕐" title="เวลาทำการ">
            จันทร์ - ศุกร์<br />
            08:00 - 16:30 น.<br />
            <span style={{ fontSize: '0.85rem', color: '#64748B' }}>(ปิดวันเสาร์-อาทิตย์ และวันหยุดราชการ)</span>
          </InfoCard>
        </div>
      </div>
    );
  };

  const renderStudentsPage = () => {
    const sd = (studentsData && studentsData.rows && studentsData.rows.length > 0) ? studentsData : DEFAULT_STUDENTS;
    const rows = sd.rows.map((r: any) => ({
      ...r,
      male: Number(r.male) || 0,
      female: Number(r.female) || 0,
      total: (Number(r.male) || 0) + (Number(r.female) || 0),
    }));
    const totalMale = rows.reduce((s, r) => s + r.male, 0);
    const totalFemale = rows.reduce((s, r) => s + r.female, 0);
    const grandTotal = totalMale + totalFemale;
    const maxTotal = Math.max(...rows.map(r => r.total), 1);

    // Group totals
    const sumGroup = (prefix: string) => rows
      .filter(r => r.class.startsWith(prefix))
      .reduce((s, r) => ({ male: s.male + r.male, female: s.female + r.female }), { male: 0, female: 0 });
    const anubaan = sumGroup('อนุบาล');
    const prathom = sumGroup('ประถม');
    const matthayom = sumGroup('มัธยม');

    return (
      <div className="animate-fade-in">
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontWeight: 900, color: '#0F172A', marginBottom: 8 }}>{sd.title || 'จำนวนนักเรียน'}</h2>
          <p style={{ color: '#64748B', margin: 0 }}>{sd.subtitle}</p>
        </div>

        {/* Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2.5rem' }}>
          {[
            { label: 'นักเรียนชาย', val: totalMale, color: '#3B82F6', bg: '#EFF6FF' },
            { label: 'นักเรียนหญิง', val: totalFemale, color: '#EC4899', bg: '#FDF2F8' },
            { label: 'รวมทั้งสิ้น', val: grandTotal, color: '#FF6A01', bg: '#FFF7ED' },
            { label: 'จำนวนชั้นเรียน', val: rows.length, color: '#10B981', bg: '#ECFDF5' },
          ].map((s, i) => (
            <div key={i} style={{ background: s.bg, borderRadius: 20, padding: '1.5rem', border: `1px solid ${s.color}22` }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 800, color: s.color, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.val.toLocaleString()}</div>
            </div>
          ))}
        </div>

        {/* Bar Chart */}
        <div style={{ background: 'white', borderRadius: 24, padding: '2rem', border: '1px solid #FFEDD5', marginBottom: '2rem' }}>
          <h4 style={{ fontWeight: 900, color: '#0F172A', marginBottom: '1.5rem' }}>กราฟจำนวนนักเรียนแยกชั้น</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {rows.map((r, i) => {
              const malePct = (r.male / maxTotal) * 100;
              const femalePct = (r.female / maxTotal) * 100;
              return (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: '0.85rem' }}>
                    <span style={{ fontWeight: 700, color: '#0F172A' }}>{r.class}</span>
                    <span style={{ color: '#64748B' }}>
                      <span style={{ color: '#3B82F6', fontWeight: 700 }}>ช {r.male}</span> · <span style={{ color: '#EC4899', fontWeight: 700 }}>ญ {r.female}</span> · <span style={{ color: '#FF6A01', fontWeight: 800 }}>รวม {r.total}</span>
                    </span>
                  </div>
                  <div style={{ display: 'flex', height: 22, borderRadius: 8, overflow: 'hidden', background: '#F1F5F9' }}>
                    <div style={{ width: `${malePct}%`, background: 'linear-gradient(90deg,#60A5FA,#3B82F6)', transition: 'width .6s ease' }} />
                    <div style={{ width: `${femalePct}%`, background: 'linear-gradient(90deg,#F472B6,#EC4899)', transition: 'width .6s ease' }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: '1.5rem', justifyContent: 'center', fontSize: '0.85rem', color: '#64748B' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 14, height: 14, borderRadius: 4, background: '#3B82F6' }} /> ชาย
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 14, height: 14, borderRadius: 4, background: '#EC4899' }} /> หญิง
            </span>
          </div>
        </div>

        {/* Group Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          {[
            { label: 'อนุบาล', g: anubaan, color: '#EC4899' },
            { label: 'ประถมศึกษา', g: prathom, color: '#3B82F6' },
            { label: 'มัธยมศึกษา', g: matthayom, color: '#F59E0B' },
          ].map((g, i) => {
            const total = g.g.male + g.g.female;
            const pct = grandTotal > 0 ? Math.round((total / grandTotal) * 100) : 0;
            return (
              <div key={i} style={{ background: 'white', borderRadius: 20, padding: '1.25rem', borderLeft: `5px solid ${g.color}`, boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
                <div style={{ fontWeight: 800, color: '#0F172A', marginBottom: 8 }}>ระดับ{g.label}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: '2rem', fontWeight: 900, color: g.color }}>{total}</span>
                  <span style={{ color: '#64748B', fontSize: '0.85rem' }}>คน · {pct}%</span>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748B', marginTop: 4 }}>ช {g.g.male} · ญ {g.g.female}</div>
              </div>
            );
          })}
        </div>

        {/* Detail Table */}
        <div style={{ background: 'white', borderRadius: 24, padding: '1.5rem', border: '1px solid #FFEDD5', overflow: 'auto' }}>
          <h4 style={{ fontWeight: 900, color: '#0F172A', marginBottom: '1rem' }}>ตารางรายละเอียด</h4>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '0.92rem' }}>
            <thead>
              <tr style={{ background: '#FFF7ED', color: '#0F172A' }}>
                <th style={thStyle}>ชั้น</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>ชาย</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>หญิง</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>รวม</th>
                <th style={thStyle}>ครูประจำชั้น</th>
                <th style={thStyle}>หมายเหตุ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={tdStyle}>{r.class}</td>
                  <td style={{ ...tdStyle, textAlign: 'center', color: '#3B82F6', fontWeight: 700 }}>{r.male}</td>
                  <td style={{ ...tdStyle, textAlign: 'center', color: '#EC4899', fontWeight: 700 }}>{r.female}</td>
                  <td style={{ ...tdStyle, textAlign: 'center', color: '#FF6A01', fontWeight: 800 }}>{r.total}</td>
                  <td style={tdStyle}>{r.teacher}</td>
                  <td style={tdStyle}>{r.note}</td>
                </tr>
              ))}
              <tr style={{ background: '#FFF7ED', fontWeight: 800 }}>
                <td style={tdStyle}>รวมทั้งสิ้น</td>
                <td style={{ ...tdStyle, textAlign: 'center', color: '#3B82F6' }}>{totalMale}</td>
                <td style={{ ...tdStyle, textAlign: 'center', color: '#EC4899' }}>{totalFemale}</td>
                <td style={{ ...tdStyle, textAlign: 'center', color: '#FF6A01' }}>{grandTotal}</td>
                <td colSpan={2} style={tdStyle}></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderBuildingsPage = () => {
    const grouped = BUILDINGS.reduce((acc, b) => {
      (acc[b.category] = acc[b.category] || []).push(b);
      return acc;
    }, {} as Record<string, typeof BUILDINGS>);

    const total = BUILDINGS.length;
    const good = BUILDINGS.filter(b => b.status === 'ดี').length;
    const ok = BUILDINGS.filter(b => b.status === 'พอใช้').length;
    const bad = BUILDINGS.filter(b => b.status === 'ทรุดโทรม').length;

    return (
      <div className="animate-fade-in">
        {/* Hero */}
        <div style={{
          background: 'linear-gradient(135deg, #0F172A 0%, #1E3A8A 60%, #FF6A01 130%)',
          color: 'white', borderRadius: 28, padding: '2.2rem 2rem', marginBottom: '2rem',
          boxShadow: '0 30px 60px rgba(15,23,42,0.25)',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 80% 20%, rgba(255,212,0,0.18), transparent 50%)' }} />
          <div style={{ position: 'relative' }}>
            <div style={{ fontSize: '0.85rem', letterSpacing: 2, opacity: 0.85, fontWeight: 700 }}>3D MODEL · CAMPUS</div>
            <h2 style={{ margin: '6px 0 4px', fontSize: '2rem', fontWeight: 900 }}>แบบจำลองอาคารทั้งหมด</h2>
            <p style={{ opacity: 0.9, margin: 0 }}>โรงเรียนบ้านคลองมดแดง · รวม {total} อาคาร</p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12, marginTop: '1.5rem' }}>
              {[
                { label: 'ทั้งหมด', val: total, color: '#FFD400' },
                { label: 'สภาพดี', val: good, color: STATUS_COLOR['ดี'] },
                { label: 'พอใช้', val: ok, color: STATUS_COLOR['พอใช้'] },
                { label: 'ทรุดโทรม', val: bad, color: STATUS_COLOR['ทรุดโทรม'] },
              ].map(s => (
                <div key={s.label} style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(6px)', borderRadius: 16, padding: '12px 16px', borderLeft: `4px solid ${s.color}` }}>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900, color: s.color }}>{s.val}</div>
                  <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Campus Map — full isometric overview */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1rem' }}>
            <span style={{ fontSize: '1.6rem' }}>🗺️</span>
            <h3 style={{ margin: 0, fontWeight: 900, color: '#0F172A', fontSize: '1.3rem' }}>แผนผังโรงเรียน · 3D Campus Map</h3>
            <span style={{ flex: 1, height: 1, background: 'linear-gradient(90deg,#FFEDD5,transparent)' }} />
          </div>
          <CampusMap />
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: '1.5rem', padding: '12px 16px', background: '#FFF7ED', borderRadius: 14, border: '1px solid #FFEDD5' }}>
          <span style={{ fontWeight: 800, color: '#7C2D12' }}>สถานะ:</span>
          {(['ดี', 'พอใช้', 'ทรุดโทรม'] as const).map(s => (
            <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, color: '#0F172A' }}>
              <span style={{ width: 12, height: 12, borderRadius: '50%', background: STATUS_COLOR[s] }} />
              {s}
            </span>
          ))}
        </div>

        {Object.entries(grouped).map(([cat, items]) => (
          <div key={cat} style={{ marginBottom: '2.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1rem' }}>
              <span style={{ fontSize: '1.6rem' }}>{CATEGORY_ICON[cat] || '🏗️'}</span>
              <h3 style={{ margin: 0, fontWeight: 900, color: '#0F172A', fontSize: '1.3rem' }}>{cat}</h3>
              <span style={{ background: '#FFEDD5', color: '#7C2D12', padding: '2px 12px', borderRadius: 50, fontSize: '0.78rem', fontWeight: 800 }}>{items.length} หลัง</span>
              <span style={{ flex: 1, height: 1, background: 'linear-gradient(90deg,#FFEDD5,transparent)' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 18 }}>
              {items.map(b => (
                <div key={b.id} style={{
                  position: 'relative',
                  background: 'linear-gradient(180deg, #F0F9FF 0%, #FFF 60%, #FFFBEB 100%)',
                  borderRadius: 20,
                  padding: '0.5rem 1rem 1.1rem',
                  border: '1px solid #E2E8F0',
                  boxShadow: '0 6px 20px rgba(0,0,0,0.05)',
                  transition: 'transform .25s, box-shadow .25s',
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 14px 30px rgba(255,106,1,0.15)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 20px rgba(0,0,0,0.05)'; }}
                >
                  <Building3D b={b} />
                  <div style={{
                    borderTop: '1px dashed #E2E8F0',
                    paddingTop: 10, marginTop: 4,
                  }}>
                    <div style={{ fontWeight: 900, color: '#0F172A', fontSize: '0.98rem' }}>{b.name}</div>
                    <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: 2 }}>
                      {b.floors} ชั้น · {b.shape === 'house' ? 'หลังคาจั่ว' : 'หลังคาเรียบ'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderContent = () => {
    if (activeSlug === 'students') {
      return renderStudentsPage();
    }
    if (activeSlug === 'contact') {
      return renderContactPage();
    }
    if (activeSlug === 'campus' || activeSlug === 'buildings' || activeSlug === 'school-buildings') {
      return renderBuildingsPage();
    }
    if (dynamicPage?.blocks && dynamicPage.blocks.length > 0) {
      return renderBlocks(dynamicPage.blocks);
    }
    if (data.type === 'text') {
      return <div className="animate-fade-in">{renderFormattedText(data.content)}</div>;
    }

    if (data.type === 'personnel' || data.type === 'personnel-groups') {
      const displayPersonnel = firePersonnel.length > 0 ? firePersonnel : (data.personnelData || []);
      const heads = displayPersonnel.filter(p => p.isHead);
      const others = displayPersonnel.filter(p => !p.isHead);

      const renderPersonCard = (person: any, isBig = false) => (
        <div key={person.id || person.name} style={{ 
          background: 'white', borderRadius: '24px', overflow: 'hidden', 
          boxShadow: '0 4px 20px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9',
          textAlign: 'center', transition: 'all 0.3s ease',
          height: '100%'
        }}>
          <div style={{ height: isBig ? '450px' : '320px', background: '#f8fafc', overflow: 'hidden' }}>
            <DriveImage src={person.image || person.imageUrl} alt={person.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div style={{ padding: '1.5rem' }}>
            <h4 style={{ fontSize: isBig ? '1.4rem' : '1.1rem', fontWeight: 800, color: '#1e293b', marginBottom: '0.4rem' }}>{person.name}</h4>
            <p style={{ fontSize: '0.9rem', color: '#FF6A01', fontWeight: 700, margin: '0 0 0.5rem 0' }}>{person.position}</p>
            {person.major && (
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.25rem' }}>
                วิชาเอก: <span style={{ fontWeight: 600 }}>{person.major}</span>
              </div>
            )}
            {person.phone && (
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                โทร: <span style={{ fontWeight: 600 }}>{person.phone}</span>
              </div>
            )}
          </div>
        </div>
      );

      const SectionHeading = ({ text }: { text: string }) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', margin: '0 0 2rem' }}>
          <span style={{ width: 6, height: 28, borderRadius: 4, background: 'linear-gradient(180deg,#FF6A01,#FB923C)' }} />
          <h3 style={{ margin: 0, fontWeight: 900, color: '#0F172A', fontSize: '1.4rem' }}>{text}</h3>
          <span style={{ flex: 1, height: 1, background: 'linear-gradient(90deg,#FFEDD5,transparent)' }} />
        </div>
      );

      return (
        <div className="animate-fade-in">
          {heads.length > 0 && (
            <div style={{ marginBottom: '4rem' }}>
               <SectionHeading text="หัวหน้างาน" />
               <div style={{
                 display: 'flex',
                 flexWrap: 'wrap',
                 justifyContent: 'center',
                 gap: '3rem',
                 maxWidth: '1000px',
                 margin: '0 auto'
               }}>
                 {heads.map(h => (
                   <div key={h.id} style={{ width: heads.length === 1 ? '400px' : '350px' }}>
                     {renderPersonCard(h, heads.length === 1)}
                   </div>
                 ))}
               </div>
            </div>
          )}
          {others.length > 0 && (
            <>
              <SectionHeading text="สมาชิกกลุ่มงาน" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '2rem' }}>
                {others.map(person => renderPersonCard(person))}
              </div>
            </>
          )}
        </div>
      );
    }

    if (data.type === 'gallery') {
      return (
        <div className="animate-fade-in">
          {firebasePosts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem 2rem', background: '#f8fafc', borderRadius: '24px' }}>
              <ImageIcon size={48} color="#cbd5e1" style={{ marginBottom: '1rem' }} />
              <p style={{ color: '#94a3b8', fontSize: '1.05rem', fontWeight: 600 }}>ยังไม่มีอัลบั้มภาพ</p>
              <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>เพิ่มอัลบั้มได้จากหน้า Admin โดยใส่ลิงก์ Google Photos ในข่าว</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
              {firebasePosts.map((post) => (
                <a
                  key={post.id}
                  href={post.albumUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    background: 'white', borderRadius: '20px', overflow: 'hidden',
                    border: '1px solid #f1f5f9', boxShadow: '0 4px 15px rgba(0,0,0,0.04)',
                    textDecoration: 'none', color: 'inherit',
                    display: 'flex', flexDirection: 'column',
                    transition: 'transform 0.25s ease, box-shadow 0.25s ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-6px)'; e.currentTarget.style.boxShadow = '0 16px 36px rgba(255,106,1,0.18)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.04)'; }}
                >
                  <div style={{ position: 'relative', height: '200px', background: '#f8fafc', overflow: 'hidden' }}>
                    <DriveImage src={post.imageUrl} alt={post.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div style={{
                      position: 'absolute', top: '12px', right: '12px',
                      background: 'rgba(255,106,1,0.95)', color: 'white',
                      padding: '5px 10px', borderRadius: '20px',
                      fontSize: '0.7rem', fontWeight: 800,
                      display: 'flex', alignItems: 'center', gap: '4px',
                      boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
                    }}>
                      <ImageIcon size={12} /> ALBUM
                    </div>
                  </div>
                  <div style={{ padding: '1.25rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8', fontSize: '0.75rem' }}>
                      <Calendar size={12} /> {post.date}
                    </div>
                    <h4 style={{ fontSize: '1rem', fontWeight: 800, color: '#1e293b', lineHeight: 1.4, margin: 0 }}>
                      {post.title}
                    </h4>
                    <div style={{ marginTop: 'auto', paddingTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px', color: '#FF6A01', fontSize: '0.85rem', fontWeight: 700 }}>
                      เปิดอัลบั้ม <ExternalLink size={14} />
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (data.type === 'news') {
      return (
        <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '2rem' }}>
          {firebasePosts.map((post) => (
            <div key={post.id} onClick={() => setActivePost(post as NewsItem)} style={{ background: 'white', borderRadius: '24px', overflow: 'hidden', border: '1px solid #f1f5f9', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', cursor: 'pointer', transition: 'transform 0.2s ease, box-shadow 0.2s ease' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 30px rgba(255,106,1,0.15)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.03)'; }}
            >
               <div style={{ height: '200px', background: '#f8fafc' }}>
                  <DriveImage src={post.imageUrl} alt={post.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
               </div>
               <div style={{ padding: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '0.8rem', marginBottom: '0.8rem' }}>
                    <Calendar size={14} /> {post.date}
                  </div>
                  <h4 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '1rem', color: '#1e293b', lineHeight: 1.4 }}>{post.title}</h4>
                  <p style={{ fontSize: '0.9rem', color: '#64748b', lineHeight: 1.6, marginBottom: '1.5rem' }}>{post.content.substring(0, 90)}...</p>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <span style={{ color: '#FF6A01', fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      อ่านรายละเอียด <ChevronRight size={16} />
                    </span>
                    {post.imageType === 'pdf' && (
                      <a href={post.imageUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ color: '#64748b', fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}>
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
                      <a href={post.tiktokUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ color: '#000', fontSize: '0.8rem', textDecoration: 'none', background: '#f1f5f9', padding: '4px 8px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Video size={14} /> TikTok
                      </a>
                    )}
                    {post.websiteUrl && post.websiteUrl.trim() !== '' && (
                      <a href={post.websiteUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ color: '#3B82F6', fontSize: '0.8rem', textDecoration: 'none', background: '#f1f5f9', padding: '4px 8px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Globe size={14} /> เว็บไซต์
                      </a>
                    )}
                    {post.documentUrl && post.documentUrl.trim() !== '' && (
                      <a href={post.documentUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ color: '#10B981', fontSize: '0.8rem', textDecoration: 'none', background: '#f1f5f9', padding: '4px 8px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
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

      <NewsModal post={activePost} onClose={() => setActivePost(null)} />

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
