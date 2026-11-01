// Study time for ปพ.5 from the daily attendance check (pure functions, no Firebase).
// attendance/{classId}_{date}.records is keyed by the roster student id ("{classId}_{code}"),
// with status present / absent / leave. A student must attend at least 80% of the time or the
// subject result is มส.
export const MIN_ATTENDANCE_RATIO = 0.8;

export interface AttendanceDay {
  date: string;
  records?: Record<string, { status?: string }>;
}

const dayBefore = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** First and last day of a term, from the school calendar's เปิด/ปิดภาคเรียน entries (DEFAULT_ACTIVITIES) */
export function termRange(calendar: { id: string; date: string }[], term: 1 | 2, year = '69'): { from: string; to: string } {
  const open = calendar.find(a => a.id === `d-open-${term}-${year}`);
  const close = calendar.find(a => a.id === `d-close-${term}-${year}`);
  if (!open || !close) throw new Error(`ไม่พบวันเปิด/ปิดภาคเรียนที่ ${term} ในปฏิทิน`);
  return { from: open.date, to: dayBefore(close.date) };
}

/** Days the student was checked in the range, and how many of them they were present */
export function attendanceCount(days: AttendanceDay[], studentId: string, range: { from: string; to: string }) {
  let checked = 0;
  let present = 0;
  for (const day of days) {
    if (day.date < range.from || day.date > range.to) continue;
    const rec = day.records?.[studentId];
    if (!rec) continue;
    checked++;
    if ((rec.status || 'present') === 'present') present++;
  }
  return { checked, present };
}

/** Hours attended out of the subject's hours, scaled by the share of checked days present */
export function attendedHours(count: { checked: number; present: number }, subjectHours: number) {
  if (!count.checked) return null;
  return Math.round((count.present / count.checked) * subjectHours);
}

export const isUnderAttendance = (hours: number, subjectHours: number) => hours < subjectHours * MIN_ATTENDANCE_RATIO;
