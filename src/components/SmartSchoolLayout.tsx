import { useState, useEffect, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home, Printer, CheckSquare, School, Users, Coffee, Smile, Wallet,
  BookOpen, BarChart2, FileText, Heart, Calendar, Settings, LogOut,
  Menu, X, Clock, ChevronRight, Globe, FileCheck, Utensils, ClipboardCheck, ShieldAlert, ShieldCheck,
} from 'lucide-react';
import { useTeacherAuth } from '../utils/teacherAuth';

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  highlightColor?: string;
  badge?: string;
}

interface NavGroup {
  title?: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { to: '/teacher-hub', label: 'หน้าหลัก (Dashboard)', icon: <Home size={17} />, highlightColor: '#2563EB' },
      { to: '/print-hub', label: 'ศูนย์รวมการพิมพ์ (One-Stop)', icon: <Printer size={17} />, highlightColor: '#BE123C', badge: 'ครบวงจร' },
      { to: '/attendance', label: 'เช็คชื่อรายวัน', icon: <CheckSquare size={17} />, highlightColor: '#059669' },
    ],
  },
  {
    title: 'งานประจำชั้น & กิจวัตร',
    items: [
      { to: '/lunch', label: 'อาหารกลางวัน (22 บ.)', icon: <Utensils size={17} />, highlightColor: '#EA580C' },
      { to: '/duty', label: 'เวรประจำวัน & เขตพื้นที่', icon: <ClipboardCheck size={17} />, highlightColor: '#059669' },
      { to: '/homeroom', label: 'กิจกรรมโฮมรูม', icon: <School size={17} /> },
      { to: '/milk-report', label: 'บันทึกการดื่มนม', icon: <Coffee size={17} /> },
      { to: '/brush-log', label: 'บันทึกการแปรงฟัน', icon: <Smile size={17} /> },
      { to: '/saving', label: 'ระบบออมทรัพย์', icon: <Wallet size={17} /> },
      { to: '/club-attendance', label: 'กิจกรรมชุมนุม', icon: <Users size={17} /> },
    ],
  },
  {
    title: 'งานวัดผล (ปพ.5 / ปพ.6)',
    items: [
      { to: '/porpor6', label: 'พิมพ์ ปพ.6 (ครูประจำชั้น)', icon: <FileText size={17} />, highlightColor: '#DC2626', badge: 'A4' },
      { to: '/porpor5', label: 'วิชาที่ฉันสอน (ปพ.5)', icon: <BookOpen size={17} />, highlightColor: '#0284C7' },
      { to: '/academic-summary', label: 'สรุปผลสัมฤทธิ์ (8 กลุ่มสาระฯ)', icon: <BarChart2 size={17} />, highlightColor: '#D97706' },
    ],
  },
  {
    title: 'งานกิจการนักเรียน',
    items: [
      { to: '/behavior', label: 'คะแนนความประพฤติ & ใบเตือน', icon: <ShieldAlert size={17} />, highlightColor: '#B91C1C', badge: 'ใหม่' },
      { to: '/body-metrics', label: 'ข้อมูลสุขภาพ (BMI)', icon: <Heart size={17} /> },
      { to: '/class-dashboard', label: 'แดชบอร์ดรายชั้นเรียน', icon: <FileCheck size={17} /> },
      { to: '/manage-roster', label: 'จัดการรายชื่อนักเรียน', icon: <Users size={17} /> },
      { to: '/school-stats-report', label: 'รายงานสถิติประจำเดือน', icon: <BarChart2 size={17} /> },
    ],
  },
  {
    title: 'งานวิชาการ & บริหาร',
    items: [
      { to: '/timetable', label: 'ตารางสอน & จัดสอนแทน', icon: <Calendar size={17} />, highlightColor: '#4F46E5', badge: 'อัจฉริยะ' },
      { to: '/school-calendar', label: 'ปฏิทินการศึกษา', icon: <Calendar size={17} /> },
      { to: '/admin', label: 'จัดการระบบส่วนกลาง', icon: <Settings size={17} /> },
    ],
  },
];

function formatThaiLiveDateTime(d: Date) {
  const days = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์'];
  const months = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
  ];
  const dayName = days[d.getDay()];
  const dateNum = d.getDate();
  const monthName = months[d.getMonth()];
  const buddhistYear = d.getFullYear() + 543;
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return {
    datePart: `${dayName}ที่ ${dateNum} ${monthName} ${buddhistYear}`,
    timePart: `${hh}:${mm}:${ss} น.`,
  };
}

export default function SmartSchoolLayout({
  children,
  pageTitle = 'ระบบบริหารจัดการโรงเรียน',
}: {
  children: ReactNode;
  pageTitle?: string;
}) {
  const auth = useTeacherAuth();
  const location = useLocation();
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 960 : false
  );
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 960 : true
  );
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth < 960;
      setIsMobile(mobile);
      if (mobile) setSidebarOpen(false);
      else setSidebarOpen(true);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const { datePart, timePart } = formatThaiLiveDateTime(now);
  const userInitial = (auth.name || 'ครู').trim().charAt(0);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F8FAFC', fontFamily: 'inherit', position: 'relative' }}>
      {/* Mobile Backdrop Overlay */}
      {isMobile && sidebarOpen && (
        <div
          className="no-print"
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(2px)',
            zIndex: 45,
          }}
        />
      )}

      {/* Left Dark Sidebar */}
      <aside
        className="no-print"
        style={{
          position: isMobile ? 'fixed' : 'sticky',
          top: 0,
          left: 0,
          height: '100vh',
          width: sidebarOpen ? 260 : 0,
          minWidth: sidebarOpen ? 260 : 0,
          background: 'linear-gradient(180deg, #0F172A 0%, #1E293B 100%)',
          color: '#E2E8F0',
          transition: 'width 0.22s ease, min-width 0.22s ease',
          overflowX: 'hidden',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: sidebarOpen ? '4px 0 24px rgba(15,23,42,0.22)' : 'none',
          zIndex: 50,
        }}
      >
        {/* Brand Top */}
        <div style={{
          padding: '16px 16px 14px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
        }}>
          <Link
            to="/teacher-hub"
            style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', overflow: 'hidden' }}
          >
            <img
              src={`${import.meta.env.BASE_URL}images/school-logo.png`}
              alt="ตราโรงเรียนบ้านคลองมดแดง"
              style={{
                width: 38, height: 38, borderRadius: 10,
                background: '#FFFFFF', padding: 2, objectFit: 'contain', flexShrink: 0,
              }}
            />
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontWeight: 900, fontSize: '0.92rem', color: '#FFFFFF', letterSpacing: 0.4, whiteSpace: 'nowrap' }}>
                SMART SCHOOL OS
              </div>
              <div style={{ fontSize: '0.73rem', color: '#FDBA74', fontWeight: 700, whiteSpace: 'nowrap' }}>
                ร.ร.บ้านคลองมดแดง
              </div>
            </div>
          </Link>

          {isMobile && (
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              style={{
                background: 'rgba(255,255,255,0.1)', border: 'none', color: '#FFF',
                borderRadius: 8, width: 30, height: 30, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Navigation Groups */}
        <nav style={{ padding: '10px 10px 18px', flex: 1 }}>
          {NAV_GROUPS.map((grp, gIdx) => (
            <div key={gIdx} style={{ marginBottom: 12 }}>
              {grp.title && (
                <div style={{
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  color: '#94A3B8',
                  padding: '8px 10px 4px',
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                }}>
                  {grp.title}
                </div>
              )}
              {grp.items.map(item => {
                const active = location.pathname === item.to;
                const activeBg = item.highlightColor || '#0284C7';
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => { if (isMobile) setSidebarOpen(false); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '9px 12px',
                      marginBottom: 3,
                      borderRadius: 10,
                      textDecoration: 'none',
                      fontSize: '0.83rem',
                      fontWeight: active ? 800 : 600,
                      color: active ? '#FFFFFF' : '#CBD5E1',
                      background: active ? activeBg : 'transparent',
                      boxShadow: active ? `0 4px 12px ${activeBg}44` : 'none',
                      transition: 'background 0.15s, color 0.15s',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <span style={{ display: 'inline-flex', color: active ? '#FFFFFF' : '#94A3B8' }}>
                      {item.icon}
                    </span>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.label}
                    </span>
                    {item.badge && (
                      <span style={{
                        fontSize: '0.62rem',
                        fontWeight: 900,
                        padding: '1px 6px',
                        borderRadius: 999,
                        background: active ? 'rgba(255,255,255,0.22)' : 'rgba(251,146,60,0.2)',
                        color: active ? '#FFFFFF' : '#FDBA74',
                      }}>
                        {item.badge}
                      </span>
                    )}
                    {!active && !item.badge && <ChevronRight size={13} style={{ opacity: 0.3 }} />}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Bottom Database Protection Status & Website Link */}
        <div style={{ padding: '12px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
            borderRadius: 8, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)',
            color: '#A7F3D0', fontSize: '0.72rem', fontWeight: 700,
          }}>
            <ShieldCheck size={15} color="#34D399" style={{ flexShrink: 0 }} />
            <span>ฐานข้อมูลหลักปลอดภัย (ป้องกันการลบข้อมูล)</span>
          </div>
          <Link
            to="/"
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
              borderRadius: 8, background: 'rgba(255,255,255,0.06)', color: '#E2E8F0',
              textDecoration: 'none', fontSize: '0.78rem', fontWeight: 700,
            }}
          >
            <Globe size={15} color="#38BDF8" /> กลับหน้าเว็บไซต์หลักโรงเรียน
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top Live Header Bar */}
        <header
          className="no-print"
          style={{
            background: '#FFFFFF',
            borderBottom: '1px solid #E2E8F0',
            padding: '10px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
            boxShadow: '0 1px 4px rgba(15,23,42,0.04)',
            position: 'sticky',
            top: 0,
            zIndex: 30,
          }}
        >
          <button
            type="button"
            onClick={() => setSidebarOpen(o => !o)}
            style={{
              background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: 8,
              width: 36, height: 36, display: 'inline-flex', alignItems: 'center',
              justifyContent: 'center', cursor: 'pointer', color: '#1E293B',
            }}
            title="เปิด/ปิดแถบเมนู"
          >
            <Menu size={18} />
          </button>

          <div style={{ fontWeight: 900, fontSize: '1.02rem', color: '#0F172A' }}>
            {pageTitle}
          </div>

          {/* Live Date & Clock Pill */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '5px 12px',
            background: '#F8FAFC',
            border: '1px solid #E2E8F0',
            borderRadius: 8,
            fontSize: '0.78rem',
            fontWeight: 700,
            color: '#475569',
          }}>
            <span style={{ color: '#0284C7' }}>📅 {datePart}</span>
            <span style={{ color: '#CBD5E1' }}>|</span>
            <span style={{ color: '#DC2626', display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 800 }}>
              <Clock size={13} /> {timePart}
            </span>
          </div>

          {/* Right User / Online Status */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              fontSize: '0.75rem', fontWeight: 800, color: '#16A34A',
              background: '#DCFCE7', padding: '4px 10px', borderRadius: 999,
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#16A34A', display: 'inline-block' }} />
              Online
            </span>

            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '4px 10px 4px 4px', borderRadius: 999,
              background: '#EFF6FF', border: '1px solid #BFDBFE',
            }}>
              <div style={{
                width: 26, height: 26, borderRadius: '50%',
                background: '#2563EB', color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 900, fontSize: '0.78rem',
              }}>
                {userInitial}
              </div>
              <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#1E3A8A' }}>
                {auth.name || 'ครูผู้สอน'}
              </span>
            </div>

            {auth.authed && (
              <button
                type="button"
                onClick={auth.logout}
                style={{
                  background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA',
                  borderRadius: 8, padding: '6px 10px', fontSize: '0.76rem', fontWeight: 800,
                  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
                }}
              >
                <LogOut size={13} /> ออก
              </button>
            )}
          </div>
        </header>

        {/* Page Body */}
        <main style={{ flex: 1, padding: isMobile ? '14px 12px' : '20px', maxWidth: 1440, width: '100%', margin: '0 auto' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
