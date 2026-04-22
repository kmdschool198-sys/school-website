import { useState, useEffect, useMemo } from 'react';
import {
  ArrowRight, Video, Globe, FileText, Image as ImageIcon,
  GraduationCap, ClipboardList, CalendarDays, FolderOpen,
  Award, Target, BookOpen, Users, Sparkles, Heart, ShieldCheck,
  ChevronRight, Phone, Mail, MapPin, Quote, Images
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import '../App.css';
import Header from '../components/Header';
import Footer from '../components/Footer';

import { getDirectImageUrl } from '../utils/imageUtils';
import DriveImage from '../components/DriveImage';
import NewsModal, { type NewsItem } from '../components/NewsModal';
import { DEFAULT_ACTIVITIES, COLOR_ACTIVITY } from '../data/defaultActivities';

interface HomePost {
  id: string;
  title: string;
  content: string;
  date: string;
  category: string;
  link?: string;
  imageUrl?: string;
  imageType?: 'image' | 'pdf';
  albumUrl?: string;
  tiktokUrl?: string;
  websiteUrl?: string;
  documentUrl?: string;
}

interface Highlight {
  id: string;
  badge: string;
  title: string;
  titleAccent: string;
  description: string;
  buttonText: string;
  imageUrl: string;
  order: number;
}

function Home() {
  const [posts, setPosts] = useState<HomePost[]>([]);
  const [heroSlides, setHeroSlides] = useState<string[]>([]);
  const [schoolInfo, setSchoolInfo] = useState<any>(null);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [currentHeroSlide, setCurrentHeroSlide] = useState(0);
  const [currentHighlightSlide, setCurrentHighlightSlide] = useState(0);
  const [activePost, setActivePost] = useState<NewsItem | null>(null);
  const [activities, setActivities] = useState<any[]>([]);

  useEffect(() => {
    getDoc(doc(db, 'config', 'home_assets')).then(snap => {
      if (snap.exists()) setSchoolInfo((prev: any) => ({ ...prev, ...snap.data() }));
    });
    getDoc(doc(db, 'config', 'school_info')).then(snap => {
      if (snap.exists()) setSchoolInfo((prev: Record<string, any>) => ({ ...prev, ...snap.data() }));
    });

    const hq = query(collection(db, 'highlights'), orderBy('order', 'asc'));
    const unsubH = onSnapshot(hq, snap => {
      const items: Highlight[] = [];
      snap.forEach(d => items.push({ id: d.id, ...(d.data() as any) }));
      setHighlights(items);
    });

    const q = query(collection(db, 'posts'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allItems: HomePost[] = [];
      snapshot.forEach(d => allItems.push({ id: d.id, ...(d.data() as any) }));
      allItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      const fetchedPosts: HomePost[] = [];
      const fetchedSlides: string[] = [];
      allItems.forEach((data) => {
        if (data.category === 'แบนเนอร์สไลด์หน้าแรก' && data.imageUrl) {
          fetchedSlides.push(data.imageUrl);
        } else if (data.category !== 'แบนเนอร์สไลด์หน้าแรก') {
          fetchedPosts.push({ ...data });
        }
      });
      setHeroSlides(fetchedSlides);
      setPosts(fetchedPosts.slice(0, 6));
    });

    const unsubAct = onSnapshot(collection(db, 'activities'), snap => {
      const arr: any[] = [];
      snap.forEach(d => arr.push({ id: d.id, ...(d.data() as any) }));
      const ids = new Set(arr.map(a => a.id));
      const merged = [...DEFAULT_ACTIVITIES.filter(a => !ids.has(a.id)), ...arr];
      merged.forEach(a => { if (!a.color && !a.isHoliday) a.color = COLOR_ACTIVITY; });
      setActivities(merged);
    });

    return () => { unsubscribe(); unsubH(); unsubAct(); };
  }, []);

  useEffect(() => {
    if (heroSlides.length <= 1) return;
    const i = setInterval(() => setCurrentHeroSlide(p => (p + 1) % heroSlides.length), 6000);
    return () => clearInterval(i);
  }, [heroSlides.length]);

  useEffect(() => {
    if (highlights.length <= 1) return;
    const i = setInterval(() => setCurrentHighlightSlide(p => (p + 1) % highlights.length), 10000);
    return () => clearInterval(i);
  }, [highlights.length]);

  const aboutImgRaw = schoolInfo?.homeAboutImg;
  const hlImg1Raw = schoolInfo?.homeHighlight1Img;
  const hlImg2Raw = schoolInfo?.homeHighlight2Img;
  const aboutImg = aboutImgRaw ? getDirectImageUrl(aboutImgRaw) : "/school_history.png";
  const hlImg1 = hlImg1Raw ? getDirectImageUrl(hlImg1Raw) : "https://images.unsplash.com/photo-1509062522246-3755977927d7?q=80&w=1200";
  const hlImg2 = hlImg2Raw ? getDirectImageUrl(hlImg2Raw) : "https://images.unsplash.com/photo-1544027993-37dbfe43562a?q=80&w=1200";

  // Upcoming events (next 4) from today
  const todayStr = new Date().toISOString().split('T')[0];
  const upcoming = useMemo(() =>
    activities.filter(a => a.date >= todayStr).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4),
    [activities, todayStr]
  );

  // Album previews from posts with albumUrl
  const albumPosts = useMemo(() => posts.filter(p => p.albumUrl && p.albumUrl.trim() !== '').slice(0, 3), [posts]);

  return (
    <div className="app-container" style={{ backgroundColor: '#ffffff' }}>
      <Header />

      {/* ============== HERO ============== */}
      <section style={{ height: '92vh', minHeight: 640, width: '100%', position: 'relative', overflow: 'hidden', background: '#0F172A' }}>
        {heroSlides.length > 0 ? (
          <DriveImage src={heroSlides[currentHeroSlide]} alt="hero"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #FF6A01 0%, #FB923C 100%)' }} />
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(15,23,42,0.55) 0%, rgba(15,23,42,0.4) 50%, rgba(15,23,42,0.85) 100%)' }} />

        <div className="container" style={{ position: 'relative', zIndex: 10, height: '100%', display: 'flex', alignItems: 'center' }}>
          <div style={{ maxWidth: '820px' }}>
            <div className="animate-fade-in" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '0.5rem 1.2rem', background: 'rgba(255,106,1,0.95)', borderRadius: '50px', marginBottom: '2rem', boxShadow: '0 10px 30px rgba(255,106,1,0.4)' }}>
              <Sparkles size={14} color="white" />
              <h5 style={{ color: 'white', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 800, fontSize: '0.75rem', margin: 0 }}>Excellence In Education</h5>
            </div>

            <h1 style={{ fontSize: 'clamp(2.8rem, 7vw, 5.5rem)', fontWeight: 900, color: '#fff', lineHeight: 1.05, marginBottom: '1.2rem', textShadow: '0 10px 30px rgba(0,0,0,0.4)', letterSpacing: '-1px' }}>
              Learn. Grow.<br />
              <span style={{ color: '#FFD400' }}>Inspire.</span>
            </h1>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'rgba(255,255,255,0.95)', marginBottom: '1rem', letterSpacing: '0.5px' }}>
              โรงเรียนบ้านคลองมดแดง <span style={{ opacity: 0.6, fontWeight: 600 }}>· Ban Klong Mod Daeng School</span>
            </div>

            <p style={{ fontSize: '1.05rem', color: 'rgba(255,255,255,0.85)', marginBottom: '2.5rem', maxWidth: '600px', lineHeight: 1.7 }}>
              สังกัด สพป.กำแพงเพชร เขต 2 — "สะอาด มีวินัย มุ่งมั่นเรียนรู้ เชิดชูคุณธรรม"
            </p>

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <Link to="/page/history" className="btn-premium" style={{ background: '#FF6A01', color: 'white', padding: '1.1rem 2.5rem', borderRadius: '14px', fontSize: '1.05rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 15px 35px rgba(255,106,1,0.5)', textDecoration: 'none' }}>
                รู้จักโรงเรียนของเรา <ArrowRight size={20} />
              </Link>
              <Link to="/calendar" style={{ background: 'rgba(255,255,255,0.12)', color: 'white', padding: '1.1rem 2.5rem', border: '2px solid rgba(255,255,255,0.5)', borderRadius: '14px', fontSize: '1.05rem', fontWeight: 700, backdropFilter: 'blur(10px)', textDecoration: 'none' }}>
                ปฏิทินกิจกรรม
              </Link>
            </div>

            {heroSlides.length > 1 && (
              <div style={{ display: 'flex', gap: 8, marginTop: '3rem' }}>
                {heroSlides.map((_, i) => (
                  <div key={i} onClick={() => setCurrentHeroSlide(i)}
                    style={{ width: i === currentHeroSlide ? 36 : 12, height: 6, borderRadius: 50, background: i === currentHeroSlide ? '#FF6A01' : 'rgba(255,255,255,0.4)', cursor: 'pointer', transition: 'all .3s' }} />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ============== QUICK ACCESS STRIP ============== */}
      <section style={{ marginTop: '-70px', position: 'relative', zIndex: 20, paddingBottom: '4rem' }}>
        <div className="container">
          <div style={{ background: 'white', borderRadius: '28px', padding: '1.5rem', boxShadow: '0 30px 70px rgba(15,23,42,0.12)', border: '1px solid #FFEDD5', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem' }}>
            {[
              { to: '/page/pr-news', icon: <ClipboardList size={24} />, label: 'ข่าวประชาสัมพันธ์', sub: 'อัปเดตล่าสุด', color: '#FF6A01' },
              { to: '/calendar', icon: <CalendarDays size={24} />, label: 'ปฏิทินกิจกรรม', sub: 'วันสำคัญ/วันพระ', color: '#10B981' },
              { to: '/page/gallery', icon: <Images size={24} />, label: 'ภาพกิจกรรม', sub: 'อัลบั้มทั้งหมด', color: '#EC4899' },
              { to: '/page/e-newsletter', icon: <FolderOpen size={24} />, label: 'จดหมายข่าว', sub: 'E-Newsletter', color: '#A855F7' },
            ].map((q, i) => (
              <Link key={i} to={q.to} className="quick-card" style={{ textDecoration: 'none', color: 'inherit', padding: '1.25rem 1rem', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '14px', transition: 'all .3s' }}>
                <div style={{ width: 52, height: 52, borderRadius: '14px', background: `${q.color}15`, color: q.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {q.icon}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800, color: '#0F172A', fontSize: '0.95rem' }}>{q.label}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{q.sub}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ============== STATS ============== */}
      <section style={{ padding: '4rem 0 6rem', background: 'white' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
            {[
              { val: '44+', label: 'ปีแห่งการก่อตั้ง', sub: 'ก่อตั้ง พ.ศ. 2525', icon: <Award size={28} /> },
              { val: '300+', label: 'นักเรียน', sub: 'ระดับอนุบาล - ม.3', icon: <Users size={28} /> },
              { val: '20+', label: 'บุคลากร', sub: 'ครูและสายสนับสนุน', icon: <Heart size={28} /> },
              { val: '4', label: 'ยุทธศาสตร์', sub: 'จุดเน้นการพัฒนา', icon: <Target size={28} /> },
            ].map((s, i) => (
              <div key={i} className="stat-card" style={{ padding: '2rem 1.5rem', background: 'linear-gradient(135deg,#FFF7ED,#FFFFFF)', borderRadius: '24px', border: '1px solid #FFEDD5', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 16, right: 16, color: '#FF6A01', opacity: 0.25 }}>{s.icon}</div>
                <h3 style={{ fontSize: '3rem', fontWeight: 900, color: '#FF6A01', margin: '0 0 0.5rem 0' }}>{s.val}</h3>
                <h5 style={{ fontSize: '1rem', fontWeight: 800, color: '#0F172A', marginBottom: '0.25rem' }}>{s.label}</h5>
                <p style={{ color: '#64748B', fontSize: '0.82rem', margin: 0 }}>{s.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============== VISION / IDENTITY / 4 PILLARS ============== */}
      <section style={{ padding: '6rem 0', background: 'linear-gradient(180deg, #FFF7ED 0%, #FFFFFF 100%)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <h5 style={{ color: '#FF6A01', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '4px', fontSize: '0.8rem', marginBottom: '1rem' }}>Vision · Mission · Identity</h5>
            <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 950, margin: 0, color: '#0F172A' }}>
              วิสัยทัศน์ <span style={{ color: '#FF6A01' }}>นำพานักเรียน</span> ก้าวไปด้วยกัน
            </h2>
          </div>

          {/* Vision banner card */}
          <div style={{ background: 'linear-gradient(135deg, #FF6A01, #FB923C)', borderRadius: '32px', padding: '3rem', color: 'white', marginBottom: '3rem', boxShadow: '0 30px 70px rgba(255,106,1,0.25)', position: 'relative', overflow: 'hidden' }}>
            <Quote size={120} style={{ position: 'absolute', top: -10, right: 20, opacity: 0.12 }} />
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem', position: 'relative' }}>
              <div style={{ width: 56, height: 56, borderRadius: '16px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Target size={28} />
              </div>
              <div>
                <div style={{ opacity: 0.9, fontSize: '0.85rem', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' }}>วิสัยทัศน์</div>
                <h3 style={{ margin: 0, fontWeight: 900, fontSize: '1.5rem' }}>โรงเรียนบ้านคลองมดแดง</h3>
              </div>
            </div>
            <p style={{ fontSize: '1.4rem', fontWeight: 700, lineHeight: 1.6, margin: 0, position: 'relative', maxWidth: 900 }}>
              "จัดการศึกษาที่มีคุณภาพตามมาตรฐานการศึกษา พัฒนาผู้เรียนให้เป็นคนดี มีความรู้ มีทักษะ และดำรงชีวิตอย่างมีความสุขในสังคม"
            </p>
          </div>

          {/* 4 Pillars */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
            {[
              { icon: <BookOpen size={26} />, title: 'พัฒนาวิชาการ', desc: 'ยกระดับผลสัมฤทธิ์ทางการเรียนและพัฒนาทักษะการเรียนรู้ในศตวรรษที่ 21', color: '#3B82F6' },
              { icon: <Heart size={26} />, title: 'ส่งเสริมคุณธรรม', desc: 'ปลูกฝังคุณธรรม จริยธรรม และคุณลักษณะอันพึงประสงค์', color: '#EC4899' },
              { icon: <Sparkles size={26} />, title: 'นำเทคโนโลยี', desc: 'ใช้สื่อและนวัตกรรมการเรียนการสอนทันสมัย เปิดโลกการเรียนรู้', color: '#A855F7' },
              { icon: <ShieldCheck size={26} />, title: 'บริหารโปร่งใส', desc: 'ระบบบริหารจัดการมีคุณภาพ ตรวจสอบได้ ชุมชนมีส่วนร่วม', color: '#10B981' },
            ].map((p, i) => (
              <div key={i} className="pillar-card" style={{ background: 'white', padding: '2rem 1.5rem', borderRadius: '24px', border: '1px solid #F1F5F9', boxShadow: '0 4px 20px rgba(0,0,0,0.04)', transition: 'all .3s' }}>
                <div style={{ width: 56, height: 56, borderRadius: '16px', background: `${p.color}15`, color: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem' }}>
                  {p.icon}
                </div>
                <h4 style={{ fontWeight: 900, color: '#0F172A', marginBottom: '0.75rem', fontSize: '1.15rem' }}>{p.title}</h4>
                <p style={{ color: '#64748B', fontSize: '0.92rem', lineHeight: 1.7, margin: 0 }}>{p.desc}</p>
              </div>
            ))}
          </div>

          {/* Identity badge strip */}
          <div style={{ marginTop: '3rem', display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center', alignItems: 'center' }}>
            <span style={{ fontSize: '0.95rem', color: '#64748B', fontWeight: 700 }}>อัตลักษณ์โรงเรียน:</span>
            {['สะอาด', 'มีวินัย', 'มุ่งมั่นเรียนรู้', 'เชิดชูคุณธรรม'].map((t, i) => (
              <span key={i} style={{ padding: '8px 20px', background: 'white', border: '2px solid #FF6A01', color: '#FF6A01', borderRadius: '50px', fontWeight: 800, fontSize: '0.95rem' }}>{t}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ============== HIGHLIGHT SLIDER ============== */}
      {(() => {
        const fallback: Highlight[] = [
          { id: 'f1', badge: 'Excellence', title: 'การศึกษาระดับมาตรฐาน', titleAccent: 'ก้าวสู่สากล', description: 'มุ่งเน้นการสอนที่ผสมผสานเทคโนโลยีสมัยใหม่ เตรียมพร้อมนักเรียนสำหรับศตวรรษที่ 21', buttonText: 'อ่านรายละเอียดข้อมูลสารสนเทศ', imageUrl: hlImg1, order: 1 },
          { id: 'f2', badge: 'Innovation', title: 'ล้ำสมัยด้วย', titleAccent: 'เทคโนโลยีการสอน', description: 'ห้องเรียนอัจฉริยะ พร้อมอุปกรณ์ครบวงจร เปิดโลกแห่งการเรียนรู้ไร้ขีดจำกัด', buttonText: 'รู้จักเทคโนโลยีของเรา', imageUrl: hlImg2, order: 2 },
        ];
        const slides = highlights.length > 0 ? highlights : fallback;
        const safeIdx = currentHighlightSlide % slides.length;
        return (
          <section style={{ padding: '8rem 0', background: '#0F172A', color: 'white' }}>
            <div className="container">
              {slides.map((s, i) => (
                <div key={s.id} style={{ display: i === safeIdx ? 'grid' : 'none', gridTemplateColumns: '1fr 1fr', gap: '4rem', alignItems: 'center', animation: 'fadeIn 0.8s ease' }}>
                  <div>
                    <div style={{ display: 'inline-block', padding: '0.5rem 1.5rem', background: 'rgba(255,106,1,0.2)', color: '#FF6A01', borderRadius: '50px', fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '1.5rem' }}>{s.badge}</div>
                    <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3.2rem)', fontWeight: 950, marginBottom: '1.5rem', lineHeight: 1.15 }}>
                      {s.title} <br /><span style={{ color: '#FFD400' }}>{s.titleAccent}</span>
                    </h2>
                    <p style={{ fontSize: '1.1rem', color: 'rgba(255,255,255,0.8)', lineHeight: 1.8, marginBottom: '2rem' }}>{s.description}</p>
                    {s.buttonText && (
                      <button style={{ background: '#FF6A01', color: 'white', padding: '1rem 2.5rem', borderRadius: '12px', border: 'none', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        {s.buttonText} <ArrowRight size={18} />
                      </button>
                    )}
                  </div>
                  <div style={{ position: 'relative', borderRadius: '32px', overflow: 'hidden', boxShadow: '0 30px 70px rgba(0,0,0,0.4)', minHeight: 360, background: '#1E293B' }}>
                    <DriveImage src={s.imageUrl} alt={s.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  </div>
                </div>
              ))}
              {slides.length > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '3rem' }}>
                  {slides.map((_, i) => (
                    <div key={i} onClick={() => setCurrentHighlightSlide(i)} style={{ width: i === safeIdx ? '40px' : '12px', height: '12px', borderRadius: '50px', background: i === safeIdx ? '#FF6A01' : 'rgba(255,255,255,0.2)', cursor: 'pointer', transition: 'all 0.3s' }} />
                  ))}
                </div>
              )}
            </div>
          </section>
        );
      })()}

      {/* ============== ABOUT (Timeline + Visual Story) + UPCOMING ============== */}
      <section style={{ padding: '7rem 0', background: 'white', position: 'relative', overflow: 'hidden' }}>
        {/* Decorative bg */}
        <div style={{ position: 'absolute', top: -80, right: -80, width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,106,1,0.08), transparent 70%)' }} />
        <div style={{ position: 'absolute', bottom: -100, left: -100, width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.06), transparent 70%)' }} />

        <div className="container" style={{ position: 'relative' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '4rem', alignItems: 'start' }}>
            {/* About - Visual Story */}
            <div>
              <h5 style={{ color: '#FF6A01', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '4px', fontSize: '0.8rem', marginBottom: '1rem' }}>Our Story · 44 ปีแห่งการเรียนรู้</h5>
              <h2 style={{ fontSize: 'clamp(2rem, 4vw, 2.8rem)', fontWeight: 950, marginBottom: '2.5rem', lineHeight: 1.15, color: '#0F172A' }}>
                จากผืนดินเล็ก ๆ สู่<br /><span style={{ color: '#FF6A01' }}>บ้านหลังที่สอง</span> ของเด็ก ๆ
              </h2>

              {/* Image collage */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: '2rem', height: 320 }}>
                <div style={{ position: 'relative', borderRadius: 24, overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.12)' }}>
                  <DriveImage src={aboutImgRaw || aboutImg} fallback="/school_history.png" alt="About"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 60%, rgba(0,0,0,0.6))' }} />
                  <div style={{ position: 'absolute', bottom: 16, left: 16, color: 'white' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, opacity: 0.9, textTransform: 'uppercase', letterSpacing: 2 }}>Since</div>
                    <div style={{ fontSize: '2rem', fontWeight: 900, lineHeight: 1 }}>2525</div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ flex: 1, background: 'linear-gradient(135deg, #FF6A01, #FB923C)', borderRadius: 20, padding: '1rem', color: 'white', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <Award size={28} />
                    <div>
                      <div style={{ fontSize: '1.6rem', fontWeight: 900, lineHeight: 1 }}>44+</div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, opacity: 0.95 }}>ปีแห่งความมุ่งมั่น</div>
                    </div>
                  </div>
                  <div style={{ flex: 1, background: '#0F172A', borderRadius: 20, padding: '1rem', color: 'white', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <Users size={28} color="#FFD400" />
                    <div>
                      <div style={{ fontSize: '1.6rem', fontWeight: 900, lineHeight: 1 }}>3,000+</div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, opacity: 0.85 }}>ศิษย์เก่าทั่วประเทศ</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Timeline */}
              <div style={{ position: 'relative', paddingLeft: 32 }}>
                <div style={{ position: 'absolute', left: 11, top: 8, bottom: 8, width: 2, background: 'linear-gradient(180deg, #FF6A01, #FFEDD5)' }} />
                {[
                  { year: '2525', title: 'ก่อตั้งโรงเรียน', desc: 'เริ่มต้นการศึกษาในชุมชนตำบลโป่งน้ำร้อน', color: '#FF6A01' },
                  { year: '2540', title: 'ขยายระดับชั้น', desc: 'เปิดสอนระดับมัธยมศึกษาตอนต้น (ม.1-ม.3)', color: '#3B82F6' },
                  { year: '2560', title: 'ก้าวสู่ยุคดิจิทัล', desc: 'นำเทคโนโลยีและสื่อการสอนสมัยใหม่เข้าสู่ห้องเรียน', color: '#A855F7' },
                  { year: '2569', title: 'ปัจจุบัน', desc: 'มุ่งสู่โรงเรียนคุณภาพ พัฒนาผู้เรียนรอบด้าน', color: '#10B981' },
                ].map((t, i) => (
                  <div key={i} style={{ position: 'relative', paddingBottom: i === 3 ? 0 : 20 }}>
                    <div style={{ position: 'absolute', left: -28, top: 4, width: 24, height: 24, borderRadius: '50%', background: 'white', border: `3px solid ${t.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.color }} />
                    </div>
                    <div style={{ display: 'inline-block', padding: '2px 10px', background: `${t.color}15`, color: t.color, borderRadius: 50, fontSize: '0.72rem', fontWeight: 800, marginBottom: 4 }}>พ.ศ. {t.year}</div>
                    <div style={{ fontWeight: 800, color: '#0F172A', fontSize: '1rem' }}>{t.title}</div>
                    <div style={{ color: '#64748B', fontSize: '0.88rem', lineHeight: 1.6 }}>{t.desc}</div>
                  </div>
                ))}
              </div>

              <Link to="/page/history" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: '2rem', padding: '0.85rem 1.75rem', background: '#0F172A', color: 'white', borderRadius: 12, fontWeight: 800, textDecoration: 'none' }}>
                อ่านประวัติฉบับเต็ม <ArrowRight size={18} />
              </Link>
            </div>

            {/* Upcoming events */}
            <div>
              <h5 style={{ color: '#FF6A01', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '4px', fontSize: '0.8rem', marginBottom: '1rem' }}>Upcoming</h5>
              <h2 style={{ fontSize: '2rem', fontWeight: 950, marginBottom: '1.5rem', color: '#0F172A' }}>กิจกรรมเร็ว ๆ นี้</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {upcoming.length === 0 && (
                  <div style={{ padding: '2rem', background: '#F8FAFC', borderRadius: '20px', textAlign: 'center', color: '#94A3B8' }}>
                    ยังไม่มีกิจกรรมที่กำลังจะมาถึง
                  </div>
                )}
                {upcoming.map(a => {
                  const d = new Date(a.date);
                  return (
                    <Link key={a.id} to="/calendar" style={{ display: 'flex', gap: 16, padding: '14px 16px', background: '#FAFAFA', borderRadius: '18px', textDecoration: 'none', color: 'inherit', borderLeft: `5px solid ${a.isHoliday ? '#EF4444' : (a.color || '#FF6A01')}`, transition: 'all .25s' }}
                      onMouseOver={e => { e.currentTarget.style.background = '#FFF7ED'; e.currentTarget.style.transform = 'translateX(4px)'; }}
                      onMouseOut={e => { e.currentTarget.style.background = '#FAFAFA'; e.currentTarget.style.transform = 'translateX(0)'; }}>
                      <div style={{ width: 60, textAlign: 'center', flexShrink: 0 }}>
                        <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#FF6A01', lineHeight: 1 }}>{d.getDate()}</div>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                          {['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'][d.getMonth()]}
                        </div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 800, color: '#0F172A', fontSize: '0.95rem', marginBottom: 4 }}>{a.title}</div>
                        {a.description && <div style={{ fontSize: '0.8rem', color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.description}</div>}
                      </div>
                      <ChevronRight size={18} color="#94A3B8" style={{ alignSelf: 'center' }} />
                    </Link>
                  );
                })}
              </div>
              <Link to="/calendar" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: '1.5rem', color: '#FF6A01', fontWeight: 800, textDecoration: 'none' }}>
                ดูปฏิทินเต็ม <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ============== NEWS GRID ============== */}
      <section style={{ padding: '7rem 0', backgroundColor: '#F8FAFC' }}>
        <div className="container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '3rem', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <h5 style={{ color: '#FF6A01', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '4px', fontSize: '0.8rem', marginBottom: '0.5rem' }}>Latest Updates</h5>
              <h2 style={{ fontSize: '2.5rem', fontWeight: 950, margin: 0, color: '#0F172A' }}>ก้าวทัน <span style={{ color: '#FF6A01' }}>ข่าวสาร</span> โรงเรียน</h2>
            </div>
            <Link to="/page/pr-news" style={{ padding: '0.85rem 1.75rem', borderRadius: '12px', background: 'white', color: '#FF6A01', border: '2px solid #FF6A01', fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              ข่าวทั้งหมด <ArrowRight size={16} />
            </Link>
          </div>

          <div className="row g-4">
            {posts.length === 0 && (
              <div className="col-12" style={{ textAlign: 'center', padding: '3rem', color: '#94A3B8' }}>ยังไม่มีข่าวสาร</div>
            )}
            {posts.map((post) => (
              <div key={post.id} className="col-lg-4 col-md-6">
                <div onClick={() => setActivePost(post as NewsItem)} className="news-card" style={{ cursor: 'pointer', background: 'white', borderRadius: '24px', overflow: 'hidden', height: '100%', border: '1px solid #F1F5F9', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', transition: 'all 0.4s ease' }}>
                  <div style={{ height: 220, background: '#F8FAFC', position: 'relative' }}>
                    <DriveImage src={post.imageUrl} alt={post.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(255,106,1,0.95)', color: 'white', padding: '6px 14px', borderRadius: 50, fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>
                      {post.category}
                    </div>
                  </div>
                  <div style={{ padding: '1.75rem' }}>
                    <h4 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '1rem', lineHeight: 1.5, color: '#0F172A' }}>{post.title}</h4>

                    <div style={{ display: 'flex', gap: '6px', marginBottom: '1rem', flexWrap: 'wrap' }}>
                      {post.albumUrl?.trim() && <Tag color="#EC4899" icon={<ImageIcon size={11} />} label="อัลบั้ม" />}
                      {post.tiktokUrl?.trim() && <Tag color="#000" icon={<Video size={11} />} label="TikTok" />}
                      {post.websiteUrl?.trim() && <Tag color="#3B82F6" icon={<Globe size={11} />} label="เว็บ" />}
                      {post.documentUrl?.trim() && <Tag color="#10B981" icon={<FileText size={11} />} label="เอกสาร" />}
                      {post.imageType === 'pdf' && <Tag color="#EF4444" icon={<FileText size={11} />} label="PDF" />}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1rem', borderTop: '1px solid #F1F5F9' }}>
                      <span style={{ fontSize: '0.82rem', color: '#94A3B8', fontWeight: 600 }}>{post.date}</span>
                      <span style={{ color: '#FF6A01', fontWeight: 800, fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        อ่านต่อ <ArrowRight size={14} />
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============== GALLERY PREVIEW ============== */}
      {albumPosts.length > 0 && (
        <section style={{ padding: '7rem 0', background: 'white' }}>
          <div className="container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '3rem', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <h5 style={{ color: '#FF6A01', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '4px', fontSize: '0.8rem', marginBottom: '0.5rem' }}>Photo Gallery</h5>
                <h2 style={{ fontSize: '2.5rem', fontWeight: 950, margin: 0, color: '#0F172A' }}>อัลบั้ม <span style={{ color: '#FF6A01' }}>ภาพกิจกรรม</span></h2>
              </div>
              <Link to="/page/gallery" style={{ padding: '0.85rem 1.75rem', borderRadius: 12, background: 'white', color: '#FF6A01', border: '2px solid #FF6A01', fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                ดูทั้งหมด <ArrowRight size={16} />
              </Link>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
              {albumPosts.map(p => (
                <a key={p.id} href={p.albumUrl} target="_blank" rel="noreferrer" className="album-card" style={{ position: 'relative', borderRadius: '24px', overflow: 'hidden', height: 280, textDecoration: 'none', display: 'block', boxShadow: '0 10px 30px rgba(0,0,0,0.08)' }}>
                  <DriveImage src={p.imageUrl} alt={p.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.85) 100%)' }} />
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '1.5rem', color: 'white' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', background: 'rgba(236,72,153,0.95)', borderRadius: 50, fontSize: '0.7rem', fontWeight: 800, marginBottom: 8 }}>
                      <Images size={12} /> Google Photos
                    </div>
                    <h4 style={{ margin: 0, fontWeight: 900, fontSize: '1.1rem' }}>{p.title}</h4>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ============== CTA / CONTACT ============== */}
      <section style={{ padding: '6rem 0', background: 'linear-gradient(135deg, #FF6A01, #FB923C)', color: 'white', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -100, right: -100, width: 400, height: 400, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ position: 'absolute', bottom: -150, left: -100, width: 350, height: 350, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
        <div className="container" style={{ position: 'relative' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '3rem', alignItems: 'center' }}>
            <div>
              <h5 style={{ opacity: 0.9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 4, fontSize: '0.8rem', marginBottom: '1rem' }}>Get In Touch</h5>
              <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 950, marginBottom: '1.5rem', lineHeight: 1.2 }}>
                ติดต่อสอบถาม<br />หรือเยี่ยมชมโรงเรียน
              </h2>
              <p style={{ fontSize: '1.1rem', opacity: 0.95, marginBottom: '2rem', lineHeight: 1.7 }}>
                ทางโรงเรียนยินดีต้อนรับผู้ปกครองและผู้สนใจ สามารถเข้าเยี่ยมชมหรือสอบถามข้อมูลได้ทุกวันราชการ
              </p>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <Link to="/page/contact" style={{ background: 'white', color: '#FF6A01', padding: '1rem 2.25rem', borderRadius: 14, fontWeight: 800, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8, boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }}>
                  แผนที่ & ติดต่อ <ArrowRight size={18} />
                </Link>
                <Link to="/page/pr-news" style={{ background: 'rgba(255,255,255,0.15)', color: 'white', padding: '1rem 2.25rem', borderRadius: 14, fontWeight: 700, textDecoration: 'none', border: '2px solid rgba(255,255,255,0.5)' }}>
                  ข่าวประชาสัมพันธ์
                </Link>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <ContactItem icon={<MapPin size={20} />} label="ที่ตั้ง" value="ต.โป่งน้ำร้อน อ.คลองลาน จ.กำแพงเพชร" />
              <ContactItem icon={<Phone size={20} />} label="โทรศัพท์" value={schoolInfo?.phone || '055-000-000'} />
              <ContactItem icon={<Mail size={20} />} label="อีเมล" value={schoolInfo?.email || 'school@kmd.ac.th'} />
            </div>
          </div>
        </div>
      </section>

      <NewsModal post={activePost} onClose={() => setActivePost(null)} />
      <Footer />

      <style>{`
        .btn-premium:hover { transform: translateY(-3px); filter: brightness(1.05); box-shadow: 0 20px 40px rgba(255,106,1,0.6); }
        .stat-card:hover { transform: translateY(-6px); box-shadow: 0 20px 40px rgba(255,106,1,0.12); transition: all .3s; }
        .pillar-card:hover { transform: translateY(-6px); box-shadow: 0 20px 40px rgba(0,0,0,0.08); }
        .quick-card:hover { background: #FFF7ED; transform: translateY(-3px); }
        .news-card:hover { transform: translateY(-8px); box-shadow: 0 20px 40px rgba(0,0,0,0.1); }
        .album-card:hover img { transform: scale(1.08); }
        .album-card img { transition: transform .6s ease; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.8s ease-out; }
      `}</style>
    </div>
  );
}

function Tag({ color, icon, label }: { color: string; icon: any; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: `${color}15`, color, borderRadius: 50, fontSize: '0.7rem', fontWeight: 800 }}>
      {icon}{label}
    </span>
  );
}

function ContactItem({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '1rem 1.25rem', background: 'rgba(255,255,255,0.15)', borderRadius: 16, backdropFilter: 'blur(10px)' }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '0.75rem', opacity: 0.85, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
        <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{value}</div>
      </div>
    </div>
  );
}

export default Home;
