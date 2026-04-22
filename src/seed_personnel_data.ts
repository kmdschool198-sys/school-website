
import { db } from './firebase';
import { collection, addDoc } from 'firebase/firestore';

const personnelData = [
  { name: 'นาย ปรัชญา ปรางค์ชัยภูมิ', pos: 'ผู้อำนวยการสถานศึกษา', major: 'ดนตรีศึกษา/การบริหารการศึกษา', posNum: '610', phone: '0880998990', cat: 'director', wg: 'management' },
  { name: 'นางสาว เจนจีรา บุญเกตุ', pos: 'รองผู้อำนวยการสถานศึกษา', major: 'จุลชีววิทยา/การบริหารการศึกษา', posNum: '1975', phone: '0973061350', cat: 'director', wg: 'management' },
  { name: 'นาย พีระ เดชะผล', pos: 'ครูชำนาญการ', major: 'ศิลปกรรม', posNum: '3048', phone: '0966653788', cat: 'teacher', wg: 'general' },
  { name: 'นางสาว จิราภา พานชัย', pos: 'ครู', major: 'ภาษาไทย', posNum: '2753', phone: '0640049333', cat: 'teacher', wg: 'budget' },
  { name: 'นางสาว อาริษา ฉิมสุพร', pos: 'ครู', major: 'พลศึกษา', posNum: '2837', phone: '0645502691', cat: 'teacher', wg: 'personnel' },
  { name: 'นางสาว นริศรา ทำจิตรเหมาะ', pos: 'ครู', major: 'ภาษาไทย', posNum: '2284', phone: '0808185056', cat: 'teacher', wg: 'academic' },
  { name: 'นางสาว ธิดารัตน์ แรตสอน', pos: 'ครู', major: 'การศึกษาปฐมวัย', posNum: '2297', phone: '0951287927', cat: 'teacher', wg: 'budget' },
  { name: 'นาย อนันตชัย เพ็ชรรี่', pos: 'ครู', major: 'คอมพิวเตอร์', posNum: '4595', phone: '0638233966', cat: 'teacher', wg: 'general' },
  { name: 'นางสาว ไอยรดา อาจจีน', pos: 'ครู', major: 'นาฏศิลป์ไทย', posNum: '4083', phone: '0983395228', cat: 'teacher', wg: 'budget' },
  { name: 'นางสาว อรปภา หมื่นอภัย', pos: 'ครู', major: 'คณิตศาสตร์', posNum: '1663', phone: '0956264141', cat: 'teacher', wg: 'academic' },
  { name: 'นาย ธิติวุฒิ เตยไธสง', pos: 'ครู', major: 'สังคมศึกษา', posNum: '3005', phone: '0992392089', cat: 'teacher', wg: 'student' },
  { name: 'นาย นวพานิชณ์ วังคีรี', pos: 'ครูผู้ช่วย', major: 'การประถมศึกษา', posNum: '575', phone: '0863345994', cat: 'teacher', wg: 'general' },
  { name: 'นาย อรรถชัย แก้วเอี่ยม', pos: 'ครูผู้ช่วย', major: 'ภาษาอังกฤษ/การสอนภาษาอังกฤษ', posNum: '2849', phone: '0801463897', cat: 'teacher', wg: 'academic' },
  { name: 'นาย พิศุทธิ์ เชาวลิตโรจน์', pos: 'ครูผู้ช่วย', major: 'วิทยาศาสตร์ (เคมี)', posNum: '4850', phone: '0806404134', cat: 'teacher', wg: 'student' },
  { name: 'นางสาว ธญาภรณ์ คล้ายเพ็ง', pos: 'ครูผู้ช่วย', major: 'ภาษาอังกฤษ', posNum: '2098', phone: '0933068071', cat: 'teacher', wg: 'budget' },
  { name: 'นางสาว ณัฐณิชา ภักดี', pos: 'ครูผู้ช่วย', major: 'การศึกษาปฐมวัย', posNum: '2092', phone: '0910264479', cat: 'teacher', wg: 'personnel' },
  { name: 'นางสาว วิมลรัตน์ เจริญธัญญากร', pos: 'ครู', major: 'วิทยาการคอมพิวเตอร์', posNum: '535', phone: '0645192428', cat: 'teacher', wg: 'general' },
  { name: 'นาย กิตติชัย การะภักดี', pos: 'ครูขาดแคลนขั้นวิกฤต', major: 'สังคมศึกษา', posNum: 'จ1100330', phone: '0808423970', cat: 'teacher', wg: 'general' },
  { name: 'นางสาว ภัทรสุดา สุหงษา', pos: 'ธุรการ', major: 'สังคมศึกษา', posNum: 'จ2100671', phone: '0982368502', cat: 'support', wg: 'general' },
  { name: 'นาย เมธี ตรียาวรรณ', pos: 'ลูกจ้างประจำ', major: 'ช่างปูน', posNum: '3595', phone: '0645507085', cat: 'support', wg: 'general' }
];

export const seedPersonnel = async () => {
  console.log('Seeding personnel...');
  for (let i = 0; i < personnelData.length; i++) {
    const p = personnelData[i];
    await addDoc(collection(db, 'personnel'), {
      name: p.name,
      position: p.pos,
      major: p.major,
      positionNumber: p.posNum,
      phone: p.phone,
      category: p.cat,
      workGroup: p.wg,
      image: '',
      order: i + 1,
      isHead: p.cat === 'director'
    });
  }
  console.log('Seeding complete!');
};
