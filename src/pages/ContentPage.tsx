import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot, doc } from 'firebase/firestore';
import { db } from '../firebase';
import {
  ChevronRight,
  Home as HomeIcon,
  Calendar,
  Image as ImageIcon
} from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { SCHOOL_NAME, SCHOOL_AFFILIATION, SCHOOL_EMAIL, SCHOOL_PHONE } from '../config/siteLinks';
import BranchPersonnel from '../components/BranchPersonnel';
import { sidebarMenus, pageContent } from '../data/pageContent';
import { getDirectImageUrl, getDrivePreviewUrl } from '../utils/imageUtils';
import DriveImage from '../components/DriveImage';
import NewsModal, { type NewsItem } from '../components/NewsModal';
import FacebookPostCard from '../components/FacebookPostCard';
import { DEFAULT_STUDENTS } from '../data/defaultStudents';
import { OFFICIAL_PERSONNEL, toPersonnelDoc } from '../data/personnelRoster';
import { useSchoolRoster } from '../utils/useSchoolRoster';
import { BUILDINGS, STATUS_COLOR, CATEGORY_ICON } from '../data/buildings';
import Building3D from '../components/Building3D';
import CampusMap from '../components/CampusMap';
import TimetableSmart from '../components/TimetableSmart';
import {
  FileText, ExternalLink, Video, Globe,
  Target, Award, BookOpen, Users, Cpu, Sparkles, ShieldCheck, Quote, Printer
} from 'lucide-react';

const thStyle: React.CSSProperties = { padding: '12px 14px', textAlign: 'left', fontWeight: 800, fontSize: '0.85rem', borderBottom: '2px solid #FFEDD5' };
const tdStyle: React.CSSProperties = { padding: '12px 14px', color: '#334155' };

const infoRow: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '10px 14px', background: '#F8FAFC', borderRadius: 12,
  borderLeft: '3px solid #FFEDD5',
};
const infoLabel: React.CSSProperties = { color: '#64748B', fontWeight: 700, fontSize: '0.85rem' };
const infoVal: React.CSSProperties = { color: '#0F172A', fontWeight: 700, fontSize: '0.95rem', textAlign: 'right' };
const modalBtn = (color: string): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  padding: '10px 14px', borderRadius: 12, background: color, color: 'white',
  fontWeight: 800, textDecoration: 'none', fontSize: '0.85rem',
  boxShadow: `0 6px 16px ${color}40`, border: 'none', cursor: 'pointer',
  whiteSpace: 'nowrap', flex: 1, minWidth: 0,
});

const WORK_GROUP_LABELS: Record<string, string> = {
  management: 'ฝ่ายบริหาร',
  academic: 'งานวิชาการ',
  budget: 'งานงบประมาณ',
  personnel: 'งานบุคคล',
  general: 'งานบริหารทั่วไป',
  student: 'งานกิจการนักเรียน',
};

const PERSONNEL_CATEGORY_LABELS: Record<string, string> = {
  director: 'ฝ่ายบริหาร',
  board: 'คณะกรรมการสถานศึกษา',
  teacher: 'ครู',
  support: 'บุคลากรสนับสนุน',
};

const PERSONNEL_FILTERS: Record<string, { field: 'category' | 'workGroup'; value: string }> = {
  directors: { field: 'category', value: 'director' },
  board: { field: 'category', value: 'board' },
  teacher: { field: 'category', value: 'teacher' },
  support: { field: 'category', value: 'support' },
  'academic-affairs': { field: 'workGroup', value: 'academic' },
  budget: { field: 'workGroup', value: 'budget' },
  personnel: { field: 'workGroup', value: 'personnel' },
  'general-affairs': { field: 'workGroup', value: 'general' },
  'student-affairs': { field: 'workGroup', value: 'student' },
};

const personnelLabel = (value: string | undefined, labels: Record<string, string>) =>
  value && value !== 'none' ? labels[value] || value : '';

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

function LoadingState({ text }: { text: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '4rem 2rem', background: '#f8fafc', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
      <div style={{
        width: 42,
        height: 42,
        borderRadius: '50%',
        border: '4px solid #FFEDD5',
        borderTopColor: '#FF6A01',
        margin: '0 auto 1rem',
        animation: 'spin 0.9s linear infinite',
      }} />
      <p style={{ color: '#64748b', fontSize: '1.05rem', fontWeight: 700 }}>{text}</p>
    </div>
  );
}

function ContentPage() {
  const { slug } = useParams<{ slug: string }>();
  const activeSlug = slug || '';
  const { classes: unifiedRosters } = useSchoolRoster();
  const [firePersonnel, setFirePersonnel] = useState<any[]>(() =>
    OFFICIAL_PERSONNEL.map((p, i) => ({ id: `off_${i}`, ...toPersonnelDoc(p, i + 1) }))
  );
  const [personnelLoading, setPersonnelLoading] = useState(false);
  const [firebasePosts, setFirebasePosts] = useState<any[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [studentsData, setStudentsData] = useState<{ title?: string; subtitle?: string; rows: any[] } | null>(null);
  const [dynamicPage, setDynamicPage] = useState<{ title?: string, content?: string, bannerUrl?: string, blocks?: any[] } | null>(null);
  const [activePost, setActivePost] = useState<NewsItem | null>(null);
  const [mapMode, setMapMode] = useState<string>('hybrid');
  const [activePerson, setActivePerson] = useState<any | null>(null);

  useEffect(() => {
    let unsubPosts: any = null;
    let unsubPers: any = null;
    let unsubPage: any = null;
    let unsubStu: any = null;
    const usesPostList = activeSlug === 'pr-news' || activeSlug === 'e-newsletter' || activeSlug === 'school-awards' || activeSlug === 'gallery';

    setPostsLoading(usesPostList);
    if (usesPostList) setFirebasePosts([]);

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

      // Filter+sort client-side to avoid needing a Firestore composite index
      const targetCat = catMap[activeSlug];
      unsubPosts = onSnapshot(collection(db, 'posts'), (snapshot) => {
        const results: any[] = [];
        snapshot.forEach(doc => results.push({ id: doc.id, ...doc.data() }));
        const filtered = results
          .filter(p => p.category === targetCat)
          .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        setFirebasePosts(filtered);
        setPostsLoading(false);
      }, (err) => {
        console.error("Posts snapshot error:", err);
        setPostsLoading(false);
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
        setPostsLoading(false);
      }, (err) => {
        console.error("Gallery snapshot error:", err);
        setPostsLoading(false);
      });
    }

    // One master personnel source is shared by personnel, work-group and student pages.
    const personnelQuery = query(collection(db, 'personnel'), orderBy('order', 'asc'));
    unsubPers = onSnapshot(personnelQuery, (snapshot) => {
      const results: any[] = [];
      snapshot.forEach(personnelDoc => results.push({ id: personnelDoc.id, ...personnelDoc.data() }));
      if (results.length > 0) {
        setFirePersonnel(results);
      }
      setPersonnelLoading(false);
    }, (error) => {
      console.warn('Personnel snapshot fallback:', error);
      setPersonnelLoading(false);
    });

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
    subtitle: SCHOOL_NAME,
    type: 'text',
    content: 'ขออภัย กำลังอยู่ระหว่างการปรับปรุงเนื้อหาในส่วนนี้'
  };

  const data = {
    ...staticData,
    title: dynamicPage?.title || staticData.title,
    content: dynamicPage?.content || staticData.content
  };
  const activePersonnelFilter = PERSONNEL_FILTERS[activeSlug];
  const displayPersonnel = activeSlug === 'teachers'
    ? firePersonnel.filter(person => person.category !== 'board')
    : activePersonnelFilter
      ? firePersonnel.filter(person => person[activePersonnelFilter.field] === activePersonnelFilter.value)
      : firePersonnel;
  const personnelById = new Map(firePersonnel.map(person => [person.id, person]));

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
    const LABEL = encodeURIComponent(SCHOOL_NAME);
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
              {SCHOOL_NAME} →
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
    const sd = DEFAULT_STUDENTS;
    const rows = unifiedRosters.map(cls => {
      const configuredRow = studentsData?.rows?.find(
        (r: any) => r.class === cls.fullClassName || r.class === cls.label
      );
      return {
        class: cls.fullClassName,
        shortLabel: cls.label,
        teacher:
          (configuredRow?.teacherId && personnelById.get(configuredRow.teacherId)?.name) ||
          configuredRow?.teacher ||
          cls.homeroomTeacher,
        male: cls.maleCount,
        female: cls.femaleCount,
        total: cls.totalCount,
        note: configuredRow?.note || '',
      };
    });
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
            <p style={{ opacity: 0.9, margin: 0 }}>{SCHOOL_NAME} · รวม {total} อาคาร</p>

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

        {/* Controls */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: '1.5rem', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', padding: '10px 16px', background: '#FFF7ED', borderRadius: 14, border: '1px solid #FFEDD5' }}>
            <span style={{ fontWeight: 800, color: '#7C2D12' }}>สถานะ:</span>
            {(['ดี', 'พอใช้', 'ทรุดโทรม'] as const).map(s => (
              <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, color: '#0F172A' }}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', background: STATUS_COLOR[s] }} />
                {s}
              </span>
            ))}
          </div>

        </div>

        <div>
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
      </div>
    );
  };

    const renderVisionPage = () => {
    const missions = [
      {
        num: 1,
        title: 'พัฒนาคุณภาพและสมรรถนะผู้เรียน',
        desc: 'พัฒนาคุณภาพผู้เรียนให้มีความรู้ ความสามารถ และสมรรถนะตามมาตรฐานการศึกษาและหลักสูตร ส่งเสริมการเรียนรู้ตามศักยภาพและความถนัดของผู้เรียน ตลอดจนพัฒนาทักษะที่จำเป็นต่อการดำรงชีวิตและการเรียนรู้ในศตวรรษที่ 21',
        icon: Award,
        badge: 'คุณภาพ & ศตวรรษที่ 21',
        color: '#FF6A01',
        bg: '#FFF7ED',
      },
      {
        num: 2,
        title: 'คุณค่าความหลากหลายทางวัฒนธรรม',
        desc: 'ส่งเสริมและพัฒนาผู้เรียน ครู และบุคลากรทางการศึกษาให้มีความรู้ ความเข้าใจ และสามารถจัดการเรียนรู้ที่เคารพและเห็นคุณค่าความหลากหลายทางวัฒนธรรม ที่เชื่อมโยงวิถีชีวิต ครอบครัว ชุมชน และบริบทท้องถิ่น',
        icon: Users,
        badge: 'พหุวัฒนธรรม & ชุมชน',
        color: '#8B5CF6',
        bg: '#F5F3FF',
      },
      {
        num: 3,
        title: 'เทคโนโลยีและนวัตกรรมการเรียนรู้',
        desc: 'พัฒนาครูและบุคลากรทางการศึกษาให้มีความรู้ ความสามารถและทักษะในการประยุกต์ใช้เทคโนโลยีและนวัตกรรมเพื่อการจัดการเรียนรู้ พัฒนาระบบสารสนเทศและแหล่งเรียนรู้ให้เอื้อต่อการเรียนรู้ของผู้เรียนอย่างมีประสิทธิภาพและปลอดภัย',
        icon: Cpu,
        badge: 'เทคโนโลยี & นวัตกรรม',
        color: '#0284C7',
        bg: '#F0F9FF',
      },
      {
        num: 4,
        title: 'ยกระดับผลสัมฤทธิ์คู่คุณธรรมและความเสมอภาค',
        desc: 'ยกระดับผลสัมฤทธิ์ทางการศึกษาให้เป็นไปตามค่าเป้าหมายของสถานศึกษา ควบคู่กับการปลูกฝังคุณธรรม จริยธรรม คุณลักษณะอันพึงประสงค์ และค่านิยมที่ดีงาม เสริมสร้างโอกาส ความเสมอภาค ลดความเหลื่อมล้ำ และให้ผู้เรียนทุกคนสามารถเข้าถึงบริการทางการศึกษาอย่างทั่วถึงและเท่าเทียม',
        icon: Sparkles,
        badge: 'ผลสัมฤทธิ์คู่คุณธรรม',
        color: '#10B981',
        bg: '#ECFDF5',
      },
      {
        num: 5,
        title: 'น้อมนำหลักปรัชญาของเศรษฐกิจพอเพียงสู่ทักษะอาชีพ',
        desc: 'น้อมนำหลักปรัชญาของเศรษฐกิจพอเพียงมาบูรณาการในการจัดการเรียนรู้และการบริหารจัดการสถานศึกษา ส่งเสริมทักษะอาชีพที่สอดคล้องกับวิถีชีวิต ความถนัด ความสนใจ และบริบทของครอบครัวและชุมชน เพื่อให้ผู้เรียนสามารถดำรงชีวิตและการประกอบอาชีพได้อย่างเหมาะสม',
        icon: BookOpen,
        badge: 'พอเพียง & ทักษะอาชีพ',
        color: '#D97706',
        bg: '#FFFBEB',
      },
      {
        num: 6,
        title: 'ระบบบริหารโปร่งใส ปลอดภัย สู่ความยั่งยืน',
        desc: 'พัฒนาระบบบริหารและการปฏิบัติงานของสถานศึกษาให้มีประสิทธิภาพ โปร่งใส และเหมาะสมกับบริบทท้องถิ่น จัดสภาพแวดล้อมและระบบดูแลช่วยเหลือนักเรียนให้มีความปลอดภัยอย่างรอบด้าน และส่งเสริมการพัฒนาสถานศึกษาสู่ความยั่งยืน',
        icon: ShieldCheck,
        badge: 'ธรรมาภิบาล & ปลอดภัย',
        color: '#E11D48',
        bg: '#FFF1F2',
      },
    ];

    const goals = [
      'ผู้เรียนมีความรู้ ความสามารถ และสมรรถนะตามมาตรฐานการศึกษาและหลักสูตร สามารถเรียนรู้และพัฒนาตนเองได้ตามศักยภาพ ตลอดจนมีทักษะที่จำเป็นต่อการดำรงชีวิตและการเรียนรู้ในศตวรรษที่ 21',
      'ผู้เรียน ครู และบุคลากรทางการศึกษามีความรู้ ความเข้าใจ ยอมรับ และเห็นคุณค่าของความหลากหลายทางวัฒนธรรม สามารถอยู่ร่วมกันบนพื้นฐานของความเคารพ ความเข้าใจ และยอมรับความแตกต่างทางวัฒนธรรม',
      'ครูและบุคลากรทางการศึกษาสามารถประยุกต์ใช้เทคโนโลยีและนวัตกรรมในการจัดการเรียนรู้ได้อย่างเหมาะสม มีระบบสารสนเทศและแหล่งเรียนรู้ที่สนับสนุนการเรียนรู้ของผู้เรียนอย่างมีประสิทธิภาพ',
      'ผู้เรียนมีผลสัมฤทธิ์ทางการศึกษาตามค่าเป้าหมายของสถานศึกษา มีคุณธรรม จริยธรรม และคุณลักษณะอันพึงประสงค์ พร้อมทั้งได้รับโอกาสทางการศึกษาอย่างทั่วถึง เท่าเทียม และเป็นธรรม',
      'ผู้เรียนสามารถประยุกต์ใช้หลักปรัชญาของเศรษฐกิจพอเพียงในการดำเนินชีวิต มีทักษะอาชีพที่สอดคล้องกับความถนัด ความสนใจ วิถีชีวิต และบริบทของครอบครัวและชุมชน สามารถนำความรู้และทักษะไปใช้ในการดำรงชีวิตและประกอบอาชีพได้อย่างเหมาะสม',
      'สถานศึกษามีระบบบริหารจัดการและการปฏิบัติงานที่มีประสิทธิภาพ โปร่งใส สอดคล้องกับบริบทท้องถิ่น มีระบบดูแลช่วยเหลือนักเรียนและสภาพแวดล้อมที่ปลอดภัย เอื้อต่อการเรียนรู้ และสนับสนุนการพัฒนาสถานศึกษาอย่างยั่งยืน',
    ];

    const strategies = [
      { no: '1', title: 'ส่งเสริมและพัฒนาคุณภาพผู้เรียนให้มีความรู้ ความสามารถ และสมรรถนะตามมาตรฐานการศึกษาและหลักสูตร', focus: 'คุณภาพผู้เรียน & สมรรถนะ' },
      { no: '2', title: 'ส่งเสริมการจัดการเรียนรู้เพื่อพัฒนาศักยภาพผู้เรียนสู่ความเป็นเลิศ และเสริมสร้างทักษะที่จำเป็นในศตวรรษที่ 21', focus: 'สู่ความเป็นเลิศ & ศตวรรษที่ 21' },
      { no: '3', title: 'พัฒนาครูและบุคลากรทางการศึกษาให้มีความเชี่ยวชาญในการจัดการเรียนรู้ที่หลากหลาย สามารถประยุกต์ใช้เทคโนโลยีและนวัตกรรมได้อย่างเหมาะสม', focus: 'ครูมืออาชีพ & นวัตกรรม' },
      { no: '4', title: 'ส่งเสริมการเรียนรู้และการอยู่ร่วมกันบนพื้นฐานของความหลากหลายทางวัฒนธรรม เชื่อมโยงวิถีชีวิต ครอบครัว และชุมชน', focus: 'พหุวัฒนธรรม & ชุมชนสัมพันธ์' },
      { no: '5', title: 'ยกระดับผลสัมฤทธิ์ทางการศึกษา ควบคู่กับการส่งเสริมคุณธรรม จริยธรรม คุณลักษณะอันพึงประสงค์ และค่านิยมที่ดีงามของผู้เรียน', focus: 'ผลสัมฤทธิ์ & คุณธรรมนำความรู้' },
      { no: '6', title: 'ส่งเสริมการน้อมนำหลักปรัชญาของเศรษฐกิจพอเพียงสู่การจัดการเรียนรู้และการพัฒนาทักษะอาชีพที่สอดคล้องกับความถนัด ความสนใจ วิถีชีวิตและบริบทของชุมชน', focus: 'เศรษฐกิจพอเพียง & อาชีพ' },
      { no: '7', title: 'พัฒนาแหล่งเรียนรู้ ระบบเทคโนโลยีสารสนเทศ และสภาพแวดล้อมที่เอื้อต่อการเรียนรู้และการพัฒนาผู้เรียนอย่างรอบด้าน', focus: 'แหล่งเรียนรู้ & เทคโนโลยี' },
      { no: '8', title: 'พัฒนาระบบบริหารจัดการสถานศึกษาให้มีประสิทธิภาพ โปร่งใส ปลอดภัย และสอดคล้องกับบริบทท้องถิ่นและเป้าหมายการพัฒนาที่ยั่งยืน', focus: 'ธรรมาภิบาล ปลอดภัย ยั่งยืน' },
    ];

    return (
      <div className="animate-fade-in vision-page" style={{ paddingBottom: '3rem' }}>
        {/* Banner ผู้อำนวยการและกรอบวิสัยทัศน์ */}
        <div style={{
          background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 55%, #FF6A01 100%)',
          borderRadius: 24,
          padding: '2.4rem 2rem',
          color: 'white',
          boxShadow: '0 20px 45px rgba(15,23,42,0.22)',
          position: 'relative',
          overflow: 'hidden',
          marginBottom: '2rem',
        }}>
          <div style={{
            position: 'absolute', top: -30, right: -30, width: 220, height: 220,
            background: 'radial-gradient(circle, rgba(255,106,1,0.3) 0%, rgba(255,255,255,0) 70%)',
            borderRadius: '50%', pointerEvents: 'none',
          }} />
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
            <span style={{
              background: 'rgba(255,106,1,0.25)', color: '#FFD4B2',
              padding: '6px 14px', borderRadius: 99, fontSize: '0.85rem', fontWeight: 800,
              border: '1px solid rgba(255,106,1,0.4)', display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              <Award size={15} /> 4. วิสัยทัศน์ในการบริหารจัดการสถานศึกษา
            </span>
            <span style={{
              background: 'rgba(255,255,255,0.12)', color: '#F1F5F9',
              padding: '6px 14px', borderRadius: 99, fontSize: '0.85rem', fontWeight: 700,
            }}>
              ระยะเวลา 1 ปี (พ.ศ. 2570)
            </span>
            <button
              onClick={() => window.print()}
              style={{
                marginLeft: 'auto', background: 'white', color: '#0F172A',
                border: 'none', padding: '8px 16px', borderRadius: 12,
                fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 8,
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              }}
            >
              <Printer size={15} /> พิมพ์เอกสารราชการ
            </button>
          </div>

          <h1 style={{ fontSize: '2rem', fontWeight: 900, margin: '8px 0 16px', lineHeight: 1.3 }}>
            วิสัยทัศน์ พันธกิจ เป้าประสงค์ และกลยุทธ์
          </h1>

          <div style={{
            background: 'rgba(255,255,255,0.07)',
            backdropFilter: 'blur(10px)',
            borderRadius: 16,
            padding: '1.4rem 1.6rem',
            border: '1px solid rgba(255,255,255,0.15)',
            marginBottom: '1.5rem',
            lineHeight: 1.8,
            fontSize: '1rem',
            color: '#F8FAFC',
          }}>
            <p style={{ margin: 0, textIndent: '2.5rem' }}>
              การจัดการศึกษาขั้นพื้นฐาน เป็นการศึกษาเพื่อเป็นรากฐานในการพัฒนาประเทศ โดยมีเป้าหมายให้ผู้เรียนได้รับการศึกษาที่มีคุณภาพตามมาตรฐาน เป็นผู้เรียนรู้ ผู้ร่วมสร้างสรรค์นวัตกรรม และเป็นพลเมืองที่เข้มแข็งของประเทศ ข้าพเจ้านายปรัชญา ปรางค์ชัยภูมิ ตำแหน่งผู้อำนวยการสถานศึกษา จึงได้กำหนดวิสัยทัศน์ พันธกิจ เป้าประสงค์ และกลยุทธ์ ในระยะเวลา 1 ปี (พ.ศ. 2570) ดังนี้
            </p>
          </div>

          {/* ผู้อำนวยการผู้กำหนดวิสัยทัศน์ */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 14,
            paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.15)',
          }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              background: '#FF6A01', display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: 'white', fontWeight: 900,
              fontSize: '1.3rem', boxShadow: '0 6px 16px rgba(255,106,1,0.4)',
              border: '2px solid white',
            }}>
              ป
            </div>
            <div>
              <div style={{ fontWeight: 900, fontSize: '1.05rem', color: '#FFF' }}>
                นายปรัชญา ปรางค์ชัยภูมิ
              </div>
              <div style={{ fontSize: '0.85rem', color: '#CBD5E1', marginTop: 2 }}>
                ผู้อำนวยการสถานศึกษา · {SCHOOL_NAME}
              </div>
            </div>
          </div>
        </div>

        {/* จุดเน้นวิสัยทัศน์ (Vision Statement) */}
        <div style={{
          background: 'linear-gradient(135deg, #FFF7ED 0%, #FFFFFF 100%)',
          borderRadius: 24,
          padding: '2.2rem',
          border: '2px solid #FFEDD5',
          boxShadow: '0 10px 30px rgba(255,106,1,0.08)',
          marginBottom: '2.5rem',
          position: 'relative',
        }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            color: '#EA580C', fontWeight: 800, fontSize: '0.9rem',
            background: 'white', padding: '6px 14px', borderRadius: 99,
            boxShadow: '0 2px 8px rgba(234,88,12,0.1)', marginBottom: 16,
          }}>
            <Target size={18} /> วิสัยทัศน์ (Vision)
          </div>

          <div style={{
            position: 'relative', padding: '1rem 0 1rem 1.5rem',
            borderLeft: '5px solid #FF6A01',
          }}>
            <Quote size={32} style={{ color: '#FF6A01', opacity: 0.35, position: 'absolute', top: -5, left: 10 }} />
            <h2 style={{
              fontSize: '1.65rem', fontWeight: 900, color: '#0F172A',
              lineHeight: 1.6, margin: 0,
            }}>
              “โรงเรียนคุณภาพมาตรฐาน บูรณาการหลากวัฒนธรรม ก้าวทันเทคโนโลยี ผู้เรียนมีความรู้คู่คุณธรรม น้อมนำหลักปรัชญา สู่การพัฒนาทักษะอาชีพ”
            </h2>
          </div>

          {/* เสาหลัก 6 ประการในวิสัยทัศน์ */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12,
            marginTop: '1.8rem',
            paddingTop: '1.5rem',
            borderTop: '1px dashed #FED7AA',
          }}>
            {[
              { label: 'โรงเรียนคุณภาพมาตรฐาน', icon: '🏫', color: '#EA580C' },
              { label: 'บูรณาการหลากวัฒนธรรม', icon: '🤝', color: '#7C3AED' },
              { label: 'ก้าวทันเทคโนโลยี', icon: '💻', color: '#0284C7' },
              { label: 'ผู้เรียนมีความรู้คู่คุณธรรม', icon: '⭐', color: '#059669' },
              { label: 'น้อมนำหลักปรัชญาพอเพียง', icon: '🌱', color: '#D97706' },
              { label: 'สู่การพัฒนาทักษะอาชีพ', icon: '🛠️', color: '#DC2626' },
            ].map((pillar, idx) => (
              <div key={idx} style={{
                background: 'white', borderRadius: 14, padding: '12px 14px',
                border: '1px solid #FFEDD5', display: 'flex', alignItems: 'center', gap: 10,
                boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
              }}>
                <span style={{ fontSize: '1.3rem' }}>{pillar.icon}</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1E293B' }}>{pillar.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ส่วนที่ 1: พันธกิจ (Mission) 6 ข้อ */}
        <div style={{ marginBottom: '3rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: '1.5rem' }}>
            <span style={{ width: 6, height: 28, borderRadius: 4, background: 'linear-gradient(180deg,#FF6A01,#FB923C)' }} />
            <div>
              <h3 style={{ margin: 0, fontWeight: 900, color: '#0F172A', fontSize: '1.5rem' }}>
                พันธกิจ (Mission)
              </h3>
              <p style={{ margin: '4px 0 0', color: '#64748B', fontSize: '0.9rem' }}>
                ภารกิจหลัก 6 ด้านเพื่อขับเคลื่อนคุณภาพการศึกษาให้บรรลุตามวิสัยทัศน์
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.2rem' }}>
            {missions.map(m => {
              const IconComponent = m.icon;
              return (
                <div
                  key={m.num}
                  style={{
                    background: 'white',
                    borderRadius: 20,
                    padding: '1.6rem',
                    border: '1px solid #E2E8F0',
                    boxShadow: '0 4px 16px rgba(15,23,42,0.04)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    position: 'relative',
                    overflow: 'hidden',
                    transition: 'all 0.25s ease',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)';
                    (e.currentTarget as HTMLElement).style.boxShadow = '0 14px 30px rgba(0,0,0,0.08)';
                    (e.currentTarget as HTMLElement).style.borderColor = m.color;
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.transform = '';
                    (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(15,23,42,0.04)';
                    (e.currentTarget as HTMLElement).style.borderColor = '#E2E8F0';
                  }}
                >
                  <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: 4,
                    background: m.color,
                  }} />

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 14,
                      background: m.bg, color: m.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 900, fontSize: '1.1rem',
                    }}>
                      <IconComponent size={22} />
                    </div>
                    <span style={{
                      background: m.bg, color: m.color,
                      padding: '4px 12px', borderRadius: 99,
                      fontSize: '0.78rem', fontWeight: 800,
                    }}>
                      พันธกิจที่ {m.num}
                    </span>
                  </div>

                  <h4 style={{ margin: '4px 0 0', fontSize: '1.08rem', fontWeight: 800, color: '#0F172A', lineHeight: 1.4 }}>
                    {m.title}
                  </h4>

                  <p style={{
                    margin: 0, fontSize: '0.92rem', color: '#475569',
                    lineHeight: 1.7, flex: 1,
                  }}>
                    {m.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* ส่วนที่ 2: เป้าประสงค์ (Goals) 6 ข้อ */}
        <div style={{ marginBottom: '3rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: '1.5rem' }}>
            <span style={{ width: 6, height: 28, borderRadius: 4, background: 'linear-gradient(180deg,#0284C7,#38BDF8)' }} />
            <div>
              <h3 style={{ margin: 0, fontWeight: 900, color: '#0F172A', fontSize: '1.5rem' }}>
                เป้าประสงค์ (Goals)
              </h3>
              <p style={{ margin: '4px 0 0', color: '#64748B', fontSize: '0.9rem' }}>
                ผลสัมฤทธิ์และเป้าหมายความสำเร็จ 6 ประการที่สถานศึกษาตั้งไว้
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.2rem' }}>
            {goals.map((goal, idx) => (
              <div
                key={idx}
                style={{
                  background: '#F8FAFC',
                  borderRadius: 18,
                  padding: '1.4rem 1.6rem',
                  border: '1px solid #E2E8F0',
                  display: 'flex',
                  gap: 14,
                  alignItems: 'flex-start',
                }}
              >
                <div style={{
                  minWidth: 32, height: 32, borderRadius: 10,
                  background: '#0284C7', color: 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 900, fontSize: '0.9rem', marginTop: 2,
                }}>
                  {idx + 1}
                </div>
                <div style={{ fontSize: '0.93rem', color: '#334155', lineHeight: 1.7, fontWeight: 600 }}>
                  {goal}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ส่วนที่ 3: กลยุทธ์ (Strategies) 8 ข้อ */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: '1.5rem' }}>
            <span style={{ width: 6, height: 28, borderRadius: 4, background: 'linear-gradient(180deg,#10B981,#34D399)' }} />
            <div>
              <h3 style={{ margin: 0, fontWeight: 900, color: '#0F172A', fontSize: '1.5rem' }}>
                กลยุทธ์การพัฒนาสถานศึกษา (Strategies)
              </h3>
              <p style={{ margin: '4px 0 0', color: '#64748B', fontSize: '0.9rem' }}>
                แนวทางการดำเนินงาน 8 กลยุทธ์เพื่อขับเคลื่อนการจัดการศึกษาอย่างเป็นรูปธรรม
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.2rem' }}>
            {strategies.map((st) => (
              <div
                key={st.no}
                style={{
                  background: 'white',
                  borderRadius: 18,
                  padding: '1.4rem 1.5rem',
                  border: '1px solid #E2E8F0',
                  boxShadow: '0 4px 14px rgba(15,23,42,0.03)',
                  display: 'flex',
                  gap: 14,
                  alignItems: 'flex-start',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = '#10B981';
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 10px 24px rgba(16,185,129,0.12)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = '#E2E8F0';
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 14px rgba(15,23,42,0.03)';
                }}
              >
                <div style={{
                  minWidth: 42, height: 42, borderRadius: 12,
                  background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                  color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 900, fontSize: '1rem', boxShadow: '0 4px 10px rgba(16,185,129,0.3)',
                  flexShrink: 0,
                }}>
                  {st.no}
                </div>
                <div>
                  <div style={{
                    fontSize: '0.75rem', fontWeight: 800, color: '#059669',
                    letterSpacing: 0.5, marginBottom: 4, textTransform: 'uppercase',
                  }}>
                    กลยุทธ์ที่ {st.no} · {st.focus}
                  </div>
                  <div style={{ fontSize: '0.92rem', color: '#1E293B', lineHeight: 1.65, fontWeight: 700 }}>
                    {st.title}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ท้ายเอกสารราชการ */}
        <div style={{
          marginTop: '3rem',
          padding: '1.8rem',
          borderRadius: 20,
          background: '#F8FAFC',
          border: '1px dashed #CBD5E1',
          textAlign: 'center',
          color: '#64748B',
          fontSize: '0.88rem',
        }}>
          <div style={{ fontWeight: 800, color: '#0F172A', fontSize: '1rem', marginBottom: 4 }}>
            {SCHOOL_NAME}
          </div>
          <div>{SCHOOL_AFFILIATION} · กระทรวงศึกษาธิการ</div>
          <div style={{ marginTop: 8, fontSize: '0.8rem', color: '#94A3B8' }}>
            เอกสารวิสัยทัศน์ในการบริหารจัดการสถานศึกษา (ระยะเวลา 1 ปี พ.ศ. 2570)
          </div>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    if (activeSlug === 'vision') {
      return renderVisionPage();
    }
    if (activeSlug === 'students') {
      return renderStudentsPage();
    }
    if (activeSlug === 'contact') {
      return renderContactPage();
    }
    if (activeSlug === 'campus' || activeSlug === 'buildings' || activeSlug === 'school-buildings') {
      return renderBuildingsPage();
    }
    if (activeSlug === 'e-service' || activeSlug === 'timetable' || activeSlug === 'eservice') {
      return (
        <div className="animate-fade-in">
          <div style={{
            background: 'linear-gradient(135deg,#0F172A 0%,#1E3A8A 55%,#FF6A01 100%)',
            color: 'white', borderRadius: 24, padding: '1.8rem 2rem',
            marginBottom: '1.5rem', boxShadow: '0 20px 50px rgba(15,23,42,0.18)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14,
          }}>
            <div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontSize: '0.8rem', fontWeight: 800, letterSpacing: 1.5,
                background: 'rgba(255,255,255,0.15)', padding: '4px 12px', borderRadius: 99, marginBottom: 8,
              }}>
                🎒 E-SERVICE สำหรับนักเรียน & ผู้ปกครอง
              </div>
              <h2 style={{ margin: '4px 0 6px', fontSize: '1.85rem', fontWeight: 900 }}>
                📅 ตารางเรียนประจำห้องเรียน (ป.1 – ม.3)
              </h2>
              <p style={{ opacity: 0.9, margin: 0, fontSize: '0.92rem' }}>
                ภาคเรียนที่ 2 ปีการศึกษา 2569 · เลือกระดับชั้นของนักเรียนเพื่อดูตารางเรียนรายสัปดาห์ (โหมดดูข้อมูล)
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{
                background: 'rgba(255,255,255,0.12)', color: '#F1F5F9',
                padding: '8px 14px', borderRadius: 12, fontWeight: 700, fontSize: '0.82rem',
                border: '1px solid rgba(255,255,255,0.2)', display: 'inline-flex', alignItems: 'center', gap: 6,
              }}>
                🔒 โหมดนักเรียน (ดูอย่างเดียว)
              </span>
              <button
                onClick={() => window.print()}
                style={{
                  background: 'white', color: '#0F172A', border: 'none',
                  padding: '9px 18px', borderRadius: 12, fontWeight: 900, fontSize: '0.86rem',
                  boxShadow: '0 6px 18px rgba(0,0,0,0.18)', display: 'inline-flex', alignItems: 'center', gap: 8,
                  cursor: 'pointer',
                }}
              >
                <Printer size={15} /> พิมพ์ตารางเรียน (A4)
              </button>
            </div>
          </div>
          <TimetableSmart readOnly />
        </div>
      );
    }
    if (dynamicPage?.blocks && dynamicPage.blocks.length > 0) {
      return renderBlocks(dynamicPage.blocks);
    }
    if (data.type === 'text') {
      return <div className="animate-fade-in">{renderFormattedText(data.content)}</div>;
    }

    if (data.type === 'personnel' || data.type === 'personnel-groups') {
      const renderPersonCard = (person: any, isBig = false) => (
        <div key={person.id || person.name}
          onClick={() => setActivePerson(person)}
          style={{
            background: 'white', borderRadius: '24px', overflow: 'hidden',
            boxShadow: '0 4px 20px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9',
            textAlign: 'center', transition: 'all 0.3s ease',
            height: '100%', cursor: 'pointer',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-6px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 18px 40px rgba(255,106,1,0.18)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(0,0,0,0.04)'; }}
        >
          <div style={{ width: '100%', aspectRatio: '3 / 4', maxHeight: isBig ? '520px' : '420px', background: '#f8fafc', overflow: 'hidden' }}>
            <DriveImage
              src={person.image || person.imageUrl || `/personnel/${person.name}.jpg`}
              fallback={`/personnel/${person.name}.jpg`}
              alt={person.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }}
            />
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

      if (personnelLoading) return <LoadingState text="กำลังโหลดข้อมูลบุคลากร..." />;

      const heads = displayPersonnel.filter(p => p.isHead);
      const others = displayPersonnel.filter(p => !p.isHead);

      return (
        <div className="animate-fade-in">
          {heads.length > 0 && (
            <div style={{ marginBottom: '4rem' }}>
              <SectionHeading text="หัวหน้างาน" />
              {heads.length === 1 ? (
                <div style={{ maxWidth: '360px', margin: '0 auto' }}>
                  {renderPersonCard(heads[0], true)}
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '2rem' }}>
                  {heads.map(h => renderPersonCard(h))}
                </div>
              )}
            </div>
          )}
          {others.length > 0 && (
            <>
              <SectionHeading text={heads.length > 0 ? "สมาชิกกลุ่มงาน" : "คณะครูและบุคลากร"} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '2rem' }}>
                {others.map(person => renderPersonCard(person))}
              </div>
            </>
          )}
          {displayPersonnel.length === 0 && (
            <div style={{ textAlign: 'center', padding: '4rem 2rem', background: '#F8FAFC', borderRadius: 20, color: '#64748B' }}>
              ยังไม่มีรายชื่อบุคลากรในหมวดนี้
            </div>
          )}
          {/* ครูโรงเรียนสาขา — ข้อมูลคนละชุดกับบุคลากรด้านบน แสดงเฉพาะหน้า "บุคลากร" */}
          {activeSlug === 'teacher' && <BranchPersonnel />}
        </div>
      );
    }

    if (data.type === 'gallery') {
      return (
        <div className="animate-fade-in">
          {postsLoading ? (
            <LoadingState text="กำลังโหลดอัลบั้มภาพ..." />
          ) : firebasePosts.length === 0 ? (
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
      if (postsLoading) {
        return <LoadingState text="กำลังโหลดข่าวสาร..." />;
      }

      return (
        <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '2rem' }}>
          {firebasePosts.map((post) => (
            <div key={post.id} onClick={() => setActivePost(post as NewsItem)} style={{ background: 'white', borderRadius: '24px', overflow: 'hidden', border: '1px solid #f1f5f9', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', cursor: 'pointer', transition: 'transform 0.2s ease, box-shadow 0.2s ease' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 30px rgba(255,106,1,0.15)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.03)'; }}
            >
              <div style={{ height: '200px', background: '#f8fafc' }}>
                {post.imageUrl?.trim() ? (
                  <DriveImage src={post.imageUrl} alt={post.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : post.facebookUrl?.trim() ? (
                  <FacebookPostCard url={post.facebookUrl} preview />
                ) : (
                  <DriveImage src={post.imageUrl} alt={post.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                )}
              </div>
              <div style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '0.8rem', marginBottom: '0.8rem' }}>
                  <Calendar size={14} /> {post.date}
                </div>
                <h4 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '1rem', color: '#1e293b', lineHeight: 1.4 }}>{post.title}</h4>
                <p style={{ fontSize: '0.9rem', color: '#64748b', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                  {post.content?.trim()
                    ? `${post.content.substring(0, 90)}...`
                    : (post.facebookUrl?.trim() ? 'อ่านรายละเอียด รูปภาพ และความเคลื่อนไหวต่อได้บน Facebook' : '')}
                </p>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <span style={{ color: '#FF6A01', fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {post.facebookUrl?.trim() ? 'เปิดโพสต์ Facebook' : 'อ่านรายละเอียด'} <ChevronRight size={16} />
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
                  {post.facebookUrl && post.facebookUrl.trim() !== '' && (
                    <a href={post.facebookUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ color: '#1877F2', fontSize: '0.8rem', textDecoration: 'none', background: '#EFF6FF', padding: '4px 8px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Globe size={14} /> Facebook
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
                {post.facebookUrl && post.facebookUrl.trim() !== '' && (
                  <div style={{ marginTop: '1rem' }}>
                    <FacebookPostCard url={post.facebookUrl} compact />
                  </div>
                )}
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
          <h1 style={{ color: 'white', fontSize: 'clamp(1.6rem, 6vw, 3.5rem)', fontWeight: 900, marginBottom: '0', letterSpacing: '-1px', lineHeight: 1.15 }}>{data.title}</h1>
          <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: 'clamp(0.95rem, 3vw, 1.2rem)', marginTop: '1rem' }}>{data.subtitle}</p>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="container content-page-main" style={{ marginTop: '-4rem', paddingBottom: '8rem', position: 'relative', zIndex: 20 }}>
        <div className="content-page-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 320px) 1fr', gap: '3rem', alignItems: 'start' }}>

          {/* MWIT Style Sidebar */}
          <aside className="content-page-sidebar" style={{ position: 'sticky', top: '100px' }}>
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
                    onMouseOver={e => { if (activeSlug !== link.path) e.currentTarget.style.color = '#FF6A01'; }}
                    onMouseOut={e => { if (activeSlug !== link.path) e.currentTarget.style.color = '#64748b'; }}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>

            <div style={{ marginTop: '2rem', padding: '2rem', background: 'linear-gradient(to bottom right, #FFFFFF, #FFF7ED)', borderRadius: '24px', border: '1px solid #FFEDD5', textAlign: 'center' }}>
              <h5 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#C2410C', marginBottom: '0.8rem' }}>ติดต่อสอบถาม</h5>
              <p style={{ fontSize: '0.85rem', color: '#9a3412', lineHeight: 1.6, margin: 0 }}>
                ฝ่ายบริหารงานโรงเรียน<br />
                โทร: <a href={`tel:${SCHOOL_PHONE}`} style={{ color: 'inherit' }}>{SCHOOL_PHONE}</a><br />
                อีเมล: <a href={`mailto:${SCHOOL_EMAIL}`} style={{ color: 'inherit' }}>{SCHOOL_EMAIL}</a>
              </p>
            </div>
          </aside>

          {/* Premium Content Card */}
          <section className="content-page-card" style={{ background: 'white', padding: '4rem', borderRadius: '32px', boxShadow: '0 10px 30px rgba(0,0,0,0.02)', border: '1px solid #f1f5f9', minHeight: '600px' }}>
            {/* Dynamic Content */}
            {renderContent()}
          </section>

        </div>
      </main>

      <Footer />

      <NewsModal post={activePost} onClose={() => setActivePost(null)} />

      {/* Personnel detail modal */}
      {activePerson && (
        <div
          onClick={() => setActivePerson(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1rem', animation: 'fadeIn .25s ease-out',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'white', borderRadius: 24, maxWidth: 900, width: '100%',
              maxHeight: '92vh', overflow: 'auto',
              boxShadow: '0 30px 80px rgba(0,0,0,0.4)',
              display: 'grid', gridTemplateColumns: 'minmax(0,420px) 1fr',
              animation: 'modalIn .3s cubic-bezier(.2,.9,.3,1.2)',
            }}
          >
            {/* Image side */}
            <div style={{ background: '#0F172A', minHeight: 360, position: 'relative' }}>
              <DriveImage
                src={activePerson.image || activePerson.imageUrl || `/personnel/${activePerson.name}.jpg`}
                fallback={`/personnel/${activePerson.name}.jpg`}
                alt={activePerson.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', minHeight: 360 }}
              />
              {activePerson.isHead && (
                <div style={{
                  position: 'absolute', top: 16, left: 16,
                  background: 'linear-gradient(135deg,#FF6A01,#FB923C)',
                  color: 'white', padding: '6px 14px', borderRadius: 50,
                  fontSize: '0.78rem', fontWeight: 800,
                  boxShadow: '0 8px 20px rgba(255,106,1,0.45)',
                }}>★ หัวหน้างาน</div>
              )}
            </div>

            {/* Info side */}
            <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column' }}>
              <button
                onClick={() => setActivePerson(null)}
                style={{
                  alignSelf: 'flex-end', background: '#F1F5F9', border: 'none',
                  width: 36, height: 36, borderRadius: '50%', cursor: 'pointer',
                  fontSize: '1.2rem', fontWeight: 800, color: '#475569',
                }}
                aria-label="ปิด"
              >×</button>

              <h2 style={{ fontSize: '1.6rem', fontWeight: 900, color: '#0F172A', margin: '0 0 6px' }}>
                {activePerson.name}
              </h2>
              <div style={{ color: '#FF6A01', fontWeight: 800, marginBottom: '1.5rem' }}>
                {activePerson.position}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {activePerson.major && (
                  <div style={infoRow}><span style={infoLabel}>วิชาเอก</span><span style={infoVal}>{activePerson.major}</span></div>
                )}
                {activePerson.workGroup && (
                  <div style={infoRow}><span style={infoLabel}>กลุ่มงาน</span><span style={infoVal}>{personnelLabel(activePerson.workGroup, WORK_GROUP_LABELS)}</span></div>
                )}
                {activePerson.positionNumber && (
                  <div style={infoRow}><span style={infoLabel}>เลขที่ตำแหน่ง</span><span style={infoVal}>{activePerson.positionNumber}</span></div>
                )}
                {activePerson.phone && (
                  <div style={infoRow}>
                    <span style={infoLabel}>โทรศัพท์</span>
                    <a href={`tel:${activePerson.phone}`} style={{ ...infoVal, color: '#0EA5E9', textDecoration: 'none' }}>
                      {activePerson.phone}
                    </a>
                  </div>
                )}
                {activePerson.email && (
                  <div style={infoRow}>
                    <span style={infoLabel}>อีเมล</span>
                    <a href={`mailto:${activePerson.email}`} style={{ ...infoVal, color: '#0EA5E9', textDecoration: 'none' }}>
                      {activePerson.email}
                    </a>
                  </div>
                )}
                {activePerson.category && (
                  <div style={infoRow}><span style={infoLabel}>สังกัด</span><span style={infoVal}>{personnelLabel(activePerson.category, PERSONNEL_CATEGORY_LABELS)}</span></div>
                )}
              </div>

              {/* Action buttons */}
              <div style={{ marginTop: 'auto', paddingTop: '1.5rem', display: 'flex', gap: 8, flexWrap: 'nowrap', alignItems: 'center' }}>
                {activePerson.websiteUrl && (
                  <a href={activePerson.websiteUrl} target="_blank" rel="noreferrer"
                    style={modalBtn('#FF6A01')}>
                    🌐 เข้าเว็บไซต์ครู
                  </a>
                )}
                {activePerson.phone && (
                  <a href={`tel:${activePerson.phone}`} style={modalBtn('#10B981')}>
                    📞 โทร
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Premium Specific CSS Effects */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modalIn { from { opacity: 0; transform: translateY(20px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @media (max-width: 720px) {
          [data-personnel-modal] { grid-template-columns: 1fr !important; }
        }
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
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" /></svg>
);

export default ContentPage;
