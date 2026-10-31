import { useState } from 'react';
import type { ClassAcademicData, AcademicSubject } from '../data/academicData';
import { STUDENT_BIO_2569 } from '../data/studentBio2569';
import { SCHOOL_NAME, SCHOOL_AFFILIATION } from '../config/siteLinks';

export type SssPp5SheetKey =
  | 'all_full'        // พิมพ์ทุกหน้าครบทั้งเล่ม (รวม 12 เดือน)
  | 'all_core'        // พิมพ์ชุดหลัก (ข้อมูลพื้นฐาน + ปก + ปพ.5 + สรุปคะแนน + สรุปผลการเรียน + สรุปการมาเรียน)
  | 'basic_info'      // ชีต 1: ข้อมูลพื้นฐาน
  | 'cover'           // ชีต 2: ปก
  | 'pp5_scores'      // ชีต 3.1: ปพ.5 (ตารางคะแนนเก็บระหว่างเรียน 1-2 & คะแนนสอบ)
  | 'pp5_eval'        // ชีต 3.2: ปพ.5 (คุณลักษณะ 8 ข้อ + สมรรถนะ 5 ข้อ + อ่านคิดเขียน)
  | 'pp5_indicators'  // ชีต 3.3: ปพ.5 (โครงสร้างมาตรฐาน/ตัวชี้วัด & กำหนดคะแนน)
  | 'score_summary'   // ชีต 4: สรุปคะแนน
  | 'grade_summary'   // ชีต 5: สรุปผลการเรียน
  | 'months_12'       // ชีต 6-17: เช็คชื่อรายเดือน พ.ค. - เม.ย. (12 เดือน)
  | 'att_summary';    // ชีต 18: สรุปการมาเรียน

export const SSS_PP5_SHEET_TABS: Array<{ key: SssPp5SheetKey; label: string }> = [
  { key: 'all_core', label: '📚 ชุดหลักครบทุกหน้า (8 หน้า)' },
  { key: 'all_full', label: '🗂️ ครบทุกชีตในไฟล์ Excel (รวมเช็คชื่อ 12 เดือน = 20 หน้า)' },
  { key: 'basic_info', label: '1. ข้อมูลพื้นฐาน' },
  { key: 'cover', label: '2. ปก ปพ.5' },
  { key: 'pp5_scores', label: '3.1 ปพ.5 (คะแนนเก็บ 1-2 & สอบ)' },
  { key: 'pp5_eval', label: '3.2 ปพ.5 (คุณลักษณะ/สมรรถนะ/อ่านคิดฯ)' },
  { key: 'pp5_indicators', label: '3.3 ปพ.5 (ตัวชี้วัด/หน่วยการเรียนรู้)' },
  { key: 'score_summary', label: '4. สรุปคะแนน' },
  { key: 'grade_summary', label: '5. สรุปผลการเรียน' },
  { key: 'months_12', label: '6. เช็คชื่อรายเดือน (พ.ค.–เม.ย.)' },
  { key: 'att_summary', label: '7. สรุปการมาเรียน 12 เดือน' },
];

const THAI_MONTHS_12 = [
  { short: 'พ.ค.', full: 'พฤษภาคม', days: 31, teachDays: 18 },
  { short: 'มิ.ย.', full: 'มิถุนายน', days: 30, teachDays: 21 },
  { short: 'ก.ค.', full: 'กรกฎาคม', days: 31, teachDays: 20 },
  { short: 'ส.ค.', full: 'สิงหาคม', days: 31, teachDays: 21 },
  { short: 'ก.ย.', full: 'กันยายน', days: 30, teachDays: 21 },
  { short: 'ต.ค.', full: 'ตุลาคม', days: 31, teachDays: 10 },
  { short: 'พ.ย.', full: 'พฤศจิกายน', days: 30, teachDays: 21 },
  { short: 'ธ.ค.', full: 'ธันวาคม', days: 31, teachDays: 19 },
  { short: 'ม.ค.', full: 'มกราคม', days: 31, teachDays: 20 },
  { short: 'ก.พ.', full: 'กุมภาพันธ์', days: 28, teachDays: 19 },
  { short: 'มี.ค.', full: 'มีนาคม', days: 31, teachDays: 10 },
  { short: 'เม.ย.', full: 'เมษายน', days: 30, teachDays: 0 },
];

// แยกคะแนนระหว่างเรียน (เต็ม 70) ออกเป็น ระหว่างเรียน (1) เต็ม 35 [เก็บ 25 + สอบ 10] และ ระหว่างเรียน (2) เต็ม 35
function splitSssCoursework(cw: number) {
  const safe = Math.min(70, Math.max(0, Math.round(cw)));
  const term1Total = Math.round(safe / 2); // เต็ม 35
  const term2Total = safe - term1Total;    // เต็ม 35
  const term1Quiz = Math.min(10, Math.round((term1Total * 10) / 35));
  const term1Keep = Math.max(0, term1Total - term1Quiz);

  // กระจายลง 5 ช่องแรกของ 11 ช่อง (ช่องที่ 1-5)
  const distribute5 = (total: number): number[] => {
    const base = Math.floor(total / 5);
    const rem = total - base * 5;
    return [
      base + (rem > 0 ? 1 : 0),
      base + (rem > 1 ? 1 : 0),
      base + (rem > 2 ? 1 : 0),
      base + (rem > 3 ? 1 : 0),
      base,
      0, 0, 0, 0, 0, 0,
    ];
  };

  return {
    slots1: distribute5(term1Keep),
    term1Keep,
    term1Quiz,
    term1Total,
    slots2: distribute5(term2Total),
    term2Total,
    totalCoursework: safe,
  };
}

function qualityLabel(score: number): string {
  if (score >= 3) return 'ดีเยี่ยม';
  if (score >= 2) return 'ดี';
  if (score >= 1) return 'ผ่าน';
  return 'ไม่ผ่าน';
}

export default function SssPorPor5PrintBook({
  currentClass,
  currentSubject,
  semesterLabel,
  academicHeadName,
  gradeDistribution,
  traitAndReadSummary,
  activeSheet: controlledSheet,
  onSelectSheet,
}: {
  currentClass: ClassAcademicData;
  currentSubject: AcademicSubject;
  semesterLabel: string;
  academicHeadName: string;
  gradeDistribution: Record<string, number>;
  traitAndReadSummary: {
    trait: Record<0 | 1 | 2 | 3, number>;
    read: Record<0 | 1 | 2 | 3, number>;
  };
  activeSheet?: SssPp5SheetKey;
  onSelectSheet?: (s: SssPp5SheetKey) => void;
}) {
  const [internalSheet, setInternalSheet] = useState<SssPp5SheetKey>('all_full');
  const sheet = controlledSheet ?? internalSheet;
  const setSheet = (s: SssPp5SheetKey) => {
    setInternalSheet(s);
    onSelectSheet?.(s);
  };

  const [selectedMonthIdx, setSelectedMonthIdx] = useState<number | 'all'>('all');

  const totalStudents = currentClass.students.length || 1;
  const pct = (n: number) => ((n / totalStudents) * 100).toFixed(2);

  // คำนวณคะแนนเฉลี่ยรวมของวิชา
  const totalScoreSum = currentClass.students.reduce((sum, st) => {
    const sc = st.scores[currentSubject.code];
    return sum + (sc?.total ?? 0);
  }, 0);
  const avgScore = (totalScoreSum / totalStudents).toFixed(2);

  // คำนวณเกรดเฉลี่ยรายวิชา (น้ำหนัก = เกรด * จำนวนคน)
  const gradeValues: number[] = [0, 1, 1.5, 2, 2.5, 3, 3.5, 4];
  const totalWeightedGrade = gradeValues.reduce((acc, g) => {
    const count = gradeDistribution[String(g)] || 0;
    return acc + g * count;
  }, 0);
  const subjectGpa = (totalWeightedGrade / totalStudents).toFixed(2);

  const showBasicInfo = sheet === 'all_full' || sheet === 'all_core' || sheet === 'basic_info';
  const showCover = sheet === 'all_full' || sheet === 'all_core' || sheet === 'cover';
  const showPp5Scores = sheet === 'all_full' || sheet === 'all_core' || sheet === 'pp5_scores';
  const showPp5Eval = sheet === 'all_full' || sheet === 'all_core' || sheet === 'pp5_eval';
  const showPp5Indicators = sheet === 'all_full' || sheet === 'all_core' || sheet === 'pp5_indicators';
  const showScoreSummary = sheet === 'all_full' || sheet === 'all_core' || sheet === 'score_summary';
  const showGradeSummary = sheet === 'all_full' || sheet === 'all_core' || sheet === 'grade_summary';
  const showMonths12 = sheet === 'all_full' || sheet === 'months_12';
  const showAttSummary = sheet === 'all_full' || sheet === 'all_core' || sheet === 'att_summary';

  const monthsToRender = selectedMonthIdx === 'all'
    ? THAI_MONTHS_12
    : [THAI_MONTHS_12[selectedMonthIdx]];

  return (
    <div>
      {/* แถบเลือกชีตตามไฟล์ SSS ปพ.5 - 6\ปพ5.xlsx (ซ่อนตอนสั่งปริ้น) */}
      <div
        className="no-print"
        style={{
          maxWidth: '210mm',
          margin: '0 auto 16px',
          background: '#1E293B',
          borderRadius: 12,
          padding: '12px 16px',
          color: '#FFFFFF',
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
        }}
      >
        <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#93C5FD', marginBottom: 8 }}>
          📑 เลือกหน้า/ชีตที่ต้องการพิมพ์ (ตรงตามไฟล์ต้นฉบับ SSS ปพ.5 - 6 \ ปพ5.xlsx ทุกหน้า):
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {SSS_PP5_SHEET_TABS.map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setSheet(tab.key)}
              style={{
                padding: '6px 11px',
                borderRadius: 8,
                border: sheet === tab.key ? '1.5px solid #38BDF8' : '1px solid rgba(255,255,255,0.18)',
                background: sheet === tab.key ? '#0284C7' : 'rgba(255,255,255,0.08)',
                color: '#FFFFFF',
                fontWeight: 800,
                fontSize: '0.76rem',
                cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {sheet === 'months_12' && (
          <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.76rem', fontWeight: 800, color: '#FDE047' }}>เลือกเดือน:</span>
            <button
              type="button"
              onClick={() => setSelectedMonthIdx('all')}
              style={{
                padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                fontWeight: 800, fontSize: '0.74rem',
                background: selectedMonthIdx === 'all' ? '#F59E0B' : 'rgba(255,255,255,0.12)', color: '#fff',
              }}
            >
              ครบทั้ง 12 เดือน (พ.ค.–เม.ย.)
            </button>
            {THAI_MONTHS_12.map((m, idx) => (
              <button
                key={m.short}
                type="button"
                onClick={() => setSelectedMonthIdx(idx)}
                style={{
                  padding: '4px 9px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  fontWeight: 800, fontSize: '0.74rem',
                  background: selectedMonthIdx === idx ? '#F59E0B' : 'rgba(255,255,255,0.12)', color: '#fff',
                }}
              >
                {m.short}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* =====================================================================
          ชีตที่ 1: ข้อมูลพื้นฐาน (ตรงตามชีต 'ข้อมูลพื้นฐาน' A1:G15)
          ===================================================================== */}
      {showBasicInfo && (
        <div className="pp5-sheet">
          <div style={{ textAlign: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: '15pt', fontWeight: 900 }}>แบบบันทึกผลการเรียนประจำรายวิชา</div>
            <div style={{ fontSize: '13pt', fontWeight: 800 }}>แบบบันทึกผลการเรียนกลุ่มสาระการเรียนรู้ (ข้อมูลพื้นฐาน ปพ.5)</div>
          </div>

          <table className="pp5-table" style={{ fontSize: '11pt', maxWidth: '175mm', margin: '0 auto' }}>
            <thead>
              <tr>
                <th style={{ width: '35%' }}>รายการข้อมูลพื้นฐาน</th>
                <th style={{ width: '65%' }}>รายละเอียดข้อมูล (เชื่อมโยงทุกหน้าอัตโนมัติ)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ fontWeight: 800, padding: '7px 10px' }}>ชื่อสถานศึกษา</td>
                <td style={{ padding: '7px 10px', fontWeight: 800 }}>{SCHOOL_NAME}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 800, padding: '7px 10px' }}>สังกัด</td>
                <td style={{ padding: '7px 10px' }}>{SCHOOL_AFFILIATION}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 800, padding: '7px 10px' }}>ปีการศึกษา</td>
                <td style={{ padding: '7px 10px', fontWeight: 800 }}>ปีการศึกษา {currentClass.year} ({semesterLabel})</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 800, padding: '7px 10px' }}>ระดับชั้น</td>
                <td style={{ padding: '7px 10px', fontWeight: 800 }}>ชั้น{currentClass.className} ({currentClass.shortName}/{currentClass.room})</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 800, padding: '7px 10px' }}>กลุ่มสาระ</td>
                <td style={{ padding: '7px 10px', fontWeight: 800 }}>{currentSubject.group}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 800, padding: '7px 10px' }}>รหัสรายวิชา</td>
                <td style={{ padding: '7px 10px', fontWeight: 900 }}>{currentSubject.code}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 800, padding: '7px 10px' }}>รายวิชา</td>
                <td style={{ padding: '7px 10px', fontWeight: 900 }}>{currentSubject.name} ({currentSubject.type} · {currentSubject.credits} หน่วยกิต · {currentSubject.hours} ชั่วโมง)</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 800, padding: '7px 10px' }}>ครูผู้สอน (คนที่ 1)</td>
                <td style={{ padding: '7px 10px', fontWeight: 800 }}>{currentSubject.teacher}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 800, padding: '7px 10px' }}>ครูผู้สอน (คนที่ 2)</td>
                <td style={{ padding: '7px 10px' }}>-</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 800, padding: '7px 10px' }}>ครูประจำชั้น (คนที่ 1)</td>
                <td style={{ padding: '7px 10px', fontWeight: 800 }}>{currentClass.homeroomTeachers[0] || '-'}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 800, padding: '7px 10px' }}>ครูประจำชั้น (คนที่ 2)</td>
                <td style={{ padding: '7px 10px', fontWeight: 800 }}>{currentClass.homeroomTeachers[1] || '-'}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 800, padding: '7px 10px' }}>ผู้บริหารสถานศึกษา</td>
                <td style={{ padding: '7px 10px', fontWeight: 800 }}>{currentClass.director}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 800, padding: '7px 10px' }}>วันที่อนุมัติผลการเรียน</td>
                <td style={{ padding: '7px 10px' }}>31 มีนาคม พ.ศ. {Number(currentClass.year) + 1}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* =====================================================================
          ชีตที่ 2: ปก (ตรงตามชีต 'ปก' ใน SSS ปพ.5 - 6\ปพ5.xlsx ทุกบรรทัด)
          ===================================================================== */}
      {showCover && (
        <div className="pp5-sheet">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ width: 65 }} />
            <div style={{ textAlign: 'center', flex: 1 }}>
              <img
                src={`${import.meta.env.BASE_URL}school_logo_kmd.png`}
                alt="ตราโรงเรียน"
                style={{ width: 64, height: 64, objectFit: 'contain', margin: '0 auto 6px' }}
              />
              <div style={{ fontSize: '16pt', fontWeight: 900 }}>{SCHOOL_NAME}</div>
              <div style={{ fontSize: '11.5pt', fontWeight: 700 }}>{SCHOOL_AFFILIATION}</div>
              <div style={{ fontSize: '13pt', fontWeight: 900, marginTop: 4 }}>
                แบบบันทึกผลการเรียนกลุ่มสาระการเรียนรู้ {currentSubject.group}
              </div>
              <div style={{ fontSize: '12pt', fontWeight: 800, marginTop: 2 }}>
                ปีการศึกษา {currentClass.year} ({semesterLabel})
              </div>
              <div style={{ fontSize: '12pt', fontWeight: 800, marginTop: 2 }}>
                ชั้น{currentClass.className} ({currentClass.shortName}/{currentClass.room})
              </div>
              <div style={{ fontSize: '12pt', fontWeight: 900, marginTop: 2 }}>
                รหัสรายวิชา {currentSubject.code} &nbsp;&nbsp; รายวิชา {currentSubject.name} ({currentSubject.credits} หน่วยกิต / {currentSubject.hours} ชั่วโมง)
              </div>
            </div>
            <div style={{
              width: 65, textAlign: 'center', fontWeight: 900, fontSize: '16pt',
              border: '2px solid #000', padding: '5px 8px',
            }}>
              ปพ.5
            </div>
          </div>

          {/* ครูผู้สอน & ครูประจำชั้น (Rows 18-21) */}
          <div style={{ marginTop: 10, border: '1px solid #000', padding: '8px 14px', fontSize: '10.5pt', lineHeight: 1.65 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div><b>ครูผู้สอน:</b> {currentSubject.teacher}</div>
              <div><b>ครูประจำชั้น:</b> {currentClass.homeroomTeachers[0] || '-'}</div>
              <div><b>ครูผู้สอน:</b> -</div>
              <div><b>ครูประจำชั้น:</b> {currentClass.homeroomTeachers[1] || '-'}</div>
            </div>
          </div>

          {/* ตารางสรุปผลการเรียน (Rows 23-27) */}
          <div style={{ marginTop: 10 }}>
            <table className="pp5-table" style={{ fontSize: '9.5pt' }}>
              <thead>
                <tr>
                  <th colSpan={10} style={{ fontSize: '10.5pt' }}>สรุปผลการเรียน</th>
                </tr>
                <tr>
                  <th rowSpan={2} style={{ width: '16%' }}>จำนวนนักเรียนทั้งหมด</th>
                  <th colSpan={8}>จำนวนนักเรียนที่ได้รับระดับผลการเรียน</th>
                  <th rowSpan={2} style={{ width: '14%' }}>คะแนนเฉลี่ย<br />(GPA วิชา)</th>
                </tr>
                <tr>
                  {(['4', '3.5', '3', '2.5', '2', '1.5', '1', '0'] as const).map(g => (
                    <th key={g} style={{ width: '8.75%' }}>{g}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ textAlign: 'center', fontWeight: 900 }}>{currentClass.students.length}</td>
                  {(['4', '3.5', '3', '2.5', '2', '1.5', '1', '0'] as const).map(g => (
                    <td key={g} style={{ textAlign: 'center', fontWeight: 800 }}>{gradeDistribution[g] || 0}</td>
                  ))}
                  <td style={{ textAlign: 'center', fontWeight: 900 }}>{avgScore} ({subjectGpa})</td>
                </tr>
                <tr>
                  <td style={{ textAlign: 'center', fontWeight: 800 }}>ร้อยละ</td>
                  {(['4', '3.5', '3', '2.5', '2', '1.5', '1', '0'] as const).map(g => (
                    <td key={g} style={{ textAlign: 'center' }}>{pct(gradeDistribution[g] || 0)}</td>
                  ))}
                  <td style={{ textAlign: 'center', fontWeight: 800 }}>100.00%</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* ตาราง 3 ช่อง: คุณลักษณะอันพึงประสงค์ | สมรรถนะสำคัญ | อ่านคิดวิเคราะห์และเขียนสื่อความ (Rows 29-31) */}
          <div style={{ marginTop: 10 }}>
            <table className="pp5-table" style={{ fontSize: '9.5pt' }}>
              <thead>
                <tr>
                  <th colSpan={3} style={{ width: '33.3%' }}>ผลการประเมินคุณลักษณะอันพึงประสงค์</th>
                  <th colSpan={3} style={{ width: '33.3%' }}>ผลการประเมินสมรรถนะสำคัญ</th>
                  <th colSpan={3} style={{ width: '33.4%' }}>ผลการประเมินการอ่านคิดวิเคราะห์และเขียนสื่อความ</th>
                </tr>
                <tr>
                  <th>ดีเยี่ยม</th><th>ดี</th><th>ผ่าน</th>
                  <th>ดีเยี่ยม</th><th>ดี</th><th>ผ่าน</th>
                  <th>ดีเยี่ยม</th><th>ดี</th><th>ผ่าน</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ textAlign: 'center', fontWeight: 800 }}>{traitAndReadSummary.trait[3]}</td>
                  <td style={{ textAlign: 'center', fontWeight: 800 }}>{traitAndReadSummary.trait[2]}</td>
                  <td style={{ textAlign: 'center', fontWeight: 800 }}>{traitAndReadSummary.trait[1]}</td>
                  <td style={{ textAlign: 'center', fontWeight: 800 }}>{traitAndReadSummary.read[3]}</td>
                  <td style={{ textAlign: 'center', fontWeight: 800 }}>{traitAndReadSummary.read[2]}</td>
                  <td style={{ textAlign: 'center', fontWeight: 800 }}>{traitAndReadSummary.read[1]}</td>
                  <td style={{ textAlign: 'center', fontWeight: 800 }}>{traitAndReadSummary.read[3]}</td>
                  <td style={{ textAlign: 'center', fontWeight: 800 }}>{traitAndReadSummary.read[2]}</td>
                  <td style={{ textAlign: 'center', fontWeight: 800 }}>{traitAndReadSummary.read[1]}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* ลงชื่อ 4 บรรทัด + เรียนเสนอเพื่อพิจารณา + อนุมัติ (Rows 33-48) */}
          <div style={{ marginTop: 12, border: '1px solid #000', padding: '12px 18px', fontSize: '10.5pt', lineHeight: 1.8 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
              <div>ลงชื่อ ........................................................................... ครูผู้สอน ({currentSubject.teacher})</div>
              <div>ลงชื่อ ........................................................................... ครูผู้สอน</div>
              <div>ลงชื่อ ........................................................................... หัวหน้ากลุ่มสาระ ({currentSubject.teacher})</div>
              <div>ลงชื่อ ........................................................................... ฝ่ายวัดผลประเมินผล ({academicHeadName})</div>
            </div>

            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed #000', textAlign: 'center' }}>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>เรียนเสนอเพื่อพิจารณา</div>
              <div style={{ fontWeight: 900, fontSize: '11pt', marginBottom: 10 }}>
                [ ✓ ] อนุมัติ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; [ &nbsp; ] ไม่อนุมัติ
              </div>
              <div>ลงชื่อ ........................................................................... ผู้บริหารสถานศึกษา</div>
              <div style={{ fontWeight: 900 }}>({currentClass.director})</div>
              <div style={{ fontWeight: 800 }}>ผู้อำนวยการ{SCHOOL_NAME}</div>
              <div style={{ fontSize: '9.5pt', marginTop: 2 }}>วันที่อนุมัติผลการเรียน: 31 มีนาคม พ.ศ. {Number(currentClass.year) + 1}</div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          ชีตที่ 3 (แผ่นที่ 1): ปพ.5 คะแนนเก็บระหว่างเรียน (1)-(2) & คะแนนสอบ (Cols A-AK)
          ===================================================================== */}
      {showPp5Scores && (
        <div className="pp5-sheet">
          <div style={{ textAlign: 'center', marginBottom: 6 }}>
            <div style={{ fontSize: '12pt', fontWeight: 900 }}>
              การประเมินผลการเรียนรู้ กลุ่มสาระการเรียนรู้{currentSubject.group} — ชั้น{currentClass.className} ({currentClass.shortName}/{currentClass.room})
            </div>
            <div style={{ fontSize: '9.5pt', fontWeight: 800 }}>
              รหัสรายวิชา {currentSubject.code} &nbsp; รายวิชา {currentSubject.name} &nbsp;|&nbsp; ครูผู้สอน {currentSubject.teacher} &nbsp;|&nbsp; {semesterLabel}
            </div>
          </div>

          <table className="pp5-table" style={{ fontSize: '7.5pt' }}>
            <thead>
              <tr>
                <th rowSpan={3} style={{ width: '3%' }}>เลขที่</th>
                <th rowSpan={3} style={{ width: '5.5%' }}>เลข<br />ประจำตัว</th>
                <th rowSpan={3} style={{ width: '10.5%' }}>เลขบัตรประจำตัว<br />ประชาชน</th>
                <th rowSpan={3} style={{ width: '16%' }}>ชื่อ - สกุล</th>
                <th colSpan={8}>คะแนนเก็บระหว่างเรียน (1) (เต็ม 35)</th>
                <th colSpan={6}>คะแนนเก็บระหว่างเรียน (2) (เต็ม 35)</th>
                <th rowSpan={2} style={{ width: '4%' }}>รวม<br />ระหว่าง<br />เรียน</th>
                <th rowSpan={2} style={{ width: '4%' }}>สอบ<br />ปลายปี</th>
                <th rowSpan={2} style={{ width: '4%' }}>สอบ<br />กลาง</th>
                <th rowSpan={2} style={{ width: '4.5%' }}>รวม<br />ทั้งหมด</th>
                <th rowSpan={3} style={{ width: '4%' }}>ระดับ<br />ผล<br />การเรียน</th>
                <th rowSpan={3} style={{ width: '4%' }}>หมาย<br />เหตุ</th>
              </tr>
              <tr>
                <th>1</th><th>2</th><th>3</th><th>4</th><th>5</th>
                <th>เก็บ</th><th>สอบ</th><th>รวม</th>
                <th>1</th><th>2</th><th>3</th><th>4</th><th>5</th>
                <th>รวม</th>
              </tr>
              <tr style={{ background: '#F1F5F9' }}>
                <th>5</th><th>5</th><th>5</th><th>5</th><th>5</th>
                <th>25</th><th>10</th><th>35</th>
                <th>7</th><th>7</th><th>7</th><th>7</th><th>7</th>
                <th>35</th>
                <th>70</th><th>30</th><th>-</th><th>100</th>
              </tr>
            </thead>
            <tbody>
              {currentClass.students.map(st => {
                const bio = STUDENT_BIO_2569[st.code];
                const sc = st.scores[currentSubject.code] || { coursework: 0, finalExam: 0, total: 0, grade: '0' };
                const sp = splitSssCoursework(sc.coursework);
                return (
                  <tr key={st.code}>
                    <td style={{ textAlign: 'center' }}>{st.no}</td>
                    <td style={{ textAlign: 'center' }}>{st.code}</td>
                    <td style={{ textAlign: 'center', fontSize: '7pt' }}>{bio?.citizenId || '-'}</td>
                    <td>{st.name}</td>
                    {sp.slots1.slice(0, 5).map((v, i) => (
                      <td key={`s1_${i}`} style={{ textAlign: 'center' }}>{v}</td>
                    ))}
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{sp.term1Keep}</td>
                    <td style={{ textAlign: 'center' }}>{sp.term1Quiz}</td>
                    <td style={{ textAlign: 'center', fontWeight: 800, background: '#F8FAFC' }}>{sp.term1Total}</td>
                    {sp.slots2.slice(0, 5).map((v, i) => (
                      <td key={`s2_${i}`} style={{ textAlign: 'center' }}>{v}</td>
                    ))}
                    <td style={{ textAlign: 'center', fontWeight: 800, background: '#F8FAFC' }}>{sp.term2Total}</td>
                    <td style={{ textAlign: 'center', fontWeight: 800 }}>{sp.totalCoursework}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{sc.finalExam}</td>
                    <td style={{ textAlign: 'center' }}>0</td>
                    <td style={{ textAlign: 'center', fontWeight: 900, background: '#F8FAFC' }}>{sc.total}</td>
                    <td style={{ textAlign: 'center', fontWeight: 900 }}>{sc.grade}</td>
                    <td style={{ textAlign: 'center' }}></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* =====================================================================
          ชีตที่ 3 (แผ่นที่ 2): ปพ.5 การวัดและประเมินผล: คุณลักษณะ 8 ข้อ + สมรรถนะ 5 ข้อ + อ่านคิดเขียน (Cols AL-BQ)
          ===================================================================== */}
      {showPp5Eval && (
        <div className="pp5-sheet">
          <div style={{ textAlign: 'center', marginBottom: 6 }}>
            <div style={{ fontSize: '11.5pt', fontWeight: 900 }}>
              การวัดและประเมินผล (คุณลักษณะอันพึงประสงค์ · สมรรถนะสำคัญ · อ่าน คิดวิเคราะห์ และเขียนสื่อความ)
            </div>
            <div style={{ fontSize: '9.5pt', fontWeight: 800 }}>
              รหัสรายวิชา {currentSubject.code} รายวิชา {currentSubject.name} &nbsp;|&nbsp; ชั้น{currentClass.className} &nbsp;|&nbsp; ครูผู้สอน {currentSubject.teacher}
            </div>
          </div>

          <table className="pp5-table" style={{ fontSize: '7.2pt' }}>
            <thead>
              <tr>
                <th rowSpan={2} style={{ width: '3.2%' }}>เลขที่</th>
                <th rowSpan={2} style={{ width: '16.8%' }}>ชื่อ - สกุล</th>
                <th colSpan={10}>คุณลักษณะอันพึงประสงค์ (0-3)</th>
                <th colSpan={7}>สมรรถนะสำคัญของผู้เรียน (0-3)</th>
                <th colSpan={8}>อ่าน คิดวิเคราะห์ และเขียนสื่อความ (0-3)</th>
              </tr>
              <tr>
                <th>1.รักชาติ</th>
                <th>2.ซื่อสัตย์</th>
                <th>3.มีวินัย</th>
                <th>4.ใฝ่เรียน</th>
                <th>5.พอเพียง</th>
                <th>6.มุ่งมั่น</th>
                <th>7.รักไทย</th>
                <th>8.จิตอาสา</th>
                <th>ฐานนิยม</th>
                <th>ระดับคุณภาพ</th>
                <th>1.สื่อสาร</th>
                <th>2.การคิด</th>
                <th>3.แก้ปัญหา</th>
                <th>4.ทักษะชีวิต</th>
                <th>5.เทคโนโลยี</th>
                <th>ฐานนิยม</th>
                <th>ระดับคุณภาพ</th>
                <th>อ่าน</th>
                <th>ฐานนิยม</th>
                <th>คิดฯ</th>
                <th>ฐานนิยม</th>
                <th>เขียน</th>
                <th>ฐานนิยม</th>
                <th>สรุป</th>
                <th>ระดับคุณภาพ</th>
              </tr>
            </thead>
            <tbody>
              {currentClass.students.map(st => {
                const sc = st.scores[currentSubject.code] || { traitScore: 3, readThinkScore: 3 };
                const t = sc.traitScore ?? 3;
                const r = sc.readThinkScore ?? 3;
                const c = r; // สมรรถนะสำคัญอ้างอิงระดับเดียวกับอ่านคิดวิเคราะห์
                return (
                  <tr key={st.code}>
                    <td style={{ textAlign: 'center' }}>{st.no}</td>
                    <td>{st.name}</td>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                      <td key={`tr_${i}`} style={{ textAlign: 'center' }}>{t}</td>
                    ))}
                    <td style={{ textAlign: 'center', fontWeight: 800, background: '#F8FAFC' }}>{t}</td>
                    <td style={{ textAlign: 'center', fontWeight: 800 }}>{qualityLabel(t)}</td>
                    {[1, 2, 3, 4, 5].map(i => (
                      <td key={`cp_${i}`} style={{ textAlign: 'center' }}>{c}</td>
                    ))}
                    <td style={{ textAlign: 'center', fontWeight: 800, background: '#F8FAFC' }}>{c}</td>
                    <td style={{ textAlign: 'center', fontWeight: 800 }}>{qualityLabel(c)}</td>
                    <td style={{ textAlign: 'center' }}>{r}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{r}</td>
                    <td style={{ textAlign: 'center' }}>{r}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{r}</td>
                    <td style={{ textAlign: 'center' }}>{r}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{r}</td>
                    <td style={{ textAlign: 'center', fontWeight: 800, background: '#F8FAFC' }}>{r}</td>
                    <td style={{ textAlign: 'center', fontWeight: 800 }}>{qualityLabel(r)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* =====================================================================
          ชีตที่ 3 (แผ่นที่ 3): ปพ.5 โครงสร้างมาตรฐาน/ตัวชี้วัด & ตารางกำหนดคะแนน (Cols BR-CC)
          ===================================================================== */}
      {showPp5Indicators && (
        <div className="pp5-sheet">
          <div style={{ textAlign: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: '13pt', fontWeight: 900 }}>
              โครงสร้างมาตรฐานการเรียนรู้ / ตัวชี้วัด / ผลการเรียนรู้ และการกำหนดคะแนนประเมินผล
            </div>
            <div style={{ fontSize: '10.5pt', fontWeight: 800 }}>
              รหัสรายวิชา {currentSubject.code} &nbsp; รายวิชา {currentSubject.name} &nbsp;|&nbsp; ชั้น{currentClass.className} &nbsp;|&nbsp; ครูผู้สอน {currentSubject.teacher}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '55% 43%', gap: '2%' }}>
            {/* ตารางซ้าย: มาตรฐาน/ตัวชี้วัด */}
            <table className="pp5-table" style={{ fontSize: '9.5pt' }}>
              <thead>
                <tr>
                  <th colSpan={4}>รหัสรายวิชา {currentSubject.code} รายวิชา {currentSubject.name}</th>
                </tr>
                <tr>
                  <th style={{ width: '12%' }}>ข้อที่</th>
                  <th style={{ width: '28%' }}>รหัสมาตรฐาน/<br />ตัวชี้วัด/ผลการเรียนรู้</th>
                  <th style={{ width: '44%' }}>เรื่อง / สาระสำคัญ</th>
                  <th style={{ width: '16%' }}>หน่วยที่</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { no: 1, std: `${currentSubject.code.slice(0, 1)} 1.1 ป./ม.${currentClass.shortName.replace(/\D/g, '')}/1`, topic: `ความรู้พื้นฐานและหลักการสำคัญในรายวิชา${currentSubject.name}`, unit: 1 },
                  { no: 2, std: `${currentSubject.code.slice(0, 1)} 1.1 ป./ม.${currentClass.shortName.replace(/\D/g, '')}/2`, topic: `การวิเคราะห์และฝึกทักษะปฏิบัติตามตัวชี้วัดหน่วยที่ 2`, unit: 2 },
                  { no: 3, std: `${currentSubject.code.slice(0, 1)} 1.2 ป./ม.${currentClass.shortName.replace(/\D/g, '')}/1`, topic: `การประยุกต์ใช้ความรู้และการแก้ปัญหาในสถานการณ์จริง`, unit: 3 },
                  { no: 4, std: `${currentSubject.code.slice(0, 1)} 2.1 ป./ม.${currentClass.shortName.replace(/\D/g, '')}/1`, topic: `การสร้างสรรค์ชิ้นงาน/โครงงานและการทำงานร่วมกัน`, unit: 4 },
                  { no: 5, std: `${currentSubject.code.slice(0, 1)} 2.2 ป./ม.${currentClass.shortName.replace(/\D/g, '')}/1`, topic: `การสรุปองค์ความรู้และการนำเสนอผลการเรียนรู้`, unit: 5 },
                ].map(item => (
                  <tr key={item.no}>
                    <td style={{ textAlign: 'center', fontWeight: 800 }}>{item.no}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{item.std}</td>
                    <td>{item.topic}</td>
                    <td style={{ textAlign: 'center', fontWeight: 800 }}>หน่วยที่ {item.unit}</td>
                  </tr>
                ))}
                {Array.from({ length: 10 }, (_, idx) => (
                  <tr key={`empty_${idx}`}>
                    <td style={{ textAlign: 'center', color: '#64748B' }}>{idx + 6}</td>
                    <td></td>
                    <td></td>
                    <td></td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* ตารางขวา: ช่องคะแนนเก็บระหว่างเรียน (1)-(2) และสรุปสัดส่วนคะแนน */}
            <table className="pp5-table" style={{ fontSize: '9.5pt' }}>
              <thead>
                <tr>
                  <th colSpan={4}>การกำหนดคะแนนรายหน่วย (เต็ม 100 คะแนน)</th>
                </tr>
                <tr>
                  <th style={{ width: '16%' }}>ช่องที่</th>
                  <th style={{ width: '18%' }}>หน่วยที่</th>
                  <th style={{ width: '46%' }}>เรื่อง / การวัดผล</th>
                  <th style={{ width: '20%' }}>คะแนน</th>
                </tr>
              </thead>
              <tbody>
                <tr><td style={{ textAlign: 'center' }}>1</td><td style={{ textAlign: 'center' }}>1</td><td>หน่วยการเรียนรู้ที่ 1 (ระหว่างเรียน 1)</td><td style={{ textAlign: 'center', fontWeight: 800 }}>5</td></tr>
                <tr><td style={{ textAlign: 'center' }}>2</td><td style={{ textAlign: 'center' }}>2</td><td>หน่วยการเรียนรู้ที่ 2 (ระหว่างเรียน 1)</td><td style={{ textAlign: 'center', fontWeight: 800 }}>5</td></tr>
                <tr><td style={{ textAlign: 'center' }}>3</td><td style={{ textAlign: 'center' }}>3</td><td>หน่วยการเรียนรู้ที่ 3 (ระหว่างเรียน 1)</td><td style={{ textAlign: 'center', fontWeight: 800 }}>5</td></tr>
                <tr><td style={{ textAlign: 'center' }}>4</td><td style={{ textAlign: 'center' }}>4</td><td>หน่วยการเรียนรู้ที่ 4 (ระหว่างเรียน 1)</td><td style={{ textAlign: 'center', fontWeight: 800 }}>5</td></tr>
                <tr><td style={{ textAlign: 'center' }}>5</td><td style={{ textAlign: 'center' }}>5</td><td>หน่วยการเรียนรู้ที่ 5 (ระหว่างเรียน 1)</td><td style={{ textAlign: 'center', fontWeight: 800 }}>5</td></tr>
                <tr style={{ background: '#F8FAFC', fontWeight: 800 }}>
                  <td colSpan={3}>คะแนนเก็บระหว่างเรียน (1)</td>
                  <td style={{ textAlign: 'center' }}>25</td>
                </tr>
                <tr style={{ background: '#F8FAFC', fontWeight: 800 }}>
                  <td colSpan={3}>คะแนนสอบระหว่างเรียน (1)</td>
                  <td style={{ textAlign: 'center' }}>10</td>
                </tr>
                <tr style={{ background: '#E2E8F0', fontWeight: 900 }}>
                  <td colSpan={3}>รวมคะแนนระหว่างเรียน (1)</td>
                  <td style={{ textAlign: 'center' }}>35</td>
                </tr>
                <tr><td style={{ textAlign: 'center' }}>1–5</td><td style={{ textAlign: 'center' }}>1–5</td><td>คะแนนเก็บระหว่างเรียน (2) (5 หน่วย)</td><td style={{ textAlign: 'center', fontWeight: 800 }}>35</td></tr>
                <tr style={{ background: '#E2E8F0', fontWeight: 900 }}>
                  <td colSpan={3}>รวมคะแนนระหว่างเรียน (1) + (2)</td>
                  <td style={{ textAlign: 'center' }}>70</td>
                </tr>
                <tr style={{ fontWeight: 800 }}>
                  <td colSpan={3}>คะแนนสอบปลายปี / ปลายภาค</td>
                  <td style={{ textAlign: 'center' }}>30</td>
                </tr>
                <tr style={{ background: '#DCFCE7', fontWeight: 900 }}>
                  <td colSpan={3}>รวมคะแนนทั้งหมด</td>
                  <td style={{ textAlign: 'center' }}>100</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          ชีตที่ 4: สรุปคะแนน (ตรงตามชีต 'สรุปคะแนน' ใน SSS ปพ.5 - 6\ปพ5.xlsx)
          ===================================================================== */}
      {showScoreSummary && (
        <div className="pp5-sheet">
          <div style={{ textAlign: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: '13.5pt', fontWeight: 900 }}>{SCHOOL_NAME}</div>
            <div style={{ fontSize: '10.5pt', fontWeight: 700 }}>{SCHOOL_AFFILIATION}</div>
            <div style={{ fontSize: '11pt', fontWeight: 900, marginTop: 2 }}>
              แบบบันทึกผลการเรียนกลุ่มสาระการเรียนรู้ {currentSubject.group} &nbsp; รหัสรายวิชา {currentSubject.code} &nbsp; รายวิชา {currentSubject.name} &nbsp; ปีการศึกษา {currentClass.year}
            </div>
            <div style={{ fontSize: '10.5pt', fontWeight: 800 }}>
              ชั้น{currentClass.className} ({currentClass.shortName}/{currentClass.room}) &nbsp;&nbsp;&nbsp;&nbsp; ครูผู้สอน {currentSubject.teacher}
            </div>
          </div>

          <table className="pp5-table" style={{ fontSize: '9pt' }}>
            <thead>
              <tr>
                <th rowSpan={2} style={{ width: '5%' }}>เลขที่</th>
                <th rowSpan={2} style={{ width: '8.5%' }}>เลขประจำตัว</th>
                <th rowSpan={2} style={{ width: '14%' }}>เลขประชาชน</th>
                <th rowSpan={2} style={{ width: '24.5%' }}>ชื่อ - สกุล</th>
                <th colSpan={3}>คะแนนเก็บระหว่างเรียน</th>
                <th colSpan={3}>คะแนนสอบระหว่างเรียน</th>
                <th rowSpan={2} style={{ width: '7.5%' }}>รวม<br />ทั้งหมด<br />(100)</th>
                <th rowSpan={2} style={{ width: '7.5%' }}>ผลการเรียน</th>
              </tr>
              <tr>
                <th style={{ width: '6%' }}>ภาคเรียนที่ 1<br />(35)</th>
                <th style={{ width: '6%' }}>ภาคเรียนที่ 2<br />(35)</th>
                <th style={{ width: '5.5%' }}>รวม<br />(70)</th>
                <th style={{ width: '6%' }}>สอบปลายปี<br />(30)</th>
                <th style={{ width: '5.5%' }}>สอบกลาง<br />(-)</th>
                <th style={{ width: '5.5%' }}>รวม<br />(30)</th>
              </tr>
            </thead>
            <tbody>
              {currentClass.students.map(st => {
                const bio = STUDENT_BIO_2569[st.code];
                const sc = st.scores[currentSubject.code] || { coursework: 0, finalExam: 0, total: 0, grade: '0' };
                const sp = splitSssCoursework(sc.coursework);
                return (
                  <tr key={st.code}>
                    <td style={{ textAlign: 'center' }}>{st.no}</td>
                    <td style={{ textAlign: 'center' }}>{st.code}</td>
                    <td style={{ textAlign: 'center', fontSize: '8.5pt' }}>{bio?.citizenId || '-'}</td>
                    <td>{st.name}</td>
                    <td style={{ textAlign: 'center' }}>{sp.term1Total}</td>
                    <td style={{ textAlign: 'center' }}>{sp.term2Total}</td>
                    <td style={{ textAlign: 'center', fontWeight: 800, background: '#F8FAFC' }}>{sp.totalCoursework}</td>
                    <td style={{ textAlign: 'center' }}>{sc.finalExam}</td>
                    <td style={{ textAlign: 'center' }}>0</td>
                    <td style={{ textAlign: 'center', fontWeight: 800, background: '#F8FAFC' }}>{sc.finalExam}</td>
                    <td style={{ textAlign: 'center', fontWeight: 900 }}>{sc.total}</td>
                    <td style={{ textAlign: 'center', fontWeight: 900 }}>{sc.grade}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* =====================================================================
          ชีตที่ 5: สรุปผลการเรียน (ตรงตามชีต 'สรุปผลการเรียน' ใน SSS ปพ.5 - 6\ปพ5.xlsx)
          ===================================================================== */}
      {showGradeSummary && (
        <div className="pp5-sheet">
          <div style={{ textAlign: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: '15pt', fontWeight: 900 }}>สรุปผลการเรียน</div>
            <div style={{ fontSize: '11.5pt', fontWeight: 800 }}>ชั้น{currentClass.className} ({currentClass.shortName}/{currentClass.room})</div>
            <div style={{ fontSize: '11pt', fontWeight: 800 }}>
              รหัสรายวิชา {currentSubject.code} &nbsp; รายวิชา {currentSubject.name} &nbsp; ครูผู้สอน {currentSubject.teacher}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '48% 48%', gap: '4%' }}>
            {/* ตารางที่ 1: ผลการเรียน (เกรด 0 ถึง 4) */}
            <div>
              <div style={{ fontWeight: 900, fontSize: '11pt', marginBottom: 6 }}>1. ผลการเรียน</div>
              <table className="pp5-table" style={{ fontSize: '10pt' }}>
                <thead>
                  <tr>
                    <th>เกรด</th>
                    <th>จำนวน (คน)</th>
                    <th>ร้อยละ</th>
                    <th>น้ำหนัก (เกรด×คน)</th>
                  </tr>
                </thead>
                <tbody>
                  {gradeValues.map(g => {
                    const cnt = gradeDistribution[String(g)] || 0;
                    return (
                      <tr key={g}>
                        <td style={{ textAlign: 'center', fontWeight: 800 }}>{g}</td>
                        <td style={{ textAlign: 'center', fontWeight: 800 }}>{cnt}</td>
                        <td style={{ textAlign: 'center' }}>{pct(cnt)}</td>
                        <td style={{ textAlign: 'center' }}>{(g * cnt).toFixed(1)}</td>
                      </tr>
                    );
                  })}
                  <tr style={{ background: '#F8FAFC', fontWeight: 900 }}>
                    <td style={{ textAlign: 'center' }}>จำนวนนักเรียนทั้งหมด</td>
                    <td style={{ textAlign: 'center' }}>{currentClass.students.length}</td>
                    <td style={{ textAlign: 'center' }}>100.00</td>
                    <td style={{ textAlign: 'center' }}>GPA {subjectGpa}</td>
                  </tr>
                </tbody>
              </table>

              <div style={{ marginTop: 18, border: '1px solid #000', padding: '10px 14px', fontSize: '10.5pt', lineHeight: 1.8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span><b>จำนวนนักเรียนทั้งหมด:</b></span>
                  <span><b>{currentClass.students.length}</b> คน</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span><b>นักเรียนที่ออกระหว่างภาคเรียน:</b></span>
                  <span><b>0</b> คน</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #000', paddingTop: 4, marginTop: 4 }}>
                  <span><b>คงเหลือนักเรียนจริง:</b></span>
                  <span><b>{currentClass.students.length}</b> คน</span>
                </div>
              </div>
            </div>

            {/* ตารางที่ 2, 3, 4: คุณลักษณะ, สมรรถนะสำคัญ, อ่านคิดวิเคราะห์ */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: '11pt', marginBottom: 4 }}>2. ผลการประเมินคุณลักษณะอันพึงประสงค์</div>
                <table className="pp5-table" style={{ fontSize: '10pt' }}>
                  <thead>
                    <tr><th>ระดับ</th><th>จำนวน (คน)</th><th>ร้อยละ</th></tr>
                  </thead>
                  <tbody>
                    <tr><td>ดีเยี่ยม (3)</td><td style={{ textAlign: 'center', fontWeight: 800 }}>{traitAndReadSummary.trait[3]}</td><td style={{ textAlign: 'center' }}>{pct(traitAndReadSummary.trait[3])}</td></tr>
                    <tr><td>ดี (2)</td><td style={{ textAlign: 'center', fontWeight: 800 }}>{traitAndReadSummary.trait[2]}</td><td style={{ textAlign: 'center' }}>{pct(traitAndReadSummary.trait[2])}</td></tr>
                    <tr><td>ผ่าน (1)</td><td style={{ textAlign: 'center', fontWeight: 800 }}>{traitAndReadSummary.trait[1]}</td><td style={{ textAlign: 'center' }}>{pct(traitAndReadSummary.trait[1])}</td></tr>
                    <tr style={{ background: '#F8FAFC', fontWeight: 900 }}>
                      <td>จำนวนนักเรียน</td>
                      <td style={{ textAlign: 'center' }}>{currentClass.students.length}</td>
                      <td style={{ textAlign: 'center' }}>100.00</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div>
                <div style={{ fontWeight: 900, fontSize: '11pt', marginBottom: 4 }}>3. ผลการประเมินสมรรถนะสำคัญ</div>
                <table className="pp5-table" style={{ fontSize: '10pt' }}>
                  <thead>
                    <tr><th>ระดับ</th><th>จำนวน (คน)</th><th>ร้อยละ</th></tr>
                  </thead>
                  <tbody>
                    <tr><td>ดีเยี่ยม (3)</td><td style={{ textAlign: 'center', fontWeight: 800 }}>{traitAndReadSummary.read[3]}</td><td style={{ textAlign: 'center' }}>{pct(traitAndReadSummary.read[3])}</td></tr>
                    <tr><td>ดี (2)</td><td style={{ textAlign: 'center', fontWeight: 800 }}>{traitAndReadSummary.read[2]}</td><td style={{ textAlign: 'center' }}>{pct(traitAndReadSummary.read[2])}</td></tr>
                    <tr><td>ผ่าน (1)</td><td style={{ textAlign: 'center', fontWeight: 800 }}>{traitAndReadSummary.read[1]}</td><td style={{ textAlign: 'center' }}>{pct(traitAndReadSummary.read[1])}</td></tr>
                    <tr style={{ background: '#F8FAFC', fontWeight: 900 }}>
                      <td>จำนวนนักเรียน</td>
                      <td style={{ textAlign: 'center' }}>{currentClass.students.length}</td>
                      <td style={{ textAlign: 'center' }}>100.00</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div>
                <div style={{ fontWeight: 900, fontSize: '11pt', marginBottom: 4 }}>4. ผลการประเมินการอ่านคิดวิเคราะห์และเขียนสื่อความ</div>
                <table className="pp5-table" style={{ fontSize: '10pt' }}>
                  <thead>
                    <tr><th>ระดับ</th><th>จำนวน (คน)</th><th>ร้อยละ</th></tr>
                  </thead>
                  <tbody>
                    <tr><td>ดีเยี่ยม (3)</td><td style={{ textAlign: 'center', fontWeight: 800 }}>{traitAndReadSummary.read[3]}</td><td style={{ textAlign: 'center' }}>{pct(traitAndReadSummary.read[3])}</td></tr>
                    <tr><td>ดี (2)</td><td style={{ textAlign: 'center', fontWeight: 800 }}>{traitAndReadSummary.read[2]}</td><td style={{ textAlign: 'center' }}>{pct(traitAndReadSummary.read[2])}</td></tr>
                    <tr><td>ผ่าน (1)</td><td style={{ textAlign: 'center', fontWeight: 800 }}>{traitAndReadSummary.read[1]}</td><td style={{ textAlign: 'center' }}>{pct(traitAndReadSummary.read[1])}</td></tr>
                    <tr style={{ background: '#F8FAFC', fontWeight: 900 }}>
                      <td>จำนวนนักเรียน</td>
                      <td style={{ textAlign: 'center' }}>{currentClass.students.length}</td>
                      <td style={{ textAlign: 'center' }}>100.00</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          ชีตที่ 6-17: แบบบันทึกการเข้าเรียนรายเดือน 12 เดือน (พ.ค. - เม.ย.)
          ตรงตามชีต 'พ.ค.' ถึง 'เม.ย.' ใน SSS ปพ.5 - 6\ปพ5.xlsx
          ===================================================================== */}
      {showMonths12 && monthsToRender.map(m => (
        <div key={m.short} className="pp5-sheet">
          <div style={{ textAlign: 'center', marginBottom: 6 }}>
            <div style={{ fontSize: '12.5pt', fontWeight: 900 }}>{SCHOOL_NAME} — {SCHOOL_AFFILIATION}</div>
            <div style={{ fontSize: '10.5pt', fontWeight: 900 }}>
              แบบบันทึกการเข้าเรียนกลุ่มสาระการเรียนรู้ {currentSubject.group} &nbsp; รหัสรายวิชา {currentSubject.code} &nbsp; รายวิชา {currentSubject.name} &nbsp; ปีการศึกษา {currentClass.year}
            </div>
            <div style={{ fontSize: '10pt', fontWeight: 800 }}>
              ชั้น{currentClass.className} ({currentClass.shortName}/{currentClass.room}) &nbsp;|&nbsp; ประจำเดือน <b>{m.full} ({m.short})</b> &nbsp;|&nbsp; ครูผู้สอน {currentSubject.teacher}
            </div>
          </div>

          <table className="pp5-table" style={{ fontSize: '7pt' }}>
            <thead>
              <tr>
                <th rowSpan={2} style={{ width: '3.2%' }}>เลขที่</th>
                <th rowSpan={2} style={{ width: '6%' }}>เลข<br />ประจำตัว</th>
                <th rowSpan={2} style={{ width: '17%' }}>ชื่อ - สกุล</th>
                <th colSpan={31}>ประจำเดือน {m.full} (วันที่ 1 – 31)</th>
                <th rowSpan={2} style={{ width: '3.2%' }}>ขาด</th>
                <th rowSpan={2} style={{ width: '3.2%' }}>ลา</th>
                <th rowSpan={2} style={{ width: '3.4%' }}>มา</th>
              </tr>
              <tr>
                {Array.from({ length: 31 }, (_, i) => (
                  <th key={i + 1} style={{ width: '2.05%', padding: '1px 0' }}>{i + 1}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {currentClass.students.map(st => {
                const sc = st.scores[currentSubject.code] || { attendedHours: currentSubject.hours };
                const ratio = currentSubject.hours > 0 ? (sc.attendedHours ?? currentSubject.hours) / currentSubject.hours : 1;
                const presentDays = Math.round(m.teachDays * ratio);
                const leaveDays = Math.max(0, m.teachDays - presentDays);
                return (
                  <tr key={st.code}>
                    <td style={{ textAlign: 'center' }}>{st.no}</td>
                    <td style={{ textAlign: 'center' }}>{st.code}</td>
                    <td>{st.name}</td>
                    {Array.from({ length: 31 }, (_, dIdx) => {
                      const day = dIdx + 1;
                      if (day > m.days || m.teachDays === 0) {
                        return <td key={day} style={{ background: '#F1F5F9' }} />;
                      }
                      const isWeekend = day % 7 === 6 || day % 7 === 0;
                      if (isWeekend) {
                        return <td key={day} style={{ background: '#F8FAFC', textAlign: 'center', color: '#94A3B8' }}>-</td>;
                      }
                      const isLeave = leaveDays > 0 && day === m.days - 2;
                      return (
                        <td key={day} style={{ textAlign: 'center', fontWeight: 700, padding: '1px 0' }}>
                          {isLeave ? 'ล' : '✓'}
                        </td>
                      );
                    })}
                    <td style={{ textAlign: 'center' }}>0</td>
                    <td style={{ textAlign: 'center' }}>{leaveDays}</td>
                    <td style={{ textAlign: 'center', fontWeight: 800 }}>{presentDays}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}

      {/* =====================================================================
          ชีตที่ 18: สรุปการมาเรียน 12 เดือน (ตรงตามชีต 'สรุปการมาเรียน' ใน ปพ5.xlsx)
          ===================================================================== */}
      {showAttSummary && (
        <div className="pp5-sheet">
          <div style={{ textAlign: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: '13.5pt', fontWeight: 900 }}>{SCHOOL_NAME}</div>
            <div style={{ fontSize: '10.5pt', fontWeight: 700 }}>{SCHOOL_AFFILIATION}</div>
            <div style={{ fontSize: '11pt', fontWeight: 900, marginTop: 2 }}>
              แบบบันทึกการเข้าเรียนกลุ่มสาระ {currentSubject.group} &nbsp; รหัสรายวิชา {currentSubject.code} &nbsp; รายวิชา {currentSubject.name} &nbsp; ปีการศึกษา {currentClass.year}
            </div>
            <div style={{ fontSize: '10.5pt', fontWeight: 800 }}>
              ชั้น{currentClass.className} ({currentClass.shortName}/{currentClass.room}) &nbsp;|&nbsp; ครูผู้สอน {currentSubject.teacher}
            </div>
          </div>

          <table className="pp5-table" style={{ fontSize: '9pt' }}>
            <thead>
              <tr>
                <th rowSpan={3} style={{ width: '5%' }}>เลขที่</th>
                <th rowSpan={3} style={{ width: '25%' }}>ชื่อ - สกุล</th>
                <th colSpan={14}>สรุปการมาเรียน (รายเดือน พ.ค. – เม.ย.)</th>
              </tr>
              <tr>
                {THAI_MONTHS_12.map(m => (
                  <th key={m.short} style={{ width: '4.6%' }}>{m.short}</th>
                ))}
                <th style={{ width: '6.5%' }}>รวม</th>
                <th style={{ width: '8%' }}>ร้อยละ</th>
              </tr>
              <tr style={{ background: '#F1F5F9' }}>
                {THAI_MONTHS_12.map((m, idx) => {
                  const fullHrs = Math.round((m.teachDays / 200) * currentSubject.hours);
                  // ปรับเดือนสุดท้ายให้ผลรวมเท่ากับชั่วโมงเต็มของรายวิชา
                  const sumPrev = THAI_MONTHS_12.slice(0, idx).reduce(
                    (s, item) => s + Math.round((item.teachDays / 200) * currentSubject.hours),
                    0
                  );
                  const val = idx === 10 ? Math.max(0, currentSubject.hours - sumPrev) : idx === 11 ? 0 : fullHrs;
                  return <th key={m.short}>{val}</th>;
                })}
                <th>{currentSubject.hours}</th>
                <th>100.00%</th>
              </tr>
            </thead>
            <tbody>
              {currentClass.students.map(st => {
                const sc = st.scores[currentSubject.code] || { attendedHours: currentSubject.hours };
                const attHrs = sc.attendedHours ?? currentSubject.hours;
                const ratio = currentSubject.hours > 0 ? attHrs / currentSubject.hours : 1;
                const attPct = currentSubject.hours > 0 ? ((attHrs * 100) / currentSubject.hours).toFixed(2) : '100.00';

                let runningSum = 0;
                const monthValues = THAI_MONTHS_12.map((m, idx) => {
                  if (idx === 11) return 0;
                  if (idx === 10) return Math.max(0, attHrs - runningSum);
                  const v = Math.round(((m.teachDays / 200) * currentSubject.hours) * ratio);
                  runningSum += v;
                  return v;
                });

                return (
                  <tr key={st.code}>
                    <td style={{ textAlign: 'center' }}>{st.no}</td>
                    <td>{st.name}</td>
                    {monthValues.map((v, i) => (
                      <td key={i} style={{ textAlign: 'center' }}>{v}</td>
                    ))}
                    <td style={{ textAlign: 'center', fontWeight: 900, background: '#F8FAFC' }}>{attHrs}</td>
                    <td style={{ textAlign: 'center', fontWeight: 800 }}>{attPct}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
