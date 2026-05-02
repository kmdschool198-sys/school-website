// ─── Grade management data model ────────────────────────────────
// Based on ปพ.5 / ปพ.6 from MoE (Thailand)

export type LearningGroup =
  | 'ภาษาไทย' | 'คณิตศาสตร์' | 'วิทยาศาสตร์และเทคโนโลยี' | 'สังคมศึกษา'
  | 'สุขศึกษาและพลศึกษา' | 'ศิลปะ' | 'การงานอาชีพ' | 'ภาษาต่างประเทศ';

export const LEARNING_GROUPS: LearningGroup[] = [
  'ภาษาไทย', 'คณิตศาสตร์', 'วิทยาศาสตร์และเทคโนโลยี', 'สังคมศึกษา',
  'สุขศึกษาและพลศึกษา', 'ศิลปะ', 'การงานอาชีพ', 'ภาษาต่างประเทศ',
];

// ─── Subject (รายวิชา) ───
// Stored at: config/subjects/{subjectId}
export interface Subject {
  id: string;
  classId: string;          // links to attendance class roster
  code: string;             // e.g. "ว11101"
  name: string;             // e.g. "วิทยาศาสตร์"
  group: LearningGroup;
  credits: number;          // หน่วยกิต (มัธยม) / หน่วยน้ำหนัก (ประถม)
  teacherName: string;      // ครูผู้สอน
  type: 'พื้นฐาน' | 'เพิ่มเติม';
  // Weighting (sum should be 100)
  weightBetween1: number;   // คะแนนเก็บระหว่างเรียน 1
  weightBetween2: number;   // คะแนนเก็บระหว่างเรียน 2
  weightMidterm: number;    // คะแนนสอบกลางภาค
  weightFinal: number;      // คะแนนปลายภาค
  year: string;             // ปีการศึกษา (e.g. "2569")
}

// ─── Grade entry per student per subject ───
// Stored at: grades/{subjectId}_{studentId}
export interface GradeEntry {
  subjectId: string;
  studentId: string;
  classId: string;
  // Raw scores (out of weight)
  between1?: number;
  between2?: number;
  midterm?: number;
  final?: number;
  // Special assessments
  reading?: PassLevel;       // อ่าน
  thinking?: PassLevel;      // คิดวิเคราะห์
  writing?: PassLevel;       // เขียนสื่อความ
  characteristics?: PassLevel; // คุณลักษณะอันพึงประสงค์
  activity?: PassFail;       // กิจกรรมพัฒนาผู้เรียน
  note?: string;
  updatedAt?: number;
  updatedBy?: string;
}

export type PassLevel = 1 | 2 | 3;     // 1=ผ่าน, 2=ดี, 3=ดีเยี่ยม
export type PassFail = 'ผ่าน' | 'ไม่ผ่าน';
export type ThaiGrade = 0 | 1 | 1.5 | 2 | 2.5 | 3 | 3.5 | 4;

// ─── Computation logic ───
export function totalScore(g: GradeEntry): number {
  return (g.between1 || 0) + (g.between2 || 0) + (g.midterm || 0) + (g.final || 0);
}

// Standard 8-tier MoE grade scale
export function computeGrade(total: number): ThaiGrade {
  if (total >= 80) return 4;
  if (total >= 75) return 3.5;
  if (total >= 70) return 3;
  if (total >= 65) return 2.5;
  if (total >= 60) return 2;
  if (total >= 55) return 1.5;
  if (total >= 50) return 1;
  return 0;
}

export function gradeText(g: ThaiGrade): string {
  if (g === 0) return '0 (ตก)';
  return String(g);
}

export const PASS_LEVEL_LABELS: Record<PassLevel, string> = {
  1: 'ผ่าน', 2: 'ดี', 3: 'ดีเยี่ยม',
};

// Grade color (for UI)
export function gradeColor(g: ThaiGrade): string {
  if (g >= 3.5) return '#10B981';
  if (g >= 2.5) return '#3B82F6';
  if (g >= 1.5) return '#F59E0B';
  if (g >= 1)   return '#F97316';
  return '#EF4444';
}
