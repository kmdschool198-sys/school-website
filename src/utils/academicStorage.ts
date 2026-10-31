import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import {
  INITIAL_ACADEMIC_DATA,
  scoreFromParts,
  type ClassAcademicData,
  type AcademicStudentRecord,
  type StudentSubjectScore,
} from '../data/academicData';
import { useSchoolRoster } from './useSchoolRoster';
import {
  applyScoreOverrides,
  evaluationWrite,
  mergeWrite,
  scoreWrite,
  type RosterByClass,
  type ScoreOverrides,
} from './academicScores';
import { activityOverall, courseworkFromDetail, detailHasMarks, itemsLevel, type ActivityMark } from './assessment';

// Teachers' entered scores (see academicScores.ts for the storage model). The local copy is
// only a cache for showing scores while offline; it is never written back as a whole.
const SCORES_DOC = doc(db, 'config', 'academic_scores_2569');
const CACHE_KEY = 'kmd_academic_scores_cache_v2_2569';

function readCache(): ScoreOverrides {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') as ScoreOverrides;
  } catch {
    return {};
  }
}

function writeCache(overrides: ScoreOverrides) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(overrides)); } catch { /* storage full or blocked */ }
}

async function saveCell(write: ScoreOverrides) {
  try {
    await setDoc(SCORES_DOC, { ...write, updatedAt: Date.now() }, { merge: true });
  } catch (err) {
    console.error('Failed to save score to Firestore:', err);
  }
}

export function useAcademicData() {
  const [overrides, setOverrides] = useState<ScoreOverrides>(readCache);
  const { classes: unifiedRosters } = useSchoolRoster();

  useEffect(() => onSnapshot(SCORES_DOC, snap => {
    const server = (snap.exists() ? snap.data() : {}) as ScoreOverrides;
    const next = { scores: server.scores || {}, evaluations: server.evaluations || {} };
    writeCache(next);
    setOverrides(next);
  }), []);

  // live roster order per academic class (classId 'm1' etc.), so new or moved students show up
  const rosterByClass = useMemo<RosterByClass>(() => {
    const map: RosterByClass = {};
    for (const cls of INITIAL_ACADEMIC_DATA) {
      const roster = unifiedRosters.find(r => r.acadId === cls.classId || r.shortClass === cls.shortName);
      if (roster?.students.length) map[cls.classId] = roster.students.map(s => ({ code: s.code, name: s.name, gender: s.gender }));
    }
    return map;
  }, [unifiedRosters]);

  const classesData = useMemo<ClassAcademicData[]>(
    () => applyScoreOverrides(INITIAL_ACADEMIC_DATA, overrides, rosterByClass),
    [overrides, rosterByClass],
  );

  // callbacks read the latest view through a ref so a quick series of edits never uses stale data
  const viewRef = useRef(classesData);
  useEffect(() => { viewRef.current = classesData; }, [classesData]);

  const applyLocally = useCallback((write: ScoreOverrides) => {
    setOverrides(prev => {
      const next = mergeWrite(prev, write);
      writeCache(next);
      return next;
    });
    void saveCell(write);
  }, []);

  /**
   * Save one subject cell. Fields left out of `patch` keep their current value; total and grade
   * are always recomputed for the class level (ประถม: from both terms, มัธยม: this semester).
   * specialGrade: 'ร' / 'มส' to set one, null to clear it, undefined to keep the current one.
   */
  const updateStudentScore = useCallback((
    classId: string,
    studentCode: string,
    subjectCode: string,
    patch: Partial<Omit<StudentSubjectScore, 'total' | 'grade'>> & { specialGrade?: string | null },
  ) => {
    const cls = viewRef.current.find(c => c.classId === classId);
    const prev: Partial<StudentSubjectScore> = cls?.students.find(s => s.code === studentCode)?.scores[subjectCode] || {};
    const hours = cls?.subjects.find(s => s.code === subjectCode)?.hours ?? 40;
    const { specialGrade, ...fields } = patch;
    const keptSpecial = prev.grade === 'ร' || prev.grade === 'มส' ? prev.grade : undefined;
    const special = specialGrade === undefined ? keptSpecial : specialGrade ?? undefined;
    const next = { ...prev, ...fields };
    // indicator marks decide a term's coursework once that term has any; item levels decide the overall level
    if (detailHasMarks(fields.detail?.[0])) next.coursework = courseworkFromDetail(fields.detail![0]);
    if (detailHasMarks(fields.detail?.[1])) next.term2Coursework = courseworkFromDetail(fields.detail![1]);
    const traitLevel = fields.traitItems ? itemsLevel(fields.traitItems) : null;
    if (traitLevel !== null) next.traitScore = traitLevel;
    const readLevel = fields.readItems ? itemsLevel(fields.readItems) : null;
    if (readLevel !== null) next.readThinkScore = readLevel;
    const parts = {
      coursework: next.coursework ?? 0,
      finalExam: next.finalExam ?? 0,
      term2Coursework: next.term2Coursework,
      term2FinalExam: next.term2FinalExam,
    };
    const write: StudentSubjectScore = {
      ...parts,
      ...scoreFromParts(cls?.level ?? 'มัธยม', parts, special),
      traitScore: next.traitScore ?? 3,
      readThinkScore: next.readThinkScore ?? 3,
      attendedHours: next.attendedHours ?? hours,
      detail: next.detail,
      remedial: next.remedial,
      traitItems: next.traitItems,
      readItems: next.readItems,
    };
    // Firestore rejects undefined; optional fields that were never entered are simply left out
    for (const key of Object.keys(write) as (keyof StudentSubjectScore)[]) {
      if (write[key] === undefined) delete write[key];
    }
    applyLocally(scoreWrite(classId, studentCode, subjectCode, write));
  }, [applyLocally]);

  const updateStudentEvaluation = useCallback((
    classId: string,
    studentCode: string,
    traitResult: AcademicStudentRecord['traitResult'],
    readThinkResult: AcademicStudentRecord['readThinkResult'],
    activityResult: AcademicStudentRecord['activityResult'],
  ) => {
    applyLocally(evaluationWrite(classId, studentCode, { traitResult, readThinkResult, activityResult }));
  }, [applyLocally]);

  /** ผ / มผ per activity; the overall activity result follows once every activity is marked */
  const updateStudentActivities = useCallback((classId: string, studentCode: string, activities: Record<string, ActivityMark>) => {
    const cls = viewRef.current.find(c => c.classId === classId);
    const overall = activityOverall(activities, (cls?.activities || []).map(a => a.code));
    const write: ScoreOverrides = { evaluations: { [classId]: { [studentCode]: { activities, ...(overall ? { activityResult: overall } : {}) } } } };
    applyLocally(write);
  }, [applyLocally]);

  return {
    classesData,
    updateStudentScore,
    updateStudentEvaluation,
    updateStudentActivities,
    /** Re-read every entered score from the server. Never deletes or overwrites anyone's data. */
    resetToDefault: async () => {
      const snap = await getDoc(SCORES_DOC);
      const server = (snap.exists() ? snap.data() : {}) as ScoreOverrides;
      const next = { scores: server.scores || {}, evaluations: server.evaluations || {} };
      writeCache(next);
      setOverrides(next);
    },
  };
}
