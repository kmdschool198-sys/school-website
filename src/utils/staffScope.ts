// Who may change what. Admins (owner/admin) change everything. A teacher changes only the
// classes they are homeroom teacher of, and only the subjects they teach. Pages use this to
// show a teacher their own classes and subjects and to lock everything else.
import { useMemo } from 'react';
import { canManageStaffUsers, type Role } from './teacherAuth';

const TITLE = /^(ว่าที่\s*(ร\.?ต\.?|ร้อยตรี)\s*(หญิง)?|นางสาว|น\.ส\.|นาง|นาย|ดร\.)\s*/;

/** "นาย อนันตชัย  เพ็ชรรี่" and "อนันตชัย เพ็ชรรี่" are the same person. */
export function normalizePersonName(name?: string): string {
  let n = (name || '').trim().replace(/\s+/g, ' ');
  while (TITLE.test(n)) n = n.replace(TITLE, '');
  return n.replace(/\s+/g, '');
}

/** True when `field` names `person`; `field` may list several names ("ก, ข" or "ก / ข"). */
export function namesInclude(field: string | string[] | undefined, person: string): boolean {
  const me = normalizePersonName(person);
  if (!me) return false;
  const list = Array.isArray(field) ? field : (field || '').split(/[,/]|และ/);
  return list.some(n => normalizePersonName(n) === me);
}

export interface ClassLike {
  id?: string;
  classId?: string;
  roomId?: string;
  acadId?: string;
  label?: string;
  shortClass?: string;
  shortName?: string;
  homeroomTeacher?: string;
  homeroomTeachers?: string[];
}

export interface StaffScope {
  /** owner / admin: may change every class and subject */
  isAdmin: boolean;
  name: string;
  /** keys (id, acadId, label, short name) of the classes this teacher is homeroom teacher of */
  myClassKeys: Set<string>;
  canManageClass: (cls: ClassLike | string | undefined) => boolean;
  canEditSubject: (subjectTeacher: string | undefined) => boolean;
}

function classKeys(c: ClassLike): string[] {
  return [c.id, c.classId, c.roomId, c.acadId, c.label, c.shortClass, c.shortName].filter(Boolean) as string[];
}

export function buildStaffScope(auth: { role: Role; name: string; authed: boolean }, classes: ClassLike[]): StaffScope {
  const isAdmin = auth.authed && canManageStaffUsers(auth.role);
  const myClassKeys = new Set<string>();
  if (auth.authed && !isAdmin) {
    for (const c of classes) {
      const teachers = c.homeroomTeachers || c.homeroomTeacher;
      if (namesInclude(teachers, auth.name)) classKeys(c).forEach(k => myClassKeys.add(k));
    }
  }
  return {
    isAdmin,
    name: auth.name,
    myClassKeys,
    canManageClass: cls => {
      if (isAdmin) return true;
      if (!cls) return false;
      if (typeof cls === 'string') return myClassKeys.has(cls);
      return classKeys(cls).some(k => myClassKeys.has(k));
    },
    canEditSubject: subjectTeacher => isAdmin || namesInclude(subjectTeacher, auth.name),
  };
}

export function useStaffScope(auth: { role: Role; name: string; authed: boolean }, classes: ClassLike[]): StaffScope {
  return useMemo(() => buildStaffScope(auth, classes), [auth.role, auth.name, auth.authed, classes]);
}
