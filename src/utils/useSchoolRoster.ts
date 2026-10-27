import { useState, useEffect, useMemo } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import {
  DMC_CLASS_METADATA,
  DMC_STUDENTS_MASTER,
  findDmcStudent,
  type DmcStudentMaster,
} from '../data/dmcStudentMaster';

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
  id: string;        // roomId e.g. 'p1_1', 'kg_a2_1', 'm1_1'
  classId: string;   // same as id ('p1_1', 'kg_a2_1', 'm1_1')
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

export function buildSeedRosters(): UnifiedClassRoster[] {
  return DMC_CLASS_METADATA.map(meta => {
    const dmcList = DMC_STUDENTS_MASTER.filter(s => s.roomId === meta.roomId);
    const students: UnifiedStudent[] = dmcList.map((s, idx) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      emoji: s.emoji,
      gender: s.gender,
      no: idx + 1,
      weight: s.weight,
      height: s.height,
      bmi: s.bmi,
      birthDate: s.birthDate,
      age: s.age,
      bloodGroup: s.bloodGroup,
      guardianName: s.guardianName,
      guardianRelation: s.guardianRelation,
      guardianOccupation: s.guardianOccupation,
      fatherName: s.fatherName,
      motherName: s.motherName,
      address: s.address,
      disadvantage: s.disadvantage,
      citizenId: s.citizenId,
    }));
    const maleCount = students.filter(s => s.gender === 'male').length;
    const femaleCount = students.filter(s => s.gender === 'female').length;
    return {
      id: meta.roomId,
      classId: meta.roomId,
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
  cloudClasses?: Array<{ classId: string; label: string; students?: Array<{ id: string; code?: string; name: string; emoji?: string }> }>
): UnifiedClassRoster[] {
  const seed = buildSeedRosters();
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
        id: st.id || dmc?.id || `${base.classId}_s${idx + 1}`,
        code: st.code || dmc?.code || String(idx + 1),
        name: st.name || dmc?.name || '',
        emoji: st.emoji || dmc?.emoji || (gender === 'male' ? '👦' : '👧'),
        gender,
        no: idx + 1,
        weight: dmc?.weight,
        height: dmc?.height,
        bmi: dmc?.bmi,
        birthDate: dmc?.birthDate,
        age: dmc?.age,
        bloodGroup: dmc?.bloodGroup,
        guardianName: dmc?.guardianName,
        guardianRelation: dmc?.guardianRelation,
        guardianOccupation: dmc?.guardianOccupation,
        fatherName: dmc?.fatherName,
        motherName: dmc?.motherName,
        address: dmc?.address,
        disadvantage: dmc?.disadvantage,
        citizenId: dmc?.citizenId,
      };
    });

    const maleCount = mergedStudents.filter(s => s.gender === 'male').length;
    const femaleCount = mergedStudents.filter(s => s.gender === 'female').length;

    return {
      ...base,
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

  useEffect(() => {
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
  }, []);

  const classes = useMemo(() => mergeWithFirestoreClasses(cloudClasses), [cloudClasses]);

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
