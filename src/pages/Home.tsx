import { useState, useEffect } from 'react';
import { ArrowRight, Video, Globe, FileText, Image as ImageIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import '../App.css';
import Header from '../components/Header';
import Footer from '../components/Footer';

import { getDirectImageUrl, DEFAULT_PLACEHOLDER } from '../utils/imageUtils';
import NewsModal, { type NewsItem } from '../components/NewsModal';

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

  useEffect(() => {
    // Fetch Home Assets for Dynamic Imagery
    getDoc(doc(db, 'config', 'home_assets')).then(snap => {
      if (snap.exists()) setSchoolInfo((prev: any) => ({ ...prev, ...snap.data() }));
    });

    // Fetch School Info for Global Branding
    getDoc(doc(db, 'config', 'school_info')).then(snap => {
      if (snap.exists()) setSchoolInfo((prev: any) => ({ ...prev, ...snap.data() }));
    });

    // Fetch Highlights from Firestore (admin-managed)
    const hq = query(collection(db, 'highlights'), orderBy('order', 'asc'));
    const unsubH = onSnapshot(hq, snap => {
      const items: Highlight[] = [];
      snap.forEach(d => items.push({ id: d.id, ...(d.data() as any) }));
      setHighlights(items);
    });

    const q = query(collection(db, 'posts'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allItems: any[] = [];
      snapshot.forEach(doc => allItems.push({ id: doc.id, ...doc.data() }));
      
      allItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      const fetchedPosts: HomePost[] = [];
      const fetchedSlides: string[] = []; 

      allItems.forEach((data) => {
        if (data.category === 'แบนเนอร์สไลด์หน้าแรก' && data.imageUrl) {
          fetchedSlides.push(data.imageUrl);
        } else if (data.category !== 'แบนเนอร์สไลด์หน้าแรก') {
          fetchedPosts.push({
            id: data.id,
            title: data.title,
            content: data.content,
            date: data.date,
            category: data.category || 'ข่าวทั่วไป',
            link: data.link,
            imageUrl: data.imageUrl,
            imageType: data.imageType || 'image',
            albumUrl: data.albumUrl,
            tiktokUrl: data.tiktokUrl,
            websiteUrl: data.websiteUrl,
            documentUrl: data.documentUrl
          });
        }
      });

      setHeroSlides(fetchedSlides);
      setPosts(fetchedPosts.slice(0, 6));
    });

    return () => { unsubscribe(); unsubH(); };
  }, []);

  // Hero Slider Auto-play
  useEffect(() => {
    if (heroSlides.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentHeroSlide(prev => (prev + 1) % heroSlides.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [heroSlides.length]);

  // Highlight Slider Auto-play
  useEffect(() => {
    if (highlights.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentHighlightSlide(prev => (prev + 1) % highlights.length);
    }, 10000);
    return () => clearInterval(interval);
  }, [highlights.length]);

  const aboutImg = getDirectImageUrl(schoolInfo?.homeAboutImg) || "/school_history.png";
  const hlImg1 = getDirectImageUrl(schoolInfo?.homeHighlight1Img) || "https://images.unsplash.com/photo-1509062522246-3755977927d7?q=80&w=1200";
  const hlImg2 = getDirectImageUrl(schoolInfo?.homeHighlight2Img) || "https://images.unsplash.com/photo-1544027993-37dbfe43562a?q=80&w=1200";

  return (
    <div className="app-container" style={{ backgroundColor: '#ffffff' }}>
      <Header />

      {/* Hero Banner Section */}
      <section style={{ height: '85vh', width: '100%', position: 'relative', overflow: 'hidden', background: '#FAFAFA' }}>
        {heroSlides.length > 0 ? (
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundImage: `url(${getDirectImageUrl(heroSlides[currentHeroSlide])})`, backgroundSize: 'cover', backgroundPosition: 'center', transition: 'all 1s ease' }} />
        ) : (
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'linear-gradient(135deg, #FF6A01 0%, #FB923C 100%)' }} />
        )}
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(1px)' }} />
        
        <div className="container" style={{ position: 'relative', zIndex: 10, height: '100%', display: 'flex', alignItems: 'center' }}>
          <div style={{ maxWidth: '800px' }}>
            <div className="animate-fade-in" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '0.5rem 1.2rem', background: '#FF6A01', borderRadius: '50px', marginBottom: '2rem', boxShadow: '0 0 20px rgba(255, 106, 1, 0.4)' }}>
               <h5 style={{ color: 'white', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 800, fontSize: '0.75rem', margin: 0 }}>Excellence In Education</h5>
            </div>
            
            <h1 style={{ fontSize: 'clamp(2.5rem, 8vw, 5rem)', fontWeight: 900, color: '#ffffff', lineHeight: 1.1, marginBottom: '2rem', textShadow: '0 10px 30px rgba(0,0,0,0.3)' }}>
              Klong Mod Dang <br />
              <span style={{ color: '#FFD400' }}>Modern Learning.</span>
            </h1>
            
            <p style={{ fontSize: '1.25rem', color: 'rgba(255,255,255,0.95)', marginBottom: '3rem', maxWidth: '600px', lineHeight: 1.7 }}>
              สร้างสรรค์นวัตกรรมการเรียนรู้ เพื่อปูทางสู่ความสำเร็จในศตวรรษที่ 21 มุ่งเน้นคุณธรรม นำความรู้วิชาการ
            </p>
            
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
               <button className="btn-premium smooth-bounce" style={{ background: '#FF6A01', color: 'white', padding: '1.2rem 3rem', border: 'none', borderRadius: '16px', fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 15px 35px rgba(255, 106, 1, 0.5)' }}>
                สมัครเรียนออนไลน์ <ArrowRight size={22} />
               </button>
               <button className="btn-outline" style={{ background: 'rgba(255,255,255,0.1)', color: 'white', padding: '1.2rem 3rem', border: '2px solid white', borderRadius: '16px', fontSize: '1.1rem', fontWeight: 700, backdropFilter: 'blur(10px)' }}>
                หลักสูตรที่เปิดสอน
               </button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section with Pulse Glow */}
      <section style={{ padding: '6rem 0', background: 'white' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '2.5rem' }}>
            {[
              { val: '44+', label: 'Years of History', sub: 'Established 2525' },
              { val: '120', label: 'Professional Staff', sub: 'Dedicated Educators' },
              { val: '3,000+', label: 'Successful Students', sub: 'Total Graduates' }
            ].map((stat, i) => (
               <div key={i} className="stat-card pulse-glow" style={{ padding: '3rem 2rem', textAlign: 'center', background: '#FFF7ED', borderRadius: '32px', border: '1px solid #FFEDD5', transition: 'all 0.4s ease' }}>
                <h3 style={{ fontSize: '3.5rem', fontWeight: 900, color: '#FF6A01', margin: '0 0 1rem 0' }}>{stat.val}</h3>
                <h5 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--dark-text)', marginBottom: '0.5rem' }}>{stat.label}</h5>
                <p style={{ color: 'var(--gray-text)', fontSize: '0.85rem', margin: 0 }}>{stat.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Highlight Slider Section (Dynamic from Firestore) */}
      {(() => {
        const fallback: Highlight[] = [
          { id: 'f1', badge: 'Excellence', title: 'การศึกษาระดับมาตรฐาน', titleAccent: 'ก้าวสู่สากล', description: 'เรามุ่งเน้นการสอนที่ผสมผสานเทคโนโลยีสมัยใหม่ เพื่อให้นักเรียนมีความพร้อมสูงสุดสำหรับการเรียนรู้ในยุคศตวรรษที่ 21', buttonText: 'อ่านรายละเอียดข้อมูลสารสนเทศ', imageUrl: hlImg1, order: 1 },
          { id: 'f2', badge: 'Innovation', title: 'ล้ำสมัยด้วย', titleAccent: 'เทคโนโลยีการสอน', description: 'ห้องเรียนอัจฉริยะ พร้อมอุปกรณ์ครบวงจร ให้นักเรียนได้เปิดโลกกว้างแห่งการเรียนรู้ไร้ขีดจำกัดไปกับเรา', buttonText: 'รู้จักเทคโนโลยีของเรา', imageUrl: hlImg2, order: 2 },
        ];
        const slides = highlights.length > 0 ? highlights : fallback;
        const safeIdx = currentHighlightSlide % slides.length;
        return (
          <section style={{ padding: '10rem 0', background: 'linear-gradient(to bottom, #FFFFFF 0%, #FFF7ED 100%)' }}>
            <div className="container">
              {slides.map((s, i) => (
                <div key={s.id} style={{ display: i === safeIdx ? 'grid' : 'none', gridTemplateColumns: '1fr 1fr', gap: '5rem', alignItems: 'center', animation: 'fadeIn 0.8s ease' }}>
                  <div>
                    <div style={{ display: 'inline-block', padding: '0.5rem 1.5rem', background: '#FFF7ED', color: '#FF6A01', borderRadius: '50px', fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '2rem' }}>{s.badge}</div>
                    <h2 style={{ fontSize: '3.5rem', fontWeight: 950, color: 'var(--dark-text)', marginBottom: '2.5rem', lineHeight: 1.1 }}>{s.title} <br /> <span style={{ color: '#FF6A01' }}>{s.titleAccent}</span></h2>
                    <p style={{ fontSize: '1.2rem', color: '#64748b', lineHeight: 1.8, marginBottom: '3rem' }}>{s.description}</p>
                    {s.buttonText && <button style={{ background: '#FF6A01', color: 'white', padding: '1rem 2.5rem', borderRadius: '12px', border: 'none', fontWeight: 700 }}>{s.buttonText}</button>}
                  </div>
                  <div style={{ position: 'relative', borderRadius: '40px', overflow: 'hidden', boxShadow: '0 30px 70px rgba(255, 106, 1, 0.2)', minHeight: '320px', background: '#FFF7ED' }}>
                    <img src={getDirectImageUrl(s.imageUrl)} alt={s.title} style={{ width: '100%', display: 'block' }} onError={e => (e.currentTarget.src = DEFAULT_PLACEHOLDER)} />
                  </div>
                </div>
              ))}
              {slides.length > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '5rem' }}>
                  {slides.map((_, i) => (
                    <div key={i} onClick={() => setCurrentHighlightSlide(i)} style={{ width: i === safeIdx ? '40px' : '12px', height: '12px', borderRadius: '50px', background: i === safeIdx ? '#FF6A01' : '#E2E8F0', cursor: 'pointer', transition: 'all 0.3s ease' }} />
                  ))}
                </div>
              )}
            </div>
          </section>
        );
      })()}

      {/* About Section */}
      <section style={{ padding: '10rem 0', background: 'white' }}>
        <div className="container">
          <div className="row align-items-center">
            <div className="col-lg-6 pr-lg-5">
               <div style={{ position: 'relative' }}>
                  <img src={aboutImg} alt="About" style={{ width: '100%', borderRadius: '40px', boxShadow: '0 30px 60px rgba(0,0,0,0.1)' }} />
                  <div style={{ position: 'absolute', bottom: '-30px', right: '-30px', background: '#FF6A01', padding: '2rem', borderRadius: '30px', color: 'white', textAlign: 'center', boxShadow: '0 20px 40px rgba(255,106,1,0.3)' }}>
                    <h4 style={{ fontSize: '2rem', fontWeight: 900, margin: 0 }}>40+</h4>
                    <p style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', margin: 0 }}>Years Active</p>
                  </div>
               </div>
            </div>
            <div className="col-lg-6 ps-lg-5 mt-5 mt-lg-0">
               <h5 style={{ color: '#FF6A01', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '4px', fontSize: '0.8rem', marginBottom: '1.5rem' }}>Historical Legacy</h5>
               <h2 style={{ fontSize: '3rem', fontWeight: 950, marginBottom: '2.5rem', lineHeight: 1.2 }}>ประวัติความเป็นมา <br /> <span style={{ color: '#FF6A01' }}>โรงเรียนบ้านคลองมดแดง</span></h2>
               <p style={{ fontSize: '1.1rem', color: '#64748b', lineHeight: 1.8, marginBottom: '3rem' }}>
                 ตั้งอยู่ที่ตำบลโป่งน้ำร้อน มุ่งเน้นการจัดการศึกษาที่มีคุณภาพเพื่อพัฒนาศักยภาพผู้เรียนรอบด้าน ทั้งในด้านวิชาการ คุณธรรม และทักษะชีวิต
               </p>
               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                  <div style={{ padding: '1.5rem', borderLeft: '4px solid #FF6A01', background: '#FFF7ED' }}>
                    <h6 style={{ fontWeight: 800, marginBottom: '0.5rem' }}>วิสัยทัศน์</h6>
                    <p style={{ fontSize: '0.85rem', color: '#9a3412', margin: 0 }}>มุ่งเน้นความเป็นเลิศ ก้าวทันเทคโนโลยี มีคุณธรรมเด่น</p>
                  </div>
                  <div style={{ padding: '1.5rem', borderLeft: '4px solid #FFD400', background: '#FFF7ED' }}>
                    <h6 style={{ fontWeight: 800, marginBottom: '0.5rem' }}>อัตลักษณ์</h6>
                    <p style={{ fontSize: '0.85rem', color: '#9a3412', margin: 0 }}>"สะอาด มีวินัย มุ่งมั่นเรียนรู้ เชิดชูคุณธรรม"</p>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* News Grid Section */}
      <section style={{ padding: '10rem 0', backgroundColor: '#F8FAFC' }}>
        <div className="container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '5rem' }}>
            <div>
              <h5 style={{ color: '#FF6A01', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '4px', fontSize: '0.8rem', marginBottom: '1rem' }}>Latest Updates</h5>
              <h2 style={{ fontSize: '3.5rem', fontWeight: 950, margin: 0 }}>ก้าวทัน <span style={{ color: '#FF6A01' }}>ข่าวสาร</span> โรงเรียน</h2>
            </div>
            <Link to="/page/pr-news" style={{ padding: '1rem 2rem', borderRadius: '14px', background: 'white', color: '#FF6A01', border: '1px solid #FF6A01', fontWeight: 700, textDecoration: 'none', transition: 'all 0.3s ease' }}>
              ข่าวทั้งหมด
            </Link>
          </div>

          <div className="row g-4">
            {posts.map((post) => (
              <div key={post.id} className="col-lg-4 col-md-6">
                <div onClick={() => setActivePost(post)} style={{ cursor: 'pointer', background: 'white', borderRadius: '32px', overflow: 'hidden', height: '100%', border: '1px solid #F1F5F9', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', transition: 'all 0.4s ease' }} onMouseOver={e => e.currentTarget.style.transform='translateY(-10px)'} onMouseOut={e => e.currentTarget.style.transform='translateY(0)'}>
                   <div style={{ height: '240px', background: '#F8FAFC' }}>
                      <img src={getDirectImageUrl(post.imageUrl)} alt={post.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => e.currentTarget.src = DEFAULT_PLACEHOLDER} />
                   </div>
                   <div style={{ padding: '2.5rem' }}>
                      <div style={{ color: '#FF6A01', fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '1rem' }}>{post.category}</div>
                      <h4 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '1.2rem', lineHeight: 1.4 }}>{post.title}</h4>
                      
                      {/* Link Indicators */}
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '1.25rem' }}>
                        {post.albumUrl && post.albumUrl.trim() !== '' && (
                          <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'linear-gradient(135deg,#FF6A01,#FB923C)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }} title="Google Photos Album">
                            <ImageIcon size={14} />
                          </div>
                        )}
                        {post.tiktokUrl && post.tiktokUrl.trim() !== '' && (
                          <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }} title="TikTok">
                            <Video size={14} />
                          </div>
                        )}
                        {post.websiteUrl && post.websiteUrl.trim() !== '' && (
                          <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }} title="Website">
                            <Globe size={14} />
                          </div>
                        )}
                        {post.documentUrl && post.documentUrl.trim() !== '' && (
                          <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }} title="Document">
                            <FileText size={14} />
                          </div>
                        )}
                        {post.imageType === 'pdf' && (
                          <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }} title="PDF View">
                            <FileText size={14} />
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.85rem', color: '#94A3B8' }}>{post.date}</span>
                        <ArrowRight size={20} color="#FF6A01" />
                      </div>
                   </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <NewsModal post={activePost} onClose={() => setActivePost(null)} />

      <Footer />

      <style>{`
        .btn-premium:hover {
          transform: translateY(-5px);
          filter: brightness(1.1);
          box-shadow: 0 20px 40px rgba(255, 106, 1, 0.6);
        }
        .stat-card:hover {
          transform: translateY(-10px);
          background: #FFEDD5;
          box-shadow: 0 20px 40px rgba(255, 106, 1, 0.1);
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fadeIn 0.8s ease-out;
        }
      `}</style>
    </div>
  );
}

export default Home;
