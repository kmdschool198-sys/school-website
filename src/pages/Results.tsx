import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { ChevronLeft, Search, Calendar, X as XIcon, FileText, Award, Printer } from 'lucide-react';
import type { ResultAnnouncement, ResultRow } from '../data/results';
import { totalScore, pctColor } from '../data/results';

const BRAND = '#FF6A01';

export default function ResultsPage() {
  const [announcements, setAnnouncements] = useState<ResultAnnouncement[]>([]);
  const [selected, setSelected] = useState<ResultAnnouncement | null>(null);
  const [code, setCode] = useState('');
  const [foundRow, setFoundRow] = useState<ResultRow | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    try {
      const q = query(collection(db, 'results'), where('visible', '==', true), orderBy('publishedAt', 'desc'));
      return onSnapshot(q, snap => {
        const arr: ResultAnnouncement[] = [];
        snap.forEach(d => arr.push({ id: d.id, ...(d.data() as any) }));
        setAnnouncements(arr);
      }, err => console.error('[results]', err));
    } catch (e) { console.error(e); }
  }, []);

  const lookup = () => {
    if (!selected || !code.trim()) return;
    const rec = selected.records.find(r => r.code.trim() === code.trim());
    if (rec) { setFoundRow(rec); setNotFound(false); }
    else { setFoundRow(null); setNotFound(true); }
  };

  const closeModal = () => {
    setSelected(null); setCode(''); setFoundRow(null); setNotFound(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg,#FFF7ED 0%, #FFFFFF 60%)' }}>
      {/* Header */}
      <header className="no-print" style={{
        background: 'linear-gradient(135deg,#FF6A01,#FB923C)', color: 'white',
        padding: '4rem 1.25rem 3rem', boxShadow: '0 4px 20px rgba(255,106,1,0.3)',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <Link to="/" style={{ color: 'white', display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontSize: '0.9rem', opacity: 0.9, marginBottom: 16 }}>
            <ChevronLeft size={16} />หน้าหลัก
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
            <Award size={36} />
            <h1 style={{ margin: 0, fontSize: '2.2rem', fontWeight: 900 }}>📢 ประกาศผลสอบนักเรียน</h1>
          </div>
          <p style={{ opacity: 0.95, fontSize: '1rem', margin: 0 }}>
            เลือกประกาศ → กรอกเลขประจำตัวนักเรียน → ตรวจสอบผลสอบของตัวเอง
          </p>
        </div>
      </header>

      <main className="no-print" style={{ maxWidth: 1100, margin: '-1.5rem auto 3rem', padding: '0 1.25rem' }}>
        {announcements.length === 0 ? (
          <div style={{
            background: 'white', borderRadius: 20, padding: '3rem', textAlign: 'center',
            border: '1px solid #FFEDD5', boxShadow: '0 10px 30px rgba(0,0,0,0.05)',
          }}>
            <FileText size={56} color="#FFD7B0" style={{ marginBottom: 12 }} />
            <h4 style={{ fontWeight: 800, color: '#0F172A' }}>ยังไม่มีประกาศผลสอบ</h4>
            <p style={{ color: '#64748B' }}>ติดตามใหม่อีกครั้งเมื่อโรงเรียนประกาศผล</p>
          </div>
        ) : (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))', gap: 14,
          }}>
            {announcements.map(a => (
              <button key={a.id} onClick={() => setSelected(a)} style={{
                background: 'white', border: '2px solid #FFEDD5', borderRadius: 16,
                padding: '1.25rem', textAlign: 'left', cursor: 'pointer',
                transition: 'transform .2s, box-shadow .2s, border-color .2s',
                boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
              }}
                onMouseOver={e => {
                  e.currentTarget.style.transform = 'translateY(-3px)';
                  e.currentTarget.style.borderColor = BRAND;
                  e.currentTarget.style.boxShadow = '0 12px 24px rgba(255,106,1,0.18)';
                }}
                onMouseOut={e => {
                  e.currentTarget.style.transform = '';
                  e.currentTarget.style.borderColor = '#FFEDD5';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.04)';
                }}>
                <div style={{
                  background: 'linear-gradient(135deg,#FF6A01,#FB923C)', color: 'white',
                  width: 44, height: 44, borderRadius: 12, display: 'inline-flex',
                  alignItems: 'center', justifyContent: 'center', marginBottom: 10,
                }}>
                  <Award size={22} />
                </div>
                <div style={{ fontWeight: 900, color: '#0F172A', fontSize: '1.05rem', marginBottom: 4 }}>
                  {a.title}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#475569', marginBottom: 8 }}>
                  ชั้น <b>{a.className}</b> · {a.records.length} คน · {a.subjects.length} วิชา
                </div>
                <div style={{ fontSize: '0.75rem', color: '#94A3B8', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Calendar size={12} /> ประกาศเมื่อ {new Date(a.publishedAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
                <div style={{
                  marginTop: 10, padding: '8px 12px', background: '#FFF7ED', borderRadius: 8,
                  color: BRAND, fontSize: '0.85rem', fontWeight: 800, textAlign: 'center',
                }}>
                  🔍 คลิกเพื่อตรวจสอบผลสอบ
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

      {/* Lookup modal / Report card */}
      {selected && (
        <div onClick={foundRow ? undefined : closeModal} style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(6px)',
          zIndex: 9990, display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
          padding: '1rem', overflowY: 'auto',
        }} className="modal-bg">
          <div onClick={e => e.stopPropagation()} style={{
            background: 'white', borderRadius: 24, maxWidth: foundRow ? 820 : 720, width: '100%',
            position: 'relative', boxShadow: '0 30px 60px rgba(255,106,1,0.25)',
            margin: 'auto',
          }}>
            <button onClick={closeModal} className="no-print" style={{
              position: 'absolute', top: 14, right: 14, background: '#FFF7ED', border: 'none',
              borderRadius: '50%', width: 38, height: 38, display: 'flex', alignItems: 'center',
              justifyContent: 'center', cursor: 'pointer', zIndex: 1,
            }}>
              <XIcon size={18} color={BRAND} />
            </button>

            {!foundRow ? (
              <>
                {/* Header */}
                <div style={{
                  background: 'linear-gradient(135deg,#FF6A01,#FB923C)', color: 'white',
                  padding: '1.5rem 1.5rem 1.25rem', borderRadius: '24px 24px 0 0',
                }}>
                  <div style={{ fontSize: '0.78rem', opacity: 0.9, fontWeight: 800, letterSpacing: 2 }}>📢 ประกาศผลสอบ</div>
                  <h3 style={{ margin: '4px 0 4px', fontWeight: 900 }}>{selected.title}</h3>
                  <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>ชั้น {selected.className} · {selected.records.length} คน</div>
                </div>

                <div style={{ padding: '1.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 800, color: '#0F172A', marginBottom: 8 }}>
                    🔢 กรอกเลขประจำตัวนักเรียนของคุณ
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input value={code} onChange={e => { setCode(e.target.value); setNotFound(false); }}
                      onKeyDown={e => e.key === 'Enter' && lookup()}
                      placeholder="เช่น 3069" autoFocus
                      style={{
                        flex: 1, padding: '12px 14px', borderRadius: 12, border: '2px solid #E2E8F0',
                        fontSize: '1.1rem', fontWeight: 700, letterSpacing: 1,
                      }} />
                    <button onClick={lookup} style={{
                      background: BRAND, color: 'white', border: 'none', borderRadius: 12,
                      padding: '0 20px', fontWeight: 900, cursor: 'pointer', fontSize: '0.95rem',
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                    }}>
                      <Search size={16} /> ค้นหา
                    </button>
                  </div>
                  {notFound && (
                    <div style={{
                      marginTop: 14, padding: '12px 14px', background: '#FEE2E2', color: '#DC2626',
                      borderRadius: 10, fontSize: '0.9rem', fontWeight: 700,
                    }}>
                      ❌ ไม่พบเลขประจำตัว <b>{code}</b> ในประกาศนี้ — ตรวจสอบหมายเลขอีกครั้ง
                    </div>
                  )}
                  <div style={{
                    marginTop: 16, padding: '10px 14px', background: '#FEF3C7', color: '#92400E',
                    borderRadius: 10, fontSize: '0.8rem',
                  }}>
                    💡 เลขประจำตัวอยู่ในใบรายชื่อนักเรียน หรือถามคุณครู ถ้าจำไม่ได้
                  </div>
                </div>
              </>
            ) : (
              <ReportCard announcement={selected} row={foundRow}
                onBack={() => { setFoundRow(null); setCode(''); }} />
            )}
          </div>
        </div>
      )}

      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 1.2cm; }
          body > *:not(.modal-bg):not(script):not(style) { display: none !important; }
          .modal-bg { position: static !important; background: white !important; backdrop-filter: none !important; padding: 0 !important; }
          .modal-bg > div { box-shadow: none !important; max-width: 100% !important; border-radius: 0 !important; }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// ปพ.6-style Report Card
function ReportCard({ announcement, row, onBack }: {
  announcement: ResultAnnouncement; row: ResultRow; onBack: () => void;
}) {
  const t = totalScore(row.scores, announcement.subjects);
  const print = () => window.print();

  // Group subjects by category
  return (
    <div style={{ padding: '1.5rem' }}>
      {/* Toolbar (no-print) */}
      <div className="no-print" style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center' }}>
        <button onClick={onBack} style={{
          background: 'white', color: '#475569', border: '1px solid #E2E8F0',
          borderRadius: 8, padding: '8px 14px', fontWeight: 700, cursor: 'pointer',
        }}>← ย้อนกลับ</button>
        <button onClick={print} style={{
          marginLeft: 'auto', background: BRAND, color: 'white', border: 'none',
          borderRadius: 8, padding: '8px 14px', fontWeight: 800, cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          <Printer size={14} /> พิมพ์ใบรายงานผล
        </button>
      </div>

      {/* Print area */}
      <div className="report-print" style={{ fontSize: '0.92rem' }}>
        {/* School header */}
        <div style={{ textAlign: 'center', marginBottom: 16, paddingBottom: 14, borderBottom: '2px solid #FF6A01' }}>
          <div style={{ fontSize: '0.85rem', color: '#64748B', fontWeight: 700 }}>
            แบบรายงานผลการพัฒนาคุณภาพผู้เรียน (ปพ.6)
          </div>
          <h2 style={{ fontWeight: 900, color: '#0F172A', margin: '4px 0' }}>โรงเรียนบ้านคลองมดแดง</h2>
          <div style={{ fontSize: '0.85rem', color: '#475569' }}>
            สำนักงานเขตพื้นที่การศึกษาประถมศึกษากำแพงเพชร เขต 2
          </div>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#FF6A01', marginTop: 8 }}>
            {announcement.title}
          </div>
        </div>

        {/* Student info */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, marginBottom: 16,
          padding: '12px 16px', background: '#FFF7ED', borderRadius: 10,
          border: '1px solid #FFEDD5',
        }}>
          <div><b style={{ color: '#7C2D12' }}>ชื่อ-สกุล:</b> {row.name}</div>
          <div><b style={{ color: '#7C2D12' }}>เลขประจำตัว:</b> {row.code}</div>
          <div><b style={{ color: '#7C2D12' }}>ชั้น:</b> {announcement.className}</div>
          <div><b style={{ color: '#7C2D12' }}>วันที่ออกเอกสาร:</b> {new Date(announcement.publishedAt).toLocaleDateString('th-TH')}</div>
        </div>

        {/* Scores table */}
        <table style={{
          width: '100%', borderCollapse: 'collapse', marginBottom: 16,
          fontSize: '0.88rem', border: '1px solid #CBD5E1',
        }}>
          <thead>
            <tr style={{ background: 'linear-gradient(135deg,#0F172A,#1E3A8A)', color: 'white' }}>
              <th style={th}>ที่</th>
              <th style={{ ...th, textAlign: 'left' }}>รายวิชา</th>
              <th style={th}>คะแนนเต็ม</th>
              <th style={th}>คะแนนที่ได้</th>
              <th style={th}>ร้อยละ</th>
              <th style={{ ...th, textAlign: 'left' }}>ครูผู้สอน</th>
            </tr>
          </thead>
          <tbody>
            {announcement.subjects.map((s, i) => {
              const raw = row.scores[s.name];
              const num = typeof raw === 'number' ? raw : Number(raw);
              const hasScore = raw != null && raw !== '' && !isNaN(num);
              const subjPct = hasScore && s.maxScore ? (num / s.maxScore) * 100 : 0;
              return (
                <tr key={s.name} style={{ borderBottom: '1px solid #E2E8F0' }}>
                  <td style={tdCenter}>{i + 1}</td>
                  <td style={td}>{s.name}</td>
                  <td style={tdCenter}>{s.maxScore}</td>
                  <td style={{ ...tdCenter, fontWeight: 900, fontSize: '1.05rem',
                    color: hasScore ? pctColor(subjPct) : '#94A3B8' }}>
                    {hasScore ? num.toFixed(1) : '-'}
                  </td>
                  <td style={{ ...tdCenter, color: hasScore ? pctColor(subjPct) : '#94A3B8', fontWeight: 700 }}>
                    {hasScore ? `${subjPct.toFixed(1)}%` : '-'}
                  </td>
                  <td style={td}>{s.teacher || '-'}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: '#FFF7ED', fontWeight: 900 }}>
              <td colSpan={2} style={{ ...td, textAlign: 'right' }}>คะแนนรวม</td>
              <td style={tdCenter}>{t.max}</td>
              <td style={{ ...tdCenter, color: pctColor(t.pct), fontSize: '1.2rem' }}>{t.sum.toFixed(1)}</td>
              <td style={{ ...tdCenter, color: pctColor(t.pct), fontSize: '1.2rem' }}>{t.pct.toFixed(1)}%</td>
              <td style={td}></td>
            </tr>
          </tfoot>
        </table>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
          <Stat label="🏆 อันดับในชั้น" value={row.rank ? `${row.rank} / ${announcement.records.length}` : '-'} />
          <Stat label="📊 คะแนนรวม" value={`${t.sum.toFixed(1)} / ${t.max}`} />
          <Stat label="💯 ร้อยละ" value={`${t.pct.toFixed(1)}%`} />
        </div>

        {/* Note */}
        {row.note && (
          <div style={{
            padding: '10px 14px', background: '#FEF3C7', borderRadius: 8,
            color: '#92400E', fontSize: '0.85rem', marginBottom: 16,
            borderLeft: '4px solid #F59E0B',
          }}>
            💬 <b>หมายเหตุจากครูประจำชั้น:</b> {row.note}
          </div>
        )}

        {/* Signature block */}
        <div style={{
          marginTop: 30, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40,
          textAlign: 'center', fontSize: '0.85rem',
        }}>
          <div>
            <div style={{ borderTop: '1px dashed #94A3B8', marginTop: 50, paddingTop: 6, color: '#475569' }}>
              ลงชื่อ ........................ ครูประจำชั้น
            </div>
          </div>
          <div>
            <div style={{ borderTop: '1px dashed #94A3B8', marginTop: 50, paddingTop: 6, color: '#475569' }}>
              ลงชื่อ ........................ ผู้อำนวยการสถานศึกษา
            </div>
          </div>
        </div>

        <div style={{
          marginTop: 20, padding: '8px 12px', background: '#F1F5F9', borderRadius: 8,
          fontSize: '0.7rem', color: '#64748B', textAlign: 'center',
        }}>
          เอกสารนี้สร้างโดยระบบอิเล็กทรอนิกส์ เพื่อแจ้งผลการเรียนเบื้องต้นเท่านั้น —
          เอกสารทางการ ปพ.6 ฉบับจริงรับได้ที่โรงเรียน
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      background: 'white', border: '1px solid #E2E8F0', borderRadius: 10,
      padding: 12, textAlign: 'center', borderTop: `4px solid ${BRAND}`,
    }}>
      <div style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0F172A', marginTop: 4 }}>{value}</div>
    </div>
  );
}

const th: React.CSSProperties = { padding: '8px 10px', fontWeight: 800, fontSize: '0.82rem', borderRight: '1px solid rgba(255,255,255,0.2)' };
const td: React.CSSProperties = { padding: '8px 10px', borderRight: '1px solid #E2E8F0' };
const tdCenter: React.CSSProperties = { ...td, textAlign: 'center' };
