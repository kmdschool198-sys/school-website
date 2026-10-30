/**
 * BMI wording used by the body-metrics grid, its printed form and the executive dashboard,
 * so every screen and report labels the same student the same way.
 * These are BMI cut-offs, not the age/sex growth charts of กรมอนามัย.
 */
export function bmiInterpretation(bmi?: number): string {
  if (!bmi || bmi <= 0) return '-';
  if (bmi < 16) return 'ผอมมาก';
  if (bmi < 18.5) return 'ค่อนข้างผอม';
  if (bmi < 23) return 'สมส่วน';
  if (bmi < 25) return 'ท้วม';
  return 'เริ่มอ้วน';
}
