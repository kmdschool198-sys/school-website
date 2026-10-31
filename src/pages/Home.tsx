import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ArrowRight, Video, Globe, FileText, Image as ImageIcon,
  ClipboardList, CalendarDays, FolderOpen, School,
  ChevronRight, Phone, Mail, MapPin, Images, Newspaper
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import Header from '../components/Header';
import Footer from '../components/Footer';

import DriveImage from '../components/DriveImage';
import NewsModal, { type NewsItem } from '../components/NewsModal';
import FacebookPostCard from '../components/FacebookPostCard';
import CountUp from '../components/CountUp';
import { SCHOOL_NAME, SCHOOL_AFFILIATION, SCHOOL_EMAIL, SCHOOL_PHONE } from '../config/siteLinks';
import { DEFAULT_ACTIVITIES, COLOR_ACTIVITY, COLOR_BUDDHIST } from '../data/defaultActivities';
import { todayIso } from '../utils/dates';

// Orange that keeps text readable: white on it and it on white are both above 4.5:1.
// The bright brand orange (#FF6A01) stays for decoration only.
const ACCENT = '#C2410C';
const MUTED = '#64748B';
const THAI_HEADING_LH = 1.35;

const THAI_MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

/** "2026-10-31" -> "31 ต.ค. 2569"; anything unparseable is shown as it was entered */
function thaiDateShort(value: string): string {
  const d = new Date(value);
  if (!value || Number.isNaN(d.getTime())) return value;
  return `${d.getDate()} ${THAI_MONTHS_SHORT[d.getMonth()]} ${d.getFullYear() + 543}`;
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Auto-advancing slide index that stops while the visitor hovers or focuses the slides */
function useCarousel(length: number, intervalMs: number) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (length <= 1 || paused || prefersReducedMotion()) return;
    const timer = setInterval(() => setIndex(i => (i + 1) % length), intervalMs);
    return () => clearInterval(timer);
  }, [length, paused, intervalMs]);

  const pause = useCallback(() => setPaused(true), []);
  const resume = useCallback(() => setPaused(false), []);
  const pauseHandlers = { onMouseEnter: pause, onMouseLeave: resume, onFocus: pause, onBlur: resume };

  return { index: length ? index % length : 0, setIndex, pauseHandlers };
}

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
  facebookUrl?: string;
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
  buttonLink?: string;
  endDate?: string;
  imageUrl: string;
  order: number;
}

function Home() {
  const [posts, setPosts] = useState<HomePost[]>([]);
  const [heroSlides, setHeroSlides] = useState<string[]>([]);
  const [schoolInfo, setSchoolInfo] = useState<any>(null);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [activePost, setActivePost] = useState<NewsItem | null>(null);
  const [allPosts, setAllPosts] = useState<HomePost[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [personnelCount, setPersonnelCount] = useState<number | null>(null);
  const [studentCount, setStudentCount] = useState<number | null>(null);
  const [classCount, setClassCount] = useState<number | null>(null);
  const [postsLoaded, setPostsLoaded] = useState(false);

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
      setAllPosts(fetchedPosts);
      setPostsLoaded(true);
    }, () => setPostsLoaded(true));

    // จำนวนนักเรียนและห้องเรียน นับจากรายชื่อจริงที่ครูใช้เช็คชื่อ
    // (ฐานเดียวกับทุกระบบ ไม่ต้องมากรอกซ้ำให้ตัวเลขขัดกันเอง)
    const unsubRoster = onSnapshot(doc(db, 'config', 'attendance_classes'), snap => {
      const classes = (snap.data()?.classes || []) as Array<{ students?: unknown[] }>;
      const withStudents = classes.filter(c => (c.students?.length || 0) > 0);
      const total = withStudents.reduce((sum, c) => sum + (c.students?.length || 0), 0);
      setStudentCount(total > 0 ? total : null);
      setClassCount(withStudents.length > 0 ? withStudents.length : null);
    }, error => {
      console.error('Unable to load roster count', error);
    });

    const unsubAct = onSnapshot(collection(db, 'activities'), snap => {
      const arr: any[] = [];
      snap.forEach(d => arr.push({ id: d.id, ...(d.data() as any) }));
      const ids = new Set(arr.map(a => a.id));
      const merged = [...DEFAULT_ACTIVITIES.filter(a => !ids.has(a.id)), ...arr];
      merged.forEach(a => { if (!a.color && !a.isHoliday) a.color = COLOR_ACTIVITY; });
      setActivities(merged);
    });

    const unsubPersonnel = onSnapshot(collection(db, 'personnel'), snap => {
      setPersonnelCount(snap.size);
    }, error => {
      console.error('Unable to load personnel count', error);
      setPersonnelCount(null);
    });

    return () => { unsubscribe(); unsubH(); unsubAct(); unsubPersonnel(); unsubRoster(); };
  }, []);

  // Deep link: /?post=<id> opens that news item directly (for shared links)
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('post');
    if (!id || activePost || allPosts.length === 0) return;
    const found = allPosts.find(p => String((p as any).id) === id);
    if (found) setActivePost(found as unknown as NewsItem);
  }, [allPosts, activePost]);

  // Keep the URL in sync so users can copy/share the address bar too
  const openPost = (p: any) => {
    setActivePost(p as NewsItem);
    const url = new URL(window.location.href);
    url.searchParams.set('post', String(p.id));
    window.history.replaceState({}, '', url);
  };
  const closePost = () => {
    setActivePost(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('post');
    window.history.replaceState({}, '', url);
  };

  const todayStr = todayIso();

  // วันพระมีทุกสัปดาห์ ถ้าใส่ไว้ด้วยจะดันกิจกรรมจริงของโรงเรียนตกจากรายการ
  const upcoming = useMemo(() =>
    activities
      .filter(a => a.date >= todayStr && a.color !== COLOR_BUDDHIST)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 5),
    [activities, todayStr]
  );

  // ไฮไลต์ที่หมดอายุแล้ว (เช่น ข่าวต้อนรับเปิดภาคเรียน) ไม่ควรค้างอยู่บนหน้าแรก
  const liveHighlights = useMemo(
    () => highlights.filter(h => !h.endDate || h.endDate >= todayStr),
    [highlights, todayStr]
  );

  const hero = useCarousel(heroSlides.length, 6000);
  const highlight = useCarousel(liveHighlights.length, 10000);

  // Album previews from posts with albumUrl
  const albumPosts = useMemo(() => posts.filter(p => p.albumUrl && p.albumUrl.trim() !== '').slice(0, 3), [posts]);

  const phone = schoolInfo?.phone || SCHOOL_PHONE;
  const email = schoolInfo?.email || SCHOOL_EMAIL;

  return (
    <div className="app-container" style={{ backgroundColor: '#ffffff' }}>
      <Header />

      {/* ============== HERO ============== */}
      <section {...hero.pauseHandlers} className="home-hero" style={{ height: '72vh', minHeight: 540, width: '100%', position: 'relative', overflow: 'hidden', background: '#0F172A' }}>
        {heroSlides.length > 0 ? (
          <DriveImage src={heroSlides[hero.index]} alt={`ภาพกิจกรรม${SCHOOL_NAME}`}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #FF6A01 0%, #FB923C 100%)' }} />
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(15,23,42,0.55) 0%, rgba(15,23,42,0.45) 50%, rgba(15,23,42,0.88) 100%)' }} />

        <div className="container" style={{ position: 'relative', zIndex: 10, height: '100%', display: 'flex', alignItems: 'center' }}>
          <div style={{ maxWidth: '820px' }}>
            <h1 style={{ fontSize: 'clamp(2.6rem, 6.5vw, 5rem)', fontWeight: 900, color: '#fff', lineHeight: 1.1, marginBottom: '1.2rem', textShadow: '0 4px 16px rgba(0,0,0,0.35)', letterSpacing: '-1px' }}>
              Learn. Grow.<br />
              <span style={{ color: '#FFD400' }}>Inspire.</span>
            </h1>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'rgba(255,255,255,0.95)', marginBottom: '1rem', lineHeight: THAI_HEADING_LH }}>
              {SCHOOL_NAME} <span style={{ opacity: 0.75, fontWeight: 600 }}>· Ban Klong Mod Daeng School</span>
            </div>

            <p style={{ fontSize: '1.05rem', color: 'rgba(255,255,255,0.9)', marginBottom: '2.25rem', maxWidth: '600px', lineHeight: 1.7 }}>
              {SCHOOL_AFFILIATION} — "สะอาด มีวินัย มุ่งมั่นเรียนรู้ เชิดชูคุณธรรม"
            </p>

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <Link to="/page/history" className="btn-premium" style={{ background: ACCENT, color: 'white', padding: '1rem 2.25rem', borderRadius: '14px', fontSize: '1.05rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 12px 28px rgba(194,65,12,0.45)', textDecoration: 'none' }}>
                รู้จักโรงเรียนของเรา <ArrowRight size={20} />
              </Link>
              <Link to="/calendar" style={{ background: 'rgba(15,23,42,0.35)', color: 'white', padding: '1rem 2.25rem', border: '2px solid rgba(255,255,255,0.7)', borderRadius: '14px', fontSize: '1.05rem', fontWeight: 700, textDecoration: 'none' }}>
                ปฏิทินกิจกรรม
              </Link>
              <Link to="/teacher-hub" style={{ background: 'rgba(255,255,255,0.94)', color: '#7C2D12', padding: '1rem 2rem', borderRadius: '14px', fontSize: '1.05rem', fontWeight: 800, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <School size={20} /> ระบบครู
              </Link>
            </div>

            {heroSlides.length > 1 && (
              <div style={{ display: 'flex', gap: 4, marginTop: '2.5rem' }}>
                {heroSlides.map((_, i) => (
                  <button key={i} type="button" className="slide-dot" onClick={() => hero.setIndex(i)}
                    aria-label={`ภาพที่ ${i + 1} จาก ${heroSlides.length}`} aria-current={i === hero.index}>
                    <span style={{ width: i === hero.index ? 36 : 12, background: i === hero.index ? '#FFD400' : 'rgba(255,255,255,0.6)' }} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ============== QUICK ACCESS STRIP ============== */}
      <section style={{ marginTop: '-56px', position: 'relative', zIndex: 20, paddingBottom: '3rem' }}>
        <div className="container">
          <div className="quick-grid" style={{ background: 'white', borderRadius: '28px', padding: '1.25rem', boxShadow: '0 24px 60px rgba(15,23,42,0.12)', border: '1px solid #FFEDD5', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.5rem' }}>
            {[
              { to: '/page/pr-news', icon: <ClipboardList size={24} />, label: 'ข่าวประชาสัมพันธ์', sub: 'อัปเดตล่าสุด', color: ACCENT },
              { to: '/calendar', icon: <CalendarDays size={24} />, label: 'ปฏิทินกิจกรรม', sub: 'วันสำคัญ/วันพระ', color: '#047857' },
              { to: '/page/gallery', icon: <Images size={24} />, label: 'ภาพกิจกรรม', sub: 'อัลบั้มทั้งหมด', color: '#BE185D' },
              { to: '/page/e-newsletter', icon: <FolderOpen size={24} />, label: 'จดหมายข่าว', sub: 'E-Newsletter', color: '#7E22CE' },
            ].map((q, i) => (
              <Link key={i} to={q.to} className="quick-card" style={{ textDecoration: 'none', color: 'inherit', padding: '1.1rem 1rem', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '14px', transition: 'all .3s' }}>
                <div style={{ width: 52, height: 52, borderRadius: '14px', background: `${q.color}14`, color: q.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {q.icon}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800, color: '#0F172A', fontSize: '0.95rem' }}>{q.label}</div>
                  <div style={{ fontSize: '0.78rem', color: MUTED }}>{q.sub}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ============== NEWS + THIS WEEK ============== */}
      <section style={{ padding: '2rem 0 5rem', background: 'white' }}>
        <div className="container">
          <div className="row g-5">
            {/* News */}
            <div className="col-lg-8">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.75rem', flexWrap: 'wrap', gap: 16 }}>
                <h2 style={{ fontSize: 'clamp(1.7rem, 3.5vw, 2.3rem)', fontWeight: 900, margin: 0, color: '#0F172A', lineHeight: THAI_HEADING_LH }}>ข่าวล่าสุดจากโรงเรียน</h2>
                <Link to="/page/pr-news" style={{ color: ACCENT, fontWeight: 800, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  ข่าวทั้งหมด <ArrowRight size={16} />
                </Link>
              </div>

              <div className="row g-4">
                {/* ระหว่างรอข้อมูล แสดงโครงการ์ดจาง ๆ แทนหน้าว่าง */}
                {!postsLoaded && [0, 1].map(i => (
                  <div key={`sk-${i}`} className="col-md-6">
                    <div style={{ background: 'white', borderRadius: 24, overflow: 'hidden', border: '1px solid #F1F5F9' }}>
                      <div className="skeleton" style={{ height: 200 }} />
                      <div style={{ padding: '1.5rem' }}>
                        <div className="skeleton" style={{ height: 18, borderRadius: 6, marginBottom: 12 }} />
                        <div className="skeleton" style={{ height: 18, width: '70%', borderRadius: 6, marginBottom: 20 }} />
                        <div className="skeleton" style={{ height: 12, width: '40%', borderRadius: 6 }} />
                      </div>
                    </div>
                  </div>
                ))}
                {postsLoaded && posts.length === 0 && (
                  <div className="col-12" style={{ textAlign: 'center', padding: '3rem 1rem', color: MUTED, background: '#F8FAFC', borderRadius: 24 }}>
                    <Newspaper size={36} style={{ marginBottom: 12 }} />
                    <div style={{ fontWeight: 800, color: '#334155', marginBottom: 4 }}>ยังไม่มีข่าวสาร</div>
                    <div style={{ fontSize: '0.88rem' }}>ข่าวใหม่จะแสดงที่นี่ทันทีเมื่อโรงเรียนเผยแพร่</div>
                  </div>
                )}
                {posts.slice(0, 4).map((post) => (
                  <div key={post.id} className="col-md-6">
                    <div role="button" tabIndex={0} aria-label={`อ่านข่าว ${post.title}`}
                      onClick={() => openPost(post)}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPost(post); } }}
                      className="news-card" style={{ cursor: 'pointer', background: 'white', borderRadius: '24px', overflow: 'hidden', height: '100%', border: '1px solid #E2E8F0', boxShadow: '0 4px 16px rgba(15,23,42,0.04)', transition: 'all 0.3s ease' }}>
                      <div style={{ height: 200, background: '#F8FAFC', position: 'relative' }}>
                        {!post.imageUrl?.trim() && post.facebookUrl?.trim() ? (
                          <FacebookPostCard url={post.facebookUrl} preview />
                        ) : (
                          <DriveImage src={post.imageUrl} alt={post.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        )}
                        <div style={{ position: 'absolute', top: 12, left: 12, background: ACCENT, color: 'white', padding: '5px 12px', borderRadius: 50, fontSize: '0.75rem', fontWeight: 800 }}>
                          {post.category}
                        </div>
                      </div>
                      <div style={{ padding: '1.4rem 1.5rem' }}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '0.85rem', lineHeight: 1.5, color: '#0F172A' }}>{post.title}</h3>

                        <div style={{ display: 'flex', gap: '6px', marginBottom: '0.85rem', flexWrap: 'wrap' }}>
                          {post.albumUrl?.trim() && <Tag color="#BE185D" icon={<ImageIcon size={11} />} label="อัลบั้ม" />}
                          {post.tiktokUrl?.trim() && <Tag color="#000" icon={<Video size={11} />} label="TikTok" />}
                          {post.facebookUrl?.trim() && <Tag color="#1D4ED8" icon={<Globe size={11} />} label="Facebook" />}
                          {post.websiteUrl?.trim() && <Tag color="#1D4ED8" icon={<Globe size={11} />} label="เว็บ" />}
                          {post.documentUrl?.trim() && <Tag color="#047857" icon={<FileText size={11} />} label="เอกสาร" />}
                          {post.imageType === 'pdf' && <Tag color="#B91C1C" icon={<FileText size={11} />} label="PDF" />}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.85rem', borderTop: '1px solid #F1F5F9' }}>
                          <time dateTime={post.date} style={{ fontSize: '0.85rem', color: MUTED, fontWeight: 600 }}>{thaiDateShort(post.date)}</time>
                          <span style={{ color: ACCENT, fontWeight: 800, fontSize: '0.88rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            {post.facebookUrl?.trim() ? 'เปิดโพสต์' : 'อ่านต่อ'} <ArrowRight size={14} />
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* This week */}
            <aside className="col-lg-4">
              <h2 style={{ fontSize: 'clamp(1.5rem, 3vw, 1.9rem)', fontWeight: 900, marginBottom: '1.75rem', color: '#0F172A', lineHeight: THAI_HEADING_LH }}>กิจกรรมที่กำลังจะมาถึง</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {upcoming.length === 0 && (
                  <div style={{ padding: '2rem', background: '#F8FAFC', borderRadius: '20px', textAlign: 'center', color: MUTED }}>
                    ยังไม่มีกิจกรรมที่กำลังจะมาถึง
                  </div>
                )}
                {upcoming.map(a => {
                  const d = new Date(a.date);
                  const dotColor = a.isHoliday ? '#DC2626' : (a.color || ACCENT);
                  return (
                    <Link key={a.id} to="/calendar" className="event-row" style={{ display: 'flex', gap: 14, padding: '12px 14px', background: '#F8FAFC', borderRadius: '16px', textDecoration: 'none', color: 'inherit', border: '1px solid #F1F5F9' }}>
                      <div style={{ width: 54, textAlign: 'center', flexShrink: 0, background: 'white', borderRadius: 12, padding: '6px 0', border: '1px solid #E2E8F0' }}>
                        <div style={{ fontSize: '1.4rem', fontWeight: 900, color: ACCENT, lineHeight: 1.1 }}>{d.getDate()}</div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: MUTED }}>{THAI_MONTHS_SHORT[d.getMonth()]}</div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0, alignSelf: 'center' }}>
                        <div style={{ fontWeight: 800, color: '#0F172A', fontSize: '0.95rem', lineHeight: 1.45, display: 'flex', gap: 8, alignItems: 'baseline' }}>
                          <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, flexShrink: 0, transform: 'translateY(-1px)' }} />
                          {a.title}
                        </div>
                        {a.description && <div style={{ fontSize: '0.82rem', color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingLeft: 16 }}>{a.description}</div>}
                      </div>
                      <ChevronRight size={18} color={MUTED} style={{ alignSelf: 'center' }} />
                    </Link>
                  );
                })}
              </div>
              <Link to="/calendar" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: '1.25rem', color: ACCENT, fontWeight: 800, textDecoration: 'none' }}>
                ดูปฏิทินเต็ม <ArrowRight size={18} />
              </Link>
            </aside>
          </div>
        </div>
      </section>

      {/* ============== HIGHLIGHT SLIDER (only when the school has posted one that is still current) ============== */}
      {liveHighlights.length > 0 && (
        <section {...highlight.pauseHandlers} style={{ padding: '5.5rem 0', background: '#0F172A', color: 'white' }}>
          <div className="container">
            {liveHighlights.map((s, i) => (
              <div key={s.id} className="highlight-slide" style={{ display: i === highlight.index ? 'grid' : 'none' }}>
                <div>
                  {s.badge && <div style={{ display: 'inline-block', padding: '0.4rem 1.1rem', background: 'rgba(255,212,0,0.14)', color: '#FFD400', borderRadius: '50px', fontSize: '0.85rem', fontWeight: 800, marginBottom: '1.25rem' }}>{s.badge}</div>}
                  <h2 style={{ fontSize: 'clamp(1.9rem, 4vw, 3rem)', fontWeight: 900, marginBottom: '1.25rem', lineHeight: THAI_HEADING_LH }}>
                    {s.title} <br /><span style={{ color: '#FFD400' }}>{s.titleAccent}</span>
                  </h2>
                  <p style={{ fontSize: '1.05rem', color: 'rgba(255,255,255,0.85)', lineHeight: 1.8, marginBottom: '2rem' }}>{s.description}</p>
                  {s.buttonText && s.buttonLink && (
                    /^https?:\/\//.test(s.buttonLink) ? (
                      <a href={s.buttonLink} target="_blank" rel="noreferrer" className="highlight-btn">{s.buttonText} <ArrowRight size={18} /></a>
                    ) : (
                      <Link to={s.buttonLink} className="highlight-btn">{s.buttonText} <ArrowRight size={18} /></Link>
                    )
                  )}
                </div>
                <div style={{ position: 'relative', borderRadius: '28px', overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.4)', minHeight: 320, background: '#1E293B' }}>
                  <DriveImage src={s.imageUrl} alt={s.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </div>
              </div>
            ))}
            {liveHighlights.length > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', marginTop: '2.5rem' }}>
                {liveHighlights.map((s, i) => (
                  <button key={s.id} type="button" className="slide-dot" onClick={() => highlight.setIndex(i)}
                    aria-label={`ไฮไลต์ที่ ${i + 1}: ${s.title}`} aria-current={i === highlight.index}>
                    <span style={{ width: i === highlight.index ? 40 : 12, background: i === highlight.index ? '#FFD400' : 'rgba(255,255,255,0.45)' }} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ============== SCHOOL AT A GLANCE ============== */}
      <section style={{ padding: '5rem 0', background: '#FFF7ED' }}>
        <div className="container">
          <div className="row g-5 align-items-center">
            <div className="col-lg-7">
              <h2 style={{ fontSize: 'clamp(1.7rem, 3.5vw, 2.3rem)', fontWeight: 900, color: '#0F172A', marginBottom: '1.25rem', lineHeight: THAI_HEADING_LH }}>
                วิสัยทัศน์โรงเรียน
              </h2>
              <p style={{ fontSize: '1.2rem', fontWeight: 700, lineHeight: 1.75, color: '#7C2D12', marginBottom: '1.5rem', maxWidth: '62ch' }}>
                “โรงเรียนคุณภาพมาตรฐาน บูรณาการหลากวัฒนธรรม ก้าวทันเทคโนโลยี ผู้เรียนมีความรู้คู่คุณธรรม น้อมนำหลักปรัชญา สู่การพัฒนาทักษะอาชีพ”
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: '2rem' }}>
                <span style={{ fontSize: '0.95rem', color: '#334155', fontWeight: 700 }}>อัตลักษณ์:</span>
                {['สะอาด', 'มีวินัย', 'มุ่งมั่นเรียนรู้', 'เชิดชูคุณธรรม'].map(t => (
                  <span key={t} style={{ padding: '6px 16px', background: 'white', border: `1.5px solid ${ACCENT}`, color: ACCENT, borderRadius: '50px', fontWeight: 800, fontSize: '0.92rem' }}>{t}</span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                <Link to="/page/vision" style={{ color: ACCENT, fontWeight: 800, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  พันธกิจและกลยุทธ์ <ArrowRight size={16} />
                </Link>
                <Link to="/page/history" style={{ color: ACCENT, fontWeight: 800, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  ประวัติโรงเรียน <ArrowRight size={16} />
                </Link>
              </div>
            </div>
            <div className="col-lg-5">
              <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', margin: 0 }}>
                {[
                  { val: '44', label: 'ปีแห่งการก่อตั้ง', sub: 'ตั้งแต่ พ.ศ. 2525' },
                  { val: studentCount === null ? '—' : String(studentCount), label: 'นักเรียน', sub: 'อนุบาล - ม.3' },
                  { val: personnelCount === null ? '—' : String(personnelCount), label: 'บุคลากร', sub: 'ข้อมูลจากระบบ' },
                  { val: classCount === null ? '—' : String(classCount), label: 'ห้องเรียน', sub: 'ปีการศึกษานี้' },
                ].map(s => (
                  <div key={s.label} style={{ padding: '1.25rem 1.25rem 1.1rem', background: 'white', borderRadius: '20px', border: '1px solid #FFEDD5' }}>
                    <dd style={{ fontSize: '2.2rem', fontWeight: 900, margin: 0, color: ACCENT, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>
                      <CountUp value={s.val} />
                    </dd>
                    <dt style={{ fontSize: '0.98rem', fontWeight: 800, color: '#0F172A', marginTop: 4 }}>{s.label}</dt>
                    <div style={{ color: MUTED, fontSize: '0.82rem' }}>{s.sub}</div>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </section>

      {/* ============== GALLERY PREVIEW ============== */}
      {albumPosts.length > 0 && (
        <section style={{ padding: '5rem 0', background: 'white' }}>
          <div className="container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2rem', flexWrap: 'wrap', gap: 16 }}>
              <h2 style={{ fontSize: 'clamp(1.7rem, 3.5vw, 2.3rem)', fontWeight: 900, margin: 0, color: '#0F172A', lineHeight: THAI_HEADING_LH }}>อัลบั้มภาพกิจกรรม</h2>
              <Link to="/page/gallery" style={{ color: ACCENT, fontWeight: 800, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                ดูทั้งหมด <ArrowRight size={16} />
              </Link>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
              {albumPosts.map(p => (
                <a key={p.id} href={p.albumUrl} target="_blank" rel="noreferrer" className="album-card" style={{ position: 'relative', borderRadius: '24px', overflow: 'hidden', height: 260, textDecoration: 'none', display: 'block', boxShadow: '0 10px 30px rgba(0,0,0,0.08)' }}>
                  <DriveImage src={p.imageUrl} alt={p.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 35%, rgba(0,0,0,0.85) 100%)' }} />
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '1.25rem 1.5rem', color: 'white' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 700, marginBottom: 6, opacity: 0.95 }}>
                      <Images size={14} /> Google Photos
                    </div>
                    <h3 style={{ margin: 0, fontWeight: 800, fontSize: '1.1rem', lineHeight: 1.45 }}>{p.title}</h3>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ============== CONTACT ============== */}
      <section style={{ padding: '5rem 0', background: 'linear-gradient(135deg, #C2410C, #9A3412)', color: 'white' }}>
        <div className="container">
          <div className="contact-grid">
            <div>
              <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', fontWeight: 900, marginBottom: '1.25rem', lineHeight: THAI_HEADING_LH }}>
                ติดต่อสอบถาม<br />หรือเยี่ยมชมโรงเรียน
              </h2>
              <p style={{ fontSize: '1.05rem', marginBottom: '2rem', lineHeight: 1.7, maxWidth: '56ch' }}>
                ทางโรงเรียนยินดีต้อนรับผู้ปกครองและผู้สนใจ สามารถเข้าเยี่ยมชมหรือสอบถามข้อมูลได้ทุกวันราชการ
              </p>
              <Link to="/page/contact" style={{ background: 'white', color: '#9A3412', padding: '0.95rem 2rem', borderRadius: 14, fontWeight: 800, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                แผนที่และการเดินทาง <ArrowRight size={18} />
              </Link>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <ContactItem icon={<MapPin size={20} />} label="ที่ตั้ง" value="ต.โป่งน้ำร้อน อ.คลองลาน จ.กำแพงเพชร" />
              <ContactItem icon={<Phone size={20} />} label="โทรศัพท์ (กดเพื่อโทร)" value={phone} href={`tel:${phone.replace(/[^\d+]/g, '')}`} />
              <ContactItem icon={<Mail size={20} />} label="อีเมล" value={email} href={`mailto:${email}`} />
            </div>
          </div>
        </div>
      </section>

      <NewsModal post={activePost} onClose={closePost} />
      <Footer />

      <style>{`
        .btn-premium:hover { transform: translateY(-2px); filter: brightness(1.08); }
        .quick-card:hover, .quick-card:focus-visible { background: #FFF7ED; }
        .news-card:hover { transform: translateY(-4px); box-shadow: 0 16px 32px rgba(15,23,42,0.1); }
        .news-card:focus-visible, .event-row:focus-visible, .slide-dot:focus-visible, .highlight-btn:focus-visible, .contact-link:focus-visible { outline: 3px solid #FFD400; outline-offset: 3px; }
        .event-row { transition: background .2s; }
        .event-row:hover { background: #FFF7ED !important; }
        .album-card img { transition: transform .6s ease; }
        .album-card:hover img { transform: scale(1.05); }
        .slide-dot { background: none; border: 0; padding: 9px 4px; cursor: pointer; display: inline-flex; align-items: center; min-height: 24px; }
        .slide-dot span { display: block; height: 6px; border-radius: 50px; transition: width .3s, background .3s; }
        .highlight-slide { grid-template-columns: 1fr 1fr; gap: 3.5rem; align-items: center; }
        .highlight-btn { background: #FFD400; color: #0F172A; padding: 0.95rem 2.25rem; border-radius: 12px; font-weight: 800; display: inline-flex; align-items: center; gap: 8px; text-decoration: none; }
        .contact-grid { display: grid; grid-template-columns: 1.4fr 1fr; gap: 3rem; align-items: center; }
        .contact-link { color: inherit; text-decoration: underline; text-underline-offset: 3px; }
        @media (max-width: 600px) {
          .home-hero { height: auto !important; min-height: 0 !important; padding: 104px 0 84px; }
          .home-hero .container { height: auto !important; }
          section .container > div.quick-grid[style] { grid-template-columns: 1fr 1fr !important; padding: 0.75rem !important; }
          .quick-card { flex-direction: column; text-align: center; gap: 8px !important; padding: 0.9rem 0.5rem !important; }
        }
        @media (max-width: 900px) {
          .highlight-slide, .contact-grid { grid-template-columns: 1fr; gap: 2rem; }
        }
        @media (prefers-reduced-motion: reduce) {
          .news-card, .album-card img, .slide-dot span, .btn-premium { transition: none !important; transform: none !important; }
        }
      `}</style>
    </div>
  );
}

function Tag({ color, icon, label }: { color: string; icon: any; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: `${color}12`, color, borderRadius: 50, fontSize: '0.75rem', fontWeight: 800 }}>
      {icon}{label}
    </span>
  );
}

function ContactItem({ icon, label, value, href }: { icon: any; label: string; value: string; href?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '0.9rem 1.15rem', background: 'rgba(0,0,0,0.16)', borderRadius: 16 }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '0.82rem', fontWeight: 700 }}>{label}</div>
        <div style={{ fontWeight: 800, fontSize: '1rem', overflowWrap: 'anywhere' }}>
          {href ? <a href={href} className="contact-link">{value}</a> : value}
        </div>
      </div>
    </div>
  );
}

export default Home;
