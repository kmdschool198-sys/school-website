import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import {
  INITIAL_ACADEMIC_DATA,
  scoreToGrade,
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

  const updateStudentScore = useCallback((
    classId: string,
    studentCode: string,
    subjectCode: string,
    coursework: number,
    finalExam: number,
    specialGrade?: string,
    traitScore?: number,
    readThinkScore?: number,
    attendedHours?: number,
  ) => {
    const cls = viewRef.current.find(c => c.classId === classId);
    const prev: Partial<StudentSubjectScore> = cls?.students.find(s => s.code === studentCode)?.scores[subjectCode] || {};
    const hours = cls?.subjects.find(s => s.code === subjectCode)?.hours ?? 40;
    const total = Math.max(0, Math.min(100, Math.round(coursework + finalExam)));
    applyLocally(scoreWrite(classId, studentCode, subjectCode, {
      coursework,
      finalExam,
      total,
      grade: scoreToGrade(total, specialGrade),
      traitScore: traitScore ?? prev.traitScore ?? 3,
      readThinkScore: readThinkScore ?? prev.readThinkScore ?? 3,
      attendedHours: attendedHours ?? prev.attendedHours ?? hours,
    }));
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

  return {
    classesData,
    updateStudentScore,
    updateStudentEvaluation,
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
