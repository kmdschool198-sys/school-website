import type { ClassAcademicData } from '../../data/academicData';
import { activityOverall, type ActivityMark } from '../../utils/assessment';

// SGS "บันทึกผลการเรียน วิชากิจกรรม": ผ / มผ for each activity. "ผ่านทั้งห้อง" marks every
// student ผ for that activity; individual students are changed afterwards.
export default function ActivityGrid({ classData, locked, onSave }: {
  classData: ClassAcademicData;
  locked: boolean;
  onSave: (studentCode: string, activities: Record<string, ActivityMark>) => void;
}) {
  const codes = classData.activities.map(a => a.code);

  const passWholeClass = (code: string, name: string) => {
    if (!window.confirm(`บันทึก "ผ" กิจกรรม${name} ให้นักเรียนทั้งห้อง (${classData.students.length} คน)?`)) return;
    classData.students.forEach(st => onSave(st.code, { ...(st.activities || {}), [code]: 'ผ' }));
  };

  if (!codes.length) return <p style={{ color: '#475569' }}>ชั้นนี้ยังไม่มีรายการกิจกรรมพัฒนาผู้เรียน</p>;

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
        <thead>
          <tr style={{ background: '#1E293B', color: 'white' }}>
            <th style={{ ...th, width: 48 }}>เลขที่</th>
            <th style={{ ...th, textAlign: 'left', minWidth: 180 }}>ชื่อ-นามสกุล</th>
            {classData.activities.map(a => <th key={a.code} style={th}>{a.name}<div style={{ fontWeight: 600, opacity: 0.85 }}>{a.hours} ชม.</div></th>)}
            <th style={{ ...th, background: '#0F172A' }}>สรุป</th>
          </tr>
          <tr className="no-print" style={{ background: '#E0F2FE' }}>
            <td colSpan={2} style={{ ...td, textAlign: 'left', fontWeight: 800, color: '#075985' }}>ทั้งห้อง</td>
            {classData.activities.map(a => (
              <td key={a.code} style={td}>
                <button type="button" disabled={locked} onClick={() => passWholeClass(a.code, a.name)}
                  style={{ border: 'none', borderRadius: 8, padding: '4px 10px', fontWeight: 800, cursor: 'pointer', background: locked ? '#94A3B8' : '#047857', color: 'white' }}>
                  ผ่านทั้งห้อง
                </button>
              </td>
            ))}
            <td style={td} />
          </tr>
        </thead>
        <tbody>
          {classData.students.map(st => {
            const overall = activityOverall(st.activities, codes);
            return (
              <tr key={st.code} style={{ borderBottom: '1px solid #E2E8F0' }}>
                <td style={{ ...td, fontWeight: 800 }}>{st.no}</td>
                <td style={{ ...td, textAlign: 'left', fontWeight: 700 }}>{st.name}</td>
                {classData.activities.map(a => {
                  const mark = st.activities?.[a.code];
                  return (
                    <td key={a.code} style={td}>
                      <select value={mark || ''} disabled={locked} aria-label={`${st.name} ${a.name}`}
                        onChange={e => {
                          // saved marks merge into Firestore, so a mark can be changed but not cleared
                          if (e.target.value) onSave(st.code, { ...(st.activities || {}), [a.code]: e.target.value as ActivityMark });
                        }}
                        style={{ padding: '4px 6px', borderRadius: 6, border: '1px solid #CBD5E1', fontWeight: 800, color: mark === 'มผ' ? '#B91C1C' : '#0F172A' }}>
                        {!mark && <option value="">-</option>}
                        <option value="ผ">ผ</option>
                        <option value="มผ">มผ</option>
                      </select>
                    </td>
                  );
                })}
                <td style={{ ...td, fontWeight: 900, color: overall === 'ไม่ผ่าน' ? '#B91C1C' : '#15803D' }}>{overall ?? 'ยังไม่ครบ'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const th: React.CSSProperties = { padding: '8px 6px', fontWeight: 800, fontSize: '0.78rem', textAlign: 'center' };
const td: React.CSSProperties = { padding: '5px 6px', textAlign: 'center' };
