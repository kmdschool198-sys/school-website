import type { ResultRow } from '../data/results';

export interface RosterStudent {
  id: string;
  code?: string;
  name: string;
  emoji?: string;
}

export interface RosterClass {
  classId: string;
  label: string;
  students: RosterStudent[];
}

export interface RosterStudentLocation {
  student: RosterStudent;
  classId: string;
  classLabel: string;
}

export interface StudentCountRow {
  class: string;
  male: number;
  female: number;
  teacher?: string;
  teacherId?: string;
  note?: string;
  [key: string]: unknown;
}

export interface LinkedClubMember {
  studentId: string;
  code?: string;
  name: string;
  classLabel: string;
  [key: string]: unknown;
}

const normalize = (value: string | undefined) =>
  (value || '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('th-TH');

export function buildRosterIndex(classes: RosterClass[]) {
  const index = new Map<string, RosterStudentLocation>();
  classes.forEach(rosterClass => {
    rosterClass.students.forEach(student => {
      index.set(student.id, {
        student,
        classId: rosterClass.classId,
        classLabel: rosterClass.label,
      });
    });
  });
  return index;
}

export function detectRosterChanges(previous: RosterClass[], next: RosterClass[]) {
  const previousIndex = buildRosterIndex(previous);
  const nextIndex = buildRosterIndex(next);
  const addedToClass: Array<{ id: string; classId: string }> = [];
  const removedFromClass: Array<{ id: string; classId: string }> = [];
  const deletedIds: string[] = [];
  const changedIds: string[] = [];

  nextIndex.forEach((location, id) => {
    const before = previousIndex.get(id);
    if (!before || before.classId !== location.classId) {
      addedToClass.push({ id, classId: location.classId });
    }
    if (before && (
      before.classId !== location.classId
      || normalize(before.student.name) !== normalize(location.student.name)
      || normalize(before.student.code) !== normalize(location.student.code)
      || before.student.emoji !== location.student.emoji
    )) {
      changedIds.push(id);
    }
  });

  previousIndex.forEach((location, id) => {
    const after = nextIndex.get(id);
    if (!after || after.classId !== location.classId) {
      removedFromClass.push({ id, classId: location.classId });
    }
    if (!after) deletedIds.push(id);
  });

  return {
    previousIndex,
    nextIndex,
    addedToClass,
    removedFromClass,
    deletedIds,
    changedIds,
    hasChanges: addedToClass.length > 0
      || removedFromClass.length > 0
      || changedIds.length > 0,
  };
}

function studentGender(student: RosterStudent) {
  const name = student.name.trim();
  if (/^(เด็กชาย|ด\.ช\.|นาย)\s*/.test(name) || student.emoji === '👦') return 'male';
  if (/^(เด็กหญิง|ด\.ญ\.|นางสาว|น\.ส\.|นาง)\s*/.test(name) || student.emoji === '👧') return 'female';
  return null;
}

export function buildStudentCountRows(
  classes: RosterClass[],
  existingRows: StudentCountRow[] = [],
) {
  return classes.map(rosterClass => {
    const existing = existingRows.find(row => normalize(row.class) === normalize(rosterClass.label));
    const male = rosterClass.students.filter(student => studentGender(student) === 'male').length;
    const female = rosterClass.students.filter(student => studentGender(student) === 'female').length;
    return {
      ...(existing || {}),
      class: rosterClass.label,
      male,
      female,
      teacher: existing?.teacher || '',
      teacherId: existing?.teacherId || '',
      note: existing?.note || '',
    };
  });
}

export function syncClubMembers(
  members: LinkedClubMember[],
  rosterIndex: Map<string, RosterStudentLocation>,
) {
  let changed = false;
  const synced = members.flatMap(member => {
    const current = rosterIndex.get(member.studentId);
    if (!current) {
      changed = true;
      return [];
    }
    const code = current.student.code || current.student.id;
    if (
      member.name !== current.student.name
      || member.code !== code
      || member.classLabel !== current.classLabel
    ) {
      changed = true;
      return [{
        ...member,
        name: current.student.name,
        code,
        classLabel: current.classLabel,
      }];
    }
    return [member];
  });
  return { members: synced, changed };
}

export function syncDraftResultRows(
  rows: ResultRow[],
  students: RosterStudent[],
) {
  return students.map(student => {
    const code = student.code || student.id;
    const existing = rows.find(row => row.studentId === student.id)
      || rows.find(row => normalize(row.code) === normalize(code))
      || rows.find(row => normalize(row.name) === normalize(student.name));
    return existing
      ? { ...existing, studentId: student.id, code, name: student.name }
      : { studentId: student.id, code, name: student.name, scores: {}, note: '' };
  });
}

export function findExistingStudent(
  classes: RosterClass[],
  code: string | undefined,
  name: string,
) {
  const normalizedCode = normalize(code);
  const normalizedName = normalize(name);
  const allStudents = classes.flatMap(rosterClass => rosterClass.students);
  return (normalizedCode
    ? allStudents.find(student => normalize(student.code) === normalizedCode)
    : undefined)
    || (normalizedName
      ? allStudents.find(student => normalize(student.name) === normalizedName)
      : undefined);
}
