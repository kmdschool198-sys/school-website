import AttendanceTallyReport, { type TallyConfig } from '../components/AttendanceTallyReport';

const LUNCH_RATE_PER_HEAD = 22; // งบประมาณอาหารกลางวัน 22 บาท/คน/วัน

const LUNCH: TallyConfig = {
  title: 'รายงานอาหารกลางวัน',
  icon: '🍱',
  color: '#C2410C',
  colorLight: '#EA580C',
  flag: 'noLunch',
  countedLabel: 'ได้กินอาหารกลางวัน',
  unit: 'คน-มื้อ',
  rule: <>นักเรียนที่ <b>"มาเรียน"</b> = ได้กินอาหารกลางวัน ({LUNCH_RATE_PER_HEAD} บ./คน)</>,
  printFormType: 'lunch',
  ratePerHead: LUNCH_RATE_PER_HEAD,
  csvFilePrefix: 'รายงานอาหารกลางวัน',
};

export default function LunchPage() {
  return <AttendanceTallyReport config={LUNCH} />;
}
