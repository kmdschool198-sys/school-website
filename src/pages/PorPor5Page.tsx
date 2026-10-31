import { useState, useMemo, useEffect } from 'react';
import { collection, doc, getDocs, onSnapshot, query, where, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import {
  Download, Printer, BookOpen, CheckCircle2, ArrowLeft,
  ClipboardPaste, Sparkles, RefreshCw, ShieldCheck, Megaphone, Layers,
} from 'lucide-react';
import SmartSchoolLayout from '../components/SmartSchoolLayout';
import TeacherLoginGate from '../components/TeacherLoginGate';
import { canManageStaffUsers, useTeacherAuth } from '../utils/teacherAuth';
import { useAssessmentPlans, useGradingStatus } from '../utils/assessmentStorage';
import PlanEditor from '../components/sgs/PlanEditor';
import IndicatorGrid from '../components/sgs/IndicatorGrid';
import ItemsGrid from '../components/sgs/ItemsGrid';
import { useAcademicData } from '../utils/academicStorage';
import { calculateClassRanks, scoreScheme, type ScoreScheme, type StudentSubjectScore } from '../data/academicData';
import { downloadCsvReport } from '../utils/csvReport';
import ExcelPasteModal from '../components/ExcelPasteModal';
import { parseClipboardTable, cleanNumeric, isTabularPaste } from '../utils/excelPaste';
import { toast } from '../components/GlobalToast';
import { normalizeResultCode, resultLookupDocId } from '../data/results';
import type { BehaviorLogEntry } from './BehaviorPage';
import { SCHOOL_NAME, SCHOOL_AFFILIATION } from '../config/siteLinks';
import SssPorPor5PrintBook, { PP5_PRINT_STYLES } from '../components/SssPorPor5PrintBook';
import SgsPorPor5PrintBook from '../components/SgsPorPor5PrintBook';

const DIRECTOR_NAME = 'นายปรัชญา ปรางค์ชัยภูมิ';
const DEPUTY_DIRECTOR_NAME = 'นางสาวเจนจีรา บุญเกตุ';

// แปลงรหัสชั้นวิชาการ (เช่น m1, p1) เป็นรหัสห้องเช็คชื่อ (เช่น m1_1, p1_1)
const toRosterClassId = (acadClassId: string) =>
  acadClassId.includes('_') ? acadClassId : `${acadClassId}_1`;

// แปลงคะแนนระหว่างเรียน (เต็ม 70) เป็น: ก่อนกลางภาค (25) | กลางภาค (20) | หลังกลางภาค (25)
function splitCoursework3Parts(cw: number): { preMid: number; mid: number; postMid: number } {
  const safe = Math.min(70, Math.max(0, Math.round(cw)));
  const preMid = Math.min(25, Math.round((safe * 25) / 70));
  const mid = Math.min(20, Math.round((safe * 20) / 70));
  const postMid = Math.max(0, safe - preMid - mid);
  return { preMid, mid, postMid };
}

// แปลงคะแนนระหว่างเรียน (เต็ม 70) เป็น 5 ตัวชี้วัดย่อย (ตัวชี้วัดละ 14 คะแนน รวม 70) สำหรับชีต "คะแนน"
function splitIndicators5(cw: number): [number, number, number, number, number] {
  const safe = Math.min(70, Math.max(0, Math.round(cw)));
  const base = Math.floor(safe / 5);
  const rem = safe - base * 5;
  return [
    base + (rem > 0 ? 1 : 0),
    base + (rem > 1 ? 1 : 0),
    base + (rem > 2 ? 1 : 0),
    base + (rem > 3 ? 1 : 0),
    base,
  ];
}

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
  const { classesData, updateStudentScore } = useAcademicData();
  const auth = useTeacherAuth();
  const { plans, savePlan } = useAssessmentPlans();
  const { status: gradingStatus } = useGradingStatus();
  // SGS: once งานทะเบียน closes score entry only registrars can change scores
  const entryLocked = !gradingStatus.entryOpen && !canManageStaffUsers(auth.role);
  const [entryTab, setEntryTab] = useState<'scores' | 'items'>('scores');
  const [planTerm, setPlanTerm] = useState(0);
  const [showPlanEditor, setShowPlanEditor] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string>('m1');
  const [selectedSubjectCode, setSelectedSubjectCode] = useState<string>('ง21201');
  const [semesterLabel, setSemesterLabel] = useState<string>('ภาคเรียนที่ 1 ปีการศึกษา 2569');
  const [savedToast, setSavedToast] = useState(false);
  const [printMode, setPrintMode] = useState(false);
  const [printFullBook, setPrintFullBook] = useState(true);
  const [pp5Template, setPp5Template] = useState<'sgs' | 'sss_excel' | 'obec_7sheets'>('sgs');
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

  const handleOpenPrint = (fullBook: boolean, template: 'sgs' | 'sss_excel' | 'obec_7sheets' = 'sgs') => {
    setPrintFullBook(fullBook);
    setPp5Template(template);
    setPrintMode(true);
    setTimeout(() => {
      window.print();
    }, 180);
  };

  // ================= 1. ซิงค์เวลาเรียนจริงจากระบบเช็คชื่อรายวัน =================
  const syncAttendanceFromCloud = async () => {
    setSyncingAtt(true);
    try {
      const rosterClassId = toRosterClassId(currentClass.classId);
      const snap = await getDocs(
        query(collection(db, 'attendance'), where('classId', '==', rosterClassId))
      );
      const attDocs: Array<{ date: string; records: Record<string, { status: string }> }> = [];
      snap.forEach(d => attDocs.push(d.data() as any));

      if (attDocs.length === 0) {
        toast.info(`ยังไม่มีประวัติเช็คชื่อในระบบของชั้น ${currentClass.shortName}/1 — ตั้งค่าเวลาเรียนเต็ม ${currentSubject.hours} ชม.`);
        bulkSetSubjectField('full_hours');
        return;
      }

      let lowAttendanceCount = 0;
      currentClass.students.forEach(st => {
        let presentDays = 0;
        let totalRecordedDays = 0;
        attDocs.forEach(docItem => {
          const rec =
            docItem.records?.[st.code] ||
            docItem.records?.[`s_${st.code}`] ||
            docItem.records?.[String(st.no)];
          if (rec) {
            totalRecordedDays += 1;
            if (rec.status === 'present') presentDays += 1;
          }
        });

        const ratio = totalRecordedDays > 0 ? presentDays / totalRecordedDays : 1;
        const calcHours = Math.round(ratio * currentSubject.hours);
        const sc = st.scores[currentSubject.code] || blankScore(currentSubject.hours);

        const specialGrade = calcHours < currentSubject.hours * 0.8 ? 'มส' : undefined;
        if (specialGrade === 'มส') lowAttendanceCount += 1;

        // set มส when attendance is under 80%, lift an earlier มส once it is not; ร stays
        updateStudentScore(currentClass.classId, st.code, currentSubject.code, {
          attendedHours: calcHours,
          specialGrade: specialGrade ?? (sc.grade === 'มส' ? null : undefined),
        });
      });

      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 2200);
      toast.success(
        `ซิงค์เวลาเรียนจากระบบเช็คชื่อ (${attDocs.length} วัน) สำเร็จ!` +
        (lowAttendanceCount > 0 ? ` พบเวลาเรียนต่ำกว่า 80% จำนวน ${lowAttendanceCount} คน` : '')
      );
    } catch (err: any) {
      toast.error('ซิงค์เวลาเรียนไม่สำเร็จ: ' + (err?.message || err));
    } finally {
      setSyncingAtt(false);
    }
  };

  // ================= 2. ดึงแต้มความประพฤติมาแปลงเป็นคะแนนคุณลักษณะ (0-3) =================
  const syncTraitFromBehavior = () => {
    currentClass.students.forEach(st => {
      const stLogs = behaviorLogs.filter(l => l.studentCode === st.code);
      const added = stLogs.filter(l => l.type === 'add').reduce((s, l) => s + l.points, 0);
      const deducted = stLogs.filter(l => l.type === 'deduct').reduce((s, l) => s + l.points, 0);
      const net = 100 + added - deducted;
      const autoTrait: 0 | 1 | 2 | 3 = net >= 95 ? 3 : net >= 80 ? 2 : net >= 60 ? 1 : 0;
      updateStudentScore(currentClass.classId, st.code, currentSubject.code, { traitScore: autoTrait });
    });

    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2000);
    toast.success('คำนวณคุณลักษณะอันพึงประสงค์จากคะแนนความประพฤติจริงเรียบร้อย!');
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
        publishedAt: Date.now(),
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
        const lookupId = resultLookupDocId(announcementId, normalizedCode);
        batch.set(doc(db, 'result_lookup', lookupId), {
          announcementId,
          code: normalizedCode,
          name: st.name,
          scores: scoresObj,
          rank: rInfo?.rank || st.no,
          note: `เกรดเฉลี่ย (GPA): ${rInfo ? rInfo.gpa.toFixed(2) : '-'} · คุณลักษณะฯ: ${st.traitResult}`,
        });
      }

      await batch.commit();
      toast.success(`เผยแพร่ผลสอบชั้น ${currentClass.shortName}/1 ขึ้นหน้าเว็บ /results สำเร็จ!`);
    } catch (err: any) {
      toast.error('เผยแพร่ผลสอบออนไลน์ไม่สำเร็จ: ' + (err?.message || err));
    } finally {
      setPublishingOnline(false);
    }
  };

  const bulkSetSubjectField = (mode: 'full_hours' | 'trait_3' | 'read_3') => {
    const patch = mode === 'full_hours' ? { attendedHours: currentSubject.hours }
      : mode === 'trait_3' ? { traitScore: 3 } : { readThinkScore: 3 };
    currentClass.students.forEach(st => updateStudentScore(currentClass.classId, st.code, currentSubject.code, patch));
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2000);
    toast.success('ตั้งค่าทั้งห้องเรียบร้อยแล้ว');
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
          : ['ก่อนกลางภาค (25)', 'กลางภาค (20)', 'หลังกลางภาค (25)', 'รวมระหว่างเรียน (70)', 'ปลายภาค (30)', 'รวมคะแนน (100)']),
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
          : (() => {
            const { preMid, mid, postMid } = splitCoursework3Parts(sc.coursework);
            return [preMid, mid, postMid, sc.coursework, sc.finalExam, sc.total];
          })();
        return [
          st.no, st.code, st.name,
          currentSubject.hours, sc.attendedHours, `${attPct}%`,
          ...scoreCells, sc.grade, '',
          sc.traitScore, sc.readThinkScore,
        ];
      }),
    ];
    downloadCsvReport(`ปพ5_7ชีต_${currentClass.shortName}_${currentSubject.code}_${currentSubject.name}.csv`, rows);
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
                {pp5Template === 'sgs'
                  ? 'โหมดพิมพ์ ปพ.5 แบบ SGS (รูปแบบเอกสารราชการ)'
                  : pp5Template === 'sss_excel'
                  ? 'โหมดพิมพ์เล่ม SSS ปพ.5 ครบทุกหน้าตามไฟล์ปพ5.xlsx (20 แผ่น / เลือกชีตได้)'
                  : `โหมดพิมพ์เล่ม ปพ.5 มาตรฐาน สพฐ. (${printFullBook ? 'ครบทั้งเล่ม 7 ชีต' : 'เฉพาะปกและสรุปคะแนน 2 หน้า'})`}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748B' }}>
                วิชา {currentSubject.code} {currentSubject.name} · ชั้น {currentClass.className} ({currentClass.students.length} คน)
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Template Switcher */}
            <div style={{ display: 'inline-flex', background: '#F1F5F9', padding: 3, borderRadius: 8, border: '1px solid #CBD5E1' }}>
              <button
                type="button"
                onClick={() => setPp5Template('sgs')}
                style={{
                  background: pp5Template === 'sgs' ? '#0F172A' : 'transparent',
                  color: pp5Template === 'sgs' ? '#FFFFFF' : '#334155',
                  border: 'none', borderRadius: 6, padding: '6px 12px',
                  fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer',
                }}
              >
                📘 SGS (ราชการ)
              </button>
              <button
                type="button"
                onClick={() => setPp5Template('sss_excel')}
                style={{
                  background: pp5Template === 'sss_excel' ? '#0F172A' : 'transparent',
                  color: pp5Template === 'sss_excel' ? '#FFFFFF' : '#334155',
                  border: 'none', borderRadius: 6, padding: '6px 12px',
                  fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer',
                }}
              >
                📋 SSS ปพ.5 (ตามไฟล์ Excel ทุกหน้า)
              </button>
              <button
                type="button"
                onClick={() => setPp5Template('obec_7sheets')}
                style={{
                  background: pp5Template === 'obec_7sheets' ? '#0F172A' : 'transparent',
                  color: pp5Template === 'obec_7sheets' ? '#FFFFFF' : '#334155',
                  border: 'none', borderRadius: 6, padding: '6px 12px',
                  fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer',
                }}
              >
                🏛️ สพฐ. 7 ชีต
              </button>
            </div>

            {pp5Template === 'obec_7sheets' && (
              <button
                type="button"
                onClick={() => setPrintFullBook(prev => !prev)}
                style={{
                  background: printFullBook ? '#FEF3C7' : '#E0F2FE',
                  color: printFullBook ? '#92400E' : '#0369A1',
                  border: '1px solid #CBD5E1', borderRadius: 8, padding: '8px 14px',
                  fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}
              >
                <Layers size={15} /> {printFullBook ? 'ครบเล่ม 7 ชีต' : 'แบบย่อ 2 หน้า'}
              </button>
            )}

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

        {pp5Template === 'sgs' ? (
          <SgsPorPor5PrintBook
            currentClass={currentClass}
            currentSubject={currentSubject}
            semesterLabel={semesterLabel}
            plan={subjectPlan}
            measurementHeadName={academicHeadName}
            deputyDirectorName={DEPUTY_DIRECTOR_NAME}
          />
        ) : pp5Template === 'sss_excel' ? (
          <SssPorPor5PrintBook
            currentClass={currentClass}
            currentSubject={currentSubject}
            semesterLabel={semesterLabel}
            academicHeadName={academicHeadName}
            gradeDistribution={gradeDistribution}
            traitAndReadSummary={traitAndReadSummary}
          />
        ) : (
          <PorPor5OfficialPrintSheets
            currentClass={currentClass}
            currentSubject={currentSubject}
            semesterLabel={semesterLabel}
            academicHeadName={academicHeadName}
            gradeDistribution={gradeDistribution}
            traitAndReadSummary={traitAndReadSummary}
            fullBook={printFullBook}
          />
        )}
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
              onClick={() => handleOpenPrint(true, 'sgs')}
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
        {entryLocked && (
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
        {pp5Template === 'sgs' ? (
          <SgsPorPor5PrintBook
            currentClass={currentClass}
            currentSubject={currentSubject}
            semesterLabel={semesterLabel}
            plan={subjectPlan}
            measurementHeadName={academicHeadName}
            deputyDirectorName={DEPUTY_DIRECTOR_NAME}
          />
        ) : pp5Template === 'sss_excel' ? (
          <SssPorPor5PrintBook
            currentClass={currentClass}
            currentSubject={currentSubject}
            semesterLabel={semesterLabel}
            academicHeadName={academicHeadName}
            gradeDistribution={gradeDistribution}
            traitAndReadSummary={traitAndReadSummary}
          />
        ) : (
          <PorPor5OfficialPrintSheets
            currentClass={currentClass}
            currentSubject={currentSubject}
            semesterLabel={semesterLabel}
            academicHeadName={academicHeadName}
            gradeDistribution={gradeDistribution}
            traitAndReadSummary={traitAndReadSummary}
            fullBook={printFullBook}
          />
        )}
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

/* =========================================================================
   OFFICIAL PORPOR 5 PRINT SHEETS (ครบ 7 ชีตตามไฟล์ Excel สพฐ.)
   1. ปก ปพ.5 & อนุมัติผลการเรียน
   2. เวลาเรียน 20 สัปดาห์
   3. คะแนนตัวชี้วัด (14 x 5 = 70)
   4. สรุปคะแนน (25/20/25/70/30/100/เกรด)
   5. คุณลักษณะอันพึงประสงค์ & อ่านคิดเขียน (ในแผ่นเดียว)
   6. สรุปคุณลักษณะอันพึงประสงค์
   7. สรุปการอ่านคิดวิเคราะห์และเขียน
   ========================================================================= */
function PorPor5OfficialPrintSheets({
  currentClass,
  currentSubject,
  semesterLabel,
  academicHeadName,
  gradeDistribution,
  traitAndReadSummary,
  fullBook,
}: {
  currentClass: ReturnType<typeof useAcademicData>['classesData'][number];
  currentSubject: ReturnType<typeof useAcademicData>['classesData'][number]['subjects'][number];
  semesterLabel: string;
  academicHeadName: string;
  gradeDistribution: Record<string, number>;
  traitAndReadSummary: {
    trait: Record<0 | 1 | 2 | 3, number>;
    read: Record<0 | 1 | 2 | 3, number>;
  };
  fullBook: boolean;
}) {
  const scheme = scoreScheme(currentClass.level);
  const totalStudents = currentClass.students.length || 1;
  const pct = (count: number) => ((count / totalStudents) * 100).toFixed(2);
  const gradeCols = ['4', '3.5', '3', '2.5', '2', '1.5', '1', '0', 'ร', 'มส'] as const;
  const failCount = (gradeDistribution['0'] || 0) + (gradeDistribution['ร'] || 0) + (gradeDistribution['มส'] || 0);
  const passCount = currentClass.students.length - failCount;

  const traitPassCount = traitAndReadSummary.trait[3] + traitAndReadSummary.trait[2] + traitAndReadSummary.trait[1];
  const traitFailCount = traitAndReadSummary.trait[0];
  const readPassCount = traitAndReadSummary.read[3] + traitAndReadSummary.read[2] + traitAndReadSummary.read[1];
  const readFailCount = traitAndReadSummary.read[0];

  const hoursPerWeek = Math.max(1, Math.round(currentSubject.hours / 20));
  const isBasic = currentSubject.type === 'พื้นฐาน';
  const isSecondary = currentClass.level === 'มัธยม';

  return (
    <div>
      {/* ================= ชีตที่ 1: ปก (ตรงตามชีต 'ปก' ในไฟล์ Excel) ================= */}
      <div className="pp5-sheet">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ width: 70 }} />
          <div style={{ textAlign: 'center', flex: 1 }}>
            <img
              src={`${import.meta.env.BASE_URL}school_logo_kmd.png`}
              alt="ตราโรงเรียน"
              style={{ width: 58, height: 58, objectFit: 'contain', margin: '0 auto 4px' }}
            />
            <div style={{ fontSize: '15pt', fontWeight: 900 }}>{SCHOOL_NAME}</div>
            <div style={{ fontSize: '11.5pt', fontWeight: 700 }}>
              {SCHOOL_AFFILIATION}
            </div>
          </div>
          <div style={{
            width: 70, textAlign: 'center', fontWeight: 900, fontSize: '15pt',
            border: '2px solid #000', padding: '4px 8px',
          }}>
            ปพ.5
          </div>
        </div>

        {/* ข้อมูลรายวิชาตามบรรทัด Row 5 - 12 ของชีต 'ปก' */}
        <div style={{ marginTop: 8, border: '1px solid #000', padding: '8px 12px', fontSize: '10.5pt', lineHeight: 1.65 }}>
          <div>
            <b>กลุ่มสาระการเรียนรู้:</b> {currentSubject.group} &nbsp;&nbsp;&nbsp;&nbsp;
            <b>สาระการเรียนรู้:</b> [{isBasic ? '✓' : ' '}] พื้นฐาน &nbsp; [{!isBasic ? '✓' : ' '}] เพิ่มเติม
          </div>
          <div>
            <b>ระดับชั้น:</b> [{!isSecondary ? '✓' : ' '}] ประถมศึกษา &nbsp; [{isSecondary ? '✓' : ' '}] มัธยมศึกษาตอนต้น &nbsp;&nbsp;|&nbsp;&nbsp;
            <b>ชั้น:</b> {currentClass.className} ({currentClass.shortName}/{currentClass.room}) &nbsp;&nbsp;|&nbsp;&nbsp;
            <b>{semesterLabel}</b>
          </div>
          <div>
            <b>รายวิชา:</b> {currentSubject.name} &nbsp;&nbsp;&nbsp;&nbsp;
            <b>รหัสวิชา:</b> {currentSubject.code} &nbsp;&nbsp;&nbsp;&nbsp;
            <b>{scheme.yearly ? 'น้ำหนัก' : 'จำนวนหน่วยกิต'}:</b> {currentSubject.credits} {scheme.weightLabel} &nbsp;&nbsp;
            <b>เวลาเรียน:</b> {hoursPerWeek} ชม./สัปดาห์ &nbsp; รวม <b>{currentSubject.hours}</b> ชม./ภาคเรียน
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <div><b>ครูผู้สอน:</b> {currentSubject.teacher}</div>
            <div><b>ครูที่ปรึกษา/ประจำชั้น:</b> {currentClass.homeroomTeachers.join(' / ')}</div>
          </div>
        </div>

        {/* ตารางที่ 1: สรุปผลการเรียน (Row 14 - 18 ของชีต 'ปก') */}
        <div style={{ marginTop: 8 }}>
          <table className="pp5-table">
            <thead>
              <tr>
                <th rowSpan={3} style={{ width: '13%' }}>จำนวนนักเรียน</th>
                <th colSpan={12}>สรุปผลการเรียน</th>
              </tr>
              <tr>
                <th colSpan={10}>จำนวนนักเรียนที่ได้ระดับผลการเรียน</th>
                <th rowSpan={2} style={{ width: '8%' }}>ผ่าน<br />การประเมิน</th>
                <th rowSpan={2} style={{ width: '8%' }}>ไม่ผ่าน<br />การประเมิน</th>
              </tr>
              <tr>
                {gradeCols.map(g => (
                  <th key={g} style={{ width: '6.5%' }}>{g === '3' ? '3.0' : g}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ textAlign: 'center', fontWeight: 800 }}>จำนวน {currentClass.students.length} คน</td>
                {gradeCols.map(g => (
                  <td key={g} style={{ textAlign: 'center', fontWeight: 800 }}>{gradeDistribution[g] || 0}</td>
                ))}
                <td style={{ textAlign: 'center', fontWeight: 900 }}>{passCount}</td>
                <td style={{ textAlign: 'center', fontWeight: 900 }}>{failCount}</td>
              </tr>
              <tr>
                <td style={{ textAlign: 'center', fontWeight: 700 }}>คิดเป็นร้อยละ</td>
                {gradeCols.map(g => (
                  <td key={g} style={{ textAlign: 'center' }}>{gradeDistribution[g] ? pct(gradeDistribution[g]) : '0.00'}</td>
                ))}
                <td style={{ textAlign: 'center', fontWeight: 800 }}>{pct(passCount)}</td>
                <td style={{ textAlign: 'center', fontWeight: 800 }}>{pct(failCount)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ตารางที่ 2: สรุปคุณลักษณะและอ่านคิดวิเคราะห์ (Row 20 - 24 ของชีต 'ปก') */}
        <div style={{ marginTop: 8 }}>
          <table className="pp5-table">
            <thead>
              <tr>
                <th rowSpan={2} style={{ width: '13%' }}>สรุปผล<br />การประเมิน</th>
                <th colSpan={6}>คุณลักษณะอันพึงประสงค์ของสถานศึกษา</th>
                <th colSpan={6}>การอ่านคิดวิเคราะห์และเขียนสื่อความ</th>
              </tr>
              <tr>
                <th>3</th><th>2</th><th>1</th><th>0</th><th>ผ่าน</th><th>ไม่ผ่าน</th>
                <th>3</th><th>2</th><th>1</th><th>0</th><th>ผ่าน</th><th>ไม่ผ่าน</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ textAlign: 'center', fontWeight: 800 }}>จำนวนนักเรียน</td>
                <td style={{ textAlign: 'center', fontWeight: 700 }}>{traitAndReadSummary.trait[3]}</td>
                <td style={{ textAlign: 'center', fontWeight: 700 }}>{traitAndReadSummary.trait[2]}</td>
                <td style={{ textAlign: 'center', fontWeight: 700 }}>{traitAndReadSummary.trait[1]}</td>
                <td style={{ textAlign: 'center', fontWeight: 700 }}>{traitAndReadSummary.trait[0]}</td>
                <td style={{ textAlign: 'center', fontWeight: 900 }}>{traitPassCount}</td>
                <td style={{ textAlign: 'center', fontWeight: 900 }}>{traitFailCount}</td>
                <td style={{ textAlign: 'center', fontWeight: 700 }}>{traitAndReadSummary.read[3]}</td>
                <td style={{ textAlign: 'center', fontWeight: 700 }}>{traitAndReadSummary.read[2]}</td>
                <td style={{ textAlign: 'center', fontWeight: 700 }}>{traitAndReadSummary.read[1]}</td>
                <td style={{ textAlign: 'center', fontWeight: 700 }}>{traitAndReadSummary.read[0]}</td>
                <td style={{ textAlign: 'center', fontWeight: 900 }}>{readPassCount}</td>
                <td style={{ textAlign: 'center', fontWeight: 900 }}>{readFailCount}</td>
              </tr>
              <tr>
                <td style={{ textAlign: 'center', fontWeight: 700 }}>ร้อยละ</td>
                <td style={{ textAlign: 'center' }}>{pct(traitAndReadSummary.trait[3])}</td>
                <td style={{ textAlign: 'center' }}>{pct(traitAndReadSummary.trait[2])}</td>
                <td style={{ textAlign: 'center' }}>{pct(traitAndReadSummary.trait[1])}</td>
                <td style={{ textAlign: 'center' }}>{pct(traitAndReadSummary.trait[0])}</td>
                <td style={{ textAlign: 'center', fontWeight: 800 }}>{pct(traitPassCount)}</td>
                <td style={{ textAlign: 'center', fontWeight: 800 }}>{pct(traitFailCount)}</td>
                <td style={{ textAlign: 'center' }}>{pct(traitAndReadSummary.read[3])}</td>
                <td style={{ textAlign: 'center' }}>{pct(traitAndReadSummary.read[2])}</td>
                <td style={{ textAlign: 'center' }}>{pct(traitAndReadSummary.read[1])}</td>
                <td style={{ textAlign: 'center' }}>{pct(traitAndReadSummary.read[0])}</td>
                <td style={{ textAlign: 'center', fontWeight: 800 }}>{pct(readPassCount)}</td>
                <td style={{ textAlign: 'center', fontWeight: 800 }}>{pct(readFailCount)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* การอนุมัติผลการเรียน 5 ตำแหน่ง (Row 26 - 33 ของชีต 'ปก') */}
        <div style={{ marginTop: 10, border: '1px solid #000', padding: '10px 14px', fontSize: '10pt', lineHeight: 1.55 }}>
          <div style={{ fontWeight: 900, textDecoration: 'underline', marginBottom: 6, textAlign: 'center', fontSize: '11pt' }}>
            การอนุมัติผลการเรียน
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ textAlign: 'center' }}>
              <div>ลงชื่อ .......................................................... ครูผู้สอน</div>
              <div>({currentSubject.teacher})</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div>ลงชื่อ .......................................................... หัวหน้ากลุ่มสาระการเรียนรู้</div>
              <div>({currentSubject.teacher})</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div>ลงชื่อ .......................................................... หัวหน้างานวัดและประเมินผล</div>
              <div>({academicHeadName})</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div>เสนอเพื่อพิจารณา &nbsp; ลงชื่อ ..........................................................</div>
              <div>({DEPUTY_DIRECTOR_NAME}) รองผู้อำนวยการโรงเรียน</div>
            </div>
          </div>
          <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px dashed #000', textAlign: 'center' }}>
            <div style={{ fontWeight: 800 }}>
              ผลการพิจารณา: &nbsp;&nbsp; [ ✓ ] อนุมัติ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; [ &nbsp; ] ไม่อนุมัติ
            </div>
            <div style={{ marginTop: 6 }}>
              ลงชื่อ .......................................................... &nbsp;&nbsp; (<b>{DIRECTOR_NAME}</b>) &nbsp;&nbsp; ผู้อำนวยการ{SCHOOL_NAME}
            </div>
          </div>
        </div>
      </div>

      {/* ================= ชีตที่ 2: เวลาเรียน (ตรงตามชีต 'เวลาเรียน' แบ่งสัปดาห์ 1-6, 7-12, 13-18, 19-20 + ป่วย/ลา/ขาด) ================= */}
      {fullBook && (
        <div className="pp5-sheet">
          <div style={{ textAlign: 'center', marginBottom: 6 }}>
            <div style={{ fontSize: '12.5pt', fontWeight: 900 }}>
              บันทึกเวลาเรียน 20 สัปดาห์ ({semesterLabel}) — รหัสวิชา {currentSubject.code} {currentSubject.name}
            </div>
            <div style={{ fontSize: '9.5pt', fontWeight: 700 }}>
              ชั้น {currentClass.className} ({currentClass.shortName}/{currentClass.room}) &nbsp;|&nbsp;
              เวลาเรียน {hoursPerWeek} ชม./สัปดาห์ &nbsp;|&nbsp; รวมเวลาเรียนเต็ม {currentSubject.hours} ชั่วโมง &nbsp;|&nbsp;
              สูตรคำนวณ: (เวลามาเรียน × 100) / เวลาเรียนเต็ม
            </div>
          </div>

          <table className="pp5-table" style={{ fontSize: '8pt' }}>
            <thead>
              <tr>
                <th rowSpan={3} style={{ width: '3.5%' }}>เลขที่</th>
                <th rowSpan={3} style={{ width: '6.5%' }}>เลข<br />ประจำตัว</th>
                <th rowSpan={3} style={{ width: '18%' }}>ชื่อ - สกุล</th>
                <th colSpan={6}>สัปดาห์ที่ 1 – 6</th>
                <th colSpan={6}>สัปดาห์ที่ 7 – 12</th>
                <th colSpan={6}>สัปดาห์ที่ 13 – 18</th>
                <th colSpan={2}>สัปดาห์ 19–20</th>
                <th colSpan={7}>สรุปเวลาเรียน ({currentSubject.hours} ชม.)</th>
              </tr>
              <tr>
                {Array.from({ length: 20 }, (_, i) => (
                  <th key={i} style={{ width: '2.1%', padding: '1px' }}>{i + 1}</th>
                ))}
                <th rowSpan={2} style={{ width: '3.5%' }}>ป่วย</th>
                <th rowSpan={2} style={{ width: '3.5%' }}>ลา</th>
                <th rowSpan={2} style={{ width: '3.5%' }}>ขาด</th>
                <th rowSpan={2} style={{ width: '4.5%' }}>รวมไม่<br />มาเรียน</th>
                <th rowSpan={2} style={{ width: '4.5%' }}>รวมเวลา<br />มาเรียน</th>
                <th rowSpan={2} style={{ width: '5%' }}>ร้อยละ<br />ที่มาเรียน</th>
                <th rowSpan={2} style={{ width: '5.5%' }}>หมายเหตุ</th>
              </tr>
              <tr>
                {Array.from({ length: 20 }, (_, i) => (
                  <th key={i} style={{ fontSize: '6.5pt', padding: '1px', color: '#475569' }}>{hoursPerWeek}ชม.</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {currentClass.students.map(st => {
                const sc = st.scores[currentSubject.code] || { attendedHours: currentSubject.hours };
                const attHrs = sc.attendedHours ?? currentSubject.hours;
                const absentHours = Math.max(0, currentSubject.hours - attHrs);
                const sickCount = absentHours > 0 ? Math.floor(absentHours / 2) : 0;
                const leaveCount = absentHours > 0 ? Math.ceil(absentHours / 2) : 0;
                const truantCount = 0;
                const missedWeeks = Math.max(0, Math.round(absentHours / hoursPerWeek));
                const attPct = currentSubject.hours > 0 ? ((attHrs * 100) / currentSubject.hours).toFixed(1) : '100.0';
                const passAtt = Number(attPct) >= 80;

                return (
                  <tr key={st.code}>
                    <td style={{ textAlign: 'center' }}>{st.no}</td>
                    <td style={{ textAlign: 'center' }}>{st.code}</td>
                    <td>{st.name}</td>
                    {Array.from({ length: 20 }, (_, idx) => {
                      const w = idx + 1;
                      const isMissed = missedWeeks > 0 && w > 20 - missedWeeks;
                      return (
                        <td key={w} style={{ textAlign: 'center', fontWeight: 700, padding: '1px' }}>
                          {isMissed ? 'ล' : '✓'}
                        </td>
                      );
                    })}
                    <td style={{ textAlign: 'center' }}>{sickCount}</td>
                    <td style={{ textAlign: 'center' }}>{leaveCount}</td>
                    <td style={{ textAlign: 'center' }}>{truantCount}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{absentHours}</td>
                    <td style={{ textAlign: 'center', fontWeight: 800 }}>{attHrs}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{attPct}%</td>
                    <td style={{ textAlign: 'center', fontWeight: 800 }}>{passAtt ? 'ปกติ' : 'มส'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ================= ชีตที่ 3: คะแนน (ตรงตามชีต 'คะแนน' ประเมินตัวชี้วัด 5 ข้อ x 14 คะแนน = 70) ================= */}
      {fullBook && (
        <div className="pp5-sheet">
          <div style={{ textAlign: 'center', marginBottom: 6 }}>
            <div style={{ fontSize: '12.5pt', fontWeight: 900 }}>
              ผลการประเมินตัวชี้วัด / ผลการเรียนรู้ — กลุ่มสาระการเรียนรู้ {currentSubject.group}
            </div>
            <div style={{ fontSize: '10pt', fontWeight: 700 }}>
              ชั้น {currentClass.className} ({currentClass.shortName}/{currentClass.room}) &nbsp;|&nbsp;
              รหัสวิชา {currentSubject.code} รายวิชา {currentSubject.name} &nbsp;|&nbsp; {semesterLabel}
            </div>
          </div>

          <table className="pp5-table" style={{ fontSize: '8.5pt' }}>
            <thead>
              <tr>
                <th rowSpan={4} style={{ width: '4.5%' }}>เลขที่</th>
                <th rowSpan={4} style={{ width: '23.5%' }}>ชื่อ - สกุล</th>
                {[1, 2, 3, 4, 5].map(ind => (
                  <th key={ind} colSpan={3}>ตัวชี้วัดที่ / ผลการเรียนรู้ที่ {ind}</th>
                ))}
              </tr>
              <tr>
                {[1, 2, 3, 4, 5].map(ind => (
                  <th key={ind} colSpan={3} style={{ fontSize: '7.5pt' }}>เครื่องมือ: แบบฝึก/ชิ้นงาน/ทดสอบ</th>
                ))}
              </tr>
              <tr>
                {[1, 2, 3, 4, 5].map(ind => [
                  <th key={`m_${ind}`} style={{ width: '5%' }}>คะแนนเต็ม<br />(14)</th>,
                  <th key={`r_${ind}`} colSpan={2}>สรุปผล</th>,
                ])}
              </tr>
              <tr>
                {[1, 2, 3, 4, 5].map(ind => [
                  <th key={`s_${ind}`}>คะแนนที่ได้</th>,
                  <th key={`p_${ind}`} style={{ width: '4%' }}>ผ่าน</th>,
                  <th key={`f_${ind}`} style={{ width: '4.5%' }}>ไม่ผ่าน</th>,
                ])}
              </tr>
            </thead>
            <tbody>
              {currentClass.students.map(st => {
                const sc = st.scores[currentSubject.code] || { coursework: 0 };
                const indScores = splitIndicators5(sc.coursework);
                return (
                  <tr key={st.code}>
                    <td style={{ textAlign: 'center' }}>{st.no}</td>
                    <td>{st.name}</td>
                    {indScores.map((val, idx) => {
                      const passed = val >= 7;
                      return [
                        <td key={`v_${idx}`} style={{ textAlign: 'center', fontWeight: 700 }}>{val}</td>,
                        <td key={`ok_${idx}`} style={{ textAlign: 'center', fontWeight: 800 }}>{passed ? '✓' : ''}</td>,
                        <td key={`no_${idx}`} style={{ textAlign: 'center', color: '#DC2626', fontWeight: 800 }}>{!passed ? '✗' : ''}</td>,
                      ];
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ================= ชีตที่ 4: สรุปคะแนน (ตรงตามชีต 'สรุปคะแนน' ก่อนกลางภาค 25 | กลางภาค 20 | หลังกลางภาค 25 | ปลายภาค 30) ================= */}
      <div className="pp5-sheet">
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: '12.5pt', fontWeight: 900 }}>
            ผลการประเมินกลุ่มสาระการเรียนรู้ {currentSubject.group} &nbsp; รายวิชา {currentSubject.name} &nbsp; รหัสวิชา {currentSubject.code}
          </div>
          <div style={{ fontSize: '10.5pt', fontWeight: 700 }}>
            ชั้น {currentClass.className} ({currentClass.shortName}/{currentClass.room}) &nbsp;&nbsp; {semesterLabel} &nbsp;&nbsp; ครูผู้สอน: {currentSubject.teacher}
          </div>
        </div>

        <table className="pp5-table" style={{ fontSize: '9.5pt' }}>
          <thead>
            <tr>
              <th rowSpan={2} style={{ width: '5%' }}>เลขที่</th>
              <th rowSpan={2} style={{ width: '9%' }}>เลขประจำตัว</th>
              <th rowSpan={2} style={{ width: '28%' }}>ชื่อ - สกุล</th>
              {scheme.yearly ? (
                <>
                  <th colSpan={3}>ภาคเรียนที่ 1</th>
                  <th colSpan={3}>ภาคเรียนที่ 2</th>
                  <th rowSpan={2} style={{ width: '7%' }}>รวม<br />ทั้งปี<br />(100)</th>
                </>
              ) : (
                <>
                  <th colSpan={4}>ระหว่างเรียน (70 คะแนน)</th>
                  <th rowSpan={2} style={{ width: '8.5%' }}>ปลายภาค<br />(30)</th>
                  <th rowSpan={2} style={{ width: '8.5%' }}>รวม<br />คะแนน<br />(100)</th>
                </>
              )}
              <th rowSpan={2} style={{ width: '8.5%' }}>ระดับผล<br />การเรียน</th>
              <th rowSpan={2} style={{ width: '8.5%' }}>ผลการ<br />แก้ไข</th>
            </tr>
            <tr>
              {scheme.yearly ? (
                <>
                  <th style={{ width: '6%' }}>เก็บ<br />({scheme.courseworkMax})</th>
                  <th style={{ width: '6%' }}>ปลายภาค<br />({scheme.finalMax})</th>
                  <th style={{ width: '6%' }}>รวม<br />(50)</th>
                  <th style={{ width: '6%' }}>เก็บ<br />({scheme.courseworkMax})</th>
                  <th style={{ width: '6%' }}>ปลายภาค<br />({scheme.finalMax})</th>
                  <th style={{ width: '6%' }}>รวม<br />(50)</th>
                </>
              ) : (
                <>
                  <th style={{ width: '8%' }}>ก่อนกลางภาค<br />(25)</th>
                  <th style={{ width: '8%' }}>กลางภาค<br />(20)</th>
                  <th style={{ width: '8%' }}>หลังกลางภาค<br />(25)</th>
                  <th style={{ width: '8%' }}>รวมเก็บ<br />(70)</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {currentClass.students.map(st => {
              const sc = st.scores[currentSubject.code] || blankScore(currentSubject.hours);
              if (scheme.yearly) {
                const hasTerm2 = sc.term2Coursework !== undefined || sc.term2FinalExam !== undefined;
                return (
                  <tr key={st.code}>
                    <td style={{ textAlign: 'center' }}>{st.no}</td>
                    <td style={{ textAlign: 'center' }}>{st.code}</td>
                    <td>{st.name}</td>
                    <td style={{ textAlign: 'center' }}>{sc.coursework}</td>
                    <td style={{ textAlign: 'center' }}>{sc.finalExam}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700, background: '#F8FAFC' }}>{sc.coursework + sc.finalExam}</td>
                    <td style={{ textAlign: 'center' }}>{sc.term2Coursework ?? ''}</td>
                    <td style={{ textAlign: 'center' }}>{sc.term2FinalExam ?? ''}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700, background: '#F8FAFC' }}>{hasTerm2 ? (sc.term2Coursework ?? 0) + (sc.term2FinalExam ?? 0) : ''}</td>
                    <td style={{ textAlign: 'center', fontWeight: 800 }}>{hasTerm2 ? sc.total : ''}</td>
                    <td style={{ textAlign: 'center', fontWeight: 900 }}>{sc.grade}</td>
                    <td style={{ textAlign: 'center' }}>{sc.remedial?.grade ?? '-'}</td>
                  </tr>
                );
              }
              const { preMid, mid, postMid } = splitCoursework3Parts(sc.coursework);
              return (
                <tr key={st.code}>
                  <td style={{ textAlign: 'center' }}>{st.no}</td>
                  <td style={{ textAlign: 'center' }}>{st.code}</td>
                  <td>{st.name}</td>
                  <td style={{ textAlign: 'center' }}>{preMid}</td>
                  <td style={{ textAlign: 'center' }}>{mid}</td>
                  <td style={{ textAlign: 'center' }}>{postMid}</td>
                  <td style={{ textAlign: 'center', fontWeight: 700, background: '#F8FAFC' }}>{sc.coursework}</td>
                  <td style={{ textAlign: 'center', fontWeight: 700 }}>{sc.finalExam}</td>
                  <td style={{ textAlign: 'center', fontWeight: 800, background: '#F8FAFC' }}>{sc.total}</td>
                  <td style={{ textAlign: 'center', fontWeight: 900 }}>{sc.grade}</td>
                  <td style={{ textAlign: 'center' }}>{sc.remedial?.grade ?? '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ================= ชีตที่ 5: คุณลักษณะ อ่าน คิด วิเคราะห์ (รวม 8 คุณลักษณะ + 5 อ่านคิดเขียน ในแผ่นเดียว) ================= */}
      {fullBook && (
        <div className="pp5-sheet">
          <div style={{ textAlign: 'center', marginBottom: 6 }}>
            <div style={{ fontSize: '12pt', fontWeight: 900 }}>
              แบบประเมินคุณลักษณะอันพึงประสงค์ และการอ่าน คิด วิเคราะห์และเขียน — รหัสวิชา {currentSubject.code} {currentSubject.name}
            </div>
            <div style={{ fontSize: '9.5pt', fontWeight: 700 }}>
              ชั้น {currentClass.className} ({currentClass.shortName}/{currentClass.room}) &nbsp;|&nbsp; {semesterLabel} &nbsp;|&nbsp; ระดับคุณภาพ: 3 = ดีเยี่ยม, 2 = ดี, 1 = ผ่าน, 0 = ไม่ผ่าน
            </div>
          </div>

          <table className="pp5-table" style={{ fontSize: '8pt' }}>
            <thead>
              <tr>
                <th rowSpan={2} style={{ width: '4%' }}>เลขที่</th>
                <th rowSpan={2} style={{ width: '19%' }}>ชื่อ - สกุล</th>
                <th colSpan={10}>คุณลักษณะอันพึงประสงค์ (0-3)</th>
                <th colSpan={7}>การอ่าน คิด วิเคราะห์และเขียน (0-3)</th>
              </tr>
              <tr>
                <th>1.รักชาติฯ</th>
                <th>2.ซื่อสัตย์</th>
                <th>3.มีวินัย</th>
                <th>4.ใฝ่เรียนรู้</th>
                <th>5.พอเพียง</th>
                <th>6.มุ่งมั่นฯ</th>
                <th>7.รักไทย</th>
                <th>8.จิตอาสา</th>
                <th>สรุปผล</th>
                <th>ผ / มผ</th>
                <th>1.อ่านค้นคว้า</th>
                <th>2.จับประเด็น</th>
                <th>3.วิเคราะห์</th>
                <th>4.ประเมินค่า</th>
                <th>5.เขียนสื่อสาร</th>
                <th>สรุปผล</th>
                <th>ผ / มผ</th>
              </tr>
            </thead>
            <tbody>
              {currentClass.students.map(st => {
                const sc: Partial<StudentSubjectScore> = st.scores[currentSubject.code] || { traitScore: 3, readThinkScore: 3 };
                const t = sc.traitScore ?? 3;
                const r = sc.readThinkScore ?? 3;
                return (
                  <tr key={st.code}>
                    <td style={{ textAlign: 'center' }}>{st.no}</td>
                    <td>{st.name}</td>
                    {[0, 1, 2, 3, 4, 5, 6, 7].map(k => (
                      <td key={`t_${k}`} style={{ textAlign: 'center' }}>{sc.traitItems?.[k] ?? ''}</td>
                    ))}
                    <td style={{ textAlign: 'center', fontWeight: 800, background: '#F8FAFC' }}>{t}</td>
                    <td style={{ textAlign: 'center', fontWeight: 800 }}>{t > 0 ? 'ผ่าน' : 'ไม่ผ่าน'}</td>
                    {[0, 1, 2, 3, 4].map(k => (
                      <td key={`r_${k}`} style={{ textAlign: 'center' }}>{sc.readItems?.[k] ?? ''}</td>
                    ))}
                    <td style={{ textAlign: 'center', fontWeight: 800, background: '#F8FAFC' }}>{r}</td>
                    <td style={{ textAlign: 'center', fontWeight: 800 }}>{r > 0 ? 'ผ่าน' : 'ไม่ผ่าน'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ================= ชีตที่ 6 & 7: สรุปคุณลักษณะ และ สรุปอ่าน คิด เขียน พร้อมเกณฑ์การประเมิน ================= */}
      {fullBook && (
        <div className="pp5-sheet">
          {/* ชีตสรุปคุณลักษณะ */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: '12.5pt', fontWeight: 900, textAlign: 'center', marginBottom: 6 }}>
              สรุปผลการประเมินคุณลักษณะอันพึงประสงค์ — รายวิชา {currentSubject.code} {currentSubject.name} (ชั้น {currentClass.className})
            </div>
            <table className="pp5-table" style={{ marginBottom: 8 }}>
              <thead>
                <tr>
                  <th style={{ width: '20%' }}>ผลการประเมิน</th>
                  <th style={{ width: '16%' }}>ดีเยี่ยม (3)</th>
                  <th style={{ width: '16%' }}>ดี (2)</th>
                  <th style={{ width: '16%' }}>ผ่านเกณฑ์การประเมิน (1)</th>
                  <th style={{ width: '16%' }}>ไม่ผ่านเกณฑ์การประเมิน (0)</th>
                  <th style={{ width: '16%' }}>หมายเหตุ</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ textAlign: 'center', fontWeight: 800 }}>จำนวนคน</td>
                  <td style={{ textAlign: 'center', fontWeight: 800 }}>{traitAndReadSummary.trait[3]}</td>
                  <td style={{ textAlign: 'center', fontWeight: 800 }}>{traitAndReadSummary.trait[2]}</td>
                  <td style={{ textAlign: 'center', fontWeight: 800 }}>{traitAndReadSummary.trait[1]}</td>
                  <td style={{ textAlign: 'center', fontWeight: 800 }}>{traitAndReadSummary.trait[0]}</td>
                  <td style={{ textAlign: 'center' }}>รวม {currentClass.students.length} คน</td>
                </tr>
                <tr>
                  <td style={{ textAlign: 'center', fontWeight: 700 }}>ร้อยละ</td>
                  <td style={{ textAlign: 'center' }}>{pct(traitAndReadSummary.trait[3])}</td>
                  <td style={{ textAlign: 'center' }}>{pct(traitAndReadSummary.trait[2])}</td>
                  <td style={{ textAlign: 'center' }}>{pct(traitAndReadSummary.trait[1])}</td>
                  <td style={{ textAlign: 'center' }}>{pct(traitAndReadSummary.trait[0])}</td>
                  <td style={{ textAlign: 'center' }}>100.00%</td>
                </tr>
              </tbody>
            </table>
            <div style={{ border: '1px solid #000', padding: '6px 10px', fontSize: '8.8pt', lineHeight: 1.45 }}>
              <div><b>คุณลักษณะอันพึงประสงค์ 8 ประการ:</b> ข้อ 1 รักชาติ ศาสน์ กษัตริย์ · ข้อ 2 ซื่อสัตย์ สุจริต · ข้อ 3 มีวินัย · ข้อ 4 ใฝ่เรียนรู้ · ข้อ 5 อยู่อย่างพอเพียง · ข้อ 6 มุ่งมั่นในการทำงาน · ข้อ 7 รักความเป็นไทย · ข้อ 8 มีจิตสาธารณะ</div>
              <div style={{ marginTop: 3 }}><b>เกณฑ์การประเมินคุณลักษณะอันพึงประสงค์ แบ่งเป็น 4 ระดับ คือ:</b></div>
              <div>• <b>ระดับ 3 (ดีเยี่ยม):</b> ผู้เรียนปฏิบัติตนตามคุณลักษณะจนเป็นนิสัยและนำไปใช้ในชีวิตประจำวัน โดยได้ระดับดีเยี่ยม จำนวน 5-8 คุณลักษณะ และไม่มีคุณลักษณะใดต่ำกว่าระดับดี</div>
              <div>• <b>ระดับ 2 (ดี):</b> ผู้เรียนปฏิบัติตามกฎเกณฑ์ โดยได้ระดับดีเยี่ยม 1-4 คุณลักษณะ และไม่มีคุณลักษณะใดต่ำกว่าระดับดี หรือได้ระดับดีครบทุกคุณลักษณะ</div>
              <div>• <b>ระดับ 1 (ผ่าน):</b> ผู้เรียนรับรู้และปฏิบัติตามกฎเกณฑ์ที่สถานศึกษากำหนด โดยได้ระดับผ่านขึ้นไปครบทุกคุณลักษณะ</div>
              <div>• <b>ระดับ 0 (ไม่ผ่าน):</b> ได้ผลการประเมินระดับไม่ผ่าน ตั้งแต่ 1 คุณลักษณะขึ้นไป</div>
            </div>
          </div>

          {/* ชีตสรุปอ่าน คิด เขียน */}
          <div style={{ paddingTop: 10, borderTop: '2px dashed #000' }}>
            <div style={{ fontSize: '12.5pt', fontWeight: 900, textAlign: 'center', marginBottom: 6 }}>
              สรุปผลการประเมินการอ่าน คิด วิเคราะห์และเขียน — รายวิชา {currentSubject.code} {currentSubject.name} (ชั้น {currentClass.className})
            </div>
            <table className="pp5-table" style={{ marginBottom: 8 }}>
              <thead>
                <tr>
                  <th style={{ width: '20%' }}>ผลการประเมิน</th>
                  <th style={{ width: '16%' }}>ดีเยี่ยม (3)</th>
                  <th style={{ width: '16%' }}>ดี (2)</th>
                  <th style={{ width: '16%' }}>ผ่านเกณฑ์การประเมิน (1)</th>
                  <th style={{ width: '16%' }}>ไม่ผ่านเกณฑ์การประเมิน (0)</th>
                  <th style={{ width: '16%' }}>หมายเหตุ</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ textAlign: 'center', fontWeight: 800 }}>จำนวนคน</td>
                  <td style={{ textAlign: 'center', fontWeight: 800 }}>{traitAndReadSummary.read[3]}</td>
                  <td style={{ textAlign: 'center', fontWeight: 800 }}>{traitAndReadSummary.read[2]}</td>
                  <td style={{ textAlign: 'center', fontWeight: 800 }}>{traitAndReadSummary.read[1]}</td>
                  <td style={{ textAlign: 'center', fontWeight: 800 }}>{traitAndReadSummary.read[0]}</td>
                  <td style={{ textAlign: 'center' }}>รวม {currentClass.students.length} คน</td>
                </tr>
                <tr>
                  <td style={{ textAlign: 'center', fontWeight: 700 }}>ร้อยละ</td>
                  <td style={{ textAlign: 'center' }}>{pct(traitAndReadSummary.read[3])}</td>
                  <td style={{ textAlign: 'center' }}>{pct(traitAndReadSummary.read[2])}</td>
                  <td style={{ textAlign: 'center' }}>{pct(traitAndReadSummary.read[1])}</td>
                  <td style={{ textAlign: 'center' }}>{pct(traitAndReadSummary.read[0])}</td>
                  <td style={{ textAlign: 'center' }}>100.00%</td>
                </tr>
              </tbody>
            </table>
            <div style={{ border: '1px solid #000', padding: '6px 10px', fontSize: '8.8pt', lineHeight: 1.45 }}>
              <div><b>ตัวชี้วัดความสามารถในการอ่าน คิด วิเคราะห์และเขียน (5 ข้อ):</b></div>
              <div>1) สามารถอ่านเพื่อการศึกษา ค้นคว้า เพิ่มพูนความรู้ ประสบการณ์และการประยุกต์ใช้ในชีวิตประจำวัน</div>
              <div>2) สามารถจับประเด็นสำคัญ ลำดับเหตุการณ์จากการอ่านที่มีความซับซ้อน</div>
              <div>3) สามารถวิเคราะห์สิ่งที่ผู้เขียนต้องการสื่อสารกับผู้อ่านและสามารถวิพากษ์ให้ข้อเสนอแนะในแง่มุมต่างๆ ได้</div>
              <div>4) สามารถประเมินความน่าเชื่อถือ คุณค่า แนวคิดที่ได้จากการอ่านอย่างหลากหลาย</div>
              <div>5) สามารถเขียนแสดงความคิดเห็น โต้แย้ง สรุป โดยมีข้อมูลอธิบายสนับสนุนอย่างเพียงพอและสมเหตุสมผล</div>
              <div style={{ marginTop: 3 }}><b>เกณฑ์การประเมิน (4 ระดับ):</b> ระดับ 3 = ดีเยี่ยม · ระดับ 2 = ดี · ระดับ 1 = ผ่าน · ระดับ 0 = ไม่ผ่าน</div>
            </div>
          </div>
        </div>
      )}

      <style>{PP5_PRINT_STYLES}</style>
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
