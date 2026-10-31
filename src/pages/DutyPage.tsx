import AttendanceTallyReport, { type TallyConfig } from '../components/AttendanceTallyReport';

const DUTY: TallyConfig = {
  title: 'รายงานการทำเวรประจำวัน',
  icon: '🧹',
  color: '#047857',
  colorLight: '#059669',
  flag: 'noDuty',
  countedLabel: 'มาทำเวร',
  unit: 'คน-ครั้ง',
  rule: <>นักเรียนที่ <b>"มาเรียน"</b> = มาทำเวร</>,
  printFormType: 'duty',
  csvFilePrefix: 'รายงานการทำเวร',
};

export default function DutyPage() {
  return <AttendanceTallyReport config={DUTY} />;
}
