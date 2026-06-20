import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X, MapPin, Clock, AlertCircle, Image as ImageIcon, FileText, Link as LinkIcon, Newspaper, Images } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import DriveImage from '../components/DriveImage';
import '../App.css';
import { DEFAULT_ACTIVITIES, COLOR_ACTIVITY } from '../data/defaultActivities';

interface Post {
  id: string;
  title: string;
  date?: string;
  category?: string;
  imageUrl?: string;
  imageType?: string;
  albumUrl?: string;
  tiktokUrl?: string;
  facebookUrl?: string;
  websiteUrl?: string;
  documentUrl?: string;
  content?: string;
}

export interface Activity {
  id: string;
  date: string;          // YYYY-MM-DD
  endDate?: string;      // optional range end
  title: string;
  description?: string;
  location?: string;
  time?: string;
  isHoliday?: boolean;
  color?: string;        // hex
}

const THAI_MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const THAI_DAYS = ['อา','จ','อ','พ','พฤ','ศ','ส'];

const fmt = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export default function CalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-11
  const [activities, setActivities] = useState<Activity[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [attStats, setAttStats] = useState<{ classId: string; label: string; p: number; a: number; l: number; tot: number }[] | null>(null);
  const [attLoading, setAttLoading] = useState(false);

  // Load attendance stats for the selected date
  useEffect(() => {
    if (!selectedDate) { setAttStats(null); return; }
    setAttLoading(true);
    (async () => {
      try {
        // Get class roster (label lookup)
        const rosterSnap = await getDocs(query(collection(db, 'config')));
        let classes: Array<{ classId: string; label: string }> = [];
        rosterSnap.forEach(d => {
          if (d.id === 'attendance_classes') {
            const data = d.data() as any;
            if (Array.isArray(data.classes)) classes = data.classes.map((c: any) => ({ classId: c.classId, label: c.label }));
          }
        });
        const labelMap = new Map(classes.map(c => [c.classId, c.label]));

        const q = query(collection(db, 'attendance'), where('date', '==', selectedDate));
        const snap = await getDocs(q);
        const stats: typeof attStats = [];
        snap.forEach(d => {
          const data = d.data() as any;
          let p = 0, a = 0, l = 0;
          Object.values(data.records || {}).forEach((r: any) => {
            if (r.status === 'present') p++;
            else if (r.status === 'absent') a++;
            else if (r.status === 'leave') l++;
          });
          if (p + a + l > 0) stats!.push({
            classId: data.classId, label: labelMap.get(data.classId) || data.classId,
            p, a, l, tot: p + a + l,
          });
        });
        stats!.sort((x, y) => x.label.localeCompare(y.label, 'th'));
        setAttStats(stats);
      } catch (e) { console.error(e); setAttStats([]); }
      finally { setAttLoading(false); }
    })();
  }, [selectedDate]);

  useEffect(() => {
    const q = query(collection(db, 'activities'), orderBy('date', 'asc'));
    const unsub = onSnapshot(q, snap => {
      const arr: Activity[] = [];
      snap.forEach(d => arr.push({ id: d.id, ...(d.data() as any) }));
      // Merge with defaults: Firestore data overrides defaults with same id
      const fireIds = new Set(arr.map(a => a.id));
      const merged = [...DEFAULT_ACTIVITIES.filter(a => !fireIds.has(a.id)), ...arr];
      // Apply default activity color (blue) if user didn't pick one
      merged.forEach(a => { if (!a.color && !a.isHoliday) a.color = COLOR_ACTIVITY; });
      merged.sort((a, b) => a.date.localeCompare(b.date));
      setActivities(merged);
    });
    const unsubPosts = onSnapshot(collection(db, 'posts'), snap => {
      const arr: Post[] = [];
      snap.forEach(d => arr.push({ id: d.id, ...(d.data() as any) }));
      setPosts(arr);
    });
    return () => { unsub(); unsubPosts(); };
  }, []);

  const postsByDate = useMemo(() => {
    const map: Record<string, Post[]> = {};
    posts.forEach(p => { if (p.date) (map[p.date] = map[p.date] || []).push(p); });
    return map;
  }, [posts]);

  // Group by date
  const byDate = useMemo(() => {
    const map: Record<string, Activity[]> = {};
    activities.forEach(a => {
      const start = new Date(a.date);
      const end = a.endDate ? new Date(a.endDate) : start;
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const k = fmt(d);
        (map[k] = map[k] || []).push(a);
      }
    });
    return map;
  }, [activities]);

  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const goPrev = () => {
    if (month === 0) { setMonth(11); setYear(year - 1); }
    else setMonth(month - 1);
  };
  const goNext = () => {
    if (month === 11) { setMonth(0); setYear(year + 1); }
    else setMonth(month + 1);
  };
  const goToday = () => { setMonth(today.getMonth()); setYear(today.getFullYear()); setSelectedDate(fmt(today)); };

  const todayStr = fmt(today);
  const selectedActs = selectedDate ? (byDate[selectedDate] || []) : [];
  const selectedPosts = selectedDate ? (postsByDate[selectedDate] || []) : [];
  const upcoming = activities
    .filter(a => a.date >= todayStr)
    .slice(0, 6);

  return (
    <div style={{ background: '#FFFFFF', minHeight: '100vh' }}>
      <Header />

      <section style={{ padding: '7rem 0 2rem', background: 'linear-gradient(135deg,#FF6A01,#FB923C)' }}>
        <div className="container text-white">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
            <CalendarIcon size={28} />
            <h1 style={{ margin: 0, fontSize: '2.5rem', fontWeight: 900 }}>ปฏิทินการปฏิบัติงาน</h1>
          </div>
          <p style={{ opacity: 0.9, fontSize: '1.05rem', margin: 0 }}>คลิกวันที่เพื่อดูกิจกรรม / วันหยุด แอดมินเพิ่มกิจกรรมใหม่ได้ผ่านระบบหลังบ้าน</p>
        </div>
      </section>

      <main className="container" style={{ padding: '3rem 0 6rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem', alignItems: 'start' }}>
          {/* Calendar Grid */}
          <div style={{ background: 'white', borderRadius: '24px', padding: '1.75rem', boxShadow: '0 10px 40px rgba(255,106,1,0.08)', border: '1px solid #FFEDD5' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '12px' }}>
              <h3 style={{ margin: 0, fontWeight: 900, color: '#0F172A' }}>{THAI_MONTHS[month]} {year + 543}</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={goPrev} style={navBtn}><ChevronLeft size={18} /></button>
                <button onClick={goToday} style={{ ...navBtn, padding: '0 18px', width: 'auto' }}>วันนี้</button>
                <button onClick={goNext} style={navBtn}><ChevronRight size={18} /></button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '6px' }}>
              {THAI_DAYS.map(d => (
                <div key={d} style={{ textAlign: 'center', padding: '8px 0', fontWeight: 800, color: '#94A3B8', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '1px' }}>{d}</div>
              ))}
              {cells.map((d, i) => {
                if (d === null) return <div key={i} />;
                const dateStr = fmt(new Date(year, month, d));
                const acts = byDate[dateStr] || [];
                const dayPosts = postsByDate[dateStr] || [];
                const hasHoliday = acts.some(a => a.isHoliday);
                const isToday = dateStr === todayStr;
                const isSelected = dateStr === selectedDate;
                return (
                  <button key={i} onClick={() => setSelectedDate(dateStr)} style={{
                    aspectRatio: '1', borderRadius: '12px', position: 'relative',
                    background: isSelected ? 'linear-gradient(135deg,#FF6A01,#FB923C)' :
                      hasHoliday ? '#FEE2E2' :
                      acts.length > 0 ? '#FFF7ED' : '#FAFAFA',
                    color: isSelected ? 'white' : hasHoliday ? '#B91C1C' : '#0F172A',
                    fontWeight: 700, cursor: 'pointer', padding: '6px',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
                    border: isToday && !isSelected ? '2px solid #FF6A01' : '2px solid transparent',
                    transition: 'transform 0.15s ease',
                  }}
                    onMouseOver={e => (e.currentTarget.style.transform = 'scale(1.05)')}
                    onMouseOut={e => (e.currentTarget.style.transform = 'scale(1)')}
                  >
                    <span style={{ fontSize: '0.95rem' }}>{d}</span>
                    {(acts.length > 0 || dayPosts.length > 0) && (() => {
                      const hasActivity = acts.some(a => !a.isHoliday);
                      const hasAlbum = dayPosts.some(p => p.albumUrl || (p.imageUrl && p.imageType !== 'pdf'));
                      const hasPdf = dayPosts.some(p => (p.imageUrl && p.imageType === 'pdf') || p.documentUrl);
                      const hasLink = dayPosts.some(p => p.websiteUrl || p.tiktokUrl);
                      const hasNews = dayPosts.length > 0 && !hasAlbum && !hasPdf && !hasLink;
                      return (
                        <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap', justifyContent: 'center', fontSize: '0.7rem', lineHeight: 1 }}>
                          {hasHoliday && <span title="วันหยุด">🚫</span>}
                          {hasActivity && <span title="กิจกรรม">📌</span>}
                          {hasNews && <span title="ข่าว/ประชาสัมพันธ์">📣</span>}
                          {hasAlbum && <span title="ภาพ/อัลบั้ม">🖼️</span>}
                          {hasPdf && <span title="เอกสาร PDF">📄</span>}
                          {hasLink && <span title="ลิงก์เว็บไซต์">🔗</span>}
                        </div>
                      );
                    })()}
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: '14px', marginTop: '1.5rem', flexWrap: 'wrap', fontSize: '0.8rem', color: '#64748B', alignItems: 'center' }}>
              <span>📌 กิจกรรม</span>
              <span>🚫 วันหยุด</span>
              <span>📣 ข่าว/ประชาสัมพันธ์</span>
              <span>🖼️ ภาพ/อัลบั้ม</span>
              <span>📄 PDF</span>
              <span>🔗 ลิงก์</span>
              <Legend color="#FFFFFF" border="#FF6A01" label="วันนี้" />
            </div>
          </div>

          {/* Side panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ background: 'white', borderRadius: '20px', padding: '1.5rem', border: '1px solid #FFEDD5' }}>
              <h5 style={{ fontWeight: 800, marginBottom: '1rem', color: '#0F172A' }}>กิจกรรมที่จะมาถึง</h5>
              {upcoming.length === 0 && <p style={{ color: '#94A3B8', fontSize: '0.9rem', margin: 0 }}>ยังไม่มีกิจกรรม</p>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {upcoming.map(a => (
                  <div key={a.id} onClick={() => setSelectedDate(a.date)} style={{ cursor: 'pointer', padding: '10px 12px', borderRadius: '12px', background: a.isHoliday ? '#FEE2E2' : '#FFF7ED', borderLeft: `4px solid ${a.isHoliday ? '#EF4444' : (a.color || '#FF6A01')}` }}>
                    <div style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 700 }}>{a.date}</div>
                    <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#0F172A' }}>{a.title}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Day Detail Modal */}
      {selectedDate && (
        <div onClick={() => setSelectedDate(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(6px)', zIndex: 9990, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: '24px', maxWidth: '520px', width: '100%', padding: '2rem', maxHeight: '85vh', overflow: 'auto', position: 'relative', boxShadow: '0 30px 60px rgba(255,106,1,0.25)' }}>
            <button onClick={() => setSelectedDate(null)} style={{ position: 'absolute', top: 14, right: 14, background: '#FFF7ED', border: 'none', borderRadius: '50%', width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <X size={18} color="#FF6A01" />
            </button>
            <div style={{ color: '#FF6A01', fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '4px' }}>วันที่</div>
            <h3 style={{ fontWeight: 900, color: '#0F172A', marginBottom: '1.5rem' }}>{selectedDate}</h3>

            {/* Attendance stats for this date */}
            <div style={{ marginBottom: '1.25rem', padding: '14px', background: '#FFF7ED', border: '1px solid #FFEDD5', borderRadius: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: '1.1rem' }}>📋</span>
                <div style={{ fontWeight: 800, color: '#7C2D12', fontSize: '0.95rem' }}>สถิติการเช็คชื่อ</div>
              </div>
              {attLoading ? (
                <div style={{ color: '#94A3B8', fontSize: '0.85rem' }}>กำลังโหลด…</div>
              ) : !attStats || attStats.length === 0 ? (
                <div style={{ color: '#94A3B8', fontSize: '0.85rem' }}>ยังไม่มีการเช็คชื่อในวันนี้</div>
              ) : (
                <>
                  {/* Total summary */}
                  {(() => {
                    const tp = attStats.reduce((s, x) => s + x.p, 0);
                    const ta = attStats.reduce((s, x) => s + x.a, 0);
                    const tl = attStats.reduce((s, x) => s + x.l, 0);
                    const tot = tp + ta + tl;
                    const pct = tot ? Math.round((tp / tot) * 100) : 0;
                    return (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 10 }}>
                        <Mini label="มา" value={tp} color="#FF6A01" />
                        <Mini label="ขาด" value={ta} color="#EF4444" />
                        <Mini label="ลา" value={tl} color="#F59E0B" />
                        <Mini label={`${pct}%`} value={tot} color="#0F172A" sub="รวม" />
                      </div>
                    );
                  })()}
                  {/* Per class */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {attStats.map(s => (
                      <div key={s.classId} style={{
                        background: 'white', borderRadius: 10, padding: '8px 12px',
                        display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.82rem',
                      }}>
                        <span style={{ fontWeight: 800, color: '#0F172A', minWidth: 60 }}>{s.label}</span>
                        <div style={{ flex: 1, display: 'flex', height: 16, borderRadius: 8, overflow: 'hidden', background: '#F1F5F9' }}>
                          {s.p > 0 && <div style={{ width: `${(s.p / s.tot) * 100}%`, background: '#FF6A01' }} />}
                          {s.a > 0 && <div style={{ width: `${(s.a / s.tot) * 100}%`, background: '#EF4444' }} />}
                          {s.l > 0 && <div style={{ width: `${(s.l / s.tot) * 100}%`, background: '#F59E0B' }} />}
                        </div>
                        <span style={{ color: '#64748B', fontWeight: 700, minWidth: 60, textAlign: 'right' }}>
                          {s.p}/{s.tot}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {selectedActs.length === 0 && selectedPosts.length === 0 ? (
              <div style={{ padding: '2rem', background: '#FAFAFA', borderRadius: '16px', textAlign: 'center', color: '#94A3B8' }}>
                <CalendarIcon size={32} style={{ opacity: 0.4, marginBottom: '8px' }} />
                <p style={{ margin: 0 }}>ไม่มีกิจกรรมในวันนี้</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {selectedActs.map(a => (
                  <div key={a.id} style={{ padding: '14px 16px', borderRadius: '14px', background: a.isHoliday ? '#FEE2E2' : '#FFF7ED', borderLeft: `5px solid ${a.isHoliday ? '#EF4444' : (a.color || '#FF6A01')}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      {a.isHoliday && <AlertCircle size={14} color="#EF4444" />}
                      <h5 style={{ margin: 0, fontWeight: 800, color: '#0F172A' }}>{a.title}</h5>
                      {a.isHoliday && <span style={{ background: '#EF4444', color: 'white', padding: '2px 10px', borderRadius: '50px', fontSize: '0.7rem', fontWeight: 800 }}>วันหยุด</span>}
                    </div>
                    {a.description && <p style={{ margin: '6px 0', color: '#475569', fontSize: '0.92rem', lineHeight: 1.6 }}>{a.description}</p>}
                    <div style={{ display: 'flex', gap: '14px', marginTop: '6px', flexWrap: 'wrap', fontSize: '0.8rem', color: '#64748B' }}>
                      {a.time && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Clock size={12} /> {a.time}</span>}
                      {a.location && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><MapPin size={12} /> {a.location}</span>}
                    </div>
                  </div>
                ))}

                {selectedPosts.length > 0 && (
                  <div style={{ marginTop: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '12px 0 10px', color: '#0F172A', fontWeight: 800, fontSize: '0.95rem' }}>
                      <Newspaper size={16} color="#FF6A01" /> ข่าว / สื่อในวันนี้
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {selectedPosts.map(p => (
                        <div key={p.id} style={{ display: 'flex', gap: '12px', padding: '10px', borderRadius: '14px', background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                          {p.imageUrl && p.imageType !== 'pdf' && (
                            <div style={{ width: 72, height: 72, borderRadius: '10px', overflow: 'hidden', flexShrink: 0, background: '#FFEDD5' }}>
                              <DriveImage src={p.imageUrl} alt={p.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {p.category && <div style={{ fontSize: '0.7rem', color: '#FF6A01', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>{p.category}</div>}
                            <div style={{ fontWeight: 800, color: '#0F172A', fontSize: '0.92rem', marginBottom: '4px' }}>{p.title}</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                              {p.albumUrl && (
                                <a href={p.albumUrl} target="_blank" rel="noreferrer" style={chipLink}><Images size={12} /> อัลบั้ม</a>
                              )}
                              {p.imageUrl && p.imageType === 'pdf' && (
                                <a href={p.imageUrl} target="_blank" rel="noreferrer" style={chipLink}><FileText size={12} /> PDF</a>
                              )}
                              {p.imageUrl && p.imageType !== 'pdf' && (
                                <a href={p.imageUrl} target="_blank" rel="noreferrer" style={chipLink}><ImageIcon size={12} /> รูปภาพ</a>
                              )}
                              {p.websiteUrl && (
                                <a href={p.websiteUrl} target="_blank" rel="noreferrer" style={chipLink}><LinkIcon size={12} /> เว็บไซต์</a>
                              )}
                              {p.documentUrl && (
                                <a href={p.documentUrl} target="_blank" rel="noreferrer" style={chipLink}><FileText size={12} /> เอกสาร</a>
                              )}
                              {p.tiktokUrl && (
                                <a href={p.tiktokUrl} target="_blank" rel="noreferrer" style={chipLink}><LinkIcon size={12} /> TikTok</a>
                              )}
                              {p.facebookUrl && (
                                <a href={p.facebookUrl} target="_blank" rel="noreferrer" style={chipLink}><LinkIcon size={12} /> Facebook</a>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}

const chipLink: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '4px',
  padding: '4px 10px', borderRadius: '50px', background: 'white',
  border: '1px solid #FFEDD5', color: '#FF6A01', fontSize: '0.72rem',
  fontWeight: 700, textDecoration: 'none',
};

const navBtn: React.CSSProperties = {
  width: 38, height: 38, borderRadius: '12px', border: '1px solid #FFEDD5',
  background: 'white', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', color: '#FF6A01', fontWeight: 700,
};

function Legend({ color, label, border }: { color: string; label: string; border?: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
      <span style={{ width: 14, height: 14, borderRadius: '4px', background: color, border: border ? `2px solid ${border}` : 'none' }} />
      {label}
    </span>
  );
}

function Mini({ label, value, color, sub }: { label: string; value: number; color: string; sub?: string }) {
  return (
    <div style={{ background: 'white', padding: '6px 4px', borderRadius: 8, textAlign: 'center', borderTop: `2px solid ${color}` }}>
      <div style={{ fontSize: '1.05rem', fontWeight: 900, color }}>{value}</div>
      <div style={{ fontSize: '0.65rem', color: '#64748B', fontWeight: 700 }}>{sub || label}</div>
      {sub && <div style={{ fontSize: '0.6rem', color }}>{label}</div>}
    </div>
  );
}
