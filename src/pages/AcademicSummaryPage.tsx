import { useState, useMemo } from 'react';
import { Download, Search, Printer, Info } from 'lucide-react';
import SmartSchoolLayout from '../components/SmartSchoolLayout';
import TeacherLoginGate from '../components/TeacherLoginGate';
import { useTeacherAuth } from '../utils/teacherAuth';
import { useAcademicData } from '../utils/academicStorage';
import { SUBJECT_GROUPS } from '../data/academicData';
import { downloadCsvReport } from '../utils/csvReport';

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

export default function AcademicSummaryPage() {
  const auth = useTeacherAuth();
  if (!auth.authed) {
    return <TeacherLoginGate title="📊 สรุปผลสัมฤทธิ์ทางการเรียน (แยกตามกลุ่มสาระฯ)" />;
  }
  return <AcademicSummaryContent />;
}

function AcademicSummaryContent() {
  const { classesData } = useAcademicData();
  const [selectedGroup, setSelectedGroup] = useState<string>('วิทยาศาสตร์ฯ (พื้นฐาน)');
  const [semester, setSemester] = useState<string>('เทอม 1/2569 (ปัจจุบัน)');
  const [search, setSearch] = useState<string>('');
  const [rowsLimit, setRowsLimit] = useState<number>(50);

  const allDistRows = useMemo<SubjectDistRow[]>(() => {
    const rows: SubjectDistRow[] = [];

    for (const cls of classesData) {
      if (selectedGroup === 'กิจกรรมพัฒนาผู้เรียน') {
        for (const act of cls.activities) {
          const passCount = cls.students.filter(s => s.activityResult === 'ผ่าน').length;
          const failCount = cls.students.length - passCount;
          rows.push({
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
          });
        }
        continue;
      }

      for (const subj of cls.subjects) {
        if (selectedGroup !== 'ทั้งหมด (ทุกกลุ่มสาระฯ)' && subj.group !== selectedGroup) {
          continue;
        }
        const counts = {
          '4': 0, '3.5': 0, '3': 0, '2.5': 0,
          '2': 0, '1.5': 0, '1': 0, '0': 0, 'ร': 0, 'มส': 0,
        };
        let gradeSum = 0;
        let gradedCount = 0;

        for (const st of cls.students) {
          const sc = st.scores[subj.code];
          const g = sc ? sc.grade : '0';
          if (g in counts) {
            counts[g as keyof typeof counts] += 1;
          }
          const gNum = parseFloat(g);
          if (!isNaN(gNum)) {
            gradeSum += gNum;
            gradedCount += 1;
          }
        }

        const total = cls.students.length;
        const count3Up = counts['4'] + counts['3.5'] + counts['3'];
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
          avgGrade: gradedCount > 0 ? gradeSum / gradedCount : 0,
          pct3Up: total > 0 ? (count3Up / total) * 100 : 0,
        });
      }
    }
    return rows;
  }, [classesData, selectedGroup]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allDistRows
      .filter(
        r =>
          !q ||
          r.shortName.toLowerCase().includes(q) ||
          r.code.toLowerCase().includes(q) ||
          r.name.toLowerCase().includes(q) ||
          r.teacher.toLowerCase().includes(q)
      )
      .slice(0, rowsLimit);
  }, [allDistRows, search, rowsLimit]);

  const totals = useMemo(() => {
    const t = {
      students: 0,
      '4': 0, '3.5': 0, '3': 0, '2.5': 0,
      '2': 0, '1.5': 0, '1': 0, '0': 0, 'ร': 0, 'มส': 0,
    };
    for (const r of filteredRows) {
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
    }
    return t;
  }, [filteredRows]);

  const exportExcelCsv = () => {
    const rows: Array<Array<string | number>> = [
      ['รายงานสรุปผลสัมฤทธิ์ทางการเรียน โรงเรียนบ้านคลองมดแดง'],
      ['กลุ่มสาระ/หมวดวิชา:', selectedGroup, 'ภาคเรียน:', semester],
      [],
      ['ระดับชั้น', 'ห้อง', 'รหัสวิชา', 'ชื่อรายวิชา', 'ครูผู้สอน', 'รวม(คน)', '4', '3.5', '3', '2.5', '2', '1.5', '1', '0', 'ร', 'มส', 'เกรดเฉลี่ย', 'ร้อยละ 3 ขึ้นไป'],
      ...filteredRows.map(r => [
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
        r.avgGrade.toFixed(2),
        `${r.pct3Up.toFixed(1)}%`,
      ]),
      [
        'รวมทั้งหมด', '', '', '', '',
        totals.students,
        totals['4'], totals['3.5'], totals['3'], totals['2.5'],
        totals['2'], totals['1.5'], totals['1'], totals['0'],
        totals['ร'], totals['มส'], '', '',
      ],
    ];
    downloadCsvReport(`สรุปผลสัมฤทธิ์_${selectedGroup}_1-2569.csv`, rows);
  };

  return (
    <SmartSchoolLayout pageTitle="ระบบบริหารจัดการโรงเรียน">
      {/* Top Title & Export Button (matching Screenshot 2) */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 18,
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 900, color: '#0284C7', display: 'flex', alignItems: 'center', gap: 8 }}>
            📊 สรุปผลสัมฤทธิ์ทางการเรียน (แยกตามกลุ่มสาระฯ)
          </h1>
          <div style={{ fontSize: '0.82rem', color: '#64748B', marginTop: 2 }}>
            แสดงข้อมูลและวิเคราะห์ผลการประเมินรายวิชาตั้งแต่ ป.1 ถึง ม.3 · โรงเรียนบ้านคลองมดแดง
          </div>
        </div>

        <div className="no-print" style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => window.print()}
            style={{
              background: '#FFFFFF', color: '#334155', border: '1px solid #CBD5E1',
              borderRadius: 999, padding: '9px 16px', fontWeight: 800, fontSize: '0.84rem',
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            <Printer size={15} /> พิมพ์ตาราง
          </button>
          <button
            type="button"
            onClick={exportExcelCsv}
            style={{
              background: '#15803D',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: 999,
              padding: '9px 20px',
              fontWeight: 900,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              boxShadow: '0 4px 14px rgba(21,128,61,0.3)',
            }}
          >
            <Download size={16} /> ดาวน์โหลด Excel กลุ่มสาระฯ
          </button>
        </div>
      </div>

      {/* Semester Selector & Info Banner (matching Screenshot 2) */}
      <div
        className="no-print"
        style={{
          background: '#FFFFFF',
          borderRadius: 14,
          padding: '16px 20px',
          marginBottom: 16,
          border: '1px solid #E2E8F0',
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
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
            ข้อมูลด้านล่างถูกจัดเรียงตามหมวดหมู่กลุ่มวิชา และเรียงลำดับตาม <b>ระดับชั้น → ห้องเรียน → รหัสวิชา</b> อัตโนมัติ เพื่อให้ง่ายต่อการวิเคราะห์ผลสัมฤทธิ์
          </span>
        </div>
      </div>

      {/* Subject Group Filter Pills (matching Screenshot 2) */}
      <div
        className="no-print"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          marginBottom: 18,
        }}
      >
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

      {/* Main Grade Distribution Table Card (matching Screenshot 2) */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: 16,
        border: '1px solid #E2E8F0',
        boxShadow: '0 4px 18px rgba(15,23,42,0.04)',
        overflow: 'hidden',
      }}>
        {/* Card Title */}
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
            จำนวนรายวิชาที่แสดง: <b>{filteredRows.length}</b> รายวิชา
          </div>
        </div>

        {/* Table Toolbar */}
        <div
          className="no-print"
          style={{
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
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            แสดง
            <select
              value={rowsLimit}
              onChange={e => setRowsLimit(Number(e.target.value))}
              style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #CBD5E1', fontWeight: 700 }}
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            แถว
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>ค้นหาวิชา/ชั้น:</span>
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
                  width: 210,
                }}
              />
            </div>
          </div>
        </div>

        {/* Grade Distribution Grid */}
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
                {/* Color-coded Grade Headers matching Screenshot 2 */}
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
                  {/* Grade Counts */}
                  <td style={{ ...tdCell, fontWeight: 900, color: row.counts['4'] > 0 ? '#15803D' : '#CBD5E1' }}>
                    {row.counts['4']}
                  </td>
                  <td style={{ ...tdCell, fontWeight: 900, color: row.counts['3.5'] > 0 ? '#15803D' : '#CBD5E1' }}>
                    {row.counts['3.5']}
                  </td>
                  <td style={{ ...tdCell, fontWeight: 900, color: row.counts['3'] > 0 ? '#1D4ED8' : '#CBD5E1' }}>
                    {row.counts['3']}
                  </td>
                  <td style={{ ...tdCell, fontWeight: 900, color: row.counts['2.5'] > 0 ? '#1D4ED8' : '#CBD5E1' }}>
                    {row.counts['2.5']}
                  </td>
                  <td style={{ ...tdCell, fontWeight: 800, color: row.counts['2'] > 0 ? '#0F172A' : '#CBD5E1' }}>
                    {row.counts['2']}
                  </td>
                  <td style={{ ...tdCell, fontWeight: 800, color: row.counts['1.5'] > 0 ? '#0F172A' : '#CBD5E1' }}>
                    {row.counts['1.5']}
                  </td>
                  <td style={{ ...tdCell, fontWeight: 800, color: row.counts['1'] > 0 ? '#DC2626' : '#CBD5E1' }}>
                    {row.counts['1']}
                  </td>
                  <td style={{
                    ...tdCell,
                    fontWeight: 900,
                    color: row.counts['0'] > 0 ? '#DC2626' : '#CBD5E1',
                    background: row.counts['0'] > 0 ? '#FEE2E2' : 'transparent',
                  }}>
                    {row.counts['0']}
                  </td>
                  <td style={{ ...tdCell, color: row.counts['ร'] > 0 ? '#DC2626' : '#CBD5E1' }}>
                    {row.counts['ร']}
                  </td>
                  <td style={{ ...tdCell, color: row.counts['มส'] > 0 ? '#DC2626' : '#CBD5E1' }}>
                    {row.counts['มส']}
                  </td>
                  <td style={{ ...tdCell, fontWeight: 900, color: '#0284C7', background: '#F0F9FF' }}>
                    {row.avgGrade.toFixed(2)}
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
                  รวมทั้งสิ้น ({filteredRows.length} รายวิชา)
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
                <td colSpan={2} style={tdCell}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
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
