// Janitor (นักการภารโรง) data shared by the daily work log (/janitor-tasks) and the duty
// roster and monthly report (/janitor-duty).
//
// Firestore:
//   janitor_tasks/{janitor_<date>_<staff>}  daily morning/afternoon work record (JanitorDailyRecord)
//   janitor_tasks/{janitor_<date>}          older records saved before per-staff ids; still read
//   config/janitor_roster                   weekly duty pattern + per-date changes (JanitorRoster)

export type DutyShift = 'เช้า' | 'บ่าย' | 'เวรกลางวัน' | 'เวรกลางคืน' | 'เวรวันหยุด';
export const DUTY_SHIFTS: DutyShift[] = ['เช้า', 'บ่าย', 'เวรกลางวัน', 'เวรกลางคืน', 'เวรวันหยุด'];

export interface DutySlot {
  shift: DutyShift;
  staff: string;
  staffId?: string;  // personnel doc id
  area: string;      // พื้นที่/งานที่รับผิดชอบ
  note?: string;
}

export interface JanitorRoster {
  /** Weekly pattern: key is JS weekday 0 (อาทิตย์) .. 6 (เสาร์) */
  weekly: Record<string, DutySlot[]>;
  /** Per-date replacement for the weekly pattern, key YYYY-MM-DD */
  overrides: Record<string, DutySlot[]>;
  updatedAt?: number;
  updatedBy?: string;
}

export const EMPTY_ROSTER: JanitorRoster = { weekly: {}, overrides: {} };

export const WEEKDAY_TH = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

export function janitorDocId(date: string, staffName: string): string {
  return `janitor_${date}_${staffName.trim().replace(/[\s/]+/g, '_')}`;
}

/** Duty slots for one date: the date's override when set, otherwise the weekly pattern. */
export function dutiesForDate(roster: JanitorRoster, date: string): DutySlot[] {
  if (roster.overrides[date]) return roster.overrides[date];
  const [y, m, d] = date.split('-').map(Number);
  return roster.weekly[String(new Date(y, m - 1, d).getDay())] || [];
}
