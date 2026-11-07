import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useSchoolRoster } from '../utils/useSchoolRoster';
import {
  Utensils, Sparkles, Download, Printer, CheckCircle2, Users,
  ClipboardCheck, Star, Edit3,
} from 'lucide-react';
import SmartSchoolLayout from '../components/SmartSchoolLayout';
import TeacherLoginGate from '../components/TeacherLoginGate';
import QuickDate from '../components/QuickDate';
import { useTeacherAuth } from '../utils/teacherAuth';
import {
  daysInMonth,
  downloadCsvReport,
  makeSectionedReportRows,
  monthLabel,
  yearLabel,
  THAI_MONTHS_FULL,
} from '../utils/csvReport';
import { SCHOOL_NAME, SCHOOL_AFFILIATION } from '../config/siteLinks';

const DIRECTOR_NAME = 'นายปรัชญา ปรางค์ชัยภูมิ';
const LUNCH_RATE_PER_HEAD = 22; // งบอาหารกลางวัน สพฐ./อปท. 22 บาท/คน/วัน

interface AttRecord {
  status: 'present' | 'absent' | 'leave';
  note?: string;
  noMilk?: boolean;
  noBrush?: boolean;
  noLunch?: boolean;
  noDuty?: boolean;
}
interface AttDoc {
  classId: string;
  date: string;
  records: Record<string, AttRecord>;
}

interface DailyLunchAndDutyMeta {
  date: string;
  mainDish1: string;
  mainDish2: string;
  dessertOrFruit: string;
  riceType: string;
  caloriesKcal: number;
  inspectTeacher: string;
  zoneScores: Record<string, { rating: number; note: string }>;
  updatedAt?: number;
}

const DEFAULT_ZONES: Record<string, { zoneName: string; teacher: string }> = {
  'อ.2/1': { zoneName: 'อาคารปฐมวัย ห้องเรียน อ.2 และสนามเด็กเล่นโซน A', teacher: 'นางสาวณัฐณิชา ภักดี' },
  'อ.3/1': { zoneName: 'อาคารปฐมวัย ห้องเรียน อ.3 และระเบียงหน้าอาคาร', teacher: 'นางสาวณัฐณิชา ภักดี' },
  'ป.1/1': { zoneName: 'ห้องเรียน ป.1 และทางเดินอาคารประถมชั้นล่าง (ฝั่งตะวันออก)', teacher: 'นางสาวธิดารัตน์ แรตสอน' },
  'ป.2/1': { zoneName: 'ห้องเรียน ป.2 และลานอเนกประสงค์หน้าเสาธง', teacher: 'นางสาวธญาภรณ์ คล้ายเพ็ง' },
  'ป.3/1': { zoneName: 'ห้องเรียน ป.3 และบริเวณโรงอาหาร/จุดวางภาชนะ', teacher: 'นางสาวไอยรดา อาจจีน' },
  'ป.4/1': { zoneName: 'ห้องเรียน ป.4 และห้องน้ำนักเรียนชาย-หญิง (ฝั่งประถม)', teacher: 'นายพีระ เดชะผล' },
  'ป.5/1': { zoneName: 'ห้องเรียน ป.5 ห้องสมุด และสวนหย่อมหน้าอาคาร', teacher: 'นายนวพานิชณ์ วังคีรี' },
  'ป.6/1': { zoneName: 'ห้องเรียน ป.6 ห้องปฏิบัติการคอมพิวเตอร์ และลานกีฬา', teacher: 'นางสาวอาริษา ฉิมสุพร, นายพิศุทธิ์ เชาวลิตโรจน์' },
  'ม.1/1': { zoneName: 'อาคารมัธยมศึกษา ห้อง ม.1 และโรงอาหารฝั่งมัธยม', teacher: 'นางสาวจิราภา พานชัย, นายอนันตชัย เพ็ชรรี่' },
  'ม.2/1': { zoneName: 'อาคารมัธยมศึกษา ห้อง ม.2 และห้องน้ำฝั่งมัธยม', teacher: 'นายอรรถชัย แก้วเอี่ยม' },
  'ม.3/1': { zoneName: 'อาคารมัธยมศึกษา ห้อง ม.3 แปลงเกษตร และแนวรั้วหน้าโรงเรียน', teacher: 'นางสาวนริศรา ทำจิตรเหมาะ, นายธิติวุฒิ เตยไธสง' },
};

const PRESET_MENUS = [
  {
    label: 'ชุดที่ 1: ต้มจืดเต้าหู้หมูสับ + ไก่ทอดกระเทียม + แตงโม',
    riceType: 'ข้าวสวยหอมมะลิ',
    mainDish1: 'แกงจืดเต้าหู้หมูสับตำลึง',
    mainDish2: 'ไก่ทอดกระเทียมพริกไทย',
    dessertOrFruit: 'แตงโมสดฉ่ำ',
    caloriesKcal: 620,
  },
  {
    label: 'ชุดที่ 2: ข้าวมันไก่ต้ม/ไก่ทอด + ซุปฟักโครงไก่ + กล้วยน้ำว้า',
    riceType: 'ข้าวมันหอมซุปไก่',
    mainDish1: 'ไก่ต้มสับ + ไก่กรอบน้ำจิ้มเต้าเจี้ยว',
    mainDish2: 'ต้มซุปฟักเขียวโครงไก่',
    dessertOrFruit: 'กล้วยน้ำว้าสุก',
    caloriesKcal: 650,
  },
  {
    label: 'ชุดที่ 3: ไข่พะโล้หมูสามชั้น + ผัดผักรวมมิตร + ส้มเขียวหวาน',
    riceType: 'ข้าวสวยกล้องผสมข้าวหอมมะลิ',
    mainDish1: 'ไข่พะโล้หมูสามชั้นเต้าหู้พวง',
    mainDish2: 'ผัดผักรวมมิตรหมูชิ้น',
    dessertOrFruit: 'ส้มเขียวหวาน',
    caloriesKcal: 610,
  },
  {
    label: 'ชุดที่ 4: ก๋วยเตี๋ยวไก่ตุ๋นมะระ/หมูสับ + ขนมหวานลอดช่อง',
    riceType: 'เส้นเล็ก / บะหมี่เหลือง',
    mainDish1: 'ก๋วยเตี๋ยวไก่ตุ๋นหมูสับลูกชิ้นผักบุ้ง',
    mainDish2: 'เกี๊ยวกรอบทอด',
    dessertOrFruit: 'ลอดช่องน้ำกะทิแตงไทย',
    caloriesKcal: 590,
  },
  {
    label: 'ชุดที่ 5: แกงเขียวหวานไก่ฟักทอง + ไข่เจียวทรงเครื่อง + สับปะรด',
    riceType: 'ข้าวสวยหอมมะลิ',
    mainDish1: 'แกงเขียวหวานไก่ใส่ฟักทองและเลือด',
    mainDish2: 'ไข่เจียวหมูสับหอมใหญ่',
    dessertOrFruit: 'สับปะรดหวานฉ่ำ',
    caloriesKcal: 640,
  },
];

const STORAGE_META_KEY = 'kmd_lunch_duty_meta_v1';

export default function LunchDutyPage() {
  const auth = useTeacherAuth();
  if (!auth.authed) {
    return (
      <TeacherLoginGate
        title="🍱 อาหารกลางวัน & 🧹 เวรเขตพื้นที่"
        subtitle="ดึงข้อมูลอัตโนมัติจากการเช็คชื่อมาเรียน (มาเรียน = ได้กินอาหารกลางวัน & ได้ทำเวร)"
      />
    );
  }
  return <LunchDutyContent userName={auth.name} />;
}

function LunchDutyContent({ userName }: { userName: string }) {
  const { classes: availableClasses } = useSchoolRoster();
  const [date, setDate] = useState(todayStr());
  const [allDocs, setAllDocs] = useState<AttDoc[]>([]);
  const [activeTab, setActiveTab] = useState<'lunch' | 'duty' | 'roster'>('lunch');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [csvPeriod, setCsvPeriod] = useState<'month' | 'year'>('month');
  const [csvScope, setCsvScope] = useState<string>('all');
  const [savedToast, setSavedToast] = useState<string | null>(null);

  // Daily Menu & Duty Inspection Meta
  const [metaMap, setMetaMap] = useState<Record<string, DailyLunchAndDutyMeta>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_META_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return {};
  });

  const currentMeta: DailyLunchAndDutyMeta = useMemo(() => {
    if (metaMap[date]) return metaMap[date];
    const dayIdx = new Date(date).getDate() % PRESET_MENUS.length;
    const p = PRESET_MENUS[dayIdx];
    return {
      date,
      riceType: p.riceType,
      mainDish1: p.mainDish1,
      mainDish2: p.mainDish2,
      dessertOrFruit: p.dessertOrFruit,
      caloriesKcal: p.caloriesKcal,
      inspectTeacher: userName || 'ครูเวรประจำวัน',
      zoneScores: {},
    };
  }, [metaMap, date, userName]);

  const saveMeta = (next: DailyLunchAndDutyMeta) => {
    const updated = { ...metaMap, [date]: { ...next, updatedAt: Date.now() } };
    setMetaMap(updated);
    try {
      localStorage.setItem(STORAGE_META_KEY, JSON.stringify(updated));
    } catch { /* fallback local */ }
    setSavedToast('บันทึกข้อมูลเมนูอาหารกลางวันและผลตรวจเวรแล้ว');
    setTimeout(() => setSavedToast(null), 2200);
  };

  const loadAttendanceDocs = async () => {
    try {
      const snap = await getDocs(collection(db, 'attendance'));
      const arr: AttDoc[] = [];
      snap.forEach(d => arr.push(d.data() as AttDoc));
      setAllDocs(arr);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadAttendanceDocs();
  }, []);

  useEffect(() => {
    if (availableClasses.length && !availableClasses.some(c => c.id === selectedClassId)) {
      setSelectedClassId(availableClasses[0].id);
    }
  }, [availableClasses, selectedClassId]);

  const totalStudents = availableClasses.reduce((s, c) => s + c.students.length, 0);
  const month = date.slice(0, 7);
  const year = date.slice(0, 4);

  // Per-day per-class calculation (same pattern as MilkReport: present => eats lunch & does duty)
  const dayDocs = useMemo(() => allDocs.filter(d => d.date === date), [allDocs, date]);

  const dayPerClass = useMemo(() => availableClasses.map(c => {
    const docItem = dayDocs.find(d => d.classId === c.id);
    let lunchCount = 0;
    let dutyCount = 0;
    let presentCount = 0;
    if (docItem && docItem.records) {
      Object.values(docItem.records).forEach((r: AttRecord) => {
        if (r.status === 'present') {
          presentCount++;
          if (!r.noLunch) lunchCount++;
          if (!r.noDuty) dutyCount++;
        }
      });
    } else {
      // If attendance hasn't been saved yet today, preview default = all students present eat lunch & do duty
      presentCount = c.students.length;
      lunchCount = c.students.length;
      dutyCount = c.students.length;
    }
    const zoneInfo = DEFAULT_ZONES[c.label] || { zoneName: `ห้องเรียน ${c.label} และบริเวณโดยรอบ`, teacher: 'ครูประจำชั้น' };
    const zoneScore = currentMeta.zoneScores?.[c.id] || { rating: 5, note: 'สะอาดเรียบร้อยดีมาก' };
    return {
      c,
      presentCount,
      lunch: lunchCount,
      duty: dutyCount,
      checked: !!docItem,
      zoneInfo,
      zoneScore,
    };
  }), [availableClasses, dayDocs, currentMeta]);

  const dayTotalLunch = dayPerClass.reduce((s, x) => s + x.lunch, 0);
  const dayTotalDuty = dayPerClass.reduce((s, x) => s + x.duty, 0);
  const dayBudget = dayTotalLunch * LUNCH_RATE_PER_HEAD;

  // Month summary per class
  const monthPerClass = useMemo(() => availableClasses.map(c => {
    const docs = allDocs.filter(d => d.classId === c.id && d.date.startsWith(month));
    let totalLunch = 0;
    let totalDuty = 0;
    const days = new Set<string>();
    docs.forEach(d => {
      days.add(d.date);
      Object.values(d.records || {}).forEach((r: AttRecord) => {
        if (r.status === 'present') {
          if (!r.noLunch) totalLunch++;
          if (!r.noDuty) totalDuty++;
        }
      });
    });
    return { c, totalLunch, totalDuty, days: days.size };
  }), [availableClasses, allDocs, month]);

  // Toggle individual student's noLunch / noDuty and sync to Cloud Firestore attendance
  const toggleStudentFlag = async (classId: string, studentId: string, field: 'noLunch' | 'noDuty') => {
    const cls = availableClasses.find(c => c.id === classId);
    if (!cls) return;
    const existingDoc = dayDocs.find(d => d.classId === classId);
    const nextRecords: Record<string, AttRecord> = {};

    cls.students.forEach(st => {
      const prev = existingDoc?.records?.[st.id] || { status: 'present' };
      nextRecords[st.id] = { ...prev };
    });

    const cur = nextRecords[studentId] || { status: 'present' };
    nextRecords[studentId] = {
      ...cur,
      [field]: !cur[field],
    };

    const newDoc: AttDoc = {
      classId,
      date,
      records: nextRecords,
    };

    setAllDocs(prev => {
      const filtered = prev.filter(d => !(d.classId === classId && d.date === date));
      return [...filtered, newDoc];
    });

    try {
      await setDoc(doc(db, 'attendance', `${classId}_${date}`), newDoc, { merge: true });
      setSavedToast('อัปเดตสถานะอาหารกลางวัน/เวรลง Cloud Firestore แล้ว');
    } catch (err) {
      console.error('Failed to sync lunch/duty flag:', err);
      setSavedToast('อัปเดตสถานะในเครื่องแล้ว');
    }
    setTimeout(() => setSavedToast(null), 1800);
  };

  const exportCsv = (mode: 'lunch' | 'duty') => {
    const isLunch = mode === 'lunch';
    const titleLabel = isLunch ? 'รายงานการรับประทานอาหารกลางวัน' : 'รายงานการปฏิบัติเวรทำความสะอาดประจำวัน';
    const targetClasses = csvScope === 'all'
      ? availableClasses
      : availableClasses.filter(c => c.id === csvScope);

    const sections = targetClasses.map(classItem => {
      const classDocs = allDocs.filter(docItem => docItem.classId === classItem.id);
      const rows = csvPeriod === 'month'
        ? classItem.students.map((student, index) => {
          let countYes = 0;
          let countNo = 0;
          const marks = daysInMonth(month).map(day => {
            const dateText = `${month}-${String(day).padStart(2, '0')}`;
            const record = classDocs.find(docItem => docItem.date === dateText)?.records?.[student.id];
            if (!record) return '';
            const ok = record.status === 'present' && (isLunch ? !record.noLunch : !record.noDuty);
            if (ok) {
              countYes++;
              return '✓';
            }
            countNo++;
            return '✗';
          });
          return [String(index + 1), student.code || '-', student.name, ...marks, String(countYes), String(countNo)];
        })
        : classItem.students.map((student, index) => {
          const row = [String(index + 1), student.code || '-', student.name];
          let totalYes = 0;
          let totalDays = 0;
          THAI_MONTHS_FULL.forEach((_, monthIndex) => {
            const prefix = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
            let mYes = 0;
            let mDays = 0;
            classDocs.filter(docItem => docItem.date.startsWith(prefix)).forEach(docItem => {
              const record = docItem.records?.[student.id];
              if (!record) return;
              mDays++;
              if (record.status === 'present' && (isLunch ? !record.noLunch : !record.noDuty)) mYes++;
            });
            totalYes += mYes;
            totalDays += mDays;
            row.push(mDays ? `${mYes}/${mDays}` : '-');
          });
          row.push(String(totalYes), String(totalDays));
          return row;
        });

      return {
        title: `ชั้น ${classItem.label}`,
        headers: csvPeriod === 'month'
          ? ['ที่', 'รหัส', 'ชื่อ-สกุล', ...daysInMonth(month).map(String), isLunch ? 'รวมทาน (มื้อ)' : 'รวมทำเวร (ครั้ง)', 'ไม่ได้ทำ/ขาด']
          : ['ที่', 'รหัส', 'ชื่อ-สกุล', ...THAI_MONTHS_FULL.map(m => `${m}`), 'รวมทั้งหมด', 'จำนวนวันที่มีข้อมูล'],
        rows: rows.length ? rows : [['-', '-', 'ยังไม่มีรายชื่อนักเรียน']],
      };
    });

    const reportRows = makeSectionedReportRows({
      title: `${titleLabel} ${SCHOOL_NAME}`,
      subtitle: csvPeriod === 'month' ? `รายเดือน ${monthLabel(month)}` : `รายปี ${yearLabel(year)}`,
      meta: [
        ['ขอบเขต', csvScope === 'all' ? 'ทุกชั้น' : `ชั้น ${targetClasses[0]?.label || '-'}`],
        ['เมนูประจำวันที่เลือก', `${currentMeta.riceType} · ${currentMeta.mainDish1} · ${currentMeta.mainDish2} · ${currentMeta.dessertOrFruit}`],
        ['ผู้ส่งออก', userName],
      ],
      sections,
      footerRows: [['คำอธิบาย', '✓ = มาเรียนและได้รับอาหารกลางวัน/ปฏิบัติเวร, ✗ = ขาด/ลา/ยกเว้น']],
    });

    downloadCsvReport(
      `${titleLabel}_${csvScope === 'all' ? 'ทุกชั้น' : targetClasses[0]?.label || 'ชั้น'}_${month}.csv`,
      reportRows
    );
  };

  const selectedClassObj = availableClasses.find(c => c.id === selectedClassId) || availableClasses[0];
  const selectedClassDoc = dayDocs.find(d => d.classId === selectedClassObj?.id);

  return (
    <SmartSchoolLayout pageTitle="อาหารกลางวัน & เวรเขตพื้นที่">
      <div className="no-print">
        {/* Header Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 900, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
              🍱 โครงการอาหารกลางวัน & 🧹 เวรทำความสะอาดเขตพื้นที่
            </h1>
            <div style={{ fontSize: '0.82rem', color: '#64748B', marginTop: 2 }}>
              เชื่อมกับระบบเช็คชื่ออัตโนมัติ (เหมือนระบบนมโรงเรียน): <b>นักเรียนที่มาเรียน = ได้รับประทานอาหารกลางวัน และได้ปฏิบัติเวรประจำวัน</b>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {savedToast && (
              <span style={{
                background: '#DCFCE7', color: '#15803D', padding: '8px 12px',
                borderRadius: 999, fontSize: '0.78rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 5,
              }}>
                <CheckCircle2 size={14} /> {savedToast}
              </span>
            )}
            <Link
              to={`/print-form/lunch?classId=${selectedClassId}&month=${month}`}
              style={{
                background: '#EA580C', color: 'white', textDecoration: 'none',
                borderRadius: 999, padding: '9px 16px', fontWeight: 800, fontSize: '0.82rem',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              <Printer size={15} /> พิมพ์ใบบันทึกอาหารกลางวัน (รายเดือน)
            </Link>
            <Link
              to={`/print-form/duty?classId=${selectedClassId}&month=${month}`}
              style={{
                background: '#15803D', color: 'white', textDecoration: 'none',
                borderRadius: 999, padding: '9px 16px', fontWeight: 800, fontSize: '0.82rem',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              <Printer size={15} /> พิมพ์ใบบันทึกเวรความสะอาด (รายเดือน)
            </Link>
            <button
              type="button"
              onClick={() => window.print()}
              style={{
                background: '#1E293B', color: 'white', border: 'none',
                borderRadius: 999, padding: '9px 16px', fontWeight: 800, fontSize: '0.82rem',
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              <Printer size={15} /> พิมพ์ใบตรวจเมนูอาหาร & เวรวันนี้ (A4)
            </button>
          </div>
        </div>

        {/* Auto-sync Banner */}
        <div style={{
          background: 'linear-gradient(135deg, #FFEDD5, #FEF3C7)',
          border: '1px solid #FDBA74',
          color: '#9A3412',
          borderRadius: 14,
          padding: '12px 18px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Sparkles size={20} color="#EA580C" />
            <div style={{ fontSize: '0.86rem', fontWeight: 700 }}>
              <b>ระบบอัตโนมัติ (แบบเดียวกับนมโรงเรียน):</b> นักเรียนที่เช็คชื่อ <b>"มาเรียน"</b> จะถูกนับว่า <b>"ได้รับอาหารกลางวัน ✓"</b> และ <b>"ปฏิบัติเวรทำความสะอาด ✓"</b> ทันที (คลิกแก้ไขรายบุคคลได้ที่แท็บรายชื่อนักเรียน)
            </div>
          </div>
          <Link
            to="/attendance"
            style={{
              background: '#EA580C', color: 'white', textDecoration: 'none',
              padding: '6px 14px', borderRadius: 8, fontSize: '0.78rem', fontWeight: 800,
            }}
          >
            ไปหน้าเช็คชื่อประจำวัน →
          </Link>
        </div>

        {/* Date & Export Controls */}
        <div style={{
          background: '#FFFFFF', borderRadius: 14, padding: '14px 18px',
          marginBottom: 16, border: '1px solid #E2E8F0',
          display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap',
        }}>
          <QuickDate value={date} onChange={setDate} color="#EA580C" />
          <div>
            <label style={lbl}>ช่วงรายงาน CSV</label>
            <select value={csvPeriod} onChange={e => setCsvPeriod(e.target.value as 'month' | 'year')} style={inp}>
              <option value="month">รายเดือน ({monthLabel(month)})</option>
              <option value="year">รายปี ({yearLabel(year)})</option>
            </select>
          </div>
          <div>
            <label style={lbl}>ระดับชั้น</label>
            <select value={csvScope} onChange={e => setCsvScope(e.target.value)} style={inp}>
              <option value="all">ทุกชั้นเรียน</option>
              {availableClasses.map(c => <option key={c.id} value={c.id}>ชั้น {c.label}</option>)}
            </select>
          </div>
          <button onClick={() => exportCsv('lunch')} style={{ ...btnAction, background: '#EA580C' }}>
            <Download size={14} /> CSV อาหารกลางวัน
          </button>
          <button onClick={() => exportCsv('duty')} style={{ ...btnAction, background: '#15803D' }}>
            <Download size={14} /> CSV เวรทำความสะอาด
          </button>
        </div>

        {/* Summary KPI Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: 14,
          marginBottom: 18,
        }}>
          <KpiCard
            icon="👥"
            label={`นักเรียนทั้งหมด (${fmtThai(date)})`}
            value={`${totalStudents} คน`}
            sub="อ.2/1 – ม.3/1 (11 ห้องเรียน)"
            color="#0284C7"
          />
          <KpiCard
            icon="🍱"
            label="รับประทานอาหารกลางวันวันนี้"
            value={`${dayTotalLunch} คน`}
            sub={`คิดเป็น ${totalStudents ? Math.round((dayTotalLunch / totalStudents) * 100) : 0}% ของนักเรียนทั้งหมด`}
            color="#EA580C"
          />
          <KpiCard
            icon="💰"
            label="งบอาหารกลางวันวันนี้ (22 บ./คน)"
            value={`${dayBudget.toLocaleString()} บาท`}
            sub="ตามเกณฑ์งบอุดหนุน สพฐ. / อปท."
            color="#D97706"
          />
          <KpiCard
            icon="🧹"
            label="ปฏิบัติเวรเขตพื้นที่วันนี้"
            value={`${dayTotalDuty} คน`}
            sub={`ครบทั้ง ${availableClasses.length} เขตพื้นที่รับผิดชอบ`}
            color="#16A34A"
          />
        </div>

        {/* Mode Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setActiveTab('lunch')}
            style={{
              ...tabPill,
              background: activeTab === 'lunch' ? '#EA580C' : '#FFFFFF',
              color: activeTab === 'lunch' ? '#FFFFFF' : '#334155',
            }}
          >
            <Utensils size={16} /> 1. เมนูอาหารกลางวัน & สรุปรายชั้น
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('duty')}
            style={{
              ...tabPill,
              background: activeTab === 'duty' ? '#15803D' : '#FFFFFF',
              color: activeTab === 'duty' ? '#FFFFFF' : '#334155',
            }}
          >
            <ClipboardCheck size={16} /> 2. ตรวจเวรทำความสะอาดเขตพื้นที่ (Zoning)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('roster')}
            style={{
              ...tabPill,
              background: activeTab === 'roster' ? '#1D4ED8' : '#FFFFFF',
              color: activeTab === 'roster' ? '#FFFFFF' : '#334155',
            }}
          >
            <Users size={16} /> 3. เช็ค/แก้ไขรายชื่อนักเรียนรายห้อง ({selectedClassObj?.label})
          </button>
        </div>

        {/* TAB 1: LUNCH MENU & PER-CLASS TABLE */}
        {activeTab === 'lunch' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
            {/* Daily Menu Card */}
            <div style={{ background: '#FFFFFF', borderRadius: 16, padding: 20, border: '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: '#0F172A' }}>
                  🍲 บันทึกเมนูอาหารกลางวันประจำวันที่ {fmtThai(date)}
                </h3>
                <span style={{
                  fontSize: '0.74rem', fontWeight: 800, background: '#FFEDD5',
                  color: '#C2410C', padding: '4px 10px', borderRadius: 999,
                }}>
                  Thai School Lunch (5 หมู่)
                </span>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={lbl}>⚡ เลือกชุดเมนูมาตรฐานโรงเรียน (คลิกเพื่อเติมอัตโนมัติ)</label>
                <select
                  onChange={e => {
                    const idx = Number(e.target.value);
                    if (!Number.isNaN(idx) && PRESET_MENUS[idx]) {
                      const p = PRESET_MENUS[idx];
                      saveMeta({
                        ...currentMeta,
                        riceType: p.riceType,
                        mainDish1: p.mainDish1,
                        mainDish2: p.mainDish2,
                        dessertOrFruit: p.dessertOrFruit,
                        caloriesKcal: p.caloriesKcal,
                      });
                    }
                  }}
                  defaultValue=""
                  style={{ ...inp, width: '100%' }}
                >
                  <option value="" disabled>-- เลือกชุดเมนูอาหารกลางวันยอดนิยม --</option>
                  {PRESET_MENUS.map((p, idx) => (
                    <option key={idx} value={idx}>{p.label}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={lbl}>🍚 ข้าว / เส้นหลัก</label>
                  <input
                    value={currentMeta.riceType}
                    onChange={e => saveMeta({ ...currentMeta, riceType: e.target.value })}
                    style={{ ...inp, width: '100%' }}
                  />
                </div>
                <div>
                  <label style={lbl}>🔥 พลังงานโดยประมาณ (kcal)</label>
                  <input
                    type="number"
                    value={currentMeta.caloriesKcal}
                    onChange={e => saveMeta({ ...currentMeta, caloriesKcal: Number(e.target.value) })}
                    style={{ ...inp, width: '100%' }}
                  />
                </div>
                <div>
                  <label style={lbl}>🥘 กับข้าวรายการที่ 1 (ต้ม/แกง/ผัด)</label>
                  <input
                    value={currentMeta.mainDish1}
                    onChange={e => saveMeta({ ...currentMeta, mainDish1: e.target.value })}
                    style={{ ...inp, width: '100%' }}
                  />
                </div>
                <div>
                  <label style={lbl}>🍗 กับข้าวรายการที่ 2 (ทอด/ไข่/เนื้อสัตว์)</label>
                  <input
                    value={currentMeta.mainDish2}
                    onChange={e => saveMeta({ ...currentMeta, mainDish2: e.target.value })}
                    style={{ ...inp, width: '100%' }}
                  />
                </div>
                <div>
                  <label style={lbl}>🍉 ผลไม้ / ของหวาน</label>
                  <input
                    value={currentMeta.dessertOrFruit}
                    onChange={e => saveMeta({ ...currentMeta, dessertOrFruit: e.target.value })}
                    style={{ ...inp, width: '100%' }}
                  />
                </div>
                <div>
                  <label style={lbl}>👩‍🏫 ครูผู้ตรวจอาหารกลางวัน/ครูเวร</label>
                  <input
                    value={currentMeta.inspectTeacher}
                    onChange={e => saveMeta({ ...currentMeta, inspectTeacher: e.target.value })}
                    style={{ ...inp, width: '100%' }}
                  />
                </div>
              </div>

              <div style={{
                marginTop: 14, padding: '12px 14px', borderRadius: 12,
                background: '#FFF7ED', border: '1px dashed #FDBA74',
                fontSize: '0.82rem', color: '#7C2D12',
              }}>
                <div><b>สรุปเมนูวันนี้:</b> {currentMeta.riceType} + {currentMeta.mainDish1} + {currentMeta.mainDish2} + {currentMeta.dessertOrFruit}</div>
                <div style={{ marginTop: 4 }}>
                  <b>คุณค่าทางโภชนาการ:</b> ครบ 5 หมู่ ({currentMeta.caloriesKcal} kcal) · ปลอดภัย ถูกสุขอนามัย
                </div>
              </div>
            </div>

            {/* Per-Class Daily & Monthly Lunch Table */}
            <div style={{ background: '#FFFFFF', borderRadius: 16, padding: 20, border: '1px solid #E2E8F0' }}>
              <h3 style={{ margin: '0 0 12px', fontSize: '1.05rem', fontWeight: 900, color: '#0F172A' }}>
                📋 จำนวนนักเรียนที่รับประทานอาหารกลางวันแยกตามชั้น ({fmtThai(date)})
              </h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0' }}>
                      <th style={th}>ชั้น</th>
                      <th style={th}>ทั้งหมด</th>
                      <th style={th}>🍱 ทานวันนี้</th>
                      <th style={th}>งบวันนี้ (บ.)</th>
                      <th style={th}>สะสมเดือนนี้</th>
                      <th style={th}>จัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dayPerClass.map((x, idx) => {
                      const mStat = monthPerClass[idx];
                      return (
                        <tr key={x.c.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ ...td, fontWeight: 800, textAlign: 'left' }}>{x.c.label}</td>
                          <td style={td}>{x.c.students.length}</td>
                          <td style={{ ...td, color: '#EA580C', fontWeight: 900 }}>{x.lunch} คน</td>
                          <td style={{ ...td, fontWeight: 700 }}>{(x.lunch * LUNCH_RATE_PER_HEAD).toLocaleString()}</td>
                          <td style={{ ...td, color: '#0284C7', fontWeight: 800 }}>{mStat?.totalLunch || x.lunch} มื้อ</td>
                          <td style={td}>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedClassId(x.c.id);
                                setActiveTab('roster');
                              }}
                              style={{
                                background: '#F1F5F9', border: '1px solid #CBD5E1',
                                borderRadius: 6, padding: '4px 10px', fontSize: '0.74rem',
                                fontWeight: 800, cursor: 'pointer', color: '#1E293B',
                              }}
                            >
                              <Edit3 size={12} style={{ verticalAlign: 'middle' }} /> รายชื่อ
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    <tr style={{ background: '#FFF7ED', fontWeight: 900 }}>
                      <td style={{ ...td, textAlign: 'left' }}>รวมทั้งโรงเรียน</td>
                      <td style={td}>{totalStudents}</td>
                      <td style={{ ...td, color: '#EA580C' }}>{dayTotalLunch} คน</td>
                      <td style={{ ...td, color: '#9A3412' }}>{dayBudget.toLocaleString()} บ.</td>
                      <td style={{ ...td, color: '#0284C7' }}>
                        {monthPerClass.reduce((s, m) => s + m.totalLunch, 0) || dayTotalLunch} มื้อ
                      </td>
                      <td style={td}>—</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: CLEANING DUTY & ZONING */}
        {activeTab === 'duty' && (
          <div style={{ background: '#FFFFFF', borderRadius: 16, padding: 20, border: '1px solid #E2E8F0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: '#0F172A' }}>
                  🧹 ตารางตรวจเวรทำความสะอาดเขตพื้นที่ประจำวัน ({fmtThai(date)})
                </h3>
                <div style={{ fontSize: '0.8rem', color: '#64748B', marginTop: 2 }}>
                  นักเรียนที่มาเรียนทุกคนมีส่วนร่วมดูแลเขตพื้นที่ประจำชั้น · คลิกให้ดาวประเมินความสะอาดรายเขตพื้นที่
                </div>
              </div>
              <Link
                to={`/print-form/duty?classId=${selectedClassId}&month=${month}`}
                style={{
                  background: '#15803D', color: 'white', textDecoration: 'none',
                  padding: '8px 16px', borderRadius: 8, fontSize: '0.8rem', fontWeight: 800,
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}
              >
                <Printer size={14} /> พิมพ์ฟอร์มเช็คเวรรายเดือน (เหมือนใบนม)
              </Link>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#0F172A', color: 'white' }}>
                    <th style={{ ...th, color: 'white', width: 85 }}>ระดับชั้น</th>
                    <th style={{ ...th, color: 'white', textAlign: 'left' }}>เขตพื้นที่รับผิดชอบความสะอาด (School Zoning)</th>
                    <th style={{ ...th, color: 'white', width: 170 }}>ครูผู้ควบคุมเขต</th>
                    <th style={{ ...th, color: 'white', width: 120 }}>ทำเวรวันนี้</th>
                    <th style={{ ...th, color: 'white', width: 150 }}>ระดับความสะอาด</th>
                    <th style={{ ...th, color: 'white', width: 180 }}>หมายเหตุ / ผลตรวจ</th>
                    <th style={{ ...th, color: 'white', width: 90 }}>รายคน</th>
                  </tr>
                </thead>
                <tbody>
                  {dayPerClass.map(x => (
                    <tr key={x.c.id} style={{ borderBottom: '1px solid #E2E8F0' }}>
                      <td style={{ ...td, fontWeight: 900, color: '#0F172A' }}>{x.c.label}</td>
                      <td style={{ ...td, textAlign: 'left', fontWeight: 700, color: '#1E293B' }}>
                        📍 {x.zoneInfo.zoneName}
                      </td>
                      <td style={{ ...td, color: '#475569', fontWeight: 700 }}>{x.zoneInfo.teacher}</td>
                      <td style={{ ...td, color: '#15803D', fontWeight: 900 }}>
                        🧹 {x.duty}/{x.c.students.length} คน
                      </td>
                      <td style={td}>
                        <div style={{ display: 'inline-flex', gap: 2 }}>
                          {[1, 2, 3, 4, 5].map(star => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => {
                                const nextScores = {
                                  ...currentMeta.zoneScores,
                                  [x.c.id]: { ...x.zoneScore, rating: star },
                                };
                                saveMeta({ ...currentMeta, zoneScores: nextScores });
                              }}
                              style={{
                                background: 'none', border: 'none', padding: 1, cursor: 'pointer',
                                color: star <= x.zoneScore.rating ? '#F59E0B' : '#CBD5E1',
                              }}
                            >
                              <Star size={16} fill={star <= x.zoneScore.rating ? '#F59E0B' : 'none'} />
                            </button>
                          ))}
                        </div>
                      </td>
                      <td style={td}>
                        <input
                          value={x.zoneScore.note}
                          onChange={e => {
                            const nextScores = {
                              ...currentMeta.zoneScores,
                              [x.c.id]: { ...x.zoneScore, note: e.target.value },
                            };
                            saveMeta({ ...currentMeta, zoneScores: nextScores });
                          }}
                          style={{
                            width: '100%', padding: '5px 8px', borderRadius: 6,
                            border: '1px solid #CBD5E1', fontSize: '0.78rem',
                          }}
                        />
                      </td>
                      <td style={td}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedClassId(x.c.id);
                            setActiveTab('roster');
                          }}
                          style={{
                            background: '#DCFCE7', color: '#166534', border: 'none',
                            borderRadius: 6, padding: '5px 10px', fontSize: '0.75rem',
                            fontWeight: 800, cursor: 'pointer',
                          }}
                        >
                          ดูรายชื่อ
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: INDIVIDUAL STUDENT ROSTER TOGGLE (เหมือนหน้าเช็คชื่อ/นม) */}
        {activeTab === 'roster' && selectedClassObj && (
          <div style={{ background: '#FFFFFF', borderRadius: 16, padding: 20, border: '1px solid #E2E8F0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <label style={{ fontWeight: 900, color: '#0F172A' }}>🏫 เลือกห้องเรียน:</label>
                <select
                  value={selectedClassId}
                  onChange={e => setSelectedClassId(e.target.value)}
                  style={{ ...inp, fontWeight: 800 }}
                >
                  {availableClasses.map(c => (
                    <option key={c.id} value={c.id}>
                      ชั้น {c.label} ({c.students.length} คน)
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: '0.82rem', color: '#64748B' }}>
                  เขตพื้นที่: <b>{DEFAULT_ZONES[selectedClassObj.label]?.zoneName || '-'}</b>
                </span>
              </div>

              <div style={{ fontSize: '0.8rem', color: '#15803D', fontWeight: 800 }}>
                💡 คลิกที่ปุ่ม 🍱 อาหารกลางวัน หรือ 🧹 ทำเวร เพื่อสลับสถานะรายคน
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 10 }}>
              {selectedClassObj.students.map((st, idx) => {
                const rec = selectedClassDoc?.records?.[st.id] || { status: 'present' };
                const isPresent = rec.status === 'present';
                const hasLunch = isPresent && !rec.noLunch;
                const hasDuty = isPresent && !rec.noDuty;

                return (
                  <div
                    key={st.id}
                    style={{
                      border: '1px solid #E2E8F0',
                      borderLeft: `4px solid ${isPresent ? '#16A34A' : '#EF4444'}`,
                      borderRadius: 12,
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                      background: isPresent ? '#FFFFFF' : '#FEF2F2',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700 }}>
                        เลขที่ {idx + 1} · รหัส {st.code || st.id}
                      </div>
                      <div style={{ fontWeight: 800, color: '#0F172A', fontSize: '0.9rem' }}>
                        {st.name}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: isPresent ? '#16A34A' : '#DC2626', fontWeight: 800 }}>
                        สถานะเช็คชื่อ: {isPresent ? '✓ มาเรียน' : rec.status === 'leave' ? 'ล ลา' : '✗ ขาดเรียน'}
                      </div>
                    </div>

                    {isPresent ? (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => toggleStudentFlag(selectedClassObj.id, st.id, 'noLunch')}
                          style={{
                            padding: '6px 10px',
                            borderRadius: 8,
                            border: `1px solid ${hasLunch ? '#FDBA74' : '#CBD5E1'}`,
                            background: hasLunch ? '#FFEDD5' : '#F1F5F9',
                            color: hasLunch ? '#C2410C' : '#64748B',
                            fontWeight: 800,
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          🍱 {hasLunch ? 'ได้กิน' : 'ไม่กิน'}
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleStudentFlag(selectedClassObj.id, st.id, 'noDuty')}
                          style={{
                            padding: '6px 10px',
                            borderRadius: 8,
                            border: `1px solid ${hasDuty ? '#86EFAC' : '#CBD5E1'}`,
                            background: hasDuty ? '#DCFCE7' : '#F1F5F9',
                            color: hasDuty ? '#15803D' : '#64748B',
                            fontWeight: 800,
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          🧹 {hasDuty ? 'ทำเวร' : 'งดเวร'}
                        </button>
                      </div>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: '#94A3B8', fontWeight: 700 }}>
                        ไม่ได้มาเรียน
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ================= OFFICIAL A4 PRINT SHEET FOR DAILY LUNCH & DUTY REPORT ================= */}
      <div className="only-print-lunch-duty print-area">
        <div className="ld-print-sheet">
          <div style={{ textAlign: 'center', marginBottom: 10 }}>
            <img
              src={`${import.meta.env.BASE_URL}images/school-logo.png`}
              alt="ตราโรงเรียน"
              style={{ width: 56, height: 56, objectFit: 'contain', margin: '0 auto 4px' }}
            />
            <div style={{ fontSize: '14pt', fontWeight: 800 }}>
              แบบบันทึกการตรวจสอบโครงการอาหารกลางวันและเวรทำความสะอาดเขตพื้นที่ประจำวัน
            </div>
            <div style={{ fontSize: '11.5pt', fontWeight: 700 }}>
              {SCHOOL_NAME} &nbsp; {SCHOOL_AFFILIATION}
            </div>
            <div style={{ fontSize: '11pt', fontWeight: 700, marginTop: 2 }}>
              ประจำวันที่ {fmtThai(date)} &nbsp;|&nbsp; ครูเวรผู้ตรวจ: {currentMeta.inspectTeacher}
            </div>
          </div>

          {/* Box 1: Menu Info */}
          <div style={{ border: '1px solid #000', padding: '8px 12px', marginBottom: 10, fontSize: '10.5pt', lineHeight: 1.5 }}>
            <div style={{ fontWeight: 800, textDecoration: 'underline', marginBottom: 4 }}>
              ส่วนที่ 1: รายการเมนูอาหารกลางวันและงบประมาณประจำวัน
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
              <div><b>ข้าว/อาหารหลัก:</b> {currentMeta.riceType}</div>
              <div><b>พลังงานเฉลี่ย:</b> {currentMeta.caloriesKcal} กิโลแคลอรี (ครบ 5 หมู่)</div>
              <div><b>รายการกับข้าวที่ 1:</b> {currentMeta.mainDish1}</div>
              <div><b>รายการกับข้าวที่ 2:</b> {currentMeta.mainDish2}</div>
              <div><b>ผลไม้/ของหวาน:</b> {currentMeta.dessertOrFruit}</div>
              <div>
                <b>จำนวนผู้รับประทาน:</b> {dayTotalLunch} คน &nbsp;
                (งบประมาณ {dayBudget.toLocaleString()} บาท)
              </div>
            </div>
          </div>

          {/* Box 2: Per-Class Table */}
          <div style={{ fontWeight: 800, fontSize: '10.5pt', marginBottom: 4 }}>
            ส่วนที่ 2: สรุปจำนวนนักเรียนที่รับประทานอาหารกลางวันและผลตรวจเวรทำความสะอาดเขตพื้นที่
          </div>
          <table className="ld-table">
            <thead>
              <tr>
                <th style={{ width: '8%' }}>ชั้น</th>
                <th style={{ width: '8%' }}>นักเรียน<br />ทั้งหมด</th>
                <th style={{ width: '10%' }}>รับประทาน<br />อาหาร (คน)</th>
                <th style={{ width: '10%' }}>ปฏิบัติเวร<br />(คน)</th>
                <th style={{ width: '38%' }}>เขตพื้นที่รับผิดชอบความสะอาด</th>
                <th style={{ width: '10%' }}>คะแนน<br />(เต็ม 5)</th>
                <th style={{ width: '16%' }}>ผลการตรวจ</th>
              </tr>
            </thead>
            <tbody>
              {dayPerClass.map(x => (
                <tr key={x.c.id}>
                  <td style={{ textAlign: 'center', fontWeight: 700 }}>{x.c.label}</td>
                  <td style={{ textAlign: 'center' }}>{x.c.students.length}</td>
                  <td style={{ textAlign: 'center', fontWeight: 700 }}>{x.lunch}</td>
                  <td style={{ textAlign: 'center', fontWeight: 700 }}>{x.duty}</td>
                  <td>{x.zoneInfo.zoneName}</td>
                  <td style={{ textAlign: 'center', fontWeight: 700 }}>{x.zoneScore.rating} / 5</td>
                  <td style={{ textAlign: 'center' }}>{x.zoneScore.note}</td>
                </tr>
              ))}
              <tr style={{ fontWeight: 800, background: '#F8FAFC' }}>
                <td style={{ textAlign: 'center' }}>รวม</td>
                <td style={{ textAlign: 'center' }}>{totalStudents}</td>
                <td style={{ textAlign: 'center' }}>{dayTotalLunch}</td>
                <td style={{ textAlign: 'center' }}>{dayTotalDuty}</td>
                <td colSpan={3} style={{ textAlign: 'center' }}>
                  ผ่านเกณฑ์มาตรฐานสุขาภิบาลอาหารและสิ่งแวดล้อมในโรงเรียน
                </td>
              </tr>
            </tbody>
          </table>

          <div style={{
            marginTop: 22, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
            gap: 16, textAlign: 'center', fontSize: '10.5pt', lineHeight: 1.6,
          }}>
            <div>
              <div>ลงชื่อ....................................................</div>
              <div>({currentMeta.inspectTeacher})</div>
              <div>ครูเวรประจำวัน / ผู้ตรวจสอบ</div>
            </div>
            <div>
              <div>ลงชื่อ....................................................</div>
              <div>(....................................................)</div>
              <div>เจ้าหน้าที่โภชนาการ / โครงการอาหารกลางวัน</div>
            </div>
            <div>
              <div>ลงชื่อ....................................................</div>
              <div style={{ fontWeight: 800 }}>({DIRECTOR_NAME})</div>
              <div>ผู้อำนวยการ{SCHOOL_NAME}</div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .only-print-lunch-duty {
          display: none;
        }
        .ld-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 10pt;
        }
        .ld-table th, .ld-table td {
          border: 1px solid #000;
          padding: 4px 6px;
        }
        .ld-table th {
          background: #F1F5F9;
          text-align: center;
          font-weight: 800;
        }
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          .no-print {
            display: none !important;
          }
          .only-print-lunch-duty {
            display: block !important;
          }
          .ld-print-sheet {
            width: 100%;
            font-family: 'Sarabun', 'TH SarabunPSK', sans-serif;
            color: #000;
          }
        }
      `}</style>
    </SmartSchoolLayout>
  );
}

function KpiCard({ icon, label, value, sub, color }: { icon: string; label: string; value: string; sub: string; color: string }) {
  return (
    <div style={{
      background: '#FFFFFF',
      borderRadius: 14,
      padding: '14px 16px',
      border: '1px solid #E2E8F0',
      borderLeft: `5px solid ${color}`,
      boxShadow: '0 2px 8px rgba(15,23,42,0.03)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.76rem', fontWeight: 800, color: '#64748B' }}>{label}</span>
        <span style={{ fontSize: '1.35rem' }}>{icon}</span>
      </div>
      <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0F172A', marginTop: 4 }}>{value}</div>
      <div style={{ fontSize: '0.72rem', color, fontWeight: 700, marginTop: 2 }}>{sub}</div>
    </div>
  );
}

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const fmtThai = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  return `${d} ${months[(m || 1) - 1]} ${(y || 2026) + 543}`;
};

const lbl: React.CSSProperties = {
  display: 'block',
  fontSize: '0.75rem',
  color: '#475569',
  marginBottom: 4,
  fontWeight: 800,
};

const inp: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 8,
  border: '1px solid #CBD5E1',
  fontSize: '0.86rem',
  color: '#0F172A',
};

const btnAction: React.CSSProperties = {
  color: 'white',
  border: 'none',
  borderRadius: 8,
  padding: '9px 14px',
  fontWeight: 800,
  fontSize: '0.82rem',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
};

const tabPill: React.CSSProperties = {
  padding: '10px 16px',
  borderRadius: 10,
  border: '1px solid #E2E8F0',
  fontWeight: 800,
  fontSize: '0.85rem',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
};

const th: React.CSSProperties = {
  padding: '10px 10px',
  fontWeight: 800,
  fontSize: '0.78rem',
  textAlign: 'center',
};

const td: React.CSSProperties = {
  padding: '8px 10px',
  textAlign: 'center',
};
