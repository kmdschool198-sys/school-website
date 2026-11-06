import { useState, useEffect, useMemo } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import {
  DMC_CLASS_METADATA,
  DMC_STUDENTS_MASTER,
  findDmcStudent,
  type DmcStudentMaster,
} from '../data/dmcStudentMaster';
import { useStudentDetails, type StudentDetailsMap } from '../data/studentDetails';
import { useSignedIn } from './useSignedIn';

export interface UnifiedStudent {
  id: string;
  code: string;
  name: string;
  emoji: string;
  gender: 'male' | 'female';
  no: number;
  weight?: number;
  height?: number;
  bmi?: number;
  birthDate?: string;
  age?: number;
  bloodGroup?: string;
  guardianName?: string;
  guardianRelation?: string;
  guardianOccupation?: string;
  fatherName?: string;
  motherName?: string;
  address?: string;
  disadvantage?: string;
  citizenId?: string;
}

export interface UnifiedClassRoster {
  // The class key every Firestore record uses (attendance `{classId}_{date}`, homeroom, lunch, duty):
  // the classId saved in config/attendance_classes (e.g. 'kg_a2_1', 'mnnbhd8om45cr'). Only when the
  // school has no cloud roster yet does it fall back to the DMC room id.
  id: string;
  classId: string;   // same as id
  roomId: string;    // DMC room id 'p1_1', 'kg_a2_1', 'm1_1' (for DMC metadata only)
  acadId: string;    // 'a2', 'a3', 'p1'...'m3'
  shortClass: string;// 'อ.2', 'ป.1', 'ม.1'
  label: string;     // 'อ.2/1', 'ป.1/1', 'ม.1/1'
  fullClassName: string;
  levelGroup: 'ปฐมวัย' | 'ประถม' | 'มัธยม';
  homeroomTeacher: string;
  students: UnifiedStudent[];
  maleCount: number;
  femaleCount: number;
  totalCount: number;
}

function inferGender(name: string, emoji?: string, dmc?: DmcStudentMaster): 'male' | 'female' {
  if (dmc) return dmc.gender;
  const trimmed = (name || '').trim();
  if (/^(เด็กหญิง|ด\.ญ\.|นางสาว|น\.ส\.|นาง)/.test(trimmed) || emoji === '👧') return 'female';
  return 'male';
}

export function buildSeedRosters(details: StudentDetailsMap = {}): UnifiedClassRoster[] {
  return DMC_CLASS_METADATA.map(meta => {
    const dmcList = DMC_STUDENTS_MASTER.filter(s => s.roomId === meta.roomId);
    const students: UnifiedStudent[] = dmcList.map((s, idx) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      emoji: s.emoji,
      gender: s.gender,
      no: idx + 1,
      ...details[s.id],
    }));
    const maleCount = students.filter(s => s.gender === 'male').length;
    const femaleCount = students.filter(s => s.gender === 'female').length;
    return {
      id: meta.roomId,
      classId: meta.roomId,
      roomId: meta.roomId,
      acadId: meta.acadId,
      shortClass: meta.shortClass,
      label: meta.label,
      fullClassName: meta.fullClassName,
      levelGroup: meta.levelGroup,
      homeroomTeacher: meta.homeroomTeacher,
      students,
      maleCount,
      femaleCount,
      totalCount: students.length,
    };
  });
}

export function mergeWithFirestoreClasses(
  cloudClasses?: Array<{ classId: string; label: string; students?: Array<{ id: string; code?: string; name: string; emoji?: string }> }>,
  details: StudentDetailsMap = {}
): UnifiedClassRoster[] {
  const seed = buildSeedRosters(details);
  if (!cloudClasses || cloudClasses.length === 0) return seed;

  return seed.map(base => {
    const cloud = cloudClasses.find(
      c => c.classId === base.classId || c.label === base.label || c.classId === base.acadId
    );
    if (!cloud || !Array.isArray(cloud.students)) {
      return base;
    }

    const mergedStudents: UnifiedStudent[] = cloud.students.map((st, idx) => {
      const dmc = findDmcStudent(st.code || st.id, st.name);
      const gender = inferGender(st.name, st.emoji, dmc);
      return {
        id: st.id || dmc?.id || `${cloud.classId}_s${idx + 1}`,
        code: st.code || dmc?.code || String(idx + 1),
        name: st.name || dmc?.name || '',
        emoji: st.emoji || dmc?.emoji || (gender === 'male' ? '👦' : '👧'),
        gender,
        no: idx + 1,
        ...(dmc ? details[dmc.id] : undefined),
      };
    });

    const maleCount = mergedStudents.filter(s => s.gender === 'male').length;
    const femaleCount = mergedStudents.filter(s => s.gender === 'female').length;

    return {
      ...base,
      id: cloud.classId,
      classId: cloud.classId,
      roomId: base.roomId,
      students: mergedStudents,
      maleCount,
      femaleCount,
      totalCount: mergedStudents.length,
    };
  });
}

export function useSchoolRoster() {
  const [cloudClasses, setCloudClasses] = useState<Array<{ classId: string; label: string; students?: Array<{ id: string; code?: string; name: string; emoji?: string }> }>>([]);
  const [loaded, setLoaded] = useState(false);
  const signedIn = useSignedIn();

  // the live roster is staff data; visitors keep the built-in seed list
  useEffect(() => {
    if (!signedIn) {
      setLoaded(true);
      return;
    }
    return onSnapshot(
      doc(db, 'config', 'attendance_classes'),
      snap => {
        if (snap.exists()) {
          const d = snap.data() as { classes?: Array<{ classId: string; label: string; students?: Array<{ id: string; code?: string; name: string; emoji?: string }> }> };
          if (Array.isArray(d.classes)) {
            setCloudClasses(d.classes);
          }
        }
        setLoaded(true);
      },
      () => setLoaded(true)
    );
  }, [signedIn]);

  // visitors: class sizes from the public summary (config/students_count, kept in step with the
  // roster by the roster manager); the seed list alone is out of date once students move
  const [publicCounts, setPublicCounts] = useState<Record<string, { male: number; female: number }>>({});
  useEffect(() => {
    if (signedIn) return;
    return onSnapshot(doc(db, 'config', 'students_count'), snap => {
      const rows = (snap.data()?.rows || []) as Array<{ class?: string; male?: number; female?: number }>;
      setPublicCounts(Object.fromEntries(rows.filter(r => r.class).map(r => [r.class as string, { male: Number(r.male) || 0, female: Number(r.female) || 0 }])));
    }, () => setPublicCounts({}));
  }, [signedIn]);

  const details = useStudentDetails();
  const classes = useMemo(() => {
    const merged = mergeWithFirestoreClasses(cloudClasses, details);
    if (signedIn) return merged;
    return merged.map(c => {
      const n = publicCounts[c.label];
      return n ? { ...c, maleCount: n.male, femaleCount: n.female, totalCount: n.male + n.female } : c;
    });
  }, [cloudClasses, details, signedIn, publicCounts]);

  const summary = useMemo(() => {
    const totalStudents = classes.reduce((sum, c) => sum + c.totalCount, 0);
    const totalMale = classes.reduce((sum, c) => sum + c.maleCount, 0);
    const totalFemale = classes.reduce((sum, c) => sum + c.femaleCount, 0);
    return {
      totalStudents,
      totalMale,
      totalFemale,
      totalClasses: classes.length,
    };
  }, [classes]);

  return {
    classes,
    summary,
    loaded,
  };
}
