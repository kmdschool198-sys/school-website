import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import SmartSchoolLayout from '../components/SmartSchoolLayout';
import TimetableSmart from '../components/TimetableSmart';
import { canManageStaffUsers, useTeacherAuth } from '../utils/teacherAuth';
import { useSignedIn } from '../utils/useSignedIn';
import { Calendar, Eye, Edit3, Printer, ExternalLink, AlertCircle, ChevronLeft } from 'lucide-react';
import { SCHOOL_NAME } from '../config/siteLinks';

export default function TimetablePage() {
  const teacherAuth = useTeacherAuth();
  const [editMode, setEditMode] = useState(false);
  const [activeLeaves, setActiveLeaves] = useState<Array<{ id: string; teacherName: string; type: string; startDate: string; endDate: string; substitute?: string }>>([]);

  // leave records are staff data; visitors see the timetable without today's substitutes
  const signedIn = useSignedIn();
  useEffect(() => {
    if (!signedIn) return;
    const today = new Date().toISOString().slice(0, 10);
    return onSnapshot(query(collection(db, 'teacher_leaves'), where('status', '==', 'อนุมัติ')), snap => {
      const list: typeof activeLeaves = [];
      snap.forEach(d => {
        const data = d.data() as any;
        if (data.startDate <= today && data.endDate >= today) {
          list.push({ id: d.id, ...data });
        }
      });
      setActiveLeaves(list);
    });
  }, [signedIn]);

  // Only admins edit the timetable and arrange substitutes; teachers see it read-only
  const canEditTimetable = teacherAuth.authed && canManageStaffUsers(teacherAuth.role);
  const isReadOnly = !canEditTimetable || !editMode;

  if (teacherAuth.loading) return null;

  // Students and parents get the timetable and nothing else: the staff shell (sidebar of every
  // teacher system, admin login, edit tools) is only for signed-in teachers.
  if (!teacherAuth.authed) {
    return (
      <div style={{ minHeight: '100vh', background: '#F8FAFC' }}>
        <div style={{ maxWidth: 1440, margin: '0 auto', padding: '1rem 1rem 2rem' }}>
          <div className="tt-no-print" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <Link to="/" style={{ color: '#1E3A8A', fontWeight: 800, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <ChevronLeft size={16} /> หน้าแรก
            </Link>
            <h1 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900, color: '#0F172A' }}>
              ตารางเรียนและตารางสอน · {SCHOOL_NAME}
            </h1>
          </div>
          <TimetableSmart readOnly />
        </div>
      </div>
    );
  }

  return (
    <SmartSchoolLayout pageTitle="ระบบตารางเรียน & ตารางสอน">
      <div style={{ maxWidth: 1440, margin: '0 auto', paddingBottom: '2rem' }}>
        {/* Banner แจ้งเตือนครูที่ได้รับอนุมัติลาในวันนี้ */}
        {activeLeaves.length > 0 && (
          <div
            className="tt-no-print"
            style={{
              background: '#FEF3C7', border: '1.5px solid #F59E0B', borderRadius: 14,
              padding: '12px 18px', marginBottom: 14, display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, color: '#92400E',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 800, fontSize: '0.86rem' }}>
              <AlertCircle size={20} color="#D97706" />
              <span>
                📢 แจ้งเตือนการจัดสอนแทนวันนี้ ({activeLeaves.length} ท่าน):{' '}
                {activeLeaves.map(l => `${l.teacherName} (${l.type} · ผู้สอนแทน: ${l.substitute || 'ระบุในตาราง'})`).join(' | ')}
              </span>
            </div>
            {!editMode && canEditTimetable && (
              <button
                onClick={() => setEditMode(true)}
                style={{
                  background: '#D97706', color: 'white', border: 'none', borderRadius: 8,
                  padding: '6px 12px', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer',
                }}
              >
                คลิกเพื่อจัดคาบสอนแทน
              </button>
            )}
          </div>
        )}

        {/* Page Header Banner */}
        <div
          className="tt-no-print"
          style={{
            background: 'linear-gradient(135deg, #0F172A 0%, #1E3A8A 60%, #312E81 100%)',
            borderRadius: 18,
            padding: '1.25rem 1.5rem',
            color: 'white',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 14,
            boxShadow: '0 12px 28px rgba(15, 23, 42, 0.16)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: 'rgba(255,255,255,0.14)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Calendar size={26} />
            </div>
            <div>
              <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#93C5FD', letterSpacing: '0.04em' }}>
                {`SMART TIMETABLE & SUBSTITUTE STUDIO (ครู: ${teacherAuth.name})`}
              </div>
              <h2 style={{ margin: '2px 0 0', fontSize: '1.3rem', fontWeight: 900 }}>
                {editMode
                  ? 'ระบบจัดตารางสอน & จัดครูสอนแทนอัจฉริยะ'
                  : `ตารางเรียนและตารางสอน · ${SCHOOL_NAME}`}
              </h2>
              <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>
                {editMode
                  ? 'คลิกช่องคาบเรียนเพื่อแก้ไข · สลับคาบเรียน 2 คลิก · จัดครูสอนแทนอัตโนมัติ'
                  : 'โหมดแสดงผลสำหรับนักเรียนและบุคคลทั่วไป (ดูอย่างเดียว)'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <>
                {canEditTimetable && <button
                  onClick={() => setEditMode(!editMode)}
                  style={{
                    background: editMode ? '#10B981' : 'rgba(255,255,255,0.16)',
                    color: 'white',
                    border: '1px solid rgba(255,255,255,0.25)',
                    padding: '8px 14px',
                    borderRadius: 10,
                    fontWeight: 800,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  {editMode ? <Edit3 size={15} /> : <Eye size={15} />}
                  {editMode ? 'โหมดแก้ไขเปิดอยู่ (คลิกเพื่อสลับดูอย่างเดียว)' : 'เปิดโหมดแก้ไข & จัดสอนแทน'}
                </button>}
                {canEditTimetable && <Link
                  to="/admin?tab=timetable"
                  style={{
                    background: 'rgba(255,255,255,0.12)',
                    color: 'white',
                    textDecoration: 'none',
                    border: '1px solid rgba(255,255,255,0.22)',
                    padding: '8px 14px',
                    borderRadius: 10,
                    fontWeight: 800,
                    fontSize: '0.8rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <ExternalLink size={15} /> จัดการในหน้าแอดมิน
                </Link>}
            </>

            <button
              onClick={() => window.print()}
              style={{
                background: 'white',
                color: '#0F172A',
                border: 'none',
                padding: '8px 14px',
                borderRadius: 10,
                fontWeight: 800,
                fontSize: '0.8rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Printer size={15} /> พิมพ์ A4
            </button>
          </div>
        </div>

        {/* Main Interactive Timetable Component */}
        <TimetableSmart readOnly={isReadOnly} />
      </div>
    </SmartSchoolLayout>
  );
}
