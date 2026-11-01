// Per-student results over a whole year and earlier years (pure functions, no Firebase).
// ประถม: every subject runs all year (ภาค 1 /50 + ภาค 2 /50, one grade).
// มัธยม: each semester has its own subjects (and codes); a subject's semester comes from
// subject.semester, or the class's semester when the subject does not say.
import type { AcademicStudentRecord, AcademicSubject, ClassAcademicData, StudentSubjectScore } from '../data/academicData';

export interface SubjectRow {
  subject: AcademicSubject;
  term: '1' | '2' | 'ปี';
  score?: StudentSubjectScore;
  /** grade that counts: the remedial result when there is one */
  grade: string;
}

export const subjectTerm = (cls: Pick<ClassAcademicData, 'semester'>, subject: AcademicSubject) =>
  (subject.semester || cls.semester || '1') as '1' | '2';

const counted = (sc: StudentSubjectScore | undefined) => sc?.remedial?.grade || sc?.grade || '';

/** Rows of one student's year, grouped by term; ประถม subjects are one yearly row each */
export function yearRows(cls: ClassAcademicData, student: Pick<AcademicStudentRecord, 'scores'>): SubjectRow[] {
  return cls.subjects.map(subject => {
    const score = student.scores[subject.code];
    const term = cls.level === 'ประถม' ? 'ปี' as const : subjectTerm(cls, subject);
    return { subject, term, score, grade: counted(score) };
  });
}

/**
 * Credit-weighted GPA over subjects with a numeric grade (0 included). Subjects still waiting
 * for a result (blank, ร, มส) are left out and counted in `pending`, so an unfinished year is
 * not shown as a low GPA.
 */
export function gpaOf(rows: Pick<SubjectRow, 'grade' | 'subject'>[]): { gpa: number | null; credits: number; pending: number } {
  let credits = 0;
  let points = 0;
  let pending = 0;
  for (const r of rows) {
    const g = Number(r.grade);
    if (r.grade === '' || Number.isNaN(g)) { pending++; continue; }
    credits += r.subject.credits;
    points += r.subject.credits * g;
  }
  return { gpa: credits ? Math.round((points / credits) * 100) / 100 : null, credits, pending };
}

/** Where a student code appears in a year's saved scores: { classId, scores } or null */
export function findStudentInYear(
  saved: Record<string, Record<string, Record<string, StudentSubjectScore>>> | undefined,
  studentCode: string,
): { classId: string; scores: Record<string, StudentSubjectScore> } | null {
  for (const [classId, students] of Object.entries(saved || {})) {
    if (students?.[studentCode]) return { classId, scores: students[studentCode] };
  }
  return null;
}

/** Years to look back from the current one, newest first (Thai years as strings) */
export const yearsBack = (current: string, count: number) =>
  Array.from({ length: count }, (_, i) => String(Number(current) - i - 1));
