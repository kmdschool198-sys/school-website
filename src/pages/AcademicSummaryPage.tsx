import { useState, useMemo } from 'react';
import {
  Download, Search, Printer, Info, Award,
  TrendingUp, BarChart3, CheckCircle2, Sparkles, BookOpen, Users,
} from 'lucide-react';
import SmartSchoolLayout from '../components/SmartSchoolLayout';
import TeacherLoginGate from '../components/TeacherLoginGate';
import { useTeacherAuth } from '../utils/teacherAuth';
import { useAcademicData } from '../utils/academicStorage';
import { SUBJECT_GROUPS, calculateStudentGPA } from '../data/academicData';
import { downloadCsvReport } from '../utils/csvReport';
import { SCHOOL_NAME, SCHOOL_AFFILIATION } from '../config/siteLinks';

const DIRECTOR_NAME = 'นายปรัชญา ปรางค์ชัยภูมิ';

interface SubjectDistRow {
  classId: string;
  shortName: string;
  room: number;
  code: string;
  name: string;
  group: string;
  teacher: string;
  totalStudents: number;
  counts: {
    '4': number;
    '3.5': number;
    '3': number;
    '2.5': number;
    '2': number;
    '1.5': number;
    '1': number;
    '0': number;
    'ร': number;
    'มส': number;
  };
  avgGrade: number;
  pct3Up: number;
  avgCourseworkPct: number; // % คะแนนเก็บเฉลี่ย (เทียบเต็ม 70)
  avgFinalExamPct: number;  // % คะแนนสอบปลายภาคเฉลี่ย (เทียบเต็ม 30)
  avgTotalScore: number;    // คะแนนรวมเฉลี่ย (เต็ม 100)
  consistencyGap: number;   // ส่วนต่างระหว่าง % คะแนนเก็บ กับ % สอบปลายภาค
  teachingStatus: 'ดีเยี่ยม (วัดผลเที่ยงตรง)' | 'มาตรฐานดี' | 'ควรนิเทศ/ซ่อมเสริม';
}

const GROUP_ICONS: Record<string, string> = {
  'ทั้งหมด (ทุกกลุ่มสาระฯ)': '🌐',
  'ภาษาไทย (พื้นฐาน)': '📖',
  'คณิตศาสตร์ (พื้นฐาน)': '🔢',
  'คณิตศาสตร์ (เพิ่มเติม)': '🧮',
  'วิทยาศาสตร์ฯ (พื้นฐาน)': '🧪',
  'วิทยาศาสตร์ฯ (เพิ่มเติม)': '💻',
  'สังคมศึกษาฯ (พื้นฐาน)': '🌍',
  'สุขศึกษาฯ (พื้นฐาน)': '❤️',
  'ศิลปะ (พื้นฐาน)': '🎨',
  'การงานอาชีพฯ (พื้นฐาน)': '💼',
  'การงานอาชีพฯ (เพิ่มเติม)': '🛠️',
  'ภาษาต่างประเทศ (พื้นฐาน)': '💬',
  'ภาษาต่างประเทศ (เพิ่มเติม)': '🗣️',
  'กิจกรรมพัฒนาผู้เรียน': '🏃',
};

const CORE_GROUPS_FOR_HEATMAP = [
  { key: 'ภาษาไทย', label: 'ภาษาไทย', match: (g: string) => g.startsWith('ภาษาไทย') },
  { key: 'คณิตศาสตร์', label: 'คณิตศาสตร์', match: (g: string) => g.startsWith('คณิตศาสตร์') },
  { key: 'วิทยาศาสตร์ฯ', label: 'วิทย์-เทคโนฯ', match: (g: string) => g.startsWith('วิทยาศาสตร์') },
  { key: 'สังคมศึกษาฯ', label: 'สังคมศึกษาฯ', match: (g: string) => g.startsWith('สังคมศึกษา') },
  { key: 'สุขศึกษาฯ', label: 'สุขศึกษา-พละ', match: (g: string) => g.startsWith('สุขศึกษา') },
  { key: 'ศิลปะ', label: 'ศิลปะ', match: (g: string) => g.startsWith('ศิลปะ') },
  { key: 'การงานอาชีพฯ', label: 'การงานอาชีพ', match: (g: string) => g.startsWith('การงานอาชีพ') },
  { key: 'ภาษาต่างประเทศ', label: 'ภาษาอังกฤษ', match: (g: string) => g.startsWith('ภาษาต่างประเทศ') },
];

export default function AcademicSummaryPage() {
  const auth = useTeacherAuth();
  if (!auth.authed) {
    return <TeacherLoginGate title="📊 สรุปผลสัมฤทธิ์ & แดชบอร์ดผู้บริหาร" />;
  }
  return <AcademicSummaryContent />;
}

function AcademicSummaryContent() {
  const { classesData } = useAcademicData();
  const [viewMode, setViewMode] = useState<'director' | 'table'>('director');
  const [selectedGroup, setSelectedGroup] = useState<string>('ทั้งหมด (ทุกกลุ่มสาระฯ)');
  const [semester, setSemester] = useState<string>('เทอม 1/2569 (ปัจจุบัน)');
  const [search, setSearch] = useState<string>('');
  const [rowsLimit, setRowsLimit] = useState<number>(50);
  const [selectedRiskClass, setSelectedRiskClass] = useState<string>('all');

  // คำนวณข้อมูลรายวิชาทั้งหมดพร้อมดัชนีคุณภาพการสอน
  const allSubjectMetrics = useMemo<SubjectDistRow[]>(() => {
    const rows: SubjectDistRow[] = [];

    for (const cls of classesData) {
      for (const subj of cls.subjects) {
        const counts = {
          '4': 0, '3.5': 0, '3': 0, '2.5': 0,
          '2': 0, '1.5': 0, '1': 0, '0': 0, 'ร': 0, 'มส': 0,
        };
        let gradeSum = 0;
        let gradedCount = 0;
        let cwSum = 0;
        let finSum = 0;
        let totalScoreSum = 0;

        for (const st of cls.students) {
          const sc = st.scores[subj.code] || { coursework: 50, finalExam: 20, total: 70, grade: '3' };
          const g = sc.grade || '0';
          if (g in counts) {
            counts[g as keyof typeof counts] += 1;
          }
          const gNum = parseFloat(g);
          if (!isNaN(gNum)) {
            gradeSum += gNum;
            gradedCount += 1;
          }
          cwSum += Number(sc.coursework) || 0;
          finSum += Number(sc.finalExam) || 0;
          totalScoreSum += Number(sc.total) || 0;
        }

        const total = cls.students.length;
        const count3Up = counts['4'] + counts['3.5'] + counts['3'];
        const avgGrade = gradedCount > 0 ? gradeSum / gradedCount : 0;
        const pct3Up = total > 0 ? (count3Up / total) * 100 : 0;
        const avgCw = total > 0 ? cwSum / total : 0;
        const avgFin = total > 0 ? finSum / total : 0;
        const avgCourseworkPct = (avgCw / 70) * 100;
        const avgFinalExamPct = (avgFin / 30) * 100;
        const avgTotalScore = total > 0 ? totalScoreSum / total : 0;
        const consistencyGap = Math.abs(avgCourseworkPct - avgFinalExamPct);
        const failOrIncomplete = counts['0'] + counts['ร'] + counts['มส'];

        let teachingStatus: SubjectDistRow['teachingStatus'] = 'มาตรฐานดี';
        if (avgGrade >= 3.0 && pct3Up >= 70 && avgFinalExamPct >= 62 && failOrIncomplete === 0) {
          teachingStatus = 'ดีเยี่ยม (วัดผลเที่ยงตรง)';
        } else if (avgGrade < 2.2 || failOrIncomplete > 0 || (avgCourseworkPct - avgFinalExamPct > 28)) {
          teachingStatus = 'ควรนิเทศ/ซ่อมเสริม';
        }

        rows.push({
          classId: cls.classId,
          shortName: cls.shortName,
          room: cls.room,
          code: subj.code,
          name: subj.name,
          group: subj.group,
          teacher: subj.teacher,
          totalStudents: total,
          counts,
          avgGrade,
          pct3Up,
          avgCourseworkPct,
          avgFinalExamPct,
          avgTotalScore,
          consistencyGap,
          teachingStatus,
        });
      }
    }
    return rows;
  }, [classesData]);

  // ข้อมูลสำหรับโหมดตารางแยกตามกลุ่มสาระฯ
  const allDistRows = useMemo<SubjectDistRow[]>(() => {
    if (selectedGroup === 'กิจกรรมพัฒนาผู้เรียน') {
      const actRows: SubjectDistRow[] = [];
      for (const cls of classesData) {
        for (const act of cls.activities) {
          const passCount = cls.students.filter(s => s.activityResult === 'ผ่าน').length;
          const failCount = cls.students.length - passCount;
          actRows.push({
            classId: cls.classId,
            shortName: cls.shortName,
            room: cls.room,
            code: act.code,
            name: act.name,
            group: 'กิจกรรมพัฒนาผู้เรียน',
            teacher: cls.homeroomTeachers.join(', '),
            totalStudents: cls.students.length,
            counts: {
              '4': passCount, '3.5': 0, '3': 0, '2.5': 0,
              '2': 0, '1.5': 0, '1': 0, '0': failCount, 'ร': 0, 'มส': 0,
            },
            avgGrade: 4.0,
            pct3Up: cls.students.length > 0 ? (passCount / cls.students.length) * 100 : 100,
            avgCourseworkPct: 100,
            avgFinalExamPct: 100,
            avgTotalScore: 100,
            consistencyGap: 0,
            teachingStatus: 'ดีเยี่ยม (วัดผลเที่ยงตรง)',
          });
        }
      }
      return actRows;
    }
    if (selectedGroup === 'ทั้งหมด (ทุกกลุ่มสาระฯ)') {
      return allSubjectMetrics;
    }
    return allSubjectMetrics.filter(r => r.group === selectedGroup);
  }, [classesData, allSubjectMetrics, selectedGroup]);

  // แยก searchedRows ก่อน slice เพื่อให้ผลรวมและ CSV ครบ 100%
  const searchedRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allDistRows.filter(
      r =>
        !q ||
        r.shortName.toLowerCase().includes(q) ||
        r.code.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.teacher.toLowerCase().includes(q)
    );
  }, [allDistRows, search]);

  const filteredRows = useMemo(() => searchedRows.slice(0, rowsLimit), [searchedRows, rowsLimit]);

  const totals = useMemo(() => {
    const t = {
      students: 0,
      '4': 0, '3.5': 0, '3': 0, '2.5': 0,
      '2': 0, '1.5': 0, '1': 0, '0': 0, 'ร': 0, 'มส': 0,
      avgGrade: 0,
      pct3Up: 0,
    };
    let weightedGradeSum = 0;
    let gradedStudentCount = 0;

    for (const r of searchedRows) {
      t.students += r.totalStudents;
      t['4'] += r.counts['4'];
      t['3.5'] += r.counts['3.5'];
      t['3'] += r.counts['3'];
      t['2.5'] += r.counts['2.5'];
      t['2'] += r.counts['2'];
      t['1.5'] += r.counts['1.5'];
      t['1'] += r.counts['1'];
      t['0'] += r.counts['0'];
      t['ร'] += r.counts['ร'];
      t['มส'] += r.counts['มส'];

      const rowGraded = r.totalStudents - r.counts['ร'] - r.counts['มส'];
      if (rowGraded > 0 && r.group !== 'กิจกรรมพัฒนาผู้เรียน') {
        weightedGradeSum += r.avgGrade * rowGraded;
        gradedStudentCount += rowGraded;
      }
    }

    const total3Up = t['4'] + t['3.5'] + t['3'];
    t.avgGrade = gradedStudentCount > 0 ? weightedGradeSum / gradedStudentCount : 0;
    t.pct3Up = t.students > 0 ? (total3Up / t.students) * 100 : 0;
    return t;
  }, [searchedRows]);

  // ================= วิเคราะห์เชิงลึกสำหรับแดชบอร์ด ผอ. =================
  const directorAnalytics = useMemo(() => {
    // 1. วิเคราะห์วิชาที่เก่งที่สุด และอ่อนที่สุด ของแต่ละชั้นเรียน
    const classStrengthWeakness = classesData.map(cls => {
      const clsSubjs = allSubjectMetrics.filter(m => m.classId === cls.classId);
      const sorted = [...clsSubjs].sort((a, b) => b.avgGrade - a.avgGrade || b.pct3Up - a.pct3Up);
      const strongest = sorted[0];
      const weakest = sorted[sorted.length - 1];

      // คำนวณ GPA เฉลี่ยของห้อง
      const studentGpas = cls.students.map(st => calculateStudentGPA(st, cls.subjects, true).gpa);
      const classAvgGpa = studentGpas.length
        ? studentGpas.reduce((s, v) => s + v, 0) / studentGpas.length
        : 0;

      return {
        classId: cls.classId,
        shortName: cls.shortName,
        className: cls.className,
        homeroom: cls.homeroomTeachers.join(', '),
        studentCount: cls.students.length,
        classAvgGpa,
        strongest,
        weakest,
      };
    });

    // 2. Heatmap 8 กลุ่มสาระ x ระดับชั้น
    const groupRanking = CORE_GROUPS_FOR_HEATMAP.map(grp => {
      const grpRows = allSubjectMetrics.filter(m => grp.match(m.group));
      const avgGpa = grpRows.length
        ? grpRows.reduce((s, r) => s + r.avgGrade, 0) / grpRows.length
        : 0;
      const avgPct3Up = grpRows.length
        ? grpRows.reduce((s, r) => s + r.pct3Up, 0) / grpRows.length
        : 0;

      const byClass: Record<string, number | null> = {};
      for (const cls of classesData) {
        const cRows = grpRows.filter(r => r.classId === cls.classId);
        byClass[cls.shortName] = cRows.length
          ? cRows.reduce((s, r) => s + r.avgGrade, 0) / cRows.length
          : null;
      }

      return {
        ...grp,
        avgGpa,
        avgPct3Up,
        byClass,
      };
    }).sort((a, b) => b.avgGpa - a.avgGpa);

    // 3. จัดอันดับรายวิชาที่สอนดีเด่น (Top Teaching Effectiveness)
    const topTeachingSubjects = [...allSubjectMetrics]
      .sort((a, b) => {
        const scoreA = a.avgGrade * 20 + a.pct3Up * 0.4 - a.consistencyGap * 0.3;
        const scoreB = b.avgGrade * 20 + b.pct3Up * 0.4 - b.consistencyGap * 0.3;
        return scoreB - scoreA;
      });

    // 4. วิเคราะห์นักเรียนรายบุคคล: กลุ่มคนเก่ง, กลุ่มพัฒนาการปลายภาค, กลุ่มต้องซ่อมเสริม
    const allStudentProfiles: Array<{
      code: string;
      name: string;
      classId: string;
      shortName: string;
      gpa: number;
      gpaFormatted: string;
      bestSubject: string;
      weakSubjects: string[];
      growthIndex: number; // % สอบปลายภาค เทียบกับ % คะแนนเก็บ
      hasFailOrIncomplete: boolean;
    }> = [];

    for (const cls of classesData) {
      for (const st of cls.students) {
        const gpaInfo = calculateStudentGPA(st, cls.subjects, true);
        let bestSubjName = '-';
        let bestSubjScore = -1;
        const weakSubjs: string[] = [];
        let cwPctSum = 0;
        let finPctSum = 0;
        let subjCount = 0;
        let hasFail = false;

        for (const subj of cls.subjects) {
          const sc = st.scores[subj.code] || { coursework: 50, finalExam: 20, total: 70, grade: '3' };
          if (sc.total > bestSubjScore) {
            bestSubjScore = sc.total;
            bestSubjName = `${subj.name} (${sc.total}%)`;
          }
          if (sc.grade === '0' || sc.grade === '1' || sc.grade === '1.5' || sc.grade === 'ร' || sc.grade === 'มส') {
            weakSubjs.push(`${subj.name} (เกรด ${sc.grade})`);
          }
          if (sc.grade === '0' || sc.grade === 'ร' || sc.grade === 'มส') {
            hasFail = true;
          }
          cwPctSum += (sc.coursework / 70) * 100;
          finPctSum += (sc.finalExam / 30) * 100;
          subjCount += 1;
        }

        const avgCwPct = subjCount > 0 ? cwPctSum / subjCount : 70;
        const avgFinPct = subjCount > 0 ? finPctSum / subjCount : 70;
        const growthIndex = avgFinPct - avgCwPct; // บวก = ปลายภาคทำได้ดีกว่าคะแนนเก็บ (พัฒนาการปลายภาคพุ่งขึ้น)

        allStudentProfiles.push({
          code: st.code,
          name: st.name,
          classId: cls.classId,
          shortName: cls.shortName,
          gpa: gpaInfo.gpa,
          gpaFormatted: gpaInfo.gpaFormatted,
          bestSubject: bestSubjName,
          weakSubjects: weakSubjs,
          growthIndex,
          hasFailOrIncomplete: hasFail,
        });
      }
    }

    const filteredProfiles = selectedRiskClass === 'all'
      ? allStudentProfiles
      : allStudentProfiles.filter(p => p.classId === selectedRiskClass);

    const topPerformers = [...filteredProfiles]
      .filter(p => p.gpa >= 3.5)
      .sort((a, b) => b.gpa - a.gpa)
      .slice(0, 12);

    const risingStars = [...filteredProfiles]
      .filter(p => p.gpa >= 2.5)
      .sort((a, b) => b.growthIndex - a.growthIndex || b.gpa - a.gpa)
      .slice(0, 12);

    const needSupport = [...filteredProfiles]
      .filter(p => p.gpa < 2.5 || p.weakSubjects.length > 0 || p.hasFailOrIncomplete)
      .sort((a, b) => a.gpa - b.gpa || b.weakSubjects.length - a.weakSubjects.length)
      .slice(0, 15);

    const schoolAvgGpa = allStudentProfiles.length
      ? allStudentProfiles.reduce((s, p) => s + p.gpa, 0) / allStudentProfiles.length
      : 0;

    return {
      classStrengthWeakness,
      groupRanking,
      topTeachingSubjects,
      topPerformers,
      risingStars,
      needSupport,
      schoolAvgGpa,
      totalStudentsCount: allStudentProfiles.length,
      excellentSubjectCount: allSubjectMetrics.filter(m => m.teachingStatus === 'ดีเยี่ยม (วัดผลเที่ยงตรง)').length,
    };
  }, [classesData, allSubjectMetrics, selectedRiskClass]);

  const exportExcelCsv = () => {
    const safeSem = semester.replace(/[^\wก-๙-]/g, '_');
    const rows: Array<Array<string | number>> = [
      [`รายงานสรุปผลสัมฤทธิ์ทางการเรียนและการวิเคราะห์คุณภาพการสอน ${SCHOOL_NAME}`],
      ['กลุ่มสาระ/หมวดวิชา:', selectedGroup, 'ภาคเรียน:', semester],
      [],
      ['ระดับชั้น', 'ห้อง', 'รหัสวิชา', 'ชื่อรายวิชา', 'ครูผู้สอน', 'รวม(คน)', '4', '3.5', '3', '2.5', '2', '1.5', '1', '0', 'ร', 'มส', 'GPA วิชา', '% เกรด 3 ขึ้นไป', '% คะแนนเก็บ', '% สอบปลายภาค', 'ประเมินการสอน'],
      ...searchedRows.map(r => [
        r.shortName,
        r.room,
        r.code,
        r.name,
        r.teacher,
        r.totalStudents,
        r.counts['4'],
        r.counts['3.5'],
        r.counts['3'],
        r.counts['2.5'],
        r.counts['2'],
        r.counts['1.5'],
        r.counts['1'],
        r.counts['0'],
        r.counts['ร'],
        r.counts['มส'],
        r.group === 'กิจกรรมพัฒนาผู้เรียน' ? 'ผ่าน' : r.avgGrade.toFixed(2),
        `${r.pct3Up.toFixed(1)}%`,
        `${r.avgCourseworkPct.toFixed(1)}%`,
        `${r.avgFinalExamPct.toFixed(1)}%`,
        r.teachingStatus,
      ]),
      [
        `รวมทั้งสิ้น (${searchedRows.length} รายวิชา)`, '', '', '', '',
        totals.students,
        totals['4'], totals['3.5'], totals['3'], totals['2.5'],
        totals['2'], totals['1.5'], totals['1'], totals['0'],
        totals['ร'], totals['มส'],
        selectedGroup === 'กิจกรรมพัฒนาผู้เรียน' ? '-' : totals.avgGrade.toFixed(2),
        `${totals.pct3Up.toFixed(1)}%`,
        '', '', '',
      ],
    ];
    downloadCsvReport(`สรุปผลสัมฤทธิ์_${selectedGroup}_${safeSem}.csv`, rows);
  };

  return (
    <SmartSchoolLayout pageTitle="สรุปผลสัมฤทธิ์ & แดชบอร์ดผู้บริหาร">
      {/* Top Title & Mode Switcher */}
      <div className="no-print" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 16,
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 900, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
            📊 ระบบวิเคราะห์ผลสัมฤทธิ์ทางการเรียน & แดชบอร์ดผู้บริหาร
          </h1>
          <div style={{ fontSize: '0.82rem', color: '#64748B', marginTop: 2 }}>
            เชื่อมข้อมูลตรงจาก ปพ.5 และ ปพ.6 · วิเคราะห์วิชาเก่ง-วิชาอ่อน คุณภาพการสอน และพัฒนาการนักเรียนรายบุคคล
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => window.print()}
            style={{
              background: '#1E293B', color: '#FFFFFF', border: 'none',
              borderRadius: 999, padding: '9px 18px', fontWeight: 800, fontSize: '0.84rem',
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            <Printer size={15} /> พิมพ์รายงานผู้บริหาร (A4)
          </button>
          <button
            type="button"
            onClick={exportExcelCsv}
            style={{
              background: '#15803D', color: '#FFFFFF', border: 'none',
              borderRadius: 999, padding: '9px 20px', fontWeight: 900, fontSize: '0.85rem',
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7,
              boxShadow: '0 4px 14px rgba(21,128,61,0.3)',
            }}
          >
            <Download size={16} /> ส่งออก Excel (CSV)
          </button>
        </div>
      </div>

      {/* Mode Switch Tabs */}
      <div className="no-print" style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setViewMode('director')}
          style={{
            padding: '11px 20px',
            borderRadius: 12,
            border: viewMode === 'director' ? '2px solid #EA580C' : '1px solid #CBD5E1',
            background: viewMode === 'director' ? 'linear-gradient(135deg,#EA580C,#D97706)' : '#FFFFFF',
            color: viewMode === 'director' ? '#FFFFFF' : '#1E293B',
            fontWeight: 900,
            fontSize: '0.88rem',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            boxShadow: viewMode === 'director' ? '0 6px 18px rgba(234,88,12,0.3)' : 'none',
          }}
        >
          <Sparkles size={17} /> 🎯 แดชบอร์ดผู้บริหาร (ชี้ชัดวิชาเก่ง-อ่อน / ครูสอนดี / พัฒนาการเด็ก)
        </button>
        <button
          type="button"
          onClick={() => setViewMode('table')}
          style={{
            padding: '11px 20px',
            borderRadius: 12,
            border: viewMode === 'table' ? '2px solid #0284C7' : '1px solid #CBD5E1',
            background: viewMode === 'table' ? '#0284C7' : '#FFFFFF',
            color: viewMode === 'table' ? '#FFFFFF' : '#1E293B',
            fontWeight: 900,
            fontSize: '0.88rem',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <BarChart3 size={17} /> 📋 ตารางแจกแจงเกรดรายวิชา (4 ถึง 0) แยกตามกลุ่มสาระฯ
        </button>
      </div>

      {/* ================= VIEW 1: DIRECTOR'S ACADEMIC INTELLIGENCE DASHBOARD ================= */}
      {viewMode === 'director' && (
        <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Executive KPI Strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            <div style={{ background: '#FFFFFF', borderRadius: 14, padding: '16px 18px', border: '1px solid #E2E8F0', borderLeft: '5px solid #0284C7' }}>
              <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#64748B' }}>GPA เฉลี่ยทั้งโรงเรียน (ป.1–ม.3)</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#0284C7', marginTop: 4 }}>
                {directorAnalytics.schoolAvgGpa.toFixed(2)}
              </div>
              <div style={{ fontSize: '0.74rem', color: '#475569', fontWeight: 700 }}>
                ประมวลผลจากนักเรียน {directorAnalytics.totalStudentsCount} คน
              </div>
            </div>

            <div style={{ background: '#FFFFFF', borderRadius: 14, padding: '16px 18px', border: '1px solid #E2E8F0', borderLeft: '5px solid #16A34A' }}>
              <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#64748B' }}>🏆 กลุ่มสาระฯ ที่ผลสัมฤทธิ์สูงสุด</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#15803D', marginTop: 6 }}>
                {directorAnalytics.groupRanking[0]?.label || '-'} (GPA {directorAnalytics.groupRanking[0]?.avgGpa.toFixed(2)})
              </div>
              <div style={{ fontSize: '0.74rem', color: '#16A34A', fontWeight: 700, marginTop: 2 }}>
                ได้เกรด 3 ขึ้นไป {directorAnalytics.groupRanking[0]?.avgPct3Up.toFixed(1)}%
              </div>
            </div>

            <div style={{ background: '#FFFFFF', borderRadius: 14, padding: '16px 18px', border: '1px solid #E2E8F0', borderLeft: '5px solid #EA580C' }}>
              <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#64748B' }}>⚠️ กลุ่มสาระฯ ที่ควรเร่งรัด</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#C2410C', marginTop: 6 }}>
                {directorAnalytics.groupRanking[directorAnalytics.groupRanking.length - 1]?.label || '-'} (GPA {directorAnalytics.groupRanking[directorAnalytics.groupRanking.length - 1]?.avgGpa.toFixed(2)})
              </div>
              <div style={{ fontSize: '0.74rem', color: '#EA580C', fontWeight: 700, marginTop: 2 }}>
                เป้าหมายนิเทศและจัดสอนซ่อมเสริม
              </div>
            </div>

            <div style={{ background: '#FFFFFF', borderRadius: 14, padding: '16px 18px', border: '1px solid #E2E8F0', borderLeft: '5px solid #8B5CF6' }}>
              <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#64748B' }}>🌟 รายวิชาที่สอนดีเยี่ยม & วัดผลเที่ยงตรง</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#6D28D9', marginTop: 4 }}>
                {directorAnalytics.excellentSubjectCount} / {allSubjectMetrics.length} วิชา
              </div>
              <div style={{ fontSize: '0.74rem', color: '#7C3AED', fontWeight: 700 }}>
                GPA ≥ 3.00 และคะแนนสอบสอดคล้องคะแนนเก็บ
              </div>
            </div>
          </div>

          {/* MODULE 1: ตารางชี้เป้าประจำชั้น — ชั้นไหนเก่งวิชาอะไร อ่อนวิชาอะไร */}
          <div style={{ background: '#FFFFFF', borderRadius: 16, padding: 20, border: '1px solid #E2E8F0', boxShadow: '0 4px 16px rgba(15,23,42,0.03)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.08rem', fontWeight: 900, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Award size={20} color="#EA580C" /> 1. สรุปจุดแข็ง-จุดอ่อนรายชั้นเรียน (ชั้นไหนเก่งวิชาใด / อ่อนวิชาใด)
                </h3>
                <div style={{ fontSize: '0.8rem', color: '#64748B', marginTop: 2 }}>
                  ช่วยให้ผู้บริหารทราบภาพรวมทันทีว่าแต่ละห้องเรียนถนัดวิชาอะไร และต้องเสริมวิชาอะไรเป็นพิเศษ
                </div>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                <thead>
                  <tr style={{ background: '#0F172A', color: 'white' }}>
                    <th style={{ ...thDark, width: 80 }}>ระดับชั้น</th>
                    <th style={{ ...thDark, width: 70 }}>นักเรียน</th>
                    <th style={{ ...thDark, width: 95, background: '#0284C7' }}>GPA เฉลี่ยห้อง</th>
                    <th style={{ ...thDark, textAlign: 'left', background: '#15803D' }}>🏆 วิชาที่เด็กเก่งที่สุด (Top Subject)</th>
                    <th style={{ ...thDark, textAlign: 'left', background: '#B91C1C' }}>⚠️ วิชาที่เด็กอ่อนที่สุด (ต้องเสริมเร่งด่วน)</th>
                    <th style={{ ...thDark, textAlign: 'left', width: 190 }}>ครูประจำชั้น</th>
                  </tr>
                </thead>
                <tbody>
                  {directorAnalytics.classStrengthWeakness.map(row => (
                    <tr key={row.classId} style={{ borderBottom: '1px solid #E2E8F0' }}>
                      <td style={{ ...tdCell, fontWeight: 900, color: '#0F172A' }}>{row.shortName}/1</td>
                      <td style={{ ...tdCell, fontWeight: 700 }}>{row.studentCount} คน</td>
                      <td style={{ ...tdCell, fontWeight: 900, color: '#0284C7', background: '#F0F9FF', fontSize: '0.95rem' }}>
                        {row.classAvgGpa.toFixed(2)}
                      </td>
                      <td style={{ ...tdCell, textAlign: 'left', background: '#F0FDF4' }}>
                        {row.strongest ? (
                          <div>
                            <span style={{ fontWeight: 900, color: '#15803D' }}>
                              {row.strongest.code} {row.strongest.name}
                            </span>
                            <span style={{ marginLeft: 8, fontSize: '0.76rem', fontWeight: 800, background: '#DCFCE7', color: '#166534', padding: '2px 8px', borderRadius: 999 }}>
                              GPA {row.strongest.avgGrade.toFixed(2)} · เกรด 3 ขึ้นไป {row.strongest.pct3Up.toFixed(0)}%
                            </span>
                            <div style={{ fontSize: '0.74rem', color: '#475569', marginTop: 2 }}>
                              ผู้สอน: {row.strongest.teacher}
                            </div>
                          </div>
                        ) : '-'}
                      </td>
                      <td style={{ ...tdCell, textAlign: 'left', background: '#FEF2F2' }}>
                        {row.weakest ? (
                          <div>
                            <span style={{ fontWeight: 900, color: '#B91C1C' }}>
                              {row.weakest.code} {row.weakest.name}
                            </span>
                            <span style={{ marginLeft: 8, fontSize: '0.76rem', fontWeight: 800, background: '#FEE2E2', color: '#991B1B', padding: '2px 8px', borderRadius: 999 }}>
                              GPA {row.weakest.avgGrade.toFixed(2)} · เกรด 3 ขึ้นไป {row.weakest.pct3Up.toFixed(0)}%
                            </span>
                            <div style={{ fontSize: '0.74rem', color: '#475569', marginTop: 2 }}>
                              ผู้สอน: {row.weakest.teacher}
                            </div>
                          </div>
                        ) : '-'}
                      </td>
                      <td style={{ ...tdCell, textAlign: 'left', fontSize: '0.78rem', color: '#334155', fontWeight: 700 }}>
                        {row.homeroom}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* MODULE 2: HEATMAP 8 กลุ่มสาระ x ระดับชั้น */}
          <div style={{ background: '#FFFFFF', borderRadius: 16, padding: 20, border: '1px solid #E2E8F0' }}>
            <h3 style={{ margin: '0 0 6px', fontSize: '1.08rem', fontWeight: 900, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
              <BookOpen size={20} color="#0284C7" /> 2. แผนผังความเข้มแข็งทางวิชาการ (Heatmap 8 กลุ่มสาระฯ × ระดับชั้น)
            </h3>
            <div style={{ fontSize: '0.8rem', color: '#64748B', marginBottom: 14 }}>
              สีเขียวเข้ม = GPA ≥ 3.20 (ดีเยี่ยม) · สีฟ้า = 2.75–3.19 (ดี) · สีเหลือง = 2.25–2.74 (ปานกลาง) · สีส้มแดง = &lt; 2.25 (ควรเร่งพัฒนา)
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                <thead>
                  <tr style={{ background: '#1E293B', color: 'white' }}>
                    <th style={{ ...thDark, width: 50 }}>อันดับ</th>
                    <th style={{ ...thDark, textAlign: 'left' }}>กลุ่มสาระการเรียนรู้</th>
                    {classesData.map(cls => (
                      <th key={cls.classId} style={{ ...thDark, width: 68 }}>{cls.shortName}</th>
                    ))}
                    <th style={{ ...thDark, width: 90, background: '#0284C7' }}>GPA เฉลี่ย</th>
                    <th style={{ ...thDark, width: 100, background: '#15803D' }}>% เกรด 3 ขึ้นไป</th>
                  </tr>
                </thead>
                <tbody>
                  {directorAnalytics.groupRanking.map((grp, idx) => (
                    <tr key={grp.key} style={{ borderBottom: '1px solid #E2E8F0' }}>
                      <td style={{ ...tdCell, fontWeight: 900 }}>{idx + 1}</td>
                      <td style={{ ...tdCell, textAlign: 'left', fontWeight: 800, color: '#0F172A' }}>{grp.label}</td>
                      {classesData.map(cls => {
                        const val = grp.byClass[cls.shortName];
                        if (val == null) return <td key={cls.classId} style={tdCell}>-</td>;
                        const bg = val >= 3.2 ? '#DCFCE7' : val >= 2.75 ? '#E0F2FE' : val >= 2.25 ? '#FEF3C7' : '#FEE2E2';
                        const fg = val >= 3.2 ? '#166534' : val >= 2.75 ? '#0369A1' : val >= 2.25 ? '#92400E' : '#991B1B';
                        return (
                          <td key={cls.classId} style={{ ...tdCell, background: bg, color: fg, fontWeight: 900 }}>
                            {val.toFixed(2)}
                          </td>
                        );
                      })}
                      <td style={{ ...tdCell, fontWeight: 900, color: '#0284C7', background: '#F0F9FF' }}>
                        {grp.avgGpa.toFixed(2)}
                      </td>
                      <td style={{ ...tdCell, fontWeight: 900, color: '#15803D' }}>
                        {grp.avgPct3Up.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* MODULE 3: วิเคราะห์วิชาไหนสอนดี & ความเที่ยงตรงของการให้คะแนน (70 vs 30) */}
          <div style={{ background: '#FFFFFF', borderRadius: 16, padding: 20, border: '1px solid #E2E8F0' }}>
            <h3 style={{ margin: '0 0 6px', fontSize: '1.08rem', fontWeight: 900, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
              <TrendingUp size={20} color="#16A34A" /> 3. วิเคราะห์คุณภาพการสอนรายวิชา & ดัชนีความสอดคล้องของคะแนน (ระหว่างภาค 70 : ปลายภาค 30)
            </h3>
            <div style={{ fontSize: '0.8rem', color: '#64748B', marginBottom: 14 }}>
              วิชาที่สอนดีและวัดผลได้มาตรฐาน คือวิชาที่นักเรียนทำข้อสอบปลายภาค (30) ได้สัดส่วนใกล้เคียงกับคะแนนเก็บ (70) และมีอัตราได้เกรด 3 ขึ้นไปสูง
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                <thead>
                  <tr style={{ background: '#0F172A', color: 'white' }}>
                    <th style={{ ...thDark, width: 50 }}>อันดับ</th>
                    <th style={{ ...thDark, width: 65 }}>ชั้น</th>
                    <th style={{ ...thDark, width: 85 }}>รหัสวิชา</th>
                    <th style={{ ...thDark, textAlign: 'left' }}>ชื่อรายวิชา</th>
                    <th style={{ ...thDark, textAlign: 'left', width: 170 }}>ครูผู้สอน</th>
                    <th style={{ ...thDark, width: 85 }}>% คะแนนเก็บ<br />(เต็ม 70)</th>
                    <th style={{ ...thDark, width: 85 }}>% ปลายภาค<br />(เต็ม 30)</th>
                    <th style={{ ...thDark, width: 80, background: '#0284C7' }}>GPA วิชา</th>
                    <th style={{ ...thDark, width: 90, background: '#15803D' }}>% เกรด 3+</th>
                    <th style={{ ...thDark, width: 165 }}>การประเมินคุณภาพการสอน</th>
                  </tr>
                </thead>
                <tbody>
                  {directorAnalytics.topTeachingSubjects.slice(0, 18).map((r, i) => {
                    const isBest = r.teachingStatus === 'ดีเยี่ยม (วัดผลเที่ยงตรง)';
                    const isWarn = r.teachingStatus === 'ควรนิเทศ/ซ่อมเสริม';
                    return (
                      <tr key={`${r.classId}_${r.code}`} style={{ borderBottom: '1px solid #E2E8F0' }}>
                        <td style={{ ...tdCell, fontWeight: 900, color: i < 5 ? '#EA580C' : '#475569' }}>
                          {i < 3 ? `🥇 ${i + 1}` : i + 1}
                        </td>
                        <td style={{ ...tdCell, fontWeight: 800 }}>{r.shortName}</td>
                        <td style={{ ...tdCell, fontWeight: 700, color: '#475569' }}>{r.code}</td>
                        <td style={{ ...tdCell, textAlign: 'left', fontWeight: 800, color: '#0F172A' }}>{r.name}</td>
                        <td style={{ ...tdCell, textAlign: 'left', color: '#334155', fontWeight: 700 }}>{r.teacher}</td>
                        <td style={{ ...tdCell, fontWeight: 700 }}>{r.avgCourseworkPct.toFixed(1)}%</td>
                        <td style={{ ...tdCell, fontWeight: 800, color: r.avgFinalExamPct >= 65 ? '#15803D' : '#B45309' }}>
                          {r.avgFinalExamPct.toFixed(1)}%
                        </td>
                        <td style={{ ...tdCell, fontWeight: 900, color: '#0284C7', background: '#F0F9FF' }}>
                          {r.avgGrade.toFixed(2)}
                        </td>
                        <td style={{ ...tdCell, fontWeight: 900, color: '#15803D' }}>
                          {r.pct3Up.toFixed(1)}%
                        </td>
                        <td style={tdCell}>
                          <span style={{
                            padding: '4px 10px',
                            borderRadius: 999,
                            fontSize: '0.73rem',
                            fontWeight: 800,
                            background: isBest ? '#DCFCE7' : isWarn ? '#FEF3C7' : '#E0F2FE',
                            color: isBest ? '#166534' : isWarn ? '#92400E' : '#0369A1',
                          }}>
                            {r.teachingStatus}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* MODULE 4: เรดาร์ติดตามพัฒนาการผู้เรียน & คัดกรองเด็กเก่ง / เด็กต้องซ่อมเสริม */}
          <div style={{ background: '#FFFFFF', borderRadius: 16, padding: 20, border: '1px solid #E2E8F0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.08rem', fontWeight: 900, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Users size={20} color="#8B5CF6" /> 4. ทะเบียนติดตามพัฒนาการผู้เรียนรายบุคคล (เด็กเก่ง / พัฒนาการพุ่ง / ต้องซ่อมเสริม)
                </h3>
                <div style={{ fontSize: '0.8rem', color: '#64748B', marginTop: 2 }}>
                  แยกกลุ่มนักเรียนอัตโนมัติเพื่อให้ผู้บริหารและครูประจำชั้นส่งเสริมเด็กเก่ง ส่งแข่งขัน และซ่อมเสริมเด็กที่อ่อนได้ตรงจุด
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#334155' }}>กรองตามชั้น:</span>
                <select
                  value={selectedRiskClass}
                  onChange={e => setSelectedRiskClass(e.target.value)}
                  style={{ padding: '7px 12px', borderRadius: 8, border: '1.5px solid #CBD5E1', fontWeight: 800, fontSize: '0.82rem' }}
                >
                  <option value="all">ทุกชั้นเรียน (ป.1 – ม.3)</option>
                  {classesData.map(c => (
                    <option key={c.classId} value={c.classId}>ชั้น {c.shortName}/1 ({c.className})</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: 16 }}>
              {/* กล่องที่ 1: เด็กเก่งยอดเยี่ยม */}
              <div style={{ border: '1px solid #BBF7D0', borderRadius: 14, overflow: 'hidden', background: '#F0FDF4' }}>
                <div style={{ background: '#15803D', color: 'white', padding: '10px 14px', fontWeight: 900, fontSize: '0.88rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>🏆 กลุ่มคนเก่งคลองมดแดง (GPA ≥ 3.50)</span>
                  <span>{directorAnalytics.topPerformers.length} คน</span>
                </div>
                <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflowY: 'auto' }}>
                  {directorAnalytics.topPerformers.map((st, idx) => (
                    <div key={st.code} style={{ background: 'white', padding: '8px 12px', borderRadius: 10, border: '1px solid #DCFCE7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 800, color: '#0F172A', fontSize: '0.84rem' }}>
                          {idx + 1}. {st.name} <span style={{ color: '#0284C7' }}>({st.shortName})</span>
                        </div>
                        <div style={{ fontSize: '0.73rem', color: '#15803D', fontWeight: 700 }}>
                          เด่นสุด: {st.bestSubject}
                        </div>
                      </div>
                      <span style={{ background: '#DCFCE7', color: '#166534', padding: '4px 10px', borderRadius: 999, fontWeight: 900, fontSize: '0.82rem' }}>
                        {st.gpaFormatted}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* กล่องที่ 2: พัฒนาการปลายภาคโดดเด่น */}
              <div style={{ border: '1px solid #BAE6FD', borderRadius: 14, overflow: 'hidden', background: '#F0F9FF' }}>
                <div style={{ background: '#0284C7', color: 'white', padding: '10px 14px', fontWeight: 900, fontSize: '0.88rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>🚀 กลุ่มพัฒนาการปลายภาคโดดเด่น (Rising Stars)</span>
                  <span>{directorAnalytics.risingStars.length} คน</span>
                </div>
                <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflowY: 'auto' }}>
                  {directorAnalytics.risingStars.map((st, idx) => (
                    <div key={st.code} style={{ background: 'white', padding: '8px 12px', borderRadius: 10, border: '1px solid #E0F2FE', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 800, color: '#0F172A', fontSize: '0.84rem' }}>
                          {idx + 1}. {st.name} <span style={{ color: '#0284C7' }}>({st.shortName})</span>
                        </div>
                        <div style={{ fontSize: '0.73rem', color: '#0369A1', fontWeight: 700 }}>
                          วิชาเด่น: {st.bestSubject}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 900, color: '#0284C7', fontSize: '0.82rem' }}>GPA {st.gpaFormatted}</div>
                        <div style={{ fontSize: '0.68rem', color: '#16A34A', fontWeight: 800 }}>
                          📈 พัฒนาการดี
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* กล่องที่ 3: กลุ่มต้องซ่อมเสริม / ดูแลพิเศษ */}
              <div style={{ border: '1px solid #FECACA', borderRadius: 14, overflow: 'hidden', background: '#FEF2F2' }}>
                <div style={{ background: '#DC2626', color: 'white', padding: '10px 14px', fontWeight: 900, fontSize: '0.88rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>⚠️ กลุ่มเฝ้าระวัง / ควรเสริมรายวิชา</span>
                  <span>{directorAnalytics.needSupport.length} คน</span>
                </div>
                <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflowY: 'auto' }}>
                  {directorAnalytics.needSupport.length === 0 ? (
                    <div style={{ padding: 24, textAlign: 'center', color: '#15803D', fontWeight: 800, fontSize: '0.85rem' }}>
                      <CheckCircle2 size={24} style={{ margin: '0 auto 6px', display: 'block' }} />
                      นักเรียนทุกคนผ่านเกณฑ์มาตรฐาน ไม่มีผู้ติด 0/ร/มส
                    </div>
                  ) : (
                    directorAnalytics.needSupport.map((st, idx) => (
                      <div key={st.code} style={{ background: 'white', padding: '8px 12px', borderRadius: 10, border: '1px solid #FEE2E2', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 800, color: '#0F172A', fontSize: '0.84rem' }}>
                            {idx + 1}. {st.name} <span style={{ color: '#DC2626' }}>({st.shortName})</span>
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#B91C1C', fontWeight: 700 }}>
                            {st.weakSubjects.length > 0
                              ? `ควรเสริม: ${st.weakSubjects.slice(0, 2).join(', ')}`
                              : 'ควรเสริมทักษะพื้นฐานเพื่อยกระดับ GPA'}
                          </div>
                        </div>
                        <span style={{ background: '#FEE2E2', color: '#991B1B', padding: '4px 10px', borderRadius: 999, fontWeight: 900, fontSize: '0.82rem' }}>
                          {st.gpaFormatted}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= VIEW 2: GRADE DISTRIBUTION TABLE BY SUBJECT GROUP ================= */}
      {viewMode === 'table' && (
        <div className="no-print">
          {/* Semester Selector & Info Banner */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: 14,
            padding: '16px 20px',
            marginBottom: 16,
            border: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16,
          }}>
            <div style={{ minWidth: 260 }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#0284C7', marginBottom: 4 }}>
                📅 ปีการศึกษา / ภาคเรียน
              </label>
              <select
                value={semester}
                onChange={e => setSemester(e.target.value)}
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 8,
                  border: '1.5px solid #0284C7', fontWeight: 700, fontSize: '0.86rem', color: '#0F172A',
                }}
              >
                <option value="เทอม 1/2569 (ปัจจุบัน)">เทอม 1/2569 (ปัจจุบัน)</option>
                <option value="เทอม 2/2569">เทอม 2/2569</option>
                <option value="ตลอดปีการศึกษา 2569">ตลอดปีการศึกษา 2569</option>
              </select>
            </div>
            <div style={{
              flex: 1, minWidth: 260, fontSize: '0.8rem', color: '#475569',
              display: 'flex', alignItems: 'center', gap: 6, paddingTop: 14,
            }}>
              <Info size={16} color="#0284C7" style={{ flexShrink: 0 }} />
              <span>
                ข้อมูลด้านล่างดึงตรงจากคะแนน ปพ.5 และเรียงลำดับตาม <b>ระดับชั้น → ห้องเรียน → รหัสวิชา</b> อัตโนมัติ
              </span>
            </div>
          </div>

          {/* Subject Group Filter Pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
            {SUBJECT_GROUPS.map(grp => {
              const active = selectedGroup === grp;
              return (
                <button
                  key={grp}
                  type="button"
                  onClick={() => setSelectedGroup(grp)}
                  style={{
                    padding: '8px 15px',
                    borderRadius: 999,
                    border: active ? '2px solid #F59E0B' : '1px solid #CBD5E1',
                    background: active ? '#F59E0B' : '#FFFFFF',
                    color: active ? '#FFFFFF' : '#1E293B',
                    fontWeight: 800,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    boxShadow: active ? '0 4px 12px rgba(245,158,11,0.35)' : '0 1px 3px rgba(0,0,0,0.04)',
                    transition: 'all 0.15s',
                  }}
                >
                  <span>{GROUP_ICONS[grp] || '📚'}</span>
                  <span>{grp}</span>
                </button>
              );
            })}
          </div>

          {/* Main Grade Distribution Table Card */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: 16,
            border: '1px solid #E2E8F0',
            boxShadow: '0 4px 18px rgba(15,23,42,0.04)',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #F1F5F9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 10,
            }}>
              <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#D97706', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>{GROUP_ICONS[selectedGroup] || '🧪'}</span>
                <span>สรุปผลสัมฤทธิ์: {selectedGroup}</span>
              </div>
              <div style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 700 }}>
                แสดง <b>{filteredRows.length}</b> จากทั้งหมด <b>{searchedRows.length}</b> รายวิชา
              </div>
            </div>

            <div style={{
              padding: '10px 20px',
              background: '#F8FAFC',
              borderBottom: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 10,
              fontSize: '0.8rem',
              color: '#475569',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                แสดง
                <select
                  value={rowsLimit}
                  onChange={e => setRowsLimit(Number(e.target.value))}
                  style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #CBD5E1', fontWeight: 700 }}
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={150}>ทั้งหมด (150)</option>
                </select>
                แถว
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>ค้นหาวิชา/ชั้น/ครู:</span>
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: 8, color: '#94A3B8' }} />
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="เช่น ม.1, ว21101, ครู..."
                    style={{
                      padding: '5px 12px 5px 30px',
                      borderRadius: 8,
                      border: '1px solid #CBD5E1',
                      fontSize: '0.8rem',
                      width: 220,
                    }}
                  />
                </div>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                <thead>
                  <tr>
                    <th style={{ ...thDark, width: 74 }}>ระดับชั้น</th>
                    <th style={{ ...thDark, width: 54 }}>ห้อง</th>
                    <th style={{ ...thDark, width: 88 }}>รหัสวิชา</th>
                    <th style={{ ...thDark, textAlign: 'left' }}>ชื่อรายวิชา</th>
                    <th style={{ ...thDark, textAlign: 'left', width: 165 }}>ครูผู้สอน</th>
                    <th style={{ ...thDark, width: 76 }}>รวม(คน)</th>
                    <th style={{ ...thGrade, background: '#15803D' }}>4</th>
                    <th style={{ ...thGrade, background: '#15803D' }}>3.5</th>
                    <th style={{ ...thGrade, background: '#1D4ED8' }}>3</th>
                    <th style={{ ...thGrade, background: '#1D4ED8' }}>2.5</th>
                    <th style={{ ...thGrade, background: '#F59E0B', color: '#0F172A' }}>2</th>
                    <th style={{ ...thGrade, background: '#F59E0B', color: '#0F172A' }}>1.5</th>
                    <th style={{ ...thGrade, background: '#DC2626' }}>1</th>
                    <th style={{ ...thGrade, background: '#DC2626' }}>0</th>
                    <th style={{ ...thGrade, background: '#64748B' }}>ร</th>
                    <th style={{ ...thGrade, background: '#64748B' }}>มส</th>
                    <th style={{ ...thDark, width: 78 }}>GPA วิชา</th>
                    <th style={{ ...thDark, width: 88 }}>% 3 ขึ้นไป</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map(row => (
                    <tr
                      key={`${row.classId}_${row.code}`}
                      style={{ borderBottom: '1px solid #E2E8F0', transition: 'background 0.12s' }}
                      onMouseOver={e => (e.currentTarget.style.background = '#F8FAFC')}
                      onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ ...tdCell, fontWeight: 900, color: '#0F172A' }}>{row.shortName}</td>
                      <td style={{ ...tdCell, fontWeight: 800, color: '#2563EB' }}>{row.room}</td>
                      <td style={{ ...tdCell, color: '#475569', fontWeight: 700 }}>{row.code}</td>
                      <td style={{ ...tdCell, textAlign: 'left', fontWeight: 800, color: '#1E293B' }}>{row.name}</td>
                      <td style={{ ...tdCell, textAlign: 'left', color: '#475569', fontSize: '0.78rem' }}>{row.teacher}</td>
                      <td style={{ ...tdCell, fontWeight: 900, background: '#F8FAFC', color: '#0F172A' }}>
                        {row.totalStudents}
                      </td>
                      <td style={{ ...tdCell, fontWeight: 900, color: row.counts['4'] > 0 ? '#15803D' : '#CBD5E1' }}>{row.counts['4']}</td>
                      <td style={{ ...tdCell, fontWeight: 900, color: row.counts['3.5'] > 0 ? '#15803D' : '#CBD5E1' }}>{row.counts['3.5']}</td>
                      <td style={{ ...tdCell, fontWeight: 900, color: row.counts['3'] > 0 ? '#1D4ED8' : '#CBD5E1' }}>{row.counts['3']}</td>
                      <td style={{ ...tdCell, fontWeight: 900, color: row.counts['2.5'] > 0 ? '#1D4ED8' : '#CBD5E1' }}>{row.counts['2.5']}</td>
                      <td style={{ ...tdCell, fontWeight: 800, color: row.counts['2'] > 0 ? '#0F172A' : '#CBD5E1' }}>{row.counts['2']}</td>
                      <td style={{ ...tdCell, fontWeight: 800, color: row.counts['1.5'] > 0 ? '#0F172A' : '#CBD5E1' }}>{row.counts['1.5']}</td>
                      <td style={{ ...tdCell, fontWeight: 800, color: row.counts['1'] > 0 ? '#DC2626' : '#CBD5E1' }}>{row.counts['1']}</td>
                      <td style={{
                        ...tdCell,
                        fontWeight: 900,
                        color: row.counts['0'] > 0 ? '#DC2626' : '#CBD5E1',
                        background: row.counts['0'] > 0 ? '#FEE2E2' : 'transparent',
                      }}>
                        {row.counts['0']}
                      </td>
                      <td style={{ ...tdCell, color: row.counts['ร'] > 0 ? '#DC2626' : '#CBD5E1' }}>{row.counts['ร']}</td>
                      <td style={{ ...tdCell, color: row.counts['มส'] > 0 ? '#DC2626' : '#CBD5E1' }}>{row.counts['มส']}</td>
                      <td style={{ ...tdCell, fontWeight: 900, color: '#0284C7', background: '#F0F9FF' }}>
                        {row.group === 'กิจกรรมพัฒนาผู้เรียน' ? 'ผ' : row.avgGrade.toFixed(2)}
                      </td>
                      <td style={{ ...tdCell, fontWeight: 800, color: '#15803D' }}>
                        {row.pct3Up.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#FFFBEB', borderTop: '2px solid #F59E0B', fontWeight: 900 }}>
                    <td colSpan={5} style={{ ...tdCell, textAlign: 'right', paddingRight: 16, color: '#92400E' }}>
                      รวมทั้งสิ้น ({searchedRows.length} รายวิชา)
                    </td>
                    <td style={{ ...tdCell, color: '#0F172A' }}>{totals.students}</td>
                    <td style={{ ...tdCell, color: '#15803D' }}>{totals['4']}</td>
                    <td style={{ ...tdCell, color: '#15803D' }}>{totals['3.5']}</td>
                    <td style={{ ...tdCell, color: '#1D4ED8' }}>{totals['3']}</td>
                    <td style={{ ...tdCell, color: '#1D4ED8' }}>{totals['2.5']}</td>
                    <td style={{ ...tdCell, color: '#B45309' }}>{totals['2']}</td>
                    <td style={{ ...tdCell, color: '#B45309' }}>{totals['1.5']}</td>
                    <td style={{ ...tdCell, color: '#DC2626' }}>{totals['1']}</td>
                    <td style={{ ...tdCell, color: '#DC2626' }}>{totals['0']}</td>
                    <td style={{ ...tdCell, color: '#64748B' }}>{totals['ร']}</td>
                    <td style={{ ...tdCell, color: '#64748B' }}>{totals['มส']}</td>
                    <td style={{ ...tdCell, color: '#0284C7', background: '#F0F9FF' }}>
                      {selectedGroup === 'กิจกรรมพัฒนาผู้เรียน' ? '-' : totals.avgGrade.toFixed(2)}
                    </td>
                    <td style={{ ...tdCell, color: '#15803D' }}>
                      {totals.pct3Up.toFixed(1)}%
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= OFFICIAL A4 EXECUTIVE PRINT REPORT ================= */}
      <div className="only-print-exec-acad print-area">
        <div style={{ textAlign: 'center', marginBottom: 10 }}>
          <img
            src={`${import.meta.env.BASE_URL}school_logo_kmd.png`}
            alt="ตราโรงเรียน"
            style={{ width: 54, height: 54, objectFit: 'contain', margin: '0 auto 4px' }}
          />
          <div style={{ fontSize: '14pt', fontWeight: 800 }}>
            รายงานสรุปผลสัมฤทธิ์ทางการเรียนและการวิเคราะห์คุณภาพการจัดการเรียนรู้ (สำหรับผู้บริหาร)
          </div>
          <div style={{ fontSize: '11pt', fontWeight: 700 }}>
            {SCHOOL_NAME} &nbsp; {SCHOOL_AFFILIATION} &nbsp;|&nbsp; {semester} &nbsp;|&nbsp; GPA เฉลี่ยทั้งโรงเรียน: {directorAnalytics.schoolAvgGpa.toFixed(2)}
          </div>
        </div>

        <div style={{ fontWeight: 800, fontSize: '10.5pt', marginBottom: 4 }}>
          1. สรุปผลสัมฤทธิ์รายชั้นเรียน (วิชาที่นักเรียนเก่งที่สุด และวิชาที่ต้องเร่งยกระดับ)
        </div>
        <table className="exec-print-table" style={{ marginBottom: 12 }}>
          <thead>
            <tr>
              <th style={{ width: '9%' }}>ชั้น</th>
              <th style={{ width: '9%' }}>จำนวน</th>
              <th style={{ width: '10%' }}>GPA ห้อง</th>
              <th style={{ width: '36%' }}>วิชาที่ผลสัมฤทธิ์สูงสุด (จุดแข็ง)</th>
              <th style={{ width: '36%' }}>วิชาที่ควรเสริมเร่งด่วน (จุดที่ต้องพัฒนา)</th>
            </tr>
          </thead>
          <tbody>
            {directorAnalytics.classStrengthWeakness.map(r => (
              <tr key={r.classId}>
                <td style={{ textAlign: 'center', fontWeight: 700 }}>{r.shortName}/1</td>
                <td style={{ textAlign: 'center' }}>{r.studentCount} คน</td>
                <td style={{ textAlign: 'center', fontWeight: 800 }}>{r.classAvgGpa.toFixed(2)}</td>
                <td>
                  {r.strongest ? `${r.strongest.code} ${r.strongest.name} (GPA ${r.strongest.avgGrade.toFixed(2)})` : '-'}
                </td>
                <td>
                  {r.weakest ? `${r.weakest.code} ${r.weakest.name} (GPA ${r.weakest.avgGrade.toFixed(2)})` : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ fontWeight: 800, fontSize: '10.5pt', marginBottom: 4 }}>
          2. อันดับผลสัมฤทธิ์แยกตาม 8 กลุ่มสาระการเรียนรู้
        </div>
        <table className="exec-print-table" style={{ marginBottom: 18 }}>
          <thead>
            <tr>
              <th style={{ width: '8%' }}>อันดับ</th>
              <th style={{ width: '32%' }}>กลุ่มสาระการเรียนรู้</th>
              <th style={{ width: '20%' }}>เกรดเฉลี่ยรวม (GPA)</th>
              <th style={{ width: '20%' }}>ร้อยละเกรด 3 ขึ้นไป</th>
              <th style={{ width: '20%' }}>การประเมินคุณภาพ</th>
            </tr>
          </thead>
          <tbody>
            {directorAnalytics.groupRanking.map((g, i) => (
              <tr key={g.key}>
                <td style={{ textAlign: 'center', fontWeight: 700 }}>{i + 1}</td>
                <td>{g.label}</td>
                <td style={{ textAlign: 'center', fontWeight: 800 }}>{g.avgGpa.toFixed(2)}</td>
                <td style={{ textAlign: 'center', fontWeight: 700 }}>{g.avgPct3Up.toFixed(1)}%</td>
                <td style={{ textAlign: 'center' }}>
                  {g.avgGpa >= 3.0 ? 'ดีเยี่ยม' : g.avgGpa >= 2.5 ? 'ดี' : 'ควรส่งเสริม'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, textAlign: 'center', fontSize: '10.5pt', marginTop: 20 }}>
          <div>
            <div>ลงชื่อ .......................................................... หัวหน้างานวิชาการ</div>
            <div style={{ marginTop: 4 }}>(..........................................................)</div>
          </div>
          <div>
            <div>ลงชื่อ .......................................................... ผู้อำนวยการโรงเรียน</div>
            <div style={{ fontWeight: 800, marginTop: 4 }}>({DIRECTOR_NAME})</div>
            <div>ผู้อำนวยการ{SCHOOL_NAME}</div>
          </div>
        </div>
      </div>

      <style>{`
        .only-print-exec-acad { display: none; }
        .exec-print-table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
        .exec-print-table th, .exec-print-table td { border: 1px solid #000; padding: 4px 6px; }
        .exec-print-table th { background: #F1F5F9; font-weight: 800; text-align: center; }
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          .no-print { display: none !important; }
          .only-print-exec-acad {
            display: block !important;
            font-family: 'Sarabun', 'TH SarabunPSK', sans-serif;
            color: #000;
          }
        }
      `}</style>
    </SmartSchoolLayout>
  );
}

const thDark: React.CSSProperties = {
  background: '#1E293B',
  color: '#FFFFFF',
  padding: '11px 8px',
  fontWeight: 800,
  fontSize: '0.78rem',
  textAlign: 'center',
  borderRight: '1px solid rgba(255,255,255,0.1)',
};

const thGrade: React.CSSProperties = {
  color: '#FFFFFF',
  padding: '11px 6px',
  fontWeight: 900,
  fontSize: '0.8rem',
  textAlign: 'center',
  width: 46,
  borderRight: '1px solid rgba(255,255,255,0.18)',
};

const tdCell: React.CSSProperties = {
  padding: '10px 8px',
  textAlign: 'center',
  borderRight: '1px solid #F1F5F9',
};
