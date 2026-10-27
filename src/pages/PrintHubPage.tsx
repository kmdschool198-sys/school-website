import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { collection, onSnapshot, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { calculateStudentGPA, calculateClassRanks } from '../data/academicData';
import { useAcademicData } from '../utils/academicStorage';
import { useSchoolRoster } from '../utils/useSchoolRoster';
import { Printer, Download, Calendar, Layers } from 'lucide-react';
import SmartSchoolLayout from '../components/SmartSchoolLayout';
import TeacherLoginGate from '../components/TeacherLoginGate';
import { useTeacherAuth } from '../utils/teacherAuth';
import { downloadCsvReport } from '../utils/csvReport';
import {
  SCHOOL_CALENDAR_COLLECTION,
  resolveSchoolDay,
  type SchoolDayOverride,
} from '../data/schoolCalendar';
import { FORM_INFO, type FormType } from './MonthlyFormPrint';

const THAI_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const DIRECTOR_NAME = 'นายปรัชญา ปรางค์ชัยภูมิ';

interface AttDoc {
  classId: string;
  date: string;
  records: Record<string, { status: string; noMilk?: boolean; noBrush?: boolean; noLunch?: boolean; noDuty?: boolean }>;
}

type InstantDocType =
  | 'milk'
  | 'brush'
  | 'lunch'
  | 'duty'
  | 'attendance'
  | 'academic_class'
  | 'behavior_class';

const INSTANT_DOCS: Array<{
  id: InstantDocType;
  label: string;
  icon: string;
  orientation: 'landscape' | 'portrait';
  color: string;
}> = [
  { id: 'milk', label: 'บันทึกดื่มนม (รายเดือน)', icon: '🥛', orientation: 'landscape', color: '#2563EB' },
  { id: 'brush', label: 'บันทึกแปรงฟัน (รายเดือน)', icon: '🪥', orientation: 'landscape', color: '#0891B2' },
  { id: 'lunch', label: 'บันทึกอาหารกลางวัน (รายเดือน)', icon: '🍱', orientation: 'landscape', color: '#EA580C' },
  { id: 'duty', label: 'บันทึกเวรความสะอาด (รายเดือน)', icon: '🧹', orientation: 'landscape', color: '#16A34A' },
  { id: 'attendance', label: 'บันทึกเวลาเรียน/เช็คชื่อ (รายเดือน)', icon: '📋', orientation: 'landscape', color: '#4F46E5' },
  { id: 'academic_class', label: 'สรุปเกรดเฉลี่ย & ผลการเรียนประจำชั้น', icon: '📊', orientation: 'portrait', color: '#D97706' },
  { id: 'behavior_class', label: 'สรุปคะแนนความประพฤติประจำชั้น', icon: '🛡️', orientation: 'portrait', color: '#DC2626' },
];

export default function PrintHubPage() {
  const auth = useTeacherAuth();
  if (!auth.authed) {
    return <TeacherLoginGate title="🖨️ ศูนย์รวมการพิมพ์ (One-Stop Print Hub)" />;
  }
  return <OneStopPrintHub />;
}

function OneStopPrintHub() {
  const { classesData } = useAcademicData();
  const { classes: availableRooms } = useSchoolRoster();
  const [selectedRoomId, setSelectedRoomId] = useState<string>('p1_1');
  const [month, setMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [instantDoc, setInstantDoc] = useState<InstantDocType>('milk');
  const [docs, setDocs] = useState<AttDoc[]>([]);
  const [holidays, setHolidays] = useState<Record<string, string>>({});
  const [schoolDays, setSchoolDays] = useState<Record<string, SchoolDayOverride>>({});

  useEffect(() => {
    if (availableRooms.length && !availableRooms.some(r => r.id === selectedRoomId)) {
      setSelectedRoomId(availableRooms[0].id);
    }
  }, [availableRooms, selectedRoomId]);

  useEffect(() => {
    if (!selectedRoomId) return;
    (async () => {
      try {
        const snap = await getDocs(query(collection(db, 'attendance'), where('classId', '==', selectedRoomId)));
        const arr: AttDoc[] = [];
        snap.forEach(d => arr.push(d.data() as AttDoc));
        setDocs(arr);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [selectedRoomId]);

  useEffect(() => {
    return onSnapshot(collection(db, 'activities'), snap => {
      const map: Record<string, string> = {};
      snap.forEach(d => {
        const a = d.data() as any;
        if (a.isHoliday && a.date) map[a.date] = a.title || 'วันหยุด';
      });
      setHolidays(map);
    });
  }, []);

  useEffect(() => {
    return onSnapshot(collection(db, SCHOOL_CALENDAR_COLLECTION), snap => {
      const map: Record<string, SchoolDayOverride> = {};
      snap.forEach(d => { map[d.id] = { date: d.id, ...(d.data() as Omit<SchoolDayOverride, 'date'>) }; });
      setSchoolDays(map);
    });
  }, []);

  const currentRoom = availableRooms.find(r => r.id === selectedRoomId) || availableRooms[0];
  const currentAcadClass = useMemo(
    () => classesData.find(c => c.classId === currentRoom?.acadId) || classesData[0],
    [classesData, currentRoom]
  );

  const [yearStr, monStr] = month.split('-');
  const year = Number(yearStr);
  const monthNum = Number(monStr);
  const daysInMonthCount = new Date(year, monthNum, 0).getDate();
  const days = Array.from({ length: daysInMonthCount }, (_, i) => i + 1);

  const isMonthlyGridDoc =
    instantDoc === 'milk' ||
    instantDoc === 'brush' ||
    instantDoc === 'lunch' ||
    instantDoc === 'duty' ||
    instantDoc === 'attendance';

  const formInfo = isMonthlyGridDoc ? FORM_INFO[instantDoc as FormType] : FORM_INFO.milk;

  const didTarget = (rec: { status: string; noMilk?: boolean; noBrush?: boolean; noLunch?: boolean; noDuty?: boolean }) => {
    if (rec.status !== 'present') return false;
    if (instantDoc === 'milk') return !rec.noMilk;
    if (instantDoc === 'brush') return !rec.noBrush;
    if (instantDoc === 'lunch') return !rec.noLunch;
    if (instantDoc === 'duty') return !rec.noDuty;
    return true;
  };

  const statusFor = (studentId: string, day: number): string => {
    const dateStr = `${yearStr}-${monStr}-${String(day).padStart(2, '0')}`;
    const closed = !resolveSchoolDay(dateStr, schoolDays, holidays).open;
    const docItem = docs.find(d => d.date === dateStr);
    if (!docItem) return closed ? '/' : '';
    const rec = docItem.records?.[studentId];
    if (!rec) return closed ? '/' : '';
    if (rec.status === 'present') return didTarget(rec) ? formInfo.mark : formInfo.missMark;
    if (rec.status === 'absent') return formInfo.missMark;
    if (rec.status === 'leave') return instantDoc === 'attendance' ? 'ล' : formInfo.missMark;
    return '';
  };

  const summaryFor = (studentId: string) => {
    let present = 0;
    let totalDays = 0;
    days.forEach(d => {
      const dateStr = `${yearStr}-${monStr}-${String(d).padStart(2, '0')}`;
      const docItem = docs.find(x => x.date === dateStr);
      const rec = docItem?.records?.[studentId];
      if (!rec) return;
      totalDays++;
      if (didTarget(rec)) present++;
    });
    return { present, totalDays };
  };

  const exportCurrentPreviewCsv = () => {
    if (!currentRoom) return;
    if (isMonthlyGridDoc) {
      const rows: Array<Array<string | number>> = [
        [`${formInfo.title} โรงเรียนบ้านคลองมดแดง`],
        [`ชั้น ${currentRoom.label}`, `ประจำเดือน ${THAI_MONTHS[monthNum - 1]} พ.ศ. ${year + 543}`],
        [],
        ['ที่', 'รหัสนักเรียน', 'ชื่อ-สกุล', ...days.map(String), 'สรุปผล'],
        ...currentRoom.students.map((st, idx) => {
          const sum = summaryFor(st.id);
          return [
            idx + 1,
            st.code || st.id,
            st.name,
            ...days.map(d => statusFor(st.id, d) || '-'),
            instantDoc === 'attendance' ? `${sum.present}/${sum.totalDays}` : `${sum.present} ครั้ง`,
          ];
        }),
      ];
      downloadCsvReport(`${formInfo.title}_${currentRoom.label}_${month}.csv`, rows);
    } else if (instantDoc === 'academic_class') {
      const ranks = calculateClassRanks(currentAcadClass.students, currentAcadClass.subjects);
      const rows: Array<Array<string | number>> = [
        [`สรุปผลการเรียนและเกรดเฉลี่ยประจำชั้น ${currentAcadClass.className}`],
        ['เลขที่', 'รหัส', 'ชื่อ-สกุล', ...currentAcadClass.subjects.map(s => s.code), 'GPA', 'ลำดับที่'],
        ...currentAcadClass.students.map(st => [
          st.no,
          st.code,
          st.name,
          ...currentAcadClass.subjects.map(s => st.scores[s.code]?.grade ?? '-'),
          calculateStudentGPA(st, currentAcadClass.subjects).gpaFormatted,
          ranks[st.code]?.rank || 1,
        ]),
      ];
      downloadCsvReport(`สรุปผลการเรียน_${currentAcadClass.shortName}.csv`, rows);
    }
  };

  const currentDocConfig = INSTANT_DOCS.find(d => d.id === instantDoc) || INSTANT_DOCS[0];

  return (
    <SmartSchoolLayout pageTitle="ศูนย์รวมการพิมพ์ (One-Stop Print Portal)">
      <div className="no-print">
        {/* Title Banner */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.38rem', fontWeight: 900, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Printer size={26} color="#EF4444" /> ศูนย์รวมการพิมพ์เอกสารราชการ (One-Stop Print Portal)
            </h1>
            <div style={{ fontSize: '0.84rem', color: '#64748B', marginTop: 2 }}>
              เลือก <b>ระดับชั้น + เดือน + ประเภทแบบฟอร์ม</b> แล้วกดสั่งพิมพ์กระดาษ A4 ได้ครบจบในหน้าเดียว
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={exportCurrentPreviewCsv}
              style={{
                background: '#15803D', color: 'white', border: 'none',
                borderRadius: 999, padding: '10px 18px', fontWeight: 800, fontSize: '0.85rem',
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              <Download size={16} /> ส่งออก CSV ฟอร์มนี้
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              style={{
                background: '#1D4ED8', color: 'white', border: 'none',
                borderRadius: 999, padding: '10px 22px', fontWeight: 900, fontSize: '0.9rem',
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8,
                boxShadow: '0 6px 18px rgba(29,78,216,0.3)',
              }}
            >
              <Printer size={18} /> สั่งพิมพ์แบบฟอร์มนี้ทันที (Print A4)
            </button>
          </div>
        </div>

        {/* Master Step 1 & 2: Select Class, Month, and Form Type */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: 16,
          padding: 20,
          border: '1px solid #E2E8F0',
          boxShadow: '0 4px 16px rgba(15,23,42,0.04)',
          marginBottom: 18,
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
            gap: 14,
            marginBottom: 16,
          }}>
            <div>
              <label style={lblStyle}>🏫 1. เลือกระดับชั้นเรียน</label>
              <select
                value={selectedRoomId}
                onChange={e => setSelectedRoomId(e.target.value)}
                style={selectStyle}
              >
                {availableRooms.map(r => (
                  <option key={r.id} value={r.id}>
                    ชั้น {r.label} ({r.students.length} คน)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={lblStyle}>📅 2. เลือกเดือน / ปี พ.ศ. (สำหรับใบบันทึกรายเดือน)</label>
              <input
                type="month"
                value={month}
                onChange={e => setMonth(e.target.value)}
                style={selectStyle}
              />
            </div>

            <div style={{
              background: '#F8FAFC', borderRadius: 12, padding: '10px 14px',
              border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', justifyContent: 'center',
            }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#64748B' }}>สถานะกระดาษที่พร้อมพิมพ์</div>
              <div style={{ fontSize: '0.92rem', fontWeight: 900, color: '#0F172A', marginTop: 2 }}>
                {currentDocConfig.icon} {currentDocConfig.label}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#0284C7', fontWeight: 700 }}>
                ชั้น {currentRoom?.label} · เดือน{THAI_MONTHS[monthNum - 1]} {year + 543} · A4 {currentDocConfig.orientation === 'landscape' ? 'แนวนอน' : 'แนวตั้ง'}
              </div>
            </div>
          </div>

          <label style={lblStyle}>📄 3. คลิกเลือกแบบฟอร์มที่ต้องการแสดงและสั่งพิมพ์ทันที:</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {INSTANT_DOCS.map(docItem => {
              const active = instantDoc === docItem.id;
              return (
                <button
                  key={docItem.id}
                  type="button"
                  onClick={() => setInstantDoc(docItem.id)}
                  style={{
                    padding: '10px 16px',
                    borderRadius: 12,
                    border: active ? `2px solid ${docItem.color}` : '1px solid #CBD5E1',
                    background: active ? docItem.color : '#FFFFFF',
                    color: active ? '#FFFFFF' : '#1E293B',
                    fontWeight: 800,
                    fontSize: '0.84rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    transition: 'all 0.15s',
                  }}
                >
                  <span>{docItem.icon}</span>
                  <span>{docItem.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Shortcut Bar to Specialized Multi-page Print Systems (ปพ.6 / ปพ.5 / BMI / โฮมรูม) */}
        <div style={{
          background: '#FFF7ED',
          border: '1px solid #FED7AA',
          borderRadius: 14,
          padding: '12px 16px',
          marginBottom: 18,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.84rem', fontWeight: 800, color: '#9A3412' }}>
            <Layers size={18} color="#EA580C" />
            <span>ทางลัดเปิดพิมพ์สมุดพก ปพ.6 ทั้งห้อง / หน้าปก ปพ.5 / รายงานเฉพาะทาง:</span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link to="/porpor6" style={quickLinkBtn}>📄 พิมพ์สมุดพก ปพ.6 (รายคน/ทั้งห้อง)</Link>
            <Link to="/porpor5" style={quickLinkBtn}>📘 พิมพ์หน้าปก & คะแนน ปพ.5</Link>
            <Link to="/behavior" style={quickLinkBtn}>🛡️ พิมพ์ใบเตือน/เกียรติบัตรความดี</Link>
            <Link to="/print-body-metrics" style={quickLinkBtn}>⚖️ พิมพ์รายงาน BMI</Link>
            <Link to="/print-homeroom" style={quickLinkBtn}>🏫 พิมพ์บันทึกโฮมรูม</Link>
            <Link to="/school-stats-report" style={quickLinkBtn}>📈 พิมพ์สถิติทั้งโรงเรียน</Link>
          </div>
        </div>
      </div>

      {/* ================= LIVE PRINTABLE A4 SHEET PREVIEW ================= */}
      <div
        className="print-hub-sheet"
        style={{
          background: '#FFFFFF',
          maxWidth: currentDocConfig.orientation === 'landscape' ? '297mm' : '210mm',
          margin: '0 auto 24px',
          padding: '10mm 12mm',
          boxShadow: '0 8px 28px rgba(15,23,42,0.12)',
          borderRadius: 8,
          color: '#000000',
          fontFamily: "'Sarabun', 'TH SarabunPSK', sans-serif",
        }}
      >
        {/* 1) MONTHLY GRID FORMS: MILK / BRUSH / LUNCH / DUTY / ATTENDANCE */}
        {isMonthlyGridDoc && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 10 }}>
              <div style={{ fontWeight: 900, fontSize: '14pt' }}>{formInfo.title}</div>
              <div style={{ fontSize: '11.5pt', fontWeight: 700 }}>
                โรงเรียนบ้านคลองมดแดง &nbsp; สำนักงานเขตพื้นที่การศึกษาประถมศึกษากำแพงเพชร เขต 2
              </div>
              <div style={{ fontSize: '11pt', marginTop: 2 }}>
                ระดับชั้น <b>{currentRoom?.label || '-'}</b> &nbsp;·&nbsp;
                ประจำเดือน <b>{THAI_MONTHS[monthNum - 1]} พ.ศ. {year + 543}</b>
              </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10.5px', tableLayout: 'fixed' }}>
              <thead>
                <tr style={{ background: '#F1F5F9' }}>
                  <th style={{ ...thCell, width: '4%' }}>ที่</th>
                  <th style={{ ...thCell, width: '20%', textAlign: 'left', paddingLeft: 6 }}>ชื่อ - นามสกุล</th>
                  {days.map(d => {
                    const dateStr = `${yearStr}-${monStr}-${String(d).padStart(2, '0')}`;
                    const dt = new Date(year, monthNum - 1, d);
                    const dayInfo = resolveSchoolDay(dateStr, schoolDays, holidays);
                    const isWeekend = dayInfo.reason === 'weekend';
                    const holiday = dayInfo.open ? '' : dayInfo.label;
                    const dayName = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'][dt.getDay()];
                    return (
                      <th
                        key={d}
                        title={holiday || ''}
                        style={{
                          ...thCell,
                          width: `${66 / daysInMonthCount}%`,
                          background: holiday ? '#FED7AA' : isWeekend ? '#FEE2E2' : '#F1F5F9',
                          color: holiday ? '#7C2D12' : isWeekend ? '#991B1B' : '#0F172A',
                        }}
                      >
                        <div>{d}</div>
                        <div style={{ fontSize: '8px', fontWeight: 600 }}>{dayName}</div>
                      </th>
                    );
                  })}
                  <th style={{ ...thCell, width: '10%', background: '#FFEDD5' }}>สรุปผล</th>
                </tr>
              </thead>
              <tbody>
                {(currentRoom?.students || []).map((s, i) => {
                  const sum = summaryFor(s.id);
                  return (
                    <tr key={s.id}>
                      <td style={tdCell}>{i + 1}</td>
                      <td style={{ ...tdCell, textAlign: 'left', paddingLeft: 6 }}>{s.name}</td>
                      {days.map(d => {
                        const status = statusFor(s.id, d);
                        const dateStr = `${yearStr}-${monStr}-${String(d).padStart(2, '0')}`;
                        const dayInfo = resolveSchoolDay(dateStr, schoolDays, holidays);
                        const isWeekend = dayInfo.reason === 'weekend';
                        const isHoliday = !dayInfo.open && dayInfo.reason !== 'weekend';
                        let color = '#0F172A';
                        if (status === formInfo.missMark || status === '−') color = '#DC2626';
                        else if (status === 'ล') color = '#D97706';
                        else if (status === '/') color = '#94A3B8';
                        else if (status === formInfo.mark) color = '#16A34A';
                        return (
                          <td
                            key={d}
                            style={{
                              ...tdCell,
                              background: isHoliday ? '#FED7AA' : isWeekend ? '#FEF2F2' : 'white',
                              color,
                              fontWeight: status ? 800 : 400,
                            }}
                          >
                            {status}
                          </td>
                        );
                      })}
                      <td style={{ ...tdCell, background: '#FFFBEB', fontWeight: 700 }}>
                        {instantDoc === 'attendance'
                          ? `${sum.present}/${sum.totalDays}`
                          : `${sum.present} ครั้ง`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div style={{ marginTop: 8, fontSize: '10px', color: '#334155', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <div><Calendar size={11} style={{ verticalAlign: 'middle' }} /> {formInfo.legendDesc}</div>
              <div>จำนวนนักเรียนในชั้น: <b>{currentRoom?.students.length || 0}</b> คน</div>
            </div>

            <div style={{ marginTop: 22, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 30, textAlign: 'center', fontSize: '11pt' }}>
              <div>
                <div>ลงชื่อ ....................................................... ครูประจำชั้น</div>
                <div style={{ marginTop: 2 }}>({currentAcadClass.homeroomTeachers.join(' / ')})</div>
              </div>
              <div>
                <div>ลงชื่อ ....................................................... ผู้อำนวยการโรงเรียน</div>
                <div style={{ marginTop: 2, fontWeight: 800 }}>({DIRECTOR_NAME})</div>
              </div>
            </div>
          </div>
        )}

        {/* 2) ACADEMIC CLASS SUMMARY FORM */}
        {instantDoc === 'academic_class' && (() => {
          const ranks = calculateClassRanks(currentAcadClass.students, currentAcadClass.subjects);
          return (
            <div>
              <div style={{ textAlign: 'center', marginBottom: 10 }}>
                <img
                  src={`${import.meta.env.BASE_URL}images/school-logo.png`}
                  alt="ตราโรงเรียน"
                  style={{ width: 54, height: 54, objectFit: 'contain', margin: '0 auto 4px' }}
                />
                <div style={{ fontWeight: 900, fontSize: '14pt' }}>
                  แบบสรุปผลการเรียนรายวิชาและเกรดเฉลี่ยประจำชั้น (ปพ.5 / ปพ.6)
                </div>
                <div style={{ fontSize: '11pt', fontWeight: 700 }}>
                  โรงเรียนบ้านคลองมดแดง &nbsp;|&nbsp; ชั้น{currentAcadClass.className} ({currentAcadClass.shortName}/1) &nbsp;|&nbsp; ภาคเรียนที่ 1 ปีการศึกษา 2569
                </div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9.5pt' }}>
                <thead>
                  <tr style={{ background: '#F1F5F9' }}>
                    <th style={thCell}>เลขที่</th>
                    <th style={thCell}>รหัส</th>
                    <th style={{ ...thCell, textAlign: 'left', paddingLeft: 6 }}>ชื่อ - นามสกุล</th>
                    {currentAcadClass.subjects.map(sub => (
                      <th key={sub.code} style={thCell}>
                        <div>{sub.code}</div>
                        <div style={{ fontSize: '7.5pt', fontWeight: 600 }}>{sub.name.slice(0, 8)}</div>
                      </th>
                    ))}
                    <th style={{ ...thCell, background: '#FEF3C7' }}>GPA</th>
                    <th style={{ ...thCell, background: '#DCFCE7' }}>ลำดับที่</th>
                  </tr>
                </thead>
                <tbody>
                  {currentAcadClass.students.map(st => {
                    const gpaInfo = calculateStudentGPA(st, currentAcadClass.subjects);
                    return (
                      <tr key={st.code}>
                        <td style={tdCell}>{st.no}</td>
                        <td style={tdCell}>{st.code}</td>
                        <td style={{ ...tdCell, textAlign: 'left', paddingLeft: 6 }}>{st.name}</td>
                        {currentAcadClass.subjects.map(sub => (
                          <td key={sub.code} style={{ ...tdCell, fontWeight: 700 }}>
                            {st.scores[sub.code]?.grade ?? '3'}
                          </td>
                        ))}
                        <td style={{ ...tdCell, fontWeight: 900, background: '#FFFBEB' }}>{gpaInfo.gpaFormatted}</td>
                        <td style={{ ...tdCell, fontWeight: 800 }}>{ranks[st.code]?.rank || 1}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div style={{ marginTop: 22, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 30, textAlign: 'center', fontSize: '10.5pt' }}>
                <div>
                  <div>ลงชื่อ ....................................................... ครูประจำชั้น</div>
                  <div>({currentAcadClass.homeroomTeachers.join(' / ')})</div>
                </div>
                <div>
                  <div>ลงชื่อ ....................................................... ผู้อำนวยการโรงเรียน</div>
                  <div style={{ fontWeight: 800 }}>({DIRECTOR_NAME})</div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* 3) BEHAVIOR CLASS SUMMARY FORM */}
        {instantDoc === 'behavior_class' && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 10 }}>
              <img
                src={`${import.meta.env.BASE_URL}images/school-logo.png`}
                alt="ตราโรงเรียน"
                style={{ width: 54, height: 54, objectFit: 'contain', margin: '0 auto 4px' }}
              />
              <div style={{ fontWeight: 900, fontSize: '14pt' }}>
                แบบสรุปผลการประเมินคะแนนความประพฤติและคุณลักษณะอันพึงประสงค์ประจำชั้น
              </div>
              <div style={{ fontSize: '11pt', fontWeight: 700 }}>
                โรงเรียนบ้านคลองมดแดง &nbsp;|&nbsp; ชั้น{currentAcadClass.className} ({currentAcadClass.shortName}/1) &nbsp;|&nbsp; ประจำเดือน {THAI_MONTHS[monthNum - 1]} พ.ศ. {year + 543}
              </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10pt' }}>
              <thead>
                <tr style={{ background: '#F1F5F9' }}>
                  <th style={{ ...thCell, width: '7%' }}>เลขที่</th>
                  <th style={{ ...thCell, width: '12%' }}>รหัสนักเรียน</th>
                  <th style={{ ...thCell, width: '33%', textAlign: 'left', paddingLeft: 6 }}>ชื่อ - นามสกุล</th>
                  <th style={{ ...thCell, width: '12%' }}>คะแนนตั้งต้น</th>
                  <th style={{ ...thCell, width: '12%' }}>คุณลักษณะฯ</th>
                  <th style={{ ...thCell, width: '12%' }}>อ่านคิดวิเคราะห์</th>
                  <th style={{ ...thCell, width: '12%' }}>สรุปความประพฤติ</th>
                </tr>
              </thead>
              <tbody>
                {currentAcadClass.students.map(st => (
                  <tr key={st.code}>
                    <td style={tdCell}>{st.no}</td>
                    <td style={tdCell}>{st.code}</td>
                    <td style={{ ...tdCell, textAlign: 'left', paddingLeft: 6 }}>{st.name}</td>
                    <td style={{ ...tdCell, fontWeight: 700 }}>100</td>
                    <td style={tdCell}>{st.traitResult}</td>
                    <td style={tdCell}>{st.readThinkResult}</td>
                    <td style={{ ...tdCell, fontWeight: 800 }}>ปกติ (เรียบร้อย)</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ marginTop: 22, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 30, textAlign: 'center', fontSize: '10.5pt' }}>
              <div>
                <div>ลงชื่อ ....................................................... ครูประจำชั้น</div>
                <div>({currentAcadClass.homeroomTeachers.join(' / ')})</div>
              </div>
              <div>
                <div>ลงชื่อ ....................................................... ผู้อำนวยการโรงเรียน</div>
                <div style={{ fontWeight: 800 }}>({DIRECTOR_NAME})</div>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @media print {
          @page {
            size: A4 ${currentDocConfig.orientation};
            margin: 8mm;
          }
          body {
            background: #FFFFFF !important;
          }
          .no-print {
            display: none !important;
          }
          .print-hub-sheet {
            box-shadow: none !important;
            margin: 0 !important;
            padding: 2mm !important;
            max-width: 100% !important;
            width: 100% !important;
          }
        }
      `}</style>
    </SmartSchoolLayout>
  );
}

const lblStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.78rem',
  fontWeight: 800,
  color: '#334155',
  marginBottom: 6,
};

const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: 10,
  border: '1.5px solid #CBD5E1',
  fontSize: '0.88rem',
  fontWeight: 800,
  color: '#0F172A',
};

const quickLinkBtn: React.CSSProperties = {
  background: '#FFFFFF',
  color: '#9A3412',
  border: '1px solid #FDBA74',
  borderRadius: 8,
  padding: '6px 12px',
  fontSize: '0.78rem',
  fontWeight: 800,
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
};

const thCell: React.CSSProperties = {
  border: '1px solid #000000',
  padding: '4px 3px',
  textAlign: 'center',
  fontWeight: 800,
};

const tdCell: React.CSSProperties = {
  border: '1px solid #000000',
  padding: '3.5px 3px',
  textAlign: 'center',
};
