import { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { SubjectPlan } from './assessment';

// Full-mark plans per subject and the school's score-entry switch (SGS "บันทึกผลการเรียน").
// Each save merges one leaf, like the score doc, so two teachers never overwrite each other.
const PLANS_DOC = doc(db, 'config', 'assessment_plans_2569');
const STATUS_DOC = doc(db, 'config', 'grading_status_2569');

export type PlansMap = Record<string, Record<string, SubjectPlan>>; // classId -> subjectCode -> plan

export interface GradingStatus {
  /** teachers may enter and change scores; registrars close it before recording remedial results */
  entryOpen: boolean;
  updatedBy?: string;
  updatedAt?: number;
}

export function useAssessmentPlans() {
  const [plans, setPlans] = useState<PlansMap>({});
  useEffect(() => onSnapshot(PLANS_DOC, snap => {
    setPlans(((snap.exists() ? snap.data().plans : null) as PlansMap) || {});
  }, err => console.error('Unable to load assessment plans', err)), []);

  const savePlan = (classId: string, subjectCode: string, plan: SubjectPlan) =>
    setDoc(PLANS_DOC, { plans: { [classId]: { [subjectCode]: plan } }, updatedAt: Date.now() }, { merge: true });

  return { plans, savePlan };
}

/** Score entry is open unless a registrar has closed it */
export function useGradingStatus() {
  const [status, setStatus] = useState<GradingStatus>({ entryOpen: true });
  useEffect(() => onSnapshot(STATUS_DOC, snap => {
    setStatus({ entryOpen: true, ...(snap.exists() ? (snap.data() as Partial<GradingStatus>) : {}) });
  }, err => console.error('Unable to load grading status', err)), []);

  const setEntryOpen = (entryOpen: boolean, by: string) =>
    setDoc(STATUS_DOC, { entryOpen, updatedBy: by, updatedAt: Date.now() }, { merge: true });

  return { status, setEntryOpen };
}
