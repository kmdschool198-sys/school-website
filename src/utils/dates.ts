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
