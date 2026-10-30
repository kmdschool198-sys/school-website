import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { TIMETABLE_BACKUP } from '../data/timetableData';
import { useSchoolRoster } from '../utils/useSchoolRoster';
import { SCHOOL_NAME, SCHOOL_AFFILIATION } from '../config/siteLinks';
import {
  Printer, Save, AlertTriangle, X, Users, BookOpen, Calendar as Cal,
  Coffee, UserPlus, Download, Upload, RotateCcw, Database, CloudOff,
  ArrowLeftRight, Sparkles, CheckCircle2, Clock, Grid, Trash2,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────
interface Teacher {
  id: string;
  prefix?: string;
  first: string;
  last: string;
  dept?: string;
  rank?: string;
  subjects?: string[];
}
interface Subject {
  id: string;
  name: string;
  code?: string;
  dept?: string;
  hours?: number;
  color?: string;
}
interface Room {
  id: string;
  level?: string;
  grade: string;
  room?: string;
  homeroom?: string;
  label: string;
}
interface Slot {
  id: number;
  label: string;
  start: string;
  end: string;
}
interface SchedCell {
  subject?: string;
  teacher?: string;
  substitute?: string;
  free?: boolean;
}
interface School {
  name: string;
  year?: string;
  semester?: string;
  principalName?: string;
  principalPos?: string;
  acadName?: string;
  acadPos?: string;
}
interface DailySubPeriod {
  slotId: number;
  roomId: string;
  day: string;
  subject: string;
  subTeacher: string;
  note?: string;
}
interface DailyAbsentEntry {
  teacherId: string;
  teacherName?: string;
  reason?: string;
  periods: DailySubPeriod[];
}
interface DailySubRecord {
  absentList: DailyAbsentEntry[];
  updatedAt?: string;
}
interface TTData {
  school: School;
  teachers: Teacher[];
  subjects: Subject[];
  rooms: Room[];
  slots: Slot[];
  days: string[];
  sched: Record<string, SchedCell>;
  substitute?: Record<string, DailySubRecord>;
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const seedData = (): TTData => {
  const profile = (TIMETABLE_BACKUP as any).profiles[Object.keys((TIMETABLE_BACKUP as any).profiles)[0]];
  return JSON.parse(JSON.stringify(profile.data)) as TTData;
};

const SEP = '_';
const cellKey = (roomId: string, slot: number, day: string) => `${roomId}${SEP}${slot}${SEP}${day}`;

const parseKey = (key: string): [string, string, string] => {
  const parts = key.split('_');
  const day = parts.pop()!;
  const slot = parts.pop()!;
  return [parts.join('_'), slot, day];
};

const teacherName = (t?: Teacher) => (t ? `${t.prefix || ''}${t.first} ${t.last}`.trim() : '');

const getEffectiveTeacher = (cell?: SchedCell): string => {
  if (!cell || cell.free) return '';
  if (cell.teacher && cell.teacher.trim()) return cell.teacher.trim();
  if (cell.subject === 'กิจกรรมแนะแนว' || cell.subject === 'ตลาดนัดอาชีพ') {
    return 'ครูที่ปรึกษา';
  }
  return '';
};

const colorFor = (subjectName: string, subjects: Subject[]) =>
  subjects.find(s => s.name === subjectName)?.color || '#F8FAFC';

const FREE_LABEL = 'คาบว่าง';

const SCHOOL_ACTIVITIES_MAP: Record<string, string> = {
  [`6${SEP}จันทร์`]: 'กิจกรรมแนะแนว',
  [`8${SEP}พุธ`]: 'ลูกเสือ/เนตรนารี',
  [`8${SEP}พฤหัสบดี`]: 'ชุมนุม',
  [`6${SEP}ศุกร์`]: 'ตลาดนัดอาชีพ',
  [`7${SEP}ศุกร์`]: 'ตลาดนัดอาชีพ',
  [`8${SEP}ศุกร์`]: 'สวดมนต์',
};

const SHARED_ACTIVITY_NAMES = new Set([
  'กิจกรรมแนะแนว',
  'ลูกเสือ/เนตรนารี',
  'ลูกเสือ / เนตรนารี',
  'ชุมนุม',
  'กิจกรรมชุมนุม',
  'ตลาดนัดอาชีพ',
  'สวดมนต์',
  'สวดมนต์ / กิจกรรมคุณธรรม',
]);

const LEAVE_REASONS = [
  'ไปราชการ / อบรม',
  'ลาป่วย',
  'ลากิจส่วนตัว',
  'ติดภารกิจโรงเรียน',
];

function getTodayIso(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getThaiWeekdayFromDate(dateStr: string, validDays: string[]): string {
  if (!dateStr) return validDays[0] || 'จันทร์';
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return validDays[0] || 'จันทร์';
  const jsDay = new Date(y, m - 1, d).getDay(); // 0=Sun, 1=Mon..5=Fri, 6=Sat
  const map: Record<number, string> = {
    1: 'จันทร์',
    2: 'อังคาร',
    3: 'พุธ',
    4: 'พฤหัสบดี',
    5: 'ศุกร์',
  };
  return map[jsDay] || 'จันทร์';
}

function formatThaiFullDate(dateStr: string): string {
  if (!dateStr) return '-';
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  const dateObj = new Date(y, m - 1, d);
  return dateObj.toLocaleDateString('th-TH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// ─── Main component ─────────────────────────────────────────────────────────
type View = 'class' | 'teacher' | 'master' | 'sub' | 'overview' | 'data';
type CloudStatus = 'connecting' | 'ready' | 'missing' | 'saving' | 'error';

export default function TimetableSmart({ readOnly = false }: { readOnly?: boolean }) {
  const { classes: rosterClasses } = useSchoolRoster();
  const getClassRoster = (label: string) =>
    rosterClasses.find(c => c.label === label || c.shortClass === label);
  const [data, setData] = useState<TTData>(() => seedData());
  const [view, setView] = useState<View>('class');
  const [activeRoom, setActiveRoom] = useState<string>('');
  const [activeTeacher, setActiveTeacher] = useState<string>('');
  const [masterDay, setMasterDay] = useState<string>('จันทร์');
  const [editing, setEditing] = useState<{ roomId: string; slot: number; day: string } | null>(null);
  const [swapMode, setSwapMode] = useState<boolean>(false);
  const [swapSource, setSwapSource] = useState<{ roomId: string; slot: number; day: string } | null>(null);
  const [search, setSearch] = useState('');
  const [, setSavedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>('connecting');
  const [, setCloudError] = useState('');
  const [toastMsg, setToastMsg] = useState<string>('');

  // Substitute Wizard States
  const [subDate, setSubDate] = useState<string>(() => getTodayIso());
  const [subWeekday, setSubWeekday] = useState<string>(() => getThaiWeekdayFromDate(getTodayIso(), ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์']));
  const [subAbsentTeacherId, setSubAbsentTeacherId] = useState<string>('');
  const [subReason, setSubReason] = useState<string>(LEAVE_REASONS[0]);
  const [draftSubMap, setDraftSubMap] = useState<Record<string, string>>({}); // key: `${roomId}_${slotId}` -> subTeacherName

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(prev => (prev === msg ? '' : prev)), 3500);
  };

  // Sync weekday when subDate changes
  useEffect(() => {
    const wd = getThaiWeekdayFromDate(subDate, data.days);
    setSubWeekday(wd);
  }, [subDate, data.days]);

  // When in readOnly (Student View), restrict view to 'class' or 'teacher'
  useEffect(() => {
    if (readOnly && view !== 'class' && view !== 'teacher') {
      setView('class');
    }
  }, [readOnly, view]);

  // Firestore listener
  useEffect(() => {
    return onSnapshot(
      doc(db, 'config', 'timetable'),
      snap => {
        if (snap.exists()) {
          const d = snap.data() as TTData;
          if (d.rooms?.length && d.teachers && d.subjects && d.slots && d.days && d.sched) {
            setData(d);
            setDirty(false);
            setCloudStatus('ready');
            setCloudError('');
            const updatedAt = (snap.data() as any).updatedAt;
            if (updatedAt?.toDate) setSavedAt(updatedAt.toDate());
          } else {
            setCloudStatus('error');
            setCloudError('ข้อมูลตารางกลางมีรูปแบบไม่ครบ กรุณานำเข้าไฟล์สำรอง');
          }
        } else {
          setCloudStatus('missing');
        }
      },
      error => {
        console.error('Timetable snapshot error:', error);
        setCloudStatus('error');
        setCloudError('เชื่อมต่อฐานข้อมูลกลางไม่ได้ ระบบกำลังแสดงข้อมูลสำรองในเครื่อง');
      }
    );
  }, []);

  useEffect(() => {
    const warnUnsaved = (event: BeforeUnloadEvent) => {
      if (!dirty || readOnly) return;
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warnUnsaved);
    return () => window.removeEventListener('beforeunload', warnUnsaved);
  }, [dirty, readOnly]);

  useEffect(() => {
    if (!activeRoom && data.rooms.length) setActiveRoom(data.rooms[0].id);
    if (!activeTeacher && data.teachers.length) setActiveTeacher(teacherName(data.teachers[0]));
    if (!subAbsentTeacherId && data.teachers.length) setSubAbsentTeacherId(data.teachers[0].id);
  }, [data.rooms, data.teachers, activeRoom, activeTeacher, subAbsentTeacherId]);

  const saveToCloud = async (customData?: TTData) => {
    if (readOnly) return;
    const payload = customData || data;
    setLoading(true);
    setCloudStatus('saving');
    setCloudError('');
    try {
      const cleanData = JSON.parse(JSON.stringify(payload)) as TTData;
      const writePromise = setDoc(doc(db, 'config', 'timetable'), {
        ...cleanData,
        schemaVersion: 1,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.email || null,
      });
      const timeoutPromise = new Promise<'offline_cached'>(resolve => setTimeout(() => resolve('offline_cached'), 1800));
      const res = await Promise.race([writePromise.then(() => 'synced' as const), timeoutPromise]);

      setSavedAt(new Date());
      setDirty(false);
      setCloudStatus('ready');
      if (res === 'offline_cached') {
        showToast('📴 บันทึกตารางสอนลงเครื่องแล้ว (ระบบจะซิงค์ขึ้นระบบกลางอัตโนมัติเมื่อมีสัญญาณอินเทอร์เน็ต)');
      } else {
        showToast('✅ บันทึกตารางสอนและการสอนแทนขึ้นระบบกลางเรียบร้อยแล้ว');
      }
    } catch (e: any) {
      setCloudStatus('error');
      setCloudError('บันทึกไม่สำเร็จ กรุณาตรวจสอบสิทธิ์ผู้ใช้และอินเทอร์เน็ต');
      alert('❌ บันทึกไม่สำเร็จ: ' + (e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timetable_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        const d: TTData = parsed.profiles
          ? parsed.profiles[Object.keys(parsed.profiles)[0]].data
          : parsed;
        if (!d.rooms || !d.teachers) throw new Error('โครงสร้างไฟล์ไม่ถูกต้อง');
        if (!confirm(`โหลดข้อมูลจากไฟล์? (${d.rooms.length} ห้อง, ${d.teachers.length} ครู — ของเดิมจะถูกแทนที่)`)) return;
        setData(d);
        setDirty(true);
        showToast('📂 นำเข้าข้อมูลตารางสอนสำเร็จ กรุณากด "บันทึกการแก้ไข" เพื่ออัปเดตขึ้นคลาวด์');
      } catch (e: any) {
        alert('❌ อ่านไฟล์ไม่สำเร็จ: ' + (e?.message || e));
      }
    };
    reader.readAsText(file);
  };

  const resetToSeed = () => {
    if (!confirm('รีเซ็ตตารางสอนกลับเป็นค่ามาตรฐานเทอม 2/2569? (ควร Export สำรองไว้ก่อนหากมีการแก้ไขสำคัญ)')) return;
    setData(seedData());
    setDirty(true);
    showToast('🔄 รีเซ็ตเป็นตารางมาตรฐานแล้ว กรุณากด "บันทึกการแก้ไข" หากต้องการยืนยัน');
  };

  const updateCell = (key: string, val: SchedCell | null) => {
    setDirty(true);
    setData(d => {
      const sched = { ...d.sched };
      if (!val || (!val.subject && !val.teacher && !val.substitute && !val.free)) delete sched[key];
      else sched[key] = val;
      return { ...d, sched };
    });
  };

  // Swap two cells in 1 click
  const handleCellAction = (roomId: string, slot: number, day: string) => {
    if (readOnly) return;
    if (!swapMode) {
      setEditing({ roomId, slot, day });
      return;
    }
    if (!swapSource) {
      setSwapSource({ roomId, slot, day });
      return;
    }
    // If clicking same cell, cancel source
    if (swapSource.roomId === roomId && swapSource.slot === slot && swapSource.day === day) {
      setSwapSource(null);
      return;
    }
    // Perform swap
    const k1 = cellKey(swapSource.roomId, swapSource.slot, swapSource.day);
    const k2 = cellKey(roomId, slot, day);
    const c1 = data.sched[k1] ? { ...data.sched[k1] } : undefined;
    const c2 = data.sched[k2] ? { ...data.sched[k2] } : undefined;

    setDirty(true);
    setData(d => {
      const sched = { ...d.sched };
      if (c2) sched[k1] = c2;
      else delete sched[k1];
      if (c1) sched[k2] = c1;
      else delete sched[k2];
      return { ...d, sched };
    });
    const r1 = data.rooms.find(r => r.id === swapSource.roomId)?.label || '';
    const r2 = data.rooms.find(r => r.id === roomId)?.label || '';
    const s1 = data.slots.find(s => s.id === swapSource.slot)?.label || '';
    const s2 = data.slots.find(s => s.id === slot)?.label || '';
    showToast(`🔄 สลับคาบเรียนสำเร็จ: [${r1} ${swapSource.day} ${s1}] ↔ [${r2} ${day} ${s2}]`);
    setSwapSource(null);
  };

  // ─── Conflict detection & Teacher busy map ──────────────────────────────
  const { conflictCells, conflictGroups, conflictDetails, teacherSlotMap, teacherWeeklyLoad } = useMemo(() => {
    const map: Record<string, { rooms: string[]; slot: string; day: string; teacher: string }> = {};
    // teacherSlotMap[`${teacherName}_${slot}_${day}`] = { roomId, roomLabel, subject, isSub }
    const tSlotMap: Record<string, { roomId: string; roomLabel: string; subject: string; isSub: boolean }[]> = {};
    const weeklyLoad: Record<string, { main: number; sub: number }> = {};

    Object.entries(data.sched).forEach(([key, cell]) => {
      if (cell.free) return;
      const [roomId, slot, day] = parseKey(key);
      const roomLabel = data.rooms.find(r => r.id === roomId)?.label || roomId;

      const effT = getEffectiveTeacher(cell);
      if (effT && !cell.substitute && effT !== 'ครูที่ปรึกษา') {
        weeklyLoad[effT] = weeklyLoad[effT] || { main: 0, sub: 0 };
        weeklyLoad[effT].main++;
      }
      if (cell.substitute) {
        weeklyLoad[cell.substitute] = weeklyLoad[cell.substitute] || { main: 0, sub: 0 };
        weeklyLoad[cell.substitute].sub++;
      }

      const activeT = cell.substitute || effT;
      if (!activeT || activeT === 'ครูที่ปรึกษา') return;

      const k = `${activeT}${SEP}${slot}${SEP}${day}`;
      if (!map[k]) map[k] = { rooms: [], slot, day, teacher: activeT };
      map[k].rooms.push(roomId);

      if (!tSlotMap[k]) tSlotMap[k] = [];
      tSlotMap[k].push({
        roomId,
        roomLabel,
        subject: cell.subject || '-',
        isSub: !!cell.substitute,
      });
    });

    const cells = new Set<string>();
    const details: { teacher: string; day: string; slotLabel: string; roomLabels: string[] }[] = [];
    let groups = 0;

    Object.values(map).forEach(({ rooms, slot, day, teacher }) => {
      if (rooms.length > 1) {
        groups++;
        rooms.forEach(r => cells.add(cellKey(r, +slot, day)));
        const slotLabel = data.slots.find(s => s.id === +slot)?.label || `คาบ ${slot}`;
        const roomLabels = rooms.map(rid => data.rooms.find(r => r.id === rid)?.label || rid);
        details.push({ teacher, day, slotLabel, roomLabels });
      }
    });

    return {
      conflictCells: cells,
      conflictGroups: groups,
      conflictDetails: details,
      teacherSlotMap: tSlotMap,
      teacherWeeklyLoad: weeklyLoad,
    };
  }, [data.sched, data.rooms, data.slots]);

  // ─── Stats ──────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const totalCells = data.rooms.length * data.slots.length * data.days.length;
    const cells = Object.values(data.sched);
    const filled = cells.filter(c => c.subject || c.teacher || c.free).length;
    const free = cells.filter(c => c.free).length;
    const standingSubs = cells.filter(c => c.substitute).length;

    let dailySubsCount = 0;
    if (data.substitute) {
      Object.values(data.substitute).forEach(rec => {
        rec?.absentList?.forEach(ab => {
          ab?.periods?.forEach(p => {
            if (p.subTeacher) dailySubsCount++;
          });
        });
      });
    }

    return {
      teachers: data.teachers.length,
      subjects: data.subjects.length,
      rooms: data.rooms.length,
      filled,
      totalCells,
      free,
      subs: standingSubs + dailySubsCount,
      pct: totalCells ? Math.round((filled / totalCells) * 100) : 0,
      conflicts: conflictGroups,
    };
  }, [data, conflictGroups]);

  // ─── Daily Substitute Wizard Logic ──────────────────────────────────────
  const selectedAbsentTeacher = useMemo(
    () => data.teachers.find(t => t.id === subAbsentTeacherId),
    [data.teachers, subAbsentTeacherId]
  );
  const selectedAbsentName = useMemo(
    () => teacherName(selectedAbsentTeacher),
    [selectedAbsentTeacher]
  );

  // Periods that the absent teacher teaches on `subWeekday`
  const absentTeacherPeriods = useMemo(() => {
    if (!selectedAbsentName || !subWeekday) return [];
    const list: {
      slot: Slot;
      room: Room;
      subject: string;
      cellKeyStr: string;
    }[] = [];

    data.slots.forEach(slot => {
      data.rooms.forEach(room => {
        const k = cellKey(room.id, slot.id, subWeekday);
        const cell = data.sched[k];
        if (!cell || cell.free) return;
        if (cell.teacher === selectedAbsentName) {
          list.push({
            slot,
            room,
            subject: cell.subject || '-',
            cellKeyStr: k,
          });
        }
      });
    });

    return list.sort((a, b) => a.slot.id - b.slot.id);
  }, [selectedAbsentName, subWeekday, data.slots, data.rooms, data.sched]);

  // Load existing saved daily sub assignments when date / absent teacher changes
  useEffect(() => {
    const dailyRec = data.substitute?.[subDate];
    const existingEntry = dailyRec?.absentList?.find(a => a.teacherId === subAbsentTeacherId);
    const nextDraft: Record<string, string> = {};
    if (existingEntry) {
      if (existingEntry.reason) setSubReason(existingEntry.reason);
      existingEntry.periods?.forEach(p => {
        if (p.subTeacher) {
          nextDraft[`${p.roomId}_${p.slotId}`] = p.subTeacher;
        }
      });
    }
    setDraftSubMap(nextDraft);
  }, [subDate, subAbsentTeacherId, data.substitute]);

  // Helper: Find available free teachers for a given (day, slotId)
  const getAvailableTeachersForSlot = (day: string, slotId: number, excludeTeacherName: string) => {
    // Also check who is already absent on `subDate` or already assigned as substitute in another room at the same slotId on `subDate`
    const dailyRec = data.substitute?.[subDate];
    const absentIdsOnDate = new Set<string>(
      (dailyRec?.absentList || []).map(a => a.teacherId)
    );
    absentIdsOnDate.add(subAbsentTeacherId);

    const alreadySubbingAtSlot = new Set<string>();
    (dailyRec?.absentList || []).forEach(a => {
      if (a.teacherId === subAbsentTeacherId) return;
      a.periods?.forEach(p => {
        if (p.slotId === slotId && p.subTeacher) {
          alreadySubbingAtSlot.add(p.subTeacher);
        }
      });
    });

    // Count how many periods each teacher teaches on `day`
    const dayLoadMap: Record<string, number> = {};
    data.teachers.forEach(t => {
      const tName = teacherName(t);
      let count = 0;
      data.slots.forEach(s => {
        const busy = teacherSlotMap[`${tName}${SEP}${s.id}${SEP}${day}`];
        if (busy && busy.length > 0) count++;
      });
      dayLoadMap[tName] = count;
    });

    return data.teachers
      .map(t => {
        const name = teacherName(t);
        const isSelf = name === excludeTeacherName || absentIdsOnDate.has(t.id);
        const isPhattaraOff = name.includes('ภัทรสุดา') && (day === 'พฤหัสบดี' || day === 'ศุกร์');
        const busyList = teacherSlotMap[`${name}${SEP}${slotId}${SEP}${day}`] || [];
        const isSubbingOther = alreadySubbingAtSlot.has(name);
        const dayPeriods = dayLoadMap[name] || 0;
        const weekPeriods = (teacherWeeklyLoad[name]?.main || 0) + (teacherWeeklyLoad[name]?.sub || 0);

        const isFree = !isSelf && !isPhattaraOff && busyList.length === 0 && !isSubbingOther;
        return {
          teacher: t,
          name,
          isSelf,
          isPhattaraOff,
          busyList,
          isSubbingOther,
          isFree,
          dayPeriods,
          weekPeriods,
        };
      })
      .sort((a, b) => {
        if (a.isFree !== b.isFree) return a.isFree ? -1 : 1;
        if (a.dayPeriods !== b.dayPeriods) return a.dayPeriods - b.dayPeriods;
        return a.weekPeriods - b.weekPeriods;
      });
  };

  // 1-Click Auto Assign Smart Substitute for all periods of the absent teacher
  const autoAssignDailySubs = () => {
    if (absentTeacherPeriods.length === 0) return;
    const tempDraft: Record<string, string> = {};
    const assignedCountInDraft: Record<string, number> = {};

    absentTeacherPeriods.forEach(item => {
      const candidates = getAvailableTeachersForSlot(subWeekday, item.slot.id, selectedAbsentName)
        .filter(c => c.isFree);

      if (candidates.length > 0) {
        // Sort by (dayPeriods + already assigned in this draft) so workload is distributed evenly!
        candidates.sort((a, b) => {
          const loadA = a.dayPeriods + (assignedCountInDraft[a.name] || 0);
          const loadB = b.dayPeriods + (assignedCountInDraft[b.name] || 0);
          if (loadA !== loadB) return loadA - loadB;
          return a.weekPeriods - b.weekPeriods;
        });
        const chosen = candidates[0].name;
        tempDraft[`${item.room.id}_${item.slot.id}`] = chosen;
        assignedCountInDraft[chosen] = (assignedCountInDraft[chosen] || 0) + 1;
      }
    });

    setDraftSubMap(tempDraft);
    showToast(`⚡ จัดครูสอนแทนอัตฉริยะครบ ${Object.keys(tempDraft).length} คาบเรียบร้อย! กด "บันทึกใบจัดสอนแทน" เพื่อยืนยัน`);
  };

  // Save Daily Substitute Record into `data.substitute[subDate]`
  const saveDailySubAssignment = async () => {
    if (!subAbsentTeacherId || absentTeacherPeriods.length === 0) return;
    const periodsPayload: DailySubPeriod[] = absentTeacherPeriods.map(item => ({
      slotId: item.slot.id,
      roomId: item.room.id,
      day: subWeekday,
      subject: item.subject,
      subTeacher: draftSubMap[`${item.room.id}_${item.slot.id}`] || '',
    })).filter(p => p.subTeacher);

    if (periodsPayload.length === 0) {
      alert('กรุณาเลือกครูสอนแทนอย่างน้อย 1 คาบ หรือกดปุ่ม "⚡ จัดครูสอนแทนอัตโนมัติ"');
      return;
    }

    const nextSub = { ...(data.substitute || {}) };
    const dayRecord: DailySubRecord = nextSub[subDate]
      ? JSON.parse(JSON.stringify(nextSub[subDate]))
      : { absentList: [] };

    const existingIdx = dayRecord.absentList.findIndex(a => a.teacherId === subAbsentTeacherId);
    const entry: DailyAbsentEntry = {
      teacherId: subAbsentTeacherId,
      teacherName: selectedAbsentName,
      reason: subReason,
      periods: periodsPayload,
    };

    if (existingIdx >= 0) {
      dayRecord.absentList[existingIdx] = entry;
    } else {
      dayRecord.absentList.push(entry);
    }
    dayRecord.updatedAt = new Date().toISOString();
    nextSub[subDate] = dayRecord;

    const nextData: TTData = { ...data, substitute: nextSub };
    setData(nextData);
    setDirty(true);
    await saveToCloud(nextData);
  };

  const removeDailyAbsentEntry = async (dateStr: string, teacherId: string) => {
    if (!confirm('ต้องการลบรายการจัดสอนแทนนี้ใช่หรือไม่?')) return;
    const nextSub = { ...(data.substitute || {}) };
    if (!nextSub[dateStr]) return;
    const filtered = (nextSub[dateStr].absentList || []).filter(a => a.teacherId !== teacherId);
    if (filtered.length === 0) {
      delete nextSub[dateStr];
    } else {
      nextSub[dateStr] = { ...nextSub[dateStr], absentList: filtered };
    }
    const nextData: TTData = { ...data, substitute: nextSub };
    setData(nextData);
    setDirty(true);
    await saveToCloud(nextData);
  };

  // ─── Render Class Grid ──────────────────────────────────────────────────
  const renderClassGrid = () => {
    const room = data.rooms.find(r => r.id === activeRoom);
    if (!room) return <div className="text-muted">เลือกห้องเรียนก่อน</div>;
    const roomRoster = getClassRoster(room.label);

    return (
      <div>
        {/* Room Quick Switcher Pills */}
        <div className="tt-no-print" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {data.rooms.map(r => {
            const count = getClassRoster(r.label)?.totalCount || 0;
            const isSel = r.id === activeRoom;
            return (
              <button
                key={r.id}
                onClick={() => setActiveRoom(r.id)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 12,
                  border: isSel ? '2px solid #EA580C' : '1px solid #E2E8F0',
                  background: isSel ? 'linear-gradient(135deg,#EA580C,#F97316)' : 'white',
                  color: isSel ? 'white' : '#1E293B',
                  fontWeight: 800,
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  boxShadow: isSel ? '0 4px 12px rgba(234,88,12,0.25)' : 'none',
                }}
              >
                <span>🏫 {r.label}</span>
                <span style={{
                  fontSize: '0.7rem',
                  padding: '1px 6px',
                  borderRadius: 99,
                  background: isSel ? 'rgba(255,255,255,0.22)' : '#F1F5F9',
                  color: isSel ? 'white' : '#64748B',
                }}>
                  {count} คน
                </span>
              </button>
            );
          })}
        </div>

        {/* Selected Room Info Bar */}
        <div className="tt-no-print" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10,
          background: 'white', padding: '10px 16px', borderRadius: 12, border: '1px solid #E2E8F0', marginBottom: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 900, fontSize: '1rem', color: '#0F172A' }}>
              ตารางเรียนชั้น {room.label} ({room.level})
            </span>
            {roomRoster && (
              <span style={{ fontSize: '0.8rem', color: '#047857', background: '#ECFDF5', padding: '3px 10px', borderRadius: 99, fontWeight: 700 }}>
                👨‍🎓 นักเรียนจริง {roomRoster.totalCount} คน (ชาย {roomRoster.maleCount} / หญิง {roomRoster.femaleCount}) · ครูประจำชั้น: {roomRoster.homeroomTeacher}
              </span>
            )}
          </div>
          {!readOnly && (
            <div style={{ fontSize: '0.78rem', color: swapMode ? '#1D4ED8' : '#64748B', fontWeight: 700 }}>
              {swapMode
                ? (swapSource ? '👉 คลิกช่องปลายทางที่ต้องการสลับคาบเรียน' : '🔄 โหมดสลับคาบ: คลิกช่องต้นทางช่องที่ 1')
                : '💡 คลิกที่ช่องคาบเรียนเพื่อแก้ไขวิชา/ครู หรือเปิด "โหมดสลับคาบ" ด้านบน'}
            </div>
          )}
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: 760, background: 'white', borderRadius: 14, overflow: 'hidden', border: '1px solid #CBD5E1' }}>
            <thead>
              <tr>
                <th style={{ ...th, width: 125 }}>คาบ / เวลา</th>
                {data.days.map(d => (
                  <th key={d} style={{ ...th, width: `${100 / data.days.length}%`, textAlign: 'center' }}>
                    วัน{d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.slots.map(slot => (
                <React.Fragment key={slot.id}>
                  {/* Insert Lunch Break Row right before Afternoon Period 5 (slot.id === 6) */}
                  {slot.id === 6 && (
                    <tr>
                      <td style={{ ...td, background: '#FEF3C7', fontWeight: 800, color: '#92400E', textAlign: 'center', padding: '6px 8px' }}>
                        <div style={{ fontSize: '0.78rem' }}>พักกลางวัน</div>
                        <div style={{ fontSize: '0.68rem', color: '#B45309' }}>11:50 - 13:00</div>
                      </td>
                      <td colSpan={data.days.length} style={{
                        background: '#FFFBEB', color: '#B45309', fontWeight: 800, fontSize: '0.8rem',
                        textAlign: 'center', padding: '6px', border: '1px solid #FDE68A', letterSpacing: '0.03em',
                      }}>
                        🍱 พักรับประทานอาหารกลางวัน และกิจกรรมทำเวรประจำวัน (11:50 – 13:00 น.)
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td style={{ ...td, background: '#F8FAFC', fontWeight: 800, color: '#1E293B', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.85rem', color: '#0F172A' }}>{slot.label}</div>
                      <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600 }}>{slot.start} – {slot.end}</div>
                    </td>
                    {data.days.map(day => {
                      const k = cellKey(room.id, slot.id, day);
                      const cell = data.sched[k];
                      const conflict = conflictCells.has(k);
                      const isSwapSelected =
                        swapSource?.roomId === room.id &&
                        swapSource?.slot === slot.id &&
                        swapSource?.day === day;
                      const isSharedAct = cell?.subject && SHARED_ACTIVITY_NAMES.has(cell.subject);

                      return (
                        <td
                          key={day}
                          onClick={() => handleCellAction(room.id, slot.id, day)}
                          style={{
                            ...td,
                            padding: '8px 10px',
                            background: isSwapSelected
                              ? '#DBEAFE'
                              : cell?.free
                              ? '#F1F5F9'
                              : isSharedAct
                              ? '#FEF3C7'
                              : cell?.subject
                              ? colorFor(cell.subject, data.subjects)
                              : 'white',
                            cursor: readOnly ? 'default' : 'pointer',
                            position: 'relative',
                            border: isSwapSelected
                              ? '2.5px dashed #2563EB'
                              : conflict
                              ? '2px solid #EF4444'
                              : '1px solid #E2E8F0',
                            opacity: cell?.free ? 0.75 : 1,
                            transition: 'all 0.12s ease',
                          }}
                        >
                          {cell?.free && (
                            <div style={{ fontWeight: 800, color: '#64748B', fontSize: '0.84rem' }}>
                              ☕ {FREE_LABEL}
                            </div>
                          )}
                          {!cell?.free && cell?.subject && (
                            <div style={{ fontWeight: 800, fontSize: '0.86rem', color: isSharedAct ? '#92400E' : '#0F172A', lineHeight: 1.3 }}>
                              {isSharedAct ? `⭐ ${cell.subject}` : cell.subject}
                            </div>
                          )}
                          {!cell?.free && (() => {
                            const effT = getEffectiveTeacher(cell);
                            if (!effT) return null;
                            return (
                              <div style={{
                                fontSize: '0.74rem',
                                color: cell?.substitute ? '#94A3B8' : '#334155',
                                marginTop: 4,
                                fontWeight: 600,
                                textDecoration: cell?.substitute ? 'line-through' : 'none',
                              }}>
                                👤 {effT}
                              </div>
                            );
                          })()}
                          {cell?.substitute && (
                            <div style={{
                              fontSize: '0.72rem', color: '#6D28D9', background: '#EDE9FE',
                              padding: '2px 6px', borderRadius: 6, marginTop: 4, fontWeight: 800, display: 'inline-block',
                            }}>
                              🔁 แทน: {cell.substitute}
                            </div>
                          )}
                          {!cell?.free && !cell?.subject && !readOnly && (
                            <div className="tt-no-print" style={{ fontSize: '0.72rem', color: '#CBD5E1', textAlign: 'center', padding: '8px 0' }}>
                              + คลิกเพื่มวิชา
                            </div>
                          )}
                          {conflict && (
                            <span
                              style={{
                                position: 'absolute', top: 4, right: 4,
                                background: '#FEE2E2', color: '#DC2626',
                                borderRadius: 99, padding: '2px 6px', fontSize: '0.66rem', fontWeight: 800,
                                display: 'inline-flex', alignItems: 'center', gap: 3,
                              }}
                              title="ครูซ้ำคาบในเวลาเดียวกัน"
                            >
                              <AlertTriangle size={11} /> ซ้ำคาบ
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ─── Render Teacher Grid (Interactive!) ─────────────────────────────────
  const renderTeacherGrid = () => {
    if (!activeTeacher) return <div className="text-muted">เลือกครูก่อน</div>;
    type Mark = 'main' | 'sub' | 'covered';
    const tSched: Record<string, { room: Room; cell: SchedCell; mark: Mark }> = {};

    Object.entries(data.sched).forEach(([key, cell]) => {
      if (cell.free) return;
      let mark: Mark | null = null;
      if (cell.substitute === activeTeacher) mark = 'sub';
      else if (cell.teacher === activeTeacher && !cell.substitute) mark = 'main';
      else if (cell.teacher === activeTeacher && cell.substitute) mark = 'covered';
      if (!mark) return;
      const [roomId, slot, day] = parseKey(key);
      const room = data.rooms.find(r => r.id === roomId);
      if (room) tSched[`${slot}${SEP}${day}`] = { room, cell, mark };
    });

    const teacherObj = data.teachers.find(t => teacherName(t) === activeTeacher);
    const totalLoad = (teacherWeeklyLoad[activeTeacher]?.main || 0) + (teacherWeeklyLoad[activeTeacher]?.sub || 0);

    return (
      <div>
        {/* Quick Teacher Pills */}
        <div className="tt-no-print" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {data.teachers.map(t => {
            const name = teacherName(t);
            const isSel = name === activeTeacher;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTeacher(name)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 10,
                  border: isSel ? '2px solid #2563EB' : '1px solid #E2E8F0',
                  background: isSel ? 'linear-gradient(135deg,#1D4ED8,#2563EB)' : 'white',
                  color: isSel ? 'white' : '#1E293B',
                  fontWeight: 800,
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  boxShadow: isSel ? '0 4px 12px rgba(37,99,235,0.25)' : 'none',
                }}
              >
                <span>{t.first}</span>
              </button>
            );
          })}
        </div>

        {/* Teacher Summary Header */}
        <div className="tt-no-print" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10,
          background: 'white', padding: '12px 16px', borderRadius: 12, border: '1px solid #E2E8F0', marginBottom: 12,
        }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: '1.02rem', color: '#0F172A' }}>
              👨‍🏫 ตารางสอนรายบุคคล: {activeTeacher}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: 2 }}>
              ตำแหน่ง: {teacherObj?.rank || 'ครู'} · กลุ่มสาระฯ: {teacherObj?.dept || '-'}
              {!readOnly && (
                <> · รวมภาระงานสอน <strong>{totalLoad} คาบ/สัปดาห์</strong></>
              )}
            </div>
          </div>
          {!readOnly && (
            <button
              onClick={() => {
                if (teacherObj) {
                  setSubAbsentTeacherId(teacherObj.id);
                  setView('sub');
                }
              }}
              style={{
                padding: '8px 14px', borderRadius: 10, border: '1px solid #DDD6FE',
                background: '#F5F3FF', color: '#6D28D9', fontWeight: 800, fontSize: '0.8rem',
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              <UserPlus size={15} /> จัดคนสอนแทนครูท่านนี้
            </button>
          )}
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: 760, background: 'white', borderRadius: 14, overflow: 'hidden', border: '1px solid #CBD5E1' }}>
            <thead>
              <tr>
                <th style={{ ...th, width: 125 }}>คาบ / เวลา</th>
                {data.days.map(d => (
                  <th key={d} style={{ ...th, width: `${100 / data.days.length}%`, textAlign: 'center' }}>
                    วัน{d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.slots.map(slot => (
                <React.Fragment key={slot.id}>
                  {slot.id === 6 && (
                    <tr>
                      <td style={{ ...td, background: '#FEF3C7', fontWeight: 800, color: '#92400E', textAlign: 'center', padding: '6px 8px' }}>
                        <div style={{ fontSize: '0.78rem' }}>พักกลางวัน</div>
                        <div style={{ fontSize: '0.68rem', color: '#B45309' }}>11:50 - 13:00</div>
                      </td>
                      <td colSpan={data.days.length} style={{
                        background: '#FFFBEB', color: '#B45309', fontWeight: 800, fontSize: '0.8rem',
                        textAlign: 'center', padding: '6px', border: '1px solid #FDE68A',
                      }}>
                        🍱 พักรับประทานอาหารกลางวัน (11:50 – 13:00 น.)
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td style={{ ...td, background: '#F8FAFC', fontWeight: 800, color: '#1E293B', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.85rem', color: '#0F172A' }}>{slot.label}</div>
                      <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600 }}>{slot.start} – {slot.end}</div>
                    </td>
                    {data.days.map(day => {
                      const entry = tSched[`${slot.id}${SEP}${day}`];
                      const covered = entry?.mark === 'covered';
                      const isPhattaraOff = activeTeacher.includes('ภัทรสุดา') && (day === 'พฤหัสบดี' || day === 'ศุกร์');
                      const schoolAct = !isPhattaraOff ? SCHOOL_ACTIVITIES_MAP[`${slot.id}${SEP}${day}`] : null;

                      return (
                        <td
                          key={day}
                          onClick={() => {
                            if (readOnly) return;
                            if (entry) {
                              setEditing({ roomId: entry.room.id, slot: slot.id, day });
                            }
                          }}
                          style={{
                            ...td,
                            background: entry
                              ? covered
                                ? '#FEF3C7'
                                : colorFor(entry.cell.subject || '', data.subjects)
                              : isPhattaraOff
                              ? '#F1F5F9'
                              : schoolAct
                              ? '#FFFBEB'
                              : 'white',
                            cursor: !readOnly && entry ? 'pointer' : 'default',
                            borderLeft: entry?.mark === 'sub'
                              ? '4px solid #7C3AED'
                              : entry?.mark === 'covered'
                              ? '4px solid #F59E0B'
                              : '1px solid #E2E8F0',
                            opacity: covered ? 0.78 : 1,
                          }}
                          title={!readOnly && entry ? 'คลิกเพื่อแก้ไขคาบสอนหรือตั้งค่าครูสอนแทน' : undefined}
                        >
                          {entry && (
                            <>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
                                <span style={{
                                  fontSize: '0.72rem', fontWeight: 900, background: '#0F172A', color: 'white',
                                  padding: '1px 7px', borderRadius: 6,
                                }}>
                                  {entry.room.label}
                                </span>
                                {!readOnly && (
                                  <span className="tt-no-print" style={{ fontSize: '0.66rem', color: '#64748B' }}>แก้ไข ✎</span>
                                )}
                              </div>
                              <div style={{
                                fontWeight: 800, fontSize: '0.85rem', color: '#0F172A', marginTop: 4,
                                textDecoration: covered ? 'line-through' : 'none',
                              }}>
                                {entry.cell.subject}
                              </div>
                              {entry.mark === 'sub' && (
                                <div style={{ fontSize: '0.7rem', color: '#7C3AED', fontWeight: 800, marginTop: 3 }}>
                                  🔁 สอนแทน ({entry.cell.teacher})
                                </div>
                              )}
                              {entry.mark === 'covered' && (
                                <div style={{ fontSize: '0.7rem', color: '#B45309', fontWeight: 800, marginTop: 3 }}>
                                  ⚠ มอบหมาย {entry.cell.substitute} สอนแทน
                                </div>
                              )}
                            </>
                          )}
                          {!entry && isPhattaraOff && (
                            <div style={{
                              fontSize: '0.74rem',
                              color: '#1E40AF',
                              background: '#EFF6FF',
                              border: '1px solid #BFDBFE',
                              borderRadius: 8,
                              fontWeight: 700,
                              textAlign: 'center',
                              padding: '6px 4px',
                              lineHeight: 1.35,
                            }}>
                              🏫 ปฏิบัติราชการ<br />โรงเรียนบ้านคลองไพร
                            </div>
                          )}
                          {!entry && !isPhattaraOff && schoolAct && (
                            <div style={{
                              background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 8,
                              padding: '4px 6px', textAlign: 'center',
                            }}>
                              <div style={{ fontWeight: 800, fontSize: '0.8rem', color: '#92400E' }}>⭐ {schoolAct}</div>
                              {(schoolAct === 'กิจกรรมแนะแนว' || schoolAct === 'ตลาดนัดอาชีพ') && (
                                <div style={{ fontSize: '0.66rem', color: '#B45309', fontWeight: 600 }}>ครูที่ปรึกษา</div>
                              )}
                            </div>
                          )}
                          {!entry && !isPhattaraOff && !schoolAct && (
                            <div style={{ fontSize: '0.74rem', color: '#10B981', fontWeight: 700, textAlign: 'center', padding: '8px 0', opacity: 0.75 }}>
                              🟢 คาบว่าง
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ─── Render Master Matrix View (All Rooms x Periods on a Day) ───────────
  const renderMasterGrid = () => {
    return (
      <div>
        <div className="tt-no-print" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10,
          background: 'white', padding: '12px 16px', borderRadius: 12, border: '1px solid #E2E8F0', marginBottom: 14,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 900, color: '#0F172A', fontSize: '0.95rem' }}>📅 เลือกวันเพื่อดูตารางรวมทั้งโรงเรียน (ป.1 – ม.3):</span>
            {data.days.map(d => (
              <button
                key={d}
                onClick={() => setMasterDay(d)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 99,
                  border: masterDay === d ? 'none' : '1px solid #CBD5E1',
                  background: masterDay === d ? 'linear-gradient(135deg,#0F172A,#1E3A8A)' : 'white',
                  color: masterDay === d ? 'white' : '#334155',
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                }}
              >
                วัน{d}
              </button>
            ))}
          </div>
          <span style={{ fontSize: '0.76rem', color: '#64748B', fontWeight: 600 }}>
            💡 คลิกที่ช่องใดก็ได้เพื่อแก้ไขหรือสลับคาบเรียนได้ทันที
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: 920, background: 'white', borderRadius: 14, overflow: 'hidden', border: '1px solid #CBD5E1' }}>
            <thead>
              <tr>
                <th style={{ ...th, width: 95 }}>ห้องเรียน</th>
                {data.slots.map(s => (
                  <th key={s.id} style={{ ...th, textAlign: 'center' }}>
                    <div>{s.label}</div>
                    <div style={{ fontSize: '0.68rem', fontWeight: 500, opacity: 0.85 }}>{s.start}-{s.end}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rooms.map(room => (
                <tr key={room.id}>
                  <td style={{ ...td, background: '#F8FAFC', fontWeight: 900, color: '#0F172A', textAlign: 'center' }}>
                    <div>{room.label}</div>
                    <div style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 600 }}>
                      {getClassRoster(room.label)?.totalCount || 0} คน
                    </div>
                  </td>
                  {data.slots.map(slot => {
                    const k = cellKey(room.id, slot.id, masterDay);
                    const cell = data.sched[k];
                    const conflict = conflictCells.has(k);
                    const isSwapSelected =
                      swapSource?.roomId === room.id &&
                      swapSource?.slot === slot.id &&
                      swapSource?.day === masterDay;
                    return (
                      <td
                        key={slot.id}
                        onClick={() => handleCellAction(room.id, slot.id, masterDay)}
                        style={{
                          ...td,
                          padding: '6px 8px',
                          background: isSwapSelected
                            ? '#DBEAFE'
                            : cell?.free
                            ? '#F1F5F9'
                            : cell?.subject
                            ? colorFor(cell.subject, data.subjects)
                            : 'white',
                          cursor: readOnly ? 'default' : 'pointer',
                          border: isSwapSelected
                            ? '2px dashed #2563EB'
                            : conflict
                            ? '2px solid #EF4444'
                            : '1px solid #E2E8F0',
                        }}
                      >
                        {cell?.subject && (
                          <div style={{ fontWeight: 800, fontSize: '0.78rem', color: '#0F172A' }}>{cell.subject}</div>
                        )}
                        {(() => {
                          const effT = getEffectiveTeacher(cell);
                          return effT ? (
                            <div style={{ fontSize: '0.68rem', color: '#475569', marginTop: 2 }}>{effT}</div>
                          ) : null;
                        })()}
                        {cell?.substitute && (
                          <div style={{ fontSize: '0.68rem', color: '#7C3AED', fontWeight: 800 }}>🔁 {cell.substitute}</div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ─── Render Workload Overview ───────────────────────────────────────────
  const renderOverview = () => {
    const filtered = data.teachers.filter(t =>
      !search || `${t.first} ${t.last} ${t.dept || ''}`.toLowerCase().includes(search.toLowerCase())
    );
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
        {filtered.map(t => {
          const name = teacherName(t);
          const l = teacherWeeklyLoad[name] || { main: 0, sub: 0 };
          const total = l.main + l.sub;
          return (
            <div
              key={t.id}
              onClick={() => { setActiveTeacher(name); setView('teacher'); }}
              style={{
                background: 'white', padding: '1.1rem', borderRadius: 14, cursor: 'pointer',
                border: '1px solid #E2E8F0',
                borderLeft: `5px solid ${total > 25 ? '#EF4444' : total > 18 ? '#F59E0B' : '#10B981'}`,
                boxShadow: '0 2px 8px rgba(15,23,42,0.04)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 900, color: '#0F172A', fontSize: '0.96rem' }}>{name}</div>
                  <div style={{ fontSize: '0.76rem', color: '#64748B', marginTop: 2 }}>{t.rank} · กลุ่มสาระฯ {t.dept}</div>
                </div>
                <span style={{
                  fontSize: '0.7rem', color: '#2563EB', background: '#EFF6FF',
                  padding: '3px 8px', borderRadius: 99, fontWeight: 700,
                }}>
                  ดูตาราง →
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 12 }}>
                <span style={{ fontSize: '0.82rem', color: '#475569', fontWeight: 600 }}>รวมคาบสอน/สัปดาห์</span>
                <span style={{ fontSize: '1.5rem', fontWeight: 900, color: total > 25 ? '#EF4444' : '#0F172A' }}>
                  {total} <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748B' }}>คาบ</span>
                </span>
              </div>
              {l.sub > 0 && (
                <div style={{ fontSize: '0.74rem', color: '#7C3AED', fontWeight: 800, marginTop: 4 }}>
                  🔁 รวมสอนแทนประจำ {l.sub} คาบ
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // ─── Render Smart Substitute Teaching Studio ────────────────────────────
  const renderSubPanel = () => {
    const dayOrder = data.days;
    const allSavedSubs: {
      key: string;
      slot: number;
      day: string;
      dateStr: string;
      reason: string;
      room?: Room;
      slotInfo?: Slot;
      subject: string;
      original: string;
      originalTeacherId?: string;
      substitute: string;
    }[] = [];

    // 1. Standing substitutes inside `data.sched`
    Object.entries(data.sched)
      .filter(([, c]) => c.substitute)
      .forEach(([key, c]) => {
        const [roomId, slot, day] = parseKey(key);
        allSavedSubs.push({
          key,
          slot: +slot,
          day,
          dateStr: 'ตารางสอนปกติ',
          reason: 'มอบหมายประจำคาบ',
          room: data.rooms.find(r => r.id === roomId),
          slotInfo: data.slots.find(s => s.id === +slot),
          subject: c.subject || '-',
          original: c.teacher || '-',
          substitute: c.substitute!,
        });
      });

    // 2. Daily substitutes inside `data.substitute`
    if (data.substitute) {
      Object.entries(data.substitute).forEach(([dateStr, dailyData]) => {
        if (dailyData?.absentList) {
          dailyData.absentList.forEach(absent => {
            const origTeacher = data.teachers.find(t => t.id === absent.teacherId);
            const origName = absent.teacherName || teacherName(origTeacher) || '-';
            absent.periods?.forEach(p => {
              if (p.subTeacher) {
                allSavedSubs.push({
                  key: `daily_${dateStr}_${absent.teacherId}_${p.slotId}_${p.roomId}`,
                  slot: p.slotId,
                  day: p.day || getThaiWeekdayFromDate(dateStr, dayOrder),
                  dateStr,
                  reason: absent.reason || 'ไปราชการ / ลา',
                  room: data.rooms.find(r => r.id === p.roomId),
                  slotInfo: data.slots.find(s => s.id === p.slotId),
                  subject: p.subject || '-',
                  original: origName,
                  originalTeacherId: absent.teacherId,
                  substitute: p.subTeacher,
                });
              }
            });
          });
        }
      });
    }

    allSavedSubs.sort((a, b) => {
      if (a.dateStr !== b.dateStr && a.dateStr !== 'ตารางสอนปกติ' && b.dateStr !== 'ตารางสอนปกติ') {
        return b.dateStr.localeCompare(a.dateStr);
      }
      if (a.dateStr !== b.dateStr) return a.dateStr === 'ตารางสอนปกติ' ? 1 : -1;
      const di = dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day);
      if (di !== 0) return di;
      return a.slot - b.slot;
    });

    const subsForSelectedDate = allSavedSubs.filter(s => s.dateStr === subDate);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* ─── STEP-BY-STEP SMART SUBSTITUTE WIZARD ─── */}
        {!readOnly && (
          <div className="tt-no-print" style={{
            background: 'white', borderRadius: 16, padding: '1.25rem',
            border: '2px solid #DDD6FE', boxShadow: '0 8px 24px rgba(109,40,217,0.07)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
              <div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#F5F3FF', color: '#6D28D9', padding: '4px 10px', borderRadius: 99, fontSize: '0.74rem', fontWeight: 800, marginBottom: 4 }}>
                  <Sparkles size={13} /> ระบบจัดสอนแทนอัจฉริยะ (Smart 1-Click Substitute)
                </div>
                <h5 style={{ margin: 0, fontWeight: 900, color: '#0F172A', fontSize: '1.08rem' }}>
                  จัดครูสอนแทนรายวัน — คัดกรองเฉพาะครูที่ว่างในคาบนั้นให้อัตโนมัติ
                </h5>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {absentTeacherPeriods.length > 0 && (
                  <button
                    onClick={autoAssignDailySubs}
                    style={{
                      background: 'linear-gradient(135deg,#7C3AED,#9333EA)', color: 'white',
                      border: 'none', padding: '9px 16px', borderRadius: 10, fontWeight: 800,
                      fontSize: '0.84rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
                      boxShadow: '0 4px 12px rgba(124,58,237,0.28)',
                    }}
                  >
                    <Sparkles size={15} /> ⚡ จัดครูสอนแทนอัตโนมัติทั้งวัน
                  </button>
                )}
                {subsForSelectedDate.length > 0 && (
                  <button
                    onClick={() => window.print()}
                    style={{
                      background: '#0F172A', color: 'white', border: 'none', padding: '9px 14px',
                      borderRadius: 10, fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer',
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                    }}
                  >
                    <Printer size={14} /> พิมพ์ใบแจ้งสอนแทน ({subDate})
                  </button>
                )}
              </div>
            </div>

            {/* Step 1: Pick Date, Weekday, Absent Teacher, Reason */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12,
              background: '#F8FAFC', padding: '14px', borderRadius: 12, border: '1px solid #E2E8F0', marginBottom: 16,
            }}>
              <div>
                <label style={{ fontSize: '0.76rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>
                  1. วันที่ต้องการจัดสอนแทน
                </label>
                <input
                  type="date"
                  value={subDate}
                  onChange={e => setSubDate(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 9, border: '1px solid #CBD5E1', fontWeight: 700, fontSize: '0.86rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.76rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>
                  ตารางสอนของวัน (จันทร์–ศุกร์)
                </label>
                <select
                  value={subWeekday}
                  onChange={e => setSubWeekday(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 9, border: '1px solid #CBD5E1', fontWeight: 700, fontSize: '0.86rem' }}
                >
                  {data.days.map(d => (
                    <option key={d} value={d}>วัน{d}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.76rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>
                  2. เลือกครูที่ลา / ไปราชการ
                </label>
                <select
                  value={subAbsentTeacherId}
                  onChange={e => setSubAbsentTeacherId(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 9, border: '1px solid #CBD5E1', fontWeight: 800, fontSize: '0.86rem', color: '#0F172A' }}
                >
                  {data.teachers.map(t => (
                    <option key={t.id} value={t.id}>
                      {teacherName(t)} ({t.dept})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.76rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>
                  3. สาเหตุการลา / ไปราชการ
                </label>
                <select
                  value={subReason}
                  onChange={e => setSubReason(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 9, border: '1px solid #CBD5E1', fontWeight: 700, fontSize: '0.86rem' }}
                >
                  {LEAVE_REASONS.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Step 2: List of Periods for that Teacher on that Weekday */}
            {absentTeacherPeriods.length === 0 ? (
              <div style={{
                padding: '1.5rem', textAlign: 'center', background: '#F8FAFC', borderRadius: 12,
                border: '1px dashed #CBD5E1', color: '#64748B', fontWeight: 700,
              }}>
                🎉 <strong>{selectedAbsentName}</strong> ไม่มีคาบสอนใน <strong>วัน{subWeekday}</strong> (ไม่ต้องจัดครูสอนแทน)
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#1E293B' }}>
                    📋 รายการคาบสอนของ <span style={{ color: '#DC2626' }}>{selectedAbsentName}</span> ในวัน{subWeekday} ({absentTeacherPeriods.length} คาบ):
                  </div>
                  <div style={{ fontSize: '0.76rem', color: '#059669', fontWeight: 700 }}>
                    🟢 คลิกชื่อครูที่ว่างด้านขวาเพื่อมอบหมายในคลิกเดียว
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {absentTeacherPeriods.map(item => {
                    const draftKey = `${item.room.id}_${item.slot.id}`;
                    const currentSub = draftSubMap[draftKey] || '';
                    const candidates = getAvailableTeachersForSlot(subWeekday, item.slot.id, selectedAbsentName);
                    const freeCandidates = candidates.filter(c => c.isFree);

                    return (
                      <div
                        key={draftKey}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'minmax(220px, 1.1fr) minmax(260px, 2fr)',
                          gap: 12,
                          padding: '12px 14px',
                          borderRadius: 12,
                          border: currentSub ? '1.5px solid #A7F3D0' : '1px solid #E2E8F0',
                          background: currentSub ? '#F0FDF4' : 'white',
                          alignItems: 'center',
                        }}
                      >
                        {/* Left: Period & Room Info */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            background: '#0F172A', color: 'white', borderRadius: 10, padding: '8px 10px',
                            textAlign: 'center', minWidth: 78,
                          }}>
                            <div style={{ fontWeight: 900, fontSize: '0.82rem' }}>{item.slot.label}</div>
                            <div style={{ fontSize: '0.66rem', opacity: 0.8 }}>{item.slot.start}-{item.slot.end}</div>
                          </div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{
                                background: '#EA580C', color: 'white', fontWeight: 900, fontSize: '0.75rem',
                                padding: '2px 8px', borderRadius: 6,
                              }}>
                                ชั้น {item.room.label}
                              </span>
                              <span style={{ fontWeight: 800, color: '#0F172A', fontSize: '0.9rem' }}>
                                {item.subject}
                              </span>
                            </div>
                            <div style={{ fontSize: '0.74rem', color: '#64748B', marginTop: 3 }}>
                              ครูประจำวิชา: {selectedAbsentName}
                            </div>
                          </div>
                        </div>

                        {/* Right: Quick 1-Click Free Teacher Pills + Dropdown */}
                        <div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                            {freeCandidates.slice(0, 5).map(c => {
                              const isChosen = currentSub === c.name;
                              return (
                                <button
                                  key={c.teacher.id}
                                  type="button"
                                  onClick={() =>
                                    setDraftSubMap(prev => ({
                                      ...prev,
                                      [draftKey]: isChosen ? '' : c.name,
                                    }))
                                  }
                                  style={{
                                    padding: '5px 10px',
                                    borderRadius: 99,
                                    border: isChosen ? '2px solid #059669' : '1px solid #CBD5E1',
                                    background: isChosen ? '#059669' : 'white',
                                    color: isChosen ? 'white' : '#0F172A',
                                    fontWeight: 700,
                                    fontSize: '0.76rem',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                  }}
                                  title={`ว่างในคาบนี้ · วันนี้สอน ${c.dayPeriods} คาบ · สัปดาห์ละ ${c.weekPeriods} คาบ`}
                                >
                                  <span>{isChosen ? '✓' : '🟢'} {c.teacher.first}</span>
                                  <span style={{
                                    fontSize: '0.66rem',
                                    opacity: 0.85,
                                    background: isChosen ? 'rgba(255,255,255,0.2)' : '#F1F5F9',
                                    padding: '0 5px',
                                    borderRadius: 99,
                                  }}>
                                    วันนี้ {c.dayPeriods} คาบ
                                  </span>
                                </button>
                              );
                            })}
                          </div>

                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <select
                              value={currentSub}
                              onChange={e =>
                                setDraftSubMap(prev => ({
                                  ...prev,
                                  [draftKey]: e.target.value,
                                }))
                              }
                              style={{
                                flex: 1,
                                padding: '6px 10px',
                                borderRadius: 8,
                                border: '1px solid #CBD5E1',
                                fontSize: '0.8rem',
                                fontWeight: 700,
                                color: currentSub ? '#047857' : '#64748B',
                              }}
                            >
                              <option value="">— เลือกครูสอนแทน ({freeCandidates.length} คนว่างในคาบนี้) —</option>
                              <optgroup label="🟢 ครูที่ว่างในคาบนี้ (แนะนำ)">
                                {freeCandidates.map(c => (
                                  <option key={c.teacher.id} value={c.name}>
                                    🟢 {c.name} (ว่าง · วันนี้สอน {c.dayPeriods} คาบ / สัปดาห์ละ {c.weekPeriods} คาบ)
                                  </option>
                                ))}
                              </optgroup>
                              <optgroup label="🔴 ครูที่ติดสอนห้องอื่น / หยุดราชการ">
                                {candidates.filter(c => !c.isFree && !c.isSelf).map(c => (
                                  <option key={c.teacher.id} value={c.name}>
                                    {c.isPhattaraOff
                                      ? `⚪ ${c.name} (ปฏิบัติราชการโรงเรียนบ้านคลองไพร พฤ.-ศ.)`
                                      : `🔴 ${c.name} (ติดสอน ${c.busyList.map(b => `${b.roomLabel} ${b.subject}`).join(', ')})`}
                                  </option>
                                ))}
                              </optgroup>
                            </select>
                            {currentSub && (
                              <button
                                onClick={() => setDraftSubMap(prev => ({ ...prev, [draftKey]: '' }))}
                                style={{
                                  background: '#FEE2E2', color: '#DC2626', border: 'none',
                                  borderRadius: 8, padding: '6px 10px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                                }}
                              >
                                ล้าง
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
                  <button
                    onClick={saveDailySubAssignment}
                    disabled={loading}
                    style={{
                      background: 'linear-gradient(135deg,#059669,#10B981)', color: 'white',
                      border: 'none', padding: '10px 22px', borderRadius: 12, fontWeight: 900,
                      fontSize: '0.9rem', cursor: loading ? 'wait' : 'pointer',
                      display: 'inline-flex', alignItems: 'center', gap: 8,
                      boxShadow: '0 6px 16px rgba(5,150,105,0.28)',
                    }}
                  >
                    <CheckCircle2 size={17} /> บันทึกใบจัดสอนแทนประจำวันที่ {subDate}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── SAVED SUBSTITUTE RECORDS & OFFICIAL PRINT TABLE ─── */}
        <div style={{ background: 'white', borderRadius: 16, padding: '1.25rem', border: '1px solid #E2E8F0' }}>
          <div className="tt-no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <h6 style={{ margin: 0, fontWeight: 900, color: '#0F172A', fontSize: '1rem' }}>
              📜 ประวัติและรายการจัดสอนแทนทั้งหมด ({allSavedSubs.length} คาบ)
            </h6>
            {allSavedSubs.length > 0 && (
              <button
                onClick={() => window.print()}
                style={{
                  background: '#F8FAFC', border: '1px solid #CBD5E1', color: '#0F172A',
                  padding: '7px 14px', borderRadius: 10, fontWeight: 800, fontSize: '0.8rem',
                  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
                }}
              >
                <Printer size={14} /> พิมพ์ใบแจ้งสอนแทน (A4)
              </button>
            )}
          </div>

          {allSavedSubs.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#94A3B8' }}>
              ยังไม่มีรายการสอนแทนที่บันทึกไว้ — เลือกครูที่ลาด้านบนแล้วกด "⚡ จัดครูสอนแทนอัตโนมัติ" ได้เลย!
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: 820 }}>
                <thead>
                  <tr>
                    <th style={th}>วันที่ / ประเภท</th>
                    <th style={th}>วัน</th>
                    <th style={th}>คาบเรียน</th>
                    <th style={th}>ห้อง</th>
                    <th style={th}>รายวิชา</th>
                    <th style={th}>ครูผู้ลา / ติดราชการ</th>
                    <th style={th}>ครูผู้สอนแทน</th>
                    <th style={th}>ลายมือชื่อรับทราบ</th>
                    {!readOnly && <th className="tt-no-print" style={th}>จัดการ</th>}
                  </tr>
                </thead>
                <tbody>
                  {allSavedSubs.map(s => (
                    <tr key={s.key}>
                      <td style={{ ...td, fontWeight: 700, background: '#F8FAFC' }}>
                        <div>{s.dateStr === 'ตารางสอนปกติ' ? '📌 ประจำคาบ' : `📅 ${s.dateStr}`}</div>
                        <div style={{ fontSize: '0.7rem', color: '#64748B' }}>{s.reason}</div>
                      </td>
                      <td style={{ ...td, fontWeight: 800, color: '#7C2D12', background: '#FFF7ED', textAlign: 'center' }}>
                        {s.day}
                      </td>
                      <td style={td}>
                        <div style={{ fontWeight: 800 }}>{s.slotInfo?.label || `คาบ ${s.slot}`}</div>
                        <div style={{ fontSize: '0.72rem', color: '#64748B' }}>
                          {s.slotInfo ? `${s.slotInfo.start}–${s.slotInfo.end}` : '-'}
                        </div>
                      </td>
                      <td style={{ ...td, fontWeight: 900, textAlign: 'center' }}>{s.room?.label || '-'}</td>
                      <td style={{ ...td, fontWeight: 700 }}>{s.subject}</td>
                      <td style={{ ...td, color: '#64748B' }}>{s.original}</td>
                      <td style={{ ...td, color: '#6D28D9', fontWeight: 900 }}>🔁 {s.substitute}</td>
                      <td style={{ ...td, color: '#94A3B8', textAlign: 'center' }}>...........................</td>
                      {!readOnly && (
                        <td className="tt-no-print" style={{ ...td, textAlign: 'center' }}>
                          {s.dateStr === 'ตารางสอนปกติ' ? (
                            <button
                              onClick={() => {
                                const cell = data.sched[s.key];
                                if (cell) updateCell(s.key, { ...cell, substitute: undefined });
                              }}
                              style={{
                                padding: '4px 10px', borderRadius: 8, border: '1px solid #FECACA',
                                background: 'white', color: '#DC2626', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer',
                              }}
                            >
                              ยกเลิก
                            </button>
                          ) : (
                            s.originalTeacherId && (
                              <button
                                onClick={() => removeDailyAbsentEntry(s.dateStr, s.originalTeacherId!)}
                                style={{
                                  padding: '4px 10px', borderRadius: 8, border: '1px solid #FECACA',
                                  background: 'white', color: '#DC2626', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer',
                                }}
                              >
                                ลบใบลา
                              </button>
                            )
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderDataPanel = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
      <div style={{ background: 'white', borderRadius: 14, padding: '1rem', border: '1px solid #E2E8F0' }}>
        <h6 style={{ fontWeight: 900, marginBottom: 10 }}>📚 รายวิชาในหลักสูตร ({data.subjects.length} รายวิชา)</h6>
        <div style={{ maxHeight: 440, overflow: 'auto' }}>
          {data.subjects.map(s => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderBottom: '1px solid #F1F5F9' }}>
              <span style={{ width: 16, height: 16, background: s.color || '#E2E8F0', borderRadius: 5, flexShrink: 0, border: '1px solid rgba(0,0,0,0.08)' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#0F172A' }}>{s.name}</div>
                <div style={{ fontSize: '0.72rem', color: '#64748B' }}>กลุ่มสาระฯ: {s.dept} · {s.hours} คาบ/สัปดาห์</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ background: 'white', borderRadius: 14, padding: '1rem', border: '1px solid #E2E8F0' }}>
        <h6 style={{ fontWeight: 900, marginBottom: 10 }}>👥 คณะครูผู้สอน ({data.teachers.length} ท่าน)</h6>
        <div style={{ maxHeight: 440, overflow: 'auto' }}>
          {data.teachers.map(t => (
            <div key={t.id} style={{ padding: '8px 10px', borderBottom: '1px solid #F1F5F9' }}>
              <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#0F172A' }}>{teacherName(t)}</div>
              <div style={{ fontSize: '0.72rem', color: '#64748B' }}>
                {t.rank} · {t.dept} · วิชาที่สอน: {t.subjects?.join(', ') || '-'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const printTitle =
    view === 'class'
      ? `ตารางเรียนชั้น ${data.rooms.find(r => r.id === activeRoom)?.label || ''}`
      : view === 'teacher'
      ? `ตารางสอนรายบุคคล · ${activeTeacher}`
      : view === 'master'
      ? `ตารางเรียนรวมทั้งโรงเรียน · วัน${masterDay}`
      : view === 'sub'
      ? `ใบแจ้งจัดครูสอนแทนราชการ · ${formatThaiFullDate(subDate)}`
      : 'สรุปภาระงานสอนคณะครู';

  // Helper: Summary of subjects taught by a teacher
  const getTeacherSubjectSummary = (tName: string) => {
    const summaryMap: Record<string, { code: string; name: string; rooms: Set<string>; count: number }> = {};
    Object.entries(data.sched).forEach(([k, cell]) => {
      if (cell.free || !cell.subject) return;
      const [roomId] = parseKey(k);
      const room = data.rooms.find(r => r.id === roomId);
      const roomLabel = room?.label || roomId;
      const effT = getEffectiveTeacher(cell);
      if (cell.substitute === tName || cell.teacher === tName || effT === tName) {
        const subj = data.subjects.find(s => s.name === cell.subject);
        const code = subj?.code || '-';
        const key = `${cell.subject}_${roomLabel}`;
        if (!summaryMap[key]) {
          summaryMap[key] = { code, name: cell.subject, rooms: new Set([roomLabel]), count: 0 };
        }
        summaryMap[key].count++;
      }
    });
    return Object.values(summaryMap);
  };

  // Helper: Summary of subjects in a classroom
  const getClassSubjectSummary = (rId: string) => {
    const summaryMap: Record<string, { code: string; name: string; teacher: string; count: number }> = {};
    data.days.forEach(day => {
      data.slots.forEach(slot => {
        const k = cellKey(rId, slot.id, day);
        const cell = data.sched[k];
        if (!cell || cell.free || !cell.subject) return;
        const subj = data.subjects.find(s => s.name === cell.subject);
        const code = subj?.code || '-';
        const effT = getEffectiveTeacher(cell);
        const key = `${cell.subject}_${effT}`;
        if (!summaryMap[key]) {
          summaryMap[key] = { code, name: cell.subject, teacher: effT || '-', count: 0 };
        }
        summaryMap[key].count++;
      });
    });
    return Object.values(summaryMap);
  };

  const renderOfficialPrintSheet = () => {
    // ════════════════════════════════════════════════════════════════════════
    // 1. OFFICIAL TEACHER TIMETABLE (ตารางสอนรายบุคคล แบบฟอร์มราชการ สพฐ.)
    // ════════════════════════════════════════════════════════════════════════
    if (view === 'teacher') {
      const teacherObj = data.teachers.find(t => teacherName(t) === activeTeacher);
      const isPhattara = activeTeacher.includes('ภัทรสุดา');
      const subjSummary = getTeacherSubjectSummary(activeTeacher);
      const totalHours = subjSummary.reduce((sum, s) => sum + s.count, 0);

      // Matrix: [day][slotId] -> teaching cell info
      const matrix: Record<string, Record<number, { roomLabel: string; subject: string; isSub: boolean }>> = {};
      data.days.forEach(d => {
        matrix[d] = {};
        data.slots.forEach(s => {
          let match: { roomLabel: string; subject: string; isSub: boolean } | null = null;
          data.rooms.forEach(r => {
            const k = cellKey(r.id, s.id, d);
            const cell = data.sched[k];
            if (!cell || cell.free) return;
            const effT = getEffectiveTeacher(cell);
            if (cell.substitute === activeTeacher) {
              match = { roomLabel: r.label, subject: cell.subject || '-', isSub: true };
            } else if (cell.teacher === activeTeacher || effT === activeTeacher) {
              match = { roomLabel: r.label, subject: cell.subject || '-', isSub: false };
            }
          });
          if (match) {
            matrix[d][s.id] = match;
          }
        });
      });

      return (
        <div className="tt-official-print-doc">
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <img
                src="/school_logo_kmd.png"
                alt="ตราโรงเรียน"
                style={{ width: 44, height: 44, objectFit: 'contain' }}
                onError={e => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
              />
              <div>
                <h2 style={{ margin: 0, fontSize: '14pt', fontWeight: 900, color: '#000', letterSpacing: 0.5 }}>
                  ตารางสอนรายบุคคล
                </h2>
                <div style={{ fontSize: '10pt', fontWeight: 800, color: '#1E293B', marginTop: 1 }}>
                  {SCHOOL_NAME} {SCHOOL_AFFILIATION}
                </div>
                <div style={{ fontSize: '8.5pt', color: '#475569', fontWeight: 700 }}>
                  ภาคเรียนที่ {data.school.semester} ปีการศึกษา {data.school.year}
                </div>
              </div>
            </div>

            {/* Teacher Meta Bar */}
            <div style={{
              marginTop: 4, padding: '3px 12px', background: '#F8FAFC', border: '1px solid #CBD5E1',
              borderRadius: 6, fontSize: '8.5pt', fontWeight: 700, display: 'flex', justifyContent: 'space-between',
            }}>
              <span>ชื่อ-สกุล: <strong>{activeTeacher}</strong></span>
              <span>ตำแหน่ง: <strong>{teacherObj?.rank || 'ครู'}</strong></span>
              <span>กลุ่มสาระฯ: <strong>{teacherObj?.dept || '-'}</strong></span>
              <span>รวมภาระงานสอน: <strong>{totalHours} คาบ/สัปดาห์</strong></span>
            </div>
          </div>

          {/* Matrix Table: Days as Rows, Slots as Columns */}
          <table style={{
            width: '100%', borderCollapse: 'collapse', textAlign: 'center',
            fontSize: '8pt', marginBottom: 6, border: '1.5px solid #000', tableLayout: 'fixed',
          }}>
            <thead>
              <tr style={{ background: '#F1F5F9', color: '#000', fontWeight: 900 }}>
                <th style={{ border: '1px solid #000', padding: '4px 2px', width: '9%' }}>วัน / เวลา</th>
                {data.slots.map(s => (
                  <React.Fragment key={s.id}>
                    {s.id === 6 && (
                      <th style={{ border: '1px solid #000', padding: '4px 2px', width: '6.5%', background: '#FEF3C7', fontSize: '7.5pt' }}>
                        พักกลางวัน<br />
                        <span style={{ fontSize: '6.5pt', fontWeight: 600 }}>11.50–13.00</span>
                      </th>
                    )}
                    <th style={{ border: '1px solid #000', padding: '4px 2px', width: '12%' }}>
                      คาบที่ {s.id === 6 ? 5 : s.id === 7 ? 6 : s.id === 8 ? 7 : s.id === 9 ? 8 : s.id}<br />
                      <span style={{ fontSize: '6.5pt', fontWeight: 600 }}>{s.start}–{s.end}</span>
                    </th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.days.map(day => {
                const isOffDay = isPhattara && (day === 'พฤหัสบดี' || day === 'ศุกร์');
                return (
                  <tr key={day} style={{ height: 28 }}>
                    <td style={{ border: '1px solid #000', padding: '3px 2px', fontWeight: 900, background: '#F8FAFC', fontSize: '8pt' }}>
                      วัน{day}
                    </td>

                    {/* Kru Phattasuda Thu/Fri full duty notice */}
                    {isOffDay ? (
                      <td colSpan={data.slots.length + 1} style={{
                        border: '1px solid #000', padding: '6px',
                        background: '#EFF6FF', color: '#1E40AF',
                        fontWeight: 900, fontSize: '9pt', letterSpacing: 0.5,
                      }}>
                        🏫 ปฏิบัติราชการโรงเรียนบ้านคลองไพร (ตลอดวัน)
                      </td>
                    ) : (
                      data.slots.map(s => {
                        const cellData = matrix[day]?.[s.id];
                        const schoolAct = SCHOOL_ACTIVITIES_MAP[`${s.id}${SEP}${day}`];

                        return (
                          <React.Fragment key={s.id}>
                            {s.id === 6 && (
                              <td style={{
                                border: '1px solid #000', padding: '2px', background: '#FFFBEB',
                                fontSize: '7pt', color: '#92400E', fontWeight: 700,
                              }}>
                                พัก
                              </td>
                            )}
                            <td style={{
                              border: '1px solid #000', padding: '2px',
                              background: cellData ? '#FFFFFF' : schoolAct ? '#FFFBEB' : '#FFFFFF',
                              verticalAlign: 'middle',
                            }}>
                              {cellData ? (
                                <div>
                                  <div style={{ fontWeight: 800, fontSize: '7.8pt', color: '#000', lineHeight: 1.2 }}>
                                    {cellData.subject}
                                  </div>
                                  <div style={{ fontSize: '6.8pt', color: '#475569', fontWeight: 700, marginTop: 1 }}>
                                    {cellData.roomLabel} {cellData.isSub && '(สอนแทน)'}
                                  </div>
                                </div>
                              ) : schoolAct ? (
                                <div>
                                  <div style={{ fontWeight: 800, fontSize: '7.2pt', color: '#92400E', lineHeight: 1.2 }}>
                                    ⭐ {schoolAct}
                                  </div>
                                  {(schoolAct === 'กิจกรรมแนะแนว' || schoolAct === 'ตลาดนัดอาชีพ') && (
                                    <div style={{ fontSize: '6.5pt', color: '#B45309', fontWeight: 700 }}>
                                      ครูที่ปรึกษา
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span style={{ color: '#94A3B8', fontSize: '7pt' }}>-</span>
                              )}
                            </td>
                          </React.Fragment>
                        );
                      })
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Bottom Section: Course Workload Summary & Official Signatures */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1.85fr', gap: 10, alignItems: 'flex-start' }}>
            {/* Subject Summary Table */}
            <div>
              <div style={{ fontSize: '7.5pt', fontWeight: 900, marginBottom: 2 }}>
                ตารางสรุปรายวิชาและภาระงานสอน:
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '7pt', border: '1px solid #000', tableLayout: 'fixed' }}>
                <thead>
                  <tr style={{ background: '#F1F5F9', fontWeight: 800 }}>
                    <th style={{ border: '1px solid #000', padding: '2px', width: '10%' }}>ที่</th>
                    <th style={{ border: '1px solid #000', padding: '2px 4px', textAlign: 'left' }}>รายวิชา / กิจกรรม</th>
                    <th style={{ border: '1px solid #000', padding: '2px', width: '22%' }}>ชั้น</th>
                    <th style={{ border: '1px solid #000', padding: '2px', width: '20%' }}>คาบ/สัปดาห์</th>
                  </tr>
                </thead>
                <tbody>
                  {subjSummary.slice(0, 6).map((s, idx) => (
                    <tr key={idx}>
                      <td style={{ border: '1px solid #000', padding: '2px', textAlign: 'center' }}>{idx + 1}</td>
                      <td style={{ border: '1px solid #000', padding: '2px 4px', textAlign: 'left', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</td>
                      <td style={{ border: '1px solid #000', padding: '2px', textAlign: 'center' }}>{Array.from(s.rooms).join(', ')}</td>
                      <td style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', fontWeight: 800 }}>{s.count}</td>
                    </tr>
                  ))}
                  <tr style={{ background: '#F8FAFC', fontWeight: 900 }}>
                    <td colSpan={3} style={{ border: '1px solid #000', padding: '2px 6px', textAlign: 'right' }}>
                      รวมภาระงานสอนทั้งสิ้น:
                    </td>
                    <td style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', color: '#0F172A' }}>
                      {totalHours} คาบ
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Official 3 Signatures */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, textAlign: 'center', fontSize: '7.5pt', marginTop: 6 }}>
              <div>
                <div>ลงชื่อ................................................</div>
                <div style={{ marginTop: 2, fontWeight: 700 }}>({activeTeacher})</div>
                <div style={{ color: '#475569' }}>ครูผู้สอน</div>
              </div>
              <div>
                <div>ลงชื่อ................................................</div>
                <div style={{ marginTop: 2, fontWeight: 700 }}>({data.school.acadName || 'นางสาวนริศรา ทำจิตรเหมาะ'})</div>
                <div style={{ color: '#475569' }}>หัวหน้างานวิชาการ</div>
              </div>
              <div>
                <div>ลงชื่อ................................................</div>
                <div style={{ marginTop: 2, fontWeight: 700 }}>({data.school.principalName || 'นายปรัชญา ปรางค์ชัยภูมิ'})</div>
                <div style={{ color: '#475569' }}>ผู้อำนวยการสถานศึกษา</div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // ════════════════════════════════════════════════════════════════════════
    // 2. OFFICIAL CLASS TIMETABLE (ตารางเรียนประจำชั้น แบบฟอร์มราชการ สพฐ.)
    // ════════════════════════════════════════════════════════════════════════
    if (view === 'class') {
      const room = data.rooms.find(r => r.id === activeRoom) || data.rooms[0];
      const roomRoster = getClassRoster(room.label);
      const subjSummary = getClassSubjectSummary(room.id);
      const totalHours = subjSummary.reduce((sum, s) => sum + s.count, 0);

      return (
        <div className="tt-official-print-doc">
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <img
                src="/school_logo_kmd.png"
                alt="ตราโรงเรียน"
                style={{ width: 44, height: 44, objectFit: 'contain' }}
                onError={e => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
              />
              <div>
                <h2 style={{ margin: 0, fontSize: '14pt', fontWeight: 900, color: '#000', letterSpacing: 0.5 }}>
                  ตารางเรียนประจำชั้นเรียน
                </h2>
                <div style={{ fontSize: '10pt', fontWeight: 800, color: '#1E293B', marginTop: 1 }}>
                  {SCHOOL_NAME} {SCHOOL_AFFILIATION}
                </div>
                <div style={{ fontSize: '8.5pt', color: '#475569', fontWeight: 700 }}>
                  ภาคเรียนที่ {data.school.semester} ปีการศึกษา {data.school.year}
                </div>
              </div>
            </div>

            {/* Room Meta Bar */}
            <div style={{
              marginTop: 4, padding: '3px 12px', background: '#F8FAFC', border: '1px solid #CBD5E1',
              borderRadius: 6, fontSize: '8.5pt', fontWeight: 700, display: 'flex', justifyContent: 'space-between',
            }}>
              <span>ชั้นเรียน: <strong>ชั้น{room.label} ({room.level})</strong></span>
              <span>ครูประจำชั้น: <strong>{roomRoster?.homeroomTeacher || 'ครูประจำชั้น'}</strong></span>
              <span>จำนวนนักเรียน: <strong>{roomRoster?.totalCount || 0} คน (ชาย {roomRoster?.maleCount || 0} / หญิง {roomRoster?.femaleCount || 0})</strong></span>
              <span>รวมเวลาเรียน: <strong>{totalHours} คาบ/สัปดาห์</strong></span>
            </div>
          </div>

          {/* Matrix Table: Days as Rows, Slots as Columns */}
          <table style={{
            width: '100%', borderCollapse: 'collapse', textAlign: 'center',
            fontSize: '8pt', marginBottom: 6, border: '1.5px solid #000', tableLayout: 'fixed',
          }}>
            <thead>
              <tr style={{ background: '#F1F5F9', color: '#000', fontWeight: 900 }}>
                <th style={{ border: '1px solid #000', padding: '4px 2px', width: '9%' }}>วัน / เวลา</th>
                {data.slots.map(s => (
                  <React.Fragment key={s.id}>
                    {s.id === 6 && (
                      <th style={{ border: '1px solid #000', padding: '4px 2px', width: '6.5%', background: '#FEF3C7', fontSize: '7.5pt' }}>
                        พักกลางวัน<br />
                        <span style={{ fontSize: '6.5pt', fontWeight: 600 }}>11.50–13.00</span>
                      </th>
                    )}
                    <th style={{ border: '1px solid #000', padding: '4px 2px', width: '12%' }}>
                      คาบที่ {s.id === 6 ? 5 : s.id === 7 ? 6 : s.id === 8 ? 7 : s.id === 9 ? 8 : s.id}<br />
                      <span style={{ fontSize: '6.5pt', fontWeight: 600 }}>{s.start}–{s.end}</span>
                    </th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.days.map(day => (
                <tr key={day} style={{ height: 28 }}>
                  <td style={{ border: '1px solid #000', padding: '3px 2px', fontWeight: 900, background: '#F8FAFC', fontSize: '8pt' }}>
                    วัน{day}
                  </td>
                  {data.slots.map(s => {
                    const k = cellKey(room.id, s.id, day);
                    const cell = data.sched[k];
                    const effT = getEffectiveTeacher(cell);
                    const schoolAct = SCHOOL_ACTIVITIES_MAP[`${s.id}${SEP}${day}`];

                    return (
                      <React.Fragment key={s.id}>
                        {s.id === 6 && (
                          <td style={{
                            border: '1px solid #000', padding: '2px', background: '#FFFBEB',
                            fontSize: '7pt', color: '#92400E', fontWeight: 700,
                          }}>
                            พัก
                          </td>
                        )}
                        <td style={{
                          border: '1px solid #000', padding: '2px',
                          background: cell?.free ? '#FFFFFF' : cell?.subject ? '#FFFFFF' : (schoolAct ? '#FFFBEB' : '#FFFFFF'),
                          verticalAlign: 'middle',
                        }}>
                          {cell?.subject ? (
                            <div>
                              <div style={{ fontWeight: 800, fontSize: '7.8pt', color: '#000', lineHeight: 1.2 }}>
                                {cell.subject}
                              </div>
                              {effT && (
                                <div style={{ fontSize: '6.8pt', color: '#475569', fontWeight: 700, marginTop: 1 }}>
                                  {effT}
                                </div>
                              )}
                            </div>
                          ) : schoolAct ? (
                            <div>
                              <div style={{ fontWeight: 800, fontSize: '7.2pt', color: '#92400E', lineHeight: 1.2 }}>
                                ⭐ {schoolAct}
                              </div>
                              {(schoolAct === 'กิจกรรมแนะแนว' || schoolAct === 'ตลาดนัดอาชีพ') && (
                                <div style={{ fontSize: '6.5pt', color: '#B45309', fontWeight: 700 }}>
                                  ครูที่ปรึกษา
                                </div>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: '#94A3B8', fontSize: '7pt' }}>-</span>
                          )}
                        </td>
                      </React.Fragment>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Bottom Section: Class Subject Summary & Official Signatures */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1.85fr', gap: 10, alignItems: 'flex-start' }}>
            {/* Subject Summary Table */}
            <div>
              <div style={{ fontSize: '7.5pt', fontWeight: 900, marginBottom: 2 }}>
                ตารางสรุปโครงสร้างเวลาเรียนประจำชั้น:
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '7pt', border: '1px solid #000', tableLayout: 'fixed' }}>
                <thead>
                  <tr style={{ background: '#F1F5F9', fontWeight: 800 }}>
                    <th style={{ border: '1px solid #000', padding: '2px', width: '10%' }}>ที่</th>
                    <th style={{ border: '1px solid #000', padding: '2px 4px', textAlign: 'left' }}>รายวิชา / กิจกรรม</th>
                    <th style={{ border: '1px solid #000', padding: '2px', width: '28%' }}>ครูผู้สอน</th>
                    <th style={{ border: '1px solid #000', padding: '2px', width: '18%' }}>คาบ/สัปดาห์</th>
                  </tr>
                </thead>
                <tbody>
                  {subjSummary.slice(0, 6).map((s, idx) => (
                    <tr key={idx}>
                      <td style={{ border: '1px solid #000', padding: '2px', textAlign: 'center' }}>{idx + 1}</td>
                      <td style={{ border: '1px solid #000', padding: '2px 4px', textAlign: 'left', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</td>
                      <td style={{ border: '1px solid #000', padding: '2px', textAlign: 'center' }}>{s.teacher}</td>
                      <td style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', fontWeight: 800 }}>{s.count}</td>
                    </tr>
                  ))}
                  <tr style={{ background: '#F8FAFC', fontWeight: 900 }}>
                    <td colSpan={3} style={{ border: '1px solid #000', padding: '2px 6px', textAlign: 'right' }}>
                      รวมเวลาเรียนทั้งสิ้น:
                    </td>
                    <td style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', color: '#0F172A' }}>
                      {totalHours} คาบ
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Official 3 Signatures */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, textAlign: 'center', fontSize: '7.5pt', marginTop: 6 }}>
              <div>
                <div>ลงชื่อ................................................</div>
                <div style={{ marginTop: 2, fontWeight: 700 }}>({roomRoster?.homeroomTeacher || 'ครูประจำชั้น'})</div>
                <div style={{ color: '#475569' }}>ครูประจำชั้น</div>
              </div>
              <div>
                <div>ลงชื่อ................................................</div>
                <div style={{ marginTop: 2, fontWeight: 700 }}>({data.school.acadName || 'นางสาวนริศรา ทำจิตรเหมาะ'})</div>
                <div style={{ color: '#475569' }}>หัวหน้างานวิชาการ</div>
              </div>
              <div>
                <div>ลงชื่อ................................................</div>
                <div style={{ marginTop: 2, fontWeight: 700 }}>({data.school.principalName || 'นายปรัชญา ปรางค์ชัยภูมิ'})</div>
                <div style={{ color: '#475569' }}>ผู้อำนวยการสถานศึกษา</div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Fallback for sub or master views
    return (
      <div className="tt-official-print-doc">
        <div style={{ textAlign: 'center', marginBottom: 10 }}>
          <img
            src="/school_logo_kmd.png"
            alt="ตราโรงเรียน"
            style={{ width: 44, height: 44, objectFit: 'contain', marginBottom: 2 }}
            onError={e => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
          />
          <h3 style={{ margin: 0, fontSize: '14pt', fontWeight: 900 }}>{printTitle}</h3>
          <div style={{ fontSize: '9.5pt', color: '#334155', fontWeight: 700 }}>
            {data.school.name} · สำนักงานเขตพื้นที่การศึกษาประถมศึกษากำแพงเพชร เขต 2 · ภาคเรียนที่ {data.school.semester} ปีการศึกษา {data.school.year}
          </div>
        </div>
        <div className="tt-grid">
          {view === 'master' && renderMasterGrid()}
          {view === 'overview' && renderOverview()}
          {view === 'sub' && renderSubPanel()}
          {view === 'data' && renderDataPanel()}
        </div>
      </div>
    );
  };

    return (
    <div className="tt-root" style={{ background: '#F8FAFC', borderRadius: 18, padding: '1.25rem', border: '1px solid #E2E8F0' }}>
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 5mm 8mm 5mm 8mm;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            overflow: visible !important;
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body > *:not(.tt-print-portal):not(script):not(style) {
            display: none !important;
          }
          body .tt-print-portal {
            display: block !important;
            position: static !important;
            width: 100% !important;
            max-height: 195mm !important;
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            page-break-inside: avoid !important;
            page-break-after: avoid !important;
          }
          .tt-official-print-doc {
            width: 100% !important;
            height: 190mm !important;
            max-height: 195mm !important;
            box-sizing: border-box !important;
            page-break-inside: avoid !important;
            page-break-after: avoid !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
          }
        }
        .tt-print-header { display: none; }
      `}</style>

      {/* Toast Notification */}
      {toastMsg && (
        <div className="tt-no-print" style={{
          marginBottom: 12, padding: '10px 16px', borderRadius: 12,
          background: '#0F172A', color: 'white', fontWeight: 800, fontSize: '0.84rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          boxShadow: '0 8px 20px rgba(15,23,42,0.18)',
        }}>
          <span>{toastMsg}</span>
          <button onClick={() => setToastMsg('')} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}>
            <X size={15} />
          </button>
        </div>
      )}

      {/* Top Action Bar */}
      <div className="tt-no-print" style={{
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap',
        background: 'white', padding: '12px 16px', borderRadius: 14, border: '1px solid #E2E8F0',
      }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontWeight: 900, color: '#0F172A', fontSize: '1.08rem' }}>
            📅 {data.school.name} · {readOnly ? 'ตารางเรียนประจำห้องเรียน (ป.1 - ม.3)' : 'ระบบตารางสอน & จัดสอนแทนอัจฉริยะ'}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 600 }}>
            ภาคเรียนที่ {data.school.semester} ปีการศึกษา {data.school.year} · {readOnly ? 'ข้อมูลล่าสุดจากโรงเรียน (โหมดดูข้อมูล)' : 'ข้อมูลเชื่อมตรงฐานข้อมูลกลาง (Real-time Sync)'}
          </div>
        </div>

        {/* Cloud Status Badge - Admin only */}
        {!readOnly && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 99,
            fontSize: '0.76rem', fontWeight: 800,
            color: cloudStatus === 'error' ? '#B91C1C' : cloudStatus === 'missing' || dirty ? '#92400E' : '#047857',
            background: cloudStatus === 'error' ? '#FEF2F2' : cloudStatus === 'missing' || dirty ? '#FFFBEB' : '#ECFDF5',
            border: `1px solid ${cloudStatus === 'error' ? '#FECACA' : cloudStatus === 'missing' || dirty ? '#FDE68A' : '#A7F3D0'}`,
          }}>
            {cloudStatus === 'error' ? <CloudOff size={14} /> : <Database size={14} />}
            {cloudStatus === 'connecting' && 'กำลังซิงค์ข้อมูลกลาง...'}
            {cloudStatus === 'saving' && 'กำลังบันทึก...'}
            {cloudStatus === 'ready' && (dirty ? 'มีการแก้ไขที่ยังไม่บันทึก' : 'ซิงค์ฐานข้อมูลกลางแล้ว')}
            {cloudStatus === 'missing' && 'ใช้ข้อมูลเริ่มต้น'}
            {cloudStatus === 'error' && 'โหมดออฟไลน์'}
          </span>
        )}

        {!readOnly && (view === 'class' || view === 'master') && (
          <button
            onClick={() => { setSwapMode(!swapMode); setSwapSource(null); }}
            style={{
              background: swapMode ? 'linear-gradient(135deg,#1D4ED8,#2563EB)' : '#EFF6FF',
              color: swapMode ? 'white' : '#1D4ED8',
              border: swapMode ? 'none' : '1px solid #BFDBFE',
              padding: '8px 14px', borderRadius: 10, fontWeight: 800, fontSize: '0.82rem',
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            <ArrowLeftRight size={14} />
            {swapMode ? 'กำลังสลับคาบ (คลิกเพื่อปิด)' : 'โหมดสลับคาบเรียน'}
          </button>
        )}

        {!readOnly && (
          <button
            onClick={() => saveToCloud()}
            disabled={loading || (!dirty && cloudStatus === 'ready')}
            style={{
              background: dirty ? 'linear-gradient(135deg,#EA580C,#F97316)' : '#10B981',
              color: 'white', border: 'none', padding: '8px 16px', borderRadius: 10,
              fontWeight: 800, fontSize: '0.82rem', cursor: loading ? 'wait' : 'pointer',
              opacity: loading || (!dirty && cloudStatus === 'ready') ? 0.7 : 1,
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            <Save size={14} />
            {loading ? 'กำลังบันทึก…' : dirty ? 'บันทึกการแก้ไขขึ้นระบบ' : 'ข้อมูลเป็นปัจจุบัน'}
          </button>
        )}

        <button
          onClick={() => window.print()}
          style={{
            background: '#0F172A', border: 'none', color: 'white',
            padding: '8px 14px', borderRadius: 10, fontWeight: 800, fontSize: '0.82rem',
            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
          }}
        >
          <Printer size={14} /> พิมพ์ A4
        </button>
      </div>

      {/* Conflict Alert Banner if any conflict exists - Admin only */}
      {!readOnly && conflictDetails.length > 0 && (
        <div className="tt-no-print" style={{
          marginBottom: 14, padding: '10px 14px', borderRadius: 12,
          background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B',
          fontSize: '0.82rem', fontWeight: 700,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 900, marginBottom: 4 }}>
            <AlertTriangle size={16} /> พบครูซ้ำคาบในเวลาเดียวกัน ({conflictDetails.length} จุด) — คลิกที่ช่องสีแดงเพื่อเปลี่ยนครูหรือสลับคาบ:
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {conflictDetails.map((c, idx) => (
              <span key={idx} style={{ background: 'white', padding: '2px 8px', borderRadius: 6, border: '1px solid #FCA5A5', fontSize: '0.75rem' }}>
                ⚠️ <strong>{c.teacher}</strong> · วัน{c.day} {c.slotLabel} (ชนกันที่ห้อง {c.roomLabels.join(' และ ')})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Compact Stats Bar - Admin only */}
      {!readOnly ? (
        <div className="tt-no-print" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(125px,1fr))', gap: 8, marginBottom: 14 }}>
          {[
            { label: 'ชั้นเรียน (ป.1–ม.3)', v: `${stats.rooms} ห้อง`, c: '#EA580C' },
            { label: 'ครูผู้สอน', v: `${stats.teachers} ท่าน`, c: '#2563EB' },
            { label: 'รายวิชาทั้งหมด', v: `${stats.subjects} วิชา`, c: '#059669' },
            { label: 'จัดคาบเรียนแล้ว', v: `${stats.filled}/${stats.totalCells} (${stats.pct}%)`, c: '#7C3AED' },
            { label: 'รายการสอนแทน', v: `${stats.subs} คาบ`, c: '#9333EA' },
            { label: 'ตรวจสอบชนคาบ', v: stats.conflicts === 0 ? '✓ ไม่ชนคาบ' : `${stats.conflicts} จุด`, c: stats.conflicts > 0 ? '#EF4444' : '#10B981' },
          ].map(s => (
            <div key={s.label} style={{ background: 'white', padding: '10px 12px', borderRadius: 12, border: '1px solid #E2E8F0', borderLeft: `4px solid ${s.c}` }}>
              <div style={{ fontSize: '1.05rem', fontWeight: 900, color: s.c }}>{s.v}</div>
              <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700 }}>{s.label}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="tt-no-print" style={{
          marginBottom: 14, padding: '10px 16px', borderRadius: 12,
          background: '#FFF7ED', border: '1px solid #FFEDD5', color: '#9A3412',
          fontSize: '0.84rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span>💡 <strong>คำแนะนำสำหรับนักเรียนและผู้ปกครอง:</strong> คลิกเลือกระดับชั้นเรียน (ป.1 – ม.3) ด้านล่างเพื่อดูตารางเรียนประจำสัปดาห์</span>
        </div>
      )}

      {/* Main View Tabs */}
      <div className="tt-no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(readOnly
            ? [
                ['class', <Cal size={15} />, '🏫 ตารางเรียน (รายห้อง ป.1–ม.3)'],
                ['teacher', <Users size={15} />, '👨‍🏫 ตารางสอน (รายครู)'],
              ]
            : [
                ['class', <Cal size={15} />, '🏫 ตารางเรียน (รายห้อง)'],
                ['teacher', <Users size={15} />, '👨‍🏫 ตารางสอน (รายครู)'],
                ['sub', <UserPlus size={15} />, `🔁 จัดสอนแทน (${stats.subs})`],
                ['master', <Grid size={15} />, '📊 ตารางรวมทั้งโรงเรียน'],
                ['overview', <Clock size={15} />, '📈 สรุปภาระงานครู'],
                ['data', <BookOpen size={15} />, '📚 ข้อมูลวิชา/ครู'],
              ]
          ).map(([k, ic, l]: any) => {
            const active = view === k;
            const isSubTab = k === 'sub';
            return (
              <button
                key={k}
                onClick={() => setView(k)}
                style={{
                  padding: '9px 15px',
                  borderRadius: 11,
                  border: active ? 'none' : isSubTab ? '1.5px solid #DDD6FE' : '1px solid #E2E8F0',
                  cursor: 'pointer',
                  fontWeight: 800,
                  fontSize: '0.84rem',
                  background: active
                    ? isSubTab
                      ? 'linear-gradient(135deg,#7C3AED,#9333EA)'
                      : 'linear-gradient(135deg,#0F172A,#1E3A8A)'
                    : isSubTab
                    ? '#F5F3FF'
                    : 'white',
                  color: active ? 'white' : isSubTab ? '#6D28D9' : '#334155',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  boxShadow: active ? '0 4px 12px rgba(15,23,42,0.16)' : 'none',
                }}
              >
                {ic}
                {l}
              </button>
            );
          })}
        </div>

        {/* Backup / Export tools */}
        {!readOnly && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              onClick={exportJson}
              style={{
                background: 'white', color: '#059669', border: '1px solid #A7F3D0',
                padding: '6px 10px', borderRadius: 8, fontWeight: 700, fontSize: '0.75rem',
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
              }}
            >
              <Download size={12} /> สำรองไฟล์ JSON
            </button>
            <label
              style={{
                background: 'white', color: '#2563EB', border: '1px solid #BFDBFE',
                padding: '6px 10px', borderRadius: 8, fontWeight: 700, fontSize: '0.75rem',
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
              }}
            >
              <Upload size={12} /> นำเข้า JSON
              <input
                type="file"
                accept=".json,application/json"
                style={{ display: 'none' }}
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) importJson(f);
                  e.target.value = '';
                }}
              />
            </label>
            <button
              onClick={resetToSeed}
              style={{
                background: 'white', color: '#DC2626', border: '1px solid #FECACA',
                padding: '6px 10px', borderRadius: 8, fontWeight: 700, fontSize: '0.75rem',
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
              }}
            >
              <RotateCcw size={12} /> รีเซ็ตตารางเริ่มต้น
            </button>
          </div>
        )}
      </div>

      {view === 'overview' && (
        <div className="tt-no-print" style={{ marginBottom: 12 }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="🔍 ค้นหาชื่อครู หรือกลุ่มสาระฯ..."
            style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid #CBD5E1', width: '100%', maxWidth: 340, fontWeight: 600 }}
          />
        </div>
      )}

      {/* Main Content Area */}
      <div className="tt-grid">
        {view === 'class' && renderClassGrid()}
        {view === 'teacher' && renderTeacherGrid()}
        {view === 'master' && renderMasterGrid()}
        {view === 'overview' && renderOverview()}
        {view === 'sub' && renderSubPanel()}
        {view === 'data' && renderDataPanel()}
      </div>

      {/* Print Portal */}
      {createPortal(
        <div className="tt-print-portal" style={{ display: 'none' }}>
          {renderOfficialPrintSheet()}
        </div>,
        document.body
      )}

      {/* Smart Cell Editor Modal */}
      {editing && (
        <CellEditor
          data={data}
          editing={editing}
          teacherSlotMap={teacherSlotMap}
          teacherWeeklyLoad={teacherWeeklyLoad}
          onClose={() => setEditing(null)}
          onSave={val => {
            updateCell(cellKey(editing.roomId, editing.slot, editing.day), val);
            setEditing(null);
          }}
          currentCell={data.sched[cellKey(editing.roomId, editing.slot, editing.day)]}
        />
      )}
    </div>
  );
}

// ─── Smart Cell Editor with Real-time Teacher Availability ──────────────────
function CellEditor({
  data,
  editing,
  teacherSlotMap,
  teacherWeeklyLoad,
  onClose,
  onSave,
  currentCell,
}: {
  data: TTData;
  editing: { roomId: string; slot: number; day: string };
  teacherSlotMap: Record<string, { roomId: string; roomLabel: string; subject: string; isSub: boolean }[]>;
  teacherWeeklyLoad: Record<string, { main: number; sub: number }>;
  onClose: () => void;
  onSave: (v: SchedCell | null) => void;
  currentCell?: SchedCell;
}) {
  const [subject, setSubject] = useState(currentCell?.subject || '');
  const [teacher, setTeacher] = useState(currentCell?.teacher || '');
  const [substitute, setSubstitute] = useState(currentCell?.substitute || '');
  const [free, setFree] = useState(!!currentCell?.free);
  const [showAllSubjects, setShowAllSubjects] = useState(false);

  const room = data.rooms.find(r => r.id === editing.roomId);
  const slot = data.slots.find(s => s.id === editing.slot);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Extract grade suffix to filter subjects relevant to this classroom (e.g. ป.4 -> '4', ม.1 -> '7' or general)
  const filteredSubjects = useMemo(() => {
    if (showAllSubjects || !room) return data.subjects;
    const gradeMatch = room.grade.match(/ป\.(\d)/);
    if (!gradeMatch) return data.subjects;
    const gNum = gradeMatch[1];
    const relevant = data.subjects.filter(s => {
      const trailingDigit = s.name.match(/(\d+)$/);
      if (!trailingDigit) return true; // General subject
      return trailingDigit[1] === gNum;
    });
    return relevant.length > 0 ? relevant : data.subjects;
  }, [data.subjects, room, showAllSubjects]);

  // Compute live status for every teacher at (editing.day, editing.slot)
  const teacherOptions = useMemo(() => {
    return data.teachers.map(t => {
      const name = teacherName(t);
      const isPhattaraOff = name.includes('ภัทรสุดา') && (editing.day === 'พฤหัสบดี' || editing.day === 'ศุกร์');
      const busyEntries = (teacherSlotMap[`${name}${SEP}${editing.slot}${SEP}${editing.day}`] || []).filter(
        b => b.roomId !== editing.roomId // ignore current room
      );
      const isSuggested = subject ? !!t.subjects?.includes(subject) : false;
      const weekTotal = (teacherWeeklyLoad[name]?.main || 0) + (teacherWeeklyLoad[name]?.sub || 0);
      const isFree = !isPhattaraOff && busyEntries.length === 0;

      return {
        teacher: t,
        name,
        isPhattaraOff,
        busyEntries,
        isSuggested,
        weekTotal,
        isFree,
      };
    }).sort((a, b) => {
      if (a.isFree !== b.isFree) return a.isFree ? -1 : 1;
      if (a.isSuggested !== b.isSuggested) return a.isSuggested ? -1 : 1;
      return a.weekTotal - b.weekTotal;
    });
  }, [data.teachers, teacherSlotMap, teacherWeeklyLoad, editing, subject]);

  const submit = () => {
    if (free) {
      onSave({ free: true });
    } else {
      onSave({ subject, teacher, substitute: substitute || undefined });
    }
  };

  const quickActivities = ['กิจกรรมแนะแนว', 'ลูกเสือ/เนตรนารี', 'ชุมนุม', 'ตลาดนัดอาชีพ', 'สวดมนต์', 'กิจกรรมตามความสนใจ'];

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.62)', zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'white', borderRadius: 20, padding: '1.5rem',
          maxWidth: 560, width: '100%', boxShadow: '0 30px 60px rgba(0,0,0,0.35)',
          maxHeight: '92vh', overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#FFF7ED', color: '#EA580C', padding: '3px 10px', borderRadius: 99, fontSize: '0.74rem', fontWeight: 800, marginBottom: 4 }}>
              🏫 ชั้น {room?.label} · วัน{editing.day} · {slot?.label} ({slot?.start}–{slot?.end})
            </div>
            <h5 style={{ margin: 0, fontWeight: 900, color: '#0F172A' }}>กำหนดรายวิชา / ครูผู้สอน / สอนแทน</h5>
          </div>
          <button
            onClick={onClose}
            style={{ background: '#F1F5F9', border: 'none', width: 34, height: 34, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={17} />
          </button>
        </div>

        {/* Quick Mode Buttons */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setFree(!free)}
            style={{
              padding: '7px 12px', borderRadius: 10,
              border: free ? 'none' : '1px solid #CBD5E1',
              background: free ? '#475569' : 'white',
              color: free ? 'white' : '#475569',
              fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5,
            }}
          >
            <Coffee size={13} /> {free ? '✓ ตั้งเป็นคาบว่างแล้ว' : 'ตั้งเป็นคาบว่าง'}
          </button>
          {quickActivities.map(act => (
            <button
              key={act}
              type="button"
              onClick={() => {
                setFree(false);
                setSubject(act);
                if (act === 'กิจกรรมแนะแนว' || act === 'ตลาดนัดอาชีพ') {
                  setTeacher('ครูที่ปรึกษา');
                } else if (SHARED_ACTIVITY_NAMES.has(act)) {
                  setTeacher('');
                }
              }}
              style={{
                padding: '6px 10px', borderRadius: 99,
                border: subject === act ? '2px solid #D97706' : '1px solid #FDE68A',
                background: subject === act ? '#FEF3C7' : '#FFFBEB',
                color: '#92400E', fontWeight: 800, fontSize: '0.74rem', cursor: 'pointer',
              }}
            >
              ⭐ {act}
            </button>
          ))}
        </div>

        {!free && (
          <>
            {/* 1. Subject Picker */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label style={{ fontWeight: 800, fontSize: '0.84rem', color: '#1E293B' }}>1. เลือกรายวิชา</label>
              <button
                type="button"
                onClick={() => setShowAllSubjects(!showAllSubjects)}
                style={{ background: 'none', border: 'none', color: '#2563EB', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer' }}
              >
                {showAllSubjects ? 'แสดงเฉพาะวิชาของชั้นนี้' : `แสดงวิชาทั้งหมด (${data.subjects.length})`}
              </button>
            </div>
            <select
              value={subject}
              onChange={e => {
                const nextSubj = e.target.value;
                setSubject(nextSubj);
                // Auto-pick suggested free teacher if teacher is currently empty
                if (!teacher && nextSubj) {
                  const matchFree = teacherOptions.find(o => o.isFree && o.teacher.subjects?.includes(nextSubj));
                  if (matchFree) setTeacher(matchFree.name);
                }
              }}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #CBD5E1', marginBottom: 14, fontWeight: 700, fontSize: '0.88rem' }}
            >
              <option value="">— เลือกรายวิชา —</option>
              {filteredSubjects.map(s => (
                <option key={s.id} value={s.name}>
                  {s.name} ({s.dept})
                </option>
              ))}
            </select>

            {/* 2. Teacher Picker with Live Availability */}
            <label style={{ fontWeight: 800, fontSize: '0.84rem', color: '#1E293B', display: 'block', marginBottom: 6 }}>
              2. เลือกครูผู้สอน (แสดงสถานะว่างจริงในวัน{editing.day} {slot?.label})
            </label>

            {/* Quick 1-Tap Free Teacher Chips */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              {teacherOptions.filter(o => o.isFree).map(o => {
                const isSelected = teacher === o.name;
                return (
                  <button
                    key={o.teacher.id}
                    type="button"
                    onClick={() => setTeacher(isSelected ? '' : o.name)}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 10,
                      border: isSelected ? '2px solid #059669' : o.isSuggested ? '1.5px solid #10B981' : '1px solid #E2E8F0',
                      background: isSelected ? '#059669' : o.isSuggested ? '#ECFDF5' : '#F8FAFC',
                      color: isSelected ? 'white' : '#0F172A',
                      fontWeight: 700,
                      fontSize: '0.76rem',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <span>{isSelected ? '✓' : '🟢'} {o.teacher.first}</span>
                    {o.isSuggested && !isSelected && (
                      <span style={{ fontSize: '0.65rem', color: '#047857', fontWeight: 800 }}>★ตรงวิชา</span>
                    )}
                    <span style={{ fontSize: '0.66rem', opacity: 0.75 }}>({o.weekTotal})</span>
                  </button>
                );
              })}
            </div>

            <select
              value={teacher}
              onChange={e => setTeacher(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #CBD5E1', marginBottom: 14, fontWeight: 700, fontSize: '0.86rem' }}
            >
              <option value="">— ไม่ระบุครู —</option>
              <option value="ครูที่ปรึกษา">👤 ครูที่ปรึกษา</option>
              <optgroup label="🟢 ครูที่ว่างในคาบนี้ (ไม่ชนคาบ)">
                {teacherOptions.filter(o => o.isFree).map(o => (
                  <option key={o.teacher.id} value={o.name}>
                    🟢 {o.name} {o.isSuggested ? '★ แนะนำตรงวิชา' : ''} (สอนรวม {o.weekTotal} คาบ/สัปดาห์)
                  </option>
                ))}
              </optgroup>
              <optgroup label="🔴 ครูที่ติดสอนห้องอื่นในคาบนี้ / หยุดราชการ">
                {teacherOptions.filter(o => !o.isFree).map(o => (
                  <option key={o.teacher.id} value={o.name}>
                    {o.isPhattaraOff
                      ? `⚪ ${o.name} (ปฏิบัติราชการโรงเรียนบ้านคลองไพร พฤ.-ศ.)`
                      : `🔴 ${o.name} — ติดสอนห้อง ${o.busyEntries.map(b => `${b.roomLabel} (${b.subject})`).join(', ')}`}
                  </option>
                ))}
              </optgroup>
            </select>

            {/* 3. Optional Standing Substitute Teacher */}
            <div style={{ background: '#F5F3FF', padding: '10px 12px', borderRadius: 12, border: '1px solid #DDD6FE', marginBottom: 16 }}>
              <label style={{ fontWeight: 800, fontSize: '0.82rem', color: '#6D28D9', display: 'block', marginBottom: 6 }}>
                🔁 มอบหมายครูสอนแทนประจำคาบนี้ (เฉพาะกรณีสอนแทนในตารางหลัก)
              </label>
              <select
                value={substitute}
                onChange={e => setSubstitute(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #C4B5FD', fontWeight: 700, fontSize: '0.84rem' }}
              >
                <option value="">— ไม่มีครูสอนแทนประจำคาบ —</option>
                {teacherOptions
                  .filter(o => o.name !== teacher)
                  .map(o => (
                    <option key={o.teacher.id} value={o.name}>
                      {o.isFree
                        ? `🟢 ${o.name} (ว่างในคาบนี้ · รวม ${o.weekTotal} คาบ)`
                        : `🔴 ${o.name} (ติดสอน ${o.busyEntries.map(b => b.roomLabel).join(', ')})`}
                    </option>
                  ))}
              </select>
            </div>
          </>
        )}

        {/* Footer Actions */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={() => onSave(null)}
            style={{
              flex: 1, padding: '10px 14px', borderRadius: 10,
              border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626',
              fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <Trash2 size={15} /> ล้างช่องนี้
          </button>
          <button
            type="button"
            onClick={submit}
            style={{
              flex: 2, padding: '10px 18px', borderRadius: 10, border: 'none',
              background: 'linear-gradient(135deg,#EA580C,#F97316)', color: 'white',
              fontWeight: 900, fontSize: '0.92rem', cursor: 'pointer',
              boxShadow: '0 6px 16px rgba(234,88,12,0.28)',
            }}
          >
            ✓ ตกลง (อัปเดตลงตาราง)
          </button>
        </div>
      </div>
    </div>
  );
}

const th: React.CSSProperties = {
  padding: '10px 12px',
  background: 'linear-gradient(135deg,#0F172A,#1E3A8A)',
  color: 'white',
  fontWeight: 800,
  fontSize: '0.84rem',
  borderRadius: 0,
};

const td: React.CSSProperties = {
  padding: '10px',
  border: '1px solid #E2E8F0',
  verticalAlign: 'top',
  fontSize: '0.84rem',
  minHeight: 60,
};

// ─── External Export Utilities (Double-Booking & Smart Substitution) ─────────
export interface TimetableSlot {
  day: number; // 0 = จันทร์ ... 4 = ศุกร์
  period: number; // 1 - 7
  subjectCode: string;
  subjectName: string;
  teacherName: string;
  room?: string;
  substituteTeacher?: string;
}

export type SchoolTimetableMap = Record<string, TimetableSlot[]>;

export function findTimetableConflicts(allClassSchedules: SchoolTimetableMap) {
  const occupied = new Map<string, { classId: string; subjectName: string }>();
  const conflicts: Array<{
    day: number;
    period: number;
    teacherName: string;
    classA: string;
    classB: string;
  }> = [];

  for (const [classId, slots] of Object.entries(allClassSchedules)) {
    for (const slot of slots) {
      const activeTeacher = (slot.substituteTeacher || slot.teacherName || '').trim();
      if (!activeTeacher || activeTeacher === '-' || activeTeacher.includes('ชุมนุม')) continue;
      const key = `${slot.day}_${slot.period}_${activeTeacher}`;
      const existing = occupied.get(key);
      if (existing && existing.classId !== classId) {
        conflicts.push({
          day: slot.day,
          period: slot.period,
          teacherName: activeTeacher,
          classA: existing.classId,
          classB: classId,
        });
      } else {
        occupied.set(key, { classId, subjectName: slot.subjectName });
      }
    }
  }
  return conflicts;
}

export function getAvailableSubstituteTeachers(
  day: number,
  period: number,
  allClassSchedules: SchoolTimetableMap,
  allTeachers: string[],
  absentTeacherName: string
): Array<{ teacherName: string; dailyLoad: number }> {
  const busyTeachersInPeriod = new Set<string>();
  const dailyLoadCount = new Map<string, number>();

  allTeachers.forEach(t => dailyLoadCount.set(t, 0));

  for (const slots of Object.values(allClassSchedules)) {
    for (const slot of slots) {
      const activeTeacher = (slot.substituteTeacher || slot.teacherName || '').trim();
      if (!activeTeacher) continue;
      if (slot.day === day) {
        dailyLoadCount.set(activeTeacher, (dailyLoadCount.get(activeTeacher) || 0) + 1);
        if (slot.period === period) {
          busyTeachersInPeriod.add(activeTeacher);
        }
      }
    }
  }

  return allTeachers
    .filter(t => t !== absentTeacherName && !busyTeachersInPeriod.has(t))
    .map(t => ({
      teacherName: t,
      dailyLoad: dailyLoadCount.get(t) || 0,
    }))
    .sort((a, b) => a.dailyLoad - b.dailyLoad);
}

