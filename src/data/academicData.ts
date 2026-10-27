// Auto-generated from C:\Users\KruJames\Desktop\ตัดเกรดนักเรียน ปลายภาคเรียน 1-2569 (งานวัดผล)
// Contains real student rosters (ข้อมูลนักเรียน.xlsx) and real PorPor 5 / PorPor 6 scores (1/2569)

export interface AcademicSubject {
  code: string;
  name: string;
  type: 'พื้นฐาน' | 'เพิ่มเติม';
  group: string;
  credits: number;
  hours: number;
  teacher: string;
}

export interface StudentSubjectScore {
  coursework: number;     // คะแนนเก็บระหว่างภาค (เต็ม 70)
  finalExam: number;      // คะแนนสอบปลายภาค (เต็ม 30)
  total: number;          // คะแนนรวม (เต็ม 100)
  grade: string;          // 4, 3.5, 3, 2.5, 2, 1.5, 1, 0, ร, มส
  attendedHours: number;  // เวลาเรียนที่มาจริง
  traitScore: number;     // คุณลักษณะอันพึงประสงค์ (0-3)
  readThinkScore: number; // อ่าน คิด วิเคราะห์และเขียน (0-3)
}

export interface AcademicStudentRecord {
  no: number;
  code: string;
  name: string;
  gender: 'male' | 'female';
  scores: Record<string, StudentSubjectScore>;
  traitResult: 'ดีเยี่ยม' | 'ดี' | 'ผ่าน' | 'ไม่ผ่าน';
  readThinkResult: 'ดีเยี่ยม' | 'ดี' | 'ผ่าน' | 'ไม่ผ่าน';
  activityResult: 'ผ่าน' | 'ไม่ผ่าน';
}

export interface ClassAcademicData {
  classId: string;
  shortName: string;
  className: string;
  level: 'ประถม' | 'มัธยม';
  room: number;
  semester: string;
  year: string;
  schoolName: string;
  affiliation: string;
  director: string;
  homeroomTeachers: string[];
  subjects: AcademicSubject[];
  activities: Array<{ code: string; name: string; hours: number }>;
  students: AcademicStudentRecord[];
}

export const SUBJECT_GROUPS = [
  'ทั้งหมด (ทุกกลุ่มสาระฯ)',
  'ภาษาไทย (พื้นฐาน)',
  'คณิตศาสตร์ (พื้นฐาน)',
  'คณิตศาสตร์ (เพิ่มเติม)',
  'วิทยาศาสตร์ฯ (พื้นฐาน)',
  'วิทยาศาสตร์ฯ (เพิ่มเติม)',
  'สังคมศึกษาฯ (พื้นฐาน)',
  'สุขศึกษาฯ (พื้นฐาน)',
  'ศิลปะ (พื้นฐาน)',
  'การงานอาชีพฯ (พื้นฐาน)',
  'การงานอาชีพฯ (เพิ่มเติม)',
  'ภาษาต่างประเทศ (พื้นฐาน)',
  'ภาษาต่างประเทศ (เพิ่มเติม)',
  'กิจกรรมพัฒนาผู้เรียน',
] as const;

export function scoreToGrade(total: number, special?: string): string {
  if (special === 'ร' || special === 'มส') return special;
  if (total >= 80) return '4';
  if (total >= 75) return '3.5';
  if (total >= 70) return '3';
  if (total >= 65) return '2.5';
  if (total >= 60) return '2';
  if (total >= 55) return '1.5';
  if (total >= 50) return '1';
  return '0';
}

export function calculateStudentGPA(
  student: AcademicStudentRecord,
  subjects: AcademicSubject[],
  porPor6Core12Only = false
) {
  const targetSubjects = porPor6Core12Only
    ? subjects.filter(s => !['ว21103', 'ว21104', 'ว22103', 'ว22104', 'ว23103', 'ว23104'].includes(s.code))
    : subjects;

  let coreCredits = 0;
  let electiveCredits = 0;
  let earnedCredits = 0;
  let weightedPoints = 0;

  for (const subj of targetSubjects) {
    const sc = student.scores[subj.code];
    const gStr = sc ? sc.grade : '0';
    const gNum = parseFloat(gStr);
    if (subj.type === 'พื้นฐาน') coreCredits += subj.credits;
    else electiveCredits += subj.credits;

    if (!isNaN(gNum) && gNum > 0) {
      earnedCredits += subj.credits;
      weightedPoints += subj.credits * gNum;
    }
  }

  const totalCredits = coreCredits + electiveCredits;
  const gpa = totalCredits > 0 ? weightedPoints / totalCredits : 0;

  return {
    coreCredits,
    electiveCredits,
    totalCredits,
    earnedCredits,
    gpa: Number(gpa.toFixed(2)),
    gpaFormatted: gpa.toFixed(2),
  };
}

export function calculateClassRanks(
  students: AcademicStudentRecord[],
  subjects: AcademicSubject[]
): Record<string, { rank: number; total: number; gpa: number }> {
  const list = students.map(st => ({
    code: st.code,
    gpa: calculateStudentGPA(st, subjects, true).gpa,
  }));
  const sorted = [...list].sort((a, b) => b.gpa - a.gpa);
  const result: Record<string, { rank: number; total: number; gpa: number }> = {};
  let currentRank = 1;
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i].gpa < sorted[i - 1].gpa) {
      currentRank = i + 1;
    }
    result[sorted[i].code] = {
      rank: currentRank,
      total: students.length,
      gpa: sorted[i].gpa,
    };
  }
  return result;
}

export const INITIAL_ACADEMIC_DATA: ClassAcademicData[] = [
  {
    "classId": "p1",
    "shortName": "ป.1",
    "className": "ประถมศึกษาปีที่ 1",
    "level": "ประถม",
    "room": 1,
    "semester": "1",
    "year": "2569",
    "schoolName": "โรงเรียนบ้านคลองมดแดง",
    "affiliation": "สำนักงานเขตพื้นที่การศึกษาประถมศึกษากำแพงเพชร เขต 2",
    "director": "นายปรัชญา ปรางค์ชัยภูมิ",
    "homeroomTeachers": [
      "นางสาวธิดารัตน์ แรตสอน"
    ],
    "subjects": [
      {
        "code": "ท11101",
        "name": "ภาษาไทย 1",
        "type": "พื้นฐาน",
        "group": "ภาษาไทย (พื้นฐาน)",
        "credits": 4.0,
        "hours": 80,
        "teacher": "นายนวพานิชณ์ วังคีรี"
      },
      {
        "code": "ค11101",
        "name": "คณิตศาสตร์ 1",
        "type": "พื้นฐาน",
        "group": "คณิตศาสตร์ (พื้นฐาน)",
        "credits": 4.0,
        "hours": 80,
        "teacher": "นางสาวธิดารัตน์ แรตสอน"
      },
      {
        "code": "ว11101",
        "name": "วิทยาศาสตร์และเทคโนโลยี 1",
        "type": "พื้นฐาน",
        "group": "วิทยาศาสตร์ฯ (พื้นฐาน)",
        "credits": 2.0,
        "hours": 40,
        "teacher": "นางสาวธิดารัตน์ แรตสอน"
      },
      {
        "code": "ส11101",
        "name": "สังคมศึกษา ศาสนาและวัฒนธรรม 1",
        "type": "พื้นฐาน",
        "group": "สังคมศึกษาฯ (พื้นฐาน)",
        "credits": 1.0,
        "hours": 20,
        "teacher": "นางสาวภัทรสุดา สุหงษา"
      },
      {
        "code": "ส11102",
        "name": "ประวัติศาสตร์ 1",
        "type": "พื้นฐาน",
        "group": "สังคมศึกษาฯ (พื้นฐาน)",
        "credits": 1.0,
        "hours": 20,
        "teacher": "นางสาวภัทรสุดา สุหงษา"
      },
      {
        "code": "พ11101",
        "name": "สุขศึกษาและพลศึกษา 1",
        "type": "พื้นฐาน",
        "group": "สุขศึกษาฯ (พื้นฐาน)",
        "credits": 1.0,
        "hours": 20,
        "teacher": "นายนวพานิชณ์ วังคีรี"
      },
      {
        "code": "ศ11101",
        "name": "ศิลปะ 1",
        "type": "พื้นฐาน",
        "group": "ศิลปะ (พื้นฐาน)",
        "credits": 1.0,
        "hours": 20,
        "teacher": "นายพีระ เดชะผล"
      },
      {
        "code": "ง11101",
        "name": "การงานอาชีพ 1",
        "type": "พื้นฐาน",
        "group": "การงานอาชีพฯ (พื้นฐาน)",
        "credits": 1.0,
        "hours": 20,
        "teacher": "นายอนันตชัย เพ็ชรรี่"
      },
      {
        "code": "อ11101",
        "name": "ภาษาอังกฤษ 1",
        "type": "พื้นฐาน",
        "group": "ภาษาต่างประเทศ (พื้นฐาน)",
        "credits": 4.0,
        "hours": 80,
        "teacher": "นางสาวธญาภรณ์ คล้ายเพ็ง"
      }
    ],
    "activities": [
      {
        "code": "ก11101",
        "name": "กิจกรรมแนะแนว",
        "hours": 20
      },
      {
        "code": "ก11102",
        "name": "กิจกรรมลูกเสือ / เนตรนารี",
        "hours": 20
      },
      {
        "code": "ก11103",
        "name": "กิจกรรมชุมนุม / ตลาดนัดอาชีพ",
        "hours": 20
      },
      {
        "code": "ก11104",
        "name": "กิจกรรมเพื่อสังคมและสาธารณประโยชน์",
        "hours": 10
      }
    ],
    "students": [
      {
        "no": 1,
        "code": "3069",
        "name": "เด็กชายณัฐพัฒน์ จันทร์สิงห์",
        "gender": "male",
        "scores": {
          "ท11101": {
            "coursework": 65,
            "finalExam": 23,
            "total": 88,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค11101": {
            "coursework": 67,
            "finalExam": 26,
            "total": 93,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว11101": {
            "coursework": 64,
            "finalExam": 21,
            "total": 85,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส11101": {
            "coursework": 64,
            "finalExam": 22,
            "total": 86,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส11102": {
            "coursework": 68,
            "finalExam": 28,
            "total": 96,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ11101": {
            "coursework": 68,
            "finalExam": 27,
            "total": 95,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ11101": {
            "coursework": 67,
            "finalExam": 28,
            "total": 95,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง11101": {
            "coursework": 65,
            "finalExam": 24,
            "total": 89,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ11101": {
            "coursework": 63,
            "finalExam": 19,
            "total": 82,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 2,
        "code": "3071",
        "name": "เด็กชายระพีพัฒน์ เลิกนอก",
        "gender": "male",
        "scores": {
          "ท11101": {
            "coursework": 58,
            "finalExam": 25,
            "total": 83,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค11101": {
            "coursework": 52,
            "finalExam": 16,
            "total": 68,
            "grade": "2.5",
            "attendedHours": 80,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ว11101": {
            "coursework": 55,
            "finalExam": 19,
            "total": 74,
            "grade": "3",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส11101": {
            "coursework": 54,
            "finalExam": 18,
            "total": 72,
            "grade": "3",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส11102": {
            "coursework": 54,
            "finalExam": 19,
            "total": 73,
            "grade": "3",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ11101": {
            "coursework": 55,
            "finalExam": 19,
            "total": 74,
            "grade": "3",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ11101": {
            "coursework": 54,
            "finalExam": 18,
            "total": 72,
            "grade": "3",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง11101": {
            "coursework": 58,
            "finalExam": 24,
            "total": 82,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ11101": {
            "coursework": 58,
            "finalExam": 24,
            "total": 82,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 3,
        "code": "3070",
        "name": "เด็กชายวงศกร เลิกนอก",
        "gender": "male",
        "scores": {
          "ท11101": {
            "coursework": 59,
            "finalExam": 21,
            "total": 80,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค11101": {
            "coursework": 61,
            "finalExam": 23,
            "total": 84,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว11101": {
            "coursework": 62,
            "finalExam": 26,
            "total": 88,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส11101": {
            "coursework": 60,
            "finalExam": 22,
            "total": 82,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส11102": {
            "coursework": 58,
            "finalExam": 19,
            "total": 77,
            "grade": "3.5",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ11101": {
            "coursework": 62,
            "finalExam": 25,
            "total": 87,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ11101": {
            "coursework": 59,
            "finalExam": 19,
            "total": 78,
            "grade": "3.5",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง11101": {
            "coursework": 59,
            "finalExam": 19,
            "total": 78,
            "grade": "3.5",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ11101": {
            "coursework": 57,
            "finalExam": 17,
            "total": 74,
            "grade": "3",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 4,
        "code": "3072",
        "name": "เด็กชายณฐพงศ์ พวงมาลี",
        "gender": "male",
        "scores": {
          "ท11101": {
            "coursework": 52,
            "finalExam": 21,
            "total": 73,
            "grade": "3",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค11101": {
            "coursework": 47,
            "finalExam": 14,
            "total": 61,
            "grade": "2",
            "attendedHours": 80,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ว11101": {
            "coursework": 49,
            "finalExam": 17,
            "total": 66,
            "grade": "2.5",
            "attendedHours": 40,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ส11101": {
            "coursework": 49,
            "finalExam": 16,
            "total": 65,
            "grade": "2.5",
            "attendedHours": 20,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ส11102": {
            "coursework": 52,
            "finalExam": 22,
            "total": 74,
            "grade": "3",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ11101": {
            "coursework": 53,
            "finalExam": 22,
            "total": 75,
            "grade": "3.5",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ11101": {
            "coursework": 46,
            "finalExam": 14,
            "total": 60,
            "grade": "2",
            "attendedHours": 20,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ง11101": {
            "coursework": 50,
            "finalExam": 17,
            "total": 67,
            "grade": "2.5",
            "attendedHours": 20,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "อ11101": {
            "coursework": 52,
            "finalExam": 20,
            "total": 72,
            "grade": "3",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดี",
        "readThinkResult": "ดี",
        "activityResult": "ผ่าน"
      },
      {
        "no": 5,
        "code": "3149",
        "name": "เด็กชายเชาวลิต แสงทองศรี",
        "gender": "male",
        "scores": {
          "ท11101": {
            "coursework": 60,
            "finalExam": 24,
            "total": 84,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค11101": {
            "coursework": 59,
            "finalExam": 20,
            "total": 79,
            "grade": "3.5",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว11101": {
            "coursework": 59,
            "finalExam": 22,
            "total": 81,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส11101": {
            "coursework": 57,
            "finalExam": 17,
            "total": 74,
            "grade": "3",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส11102": {
            "coursework": 62,
            "finalExam": 26,
            "total": 88,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ11101": {
            "coursework": 57,
            "finalExam": 17,
            "total": 74,
            "grade": "3",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ11101": {
            "coursework": 61,
            "finalExam": 24,
            "total": 85,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง11101": {
            "coursework": 61,
            "finalExam": 26,
            "total": 87,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ11101": {
            "coursework": 61,
            "finalExam": 24,
            "total": 85,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 6,
        "code": "3150",
        "name": "เด็กชายกมลโชค ปู่วาคี",
        "gender": "male",
        "scores": {
          "ท11101": {
            "coursework": 57,
            "finalExam": 24,
            "total": 81,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค11101": {
            "coursework": 52,
            "finalExam": 17,
            "total": 69,
            "grade": "2.5",
            "attendedHours": 80,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ว11101": {
            "coursework": 53,
            "finalExam": 17,
            "total": 70,
            "grade": "3",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "ส11101": {
            "coursework": 57,
            "finalExam": 24,
            "total": 81,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส11102": {
            "coursework": 57,
            "finalExam": 23,
            "total": 80,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ11101": {
            "coursework": 54,
            "finalExam": 20,
            "total": 74,
            "grade": "3",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ11101": {
            "coursework": 51,
            "finalExam": 15,
            "total": 66,
            "grade": "2.5",
            "attendedHours": 20,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ง11101": {
            "coursework": 56,
            "finalExam": 23,
            "total": 79,
            "grade": "3.5",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ11101": {
            "coursework": 56,
            "finalExam": 23,
            "total": 79,
            "grade": "3.5",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 7,
        "code": "3151",
        "name": "เด็กชายสิษฐ์กัณฑ์ แสงทองศรี",
        "gender": "male",
        "scores": {
          "ท11101": {
            "coursework": 65,
            "finalExam": 20,
            "total": 85,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค11101": {
            "coursework": 68,
            "finalExam": 28,
            "total": 96,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว11101": {
            "coursework": 66,
            "finalExam": 24,
            "total": 90,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส11101": {
            "coursework": 64,
            "finalExam": 19,
            "total": 83,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส11102": {
            "coursework": 68,
            "finalExam": 26,
            "total": 94,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ11101": {
            "coursework": 66,
            "finalExam": 23,
            "total": 89,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ11101": {
            "coursework": 66,
            "finalExam": 23,
            "total": 89,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง11101": {
            "coursework": 67,
            "finalExam": 24,
            "total": 91,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ11101": {
            "coursework": 68,
            "finalExam": 28,
            "total": 96,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 8,
        "code": "3152",
        "name": "เด็กชายชลธร ศรีสุข",
        "gender": "male",
        "scores": {
          "ท11101": {
            "coursework": 62,
            "finalExam": 22,
            "total": 84,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค11101": {
            "coursework": 59,
            "finalExam": 19,
            "total": 78,
            "grade": "3.5",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว11101": {
            "coursework": 64,
            "finalExam": 27,
            "total": 91,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส11101": {
            "coursework": 61,
            "finalExam": 21,
            "total": 82,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส11102": {
            "coursework": 61,
            "finalExam": 20,
            "total": 81,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ11101": {
            "coursework": 61,
            "finalExam": 22,
            "total": 83,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ11101": {
            "coursework": 64,
            "finalExam": 26,
            "total": 90,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง11101": {
            "coursework": 60,
            "finalExam": 20,
            "total": 80,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ11101": {
            "coursework": 64,
            "finalExam": 27,
            "total": 91,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 9,
        "code": "3153",
        "name": "เด็กชายอนาวิล พลอยประดับ",
        "gender": "male",
        "scores": {
          "ท11101": {
            "coursework": 56,
            "finalExam": 21,
            "total": 77,
            "grade": "3.5",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค11101": {
            "coursework": 57,
            "finalExam": 20,
            "total": 77,
            "grade": "3.5",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว11101": {
            "coursework": 58,
            "finalExam": 23,
            "total": 81,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส11101": {
            "coursework": 57,
            "finalExam": 22,
            "total": 79,
            "grade": "3.5",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส11102": {
            "coursework": 56,
            "finalExam": 21,
            "total": 77,
            "grade": "3.5",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ11101": {
            "coursework": 57,
            "finalExam": 20,
            "total": 77,
            "grade": "3.5",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ11101": {
            "coursework": 55,
            "finalExam": 19,
            "total": 74,
            "grade": "3",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง11101": {
            "coursework": 59,
            "finalExam": 24,
            "total": 83,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ11101": {
            "coursework": 56,
            "finalExam": 19,
            "total": 75,
            "grade": "3.5",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 10,
        "code": "3213",
        "name": "เด็กชายภพธร กะวันทา",
        "gender": "male",
        "scores": {
          "ท11101": {
            "coursework": 65,
            "finalExam": 22,
            "total": 87,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค11101": {
            "coursework": 68,
            "finalExam": 28,
            "total": 96,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว11101": {
            "coursework": 66,
            "finalExam": 25,
            "total": 91,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส11101": {
            "coursework": 63,
            "finalExam": 19,
            "total": 82,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส11102": {
            "coursework": 65,
            "finalExam": 23,
            "total": 88,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ11101": {
            "coursework": 66,
            "finalExam": 24,
            "total": 90,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ11101": {
            "coursework": 67,
            "finalExam": 28,
            "total": 95,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง11101": {
            "coursework": 65,
            "finalExam": 22,
            "total": 87,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ11101": {
            "coursework": 67,
            "finalExam": 26,
            "total": 93,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 11,
        "code": "3214",
        "name": "เด็กหญิงสุุภัสสรา เอี่ยมพงษ์",
        "gender": "female",
        "scores": {
          "ท11101": {
            "coursework": 60,
            "finalExam": 21,
            "total": 81,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค11101": {
            "coursework": 58,
            "finalExam": 18,
            "total": 76,
            "grade": "3.5",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว11101": {
            "coursework": 61,
            "finalExam": 22,
            "total": 83,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส11101": {
            "coursework": 61,
            "finalExam": 24,
            "total": 85,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส11102": {
            "coursework": 62,
            "finalExam": 25,
            "total": 87,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ11101": {
            "coursework": 62,
            "finalExam": 24,
            "total": 86,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ11101": {
            "coursework": 63,
            "finalExam": 26,
            "total": 89,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง11101": {
            "coursework": 58,
            "finalExam": 19,
            "total": 77,
            "grade": "3.5",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ11101": {
            "coursework": 60,
            "finalExam": 21,
            "total": 81,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      }
    ]
  },
  {
    "classId": "p2",
    "shortName": "ป.2",
    "className": "ประถมศึกษาปีที่ 2",
    "level": "ประถม",
    "room": 1,
    "semester": "1",
    "year": "2569",
    "schoolName": "โรงเรียนบ้านคลองมดแดง",
    "affiliation": "สำนักงานเขตพื้นที่การศึกษาประถมศึกษากำแพงเพชร เขต 2",
    "director": "นายปรัชญา ปรางค์ชัยภูมิ",
    "homeroomTeachers": [
      "นางสาวภัทรสุดา สุหงษา"
    ],
    "subjects": [
      {
        "code": "ท12101",
        "name": "ภาษาไทย 2",
        "type": "พื้นฐาน",
        "group": "ภาษาไทย (พื้นฐาน)",
        "credits": 4.0,
        "hours": 80,
        "teacher": "นายนวพานิชณ์ วังคีรี"
      },
      {
        "code": "ค12101",
        "name": "คณิตศาสตร์ 2",
        "type": "พื้นฐาน",
        "group": "คณิตศาสตร์ (พื้นฐาน)",
        "credits": 4.0,
        "hours": 80,
        "teacher": "นางสาวธิดารัตน์ แรตสอน"
      },
      {
        "code": "ว12101",
        "name": "วิทยาศาสตร์และเทคโนโลยี 2",
        "type": "พื้นฐาน",
        "group": "วิทยาศาสตร์ฯ (พื้นฐาน)",
        "credits": 2.0,
        "hours": 40,
        "teacher": "นางสาวธญาภรณ์ คล้ายเพ็ง"
      },
      {
        "code": "ส12101",
        "name": "สังคมศึกษา ศาสนาและวัฒนธรรม 2",
        "type": "พื้นฐาน",
        "group": "สังคมศึกษาฯ (พื้นฐาน)",
        "credits": 1.0,
        "hours": 20,
        "teacher": "นางสาวภัทรสุดา สุหงษา"
      },
      {
        "code": "ส12102",
        "name": "ประวัติศาสตร์ 2",
        "type": "พื้นฐาน",
        "group": "สังคมศึกษาฯ (พื้นฐาน)",
        "credits": 1.0,
        "hours": 20,
        "teacher": "นางสาวภัทรสุดา สุหงษา"
      },
      {
        "code": "พ12101",
        "name": "สุขศึกษาและพลศึกษา 2",
        "type": "พื้นฐาน",
        "group": "สุขศึกษาฯ (พื้นฐาน)",
        "credits": 1.0,
        "hours": 20,
        "teacher": "นายนวพานิชณ์ วังคีรี"
      },
      {
        "code": "ศ12101",
        "name": "ศิลปะ 2",
        "type": "พื้นฐาน",
        "group": "ศิลปะ (พื้นฐาน)",
        "credits": 1.0,
        "hours": 20,
        "teacher": "นายพีระ เดชะผล"
      },
      {
        "code": "ง12101",
        "name": "การงานอาชีพ 2",
        "type": "พื้นฐาน",
        "group": "การงานอาชีพฯ (พื้นฐาน)",
        "credits": 1.0,
        "hours": 20,
        "teacher": "นายอนันตชัย เพ็ชรรี่"
      },
      {
        "code": "อ12101",
        "name": "ภาษาอังกฤษ 2",
        "type": "พื้นฐาน",
        "group": "ภาษาต่างประเทศ (พื้นฐาน)",
        "credits": 4.0,
        "hours": 80,
        "teacher": "นางสาวธญาภรณ์ คล้ายเพ็ง"
      }
    ],
    "activities": [
      {
        "code": "ก11101",
        "name": "กิจกรรมแนะแนว",
        "hours": 20
      },
      {
        "code": "ก11102",
        "name": "กิจกรรมลูกเสือ / เนตรนารี",
        "hours": 20
      },
      {
        "code": "ก11103",
        "name": "กิจกรรมชุมนุม / ตลาดนัดอาชีพ",
        "hours": 20
      },
      {
        "code": "ก11104",
        "name": "กิจกรรมเพื่อสังคมและสาธารณประโยชน์",
        "hours": 10
      }
    ],
    "students": [
      {
        "no": 1,
        "code": "2987",
        "name": "เด็กชายธนาธิป ภู่ระหงษ์",
        "gender": "male",
        "scores": {
          "ท12101": {
            "coursework": 63,
            "finalExam": 22,
            "total": 85,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค12101": {
            "coursework": 65,
            "finalExam": 27,
            "total": 92,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว12101": {
            "coursework": 64,
            "finalExam": 23,
            "total": 87,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส12101": {
            "coursework": 65,
            "finalExam": 24,
            "total": 89,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส12102": {
            "coursework": 62,
            "finalExam": 20,
            "total": 82,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ12101": {
            "coursework": 62,
            "finalExam": 21,
            "total": 83,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ12101": {
            "coursework": 66,
            "finalExam": 28,
            "total": 94,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง12101": {
            "coursework": 66,
            "finalExam": 26,
            "total": 92,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ12101": {
            "coursework": 63,
            "finalExam": 21,
            "total": 84,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 2,
        "code": "2997",
        "name": "เด็กชายพีรวัศ สุขเสริม",
        "gender": "male",
        "scores": {
          "ท12101": {
            "coursework": 66,
            "finalExam": 26,
            "total": 92,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค12101": {
            "coursework": 63,
            "finalExam": 20,
            "total": 83,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว12101": {
            "coursework": 65,
            "finalExam": 24,
            "total": 89,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส12101": {
            "coursework": 67,
            "finalExam": 27,
            "total": 94,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส12102": {
            "coursework": 66,
            "finalExam": 26,
            "total": 92,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ12101": {
            "coursework": 68,
            "finalExam": 27,
            "total": 95,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ12101": {
            "coursework": 64,
            "finalExam": 20,
            "total": 84,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง12101": {
            "coursework": 63,
            "finalExam": 20,
            "total": 83,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ12101": {
            "coursework": 67,
            "finalExam": 26,
            "total": 93,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 3,
        "code": "3073",
        "name": "เด็กชายมรุเดช แก้วมณี",
        "gender": "male",
        "scores": {
          "ท12101": {
            "coursework": 63,
            "finalExam": 24,
            "total": 87,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค12101": {
            "coursework": 59,
            "finalExam": 18,
            "total": 77,
            "grade": "3.5",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว12101": {
            "coursework": 60,
            "finalExam": 19,
            "total": 79,
            "grade": "3.5",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส12101": {
            "coursework": 62,
            "finalExam": 21,
            "total": 83,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส12102": {
            "coursework": 61,
            "finalExam": 21,
            "total": 82,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ12101": {
            "coursework": 64,
            "finalExam": 27,
            "total": 91,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ12101": {
            "coursework": 64,
            "finalExam": 27,
            "total": 91,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง12101": {
            "coursework": 64,
            "finalExam": 27,
            "total": 91,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ12101": {
            "coursework": 62,
            "finalExam": 22,
            "total": 84,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 4,
        "code": "3074",
        "name": "เด็กชายอนุพงษ์ สุขศิริ",
        "gender": "male",
        "scores": {
          "ท12101": {
            "coursework": 56,
            "finalExam": 18,
            "total": 74,
            "grade": "3",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค12101": {
            "coursework": 60,
            "finalExam": 24,
            "total": 84,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว12101": {
            "coursework": 60,
            "finalExam": 26,
            "total": 86,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส12101": {
            "coursework": 59,
            "finalExam": 23,
            "total": 82,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส12102": {
            "coursework": 60,
            "finalExam": 24,
            "total": 84,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ12101": {
            "coursework": 57,
            "finalExam": 19,
            "total": 76,
            "grade": "3.5",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ12101": {
            "coursework": 57,
            "finalExam": 21,
            "total": 78,
            "grade": "3.5",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง12101": {
            "coursework": 56,
            "finalExam": 19,
            "total": 75,
            "grade": "3.5",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ12101": {
            "coursework": 57,
            "finalExam": 20,
            "total": 77,
            "grade": "3.5",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 5,
        "code": "3075",
        "name": "เด็กชายชนาธิป แสงทองศรี",
        "gender": "male",
        "scores": {
          "ท12101": {
            "coursework": 55,
            "finalExam": 23,
            "total": 78,
            "grade": "3.5",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค12101": {
            "coursework": 54,
            "finalExam": 21,
            "total": 75,
            "grade": "3.5",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว12101": {
            "coursework": 54,
            "finalExam": 23,
            "total": 77,
            "grade": "3.5",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส12101": {
            "coursework": 52,
            "finalExam": 19,
            "total": 71,
            "grade": "3",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "ส12102": {
            "coursework": 50,
            "finalExam": 16,
            "total": 66,
            "grade": "2.5",
            "attendedHours": 20,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "พ12101": {
            "coursework": 51,
            "finalExam": 17,
            "total": 68,
            "grade": "2.5",
            "attendedHours": 20,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ศ12101": {
            "coursework": 51,
            "finalExam": 16,
            "total": 67,
            "grade": "2.5",
            "attendedHours": 20,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ง12101": {
            "coursework": 51,
            "finalExam": 18,
            "total": 69,
            "grade": "2.5",
            "attendedHours": 20,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "อ12101": {
            "coursework": 49,
            "finalExam": 14,
            "total": 63,
            "grade": "2",
            "attendedHours": 80,
            "traitScore": 2,
            "readThinkScore": 2
          }
        },
        "traitResult": "ดี",
        "readThinkResult": "ดี",
        "activityResult": "ผ่าน"
      },
      {
        "no": 6,
        "code": "3076",
        "name": "เด็กชายรชต ลึบอ",
        "gender": "male",
        "scores": {
          "ท12101": {
            "coursework": 63,
            "finalExam": 22,
            "total": 85,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค12101": {
            "coursework": 66,
            "finalExam": 25,
            "total": 91,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว12101": {
            "coursework": 65,
            "finalExam": 25,
            "total": 90,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส12101": {
            "coursework": 65,
            "finalExam": 23,
            "total": 88,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส12102": {
            "coursework": 63,
            "finalExam": 20,
            "total": 83,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ12101": {
            "coursework": 64,
            "finalExam": 21,
            "total": 85,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ12101": {
            "coursework": 62,
            "finalExam": 20,
            "total": 82,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง12101": {
            "coursework": 66,
            "finalExam": 26,
            "total": 92,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ12101": {
            "coursework": 64,
            "finalExam": 22,
            "total": 86,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 7,
        "code": "3077",
        "name": "เด็กชายชนาธิป ผาดศรี",
        "gender": "male",
        "scores": {
          "ท12101": {
            "coursework": 62,
            "finalExam": 27,
            "total": 89,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค12101": {
            "coursework": 59,
            "finalExam": 22,
            "total": 81,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว12101": {
            "coursework": 59,
            "finalExam": 20,
            "total": 79,
            "grade": "3.5",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส12101": {
            "coursework": 61,
            "finalExam": 24,
            "total": 85,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส12102": {
            "coursework": 62,
            "finalExam": 25,
            "total": 87,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ12101": {
            "coursework": 57,
            "finalExam": 18,
            "total": 75,
            "grade": "3.5",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ12101": {
            "coursework": 57,
            "finalExam": 19,
            "total": 76,
            "grade": "3.5",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง12101": {
            "coursework": 62,
            "finalExam": 27,
            "total": 89,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ12101": {
            "coursework": 59,
            "finalExam": 21,
            "total": 80,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 8,
        "code": "2988",
        "name": "เด็กหญิงมานิตา แซ่เตี๋ย",
        "gender": "female",
        "scores": {
          "ท12101": {
            "coursework": 61,
            "finalExam": 26,
            "total": 87,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค12101": {
            "coursework": 60,
            "finalExam": 24,
            "total": 84,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว12101": {
            "coursework": 58,
            "finalExam": 21,
            "total": 79,
            "grade": "3.5",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส12101": {
            "coursework": 57,
            "finalExam": 20,
            "total": 77,
            "grade": "3.5",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส12102": {
            "coursework": 57,
            "finalExam": 18,
            "total": 75,
            "grade": "3.5",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ12101": {
            "coursework": 57,
            "finalExam": 19,
            "total": 76,
            "grade": "3.5",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ12101": {
            "coursework": 56,
            "finalExam": 18,
            "total": 74,
            "grade": "3",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง12101": {
            "coursework": 60,
            "finalExam": 24,
            "total": 84,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ12101": {
            "coursework": 61,
            "finalExam": 26,
            "total": 87,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 9,
        "code": "2990",
        "name": "เด็กหญิงปภาดา กาเหวา",
        "gender": "female",
        "scores": {
          "ท12101": {
            "coursework": 63,
            "finalExam": 20,
            "total": 83,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค12101": {
            "coursework": 65,
            "finalExam": 21,
            "total": 86,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว12101": {
            "coursework": 66,
            "finalExam": 25,
            "total": 91,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส12101": {
            "coursework": 68,
            "finalExam": 28,
            "total": 96,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส12102": {
            "coursework": 63,
            "finalExam": 20,
            "total": 83,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ12101": {
            "coursework": 67,
            "finalExam": 27,
            "total": 94,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ12101": {
            "coursework": 64,
            "finalExam": 19,
            "total": 83,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง12101": {
            "coursework": 64,
            "finalExam": 21,
            "total": 85,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ12101": {
            "coursework": 63,
            "finalExam": 20,
            "total": 83,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      }
    ]
  },
  {
    "classId": "p3",
    "shortName": "ป.3",
    "className": "ประถมศึกษาปีที่ 3",
    "level": "ประถม",
    "room": 1,
    "semester": "1",
    "year": "2569",
    "schoolName": "โรงเรียนบ้านคลองมดแดง",
    "affiliation": "สำนักงานเขตพื้นที่การศึกษาประถมศึกษากำแพงเพชร เขต 2",
    "director": "นายปรัชญา ปรางค์ชัยภูมิ",
    "homeroomTeachers": [
      "นางสาวไอยรดา อาจจีน"
    ],
    "subjects": [
      {
        "code": "ท13101",
        "name": "ภาษาไทย 3",
        "type": "พื้นฐาน",
        "group": "ภาษาไทย (พื้นฐาน)",
        "credits": 4.0,
        "hours": 80,
        "teacher": "นางสาวนริศรา ทำจิตรเหมาะ"
      },
      {
        "code": "ค13101",
        "name": "คณิตศาสตร์ 3",
        "type": "พื้นฐาน",
        "group": "คณิตศาสตร์ (พื้นฐาน)",
        "credits": 4.0,
        "hours": 80,
        "teacher": "นางสาวธิดารัตน์ แรตสอน"
      },
      {
        "code": "ว13101",
        "name": "วิทยาศาสตร์และเทคโนโลยี 3",
        "type": "พื้นฐาน",
        "group": "วิทยาศาสตร์ฯ (พื้นฐาน)",
        "credits": 2.0,
        "hours": 40,
        "teacher": "นางสาวธิดารัตน์ แรตสอน"
      },
      {
        "code": "ส13101",
        "name": "สังคมศึกษา ศาสนาและวัฒนธรรม 3",
        "type": "พื้นฐาน",
        "group": "สังคมศึกษาฯ (พื้นฐาน)",
        "credits": 1.0,
        "hours": 20,
        "teacher": "นางสาวภัทรสุดา สุหงษา"
      },
      {
        "code": "ส13102",
        "name": "ประวัติศาสตร์ 3",
        "type": "พื้นฐาน",
        "group": "สังคมศึกษาฯ (พื้นฐาน)",
        "credits": 1.0,
        "hours": 20,
        "teacher": "นางสาวภัทรสุดา สุหงษา"
      },
      {
        "code": "พ13101",
        "name": "สุขศึกษาและพลศึกษา 3",
        "type": "พื้นฐาน",
        "group": "สุขศึกษาฯ (พื้นฐาน)",
        "credits": 1.0,
        "hours": 20,
        "teacher": "นายนวพานิชณ์ วังคีรี"
      },
      {
        "code": "ศ13101",
        "name": "ศิลปะ 3",
        "type": "พื้นฐาน",
        "group": "ศิลปะ (พื้นฐาน)",
        "credits": 1.0,
        "hours": 20,
        "teacher": "นายพีระ เดชะผล"
      },
      {
        "code": "ง13101",
        "name": "การงานอาชีพ 3",
        "type": "พื้นฐาน",
        "group": "การงานอาชีพฯ (พื้นฐาน)",
        "credits": 1.0,
        "hours": 20,
        "teacher": "นายอนันตชัย เพ็ชรรี่"
      },
      {
        "code": "อ13101",
        "name": "ภาษาอังกฤษ 3",
        "type": "พื้นฐาน",
        "group": "ภาษาต่างประเทศ (พื้นฐาน)",
        "credits": 4.0,
        "hours": 80,
        "teacher": "นางสาวธญาภรณ์ คล้ายเพ็ง"
      }
    ],
    "activities": [
      {
        "code": "ก11101",
        "name": "กิจกรรมแนะแนว",
        "hours": 20
      },
      {
        "code": "ก11102",
        "name": "กิจกรรมลูกเสือ / เนตรนารี",
        "hours": 20
      },
      {
        "code": "ก11103",
        "name": "กิจกรรมชุมนุม / ตลาดนัดอาชีพ",
        "hours": 20
      },
      {
        "code": "ก11104",
        "name": "กิจกรรมเพื่อสังคมและสาธารณประโยชน์",
        "hours": 10
      }
    ],
    "students": [
      {
        "no": 1,
        "code": "2920",
        "name": "เด็กชายพชร พลสามารถ",
        "gender": "male",
        "scores": {
          "ท13101": {
            "coursework": 57,
            "finalExam": 21,
            "total": 78,
            "grade": "3.5",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค13101": {
            "coursework": 52,
            "finalExam": 16,
            "total": 68,
            "grade": "2.5",
            "attendedHours": 80,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ว13101": {
            "coursework": 53,
            "finalExam": 17,
            "total": 70,
            "grade": "3",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "ส13101": {
            "coursework": 57,
            "finalExam": 22,
            "total": 79,
            "grade": "3.5",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส13102": {
            "coursework": 58,
            "finalExam": 23,
            "total": 81,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ13101": {
            "coursework": 54,
            "finalExam": 17,
            "total": 71,
            "grade": "3",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "ศ13101": {
            "coursework": 52,
            "finalExam": 16,
            "total": 68,
            "grade": "2.5",
            "attendedHours": 20,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ง13101": {
            "coursework": 57,
            "finalExam": 23,
            "total": 80,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ13101": {
            "coursework": 58,
            "finalExam": 24,
            "total": 82,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 2,
        "code": "2924",
        "name": "เด็กชายรัชกฤช ทวิราช",
        "gender": "male",
        "scores": {
          "ท13101": {
            "coursework": 53,
            "finalExam": 20,
            "total": 73,
            "grade": "3",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค13101": {
            "coursework": 55,
            "finalExam": 23,
            "total": 78,
            "grade": "3.5",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว13101": {
            "coursework": 51,
            "finalExam": 16,
            "total": 67,
            "grade": "2.5",
            "attendedHours": 40,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ส13101": {
            "coursework": 51,
            "finalExam": 16,
            "total": 67,
            "grade": "2.5",
            "attendedHours": 20,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ส13102": {
            "coursework": 52,
            "finalExam": 19,
            "total": 71,
            "grade": "3",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "พ13101": {
            "coursework": 52,
            "finalExam": 18,
            "total": 70,
            "grade": "3",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "ศ13101": {
            "coursework": 54,
            "finalExam": 21,
            "total": 75,
            "grade": "3.5",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง13101": {
            "coursework": 53,
            "finalExam": 20,
            "total": 73,
            "grade": "3",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ13101": {
            "coursework": 52,
            "finalExam": 19,
            "total": 71,
            "grade": "3",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 2
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดี",
        "activityResult": "ผ่าน"
      },
      {
        "no": 3,
        "code": "2934",
        "name": "เด็กชายอัครพนธ์ คำสีเขียว",
        "gender": "male",
        "scores": {
          "ท13101": {
            "coursework": 56,
            "finalExam": 23,
            "total": 79,
            "grade": "3.5",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค13101": {
            "coursework": 55,
            "finalExam": 21,
            "total": 76,
            "grade": "3.5",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว13101": {
            "coursework": 53,
            "finalExam": 17,
            "total": 70,
            "grade": "3",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "ส13101": {
            "coursework": 55,
            "finalExam": 20,
            "total": 75,
            "grade": "3.5",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส13102": {
            "coursework": 51,
            "finalExam": 15,
            "total": 66,
            "grade": "2.5",
            "attendedHours": 20,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "พ13101": {
            "coursework": 55,
            "finalExam": 22,
            "total": 77,
            "grade": "3.5",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ13101": {
            "coursework": 56,
            "finalExam": 22,
            "total": 78,
            "grade": "3.5",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง13101": {
            "coursework": 54,
            "finalExam": 18,
            "total": 72,
            "grade": "3",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ13101": {
            "coursework": 52,
            "finalExam": 17,
            "total": 69,
            "grade": "2.5",
            "attendedHours": 80,
            "traitScore": 2,
            "readThinkScore": 2
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 4,
        "code": "2991",
        "name": "เด็กชายนฤวัต ใจเมือง",
        "gender": "male",
        "scores": {
          "ท13101": {
            "coursework": 63,
            "finalExam": 25,
            "total": 88,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค13101": {
            "coursework": 64,
            "finalExam": 26,
            "total": 90,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว13101": {
            "coursework": 64,
            "finalExam": 27,
            "total": 91,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส13101": {
            "coursework": 60,
            "finalExam": 20,
            "total": 80,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส13102": {
            "coursework": 58,
            "finalExam": 18,
            "total": 76,
            "grade": "3.5",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ13101": {
            "coursework": 58,
            "finalExam": 17,
            "total": 75,
            "grade": "3.5",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ13101": {
            "coursework": 59,
            "finalExam": 19,
            "total": 78,
            "grade": "3.5",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง13101": {
            "coursework": 62,
            "finalExam": 23,
            "total": 85,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ13101": {
            "coursework": 62,
            "finalExam": 24,
            "total": 86,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 5,
        "code": "2992",
        "name": "เด็กชายอรรถวัฒน์ ศรีสุข",
        "gender": "male",
        "scores": {
          "ท13101": {
            "coursework": 55,
            "finalExam": 20,
            "total": 75,
            "grade": "3.5",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค13101": {
            "coursework": 56,
            "finalExam": 19,
            "total": 75,
            "grade": "3.5",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว13101": {
            "coursework": 57,
            "finalExam": 23,
            "total": 80,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส13101": {
            "coursework": 53,
            "finalExam": 17,
            "total": 70,
            "grade": "3",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "ส13102": {
            "coursework": 55,
            "finalExam": 19,
            "total": 74,
            "grade": "3",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ13101": {
            "coursework": 55,
            "finalExam": 19,
            "total": 74,
            "grade": "3",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ13101": {
            "coursework": 54,
            "finalExam": 17,
            "total": 71,
            "grade": "3",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "ง13101": {
            "coursework": 57,
            "finalExam": 22,
            "total": 79,
            "grade": "3.5",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ13101": {
            "coursework": 52,
            "finalExam": 16,
            "total": 68,
            "grade": "2.5",
            "attendedHours": 80,
            "traitScore": 2,
            "readThinkScore": 2
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 6,
        "code": "2922",
        "name": "เด็กหญิงนภัสสร การบรรจง",
        "gender": "female",
        "scores": {
          "ท13101": {
            "coursework": 61,
            "finalExam": 19,
            "total": 80,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค13101": {
            "coursework": 66,
            "finalExam": 27,
            "total": 93,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว13101": {
            "coursework": 60,
            "finalExam": 18,
            "total": 78,
            "grade": "3.5",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส13101": {
            "coursework": 63,
            "finalExam": 23,
            "total": 86,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส13102": {
            "coursework": 62,
            "finalExam": 22,
            "total": 84,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ13101": {
            "coursework": 64,
            "finalExam": 24,
            "total": 88,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ13101": {
            "coursework": 62,
            "finalExam": 20,
            "total": 82,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง13101": {
            "coursework": 61,
            "finalExam": 18,
            "total": 79,
            "grade": "3.5",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ13101": {
            "coursework": 61,
            "finalExam": 20,
            "total": 81,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 7,
        "code": "2923",
        "name": "เด็กหญิงวิรดา ทองมา",
        "gender": "female",
        "scores": {
          "ท13101": {
            "coursework": 60,
            "finalExam": 25,
            "total": 85,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค13101": {
            "coursework": 56,
            "finalExam": 18,
            "total": 74,
            "grade": "3",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว13101": {
            "coursework": 57,
            "finalExam": 19,
            "total": 76,
            "grade": "3.5",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส13101": {
            "coursework": 57,
            "finalExam": 19,
            "total": 76,
            "grade": "3.5",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส13102": {
            "coursework": 56,
            "finalExam": 19,
            "total": 75,
            "grade": "3.5",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ13101": {
            "coursework": 59,
            "finalExam": 22,
            "total": 81,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ13101": {
            "coursework": 59,
            "finalExam": 24,
            "total": 83,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง13101": {
            "coursework": 61,
            "finalExam": 25,
            "total": 86,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ13101": {
            "coursework": 55,
            "finalExam": 18,
            "total": 73,
            "grade": "3",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 8,
        "code": "2932",
        "name": "เด็กหญิงจิราพัชร หนูอิ่ม",
        "gender": "female",
        "scores": {
          "ท13101": {
            "coursework": 66,
            "finalExam": 24,
            "total": 90,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค13101": {
            "coursework": 64,
            "finalExam": 23,
            "total": 87,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว13101": {
            "coursework": 66,
            "finalExam": 25,
            "total": 91,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส13101": {
            "coursework": 64,
            "finalExam": 22,
            "total": 86,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส13102": {
            "coursework": 66,
            "finalExam": 24,
            "total": 90,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ13101": {
            "coursework": 62,
            "finalExam": 19,
            "total": 81,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ13101": {
            "coursework": 63,
            "finalExam": 21,
            "total": 84,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง13101": {
            "coursework": 64,
            "finalExam": 21,
            "total": 85,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ13101": {
            "coursework": 62,
            "finalExam": 19,
            "total": 81,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 9,
        "code": "2993",
        "name": "เด็กหญิงสาริศา ศรีสุข",
        "gender": "female",
        "scores": {
          "ท13101": {
            "coursework": 52,
            "finalExam": 19,
            "total": 71,
            "grade": "3",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "ค13101": {
            "coursework": 47,
            "finalExam": 15,
            "total": 62,
            "grade": "2",
            "attendedHours": 80,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ว13101": {
            "coursework": 49,
            "finalExam": 15,
            "total": 64,
            "grade": "2",
            "attendedHours": 40,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ส13101": {
            "coursework": 54,
            "finalExam": 23,
            "total": 77,
            "grade": "3.5",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส13102": {
            "coursework": 49,
            "finalExam": 15,
            "total": 64,
            "grade": "2",
            "attendedHours": 20,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "พ13101": {
            "coursework": 52,
            "finalExam": 21,
            "total": 73,
            "grade": "3",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ13101": {
            "coursework": 51,
            "finalExam": 20,
            "total": 71,
            "grade": "3",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "ง13101": {
            "coursework": 52,
            "finalExam": 19,
            "total": 71,
            "grade": "3",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "อ13101": {
            "coursework": 52,
            "finalExam": 20,
            "total": 72,
            "grade": "3",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดี",
        "readThinkResult": "ดี",
        "activityResult": "ผ่าน"
      },
      {
        "no": 10,
        "code": "2994",
        "name": "เด็กหญิงญาดา สายทอง",
        "gender": "female",
        "scores": {
          "ท13101": {
            "coursework": 64,
            "finalExam": 26,
            "total": 90,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค13101": {
            "coursework": 63,
            "finalExam": 22,
            "total": 85,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว13101": {
            "coursework": 66,
            "finalExam": 28,
            "total": 94,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส13101": {
            "coursework": 65,
            "finalExam": 26,
            "total": 91,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส13102": {
            "coursework": 65,
            "finalExam": 26,
            "total": 91,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ13101": {
            "coursework": 64,
            "finalExam": 25,
            "total": 89,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ13101": {
            "coursework": 63,
            "finalExam": 23,
            "total": 86,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง13101": {
            "coursework": 61,
            "finalExam": 20,
            "total": 81,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ13101": {
            "coursework": 64,
            "finalExam": 25,
            "total": 89,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 11,
        "code": "3067",
        "name": "เด็กหญิงกมลชนก ทิพย์อักษร",
        "gender": "female",
        "scores": {
          "ท13101": {
            "coursework": 56,
            "finalExam": 19,
            "total": 75,
            "grade": "3.5",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค13101": {
            "coursework": 59,
            "finalExam": 24,
            "total": 83,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว13101": {
            "coursework": 58,
            "finalExam": 22,
            "total": 80,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส13101": {
            "coursework": 59,
            "finalExam": 22,
            "total": 81,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส13102": {
            "coursework": 57,
            "finalExam": 19,
            "total": 76,
            "grade": "3.5",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ13101": {
            "coursework": 60,
            "finalExam": 25,
            "total": 85,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ13101": {
            "coursework": 56,
            "finalExam": 18,
            "total": 74,
            "grade": "3",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง13101": {
            "coursework": 55,
            "finalExam": 17,
            "total": 72,
            "grade": "3",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ13101": {
            "coursework": 56,
            "finalExam": 19,
            "total": 75,
            "grade": "3.5",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 12,
        "code": "2921",
        "name": "เด็กหญิงพสิกา เฟื่องจันทร์",
        "gender": "female",
        "scores": {
          "ท13101": {
            "coursework": 52,
            "finalExam": 21,
            "total": 73,
            "grade": "3",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค13101": {
            "coursework": 53,
            "finalExam": 23,
            "total": 76,
            "grade": "3.5",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว13101": {
            "coursework": 48,
            "finalExam": 16,
            "total": 64,
            "grade": "2",
            "attendedHours": 40,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ส13101": {
            "coursework": 51,
            "finalExam": 18,
            "total": 69,
            "grade": "2.5",
            "attendedHours": 20,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ส13102": {
            "coursework": 53,
            "finalExam": 22,
            "total": 75,
            "grade": "3.5",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ13101": {
            "coursework": 51,
            "finalExam": 19,
            "total": 70,
            "grade": "3",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "ศ13101": {
            "coursework": 52,
            "finalExam": 21,
            "total": 73,
            "grade": "3",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง13101": {
            "coursework": 52,
            "finalExam": 21,
            "total": 73,
            "grade": "3",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ13101": {
            "coursework": 50,
            "finalExam": 18,
            "total": 68,
            "grade": "2.5",
            "attendedHours": 80,
            "traitScore": 2,
            "readThinkScore": 2
          }
        },
        "traitResult": "ดี",
        "readThinkResult": "ดี",
        "activityResult": "ผ่าน"
      }
    ]
  },
  {
    "classId": "p4",
    "shortName": "ป.4",
    "className": "ประถมศึกษาปีที่ 4",
    "level": "ประถม",
    "room": 1,
    "semester": "1",
    "year": "2569",
    "schoolName": "โรงเรียนบ้านคลองมดแดง",
    "affiliation": "สำนักงานเขตพื้นที่การศึกษาประถมศึกษากำแพงเพชร เขต 2",
    "director": "นายปรัชญา ปรางค์ชัยภูมิ",
    "homeroomTeachers": [
      "นายพีระ เดชะผล"
    ],
    "subjects": [
      {
        "code": "ท14101",
        "name": "ภาษาไทย 4",
        "type": "พื้นฐาน",
        "group": "ภาษาไทย (พื้นฐาน)",
        "credits": 4.0,
        "hours": 80,
        "teacher": "นางสาวนริศรา ทำจิตรเหมาะ"
      },
      {
        "code": "ค14101",
        "name": "คณิตศาสตร์ 4",
        "type": "พื้นฐาน",
        "group": "คณิตศาสตร์ (พื้นฐาน)",
        "credits": 4.0,
        "hours": 80,
        "teacher": "นายนวพานิชณ์ วังคีรี"
      },
      {
        "code": "ว14101",
        "name": "วิทยาศาสตร์และเทคโนโลยี 4",
        "type": "พื้นฐาน",
        "group": "วิทยาศาสตร์ฯ (พื้นฐาน)",
        "credits": 2.0,
        "hours": 40,
        "teacher": "นางสาวนริศรา ทำจิตรเหมาะ"
      },
      {
        "code": "ส14101",
        "name": "สังคมศึกษา ศาสนาและวัฒนธรรม 4",
        "type": "พื้นฐาน",
        "group": "สังคมศึกษาฯ (พื้นฐาน)",
        "credits": 1.5,
        "hours": 30,
        "teacher": "นางสาวภัทรสุดา สุหงษา"
      },
      {
        "code": "ส14102",
        "name": "ประวัติศาสตร์ 4",
        "type": "พื้นฐาน",
        "group": "สังคมศึกษาฯ (พื้นฐาน)",
        "credits": 1.5,
        "hours": 30,
        "teacher": "นางสาวไอยรดา อาจจีน"
      },
      {
        "code": "พ14101",
        "name": "สุขศึกษาและพลศึกษา 4",
        "type": "พื้นฐาน",
        "group": "สุขศึกษาฯ (พื้นฐาน)",
        "credits": 1.5,
        "hours": 30,
        "teacher": "นางสาวอาริษา ฉิมสุพร"
      },
      {
        "code": "ศ14101",
        "name": "ศิลปะ 4",
        "type": "พื้นฐาน",
        "group": "ศิลปะ (พื้นฐาน)",
        "credits": 1.5,
        "hours": 30,
        "teacher": "นายพีระ เดชะผล"
      },
      {
        "code": "ง14101",
        "name": "การงานอาชีพ 4",
        "type": "พื้นฐาน",
        "group": "การงานอาชีพฯ (พื้นฐาน)",
        "credits": 1.0,
        "hours": 20,
        "teacher": "นายอนันตชัย เพ็ชรรี่"
      },
      {
        "code": "อ14101",
        "name": "ภาษาอังกฤษ 4",
        "type": "พื้นฐาน",
        "group": "ภาษาต่างประเทศ (พื้นฐาน)",
        "credits": 4.0,
        "hours": 80,
        "teacher": "นางสาวจิราภา พานชัย"
      }
    ],
    "activities": [
      {
        "code": "ก11101",
        "name": "กิจกรรมแนะแนว",
        "hours": 20
      },
      {
        "code": "ก11102",
        "name": "กิจกรรมลูกเสือ / เนตรนารี",
        "hours": 20
      },
      {
        "code": "ก11103",
        "name": "กิจกรรมชุมนุม / ตลาดนัดอาชีพ",
        "hours": 20
      },
      {
        "code": "ก11104",
        "name": "กิจกรรมเพื่อสังคมและสาธารณประโยชน์",
        "hours": 10
      }
    ],
    "students": [
      {
        "no": 1,
        "code": "2840",
        "name": "เด็กชายชรัณ พรมจันทร์",
        "gender": "male",
        "scores": {
          "ท14101": {
            "coursework": 63,
            "finalExam": 24,
            "total": 87,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค14101": {
            "coursework": 59,
            "finalExam": 19,
            "total": 78,
            "grade": "3.5",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว14101": {
            "coursework": 63,
            "finalExam": 25,
            "total": 88,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส14101": {
            "coursework": 59,
            "finalExam": 18,
            "total": 77,
            "grade": "3.5",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส14102": {
            "coursework": 62,
            "finalExam": 22,
            "total": 84,
            "grade": "4",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ14101": {
            "coursework": 63,
            "finalExam": 25,
            "total": 88,
            "grade": "4",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ14101": {
            "coursework": 59,
            "finalExam": 19,
            "total": 78,
            "grade": "3.5",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง14101": {
            "coursework": 61,
            "finalExam": 21,
            "total": 82,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ14101": {
            "coursework": 62,
            "finalExam": 24,
            "total": 86,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 2,
        "code": "2908",
        "name": "เด็กชายนนทพัทธ์ ชาติมนตรี",
        "gender": "male",
        "scores": {
          "ท14101": {
            "coursework": 66,
            "finalExam": 25,
            "total": 91,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค14101": {
            "coursework": 62,
            "finalExam": 20,
            "total": 82,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว14101": {
            "coursework": 65,
            "finalExam": 23,
            "total": 88,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส14101": {
            "coursework": 63,
            "finalExam": 22,
            "total": 85,
            "grade": "4",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส14102": {
            "coursework": 64,
            "finalExam": 21,
            "total": 85,
            "grade": "4",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ14101": {
            "coursework": 65,
            "finalExam": 24,
            "total": 89,
            "grade": "4",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ14101": {
            "coursework": 65,
            "finalExam": 23,
            "total": 88,
            "grade": "4",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง14101": {
            "coursework": 63,
            "finalExam": 19,
            "total": 82,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ14101": {
            "coursework": 63,
            "finalExam": 21,
            "total": 84,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 3,
        "code": "2925",
        "name": "เด็กชายกิตติภพ แก้วมณี",
        "gender": "male",
        "scores": {
          "ท14101": {
            "coursework": 64,
            "finalExam": 21,
            "total": 85,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค14101": {
            "coursework": 66,
            "finalExam": 25,
            "total": 91,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว14101": {
            "coursework": 64,
            "finalExam": 20,
            "total": 84,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส14101": {
            "coursework": 65,
            "finalExam": 21,
            "total": 86,
            "grade": "4",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส14102": {
            "coursework": 63,
            "finalExam": 19,
            "total": 82,
            "grade": "4",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ14101": {
            "coursework": 67,
            "finalExam": 26,
            "total": 93,
            "grade": "4",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ14101": {
            "coursework": 65,
            "finalExam": 24,
            "total": 89,
            "grade": "4",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง14101": {
            "coursework": 68,
            "finalExam": 28,
            "total": 96,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ14101": {
            "coursework": 63,
            "finalExam": 19,
            "total": 82,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 4,
        "code": "2926",
        "name": "เด็กชายอเนกคุณ หนูอิ่ม",
        "gender": "male",
        "scores": {
          "ท14101": {
            "coursework": 59,
            "finalExam": 20,
            "total": 79,
            "grade": "3.5",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค14101": {
            "coursework": 61,
            "finalExam": 24,
            "total": 85,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว14101": {
            "coursework": 62,
            "finalExam": 26,
            "total": 88,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส14101": {
            "coursework": 59,
            "finalExam": 20,
            "total": 79,
            "grade": "3.5",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส14102": {
            "coursework": 63,
            "finalExam": 26,
            "total": 89,
            "grade": "4",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ14101": {
            "coursework": 58,
            "finalExam": 18,
            "total": 76,
            "grade": "3.5",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ14101": {
            "coursework": 63,
            "finalExam": 26,
            "total": 89,
            "grade": "4",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง14101": {
            "coursework": 60,
            "finalExam": 20,
            "total": 80,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ14101": {
            "coursework": 62,
            "finalExam": 25,
            "total": 87,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 5,
        "code": "2927",
        "name": "เด็กชายณัฐวัฒน์ หมู่ทอง",
        "gender": "male",
        "scores": {
          "ท14101": {
            "coursework": 57,
            "finalExam": 23,
            "total": 80,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค14101": {
            "coursework": 57,
            "finalExam": 22,
            "total": 79,
            "grade": "3.5",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว14101": {
            "coursework": 57,
            "finalExam": 24,
            "total": 81,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส14101": {
            "coursework": 55,
            "finalExam": 20,
            "total": 75,
            "grade": "3.5",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส14102": {
            "coursework": 57,
            "finalExam": 24,
            "total": 81,
            "grade": "4",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ14101": {
            "coursework": 53,
            "finalExam": 18,
            "total": 71,
            "grade": "3",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "ศ14101": {
            "coursework": 56,
            "finalExam": 22,
            "total": 78,
            "grade": "3.5",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง14101": {
            "coursework": 54,
            "finalExam": 19,
            "total": 73,
            "grade": "3",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ14101": {
            "coursework": 54,
            "finalExam": 18,
            "total": 72,
            "grade": "3",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 6,
        "code": "2834",
        "name": "เด็กหญิงญาดา เหวิจิตร",
        "gender": "female",
        "scores": {
          "ท14101": {
            "coursework": 59,
            "finalExam": 25,
            "total": 84,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค14101": {
            "coursework": 56,
            "finalExam": 19,
            "total": 75,
            "grade": "3.5",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว14101": {
            "coursework": 60,
            "finalExam": 25,
            "total": 85,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส14101": {
            "coursework": 58,
            "finalExam": 21,
            "total": 79,
            "grade": "3.5",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส14102": {
            "coursework": 58,
            "finalExam": 22,
            "total": 80,
            "grade": "4",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ14101": {
            "coursework": 58,
            "finalExam": 23,
            "total": 81,
            "grade": "4",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ14101": {
            "coursework": 56,
            "finalExam": 19,
            "total": 75,
            "grade": "3.5",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง14101": {
            "coursework": 57,
            "finalExam": 21,
            "total": 78,
            "grade": "3.5",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ14101": {
            "coursework": 60,
            "finalExam": 24,
            "total": 84,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 7,
        "code": "2839",
        "name": "เด็กหญิงนิรัชพร คำสีเขียว",
        "gender": "female",
        "scores": {
          "ท14101": {
            "coursework": 66,
            "finalExam": 22,
            "total": 88,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค14101": {
            "coursework": 67,
            "finalExam": 25,
            "total": 92,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว14101": {
            "coursework": 67,
            "finalExam": 23,
            "total": 90,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส14101": {
            "coursework": 68,
            "finalExam": 25,
            "total": 93,
            "grade": "4",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส14102": {
            "coursework": 66,
            "finalExam": 22,
            "total": 88,
            "grade": "4",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ14101": {
            "coursework": 64,
            "finalExam": 20,
            "total": 84,
            "grade": "4",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ14101": {
            "coursework": 66,
            "finalExam": 22,
            "total": 88,
            "grade": "4",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง14101": {
            "coursework": 69,
            "finalExam": 27,
            "total": 96,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ14101": {
            "coursework": 67,
            "finalExam": 25,
            "total": 92,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 8,
        "code": "2995",
        "name": "เด็กหญิงยูบิน รัต",
        "gender": "female",
        "scores": {
          "ท14101": {
            "coursework": 58,
            "finalExam": 22,
            "total": 80,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค14101": {
            "coursework": 58,
            "finalExam": 20,
            "total": 78,
            "grade": "3.5",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว14101": {
            "coursework": 56,
            "finalExam": 18,
            "total": 74,
            "grade": "3",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส14101": {
            "coursework": 60,
            "finalExam": 23,
            "total": 83,
            "grade": "4",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส14102": {
            "coursework": 56,
            "finalExam": 19,
            "total": 75,
            "grade": "3.5",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ14101": {
            "coursework": 58,
            "finalExam": 22,
            "total": 80,
            "grade": "4",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ14101": {
            "coursework": 59,
            "finalExam": 21,
            "total": 80,
            "grade": "4",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง14101": {
            "coursework": 56,
            "finalExam": 19,
            "total": 75,
            "grade": "3.5",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ14101": {
            "coursework": 57,
            "finalExam": 20,
            "total": 77,
            "grade": "3.5",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      }
    ]
  },
  {
    "classId": "p5",
    "shortName": "ป.5",
    "className": "ประถมศึกษาปีที่ 5",
    "level": "ประถม",
    "room": 1,
    "semester": "1",
    "year": "2569",
    "schoolName": "โรงเรียนบ้านคลองมดแดง",
    "affiliation": "สำนักงานเขตพื้นที่การศึกษาประถมศึกษากำแพงเพชร เขต 2",
    "director": "นายปรัชญา ปรางค์ชัยภูมิ",
    "homeroomTeachers": [
      "นายนวพานิชณ์ วังคีรี"
    ],
    "subjects": [
      {
        "code": "ท15101",
        "name": "ภาษาไทย 5",
        "type": "พื้นฐาน",
        "group": "ภาษาไทย (พื้นฐาน)",
        "credits": 4.0,
        "hours": 80,
        "teacher": "นางสาวนริศรา ทำจิตรเหมาะ"
      },
      {
        "code": "ค15101",
        "name": "คณิตศาสตร์ 5",
        "type": "พื้นฐาน",
        "group": "คณิตศาสตร์ (พื้นฐาน)",
        "credits": 4.0,
        "hours": 80,
        "teacher": "นางสาวจิราภา พานชัย"
      },
      {
        "code": "ว15101",
        "name": "วิทยาศาสตร์และเทคโนโลยี 5",
        "type": "พื้นฐาน",
        "group": "วิทยาศาสตร์ฯ (พื้นฐาน)",
        "credits": 2.0,
        "hours": 40,
        "teacher": "นายอนันตชัย เพ็ชรรี่"
      },
      {
        "code": "ส15101",
        "name": "สังคมศึกษา ศาสนาและวัฒนธรรม 5",
        "type": "พื้นฐาน",
        "group": "สังคมศึกษาฯ (พื้นฐาน)",
        "credits": 1.5,
        "hours": 30,
        "teacher": "นางสาวไอยรดา อาจจีน"
      },
      {
        "code": "ส15102",
        "name": "ประวัติศาสตร์ 5",
        "type": "พื้นฐาน",
        "group": "สังคมศึกษาฯ (พื้นฐาน)",
        "credits": 1.5,
        "hours": 30,
        "teacher": "นางสาวไอยรดา อาจจีน"
      },
      {
        "code": "พ15101",
        "name": "สุขศึกษาและพลศึกษา 5",
        "type": "พื้นฐาน",
        "group": "สุขศึกษาฯ (พื้นฐาน)",
        "credits": 1.5,
        "hours": 30,
        "teacher": "นางสาวอาริษา ฉิมสุพร"
      },
      {
        "code": "ศ15101",
        "name": "ศิลปะ 5",
        "type": "พื้นฐาน",
        "group": "ศิลปะ (พื้นฐาน)",
        "credits": 1.5,
        "hours": 30,
        "teacher": "นายพีระ เดชะผล"
      },
      {
        "code": "ง15101",
        "name": "การงานอาชีพ 5",
        "type": "พื้นฐาน",
        "group": "การงานอาชีพฯ (พื้นฐาน)",
        "credits": 1.0,
        "hours": 20,
        "teacher": "นายอนันตชัย เพ็ชรรี่"
      },
      {
        "code": "อ15101",
        "name": "ภาษาอังกฤษ 5",
        "type": "พื้นฐาน",
        "group": "ภาษาต่างประเทศ (พื้นฐาน)",
        "credits": 4.0,
        "hours": 80,
        "teacher": "นางสาวธญาภรณ์ คล้ายเพ็ง"
      }
    ],
    "activities": [
      {
        "code": "ก11101",
        "name": "กิจกรรมแนะแนว",
        "hours": 20
      },
      {
        "code": "ก11102",
        "name": "กิจกรรมลูกเสือ / เนตรนารี",
        "hours": 20
      },
      {
        "code": "ก11103",
        "name": "กิจกรรมชุมนุม / ตลาดนัดอาชีพ",
        "hours": 20
      },
      {
        "code": "ก11104",
        "name": "กิจกรรมเพื่อสังคมและสาธารณประโยชน์",
        "hours": 10
      }
    ],
    "students": [
      {
        "no": 1,
        "code": "2741",
        "name": "เด็กชายณัฐวุฒิ ทูลนอก",
        "gender": "male",
        "scores": {
          "ท15101": {
            "coursework": 61,
            "finalExam": 23,
            "total": 84,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค15101": {
            "coursework": 58,
            "finalExam": 19,
            "total": 77,
            "grade": "3.5",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว15101": {
            "coursework": 58,
            "finalExam": 19,
            "total": 77,
            "grade": "3.5",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส15101": {
            "coursework": 61,
            "finalExam": 24,
            "total": 85,
            "grade": "4",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส15102": {
            "coursework": 56,
            "finalExam": 17,
            "total": 73,
            "grade": "3",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ15101": {
            "coursework": 57,
            "finalExam": 18,
            "total": 75,
            "grade": "3.5",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ15101": {
            "coursework": 58,
            "finalExam": 18,
            "total": 76,
            "grade": "3.5",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง15101": {
            "coursework": 60,
            "finalExam": 23,
            "total": 83,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ15101": {
            "coursework": 62,
            "finalExam": 25,
            "total": 87,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 2,
        "code": "2743",
        "name": "เด็กชายภัทรเดช สุขจิตร",
        "gender": "male",
        "scores": {
          "ท15101": {
            "coursework": 66,
            "finalExam": 21,
            "total": 87,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค15101": {
            "coursework": 64,
            "finalExam": 20,
            "total": 84,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว15101": {
            "coursework": 67,
            "finalExam": 25,
            "total": 92,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส15101": {
            "coursework": 68,
            "finalExam": 25,
            "total": 93,
            "grade": "4",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส15102": {
            "coursework": 66,
            "finalExam": 23,
            "total": 89,
            "grade": "4",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ15101": {
            "coursework": 67,
            "finalExam": 24,
            "total": 91,
            "grade": "4",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ15101": {
            "coursework": 66,
            "finalExam": 21,
            "total": 87,
            "grade": "4",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง15101": {
            "coursework": 65,
            "finalExam": 22,
            "total": 87,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ15101": {
            "coursework": 66,
            "finalExam": 22,
            "total": 88,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 3,
        "code": "2835",
        "name": "เด็กชายอนันต์วัฒน์ หมู่ทอง",
        "gender": "male",
        "scores": {
          "ท15101": {
            "coursework": 54,
            "finalExam": 22,
            "total": 76,
            "grade": "3.5",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค15101": {
            "coursework": 51,
            "finalExam": 18,
            "total": 69,
            "grade": "2.5",
            "attendedHours": 80,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ว15101": {
            "coursework": 52,
            "finalExam": 18,
            "total": 70,
            "grade": "3",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "ส15101": {
            "coursework": 49,
            "finalExam": 16,
            "total": 65,
            "grade": "2.5",
            "attendedHours": 30,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ส15102": {
            "coursework": 54,
            "finalExam": 21,
            "total": 75,
            "grade": "3.5",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ15101": {
            "coursework": 52,
            "finalExam": 18,
            "total": 70,
            "grade": "3",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "ศ15101": {
            "coursework": 48,
            "finalExam": 15,
            "total": 63,
            "grade": "2",
            "attendedHours": 30,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ง15101": {
            "coursework": 53,
            "finalExam": 19,
            "total": 72,
            "grade": "3",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ15101": {
            "coursework": 52,
            "finalExam": 18,
            "total": 70,
            "grade": "3",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 2
          }
        },
        "traitResult": "ดี",
        "readThinkResult": "ดี",
        "activityResult": "ผ่าน"
      },
      {
        "no": 4,
        "code": "2836",
        "name": "เด็กชายกิตติพงศ์ ปูตือ",
        "gender": "male",
        "scores": {
          "ท15101": {
            "coursework": 62,
            "finalExam": 19,
            "total": 81,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค15101": {
            "coursework": 62,
            "finalExam": 19,
            "total": 81,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว15101": {
            "coursework": 64,
            "finalExam": 21,
            "total": 85,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส15101": {
            "coursework": 66,
            "finalExam": 25,
            "total": 91,
            "grade": "4",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส15102": {
            "coursework": 66,
            "finalExam": 26,
            "total": 92,
            "grade": "4",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ15101": {
            "coursework": 64,
            "finalExam": 22,
            "total": 86,
            "grade": "4",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ15101": {
            "coursework": 64,
            "finalExam": 21,
            "total": 85,
            "grade": "4",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง15101": {
            "coursework": 65,
            "finalExam": 24,
            "total": 89,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ15101": {
            "coursework": 64,
            "finalExam": 23,
            "total": 87,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 5,
        "code": "2837",
        "name": "เด็กชายเอกชัย รัตนาวงศ์",
        "gender": "male",
        "scores": {
          "ท15101": {
            "coursework": 61,
            "finalExam": 23,
            "total": 84,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค15101": {
            "coursework": 60,
            "finalExam": 22,
            "total": 82,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว15101": {
            "coursework": 58,
            "finalExam": 19,
            "total": 77,
            "grade": "3.5",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส15101": {
            "coursework": 57,
            "finalExam": 18,
            "total": 75,
            "grade": "3.5",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส15102": {
            "coursework": 57,
            "finalExam": 17,
            "total": 74,
            "grade": "3",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ15101": {
            "coursework": 60,
            "finalExam": 21,
            "total": 81,
            "grade": "4",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ15101": {
            "coursework": 56,
            "finalExam": 17,
            "total": 73,
            "grade": "3",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง15101": {
            "coursework": 57,
            "finalExam": 18,
            "total": 75,
            "grade": "3.5",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ15101": {
            "coursework": 59,
            "finalExam": 21,
            "total": 80,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 6,
        "code": "2742",
        "name": "เด็กหญิงสุภัสสรา นุ่มเกิด",
        "gender": "female",
        "scores": {
          "ท15101": {
            "coursework": 54,
            "finalExam": 18,
            "total": 72,
            "grade": "3",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค15101": {
            "coursework": 53,
            "finalExam": 17,
            "total": 70,
            "grade": "3",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "ว15101": {
            "coursework": 54,
            "finalExam": 20,
            "total": 74,
            "grade": "3",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส15101": {
            "coursework": 55,
            "finalExam": 21,
            "total": 76,
            "grade": "3.5",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส15102": {
            "coursework": 51,
            "finalExam": 16,
            "total": 67,
            "grade": "2.5",
            "attendedHours": 30,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "พ15101": {
            "coursework": 54,
            "finalExam": 18,
            "total": 72,
            "grade": "3",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ15101": {
            "coursework": 53,
            "finalExam": 17,
            "total": 70,
            "grade": "3",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "ง15101": {
            "coursework": 56,
            "finalExam": 22,
            "total": 78,
            "grade": "3.5",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ15101": {
            "coursework": 54,
            "finalExam": 18,
            "total": 72,
            "grade": "3",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 7,
        "code": "2838",
        "name": "เด็กหญิงวินิดา แสงทองศรี",
        "gender": "female",
        "scores": {
          "ท15101": {
            "coursework": 51,
            "finalExam": 16,
            "total": 67,
            "grade": "2.5",
            "attendedHours": 80,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ค15101": {
            "coursework": 56,
            "finalExam": 22,
            "total": 78,
            "grade": "3.5",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว15101": {
            "coursework": 54,
            "finalExam": 19,
            "total": 73,
            "grade": "3",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส15101": {
            "coursework": 56,
            "finalExam": 21,
            "total": 77,
            "grade": "3.5",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส15102": {
            "coursework": 56,
            "finalExam": 23,
            "total": 79,
            "grade": "3.5",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ15101": {
            "coursework": 53,
            "finalExam": 18,
            "total": 71,
            "grade": "3",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "ศ15101": {
            "coursework": 54,
            "finalExam": 19,
            "total": 73,
            "grade": "3",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง15101": {
            "coursework": 56,
            "finalExam": 22,
            "total": 78,
            "grade": "3.5",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ15101": {
            "coursework": 54,
            "finalExam": 19,
            "total": 73,
            "grade": "3",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 8,
        "code": "2911",
        "name": "เด็กหญิงพิชญดา พลสามารถ",
        "gender": "female",
        "scores": {
          "ท15101": {
            "coursework": 67,
            "finalExam": 23,
            "total": 90,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค15101": {
            "coursework": 64,
            "finalExam": 20,
            "total": 84,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว15101": {
            "coursework": 64,
            "finalExam": 19,
            "total": 83,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส15101": {
            "coursework": 68,
            "finalExam": 25,
            "total": 93,
            "grade": "4",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส15102": {
            "coursework": 66,
            "finalExam": 23,
            "total": 89,
            "grade": "4",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ15101": {
            "coursework": 65,
            "finalExam": 20,
            "total": 85,
            "grade": "4",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ15101": {
            "coursework": 67,
            "finalExam": 29,
            "total": 96,
            "grade": "4",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง15101": {
            "coursework": 66,
            "finalExam": 23,
            "total": 89,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ15101": {
            "coursework": 64,
            "finalExam": 19,
            "total": 83,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      }
    ]
  },
  {
    "classId": "p6",
    "shortName": "ป.6",
    "className": "ประถมศึกษาปีที่ 6",
    "level": "ประถม",
    "room": 1,
    "semester": "1",
    "year": "2569",
    "schoolName": "โรงเรียนบ้านคลองมดแดง",
    "affiliation": "สำนักงานเขตพื้นที่การศึกษาประถมศึกษากำแพงเพชร เขต 2",
    "director": "นายปรัชญา ปรางค์ชัยภูมิ",
    "homeroomTeachers": [
      "นางสาวอาริษา ฉิมสุพร",
      "นายพิศุทธิ์ เชาวลิตโรจน์"
    ],
    "subjects": [
      {
        "code": "ท16101",
        "name": "ภาษาไทย 6",
        "type": "พื้นฐาน",
        "group": "ภาษาไทย (พื้นฐาน)",
        "credits": 4.0,
        "hours": 80,
        "teacher": "นางสาวนริศรา ทำจิตรเหมาะ"
      },
      {
        "code": "ค16101",
        "name": "คณิตศาสตร์ 6",
        "type": "พื้นฐาน",
        "group": "คณิตศาสตร์ (พื้นฐาน)",
        "credits": 4.0,
        "hours": 80,
        "teacher": "นางสาวจิราภา พานชัย"
      },
      {
        "code": "ว16101",
        "name": "วิทยาศาสตร์และเทคโนโลยี 6",
        "type": "พื้นฐาน",
        "group": "วิทยาศาสตร์ฯ (พื้นฐาน)",
        "credits": 2.0,
        "hours": 40,
        "teacher": "นายอนันตชัย เพ็ชรรี่"
      },
      {
        "code": "ส16101",
        "name": "สังคมศึกษา ศาสนาและวัฒนธรรม 6",
        "type": "พื้นฐาน",
        "group": "สังคมศึกษาฯ (พื้นฐาน)",
        "credits": 1.5,
        "hours": 30,
        "teacher": "นางสาวไอยรดา อาจจีน"
      },
      {
        "code": "ส16102",
        "name": "ประวัติศาสตร์ 6",
        "type": "พื้นฐาน",
        "group": "สังคมศึกษาฯ (พื้นฐาน)",
        "credits": 1.5,
        "hours": 30,
        "teacher": "นางสาวไอยรดา อาจจีน"
      },
      {
        "code": "พ16101",
        "name": "สุขศึกษาและพลศึกษา 6",
        "type": "พื้นฐาน",
        "group": "สุขศึกษาฯ (พื้นฐาน)",
        "credits": 1.5,
        "hours": 30,
        "teacher": "นางสาวอาริษา ฉิมสุพร"
      },
      {
        "code": "ศ16101",
        "name": "ศิลปะ 6",
        "type": "พื้นฐาน",
        "group": "ศิลปะ (พื้นฐาน)",
        "credits": 1.5,
        "hours": 30,
        "teacher": "นายพีระ เดชะผล"
      },
      {
        "code": "ง16101",
        "name": "การงานอาชีพ 6",
        "type": "พื้นฐาน",
        "group": "การงานอาชีพฯ (พื้นฐาน)",
        "credits": 1.0,
        "hours": 20,
        "teacher": "นายอนันตชัย เพ็ชรรี่"
      },
      {
        "code": "อ16101",
        "name": "ภาษาอังกฤษ 6",
        "type": "พื้นฐาน",
        "group": "ภาษาต่างประเทศ (พื้นฐาน)",
        "credits": 4.0,
        "hours": 80,
        "teacher": "นางสาวจิราภา พานชัย"
      }
    ],
    "activities": [
      {
        "code": "ก11101",
        "name": "กิจกรรมแนะแนว",
        "hours": 20
      },
      {
        "code": "ก11102",
        "name": "กิจกรรมลูกเสือ / เนตรนารี",
        "hours": 20
      },
      {
        "code": "ก11103",
        "name": "กิจกรรมชุมนุม / ตลาดนัดอาชีพ",
        "hours": 20
      },
      {
        "code": "ก11104",
        "name": "กิจกรรมเพื่อสังคมและสาธารณประโยชน์",
        "hours": 10
      }
    ],
    "students": [
      {
        "no": 1,
        "code": "2631",
        "name": "เด็กชายเอกเดชา ตะแก่",
        "gender": "male",
        "scores": {
          "ท16101": {
            "coursework": 60,
            "finalExam": 22,
            "total": 82,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค16101": {
            "coursework": 60,
            "finalExam": 20,
            "total": 80,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว16101": {
            "coursework": 63,
            "finalExam": 26,
            "total": 89,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส16101": {
            "coursework": 63,
            "finalExam": 27,
            "total": 90,
            "grade": "4",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส16102": {
            "coursework": 64,
            "finalExam": 26,
            "total": 90,
            "grade": "4",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ16101": {
            "coursework": 60,
            "finalExam": 21,
            "total": 81,
            "grade": "4",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ16101": {
            "coursework": 58,
            "finalExam": 18,
            "total": 76,
            "grade": "3.5",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง16101": {
            "coursework": 63,
            "finalExam": 27,
            "total": 90,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ16101": {
            "coursework": 63,
            "finalExam": 26,
            "total": 89,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 2,
        "code": "2632",
        "name": "เด็กชายเกียรติศักดิ์ ไทรงาม",
        "gender": "male",
        "scores": {
          "ท16101": {
            "coursework": 57,
            "finalExam": 22,
            "total": 79,
            "grade": "3.5",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค16101": {
            "coursework": 55,
            "finalExam": 18,
            "total": 73,
            "grade": "3",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว16101": {
            "coursework": 57,
            "finalExam": 23,
            "total": 80,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส16101": {
            "coursework": 52,
            "finalExam": 16,
            "total": 68,
            "grade": "2.5",
            "attendedHours": 30,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ส16102": {
            "coursework": 57,
            "finalExam": 23,
            "total": 80,
            "grade": "4",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ16101": {
            "coursework": 58,
            "finalExam": 25,
            "total": 83,
            "grade": "4",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ16101": {
            "coursework": 59,
            "finalExam": 25,
            "total": 84,
            "grade": "4",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง16101": {
            "coursework": 53,
            "finalExam": 16,
            "total": 69,
            "grade": "2.5",
            "attendedHours": 20,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "อ16101": {
            "coursework": 59,
            "finalExam": 25,
            "total": 84,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 3,
        "code": "2633",
        "name": "เด็กชายสว่าง หัวบือ",
        "gender": "male",
        "scores": {
          "ท16101": {
            "coursework": 52,
            "finalExam": 19,
            "total": 71,
            "grade": "3",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "ค16101": {
            "coursework": 47,
            "finalExam": 14,
            "total": 61,
            "grade": "2",
            "attendedHours": 80,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ว16101": {
            "coursework": 52,
            "finalExam": 20,
            "total": 72,
            "grade": "3",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส16101": {
            "coursework": 52,
            "finalExam": 21,
            "total": 73,
            "grade": "3",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส16102": {
            "coursework": 49,
            "finalExam": 16,
            "total": 65,
            "grade": "2.5",
            "attendedHours": 30,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "พ16101": {
            "coursework": 50,
            "finalExam": 17,
            "total": 67,
            "grade": "2.5",
            "attendedHours": 30,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ศ16101": {
            "coursework": 50,
            "finalExam": 18,
            "total": 68,
            "grade": "2.5",
            "attendedHours": 30,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ง16101": {
            "coursework": 49,
            "finalExam": 17,
            "total": 66,
            "grade": "2.5",
            "attendedHours": 20,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "อ16101": {
            "coursework": 50,
            "finalExam": 18,
            "total": 68,
            "grade": "2.5",
            "attendedHours": 80,
            "traitScore": 2,
            "readThinkScore": 2
          }
        },
        "traitResult": "ดี",
        "readThinkResult": "ดี",
        "activityResult": "ผ่าน"
      },
      {
        "no": 4,
        "code": "2634",
        "name": "เด็กชายรพีพัทธ์ ประเสริฐศิลป์",
        "gender": "male",
        "scores": {
          "ท16101": {
            "coursework": 63,
            "finalExam": 23,
            "total": 86,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค16101": {
            "coursework": 62,
            "finalExam": 22,
            "total": 84,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว16101": {
            "coursework": 61,
            "finalExam": 20,
            "total": 81,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส16101": {
            "coursework": 62,
            "finalExam": 21,
            "total": 83,
            "grade": "4",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส16102": {
            "coursework": 65,
            "finalExam": 25,
            "total": 90,
            "grade": "4",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ16101": {
            "coursework": 61,
            "finalExam": 19,
            "total": 80,
            "grade": "4",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ16101": {
            "coursework": 62,
            "finalExam": 20,
            "total": 82,
            "grade": "4",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง16101": {
            "coursework": 61,
            "finalExam": 18,
            "total": 79,
            "grade": "3.5",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ16101": {
            "coursework": 61,
            "finalExam": 19,
            "total": 80,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 5,
        "code": "2636",
        "name": "เด็กชายจิรภัทร ดานบิน",
        "gender": "male",
        "scores": {
          "ท16101": {
            "coursework": 54,
            "finalExam": 21,
            "total": 75,
            "grade": "3.5",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค16101": {
            "coursework": 50,
            "finalExam": 16,
            "total": 66,
            "grade": "2.5",
            "attendedHours": 80,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ว16101": {
            "coursework": 49,
            "finalExam": 15,
            "total": 64,
            "grade": "2",
            "attendedHours": 40,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ส16101": {
            "coursework": 56,
            "finalExam": 23,
            "total": 79,
            "grade": "3.5",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส16102": {
            "coursework": 50,
            "finalExam": 16,
            "total": 66,
            "grade": "2.5",
            "attendedHours": 30,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "พ16101": {
            "coursework": 53,
            "finalExam": 18,
            "total": 71,
            "grade": "3",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "ศ16101": {
            "coursework": 52,
            "finalExam": 18,
            "total": 70,
            "grade": "3",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "ง16101": {
            "coursework": 50,
            "finalExam": 15,
            "total": 65,
            "grade": "2.5",
            "attendedHours": 20,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "อ16101": {
            "coursework": 54,
            "finalExam": 20,
            "total": 74,
            "grade": "3",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดี",
        "activityResult": "ผ่าน"
      },
      {
        "no": 6,
        "code": "2637",
        "name": "เด็กชายณฐพล จันทะคุณ",
        "gender": "male",
        "scores": {
          "ท16101": {
            "coursework": 63,
            "finalExam": 21,
            "total": 84,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค16101": {
            "coursework": 65,
            "finalExam": 22,
            "total": 87,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว16101": {
            "coursework": 62,
            "finalExam": 19,
            "total": 81,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส16101": {
            "coursework": 62,
            "finalExam": 19,
            "total": 81,
            "grade": "4",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส16102": {
            "coursework": 67,
            "finalExam": 27,
            "total": 94,
            "grade": "4",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ16101": {
            "coursework": 66,
            "finalExam": 25,
            "total": 91,
            "grade": "4",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ16101": {
            "coursework": 67,
            "finalExam": 28,
            "total": 95,
            "grade": "4",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง16101": {
            "coursework": 62,
            "finalExam": 19,
            "total": 81,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ16101": {
            "coursework": 62,
            "finalExam": 19,
            "total": 81,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 7,
        "code": "2638",
        "name": "เด็กชายรัชชานนท์ จำปา",
        "gender": "male",
        "scores": {
          "ท16101": {
            "coursework": 58,
            "finalExam": 17,
            "total": 75,
            "grade": "3.5",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค16101": {
            "coursework": 62,
            "finalExam": 24,
            "total": 86,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว16101": {
            "coursework": 63,
            "finalExam": 27,
            "total": 90,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส16101": {
            "coursework": 58,
            "finalExam": 18,
            "total": 76,
            "grade": "3.5",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส16102": {
            "coursework": 59,
            "finalExam": 19,
            "total": 78,
            "grade": "3.5",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ16101": {
            "coursework": 61,
            "finalExam": 22,
            "total": 83,
            "grade": "4",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ16101": {
            "coursework": 62,
            "finalExam": 25,
            "total": 87,
            "grade": "4",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง16101": {
            "coursework": 61,
            "finalExam": 24,
            "total": 85,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ16101": {
            "coursework": 62,
            "finalExam": 26,
            "total": 88,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 8,
        "code": "2639",
        "name": "เด็กชายวระพล มีกัณหา",
        "gender": "male",
        "scores": {
          "ท16101": {
            "coursework": 57,
            "finalExam": 22,
            "total": 79,
            "grade": "3.5",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค16101": {
            "coursework": 58,
            "finalExam": 25,
            "total": 83,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว16101": {
            "coursework": 56,
            "finalExam": 22,
            "total": 78,
            "grade": "3.5",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส16101": {
            "coursework": 57,
            "finalExam": 22,
            "total": 79,
            "grade": "3.5",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส16102": {
            "coursework": 54,
            "finalExam": 18,
            "total": 72,
            "grade": "3",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ16101": {
            "coursework": 53,
            "finalExam": 16,
            "total": 69,
            "grade": "2.5",
            "attendedHours": 30,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ศ16101": {
            "coursework": 55,
            "finalExam": 20,
            "total": 75,
            "grade": "3.5",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง16101": {
            "coursework": 56,
            "finalExam": 21,
            "total": 77,
            "grade": "3.5",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ16101": {
            "coursework": 56,
            "finalExam": 21,
            "total": 77,
            "grade": "3.5",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 9,
        "code": "2640",
        "name": "เด็กชายธณพล ลันทม",
        "gender": "male",
        "scores": {
          "ท16101": {
            "coursework": 48,
            "finalExam": 16,
            "total": 64,
            "grade": "2",
            "attendedHours": 80,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ค16101": {
            "coursework": 47,
            "finalExam": 15,
            "total": 62,
            "grade": "2",
            "attendedHours": 80,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ว16101": {
            "coursework": 50,
            "finalExam": 17,
            "total": 67,
            "grade": "2.5",
            "attendedHours": 40,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ส16101": {
            "coursework": 47,
            "finalExam": 15,
            "total": 62,
            "grade": "2",
            "attendedHours": 30,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ส16102": {
            "coursework": 52,
            "finalExam": 20,
            "total": 72,
            "grade": "3",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ16101": {
            "coursework": 52,
            "finalExam": 21,
            "total": 73,
            "grade": "3",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ16101": {
            "coursework": 52,
            "finalExam": 22,
            "total": 74,
            "grade": "3",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง16101": {
            "coursework": 50,
            "finalExam": 17,
            "total": 67,
            "grade": "2.5",
            "attendedHours": 20,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "อ16101": {
            "coursework": 52,
            "finalExam": 21,
            "total": 73,
            "grade": "3",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดี",
        "readThinkResult": "ดี",
        "activityResult": "ผ่าน"
      },
      {
        "no": 10,
        "code": "2641",
        "name": "เด็กชายนราวิชญ์ พลอยประดับ",
        "gender": "male",
        "scores": {
          "ท16101": {
            "coursework": 61,
            "finalExam": 21,
            "total": 82,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค16101": {
            "coursework": 62,
            "finalExam": 21,
            "total": 83,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว16101": {
            "coursework": 65,
            "finalExam": 28,
            "total": 93,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส16101": {
            "coursework": 60,
            "finalExam": 20,
            "total": 80,
            "grade": "4",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส16102": {
            "coursework": 64,
            "finalExam": 26,
            "total": 90,
            "grade": "4",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ16101": {
            "coursework": 62,
            "finalExam": 21,
            "total": 83,
            "grade": "4",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ16101": {
            "coursework": 65,
            "finalExam": 26,
            "total": 91,
            "grade": "4",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง16101": {
            "coursework": 62,
            "finalExam": 22,
            "total": 84,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ16101": {
            "coursework": 62,
            "finalExam": 23,
            "total": 85,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 11,
        "code": "2642",
        "name": "เด็กชายศุกลวัฒน์ โพธิ์มณี",
        "gender": "male",
        "scores": {
          "ท16101": {
            "coursework": 59,
            "finalExam": 23,
            "total": 82,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค16101": {
            "coursework": 57,
            "finalExam": 20,
            "total": 77,
            "grade": "3.5",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว16101": {
            "coursework": 58,
            "finalExam": 21,
            "total": 79,
            "grade": "3.5",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส16101": {
            "coursework": 59,
            "finalExam": 24,
            "total": 83,
            "grade": "4",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส16102": {
            "coursework": 58,
            "finalExam": 22,
            "total": 80,
            "grade": "4",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ16101": {
            "coursework": 54,
            "finalExam": 16,
            "total": 70,
            "grade": "3",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "ศ16101": {
            "coursework": 56,
            "finalExam": 18,
            "total": 74,
            "grade": "3",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง16101": {
            "coursework": 55,
            "finalExam": 17,
            "total": 72,
            "grade": "3",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ16101": {
            "coursework": 55,
            "finalExam": 17,
            "total": 72,
            "grade": "3",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 12,
        "code": "2746",
        "name": "เด็กชายพีรพล แก้วดี",
        "gender": "male",
        "scores": {
          "ท16101": {
            "coursework": 48,
            "finalExam": 15,
            "total": 63,
            "grade": "2",
            "attendedHours": 80,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ค16101": {
            "coursework": 54,
            "finalExam": 23,
            "total": 77,
            "grade": "3.5",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว16101": {
            "coursework": 54,
            "finalExam": 22,
            "total": 76,
            "grade": "3.5",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส16101": {
            "coursework": 51,
            "finalExam": 18,
            "total": 69,
            "grade": "2.5",
            "attendedHours": 30,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ส16102": {
            "coursework": 50,
            "finalExam": 16,
            "total": 66,
            "grade": "2.5",
            "attendedHours": 30,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "พ16101": {
            "coursework": 54,
            "finalExam": 22,
            "total": 76,
            "grade": "3.5",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ16101": {
            "coursework": 52,
            "finalExam": 18,
            "total": 70,
            "grade": "3",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "ง16101": {
            "coursework": 54,
            "finalExam": 23,
            "total": 77,
            "grade": "3.5",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ16101": {
            "coursework": 49,
            "finalExam": 15,
            "total": 64,
            "grade": "2",
            "attendedHours": 80,
            "traitScore": 2,
            "readThinkScore": 2
          }
        },
        "traitResult": "ดี",
        "readThinkResult": "ดี",
        "activityResult": "ผ่าน"
      },
      {
        "no": 13,
        "code": "2830",
        "name": "เด็กชายพิธิสักค์ มะลัยไธสงค์",
        "gender": "male",
        "scores": {
          "ท16101": {
            "coursework": 59,
            "finalExam": 21,
            "total": 80,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค16101": {
            "coursework": 60,
            "finalExam": 20,
            "total": 80,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว16101": {
            "coursework": 59,
            "finalExam": 20,
            "total": 79,
            "grade": "3.5",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส16101": {
            "coursework": 61,
            "finalExam": 23,
            "total": 84,
            "grade": "4",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส16102": {
            "coursework": 58,
            "finalExam": 18,
            "total": 76,
            "grade": "3.5",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ16101": {
            "coursework": 58,
            "finalExam": 18,
            "total": 76,
            "grade": "3.5",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ16101": {
            "coursework": 62,
            "finalExam": 25,
            "total": 87,
            "grade": "4",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง16101": {
            "coursework": 63,
            "finalExam": 26,
            "total": 89,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ16101": {
            "coursework": 62,
            "finalExam": 24,
            "total": 86,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 14,
        "code": "2171",
        "name": "นายธนวัฒน์ สุขเสริม",
        "gender": "male",
        "scores": {
          "ท16101": {
            "coursework": 65,
            "finalExam": 25,
            "total": 90,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค16101": {
            "coursework": 61,
            "finalExam": 19,
            "total": 80,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว16101": {
            "coursework": 65,
            "finalExam": 24,
            "total": 89,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส16101": {
            "coursework": 63,
            "finalExam": 22,
            "total": 85,
            "grade": "4",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส16102": {
            "coursework": 63,
            "finalExam": 21,
            "total": 84,
            "grade": "4",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ16101": {
            "coursework": 66,
            "finalExam": 27,
            "total": 93,
            "grade": "4",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ16101": {
            "coursework": 62,
            "finalExam": 20,
            "total": 82,
            "grade": "4",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง16101": {
            "coursework": 67,
            "finalExam": 28,
            "total": 95,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ16101": {
            "coursework": 65,
            "finalExam": 26,
            "total": 91,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 15,
        "code": "2643",
        "name": "เด็กชายณัฐพล เหระวัน",
        "gender": "male",
        "scores": {
          "ท16101": {
            "coursework": 53,
            "finalExam": 21,
            "total": 74,
            "grade": "3",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค16101": {
            "coursework": 48,
            "finalExam": 15,
            "total": 63,
            "grade": "2",
            "attendedHours": 80,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ว16101": {
            "coursework": 52,
            "finalExam": 19,
            "total": 71,
            "grade": "3",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "ส16101": {
            "coursework": 53,
            "finalExam": 21,
            "total": 74,
            "grade": "3",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส16102": {
            "coursework": 54,
            "finalExam": 22,
            "total": 76,
            "grade": "3.5",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ16101": {
            "coursework": 55,
            "finalExam": 23,
            "total": 78,
            "grade": "3.5",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ16101": {
            "coursework": 49,
            "finalExam": 16,
            "total": 65,
            "grade": "2.5",
            "attendedHours": 30,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ง16101": {
            "coursework": 53,
            "finalExam": 20,
            "total": 73,
            "grade": "3",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ16101": {
            "coursework": 53,
            "finalExam": 20,
            "total": 73,
            "grade": "3",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดี",
        "readThinkResult": "ดี",
        "activityResult": "ผ่าน"
      },
      {
        "no": 16,
        "code": "2645",
        "name": "เด็กหญิงสุภัสสรา รักไทย",
        "gender": "female",
        "scores": {
          "ท16101": {
            "coursework": 58,
            "finalExam": 20,
            "total": 78,
            "grade": "3.5",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค16101": {
            "coursework": 62,
            "finalExam": 27,
            "total": 89,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว16101": {
            "coursework": 60,
            "finalExam": 22,
            "total": 82,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส16101": {
            "coursework": 61,
            "finalExam": 24,
            "total": 85,
            "grade": "4",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส16102": {
            "coursework": 62,
            "finalExam": 27,
            "total": 89,
            "grade": "4",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ16101": {
            "coursework": 57,
            "finalExam": 18,
            "total": 75,
            "grade": "3.5",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ16101": {
            "coursework": 58,
            "finalExam": 19,
            "total": 77,
            "grade": "3.5",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง16101": {
            "coursework": 57,
            "finalExam": 18,
            "total": 75,
            "grade": "3.5",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ16101": {
            "coursework": 61,
            "finalExam": 25,
            "total": 86,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 17,
        "code": "2646",
        "name": "เด็กหญิงภัทรพร มงคล",
        "gender": "female",
        "scores": {
          "ท16101": {
            "coursework": 51,
            "finalExam": 16,
            "total": 67,
            "grade": "2.5",
            "attendedHours": 80,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ค16101": {
            "coursework": 53,
            "finalExam": 17,
            "total": 70,
            "grade": "3",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "ว16101": {
            "coursework": 55,
            "finalExam": 22,
            "total": 77,
            "grade": "3.5",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส16101": {
            "coursework": 51,
            "finalExam": 16,
            "total": 67,
            "grade": "2.5",
            "attendedHours": 30,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ส16102": {
            "coursework": 55,
            "finalExam": 21,
            "total": 76,
            "grade": "3.5",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ16101": {
            "coursework": 56,
            "finalExam": 21,
            "total": 77,
            "grade": "3.5",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ16101": {
            "coursework": 52,
            "finalExam": 16,
            "total": 68,
            "grade": "2.5",
            "attendedHours": 30,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ง16101": {
            "coursework": 51,
            "finalExam": 16,
            "total": 67,
            "grade": "2.5",
            "attendedHours": 20,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "อ16101": {
            "coursework": 52,
            "finalExam": 16,
            "total": 68,
            "grade": "2.5",
            "attendedHours": 80,
            "traitScore": 2,
            "readThinkScore": 2
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 18,
        "code": "2745",
        "name": "เด็กหญิงสิริรัตน์ แสงทองศรี",
        "gender": "female",
        "scores": {
          "ท16101": {
            "coursework": 57,
            "finalExam": 21,
            "total": 78,
            "grade": "3.5",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค16101": {
            "coursework": 59,
            "finalExam": 25,
            "total": 84,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว16101": {
            "coursework": 57,
            "finalExam": 21,
            "total": 78,
            "grade": "3.5",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส16101": {
            "coursework": 54,
            "finalExam": 17,
            "total": 71,
            "grade": "3",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "ส16102": {
            "coursework": 56,
            "finalExam": 20,
            "total": 76,
            "grade": "3.5",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ16101": {
            "coursework": 58,
            "finalExam": 22,
            "total": 80,
            "grade": "4",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ16101": {
            "coursework": 57,
            "finalExam": 22,
            "total": 79,
            "grade": "3.5",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง16101": {
            "coursework": 59,
            "finalExam": 24,
            "total": 83,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ16101": {
            "coursework": 55,
            "finalExam": 19,
            "total": 74,
            "grade": "3",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 19,
        "code": "2744",
        "name": "เด็กหญิงนภรัตน์ รัตนาวงษ์",
        "gender": "female",
        "scores": {
          "ท16101": {
            "coursework": 61,
            "finalExam": 20,
            "total": 81,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค16101": {
            "coursework": 61,
            "finalExam": 21,
            "total": 82,
            "grade": "4",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว16101": {
            "coursework": 62,
            "finalExam": 22,
            "total": 84,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส16101": {
            "coursework": 60,
            "finalExam": 19,
            "total": 79,
            "grade": "3.5",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส16102": {
            "coursework": 62,
            "finalExam": 22,
            "total": 84,
            "grade": "4",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ16101": {
            "coursework": 65,
            "finalExam": 27,
            "total": 92,
            "grade": "4",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ16101": {
            "coursework": 65,
            "finalExam": 27,
            "total": 92,
            "grade": "4",
            "attendedHours": 30,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง16101": {
            "coursework": 61,
            "finalExam": 22,
            "total": 83,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ16101": {
            "coursework": 58,
            "finalExam": 18,
            "total": 76,
            "grade": "3.5",
            "attendedHours": 80,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      }
    ]
  },
  {
    "classId": "m1",
    "shortName": "ม.1",
    "className": "มัธยมศึกษาปีที่ 1",
    "level": "มัธยม",
    "room": 1,
    "semester": "1",
    "year": "2569",
    "schoolName": "โรงเรียนบ้านคลองมดแดง",
    "affiliation": "สำนักงานเขตพื้นที่การศึกษาประถมศึกษากำแพงเพชร เขต 2",
    "director": "นายปรัชญา ปรางค์ชัยภูมิ",
    "homeroomTeachers": [
      "นางสาวจิราภา พานชัย",
      "นายอนันตชัย เพ็ชรรี่"
    ],
    "subjects": [
      {
        "code": "ท21101",
        "name": "ภาษาไทย 1",
        "type": "พื้นฐาน",
        "group": "ภาษาไทย (พื้นฐาน)",
        "credits": 1.5,
        "hours": 60,
        "teacher": "นางสาวจิราภา พานชัย"
      },
      {
        "code": "ค21101",
        "name": "คณิตศาสตร์ 1",
        "type": "พื้นฐาน",
        "group": "คณิตศาสตร์ (พื้นฐาน)",
        "credits": 1.5,
        "hours": 60,
        "teacher": "นายพิศุทธิ์ เชาวลิตโรจน์"
      },
      {
        "code": "ว21101",
        "name": "วิทยาศาสตร์และเทคโนโลยี 1",
        "type": "พื้นฐาน",
        "group": "วิทยาศาสตร์ฯ (พื้นฐาน)",
        "credits": 1.5,
        "hours": 60,
        "teacher": "นายพิศุทธิ์ เชาวลิตโรจน์"
      },
      {
        "code": "ส21101",
        "name": "สังคมศึกษา ศาสนาและวัฒนธรรม 1",
        "type": "พื้นฐาน",
        "group": "สังคมศึกษาฯ (พื้นฐาน)",
        "credits": 1.5,
        "hours": 60,
        "teacher": "นายธิติวุฒิ เตยไธสง"
      },
      {
        "code": "ส21102",
        "name": "ประวัติศาสตร์ 1",
        "type": "พื้นฐาน",
        "group": "สังคมศึกษาฯ (พื้นฐาน)",
        "credits": 0.5,
        "hours": 20,
        "teacher": "นายธิติวุฒิ เตยไธสง"
      },
      {
        "code": "พ21101",
        "name": "สุขศึกษาและพลศึกษา 1",
        "type": "พื้นฐาน",
        "group": "สุขศึกษาฯ (พื้นฐาน)",
        "credits": 1.0,
        "hours": 40,
        "teacher": "นางสาวอาริษา ฉิมสุพร"
      },
      {
        "code": "ศ21101",
        "name": "ศิลปะ 1",
        "type": "พื้นฐาน",
        "group": "ศิลปะ (พื้นฐาน)",
        "credits": 1.0,
        "hours": 40,
        "teacher": "นางสาวไอยรดา อาจจีน"
      },
      {
        "code": "ง21101",
        "name": "การงานอาชีพ 1",
        "type": "พื้นฐาน",
        "group": "การงานอาชีพฯ (พื้นฐาน)",
        "credits": 1.0,
        "hours": 40,
        "teacher": "นายพีระ เดชะผล"
      },
      {
        "code": "อ21101",
        "name": "ภาษาอังกฤษ 1",
        "type": "พื้นฐาน",
        "group": "ภาษาต่างประเทศ (พื้นฐาน)",
        "credits": 1.5,
        "hours": 60,
        "teacher": "นายอรรถชัย แก้วเอี่ยม"
      },
      {
        "code": "ค21201",
        "name": "คณิตศาสตร์เพิ่มเติม 1",
        "type": "เพิ่มเติม",
        "group": "คณิตศาสตร์ (เพิ่มเติม)",
        "credits": 0.5,
        "hours": 20,
        "teacher": "นายพิศุทธิ์ เชาวลิตโรจน์"
      },
      {
        "code": "อ21201",
        "name": "ภาษาอังกฤษเพื่อการสื่อสาร 1",
        "type": "เพิ่มเติม",
        "group": "ภาษาต่างประเทศ (เพิ่มเติม)",
        "credits": 1.0,
        "hours": 40,
        "teacher": "นายอรรถชัย แก้วเอี่ยม"
      },
      {
        "code": "ง21201",
        "name": "ทักษะอาชีพ (การตลาดออนไลน์)",
        "type": "เพิ่มเติม",
        "group": "การงานอาชีพฯ (เพิ่มเติม)",
        "credits": 1.0,
        "hours": 40,
        "teacher": "นายอนันตชัย เพ็ชรรี่"
      },
      {
        "code": "ว21103",
        "name": "วิทยาการคำนวณ 1",
        "type": "พื้นฐาน",
        "group": "วิทยาศาสตร์ฯ (เพิ่มเติม)",
        "credits": 0.5,
        "hours": 20,
        "teacher": "นายอนันตชัย เพ็ชรรี่"
      },
      {
        "code": "ว21104",
        "name": "การออกแบบและเทคโนโลยี 1",
        "type": "พื้นฐาน",
        "group": "วิทยาศาสตร์ฯ (เพิ่มเติม)",
        "credits": 0.5,
        "hours": 20,
        "teacher": "นายอนันตชัย เพ็ชรรี่"
      }
    ],
    "activities": [
      {
        "code": "ก21101",
        "name": "กิจกรรมแนะแนว",
        "hours": 20
      },
      {
        "code": "ก21102",
        "name": "กิจกรรมลูกเสือ / เนตรนารี",
        "hours": 20
      },
      {
        "code": "ก21103",
        "name": "กิจกรรมชุมนุม / ตลาดนัดอาชีพ",
        "hours": 20
      },
      {
        "code": "ก21104",
        "name": "กิจกรรมเพื่อสังคมและสาธารณประโยชน์",
        "hours": 10
      }
    ],
    "students": [
      {
        "no": 1,
        "code": "2536",
        "name": "เด็กชายเอกพล รักชาติ",
        "gender": "male",
        "scores": {
          "ท21101": {
            "coursework": 55,
            "finalExam": 17,
            "total": 72,
            "grade": "3",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค21101": {
            "coursework": 54,
            "finalExam": 20,
            "total": 74,
            "grade": "3",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว21101": {
            "coursework": 58,
            "finalExam": 18,
            "total": 76,
            "grade": "3.5",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส21101": {
            "coursework": 57,
            "finalExam": 19,
            "total": 76,
            "grade": "3.5",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส21102": {
            "coursework": 60,
            "finalExam": 21,
            "total": 81,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ21101": {
            "coursework": 57,
            "finalExam": 18,
            "total": 75,
            "grade": "3.5",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ21101": {
            "coursework": 55,
            "finalExam": 20,
            "total": 75,
            "grade": "3.5",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง21101": {
            "coursework": 46,
            "finalExam": 15,
            "total": 61,
            "grade": "2",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ21101": {
            "coursework": 43,
            "finalExam": 17,
            "total": 60,
            "grade": "2",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค21201": {
            "coursework": 57,
            "finalExam": 20,
            "total": 77,
            "grade": "3.5",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ21201": {
            "coursework": 48,
            "finalExam": 14,
            "total": 62,
            "grade": "2",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง21201": {
            "coursework": 60,
            "finalExam": 18,
            "total": 78,
            "grade": "3.5",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว21103": {
            "coursework": 67,
            "finalExam": 25,
            "total": 92,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว21104": {
            "coursework": 67,
            "finalExam": 25,
            "total": 92,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 2,
        "code": "2533",
        "name": "เด็กชายพัชรพล ภูเด่นตา",
        "gender": "male",
        "scores": {
          "ท21101": {
            "coursework": 57,
            "finalExam": 18,
            "total": 75,
            "grade": "3.5",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค21101": {
            "coursework": 54,
            "finalExam": 17,
            "total": 71,
            "grade": "3",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว21101": {
            "coursework": 56,
            "finalExam": 19,
            "total": 75,
            "grade": "3.5",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส21101": {
            "coursework": 55,
            "finalExam": 21,
            "total": 76,
            "grade": "3.5",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส21102": {
            "coursework": 61,
            "finalExam": 19,
            "total": 80,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ21101": {
            "coursework": 55,
            "finalExam": 22,
            "total": 77,
            "grade": "3.5",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ21101": {
            "coursework": 60,
            "finalExam": 18,
            "total": 78,
            "grade": "3.5",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง21101": {
            "coursework": 53,
            "finalExam": 23,
            "total": 76,
            "grade": "3.5",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ21101": {
            "coursework": 52,
            "finalExam": 18,
            "total": 70,
            "grade": "3",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค21201": {
            "coursework": 48,
            "finalExam": 17,
            "total": 65,
            "grade": "2.5",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ21201": {
            "coursework": 53,
            "finalExam": 22,
            "total": 75,
            "grade": "3.5",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง21201": {
            "coursework": 67,
            "finalExam": 23,
            "total": 90,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว21103": {
            "coursework": 67,
            "finalExam": 25,
            "total": 92,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว21104": {
            "coursework": 67,
            "finalExam": 25,
            "total": 92,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 3,
        "code": "3218",
        "name": "เด็กชายกฤษณชัย แซ่ม้า",
        "gender": "male",
        "scores": {
          "ท21101": {
            "coursework": 42,
            "finalExam": 14,
            "total": 56,
            "grade": "1.5",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "ค21101": {
            "coursework": 39,
            "finalExam": 13,
            "total": 52,
            "grade": "1",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "ว21101": {
            "coursework": 41,
            "finalExam": 17,
            "total": 58,
            "grade": "1.5",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "ส21101": {
            "coursework": 41,
            "finalExam": 15,
            "total": 56,
            "grade": "1.5",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "ส21102": {
            "coursework": 46,
            "finalExam": 15,
            "total": 61,
            "grade": "2",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "พ21101": {
            "coursework": 42,
            "finalExam": 18,
            "total": 60,
            "grade": "2",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "ศ21101": {
            "coursework": 46,
            "finalExam": 16,
            "total": 62,
            "grade": "2",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "ง21101": {
            "coursework": 38,
            "finalExam": 15,
            "total": 53,
            "grade": "1",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "อ21101": {
            "coursework": 41,
            "finalExam": 14,
            "total": 55,
            "grade": "1.5",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "ค21201": {
            "coursework": 41,
            "finalExam": 13,
            "total": 54,
            "grade": "1",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "อ21201": {
            "coursework": 40,
            "finalExam": 15,
            "total": 55,
            "grade": "1.5",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "ง21201": {
            "coursework": 53,
            "finalExam": 18,
            "total": 71,
            "grade": "3",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "ว21103": {
            "coursework": 68,
            "finalExam": 26,
            "total": 94,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "ว21104": {
            "coursework": 68,
            "finalExam": 26,
            "total": 94,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 2
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดี",
        "activityResult": "ผ่าน"
      },
      {
        "no": 4,
        "code": "2538",
        "name": "เด็กหญิงณัชชา คงทน",
        "gender": "female",
        "scores": {
          "ท21101": {
            "coursework": 59,
            "finalExam": 21,
            "total": 80,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค21101": {
            "coursework": 53,
            "finalExam": 18,
            "total": 71,
            "grade": "3",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว21101": {
            "coursework": 57,
            "finalExam": 23,
            "total": 80,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส21101": {
            "coursework": 60,
            "finalExam": 21,
            "total": 81,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส21102": {
            "coursework": 60,
            "finalExam": 25,
            "total": 85,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ21101": {
            "coursework": 61,
            "finalExam": 19,
            "total": 80,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ21101": {
            "coursework": 63,
            "finalExam": 22,
            "total": 85,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง21101": {
            "coursework": 62,
            "finalExam": 20,
            "total": 82,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ21101": {
            "coursework": 57,
            "finalExam": 21,
            "total": 78,
            "grade": "3.5",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค21201": {
            "coursework": 49,
            "finalExam": 20,
            "total": 69,
            "grade": "2.5",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ21201": {
            "coursework": 52,
            "finalExam": 21,
            "total": 73,
            "grade": "3",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง21201": {
            "coursework": 70,
            "finalExam": 26,
            "total": 96,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว21103": {
            "coursework": 55,
            "finalExam": 9,
            "total": 64,
            "grade": "2",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว21104": {
            "coursework": 55,
            "finalExam": 9,
            "total": 64,
            "grade": "2",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 5,
        "code": "2539",
        "name": "เด็กหญิงพิชญธิดา มาไกล",
        "gender": "female",
        "scores": {
          "ท21101": {
            "coursework": 47,
            "finalExam": 17,
            "total": 64,
            "grade": "2",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "ค21101": {
            "coursework": 41,
            "finalExam": 17,
            "total": 58,
            "grade": "1.5",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "ว21101": {
            "coursework": 48,
            "finalExam": 15,
            "total": 63,
            "grade": "2",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "ส21101": {
            "coursework": 44,
            "finalExam": 16,
            "total": 60,
            "grade": "2",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "ส21102": {
            "coursework": 56,
            "finalExam": 22,
            "total": 78,
            "grade": "3.5",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "พ21101": {
            "coursework": 48,
            "finalExam": 20,
            "total": 68,
            "grade": "2.5",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "ศ21101": {
            "coursework": 48,
            "finalExam": 20,
            "total": 68,
            "grade": "2.5",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "ง21101": {
            "coursework": 49,
            "finalExam": 20,
            "total": 69,
            "grade": "2.5",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "อ21101": {
            "coursework": 42,
            "finalExam": 18,
            "total": 60,
            "grade": "2",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "ค21201": {
            "coursework": 48,
            "finalExam": 15,
            "total": 63,
            "grade": "2",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "อ21201": {
            "coursework": 46,
            "finalExam": 14,
            "total": 60,
            "grade": "2",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "ง21201": {
            "coursework": 44,
            "finalExam": 16,
            "total": 60,
            "grade": "2",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "ว21103": {
            "coursework": 66,
            "finalExam": 28,
            "total": 94,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "ว21104": {
            "coursework": 65,
            "finalExam": 28,
            "total": 93,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 2
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดี",
        "activityResult": "ผ่าน"
      },
      {
        "no": 6,
        "code": "2540",
        "name": "เด็กหญิงเขมิกา ลึบอ",
        "gender": "female",
        "scores": {
          "ท21101": {
            "coursework": 50,
            "finalExam": 18,
            "total": 68,
            "grade": "2.5",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค21101": {
            "coursework": 47,
            "finalExam": 17,
            "total": 64,
            "grade": "2",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว21101": {
            "coursework": 49,
            "finalExam": 18,
            "total": 67,
            "grade": "2.5",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส21101": {
            "coursework": 45,
            "finalExam": 19,
            "total": 64,
            "grade": "2",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส21102": {
            "coursework": 54,
            "finalExam": 22,
            "total": 76,
            "grade": "3.5",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ21101": {
            "coursework": 55,
            "finalExam": 18,
            "total": 73,
            "grade": "3",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ21101": {
            "coursework": 54,
            "finalExam": 20,
            "total": 74,
            "grade": "3",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง21101": {
            "coursework": 46,
            "finalExam": 16,
            "total": 62,
            "grade": "2",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ21101": {
            "coursework": 49,
            "finalExam": 16,
            "total": 65,
            "grade": "2.5",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค21201": {
            "coursework": 52,
            "finalExam": 16,
            "total": 68,
            "grade": "2.5",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ21201": {
            "coursework": 52,
            "finalExam": 16,
            "total": 68,
            "grade": "2.5",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง21201": {
            "coursework": 61,
            "finalExam": 23,
            "total": 84,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว21103": {
            "coursework": 57,
            "finalExam": 10,
            "total": 67,
            "grade": "2.5",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว21104": {
            "coursework": 58,
            "finalExam": 10,
            "total": 68,
            "grade": "2.5",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 7,
        "code": "2602",
        "name": "เด็กหญิงวราภรณ์ -",
        "gender": "female",
        "scores": {
          "ท21101": {
            "coursework": 57,
            "finalExam": 21,
            "total": 78,
            "grade": "3.5",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค21101": {
            "coursework": 47,
            "finalExam": 19,
            "total": 66,
            "grade": "2.5",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว21101": {
            "coursework": 60,
            "finalExam": 21,
            "total": 81,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส21101": {
            "coursework": 56,
            "finalExam": 19,
            "total": 75,
            "grade": "3.5",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส21102": {
            "coursework": 62,
            "finalExam": 25,
            "total": 87,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ21101": {
            "coursework": 60,
            "finalExam": 25,
            "total": 85,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ21101": {
            "coursework": 59,
            "finalExam": 25,
            "total": 84,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง21101": {
            "coursework": 63,
            "finalExam": 25,
            "total": 88,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ21101": {
            "coursework": 58,
            "finalExam": 19,
            "total": 77,
            "grade": "3.5",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค21201": {
            "coursework": 45,
            "finalExam": 16,
            "total": 61,
            "grade": "2",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ21201": {
            "coursework": 50,
            "finalExam": 20,
            "total": 70,
            "grade": "3",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง21201": {
            "coursework": 64,
            "finalExam": 21,
            "total": 85,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว21103": {
            "coursework": 58,
            "finalExam": 16,
            "total": 74,
            "grade": "3",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว21104": {
            "coursework": 58,
            "finalExam": 16,
            "total": 74,
            "grade": "3",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 8,
        "code": "2831",
        "name": "เด็กหญิงสิริกานต์ เปี่ยมใจ",
        "gender": "female",
        "scores": {
          "ท21101": {
            "coursework": 58,
            "finalExam": 24,
            "total": 82,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค21101": {
            "coursework": 53,
            "finalExam": 17,
            "total": 70,
            "grade": "3",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว21101": {
            "coursework": 61,
            "finalExam": 23,
            "total": 84,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส21101": {
            "coursework": 60,
            "finalExam": 21,
            "total": 81,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส21102": {
            "coursework": 69,
            "finalExam": 22,
            "total": 91,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ21101": {
            "coursework": 64,
            "finalExam": 23,
            "total": 87,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ21101": {
            "coursework": 65,
            "finalExam": 23,
            "total": 88,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง21101": {
            "coursework": 66,
            "finalExam": 24,
            "total": 90,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ21101": {
            "coursework": 57,
            "finalExam": 21,
            "total": 78,
            "grade": "3.5",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค21201": {
            "coursework": 45,
            "finalExam": 16,
            "total": 61,
            "grade": "2",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ21201": {
            "coursework": 47,
            "finalExam": 18,
            "total": 65,
            "grade": "2.5",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง21201": {
            "coursework": 62,
            "finalExam": 26,
            "total": 88,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว21103": {
            "coursework": 69,
            "finalExam": 28,
            "total": 97,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว21104": {
            "coursework": 69,
            "finalExam": 28,
            "total": 97,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 9,
        "code": "3215",
        "name": "เด็กหญิงสุพิชชา พูลจวง",
        "gender": "female",
        "scores": {
          "ท21101": {
            "coursework": 60,
            "finalExam": 21,
            "total": 81,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค21101": {
            "coursework": 52,
            "finalExam": 19,
            "total": 71,
            "grade": "3",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว21101": {
            "coursework": 65,
            "finalExam": 23,
            "total": 88,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส21101": {
            "coursework": 58,
            "finalExam": 18,
            "total": 76,
            "grade": "3.5",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส21102": {
            "coursework": 70,
            "finalExam": 22,
            "total": 92,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ21101": {
            "coursework": 51,
            "finalExam": 21,
            "total": 72,
            "grade": "3",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ21101": {
            "coursework": 61,
            "finalExam": 24,
            "total": 85,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง21101": {
            "coursework": 63,
            "finalExam": 25,
            "total": 88,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ21101": {
            "coursework": 57,
            "finalExam": 21,
            "total": 78,
            "grade": "3.5",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค21201": {
            "coursework": 50,
            "finalExam": 20,
            "total": 70,
            "grade": "3",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ21201": {
            "coursework": 59,
            "finalExam": 19,
            "total": 78,
            "grade": "3.5",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง21201": {
            "coursework": 67,
            "finalExam": 26,
            "total": 93,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว21103": {
            "coursework": 69,
            "finalExam": 28,
            "total": 97,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว21104": {
            "coursework": 69,
            "finalExam": 28,
            "total": 97,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 10,
        "code": "3216",
        "name": "เด็กหญิงบุญจิรา ธัญชาติไพศาล",
        "gender": "female",
        "scores": {
          "ท21101": {
            "coursework": 58,
            "finalExam": 22,
            "total": 80,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค21101": {
            "coursework": 50,
            "finalExam": 16,
            "total": 66,
            "grade": "2.5",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว21101": {
            "coursework": 61,
            "finalExam": 23,
            "total": 84,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส21101": {
            "coursework": 56,
            "finalExam": 22,
            "total": 78,
            "grade": "3.5",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส21102": {
            "coursework": 69,
            "finalExam": 21,
            "total": 90,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ21101": {
            "coursework": 65,
            "finalExam": 20,
            "total": 85,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ21101": {
            "coursework": 65,
            "finalExam": 21,
            "total": 86,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง21101": {
            "coursework": 69,
            "finalExam": 24,
            "total": 93,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ21101": {
            "coursework": 56,
            "finalExam": 21,
            "total": 77,
            "grade": "3.5",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค21201": {
            "coursework": 47,
            "finalExam": 15,
            "total": 62,
            "grade": "2",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ21201": {
            "coursework": 50,
            "finalExam": 15,
            "total": 65,
            "grade": "2.5",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง21201": {
            "coursework": 63,
            "finalExam": 27,
            "total": 90,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว21103": {
            "coursework": 69,
            "finalExam": 27,
            "total": 96,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว21104": {
            "coursework": 69,
            "finalExam": 27,
            "total": 96,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 11,
        "code": "3217",
        "name": "เด็กหญิงกชกร แซ่ม้า",
        "gender": "female",
        "scores": {
          "ท21101": {
            "coursework": 55,
            "finalExam": 21,
            "total": 76,
            "grade": "3.5",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค21101": {
            "coursework": 45,
            "finalExam": 17,
            "total": 62,
            "grade": "2",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว21101": {
            "coursework": 60,
            "finalExam": 20,
            "total": 80,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส21101": {
            "coursework": 58,
            "finalExam": 19,
            "total": 77,
            "grade": "3.5",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส21102": {
            "coursework": 62,
            "finalExam": 26,
            "total": 88,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ21101": {
            "coursework": 55,
            "finalExam": 20,
            "total": 75,
            "grade": "3.5",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ21101": {
            "coursework": 56,
            "finalExam": 22,
            "total": 78,
            "grade": "3.5",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง21101": {
            "coursework": 66,
            "finalExam": 27,
            "total": 93,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ21101": {
            "coursework": 51,
            "finalExam": 19,
            "total": 70,
            "grade": "3",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค21201": {
            "coursework": 46,
            "finalExam": 16,
            "total": 62,
            "grade": "2",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ21201": {
            "coursework": 51,
            "finalExam": 19,
            "total": 70,
            "grade": "3",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง21201": {
            "coursework": 52,
            "finalExam": 19,
            "total": 71,
            "grade": "3",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว21103": {
            "coursework": 66,
            "finalExam": 23,
            "total": 89,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว21104": {
            "coursework": 66,
            "finalExam": 23,
            "total": 89,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 12,
        "code": "3219",
        "name": "เด็กหญิงนิชา แซ่โซ้ง",
        "gender": "female",
        "scores": {
          "ท21101": {
            "coursework": 66,
            "finalExam": 20,
            "total": 86,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค21101": {
            "coursework": 63,
            "finalExam": 20,
            "total": 83,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว21101": {
            "coursework": 69,
            "finalExam": 21,
            "total": 90,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส21101": {
            "coursework": 58,
            "finalExam": 22,
            "total": 80,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส21102": {
            "coursework": 67,
            "finalExam": 27,
            "total": 94,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ21101": {
            "coursework": 64,
            "finalExam": 26,
            "total": 90,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ21101": {
            "coursework": 67,
            "finalExam": 25,
            "total": 92,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง21101": {
            "coursework": 68,
            "finalExam": 28,
            "total": 96,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ21101": {
            "coursework": 58,
            "finalExam": 19,
            "total": 77,
            "grade": "3.5",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค21201": {
            "coursework": 51,
            "finalExam": 22,
            "total": 73,
            "grade": "3",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ21201": {
            "coursework": 48,
            "finalExam": 19,
            "total": 67,
            "grade": "2.5",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง21201": {
            "coursework": 70,
            "finalExam": 26,
            "total": 96,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว21103": {
            "coursework": 67,
            "finalExam": 25,
            "total": 92,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว21104": {
            "coursework": 67,
            "finalExam": 25,
            "total": 92,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      }
    ]
  },
  {
    "classId": "m2",
    "shortName": "ม.2",
    "className": "มัธยมศึกษาปีที่ 2",
    "level": "มัธยม",
    "room": 1,
    "semester": "1",
    "year": "2569",
    "schoolName": "โรงเรียนบ้านคลองมดแดง",
    "affiliation": "สำนักงานเขตพื้นที่การศึกษาประถมศึกษากำแพงเพชร เขต 2",
    "director": "นายปรัชญา ปรางค์ชัยภูมิ",
    "homeroomTeachers": [
      "นายอรรถชัย แก้วเอี่ยม"
    ],
    "subjects": [
      {
        "code": "ท22101",
        "name": "ภาษาไทย 3",
        "type": "พื้นฐาน",
        "group": "ภาษาไทย (พื้นฐาน)",
        "credits": 1.5,
        "hours": 60,
        "teacher": "นางสาวจิราภา พานชัย"
      },
      {
        "code": "ค22101",
        "name": "คณิตศาสตร์ 3",
        "type": "พื้นฐาน",
        "group": "คณิตศาสตร์ (พื้นฐาน)",
        "credits": 1.5,
        "hours": 60,
        "teacher": "นายพิศุทธิ์ เชาวลิตโรจน์"
      },
      {
        "code": "ว22101",
        "name": "วิทยาศาสตร์และเทคโนโลยี 3",
        "type": "พื้นฐาน",
        "group": "วิทยาศาสตร์ฯ (พื้นฐาน)",
        "credits": 1.5,
        "hours": 60,
        "teacher": "นายพิศุทธิ์ เชาวลิตโรจน์"
      },
      {
        "code": "ส22101",
        "name": "สังคมศึกษา ศาสนาและวัฒนธรรม 3",
        "type": "พื้นฐาน",
        "group": "สังคมศึกษาฯ (พื้นฐาน)",
        "credits": 1.5,
        "hours": 60,
        "teacher": "นายธิติวุฒิ เตยไธสง"
      },
      {
        "code": "ส22102",
        "name": "ประวัติศาสตร์ 3",
        "type": "พื้นฐาน",
        "group": "สังคมศึกษาฯ (พื้นฐาน)",
        "credits": 0.5,
        "hours": 20,
        "teacher": "นายธิติวุฒิ เตยไธสง"
      },
      {
        "code": "พ22101",
        "name": "สุขศึกษาและพลศึกษา 3",
        "type": "พื้นฐาน",
        "group": "สุขศึกษาฯ (พื้นฐาน)",
        "credits": 1.0,
        "hours": 40,
        "teacher": "นางสาวอาริษา ฉิมสุพร"
      },
      {
        "code": "ศ22101",
        "name": "ศิลปะ 3",
        "type": "พื้นฐาน",
        "group": "ศิลปะ (พื้นฐาน)",
        "credits": 1.0,
        "hours": 40,
        "teacher": "นางสาวไอยรดา อาจจีน"
      },
      {
        "code": "ง22101",
        "name": "การงานอาชีพ 3",
        "type": "พื้นฐาน",
        "group": "การงานอาชีพฯ (พื้นฐาน)",
        "credits": 1.0,
        "hours": 40,
        "teacher": "นางสาวไอยรดา อาจจีน"
      },
      {
        "code": "อ22101",
        "name": "ภาษาอังกฤษ 3",
        "type": "พื้นฐาน",
        "group": "ภาษาต่างประเทศ (พื้นฐาน)",
        "credits": 1.5,
        "hours": 60,
        "teacher": "นายอรรถชัย แก้วเอี่ยม"
      },
      {
        "code": "ค22201",
        "name": "คณิตศาสตร์เพิ่มเติม 3",
        "type": "เพิ่มเติม",
        "group": "คณิตศาสตร์ (เพิ่มเติม)",
        "credits": 0.5,
        "hours": 20,
        "teacher": "นายพิศุทธิ์ เชาวลิตโรจน์"
      },
      {
        "code": "อ22201",
        "name": "ภาษาอังกฤษเพื่อการสื่อสาร 3",
        "type": "เพิ่มเติม",
        "group": "ภาษาต่างประเทศ (เพิ่มเติม)",
        "credits": 1.0,
        "hours": 40,
        "teacher": "นายอรรถชัย แก้วเอี่ยม"
      },
      {
        "code": "ง22201",
        "name": "ทักษะอาชีพ (งานเกษตรฯ)",
        "type": "เพิ่มเติม",
        "group": "การงานอาชีพฯ (เพิ่มเติม)",
        "credits": 1.0,
        "hours": 40,
        "teacher": "นายอนันตชัย เพ็ชรรี่"
      },
      {
        "code": "ว22103",
        "name": "วิทยาการคำนวณ 2",
        "type": "พื้นฐาน",
        "group": "วิทยาศาสตร์ฯ (เพิ่มเติม)",
        "credits": 0.5,
        "hours": 20,
        "teacher": "นายอนันตชัย เพ็ชรรี่"
      },
      {
        "code": "ว22104",
        "name": "การออกแบบและเทคโนโลยี 2",
        "type": "พื้นฐาน",
        "group": "วิทยาศาสตร์ฯ (เพิ่มเติม)",
        "credits": 0.5,
        "hours": 20,
        "teacher": "นายอนันตชัย เพ็ชรรี่"
      }
    ],
    "activities": [
      {
        "code": "ก21101",
        "name": "กิจกรรมแนะแนว",
        "hours": 20
      },
      {
        "code": "ก21102",
        "name": "กิจกรรมลูกเสือ / เนตรนารี",
        "hours": 20
      },
      {
        "code": "ก21103",
        "name": "กิจกรรมชุมนุม / ตลาดนัดอาชีพ",
        "hours": 20
      },
      {
        "code": "ก21104",
        "name": "กิจกรรมเพื่อสังคมและสาธารณประโยชน์",
        "hours": 10
      }
    ],
    "students": [
      {
        "no": 1,
        "code": "2402",
        "name": "เด็กชายพุทฒิพงศ์ คงโพธิ์น้อย",
        "gender": "male",
        "scores": {
          "ท22101": {
            "coursework": 58,
            "finalExam": 21,
            "total": 79,
            "grade": "3.5",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค22101": {
            "coursework": 58,
            "finalExam": 21,
            "total": 79,
            "grade": "3.5",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว22101": {
            "coursework": 55,
            "finalExam": 18,
            "total": 73,
            "grade": "3",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส22101": {
            "coursework": 56,
            "finalExam": 19,
            "total": 75,
            "grade": "3.5",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส22102": {
            "coursework": 60,
            "finalExam": 25,
            "total": 85,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ22101": {
            "coursework": 59,
            "finalExam": 23,
            "total": 82,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ22101": {
            "coursework": 58,
            "finalExam": 23,
            "total": 81,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง22101": {
            "coursework": 54,
            "finalExam": 30,
            "total": 84,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ22101": {
            "coursework": 57,
            "finalExam": 19,
            "total": 76,
            "grade": "3.5",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค22201": {
            "coursework": 54,
            "finalExam": 17,
            "total": 71,
            "grade": "3",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "อ22201": {
            "coursework": 60,
            "finalExam": 24,
            "total": 84,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง22201": {
            "coursework": 54,
            "finalExam": 30,
            "total": 84,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว22103": {
            "coursework": 54,
            "finalExam": 30,
            "total": 84,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว22104": {
            "coursework": 54,
            "finalExam": 30,
            "total": 84,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 2,
        "code": "2403",
        "name": "เด็กชายอินทัช นาหอม",
        "gender": "male",
        "scores": {
          "ท22101": {
            "coursework": 55,
            "finalExam": 23,
            "total": 78,
            "grade": "3.5",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค22101": {
            "coursework": 49,
            "finalExam": 15,
            "total": 64,
            "grade": "2",
            "attendedHours": 60,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ว22101": {
            "coursework": 53,
            "finalExam": 21,
            "total": 74,
            "grade": "3",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส22101": {
            "coursework": 55,
            "finalExam": 24,
            "total": 79,
            "grade": "3.5",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส22102": {
            "coursework": 52,
            "finalExam": 19,
            "total": 71,
            "grade": "3",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "พ22101": {
            "coursework": 55,
            "finalExam": 23,
            "total": 78,
            "grade": "3.5",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ22101": {
            "coursework": 50,
            "finalExam": 16,
            "total": 66,
            "grade": "2.5",
            "attendedHours": 40,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ง22101": {
            "coursework": 54,
            "finalExam": 30,
            "total": 84,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ22101": {
            "coursework": 51,
            "finalExam": 17,
            "total": 68,
            "grade": "2.5",
            "attendedHours": 60,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ค22201": {
            "coursework": 50,
            "finalExam": 17,
            "total": 67,
            "grade": "2.5",
            "attendedHours": 20,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "อ22201": {
            "coursework": 51,
            "finalExam": 17,
            "total": 68,
            "grade": "2.5",
            "attendedHours": 40,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ง22201": {
            "coursework": 54,
            "finalExam": 30,
            "total": 84,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว22103": {
            "coursework": 54,
            "finalExam": 30,
            "total": 84,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว22104": {
            "coursework": 54,
            "finalExam": 30,
            "total": 84,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดี",
        "readThinkResult": "ดี",
        "activityResult": "ผ่าน"
      },
      {
        "no": 3,
        "code": "2431",
        "name": "เด็กชายชัชพงษ์ วิจิตรปัญญา",
        "gender": "male",
        "scores": {
          "ท22101": {
            "coursework": 68,
            "finalExam": 27,
            "total": 95,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค22101": {
            "coursework": 64,
            "finalExam": 19,
            "total": 83,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว22101": {
            "coursework": 67,
            "finalExam": 24,
            "total": 91,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส22101": {
            "coursework": 67,
            "finalExam": 23,
            "total": 90,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส22102": {
            "coursework": 64,
            "finalExam": 19,
            "total": 83,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ22101": {
            "coursework": 66,
            "finalExam": 22,
            "total": 88,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ22101": {
            "coursework": 65,
            "finalExam": 20,
            "total": 85,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง22101": {
            "coursework": 56,
            "finalExam": 30,
            "total": 86,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ22101": {
            "coursework": 66,
            "finalExam": 21,
            "total": 87,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค22201": {
            "coursework": 67,
            "finalExam": 26,
            "total": 93,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ22201": {
            "coursework": 68,
            "finalExam": 28,
            "total": 96,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง22201": {
            "coursework": 56,
            "finalExam": 30,
            "total": 86,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว22103": {
            "coursework": 56,
            "finalExam": 30,
            "total": 86,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว22104": {
            "coursework": 56,
            "finalExam": 30,
            "total": 86,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 4,
        "code": "2535",
        "name": "เด็กชายพัชรกิตต์ ไทรงาม",
        "gender": "male",
        "scores": {
          "ท22101": {
            "coursework": 60,
            "finalExam": 19,
            "total": 79,
            "grade": "3.5",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค22101": {
            "coursework": 59,
            "finalExam": 18,
            "total": 77,
            "grade": "3.5",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว22101": {
            "coursework": 61,
            "finalExam": 23,
            "total": 84,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส22101": {
            "coursework": 62,
            "finalExam": 25,
            "total": 87,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส22102": {
            "coursework": 63,
            "finalExam": 27,
            "total": 90,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ22101": {
            "coursework": 58,
            "finalExam": 17,
            "total": 75,
            "grade": "3.5",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ22101": {
            "coursework": 62,
            "finalExam": 23,
            "total": 85,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง22101": {
            "coursework": 56,
            "finalExam": 30,
            "total": 86,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ22101": {
            "coursework": 61,
            "finalExam": 23,
            "total": 84,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค22201": {
            "coursework": 60,
            "finalExam": 22,
            "total": 82,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ22201": {
            "coursework": 59,
            "finalExam": 18,
            "total": 77,
            "grade": "3.5",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง22201": {
            "coursework": 56,
            "finalExam": 30,
            "total": 86,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว22103": {
            "coursework": 56,
            "finalExam": 30,
            "total": 86,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว22104": {
            "coursework": 56,
            "finalExam": 30,
            "total": 86,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 5,
        "code": "2547",
        "name": "เด็กชายกิตติทัต จันทะคุณ",
        "gender": "male",
        "scores": {
          "ท22101": {
            "coursework": 53,
            "finalExam": 21,
            "total": 74,
            "grade": "3",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค22101": {
            "coursework": 54,
            "finalExam": 20,
            "total": 74,
            "grade": "3",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว22101": {
            "coursework": 50,
            "finalExam": 17,
            "total": 67,
            "grade": "2.5",
            "attendedHours": 60,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ส22101": {
            "coursework": 55,
            "finalExam": 24,
            "total": 79,
            "grade": "3.5",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส22102": {
            "coursework": 50,
            "finalExam": 17,
            "total": 67,
            "grade": "2.5",
            "attendedHours": 20,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "พ22101": {
            "coursework": 52,
            "finalExam": 18,
            "total": 70,
            "grade": "3",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "ศ22101": {
            "coursework": 54,
            "finalExam": 22,
            "total": 76,
            "grade": "3.5",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง22101": {
            "coursework": 50,
            "finalExam": 22,
            "total": 72,
            "grade": "3",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ22101": {
            "coursework": 55,
            "finalExam": 23,
            "total": 78,
            "grade": "3.5",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค22201": {
            "coursework": 49,
            "finalExam": 15,
            "total": 64,
            "grade": "2",
            "attendedHours": 20,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "อ22201": {
            "coursework": 52,
            "finalExam": 18,
            "total": 70,
            "grade": "3",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "ง22201": {
            "coursework": 50,
            "finalExam": 22,
            "total": 72,
            "grade": "3",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว22103": {
            "coursework": 50,
            "finalExam": 22,
            "total": 72,
            "grade": "3",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว22104": {
            "coursework": 50,
            "finalExam": 22,
            "total": 72,
            "grade": "3",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดี",
        "readThinkResult": "ดี",
        "activityResult": "ผ่าน"
      },
      {
        "no": 6,
        "code": "2433",
        "name": "เด็กชายชัยณรงค์ เหระวัน",
        "gender": "male",
        "scores": {
          "ท22101": {
            "coursework": 57,
            "finalExam": 21,
            "total": 78,
            "grade": "3.5",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค22101": {
            "coursework": 55,
            "finalExam": 19,
            "total": 74,
            "grade": "3",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว22101": {
            "coursework": 55,
            "finalExam": 18,
            "total": 73,
            "grade": "3",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส22101": {
            "coursework": 59,
            "finalExam": 24,
            "total": 83,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส22102": {
            "coursework": 59,
            "finalExam": 24,
            "total": 83,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ22101": {
            "coursework": 58,
            "finalExam": 22,
            "total": 80,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ22101": {
            "coursework": 53,
            "finalExam": 16,
            "total": 69,
            "grade": "2.5",
            "attendedHours": 40,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ง22101": {
            "coursework": 49,
            "finalExam": 21,
            "total": 70,
            "grade": "3",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "อ22101": {
            "coursework": 55,
            "finalExam": 17,
            "total": 72,
            "grade": "3",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค22201": {
            "coursework": 57,
            "finalExam": 21,
            "total": 78,
            "grade": "3.5",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ22201": {
            "coursework": 54,
            "finalExam": 16,
            "total": 70,
            "grade": "3",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "ง22201": {
            "coursework": 49,
            "finalExam": 21,
            "total": 70,
            "grade": "3",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "ว22103": {
            "coursework": 49,
            "finalExam": 21,
            "total": 70,
            "grade": "3",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "ว22104": {
            "coursework": 49,
            "finalExam": 21,
            "total": 70,
            "grade": "3",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 2
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 7,
        "code": "3157",
        "name": "เด็กชายณัฐพล ดีพาชู",
        "gender": "male",
        "scores": {
          "ท22101": {
            "coursework": 50,
            "finalExam": 15,
            "total": 65,
            "grade": "2.5",
            "attendedHours": 60,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ค22101": {
            "coursework": 53,
            "finalExam": 19,
            "total": 72,
            "grade": "3",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว22101": {
            "coursework": 51,
            "finalExam": 16,
            "total": 67,
            "grade": "2.5",
            "attendedHours": 60,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ส22101": {
            "coursework": 57,
            "finalExam": 23,
            "total": 80,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส22102": {
            "coursework": 53,
            "finalExam": 18,
            "total": 71,
            "grade": "3",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "พ22101": {
            "coursework": 54,
            "finalExam": 20,
            "total": 74,
            "grade": "3",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ22101": {
            "coursework": 55,
            "finalExam": 21,
            "total": 76,
            "grade": "3.5",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง22101": {
            "coursework": 49,
            "finalExam": 22,
            "total": 71,
            "grade": "3",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "อ22101": {
            "coursework": 53,
            "finalExam": 19,
            "total": 72,
            "grade": "3",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค22201": {
            "coursework": 56,
            "finalExam": 23,
            "total": 79,
            "grade": "3.5",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ22201": {
            "coursework": 56,
            "finalExam": 24,
            "total": 80,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง22201": {
            "coursework": 49,
            "finalExam": 22,
            "total": 71,
            "grade": "3",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "ว22103": {
            "coursework": 49,
            "finalExam": 22,
            "total": 71,
            "grade": "3",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "ว22104": {
            "coursework": 49,
            "finalExam": 22,
            "total": 71,
            "grade": "3",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 2
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดี",
        "activityResult": "ผ่าน"
      },
      {
        "no": 8,
        "code": "3220",
        "name": "เด็กชายชูเดช พวงมาลี",
        "gender": "male",
        "scores": {
          "ท22101": {
            "coursework": 66,
            "finalExam": 25,
            "total": 91,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค22101": {
            "coursework": 67,
            "finalExam": 28,
            "total": 95,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว22101": {
            "coursework": 63,
            "finalExam": 20,
            "total": 83,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส22101": {
            "coursework": 63,
            "finalExam": 21,
            "total": 84,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส22102": {
            "coursework": 67,
            "finalExam": 27,
            "total": 94,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ22101": {
            "coursework": 65,
            "finalExam": 23,
            "total": 88,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ22101": {
            "coursework": 65,
            "finalExam": 24,
            "total": 89,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง22101": {
            "coursework": 55,
            "finalExam": 30,
            "total": 85,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ22101": {
            "coursework": 62,
            "finalExam": 20,
            "total": 82,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค22201": {
            "coursework": 67,
            "finalExam": 28,
            "total": 95,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ22201": {
            "coursework": 62,
            "finalExam": 19,
            "total": 81,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง22201": {
            "coursework": 55,
            "finalExam": 30,
            "total": 85,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว22103": {
            "coursework": 55,
            "finalExam": 30,
            "total": 85,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว22104": {
            "coursework": 55,
            "finalExam": 30,
            "total": 85,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 9,
        "code": "2421",
        "name": "เด็กชายพีรวัส เปกไธสง",
        "gender": "male",
        "scores": {
          "ท22101": {
            "coursework": 67,
            "finalExam": 25,
            "total": 92,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค22101": {
            "coursework": 63,
            "finalExam": 19,
            "total": 82,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว22101": {
            "coursework": 66,
            "finalExam": 24,
            "total": 90,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส22101": {
            "coursework": 66,
            "finalExam": 26,
            "total": 92,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส22102": {
            "coursework": 66,
            "finalExam": 24,
            "total": 90,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ22101": {
            "coursework": 63,
            "finalExam": 20,
            "total": 83,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ22101": {
            "coursework": 66,
            "finalExam": 25,
            "total": 91,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง22101": {
            "coursework": 47,
            "finalExam": 23,
            "total": 70,
            "grade": "3",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "อ22101": {
            "coursework": 65,
            "finalExam": 23,
            "total": 88,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค22201": {
            "coursework": 65,
            "finalExam": 22,
            "total": 87,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ22201": {
            "coursework": 64,
            "finalExam": 20,
            "total": 84,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง22201": {
            "coursework": 47,
            "finalExam": 23,
            "total": 70,
            "grade": "3",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "ว22103": {
            "coursework": 47,
            "finalExam": 23,
            "total": 70,
            "grade": "3",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "ว22104": {
            "coursework": 47,
            "finalExam": 23,
            "total": 70,
            "grade": "3",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 2
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 10,
        "code": "2405",
        "name": "เด็กหญิงกัญญารัตน์ แก้วมณี",
        "gender": "female",
        "scores": {
          "ท22101": {
            "coursework": 62,
            "finalExam": 26,
            "total": 88,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค22101": {
            "coursework": 57,
            "finalExam": 19,
            "total": 76,
            "grade": "3.5",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว22101": {
            "coursework": 57,
            "finalExam": 18,
            "total": 75,
            "grade": "3.5",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส22101": {
            "coursework": 60,
            "finalExam": 22,
            "total": 82,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส22102": {
            "coursework": 61,
            "finalExam": 25,
            "total": 86,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ22101": {
            "coursework": 61,
            "finalExam": 24,
            "total": 85,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ22101": {
            "coursework": 59,
            "finalExam": 21,
            "total": 80,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง22101": {
            "coursework": 49,
            "finalExam": 21,
            "total": 70,
            "grade": "3",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "อ22101": {
            "coursework": 61,
            "finalExam": 24,
            "total": 85,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค22201": {
            "coursework": 57,
            "finalExam": 18,
            "total": 75,
            "grade": "3.5",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ22201": {
            "coursework": 61,
            "finalExam": 24,
            "total": 85,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง22201": {
            "coursework": 49,
            "finalExam": 21,
            "total": 70,
            "grade": "3",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "ว22103": {
            "coursework": 49,
            "finalExam": 21,
            "total": 70,
            "grade": "3",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "ว22104": {
            "coursework": 49,
            "finalExam": 21,
            "total": 70,
            "grade": "3",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 2
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 11,
        "code": "2541",
        "name": "เด็กหญิงเพ็ญพิชชา หมู่ทอง",
        "gender": "female",
        "scores": {
          "ท22101": {
            "coursework": 66,
            "finalExam": 24,
            "total": 90,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค22101": {
            "coursework": 66,
            "finalExam": 25,
            "total": 91,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว22101": {
            "coursework": 66,
            "finalExam": 24,
            "total": 90,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส22101": {
            "coursework": 65,
            "finalExam": 22,
            "total": 87,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส22102": {
            "coursework": 66,
            "finalExam": 23,
            "total": 89,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ22101": {
            "coursework": 64,
            "finalExam": 20,
            "total": 84,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ22101": {
            "coursework": 63,
            "finalExam": 20,
            "total": 83,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง22101": {
            "coursework": 58,
            "finalExam": 18,
            "total": 76,
            "grade": "3.5",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ22101": {
            "coursework": 68,
            "finalExam": 28,
            "total": 96,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค22201": {
            "coursework": 66,
            "finalExam": 26,
            "total": 92,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ22201": {
            "coursework": 62,
            "finalExam": 19,
            "total": 81,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง22201": {
            "coursework": 58,
            "finalExam": 18,
            "total": 76,
            "grade": "3.5",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว22103": {
            "coursework": 58,
            "finalExam": 18,
            "total": 76,
            "grade": "3.5",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว22104": {
            "coursework": 58,
            "finalExam": 18,
            "total": 76,
            "grade": "3.5",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 12,
        "code": "2832",
        "name": "เด็กหญิงศิรญา เปี่ยมใจ",
        "gender": "female",
        "scores": {
          "ท22101": {
            "coursework": 50,
            "finalExam": 18,
            "total": 68,
            "grade": "2.5",
            "attendedHours": 60,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ค22101": {
            "coursework": 52,
            "finalExam": 21,
            "total": 73,
            "grade": "3",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว22101": {
            "coursework": 50,
            "finalExam": 19,
            "total": 69,
            "grade": "2.5",
            "attendedHours": 60,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ส22101": {
            "coursework": 52,
            "finalExam": 21,
            "total": 73,
            "grade": "3",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส22102": {
            "coursework": 46,
            "finalExam": 14,
            "total": 60,
            "grade": "2",
            "attendedHours": 20,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "พ22101": {
            "coursework": 47,
            "finalExam": 15,
            "total": 62,
            "grade": "2",
            "attendedHours": 40,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ศ22101": {
            "coursework": 52,
            "finalExam": 21,
            "total": 73,
            "grade": "3",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง22101": {
            "coursework": 61,
            "finalExam": 30,
            "total": 91,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ22101": {
            "coursework": 50,
            "finalExam": 18,
            "total": 68,
            "grade": "2.5",
            "attendedHours": 60,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ค22201": {
            "coursework": 52,
            "finalExam": 20,
            "total": 72,
            "grade": "3",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ22201": {
            "coursework": 52,
            "finalExam": 20,
            "total": 72,
            "grade": "3",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง22201": {
            "coursework": 61,
            "finalExam": 30,
            "total": 91,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว22103": {
            "coursework": 61,
            "finalExam": 30,
            "total": 91,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว22104": {
            "coursework": 61,
            "finalExam": 30,
            "total": 91,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดี",
        "readThinkResult": "ดี",
        "activityResult": "ผ่าน"
      },
      {
        "no": 13,
        "code": "2404",
        "name": "เด็กหญิงธันย์ชนก โพธิ์มณี",
        "gender": "female",
        "scores": {
          "ท22101": {
            "coursework": 63,
            "finalExam": 22,
            "total": 85,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค22101": {
            "coursework": 62,
            "finalExam": 18,
            "total": 80,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว22101": {
            "coursework": 64,
            "finalExam": 22,
            "total": 86,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส22101": {
            "coursework": 64,
            "finalExam": 23,
            "total": 87,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส22102": {
            "coursework": 62,
            "finalExam": 19,
            "total": 81,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ22101": {
            "coursework": 65,
            "finalExam": 25,
            "total": 90,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ22101": {
            "coursework": 65,
            "finalExam": 24,
            "total": 89,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง22101": {
            "coursework": 61,
            "finalExam": 30,
            "total": 91,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ22101": {
            "coursework": 67,
            "finalExam": 27,
            "total": 94,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค22201": {
            "coursework": 62,
            "finalExam": 19,
            "total": 81,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ22201": {
            "coursework": 63,
            "finalExam": 19,
            "total": 82,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง22201": {
            "coursework": 61,
            "finalExam": 30,
            "total": 91,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว22103": {
            "coursework": 61,
            "finalExam": 30,
            "total": 91,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว22104": {
            "coursework": 61,
            "finalExam": 30,
            "total": 91,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 14,
        "code": "3202",
        "name": "เด็กหญิงสุวภัทร ตลับทอง",
        "gender": "female",
        "scores": {
          "ท22101": {
            "coursework": 50,
            "finalExam": 17,
            "total": 67,
            "grade": "2.5",
            "attendedHours": 60,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ค22101": {
            "coursework": 49,
            "finalExam": 16,
            "total": 65,
            "grade": "2.5",
            "attendedHours": 60,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ว22101": {
            "coursework": 54,
            "finalExam": 23,
            "total": 77,
            "grade": "3.5",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส22101": {
            "coursework": 55,
            "finalExam": 23,
            "total": 78,
            "grade": "3.5",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส22102": {
            "coursework": 54,
            "finalExam": 23,
            "total": 77,
            "grade": "3.5",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ22101": {
            "coursework": 50,
            "finalExam": 17,
            "total": 67,
            "grade": "2.5",
            "attendedHours": 40,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ศ22101": {
            "coursework": 50,
            "finalExam": 16,
            "total": 66,
            "grade": "2.5",
            "attendedHours": 40,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ง22101": {
            "coursework": 40,
            "finalExam": 20,
            "total": 60,
            "grade": "2",
            "attendedHours": 40,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "อ22101": {
            "coursework": 50,
            "finalExam": 16,
            "total": 66,
            "grade": "2.5",
            "attendedHours": 60,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ค22201": {
            "coursework": 54,
            "finalExam": 22,
            "total": 76,
            "grade": "3.5",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ22201": {
            "coursework": 54,
            "finalExam": 22,
            "total": 76,
            "grade": "3.5",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง22201": {
            "coursework": 40,
            "finalExam": 20,
            "total": 60,
            "grade": "2",
            "attendedHours": 40,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ว22103": {
            "coursework": 40,
            "finalExam": 20,
            "total": 60,
            "grade": "2",
            "attendedHours": 20,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ว22104": {
            "coursework": 40,
            "finalExam": 20,
            "total": 60,
            "grade": "2",
            "attendedHours": 20,
            "traitScore": 2,
            "readThinkScore": 2
          }
        },
        "traitResult": "ดี",
        "readThinkResult": "ดี",
        "activityResult": "ผ่าน"
      }
    ]
  },
  {
    "classId": "m3",
    "shortName": "ม.3",
    "className": "มัธยมศึกษาปีที่ 3",
    "level": "มัธยม",
    "room": 1,
    "semester": "1",
    "year": "2569",
    "schoolName": "โรงเรียนบ้านคลองมดแดง",
    "affiliation": "สำนักงานเขตพื้นที่การศึกษาประถมศึกษากำแพงเพชร เขต 2",
    "director": "นายปรัชญา ปรางค์ชัยภูมิ",
    "homeroomTeachers": [
      "นางสาวนริศรา ทำจิตรเหมาะ",
      "นายธิติวุฒิ เตยไธสง"
    ],
    "subjects": [
      {
        "code": "ท23101",
        "name": "ภาษาไทย 5",
        "type": "พื้นฐาน",
        "group": "ภาษาไทย (พื้นฐาน)",
        "credits": 1.5,
        "hours": 60,
        "teacher": "นางสาวจิราภา พานชัย"
      },
      {
        "code": "ค23101",
        "name": "คณิตศาสตร์ 5",
        "type": "พื้นฐาน",
        "group": "คณิตศาสตร์ (พื้นฐาน)",
        "credits": 1.5,
        "hours": 60,
        "teacher": "นายพิศุทธิ์ เชาวลิตโรจน์"
      },
      {
        "code": "ว23101",
        "name": "วิทยาศาสตร์และเทคโนโลยี 5",
        "type": "พื้นฐาน",
        "group": "วิทยาศาสตร์ฯ (พื้นฐาน)",
        "credits": 1.5,
        "hours": 60,
        "teacher": "นายพิศุทธิ์ เชาวลิตโรจน์"
      },
      {
        "code": "ส23101",
        "name": "สังคมศึกษา ศาสนาและวัฒนธรรม 5",
        "type": "พื้นฐาน",
        "group": "สังคมศึกษาฯ (พื้นฐาน)",
        "credits": 1.5,
        "hours": 60,
        "teacher": "นายธิติวุฒิ เตยไธสง"
      },
      {
        "code": "ส23102",
        "name": "ประวัติศาสตร์ 5",
        "type": "พื้นฐาน",
        "group": "สังคมศึกษาฯ (พื้นฐาน)",
        "credits": 0.5,
        "hours": 20,
        "teacher": "นายธิติวุฒิ เตยไธสง"
      },
      {
        "code": "พ23101",
        "name": "สุขศึกษาและพลศึกษา 5",
        "type": "พื้นฐาน",
        "group": "สุขศึกษาฯ (พื้นฐาน)",
        "credits": 1.0,
        "hours": 40,
        "teacher": "นางสาวอาริษา ฉิมสุพร"
      },
      {
        "code": "ศ23101",
        "name": "ศิลปะ 5",
        "type": "พื้นฐาน",
        "group": "ศิลปะ (พื้นฐาน)",
        "credits": 1.0,
        "hours": 40,
        "teacher": "นางสาวไอยรดา อาจจีน"
      },
      {
        "code": "ง23101",
        "name": "การงานอาชีพ 5",
        "type": "พื้นฐาน",
        "group": "การงานอาชีพฯ (พื้นฐาน)",
        "credits": 1.0,
        "hours": 40,
        "teacher": "นางสาวนริศรา ทำจิตรเหมาะ"
      },
      {
        "code": "อ23101",
        "name": "ภาษาอังกฤษ 5",
        "type": "พื้นฐาน",
        "group": "ภาษาต่างประเทศ (พื้นฐาน)",
        "credits": 1.5,
        "hours": 60,
        "teacher": "นายอรรถชัย แก้วเอี่ยม"
      },
      {
        "code": "ค23201",
        "name": "คณิตศาสตร์เพิ่มเติม 5",
        "type": "เพิ่มเติม",
        "group": "คณิตศาสตร์ (เพิ่มเติม)",
        "credits": 0.5,
        "hours": 20,
        "teacher": "นายพิศุทธิ์ เชาวลิตโรจน์"
      },
      {
        "code": "อ23201",
        "name": "ภาษาอังกฤษเพื่อการสื่อสาร 5",
        "type": "เพิ่มเติม",
        "group": "ภาษาต่างประเทศ (เพิ่มเติม)",
        "credits": 1.0,
        "hours": 40,
        "teacher": "นายอรรถชัย แก้วเอี่ยม"
      },
      {
        "code": "ง23201",
        "name": "ทักษะอาชีพ (งานเกษตรฯ)",
        "type": "เพิ่มเติม",
        "group": "การงานอาชีพฯ (เพิ่มเติม)",
        "credits": 1.0,
        "hours": 40,
        "teacher": "นางสาวอาริษา ฉิมสุพร"
      },
      {
        "code": "ว23103",
        "name": "วิทยาการคำนวณ 3",
        "type": "พื้นฐาน",
        "group": "วิทยาศาสตร์ฯ (เพิ่มเติม)",
        "credits": 0.5,
        "hours": 20,
        "teacher": "นายอนันตชัย เพ็ชรรี่"
      },
      {
        "code": "ว23104",
        "name": "การออกแบบและเทคโนโลยี 3",
        "type": "พื้นฐาน",
        "group": "วิทยาศาสตร์ฯ (เพิ่มเติม)",
        "credits": 0.5,
        "hours": 20,
        "teacher": "นายอนันตชัย เพ็ชรรี่"
      }
    ],
    "activities": [
      {
        "code": "ก21101",
        "name": "กิจกรรมแนะแนว",
        "hours": 20
      },
      {
        "code": "ก21102",
        "name": "กิจกรรมลูกเสือ / เนตรนารี",
        "hours": 20
      },
      {
        "code": "ก21103",
        "name": "กิจกรรมชุมนุม / ตลาดนัดอาชีพ",
        "hours": 20
      },
      {
        "code": "ก21104",
        "name": "กิจกรรมเพื่อสังคมและสาธารณประโยชน์",
        "hours": 10
      }
    ],
    "students": [
      {
        "no": 1,
        "code": "2259",
        "name": "เด็กชายหิน หมื่นหาญ",
        "gender": "male",
        "scores": {
          "ท23101": {
            "coursework": 54,
            "finalExam": 21,
            "total": 75,
            "grade": "3.5",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค23101": {
            "coursework": 53,
            "finalExam": 19,
            "total": 72,
            "grade": "3",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว23101": {
            "coursework": 51,
            "finalExam": 17,
            "total": 68,
            "grade": "2.5",
            "attendedHours": 60,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ส23101": {
            "coursework": 55,
            "finalExam": 23,
            "total": 78,
            "grade": "3.5",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส23102": {
            "coursework": 53,
            "finalExam": 20,
            "total": 73,
            "grade": "3",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ23101": {
            "coursework": 48,
            "finalExam": 15,
            "total": 63,
            "grade": "2",
            "attendedHours": 40,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ศ23101": {
            "coursework": 52,
            "finalExam": 18,
            "total": 70,
            "grade": "3",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "ง23101": {
            "coursework": 53,
            "finalExam": 19,
            "total": 72,
            "grade": "3",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ23101": {
            "coursework": 51,
            "finalExam": 16,
            "total": 67,
            "grade": "2.5",
            "attendedHours": 60,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ค23201": {
            "coursework": 51,
            "finalExam": 18,
            "total": 69,
            "grade": "2.5",
            "attendedHours": 20,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "อ23201": {
            "coursework": 53,
            "finalExam": 19,
            "total": 72,
            "grade": "3",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง23201": {
            "coursework": 52,
            "finalExam": 19,
            "total": 71,
            "grade": "3",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "ว23103": {
            "coursework": 45,
            "finalExam": 6,
            "total": 51,
            "grade": "1",
            "attendedHours": 20,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ว23104": {
            "coursework": 45,
            "finalExam": 6,
            "total": 51,
            "grade": "1",
            "attendedHours": 20,
            "traitScore": 2,
            "readThinkScore": 2
          }
        },
        "traitResult": "ดี",
        "readThinkResult": "ดี",
        "activityResult": "ผ่าน"
      },
      {
        "no": 2,
        "code": "2283",
        "name": "เด็กชายชาญชัย สุขจิตร",
        "gender": "male",
        "scores": {
          "ท23101": {
            "coursework": 55,
            "finalExam": 22,
            "total": 77,
            "grade": "3.5",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค23101": {
            "coursework": 53,
            "finalExam": 19,
            "total": 72,
            "grade": "3",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว23101": {
            "coursework": 53,
            "finalExam": 19,
            "total": 72,
            "grade": "3",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส23101": {
            "coursework": 52,
            "finalExam": 18,
            "total": 70,
            "grade": "3",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "ส23102": {
            "coursework": 51,
            "finalExam": 17,
            "total": 68,
            "grade": "2.5",
            "attendedHours": 20,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "พ23101": {
            "coursework": 51,
            "finalExam": 18,
            "total": 69,
            "grade": "2.5",
            "attendedHours": 40,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ศ23101": {
            "coursework": 53,
            "finalExam": 21,
            "total": 74,
            "grade": "3",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง23101": {
            "coursework": 52,
            "finalExam": 19,
            "total": 71,
            "grade": "3",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "อ23101": {
            "coursework": 49,
            "finalExam": 15,
            "total": 64,
            "grade": "2",
            "attendedHours": 60,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ค23201": {
            "coursework": 52,
            "finalExam": 18,
            "total": 70,
            "grade": "3",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "อ23201": {
            "coursework": 50,
            "finalExam": 15,
            "total": 65,
            "grade": "2.5",
            "attendedHours": 40,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ง23201": {
            "coursework": 52,
            "finalExam": 19,
            "total": 71,
            "grade": "3",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "ว23103": {
            "coursework": 45,
            "finalExam": 6,
            "total": 51,
            "grade": "1",
            "attendedHours": 20,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ว23104": {
            "coursework": 45,
            "finalExam": 6,
            "total": 51,
            "grade": "1",
            "attendedHours": 20,
            "traitScore": 2,
            "readThinkScore": 2
          }
        },
        "traitResult": "ดี",
        "readThinkResult": "ดี",
        "activityResult": "ผ่าน"
      },
      {
        "no": 3,
        "code": "2285",
        "name": "เด็กชายณัฐวุฒิ รื่นจิตร",
        "gender": "male",
        "scores": {
          "ท23101": {
            "coursework": 57,
            "finalExam": 17,
            "total": 74,
            "grade": "3",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค23101": {
            "coursework": 59,
            "finalExam": 20,
            "total": 79,
            "grade": "3.5",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว23101": {
            "coursework": 58,
            "finalExam": 19,
            "total": 77,
            "grade": "3.5",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส23101": {
            "coursework": 56,
            "finalExam": 17,
            "total": 73,
            "grade": "3",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส23102": {
            "coursework": 59,
            "finalExam": 22,
            "total": 81,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ23101": {
            "coursework": 58,
            "finalExam": 19,
            "total": 77,
            "grade": "3.5",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ23101": {
            "coursework": 62,
            "finalExam": 26,
            "total": 88,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง23101": {
            "coursework": 60,
            "finalExam": 22,
            "total": 82,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ23101": {
            "coursework": 61,
            "finalExam": 23,
            "total": 84,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค23201": {
            "coursework": 58,
            "finalExam": 20,
            "total": 78,
            "grade": "3.5",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ23201": {
            "coursework": 61,
            "finalExam": 25,
            "total": 86,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง23201": {
            "coursework": 57,
            "finalExam": 18,
            "total": 75,
            "grade": "3.5",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว23103": {
            "coursework": 47,
            "finalExam": 4,
            "total": 51,
            "grade": "1",
            "attendedHours": 20,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ว23104": {
            "coursework": 47,
            "finalExam": 4,
            "total": 51,
            "grade": "1",
            "attendedHours": 20,
            "traitScore": 2,
            "readThinkScore": 2
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 4,
        "code": "2407",
        "name": "เด็กชายอภิชัย ปูตือ",
        "gender": "male",
        "scores": {
          "ท23101": {
            "coursework": 66,
            "finalExam": 21,
            "total": 87,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค23101": {
            "coursework": 66,
            "finalExam": 22,
            "total": 88,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว23101": {
            "coursework": 68,
            "finalExam": 28,
            "total": 96,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส23101": {
            "coursework": 67,
            "finalExam": 29,
            "total": 96,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส23102": {
            "coursework": 68,
            "finalExam": 28,
            "total": 96,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ23101": {
            "coursework": 67,
            "finalExam": 24,
            "total": 91,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ23101": {
            "coursework": 68,
            "finalExam": 28,
            "total": 96,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง23101": {
            "coursework": 67,
            "finalExam": 24,
            "total": 91,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ23101": {
            "coursework": 67,
            "finalExam": 23,
            "total": 90,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค23201": {
            "coursework": 67,
            "finalExam": 29,
            "total": 96,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ23201": {
            "coursework": 68,
            "finalExam": 28,
            "total": 96,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง23201": {
            "coursework": 68,
            "finalExam": 26,
            "total": 94,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว23103": {
            "coursework": 55,
            "finalExam": 20,
            "total": 75,
            "grade": "3.5",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว23104": {
            "coursework": 55,
            "finalExam": 20,
            "total": 75,
            "grade": "3.5",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 5,
        "code": "2406",
        "name": "เด็กชายธิวากร สุราบุตร์",
        "gender": "male",
        "scores": {
          "ท23101": {
            "coursework": 53,
            "finalExam": 17,
            "total": 70,
            "grade": "3",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "ค23101": {
            "coursework": 52,
            "finalExam": 16,
            "total": 68,
            "grade": "2.5",
            "attendedHours": 60,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ว23101": {
            "coursework": 57,
            "finalExam": 24,
            "total": 81,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส23101": {
            "coursework": 54,
            "finalExam": 18,
            "total": 72,
            "grade": "3",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส23102": {
            "coursework": 53,
            "finalExam": 18,
            "total": 71,
            "grade": "3",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "พ23101": {
            "coursework": 52,
            "finalExam": 16,
            "total": 68,
            "grade": "2.5",
            "attendedHours": 40,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ศ23101": {
            "coursework": 54,
            "finalExam": 20,
            "total": 74,
            "grade": "3",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง23101": {
            "coursework": 54,
            "finalExam": 20,
            "total": 74,
            "grade": "3",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ23101": {
            "coursework": 56,
            "finalExam": 23,
            "total": 79,
            "grade": "3.5",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค23201": {
            "coursework": 52,
            "finalExam": 16,
            "total": 68,
            "grade": "2.5",
            "attendedHours": 20,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "อ23201": {
            "coursework": 55,
            "finalExam": 21,
            "total": 76,
            "grade": "3.5",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง23201": {
            "coursework": 57,
            "finalExam": 24,
            "total": 81,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว23103": {
            "coursework": 66,
            "finalExam": 28,
            "total": 94,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว23104": {
            "coursework": 67,
            "finalExam": 28,
            "total": 95,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 6,
        "code": "2409",
        "name": "เด็กชายอดิเทพ หมู่ทอง",
        "gender": "male",
        "scores": {
          "ท23101": {
            "coursework": 55,
            "finalExam": 19,
            "total": 74,
            "grade": "3",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค23101": {
            "coursework": 54,
            "finalExam": 16,
            "total": 70,
            "grade": "3",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "ว23101": {
            "coursework": 54,
            "finalExam": 18,
            "total": 72,
            "grade": "3",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส23101": {
            "coursework": 57,
            "finalExam": 20,
            "total": 77,
            "grade": "3.5",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส23102": {
            "coursework": 57,
            "finalExam": 20,
            "total": 77,
            "grade": "3.5",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ23101": {
            "coursework": 56,
            "finalExam": 19,
            "total": 75,
            "grade": "3.5",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ23101": {
            "coursework": 57,
            "finalExam": 22,
            "total": 79,
            "grade": "3.5",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง23101": {
            "coursework": 53,
            "finalExam": 16,
            "total": 69,
            "grade": "2.5",
            "attendedHours": 40,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "อ23101": {
            "coursework": 54,
            "finalExam": 18,
            "total": 72,
            "grade": "3",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค23201": {
            "coursework": 58,
            "finalExam": 23,
            "total": 81,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ23201": {
            "coursework": 57,
            "finalExam": 20,
            "total": 77,
            "grade": "3.5",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง23201": {
            "coursework": 56,
            "finalExam": 19,
            "total": 75,
            "grade": "3.5",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว23103": {
            "coursework": 66,
            "finalExam": 28,
            "total": 94,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว23104": {
            "coursework": 67,
            "finalExam": 28,
            "total": 95,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 7,
        "code": "2408",
        "name": "นายก้องภพ แสงทองศรี",
        "gender": "male",
        "scores": {
          "ท23101": {
            "coursework": 61,
            "finalExam": 21,
            "total": 82,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค23101": {
            "coursework": 61,
            "finalExam": 20,
            "total": 81,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว23101": {
            "coursework": 61,
            "finalExam": 22,
            "total": 83,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส23101": {
            "coursework": 63,
            "finalExam": 24,
            "total": 87,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส23102": {
            "coursework": 58,
            "finalExam": 18,
            "total": 76,
            "grade": "3.5",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ23101": {
            "coursework": 59,
            "finalExam": 18,
            "total": 77,
            "grade": "3.5",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ23101": {
            "coursework": 59,
            "finalExam": 18,
            "total": 77,
            "grade": "3.5",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง23101": {
            "coursework": 62,
            "finalExam": 23,
            "total": 85,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ23101": {
            "coursework": 61,
            "finalExam": 21,
            "total": 82,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค23201": {
            "coursework": 59,
            "finalExam": 19,
            "total": 78,
            "grade": "3.5",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ23201": {
            "coursework": 62,
            "finalExam": 24,
            "total": 86,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง23201": {
            "coursework": 65,
            "finalExam": 27,
            "total": 92,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว23103": {
            "coursework": 66,
            "finalExam": 29,
            "total": 95,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว23104": {
            "coursework": 66,
            "finalExam": 29,
            "total": 95,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 8,
        "code": "2410",
        "name": "นายมนชิต รักกลิ่น",
        "gender": "male",
        "scores": {
          "ท23101": {
            "coursework": 49,
            "finalExam": 16,
            "total": 65,
            "grade": "2.5",
            "attendedHours": 60,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ค23101": {
            "coursework": 48,
            "finalExam": 15,
            "total": 63,
            "grade": "2",
            "attendedHours": 60,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ว23101": {
            "coursework": 51,
            "finalExam": 19,
            "total": 70,
            "grade": "3",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "ส23101": {
            "coursework": 52,
            "finalExam": 20,
            "total": 72,
            "grade": "3",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส23102": {
            "coursework": 49,
            "finalExam": 15,
            "total": 64,
            "grade": "2",
            "attendedHours": 20,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "พ23101": {
            "coursework": 52,
            "finalExam": 20,
            "total": 72,
            "grade": "3",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ23101": {
            "coursework": 48,
            "finalExam": 15,
            "total": 63,
            "grade": "2",
            "attendedHours": 40,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ง23101": {
            "coursework": 50,
            "finalExam": 18,
            "total": 68,
            "grade": "2.5",
            "attendedHours": 40,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "อ23101": {
            "coursework": 54,
            "finalExam": 23,
            "total": 77,
            "grade": "3.5",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค23201": {
            "coursework": 48,
            "finalExam": 14,
            "total": 62,
            "grade": "2",
            "attendedHours": 20,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "อ23201": {
            "coursework": 52,
            "finalExam": 18,
            "total": 70,
            "grade": "3",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "ง23201": {
            "coursework": 51,
            "finalExam": 18,
            "total": 69,
            "grade": "2.5",
            "attendedHours": 40,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ว23103": {
            "coursework": 70,
            "finalExam": 30,
            "total": 100,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว23104": {
            "coursework": 70,
            "finalExam": 30,
            "total": 100,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดี",
        "readThinkResult": "ดี",
        "activityResult": "ผ่าน"
      },
      {
        "no": 9,
        "code": "2542",
        "name": "เด็กชายกมลภพ วัฒนศิริ",
        "gender": "male",
        "scores": {
          "ท23101": {
            "coursework": 62,
            "finalExam": 24,
            "total": 86,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค23101": {
            "coursework": 61,
            "finalExam": 24,
            "total": 85,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว23101": {
            "coursework": 58,
            "finalExam": 18,
            "total": 76,
            "grade": "3.5",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส23101": {
            "coursework": 63,
            "finalExam": 25,
            "total": 88,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส23102": {
            "coursework": 63,
            "finalExam": 26,
            "total": 89,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ23101": {
            "coursework": 60,
            "finalExam": 21,
            "total": 81,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ23101": {
            "coursework": 59,
            "finalExam": 21,
            "total": 80,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง23101": {
            "coursework": 61,
            "finalExam": 23,
            "total": 84,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ23101": {
            "coursework": 59,
            "finalExam": 21,
            "total": 80,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค23201": {
            "coursework": 60,
            "finalExam": 21,
            "total": 81,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ23201": {
            "coursework": 58,
            "finalExam": 19,
            "total": 77,
            "grade": "3.5",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง23201": {
            "coursework": 62,
            "finalExam": 25,
            "total": 87,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว23103": {
            "coursework": 58,
            "finalExam": 20,
            "total": 78,
            "grade": "3.5",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว23104": {
            "coursework": 58,
            "finalExam": 20,
            "total": 78,
            "grade": "3.5",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 10,
        "code": "2910",
        "name": "เด็กชายวงศกร เฟื่องจันทร์",
        "gender": "male",
        "scores": {
          "ท23101": {
            "coursework": 54,
            "finalExam": 20,
            "total": 74,
            "grade": "3",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค23101": {
            "coursework": 56,
            "finalExam": 23,
            "total": 79,
            "grade": "3.5",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว23101": {
            "coursework": 52,
            "finalExam": 17,
            "total": 69,
            "grade": "2.5",
            "attendedHours": 60,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ส23101": {
            "coursework": 57,
            "finalExam": 24,
            "total": 81,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส23102": {
            "coursework": 52,
            "finalExam": 16,
            "total": 68,
            "grade": "2.5",
            "attendedHours": 20,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "พ23101": {
            "coursework": 55,
            "finalExam": 21,
            "total": 76,
            "grade": "3.5",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ23101": {
            "coursework": 56,
            "finalExam": 23,
            "total": 79,
            "grade": "3.5",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง23101": {
            "coursework": 56,
            "finalExam": 23,
            "total": 79,
            "grade": "3.5",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ23101": {
            "coursework": 54,
            "finalExam": 19,
            "total": 73,
            "grade": "3",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค23201": {
            "coursework": 57,
            "finalExam": 23,
            "total": 80,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ23201": {
            "coursework": 57,
            "finalExam": 24,
            "total": 81,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง23201": {
            "coursework": 53,
            "finalExam": 18,
            "total": 71,
            "grade": "3",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "ว23103": {
            "coursework": 48,
            "finalExam": 5,
            "total": 53,
            "grade": "1",
            "attendedHours": 20,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ว23104": {
            "coursework": 48,
            "finalExam": 5,
            "total": 53,
            "grade": "1",
            "attendedHours": 20,
            "traitScore": 2,
            "readThinkScore": 2
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 11,
        "code": "2261",
        "name": "เด็กหญิงพรชิตา ดันบิน",
        "gender": "female",
        "scores": {
          "ท23101": {
            "coursework": 60,
            "finalExam": 23,
            "total": 83,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค23101": {
            "coursework": 59,
            "finalExam": 21,
            "total": 80,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว23101": {
            "coursework": 61,
            "finalExam": 24,
            "total": 85,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส23101": {
            "coursework": 58,
            "finalExam": 20,
            "total": 78,
            "grade": "3.5",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส23102": {
            "coursework": 60,
            "finalExam": 23,
            "total": 83,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ23101": {
            "coursework": 60,
            "finalExam": 22,
            "total": 82,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ23101": {
            "coursework": 58,
            "finalExam": 20,
            "total": 78,
            "grade": "3.5",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง23101": {
            "coursework": 59,
            "finalExam": 21,
            "total": 80,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ23101": {
            "coursework": 57,
            "finalExam": 18,
            "total": 75,
            "grade": "3.5",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค23201": {
            "coursework": 62,
            "finalExam": 27,
            "total": 89,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ23201": {
            "coursework": 60,
            "finalExam": 23,
            "total": 83,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง23201": {
            "coursework": 58,
            "finalExam": 18,
            "total": 76,
            "grade": "3.5",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว23103": {
            "coursework": 66,
            "finalExam": 29,
            "total": 95,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว23104": {
            "coursework": 66,
            "finalExam": 29,
            "total": 95,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 12,
        "code": "2260",
        "name": "เด็กหญิงกัญญาพัชร ขัดสี",
        "gender": "female",
        "scores": {
          "ท23101": {
            "coursework": 65,
            "finalExam": 25,
            "total": 90,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค23101": {
            "coursework": 65,
            "finalExam": 24,
            "total": 89,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว23101": {
            "coursework": 63,
            "finalExam": 21,
            "total": 84,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส23101": {
            "coursework": 66,
            "finalExam": 25,
            "total": 91,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส23102": {
            "coursework": 66,
            "finalExam": 28,
            "total": 94,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ23101": {
            "coursework": 65,
            "finalExam": 25,
            "total": 90,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ23101": {
            "coursework": 63,
            "finalExam": 20,
            "total": 83,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง23101": {
            "coursework": 63,
            "finalExam": 20,
            "total": 83,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ23101": {
            "coursework": 64,
            "finalExam": 23,
            "total": 87,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค23201": {
            "coursework": 62,
            "finalExam": 19,
            "total": 81,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ23201": {
            "coursework": 62,
            "finalExam": 19,
            "total": 81,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง23201": {
            "coursework": 66,
            "finalExam": 26,
            "total": 92,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว23103": {
            "coursework": 66,
            "finalExam": 28,
            "total": 94,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว23104": {
            "coursework": 67,
            "finalExam": 28,
            "total": 95,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 13,
        "code": "2278",
        "name": "เด็กหญิงสรัญญา วิจิตรปัญญา",
        "gender": "female",
        "scores": {
          "ท23101": {
            "coursework": 62,
            "finalExam": 26,
            "total": 88,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค23101": {
            "coursework": 62,
            "finalExam": 24,
            "total": 86,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว23101": {
            "coursework": 61,
            "finalExam": 24,
            "total": 85,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส23101": {
            "coursework": 62,
            "finalExam": 24,
            "total": 86,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส23102": {
            "coursework": 62,
            "finalExam": 24,
            "total": 86,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ23101": {
            "coursework": 59,
            "finalExam": 19,
            "total": 78,
            "grade": "3.5",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ23101": {
            "coursework": 58,
            "finalExam": 18,
            "total": 76,
            "grade": "3.5",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง23101": {
            "coursework": 58,
            "finalExam": 19,
            "total": 77,
            "grade": "3.5",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ23101": {
            "coursework": 60,
            "finalExam": 22,
            "total": 82,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค23201": {
            "coursework": 63,
            "finalExam": 26,
            "total": 89,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ23201": {
            "coursework": 59,
            "finalExam": 20,
            "total": 79,
            "grade": "3.5",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง23201": {
            "coursework": 59,
            "finalExam": 21,
            "total": 80,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว23103": {
            "coursework": 67,
            "finalExam": 29,
            "total": 96,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว23104": {
            "coursework": 68,
            "finalExam": 29,
            "total": 97,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 14,
        "code": "2413",
        "name": "เด็กหญิงสุวรรณษา นาน้อง",
        "gender": "female",
        "scores": {
          "ท23101": {
            "coursework": 56,
            "finalExam": 22,
            "total": 78,
            "grade": "3.5",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค23101": {
            "coursework": 56,
            "finalExam": 24,
            "total": 80,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว23101": {
            "coursework": 55,
            "finalExam": 21,
            "total": 76,
            "grade": "3.5",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส23101": {
            "coursework": 56,
            "finalExam": 23,
            "total": 79,
            "grade": "3.5",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส23102": {
            "coursework": 53,
            "finalExam": 18,
            "total": 71,
            "grade": "3",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "พ23101": {
            "coursework": 55,
            "finalExam": 21,
            "total": 76,
            "grade": "3.5",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ23101": {
            "coursework": 55,
            "finalExam": 22,
            "total": 77,
            "grade": "3.5",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง23101": {
            "coursework": 53,
            "finalExam": 18,
            "total": 71,
            "grade": "3",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "อ23101": {
            "coursework": 54,
            "finalExam": 19,
            "total": 73,
            "grade": "3",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค23201": {
            "coursework": 50,
            "finalExam": 16,
            "total": 66,
            "grade": "2.5",
            "attendedHours": 20,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "อ23201": {
            "coursework": 50,
            "finalExam": 15,
            "total": 65,
            "grade": "2.5",
            "attendedHours": 40,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ง23201": {
            "coursework": 55,
            "finalExam": 21,
            "total": 76,
            "grade": "3.5",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว23103": {
            "coursework": 70,
            "finalExam": 30,
            "total": 100,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว23104": {
            "coursework": 70,
            "finalExam": 30,
            "total": 100,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดี",
        "activityResult": "ผ่าน"
      },
      {
        "no": 15,
        "code": "2411",
        "name": "เด็กหญิงณัฐณิชา แก้วมณี",
        "gender": "female",
        "scores": {
          "ท23101": {
            "coursework": 65,
            "finalExam": 24,
            "total": 89,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค23101": {
            "coursework": 65,
            "finalExam": 25,
            "total": 90,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว23101": {
            "coursework": 64,
            "finalExam": 22,
            "total": 86,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส23101": {
            "coursework": 61,
            "finalExam": 19,
            "total": 80,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส23102": {
            "coursework": 65,
            "finalExam": 26,
            "total": 91,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ23101": {
            "coursework": 65,
            "finalExam": 25,
            "total": 90,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ23101": {
            "coursework": 63,
            "finalExam": 21,
            "total": 84,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง23101": {
            "coursework": 64,
            "finalExam": 23,
            "total": 87,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ23101": {
            "coursework": 62,
            "finalExam": 21,
            "total": 83,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค23201": {
            "coursework": 63,
            "finalExam": 22,
            "total": 85,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ23201": {
            "coursework": 66,
            "finalExam": 26,
            "total": 92,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง23201": {
            "coursework": 65,
            "finalExam": 26,
            "total": 91,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว23103": {
            "coursework": 66,
            "finalExam": 27,
            "total": 93,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว23104": {
            "coursework": 67,
            "finalExam": 27,
            "total": 94,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 16,
        "code": "2412",
        "name": "นางสาวสุรัมภา จูมงคล",
        "gender": "female",
        "scores": {
          "ท23101": {
            "coursework": 60,
            "finalExam": 23,
            "total": 83,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค23101": {
            "coursework": 57,
            "finalExam": 18,
            "total": 75,
            "grade": "3.5",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว23101": {
            "coursework": 61,
            "finalExam": 25,
            "total": 86,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส23101": {
            "coursework": 61,
            "finalExam": 26,
            "total": 87,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส23102": {
            "coursework": 56,
            "finalExam": 18,
            "total": 74,
            "grade": "3",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ23101": {
            "coursework": 60,
            "finalExam": 24,
            "total": 84,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ23101": {
            "coursework": 58,
            "finalExam": 20,
            "total": 78,
            "grade": "3.5",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง23101": {
            "coursework": 55,
            "finalExam": 17,
            "total": 72,
            "grade": "3",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ23101": {
            "coursework": 62,
            "finalExam": 26,
            "total": 88,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค23201": {
            "coursework": 56,
            "finalExam": 17,
            "total": 73,
            "grade": "3",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ23201": {
            "coursework": 56,
            "finalExam": 17,
            "total": 73,
            "grade": "3",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง23201": {
            "coursework": 62,
            "finalExam": 26,
            "total": 88,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว23103": {
            "coursework": 65,
            "finalExam": 26,
            "total": 91,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว23104": {
            "coursework": 66,
            "finalExam": 26,
            "total": 92,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 17,
        "code": "2415",
        "name": "เด็กหญิงกัญญานัท แสงทองศรี",
        "gender": "female",
        "scores": {
          "ท23101": {
            "coursework": 60,
            "finalExam": 21,
            "total": 81,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค23101": {
            "coursework": 61,
            "finalExam": 23,
            "total": 84,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว23101": {
            "coursework": 64,
            "finalExam": 27,
            "total": 91,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส23101": {
            "coursework": 62,
            "finalExam": 25,
            "total": 87,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส23102": {
            "coursework": 59,
            "finalExam": 18,
            "total": 77,
            "grade": "3.5",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ23101": {
            "coursework": 63,
            "finalExam": 27,
            "total": 90,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ23101": {
            "coursework": 63,
            "finalExam": 24,
            "total": 87,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง23101": {
            "coursework": 59,
            "finalExam": 20,
            "total": 79,
            "grade": "3.5",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ23101": {
            "coursework": 63,
            "finalExam": 25,
            "total": 88,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค23201": {
            "coursework": 58,
            "finalExam": 18,
            "total": 76,
            "grade": "3.5",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ23201": {
            "coursework": 62,
            "finalExam": 24,
            "total": 86,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง23201": {
            "coursework": 64,
            "finalExam": 27,
            "total": 91,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว23103": {
            "coursework": 70,
            "finalExam": 30,
            "total": 100,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว23104": {
            "coursework": 70,
            "finalExam": 30,
            "total": 100,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 18,
        "code": "2414",
        "name": "เด็กหญิงกัญญาภัทร ดานบิน",
        "gender": "female",
        "scores": {
          "ท23101": {
            "coursework": 68,
            "finalExam": 27,
            "total": 95,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค23101": {
            "coursework": 68,
            "finalExam": 27,
            "total": 95,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว23101": {
            "coursework": 65,
            "finalExam": 23,
            "total": 88,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส23101": {
            "coursework": 67,
            "finalExam": 29,
            "total": 96,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส23102": {
            "coursework": 68,
            "finalExam": 26,
            "total": 94,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ23101": {
            "coursework": 67,
            "finalExam": 26,
            "total": 93,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ23101": {
            "coursework": 64,
            "finalExam": 20,
            "total": 84,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง23101": {
            "coursework": 66,
            "finalExam": 24,
            "total": 90,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ23101": {
            "coursework": 66,
            "finalExam": 23,
            "total": 89,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค23201": {
            "coursework": 65,
            "finalExam": 21,
            "total": 86,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ23201": {
            "coursework": 65,
            "finalExam": 21,
            "total": 86,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง23201": {
            "coursework": 65,
            "finalExam": 21,
            "total": 86,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว23103": {
            "coursework": 64,
            "finalExam": 23,
            "total": 87,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว23104": {
            "coursework": 65,
            "finalExam": 23,
            "total": 88,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 19,
        "code": "2416",
        "name": "เด็กหญิงสุธิดา รัตนาวงค์",
        "gender": "female",
        "scores": {
          "ท23101": {
            "coursework": 58,
            "finalExam": 24,
            "total": 82,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค23101": {
            "coursework": 59,
            "finalExam": 24,
            "total": 83,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว23101": {
            "coursework": 58,
            "finalExam": 23,
            "total": 81,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส23101": {
            "coursework": 57,
            "finalExam": 21,
            "total": 78,
            "grade": "3.5",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส23102": {
            "coursework": 53,
            "finalExam": 17,
            "total": 70,
            "grade": "3",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 2
          },
          "พ23101": {
            "coursework": 58,
            "finalExam": 25,
            "total": 83,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ23101": {
            "coursework": 58,
            "finalExam": 23,
            "total": 81,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง23101": {
            "coursework": 57,
            "finalExam": 22,
            "total": 79,
            "grade": "3.5",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ23101": {
            "coursework": 58,
            "finalExam": 23,
            "total": 81,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค23201": {
            "coursework": 57,
            "finalExam": 23,
            "total": 80,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ23201": {
            "coursework": 53,
            "finalExam": 16,
            "total": 69,
            "grade": "2.5",
            "attendedHours": 40,
            "traitScore": 2,
            "readThinkScore": 2
          },
          "ง23201": {
            "coursework": 56,
            "finalExam": 21,
            "total": 77,
            "grade": "3.5",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว23103": {
            "coursework": 66,
            "finalExam": 28,
            "total": 94,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว23104": {
            "coursework": 67,
            "finalExam": 28,
            "total": 95,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      },
      {
        "no": 20,
        "code": "2936",
        "name": "เด็กหญิงชลดา พันธ์ศรี",
        "gender": "female",
        "scores": {
          "ท23101": {
            "coursework": 64,
            "finalExam": 25,
            "total": 89,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค23101": {
            "coursework": 63,
            "finalExam": 26,
            "total": 89,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว23101": {
            "coursework": 63,
            "finalExam": 25,
            "total": 88,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส23101": {
            "coursework": 64,
            "finalExam": 26,
            "total": 90,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ส23102": {
            "coursework": 59,
            "finalExam": 19,
            "total": 78,
            "grade": "3.5",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "พ23101": {
            "coursework": 60,
            "finalExam": 21,
            "total": 81,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ศ23101": {
            "coursework": 61,
            "finalExam": 20,
            "total": 81,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง23101": {
            "coursework": 63,
            "finalExam": 25,
            "total": 88,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ23101": {
            "coursework": 63,
            "finalExam": 25,
            "total": 88,
            "grade": "4",
            "attendedHours": 60,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ค23201": {
            "coursework": 59,
            "finalExam": 18,
            "total": 77,
            "grade": "3.5",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "อ23201": {
            "coursework": 64,
            "finalExam": 27,
            "total": 91,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ง23201": {
            "coursework": 62,
            "finalExam": 23,
            "total": 85,
            "grade": "4",
            "attendedHours": 40,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว23103": {
            "coursework": 64,
            "finalExam": 26,
            "total": 90,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          },
          "ว23104": {
            "coursework": 64,
            "finalExam": 26,
            "total": 90,
            "grade": "4",
            "attendedHours": 20,
            "traitScore": 3,
            "readThinkScore": 3
          }
        },
        "traitResult": "ดีเยี่ยม",
        "readThinkResult": "ดีเยี่ยม",
        "activityResult": "ผ่าน"
      }
    ]
  }
];
