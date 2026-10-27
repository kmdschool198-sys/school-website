import { useState, useMemo } from 'react';
import { Printer, Search, Eye, FileText, ArrowLeft, Edit3, Check, RotateCcw } from 'lucide-react';
import SmartSchoolLayout from '../components/SmartSchoolLayout';
import TeacherLoginGate from '../components/TeacherLoginGate';
import { useTeacherAuth } from '../utils/teacherAuth';
import { useAcademicData } from '../utils/academicStorage';
import {
  calculateStudentGPA,
  calculateClassRanks,
  type ClassAcademicData,
  type AcademicStudentRecord,
} from '../data/academicData';

type PrintMode = 'none' | 'single' | 'batch';
type FormTemplate = 'smartschool' | 'kmd_excel' | 'elective';

export default function PorPor6Page() {
  const auth = useTeacherAuth();
  if (!auth.authed) {
    return <TeacherLoginGate title="📄 ระบบพิมพ์ ปพ.6 (ครูประจำชั้น)" subtitle="สมุดรายงานผลการพัฒนาคุณภาพผู้เรียนรายบุคคล" />;
  }
  return <PorPor6Content />;
}

function PorPor6Content() {
  const { classesData, updateStudentScore, updateStudentEvaluation, resetToDefault } = useAcademicData();
  const [selectedClassId, setSelectedClassId] = useState<string>('m1');
  const [semesterLabel, setSemesterLabel] = useState<string>('เทอม 1/2569 (ปัจจุบัน)');
  const [search, setSearch] = useState<string>('');
  const [rowsLimit, setRowsLimit] = useState<number>(50);

  // Modal / Print states
  const [inspectStudentCode, setInspectStudentCode] = useState<string | null>(null);
  const [printMode, setPrintMode] = useState<PrintMode>('none');
  const [printStudentCode, setPrintStudentCode] = useState<string | null>(null);
  const [formTemplate, setFormTemplate] = useState<FormTemplate>('smartschool');

  const currentClass = useMemo(
    () => classesData.find(c => c.classId === selectedClassId) || classesData[0],
    [classesData, selectedClassId]
  );

  const ranksMap = useMemo(
    () => calculateClassRanks(currentClass.students, currentClass.subjects),
    [currentClass]
  );

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = currentClass.students.filter(
      st => !q || st.name.toLowerCase().includes(q) || st.code.toLowerCase().includes(q)
    );
    return list.slice(0, rowsLimit);
  }, [currentClass.students, search, rowsLimit]);

  const inspectStudent = useMemo(
    () => currentClass.students.find(s => s.code === inspectStudentCode) || null,
    [currentClass.students, inspectStudentCode]
  );

  const triggerSinglePrint = (code: string) => {
    setPrintStudentCode(code);
    setPrintMode('single');
    setTimeout(() => window.print(), 250);
  };

  const triggerBatchPrint = () => {
    setPrintStudentCode(null);
    setPrintMode('batch');
    setTimeout(() => window.print(), 300);
  };

  // Dedicated Print View (Single or Batch)
  if (printMode !== 'none') {
    const targetStudents = printMode === 'batch'
      ? currentClass.students
      : currentClass.students.filter(s => s.code === printStudentCode);

    return (
      <div style={{ minHeight: '100vh', background: '#CBD5E1', paddingBottom: 40 }}>
        {/* Top Action Bar (hidden when printing) */}
        <div
          className="no-print"
          style={{
            position: 'sticky', top: 0, zIndex: 50,
            background: '#0F172A', color: 'white',
            padding: '12px 20px',
            display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
            boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
          }}
        >
          <button
            type="button"
            onClick={() => setPrintMode('none')}
            style={{
              background: 'rgba(255,255,255,0.12)', color: 'white',
              border: '1px solid rgba(255,255,255,0.25)', borderRadius: 8,
              padding: '8px 14px', fontWeight: 800, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.84rem',
            }}
          >
            <ArrowLeft size={16} /> กลับหน้ารายชื่อห้อง
          </button>

          {/* Form Template Switcher */}
          <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.08)', padding: 4, borderRadius: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setFormTemplate('smartschool')}
              style={{
                padding: '6px 12px', borderRadius: 7, border: 'none', cursor: 'pointer',
                fontWeight: 800, fontSize: '0.78rem',
                background: formTemplate === 'smartschool' ? '#FF6A01' : 'transparent',
                color: 'white',
              }}
            >
              🏛️ ฟอร์ม ปพ.6 มาตรฐาน (ครบทุกช่อง 70/30/100)
            </button>
            <button
              type="button"
              onClick={() => setFormTemplate('kmd_excel')}
              style={{
                padding: '6px 12px', borderRadius: 7, border: 'none', cursor: 'pointer',
                fontWeight: 800, fontSize: '0.78rem',
                background: formTemplate === 'kmd_excel' ? '#FF6A01' : 'transparent',
                color: 'white',
              }}
            >
              📋 ฟอร์ม ปพ.6 โรงเรียนบ้านคลองมดแดง (ตามไฟล์ Excel)
            </button>
            <button
              type="button"
              onClick={() => setFormTemplate('elective')}
              style={{
                padding: '6px 12px', borderRadius: 7, border: 'none', cursor: 'pointer',
                fontWeight: 800, fontSize: '0.78rem',
                background: formTemplate === 'elective' ? '#FF6A01' : 'transparent',
                color: 'white',
              }}
            >
              📑 ฟอร์มรายงานวิชาเพิ่มเติม/นอกหลักสูตร
            </button>
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '0.82rem', color: '#CBD5E1', fontWeight: 700 }}>
              {printMode === 'batch'
                ? `พิมพ์ทั้งห้อง ${currentClass.shortName}/1 (${targetStudents.length} แผ่น)`
                : `นักเรียน: ${targetStudents[0]?.name || ''}`}
            </span>
            <button
              type="button"
              onClick={() => window.print()}
              style={{
                background: '#DC2626', color: 'white', border: 'none', borderRadius: 8,
                padding: '9px 18px', fontWeight: 900, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: '0.88rem',
                boxShadow: '0 4px 12px rgba(220,38,38,0.45)',
              }}
            >
              <Printer size={16} /> สั่งพิมพ์ฟอร์ม ปพ.6 ({targetStudents.length} แผ่น)
            </button>
          </div>
        </div>

        {/* Printable A4 Pages */}
        <div className="porpor6-print-container" style={{ maxWidth: '210mm', margin: '20px auto', padding: '0 8px' }}>
          {targetStudents.map((st, idx) =>
            formTemplate === 'kmd_excel' ? (
              <KmdExcelPorPor6Form
                key={st.code}
                classData={currentClass}
                student={st}
                rankInfo={ranksMap[st.code] || { rank: idx + 1, total: currentClass.students.length, gpa: 0 }}
                isLast={idx === targetStudents.length - 1}
              />
            ) : (
              <OfficialPorPor6Form
                key={st.code}
                classData={currentClass}
                student={st}
                rankInfo={ranksMap[st.code] || { rank: idx + 1, total: currentClass.students.length, gpa: 0 }}
                variant={formTemplate === 'elective' ? 'elective' : 'core'}
                isLast={idx === targetStudents.length - 1}
              />
            )
          )}
        </div>

        <style>{PRINT_STYLES}</style>
      </div>
    );
  }

  return (
    <SmartSchoolLayout pageTitle="ระบบบริหารจัดการโรงเรียน">
      {/* Screen UI (hidden when Ctrl+P is pressed so only the official PorPor 6 forms print!) */}
      <div className="no-print">
        {/* Page Title Banner */}
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 900, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
              📄 พิมพ์ ปพ.6 (ครูประจำชั้น)
            </h1>
            <div style={{ fontSize: '0.84rem', color: '#64748B', marginTop: 2 }}>
              สำหรับครูประจำชั้น ใช้ตรวจสอบผลการเรียนและสั่งพิมพ์แบบฟอร์ม ปพ.6 ทางการแจกนักเรียนและผู้ปกครอง
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (window.confirm('ต้องการรีเซ็ตข้อมูลคะแนนกลับเป็นค่าเริ่มต้นจากไฟล์งานวัดผลหรือไม่?')) {
                resetToDefault();
              }
            }}
            style={{
              background: '#FFFFFF', color: '#475569', border: '1px solid #CBD5E1',
              borderRadius: 8, padding: '7px 12px', fontSize: '0.78rem', fontWeight: 700,
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            <RotateCcw size={14} /> รีเซ็ตข้อมูลเริ่มต้น
          </button>
        </div>

        {/* Filter Box (matching Screenshot 3) */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: 14,
          padding: '18px 22px',
          marginBottom: 20,
          border: '1px solid #E2E8F0',
          boxShadow: '0 2px 10px rgba(15,23,42,0.03)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 18,
        }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, color: '#334155', marginBottom: 6 }}>
              📅 ปีการศึกษา / ภาคเรียน
            </label>
            <select
              value={semesterLabel}
              onChange={e => setSemesterLabel(e.target.value)}
              style={selectStyle}
            >
              <option value="เทอม 1/2569 (ปัจจุบัน)">เทอม 1/2569 (ปัจจุบัน)</option>
              <option value="เทอม 2/2569">เทอม 2/2569</option>
              <option value="ตลอดปีการศึกษา 2569">ตลอดปีการศึกษา 2569</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, color: '#334155', marginBottom: 6 }}>
              🏫 เลือกห้องเรียน
            </label>
            <select
              value={selectedClassId}
              onChange={e => setSelectedClassId(e.target.value)}
              style={selectStyle}
            >
              {classesData.map(c => (
                <option key={c.classId} value={c.classId}>
                  ชั้น{c.className} ({c.shortName}/1) — {c.students.length} คน
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Student List Table Card (matching Screenshot 3) */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: 16,
          border: '1px solid #E2E8F0',
          boxShadow: '0 4px 16px rgba(15,23,42,0.04)',
          overflow: 'hidden',
        }}>
          {/* Card Header */}
          <div style={{
            padding: '18px 22px',
            borderBottom: '1px solid #F1F5F9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}>
            <div>
              <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#EF4444' }}>👥</span> รายชื่อนักเรียนในห้อง ({currentClass.shortName}/1)
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: 3 }}>
                ครูประจำชั้น: <b>{currentClass.homeroomTeachers.join(', ')}</b> · ผู้อำนวยการ: <b>{currentClass.director}</b>
              </div>
            </div>

            <button
              type="button"
              onClick={triggerBatchPrint}
              style={{
                background: '#DC2626',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 999,
                padding: '10px 20px',
                fontWeight: 900,
                fontSize: '0.88rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 4px 14px rgba(220,38,38,0.3)',
              }}
            >
              <Printer size={16} /> พิมพ์ทั้งห้อง (Batch Print)
            </button>
          </div>

          {/* Table Controls */}
          <div style={{
            padding: '12px 22px',
            background: '#F8FAFC',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
            fontSize: '0.82rem',
            color: '#475569',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              แสดง
              <select
                value={rowsLimit}
                onChange={e => setRowsLimit(Number(e.target.value))}
                style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #CBD5E1', fontWeight: 700 }}
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              แถว
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>ค้นหาชื่อ/รหัส:</span>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: 9, color: '#94A3B8' }} />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="พิมพ์ชื่อ หรือรหัสประจำตัว..."
                  style={{
                    padding: '6px 12px 6px 30px',
                    borderRadius: 8,
                    border: '1px solid #CBD5E1',
                    fontSize: '0.82rem',
                    width: 220,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Student Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0', color: '#334155' }}>
                  <th style={{ ...thStyle, width: 70, textAlign: 'center' }}>เลขที่</th>
                  <th style={{ ...thStyle, width: 120, textAlign: 'center' }}>รหัสนักเรียน</th>
                  <th style={{ ...thStyle, textAlign: 'left' }}>ชื่อ-นามสกุล</th>
                  <th style={{ ...thStyle, width: 110, textAlign: 'center' }}>หน่วยกิตที่ได้</th>
                  <th style={{ ...thStyle, width: 110, textAlign: 'center' }}>GPA</th>
                  <th style={{ ...thStyle, width: 110, textAlign: 'center' }}>ลำดับที่</th>
                  <th style={{ ...thStyle, width: 190, textAlign: 'center' }}>ดูข้อมูล/ตรวจสอบเกรด</th>
                  <th style={{ ...thStyle, width: 160, textAlign: 'center' }}>พิมพ์ ปพ.6</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map(st => {
                  const gpaInfo = calculateStudentGPA(st, currentClass.subjects, true);
                  const rInfo = ranksMap[st.code];
                  return (
                    <tr
                      key={st.code}
                      style={{ borderBottom: '1px solid #F1F5F9', transition: 'background 0.12s' }}
                      onMouseOver={e => (e.currentTarget.style.background = '#F8FAFC')}
                      onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 800, color: '#0F172A' }}>
                        {st.no}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 700, color: '#475569' }}>
                        {st.code}
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 800, color: '#1E293B' }}>
                        {st.name}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center', color: '#475569', fontWeight: 700 }}>
                        {gpaInfo.earnedCredits.toFixed(1)} / {gpaInfo.totalCredits.toFixed(1)}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '3px 10px',
                          borderRadius: 999,
                          fontWeight: 900,
                          fontSize: '0.84rem',
                          background: gpaInfo.gpa >= 3.5 ? '#DCFCE7' : gpaInfo.gpa >= 2.5 ? '#DBEAFE' : '#FEF3C7',
                          color: gpaInfo.gpa >= 3.5 ? '#15803D' : gpaInfo.gpa >= 2.5 ? '#1D4ED8' : '#B45309',
                        }}>
                          {gpaInfo.gpaFormatted}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 800, color: '#334155' }}>
                        {rInfo ? `${rInfo.rank} / ${rInfo.total}` : '-'}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => setInspectStudentCode(st.code)}
                          style={{
                            background: '#FFFFFF',
                            color: '#0284C7',
                            border: '1.5px solid #38BDF8',
                            borderRadius: 999,
                            padding: '6px 14px',
                            fontWeight: 800,
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                          }}
                        >
                          <Eye size={14} /> ดูข้อมูล/เกรด
                        </button>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => triggerSinglePrint(st.code)}
                          style={{
                            background: '#DC2626',
                            color: '#FFFFFF',
                            border: 'none',
                            borderRadius: 999,
                            padding: '6px 16px',
                            fontWeight: 800,
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            boxShadow: '0 2px 8px rgba(220,38,38,0.25)',
                          }}
                        >
                          <FileText size={14} /> พิมพ์ ปพ.6
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Print-Only Fallback: if user presses Ctrl+P directly on the list page, print all official PorPor 6 forms! */}
      <div className="only-print-batch">
        {currentClass.students.map((st, idx) => (
          <OfficialPorPor6Form
            key={st.code}
            classData={currentClass}
            student={st}
            rankInfo={ranksMap[st.code] || { rank: idx + 1, total: currentClass.students.length, gpa: 0 }}
            variant="core"
            isLast={idx === currentClass.students.length - 1}
          />
        ))}
      </div>

      {/* Modal: ดูข้อมูล/ตรวจสอบและแก้ไขเกรดรายบุคคล */}
      {inspectStudent && (
        <StudentGradeInspectModal
          classData={currentClass}
          student={inspectStudent}
          rankInfo={ranksMap[inspectStudent.code]}
          onClose={() => setInspectStudentCode(null)}
          onPrint={() => {
            const c = inspectStudent.code;
            setInspectStudentCode(null);
            triggerSinglePrint(c);
          }}
          onUpdateScore={(subjCode, cw, fin, spec, tr, rt, hrs) =>
            updateStudentScore(currentClass.classId, inspectStudent.code, subjCode, cw, fin, spec, tr, rt, hrs)
          }
          onUpdateEval={(tr, rt, act) =>
            updateStudentEvaluation(currentClass.classId, inspectStudent.code, tr, rt, act)
          }
        />
      )}

      <style>{PRINT_STYLES}</style>
    </SmartSchoolLayout>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// FORM TEMPLATE 1 & 3: แบบฟอร์ม ปพ.6 มาตรฐาน สพฐ. / SmartSchool (ตามภาพตัวอย่างที่ 4 & 5 เป๊ะ 100%)
// ════════════════════════════════════════════════════════════════════════════
export function OfficialPorPor6Form({
  classData,
  student,
  rankInfo,
  variant,
  isLast,
}: {
  classData: ClassAcademicData;
  student: AcademicStudentRecord;
  rankInfo: { rank: number; total: number; gpa: number };
  variant: 'core' | 'elective';
  isLast: boolean;
}) {
  const subjectsToShow = useMemo(() => {
    if (variant === 'elective') {
      return classData.subjects.filter(
        s => s.type === 'เพิ่มเติม' || ['ว21103', 'ว21104', 'ว22103', 'ว22104', 'ว23103', 'ว23104'].includes(s.code)
      );
    }
    return classData.subjects.filter(
      s => !['ว21103', 'ว21104', 'ว22103', 'ว22104', 'ว23103', 'ว23104'].includes(s.code)
    );
  }, [classData.subjects, variant]);

  const gpaStats = useMemo(
    () => calculateStudentGPA(student, subjectsToShow, false),
    [student, subjectsToShow]
  );

  return (
    <div
      className={`porpor6-sheet ${!isLast ? 'porpor6-page-break' : ''}`}
      style={{
        background: '#FFFFFF',
        padding: '14mm 15mm',
        marginBottom: 24,
        borderRadius: 4,
        boxShadow: '0 8px 30px rgba(15,23,42,0.15)',
        color: '#000000',
        fontFamily: '"Sarabun", "TH SarabunPSK", "TH Sarabun New", sans-serif',
        boxSizing: 'border-box',
      }}
    >
      {/* Top School Emblem & Official Header */}
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <img
          src={`${import.meta.env.BASE_URL}images/school-logo.png`}
          alt="ตราโรงเรียนบ้านคลองมดแดง"
          style={{ width: 52, height: 52, objectFit: 'contain', margin: '0 auto 4px', display: 'block' }}
        />
        <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#000', letterSpacing: 0.2 }}>
          {variant === 'core'
            ? 'แบบรายงานผลการพัฒนาคุณภาพผู้เรียนรายบุคคล (ปพ.6)'
            : 'แบบรายงานผลรายวิชาเพิ่มเติมและเทคโนโลยี (ปพ.6)'}
        </div>
        <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#000', marginTop: 2 }}>
          {classData.schoolName} สังกัด{classData.affiliation}
        </div>
        <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#000', marginTop: 1 }}>
          ชั้น{classData.className} ({classData.shortName}/{classData.room}) ภาคเรียนที่ {classData.semester} ปีการศึกษา {classData.year}
        </div>
      </div>

      {/* Student Identity Box */}
      <div style={{
        border: '1.5px solid #000',
        borderBottom: 'none',
        padding: '6px 12px',
        background: '#F8FAFC',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '0.85rem',
        fontWeight: 800,
      }}>
        <div>ชื่อ-นามสกุล: <span style={{ fontWeight: 900 }}>{student.name}</span></div>
        <div>เลขประจำตัวนักเรียน: <span style={{ fontWeight: 900 }}>{student.code}</span></div>
        <div>เลขที่: <span style={{ fontWeight: 900 }}>{student.no}</span></div>
      </div>

      {/* Main Official Grade Table */}
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        border: '1.5px solid #000',
        fontSize: '0.78rem',
      }}>
        <thead>
          <tr style={{ background: '#F8FAFC' }}>
            <th rowSpan={3} style={{ ...pTh, width: 62 }}>รหัสวิชา</th>
            <th rowSpan={3} style={{ ...pTh, textAlign: 'center' }}>รายวิชา</th>
            <th rowSpan={3} style={{ ...pTh, width: 56 }}>ประเภท</th>
            <th colSpan={3} style={pTh}>น้ำหนัก</th>
            <th colSpan={3} style={pTh}>คะแนน</th>
            <th rowSpan={2} style={{ ...pTh, width: 52 }}>ระดับผล<br />การเรียน</th>
            <th rowSpan={2} style={{ ...pTh, width: 74 }}>คุณลักษณะ<br />อันพึงประสงค์</th>
            <th rowSpan={2} style={{ ...pTh, width: 84 }}>อ่าน คิด วิเคราะห์<br />และเขียนสื่อความ</th>
          </tr>
          <tr style={{ background: '#F8FAFC' }}>
            <th rowSpan={2} style={{ ...pTh, width: 46 }}>หน่วยกิต</th>
            <th colSpan={2} style={pTh}>เวลาเรียน</th>
            <th style={{ ...pTh, width: 48 }}>ระหว่าง<br />ภาค</th>
            <th style={{ ...pTh, width: 40 }}>สอบ</th>
            <th style={{ ...pTh, width: 42 }}>รวม</th>
          </tr>
          <tr style={{ background: '#F8FAFC' }}>
            <th style={{ ...pTh, width: 34 }}>เต็ม</th>
            <th style={{ ...pTh, width: 34 }}>มา</th>
            <th style={pTh}>70</th>
            <th style={pTh}>30</th>
            <th style={pTh}>100</th>
            <th style={pTh}>4</th>
            <th style={pTh}>0, 1, 2, 3</th>
            <th style={pTh}>0, 1, 2, 3</th>
          </tr>
        </thead>
        <tbody>
          {subjectsToShow.map(subj => {
            const sc = student.scores[subj.code] || {
              coursework: 50, finalExam: 20, total: 70, grade: '3',
              attendedHours: subj.hours, traitScore: 3, readThinkScore: 3,
            };
            return (
              <tr key={subj.code}>
                <td style={{ ...pTd, textAlign: 'center' }}>{subj.code}</td>
                <td style={{ ...pTd, textAlign: 'left', paddingLeft: 6 }}>{subj.name}</td>
                <td style={{ ...pTd, textAlign: 'center' }}>{subj.type}</td>
                <td style={{ ...pTd, textAlign: 'center' }}>{subj.credits.toFixed(1)}</td>
                <td style={{ ...pTd, textAlign: 'center' }}>{subj.hours}</td>
                <td style={{ ...pTd, textAlign: 'center' }}>{sc.attendedHours}</td>
                <td style={{ ...pTd, textAlign: 'center' }}>{sc.coursework}</td>
                <td style={{ ...pTd, textAlign: 'center' }}>{sc.finalExam}</td>
                <td style={{ ...pTd, textAlign: 'center', fontWeight: 700 }}>{sc.total}</td>
                <td style={{ ...pTd, textAlign: 'center', fontWeight: 900 }}>{sc.grade}</td>
                <td style={{ ...pTd, textAlign: 'center' }}>{sc.traitScore}</td>
                <td style={{ ...pTd, textAlign: 'center' }}>{sc.readThinkScore}</td>
              </tr>
            );
          })}

          {variant === 'core' && (
            <tr>
              <td style={{ ...pTd, textAlign: 'center' }}>
                {classData.level === 'มัธยม' ? 'ก21101' : 'ก11101'}
              </td>
              <td style={{ ...pTd, textAlign: 'left', paddingLeft: 6 }}>
                กิจกรรมแนะแนว / ลูกเสือ-เนตรนารี / ชุมนุม / เพื่อสังคมฯ
              </td>
              <td style={{ ...pTd, textAlign: 'center' }}>กิจกรรม</td>
              <td style={{ ...pTd, textAlign: 'center' }}>-</td>
              <td style={{ ...pTd, textAlign: 'center' }}>60</td>
              <td style={{ ...pTd, textAlign: 'center' }}>60</td>
              <td style={{ ...pTd, textAlign: 'center' }}>-</td>
              <td style={{ ...pTd, textAlign: 'center' }}>-</td>
              <td style={{ ...pTd, textAlign: 'center' }}>-</td>
              <td style={{ ...pTd, textAlign: 'center', fontWeight: 900 }}>
                {student.activityResult === 'ผ่าน' ? 'ผ' : 'มผ'}
              </td>
              <td style={{ ...pTd, textAlign: 'center' }}>-</td>
              <td style={{ ...pTd, textAlign: 'center' }}>-</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Bottom Summary & Signature Box (matching Screenshot 4 & 5) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '44% 56%',
        borderLeft: '1.5px solid #000',
        borderRight: '1.5px solid #000',
        borderBottom: '1.5px solid #000',
        fontSize: '0.78rem',
      }}>
        {/* Left Evaluation Summary Table */}
        <div style={{ borderRight: '1.5px solid #000' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', height: '100%' }}>
            <thead>
              <tr style={{ background: '#F8FAFC' }}>
                <th rowSpan={2} style={{ ...pSubTh, textAlign: 'left', paddingLeft: 8 }}>รายการประเมิน</th>
                <th colSpan={2} style={pSubTh}>ผลการประเมิน</th>
              </tr>
              <tr style={{ background: '#F8FAFC' }}>
                <th style={{ ...pSubTh, width: 54 }}>เต็ม</th>
                <th style={{ ...pSubTh, width: 54 }}>ได้</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={pSubTd}>จำนวนหน่วยกิตที่เรียน</td>
                <td style={{ ...pSubTd, textAlign: 'center' }}>{gpaStats.totalCredits.toFixed(1)}</td>
                <td style={{ ...pSubTd, textAlign: 'center', fontWeight: 800 }}>{gpaStats.earnedCredits.toFixed(1)}</td>
              </tr>
              <tr>
                <td style={pSubTd}>ระดับผลการเรียนเฉลี่ย (GPA)</td>
                <td colSpan={2} style={{ ...pSubTd, textAlign: 'center', fontWeight: 900, fontSize: '0.88rem' }}>
                  {gpaStats.gpaFormatted}
                </td>
              </tr>
              <tr>
                <td style={pSubTd}>ลำดับที่ในห้องเรียน</td>
                <td colSpan={2} style={{ ...pSubTd, textAlign: 'center', fontWeight: 800 }}>
                  {rankInfo.rank} / {rankInfo.total}
                </td>
              </tr>
              <tr>
                <td style={pSubTd}>ลำดับที่ในระดับชั้นเรียน</td>
                <td colSpan={2} style={{ ...pSubTd, textAlign: 'center', fontWeight: 800 }}>
                  {rankInfo.rank} / {rankInfo.total}
                </td>
              </tr>
              <tr>
                <td style={pSubTd}>คุณลักษณะอันพึงประสงค์</td>
                <td colSpan={2} style={{ ...pSubTd, textAlign: 'center', fontWeight: 900 }}>
                  {student.traitResult}
                </td>
              </tr>
              <tr>
                <td style={pSubTd}>การอ่าน คิดวิเคราะห์ และเขียนสื่อความ</td>
                <td colSpan={2} style={{ ...pSubTd, textAlign: 'center', fontWeight: 900 }}>
                  {student.readThinkResult}
                </td>
              </tr>
              <tr>
                <td style={pSubTd}>กิจกรรมพัฒนาผู้เรียน</td>
                <td colSpan={2} style={{ ...pSubTd, textAlign: 'center', fontWeight: 900 }}>
                  {student.activityResult}
                </td>
              </tr>
              <tr>
                <td style={{ ...pSubTd, borderBottom: 'none', fontSize: '0.7rem', color: '#334155' }}>
                  (ลำดับที่จัดอันดับจากผลการเรียนเฉลี่ย GPA)
                </td>
                <td colSpan={2} style={{ ...pSubTd, borderBottom: 'none' }}></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Right 3-Party Signature Section */}
        <div style={{
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          textAlign: 'center',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
            <div>
              <div style={{ marginBottom: 22, fontSize: '0.76rem' }}>ลงชื่อ ....................................................</div>
              <div style={{ fontWeight: 800, fontSize: '0.76rem' }}>
                ({classData.homeroomTeachers[0] || 'ครูประจำชั้น'})
              </div>
              {classData.homeroomTeachers[1] && (
                <div style={{ fontWeight: 800, fontSize: '0.74rem', marginTop: 1 }}>
                  ({classData.homeroomTeachers[1]})
                </div>
              )}
              <div style={{ fontSize: '0.74rem', marginTop: 2 }}>ครูประจำชั้น</div>
            </div>

            <div>
              <div style={{ marginBottom: 22, fontSize: '0.76rem' }}>ลงชื่อ ....................................................</div>
              <div style={{ fontWeight: 800, fontSize: '0.76rem' }}>
                ({classData.director})
              </div>
              <div style={{ fontSize: '0.74rem', marginTop: 2 }}>ผู้อำนวยการโรงเรียน</div>
            </div>
          </div>

          <div style={{ marginTop: 18, marginBottom: 4 }}>
            <div style={{ fontSize: '0.76rem', marginBottom: 6 }}>
              ลงชื่อ ........................................................................... ผู้ปกครองนักเรียน
            </div>
            <div style={{ fontSize: '0.76rem', marginBottom: 6 }}>
              (...........................................................................)
            </div>
            <div style={{ fontSize: '0.74rem' }}>
              วันที่ ........ เดือน ............................... พ.ศ. ............
            </div>
          </div>
        </div>
      </div>

      <div style={{ textAlign: 'right', fontSize: '0.68rem', color: '#334155', marginTop: 4 }}>
        แบบรายงานผลการพัฒนาคุณภาพผู้เรียนรายบุคคล (ปพ.6) · {classData.schoolName}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// FORM TEMPLATE 2: ฟอร์ม ปพ.6 ฉบับไฟล์ Excel โรงเรียนบ้านคลองมดแดง (ปพ.6_ม.1.xlsx ชีต รายงาน ปพ.6)
// ════════════════════════════════════════════════════════════════════════════
function KmdExcelPorPor6Form({
  classData,
  student,
  isLast,
}: {
  classData: ClassAcademicData;
  student: AcademicStudentRecord;
  rankInfo: { rank: number; total: number; gpa: number };
  isLast: boolean;
}) {
  const core12Subjects = useMemo(
    () => classData.subjects.filter(
      s => !['ว21103', 'ว21104', 'ว22103', 'ว22104', 'ว23103', 'ว23104'].includes(s.code)
    ),
    [classData.subjects]
  );

  const gpaStats = useMemo(
    () => calculateStudentGPA(student, core12Subjects, false),
    [student, core12Subjects]
  );

  const totalHours = useMemo(
    () => core12Subjects.reduce((acc, s) => acc + s.hours, 0),
    [core12Subjects]
  );

  return (
    <div
      className={`porpor6-sheet ${!isLast ? 'porpor6-page-break' : ''}`}
      style={{
        background: '#FFFFFF',
        padding: '15mm 18mm',
        marginBottom: 24,
        borderRadius: 4,
        boxShadow: '0 8px 30px rgba(15,23,42,0.15)',
        color: '#000000',
        fontFamily: '"Sarabun", "TH SarabunPSK", "TH Sarabun New", sans-serif',
      }}
    >
      {/* Header matching ปพ.6_ม.1.xlsx Rows 1-5 */}
      <div style={{ textAlign: 'center', marginBottom: 10, lineHeight: 1.45 }}>
        <img
          src={`${import.meta.env.BASE_URL}images/school-logo.png`}
          alt="ตราโรงเรียนบ้านคลองมดแดง"
          style={{ width: 52, height: 52, objectFit: 'contain', margin: '0 auto 4px', display: 'block' }}
        />
        <div style={{ fontSize: '1.15rem', fontWeight: 900 }}>แบบรายงานผลการพัฒนาคุณภาพผู้เรียนรายบุคคล</div>
        <div style={{ fontSize: '1rem', fontWeight: 800 }}>โรงเรียน{classData.schoolName.replace(/^โรงเรียน/, '')}</div>
        <div style={{ fontSize: '0.92rem', fontWeight: 700 }}>{classData.affiliation}</div>
        <div style={{ fontSize: '0.92rem', fontWeight: 800, marginTop: 2 }}>
          ชั้น{classData.className} &nbsp;&nbsp;&nbsp;&nbsp; ภาคเรียนที่ {classData.semester} &nbsp;&nbsp;&nbsp;&nbsp; ปีการศึกษา {classData.year}
        </div>
      </div>

      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '6px 4px', fontSize: '0.9rem', fontWeight: 800, marginBottom: 4,
      }}>
        <div>เลขประจำตัว &nbsp; <b>{student.code}</b></div>
        <div>ชื่อ-นามสกุล &nbsp; <b>{student.name}</b></div>
        <div>เลขที่ &nbsp; <b>{student.no}</b></div>
      </div>

      {/* Main 6-Column Table matching ปพ.6_ม.1.xlsx Rows 6-20 */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1.5px solid #000', fontSize: '0.84rem', marginBottom: 14 }}>
        <thead>
          <tr style={{ background: '#F8FAFC' }}>
            <th style={{ ...pTh, padding: '7px 8px' }}>ชื่อวิชา</th>
            <th style={{ ...pTh, width: 85 }}>ประเภท</th>
            <th style={{ ...pTh, width: 110 }}>จำนวนชั่วโมงเรียน</th>
            <th style={{ ...pTh, width: 80 }}>น้ำหนัก</th>
            <th style={{ ...pTh, width: 125 }}>คะแนนรวม (100 คะแนน)</th>
            <th style={{ ...pTh, width: 85 }}>ผลการเรียน</th>
          </tr>
        </thead>
        <tbody>
          {core12Subjects.map(subj => {
            const sc = student.scores[subj.code] || { total: 70, grade: '3' };
            return (
              <tr key={subj.code}>
                <td style={{ ...pTd, padding: '5px 10px', textAlign: 'left' }}>{subj.name.replace(/\s+\d+$/, '')}</td>
                <td style={{ ...pTd, textAlign: 'center' }}>{subj.type}</td>
                <td style={{ ...pTd, textAlign: 'center' }}>{subj.hours}</td>
                <td style={{ ...pTd, textAlign: 'center' }}>{subj.credits.toFixed(1)}</td>
                <td style={{ ...pTd, textAlign: 'center' }}>{sc.total}</td>
                <td style={{ ...pTd, textAlign: 'center', fontWeight: 900 }}>{sc.grade}</td>
              </tr>
            );
          })}
          {/* Row 20: ผลการเรียนเฉลี่ย */}
          <tr style={{ background: '#F8FAFC', fontWeight: 900 }}>
            <td colSpan={2} style={{ ...pTd, textAlign: 'center', padding: '6px' }}>ผลการเรียนเฉลี่ย</td>
            <td style={{ ...pTd, textAlign: 'center' }}>{totalHours}</td>
            <td style={{ ...pTd, textAlign: 'center' }}>{gpaStats.totalCredits.toFixed(1)}</td>
            <td style={{ ...pTd, textAlign: 'center' }}></td>
            <td style={{ ...pTd, textAlign: 'center', fontSize: '0.92rem' }}>{gpaStats.gpaFormatted}</td>
          </tr>
        </tbody>
      </table>

      {/* Bottom Summary & Signatures matching ปพ.6_ม.1.xlsx Rows 22-30 */}
      <div style={{ display: 'grid', gridTemplateColumns: '55% 45%', gap: 18, alignItems: 'start', fontSize: '0.84rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1.5px solid #000' }}>
          <thead>
            <tr style={{ background: '#F8FAFC' }}>
              <th rowSpan={2} style={{ ...pTh, textAlign: 'left', paddingLeft: 10 }}>สรุปผลการเรียนตลอดหลักสูตร</th>
              <th colSpan={2} style={pTh}>ผลการเรียน</th>
            </tr>
            <tr style={{ background: '#F8FAFC' }}>
              <th style={{ ...pTh, width: 65 }}>ที่เรียน</th>
              <th style={{ ...pTh, width: 65 }}>ที่ได้</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ ...pTd, padding: '5px 10px' }}>จำนวนหน่วยกิต/น้ำหนักวิชาพื้นฐาน</td>
              <td style={{ ...pTd, textAlign: 'center' }}>{gpaStats.coreCredits.toFixed(1)}</td>
              <td style={{ ...pTd, textAlign: 'center' }}>{gpaStats.coreCredits.toFixed(1)}</td>
            </tr>
            <tr>
              <td style={{ ...pTd, padding: '5px 10px' }}>จำนวนหน่วยกิต/น้ำหนักวิชาเพิ่มเติม</td>
              <td style={{ ...pTd, textAlign: 'center' }}>{gpaStats.electiveCredits.toFixed(1)}</td>
              <td style={{ ...pTd, textAlign: 'center' }}>{gpaStats.electiveCredits.toFixed(1)}</td>
            </tr>
            <tr style={{ fontWeight: 800 }}>
              <td style={{ ...pTd, padding: '5px 10px' }}>รวมจำนวนหน่วยกิต/น้ำหนัก</td>
              <td style={{ ...pTd, textAlign: 'center' }}>{gpaStats.totalCredits.toFixed(1)}</td>
              <td style={{ ...pTd, textAlign: 'center' }}>{gpaStats.earnedCredits.toFixed(1)}</td>
            </tr>
            <tr style={{ fontWeight: 900 }}>
              <td style={{ ...pTd, padding: '5px 10px' }}>ระดับผลการเรียนเฉลี่ย (GPA)</td>
              <td colSpan={2} style={{ ...pTd, textAlign: 'center', fontSize: '0.92rem' }}>{gpaStats.gpaFormatted}</td>
            </tr>
            <tr>
              <td style={{ ...pTd, padding: '5px 10px' }}>คุณลักษณะอันพึงประสงค์ของสถานศึกษา*</td>
              <td colSpan={2} style={{ ...pTd, textAlign: 'center', fontWeight: 800 }}>{student.traitResult}</td>
            </tr>
            <tr>
              <td style={{ ...pTd, padding: '5px 10px' }}>การอ่าน คิด วิเคราะห์และเขียน**</td>
              <td colSpan={2} style={{ ...pTd, textAlign: 'center', fontWeight: 800 }}>{student.readThinkResult}</td>
            </tr>
            <tr>
              <td style={{ ...pTd, padding: '5px 10px' }}>กิจกรรมพัฒนาผู้เรียน</td>
              <td colSpan={2} style={{ ...pTd, textAlign: 'center', fontWeight: 800 }}>{student.activityResult}</td>
            </tr>
          </tbody>
        </table>

        {/* Right Stacked Signatures matching Rows 22-30 */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 18, paddingTop: 6 }}>
          <div>
            <div>ลงชื่อ...................................................</div>
            <div style={{ fontWeight: 800, marginTop: 3 }}>( {classData.homeroomTeachers.join(', ')} )</div>
            <div style={{ fontSize: '0.8rem' }}>ครูประจำชั้น</div>
          </div>

          <div>
            <div>ลงชื่อ..................................................</div>
            <div style={{ fontWeight: 800, marginTop: 3 }}>( {classData.director} )</div>
            <div style={{ fontSize: '0.8rem' }}>ผู้อำนวยการโรงเรียน</div>
          </div>

          <div>
            <div>ลงชื่อ.................................................</div>
            <div style={{ marginTop: 3 }}>(.................................................)</div>
            <div style={{ fontSize: '0.8rem' }}>ผู้ปกครอง</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Modal to Inspect & Edit Student Grades
// ════════════════════════════════════════════════════════════════════════════
function StudentGradeInspectModal({
  classData,
  student,
  rankInfo,
  onClose,
  onPrint,
  onUpdateScore,
  onUpdateEval,
}: {
  classData: ClassAcademicData;
  student: AcademicStudentRecord;
  rankInfo?: { rank: number; total: number; gpa: number };
  onClose: () => void;
  onPrint: () => void;
  onUpdateScore: (
    subjectCode: string,
    coursework: number,
    finalExam: number,
    specialGrade?: string,
    traitScore?: number,
    readThinkScore?: number,
    attendedHours?: number
  ) => void;
  onUpdateEval: (
    traitResult: AcademicStudentRecord['traitResult'],
    readThinkResult: AcademicStudentRecord['readThinkResult'],
    activityResult: AcademicStudentRecord['activityResult']
  ) => void;
}) {
  const [editMode, setEditMode] = useState(false);
  const gpaInfo = calculateStudentGPA(student, classData.subjects, true);

  return (
    <div
      className="no-print"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)',
        backdropFilter: 'blur(4px)', zIndex: 999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, overflowY: 'auto',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#FFFFFF', borderRadius: 18, maxWidth: 960, width: '100%',
          maxHeight: '90vh', display: 'flex', flexDirection: 'column',
          boxShadow: '0 25px 60px rgba(0,0,0,0.3)', overflow: 'hidden',
        }}
      >
        <div style={{
          background: 'linear-gradient(135deg,#1E293B,#0F172A)', color: 'white',
          padding: '16px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <div>
            <div style={{ fontSize: '0.76rem', color: '#38BDF8', fontWeight: 800 }}>
              ตรวจสอบและแก้ไขผลการเรียนรายบุคคล (ปพ.6)
            </div>
            <div style={{ fontSize: '1.15rem', fontWeight: 900, marginTop: 2 }}>
              เลขที่ {student.no} · {student.name} (รหัส {student.code})
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => setEditMode(m => !m)}
              style={{
                background: editMode ? '#16A34A' : 'rgba(255,255,255,0.14)',
                color: 'white', border: 'none', borderRadius: 8, padding: '8px 14px',
                fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              {editMode ? <><Check size={15} /> เสร็จสิ้นการแก้ไข</> : <><Edit3 size={15} /> แก้ไขคะแนน</>}
            </button>
            <button
              type="button"
              onClick={onPrint}
              style={{
                background: '#EF4444', color: 'white', border: 'none', borderRadius: 8,
                padding: '8px 14px', fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              <Printer size={15} /> พิมพ์ฟอร์ม ปพ.6
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none',
                borderRadius: 8, padding: '8px 12px', fontWeight: 800, cursor: 'pointer',
              }}
            >
              ✕
            </button>
          </div>
        </div>

        <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: 12, marginBottom: 16,
          }}>
            <div style={statBox}>
              <div style={statLbl}>เกรดเฉลี่ย (GPA)</div>
              <div style={{ ...statVal, color: '#0284C7' }}>{gpaInfo.gpaFormatted}</div>
            </div>
            <div style={statBox}>
              <div style={statLbl}>ลำดับที่ในห้อง</div>
              <div style={statVal}>{rankInfo ? `${rankInfo.rank} / ${rankInfo.total}` : '-'}</div>
            </div>
            <div style={statBox}>
              <div style={statLbl}>คุณลักษณะอันพึงประสงค์</div>
              {editMode ? (
                <select
                  value={student.traitResult}
                  onChange={e => onUpdateEval(e.target.value as any, student.readThinkResult, student.activityResult)}
                  style={{ marginTop: 4, padding: '4px 8px', borderRadius: 6, fontWeight: 800 }}
                >
                  <option value="ดีเยี่ยม">ดีเยี่ยม</option>
                  <option value="ดี">ดี</option>
                  <option value="ผ่าน">ผ่าน</option>
                  <option value="ไม่ผ่าน">ไม่ผ่าน</option>
                </select>
              ) : (
                <div style={{ ...statVal, color: '#16A34A', fontSize: '1.05rem' }}>{student.traitResult}</div>
              )}
            </div>
            <div style={statBox}>
              <div style={statLbl}>อ่าน คิดวิเคราะห์ เขียน</div>
              {editMode ? (
                <select
                  value={student.readThinkResult}
                  onChange={e => onUpdateEval(student.traitResult, e.target.value as any, student.activityResult)}
                  style={{ marginTop: 4, padding: '4px 8px', borderRadius: 6, fontWeight: 800 }}
                >
                  <option value="ดีเยี่ยม">ดีเยี่ยม</option>
                  <option value="ดี">ดี</option>
                  <option value="ผ่าน">ผ่าน</option>
                  <option value="ไม่ผ่าน">ไม่ผ่าน</option>
                </select>
              ) : (
                <div style={{ ...statVal, color: '#16A34A', fontSize: '1.05rem' }}>{student.readThinkResult}</div>
              )}
            </div>
            <div style={statBox}>
              <div style={statLbl}>กิจกรรมพัฒนาผู้เรียน</div>
              {editMode ? (
                <select
                  value={student.activityResult}
                  onChange={e => onUpdateEval(student.traitResult, student.readThinkResult, e.target.value as any)}
                  style={{ marginTop: 4, padding: '4px 8px', borderRadius: 6, fontWeight: 800 }}
                >
                  <option value="ผ่าน">ผ่าน</option>
                  <option value="ไม่ผ่าน">ไม่ผ่าน</option>
                </select>
              ) : (
                <div style={{ ...statVal, color: '#16A34A', fontSize: '1.05rem' }}>{student.activityResult}</div>
              )}
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem', border: '1px solid #E2E8F0' }}>
            <thead>
              <tr style={{ background: '#F1F5F9', color: '#1E293B', borderBottom: '2px solid #CBD5E1' }}>
                <th style={thStyle}>รหัสวิชา</th>
                <th style={{ ...thStyle, textAlign: 'left' }}>ชื่อรายวิชา</th>
                <th style={thStyle}>ประเภท</th>
                <th style={thStyle}>หน่วยกิต</th>
                <th style={thStyle}>ระหว่างภาค (70)</th>
                <th style={thStyle}>ปลายภาค (30)</th>
                <th style={thStyle}>รวม (100)</th>
                <th style={thStyle}>เกรด</th>
                <th style={thStyle}>คุณลักษณะ</th>
                <th style={thStyle}>อ่านคิดฯ</th>
              </tr>
            </thead>
            <tbody>
              {classData.subjects.map(subj => {
                const sc = student.scores[subj.code] || {
                  coursework: 50, finalExam: 20, total: 70, grade: '3',
                  attendedHours: subj.hours, traitScore: 3, readThinkScore: 3,
                };
                return (
                  <tr key={subj.code} style={{ borderBottom: '1px solid #E2E8F0' }}>
                    <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 700 }}>{subj.code}</td>
                    <td style={{ ...tdStyle, fontWeight: 700 }}>{subj.name}</td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>{subj.type}</td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>{subj.credits.toFixed(1)}</td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      {editMode ? (
                        <input
                          type="number"
                          min={0}
                          max={70}
                          value={sc.coursework}
                          onChange={e => onUpdateScore(subj.code, Number(e.target.value), sc.finalExam)}
                          style={numInput}
                        />
                      ) : sc.coursework}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      {editMode ? (
                        <input
                          type="number"
                          min={0}
                          max={30}
                          value={sc.finalExam}
                          onChange={e => onUpdateScore(subj.code, sc.coursework, Number(e.target.value))}
                          style={numInput}
                        />
                      ) : sc.finalExam}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 800, color: '#0F172A' }}>
                      {sc.total}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 900, color: '#0284C7' }}>
                      {sc.grade}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>{sc.traitScore}</td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>{sc.readThinkScore}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const PRINT_STYLES = `
  .only-print-batch { display: none; }
  @media print {
    @page { size: A4 portrait; margin: 10mm 12mm; }
    body { background: white !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    .no-print { display: none !important; }
    .only-print-batch { display: block !important; }
    .porpor6-print-container { max-width: 100% !important; margin: 0 !important; padding: 0 !important; }
    .porpor6-sheet {
      box-shadow: none !important;
      margin: 0 !important;
      padding: 0 !important;
      border: none !important;
      width: 100% !important;
    }
    .porpor6-page-break {
      page-break-after: always !important;
      break-after: page !important;
    }
  }
`;

const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: 10,
  border: '1.5px solid #CBD5E1',
  fontSize: '0.9rem',
  fontWeight: 700,
  color: '#0F172A',
  background: '#FFFFFF',
};

const thStyle: React.CSSProperties = {
  padding: '11px 12px',
  fontWeight: 800,
  fontSize: '0.82rem',
};

const tdStyle: React.CSSProperties = {
  padding: '11px 12px',
};

const pTh: React.CSSProperties = {
  border: '1px solid #000',
  padding: '4px 4px',
  fontWeight: 800,
  textAlign: 'center',
  lineHeight: 1.2,
  color: '#000',
};

const pTd: React.CSSProperties = {
  border: '1px solid #000',
  padding: '4px 6px',
  lineHeight: 1.25,
  color: '#000',
};

const pSubTh: React.CSSProperties = {
  borderBottom: '1px solid #000',
  borderRight: '1px solid #000',
  padding: '4px 6px',
  fontWeight: 800,
  textAlign: 'center',
  color: '#000',
};

const pSubTd: React.CSSProperties = {
  borderBottom: '1px solid #000',
  borderRight: '1px solid #000',
  padding: '4px 8px',
  color: '#000',
};

const statBox: React.CSSProperties = {
  background: '#F8FAFC',
  border: '1px solid #E2E8F0',
  borderRadius: 10,
  padding: '10px 12px',
  textAlign: 'center',
};

const statLbl: React.CSSProperties = {
  fontSize: '0.74rem',
  color: '#64748B',
  fontWeight: 700,
};

const statVal: React.CSSProperties = {
  fontSize: '1.25rem',
  fontWeight: 900,
  color: '#0F172A',
  marginTop: 2,
};

const numInput: React.CSSProperties = {
  width: 58,
  padding: '4px 6px',
  borderRadius: 6,
  border: '1px solid #94A3B8',
  textAlign: 'center',
  fontWeight: 800,
};
