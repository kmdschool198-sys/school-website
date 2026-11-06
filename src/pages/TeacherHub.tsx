import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import {
  User, Layers, CheckSquare, BarChart3, Users, Search, Pin, PinOff, ShieldCheck,
} from 'lucide-react';
import { useTeacherAuth } from '../utils/teacherAuth';
import TeacherLoginGate from '../components/TeacherLoginGate';
import SmartSchoolLayout from '../components/SmartSchoolLayout';
import { useSchoolRoster } from '../utils/useSchoolRoster';
import { SCHOOL_NAME } from '../config/siteLinks';

interface SmartAppIcon {
  id: string;
  to: string;
  label: string;
  subtitle: string;
  category: 'daily' | 'academic' | 'student' | 'print_admin';
  emoji: string;
  gradient: string;
  badge?: string;
}

const PIN_STORAGE_KEY = 'kmd_teacher_hub_pinned_apps_v1';

const CATEGORY_LABELS: Record<SmartAppIcon['category'], string> = {
  daily: 'งานประจำวัน',
  academic: 'วิชาการ & วัดผล',
  student: 'ดูแลนักเรียน',
  print_admin: 'รายงาน & บริหาร',
};

const SMART_APPS: SmartAppIcon[] = [
  { id: 'attendance', to: '/attendance', label: 'เช็คชื่อรายวัน', subtitle: 'เช็คชื่อ นม แปรงฟัน', category: 'daily', emoji: '✅', gradient: 'linear-gradient(135deg,#10B981,#059669)' },
  { id: 'porpor6', to: '/porpor6', label: 'พิมพ์ ปพ.6', subtitle: 'สมุดพกรายคน/ทั้งห้อง', category: 'academic', emoji: '📄', gradient: 'linear-gradient(135deg,#EF4444,#DC2626)', badge: 'A4' },
  { id: 'porpor5', to: '/porpor5', label: 'บันทึก ปพ.5', subtitle: 'คะแนนรายตัวชี้วัด แบบ SGS', category: 'academic', emoji: '📝', gradient: 'linear-gradient(135deg,#0284C7,#0369A1)', badge: 'A4' },
  { id: 'academic-summary', to: '/academic-summary', label: 'สรุปผลสัมฤทธิ์', subtitle: 'แยก 8 กลุ่มสาระฯ', category: 'academic', emoji: '📊', gradient: 'linear-gradient(135deg,#F59E0B,#D97706)' },
  { id: 'supervision', to: '/supervision', label: 'การนิเทศภายใน', subtitle: 'ผลนิเทศ 3 ครั้ง/ปี', category: 'print_admin', emoji: '📋', gradient: 'linear-gradient(135deg,#8B5CF6,#6D28D9)', badge: 'ใหม่' },
  { id: 'print-hub', to: '/print-hub', label: 'ศูนย์รวมการพิมพ์', subtitle: 'One-Stop Print Hub', category: 'print_admin', emoji: '🖨️', gradient: 'linear-gradient(135deg,#BE123C,#9F1239)' },
  { id: 'behavior', to: '/behavior', label: 'ความประพฤติ', subtitle: 'ตัด-เพิ่มแต้ม/ใบเตือน', category: 'student', emoji: '🛡️', gradient: 'linear-gradient(135deg,#DC2626,#991B1B)' },
  { id: 'lunch', to: '/lunch', label: 'อาหารกลางวัน', subtitle: 'นับจากเช็คชื่อ · งบ 22 บ.', category: 'daily', emoji: '🍱', gradient: 'linear-gradient(135deg,#EA580C,#C2410C)' },
  { id: 'duty', to: '/duty', label: 'เวรประจำวัน', subtitle: 'นับจากเช็คชื่อ', category: 'daily', emoji: '🧹', gradient: 'linear-gradient(135deg,#059669,#047857)' },
  { id: 'janitor-tasks', to: '/janitor-tasks', label: 'งานนักการภารโรง', subtitle: 'เช็กงานเช้า-บ่าย & รูป', category: 'print_admin', emoji: '🛠️', gradient: 'linear-gradient(135deg,#D97706,#B45309)' },
  { id: 'home-visit', to: '/home-visit', label: 'เยี่ยมบ้านนักเรียน', subtitle: 'คัดกรองทุน กสศ. & รูปบ้าน', category: 'student', emoji: '🏠', gradient: 'linear-gradient(135deg,#059669,#047857)' },
  { id: 'homeroom', to: '/homeroom', label: 'กิจกรรมโฮมรูม', subtitle: 'อบรมหน้าเสาธง/เช้า', category: 'daily', emoji: '🏫', gradient: 'linear-gradient(135deg,#38BDF8,#0284C7)' },
  { id: 'milk-report', to: '/milk-report', label: 'รายงานดื่มนม', subtitle: 'ดึงจากเช็คชื่ออัตโนมัติ', category: 'daily', emoji: '🥛', gradient: 'linear-gradient(135deg,#60A5FA,#3B82F6)' },
  { id: 'brush-log', to: '/brush-log', label: 'รายงานแปรงฟัน', subtitle: 'ดึงจากเช็คชื่ออัตโนมัติ', category: 'daily', emoji: '🦷', gradient: 'linear-gradient(135deg,#06B6D4,#0891B2)' },
  { id: 'saving', to: '/saving', label: 'ระบบออมทรัพย์', subtitle: 'ฝาก-ถอนรายวัน', category: 'daily', emoji: '🐷', gradient: 'linear-gradient(135deg,#34D399,#10B981)' },
  { id: 'body-metrics', to: '/body-metrics', label: 'น้ำหนัก-ส่วนสูง', subtitle: 'คำนวณเกณฑ์ BMI', category: 'student', emoji: '⚖️', gradient: 'linear-gradient(135deg,#14B8A6,#0D9488)' },
  { id: 'club-attendance', to: '/club-attendance', label: 'เช็คชื่อชุมนุม', subtitle: 'ชุมนุม & ลูกเสือ', category: 'student', emoji: '🎯', gradient: 'linear-gradient(135deg,#0D9488,#115E59)' },
  { id: 'manage-clubs', to: '/manage-clubs', label: 'จัดการชุมนุม', subtitle: 'จัดสมาชิกชุมนุม', category: 'student', emoji: '⚙️', gradient: 'linear-gradient(135deg,#8B5CF6,#7C3AED)' },
  { id: 'class-dashboard', to: '/class-dashboard', label: 'แดชบอร์ดชั้น', subtitle: 'ภาพรวมประจำห้อง', category: 'student', emoji: '📈', gradient: 'linear-gradient(135deg,#F97316,#EA580C)' },
  { id: 'manage-roster', to: '/manage-roster', label: 'รายชื่อนักเรียน', subtitle: 'ตรวจสอบทะเบียนชั้น', category: 'student', emoji: '👥', gradient: 'linear-gradient(135deg,#EC4899,#DB2777)' },
  { id: 'timetable', to: '/timetable', label: 'ตารางสอน & สอนแทน', subtitle: 'จัดตาราง/จัดสอนแทน 1 คลิก', category: 'academic', emoji: '📅', gradient: 'linear-gradient(135deg,#6366F1,#4F46E5)' },
  { id: 'school-stats-report', to: '/school-stats-report', label: 'สถิติประจำเดือน', subtitle: 'สรุปการมาเรียนทั้ง ร.ร.', category: 'print_admin', emoji: '📋', gradient: 'linear-gradient(135deg,#A855F7,#9333EA)' },
  { id: 'school-calendar', to: '/school-calendar', label: 'ปฏิทิน ร.ร.', subtitle: 'วันหยุด-เรียนชดเชย', category: 'print_admin', emoji: '🗓️', gradient: 'linear-gradient(135deg,#F43F5E,#E11D48)' },
  { id: 'student-record', to: '/student-record', label: 'ผลการเรียนรายคน', subtitle: 'รายปี · ทั้งห้อง · ย้อนหลัง', category: 'academic', emoji: '🎓', gradient: 'linear-gradient(135deg,#7C3AED,#5B21B6)', badge: 'A4' },
  { id: 'remedial', to: '/remedial', label: 'ผลการแก้ตัว', subtitle: 'ปิดบันทึกผล · แก้ 0/ร/มส', category: 'academic', emoji: '🔁', gradient: 'linear-gradient(135deg,#0EA5E9,#0369A1)' },
  { id: 'admin', to: '/admin', label: 'จัดการเว็บไซต์', subtitle: 'ข่าว สไลด์ บุคลากร สิทธิ์ผู้ใช้', category: 'print_admin', emoji: '🔧', gradient: 'linear-gradient(135deg,#64748B,#475569)' },
];

function readPinnedIds(): string[] {
  try {
    const raw = localStorage.getItem(PIN_STORAGE_KEY);
    if (!raw) return ['attendance', 'porpor6', 'print-hub', 'lunch', 'duty', 'behavior'];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const replaced = parsed
        .flatMap(item => (item === 'lunch-duty' ? ['lunch', 'duty'] : [item]))
        .filter(item => typeof item === 'string');
      return replaced;
    }
    return ['attendance', 'porpor6', 'print-hub', 'lunch', 'duty', 'behavior'];
  } catch {
    return ['attendance', 'porpor6', 'print-hub', 'lunch', 'duty', 'behavior'];
  }
}

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function TeacherHubPage() {
  const auth = useTeacherAuth();
  if (!auth.authed) {
    return <TeacherLoginGate title="🏫 ศูนย์รวมระบบครู (Smart School OS)" subtitle="เข้าสู่ระบบครั้งเดียว ใช้ได้ทุกระบบ" />;
  }
  return <DashboardView userName={auth.name} role={auth.role} />;
}

function DashboardView({ userName, role }: { userName: string; role: string }) {
  const { classes: unifiedRosters, summary: rosterSummary } = useSchoolRoster();
  const [pinnedIds, setPinnedIds] = useState<string[]>(readPinnedIds);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'pinned' | 'daily' | 'academic' | 'student' | 'print_admin'>('all');

  // Read-only Firestore subscriptions for live attendance dashboard
  const [todayAttDocs, setTodayAttDocs] = useState<Array<{ classId: string; date: string; records: Record<string, { status: string }> }>>([]);

  useEffect(() => {
    localStorage.setItem(PIN_STORAGE_KEY, JSON.stringify(pinnedIds));
  }, [pinnedIds]);

  useEffect(() => {
    const today = todayStr();
    (async () => {
      try {
        const snap = await getDocs(query(collection(db, 'attendance'), where('date', '==', today)));
        const docs: Array<{ classId: string; date: string; records: Record<string, { status: string }> }> = [];
        snap.forEach(d => docs.push(d.data() as any));
        setTodayAttDocs(docs);
      } catch {
        // Ignore offline errors cleanly
      }
    })();
  }, []);

  const togglePin = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPinnedIds(curr => (curr.includes(id) ? curr.filter(x => x !== id) : [id, ...curr]));
  };

  const filteredApps = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return SMART_APPS
      .filter(app => {
        if (activeCategory === 'pinned' && !pinnedIds.includes(app.id)) return false;
        if (activeCategory !== 'all' && activeCategory !== 'pinned' && app.category !== activeCategory) return false;
        if (q && !app.label.toLowerCase().includes(q) && !app.subtitle.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => {
        const pinA = pinnedIds.indexOf(a.id);
        const pinB = pinnedIds.indexOf(b.id);
        const aPinned = pinA !== -1;
        const bPinned = pinB !== -1;
        if (aPinned && bPinned) return pinA - pinB;
        if (aPinned) return -1;
        if (bPinned) return 1;
        return 0;
      });
  }, [pinnedIds, searchQuery, activeCategory]);

  // Compute live student counts & today's attendance per room (Unified Single Source of Truth)
  const stats = useMemo(() => {
    let checkedRoomsCount = 0;

    const roomBars = unifiedRosters.map(rm => {
      const total = rm.totalCount;
      const attDoc = todayAttDocs.find(d => d.classId === rm.classId);
      const isChecked = !!(attDoc && attDoc.records && Object.keys(attDoc.records).length > 0);
      if (isChecked) checkedRoomsCount += 1;

      let presentCount = total;
      if (isChecked && attDoc) {
        presentCount = Object.values(attDoc.records).filter(r => r.status === 'present').length;
      }
      const pct = total > 0 ? Math.round((presentCount / total) * 100) : 100;

      return {
        roomId: rm.classId,
        label: rm.label,
        total,
        presentCount,
        pct,
        isChecked,
      };
    });

    return {
      male: rosterSummary.totalMale,
      female: rosterSummary.totalFemale,
      total: rosterSummary.totalStudents,
      roomBars,
      totalRooms: roomBars.length,
      checkedRooms: checkedRoomsCount,
    };
  }, [unifiedRosters, rosterSummary, todayAttDocs]);

  const roleLabel =
    role === 'owner' || role === 'admin' || role === 'super'
      ? 'ผู้ดูแลระบบ (Admin)'
      : 'ครูผู้สอน (Teacher)';

  const donutPct = stats.checkedRooms > 0
    ? Math.round((stats.checkedRooms / stats.totalRooms) * 100)
    : 100;

  return (
    <SmartSchoolLayout pageTitle="ระบบบริหารจัดการโรงเรียน">
      {/* Top Section Title */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 10, marginBottom: 14,
      }}>
        <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#FF6A01' }}>🏫</span> ภาพรวมระบบบริหารจัดการ{SCHOOL_NAME} (Smart School OS)
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{
            background: '#DCFCE7', color: '#166534', padding: '5px 12px',
            borderRadius: 999, fontSize: '0.75rem', fontWeight: 800,
            display: 'inline-flex', alignItems: 'center', gap: 5,
          }}>
            <ShieldCheck size={14} /> ข้อมูลในฐานข้อมูลปลอดภัย 100%
          </span>
          <span style={{
            background: '#1E293B', color: '#FFFFFF', padding: '5px 14px',
            borderRadius: 999, fontSize: '0.76rem', fontWeight: 800,
          }}>
            📅 ปีการศึกษา 2569 · สพป.กำแพงเพชร เขต 2
          </span>
        </div>
      </div>

      {/* Welcome Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #EA580C 0%, #D97706 50%, #4F46E5 100%)',
        borderRadius: 18,
        padding: '20px 24px',
        color: '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
        marginBottom: 20,
        boxShadow: '0 10px 26px rgba(234,88,12,0.22)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 58, height: 58, borderRadius: '50%',
            background: 'rgba(255,255,255,0.22)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            border: '2px solid rgba(255,255,255,0.4)',
          }}>
            <User size={30} color="#FFFFFF" />
          </div>
          <div>
            <div style={{ fontSize: '1.3rem', fontWeight: 900, letterSpacing: 0.2 }}>
              ยินดีต้อนรับ, คุณ{userName}
            </div>
            <div style={{ fontSize: '0.84rem', opacity: 0.95, marginTop: 3, fontWeight: 600 }}>
              🪪 สิทธิ์การใช้งาน: {roleLabel} · นักเรียนทั้งหมด {stats.total} คน ({stats.totalRooms} ห้องเรียน อ.2 – ม.3)
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link
            to="/porpor6"
            style={{
              background: '#FFFFFF', color: '#DC2626', textDecoration: 'none',
              padding: '9px 16px', borderRadius: 999, fontWeight: 900, fontSize: '0.82rem',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            }}
          >
            📄 พิมพ์สมุดพก ปพ.6
          </Link>
          <Link
            to="/print-hub"
            style={{
              background: 'rgba(15,23,42,0.85)', color: '#FFFFFF', textDecoration: 'none',
              padding: '9px 16px', borderRadius: 999, fontWeight: 800, fontSize: '0.82rem',
            }}
          >
            🖨️ ศูนย์รวมการพิมพ์ (One-Stop)
          </Link>
        </div>
      </div>

      {/* Smart Apps Grid Card with Search, Category Filter & Pinning */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: 18,
        padding: '20px 22px 24px',
        marginBottom: 20,
        border: '1px solid #E2E8F0',
        boxShadow: '0 4px 16px rgba(15,23,42,0.04)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 12, marginBottom: 14,
        }}>
          <div style={{ fontSize: '0.98rem', fontWeight: 900, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Layers size={18} color="#EA580C" /> แอปพลิเคชันระบบงานครู (กด 📌 เพื่อปักหมุดระบบที่ใช้บ่อยไว้ด้านหน้า)
          </div>

          <div style={{ position: 'relative', minWidth: 230 }}>
            <Search size={15} color="#94A3B8" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="ค้นหาชื่อระบบงาน..."
              style={{
                width: '100%', padding: '7px 12px 7px 32px',
                borderRadius: 999, border: '1px solid #CBD5E1', fontSize: '0.8rem',
              }}
            />
          </div>
        </div>

        {/* Category Filter Pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
          {([
            ['all', `ทั้งหมด (${SMART_APPS.length})`],
            ['pinned', `ปักหมุด (${pinnedIds.length})`],
            ['daily', CATEGORY_LABELS.daily],
            ['academic', CATEGORY_LABELS.academic],
            ['student', CATEGORY_LABELS.student],
            ['print_admin', CATEGORY_LABELS.print_admin],
          ] as const).map(([key, label]) => {
            const active = activeCategory === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveCategory(key)}
                style={{
                  padding: '6px 13px',
                  borderRadius: 999,
                  border: active ? '1.5px solid #EA580C' : '1px solid #E2E8F0',
                  background: active ? '#FFF7ED' : '#F8FAFC',
                  color: active ? '#C2410C' : '#475569',
                  fontWeight: 800,
                  fontSize: '0.76rem',
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Apps: grouped by category when showing everything, one grid when filtered or searching */}
        {(activeCategory === 'all' && !searchQuery.trim()
          ? [
            ...(pinnedIds.length ? [{ key: 'pinned', title: 'ปักหมุดไว้', apps: filteredApps.filter(a => pinnedIds.includes(a.id)) }] : []),
            ...(Object.keys(CATEGORY_LABELS) as SmartAppIcon['category'][]).map(cat => ({
              key: cat, title: CATEGORY_LABELS[cat], apps: filteredApps.filter(a => a.category === cat && !pinnedIds.includes(a.id)),
            })),
          ]
          : [{ key: 'list', title: '', apps: filteredApps }]
        ).filter(group => group.apps.length > 0).map(group => (
        <section key={group.key} style={{ marginBottom: 18 }}>
          {group.title && <h3 style={{ fontSize: '0.95rem', fontWeight: 900, color: '#0F172A', margin: '0 0 10px' }}>{group.title}</h3>}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(125px, 1fr))',
          gap: 14,
        }}>
          {group.apps.map(app => {
            const isPinned = pinnedIds.includes(app.id);
            return (
              <Link
                key={app.id}
                to={app.to}
                style={{
                  textDecoration: 'none',
                  color: '#1E293B',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '14px 10px 12px',
                  borderRadius: 16,
                  background: isPinned ? '#FFFBEB' : '#F8FAFC',
                  border: isPinned ? '1.5px solid #FDBA74' : '1px solid #E2E8F0',
                  position: 'relative',
                  transition: 'transform 0.16s ease, box-shadow 0.16s ease',
                }}
                onMouseOver={e => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 10px 22px rgba(15,23,42,0.08)';
                }}
                onMouseOut={e => {
                  e.currentTarget.style.transform = '';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {/* Pin toggle button */}
                <button
                  type="button"
                  onClick={e => togglePin(app.id, e)}
                  title={isPinned ? 'เลิกปักหมุด' : 'ปักหมุดไว้ด้านหน้า'}
                  style={{
                    position: 'absolute',
                    top: 6,
                    left: 6,
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    border: 'none',
                    background: isPinned ? '#FFEDD5' : 'transparent',
                    color: isPinned ? '#EA580C' : '#94A3B8',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {isPinned ? <Pin size={12} /> : <PinOff size={12} />}
                </button>

                {app.badge && (
                  <span style={{
                    position: 'absolute', top: 6, right: 6,
                    background: '#EF4444', color: 'white',
                    fontSize: '0.6rem', fontWeight: 900,
                    padding: '1px 6px', borderRadius: 999,
                  }}>
                    {app.badge}
                  </span>
                )}

                <div style={{
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  background: app.gradient,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.65rem',
                  boxShadow: '0 6px 14px rgba(15,23,42,0.12)',
                  marginBottom: 8,
                }}>
                  {app.emoji}
                </div>
                <div style={{
                  fontSize: '0.8rem',
                  fontWeight: 900,
                  textAlign: 'center',
                  color: '#0F172A',
                  lineHeight: 1.2,
                }}>
                  {app.label}
                </div>
                <div style={{
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  textAlign: 'center',
                  color: '#64748B',
                  marginTop: 2,
                }}>
                  {app.subtitle}
                </div>
              </Link>
            );
          })}
        </div>
        </section>
        ))}
        {filteredApps.length === 0 && (
          <p style={{ color: '#475569', textAlign: 'center', padding: '1.5rem 0' }}>ไม่พบเครื่องมือที่ค้นหา</p>
        )}
      </div>

      {/* Bottom 3 Statistical Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))',
        gap: 18,
      }}>
        {/* Card 1: นักเรียนที่มาเรียน (ชาย/หญิง) */}
        <div style={cardBox}>
          <div style={cardHead}>
            <Users size={16} color="#2563EB" /> สัดส่วนนักเรียนชาย / หญิง ทั้งโรงเรียน
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 14, padding: '10px 0' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 800, marginBottom: 6 }}>
                <span style={{ color: '#2563EB' }}>👦 นักเรียนชาย</span>
                <span>{stats.male} คน ({((stats.male / stats.total) * 100).toFixed(1)}%)</span>
              </div>
              <div style={{ height: 14, background: '#E2E8F0', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ width: `${(stats.male / stats.total) * 100}%`, height: '100%', background: '#3B82F6', borderRadius: 999 }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 800, marginBottom: 6 }}>
                <span style={{ color: '#DB2777' }}>👧 นักเรียนหญิง</span>
                <span>{stats.female} คน ({((stats.female / stats.total) * 100).toFixed(1)}%)</span>
              </div>
              <div style={{ height: 14, background: '#E2E8F0', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ width: `${(stats.female / stats.total) * 100}%`, height: '100%', background: '#EC4899', borderRadius: 999 }} />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 18, fontSize: '0.76rem', fontWeight: 800, color: '#475569', marginTop: 8 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 12, height: 12, background: '#3B82F6', display: 'inline-block', borderRadius: 3 }} /> ชาย ({stats.male})
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 12, height: 12, background: '#EC4899', display: 'inline-block', borderRadius: 3 }} /> หญิง ({stats.female})
            </span>
          </div>
        </div>

        {/* Card 2: ความคืบหน้าการเช็คชื่อวันนี้ (Donut Chart) */}
        <div style={cardBox}>
          <div style={cardHead}>
            <CheckSquare size={16} color="#16A34A" /> ความคืบหน้าการเช็คชื่อวันนี้
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 0' }}>
            <svg width="160" height="160" viewBox="0 0 42 42">
              <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#E2E8F0" strokeWidth="5" />
              <circle
                cx="21"
                cy="21"
                r="15.915"
                fill="transparent"
                stroke="#15803D"
                strokeWidth="5"
                strokeDasharray={`${donutPct} ${100 - donutPct}`}
                strokeDashoffset="25"
              />
              <text x="21" y="20" textAnchor="middle" fontSize="6" fontWeight="900" fill="#0F172A">
                {stats.checkedRooms > 0 ? `${stats.checkedRooms}/${stats.totalRooms}` : `${stats.totalRooms} ห้อง`}
              </text>
              <text x="21" y="25.5" textAnchor="middle" fontSize="3.1" fontWeight="700" fill="#64748B">
                {stats.checkedRooms > 0 ? 'เช็คชื่อแล้ววันนี้' : 'พร้อมเช็คชื่อรายวัน'}
              </text>
            </svg>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, fontSize: '0.75rem', fontWeight: 800, color: '#475569' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 12, height: 12, background: '#15803D', display: 'inline-block', borderRadius: 3 }} /> เช็คแล้ว ({stats.checkedRooms})
            </span>
            <Link to="/attendance" style={{ color: '#EA580C', textDecoration: 'none' }}>
              ไปหน้าเช็คชื่อ →
            </Link>
          </div>
        </div>

        {/* Card 3: จำนวนนักเรียนและร้อยละการมาเรียนแยกตามห้อง (Bar Chart) */}
        <div style={cardBox}>
          <div style={cardHead}>
            <BarChart3 size={16} color="#F59E0B" /> จำนวนนักเรียนแยกตามห้องเรียน (อ.2 – ม.3)
          </div>
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 6,
            padding: '18px 4px 6px',
            borderBottom: '1px solid #E2E8F0',
            minHeight: 150,
          }}>
            {stats.roomBars.map(b => (
              <div key={b.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ fontSize: '0.62rem', fontWeight: 800, color: '#15803D' }}>{b.presentCount}</div>
                <div style={{
                  width: '100%', maxWidth: 22, height: 95,
                  background: '#F1F5F9', borderRadius: '6px 6px 0 0',
                  display: 'flex', alignItems: 'flex-end', overflow: 'hidden',
                }}>
                  <div style={{
                    width: '100%',
                    height: `${b.pct}%`,
                    background: b.isChecked
                      ? 'linear-gradient(180deg,#22C55E,#15803D)'
                      : 'linear-gradient(180deg,#38BDF8,#0284C7)',
                    borderRadius: '6px 6px 0 0',
                  }} />
                </div>
                <div style={{ fontSize: '0.64rem', fontWeight: 800, color: '#475569', transform: 'rotate(-28deg)', marginTop: 4 }}>
                  {b.label}
                </div>
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center', fontSize: '0.74rem', color: '#64748B', fontWeight: 700, marginTop: 10 }}>
            รวมนักเรียนทั้งสิ้น {stats.total} คน (11 ชั้นเรียน)
          </div>
        </div>
      </div>
    </SmartSchoolLayout>
  );
}

const cardBox: React.CSSProperties = {
  background: '#FFFFFF',
  borderRadius: 18,
  padding: '18px 20px',
  border: '1px solid #E2E8F0',
  boxShadow: '0 4px 16px rgba(15,23,42,0.04)',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
};

const cardHead: React.CSSProperties = {
  fontSize: '0.9rem',
  fontWeight: 900,
  color: '#1E293B',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  marginBottom: 8,
};
