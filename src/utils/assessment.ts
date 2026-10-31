// SGS-style assessment rules (pure functions, no Firebase), following the SGS teacher manual:
// - each subject has full marks per indicator: S1-S9 before the midterm, the midterm,
//   S10-S18 after it, and the final exam; together they are the subject's 100% (ประถม: 50 per term)
// - a mark can never be higher than its full mark
// - grades 0 / ร / มส and activity มผ are fixed on a separate "ผลการแก้ตัว" record once entry is
//   closed; the original grade stays on file
// Plans live in Firestore config/assessment_plans_2569, entry status in config/grading_status_2569.
import type { ScoreScheme } from '../data/academicData';

export const MAX_INDICATORS_PER_HALF = 9; // S1-S9 before the midterm, S10-S18 after (SGS)

/** Full marks for one term of one subject */
export interface TermPlan {
  /** S1-S9: full mark of each indicator recorded before the midterm */
  before: number[];
  /** กลางภาค (0 when the subject has no midterm) */
  midterm: number;
  /** S10-S18: full mark of each indicator recorded after the midterm */
  after: number[];
  /** ปลายภาค; always the level's final-exam share (มัธยม 30, ประถม 15) */
  final: number;
}

/** ประถม: [term 1, term 2]; มัธยม: [this semester] */
export type SubjectPlan = TermPlan[];

/** Marks a student got, same shape as the plan; null = not entered yet */
export interface TermDetail {
  before: (number | null)[];
  midterm: number | null;
  after: (number | null)[];
}

export const emptyTermPlan = (scheme: ScoreScheme): TermPlan => ({ before: [], midterm: 0, after: [], final: scheme.finalMax });

export const termCount = (scheme: ScoreScheme) => (scheme.yearly ? 2 : 1);

const sum = (xs: (number | null | undefined)[]) => xs.reduce<number>((n, x) => n + (Number(x) || 0), 0);

/** Full marks of the coursework part (indicators + midterm) */
export const courseworkFull = (plan: TermPlan) => sum(plan.before) + plan.midterm + sum(plan.after);

/** Problems with a plan, in Thai, empty when it can be saved */
export function planErrors(plan: TermPlan, scheme: ScoreScheme): string[] {
  const errors: string[] = [];
  if (plan.before.length > MAX_INDICATORS_PER_HALF || plan.after.length > MAX_INDICATORS_PER_HALF) {
    errors.push(`ตัวชี้วัดก่อนหรือหลังกลางภาคได้ไม่เกิน ${MAX_INDICATORS_PER_HALF} ช่อง`);
  }
  if ([...plan.before, ...plan.after, plan.midterm].some(x => !Number.isFinite(x) || x < 0)) {
    errors.push('คะแนนเต็มต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป');
  }
  if ([...plan.before, ...plan.after].some(x => x === 0)) errors.push('ตัวชี้วัดที่ใช้ต้องมีคะแนนเต็มมากกว่า 0');
  const cw = courseworkFull(plan);
  if (cw !== scheme.courseworkMax) {
    errors.push(`คะแนนระหว่างเรียน (ตัวชี้วัด + กลางภาค) รวม ${cw} ต้องเท่ากับ ${scheme.courseworkMax}`);
  }
  if (plan.final !== scheme.finalMax) errors.push(`ปลายภาคต้องเต็ม ${scheme.finalMax}`);
  return errors;
}

/** Clamp each mark to its full mark; keeps the detail the same length as the plan */
export function fitDetail(detail: Partial<TermDetail> | undefined, plan: TermPlan): TermDetail {
  const fit = (marks: (number | null)[] | undefined, fulls: number[]) => fulls.map((full, i) => {
    const v = marks?.[i];
    return v === null || v === undefined || !Number.isFinite(v) ? null : Math.max(0, Math.min(full, v));
  });
  const mid = detail?.midterm;
  return {
    before: fit(detail?.before, plan.before),
    midterm: plan.midterm > 0 && mid !== null && mid !== undefined && Number.isFinite(mid) ? Math.max(0, Math.min(plan.midterm, mid)) : null,
    after: fit(detail?.after, plan.after),
  };
}

/** True once any indicator or midterm mark of the term is entered */
export const detailHasMarks = (detail: TermDetail | undefined) =>
  !!detail && [...detail.before, detail.midterm, ...detail.after].some(x => typeof x === 'number');

/** Coursework mark from the indicator marks (what goes into coursework / term2Coursework) */
export const courseworkFromDetail = (detail: TermDetail) =>
  Math.round((sum(detail.before) + (detail.midterm ?? 0) + sum(detail.after)) * 10) / 10;

// ── ผลการแก้ตัว ──────────────────────────────────────────────

export type RemedialType = 'แก้ตัว' | 'เรียนซ้ำ';

export interface Remedial {
  grade: string;
  type: RemedialType;
  date: string;
  by: string;
}

export const NEEDS_REMEDIAL = ['0', 'ร', 'มส'] as const;

export const needsRemedial = (grade: string | undefined) => (NEEDS_REMEDIAL as readonly string[]).includes(grade || '');

/**
 * Grades a remedial result may take. 0 and มส fixed by แก้ตัว go up to 1; ร is graded on the
 * finished work (0-4); เรียนซ้ำ (retaking the subject) is graded normally (0-4).
 */
export function remedialGradeOptions(original: string, type: RemedialType): string[] {
  const all = ['0', '1', '1.5', '2', '2.5', '3', '3.5', '4'];
  if (type === 'เรียนซ้ำ' || original === 'ร') return all;
  return ['0', '1'];
}

// ── คุณลักษณะ 8 ข้อ / อ่าน คิด วิเคราะห์ เขียน 5 ข้อ ────────────────

export const TRAIT_ITEMS = [
  'รักชาติ ศาสน์ กษัตริย์', 'ซื่อสัตย์ สุจริต', 'มีวินัย', 'ใฝ่เรียนรู้',
  'อยู่อย่างพอเพียง', 'มุ่งมั่นในการทำงาน', 'รักความเป็นไทย', 'มีจิตสาธารณะ',
] as const;

export const READ_ITEMS = [
  'อ่านค้นคว้า', 'จับประเด็น', 'วิเคราะห์', 'ประเมินค่า', 'เขียนสื่อสาร',
] as const;

export const LEVEL_LABELS = ['ไม่ผ่าน', 'ผ่าน', 'ดี', 'ดีเยี่ยม'] as const;

/** Overall level 0-3 from item levels: the rounded mean of the items entered; null when none */
export function itemsLevel(items: (number | null | undefined)[] | undefined): number | null {
  const given = (items || []).filter((x): x is number => typeof x === 'number');
  if (!given.length) return null;
  return Math.max(0, Math.min(3, Math.round(sum(given) / given.length)));
}

// ── กิจกรรมพัฒนาผู้เรียน ─────────────────────────────────────

export type ActivityMark = 'ผ' | 'มผ';

/** ผ่าน only when every activity of the class is ผ; null until all are marked */
export function activityOverall(marks: Record<string, ActivityMark> | undefined, activityCodes: string[]): 'ผ่าน' | 'ไม่ผ่าน' | null {
  if (!activityCodes.length) return null;
  const values = activityCodes.map(code => marks?.[code]);
  if (values.some(v => v === 'มผ')) return 'ไม่ผ่าน';
  return values.every(v => v === 'ผ') ? 'ผ่าน' : null;
}
