import { useState, useEffect, useCallback, useMemo } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import {
  INITIAL_ACADEMIC_DATA,
  scoreToGrade,
  type ClassAcademicData,
  type AcademicStudentRecord,
} from '../data/academicData';
import { useSchoolRoster } from './useSchoolRoster';

const STORAGE_KEY = 'kmd_academic_data_v1_2569';

export function loadAcademicData(): ClassAcademicData[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL_ACADEMIC_DATA;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    return INITIAL_ACADEMIC_DATA;
  } catch {
    return INITIAL_ACADEMIC_DATA;
  }
}

export async function saveAcademicData(data: ClassAcademicData[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    window.dispatchEvent(new Event('kmd-academic-updated'));
  } catch (e) {
    console.error('Failed to save academic data locally', e);
  }

  try {
    await setDoc(doc(db, 'config', 'academic_data_2569'), {
      classes: data,
      updatedAt: Date.now(),
    }, { merge: true });
  } catch (err) {
    console.error('Failed to save academic data to Firestore:', err);
  }
}

export async function resetAcademicData(): Promise<ClassAcademicData[]> {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event('kmd-academic-updated'));
  try {
    await setDoc(doc(db, 'config', 'academic_data_2569'), {
      classes: INITIAL_ACADEMIC_DATA,
      updatedAt: Date.now(),
    }, { merge: true });
  } catch (err) {
    console.error('Failed to reset academic data on Firestore:', err);
  }
  return INITIAL_ACADEMIC_DATA;
}

export function useAcademicData() {
  const [rawClassesData, setRawClassesData] = useState<ClassAcademicData[]>(loadAcademicData);
  const { classes: unifiedRosters } = useSchoolRoster();

  // Listen to Firestore config/academic_data_2569 in realtime
  useEffect(() => {
    return onSnapshot(doc(db, 'config', 'academic_data_2569'), snap => {
      if (snap.exists()) {
        const d = snap.data();
        if (Array.isArray(d.classes) && d.classes.length > 0) {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(d.classes));
          } catch { /* ignore */ }
          setRawClassesData(d.classes);
        }
      }
    });
  }, []);

  useEffect(() => {
    const handler = () => setRawClassesData(loadAcademicData());
    window.addEventListener('kmd-academic-updated', handler);
    return () => window.removeEventListener('kmd-academic-updated', handler);
  }, []);

  // Dynamically synchronize each class's student list with the live unified roster
  // while preserving every student's real PorPor 5 / PorPor 6 scores!
  const classesData = useMemo<ClassAcademicData[]>(() => {
    return rawClassesData.map(cls => {
      const roster = unifiedRosters.find(
        r => r.acadId === cls.classId || r.shortClass === cls.shortName
      );
      if (!roster || roster.students.length === 0) return cls;

      const syncedStudents: AcademicStudentRecord[] = roster.students.map((rs, idx) => {
        const existing =
          cls.students.find(s => s.code === rs.code) ||
          cls.students.find(s => s.name.trim() === rs.name.trim());

        if (existing) {
          return {
            ...existing,
            no: idx + 1,
            code: rs.code || existing.code,
            name: rs.name || existing.name,
            gender: rs.gender,
          };
        }

        // If a new student was added in ManageRoster/Firestore, build default passing scores
        const defaultScores: AcademicStudentRecord['scores'] = {};
        for (const subj of cls.subjects) {
          defaultScores[subj.code] = {
            coursework: 55,
            finalExam: 20,
            total: 75,
            grade: '3.5',
            attendedHours: subj.hours,
            traitScore: 3,
            readThinkScore: 3,
          };
        }

        return {
          no: idx + 1,
          code: rs.code,
          name: rs.name,
          gender: rs.gender,
          scores: defaultScores,
          traitResult: 'ดีเยี่ยม',
          readThinkResult: 'ดีเยี่ยม',
          activityResult: 'ผ่าน',
        };
      });

      return {
        ...cls,
        students: syncedStudents,
      };
    });
  }, [rawClassesData, unifiedRosters]);

  const updateClassData = useCallback((classId: string, updater: (prev: ClassAcademicData) => ClassAcademicData) => {
    setRawClassesData(prev => {
      const next = prev.map(c => (c.classId === classId ? updater(c) : c));
      saveAcademicData(next);
      return next;
    });
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
    updateClassData(classId, cls => {
      const total = Math.max(0, Math.min(100, Math.round(coursework + finalExam)));
      const grade = scoreToGrade(total, specialGrade);
      return {
        ...cls,
        students: cls.students.map((st: AcademicStudentRecord) => {
          if (st.code !== studentCode) return st;
          // no previous score: start from zero marks, not an assumed pass
          const prevSubj = st.scores[subjectCode] || {
            coursework: 0,
            finalExam: 0,
            total: 0,
            grade: '',
            attendedHours: 40,
            traitScore: 3,
            readThinkScore: 3,
          };
          return {
            ...st,
            scores: {
              ...st.scores,
              [subjectCode]: {
                ...prevSubj,
                coursework,
                finalExam,
                total,
                grade,
                traitScore: traitScore ?? prevSubj.traitScore,
                readThinkScore: readThinkScore ?? prevSubj.readThinkScore,
                attendedHours: attendedHours ?? prevSubj.attendedHours,
              },
            },
          };
        }),
      };
    });
  }, [updateClassData]);

  const updateStudentEvaluation = useCallback((
    classId: string,
    studentCode: string,
    traitResult: AcademicStudentRecord['traitResult'],
    readThinkResult: AcademicStudentRecord['readThinkResult'],
    activityResult: AcademicStudentRecord['activityResult'],
  ) => {
    updateClassData(classId, cls => ({
      ...cls,
      students: cls.students.map(st =>
        st.code === studentCode
          ? { ...st, traitResult, readThinkResult, activityResult }
          : st
      ),
    }));
  }, [updateClassData]);

  return {
    classesData,
    setClassesData: (next: ClassAcademicData[]) => {
      saveAcademicData(next);
      setRawClassesData(next);
    },
    updateClassData,
    updateStudentScore,
    updateStudentEvaluation,
    resetToDefault: async () => {
      const d = await resetAcademicData();
      setRawClassesData(d);
    },
  };
}
