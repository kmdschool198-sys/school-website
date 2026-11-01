import AttendanceTallyReport, { type TallyConfig } from '../components/AttendanceTallyReport';

const BRUSH: TallyConfig = {
  title: 'รายงานการแปรงฟัน',
  icon: '🦷',
  color: '#0E7490',
  colorLight: '#0891B2',
  flag: 'noBrush',
  countedLabel: 'ได้แปรงฟัน',
  unit: 'คน-ครั้ง',
  rule: <>นักเรียนที่ <b>"มาเรียน"</b> = ได้แปรงฟันหลังอาหารกลางวัน</>,
  printFormType: 'brush',
  csvFilePrefix: 'รายงานแปรงฟัน',
  extraLink: { to: '/milk-report', label: '🥛 → นม' },
};

export default function BrushLogPage() {
  return <AttendanceTallyReport config={BRUSH} />;
}
