// ─── ปฏิทินเปิด-ปิดโรงเรียน ───
// เดิมทุกหน้าเดาเอาว่า "เสาร์อาทิตย์ หรือ มีวันหยุดใน activities = ไม่ต้องเช็คชื่อ"
// ซึ่งบอกไม่ได้ว่า "เสาร์นี้เปิดเรียนชดเชย" หรือ "อังคารนี้ปิดเพราะน้ำท่วม"
//
// ที่นี่เก็บเฉพาะ "วันที่ต่างจากปกติ" เป็นรายวัน ครูกดเปิด/ปิดเองได้
// วันที่ไม่ได้กดอะไรไว้ ระบบใช้กติกาเดิม (จันทร์-ศุกร์เปิด เสาร์อาทิตย์ปิด)
export const SCHOOL_CALENDAR_COLLECTION = 'school_calendar';

export interface SchoolDayOverride {
  date: string;        // YYYY-MM-DD — ใช้เป็น document id ด้วย
  open: boolean;       // true = เปิดเรียน, false = ปิด
  note?: string;
  teacherName?: string;
  updatedAt: number;
}

export type DayReason = 'override' | 'holiday' | 'weekend' | 'normal';

export interface ResolvedDay {
  open: boolean;
  reason: DayReason;
  label: string;
}

export function isWeekend(date: string): boolean {
  const day = new Date(date + 'T00:00:00').getDay();
  return day === 0 || day === 6;
}

/**
 * ตัดสินว่าวันนั้นโรงเรียนเปิดหรือปิด
 * ลำดับความสำคัญ: สิ่งที่ครูกดไว้ > วันหยุดในปฏิทินกิจกรรม > เสาร์อาทิตย์ > เปิดปกติ
 */
export function resolveSchoolDay(
  date: string,
  overrides: Record<string, SchoolDayOverride>,
  holidays: Record<string, string>,
): ResolvedDay {
  const override = overrides[date];
  if (override) {
    return {
      open: override.open,
      reason: 'override',
      label: override.note || (override.open ? 'เปิดเรียนกรณีพิเศษ' : 'ปิดเรียนกรณีพิเศษ'),
    };
  }
  if (holidays[date]) {
    return { open: false, reason: 'holiday', label: holidays[date] };
  }
  if (isWeekend(date)) {
    return { open: false, reason: 'weekend', label: 'เสาร์-อาทิตย์' };
  }
  return { open: true, reason: 'normal', label: 'วันเรียนปกติ' };
}

/** วันเรียนทั้งหมดของเดือน (YYYY-MM) ที่ต้องมีการเช็คชื่อ */
export function schoolDaysInMonth(
  month: string,
  overrides: Record<string, SchoolDayOverride>,
  holidays: Record<string, string>,
): string[] {
  const [year, mon] = month.split('-').map(Number);
  const days = new Date(year, mon, 0).getDate();
  const out: string[] = [];
  for (let d = 1; d <= days; d++) {
    const date = `${month}-${String(d).padStart(2, '0')}`;
    if (resolveSchoolDay(date, overrides, holidays).open) out.push(date);
  }
  return out;
}

export const DAY_COLORS: Record<DayReason, { bg: string; fg: string }> = {
  override: { bg: '#DBEAFE', fg: '#1E40AF' },
  holiday: { bg: '#FED7AA', fg: '#7C2D12' },
  weekend: { bg: '#FEF2F2', fg: '#FCA5A5' },
  normal: { bg: '#FFFFFF', fg: '#0F172A' },
};
