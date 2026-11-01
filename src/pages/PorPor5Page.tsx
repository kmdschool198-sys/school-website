import { useState, useMemo, useEffect } from 'react';
import { collection, doc, getDocs, onSnapshot, query, where, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import {
  Download, Printer, BookOpen, CheckCircle2, ArrowLeft,
  ClipboardPaste, Sparkles, RefreshCw, ShieldCheck, Megaphone,
} from 'lucide-react';
import SmartSchoolLayout from '../components/SmartSchoolLayout';
import TeacherLoginGate from '../components/TeacherLoginGate';
import { canManageStaffUsers, useTeacherAuth } from '../utils/teacherAuth';
import { useAssessmentPlans, useGradingStatus } from '../utils/assessmentStorage';
import { useSchoolRoster } from '../utils/useSchoolRoster';
import { findStudentDetails, useStudentDetails } from '../data/studentDetails';
import { DEFAULT_ACTIVITIES } from '../data/defaultActivities';
import { attendanceCount, attendedHours, isUnderAttendance, termRange, type AttendanceDay } from '../utils/attendanceHours';
import { READ_ITEMS, TRAIT_ITEMS } from '../utils/assessment';
import PlanEditor from '../components/sgs/PlanEditor';
import IndicatorGrid from '../components/sgs/IndicatorGrid';
import ItemsGrid from '../components/sgs/ItemsGrid';
import { useAcademicData } from '../utils/academicStorage';
import { calculateClassRanks, scoreScheme, type ScoreScheme } from '../data/academicData';
import { downloadCsvReport } from '../utils/csvReport';
import ExcelPasteModal from '../components/ExcelPasteModal';
import { parseClipboardTable, cleanNumeric, isTabularPaste } from '../utils/excelPaste';
import { toast } from '../components/GlobalToast';
import { normalizeResultCode, resultLookupDocId } from '../data/results';
import type { BehaviorLogEntry } from './BehaviorPage';
import SgsPorPor5PrintBook from '../components/SgsPorPor5PrintBook';

const DEPUTY_DIRECTOR_NAME = 'นางสาวเจนจีรา บุญเกตุ';

// แปลงรหัสชั้นวิชาการ (เช่น m1, p1) เป็นรหัสห้องเช็คชื่อ (เช่น m1_1, p1_1)

export default function PorPor5Page() {
  const auth = useTeacherAuth();
  if (!auth.authed) {
    return <TeacherLoginGate title="📝 วิชาที่ฉันสอน (บันทึกคะแนน & พิมพ์เล่ม ปพ.5)" />;
  }
  return <PorPor5Content />;
}

// Spreadsheet-style score grid (see handleGridPaste / gridInput)
// ประถม enters both terms on one sheet (grade from the year), มัธยม one semester.
type GridCol = 'attendedHours' | 'coursework' | 'finalExam' | 'term2Coursework' | 'term2FinalExam' | 'traitScore' | 'readThinkScore';
const gridColsFor = (scheme: ScoreScheme): GridCol[] => scheme.yearly
  ? ['attendedHours', 'coursework', 'finalExam', 'term2Coursework', 'term2FinalExam', 'traitScore', 'readThinkScore']
  : ['attendedHours', 'coursework', 'finalExam', 'traitScore', 'readThinkScore'];
const gridMaxFor = (scheme: ScoreScheme, col: GridCol, hours: number) => ({
  attendedHours: hours,
  coursework: scheme.courseworkMax, term2Coursework: scheme.courseworkMax,
  finalExam: scheme.finalMax, term2FinalExam: scheme.finalMax,
  traitScore: 3, readThinkScore: 3,
})[col];

/** A subject the student has no score for yet: zero marks and no grade, never a made-up pass */
function blankScore(hours: number) {
  return { coursework: 0, finalExam: 0, total: 0, grade: '', attendedHours: hours, traitScore: 3, readThinkScore: 3 };
}

function PorPor5Content() {
  const { classesData, loaded: scoresLoaded, updateStudentScore } = useAcademicData();
  const { classes: rosterClasses } = useSchoolRoster();
  const studentDetails = useStudentDetails(); // birth dates for the public results lookup (staff-only)
  const auth = useTeacherAuth();
  const { plans, savePlan } = useAssessmentPlans();
  const { status: gradingStatus } = useGradingStatus();
  // SGS: once งานทะเบียน closes score entry only registrars can change scores
  const closedByRegistrar = !gradingStatus.entryOpen && !canManageStaffUsers(auth.role);
  // nothing is editable until the score document has loaded, or a save would be built from blanks
  const entryLocked = closedByRegistrar || !scoresLoaded;
  const [entryTab, setEntryTab] = useState<'scores' | 'items'>('scores');
  const [planTerm, setPlanTerm] = useState(0);
  const [showPlanEditor, setShowPlanEditor] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string>('m1');
  const [selectedSubjectCode, setSelectedSubjectCode] = useState<string>('ง21201');
  const [semesterLabel, setSemesterLabel] = useState<string>('ภาคเรียนที่ 1 ปีการศึกษา 2569');
  const [savedToast, setSavedToast] = useState(false);
  const [printMode, setPrintMode] = useState(false);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [syncingAtt, setSyncingAtt] = useState(false);
  const [publishingOnline, setPublishingOnline] = useState(false);
  const [academicHeadName, setAcademicHeadName] = useState<string>('หัวหน้างานวิชาการ/วัดผล');
  const [behaviorLogs, setBehaviorLogs] = useState<BehaviorLogEntry[]>([]);

  // ดึงรายชื่อหัวหน้างานวิชาการจากคอลเลกชัน personnel อัตโนมัติ
  useEffect(() => {
    return onSnapshot(collection(db, 'personnel'), snap => {
      snap.forEach(d => {
        const data = d.data() as any;
        if (data.workGroup === 'academic' && data.isHead && data.name) {
          setAcademicHeadName(data.name);
        }
      });
    });
  }, []);

  // ดึงข้อมูลคะแนนความประพฤติเพื่อใช้คำนวณคุณลักษณะ 8 ข้อ
  useEffect(() => {
    return onSnapshot(doc(db, 'config', 'behavior_logs'), snap => {
      if (snap.exists() && Array.isArray(snap.data()?.logs)) {
        setBehaviorLogs(snap.data().logs as BehaviorLogEntry[]);
      }
    });
  }, []);

  const currentClass = useMemo(
    () => classesData.find(c => c.classId === selectedClassId) || classesData[0],
    [classesData, selectedClassId]
  );

  const currentSubject = useMemo(
    () => currentClass.subjects.find(s => s.code === selectedSubjectCode) || currentClass.subjects[0],
    [currentClass, selectedSubjectCode]
  );

  const scheme = scoreScheme(currentClass.level);
  const GRID_COLS = gridColsFor(scheme);
  const subjectPlan = plans[currentClass.classId]?.[currentSubject.code];
  const saveCell = (studentCode: string, patch: Parameters<typeof updateStudentScore>[3]) => {
    updateStudentScore(currentClass.classId, studentCode, currentSubject.code, patch);
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 1500);
  };

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

  const handleOpenPrint = () => {
    setPrintMode(true);
    setTimeout(() => {
      window.print();
    }, 180);
  };

  // ================= 1. ซิงค์เวลาเรียนจริงจากระบบเช็คชื่อรายวัน =================
  const syncAttendanceFromCloud = async () => {
    if (!canRunShortcut()) return;
    // the attendance check keys classes by their cloud id and students by "{classId}_{code}"
    const rosterClass = rosterClasses.find(r => r.acadId === currentClass.classId || r.shortClass === currentClass.shortName);
    if (!rosterClass) {
      toast.error(`ไม่พบชั้น ${currentClass.shortName} ในรายชื่อที่ใช้เช็คชื่อ — ยังไม่ได้เปลี่ยนเวลาเรียน`);
      return;
    }
    setSyncingAtt(true);
    try {
      const term = semesterLabel.includes('ภาคเรียนที่ 2') ? 2 : 1;
      const range = termRange(DEFAULT_ACTIVITIES, term);
      const snap = await getDocs(query(collection(db, 'attendance'), where('classId', '==', rosterClass.id)));
      const days: AttendanceDay[] = snap.docs.map(d => d.data() as AttendanceDay)
        .filter(d => d.date >= range.from && d.date <= range.to);

      if (days.length === 0) {
        toast.info(`ยังไม่มีการเช็คชื่อชั้น ${currentClass.shortName} ในภาคเรียนที่ ${term} — ยังไม่ได้เปลี่ยนเวลาเรียน`);
        return;
      }

      let updated = 0;
      let lowAttendance = 0;
      const unmatched: string[] = [];
      currentClass.students.forEach(st => {
        const rosterStudent = rosterClass.students.find(r => r.code === st.code) || rosterClass.students.find(r => r.name.trim() === st.name.trim());
        const hours = rosterStudent ? attendedHours(attendanceCount(days, rosterStudent.id, range), currentSubject.hours) : null;
        if (hours === null) { unmatched.push(st.name); return; }
        const under = isUnderAttendance(hours, currentSubject.hours);
        if (under) lowAttendance++;
        const sc = st.scores[currentSubject.code];
        // set มส under 80%, lift an earlier มส once attendance is enough; ร stays
        updateStudentScore(currentClass.classId, st.code, currentSubject.code, {
          attendedHours: hours,
          specialGrade: under ? 'มส' : sc?.grade === 'มส' ? null : undefined,
        });
        updated++;
      });

      setEntryTab('scores');
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 2200);
      toast.success(
        `ดึงเวลาเรียนจากการเช็คชื่อ ${days.length} วัน (ภาคเรียนที่ ${term}) ให้ ${updated} คน` +
        (lowAttendance > 0 ? ` · มาเรียนไม่ถึง 80% ${lowAttendance} คน (ติด มส)` : '') +
        (unmatched.length > 0 ? ` · ไม่พบข้อมูลเช็คชื่อของ ${unmatched.length} คน: ${unmatched.slice(0, 3).join(', ')}${unmatched.length > 3 ? '…' : ''}` : '')
      );
    } catch (err: any) {
      toast.error('ดึงเวลาเรียนไม่สำเร็จ: ' + (err?.message || err));
    } finally {
      setSyncingAtt(false);
    }
  };

  // ================= 2. ดึงแต้มความประพฤติมาแปลงเป็นคะแนนคุณลักษณะ (0-3) =================
  const syncTraitFromBehavior = () => {
    if (!canRunShortcut()) return;
    if (!window.confirm(`ตั้งคุณลักษณะทั้ง ${TRAIT_ITEMS.length} ข้อของทั้งห้องตามแต้มความประพฤติ (95+ = 3, 80+ = 2, 60+ = 1, ต่ำกว่า = 0)? ค่าที่กรอกไว้จะถูกแทนที่`)) return;
    currentClass.students.forEach(st => {
      const stLogs = behaviorLogs.filter(l => l.studentCode === st.code);
      const added = stLogs.filter(l => l.type === 'add').reduce((s, l) => s + l.points, 0);
      const deducted = stLogs.filter(l => l.type === 'deduct').reduce((s, l) => s + l.points, 0);
      const net = 100 + added - deducted;
      const autoTrait: 0 | 1 | 2 | 3 = net >= 95 ? 3 : net >= 80 ? 2 : net >= 60 ? 1 : 0;
      updateStudentScore(currentClass.classId, st.code, currentSubject.code, { traitItems: TRAIT_ITEMS.map(() => autoTrait) });
    });

    setEntryTab('items');
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2000);
    toast.success('ตั้งคุณลักษณะจากแต้มความประพฤติแล้ว — ดูผลในแท็บคุณลักษณะ');
  };

  // ================= 3. ส่งคะแนน ปพ.5/ปพ.6 ขึ้นระบบประกาศผลสอบออนไลน์ (/results) ทันที =================
  const publishClassResultsOnline = async () => {
    if (!window.confirm(`ยืนยันการส่งคะแนนทุกวิชาของชั้น ${currentClass.shortName}/1 ขึ้นหน้า "ประกาศผลสอบออนไลน์ (/results)" เพื่อให้ผู้ปกครองและนักเรียนค้นหาด้วยเลขประจำตัวได้ทันที?`)) {
      return;
    }
    setPublishingOnline(true);
    try {
      const announcementId = `acad_${currentClass.classId}_2569_1`;
      const ranksMap = calculateClassRanks(currentClass.students, currentClass.subjects);
      const batch = writeBatch(db);
      const publishedAt = Date.now();
      const noBirthDate: string[] = [];

      const subjectsMeta = currentClass.subjects.map(s => ({
        name: `${s.code} ${s.name}`,
        // ประถม before term 2 is out of 50 (term 1 only)
        maxScore: scheme.yearly && !currentClass.students.some(st => st.scores[s.code]?.term2Coursework !== undefined) ? 50 : 100,
        teacher: s.teacher,
      }));

      batch.set(doc(db, 'result_announcements', announcementId), {
        id: announcementId,
        title: `ประกาศผลการเรียน (${semesterLabel}) — ชั้น ${currentClass.className}`,
        className: `${currentClass.shortName}/${currentClass.room}`,
        publishedAt,
        visible: true,
        recordCount: currentClass.students.length,
        subjects: subjectsMeta,
      });

      for (const st of currentClass.students) {
        const normalizedCode = normalizeResultCode(st.code);
        const scoresObj: Record<string, number> = {};
        for (const s of currentClass.subjects) {
          const total = st.scores[s.code]?.total;
          if (total !== undefined) scoresObj[`${s.code} ${s.name}`] = total;
        }
        const rInfo = ranksMap[st.code];
        // found with code + birth date; a student without a birth date on file cannot be looked up
        const birthDate = findStudentDetails(studentDetails, st.code, st.name)?.birthDate;
        const lookupId = birthDate ? await resultLookupDocId(announcementId, normalizedCode, birthDate) : null;
        if (!lookupId) { noBirthDate.push(st.name); continue; }
        batch.set(doc(db, 'result_lookup', lookupId), {
          announcementId,
          code: normalizedCode,
          name: st.name,
          scores: scoresObj,
          note: `เกรดเฉลี่ย (GPA): ${rInfo ? rInfo.gpa.toFixed(2) : '-'} · คุณลักษณะฯ: ${st.traitResult}`,
          className: `${currentClass.shortName}/${currentClass.room}`,
          publishedAt,
          visible: true, // firestore.rules lets visitors read only visible results
          recordCount: currentClass.students.length,
        });
      }

      await batch.commit();
      toast.success(`เผยแพร่ผลสอบชั้น ${currentClass.shortName}/1 ขึ้นหน้าเว็บ /results แล้ว (ค้นด้วยเลขประจำตัว + วันเกิด)` +
        (noBirthDate.length ? ` · ไม่มีวันเกิดในระบบ ${noBirthDate.length} คน จึงยังค้นไม่ได้: ${noBirthDate.slice(0, 3).join(', ')}` : ''));
    } catch (err: any) {
      toast.error('เผยแพร่ผลสอบออนไลน์ไม่สำเร็จ: ' + (err?.message || err));
    } finally {
      setPublishingOnline(false);
    }
  };

  /** Whole-class shortcuts write nothing while scores are loading or entry is closed */
  const canRunShortcut = () => {
    if (!scoresLoaded) { toast.warn('กำลังโหลดคะแนนจากระบบ — รอสักครู่แล้วลองใหม่'); return false; }
    if (closedByRegistrar) { toast.warn('งานทะเบียนปิดการบันทึกผลแล้ว — แก้ไขไม่ได้'); return false; }
    return true;
  };

  // Each shortcut fills what its tab shows: the 8 trait items, the 5 reading items, or study time
  const bulkSetSubjectField = (mode: 'full_hours' | 'trait_3' | 'read_3') => {
    if (!canRunShortcut()) return;
    const label = mode === 'full_hours' ? `เวลาเรียนเต็ม ${currentSubject.hours} ชม.`
      : mode === 'trait_3' ? `คุณลักษณะทั้ง ${TRAIT_ITEMS.length} ข้อ = 3` : `อ่าน คิด เขียนทั้ง ${READ_ITEMS.length} ข้อ = 3`;
    if (!window.confirm(`ตั้ง${label} ให้ทั้งห้อง (${currentClass.students.length} คน)? ค่าที่กรอกไว้จะถูกแทนที่`)) return;
    const patch = mode === 'full_hours' ? { attendedHours: currentSubject.hours }
      : mode === 'trait_3' ? { traitItems: TRAIT_ITEMS.map(() => 3) } : { readItems: READ_ITEMS.map(() => 3) };
    currentClass.students.forEach(st => updateStudentScore(currentClass.classId, st.code, currentSubject.code, patch));
    setEntryTab(mode === 'full_hours' ? 'scores' : 'items');
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2000);
    toast.success(`ตั้ง${label} ทั้งห้องแล้ว`);
  };

  // ── Spreadsheet-style entry ─────────────────────────────────────────────
  // Editable number columns in table order. Paste a block copied from Excel into any of them
  // (rows go down the class list, columns continue to the right), drag the small square at the
  // bottom-right of a cell to copy its value down, and use Enter / arrow keys to move.
  const scoreOf = (st: (typeof currentClass.students)[number]) =>
    st.scores[currentSubject.code] || blankScore(currentSubject.hours);

  const applyCells = (changes: Array<{ row: number; col: GridCol; value: number }>) => {
    const byRow = new Map<number, Partial<Record<GridCol, number>>>();
    changes.forEach(c => byRow.set(c.row, { ...(byRow.get(c.row) || {}), [c.col]: c.value }));
    byRow.forEach((vals, row) => {
      const st = currentClass.students[row];
      if (!st) return;
      updateStudentScore(currentClass.classId, st.code, currentSubject.code, vals);
    });
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 1800);
    return byRow.size;
  };

  const clampFor = (col: GridCol, v: number) => {
    return Math.min(gridMaxFor(scheme, col, currentSubject.hours), Math.max(0, v));
  };

  const handleGridPaste = (e: React.ClipboardEvent<HTMLInputElement>, startRow: number, startCol: GridCol) => {
    const text = e.clipboardData.getData('text');
    if (!isTabularPaste(text)) return;
    e.preventDefault();
    const rows = parseClipboardTable(text);
    const c0 = GRID_COLS.indexOf(startCol);
    const changes: Array<{ row: number; col: GridCol; value: number }> = [];
    rows.forEach((cells, r) => {
      if (startRow + r >= currentClass.students.length) return;
      cells.forEach((cell, c) => {
        const col = GRID_COLS[c0 + c];
        const v = cleanNumeric(cell);
        if (col && v !== null) changes.push({ row: startRow + r, col, value: clampFor(col, v) });
      });
    });
    if (!changes.length) return;
    const n = applyCells(changes);
    toast.success(`วางจาก Excel แล้ว ${n} คน`);
  };

  const focusCell = (row: number, col: GridCol) => {
    const el = document.querySelector<HTMLInputElement>(`input[data-grid-row="${row}"][data-grid-col="${col}"]`);
    if (el) { el.focus(); el.select(); }
  };

  const handleGridKey = (e: React.KeyboardEvent<HTMLInputElement>, row: number, col: GridCol) => {
    const c = GRID_COLS.indexOf(col);
    if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); focusCell(row + 1, col); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focusCell(row - 1, col); }
    else if (e.key === 'ArrowRight' && e.currentTarget.selectionStart === e.currentTarget.value.length && GRID_COLS[c + 1]) { e.preventDefault(); focusCell(row, GRID_COLS[c + 1]); }
    else if (e.key === 'ArrowLeft' && e.currentTarget.selectionStart === 0 && c > 0) { e.preventDefault(); focusCell(row, GRID_COLS[c - 1]); }
  };

  // drag-fill: mouse down on the handle, move over rows, release to copy the value down/up
  const [fill, setFill] = useState<{ col: GridCol; from: number; to: number } | null>(null);
  useEffect(() => {
    if (!fill) return;
    const finish = () => {
      setFill(null);
      if (fill.to === fill.from) return;
      const src = currentClass.students[fill.from];
      if (!src) return;
      const value = Number(scoreOf(src)[fill.col] ?? 0);
      const [a, b] = fill.to > fill.from ? [fill.from + 1, fill.to] : [fill.to, fill.from - 1];
      const changes = [];
      for (let r = a; r <= b; r++) changes.push({ row: r, col: fill.col, value });
      const n = applyCells(changes);
      toast.success(`คัดลอกค่า ${value} ให้อีก ${n} คน`);
    };
    window.addEventListener('mouseup', finish);
    return () => window.removeEventListener('mouseup', finish);
  });

  const gridInput = (st: (typeof currentClass.students)[number], row: number, col: GridCol, style: React.CSSProperties) => {
    const sc = scoreOf(st);
    const inFill = fill && fill.col === col && row >= Math.min(fill.from, fill.to) && row <= Math.max(fill.from, fill.to);
    return (
      <div
        className="grid-cell"
        style={{ position: 'relative', outline: inFill ? '2px dashed #0284C7' : undefined, outlineOffset: -2 }}
        onMouseOver={() => setFill(f => (f && f.col === col && f.to !== row ? { ...f, to: row } : f))}
      >
        <input
          type="number"
          min={0}
          max={gridMaxFor(scheme, col, currentSubject.hours)}
          value={sc[col] ?? ''}
          disabled={entryLocked}
          data-grid-row={row}
          data-grid-col={col}
          onPaste={ev => handleGridPaste(ev, row, col)}
          onKeyDown={ev => handleGridKey(ev, row, col)}
          onFocus={ev => ev.target.select()}
          onChange={e => applyCells([{ row, col, value: clampFor(col, Number(e.target.value)) }])}
          title="วางหลายช่องจาก Excel ได้ (Ctrl+V) · ลากจุดมุมขวาล่างเพื่อคัดลอกลง · Enter ไปแถวถัดไป"
          style={style}
        />
        <span
          className="fill-handle no-print"
          onMouseDown={e => { e.preventDefault(); setFill({ col, from: row, to: row }); }}
          title="ลากลงเพื่อคัดลอกค่านี้ให้คนถัดไป"
        />
      </div>
    );
  };

  const handlePasteModalApply = (records: Array<{ studentId: string; values: Record<string, number | null> }>) => {
    let count = 0;
    for (const rec of records) {
      const st = currentClass.students.find(s => s.code === rec.studentId);
      if (!st) continue;
      const patch: Partial<Record<GridCol, number>> = {};
      for (const col of ['coursework', 'finalExam', 'term2Coursework', 'term2FinalExam'] as const) {
        const v = rec.values[col];
        if (v !== null && v !== undefined) patch[col] = clampFor(col, v);
      }
      updateStudentScore(currentClass.classId, st.code, currentSubject.code, patch);
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
          coursework: sc?.coursework ?? 0,
          finalExam: sc?.finalExam ?? 0,
          ...(scheme.yearly ? { term2Coursework: sc?.term2Coursework ?? 0, term2FinalExam: sc?.term2FinalExam ?? 0 } : {}),
        },
      };
    });
  }, [currentClass.students, currentSubject.code, scheme.yearly]);

  const exportSubjectCsv = () => {
    const rows: Array<Array<string | number>> = [
      [`ผลการประเมินกลุ่มสาระการเรียนรู้ ${currentSubject.group} รายวิชา ${currentSubject.name} รหัสวิชา ${currentSubject.code}`],
      [`ชั้น ${currentClass.className} (${currentClass.shortName}/${currentClass.room})`, semesterLabel, `ครูผู้สอน: ${currentSubject.teacher}`],
      [],
      [
        'เลขที่', 'เลขประจำตัว', 'ชื่อ-สกุล',
        'เวลาเรียนเต็ม', 'เวลามาเรียน', 'ร้อยละเวลาเรียน',
        ...(scheme.yearly
          ? [`ภาค 1 เก็บ (${scheme.courseworkMax})`, `ภาค 1 ปลายภาค (${scheme.finalMax})`, 'รวมภาค 1 (50)',
             `ภาค 2 เก็บ (${scheme.courseworkMax})`, `ภาค 2 ปลายภาค (${scheme.finalMax})`, 'รวมภาค 2 (50)', 'รวมทั้งปี (100)']
          : [`ระหว่างภาค (${scheme.courseworkMax})`, `ปลายภาค (${scheme.finalMax})`, 'รวมคะแนน (100)']),
        'ระดับผลการเรียน', 'ผลการแก้ไข',
        'คุณลักษณะอันพึงประสงค์ (0-3)', 'การอ่านคิดวิเคราะห์และเขียน (0-3)',
      ],
      ...currentClass.students.map(st => {
        const sc = st.scores[currentSubject.code] || blankScore(currentSubject.hours);
        const attPct = currentSubject.hours > 0 ? ((sc.attendedHours / currentSubject.hours) * 100).toFixed(1) : '100.0';
        const hasTerm2 = sc.term2Coursework !== undefined || sc.term2FinalExam !== undefined;
        const scoreCells = scheme.yearly
          ? [sc.coursework, sc.finalExam, sc.coursework + sc.finalExam,
             sc.term2Coursework ?? '', sc.term2FinalExam ?? '',
             hasTerm2 ? (sc.term2Coursework ?? 0) + (sc.term2FinalExam ?? 0) : '', hasTerm2 ? sc.total : '']
          : [sc.coursework, sc.finalExam, sc.total];
        return [
          st.no, st.code, st.name,
          currentSubject.hours, sc.attendedHours, `${attPct}%`,
          ...scoreCells, sc.grade, sc.remedial?.grade ?? '',
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
            margin: '0 auto 14px',
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
                background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: 8,
                padding: '8px 14px', fontWeight: 800, cursor: 'pointer', color: '#1E293B',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              <ArrowLeft size={16} /> กลับหน้ากรอกคะแนน
            </button>
            <div>
              <div style={{ fontWeight: 900, color: '#0F172A', fontSize: '0.95rem' }}>
                โหมดพิมพ์ ปพ.5 แบบ SGS (รูปแบบเอกสารราชการ)
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748B' }}>
                วิชา {currentSubject.code} {currentSubject.name} · ชั้น {currentClass.className} ({currentClass.students.length} คน)
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => window.print()}
              style={{
                background: '#1D4ED8', color: 'white', border: 'none', borderRadius: 10,
                padding: '10px 20px', fontWeight: 900, fontSize: '0.9rem', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 8,
                boxShadow: '0 4px 14px rgba(29,78,216,0.35)',
              }}
            >
              <Printer size={18} /> สั่งพิมพ์ทันที
            </button>
          </div>
        </div>

        <SgsPorPor5PrintBook
          currentClass={currentClass}
          currentSubject={currentSubject}
          semesterLabel={semesterLabel}
          plan={subjectPlan}
          measurementHeadName={academicHeadName}
          deputyDirectorName={DEPUTY_DIRECTOR_NAME}
        />
      </div>
    );
  }

  return (
    <SmartSchoolLayout pageTitle="บันทึกคะแนน & พิมพ์เล่ม ปพ.5">
      <div className="no-print">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 900, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
              <BookOpen size={24} color="#0284C7" /> วิชาที่ฉันสอน / บันทึกคะแนน & พิมพ์เล่ม ปพ.5 ครบวงจร
            </h1>
            <div style={{ fontSize: '0.82rem', color: '#64748B', marginTop: 2 }}>
              กรอกครั้งเดียว ซิงค์เข้าสมุดพก ปพ.6, แดชบอร์ด ผอ., และหน้าประกาศผลสอบออนไลน์ พร้อมพิมพ์เล่ม SSS ปพ.5 ครบทุกหน้าตามไฟล์ปพ5.xlsx
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {savedToast && (
              <span style={{
                background: '#DCFCE7', color: '#15803D', padding: '8px 12px',
                borderRadius: 8, fontSize: '0.8rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 5,
              }}>
                <CheckCircle2 size={15} /> ซิงค์เข้า ปพ.6 & แดชบอร์ด ผอ. แล้ว
              </span>
            )}

            <button
              type="button"
              onClick={() => setShowPasteModal(true)}
              style={{
                background: '#0F172A', color: 'white', border: 'none', borderRadius: 999,
                padding: '9px 16px', fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              <ClipboardPaste size={15} /> วางคะแนนจาก Excel
            </button>

            <button
              type="button"
              onClick={publishClassResultsOnline}
              disabled={publishingOnline}
              style={{
                background: '#EA580C', color: 'white', border: 'none', borderRadius: 999,
                padding: '9px 16px', fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              <Megaphone size={15} /> {publishingOnline ? 'กำลังส่ง...' : 'เผยแพร่ผลสอบออนไลน์ (/results)'}
            </button>

            <button
              type="button"
              onClick={handleOpenPrint}
              style={{
                background: '#1D4ED8', color: 'white', border: 'none', borderRadius: 999,
                padding: '9px 18px', fontWeight: 900, fontSize: '0.84rem', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6,
                boxShadow: '0 4px 12px rgba(29,78,216,0.25)',
              }}
            >
              <Printer size={15} /> พิมพ์ ปพ.5 (แบบ SGS)
            </button>

            <button
              type="button"
              onClick={exportSubjectCsv}
              style={{
                background: '#15803D', color: 'white', border: 'none', borderRadius: 999,
                padding: '9px 18px', fontWeight: 800, fontSize: '0.84rem', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              <Download size={15} /> ส่งออก CSV
            </button>
          </div>
        </div>

        {/* Select Class, Subject & Semester */}
        <div style={{
          background: '#FFFFFF', borderRadius: 14, padding: '18px 20px',
          marginBottom: 16, border: '1px solid #E2E8F0',
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16,
        }}>
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
                  ชั้น {c.className} ({c.shortName}/1) — {c.students.length} คน
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
                  {s.code} — {s.name} ({s.type} · {s.credits} นก. · {s.teacher})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#334155', marginBottom: 6 }}>
              📅 ภาคเรียน / ปีการศึกษา
            </label>
            <select
              value={semesterLabel}
              onChange={e => setSemesterLabel(e.target.value)}
              style={selStyle}
            >
              <option value="ภาคเรียนที่ 1 ปีการศึกษา 2569">ภาคเรียนที่ 1 ปีการศึกษา 2569</option>
              <option value="ภาคเรียนที่ 2 ปีการศึกษา 2569">ภาคเรียนที่ 2 ปีการศึกษา 2569</option>
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
              ครูผู้สอน: <b>{currentSubject.teacher}</b> · {scheme.weightLabel}: <b>{currentSubject.credits}</b> · เวลาเรียน: <b>{currentSubject.hours} ชั่วโมง/ภาค</b>{scheme.yearly ? ' · ตัดเกรดจากผลรวม 2 ภาคเรียน' : ''}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(['4', '3.5', '3', '2.5', '2', '1.5', '1', '0', 'ร', 'มส'] as const).map(g => (
              <div key={g} style={{
                padding: '6px 10px', borderRadius: 10, background: '#F8FAFC',
                border: '1px solid #E2E8F0', textAlign: 'center', minWidth: 46,
              }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748B' }}>เกรด {g}</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 900, color: g === '0' || g === 'ร' || g === 'มส' ? '#DC2626' : '#0284C7' }}>
                  {gradeDistribution[g]}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Smart Auto-Sync & 1-Click Bulk Action Strip */}
        <div style={{
          background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: 12,
          padding: '12px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, color: '#0369A1', fontSize: '0.84rem' }}>
            <Sparkles size={16} /> ⚡ เชื่อมข้อมูลอัตโนมัติ & ทางลัดทั้งห้อง (ไม่ต้องกรอกซ้ำ):
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={syncAttendanceFromCloud}
              disabled={syncingAtt}
              style={{
                background: '#0284C7', color: 'white', border: 'none', borderRadius: 8,
                padding: '6px 12px', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 5,
              }}
            >
              <RefreshCw size={13} /> {syncingAtt ? 'กำลังดึงเช็คชื่อ...' : 'ดึงเวลาเรียนจริงจากระบบเช็คชื่อ'}
            </button>
            <button
              type="button"
              onClick={syncTraitFromBehavior}
              style={{
                background: '#059669', color: 'white', border: 'none', borderRadius: 8,
                padding: '6px 12px', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 5,
              }}
            >
              <ShieldCheck size={13} /> คำนวณคุณลักษณะฯ จากแต้มความประพฤติ
            </button>
            <button
              type="button"
              onClick={() => bulkSetSubjectField('full_hours')}
              style={{
                background: 'white', color: '#0369A1', border: '1px solid #7DD3FC',
                borderRadius: 8, padding: '6px 12px', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer',
              }}
            >
              ✓ เวลาเรียนเต็ม {currentSubject.hours} ชม.
            </button>
            <button
              type="button"
              onClick={() => bulkSetSubjectField('trait_3')}
              style={{
                background: 'white', color: '#047857', border: '1px solid #6EE7B7',
                borderRadius: 8, padding: '6px 12px', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer',
              }}
            >
              ✓ คุณลักษณะฯ = 3 ทั้งห้อง
            </button>
            <button
              type="button"
              onClick={() => bulkSetSubjectField('read_3')}
              style={{
                background: 'white', color: '#6D28D9', border: '1px solid #C4B5FD',
                borderRadius: 8, padding: '6px 12px', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer',
              }}
            >
              ✓ อ่านคิดวิเคราะห์ฯ = 3 ทั้งห้อง
            </button>
          </div>
        </div>

        {/* SGS-style entry: full marks per indicator, traits / reading per item, entry lock */}
        <div className="no-print" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
          {([['scores', 'บันทึกคะแนน'], ['items', 'คุณลักษณะ / อ่าน คิด เขียน']] as const).map(([key, label]) => (
            <button key={key} type="button" onClick={() => setEntryTab(key)} aria-pressed={entryTab === key}
              style={{ border: 'none', borderRadius: 10, padding: '8px 16px', fontWeight: 800, cursor: 'pointer', background: entryTab === key ? '#0F172A' : '#E2E8F0', color: entryTab === key ? 'white' : '#0F172A' }}>
              {label}
            </button>
          ))}
          {entryTab === 'scores' && (
            <button type="button" onClick={() => setShowPlanEditor(true)} disabled={entryLocked}
              style={{ border: '1px solid #0369A1', borderRadius: 10, padding: '7px 14px', fontWeight: 800, cursor: 'pointer', background: 'white', color: '#0369A1' }}>
              {subjectPlan ? 'แก้คะแนนเต็มรายตัวชี้วัด' : 'ตั้งคะแนนเต็มรายตัวชี้วัด (แบบ SGS)'}
            </button>
          )}
          {entryTab === 'scores' && subjectPlan && scheme.yearly && [0, 1].map(t => (
            <button key={t} type="button" onClick={() => setPlanTerm(t)} aria-pressed={planTerm === t}
              style={{ border: 'none', borderRadius: 999, padding: '6px 14px', fontWeight: 800, cursor: 'pointer', background: planTerm === t ? '#0369A1' : '#F1F5F9', color: planTerm === t ? 'white' : '#0F172A' }}>
              ภาคเรียนที่ {t + 1}
            </button>
          ))}
        </div>
        {!scoresLoaded && (
          <div role="status" className="no-print" style={{ background: '#E0F2FE', border: '1px solid #7DD3FC', color: '#075985', borderRadius: 10, padding: '10px 14px', marginBottom: 10, fontWeight: 700 }}>
            กำลังโหลดคะแนนจากระบบ… กรอกได้เมื่อโหลดเสร็จ
          </div>
        )}
        {closedByRegistrar && (
          <div role="status" className="no-print" style={{ background: '#FEF3C7', border: '1px solid #FCD34D', color: '#78350F', borderRadius: 10, padding: '10px 14px', marginBottom: 10, fontWeight: 700 }}>
            งานทะเบียนปิดการบันทึกผลการเรียนแล้ว — ดูคะแนนได้ แก้ไขไม่ได้ (ติดต่องานทะเบียน/วัดผล)
          </div>
        )}
        {showPlanEditor && (
          <PlanEditor
            title={`คะแนนเต็มรายตัวชี้วัด ${currentSubject.code} ${currentSubject.name} (${currentClass.shortName})`}
            scheme={scheme}
            plan={subjectPlan}
            onSave={async plan => {
              await savePlan(currentClass.classId, currentSubject.code, plan);
              toast.success('บันทึกคะแนนเต็มรายตัวชี้วัดแล้ว');
            }}
            onClose={() => setShowPlanEditor(false)}
          />
        )}

        {entryTab === 'items' ? (
          <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
            <ItemsGrid students={currentClass.students} subjectCode={currentSubject.code} locked={entryLocked} onSave={saveCell} />
          </div>
        ) : subjectPlan ? (
          <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
            <IndicatorGrid
              students={currentClass.students}
              subjectCode={currentSubject.code}
              subjectHours={currentSubject.hours}
              scheme={scheme}
              plan={subjectPlan}
              term={scheme.yearly ? planTerm : 0}
              locked={entryLocked}
              onSave={saveCell}
            />
          </div>
        ) : (
        <div style={{
          background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0',
          boxShadow: '0 4px 16px rgba(15,23,42,0.04)', overflow: 'hidden',
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#1E293B', color: 'white' }}>
                  <th style={{ ...thP5, width: 52 }}>เลขที่</th>
                  <th style={{ ...thP5, width: 88 }}>รหัส</th>
                  <th style={{ ...thP5, textAlign: 'left' }}>ชื่อ-นามสกุล</th>
                  <th style={{ ...thP5, width: 88 }}>เวลาเรียน<br />({currentSubject.hours} ชม.)</th>
                  {scheme.yearly ? (
                    <>
                      <th style={{ ...thP5, width: 100, background: '#0369A1' }}>ภาค 1 เก็บ<br />(เต็ม {scheme.courseworkMax})</th>
                      <th style={{ ...thP5, width: 100, background: '#0369A1' }}>ภาค 1 ปลายภาค<br />(เต็ม {scheme.finalMax})</th>
                      <th style={{ ...thP5, width: 100, background: '#075985' }}>ภาค 2 เก็บ<br />(เต็ม {scheme.courseworkMax})</th>
                      <th style={{ ...thP5, width: 100, background: '#075985' }}>ภาค 2 ปลายภาค<br />(เต็ม {scheme.finalMax})</th>
                      <th style={{ ...thP5, width: 85, background: '#0F172A' }}>รวมทั้งปี<br />(100)</th>
                    </>
                  ) : (
                    <>
                      <th style={{ ...thP5, width: 115, background: '#0369A1' }}>ระหว่างภาค<br />(เต็ม {scheme.courseworkMax})</th>
                      <th style={{ ...thP5, width: 115, background: '#0369A1' }}>สอบปลายภาค<br />(เต็ม {scheme.finalMax})</th>
                      <th style={{ ...thP5, width: 85, background: '#0F172A' }}>รวม<br />(100)</th>
                    </>
                  )}
                  <th style={{ ...thP5, width: 80, background: '#15803D' }}>เกรด</th>
                  <th style={{ ...thP5, width: 88 }}>สถานะพิเศษ<br />(ปกติ/ร/มส)</th>
                  <th style={{ ...thP5, width: 95 }}>คุณลักษณะฯ<br />(0-3: ไม่ผ่าน-ดีเยี่ยม)</th>
                  <th style={{ ...thP5, width: 95 }}>อ่านคิดฯ<br />(0-3)</th>
                </tr>
              </thead>
              <tbody>
                {currentClass.students.map((st, idx) => {
                  const sc = st.scores[currentSubject.code] || blankScore(currentSubject.hours);
                  const specialVal = sc.grade === 'ร' || sc.grade === 'มส' ? sc.grade : '';

                  const setSpecial = (spec: string) => {
                    updateStudentScore(currentClass.classId, st.code, currentSubject.code, { specialGrade: spec || null });
                    setSavedToast(true);
                    setTimeout(() => setSavedToast(false), 1800);
                  };

                  return (
                    <tr key={st.code} style={{ borderBottom: '1px solid #E2E8F0' }}>
                      <td style={{ ...tdP5, fontWeight: 800 }}>{st.no}</td>
                      <td style={{ ...tdP5, color: '#475569', fontWeight: 700 }}>{st.code}</td>
                      <td style={{ ...tdP5, textAlign: 'left', fontWeight: 800, color: '#0F172A' }}>{st.name}</td>
                      <td style={tdP5}>
                        {gridInput(st, idx, 'attendedHours', inpStyle)}
                      </td>
                      <td style={{ ...tdP5, background: '#F0F9FF' }}>
                        {gridInput(st, idx, 'coursework', { ...inpStyle, borderColor: '#38BDF8', fontWeight: 900 })}
                      </td>
                      <td style={{ ...tdP5, background: '#F0F9FF' }}>
                        {gridInput(st, idx, 'finalExam', { ...inpStyle, borderColor: '#38BDF8', fontWeight: 900 })}
                      </td>
                      {scheme.yearly && (
                        <>
                          <td style={{ ...tdP5, background: '#E0F2FE' }}>
                            {gridInput(st, idx, 'term2Coursework', { ...inpStyle, borderColor: '#0EA5E9', fontWeight: 900 })}
                          </td>
                          <td style={{ ...tdP5, background: '#E0F2FE' }}>
                            {gridInput(st, idx, 'term2FinalExam', { ...inpStyle, borderColor: '#0EA5E9', fontWeight: 900 })}
                          </td>
                        </>
                      )}
                      <td style={{ ...tdP5, fontWeight: 900, fontSize: '0.95rem', color: '#0F172A', background: '#F8FAFC' }}>
                        {sc.total}
                        {scheme.yearly && sc.term2Coursework === undefined && sc.term2FinalExam === undefined && (
                          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B' }}>ภาค 1 /50</div>
                        )}
                      </td>
                      <td style={{
                        ...tdP5,
                        fontWeight: 900,
                        fontSize: '1rem',
                        color: sc.grade === '0' || sc.grade === 'ร' || sc.grade === 'มส' ? '#DC2626' : '#15803D',
                        background: sc.grade === '0' || sc.grade === 'ร' || sc.grade === 'มส' ? '#FEF2F2' : '#F0FDF4',
                      }}>
                        {sc.grade}
                      </td>
                      <td style={tdP5}>
                        <select
                          value={specialVal}
                          onChange={e => setSpecial(e.target.value)}
                          disabled={entryLocked}
                          style={{ ...inpStyle, width: 76, color: specialVal ? '#DC2626' : '#475569' }}
                        >
                          <option value="">ปกติ</option>
                          <option value="ร">ติด ร</option>
                          <option value="มส">ติด มส</option>
                        </select>
                      </td>
                      <td style={tdP5}>
                        {gridInput(st, idx, 'traitScore', inpStyle)}
                      </td>
                      <td style={tdP5}>
                        {gridInput(st, idx, 'readThinkScore', inpStyle)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        )}

        <ExcelPasteModal
          isOpen={showPasteModal}
          onClose={() => setShowPasteModal(false)}
          title={`📋 วางคะแนน ปพ.5 จาก Excel (${currentSubject.code} ${currentSubject.name})`}
          subtitle={scheme.yearly
            ? `คัดลอกคอลัมน์คะแนนภาค 1 / ภาค 2 (เก็บ ${scheme.courseworkMax}, ปลายภาค ${scheme.finalMax}) จาก Excel แล้ววางลงด้านล่าง`
            : `คัดลอกคอลัมน์คะแนนระหว่างภาค (${scheme.courseworkMax}) และ/หรือ สอบปลายภาค (${scheme.finalMax}) จาก Excel แล้ววางลงด้านล่าง`}
          themeColor="#0284C7"
          students={pasteStudentRows}
          columns={[
            { key: 'coursework', label: scheme.yearly ? 'ภาค 1 เก็บ' : 'คะแนนระหว่างภาค', unit: String(scheme.courseworkMax), min: 0, max: scheme.courseworkMax, placeholder: '' },
            { key: 'finalExam', label: scheme.yearly ? 'ภาค 1 ปลายภาค' : 'สอบปลายภาค', unit: String(scheme.finalMax), min: 0, max: scheme.finalMax, placeholder: '' },
            ...(scheme.yearly ? [
              { key: 'term2Coursework', label: 'ภาค 2 เก็บ', unit: String(scheme.courseworkMax), min: 0, max: scheme.courseworkMax, placeholder: '' },
              { key: 'term2FinalExam', label: 'ภาค 2 ปลายภาค', unit: String(scheme.finalMax), min: 0, max: scheme.finalMax, placeholder: '' },
            ] : []),
          ]}
          onApply={handlePasteModalApply}
        />
      </div>

      {/* Fallback when pressing Ctrl+P directly on the PorPor5 page */}
      <div className="only-print-pp5 print-area">
        <SgsPorPor5PrintBook
          currentClass={currentClass}
          currentSubject={currentSubject}
          semesterLabel={semesterLabel}
          plan={subjectPlan}
          measurementHeadName={academicHeadName}
          deputyDirectorName={DEPUTY_DIRECTOR_NAME}
        />
      </div>

      <style>{`
        .only-print-pp5 { display: none; }
        @media print {
          .only-print-pp5 { display: block !important; }
        }
      `}</style>
    </SmartSchoolLayout>
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
  padding: '10px 6px',
  fontWeight: 800,
  fontSize: '0.76rem',
  textAlign: 'center',
  borderRight: '1px solid rgba(255,255,255,0.12)',
};

const tdP5: React.CSSProperties = {
  padding: '7px 6px',
  textAlign: 'center',
  borderRight: '1px solid #F1F5F9',
};

const inpStyle: React.CSSProperties = {
  width: 64,
  padding: '5px 6px',
  borderRadius: 6,
  border: '1px solid #CBD5E1',
  textAlign: 'center',
  fontWeight: 700,
  fontSize: '0.83rem',
};
