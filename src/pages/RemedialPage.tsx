// งานทะเบียน/วัดผล (SGS): open or close score entry, then record ผลการแก้ตัว for 0 / ร / มส and
// activity มผ. The original grade stays; the remedial result is what counts in GPA and ปพ.6.
import { useMemo, useState } from 'react';
import SmartSchoolLayout from '../components/SmartSchoolLayout';
import TeacherLoginGate from '../components/TeacherLoginGate';
import { canManageStaffUsers, useTeacherAuth } from '../utils/teacherAuth';
import { useAcademicData } from '../utils/academicStorage';
import { useGradingStatus } from '../utils/assessmentStorage';
import { needsRemedial, remedialGradeOptions, type RemedialType } from '../utils/assessment';
import { todayIso, thaiDateLong } from '../utils/dates';

export default function RemedialPage() {
  const auth = useTeacherAuth();
  if (!auth.authed) return <TeacherLoginGate title="บันทึกผลการแก้ตัว" subtitle="งานทะเบียน / วัดผล" />;
  return <Remedial userName={auth.name} isRegistrar={canManageStaffUsers(auth.role)} />;
}

function Remedial({ userName, isRegistrar }: { userName: string; isRegistrar: boolean }) {
  const { classesData, updateStudentScore, updateStudentActivities } = useAcademicData();
  const { status, setEntryOpen } = useGradingStatus();
  const [classFilter, setClassFilter] = useState('all');
  const canEdit = isRegistrar && !status.entryOpen;

  const gradeCases = useMemo(() => classesData.flatMap(cls => cls.students.flatMap(st => cls.subjects
    .filter(subj => needsRemedial(st.scores[subj.code]?.grade))
    .map(subj => ({ cls, st, subj, sc: st.scores[subj.code]! })))), [classesData]);

  const activityCases = useMemo(() => classesData.flatMap(cls => cls.students.flatMap(st => cls.activities
    .filter(a => st.activities?.[a.code] === 'มผ')
    .map(a => ({ cls, st, activity: a })))), [classesData]);

  const shown = gradeCases.filter(c => classFilter === 'all' || c.cls.classId === classFilter);
  const shownActivities = activityCases.filter(c => classFilter === 'all' || c.cls.classId === classFilter);
  const pending = gradeCases.filter(c => !c.sc.remedial).length;

  const toggleEntry = async () => {
    const next = !status.entryOpen;
    const msg = next
      ? 'เปิดการบันทึกผลการเรียน? ครูผู้สอนจะแก้คะแนนได้อีกครั้ง'
      : 'ปิดการบันทึกผลการเรียน? ครูผู้สอนจะแก้คะแนนไม่ได้ และงานทะเบียนบันทึกผลการแก้ตัวได้';
    if (window.confirm(msg)) await setEntryOpen(next, userName);
  };

  return (
    <SmartSchoolLayout pageTitle="บันทึกผลการแก้ตัว">
      <section style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <h2 style={h2}>การบันทึกผลการเรียน: {status.entryOpen ? 'เปิด' : 'ปิด'}</h2>
            <p style={muted}>
              {status.entryOpen
                ? 'ครูผู้สอนกรอกและแก้คะแนนได้ · ปิดการบันทึกก่อน จึงบันทึกผลการแก้ตัวได้ (ตามขั้นตอน SGS)'
                : 'ครูผู้สอนแก้คะแนนไม่ได้ · งานทะเบียนบันทึกผลการแก้ตัวได้'}
              {status.updatedBy && ` · ล่าสุดโดย ${status.updatedBy}${status.updatedAt ? ` ${thaiDateLong(new Date(status.updatedAt).toISOString().slice(0, 10))}` : ''}`}
            </p>
          </div>
          {isRegistrar ? (
            <button type="button" onClick={toggleEntry} style={{ ...btn, background: status.entryOpen ? '#B91C1C' : '#047857' }}>
              {status.entryOpen ? 'ปิดการบันทึกผลการเรียน' : 'เปิดการบันทึกผลการเรียน'}
            </button>
          ) : (
            <span style={muted}>เฉพาะงานทะเบียน (ผู้ดูแลระบบ) เปิด/ปิดได้</span>
          )}
        </div>
      </section>

      <section style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
          <h2 style={{ ...h2, flex: 1 }}>นักเรียนที่ได้ 0 / ร / มส ({gradeCases.length} รายการ · ยังไม่แก้ {pending})</h2>
          <select value={classFilter} onChange={e => setClassFilter(e.target.value)} style={input} aria-label="เลือกชั้น">
            <option value="all">ทุกชั้น</option>
            {classesData.map(c => <option key={c.classId} value={c.classId}>{c.shortName}</option>)}
          </select>
        </div>
        <p style={muted}>เกณฑ์: 0 และ มส แก้ตัวได้ไม่เกิน 1 · ร ได้ผลตามงานที่ส่ง (0-4) · เรียนซ้ำได้ผลตามปกติ (0-4) · ประถมตัดเกรดเมื่อครบ 2 ภาค</p>
        {shown.length === 0 ? (
          <div style={{ padding: '1.5rem', textAlign: 'center', color: '#475569' }}>ไม่มีนักเรียนที่ต้องแก้ตัว</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={table}>
              <thead><tr style={{ background: '#F1F5F9' }}>
                <th style={th}>ชั้น</th><th style={th}>เลขที่</th><th style={{ ...th, textAlign: 'left' }}>ชื่อ-สกุล</th>
                <th style={{ ...th, textAlign: 'left' }}>รายวิชา</th><th style={th}>ผลเดิม</th><th style={th}>ผลการแก้ตัว</th><th style={th}>บันทึกเมื่อ</th>
              </tr></thead>
              <tbody>
                {shown.map(({ cls, st, subj, sc }) => (
                  <RemedialRow key={`${cls.classId}-${st.code}-${subj.code}`}
                    classLabel={cls.shortName} no={st.no} name={st.name} subject={`${subj.code} ${subj.name}`}
                    original={sc.grade} remedial={sc.remedial} canEdit={canEdit}
                    onSave={(grade, type) => updateStudentScore(cls.classId, st.code, subj.code, { remedial: { grade, type, date: todayIso(), by: userName } })}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section style={card}>
        <h2 style={h2}>กิจกรรมพัฒนาผู้เรียนที่ไม่ผ่าน (มผ) ({activityCases.length})</h2>
        {shownActivities.length === 0 ? (
          <div style={{ padding: '1rem', textAlign: 'center', color: '#475569' }}>ไม่มี</div>
        ) : (
          <table style={table}>
            <thead><tr style={{ background: '#F1F5F9' }}>
              <th style={th}>ชั้น</th><th style={{ ...th, textAlign: 'left' }}>ชื่อ-สกุล</th><th style={{ ...th, textAlign: 'left' }}>กิจกรรม</th><th style={th}>แก้เป็น</th>
            </tr></thead>
            <tbody>
              {shownActivities.map(({ cls, st, activity }) => (
                <tr key={`${cls.classId}-${st.code}-${activity.code}`} style={{ borderBottom: '1px solid #E2E8F0' }}>
                  <td style={td}>{cls.shortName}</td>
                  <td style={{ ...td, textAlign: 'left' }}>{st.name}</td>
                  <td style={{ ...td, textAlign: 'left' }}>{activity.name}</td>
                  <td style={td}>
                    <button type="button" disabled={!canEdit} style={{ ...btn, padding: '5px 12px', background: canEdit ? '#047857' : '#94A3B8' }}
                      onClick={() => updateStudentActivities(cls.classId, st.code, { ...(st.activities || {}), [activity.code]: 'ผ' })}>
                      ผ่านหลังแก้ตัว (ผ)
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </SmartSchoolLayout>
  );
}

function RemedialRow({ classLabel, no, name, subject, original, remedial, canEdit, onSave }: {
  classLabel: string; no: number; name: string; subject: string; original: string;
  remedial?: { grade: string; type: RemedialType; date: string; by: string };
  canEdit: boolean;
  onSave: (grade: string, type: RemedialType) => void;
}) {
  const [type, setType] = useState<RemedialType>(remedial?.type || 'แก้ตัว');
  const options = remedialGradeOptions(original, type);
  return (
    <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
      <td style={td}>{classLabel}</td>
      <td style={td}>{no}</td>
      <td style={{ ...td, textAlign: 'left' }}>{name}</td>
      <td style={{ ...td, textAlign: 'left' }}>{subject}</td>
      <td style={{ ...td, fontWeight: 900, color: '#B91C1C' }}>{original}</td>
      <td style={td}>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
          <select value={type} onChange={e => setType(e.target.value as RemedialType)} disabled={!canEdit} style={input} aria-label={`${name} ประเภท`}>
            <option value="แก้ตัว">แก้ตัว</option>
            <option value="เรียนซ้ำ">เรียนซ้ำ</option>
          </select>
          <select value={remedial?.type === type ? remedial.grade : ''} disabled={!canEdit} style={{ ...input, fontWeight: 900 }} aria-label={`${name} ผลการแก้ตัว`}
            onChange={e => e.target.value && onSave(e.target.value, type)}>
            <option value="">เลือกผล</option>
            {options.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
      </td>
      <td style={{ ...td, fontSize: '0.8rem', color: '#475569' }}>{remedial ? `${thaiDateLong(remedial.date)} · ${remedial.by}` : '-'}</td>
    </tr>
  );
}

const card: React.CSSProperties = { background: 'white', borderRadius: 12, padding: '14px 16px', marginBottom: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' };
const h2: React.CSSProperties = { fontSize: '1.05rem', fontWeight: 900, color: '#0F172A', margin: 0 };
const muted: React.CSSProperties = { fontSize: '0.85rem', color: '#475569', margin: '4px 0 8px' };
const btn: React.CSSProperties = { color: 'white', border: 'none', borderRadius: 10, padding: '9px 16px', fontWeight: 800, cursor: 'pointer' };
const input: React.CSSProperties = { padding: '6px 8px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.88rem' };
const table: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' };
const th: React.CSSProperties = { padding: '8px 10px', fontWeight: 800, textAlign: 'center', fontSize: '0.82rem' };
const td: React.CSSProperties = { padding: '7px 10px', textAlign: 'center' };
