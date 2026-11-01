// Thai calendar helpers shared by pages and printed documents (local time, not UTC)

export const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Today's date as YYYY-MM-DD in the browser's local time zone */
export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export type AttendanceDateIssue = 'invalid' | 'future' | 'weekend' | 'closed';

/**
 * Why a date should not get an attendance record, or null for an ordinary school day.
 * `calendar` is the school_calendar entry for the date (open: true = make-up day, false = closed);
 * `holiday` is a holiday title from the activities calendar.
 */
export function attendanceDateIssue(
  date: string,
  today: string,
  calendar?: { open?: boolean },
  holiday?: string,
): AttendanceDateIssue | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return 'invalid';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (d.getMonth() !== Number(m[2]) - 1 || d.getDate() !== Number(m[3])) return 'invalid';
  if (date > today) return 'future';
  if (calendar?.open === true) return null;
  if (calendar?.open === false || holiday) return 'closed';
  return d.getDay() === 0 || d.getDay() === 6 ? 'weekend' : null;
}

/** The current month as YYYY-MM */
export function currentMonth(): string {
  return todayIso().slice(0, 7);
}

/** "2026-10-30" -> "30 ตุลาคม พ.ศ. 2569"; "2026-10" -> "ตุลาคม พ.ศ. 2569" */
export function thaiDateLong(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m) return iso;
  return `${d ? `${d} ` : ''}${THAI_MONTHS[m - 1]} พ.ศ. ${y + 543}`;
}
