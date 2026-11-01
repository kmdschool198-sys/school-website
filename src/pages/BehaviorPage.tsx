import { useState, useMemo, useEffect } from 'react';
import { arrayRemove, arrayUnion, doc, onSnapshot, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { sameStudent } from '../utils/studentKey';
import { useSchoolRoster, type UnifiedClassRoster } from '../utils/useSchoolRoster';
import {
  ShieldAlert, Award, PlusCircle, MinusCircle, Printer, Download,
  Search, History, FileWarning, ArrowLeft, Trash2, CheckCircle2,
  Edit3, X,
} from 'lucide-react';
import SmartSchoolLayout from '../components/SmartSchoolLayout';
import TeacherLoginGate from '../components/TeacherLoginGate';
import { useTeacherAuth } from '../utils/teacherAuth';
import { downloadCsvReport } from '../utils/csvReport';
import { SCHOOL_NAME, SCHOOL_AFFILIATION } from '../config/siteLinks';

const DIRECTOR_NAME = 'นายปรัชญา ปรางค์ชัยภูมิ';
const STORAGE_KEY = 'kmd_behavior_logs_v2_dmc';

export interface BehaviorLogEntry {
  id: string;
  studentCode: string;
  studentId?: string;      // student_xxxx (older entries have only studentCode)
  studentName: string;
  classId: string;
  classLabel: string;
  date: string;
  type: 'add' | 'deduct';
  points: number; // positive number, e.g. 5 or 10
  reason: string;
  teacher: string;
  createdAt: number;
}

const DEDUCT_PRESETS = [
  { label: '⏰ มาเรียนสายเกินเวลาเข้าแถวเคารพธงชาติ', points: 3 },
  { label: '👕 แต่งกาย / ทรงผม / เล็บ ผิดระเบียบโรงเรียน', points: 5 },
  { label: '🧹 ไม่ปฏิบัติเวรทำความสะอาดเขตพื้นที่รับผิดชอบ', points: 5 },
  { label: '📚 ไม่ส่งงานตามกำหนด / ไม่นำอุปกรณ์การเรียนมา', points: 3 },
  { label: '📵 หนีเรียน / ออกนอกห้องเรียนโดยไม่ขออนุญาต', points: 10 },
  { label: '🗣️ พูดจาไม่สุภาพ / ล้อเลียนหรือแกล้งเพื่อน', points: 10 },
  { label: '⚠️ ทะเลาะวิวาท / ทำลายทรัพย์สินของโรงเรียน', points: 20 },
];

const ADD_PRESETS = [
  { label: '🌟 ช่วยเหลืองานครูอาจารย์ด้วยความเต็มใจ (จิตอาสา)', points: 5 },
  { label: '🧹 บำเพ็ญประโยชน์ / ดูแลความสะอาดเขตพื้นที่ดีเด่น', points: 5 },
  { label: '🙏 มีสัมมาคารวะ แต่งกายถูกระเบียบเป็นแบบอย่างที่ดี', points: 3 },
  { label: '💎 เก็บสิ่งของหรือเงินได้แล้วนำส่งคืนเจ้าของ (ซื่อสัตย์สุจริต)', points: 10 },
  { label: '🏆 สร้างชื่อเสียงให้โรงเรียน / เป็นผู้นำกิจกรรมนักเรียน', points: 10 },
];

type PrintDocMode = 'none' | 'warning' | 'award' | 'class_summary';

export default function BehaviorPage() {
  const auth = useTeacherAuth();
  if (!auth.authed) {
    return (
      <TeacherLoginGate
        title="🛡️ ระบบคะแนนความประพฤติ (กิจการนักเรียน)"
        subtitle="บันทึกตัด-เพิ่มคะแนนพฤติกรรม สรุปแต้มอัตโนมัติ และพิมพ์ใบเตือน/เกียรติบัตรความดี"
      />
    );
  }
  return <BehaviorContent userName={auth.name} />;
}

function BehaviorContent({ userName }: { userName: string }) {
  const { classes: unifiedRosters } = useSchoolRoster();
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [logs, setLogs] = useState<BehaviorLogEntry[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch { /* ignore */ }
    return []; // nothing cached yet: wait for Firestore, never show made-up entries
  });

  // Action Modal state
  const [modalStudent, setModalStudent] = useState<{
    id: string;
    code: string;
    name: string;
    no: number;
    mode: 'add' | 'deduct';
  } | null>(null);
  const [customReason, setCustomReason] = useState<string>('');
  const [customPoints, setCustomPoints] = useState<number>(5);
  const [logDate, setLogDate] = useState<string>(todayStr());
  const [toast, setToast] = useState<string | null>(null);

  // Edit and Delete Confirmation state
  const [editingLog, setEditingLog] = useState<BehaviorLogEntry | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Print Document state
  const [printMode, setPrintMode] = useState<PrintDocMode>('none');
  const [printStudentCode, setPrintStudentCode] = useState<string | null>(null);

  // Subscribe to Firestore config/behavior_logs if available
  useEffect(() => {
    return onSnapshot(doc(db, 'config', 'behavior_logs'), snap => {
      if (snap.exists()) {
        const data = snap.data() as { logs?: BehaviorLogEntry[] };
        if (Array.isArray(data.logs)) {
          setLogs(data.logs);
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data.logs));
          } catch { /* ignore */ }
        }
      }
    });
  }, []);

  // Each change adds or removes only its own entry (arrayUnion / arrayRemove), so two teachers
  // recording at the same time both keep their entries, and an old copy on one device can never
  // overwrite the school's list. The snapshot above brings everyone's entries back.
  const BEHAVIOR_DOC = doc(db, 'config', 'behavior_logs');
  const saveChange = async (remove: BehaviorLogEntry | null, add: BehaviorLogEntry | null) => {
    setLogs(prev => {
      const without = remove ? prev.filter(l => l.id !== remove.id) : prev;
      return add ? [add, ...without.filter(l => l.id !== add.id)] : without;
    });
    try {
      if (remove && add) {
        const batch = writeBatch(db);
        batch.update(BEHAVIOR_DOC, { logs: arrayRemove(remove) });
        batch.update(BEHAVIOR_DOC, { logs: arrayUnion(add), updatedAt: Date.now() });
        await batch.commit();
      } else if (add) {
        await setDoc(BEHAVIOR_DOC, { logs: arrayUnion(add), updatedAt: Date.now() }, { merge: true });
      } else if (remove) {
        await setDoc(BEHAVIOR_DOC, { logs: arrayRemove(remove), updatedAt: Date.now() }, { merge: true });
      }
    } catch (err) {
      console.error('Failed to save behavior log to Firestore:', err);
      setToast('บันทึกไม่สำเร็จ — ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่');
    }
  };

  const currentClass = useMemo<UnifiedClassRoster>(
    () =>
      unifiedRosters.find(c => c.classId === selectedClassId || c.acadId === selectedClassId) ||
      unifiedRosters[8] ||
      unifiedRosters[0],
    [unifiedRosters, selectedClassId]
  );

  // Compute behavior summary per student (base 100 points) — All students in class (unfiltered)
  const allClassBehaviorList = useMemo(() => {
    return currentClass.students.map(st => {
      const stLogs = logs.filter(l => sameStudent(l, st));
      const added = stLogs.filter(l => l.type === 'add').reduce((s, l) => s + l.points, 0);
      const deducted = stLogs.filter(l => l.type === 'deduct').reduce((s, l) => s + l.points, 0);
      const netScore = 100 + added - deducted;
      let statusLabel = 'ปกติ (ความประพฤติดี)';
      let statusColor = '#0284C7';
      let statusBg = '#E0F2FE';

      if (netScore > 100) {
        statusLabel = `ดีเยี่ยม (คนดีศรี${SCHOOL_NAME.replace('โรงเรียนบ้าน', '').replace('โรงเรียน', '')})`;
        statusColor = '#15803D';
        statusBg = '#DCFCE7';
      } else if (netScore < 70) {
        statusLabel = 'ต้องเชิญผู้ปกครอง / ทัณฑ์บน';
        statusColor = '#B91C1C';
        statusBg = '#FEE2E2';
      } else if (netScore < 85) {
        statusLabel = 'เฝ้าระวัง (ตักเตือนครั้งที่ 1)';
        statusColor = '#B45309';
        statusBg = '#FEF3C7';
      }

      return {
        ...st,
        added,
        deducted,
        netScore,
        statusLabel,
        statusColor,
        statusBg,
        logs: stLogs.sort((a, b) => b.createdAt - a.createdAt),
      };
    });
  }, [currentClass, logs]);

  const studentBehaviorList = useMemo(() => {
    const q = search.trim();
    if (!q) return allClassBehaviorList;
    return allClassBehaviorList.filter(st => st.name.includes(q) || st.code.includes(q));
  }, [allClassBehaviorList, search]);

  const handleRecordPoint = async (reason: string, points: number, type: 'add' | 'deduct') => {
    if (!modalStudent || !reason.trim()) return;
    const entry: BehaviorLogEntry = {
      id: `beh_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      studentCode: modalStudent.code,
      studentId: modalStudent.id,
      studentName: modalStudent.name,
      classId: currentClass.classId,
      classLabel: currentClass.label,
      date: logDate,
      type,
      points: Math.abs(Number(points) || 5),
      reason: reason.trim(),
      teacher: userName || currentClass.homeroomTeacher || 'ครูเวรประจำวัน',
      createdAt: Date.now(),
    };
    await saveChange(null, entry);
    setModalStudent(null);
    setCustomReason('');
    setToast(
      type === 'add'
        ? `เพิ่มคะแนนความดี +${entry.points} ให้ ${modalStudent.name} แล้ว`
        : `บันทึกตัดคะแนน -${entry.points} (${modalStudent.name}) แล้ว`
    );
    setTimeout(() => setToast(null), 2500);
  };

  const handleDeleteLog = async (id: string) => {
    const old = logs.find(l => l.id === id);
    if (old) await saveChange(old, null);
    setDeleteConfirmId(null);
    setToast('ลบรายการประวัติความประพฤติเรียบร้อย');
    setTimeout(() => setToast(null), 2500);
  };

  const handleUpdateLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLog) return;
    const old = logs.find(l => l.id === editingLog.id);
    await saveChange(old || null, editingLog);
    setEditingLog(null);
    setToast(`อัปเดตประวัติความประพฤติของ ${editingLog.studentName} แล้ว`);
    setTimeout(() => setToast(null), 2500);
  };

  const triggerPrintDoc = (mode: PrintDocMode, studentCode?: string) => {
    setPrintMode(mode);
    setPrintStudentCode(studentCode || null);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const exportBehaviorCsv = () => {
    const rows: Array<Array<string | number>> = [
      [`รายงานสรุปคะแนนความประพฤตินักเรียน ${SCHOOL_NAME}`],
      [`ระดับชั้น: ${currentClass.fullClassName} (${currentClass.label})`, `ครูประจำชั้น: ${currentClass.homeroomTeacher}`],
      [],
      ['เลขที่', 'รหัสนักเรียน', 'ชื่อ-นามสกุล', 'ชื่อผู้ปกครอง (DMC)', 'คะแนนตั้งต้น', 'คะแนนความดีสะสม (+)', 'คะแนนที่ถูกตัด (-)', 'คะแนนสุทธิคงเหลือ', 'สถานะการประเมิน', 'ประวัติล่าสุด'],
      ...allClassBehaviorList.map(st => [
        st.no,
        st.code,
        st.name,
        st.guardianName || '-',
        100,
        st.added,
        st.deducted,
        st.netScore,
        st.statusLabel,
        st.logs[0] ? `${st.logs[0].reason} (${st.logs[0].type === 'add' ? '+' : '-'}${st.logs[0].points})` : '-',
      ]),
    ];
    downloadCsvReport(`คะแนนความประพฤติ_${currentClass.shortClass}.csv`, rows);
  };

  const printTargetStudent = useMemo(
    () => allClassBehaviorList.find(s => s.code === printStudentCode) || allClassBehaviorList[0],
    [allClassBehaviorList, printStudentCode]
  );

  // ================= PRINT VIEW MODE (ใบเตือน / เกียรติบัตรความดี / ตารางสรุปประจำชั้น) =================
  if (printMode !== 'none') {
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
              onClick={() => setPrintMode('none')}
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
              <ArrowLeft size={16} /> กลับหน้าระบบความประพฤติ
            </button>
            <div>
              <div style={{ fontWeight: 900, color: '#0F172A', fontSize: '0.95rem' }}>
                {printMode === 'warning' && `📄 หนังสือแจ้งเตือนความประพฤติ — ${printTargetStudent?.name}`}
                {printMode === 'award' && `🏆 เกียรติบัตรคนดีศรี${SCHOOL_NAME.replace('โรงเรียนบ้าน', '').replace('โรงเรียน', '')} — ${printTargetStudent?.name}`}
                {printMode === 'class_summary' && `📋 บัญชีสรุปคะแนนความประพฤติประจำชั้น ${currentClass.fullClassName}`}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748B' }}>
                แบบฟอร์มราชการ {SCHOOL_NAME} (ขนาด A4)
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
            }}
          >
            <Printer size={18} /> สั่งพิมพ์เอกสาร (A4)
          </button>
        </div>

        {printMode === 'warning' && printTargetStudent && (
          <BehaviorWarningPrintSheet student={printTargetStudent} currentClass={currentClass} />
        )}
        {printMode === 'award' && printTargetStudent && (
          <BehaviorAwardPrintSheet student={printTargetStudent} currentClass={currentClass} />
        )}
        {printMode === 'class_summary' && (
          <BehaviorClassSummaryPrintSheet students={allClassBehaviorList} currentClass={currentClass} />
        )}
      </div>
    );
  }

  return (
    <SmartSchoolLayout pageTitle="คะแนนความประพฤติ (กิจการนักเรียน)">
      <div className="no-print">
        {/* Page Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 900, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldAlert size={24} color="#DC2626" /> ระบบคะแนนความประพฤติ & ส่งเสริมความดี (กิจการนักเรียน)
            </h1>
            <div style={{ fontSize: '0.82rem', color: '#64748B', marginTop: 2 }}>
              คะแนนตั้งต้น 100 คะแนน · บันทึกตัด-เพิ่มคะแนนพฤติกรรม สรุปแต้มอัตโนมัติ พร้อมออกใบแจ้งเตือนผู้ปกครองหรือเกียรติบัตรความดีทันที
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {toast && (
              <span style={{
                background: '#DCFCE7', color: '#15803D', padding: '8px 14px',
                borderRadius: 999, fontSize: '0.8rem', fontWeight: 800,
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}>
                <CheckCircle2 size={15} /> {toast}
              </span>
            )}
            <button
              type="button"
              onClick={() => triggerPrintDoc('class_summary')}
              style={{
                background: '#1E293B', color: 'white', border: 'none',
                borderRadius: 999, padding: '9px 18px', fontWeight: 800, fontSize: '0.84rem',
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              <Printer size={15} /> พิมพ์สรุปคะแนนทั้งห้อง (A4)
            </button>
            <button
              type="button"
              onClick={exportBehaviorCsv}
              style={{
                background: '#15803D', color: 'white', border: 'none',
                borderRadius: 999, padding: '9px 18px', fontWeight: 800, fontSize: '0.84rem',
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              <Download size={15} /> ส่งออก Excel (CSV)
            </button>
          </div>
        </div>

        {/* Summary KPI Strip */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: 14,
          marginBottom: 16,
        }}>
          <div style={{ background: '#FFFFFF', borderRadius: 14, padding: '14px 18px', border: '1px solid #E2E8F0', borderLeft: '5px solid #0284C7' }}>
            <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#64748B' }}>นักเรียนในชั้น {currentClass.label}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0F172A', marginTop: 4 }}>{currentClass.students.length} คน</div>
            <div style={{ fontSize: '0.74rem', color: '#0284C7', fontWeight: 700 }}>ชาย {currentClass.maleCount} · หญิง {currentClass.femaleCount} คน</div>
          </div>

          <div style={{ background: '#FFFFFF', borderRadius: 14, padding: '14px 18px', border: '1px solid #E2E8F0', borderLeft: '5px solid #16A34A' }}>
            <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#64748B' }}>🌟 คะแนนเกิน 100 (ทำความดีเด่น)</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#15803D', marginTop: 4 }}>
              {studentBehaviorList.filter(s => s.netScore > 100).length} คน
            </div>
            <div style={{ fontSize: '0.74rem', color: '#16A34A', fontWeight: 700 }}>ออกเกียรติบัตรคนดีศรีคลองมดแดงได้</div>
          </div>

          <div style={{ background: '#FFFFFF', borderRadius: 14, padding: '14px 18px', border: '1px solid #E2E8F0', borderLeft: '5px solid #F59E0B' }}>
            <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#64748B' }}>⚠️ ถูกหักคะแนนสะสมในห้องนี้</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#D97706', marginTop: 4 }}>
              {studentBehaviorList.filter(s => s.deducted > 0).length} คน
            </div>
            <div style={{ fontSize: '0.74rem', color: '#B45309', fontWeight: 700 }}>ติดตามตักเตือนและปรับพฤติกรรม</div>
          </div>

          <div style={{ background: '#FFFFFF', borderRadius: 14, padding: '14px 18px', border: '1px solid #E2E8F0', borderLeft: '5px solid #DC2626' }}>
            <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#64748B' }}>🚨 ต่ำกว่าเกณฑ์ (&lt; 85 คะแนน)</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#DC2626', marginTop: 4 }}>
              {studentBehaviorList.filter(s => s.netScore < 85).length} คน
            </div>
            <div style={{ fontSize: '0.74rem', color: '#DC2626', fontWeight: 700 }}>กดปุ่ม "ออกใบเตือน" เพื่อพิมพ์ทันที</div>
          </div>
        </div>

        {/* Filter Bar */}
        <div style={{
          background: '#FFFFFF', borderRadius: 14, padding: '16px 20px',
          marginBottom: 16, border: '1px solid #E2E8F0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <label style={{ fontWeight: 800, fontSize: '0.85rem', color: '#334155' }}>🏫 เลือกชั้นเรียน:</label>
            <select
              value={currentClass.classId}
              onChange={e => setSelectedClassId(e.target.value)}
              style={{
                padding: '9px 14px', borderRadius: 10, border: '1.5px solid #CBD5E1',
                fontWeight: 800, fontSize: '0.88rem', color: '#0F172A',
              }}
            >
              {unifiedRosters.map(c => (
                <option key={c.classId} value={c.classId}>
                  ชั้น{c.fullClassName} ({c.label}) — {c.totalCount} คน
                </option>
              ))}
            </select>
            <span style={{ fontSize: '0.8rem', color: '#64748B' }}>
              ครูที่ปรึกษา: <b>{currentClass.homeroomTeacher}</b>
            </span>
          </div>

          <div style={{ position: 'relative', minWidth: 250 }}>
            <Search size={16} color="#94A3B8" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="ค้นหาชื่อ หรือ รหัสนักเรียน..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%', padding: '8px 12px 8px 34px',
                borderRadius: 10, border: '1px solid #CBD5E1', fontSize: '0.85rem',
              }}
            />
          </div>
        </div>

        {/* Student Behavior Table */}
        <div style={{
          background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0',
          boxShadow: '0 4px 16px rgba(15,23,42,0.04)', overflow: 'hidden', marginBottom: 20,
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
              <thead>
                <tr style={{ background: '#0F172A', color: 'white' }}>
                  <th style={{ ...thStyle, width: 55 }}>เลขที่</th>
                  <th style={{ ...thStyle, width: 90 }}>รหัส</th>
                  <th style={{ ...thStyle, textAlign: 'left' }}>ชื่อ - นามสกุล</th>
                  <th style={{ ...thStyle, width: 95 }}>ความดี (+)</th>
                  <th style={{ ...thStyle, width: 95 }}>ถูกตัด (-)</th>
                  <th style={{ ...thStyle, width: 110, background: '#1E293B' }}>คะแนนสุทธิ</th>
                  <th style={{ ...thStyle, width: 190 }}>สถานะความประพฤติ</th>
                  <th style={{ ...thStyle, width: 210 }}>บันทึกคะแนนด่วน</th>
                  <th style={{ ...thStyle, width: 200 }}>พิมพ์ใบเตือน / เกียรติบัตร</th>
                </tr>
              </thead>
              <tbody>
                {studentBehaviorList.map(st => (
                  <tr key={st.code} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ ...tdStyle, fontWeight: 800 }}>{st.no}</td>
                    <td style={{ ...tdStyle, color: '#64748B', fontWeight: 700 }}>{st.code}</td>
                    <td style={{ ...tdStyle, textAlign: 'left' }}>
                      <div style={{ fontWeight: 800, color: '#0F172A' }}>{st.name}</div>
                      {st.guardianName && st.guardianName !== '-' && (
                        <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: 1 }}>
                          👨‍👩‍👧 ผู้ปกครอง: {st.guardianName} ({st.guardianRelation || 'ผู้ปกครอง'})
                        </div>
                      )}
                      {st.logs.length > 0 && (
                        <div style={{ fontSize: '0.73rem', color: '#0284C7', marginTop: 2, fontWeight: 700 }}>
                          ล่าสุด: {st.logs[0].reason} ({st.logs[0].type === 'add' ? `+${st.logs[0].points}` : `-${st.logs[0].points}`})
                        </div>
                      )}
                    </td>
                    <td style={{ ...tdStyle, color: '#16A34A', fontWeight: 900 }}>
                      {st.added > 0 ? `+${st.added}` : '-'}
                    </td>
                    <td style={{ ...tdStyle, color: '#DC2626', fontWeight: 900 }}>
                      {st.deducted > 0 ? `-${st.deducted}` : '-'}
                    </td>
                    <td style={{ ...tdStyle, background: '#F8FAFC' }}>
                      <span style={{
                        fontSize: '1.05rem',
                        fontWeight: 900,
                        color: st.netScore >= 100 ? '#15803D' : st.netScore < 80 ? '#DC2626' : '#0284C7',
                      }}>
                        {st.netScore}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{
                        background: st.statusBg,
                        color: st.statusColor,
                        padding: '4px 10px',
                        borderRadius: 999,
                        fontSize: '0.74rem',
                        fontWeight: 800,
                        display: 'inline-block',
                      }}>
                        {st.statusLabel}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => {
                            setModalStudent({ id: st.id, code: st.code, name: st.name, no: st.no, mode: 'add' });
                            setCustomPoints(5);
                            setCustomReason('');
                          }}
                          style={{
                            background: '#DCFCE7', color: '#15803D', border: '1px solid #86EFAC',
                            borderRadius: 8, padding: '6px 10px', fontSize: '0.76rem', fontWeight: 800,
                            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
                          }}
                        >
                          <PlusCircle size={13} /> เพิ่มความดี
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setModalStudent({ id: st.id, code: st.code, name: st.name, no: st.no, mode: 'deduct' });
                            setCustomPoints(5);
                            setCustomReason('');
                          }}
                          style={{
                            background: '#FEE2E2', color: '#B91C1C', border: '1px solid #FCA5A5',
                            borderRadius: 8, padding: '6px 10px', fontSize: '0.76rem', fontWeight: 800,
                            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
                          }}
                        >
                          <MinusCircle size={13} /> ตัดแต้ม
                        </button>
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => triggerPrintDoc('warning', st.code)}
                          title="พิมพ์หนังสือแจ้งเตือนความประพฤติส่งผู้ปกครอง"
                          style={{
                            background: '#FFF7ED', color: '#C2410C', border: '1px solid #FDBA74',
                            borderRadius: 8, padding: '6px 10px', fontSize: '0.74rem', fontWeight: 800,
                            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
                          }}
                        >
                          <FileWarning size={13} /> ใบเตือน
                        </button>
                        <button
                          type="button"
                          onClick={() => triggerPrintDoc('award', st.code)}
                          title="พิมพ์เกียรติบัตรคนดีศรีคลองมดแดง"
                          style={{
                            background: '#FEF9C3', color: '#854D0E', border: '1px solid #FDE047',
                            borderRadius: 8, padding: '6px 10px', fontSize: '0.74rem', fontWeight: 800,
                            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
                          }}
                        >
                          <Award size={13} /> เกียรติบัตร
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Behavior Logs History */}
        <div style={{ background: '#FFFFFF', borderRadius: 16, padding: 20, border: '1px solid #E2E8F0' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '1rem', fontWeight: 900, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
            <History size={18} color="#4F46E5" /> ประวัติการบันทึกตัด-เพิ่มคะแนนความประพฤติล่าสุด
          </h3>
          {logs.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#94A3B8' }}>ยังไม่มีประวัติการบันทึก</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {logs.slice(0, 15).map(item => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 10,
                    padding: '10px 14px',
                    borderRadius: 10,
                    background: item.type === 'add' ? '#F0FDF4' : '#FEF2F2',
                    border: `1px solid ${item.type === 'add' ? '#BBF7D0' : '#FECACA'}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{
                      padding: '4px 10px', borderRadius: 999, fontWeight: 900, fontSize: '0.78rem',
                      background: item.type === 'add' ? '#16A34A' : '#DC2626', color: 'white',
                    }}>
                      {item.type === 'add' ? `+${item.points}` : `-${item.points}`} คะแนน
                    </span>
                    <div>
                      <div style={{ fontWeight: 800, color: '#0F172A', fontSize: '0.88rem' }}>
                        {item.studentName} ({item.classLabel}) — {item.reason}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#64748B' }}>
                        วันที่ {fmtThai(item.date)} · ผู้บันทึก: {item.teacher}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {deleteConfirmId === item.id ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: '0.74rem', color: '#DC2626', fontWeight: 800 }}>ยืนยันลบ?</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteLog(item.id)}
                          style={{
                            background: '#DC2626', color: 'white', border: 'none', borderRadius: 6,
                            padding: '4px 8px', cursor: 'pointer', fontSize: '0.74rem', fontWeight: 800,
                          }}
                        >
                          ลบ
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(null)}
                          style={{
                            background: '#E2E8F0', color: '#334155', border: 'none', borderRadius: 6,
                            padding: '4px 8px', cursor: 'pointer', fontSize: '0.74rem', fontWeight: 700,
                          }}
                        >
                          ยกเลิก
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setEditingLog(item)}
                          style={{
                            background: 'white', border: '1px solid #CBD5E1', borderRadius: 6,
                            padding: '4px 8px', cursor: 'pointer', color: '#0284C7', fontSize: '0.74rem',
                            display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700,
                          }}
                        >
                          <Edit3 size={12} /> แก้ไข
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(item.id)}
                          style={{
                            background: 'white', border: '1px solid #CBD5E1', borderRadius: 6,
                            padding: '4px 8px', cursor: 'pointer', color: '#DC2626', fontSize: '0.74rem',
                            display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700,
                          }}
                        >
                          <Trash2 size={12} /> ลบ
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Edit Log Modal */}
        {editingLog && (
          <div
            onClick={() => setEditingLog(null)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)',
              zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                background: '#FFFFFF', borderRadius: 18, maxWidth: 520, width: '100%',
                padding: 24, boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Edit3 size={18} color="#0284C7" /> แก้ไขประวัติความประพฤติ
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingLog(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleUpdateLog} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#475569', marginBottom: 4 }}>
                    นักเรียน
                  </label>
                  <input
                    type="text"
                    disabled
                    value={`${editingLog.studentName} (${editingLog.classLabel})`}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #CBD5E1', background: '#F1F5F9', fontWeight: 700 }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#475569', marginBottom: 4 }}>
                      ประเภทรายการ
                    </label>
                    <select
                      value={editingLog.type}
                      onChange={e => setEditingLog({ ...editingLog, type: e.target.value as 'add' | 'deduct' })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontWeight: 800 }}
                    >
                      <option value="add">🌟 เพิ่มคะแนนความดี (+)</option>
                      <option value="deduct">⚠️ ตัดคะแนนความประพฤติ (-)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#475569', marginBottom: 4 }}>
                      คะแนน
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={editingLog.points}
                      onChange={e => setEditingLog({ ...editingLog, points: Number(e.target.value) || 1 })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontWeight: 800 }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#475569', marginBottom: 4 }}>
                    วันที่บันทึก
                  </label>
                  <input
                    type="date"
                    value={editingLog.date}
                    onChange={e => setEditingLog({ ...editingLog, date: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #CBD5E1' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#475569', marginBottom: 4 }}>
                    เหตุผล / รายละเอียดพฤติกรรม
                  </label>
                  <textarea
                    rows={3}
                    value={editingLog.reason}
                    onChange={e => setEditingLog({ ...editingLog, reason: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.88rem' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={() => setEditingLog(null)}
                    style={{
                      padding: '9px 16px', borderRadius: 8, border: '1px solid #CBD5E1',
                      background: 'white', color: '#475569', fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    style={{
                      padding: '9px 20px', borderRadius: 8, border: 'none',
                      background: '#0284C7', color: 'white', fontWeight: 800, cursor: 'pointer',
                    }}
                  >
                    💾 บันทึกการแก้ไข
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        {modalStudent && (
          <div
            onClick={() => setModalStudent(null)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)',
              zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                background: '#FFFFFF', borderRadius: 18, maxWidth: 560, width: '100%',
                padding: 24, boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <span style={{
                    fontSize: '0.74rem', fontWeight: 800, padding: '3px 10px', borderRadius: 999,
                    background: modalStudent.mode === 'add' ? '#DCFCE7' : '#FEE2E2',
                    color: modalStudent.mode === 'add' ? '#15803D' : '#B91C1C',
                  }}>
                    {modalStudent.mode === 'add' ? '🌟 เพิ่มคะแนนความดี' : '⚠️ ตัดคะแนนความประพฤติ'}
                  </span>
                  <h3 style={{ margin: '6px 0 0', fontSize: '1.15rem', fontWeight: 900, color: '#0F172A' }}>
                    {modalStudent.name} (เลขที่ {modalStudent.no} · ชั้น {currentClass.label})
                  </h3>
                </div>
                <input
                  type="date"
                  value={logDate}
                  onChange={e => setLogDate(e.target.value)}
                  style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.82rem' }}
                />
              </div>

              <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#475569', marginBottom: 8 }}>
                ⚡ คลิกเลือกรายการมาตรฐาน (บันทึกทันที):
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                {(modalStudent.mode === 'add' ? ADD_PRESETS : DEDUCT_PRESETS).map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleRecordPoint(preset.label, preset.points, modalStudent.mode)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 14px', borderRadius: 10,
                      border: `1px solid ${modalStudent.mode === 'add' ? '#BBF7D0' : '#FECACA'}`,
                      background: modalStudent.mode === 'add' ? '#F0FDF4' : '#FEF2F2',
                      cursor: 'pointer', textAlign: 'left', fontWeight: 700, fontSize: '0.85rem', color: '#0F172A',
                    }}
                  >
                    <span>{preset.label}</span>
                    <span style={{
                      fontWeight: 900,
                      color: modalStudent.mode === 'add' ? '#15803D' : '#DC2626',
                    }}>
                      {modalStudent.mode === 'add' ? `+${preset.points}` : `-${preset.points}`} คะแนน
                    </span>
                  </button>
                ))}
              </div>

              <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 14 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#475569', marginBottom: 8 }}>
                  ✍️ หรือระบุสาเหตุและคะแนนด้วยตนเอง:
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    placeholder="ระบุรายละเอียดพฤติกรรม..."
                    value={customReason}
                    onChange={e => setCustomReason(e.target.value)}
                    style={{
                      flex: 1, padding: '9px 12px', borderRadius: 8,
                      border: '1px solid #CBD5E1', fontSize: '0.85rem',
                    }}
                  />
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={customPoints}
                    onChange={e => setCustomPoints(Number(e.target.value))}
                    style={{
                      width: 75, padding: '9px 10px', borderRadius: 8,
                      border: '1px solid #CBD5E1', fontSize: '0.85rem', textAlign: 'center', fontWeight: 800,
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => handleRecordPoint(customReason, customPoints, modalStudent.mode)}
                    style={{
                      background: modalStudent.mode === 'add' ? '#16A34A' : '#DC2626',
                      color: 'white', border: 'none', borderRadius: 8,
                      padding: '9px 16px', fontWeight: 800, cursor: 'pointer',
                    }}
                  >
                    บันทึก
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Fallback when pressing Ctrl+P directly on /behavior */}
      <div className="only-print-behavior print-area">
        <BehaviorClassSummaryPrintSheet students={studentBehaviorList} currentClass={currentClass} />
      </div>

      <style>{`
        .only-print-behavior { display: none; }
        @media print {
          .only-print-behavior { display: block !important; }
        }
      `}</style>
    </SmartSchoolLayout>
  );
}

/* =========================================================================
   1. หนังสือแจ้งเตือนความประพฤติ / เชิญผู้ปกครองรับทราบ (Official A4 Form)
   ========================================================================= */
function BehaviorWarningPrintSheet({
  student,
  currentClass,
}: {
  student: any;
  currentClass: UnifiedClassRoster;
}) {
  const deductLogs = (student.logs as BehaviorLogEntry[]).filter(l => l.type === 'deduct');

  return (
    <div className="beh-a4-sheet">
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <img
          src={`${import.meta.env.BASE_URL}images/school-logo.png`}
          alt="ตราโรงเรียน"
          style={{ width: 64, height: 64, objectFit: 'contain', margin: '0 auto 6px' }}
        />
        <div style={{ fontSize: '15pt', fontWeight: 800 }}>
          หนังสือแจ้งผลการประเมินความประพฤติและขอความร่วมมือผู้ปกครองดูแลนักเรียน
        </div>
        <div style={{ fontSize: '12pt', fontWeight: 700 }}>
          ฝ่ายกิจการนักเรียน {SCHOOL_NAME} &nbsp; {SCHOOL_AFFILIATION}
        </div>
      </div>

      <div style={{ textAlign: 'right', fontSize: '11pt', marginBottom: 12 }}>
        วันที่พิมพ์เอกสาร: {fmtThai(todayStr())}
      </div>

      <div style={{ fontSize: '11.5pt', lineHeight: 1.8, marginBottom: 12 }}>
        <div><b>เรื่อง:</b> แจ้งคะแนนความประพฤติและขอความร่วมมือในการส่งเสริมระเบียบวินัยนักเรียน</div>
        <div>
          <b>เรียน:</b> ท่านผู้ปกครอง <b>{student.guardianName && student.guardianName !== '-' ? `${student.guardianName} (${student.guardianRelation || 'ผู้ปกครอง'})` : ''}</b> ของ <b>{student.name}</b> (นักเรียนชั้น{currentClass.fullClassName} เลขประจำตัว {student.code})
        </div>
        {student.address && (
          <div><b>ที่อยู่ตามทะเบียน DMC:</b> {student.address}</div>
        )}
        <div style={{ textIndent: '2.5em', marginTop: 8 }}>
          ด้วยฝ่ายกิจการนักเรียนและครูประจำชั้น{currentClass.fullClassName} {SCHOOL_NAME} ได้ดำเนินการส่งเสริมระเบียบวินัยและบันทึกคะแนนความประพฤตินักเรียนประจำภาคเรียนที่ 1 ปีการศึกษา 2569 (คะแนนตั้งต้น 100 คะแนน) โดยปัจจุบัน <b>{student.name}</b> มีสรุปผลคะแนนความประพฤติดังต่อไปนี้:
        </div>
      </div>

      <table className="beh-print-table" style={{ marginBottom: 14 }}>
        <thead>
          <tr>
            <th>คะแนนตั้งต้น</th>
            <th>คะแนนความดีสะสม (+)</th>
            <th>คะแนนที่ถูกหักสะสม (-)</th>
            <th>คะแนนความประพฤติคงเหลือ</th>
            <th>ผลการประเมิน</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ textAlign: 'center', fontWeight: 700 }}>100 คะแนน</td>
            <td style={{ textAlign: 'center', fontWeight: 700 }}>+{student.added} คะแนน</td>
            <td style={{ textAlign: 'center', fontWeight: 700 }}>-{student.deducted} คะแนน</td>
            <td style={{ textAlign: 'center', fontWeight: 800, fontSize: '12pt' }}>{student.netScore} คะแนน</td>
            <td style={{ textAlign: 'center', fontWeight: 800 }}>{student.statusLabel}</td>
          </tr>
        </tbody>
      </table>

      <div style={{ fontWeight: 800, fontSize: '11pt', marginBottom: 4 }}>
        รายละเอียดประวัติการบันทึกพฤติกรรม:
      </div>
      <table className="beh-print-table" style={{ marginBottom: 16 }}>
        <thead>
          <tr>
            <th style={{ width: '16%' }}>วัน/เดือน/ปี</th>
            <th style={{ width: '50%' }}>รายการพฤติกรรม</th>
            <th style={{ width: '14%' }}>คะแนน</th>
            <th style={{ width: '20%' }}>ครูผู้บันทึก</th>
          </tr>
        </thead>
        <tbody>
          {deductLogs.length > 0 ? (
            deductLogs.map(l => (
              <tr key={l.id}>
                <td style={{ textAlign: 'center' }}>{fmtThai(l.date)}</td>
                <td>{l.reason}</td>
                <td style={{ textAlign: 'center', fontWeight: 700 }}>-{l.points}</td>
                <td style={{ textAlign: 'center' }}>{l.teacher}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={4} style={{ textAlign: 'center', padding: 10 }}>
                ไม่มีประวัติการกระทำผิดระเบียบ (แบบแจ้งข้อมูลคะแนนความประพฤติประจำภาคเรียน)
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div style={{ fontSize: '11pt', lineHeight: 1.7, marginBottom: 22 }}>
        ทางโรงเรียนจึงขอแจ้งข้อมูลมายังท่านผู้ปกครองเพื่อโปรดทราบ และขอความอนุเคราะห์ท่านได้ร่วมกวดขัน ดูแล และให้คำแนะนำแก่นักเรียนในปกครองของท่าน เพื่อให้มีระเบียบวินัยและพัฒนาตนเองให้ดียิ่งขึ้นต่อไป
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, textAlign: 'center', fontSize: '11pt', lineHeight: 1.7 }}>
        <div>
          <div>ลงชื่อ..........................................................ครูประจำชั้น</div>
          <div>({currentClass.homeroomTeacher})</div>
        </div>
        <div>
          <div>ลงชื่อ..........................................................ผู้อำนวยการโรงเรียน</div>
          <div style={{ fontWeight: 800 }}>({DIRECTOR_NAME})</div>
          <div>ผู้อำนวยการ{SCHOOL_NAME}</div>
        </div>
      </div>

      {/* Tear-off Parent Reply Slip */}
      <div style={{ marginTop: 28, borderTop: '2px dashed #000', paddingTop: 14, fontSize: '10.5pt', lineHeight: 1.7 }}>
        <div style={{ textAlign: 'center', fontWeight: 800, fontSize: '11.5pt', marginBottom: 6 }}>
          ✂️ ส่วนตอบรับจากผู้ปกครอง (กรุณาส่งคืนครูประจำชั้น)
        </div>
        <div>
          ข้าพเจ้า <b>{student.guardianName && student.guardianName !== '-' ? student.guardianName : '........................................................................'}</b> ผู้ปกครองของ <b>{student.name}</b> ชั้น{currentClass.fullClassName}
          ได้รับทราบผลการประเมินคะแนนความประพฤติ (คงเหลือ {student.netScore} คะแนน) เรียบร้อยแล้ว และยินดีร่วมมือกับทางโรงเรียนในการดูแลนักเรียน
        </div>
        <div style={{ marginTop: 18, textAlign: 'right', paddingRight: 30 }}>
          ลงชื่อ..........................................................ผู้ปกครอง &nbsp;&nbsp; โทร...........................................
        </div>
      </div>

      <BehaviorPrintStyles />
    </div>
  );
}

/* =========================================================================
   2. เกียรติบัตรคนดีศรีคลองมดแดง (Official Award Certificate A4)
   ========================================================================= */
function BehaviorAwardPrintSheet({
  student,
  currentClass,
}: {
  student: any;
  currentClass: UnifiedClassRoster;
}) {
  return (
    <div className="beh-a4-sheet" style={{ border: '6px double #B45309', padding: '18mm 16mm', textAlign: 'center' }}>
      <img
        src={`${import.meta.env.BASE_URL}images/school-logo.png`}
        alt="ตราโรงเรียน"
        style={{ width: 82, height: 82, objectFit: 'contain', margin: '0 auto 10px' }}
      />
      <div style={{ fontSize: '20pt', fontWeight: 900, color: '#7C2D12' }}>
        {SCHOOL_NAME}
      </div>
      <div style={{ fontSize: '13pt', fontWeight: 700, color: '#334155', marginBottom: 18 }}>
        {SCHOOL_AFFILIATION}
      </div>

      <div style={{ fontSize: '14pt', fontWeight: 700, marginBottom: 14 }}>
        ขอมอบเกียรติบัตรฉบับนี้ไว้เพื่อแสดงว่า
      </div>

      <div style={{ fontSize: '22pt', fontWeight: 900, color: '#1D4ED8', margin: '10px 0' }}>
        {student.name}
      </div>
      <div style={{ fontSize: '13pt', fontWeight: 700, marginBottom: 18 }}>
        นักเรียนชั้น{currentClass.fullClassName} &nbsp; เลขประจำตัว {student.code}
      </div>

      <div style={{ fontSize: '15pt', fontWeight: 800, color: '#15803D', lineHeight: 1.6, marginBottom: 24 }}>
        เป็นนักเรียนผู้ประพฤติตนดีเยี่ยม มีจิตอาสา บำเพ็ญประโยชน์ต่อส่วนรวม<br />
        สมควรได้รับการยกย่องเชิดชูเกียรติเป็น “คนดีศรีคลองมดแดง”<br />
        (คะแนนความประพฤติและคุณธรรมสะสม {student.netScore} คะแนน)
      </div>

      <div style={{ fontSize: '12.5pt', marginBottom: 42 }}>
        ขอให้รักษาคุณงามความดีนี้ไว้ และเจริญก้าวหน้าในการศึกษาสืบไป<br />
        ให้ไว้ ณ วันที่ {fmtThai(todayStr())}
      </div>

      <div style={{ fontSize: '13pt', lineHeight: 1.7 }}>
        <div>ลงชื่อ..........................................................</div>
        <div style={{ fontWeight: 900 }}>({DIRECTOR_NAME})</div>
        <div>ผู้อำนวยการ{SCHOOL_NAME}</div>
      </div>

      <BehaviorPrintStyles />
    </div>
  );
}

/* =========================================================================
   3. บัญชีสรุปคะแนนความประพฤติประจำชั้น (Official Class Summary A4)
   ========================================================================= */
function BehaviorClassSummaryPrintSheet({
  students,
  currentClass,
}: {
  students: any[];
  currentClass: UnifiedClassRoster;
}) {
  return (
    <div className="beh-a4-sheet">
      <div style={{ textAlign: 'center', marginBottom: 10 }}>
        <img
          src={`${import.meta.env.BASE_URL}images/school-logo.png`}
          alt="ตราโรงเรียน"
          style={{ width: 54, height: 54, objectFit: 'contain', margin: '0 auto 4px' }}
        />
        <div style={{ fontSize: '14pt', fontWeight: 800 }}>
          แบบสรุปผลการประเมินคะแนนความประพฤตินักเรียนประจำชั้น (ฝ่ายกิจการนักเรียน)
        </div>
        <div style={{ fontSize: '11.5pt', fontWeight: 700 }}>
          {SCHOOL_NAME} &nbsp;|&nbsp; ระดับชั้น{currentClass.fullClassName} ({currentClass.label}) &nbsp;|&nbsp; ภาคเรียนที่ 1 ปีการศึกษา 2569
        </div>
      </div>

      <table className="beh-print-table">
        <thead>
          <tr>
            <th style={{ width: '6%' }}>เลขที่</th>
            <th style={{ width: '11%' }}>รหัสนักเรียน</th>
            <th style={{ width: '28%' }}>ชื่อ - นามสกุล</th>
            <th style={{ width: '10%' }}>ตั้งต้น</th>
            <th style={{ width: '10%' }}>ความดี (+)</th>
            <th style={{ width: '10%' }}>ถูกหัก (-)</th>
            <th style={{ width: '10%' }}>คงเหลือ</th>
            <th style={{ width: '15%' }}>ผลการประเมิน</th>
          </tr>
        </thead>
        <tbody>
          {students.map(st => (
            <tr key={st.code}>
              <td style={{ textAlign: 'center' }}>{st.no}</td>
              <td style={{ textAlign: 'center' }}>{st.code}</td>
              <td>{st.name}</td>
              <td style={{ textAlign: 'center' }}>100</td>
              <td style={{ textAlign: 'center' }}>{st.added > 0 ? `+${st.added}` : '-'}</td>
              <td style={{ textAlign: 'center' }}>{st.deducted > 0 ? `-${st.deducted}` : '-'}</td>
              <td style={{ textAlign: 'center', fontWeight: 800 }}>{st.netScore}</td>
              <td style={{ textAlign: 'center' }}>{st.statusLabel.split(' ')[0]}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 22, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, textAlign: 'center', fontSize: '10.5pt', lineHeight: 1.6 }}>
        <div>
          <div>ลงชื่อ..........................................................ครูประจำชั้น</div>
          <div>({currentClass.homeroomTeacher})</div>
        </div>
        <div>
          <div>ลงชื่อ..........................................................ผู้อำนวยการโรงเรียน</div>
          <div style={{ fontWeight: 800 }}>({DIRECTOR_NAME})</div>
          <div>ผู้อำนวยการ{SCHOOL_NAME}</div>
        </div>
      </div>

      <BehaviorPrintStyles />
    </div>
  );
}

function BehaviorPrintStyles() {
  return (
    <style>{`
      .beh-a4-sheet {
        width: 210mm;
        min-height: 296mm;
        margin: 0 auto 20px;
        background: #FFFFFF;
        color: #000000;
        padding: 14mm 16mm;
        box-sizing: border-box;
        font-family: 'Sarabun', 'TH SarabunPSK', sans-serif;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
      }
      .beh-print-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 10.5pt;
      }
      .beh-print-table th, .beh-print-table td {
        border: 1px solid #000;
        padding: 5px 8px;
      }
      .beh-print-table th {
        background: #F1F5F9;
        font-weight: 800;
        text-align: center;
      }
      @media print {
        @page {
          size: A4 portrait;
          margin: 10mm;
        }
        .no-print { display: none !important; }
        .beh-a4-sheet {
          width: 100% !important;
          min-height: auto !important;
          margin: 0 !important;
          padding: 4mm 6mm !important;
          box-shadow: none !important;
        }
      }
    `}</style>
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

const thStyle: React.CSSProperties = {
  padding: '10px 8px',
  fontWeight: 800,
  fontSize: '0.78rem',
  textAlign: 'center',
  borderRight: '1px solid rgba(255,255,255,0.1)',
};

const tdStyle: React.CSSProperties = {
  padding: '9px 8px',
  textAlign: 'center',
  borderRight: '1px solid #F1F5F9',
};
