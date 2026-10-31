// Auto-generated from C:\Users\KruJames\Desktop\ตัดเกรดนักเรียน ปลายภาคเรียน 1-2569 (งานวัดผล)
// Contains real student rosters (ข้อมูลนักเรียน.xlsx) and real PorPor 5 / PorPor 6 scores (1/2569)
// ประถม term-1 scores were halved to the school's ปพ.5 ประถม scale (เก็บ 35 + ปลายภาค 15 per term);
// their grades are blank until term 2 is entered, since ประถม is graded on the year total.

import type { ActivityMark, Remedial, TermDetail } from '../utils/assessment';

export interface AcademicSubject {
  code: string;
  name: string;
  type: 'พื้นฐาน' | 'เพิ่มเติม';
  group: string;
  credits: number;
  hours: number;
  teacher: string;
}

export interface StudentSubjectScore {
  coursework: number;     // คะแนนเก็บระหว่างภาค (มัธยม เต็ม 70 · ประถม ภาคเรียนที่ 1 เต็ม 35)
  finalExam: number;      // คะแนนสอบปลายภาค (มัธยม เต็ม 30 · ประถม ภาคเรียนที่ 1 เต็ม 15)
  term2Coursework?: number; // ประถมเท่านั้น: คะแนนเก็บภาคเรียนที่ 2 (เต็ม 35)
  term2FinalExam?: number;  // ประถมเท่านั้น: สอบปลายภาค ภาคเรียนที่ 2 (เต็ม 15)
  total: number;          // คะแนนรวม: มัธยม = ภาคนี้ (เต็ม 100) · ประถม = ทั้งปี (เต็ม 100) หรือภาค 1 (เต็ม 50) ถ้ายังไม่มีภาค 2
  grade: string;          // 4, 3.5, 3, 2.5, 2, 1.5, 1, 0, ร, มส
  attendedHours: number;  // เวลาเรียนที่มาจริง
  traitScore: number;     // คุณลักษณะอันพึงประสงค์ (0-3)
  readThinkScore: number; // อ่าน คิด วิเคราะห์และเขียน (0-3)
  /** marks per indicator when the subject has a full-mark plan: [term 1] or [term 1, term 2] (ประถม) */
  detail?: TermDetail[];
  /** ผลการแก้ตัว / เรียนซ้ำ; `grade` keeps the original result */
  remedial?: Remedial;
  traitItems?: (number | null)[]; // คุณลักษณะ 8 ข้อ (0-3); traitScore follows them when set
  readItems?: (number | null)[];  // อ่าน คิด วิเคราะห์ เขียน 5 ข้อ (0-3); readThinkScore follows them when set
}

export interface AcademicStudentRecord {
  no: number;
  code: string;
  name: string;
  gender: 'male' | 'female';
  scores: Record<string, StudentSubjectScore>;
  traitResult: 'ดีเยี่ยม' | 'ดี' | 'ผ่าน' | 'ไม่ผ่าน';
  readThinkResult: 'ดีเยี่ยม' | 'ดี' | 'ผ่าน' | 'ไม่ผ่าน';
  activityResult: 'ผ่าน' | 'ไม่ผ่าน';
  /** ผ / มผ per activity code (แนะแนว, ลูกเสือ, ชุมนุม, กิจกรรมเพื่อสังคม) */
  activities?: Record<string, ActivityMark>;
}

export interface ClassAcademicData {
  classId: string;
  shortName: string;
  className: string;
  level: 'ประถม' | 'มัธยม';
  room: number;
  semester: string;
  year: string;
  schoolName: string;
  affiliation: string;
  director: string;
  homeroomTeachers: string[];
  subjects: AcademicSubject[];
  activities: Array<{ code: string; name: string; hours: number }>;
  students: AcademicStudentRecord[];
}

export const SUBJECT_GROUPS = [
  'ทั้งหมด (ทุกกลุ่มสาระฯ)',
  'ภาษาไทย (พื้นฐาน)',
  'คณิตศาสตร์ (พื้นฐาน)',
  'คณิตศาสตร์ (เพิ่มเติม)',
  'วิทยาศาสตร์ฯ (พื้นฐาน)',
  'วิทยาศาสตร์ฯ (เพิ่มเติม)',
  'สังคมศึกษาฯ (พื้นฐาน)',
  'สุขศึกษาฯ (พื้นฐาน)',
  'ศิลปะ (พื้นฐาน)',
  'การงานอาชีพฯ (พื้นฐาน)',
  'การงานอาชีพฯ (เพิ่มเติม)',
  'ภาษาต่างประเทศ (พื้นฐาน)',
  'ภาษาต่างประเทศ (เพิ่มเติม)',
  'กิจกรรมพัฒนาผู้เรียน',
] as const;

/**
 * How a subject is scored, by level (แบบ ปพ.5 ของโรงเรียน):
 * - มัธยม: graded every semester, เก็บ 70 + ปลายภาค 30 = 100, weighted by หน่วยกิต
 * - ประถม: graded once a year, each term เก็บ 35 + ปลายภาค 15 = 50, two terms = 100,
 *   weighted by น้ำหนัก (ชั่วโมงต่อปี ÷ 40)
 */
export interface ScoreScheme {
  courseworkMax: number;
  finalMax: number;
  /** true when the grade comes from both terms together */
  yearly: boolean;
  weightLabel: 'หน่วยกิต' | 'น้ำหนัก';
}

export function scoreScheme(level: ClassAcademicData['level']): ScoreScheme {
  return level === 'ประถม'
    ? { courseworkMax: 35, finalMax: 15, yearly: true, weightLabel: 'น้ำหนัก' }
    : { courseworkMax: 70, finalMax: 30, yearly: false, weightLabel: 'หน่วยกิต' };
}

export type ScoreParts = Pick<StudentSubjectScore, 'coursework' | 'finalExam' | 'term2Coursework' | 'term2FinalExam'>;

const clampScore = (v: number) => Math.max(0, Math.min(100, Math.round(v * 10) / 10));

/**
 * Total and grade for one subject. ประถม gets no grade until term 2 is entered
 * (its term-1 total out of 50 is kept so teachers see progress); ร/มส always apply.
 */
export function scoreFromParts(level: ClassAcademicData['level'], parts: ScoreParts, special?: string): { total: number; grade: string } {
  const term1 = parts.coursework + parts.finalExam;
  if (!scoreScheme(level).yearly) {
    const total = clampScore(term1);
    return { total, grade: scoreToGrade(total, special) };
  }
  const hasTerm2 = parts.term2Coursework !== undefined || parts.term2FinalExam !== undefined;
  const total = clampScore(term1 + (parts.term2Coursework ?? 0) + (parts.term2FinalExam ?? 0));
  if (special === 'ร' || special === 'มส') return { total, grade: special };
  return { total, grade: hasTerm2 ? scoreToGrade(total) : '' };
}

/** Coursework and final-exam marks as % of their full marks (ประถม counts the terms entered so far) */
export function scorePercents(level: ClassAcademicData['level'], sc: ScoreParts): { courseworkPct: number; finalPct: number } {
  const scheme = scoreScheme(level);
  const hasTerm2 = scheme.yearly && (sc.term2Coursework !== undefined || sc.term2FinalExam !== undefined);
  const terms = hasTerm2 ? 2 : 1;
  const cw = sc.coursework + (hasTerm2 ? sc.term2Coursework ?? 0 : 0);
  const fin = sc.finalExam + (hasTerm2 ? sc.term2FinalExam ?? 0 : 0);
  return { courseworkPct: (cw / (scheme.courseworkMax * terms)) * 100, finalPct: (fin / (scheme.finalMax * terms)) * 100 };
}

/** The grade that counts (GPA, ปพ.6): the ผลการแก้ตัว when there is one, else the original grade */
export const effectiveGrade = (sc: Pick<StudentSubjectScore, 'grade' | 'remedial'> | undefined) =>
  sc?.remedial?.grade || sc?.grade || '';

export function scoreToGrade(total: number, special?: string): string {
  if (special === 'ร' || special === 'มส') return special;
  if (total >= 80) return '4';
  if (total >= 75) return '3.5';
  if (total >= 70) return '3';
  if (total >= 65) return '2.5';
  if (total >= 60) return '2';
  if (total >= 55) return '1.5';
  if (total >= 50) return '1';
  return '0';
}

export function calculateStudentGPA(
  student: AcademicStudentRecord,
  subjects: AcademicSubject[],
  porPor6Core12Only = false
) {
  const targetSubjects = porPor6Core12Only
    ? subjects.filter(s => !['ว21103', 'ว21104', 'ว22103', 'ว22104', 'ว23103', 'ว23104'].includes(s.code))
    : subjects;

  let coreCredits = 0;
  let electiveCredits = 0;
  let earnedCredits = 0;
  let weightedPoints = 0;

  for (const subj of targetSubjects) {
    const sc = student.scores[subj.code];
    const gStr = sc ? effectiveGrade(sc) : '0';
    const gNum = parseFloat(gStr);
    if (subj.type === 'พื้นฐาน') coreCredits += subj.credits;
    else electiveCredits += subj.credits;

    if (!isNaN(gNum) && gNum > 0) {
      earnedCredits += subj.credits;
      weightedPoints += subj.credits * gNum;
    }
  }

  const totalCredits = coreCredits + electiveCredits;
  const gpa = totalCredits > 0 ? weightedPoints / totalCredits : 0;

  return {
    coreCredits,
    electiveCredits,
    totalCredits,
    earnedCredits,
    gpa: Number(gpa.toFixed(2)),
    gpaFormatted: gpa.toFixed(2),
  };
}

export function calculateClassRanks(
  students: AcademicStudentRecord[],
  subjects: AcademicSubject[]
): Record<string, { rank: number; total: number; gpa: number }> {
  const list = students.map(st => ({
    code: st.code,
    gpa: calculateStudentGPA(st, subjects, true).gpa,
  }));
  const sorted = [...list].sort((a, b) => b.gpa - a.gpa);
  const result: Record<string, { rank: number; total: number; gpa: number }> = {};
  let currentRank = 1;
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i].gpa < sorted[i - 1].gpa) {
      currentRank = i + 1;
    }
    result[sorted[i].code] = {
      rank: currentRank,
      total: students.length,
      gpa: sorted[i].gpa,
    };
  }
  return result;
}

// Class structure only: subjects, activities and the printed header of each ปพ.5 / ปพ.6.
// Students come from the live roster and every score from Firestore config/academic_scores_2569
// (see academicScores.ts), so no student name or grade is ever shipped in the site bundle.
export const INITIAL_ACADEMIC_DATA: ClassAcademicData[] = [
  {
    "classId": "p1",
    "shortName": "ป.1",
    "className": "ประถมศึกษาปีที่ 1",
    "level": "ประถม",
    "room": 1,
    "semester": "1",
    "year": "2569",
    "schoolName": "โรงเรียนบ้านคลองมดแดง",
    "affiliation": "สำนักงานเขตพื้นที่การศึกษาประถมศึกษากำแพงเพชร เขต 2",
    "director": "นายปรัชญา ปรางค์ชัยภูมิ",
    "homeroomTeachers": [
      "นางสาวธิดารัตน์ แรตสอน"
    ],
    "subjects": [
      {
        "code": "ท11101",
        "name": "ภาษาไทย 1",
        "type": "พื้นฐาน",
        "group": "ภาษาไทย (พื้นฐาน)",
        "credits": 4,
        "hours": 80,
        "teacher": "นายนวพานิชณ์ วังคีรี"
      },
      {
        "code": "ค11101",
        "name": "คณิตศาสตร์ 1",
        "type": "พื้นฐาน",
        "group": "คณิตศาสตร์ (พื้นฐาน)",
        "credits": 4,
        "hours": 80,
        "teacher": "นางสาวธิดารัตน์ แรตสอน"
      },
      {
        "code": "ว11101",
        "name": "วิทยาศาสตร์และเทคโนโลยี 1",
        "type": "พื้นฐาน",
        "group": "วิทยาศาสตร์ฯ (พื้นฐาน)",
        "credits": 2,
        "hours": 40,
        "teacher": "นางสาวธิดารัตน์ แรตสอน"
      },
      {
        "code": "ส11101",
        "name": "สังคมศึกษา ศาสนาและวัฒนธรรม 1",
        "type": "พื้นฐาน",
        "group": "สังคมศึกษาฯ (พื้นฐาน)",
        "credits": 1,
        "hours": 20,
        "teacher": "นางสาวภัทรสุดา สุหงษา"
      },
      {
        "code": "ส11102",
        "name": "ประวัติศาสตร์ 1",
        "type": "พื้นฐาน",
        "group": "สังคมศึกษาฯ (พื้นฐาน)",
        "credits": 1,
        "hours": 20,
        "teacher": "นางสาวภัทรสุดา สุหงษา"
      },
      {
        "code": "พ11101",
        "name": "สุขศึกษาและพลศึกษา 1",
        "type": "พื้นฐาน",
        "group": "สุขศึกษาฯ (พื้นฐาน)",
        "credits": 1,
        "hours": 20,
        "teacher": "นายนวพานิชณ์ วังคีรี"
      },
      {
        "code": "ศ11101",
        "name": "ศิลปะ 1",
        "type": "พื้นฐาน",
        "group": "ศิลปะ (พื้นฐาน)",
        "credits": 1,
        "hours": 20,
        "teacher": "นายพีระ เดชะผล"
      },
      {
        "code": "ง11101",
        "name": "การงานอาชีพ 1",
        "type": "พื้นฐาน",
        "group": "การงานอาชีพฯ (พื้นฐาน)",
        "credits": 1,
        "hours": 20,
        "teacher": "นายอนันตชัย เพ็ชรรี่"
      },
      {
        "code": "อ11101",
        "name": "ภาษาอังกฤษ 1",
        "type": "พื้นฐาน",
        "group": "ภาษาต่างประเทศ (พื้นฐาน)",
        "credits": 4,
        "hours": 80,
        "teacher": "นางสาวธญาภรณ์ คล้ายเพ็ง"
      }
    ],
    "activities": [
      {
        "code": "ก11101",
        "name": "กิจกรรมแนะแนว",
        "hours": 20
      },
      {
        "code": "ก11102",
        "name": "กิจกรรมลูกเสือ / เนตรนารี",
        "hours": 20
      },
      {
        "code": "ก11103",
        "name": "กิจกรรมชุมนุม / ตลาดนัดอาชีพ",
        "hours": 20
      },
      {
        "code": "ก11104",
        "name": "กิจกรรมเพื่อสังคมและสาธารณประโยชน์",
        "hours": 10
      }
    ],
    "students": []
  },
  {
    "classId": "p2",
    "shortName": "ป.2",
    "className": "ประถมศึกษาปีที่ 2",
    "level": "ประถม",
    "room": 1,
    "semester": "1",
    "year": "2569",
    "schoolName": "โรงเรียนบ้านคลองมดแดง",
    "affiliation": "สำนักงานเขตพื้นที่การศึกษาประถมศึกษากำแพงเพชร เขต 2",
    "director": "นายปรัชญา ปรางค์ชัยภูมิ",
    "homeroomTeachers": [
      "นางสาวภัทรสุดา สุหงษา"
    ],
    "subjects": [
      {
        "code": "ท12101",
        "name": "ภาษาไทย 2",
        "type": "พื้นฐาน",
        "group": "ภาษาไทย (พื้นฐาน)",
        "credits": 4,
        "hours": 80,
        "teacher": "นายนวพานิชณ์ วังคีรี"
      },
      {
        "code": "ค12101",
        "name": "คณิตศาสตร์ 2",
        "type": "พื้นฐาน",
        "group": "คณิตศาสตร์ (พื้นฐาน)",
        "credits": 4,
        "hours": 80,
        "teacher": "นางสาวธิดารัตน์ แรตสอน"
      },
      {
        "code": "ว12101",
        "name": "วิทยาศาสตร์และเทคโนโลยี 2",
        "type": "พื้นฐาน",
        "group": "วิทยาศาสตร์ฯ (พื้นฐาน)",
        "credits": 2,
        "hours": 40,
        "teacher": "นางสาวธญาภรณ์ คล้ายเพ็ง"
      },
      {
        "code": "ส12101",
        "name": "สังคมศึกษา ศาสนาและวัฒนธรรม 2",
        "type": "พื้นฐาน",
        "group": "สังคมศึกษาฯ (พื้นฐาน)",
        "credits": 1,
        "hours": 20,
        "teacher": "นางสาวภัทรสุดา สุหงษา"
      },
      {
        "code": "ส12102",
        "name": "ประวัติศาสตร์ 2",
        "type": "พื้นฐาน",
        "group": "สังคมศึกษาฯ (พื้นฐาน)",
        "credits": 1,
        "hours": 20,
        "teacher": "นางสาวภัทรสุดา สุหงษา"
      },
      {
        "code": "พ12101",
        "name": "สุขศึกษาและพลศึกษา 2",
        "type": "พื้นฐาน",
        "group": "สุขศึกษาฯ (พื้นฐาน)",
        "credits": 1,
        "hours": 20,
        "teacher": "นายนวพานิชณ์ วังคีรี"
      },
      {
        "code": "ศ12101",
        "name": "ศิลปะ 2",
        "type": "พื้นฐาน",
        "group": "ศิลปะ (พื้นฐาน)",
        "credits": 1,
        "hours": 20,
        "teacher": "นายพีระ เดชะผล"
      },
      {
        "code": "ง12101",
        "name": "การงานอาชีพ 2",
        "type": "พื้นฐาน",
        "group": "การงานอาชีพฯ (พื้นฐาน)",
        "credits": 1,
        "hours": 20,
        "teacher": "นายอนันตชัย เพ็ชรรี่"
      },
      {
        "code": "อ12101",
        "name": "ภาษาอังกฤษ 2",
        "type": "พื้นฐาน",
        "group": "ภาษาต่างประเทศ (พื้นฐาน)",
        "credits": 4,
        "hours": 80,
        "teacher": "นางสาวธญาภรณ์ คล้ายเพ็ง"
      }
    ],
    "activities": [
      {
        "code": "ก11101",
        "name": "กิจกรรมแนะแนว",
        "hours": 20
      },
      {
        "code": "ก11102",
        "name": "กิจกรรมลูกเสือ / เนตรนารี",
        "hours": 20
      },
      {
        "code": "ก11103",
        "name": "กิจกรรมชุมนุม / ตลาดนัดอาชีพ",
        "hours": 20
      },
      {
        "code": "ก11104",
        "name": "กิจกรรมเพื่อสังคมและสาธารณประโยชน์",
        "hours": 10
      }
    ],
    "students": []
  },
  {
    "classId": "p3",
    "shortName": "ป.3",
    "className": "ประถมศึกษาปีที่ 3",
    "level": "ประถม",
    "room": 1,
    "semester": "1",
    "year": "2569",
    "schoolName": "โรงเรียนบ้านคลองมดแดง",
    "affiliation": "สำนักงานเขตพื้นที่การศึกษาประถมศึกษากำแพงเพชร เขต 2",
    "director": "นายปรัชญา ปรางค์ชัยภูมิ",
    "homeroomTeachers": [
      "นางสาวไอยรดา อาจจีน"
    ],
    "subjects": [
      {
        "code": "ท13101",
        "name": "ภาษาไทย 3",
        "type": "พื้นฐาน",
        "group": "ภาษาไทย (พื้นฐาน)",
        "credits": 4,
        "hours": 80,
        "teacher": "นางสาวนริศรา ทำจิตรเหมาะ"
      },
      {
        "code": "ค13101",
        "name": "คณิตศาสตร์ 3",
        "type": "พื้นฐาน",
        "group": "คณิตศาสตร์ (พื้นฐาน)",
        "credits": 4,
        "hours": 80,
        "teacher": "นางสาวธิดารัตน์ แรตสอน"
      },
      {
        "code": "ว13101",
        "name": "วิทยาศาสตร์และเทคโนโลยี 3",
        "type": "พื้นฐาน",
        "group": "วิทยาศาสตร์ฯ (พื้นฐาน)",
        "credits": 2,
        "hours": 40,
        "teacher": "นางสาวธิดารัตน์ แรตสอน"
      },
      {
        "code": "ส13101",
        "name": "สังคมศึกษา ศาสนาและวัฒนธรรม 3",
        "type": "พื้นฐาน",
        "group": "สังคมศึกษาฯ (พื้นฐาน)",
        "credits": 1,
        "hours": 20,
        "teacher": "นางสาวภัทรสุดา สุหงษา"
      },
      {
        "code": "ส13102",
        "name": "ประวัติศาสตร์ 3",
        "type": "พื้นฐาน",
        "group": "สังคมศึกษาฯ (พื้นฐาน)",
        "credits": 1,
        "hours": 20,
        "teacher": "นางสาวภัทรสุดา สุหงษา"
      },
      {
        "code": "พ13101",
        "name": "สุขศึกษาและพลศึกษา 3",
        "type": "พื้นฐาน",
        "group": "สุขศึกษาฯ (พื้นฐาน)",
        "credits": 1,
        "hours": 20,
        "teacher": "นายนวพานิชณ์ วังคีรี"
      },
      {
        "code": "ศ13101",
        "name": "ศิลปะ 3",
        "type": "พื้นฐาน",
        "group": "ศิลปะ (พื้นฐาน)",
        "credits": 1,
        "hours": 20,
        "teacher": "นายพีระ เดชะผล"
      },
      {
        "code": "ง13101",
        "name": "การงานอาชีพ 3",
        "type": "พื้นฐาน",
        "group": "การงานอาชีพฯ (พื้นฐาน)",
        "credits": 1,
        "hours": 20,
        "teacher": "นายอนันตชัย เพ็ชรรี่"
      },
      {
        "code": "อ13101",
        "name": "ภาษาอังกฤษ 3",
        "type": "พื้นฐาน",
        "group": "ภาษาต่างประเทศ (พื้นฐาน)",
        "credits": 4,
        "hours": 80,
        "teacher": "นางสาวธญาภรณ์ คล้ายเพ็ง"
      }
    ],
    "activities": [
      {
        "code": "ก11101",
        "name": "กิจกรรมแนะแนว",
        "hours": 20
      },
      {
        "code": "ก11102",
        "name": "กิจกรรมลูกเสือ / เนตรนารี",
        "hours": 20
      },
      {
        "code": "ก11103",
        "name": "กิจกรรมชุมนุม / ตลาดนัดอาชีพ",
        "hours": 20
      },
      {
        "code": "ก11104",
        "name": "กิจกรรมเพื่อสังคมและสาธารณประโยชน์",
        "hours": 10
      }
    ],
    "students": []
  },
  {
    "classId": "p4",
    "shortName": "ป.4",
    "className": "ประถมศึกษาปีที่ 4",
    "level": "ประถม",
    "room": 1,
    "semester": "1",
    "year": "2569",
    "schoolName": "โรงเรียนบ้านคลองมดแดง",
    "affiliation": "สำนักงานเขตพื้นที่การศึกษาประถมศึกษากำแพงเพชร เขต 2",
    "director": "นายปรัชญา ปรางค์ชัยภูมิ",
    "homeroomTeachers": [
      "นายพีระ เดชะผล"
    ],
    "subjects": [
      {
        "code": "ท14101",
        "name": "ภาษาไทย 4",
        "type": "พื้นฐาน",
        "group": "ภาษาไทย (พื้นฐาน)",
        "credits": 4,
        "hours": 80,
        "teacher": "นางสาวนริศรา ทำจิตรเหมาะ"
      },
      {
        "code": "ค14101",
        "name": "คณิตศาสตร์ 4",
        "type": "พื้นฐาน",
        "group": "คณิตศาสตร์ (พื้นฐาน)",
        "credits": 4,
        "hours": 80,
        "teacher": "นายนวพานิชณ์ วังคีรี"
      },
      {
        "code": "ว14101",
        "name": "วิทยาศาสตร์และเทคโนโลยี 4",
        "type": "พื้นฐาน",
        "group": "วิทยาศาสตร์ฯ (พื้นฐาน)",
        "credits": 2,
        "hours": 40,
        "teacher": "นางสาวนริศรา ทำจิตรเหมาะ"
      },
      {
        "code": "ส14101",
        "name": "สังคมศึกษา ศาสนาและวัฒนธรรม 4",
        "type": "พื้นฐาน",
        "group": "สังคมศึกษาฯ (พื้นฐาน)",
        "credits": 1.5,
        "hours": 30,
        "teacher": "นางสาวภัทรสุดา สุหงษา"
      },
      {
        "code": "ส14102",
        "name": "ประวัติศาสตร์ 4",
        "type": "พื้นฐาน",
        "group": "สังคมศึกษาฯ (พื้นฐาน)",
        "credits": 1.5,
        "hours": 30,
        "teacher": "นางสาวไอยรดา อาจจีน"
      },
      {
        "code": "พ14101",
        "name": "สุขศึกษาและพลศึกษา 4",
        "type": "พื้นฐาน",
        "group": "สุขศึกษาฯ (พื้นฐาน)",
        "credits": 1.5,
        "hours": 30,
        "teacher": "นางสาวอาริษา ฉิมสุพร"
      },
      {
        "code": "ศ14101",
        "name": "ศิลปะ 4",
        "type": "พื้นฐาน",
        "group": "ศิลปะ (พื้นฐาน)",
        "credits": 1.5,
        "hours": 30,
        "teacher": "นายพีระ เดชะผล"
      },
      {
        "code": "ง14101",
        "name": "การงานอาชีพ 4",
        "type": "พื้นฐาน",
        "group": "การงานอาชีพฯ (พื้นฐาน)",
        "credits": 1,
        "hours": 20,
        "teacher": "นายอนันตชัย เพ็ชรรี่"
      },
      {
        "code": "อ14101",
        "name": "ภาษาอังกฤษ 4",
        "type": "พื้นฐาน",
        "group": "ภาษาต่างประเทศ (พื้นฐาน)",
        "credits": 4,
        "hours": 80,
        "teacher": "นางสาวจิราภา พานชัย"
      }
    ],
    "activities": [
      {
        "code": "ก11101",
        "name": "กิจกรรมแนะแนว",
        "hours": 20
      },
      {
        "code": "ก11102",
        "name": "กิจกรรมลูกเสือ / เนตรนารี",
        "hours": 20
      },
      {
        "code": "ก11103",
        "name": "กิจกรรมชุมนุม / ตลาดนัดอาชีพ",
        "hours": 20
      },
      {
        "code": "ก11104",
        "name": "กิจกรรมเพื่อสังคมและสาธารณประโยชน์",
        "hours": 10
      }
    ],
    "students": []
  },
  {
    "classId": "p5",
    "shortName": "ป.5",
    "className": "ประถมศึกษาปีที่ 5",
    "level": "ประถม",
    "room": 1,
    "semester": "1",
    "year": "2569",
    "schoolName": "โรงเรียนบ้านคลองมดแดง",
    "affiliation": "สำนักงานเขตพื้นที่การศึกษาประถมศึกษากำแพงเพชร เขต 2",
    "director": "นายปรัชญา ปรางค์ชัยภูมิ",
    "homeroomTeachers": [
      "นายนวพานิชณ์ วังคีรี"
    ],
    "subjects": [
      {
        "code": "ท15101",
        "name": "ภาษาไทย 5",
        "type": "พื้นฐาน",
        "group": "ภาษาไทย (พื้นฐาน)",
        "credits": 4,
        "hours": 80,
        "teacher": "นางสาวนริศรา ทำจิตรเหมาะ"
      },
      {
        "code": "ค15101",
        "name": "คณิตศาสตร์ 5",
        "type": "พื้นฐาน",
        "group": "คณิตศาสตร์ (พื้นฐาน)",
        "credits": 4,
        "hours": 80,
        "teacher": "นางสาวจิราภา พานชัย"
      },
      {
        "code": "ว15101",
        "name": "วิทยาศาสตร์และเทคโนโลยี 5",
        "type": "พื้นฐาน",
        "group": "วิทยาศาสตร์ฯ (พื้นฐาน)",
        "credits": 2,
        "hours": 40,
        "teacher": "นายอนันตชัย เพ็ชรรี่"
      },
      {
        "code": "ส15101",
        "name": "สังคมศึกษา ศาสนาและวัฒนธรรม 5",
        "type": "พื้นฐาน",
        "group": "สังคมศึกษาฯ (พื้นฐาน)",
        "credits": 1.5,
        "hours": 30,
        "teacher": "นางสาวไอยรดา อาจจีน"
      },
      {
        "code": "ส15102",
        "name": "ประวัติศาสตร์ 5",
        "type": "พื้นฐาน",
        "group": "สังคมศึกษาฯ (พื้นฐาน)",
        "credits": 1.5,
        "hours": 30,
        "teacher": "นางสาวไอยรดา อาจจีน"
      },
      {
        "code": "พ15101",
        "name": "สุขศึกษาและพลศึกษา 5",
        "type": "พื้นฐาน",
        "group": "สุขศึกษาฯ (พื้นฐาน)",
        "credits": 1.5,
        "hours": 30,
        "teacher": "นางสาวอาริษา ฉิมสุพร"
      },
      {
        "code": "ศ15101",
        "name": "ศิลปะ 5",
        "type": "พื้นฐาน",
        "group": "ศิลปะ (พื้นฐาน)",
        "credits": 1.5,
        "hours": 30,
        "teacher": "นายพีระ เดชะผล"
      },
      {
        "code": "ง15101",
        "name": "การงานอาชีพ 5",
        "type": "พื้นฐาน",
        "group": "การงานอาชีพฯ (พื้นฐาน)",
        "credits": 1,
        "hours": 20,
        "teacher": "นายอนันตชัย เพ็ชรรี่"
      },
      {
        "code": "อ15101",
        "name": "ภาษาอังกฤษ 5",
        "type": "พื้นฐาน",
        "group": "ภาษาต่างประเทศ (พื้นฐาน)",
        "credits": 4,
        "hours": 80,
        "teacher": "นางสาวธญาภรณ์ คล้ายเพ็ง"
      }
    ],
    "activities": [
      {
        "code": "ก11101",
        "name": "กิจกรรมแนะแนว",
        "hours": 20
      },
      {
        "code": "ก11102",
        "name": "กิจกรรมลูกเสือ / เนตรนารี",
        "hours": 20
      },
      {
        "code": "ก11103",
        "name": "กิจกรรมชุมนุม / ตลาดนัดอาชีพ",
        "hours": 20
      },
      {
        "code": "ก11104",
        "name": "กิจกรรมเพื่อสังคมและสาธารณประโยชน์",
        "hours": 10
      }
    ],
    "students": []
  },
  {
    "classId": "p6",
    "shortName": "ป.6",
    "className": "ประถมศึกษาปีที่ 6",
    "level": "ประถม",
    "room": 1,
    "semester": "1",
    "year": "2569",
    "schoolName": "โรงเรียนบ้านคลองมดแดง",
    "affiliation": "สำนักงานเขตพื้นที่การศึกษาประถมศึกษากำแพงเพชร เขต 2",
    "director": "นายปรัชญา ปรางค์ชัยภูมิ",
    "homeroomTeachers": [
      "นางสาวอาริษา ฉิมสุพร",
      "นายพิศุทธิ์ เชาวลิตโรจน์"
    ],
    "subjects": [
      {
        "code": "ท16101",
        "name": "ภาษาไทย 6",
        "type": "พื้นฐาน",
        "group": "ภาษาไทย (พื้นฐาน)",
        "credits": 4,
        "hours": 80,
        "teacher": "นางสาวนริศรา ทำจิตรเหมาะ"
      },
      {
        "code": "ค16101",
        "name": "คณิตศาสตร์ 6",
        "type": "พื้นฐาน",
        "group": "คณิตศาสตร์ (พื้นฐาน)",
        "credits": 4,
        "hours": 80,
        "teacher": "นางสาวจิราภา พานชัย"
      },
      {
        "code": "ว16101",
        "name": "วิทยาศาสตร์และเทคโนโลยี 6",
        "type": "พื้นฐาน",
        "group": "วิทยาศาสตร์ฯ (พื้นฐาน)",
        "credits": 2,
        "hours": 40,
        "teacher": "นายอนันตชัย เพ็ชรรี่"
      },
      {
        "code": "ส16101",
        "name": "สังคมศึกษา ศาสนาและวัฒนธรรม 6",
        "type": "พื้นฐาน",
        "group": "สังคมศึกษาฯ (พื้นฐาน)",
        "credits": 1.5,
        "hours": 30,
        "teacher": "นางสาวไอยรดา อาจจีน"
      },
      {
        "code": "ส16102",
        "name": "ประวัติศาสตร์ 6",
        "type": "พื้นฐาน",
        "group": "สังคมศึกษาฯ (พื้นฐาน)",
        "credits": 1.5,
        "hours": 30,
        "teacher": "นางสาวไอยรดา อาจจีน"
      },
      {
        "code": "พ16101",
        "name": "สุขศึกษาและพลศึกษา 6",
        "type": "พื้นฐาน",
        "group": "สุขศึกษาฯ (พื้นฐาน)",
        "credits": 1.5,
        "hours": 30,
        "teacher": "นางสาวอาริษา ฉิมสุพร"
      },
      {
        "code": "ศ16101",
        "name": "ศิลปะ 6",
        "type": "พื้นฐาน",
        "group": "ศิลปะ (พื้นฐาน)",
        "credits": 1.5,
        "hours": 30,
        "teacher": "นายพีระ เดชะผล"
      },
      {
        "code": "ง16101",
        "name": "การงานอาชีพ 6",
        "type": "พื้นฐาน",
        "group": "การงานอาชีพฯ (พื้นฐาน)",
        "credits": 1,
        "hours": 20,
        "teacher": "นายอนันตชัย เพ็ชรรี่"
      },
      {
        "code": "อ16101",
        "name": "ภาษาอังกฤษ 6",
        "type": "พื้นฐาน",
        "group": "ภาษาต่างประเทศ (พื้นฐาน)",
        "credits": 4,
        "hours": 80,
        "teacher": "นางสาวจิราภา พานชัย"
      }
    ],
    "activities": [
      {
        "code": "ก11101",
        "name": "กิจกรรมแนะแนว",
        "hours": 20
      },
      {
        "code": "ก11102",
        "name": "กิจกรรมลูกเสือ / เนตรนารี",
        "hours": 20
      },
      {
        "code": "ก11103",
        "name": "กิจกรรมชุมนุม / ตลาดนัดอาชีพ",
        "hours": 20
      },
      {
        "code": "ก11104",
        "name": "กิจกรรมเพื่อสังคมและสาธารณประโยชน์",
        "hours": 10
      }
    ],
    "students": []
  },
  {
    "classId": "m1",
    "shortName": "ม.1",
    "className": "มัธยมศึกษาปีที่ 1",
    "level": "มัธยม",
    "room": 1,
    "semester": "1",
    "year": "2569",
    "schoolName": "โรงเรียนบ้านคลองมดแดง",
    "affiliation": "สำนักงานเขตพื้นที่การศึกษาประถมศึกษากำแพงเพชร เขต 2",
    "director": "นายปรัชญา ปรางค์ชัยภูมิ",
    "homeroomTeachers": [
      "นางสาวจิราภา พานชัย",
      "นายอนันตชัย เพ็ชรรี่"
    ],
    "subjects": [
      {
        "code": "ท21101",
        "name": "ภาษาไทย 1",
        "type": "พื้นฐาน",
        "group": "ภาษาไทย (พื้นฐาน)",
        "credits": 1.5,
        "hours": 60,
        "teacher": "นางสาวจิราภา พานชัย"
      },
      {
        "code": "ค21101",
        "name": "คณิตศาสตร์ 1",
        "type": "พื้นฐาน",
        "group": "คณิตศาสตร์ (พื้นฐาน)",
        "credits": 1.5,
        "hours": 60,
        "teacher": "นายพิศุทธิ์ เชาวลิตโรจน์"
      },
      {
        "code": "ว21101",
        "name": "วิทยาศาสตร์และเทคโนโลยี 1",
        "type": "พื้นฐาน",
        "group": "วิทยาศาสตร์ฯ (พื้นฐาน)",
        "credits": 1.5,
        "hours": 60,
        "teacher": "นายพิศุทธิ์ เชาวลิตโรจน์"
      },
      {
        "code": "ส21101",
        "name": "สังคมศึกษา ศาสนาและวัฒนธรรม 1",
        "type": "พื้นฐาน",
        "group": "สังคมศึกษาฯ (พื้นฐาน)",
        "credits": 1.5,
        "hours": 60,
        "teacher": "นายธิติวุฒิ เตยไธสง"
      },
      {
        "code": "ส21102",
        "name": "ประวัติศาสตร์ 1",
        "type": "พื้นฐาน",
        "group": "สังคมศึกษาฯ (พื้นฐาน)",
        "credits": 0.5,
        "hours": 20,
        "teacher": "นายธิติวุฒิ เตยไธสง"
      },
      {
        "code": "พ21101",
        "name": "สุขศึกษาและพลศึกษา 1",
        "type": "พื้นฐาน",
        "group": "สุขศึกษาฯ (พื้นฐาน)",
        "credits": 1,
        "hours": 40,
        "teacher": "นางสาวอาริษา ฉิมสุพร"
      },
      {
        "code": "ศ21101",
        "name": "ศิลปะ 1",
        "type": "พื้นฐาน",
        "group": "ศิลปะ (พื้นฐาน)",
        "credits": 1,
        "hours": 40,
        "teacher": "นางสาวไอยรดา อาจจีน"
      },
      {
        "code": "ง21101",
        "name": "การงานอาชีพ 1",
        "type": "พื้นฐาน",
        "group": "การงานอาชีพฯ (พื้นฐาน)",
        "credits": 1,
        "hours": 40,
        "teacher": "นายพีระ เดชะผล"
      },
      {
        "code": "อ21101",
        "name": "ภาษาอังกฤษ 1",
        "type": "พื้นฐาน",
        "group": "ภาษาต่างประเทศ (พื้นฐาน)",
        "credits": 1.5,
        "hours": 60,
        "teacher": "นายอรรถชัย แก้วเอี่ยม"
      },
      {
        "code": "ค21201",
        "name": "คณิตศาสตร์เพิ่มเติม 1",
        "type": "เพิ่มเติม",
        "group": "คณิตศาสตร์ (เพิ่มเติม)",
        "credits": 0.5,
        "hours": 20,
        "teacher": "นายพิศุทธิ์ เชาวลิตโรจน์"
      },
      {
        "code": "อ21201",
        "name": "ภาษาอังกฤษเพื่อการสื่อสาร 1",
        "type": "เพิ่มเติม",
        "group": "ภาษาต่างประเทศ (เพิ่มเติม)",
        "credits": 1,
        "hours": 40,
        "teacher": "นายอรรถชัย แก้วเอี่ยม"
      },
      {
        "code": "ง21201",
        "name": "ทักษะอาชีพ (การตลาดออนไลน์)",
        "type": "เพิ่มเติม",
        "group": "การงานอาชีพฯ (เพิ่มเติม)",
        "credits": 1,
        "hours": 40,
        "teacher": "นายอนันตชัย เพ็ชรรี่"
      },
      {
        "code": "ว21103",
        "name": "วิทยาการคำนวณ 1",
        "type": "พื้นฐาน",
        "group": "วิทยาศาสตร์ฯ (เพิ่มเติม)",
        "credits": 0.5,
        "hours": 20,
        "teacher": "นายอนันตชัย เพ็ชรรี่"
      },
      {
        "code": "ว21104",
        "name": "การออกแบบและเทคโนโลยี 1",
        "type": "พื้นฐาน",
        "group": "วิทยาศาสตร์ฯ (เพิ่มเติม)",
        "credits": 0.5,
        "hours": 20,
        "teacher": "นายอนันตชัย เพ็ชรรี่"
      }
    ],
    "activities": [
      {
        "code": "ก21101",
        "name": "กิจกรรมแนะแนว",
        "hours": 20
      },
      {
        "code": "ก21102",
        "name": "กิจกรรมลูกเสือ / เนตรนารี",
        "hours": 20
      },
      {
        "code": "ก21103",
        "name": "กิจกรรมชุมนุม / ตลาดนัดอาชีพ",
        "hours": 20
      },
      {
        "code": "ก21104",
        "name": "กิจกรรมเพื่อสังคมและสาธารณประโยชน์",
        "hours": 10
      }
    ],
    "students": []
  },
  {
    "classId": "m2",
    "shortName": "ม.2",
    "className": "มัธยมศึกษาปีที่ 2",
    "level": "มัธยม",
    "room": 1,
    "semester": "1",
    "year": "2569",
    "schoolName": "โรงเรียนบ้านคลองมดแดง",
    "affiliation": "สำนักงานเขตพื้นที่การศึกษาประถมศึกษากำแพงเพชร เขต 2",
    "director": "นายปรัชญา ปรางค์ชัยภูมิ",
    "homeroomTeachers": [
      "นายอรรถชัย แก้วเอี่ยม"
    ],
    "subjects": [
      {
        "code": "ท22101",
        "name": "ภาษาไทย 3",
        "type": "พื้นฐาน",
        "group": "ภาษาไทย (พื้นฐาน)",
        "credits": 1.5,
        "hours": 60,
        "teacher": "นางสาวจิราภา พานชัย"
      },
      {
        "code": "ค22101",
        "name": "คณิตศาสตร์ 3",
        "type": "พื้นฐาน",
        "group": "คณิตศาสตร์ (พื้นฐาน)",
        "credits": 1.5,
        "hours": 60,
        "teacher": "นายพิศุทธิ์ เชาวลิตโรจน์"
      },
      {
        "code": "ว22101",
        "name": "วิทยาศาสตร์และเทคโนโลยี 3",
        "type": "พื้นฐาน",
        "group": "วิทยาศาสตร์ฯ (พื้นฐาน)",
        "credits": 1.5,
        "hours": 60,
        "teacher": "นายพิศุทธิ์ เชาวลิตโรจน์"
      },
      {
        "code": "ส22101",
        "name": "สังคมศึกษา ศาสนาและวัฒนธรรม 3",
        "type": "พื้นฐาน",
        "group": "สังคมศึกษาฯ (พื้นฐาน)",
        "credits": 1.5,
        "hours": 60,
        "teacher": "นายธิติวุฒิ เตยไธสง"
      },
      {
        "code": "ส22102",
        "name": "ประวัติศาสตร์ 3",
        "type": "พื้นฐาน",
        "group": "สังคมศึกษาฯ (พื้นฐาน)",
        "credits": 0.5,
        "hours": 20,
        "teacher": "นายธิติวุฒิ เตยไธสง"
      },
      {
        "code": "พ22101",
        "name": "สุขศึกษาและพลศึกษา 3",
        "type": "พื้นฐาน",
        "group": "สุขศึกษาฯ (พื้นฐาน)",
        "credits": 1,
        "hours": 40,
        "teacher": "นางสาวอาริษา ฉิมสุพร"
      },
      {
        "code": "ศ22101",
        "name": "ศิลปะ 3",
        "type": "พื้นฐาน",
        "group": "ศิลปะ (พื้นฐาน)",
        "credits": 1,
        "hours": 40,
        "teacher": "นางสาวไอยรดา อาจจีน"
      },
      {
        "code": "ง22101",
        "name": "การงานอาชีพ 3",
        "type": "พื้นฐาน",
        "group": "การงานอาชีพฯ (พื้นฐาน)",
        "credits": 1,
        "hours": 40,
        "teacher": "นางสาวไอยรดา อาจจีน"
      },
      {
        "code": "อ22101",
        "name": "ภาษาอังกฤษ 3",
        "type": "พื้นฐาน",
        "group": "ภาษาต่างประเทศ (พื้นฐาน)",
        "credits": 1.5,
        "hours": 60,
        "teacher": "นายอรรถชัย แก้วเอี่ยม"
      },
      {
        "code": "ค22201",
        "name": "คณิตศาสตร์เพิ่มเติม 3",
        "type": "เพิ่มเติม",
        "group": "คณิตศาสตร์ (เพิ่มเติม)",
        "credits": 0.5,
        "hours": 20,
        "teacher": "นายพิศุทธิ์ เชาวลิตโรจน์"
      },
      {
        "code": "อ22201",
        "name": "ภาษาอังกฤษเพื่อการสื่อสาร 3",
        "type": "เพิ่มเติม",
        "group": "ภาษาต่างประเทศ (เพิ่มเติม)",
        "credits": 1,
        "hours": 40,
        "teacher": "นายอรรถชัย แก้วเอี่ยม"
      },
      {
        "code": "ง22201",
        "name": "ทักษะอาชีพ (งานเกษตรฯ)",
        "type": "เพิ่มเติม",
        "group": "การงานอาชีพฯ (เพิ่มเติม)",
        "credits": 1,
        "hours": 40,
        "teacher": "นายอนันตชัย เพ็ชรรี่"
      },
      {
        "code": "ว22103",
        "name": "วิทยาการคำนวณ 2",
        "type": "พื้นฐาน",
        "group": "วิทยาศาสตร์ฯ (เพิ่มเติม)",
        "credits": 0.5,
        "hours": 20,
        "teacher": "นายอนันตชัย เพ็ชรรี่"
      },
      {
        "code": "ว22104",
        "name": "การออกแบบและเทคโนโลยี 2",
        "type": "พื้นฐาน",
        "group": "วิทยาศาสตร์ฯ (เพิ่มเติม)",
        "credits": 0.5,
        "hours": 20,
        "teacher": "นายอนันตชัย เพ็ชรรี่"
      }
    ],
    "activities": [
      {
        "code": "ก21101",
        "name": "กิจกรรมแนะแนว",
        "hours": 20
      },
      {
        "code": "ก21102",
        "name": "กิจกรรมลูกเสือ / เนตรนารี",
        "hours": 20
      },
      {
        "code": "ก21103",
        "name": "กิจกรรมชุมนุม / ตลาดนัดอาชีพ",
        "hours": 20
      },
      {
        "code": "ก21104",
        "name": "กิจกรรมเพื่อสังคมและสาธารณประโยชน์",
        "hours": 10
      }
    ],
    "students": []
  },
  {
    "classId": "m3",
    "shortName": "ม.3",
    "className": "มัธยมศึกษาปีที่ 3",
    "level": "มัธยม",
    "room": 1,
    "semester": "1",
    "year": "2569",
    "schoolName": "โรงเรียนบ้านคลองมดแดง",
    "affiliation": "สำนักงานเขตพื้นที่การศึกษาประถมศึกษากำแพงเพชร เขต 2",
    "director": "นายปรัชญา ปรางค์ชัยภูมิ",
    "homeroomTeachers": [
      "นางสาวนริศรา ทำจิตรเหมาะ",
      "นายธิติวุฒิ เตยไธสง"
    ],
    "subjects": [
      {
        "code": "ท23101",
        "name": "ภาษาไทย 5",
        "type": "พื้นฐาน",
        "group": "ภาษาไทย (พื้นฐาน)",
        "credits": 1.5,
        "hours": 60,
        "teacher": "นางสาวจิราภา พานชัย"
      },
      {
        "code": "ค23101",
        "name": "คณิตศาสตร์ 5",
        "type": "พื้นฐาน",
        "group": "คณิตศาสตร์ (พื้นฐาน)",
        "credits": 1.5,
        "hours": 60,
        "teacher": "นายพิศุทธิ์ เชาวลิตโรจน์"
      },
      {
        "code": "ว23101",
        "name": "วิทยาศาสตร์และเทคโนโลยี 5",
        "type": "พื้นฐาน",
        "group": "วิทยาศาสตร์ฯ (พื้นฐาน)",
        "credits": 1.5,
        "hours": 60,
        "teacher": "นายพิศุทธิ์ เชาวลิตโรจน์"
      },
      {
        "code": "ส23101",
        "name": "สังคมศึกษา ศาสนาและวัฒนธรรม 5",
        "type": "พื้นฐาน",
        "group": "สังคมศึกษาฯ (พื้นฐาน)",
        "credits": 1.5,
        "hours": 60,
        "teacher": "นายธิติวุฒิ เตยไธสง"
      },
      {
        "code": "ส23102",
        "name": "ประวัติศาสตร์ 5",
        "type": "พื้นฐาน",
        "group": "สังคมศึกษาฯ (พื้นฐาน)",
        "credits": 0.5,
        "hours": 20,
        "teacher": "นายธิติวุฒิ เตยไธสง"
      },
      {
        "code": "พ23101",
        "name": "สุขศึกษาและพลศึกษา 5",
        "type": "พื้นฐาน",
        "group": "สุขศึกษาฯ (พื้นฐาน)",
        "credits": 1,
        "hours": 40,
        "teacher": "นางสาวอาริษา ฉิมสุพร"
      },
      {
        "code": "ศ23101",
        "name": "ศิลปะ 5",
        "type": "พื้นฐาน",
        "group": "ศิลปะ (พื้นฐาน)",
        "credits": 1,
        "hours": 40,
        "teacher": "นางสาวไอยรดา อาจจีน"
      },
      {
        "code": "ง23101",
        "name": "การงานอาชีพ 5",
        "type": "พื้นฐาน",
        "group": "การงานอาชีพฯ (พื้นฐาน)",
        "credits": 1,
        "hours": 40,
        "teacher": "นางสาวนริศรา ทำจิตรเหมาะ"
      },
      {
        "code": "อ23101",
        "name": "ภาษาอังกฤษ 5",
        "type": "พื้นฐาน",
        "group": "ภาษาต่างประเทศ (พื้นฐาน)",
        "credits": 1.5,
        "hours": 60,
        "teacher": "นายอรรถชัย แก้วเอี่ยม"
      },
      {
        "code": "ค23201",
        "name": "คณิตศาสตร์เพิ่มเติม 5",
        "type": "เพิ่มเติม",
        "group": "คณิตศาสตร์ (เพิ่มเติม)",
        "credits": 0.5,
        "hours": 20,
        "teacher": "นายพิศุทธิ์ เชาวลิตโรจน์"
      },
      {
        "code": "อ23201",
        "name": "ภาษาอังกฤษเพื่อการสื่อสาร 5",
        "type": "เพิ่มเติม",
        "group": "ภาษาต่างประเทศ (เพิ่มเติม)",
        "credits": 1,
        "hours": 40,
        "teacher": "นายอรรถชัย แก้วเอี่ยม"
      },
      {
        "code": "ง23201",
        "name": "ทักษะอาชีพ (งานเกษตรฯ)",
        "type": "เพิ่มเติม",
        "group": "การงานอาชีพฯ (เพิ่มเติม)",
        "credits": 1,
        "hours": 40,
        "teacher": "นางสาวอาริษา ฉิมสุพร"
      },
      {
        "code": "ว23103",
        "name": "วิทยาการคำนวณ 3",
        "type": "พื้นฐาน",
        "group": "วิทยาศาสตร์ฯ (เพิ่มเติม)",
        "credits": 0.5,
        "hours": 20,
        "teacher": "นายอนันตชัย เพ็ชรรี่"
      },
      {
        "code": "ว23104",
        "name": "การออกแบบและเทคโนโลยี 3",
        "type": "พื้นฐาน",
        "group": "วิทยาศาสตร์ฯ (เพิ่มเติม)",
        "credits": 0.5,
        "hours": 20,
        "teacher": "นายอนันตชัย เพ็ชรรี่"
      }
    ],
    "activities": [
      {
        "code": "ก21101",
        "name": "กิจกรรมแนะแนว",
        "hours": 20
      },
      {
        "code": "ก21102",
        "name": "กิจกรรมลูกเสือ / เนตรนารี",
        "hours": 20
      },
      {
        "code": "ก21103",
        "name": "กิจกรรมชุมนุม / ตลาดนัดอาชีพ",
        "hours": 20
      },
      {
        "code": "ก21104",
        "name": "กิจกรรมเพื่อสังคมและสาธารณประโยชน์",
        "hours": 10
      }
    ],
    "students": []
  }
];
