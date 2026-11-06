// แบบประเมินการนิเทศภายในรายบุคคล โรงเรียนบ้านคลองมดแดง ปีการศึกษา 2569 (ปรับปรุง 26 พ.ค. 69)
// นิเทศปีละ 3 ครั้ง ครั้งละ 1 ด้าน: ครั้งที่ 1 ด้านห้องเรียน, 2 ด้านการจัดการเรียนการสอน, 3 ด้านเอกสารชั้นเรียน
// Admin เป็นผู้บันทึก ครูดูผลของตนเองได้อย่างเดียว

export type SupervisionAspectId = 1 | 2 | 3;
export type SupervisionRound = 1 | 2 | 3;

export interface SupervisionAspect {
  id: SupervisionAspectId;
  title: string;
  /** คะแนนเต็มต่อข้อ */
  maxPerItem: number;
  /** ป้ายระดับคะแนน เรียงจาก 0 ขึ้นไป */
  scaleLabels: string[];
  items: string[];
}

export const SUPERVISION_ASPECTS: SupervisionAspect[] = [
  {
    id: 1,
    title: 'ด้านห้องเรียน',
    maxPerItem: 2,
    scaleLabels: ['ไม่ปฏิบัติหรือไม่สมบูรณ์', 'ปฏิบัติเป็นปัจจุบันและสมบูรณ์', 'มีคุณภาพและสร้างสรรค์'],
    items: [
      'สัญลักษณ์ ชาติ ศาสนา พระมหากษัตริย์',
      'ป้ายห้องเรียนประจำชั้น',
      'ป้ายชื่อครูประจำห้อง',
      'ป้ายชื่อสมาชิกในชั้นเรียน',
      'ป้ายสถิติการมาเรียน',
      'ปฏิทินแสดงวันปิด-เปิดเรียน',
      'ตารางเรียน',
      'ตารางเวร',
      'ข้อตกลงชั้นเรียน',
      'มุมข่าวและเหตุการณ์',
      'มุมแสดงผลงานนักเรียน',
      'มุมหนังสือและสื่อการเรียนรู้',
      'ความเหมาะสมของแสงสว่าง',
      'กระดานดำหรือไวท์บอร์ด',
      'ความสะอาดของห้องเรียนและบริเวณหน้าห้อง',
      'โต๊ะ เก้าอี้ ครู นักเรียนสะอาด เรียบร้อย',
    ],
  },
  {
    id: 2,
    title: 'ด้านการจัดการเรียนการสอน',
    maxPerItem: 1,
    scaleLabels: ['ไม่ปฏิบัติหรือไม่สมบูรณ์', 'ปฏิบัติเป็นปัจจุบันและสมบูรณ์'],
    items: [
      'กำหนดการสอนตามตัวชี้วัดของรายวิชาที่ได้รับมอบหมาย',
      'คู่มือครู/เอกสารประกอบการสอน',
      'เอกสาร/หนังสือสำหรับนักเรียน',
      'แผนการจัดการเรียนรู้ 2 รายวิชา',
      'แผนการสอนแนะแนวและมีการบันทึก',
      'การตรวจใบงาน/แบบฝึกหัด/สมุด',
      'ร่องรอยหลักฐานการพัฒนานักเรียนจากกระบวนการ PLC (ซ่อมเสริม)',
      'บันทึกการสอนโดยใช้เทคโนโลยี อย่างน้อย 2 ครั้ง/เดือน',
    ],
  },
  {
    id: 3,
    title: 'ด้านเอกสารชั้นเรียน',
    maxPerItem: 1,
    scaleLabels: ['ไม่ปฏิบัติหรือไม่สมบูรณ์', 'ปฏิบัติเป็นปัจจุบันและสมบูรณ์'],
    items: [
      'แบบบันทึกการประเมินคุณลักษณะอันพึงประสงค์ (ประจำชั้น)',
      'สมุดบันทึกคะแนนนักเรียน',
      'การวิเคราะห์ผู้เรียนรายบุคคลด้านพฤติกรรมชั้นเรียน',
      'การวิเคราะห์ผู้เรียนรายบุคคล ใช้ผลจากเขต (ด้านการอ่านเขียนและคิดคำนวณ/ประจำชั้น)',
      'แฟ้มระบบดูแลช่วยเหลือนักเรียน (นร.01) (ประจำชั้น)',
      'บันทึกการตรวจสุขภาพของนักเรียนด้วยตัวเอง (ประจำชั้น)',
      'แบบบันทึกสุขภาพประจำตัวนักเรียน',
      'แบบบันทึกฝากออมทรัพย์',
      'แบบบันทึกกิจกรรมชุมนุม',
      'สมุดบันทึกความดีประจำห้องเรียนของนักเรียน (ครูบันทึก)',
      'แบบบันทึกการสอนศีลธรรม (สัปดาห์ละ 1 ครั้ง) / ภาพประกอบ',
      'บันทึกกิจกรรมโฮมรูม',
    ],
  },
];

export const SUPERVISION_ROUNDS: SupervisionRound[] = [1, 2, 3];
export const SUPERVISION_COLLECTION = 'supervisions';

/** ด้านที่นิเทศในแต่ละครั้งตามแผน (ครั้งละ 1 ด้าน) */
export const aspectForRound = (round: SupervisionRound): SupervisionAspect =>
  SUPERVISION_ASPECTS[round - 1];

export const getAspect = (id: number): SupervisionAspect | undefined =>
  SUPERVISION_ASPECTS.find(a => a.id === id);

export interface SupervisionLevel {
  min: number;
  label: string;
  color: string;
}

export const SUPERVISION_LEVELS: SupervisionLevel[] = [
  { min: 90, label: 'ดีเยี่ยม', color: '#047857' },
  { min: 80, label: 'ดีมาก', color: '#0369A1' },
  { min: 70, label: 'ดี', color: '#4338CA' },
  { min: 60, label: 'พอใช้', color: '#B45309' },
  { min: 50, label: 'ควรปรับปรุงแก้ไข', color: '#C2410C' },
  { min: 0, label: 'ควรปรับปรุงแก้ไขอย่างยิ่ง', color: '#B91C1C' },
];

export function supervisionLevel(percent: number): SupervisionLevel {
  // ช่วงในแบบนิเทศเป็นจำนวนเต็ม (80-89) จึงปัดเป็นจำนวนเต็มก่อนเทียบ: 89.5 นับเป็น 90
  const p = Math.round(percent);
  return SUPERVISION_LEVELS.find(l => p >= l.min) || SUPERVISION_LEVELS[SUPERVISION_LEVELS.length - 1];
}

/** คะแนนรายข้อ: key = ลำดับข้อ (เริ่ม 0) */
export type SupervisionScores = Record<string, number>;

export interface SupervisionResult {
  total: number;
  max: number;
  percent: number;
  level: string;
  /** จำนวนข้อที่ยังไม่ได้ให้คะแนน */
  missing: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function scoreSupervision(aspectId: number, scores: SupervisionScores): SupervisionResult {
  const aspect = getAspect(aspectId);
  if (!aspect) return { total: 0, max: 0, percent: 0, level: supervisionLevel(0).label, missing: 0 };
  let total = 0;
  let missing = 0;
  aspect.items.forEach((_, i) => {
    const v = scores[String(i)];
    if (typeof v !== 'number' || Number.isNaN(v)) { missing += 1; return; }
    total += Math.min(Math.max(Math.round(v), 0), aspect.maxPerItem);
  });
  const max = aspect.items.length * aspect.maxPerItem;
  const percent = max ? round2((total / max) * 100) : 0;
  return { total, max, percent, level: supervisionLevel(percent).label, missing };
}

export interface SupervisionRecord {
  id: string;
  year: number;
  round: SupervisionRound;
  aspect: SupervisionAspectId;
  date: string;               // YYYY-MM-DD
  teacherKey?: string;        // pos<เลขที่ตำแหน่ง> จากรายชื่อบุคลากร
  teacherEmail: string;       // ตัวเล็ก ใช้จับคู่กับบัญชีครู (ว่างได้ ถ้าครูยังไม่มี Gmail)
  teacherName: string;
  teaching: string;           // รับผิดชอบงานสอน
  homeroom: string;           // งานประจำชั้น
  scores: SupervisionScores;
  itemNotes: Record<string, string>; // หมายเหตุรายข้อ
  suggestion: string;         // ข้อเสนอแนะของคณะกรรมการ
  otherWork: string;          // งานอื่น ๆ ที่ได้รับมอบหมาย
  photoLinks: string[];       // ลิงก์รูปภาพ/หลักฐาน
  committee: { chair: string; member: string; secretary: string };
  total: number;
  max: number;
  percent: number;
  level: string;
  updatedAt: number;
  updatedBy: string;
}

export const normalizeEmail = (email: string) => (email || '').trim().toLowerCase();

/** 1 เอกสารต่อครู 1 คน ต่อ 1 ครั้ง ต่อปีการศึกษา: บันทึกซ้ำจะทับของเดิม ไม่เกิดซ้อน */
export function supervisionDocId(year: number, teacherEmail: string, round: SupervisionRound): string {
  const key = normalizeEmail(teacherEmail).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  return `${year}_${key}_r${round}`;
}

/** เก็บเฉพาะลิงก์ http(s) ที่ถูกต้อง ตัดช่องว่างและตัวซ้ำ */
export function cleanPhotoLinks(raw: string[] | string): string[] {
  const list = Array.isArray(raw) ? raw : raw.split(/[\s,]+/);
  const out: string[] = [];
  for (const item of list) {
    const s = item.trim();
    if (!s) continue;
    try {
      const u = new URL(s);
      if ((u.protocol === 'http:' || u.protocol === 'https:') && !out.includes(u.href)) out.push(u.href);
    } catch { /* not a link */ }
  }
  return out;
}

export interface SupervisionSummary {
  rounds: Array<{ round: SupervisionRound; aspect: SupervisionAspect; record?: SupervisionRecord }>;
  done: number;
  /** ผลรวมร้อยละของด้านที่นิเทศแล้ว */
  sumPercent: number;
  /** เฉลี่ยร้อยละ จากด้านที่นิเทศแล้ว */
  averagePercent: number | null;
  level: string | null;
}

/** ผลการนิเทศของครู 1 คนใน 1 ปีการศึกษา ตามตาราง "ผลการนิเทศ" ท้ายแบบนิเทศ */
export function summarizeSupervision(records: SupervisionRecord[], year: number): SupervisionSummary {
  const rounds = SUPERVISION_ROUNDS.map(round => ({
    round,
    aspect: aspectForRound(round),
    record: records.find(r => r.year === year && r.round === round),
  }));
  const done = rounds.filter(r => r.record);
  const sumPercent = round2(done.reduce((s, r) => s + (r.record?.percent || 0), 0));
  const averagePercent = done.length ? round2(sumPercent / done.length) : null;
  return {
    rounds,
    done: done.length,
    sumPercent,
    averagePercent,
    level: averagePercent === null ? null : supervisionLevel(averagePercent).label,
  };
}

/** ร้อยละแบบอ่านง่าย: 87.5 -> "87.50" */
export const formatPercent = (n: number) => n.toFixed(2);
