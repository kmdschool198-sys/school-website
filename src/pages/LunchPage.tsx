import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useSchoolRoster } from '../utils/useSchoolRoster';
import {
  Utensils, Sparkles, Download, Printer, CheckCircle2, Users,
  Edit3,
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
const LUNCH_RATE_PER_HEAD = 22; // งบประมาณอาหารกลางวัน สพฐ. / อปท. 22 บาท/คน/วัน

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

export interface DailyLunchMeta {
  date: string;
  mainDish1: string;
  mainDish2: string;
  dessertOrFruit: string;
  riceType: string;
  caloriesKcal: number;
  inspectTeacher: string;
  cookName: string;
  tasteRating: 'ดีมาก' | 'ดี' | 'พอใช้';
  hygieneRating: 'ดีมาก' | 'ดี' | 'พอใช้';
  quantityRating: 'เพียงพอ' | 'ไม่เพียงพอ';
  note: string;
  updatedAt?: number;
}

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
    riceType: 'ข้าวกล้องผสมข้าวหอมมะลิ',
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
  {
    label: 'ชุดที่ 6: ต้มยำไก่น้ำใส + ไข่ลูกเขย + ฝรั่งสด',
    riceType: 'ข้าวสวยหอมมะลิ',
    mainDish1: 'ต้มยำไก่เห็ดนางฟ้าสมุนไพรน้ำใส',
    mainDish2: 'ไข่ลูกเขยทรงเครื่องหอมเจียว',
    dessertOrFruit: 'ฝรั่งกิมจูสดกรอบ',
    caloriesKcal: 600,
  },
];

const STORAGE_LUNCH_META_KEY = 'kmd_lunch_meta_v2';

export default function LunchPage() {
  const auth = useTeacherAuth();
  if (!auth.authed) {
    return (
      <TeacherLoginGate
        title="🍱 ระบบโครงการอาหารกลางวันนักเรียน"
        subtitle="บันทึกรายการอาหาร ตรวจสอบคุณค่าโภชนาการ และสรุปงบประมาณอุดหนุน"
      />
    );
  }
  return <LunchContent userName={auth.name} />;
}

function LunchContent({ userName }: { userName: string }) {
  const { classes: availableClasses } = useSchoolRoster();
  const [date, setDate] = useState(todayStr());
  const [allDocs, setAllDocs] = useState<AttDoc[]>([]);
  const [activeTab, setActiveTab] = useState<'menu' | 'roster'>('menu');
  const [selectedClassId, setSelectedClassId] = useState<string>('p1_1');
  const [csvPeriod, setCsvPeriod] = useState<'month' | 'year'>('month');
  const [csvScope, setCsvScope] = useState<string>('all');
  const [savedToast, setSavedToast] = useState<string | null>(null);

  // Daily Lunch Menu & Inspection Meta
  const [metaMap, setMetaMap] = useState<Record<string, DailyLunchMeta>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_LUNCH_META_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return {};
  });

  // Realtime subscription from Cloud Firestore
  useEffect(() => {
    return onSnapshot(doc(db, 'config', 'daily_lunch'), snap => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.metaMap && typeof data.metaMap === 'object') {
          setMetaMap(prev => {
            const merged = { ...prev, ...data.metaMap };
            try {
              localStorage.setItem(STORAGE_LUNCH_META_KEY, JSON.stringify(merged));
            } catch { /* ignore */ }
            return merged;
          });
        }
      }
    });
  }, []);

  const currentMeta: DailyLunchMeta = useMemo(() => {
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
      inspectTeacher: userName || 'ครูเวรโภชนาการ',
      cookName: `แม่ครัว${SCHOOL_NAME}`,
      tasteRating: 'ดีมาก',
      hygieneRating: 'ดีมาก',
      quantityRating: 'เพียงพอ',
      note: 'อาหารปรุงสุกใหม่ สะอาด ถูกสุขอนามัย นักเรียนรับประทานครบถ้วน',
    };
  }, [metaMap, date, userName]);

  const saveMeta = async (next: DailyLunchMeta) => {
    const cleanMeta: DailyLunchMeta = {
      date: next.date || date,
      riceType: next.riceType || 'ข้าวสวยหอมมะลิ',
      mainDish1: next.mainDish1 || '',
      mainDish2: next.mainDish2 || '',
      dessertOrFruit: next.dessertOrFruit || '',
      caloriesKcal: Number(next.caloriesKcal) || 550,
      inspectTeacher: next.inspectTeacher || userName || 'ครูเวรโภชนาการ',
      cookName: next.cookName || `แม่ครัว${SCHOOL_NAME}`,
      tasteRating: next.tasteRating || 'ดีมาก',
      hygieneRating: next.hygieneRating || 'ดีมาก',
      quantityRating: next.quantityRating || 'เพียงพอ',
      note: next.note || '',
      updatedAt: Date.now(),
    };
    const updated = { ...metaMap, [date]: cleanMeta };
    setMetaMap(updated);
    try {
      localStorage.setItem(STORAGE_LUNCH_META_KEY, JSON.stringify(updated));
    } catch { /* fallback local */ }
    try {
      await setDoc(doc(db, 'config', 'daily_lunch'), {
        metaMap: updated,
        lastUpdatedDate: date,
        updatedAt: Date.now(),
      }, { merge: true });
      setSavedToast('บันทึกลงฐานข้อมูล Cloud Firestore เรียบร้อย');
    } catch (err) {
      console.error('Failed to save lunch meta to Firestore:', err);
      setSavedToast('บันทึกในเครื่องแล้ว (กำลังรอส่งขึ้น Firestore)');
    }
    setTimeout(() => setSavedToast(null), 2500);
  };

  const resetMeta = async () => {
    if (!window.confirm(`ต้องการรีเซ็ต/ล้างข้อมูลเมนูอาหารกลางวันประจำวันที่ ${date} หรือไม่?`)) return;
    const updated = { ...metaMap };
    delete updated[date];
    setMetaMap(updated);
    try {
      localStorage.setItem(STORAGE_LUNCH_META_KEY, JSON.stringify(updated));
      await setDoc(doc(db, 'config', 'daily_lunch'), {
        metaMap: updated,
        lastUpdatedDate: date,
        updatedAt: Date.now(),
      }, { merge: true });
      setSavedToast('รีเซ็ตข้อมูลอาหารกลางวันเรียบร้อย');
    } catch (e) {
      console.error('Failed to reset lunch meta:', e);
    }
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

  // Per-day per-class calculation
  const dayDocs = useMemo(() => allDocs.filter(d => d.date === date), [allDocs, date]);

  const dayPerClass = useMemo(() => availableClasses.map(c => {
    const docItem = dayDocs.find(d => d.classId === c.id);
    let lunchCount = 0;
    let presentCount = 0;
    if (docItem && docItem.records) {
      Object.values(docItem.records).forEach((r: AttRecord) => {
        if (r.status === 'present') {
          presentCount++;
          if (!r.noLunch) lunchCount++;
        }
      });
    } else {
      // Default: present students eat lunch
      presentCount = c.students.length;
      lunchCount = c.students.length;
    }
    return {
      c,
      presentCount,
      lunch: lunchCount,
      checked: !!docItem,
    };
  }), [availableClasses, dayDocs]);

  const dayTotalLunch = dayPerClass.reduce((s, x) => s + x.lunch, 0);
  const dayBudget = dayTotalLunch * LUNCH_RATE_PER_HEAD;

  // Month summary per class
  const monthPerClass = useMemo(() => availableClasses.map(c => {
    const docs = allDocs.filter(d => d.classId === c.id && d.date.startsWith(month));
    let totalLunch = 0;
    const days = new Set<string>();
    docs.forEach(d => {
      days.add(d.date);
      Object.values(d.records || {}).forEach((r: AttRecord) => {
        if (r.status === 'present' && !r.noLunch) totalLunch++;
      });
    });
    return { c, totalLunch, days: days.size };
  }), [availableClasses, allDocs, month]);

  const toggleStudentLunch = async (classId: string, studentId: string) => {
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
      noLunch: !cur.noLunch,
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
      setSavedToast('อัปเดตสถานะการรับประทานอาหารลง Cloud Firestore แล้ว');
    } catch (err) {
      console.error('Failed to sync student lunch to attendance collection:', err);
      setSavedToast('อัปเดตสถานะการรับประทานอาหารในเครื่องแล้ว');
    }
    setTimeout(() => setSavedToast(null), 2000);
  };

  const exportCsv = () => {
    const titleLabel = 'รายงานการรับประทานอาหารกลางวัน';
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
            const ok = record.status === 'present' && !record.noLunch;
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
              if (record.status === 'present' && !record.noLunch) mYes++;
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
          ? ['ที่', 'รหัส', 'ชื่อ-สกุล', ...daysInMonth(month).map(String), 'รวมทาน (มื้อ)', 'ไม่ได้ทาน/ขาด']
          : ['ที่', 'รหัส', 'ชื่อ-สกุล', ...THAI_MONTHS_FULL.map(m => `${m}`), 'รวมทั้งหมด', 'จำนวนวันที่มีข้อมูล'],
        rows: rows.length ? rows : [['-', '-', 'ยังไม่มีรายชื่อนักเรียน']],
      };
    });

    const reportRows = makeSectionedReportRows({
      title: `${titleLabel} ${SCHOOL_NAME}`,
      subtitle: csvPeriod === 'month' ? `รายเดือน ${monthLabel(month)}` : `รายปี ${yearLabel(year)}`,
      meta: [
        ['ขอบเขต', csvScope === 'all' ? 'ทุกชั้น' : `ชั้น ${targetClasses[0]?.label || '-'}`],
        ['เมนูประจำวัน', `${currentMeta.riceType} · ${currentMeta.mainDish1} · ${currentMeta.mainDish2} · ${currentMeta.dessertOrFruit}`],
        ['อัตราอุดหนุน', `${LUNCH_RATE_PER_HEAD} บาท/คน/วัน`],
        ['ผู้ส่งออก', userName],
      ],
      sections,
      footerRows: [['คำอธิบาย', '✓ = มาเรียนและได้รับอาหารกลางวัน, ✗ = ขาด/ลา/ไม่ได้รับ']],
    });

    downloadCsvReport(
      `${titleLabel}_${csvScope === 'all' ? 'ทุกชั้น' : targetClasses[0]?.label || 'ชั้น'}_${month}.csv`,
      reportRows
    );
  };

  const selectedClassObj = availableClasses.find(c => c.id === selectedClassId) || availableClasses[0];
  const selectedClassDoc = dayDocs.find(d => d.classId === selectedClassObj?.id);

  return (
    <SmartSchoolLayout pageTitle="ระบบอาหารกลางวันนักเรียน">
      <div className="no-print">
        {/* Header Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
              🍱 ระบบโครงการอาหารกลางวันนักเรียน
            </h1>
            <div style={{ fontSize: '0.84rem', color: '#64748B', marginTop: 2 }}>
              ควบคุมคุณภาพอาหารตามหลักโภชนาการ (Thai School Lunch) · ตรวจรับรองเมนูและคำนวณงบประมาณ {LUNCH_RATE_PER_HEAD} บ./คน
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
              <Printer size={15} /> พิมพ์แบบบันทึกรายเดือน (ทางการ)
            </Link>
            <button
              type="button"
              onClick={() => window.print()}
              style={{
                background: '#0F172A', color: 'white', border: 'none',
                borderRadius: 999, padding: '9px 16px', fontWeight: 800, fontSize: '0.82rem',
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              <Printer size={15} /> พิมพ์รายงานตรวจอาหารกลางวันวันนี้ (A4)
            </button>
            <Link
              to="/duty"
              style={{
                background: '#059669', color: 'white', textDecoration: 'none',
                borderRadius: 999, padding: '9px 16px', fontWeight: 800, fontSize: '0.82rem',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              🧹 ไปหน้าระบบเวรประจำวัน →
            </Link>
          </div>
        </div>

        {/* Sync Info Banner */}
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
              <b>ระบบเช็คชื่ออัตโนมัติ:</b> นักเรียนที่เช็คชื่อ <b>"มาเรียน"</b> จะถูกนับว่า <b>"ได้รับประทานอาหารกลางวัน ✓"</b> โดยอัตโนมัติ (แก้ไขเฉพาะรายบุคคลได้ที่แท็บรายชื่อ)
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

        {/* Date & Filter Bar */}
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
          <button onClick={exportCsv} style={{ ...btnAction, background: '#EA580C' }}>
            <Download size={14} /> ดาวน์โหลด CSV อาหารกลางวัน
          </button>
        </div>

        {/* KPI Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
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
            sub={`คิดเป็น ${totalStudents ? Math.round((dayTotalLunch / totalStudents) * 100) : 0}% ของนักเรียน`}
            color="#EA580C"
          />
          <KpiCard
            icon="💰"
            label={`งบประมาณวันนี้ (${LUNCH_RATE_PER_HEAD} บ./คน)`}
            value={`${dayBudget.toLocaleString()} บาท`}
            sub="ตามเกณฑ์งบอุดหนุน สพฐ. / อปท."
            color="#D97706"
          />
          <KpiCard
            icon="🍎"
            label="พลังงานและคุณค่าอาหาร"
            value={`${currentMeta.caloriesKcal} kcal`}
            sub="ครบ 5 หมู่ ถูกหลักสุขาภิบาล"
            color="#16A34A"
          />
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setActiveTab('menu')}
            style={{
              ...tabPill,
              background: activeTab === 'menu' ? '#EA580C' : '#FFFFFF',
              color: activeTab === 'menu' ? '#FFFFFF' : '#334155',
            }}
          >
            <Utensils size={16} /> 1. เมนูอาหาร & สรุปจำนวนนักเรียน/งบประมาณรายห้อง
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('roster')}
            style={{
              ...tabPill,
              background: activeTab === 'roster' ? '#EA580C' : '#FFFFFF',
              color: activeTab === 'roster' ? '#FFFFFF' : '#334155',
            }}
          >
            <Users size={16} /> 2. ตรวจสอบ/แก้ไขรายชื่อนักเรียนรายห้อง ({selectedClassObj?.label})
          </button>
        </div>

        {/* TAB 1: MENU & PER-CLASS TABLE */}
        {activeTab === 'menu' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
            {/* Daily Menu & Evaluation Card */}
            <div style={{ background: '#FFFFFF', borderRadius: 16, padding: 20, border: '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: '#0F172A' }}>
                  🍲 เมนูอาหารกลางวันและประเมินคุณภาพ ({fmtThai(date)})
                </h3>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={resetMeta}
                    style={{
                      fontSize: '0.74rem', fontWeight: 700, background: '#FEE2E2',
                      color: '#991B1B', border: '1px solid #FECACA', padding: '4px 10px', borderRadius: 8,
                      cursor: 'pointer',
                    }}
                  >
                    ล้าง/รีเซ็ตวันนี้
                  </button>
                  <span style={{
                    fontSize: '0.74rem', fontWeight: 800, background: '#FFEDD5',
                    color: '#C2410C', padding: '4px 10px', borderRadius: 999,
                  }}>
                    Thai School Lunch
                  </span>
                </div>
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
                  <label style={lbl}>🍚 ข้าว / อาหารหลัก</label>
                  <input
                    value={currentMeta.riceType}
                    onChange={e => saveMeta({ ...currentMeta, riceType: e.target.value })}
                    style={{ ...inp, width: '100%' }}
                  />
                </div>
                <div>
                  <label style={lbl}>🔥 พลังงาน (กิโลแคลอรี)</label>
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
                  <label style={lbl}>🍗 กับข้าวรายการที่ 2 (ทอด/โปรตีน)</label>
                  <input
                    value={currentMeta.mainDish2}
                    onChange={e => saveMeta({ ...currentMeta, mainDish2: e.target.value })}
                    style={{ ...inp, width: '100%' }}
                  />
                </div>
                <div>
                  <label style={lbl}>🍉 ผลไม้ / ขนมหวาน</label>
                  <input
                    value={currentMeta.dessertOrFruit}
                    onChange={e => saveMeta({ ...currentMeta, dessertOrFruit: e.target.value })}
                    style={{ ...inp, width: '100%' }}
                  />
                </div>
                <div>
                  <label style={lbl}>👩‍🍳 แม่ครัวผู้ปรุงอาหาร</label>
                  <input
                    value={currentMeta.cookName}
                    onChange={e => saveMeta({ ...currentMeta, cookName: e.target.value })}
                    style={{ ...inp, width: '100%' }}
                  />
                </div>
              </div>

              {/* Quality Evaluation Controls */}
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 900, color: '#0F172A', marginBottom: 8 }}>
                  ⭐ ผลการตรวจรับรองคุณภาพอาหารประจำวัน:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
                  <div>
                    <label style={lbl}>รสชาติอาหาร</label>
                    <select
                      value={currentMeta.tasteRating}
                      onChange={e => saveMeta({ ...currentMeta, tasteRating: e.target.value as any })}
                      style={{ ...inp, width: '100%' }}
                    >
                      <option value="ดีมาก">ดีมาก</option>
                      <option value="ดี">ดี</option>
                      <option value="พอใช้">พอใช้</option>
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>ความสะอาด/สุขลักษณะ</label>
                    <select
                      value={currentMeta.hygieneRating}
                      onChange={e => saveMeta({ ...currentMeta, hygieneRating: e.target.value as any })}
                      style={{ ...inp, width: '100%' }}
                    >
                      <option value="ดีมาก">ดีมาก</option>
                      <option value="ดี">ดี</option>
                      <option value="พอใช้">พอใช้</option>
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>ปริมาณอาหาร</label>
                    <select
                      value={currentMeta.quantityRating}
                      onChange={e => saveMeta({ ...currentMeta, quantityRating: e.target.value as any })}
                      style={{ ...inp, width: '100%' }}
                    >
                      <option value="เพียงพอ">เพียงพอ</option>
                      <option value="ไม่เพียงพอ">ไม่เพียงพอ</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={lbl}>👩‍🏫 ครูเวรตรวจอาหาร / ผู้ตรวจบันทึก</label>
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
                <div><b>สรุปเมนูวันนี้:</b> {currentMeta.riceType} · {currentMeta.mainDish1} · {currentMeta.mainDish2} · {currentMeta.dessertOrFruit}</div>
                <div style={{ marginTop: 4 }}>
                  <b>คุณค่าทางอาหาร:</b> ครบ 5 หมู่ ({currentMeta.caloriesKcal} kcal) · รสชาติ: {currentMeta.tasteRating} · ความสะอาด: {currentMeta.hygieneRating} · ปริมาณ: {currentMeta.quantityRating}
                </div>
              </div>
            </div>

            {/* Per-Class Lunch Table */}
            <div style={{ background: '#FFFFFF', borderRadius: 16, padding: 20, border: '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: '#0F172A' }}>
                  📋 จำนวนผู้รับประทานและงบประมาณแยกตามชั้น ({fmtThai(date)})
                </h3>
                <span style={{ fontSize: '0.78rem', color: '#64748B' }}>
                  อัตรา <b>{LUNCH_RATE_PER_HEAD} บ./คน</b>
                </span>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0' }}>
                      <th style={th}>ระดับชั้น</th>
                      <th style={th}>ทั้งหมด</th>
                      <th style={th}>🍱 ทานวันนี้</th>
                      <th style={th}>งบวันนี้ (บาท)</th>
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

        {/* TAB 2: INDIVIDUAL STUDENT ROSTER TOGGLE */}
        {activeTab === 'roster' && selectedClassObj && (
          <div style={{ background: '#FFFFFF', borderRadius: 16, padding: 20, border: '1px solid #E2E8F0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <label style={{ fontWeight: 900, color: '#0F172A' }}>🏫 เลือกระดับชั้น:</label>
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
                  รับประทานอาหารวันนี้: <b>{dayPerClass.find(d => d.c.id === selectedClassObj.id)?.lunch || 0}/{selectedClassObj.students.length} คน</b>
                </span>
              </div>

              <div style={{ fontSize: '0.8rem', color: '#EA580C', fontWeight: 800 }}>
                💡 คลิกที่ปุ่ม 🍱 ด้านล่างเพื่อเปิด/ปิดสถานะการรับประทานอาหารรายคน
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: 10 }}>
              {selectedClassObj.students.map((st, idx) => {
                const rec = selectedClassDoc?.records?.[st.id] || { status: 'present' };
                const isPresent = rec.status === 'present';
                const hasLunch = isPresent && !rec.noLunch;

                return (
                  <div
                    key={st.id}
                    style={{
                      border: '1px solid #E2E8F0',
                      borderLeft: `4px solid ${hasLunch ? '#EA580C' : '#CBD5E1'}`,
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
                        สถานะ: {isPresent ? '✓ มาเรียน' : rec.status === 'leave' ? 'ล ลา' : '✗ ขาดเรียน'}
                      </div>
                    </div>

                    {isPresent ? (
                      <button
                        type="button"
                        onClick={() => toggleStudentLunch(selectedClassObj.id, st.id)}
                        style={{
                          padding: '7px 12px',
                          borderRadius: 8,
                          border: `1px solid ${hasLunch ? '#FDBA74' : '#CBD5E1'}`,
                          background: hasLunch ? '#FFEDD5' : '#F1F5F9',
                          color: hasLunch ? '#C2410C' : '#64748B',
                          fontWeight: 800,
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        🍱 {hasLunch ? 'ได้รับอาหาร ✓' : 'ไม่ได้รับ ✗'}
                      </button>
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

      {/* ================= OFFICIAL A4 PRINT SHEET FOR LUNCH REPORT ================= */}
      <div className="only-print-lunch">
        <div className="lunch-print-sheet">
          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <img
              src={`${import.meta.env.BASE_URL}images/school-logo.png`}
              alt="ตราโรงเรียน"
              style={{ width: 62, height: 62, objectFit: 'contain', margin: '0 auto 4px' }}
            />
            <div style={{ fontSize: '15pt', fontWeight: 800 }}>
              แบบรายงานการตรวจสอบคุณภาพและควบคุมอาหารกลางวันนักเรียนประจำวัน
            </div>
            <div style={{ fontSize: '12pt', fontWeight: 700 }}>
              {SCHOOL_NAME} &nbsp; {SCHOOL_AFFILIATION}
            </div>
            <div style={{ fontSize: '11pt', fontWeight: 700, marginTop: 3 }}>
              ประจำวันที่ {fmtThai(date)} &nbsp;|&nbsp; อัตราอุดหนุน {LUNCH_RATE_PER_HEAD} บาท/คน/วัน
            </div>
          </div>

          {/* Box 1: Menu & Quality Inspection Details */}
          <div style={{ border: '1.5px solid #000', padding: '10px 14px', marginBottom: 12, fontSize: '10.5pt', lineHeight: 1.6 }}>
            <div style={{ fontWeight: 800, textDecoration: 'underline', marginBottom: 6 }}>
              ส่วนที่ 1: รายการอาหารกลางวันและคุณค่าทางโภชนาการ (Thai School Lunch)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <div><b>ข้าว / อาหารหลัก:</b> {currentMeta.riceType}</div>
              <div><b>พลังงานเฉลี่ย:</b> {currentMeta.caloriesKcal} กิโลแคลอรี (ครบ 5 หมู่)</div>
              <div><b>กับข้าวรายการที่ 1:</b> {currentMeta.mainDish1}</div>
              <div><b>กับข้าวรายการที่ 2:</b> {currentMeta.mainDish2}</div>
              <div><b>ผลไม้ / ของหวาน:</b> {currentMeta.dessertOrFruit}</div>
              <div><b>ผู้ปรุงอาหาร / แม่ครัว:</b> {currentMeta.cookName}</div>
            </div>

            <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px dashed #666', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
              <div><b>รสชาติอาหาร:</b> {currentMeta.tasteRating}</div>
              <div><b>ความสะอาด/สุขลักษณะ:</b> {currentMeta.hygieneRating}</div>
              <div><b>ปริมาณอาหาร:</b> {currentMeta.quantityRating}</div>
            </div>
            <div style={{ marginTop: 4 }}>
              <b>บันทึกเพิ่มเติม:</b> {currentMeta.note}
            </div>
          </div>

          {/* Box 2: Per-Class Headcount & Budget */}
          <div style={{ fontWeight: 800, fontSize: '11pt', marginBottom: 4 }}>
            ส่วนที่ 2: สรุปจำนวนนักเรียนที่รับประทานอาหารกลางวันและงบประมาณประจำวัน
          </div>
          <table className="lunch-table">
            <thead>
              <tr>
                <th style={{ width: '12%' }}>ระดับชั้น</th>
                <th style={{ width: '15%' }}>จำนวนนักเรียนทั้งหมด</th>
                <th style={{ width: '18%' }}>รับประทานอาหาร (คน)</th>
                <th style={{ width: '18%' }}>ไม่ได้รับประทาน (คน)</th>
                <th style={{ width: '20%' }}>งบประมาณที่ใช้ (บาท)</th>
                <th style={{ width: '17%' }}>หมายเหตุ</th>
              </tr>
            </thead>
            <tbody>
              {dayPerClass.map(x => (
                <tr key={x.c.id}>
                  <td style={{ textAlign: 'center', fontWeight: 700 }}>{x.c.label}</td>
                  <td style={{ textAlign: 'center' }}>{x.c.students.length}</td>
                  <td style={{ textAlign: 'center', fontWeight: 700 }}>{x.lunch}</td>
                  <td style={{ textAlign: 'center' }}>{x.c.students.length - x.lunch}</td>
                  <td style={{ textAlign: 'right', paddingRight: 14 }}>{(x.lunch * LUNCH_RATE_PER_HEAD).toLocaleString()}</td>
                  <td style={{ textAlign: 'center' }}>เรียบร้อย</td>
                </tr>
              ))}
              <tr style={{ fontWeight: 800, background: '#F8FAFC' }}>
                <td style={{ textAlign: 'center' }}>รวมทั้งสิ้น</td>
                <td style={{ textAlign: 'center' }}>{totalStudents}</td>
                <td style={{ textAlign: 'center' }}>{dayTotalLunch}</td>
                <td style={{ textAlign: 'center' }}>{totalStudents - dayTotalLunch}</td>
                <td style={{ textAlign: 'right', paddingRight: 14, fontWeight: 900 }}>{dayBudget.toLocaleString()}</td>
                <td style={{ textAlign: 'center' }}>บาท</td>
              </tr>
            </tbody>
          </table>

          {/* Signatures */}
          <div style={{
            marginTop: 26, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
            gap: 16, textAlign: 'center', fontSize: '10.5pt', lineHeight: 1.6,
          }}>
            <div>
              <div>ลงชื่อ....................................................</div>
              <div>({currentMeta.cookName})</div>
              <div>ผู้ประกอบอาหาร / แม่ครัว</div>
            </div>
            <div>
              <div>ลงชื่อ....................................................</div>
              <div>({currentMeta.inspectTeacher})</div>
              <div>ครูเวรตรวจอาหารกลางวัน / ผู้รายงาน</div>
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
        .only-print-lunch {
          display: none;
        }
        .lunch-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 10pt;
        }
        .lunch-table th, .lunch-table td {
          border: 1px solid #000;
          padding: 5px 8px;
        }
        .lunch-table th {
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
          .only-print-lunch {
            display: block !important;
          }
          .lunch-print-sheet {
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