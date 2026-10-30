// Default students data — synced 100% from official DMC 1/2569 (ข้อมูลพื้นฐานนักเรียน โรงเรียนบ้านคลองมดแดง รหัส 62020025)
import { DMC_CLASS_METADATA, DMC_STUDENTS_MASTER } from './dmcStudentMaster';
import { SCHOOL_NAME } from '../config/siteLinks';

export const DEFAULT_STUDENTS = {
  title: `สรุปจำนวนนักเรียน${SCHOOL_NAME}`,
  subtitle: 'ข้อมูลตามระบบ DMC ภาคเรียนที่ 1 ปีการศึกษา 2569 (รวม 130 คน · ชาย 80 คน · หญิง 50 คน)',
  rows: DMC_CLASS_METADATA.map(meta => {
    const classStudents = DMC_STUDENTS_MASTER.filter(s => s.roomId === meta.roomId);
    const male = classStudents.filter(s => s.gender === 'male').length;
    const female = classStudents.filter(s => s.gender === 'female').length;
    return {
      class: meta.fullClassName,
      shortClass: meta.shortClass,
      roomId: meta.roomId,
      male,
      female,
      total: male + female,
      teacher: meta.homeroomTeacher,
      note: '',
    };
  }),
};
