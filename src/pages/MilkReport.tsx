import AttendanceTallyReport, { type TallyConfig } from '../components/AttendanceTallyReport';

const MILK: TallyConfig = {
  title: 'รายงานการดื่มนม',
  icon: '🥛',
  color: '#1D4ED8',
  colorLight: '#3B82F6',
  flag: 'noMilk',
  countedLabel: 'ได้รับนม',
  unit: 'กล่อง',
  rule: <>นักเรียนที่ <b>"มาเรียน"</b> = ได้รับนม</>,
  printFormType: 'milk',
  csvFilePrefix: 'รายงานนม',
  extraLink: { to: '/brush-log', label: '🪥 → แปรงฟัน' },
};

export default function MilkReportPage() {
  return <AttendanceTallyReport config={MILK} />;
}
