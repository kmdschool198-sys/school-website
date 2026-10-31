import {
  doc,
  getDoc,
  setDoc,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { UnifiedClassRoster } from '../utils/useSchoolRoster';
import type { BehaviorLogEntry } from '../pages/BehaviorPage';
import type { ClassAcademicData } from '../data/academicData';

// Daily records the old lunch and duty pages wrote to config/daily_lunch and config/daily_duty.
// Those pages are now plain attendance reports, but the saved records stay readable here.
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

// ==========================================
// CENTRAL FIRESTORE CONSTANTS & TYPES
// ==========================================
export const COLLECTIONS = {
  CONFIG: 'config',
  ATTENDANCE: 'attendance',
  BEHAVIOR_LOGS: 'config/behavior_logs',
  DAILY_DUTY: 'config/daily_duty',
  DAILY_LUNCH: 'config/daily_lunch',
  ACADEMIC_DATA: 'config/academic_data_2569',
  ATTENDANCE_CLASSES: 'config/attendance_classes',
  TIMETABLE: 'config/timetable',
  PERSONNEL: 'personnel',
  POSTS: 'posts',
  ACTIVITIES: 'activities',
  CLUBS: 'clubs',
} as const;

// In-memory runtime cache for DMC student rosters to prevent redundant reads
let cachedRosters: UnifiedClassRoster[] | null = null;
let lastRosterFetch = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 minute local memory cache

// ==========================================
// 1. DMC STUDENTS & ROSTER SERVICE
// ==========================================

/**
 * Fetch and cache unified student roster across all classrooms.
 * Optimizes read quota by reusing in-memory cache within TTL.
 */
export async function getCachedRoster(forceRefresh = false): Promise<UnifiedClassRoster[] | null> {
  const now = Date.now();
  if (!forceRefresh && cachedRosters && (now - lastRosterFetch) < CACHE_TTL_MS) {
    return cachedRosters;
  }

  try {
    const snap = await getDoc(doc(db, 'config', 'attendance_classes'));
    if (snap.exists()) {
      const data = snap.data();
      if (Array.isArray(data.classes)) {
        cachedRosters = data.classes as UnifiedClassRoster[];
        lastRosterFetch = now;
        return cachedRosters;
      }
    }
  } catch (err) {
    console.error('[firestoreService] Failed to fetch roster:', err);
  }
  return cachedRosters;
}

/**
 * Batch write/update student roster in an atomic transaction
 */
export async function batchSaveClassRoster(classes: any[]): Promise<boolean> {
  const batch = writeBatch(db);
  const now = Date.now();
  const classesRef = doc(db, 'config', 'attendance_classes');

  batch.set(classesRef, {
    classes,
    updatedAt: now,
  }, { merge: true });

  try {
    await batch.commit();
    cachedRosters = null; // Invalidate cache
    return true;
  } catch (err) {
    console.error('[firestoreService] batchSaveClassRoster failed:', err);
    throw err;
  }
}

// ==========================================
// 2. BATCH WRITE FOR /porpor5 & ACADEMICS
// ==========================================

export async function saveAcademicClassData(classesData: ClassAcademicData[]): Promise<boolean> {
  try {
    const academicRef = doc(db, 'config', 'academic_data_2569');
    await setDoc(academicRef, {
      classes: classesData,
      updatedAt: Date.now(),
    }, { merge: true });
    return true;
  } catch (err) {
    console.error('[firestoreService] saveAcademicClassData failed:', err);
    throw err;
  }
}

// ==========================================
// 3. BATCH WRITE FOR 11 ZONES & DAILY DUTY
// ==========================================

export async function saveDailyDutyInspection(date: string, meta: DailyDutyMeta): Promise<boolean> {
  try {
    const dutyRef = doc(db, 'config', 'daily_duty');
    await setDoc(dutyRef, {
      metaMap: {
        [date]: { ...meta, updatedAt: Date.now() }
      },
      lastUpdatedDate: date,
      updatedAt: Date.now(),
    }, { merge: true });
    return true;
  } catch (err) {
    console.error('[firestoreService] saveDailyDutyInspection failed:', err);
    throw err;
  }
}

// ==========================================
// 4. BATCH WRITE FOR DAILY LUNCH
// ==========================================

export async function saveDailyLunchMenu(date: string, meta: DailyLunchMeta): Promise<boolean> {
  try {
    const lunchRef = doc(db, 'config', 'daily_lunch');
    await setDoc(lunchRef, {
      metaMap: {
        [date]: { ...meta, updatedAt: Date.now() }
      },
      lastUpdatedDate: date,
      updatedAt: Date.now(),
    }, { merge: true });
    return true;
  } catch (err) {
    console.error('[firestoreService] saveDailyLunchMenu failed:', err);
    throw err;
  }
}

// ==========================================
// 5. BEHAVIOR LOG CRUD & REPUTATION
// ==========================================

export async function saveBehaviorLogs(logs: BehaviorLogEntry[]): Promise<boolean> {
  try {
    const behaviorRef = doc(db, 'config', 'behavior_logs');
    await setDoc(behaviorRef, {
      logs,
      updatedAt: Date.now(),
    }, { merge: true });
    return true;
  } catch (err) {
    console.error('[firestoreService] saveBehaviorLogs failed:', err);
    throw err;
  }
}

// ==========================================
// 6. HELPER COMPOSITE FUNCTION FOR /print-hub
// Pulls unified data (Roster + PorPor + Behavior + Lunch + Duty)
// ==========================================

export interface CompositePrintHubData {
  classId: string;
  date: string;
  attendanceDoc?: DocumentData | null;
  behaviorLogs: BehaviorLogEntry[];
  dutyMeta?: DailyDutyMeta | null;
  lunchMeta?: DailyLunchMeta | null;
  academicClass?: ClassAcademicData | null;
  timestamp: number;
}

export async function getPrintHubCompositeData(classId: string, date: string): Promise<CompositePrintHubData> {
  try {
    const [attSnap, behSnap, dutySnap, lunchSnap, acadSnap] = await Promise.all([
      getDoc(doc(db, 'attendance', `${classId}_${date}`)),
      getDoc(doc(db, 'config', 'behavior_logs')),
      getDoc(doc(db, 'config', 'daily_duty')),
      getDoc(doc(db, 'config', 'daily_lunch')),
      getDoc(doc(db, 'config', 'academic_data_2569')),
    ]);

    const behData = behSnap.exists() ? (behSnap.data()?.logs as BehaviorLogEntry[] || []) : [];
    const dutyMap = dutySnap.exists() ? (dutySnap.data()?.metaMap || {}) : {};
    const lunchMap = lunchSnap.exists() ? (lunchSnap.data()?.metaMap || {}) : {};
    const acadClasses = acadSnap.exists() ? (acadSnap.data()?.classes as ClassAcademicData[] || []) : [];

    const matchedAcadClass = acadClasses.find(c => c.classId === classId || (c as any).shortName === classId);

    return {
      classId,
      date,
      attendanceDoc: attSnap.exists() ? attSnap.data() : null,
      behaviorLogs: behData.filter(b => b.classId === classId || !b.classId),
      dutyMeta: dutyMap[date] || null,
      lunchMeta: lunchMap[date] || null,
      academicClass: matchedAcadClass || null,
      timestamp: Date.now(),
    };
  } catch (err) {
    console.error('[firestoreService] Failed to get composite print data:', err);
    return {
      classId,
      date,
      behaviorLogs: [],
      timestamp: Date.now(),
    };
  }
}
