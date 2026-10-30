import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { findDmcStudent } from './dmcStudentMaster';

// Personal and health fields from the DMC 1/2569 student file. They are PDPA-protected, so they
// live in Firestore (staff-only by firestore.rules) instead of the public JS bundle.
// Upload with: npm run upload:student-details
export interface StudentDetails {
  citizenId?: string;
  birthDate?: string;
  age?: number;
  weight?: number;
  height?: number;
  bmi?: number;
  bloodGroup?: string;
  religion?: string;
  address?: string;
  guardianName?: string;
  guardianOccupation?: string;
  guardianRelation?: string;
  fatherName?: string;
  motherName?: string;
  disadvantage?: string;
}

export type StudentDetailsMap = Record<string, StudentDetails>;

export const STUDENT_DETAILS_DOC = { collection: 'student_details', id: 'dmc_2569' } as const;

let cache: StudentDetailsMap = {};
const listeners = new Set<(map: StudentDetailsMap) => void>();
let unsubscribe: (() => void) | null = null;

function subscribe(listener: (map: StudentDetailsMap) => void) {
  listeners.add(listener);
  if (!unsubscribe) {
    unsubscribe = onSnapshot(
      doc(db, STUDENT_DETAILS_DOC.collection, STUDENT_DETAILS_DOC.id),
      snap => {
        cache = (snap.exists() ? (snap.data().students as StudentDetailsMap) : null) || {};
        listeners.forEach(l => l(cache));
      },
      // Visitors who are not signed-in staff get permission-denied: they simply see no details
      () => {
        cache = {};
        listeners.forEach(l => l(cache));
        unsubscribe = null;
      },
    );
  }
  return () => {
    listeners.delete(listener);
  };
}

/** Details for one student, matched the same way as findDmcStudent (code/id, then name). */
export function findStudentDetails(map: StudentDetailsMap, codeOrId?: string, name?: string): StudentDetails | undefined {
  const dmc = findDmcStudent(codeOrId, name);
  return dmc ? map[dmc.id] : undefined;
}

/** Details keyed by DMC student id (e.g. "student_3206"); empty for visitors who are not staff. */
export function useStudentDetails(): StudentDetailsMap {
  const [map, setMap] = useState<StudentDetailsMap>(cache);
  useEffect(() => subscribe(setMap), []);
  return map;
}
