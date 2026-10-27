import { useState, useMemo } from 'react';
import { Download, Printer, BookOpen, CheckCircle2, FileText, ArrowLeft, ClipboardPaste, Sparkles } from 'lucide-react';
import SmartSchoolLayout from '../components/SmartSchoolLayout';
import TeacherLoginGate from '../components/TeacherLoginGate';
import { useTeacherAuth } from '../utils/teacherAuth';
import { useAcademicData } from '../utils/academicStorage';
import { downloadCsvReport } from '../utils/csvReport';
import ExcelPasteModal from '../components/ExcelPasteModal';
import { parseClipboardTable, cleanNumeric, isTabularPaste } from '../utils/excelPaste';
import { toast } from '../components/GlobalToast';

const DIRECTOR_NAME = 'นายปรัชญา ปรางค์ชัยภูมิ';

export default function PorPor5Page() {
  const auth = useTeacherAuth();
  if (!auth.authed) {
    return <TeacherLoginGate title="📝 วิชาที่ฉันสอน (บันทึกคะแนน ปพ.5)" />;
  }
  return <PorPor5Content />;
}

function PorPor5Content() {
  const { classesData, updateStudentScore } = useAcademicData();
  const [selectedClassId, setSelectedClassId] = useState<string>('m1');
  const [selectedSubjectCode, setSelectedSubjectCode] = useState<string>('ง21201');
  const [savedToast, setSavedToast] = useState(false);
  const [printMode, setPrintMode] = useState(false);
  const [showPasteModal, setShowPasteModal] = useState(false);

  const currentClass = useMemo(
    () => classesData.find(c => c.classId === selectedClassId) || classesData[0],
    [classesData, selectedClassId]
  );

  const currentSubject = useMemo(
    () => currentClass.subjects.find(s => s.code === selectedSubjectCode) || currentClass.subjects[0],
    [currentClass, selectedSubjectCode]
  );

  const handleClassChange = (cid: string) => {
    setSelectedClassId(cid);
    const nextCls = classesData.find(c => c.classId === cid);
    if (nextCls && nextCls.subjects.length > 0) {
      setSelectedSubjectCode(nextCls.subjects[0].code);
    }
  };

  const gradeDistribution = useMemo(() => {
    const dist: Record<string, number> = {
      '4': 0, '3.5': 0, '3': 0, '2.5': 0, '2': 0, '1.5': 0, '1': 0, '0': 0, 'ร': 0, 'มส': 0,
    };
    for (const st of currentClass.students) {
      const sc = st.scores[currentSubject.code];
      const g = sc ? sc.grade : '0';
      if (g in dist) dist[g] += 1;
    }
    return dist;
  }, [currentClass.students, currentSubject.code]);

  const traitAndReadSummary = useMemo(() => {
    const trait = { 3: 0, 2: 0, 1: 0, 0: 0 };
    const read = { 3: 0, 2: 0, 1: 0, 0: 0 };
    for (const st of currentClass.students) {
      const sc = st.scores[currentSubject.code];
      const t = (sc?.traitScore ?? 3) as 0 | 1 | 2 | 3;
      const r = (sc?.readThinkScore ?? 3) as 0 | 1 | 2 | 3;
      trait[t] = (trait[t] || 0) + 1;
      read[r] = (read[r] || 0) + 1;
    }
    return { trait, read };
  }, [currentClass.students, currentSubject.code]);

  const handleOpenPrint = () => {
    setPrintMode(true);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  // Bulk set all students in this subject
  const bulkSetSubjectField = (mode: 'full_hours' | 'trait_3' | 'read_3') => {
    currentClass.students.forEach(st => {
      const sc = st.scores[currentSubject.code] || {
        coursework: 50, finalExam: 20, total: 70, grade: '3',
        attendedHours: currentSubject.hours, traitScore: 3, readThinkScore: 3,
      };
      if (mode === 'full_hours') {
        updateStudentScore(currentClass.classId, st.code, currentSubject.code, sc.coursework, sc.finalExam, undefined, sc.traitScore, sc.readThinkScore, currentSubject.hours);
      } else if (mode === 'trait_3') {
        updateStudentScore(currentClass.classId, st.code, currentSubject.code, sc.coursework, sc.finalExam, undefined, 3, sc.readThinkScore, sc.attendedHours);
      } else if (mode === 'read_3') {
        updateStudentScore(currentClass.classId, st.code, currentSubject.code, sc.coursework, sc.finalExam, undefined, sc.traitScore, 3, sc.attendedHours);
      }
    });
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2000);
    toast.success('ตั้งค่าทั้งห้องเรียบร้อยแล้ว');
  };

  // Direct Ctrl+V paste in score input
  const handleDirectScorePaste = (e: React.ClipboardEvent<HTMLInputElement>, startIdx: number, field: 'coursework' | 'finalExam') => {
    const text = e.clipboardData.getData('text');
    if (!isTabularPaste(text)) return;
    e.preventDefault();
    const rows = parseClipboardTable(text);
    if (rows.length === 0) return;

    let count = 0;
    for (let r = 0; r < rows.length; r++) {
      const sIdx = startIdx + r;
      if (sIdx >= currentClass.students.length) break;
      const st = currentClass.students[sIdx];
      const sc = st.scores[currentSubject.code] || {
        coursework: 50, finalExam: 20, total: 70, grade: '3',
        attendedHours: currentSubject.hours, traitScore: 3, readThinkScore: 3,
      };
      let cw = sc.coursework;
      let fin = sc.finalExam;
      const cells = rows[r];
      if (field === 'coursework') {
        if (cells.length >= 2) {
          const v1 = cleanNumeric(cells[0]);
          const v2 = cleanNumeric(cells[1]);
          if (v1 !== null) cw = Math.min(70, Math.max(0, v1));
          if (v2 !== null) fin = Math.min(30, Math.max(0, v2));
        } else {
          const v1 = cleanNumeric(cells[0]);
          if (v1 !== null) cw = Math.min(70, Math.max(0, v1));
        }
      } else {
        const v1 = cleanNumeric(cells[0]);
        if (v1 !== null) fin = Math.min(30, Math.max(0, v1));
      }
      updateStudentScore(currentClass.classId, st.code, currentSubject.code, cw, fin, undefined, sc.traitScore, sc.readThinkScore, sc.attendedHours);
      count++;
    }
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2000);
    toast.success(`วางคะแนนจาก Excel สำเร็จ ${count} คน`);
  };

  const handlePasteModalApply = (records: Array<{ studentId: string; values: Record<string, number | null> }>) => {
    let count = 0;
    for (const rec of records) {
      const st = currentClass.students.find(s => s.code === rec.studentId);
      if (!st) continue;
      const sc = st.scores[currentSubject.code] || {
        coursework: 50, finalExam: 20, total: 70, grade: '3',
        attendedHours: currentSubject.hours, traitScore: 3, readThinkScore: 3,
      };
      const cw = rec.values.coursework !== null && rec.values.coursework !== undefined
        ? Math.min(70, Math.max(0, rec.values.coursework))
        : sc.coursework;
      const fin = rec.values.finalExam !== null && rec.values.finalExam !== undefined
        ? Math.min(30, Math.max(0, rec.values.finalExam))
        : sc.finalExam;
      updateStudentScore(currentClass.classId, st.code, currentSubject.code, cw, fin, undefined, sc.traitScore, sc.readThinkScore, sc.attendedHours);
      count++;
    }
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2000);
    toast.success(`บันทึกคะแนนจาก Excel สำเร็จ ${count} คน`);
  };

  const pasteStudentRows = useMemo(() => {
    return currentClass.students.map(st => {
      const sc = st.scores[currentSubject.code];
      return {
        id: st.code,
        code: st.code,
        name: st.name,
        currentValues: {
          coursework: sc?.coursework ?? 50,
          finalExam: sc?.finalExam ?? 20,
        },
      };
    });
  }, [currentClass.students, currentSubject.code]);

  const exportSubjectCsv = () => {
    const rows: Array<Array<string | number>> = [
      [`แบบบันทึกผลการเรียนรายวิชา (ปพ.5) โรงเรียนบ้านคลองมดแดง`],
      [`รายวิชา: ${currentSubject.code} ${currentSubject.name}`, `ชั้น: ${currentClass.shortName}/1`, `ครูผู้สอน: ${currentSubject.teacher}`],
      [],
      ['เลขที่', 'รหัสนักเรียน', 'ชื่อ-นามสกุล', 'เวลาเรียนเต็ม', 'เวลาเรียนที่มา', 'ระหว่างภาค (70)', 'ปลายภาค (30)', 'รวม (100)', 'ผลการเรียน (เกรด)', 'คุณลักษณะ (3)', 'อ่านคิดวิเคราะห์ (3)'],
      ...currentClass.students.map(st => {
        const sc = st.scores[currentSubject.code] || {
          coursework: 50, finalExam: 20, total: 70, grade: '3',
          attendedHours: currentSubject.hours, traitScore: 3, readThinkScore: 3,
        };
        return [
          st.no, st.code, st.name,
          currentSubject.hours, sc.attendedHours,
          sc.coursework, sc.finalExam, sc.total, sc.grade,
          sc.traitScore, sc.readThinkScore,
        ];
      }),
    ];
    downloadCsvReport(`ปพ5_${currentClass.shortName}_${currentSubject.code}_${currentSubject.name}.csv`, rows);
  };

  if (printMode) {
    return (
      <div style={{ background: '#475569', minHeight: '100vh', padding: '24px 16px' }}>
        <div
          className="no-print"
          style={{
            maxWidth: '210mm',
            margin: '0 auto 20px',
            background: '#FFFFFF',
            borderRadius: 14,
            padding: '14px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
            boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              type="button"
              onClick={() => setPrintMode(false)}
              style={{
                background: '#F1F5F9',
                border: '1px solid #CBD5E1',
                borderRadius: 8,
                padding: '8px 14px',
                fontWeight: 800,
                cursor: 'pointer',
                color: '#1E293B',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <ArrowLeft size={16} /> กลับหน้ากรอกคะแนน
            </button>
            <div>
              <div style={{ fontWeight: 900, color: '#0F172A', fontSize: '0.95rem' }}>
                โหมดพิมพ์แบบฟอร์ม ปพ.5 ราชการ (หน้าปก ปพ.5 + ตารางสรุปคะแนนรายวิชา)
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748B' }}>
                วิชา {currentSubject.code} {currentSubject.name} · ชั้น{currentClass.className} ({currentClass.students.length} คน) · ตั้งค่ากระดาษ A4 แนวตั้ง
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => window.print()}
            style={{
              background: '#1D4ED8',
              color: 'white',
              border: 'none',
              borderRadius: 10,
              padding: '10px 20px',
              fontWeight: 900,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 4px 14px rgba(29,78,216,0.35)',
            }}
          >
            <Printer size={18} /> สั่งพิมพ์แบบฟอร์ม ปพ.5 (A4)
          </button>
        </div>

        <PorPor5OfficialPrintSheets
          currentClass={currentClass}
          currentSubject={currentSubject}
          gradeDistribution={gradeDistribution}
          traitAndReadSummary={traitAndReadSummary}
        />
      </div>
    );
  }

  return (
    <SmartSchoolLayout pageTitle="ระบบบริหารจัดการโรงเรียน">
      <div className="no-print">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 900, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
              <BookOpen size={24} color="#0284C7" /> วิชาที่ฉันสอน / บันทึกคะแนน ปพ.5
            </h1>
            <div style={{ fontSize: '0.82rem', color: '#64748B', marginTop: 2 }}>
              กรอกคะแนนเก็บระหว่างภาค (70) และสอบปลายภาค (30) ระบบคำนวณเกรดและซิงค์เข้าใบ ปพ.6 อัตโนมัติ พร้อมพิมพ์ฟอร์ม ปพ.5 ราชการ
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {savedToast && (
              <span style={{
                background: '#DCFCE7', color: '#15803D', padding: '8px 12px',
                borderRadius: 8, fontSize: '0.8rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 5,
              }}>
                <CheckCircle2 size={15} /> บันทึกและซิงค์ ปพ.6 แล้ว
              </span>
            )}
            <button
              type="button"
              onClick={() => setShowPasteModal(true)}
              style={{
                background: '#0F172A', color: 'white', border: 'none',
                borderRadius: 999, padding: '9px 16px', fontWeight: 800, fontSize: '0.84rem',
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              <ClipboardPaste size={15} /> วางคะแนนจาก Excel
            </button>
            <button
              type="button"
              onClick={() => setPrintMode(true)}
              style={{
                background: '#F8FAFC', color: '#1E293B', border: '1px solid #CBD5E1',
                borderRadius: 999, padding: '9px 16px', fontWeight: 800, fontSize: '0.84rem',
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              <FileText size={15} /> ดูตัวอย่างฟอร์ม ปพ.5
            </button>
            <button
              type="button"
              onClick={handleOpenPrint}
              style={{
                background: '#1D4ED8', color: 'white', border: 'none',
                borderRadius: 999, padding: '9px 18px', fontWeight: 800, fontSize: '0.84rem',
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
                boxShadow: '0 4px 12px rgba(29,78,216,0.25)',
              }}
            >
              <Printer size={15} /> พิมพ์ฟอร์ม ปพ.5 (หน้าปก + คะแนน)
            </button>
            <button
              type="button"
              onClick={exportSubjectCsv}
              style={{
                background: '#15803D', color: 'white', border: 'none', borderRadius: 999,
                padding: '9px 18px', fontWeight: 800, fontSize: '0.84rem',
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              <Download size={15} /> ส่งออก Excel (CSV)
            </button>
          </div>
        </div>

        {/* Select Class & Subject */}
        <div
          style={{
            background: '#FFFFFF', borderRadius: 14, padding: '18px 20px',
            marginBottom: 16, border: '1px solid #E2E8F0',
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16,
          }}
        >
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#334155', marginBottom: 6 }}>
              🏫 เลือกระดับชั้นเรียน
            </label>
            <select
              value={selectedClassId}
              onChange={e => handleClassChange(e.target.value)}
              style={selStyle}
            >
              {classesData.map(c => (
                <option key={c.classId} value={c.classId}>
                  ชั้น{c.className} ({c.shortName}/1) — {c.students.length} คน
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#334155', marginBottom: 6 }}>
              📘 เลือกรายวิชาที่สอน
            </label>
            <select
              value={currentSubject.code}
              onChange={e => setSelectedSubjectCode(e.target.value)}
              style={selStyle}
            >
              {currentClass.subjects.map(s => (
                <option key={s.code} value={s.code}>
                  {s.code} — {s.name} ({s.type} · {s.credits} หน่วยกิต · {s.teacher})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Grade Summary Strip */}
        <div style={{
          background: '#FFFFFF', borderRadius: 14, padding: '14px 20px',
          marginBottom: 16, border: '1px solid #E2E8F0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
        }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: '1rem', color: '#0F172A' }}>
              {currentSubject.code} {currentSubject.name} ({currentSubject.type})
            </div>
            <div style={{ fontSize: '0.8rem', color: '#64748B', marginTop: 2 }}>
              ครูผู้สอน: <b>{currentSubject.teacher}</b> · น้ำหนัก: <b>{currentSubject.credits} หน่วยกิต</b> · เวลาเรียน: <b>{currentSubject.hours} ชั่วโมง/ภาค</b>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(['4', '3.5', '3', '2.5', '2', '1.5', '1', '0'] as const).map(g => (
              <div key={g} style={{
                padding: '6px 12px', borderRadius: 10, background: '#F8FAFC',
                border: '1px solid #E2E8F0', textAlign: 'center', minWidth: 52,
              }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748B' }}>เกรด {g}</div>
                <div style={{ fontSize: '1rem', fontWeight: 900, color: '#0284C7' }}>{gradeDistribution[g]}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick 1-Click Bulk Action Strip */}
        <div style={{
          background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: 12,
          padding: '10px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, color: '#0369A1', fontSize: '0.84rem' }}>
            <Sparkles size={16} /> ⚡ ทางลัดตั้งค่าทั้งห้องในคลิกเดียว (ประหยัดเวลาครู):
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => bulkSetSubjectField('full_hours')}
              style={{
                background: 'white', color: '#0369A1', border: '1px solid #7DD3FC',
                borderRadius: 8, padding: '5px 12px', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer',
              }}
            >
              ✓ เวลาเรียนครบ {currentSubject.hours} ชม. ทั้งห้อง
            </button>
            <button
              type="button"
              onClick={() => bulkSetSubjectField('trait_3')}
              style={{
                background: 'white', color: '#047857', border: '1px solid #6EE7B7',
                borderRadius: 8, padding: '5px 12px', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer',
              }}
            >
              ✓ คุณลักษณะฯ = 3 (ดีเยี่ยม) ทั้งห้อง
            </button>
            <button
              type="button"
              onClick={() => bulkSetSubjectField('read_3')}
              style={{
                background: 'white', color: '#6D28D9', border: '1px solid #C4B5FD',
                borderRadius: 8, padding: '5px 12px', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer',
              }}
            >
              ✓ อ่านคิดวิเคราะห์ฯ = 3 (ดีเยี่ยม) ทั้งห้อง
            </button>
          </div>
        </div>

        {/* Score Recording Table */}
        <div style={{
          background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0',
          boxShadow: '0 4px 16px rgba(15,23,42,0.04)', overflow: 'hidden',
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
              <thead>
                <tr style={{ background: '#1E293B', color: 'white' }}>
                  <th style={{ ...thP5, width: 60 }}>เลขที่</th>
                  <th style={{ ...thP5, width: 100 }}>รหัสนักเรียน</th>
                  <th style={{ ...thP5, textAlign: 'left' }}>ชื่อ-นามสกุล</th>
                  <th style={{ ...thP5, width: 95 }}>เวลาเรียน<br />({currentSubject.hours} ชม.)</th>
                  <th style={{ ...thP5, width: 120, background: '#0369A1' }}>คะแนนระหว่างภาค<br />(เต็ม 70)</th>
                  <th style={{ ...thP5, width: 120, background: '#0369A1' }}>สอบปลายภาค<br />(เต็ม 30)</th>
                  <th style={{ ...thP5, width: 95, background: '#0F172A' }}>คะแนนรวม<br />(100)</th>
                  <th style={{ ...thP5, width: 85, background: '#15803D' }}>ระดับผล<br />การเรียน</th>
                  <th style={{ ...thP5, width: 95 }}>คุณลักษณะฯ<br />(0-3)</th>
                  <th style={{ ...thP5, width: 95 }}>อ่านคิดฯ<br />(0-3)</th>
                </tr>
              </thead>
              <tbody>
                {currentClass.students.map((st, idx) => {
                  const sc = st.scores[currentSubject.code] || {
                    coursework: 50, finalExam: 20, total: 70, grade: '3',
                    attendedHours: currentSubject.hours, traitScore: 3, readThinkScore: 3,
                  };
                  const triggerUpdate = (cw: number, fin: number, tr?: number, rt?: number, hrs?: number) => {
                    updateStudentScore(currentClass.classId, st.code, currentSubject.code, cw, fin, undefined, tr, rt, hrs);
                    setSavedToast(true);
                    setTimeout(() => setSavedToast(false), 1800);
                  };
                  return (
                    <tr key={st.code} style={{ borderBottom: '1px solid #E2E8F0' }}>
                      <td style={{ ...tdP5, fontWeight: 800 }}>{st.no}</td>
                      <td style={{ ...tdP5, color: '#475569', fontWeight: 700 }}>{st.code}</td>
                      <td style={{ ...tdP5, textAlign: 'left', fontWeight: 800, color: '#0F172A' }}>{st.name}</td>
                      <td style={tdP5}>
                        <input
                          type="number"
                          min={0}
                          max={currentSubject.hours}
                          value={sc.attendedHours}
                          onChange={e => triggerUpdate(sc.coursework, sc.finalExam, sc.traitScore, sc.readThinkScore, Number(e.target.value))}
                          style={inpStyle}
                        />
                      </td>
                      <td style={{ ...tdP5, background: '#F0F9FF' }}>
                        <input
                          type="number"
                          min={0}
                          max={70}
                          value={sc.coursework}
                          onPaste={ev => handleDirectScorePaste(ev, idx, 'coursework')}
                          onChange={e => triggerUpdate(Number(e.target.value), sc.finalExam)}
                          title="กด Ctrl+V เพื่อวางคะแนนจาก Excel ได้ทันที"
                          style={{ ...inpStyle, borderColor: '#38BDF8', fontWeight: 900 }}
                        />
                      </td>
                      <td style={{ ...tdP5, background: '#F0F9FF' }}>
                        <input
                          type="number"
                          min={0}
                          max={30}
                          value={sc.finalExam}
                          onPaste={ev => handleDirectScorePaste(ev, idx, 'finalExam')}
                          onChange={e => triggerUpdate(sc.coursework, Number(e.target.value))}
                          title="กด Ctrl+V เพื่อวางคะแนนจาก Excel ได้ทันที"
                          style={{ ...inpStyle, borderColor: '#38BDF8', fontWeight: 900 }}
                        />
                      </td>
                      <td style={{ ...tdP5, fontWeight: 900, fontSize: '0.95rem', color: '#0F172A', background: '#F8FAFC' }}>
                        {sc.total}
                      </td>
                      <td style={{ ...tdP5, fontWeight: 900, fontSize: '1rem', color: '#15803D', background: '#F0FDF4' }}>
                        {sc.grade}
                      </td>
                      <td style={tdP5}>
                        <select
                          value={sc.traitScore}
                          onChange={e => triggerUpdate(sc.coursework, sc.finalExam, Number(e.target.value), sc.readThinkScore)}
                          style={inpStyle}
                        >
                          <option value={3}>3 (ดีเยี่ยม)</option>
                          <option value={2}>2 (ดี)</option>
                          <option value={1}>1 (ผ่าน)</option>
                          <option value={0}>0 (ไม่ผ่าน)</option>
                        </select>
                      </td>
                      <td style={tdP5}>
                        <select
                          value={sc.readThinkScore}
                          onChange={e => triggerUpdate(sc.coursework, sc.finalExam, sc.traitScore, Number(e.target.value))}
                          style={inpStyle}
                        >
                          <option value={3}>3 (ดีเยี่ยม)</option>
                          <option value={2}>2 (ดี)</option>
                          <option value={1}>1 (ผ่าน)</option>
                          <option value={0}>0 (ไม่ผ่าน)</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <ExcelPasteModal
          isOpen={showPasteModal}
          onClose={() => setShowPasteModal(false)}
          title={`📋 วางคะแนน ปพ.5 จาก Excel (${currentSubject.code} ${currentSubject.name})`}
          subtitle="คัดลอกคอลัมน์คะแนนระหว่างภาค (70) และ/หรือ สอบปลายภาค (30) จาก Excel แล้ววางลงด้านล่าง"
          themeColor="#0284C7"
          students={pasteStudentRows}
          columns={[
            { key: 'coursework', label: 'คะแนนระหว่างภาค', unit: '70', placeholder: '50' },
            { key: 'finalExam', label: 'สอบปลายภาค', unit: '30', placeholder: '20' },
          ]}
          onApply={handlePasteModalApply}
        />
      </div>

      {/* Fallback when pressing Ctrl+P directly on the PorPor5 page: prints official PorPor5 sheets */}
      <div className="only-print-pp5">
        <PorPor5OfficialPrintSheets
          currentClass={currentClass}
          currentSubject={currentSubject}
          gradeDistribution={gradeDistribution}
          traitAndReadSummary={traitAndReadSummary}
        />
      </div>

      <style>{`
        .only-print-pp5 {
          display: none;
        }
        @media print {
          .only-print-pp5 {
            display: block !important;
          }
        }
      `}</style>
    </SmartSchoolLayout>
  );
}

/* =========================================================================
   OFFICIAL PORPOR 5 PRINT SHEETS (หน้าปก ปพ.5 + ตารางสรุปคะแนน ปพ.5)
   Matches ปพ.5_ม.1_ง21201_ทักษะอาชีพ.xlsx of โรงเรียนบ้านคลองมดแดง
   ========================================================================= */
function PorPor5OfficialPrintSheets({
  currentClass,
  currentSubject,
  gradeDistribution,
  traitAndReadSummary,
}: {
  currentClass: ReturnType<typeof useAcademicData>['classesData'][number];
  currentSubject: ReturnType<typeof useAcademicData>['classesData'][number]['subjects'][number];
  gradeDistribution: Record<string, number>;
  traitAndReadSummary: {
    trait: Record<0 | 1 | 2 | 3, number>;
    read: Record<0 | 1 | 2 | 3, number>;
  };
}) {
  const totalStudents = currentClass.students.length || 1;
  const pct = (count: number) => ((count / totalStudents) * 100).toFixed(2);
  const gradeCols = ['0', '1', '1.5', '2', '2.5', '3', '3.5', '4', 'ร', 'มส'] as const;

  return (
    <div>
      {/* ================= SHEET 1: หน้าปก ปพ.5 ================= */}
      <div className="pp5-sheet">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ width: 65 }} />
          <div style={{ textAlign: 'center', flex: 1 }}>
            <img
              src={`${import.meta.env.BASE_URL}images/school-logo.png`}
              alt="ตราโรงเรียน"
              style={{ width: 64, height: 64, objectFit: 'contain', margin: '0 auto 4px' }}
            />
            <div style={{ fontSize: '15pt', fontWeight: 800, lineHeight: 1.25 }}>
              แบบบันทึกผลการพัฒนาคุณภาพนักเรียน
            </div>
            <div style={{ fontSize: '12pt', fontWeight: 700, lineHeight: 1.25 }}>
              หลักสูตรแกนกลางการศึกษาขั้นพื้นฐาน พุทธศักราช 2551 (ฉบับปรับปรุง 2560)
            </div>
            <div style={{ fontSize: '12.5pt', fontWeight: 800, lineHeight: 1.3 }}>
              โรงเรียนบ้านคลองมดแดง &nbsp; สำนักงานเขตพื้นที่การศึกษาประถมศึกษากำแพงเพชร เขต 2
            </div>
          </div>
          <div style={{
            width: 65, textAlign: 'right', fontWeight: 900, fontSize: '15pt',
            border: '2px solid #000', padding: '4px 10px', textAlignLast: 'center',
          }}>
            ปพ.5
          </div>
        </div>

        {/* Course Information Block */}
        <div style={{
          marginTop: 10, padding: '8px 12px', border: '1px solid #000',
          fontSize: '11pt', lineHeight: 1.65,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <div><b>กลุ่มสาระการเรียนรู้:</b> {currentSubject.group}</div>
            <div><b>รายวิชา:</b> {currentSubject.name} ({currentSubject.type})</div>
            <div><b>รหัสวิชา:</b> {currentSubject.code}</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <div><b>ระดับชั้น:</b> {currentClass.className} ({currentClass.shortName}/1)</div>
            <div><b>ภาคเรียนที่:</b> 1 &nbsp;&nbsp; <b>ปีการศึกษา:</b> 2569</div>
            <div><b>เวลาเรียน:</b> {currentSubject.hours} ชั่วโมง/ภาคเรียน ({currentSubject.credits} หน่วยกิต)</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <div><b>ครูผู้สอน:</b> {currentSubject.teacher}</div>
            <div><b>ครูที่ปรึกษา/ประจำชั้น:</b> {currentClass.homeroomTeachers.join(' / ')}</div>
            <div><b>เริ่มใช้วันที่:</b> 16 พฤษภาคม พ.ศ. 2569</div>
          </div>
        </div>

        {/* Table 1: สรุปผลการเรียน */}
        <div style={{ marginTop: 10 }}>
          <div style={{ fontWeight: 800, fontSize: '11pt', marginBottom: 3 }}>
            1. สรุปผลการเรียนรายวิชา
          </div>
          <table className="pp5-table">
            <thead>
              <tr>
                <th rowSpan={2} style={{ width: '16%' }}>จำนวนนักเรียน<br />ทั้งหมด</th>
                <th colSpan={10}>ระดับผลการเรียน (คน / ร้อยละ)</th>
                <th rowSpan={2} style={{ width: '14%' }}>หมายเหตุ</th>
              </tr>
              <tr>
                {gradeCols.map(g => (
                  <th key={g} style={{ width: '7%' }}>{g}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ textAlign: 'center', fontWeight: 700 }}>
                  จำนวน {currentClass.students.length} คน
                </td>
                {gradeCols.map(g => (
                  <td key={g} style={{ textAlign: 'center', fontWeight: 800 }}>
                    {gradeDistribution[g] || 0}
                  </td>
                ))}
                <td style={{ textAlign: 'center' }}>ปกติ</td>
              </tr>
              <tr>
                <td style={{ textAlign: 'center', fontWeight: 700 }}>ร้อยละ</td>
                {gradeCols.map(g => (
                  <td key={g} style={{ textAlign: 'center' }}>
                    {gradeDistribution[g] ? pct(gradeDistribution[g]) : '0.00'}
                  </td>
                ))}
                <td style={{ textAlign: 'center' }}>100.00%</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Table 2: สรุปผลการประเมินคุณลักษณะอันพึงประสงค์ และ การอ่าน คิดวิเคราะห์ และเขียน */}
        <div style={{ marginTop: 10 }}>
          <div style={{ fontWeight: 800, fontSize: '11pt', marginBottom: 3 }}>
            2. สรุปผลการประเมินคุณลักษณะอันพึงประสงค์ และการอ่าน คิดวิเคราะห์ และเขียนสื่อความ
          </div>
          <table className="pp5-table">
            <thead>
              <tr>
                <th rowSpan={2} style={{ width: '14%' }}>รายการข้อมูล</th>
                <th colSpan={4}>คุณลักษณะอันพึงประสงค์</th>
                <th colSpan={4}>การอ่าน คิดวิเคราะห์ และเขียนสื่อความ</th>
              </tr>
              <tr>
                <th>ดีเยี่ยม (3)</th>
                <th>ดี (2)</th>
                <th>ผ่าน (1)</th>
                <th>ไม่ผ่าน (0)</th>
                <th>ดีเยี่ยม (3)</th>
                <th>ดี (2)</th>
                <th>ผ่าน (1)</th>
                <th>ไม่ผ่าน (0)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ textAlign: 'center', fontWeight: 700 }}>จำนวน ({currentClass.students.length} คน)</td>
                <td style={{ textAlign: 'center', fontWeight: 700 }}>{traitAndReadSummary.trait[3]}</td>
                <td style={{ textAlign: 'center', fontWeight: 700 }}>{traitAndReadSummary.trait[2]}</td>
                <td style={{ textAlign: 'center', fontWeight: 700 }}>{traitAndReadSummary.trait[1]}</td>
                <td style={{ textAlign: 'center', fontWeight: 700 }}>{traitAndReadSummary.trait[0]}</td>
                <td style={{ textAlign: 'center', fontWeight: 700 }}>{traitAndReadSummary.read[3]}</td>
                <td style={{ textAlign: 'center', fontWeight: 700 }}>{traitAndReadSummary.read[2]}</td>
                <td style={{ textAlign: 'center', fontWeight: 700 }}>{traitAndReadSummary.read[1]}</td>
                <td style={{ textAlign: 'center', fontWeight: 700 }}>{traitAndReadSummary.read[0]}</td>
              </tr>
              <tr>
                <td style={{ textAlign: 'center', fontWeight: 700 }}>ร้อยละ</td>
                <td style={{ textAlign: 'center' }}>{pct(traitAndReadSummary.trait[3])}</td>
                <td style={{ textAlign: 'center' }}>{pct(traitAndReadSummary.trait[2])}</td>
                <td style={{ textAlign: 'center' }}>{pct(traitAndReadSummary.trait[1])}</td>
                <td style={{ textAlign: 'center' }}>{pct(traitAndReadSummary.trait[0])}</td>
                <td style={{ textAlign: 'center' }}>{pct(traitAndReadSummary.read[3])}</td>
                <td style={{ textAlign: 'center' }}>{pct(traitAndReadSummary.read[2])}</td>
                <td style={{ textAlign: 'center' }}>{pct(traitAndReadSummary.read[1])}</td>
                <td style={{ textAlign: 'center' }}>{pct(traitAndReadSummary.read[0])}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Approval Signatures Box */}
        <div style={{
          marginTop: 14,
          border: '1px solid #000',
          padding: '12px 18px',
          fontSize: '10.8pt',
          lineHeight: 1.65,
        }}>
          <div style={{ textAlign: 'center', fontWeight: 800, fontSize: '12pt', marginBottom: 8, textDecoration: 'underline' }}>
            การอนุมัติผลการเรียน
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ textAlign: 'center', padding: '6px 4px' }}>
              <div>ลงชื่อ..........................................................ครูผู้สอน</div>
              <div>({currentSubject.teacher})</div>
              <div>วันที่........../......................../..............</div>
            </div>

            <div style={{ textAlign: 'center', padding: '6px 4px' }}>
              <div>ลงชื่อ..........................................................หัวหน้ากลุ่มสาระฯ</div>
              <div>(..........................................................)</div>
              <div>วันที่........../......................../..............</div>
            </div>

            <div style={{ textAlign: 'center', padding: '6px 4px' }}>
              <div>ได้ตรวจสอบแล้วเห็นควรอนุมัติผลการเรียน</div>
              <div style={{ marginTop: 4 }}>ลงชื่อ..........................................................หัวหน้างานวัดผลฯ</div>
              <div>(..........................................................)</div>
              <div>วันที่........../......................../..............</div>
            </div>

            <div style={{ textAlign: 'center', padding: '6px 4px', borderLeft: '1px dashed #64748B' }}>
              <div style={{ fontWeight: 700 }}>
                เรียนเสนอเพื่อพิจารณา &nbsp; [ &nbsp; ] อนุมัติ &nbsp;&nbsp; [ &nbsp; ] ไม่อนุมัติ
              </div>
              <div style={{ marginTop: 8 }}>ลงชื่อ..........................................................</div>
              <div style={{ fontWeight: 800 }}>({DIRECTOR_NAME})</div>
              <div>ผู้อำนวยการโรงเรียนบ้านคลองมดแดง</div>
              <div>วันที่........../......................../..............</div>
            </div>
          </div>
        </div>
      </div>

      {/* ================= SHEET 2: ตารางสรุปคะแนนและเวลาเรียน ปพ.5 ================= */}
      <div className="pp5-sheet">
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: '13.5pt', fontWeight: 800 }}>
            แบบสรุปผลการประเมินและคะแนนรายวิชา (ปพ.5) — ภาคเรียนที่ 1 ปีการศึกษา 2569
          </div>
          <div style={{ fontSize: '11pt', fontWeight: 700 }}>
            รหัสวิชา {currentSubject.code} &nbsp; รายวิชา {currentSubject.name} ({currentSubject.type}) &nbsp;|&nbsp;
            ชั้น{currentClass.className} ({currentClass.shortName}/1) &nbsp;|&nbsp;
            เวลาเรียน {currentSubject.hours} ชั่วโมง ({currentSubject.credits} หน่วยกิต) &nbsp;|&nbsp;
            ครูผู้สอน: {currentSubject.teacher}
          </div>
        </div>

        <table className="pp5-table">
          <thead>
            <tr>
              <th rowSpan={2} style={{ width: '5%' }}>เลขที่</th>
              <th rowSpan={2} style={{ width: '10%' }}>เลขประจำตัว</th>
              <th rowSpan={2} style={{ width: '27%' }}>ชื่อ - นามสกุล</th>
              <th colSpan={2}>เวลาเรียน ({currentSubject.hours} ชม.)</th>
              <th colSpan={3}>คะแนนผลการเรียนรายวิชา</th>
              <th rowSpan={2} style={{ width: '8%' }}>ระดับผล<br />การเรียน</th>
              <th rowSpan={2} style={{ width: '9%' }}>คุณลักษณะ<br />อันพึงประสงค์<br />(0-3)</th>
              <th rowSpan={2} style={{ width: '9%' }}>อ่าน คิดวิเคราะห์<br />และเขียน<br />(0-3)</th>
            </tr>
            <tr>
              <th style={{ width: '7%' }}>มาเรียน</th>
              <th style={{ width: '7%' }}>ร้อยละ</th>
              <th style={{ width: '8%' }}>ระหว่างภาค<br />(70)</th>
              <th style={{ width: '7%' }}>ปลายภาค<br />(30)</th>
              <th style={{ width: '7%' }}>รวม<br />(100)</th>
            </tr>
          </thead>
          <tbody>
            {currentClass.students.map(st => {
              const sc = st.scores[currentSubject.code] || {
                coursework: 50, finalExam: 20, total: 70, grade: '3',
                attendedHours: currentSubject.hours, traitScore: 3, readThinkScore: 3,
              };
              const attPct = currentSubject.hours > 0
                ? ((sc.attendedHours / currentSubject.hours) * 100).toFixed(0)
                : '100';
              return (
                <tr key={st.code}>
                  <td style={{ textAlign: 'center' }}>{st.no}</td>
                  <td style={{ textAlign: 'center' }}>{st.code}</td>
                  <td>{st.name}</td>
                  <td style={{ textAlign: 'center' }}>{sc.attendedHours}</td>
                  <td style={{ textAlign: 'center' }}>{attPct}%</td>
                  <td style={{ textAlign: 'center' }}>{sc.coursework}</td>
                  <td style={{ textAlign: 'center' }}>{sc.finalExam}</td>
                  <td style={{ textAlign: 'center', fontWeight: 700 }}>{sc.total}</td>
                  <td style={{ textAlign: 'center', fontWeight: 800 }}>{sc.grade}</td>
                  <td style={{ textAlign: 'center' }}>{sc.traitScore}</td>
                  <td style={{ textAlign: 'center' }}>{sc.readThinkScore}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div style={{
          marginTop: 16, display: 'flex', justifyContent: 'space-around',
          fontSize: '10.5pt', textAlign: 'center',
        }}>
          <div>
            <div>ลงชื่อ..........................................................ครูผู้สอน</div>
            <div>({currentSubject.teacher})</div>
          </div>
          <div>
            <div>ลงชื่อ..........................................................ครูประจำชั้น</div>
            <div>({currentClass.homeroomTeachers.join(' / ')})</div>
          </div>
          <div>
            <div>ลงชื่อ..........................................................ผู้อำนวยการโรงเรียน</div>
            <div>({DIRECTOR_NAME})</div>
          </div>
        </div>
      </div>

      <style>{`
        .pp5-sheet {
          width: 210mm;
          min-height: 296mm;
          margin: 0 auto 24px;
          background: #FFFFFF;
          color: #000000;
          padding: 12mm 14mm;
          box-sizing: border-box;
          font-family: 'Sarabun', 'TH SarabunPSK', sans-serif;
          box-shadow: 0 10px 30px rgba(0,0,0,0.3);
          page-break-after: always;
          break-after: page;
        }
        .pp5-sheet:last-child {
          page-break-after: auto;
          break-after: auto;
        }
        .pp5-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 10pt;
        }
        .pp5-table th,
        .pp5-table td {
          border: 1px solid #000000;
          padding: 3.5px 6px;
          line-height: 1.3;
        }
        .pp5-table th {
          background: #F8FAFC;
          font-weight: 800;
          text-align: center;
        }
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm;
          }
          body {
            background: #FFFFFF !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .no-print {
            display: none !important;
          }
          .pp5-sheet {
            width: 100% !important;
            min-height: auto !important;
            margin: 0 !important;
            padding: 4mm 6mm !important;
            box-shadow: none !important;
          }
        }
      `}</style>
    </div>
  );
}

const selStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: 10,
  border: '1.5px solid #CBD5E1',
  fontWeight: 700,
  fontSize: '0.88rem',
  color: '#0F172A',
};

const thP5: React.CSSProperties = {
  padding: '10px 8px',
  fontWeight: 800,
  fontSize: '0.78rem',
  textAlign: 'center',
  borderRight: '1px solid rgba(255,255,255,0.12)',
};

const tdP5: React.CSSProperties = {
  padding: '8px 8px',
  textAlign: 'center',
  borderRight: '1px solid #F1F5F9',
};

const inpStyle: React.CSSProperties = {
  width: 68,
  padding: '5px 6px',
  borderRadius: 6,
  border: '1px solid #CBD5E1',
  textAlign: 'center',
  fontWeight: 700,
  fontSize: '0.84rem',
};
