// Score storage model for ปพ.5 / ปพ.6 (pure functions, no Firebase).
//
// Firestore config/academic_scores_2569 holds only what teachers entered, as nested maps:
//   scores.{classId}.{studentCode}.{subjectCode} = StudentSubjectScore
//   evaluations.{classId}.{studentCode}          = { traitResult, readThinkResult, activityResult }
// Every save writes one leaf with setDoc(..., { merge: true }), so two teachers saving different
// cells at the same time both keep their work, and a stale copy on one device can never
// overwrite the whole school. Class structure (subjects, hours) comes from academicData.ts.
import type { AcademicStudentRecord, ClassAcademicData, StudentSubjectScore } from '../data/academicData';

export type Evaluation = Pick<AcademicStudentRecord, 'traitResult' | 'readThinkResult' | 'activityResult'>;

export interface ScoreOverrides {
  scores?: Record<string, Record<string, Record<string, StudentSubjectScore>>>;
  evaluations?: Record<string, Record<string, Partial<Evaluation>>>;
}

/** Roster students per academic classId, in roster order (from the live school roster). */
export type RosterByClass = Record<string, Array<{ code: string; name: string; gender?: 'male' | 'female' }>>;

/** The write for one score cell: a nested object that setDoc merge applies as a single leaf. */
export function scoreWrite(classId: string, studentCode: string, subjectCode: string, score: StudentSubjectScore): ScoreOverrides {
  return { scores: { [classId]: { [studentCode]: { [subjectCode]: score } } } };
}

export function evaluationWrite(classId: string, studentCode: string, evaluation: Evaluation): ScoreOverrides {
  return { evaluations: { [classId]: { [studentCode]: evaluation } } };
}

/** Same deep merge Firestore applies for setDoc(..., { merge: true }); used for the local copy. */
export function mergeWrite<T extends object>(target: T, write: object): T {
  const out: Record<string, unknown> = { ...(target as Record<string, unknown>) };
  for (const [k, v] of Object.entries(write)) {
    const cur = out[k];
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && cur && typeof cur === 'object' && !Array.isArray(cur)
      ? mergeWrite(cur as object, v as object)
      : v;
  }
  return out as T;
}

/**
 * Class data as teachers see it: bundled classes, students in live roster order (students missing
 * from the bundle are added with no scores), then every entered score and evaluation on top.
 */
export function applyScoreOverrides(base: ClassAcademicData[], overrides: ScoreOverrides, roster: RosterByClass = {}): ClassAcademicData[] {
  return base.map(cls => {
    const rosterStudents = roster[cls.classId];
    const students: AcademicStudentRecord[] = rosterStudents?.length
      ? rosterStudents.map((rs, idx) => {
        const existing = cls.students.find(s => s.code === rs.code) || cls.students.find(s => s.name.trim() === rs.name.trim());
        return existing
          ? { ...existing, no: idx + 1, code: rs.code || existing.code, name: rs.name || existing.name, gender: rs.gender || existing.gender }
          : { no: idx + 1, code: rs.code, name: rs.name, gender: rs.gender || 'male', scores: {}, traitResult: 'ผ่าน', readThinkResult: 'ผ่าน', activityResult: 'ผ่าน' };
      })
      : cls.students;

    const classScores = overrides.scores?.[cls.classId] || {};
    const classEvals = overrides.evaluations?.[cls.classId] || {};
    return {
      ...cls,
      students: students.map(st => ({
        ...st,
        ...(classEvals[st.code] || {}),
        scores: { ...st.scores, ...(classScores[st.code] || {}) },
      })),
    };
  });
}
