// ─── Exam result announcement system ───
import { TIMETABLE_BACKUP } from './timetableData';

export interface SubjectInfo {
  name: string;        // ชื่อวิชา (เช่น "ภาษาไทย1")
  teacher: string;     // ครูผู้สอน (auto-pulled from timetable)
  maxScore: number;    // คะแนนเต็ม (เช่น 20, 10, 100)
}

export interface ResultRow {
  code: string;
  name: string;
  scores: Record<string, string | number>;  // วิชา → คะแนนที่ได้ (ไม่เกิน maxScore)
  rank?: number;
  note?: string;
}

export interface ResultAnnouncement {
  id: string;
  title: string;
  classId: string;
  className: string;
  subjects: SubjectInfo[];
  records: ResultRow[];
  publishedAt: number;
  visible: boolean;
}

export interface PublicResultAnnouncement {
  id: string;
  title: string;
  classId: string;
  className: string;
  subjects: SubjectInfo[];
  publishedAt: number;
  visible: boolean;
  recordCount: number;
}

export interface ResultLookupDoc extends ResultRow {
  announcementId: string;
  className: string;
  publishedAt: number;
  visible: boolean;
  recordCount: number;
}

export function normalizeResultCode(code: string): string {
  return code.trim();
}

export function resultLookupDocId(announcementId: string, code: string): string {
  return `${announcementId}__${encodeURIComponent(normalizeResultCode(code))}`;
}

export function publicAnnouncementFromResult(
  result: ResultAnnouncement,
  recordCount = result.records.length,
): PublicResultAnnouncement {
  return {
    id: result.id,
    title: result.title,
    classId: result.classId,
    className: result.className,
    subjects: result.subjects,
    publishedAt: result.publishedAt,
    visible: result.visible,
    recordCount,
  };
}

const ACTIVITY_KEYWORDS = [
  'กิจกรรม', 'ลูกเสือ', 'เนตรนารี', 'ชุมนุม', 'สวดมนต์',
  'ตลาดนัดอาชีพ', 'แนะแนว', 'พักกลางวัน', 'อ่านหนังสือ',
];

export function isActivitySubject(name: string): boolean {
  return ACTIVITY_KEYWORDS.some(k => name.includes(k));
}

export function subjectsFromTimetable(classId: string): SubjectInfo[] {
  try {
    const profile = (TIMETABLE_BACKUP as any).profiles[Object.keys((TIMETABLE_BACKUP as any).profiles)[0]];
    const sched = profile.data.sched as Record<string, { subject: string; teacher: string }>;
    const map: Record<string, Record<string, number>> = {};
    for (const [key, cell] of Object.entries(sched)) {
      if (!key.startsWith(classId + '_')) continue;
      const subj = (cell.subject || '').trim();
      if (!subj || isActivitySubject(subj)) continue;
      if (!map[subj]) map[subj] = {};
      const t = cell.teacher || '';
      map[subj][t] = (map[subj][t] || 0) + 1;
    }
    const out: SubjectInfo[] = [];
    for (const [subj, teachers] of Object.entries(map)) {
      let bestT = '', bestN = 0;
      for (const [t, n] of Object.entries(teachers)) {
        if (t && n > bestN) { bestT = t; bestN = n; }
      }
      out.push({ name: subj, teacher: bestT, maxScore: 20 });
    }
    out.sort((a, b) => a.name.localeCompare(b.name, 'th'));
    return out;
  } catch (e) { console.error(e); return []; }
}

// Total score across all subjects
export function totalScore(scores: Record<string, string | number>, subjects: SubjectInfo[]): { sum: number; max: number; pct: number } {
  let sum = 0, max = 0;
  for (const s of subjects) {
    const v = scores[s.name];
    if (v != null && v !== '') {
      const n = typeof v === 'number' ? v : Number(v);
      if (!isNaN(n)) sum += n;
    }
    max += s.maxScore || 0;
  }
  const pct = max > 0 ? (sum / max) * 100 : 0;
  return { sum, max, pct };
}

export function pctColor(pct: number): string {
  if (pct >= 80) return '#10B981';
  if (pct >= 70) return '#3B82F6';
  if (pct >= 60) return '#F59E0B';
  if (pct >= 50) return '#F97316';
  return '#EF4444';
}
