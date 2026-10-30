// One way to decide "is this record about this student?" for every system.
// The roster id (student_3206) is the key; older records may only carry the
// เลขประจำตัว (3206) or the name, so those are accepted as fallbacks in that order.

export interface StudentRef {
  id: string;
  code?: string;
  name: string;
}

export interface StudentLinked {
  studentId?: string;
  studentCode?: string;
  studentName?: string;
}

const PREFIXES = /^(เด็กชาย|เด็กหญิง|ด\.ช\.|ด\.ญ\.|นางสาว|นาย|นาง|น\.ส\.)\s*/;

/** "เด็กชายสมชาย  ใจดี" and "นายสมชาย ใจดี" compare equal */
export function normalizeThaiName(name?: string): string {
  return (name || '').replace(/\s+/g, ' ').trim().replace(PREFIXES, '').replace(/\s+/g, '');
}

/** "student_3206" or "3206" -> "3206" */
export function studentCodeOf(idOrCode?: string): string {
  return (idOrCode || '').replace(/^student_/, '').trim();
}

export function sameStudent(rec: StudentLinked, s: StudentRef): boolean {
  if (rec.studentId) return rec.studentId === s.id;
  const code = studentCodeOf(s.code || s.id);
  if (rec.studentCode) return studentCodeOf(rec.studentCode) === code;
  return !!rec.studentName && normalizeThaiName(rec.studentName) === normalizeThaiName(s.name);
}
