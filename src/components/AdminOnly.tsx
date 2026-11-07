// Pages that change school-wide data (student rosters, clubs, the school calendar, janitor
// duties) are for admins only. A signed-in teacher sees this notice instead of the editor.
import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { canManageStaffUsers, type Role } from '../utils/teacherAuth';

export function isAdminRole(role: Role | null | undefined): boolean {
  return canManageStaffUsers(role);
}

export default function AdminOnly({ role, title, children }: { role: Role; title?: string; children: ReactNode }) {
  if (isAdminRole(role)) return <>{children}</>;
  return (
    <div style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', padding: '2rem 1rem' }}>
      <div style={{
        maxWidth: 460, width: '100%', background: 'white', border: '1px solid #FDE68A', borderRadius: 16,
        padding: '1.5rem', textAlign: 'center', boxShadow: '0 8px 24px rgba(15,23,42,0.06)',
      }}>
        <div style={{ fontSize: '2rem' }}>🔒</div>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 900, margin: '6px 0', color: '#0F172A' }}>
          {title || 'หน้านี้'} แก้ไขได้เฉพาะผู้ดูแลระบบ
        </h2>
        <p style={{ color: '#475569', fontSize: '0.9rem', margin: '0 0 14px' }}>
          ครูแต่ละท่านจัดการได้เฉพาะห้องที่เป็นครูประจำชั้นและวิชาที่สอน หากต้องการแก้ไขข้อมูลส่วนนี้ โปรดติดต่อผู้ดูแลระบบ
        </p>
        <Link to="/teacher-hub" style={{
          display: 'inline-block', background: '#0F172A', color: 'white', borderRadius: 10,
          padding: '8px 16px', fontWeight: 800, textDecoration: 'none',
        }}>กลับหน้าระบบครู</Link>
      </div>
    </div>
  );
}
