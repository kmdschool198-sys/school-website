import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useSchoolRoster } from '../utils/useSchoolRoster';
import {
  ClipboardCheck, Sparkles, Download, Printer, CheckCircle2, Users,
  Star,
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
const DEPUTY_NAME = 'นางสาวเจนจีรา บุญเกตุ';

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

export interface DailyDutyMeta {
  date: string;
  dutyLeader: string;
  dutyTeachers: string;
  gateDutyMorning: string;
  gateDutyEvening: string;
  flagCeremonyStatus: 'เรียบร้อยดีมาก' | 'เรียบร้อย' | 'ปรับปรุง';
  overallIncident: string;
  zoneScores: Record<string, { rating: number; note: string }>;
  updatedAt?: number;
}

const DEFAULT_ZONES: Record<string, { zoneName: string; teacher: string }> = {
  'อ.2/1': { zoneName: 'อาคารปฐมวัย ห้องเรียน อ.2 และสนามเด็กเล่นโซน A', teacher: 'นางสาวณัฐณิชา ภักดี' },
  'อ.3/1': { zoneName: 'อาคารปฐมวัย ห้องเรียน อ.3 และระเบียงหน้าอาคาร', teacher: 'นางสาวณัฐณิชา ภักดี' },
  'ป.1/1': { zoneName: 'ห้องเรียน ป.1 และทางเดินอาคารประถมชั้นล่าง (ฝั่งตะวันออก)', teacher: 'นางสาวธิดารัตน์ แรตสอน' },
  'ป.2/1': { zoneName: 'ห้องเรียน ป.2 และลานอเนกประสงค์หน้าเสาธง', teacher: 'นางสาวภัทรสุดา สุหงษา' },
  'ป.3/1': { zoneName: 'ห้องเรียน ป.3 และบริเวณโรงอาหาร/จุดวางภาชนะ', teacher: 'นางสาวไอยรดา อาจจีน' },
  'ป.4/1': { zoneName: 'ห้องเรียน ป.4 และห้องน้ำนักเรียนชาย-หญิง (ฝั่งประถม)', teacher: 'นายพีระ เดชะผล' },
  'ป.5/1': { zoneName: 'ห้องเรียน ป.5 ห้องสมุด และสวนหย่อมหน้าอาคาร', teacher: 'นายนวพานิชณ์ วังคีรี' },
  'ป.6/1': { zoneName: 'ห้องเรียน ป.6 ห้องปฏิบัติการคอมพิวเตอร์ และลานกีฬา', teacher: 'นางสาวอาริษา ฉิมสุพร, นายพิศุทธิ์ เชาวลิตโรจน์' },
  'ม.1/1': { zoneName: 'อาคารมัธยมศึกษา ห้อง ม.1 และโรงอาหารฝั่งมัธยม', teacher: 'นางสาวจิราภา พานชัย, นายอนันตชัย เพ็ชรรี่' },
  'ม.2/1': { zoneName: 'อาคารมัธยมศึกษา ห้อง ม.2 และห้องน้ำฝั่งมัธยม', teacher: 'นายอรรถชัย แก้วเอี่ยม' },
  'ม.3/1': { zoneName: 'อาคารมัธยมศึกษา ห้อง ม.3 แปลงเกษตร และแนวรั้วหน้าโรงเรียน', teacher: 'นางสาวนริศรา ทำจิตรเหมาะ, นายธิติวุฒิ เตยไธสง' },
};

const STORAGE_DUTY_META_KEY = 'kmd_duty_meta_v2';

export default function DutyPage() {
  const auth = useTeacherAuth();
  if (!auth.authed) {
    return (
      <TeacherLoginGate
        title="🧹 ระบบเวรประจำวัน & เขตพื้นที่ความสะอาด"
        subtitle="ตรวจ 11 เขตพื้นที่รับผิดชอบ ให้คะแนนความสะอาด และบันทึกการปฏิบัติหน้าที่ครูเวร"
      />
    );
  }
  return <DutyContent userName={auth.name} />;
}

function DutyContent({ userName }: { userName: string }) {
  const { classes: availableClasses } = useSchoolRoster();
  const [date, setDate] = useState(todayStr());
  const [allDocs, setAllDocs] = useState<AttDoc[]>([]);
  const [activeTab, setActiveTab] = useState<'duty' | 'roster'>('duty');
  const [selectedClassId, setSelectedClassId] = useState<string>('p1_1');
  const [csvPeriod, setCsvPeriod] = useState<'month' | 'year'>('month');
  const [csvScope, setCsvScope] = useState<string>('all');
  const [savedToast, setSavedToast] = useState<string | null>(null);

  // Daily Duty Meta (Zones & Teacher Log)
  const [metaMap, setMetaMap] = useState<Record<string, DailyDutyMeta>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_DUTY_META_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return {};
  });

  // Realtime subscription from Cloud Firestore
  useEffect(() => {
    return onSnapshot(doc(db, 'config', 'daily_duty'), snap => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.metaMap && typeof data.metaMap === 'object') {
          setMetaMap(prev => {
            const merged = { ...prev, ...data.metaMap };
            try {
              localStorage.setItem(STORAGE_DUTY_META_KEY, JSON.stringify(merged));
            } catch { /* ignore */ }
            return merged;
          });
        }
      }
    });
  }, []);

  const currentMeta: DailyDutyMeta = useMemo(() => {
    if (metaMap[date]) return metaMap[date];
    return {
      date,
      dutyLeader: userName || 'ครูเวรหัวหน้าสาย',
      dutyTeachers: 'ครูเวรประจำวันทุกท่าน',
      gateDutyMorning: 'เวรรับนักเรียนประตูหน้า 07:00 - 08:00 น. เรียบร้อย',
      gateDutyEvening: 'เวรส่งนักเรียนประตูหน้า 15:30 - 16:30 น. ปลอดภัย',
      flagCeremonyStatus: 'เรียบร้อยดีมาก',
      overallIncident: 'เหตุการณ์ทั่วไปปกติ นักเรียนร่วมใจรักษาความสะอาดตามเขตพื้นที่อย่างเรียบร้อย',
      zoneScores: {},
    };
  }, [metaMap, date, userName]);

  const saveMeta = async (next: DailyDutyMeta) => {
    const cleanMeta: DailyDutyMeta = {
      date: next.date || date,
      dutyLeader: next.dutyLeader || '',
      dutyTeachers: next.dutyTeachers || '',
      gateDutyMorning: next.gateDutyMorning || '',
      gateDutyEvening: next.gateDutyEvening || '',
      flagCeremonyStatus: next.flagCeremonyStatus || 'เรียบร้อยดีมาก',
      overallIncident: next.overallIncident || '',
      zoneScores: next.zoneScores || {},
      updatedAt: Date.now(),
    };
    const updated = { ...metaMap, [date]: cleanMeta };
    setMetaMap(updated);
    try {
      localStorage.setItem(STORAGE_DUTY_META_KEY, JSON.stringify(updated));
    } catch { /* fallback local */ }
    try {
      await setDoc(doc(db, 'config', 'daily_duty'), {
        metaMap: updated,
        lastUpdatedDate: date,
        updatedAt: Date.now(),
      }, { merge: true });
      setSavedToast('บันทึกลงฐานข้อมูล Cloud Firestore เรียบร้อย');
    } catch (err) {
      console.error('Failed to save duty meta to Firestore:', err);
      setSavedToast('บันทึกในเครื่องแล้ว (กำลังรอส่งขึ้น Firestore)');
    }
    setTimeout(() => setSavedToast(null), 2500);
  };

  const resetMeta = async () => {
    if (!window.confirm(`ต้องการรีเซ็ต/ล้างข้อมูลบันทึกเวรประจำวันที่ ${date} หรือไม่?`)) return;
    const updated = { ...metaMap };
    delete updated[date];
    setMetaMap(updated);
    try {
      localStorage.setItem(STORAGE_DUTY_META_KEY, JSON.stringify(updated));
      await setDoc(doc(db, 'config', 'daily_duty'), {
        metaMap: updated,
        lastUpdatedDate: date,
        updatedAt: Date.now(),
      }, { merge: true });
      setSavedToast('รีเซ็ตข้อมูลเวรประจำวันเรียบร้อย');
    } catch (e) {
      console.error('Failed to reset duty meta:', e);
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
    let dutyCount = 0;
    let presentCount = 0;
    if (docItem && docItem.records) {
      Object.values(docItem.records).forEach((r: AttRecord) => {
        if (r.status === 'present') {
          presentCount++;
          if (!r.noDuty) dutyCount++;
        }
      });
    } else {
      presentCount = c.students.length;
      dutyCount = c.students.length;
    }
    const zoneInfo = DEFAULT_ZONES[c.label] || { zoneName: `ห้องเรียน ${c.label} และบริเวณโดยรอบ`, teacher: 'ครูประจำชั้น' };
    const zoneScore = currentMeta.zoneScores?.[c.id] || { rating: 5, note: 'สะอาดเรียบร้อยดีมาก' };
    return {
      c,
      presentCount,
      duty: dutyCount,
      checked: !!docItem,
      zoneInfo,
      zoneScore,
    };
  }), [availableClasses, dayDocs, currentMeta]);

  const dayTotalDuty = dayPerClass.reduce((s, x) => s + x.duty, 0);

  const toggleStudentDuty = async (classId: string, studentId: string) => {
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
      noDuty: !cur.noDuty,
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
      setSavedToast('อัปเดตสถานะการทำเวรลง Cloud Firestore แล้ว');
    } catch (err) {
      console.error('Failed to sync student duty to attendance collection:', err);
      setSavedToast('อัปเดตสถานะการทำเวรในเครื่องแล้ว');
    }
    setTimeout(() => setSavedToast(null), 2000);
  };

  const exportCsv = () => {
    const titleLabel = 'รายงานการปฏิบัติเวรทำความสะอาดประจำวัน';
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
            const ok = record.status === 'present' && !record.noDuty;
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
              if (record.status === 'present' && !record.noDuty) mYes++;
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
          ? ['ที่', 'รหัส', 'ชื่อ-สกุล', ...daysInMonth(month).map(String), 'รวมทำเวร (ครั้ง)', 'ไม่ได้ทำ/ขาด']
          : ['ที่', 'รหัส', 'ชื่อ-สกุล', ...THAI_MONTHS_FULL.map(m => `${m}`), 'รวมทั้งหมด', 'จำนวนวันที่มีข้อมูล'],
        rows: rows.length ? rows : [['-', '-', 'ยังไม่มีรายชื่อนักเรียน']],
      };
    });

    const reportRows = makeSectionedReportRows({
      title: `${titleLabel} ${SCHOOL_NAME}`,
      subtitle: csvPeriod === 'month' ? `รายเดือน ${monthLabel(month)}` : `รายปี ${yearLabel(year)}`,
      meta: [
        ['ขอบเขต', csvScope === 'all' ? 'ทุกชั้น' : `ชั้น ${targetClasses[0]?.label || '-'}`],
        ['ครูเวรหัวหน้าสาย', currentMeta.dutyLeader],
        ['ผู้ส่งออก', userName],
      ],
      sections,
      footerRows: [['คำอธิบาย', '✓ = มาเรียนและปฏิบัติเวรทำความสะอาด, ✗ = ขาด/ลา/งดเวร']],
    });

    downloadCsvReport(
      `${titleLabel}_${csvScope === 'all' ? 'ทุกชั้น' : targetClasses[0]?.label || 'ชั้น'}_${month}.csv`,
      reportRows
    );
  };

  const selectedClassObj = availableClasses.find(c => c.id === selectedClassId) || availableClasses[0];
  const selectedClassDoc = dayDocs.find(d => d.classId === selectedClassObj?.id);

  return (
    <SmartSchoolLayout pageTitle="ระบบเวรประจำวัน & เขตพื้นที่">
      <div className="no-print">
        {/* Header Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
              🧹 ระบบเวรประจำวัน & เขตพื้นที่ความสะอาด
            </h1>
            <div style={{ fontSize: '0.84rem', color: '#64748B', marginTop: 2 }}>
              ตรวจ 11 เขตพื้นที่รับผิดชอบ (School Zoning) · ให้คะแนนความสะอาด 1-5 ดาว และบันทึกการปฏิบัติหน้าที่ครูเวร
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
              to={`/print-form/duty?classId=${selectedClassId}&month=${month}`}
              style={{
                background: '#059669', color: 'white', textDecoration: 'none',
                borderRadius: 999, padding: '9px 16px', fontWeight: 800, fontSize: '0.82rem',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              <Printer size={15} /> พิมพ์ฟอร์มเช็คเวรรายเดือน (ทางการ)
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
              <Printer size={15} /> พิมพ์ใบตรวจเขตเวรประจำวัน (A4)
            </button>
            <Link
              to="/lunch"
              style={{
                background: '#EA580C', color: 'white', textDecoration: 'none',
                borderRadius: 999, padding: '9px 16px', fontWeight: 800, fontSize: '0.82rem',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              🍱 ไปหน้าระบบอาหารกลางวัน →
            </Link>
          </div>
        </div>

        {/* Sync Info Banner */}
        <div style={{
          background: 'linear-gradient(135deg, #ECFDF5, #D1FAE5)',
          border: '1px solid #A7F3D0',
          color: '#065F46',
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
            <Sparkles size={20} color="#059669" />
            <div style={{ fontSize: '0.86rem', fontWeight: 700 }}>
              <b>ระบบเช็คชื่ออัตโนมัติ:</b> นักเรียนที่เช็คชื่อ <b>"มาเรียน"</b> จะถูกนับว่า <b>"ปฏิบัติเวรทำความสะอาด ✓"</b> ในเขตพื้นที่ประจำชั้นทันที (สลับสถานะรายคนได้ที่แท็บรายชื่อ)
            </div>
          </div>
          <Link
            to="/attendance"
            style={{
              background: '#059669', color: 'white', textDecoration: 'none',
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
          <QuickDate value={date} onChange={setDate} color="#059669" />
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
          <button onClick={exportCsv} style={{ ...btnAction, background: '#059669' }}>
            <Download size={14} /> ดาวน์โหลด CSV เวรความสะอาด
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
            icon="🧹"
            label="ปฏิบัติเวรเขตพื้นที่วันนี้"
            value={`${dayTotalDuty} คน`}
            sub={`คิดเป็น ${totalStudents ? Math.round((dayTotalDuty / totalStudents) * 100) : 0}% ของนักเรียนทั้งหมด`}
            color="#059669"
          />
          <KpiCard
            icon="📍"
            label="เขตพื้นที่รับผิดชอบความสะอาด"
            value="11 เขตพื้นที่"
            sub="ครอบคลุมทั่วบริเวณโรงเรียน"
            color="#8B5CF6"
          />
          <KpiCard
            icon="👩‍🏫"
            label="ครูเวรหัวหน้าสายผู้ตรวจ"
            value={currentMeta.dutyLeader.split(' ')[0] || 'ครูเวร'}
            sub="ตรวจรับรองความสะอาด 11 จุด"
            color="#D97706"
          />
        </div>

        {/* Teacher Duty Daily Log Box */}
        <div style={{ background: '#FFFFFF', borderRadius: 16, padding: 18, border: '1px solid #E2E8F0', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 900, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 6 }}>
              📋 บันทึกการปฏิบัติหน้าที่ครูเวรประจำวัน ({fmtThai(date)})
            </h3>
            <button
              type="button"
              onClick={resetMeta}
              style={{
                background: '#FEE2E2', color: '#991B1B', border: '1px solid #FECACA',
                borderRadius: 8, padding: '5px 12px', fontSize: '0.75rem', fontWeight: 700,
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
              }}
            >
              ล้าง / รีเซ็ตข้อมูลวันนี้
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
            <div>
              <label style={lbl}>ครูเวรหัวหน้าสาย / ผู้บันทึก</label>
              <input
                value={currentMeta.dutyLeader}
                onChange={e => saveMeta({ ...currentMeta, dutyLeader: e.target.value })}
                style={{ ...inp, width: '100%' }}
              />
            </div>
            <div>
              <label style={lbl}>กิจกรรมหน้าเสาธงช่วงเช้า</label>
              <select
                value={currentMeta.flagCeremonyStatus}
                onChange={e => saveMeta({ ...currentMeta, flagCeremonyStatus: e.target.value as any })}
                style={{ ...inp, width: '100%' }}
              >
                <option value="เรียบร้อยดีมาก">เรียบร้อยดีมาก</option>
                <option value="เรียบร้อย">เรียบร้อย</option>
                <option value="ปรับปรุง">ต้องปรับปรุง</option>
              </select>
            </div>
            <div>
              <label style={lbl}>การปฏิบัติหน้าที่เวรประตูหน้า (เช้า 07:00-08:00)</label>
              <input
                value={currentMeta.gateDutyMorning}
                onChange={e => saveMeta({ ...currentMeta, gateDutyMorning: e.target.value })}
                style={{ ...inp, width: '100%' }}
              />
            </div>
            <div>
              <label style={lbl}>การปฏิบัติหน้าที่เวรประตูหน้า (เย็น 15:30-16:30)</label>
              <input
                value={currentMeta.gateDutyEvening}
                onChange={e => saveMeta({ ...currentMeta, gateDutyEvening: e.target.value })}
                style={{ ...inp, width: '100%' }}
              />
            </div>
          </div>

          <div style={{ marginTop: 10 }}>
            <label style={lbl}>สรุปเหตุการณ์ทั่วไปในโรงเรียน / ข้อสังเกตประจำวัน</label>
            <input
              value={currentMeta.overallIncident}
              onChange={e => saveMeta({ ...currentMeta, overallIncident: e.target.value })}
              style={{ ...inp, width: '100%' }}
            />
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setActiveTab('duty')}
            style={{
              ...tabPill,
              background: activeTab === 'duty' ? '#059669' : '#FFFFFF',
              color: activeTab === 'duty' ? '#FFFFFF' : '#334155',
            }}
          >
            <ClipboardCheck size={16} /> 1. ตารางตรวจ 11 เขตพื้นที่ความสะอาด (School Zoning)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('roster')}
            style={{
              ...tabPill,
              background: activeTab === 'roster' ? '#059669' : '#FFFFFF',
              color: activeTab === 'roster' ? '#FFFFFF' : '#334155',
            }}
          >
            <Users size={16} /> 2. ตรวจสอบ/แก้ไขรายชื่อนักเรียนทำเวรรายห้อง ({selectedClassObj?.label})
          </button>
        </div>

        {/* TAB 1: 11 ZONES TABLE */}
        {activeTab === 'duty' && (
          <div style={{ background: '#FFFFFF', borderRadius: 16, padding: 20, border: '1px solid #E2E8F0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: '#0F172A' }}>
                  🧹 ผลการตรวจประเมินความสะอาด 11 เขตพื้นที่ ({fmtThai(date)})
                </h3>
                <div style={{ fontSize: '0.8rem', color: '#64748B', marginTop: 2 }}>
                  คลิกที่ดาว ⭐ เพื่อให้คะแนน 1-5 ดาว และพิมพ์บันทึกข้อเสนอแนะรายเขตพื้นที่
                </div>
              </div>
              <span style={{
                background: '#ECFDF5', color: '#065F46', padding: '5px 12px',
                borderRadius: 999, fontSize: '0.78rem', fontWeight: 800,
              }}>
                11 เขตพื้นที่มาตรฐาน
              </span>
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
                      <td style={{ ...td, color: '#059669', fontWeight: 900 }}>
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
                  <tr style={{ background: '#F8FAFC', fontWeight: 900 }}>
                    <td style={{ ...td, textAlign: 'center' }}>รวมทั้งโรงเรียน</td>
                    <td style={{ ...td, textAlign: 'left' }}>11 เขตพื้นที่ความสะอาดทั่วบริเวณโรงเรียน</td>
                    <td style={td}>—</td>
                    <td style={{ ...td, color: '#059669' }}>{dayTotalDuty}/{totalStudents} คน</td>
                    <td style={{ ...td, color: '#D97706' }}>5 / 5 ดาว (ผ่านเกณฑ์)</td>
                    <td style={{ ...td, textAlign: 'center' }}>สะอาดเรียบร้อยดีมาก</td>
                    <td style={td}>—</td>
                  </tr>
                </tbody>
              </table>
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
                  เขตพื้นที่: <b>{DEFAULT_ZONES[selectedClassObj.label]?.zoneName || '-'}</b>
                </span>
              </div>

              <div style={{ fontSize: '0.8rem', color: '#059669', fontWeight: 800 }}>
                💡 คลิกที่ปุ่ม 🧹 ด้านล่างเพื่อเปิด/ปิดสถานะการปฏิบัติเวรรายบุคคล
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: 10 }}>
              {selectedClassObj.students.map((st, idx) => {
                const rec = selectedClassDoc?.records?.[st.id] || { status: 'present' };
                const isPresent = rec.status === 'present';
                const hasDuty = isPresent && !rec.noDuty;

                return (
                  <div
                    key={st.id}
                    style={{
                      border: '1px solid #E2E8F0',
                      borderLeft: `4px solid ${hasDuty ? '#059669' : '#CBD5E1'}`,
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
                      <div style={{ fontSize: '0.72rem', color: isPresent ? '#059669' : '#DC2626', fontWeight: 800 }}>
                        สถานะ: {isPresent ? '✓ มาเรียน' : rec.status === 'leave' ? 'ล ลา' : '✗ ขาดเรียน'}
                      </div>
                    </div>

                    {isPresent ? (
                      <button
                        type="button"
                        onClick={() => toggleStudentDuty(selectedClassObj.id, st.id)}
                        style={{
                          padding: '7px 12px',
                          borderRadius: 8,
                          border: `1px solid ${hasDuty ? '#86EFAC' : '#CBD5E1'}`,
                          background: hasDuty ? '#DCFCE7' : '#F1F5F9',
                          color: hasDuty ? '#059669' : '#64748B',
                          fontWeight: 800,
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        🧹 {hasDuty ? 'ปฏิบัติเวร ✓' : 'งดเวร ✗'}
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

      {/* ================= OFFICIAL A4 PRINT SHEET FOR DUTY REPORT ================= */}
      <div className="only-print-duty">
        <div className="duty-print-sheet">
          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <img
              src={`${import.meta.env.BASE_URL}images/school-logo.png`}
              alt="ตราโรงเรียน"
              style={{ width: 62, height: 62, objectFit: 'contain', margin: '0 auto 4px' }}
            />
            <div style={{ fontSize: '15pt', fontWeight: 800 }}>
              แบบบันทึกการปฏิบัติหน้าที่ครูเวรประจำวันและตรวจเขตพื้นที่ความสะอาด
            </div>
            <div style={{ fontSize: '12pt', fontWeight: 700 }}>
              {SCHOOL_NAME} &nbsp; {SCHOOL_AFFILIATION}
            </div>
            <div style={{ fontSize: '11pt', fontWeight: 700, marginTop: 3 }}>
              ประจำวันที่ {fmtThai(date)} &nbsp;|&nbsp; ครูเวรผู้รับผิดชอบ: {currentMeta.dutyLeader}
            </div>
          </div>

          {/* Box 1: Teacher Daily Duty Summary */}
          <div style={{ border: '1.5px solid #000', padding: '10px 14px', marginBottom: 12, fontSize: '10pt', lineHeight: 1.6 }}>
            <div style={{ fontWeight: 800, textDecoration: 'underline', marginBottom: 4 }}>
              ส่วนที่ 1: บันทึกการปฏิบัติหน้าที่ครูเวรประจำวัน
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <div><b>ครูเวรหัวหน้าสาย:</b> {currentMeta.dutyLeader}</div>
              <div><b>กิจกรรมหน้าเสาธง:</b> {currentMeta.flagCeremonyStatus}</div>
              <div><b>เวรประตูหน้า (เช้า):</b> {currentMeta.gateDutyMorning}</div>
              <div><b>เวรประตูหน้า (เย็น):</b> {currentMeta.gateDutyEvening}</div>
            </div>
            <div style={{ marginTop: 4 }}>
              <b>สรุปเหตุการณ์ทั่วไปในโรงเรียน:</b> {currentMeta.overallIncident}
            </div>
          </div>

          {/* Box 2: 11 Cleaning Zones Table */}
          <div style={{ fontWeight: 800, fontSize: '11pt', marginBottom: 4 }}>
            ส่วนที่ 2: ผลการตรวจประเมิน 11 เขตพื้นที่รับผิดชอบความสะอาด (School Zoning)
          </div>
          <table className="duty-table">
            <thead>
              <tr>
                <th style={{ width: '8%' }}>ชั้น</th>
                <th style={{ width: '38%' }}>เขตพื้นที่รับผิดชอบความสะอาด</th>
                <th style={{ width: '18%' }}>ครูผู้ควบคุมเขต</th>
                <th style={{ width: '10%' }}>นักเรียนทำเวร</th>
                <th style={{ width: '10%' }}>คะแนน (5)</th>
                <th style={{ width: '16%' }}>ผลการประเมิน</th>
              </tr>
            </thead>
            <tbody>
              {dayPerClass.map(x => (
                <tr key={x.c.id}>
                  <td style={{ textAlign: 'center', fontWeight: 700 }}>{x.c.label}</td>
                  <td>{x.zoneInfo.zoneName}</td>
                  <td style={{ textAlign: 'center' }}>{x.zoneInfo.teacher}</td>
                  <td style={{ textAlign: 'center', fontWeight: 700 }}>{x.duty}/{x.c.students.length}</td>
                  <td style={{ textAlign: 'center', fontWeight: 700 }}>{x.zoneScore.rating} / 5</td>
                  <td style={{ textAlign: 'center' }}>{x.zoneScore.note}</td>
                </tr>
              ))}
              <tr style={{ fontWeight: 800, background: '#F8FAFC' }}>
                <td style={{ textAlign: 'center' }}>รวม</td>
                <td colSpan={2}>ครอบคลุม 11 เขตพื้นที่ทั่วทั้งโรงเรียน</td>
                <td style={{ textAlign: 'center' }}>{dayTotalDuty} คน</td>
                <td style={{ textAlign: 'center' }}>5 / 5</td>
                <td style={{ textAlign: 'center' }}>ผ่านเกณฑ์เรียบร้อยดี</td>
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
              <div>({currentMeta.dutyLeader})</div>
              <div>ครูเวรประจำวัน / ผู้บันทึก</div>
            </div>
            <div>
              <div>ลงชื่อ....................................................</div>
              <div>({DEPUTY_NAME})</div>
              <div>รองผู้อำนวยการ{SCHOOL_NAME}</div>
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
        .only-print-duty {
          display: none;
        }
        .duty-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 9.5pt;
        }
        .duty-table th, .duty-table td {
          border: 1px solid #000;
          padding: 4px 6px;
        }
        .duty-table th {
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
          .only-print-duty {
            display: block !important;
          }
          .duty-print-sheet {
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