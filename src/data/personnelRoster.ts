// รายชื่อบุคลากรตามเอกสารทางการของโรงเรียน — ใช้เป็นตัวตั้งต้นและตัวตรวจสอบ
// ว่าข้อมูลใน Firestore ครบหรือยัง (แหล่งเดียว ไม่ต้องพิมพ์ซ้ำหลายที่)
export interface OfficialPerson {
  name: string;
  pos: string;
  major: string;
  posNum: string;
  phone: string;
  cat: 'director' | 'teacher' | 'support';
  wg: string;
  image?: string;
}

export const OFFICIAL_PERSONNEL: OfficialPerson[] = [
  { name: 'นาย ปรัชญา ปรางค์ชัยภูมิ', pos: 'ผู้อำนวยการสถานศึกษา', major: 'ดนตรีศึกษา/การบริหารการศึกษา', posNum: '610', phone: '0880998990', cat: 'director', wg: 'management', image: 'https://drive.google.com/file/d/12GmmG9HGZfr9DjZjHm1Kw38XCUmb-3oK/view?usp=sharing' },
  { name: 'นางสาว เจนจีรา บุญเกตุ', pos: 'รองผู้อำนวยการสถานศึกษา', major: 'จุลชีววิทยา/การบริหารการศึกษา', posNum: '1975', phone: '0973061350', cat: 'director', wg: 'management', image: 'https://drive.google.com/file/d/1kuF-UZgg43BXIU8v_h2MmWv_oiZccLGz/view?usp=sharing' },
  { name: 'นาย พีระ เดชะผล', pos: 'ครูชำนาญการ', major: 'ศิลปกรรม', posNum: '3048', phone: '0966653788', cat: 'teacher', wg: 'general', image: 'https://drive.google.com/file/d/1rRWKclvbMb3Q36SL1hdLMeEQFCyM2wqF/view?usp=sharing' },
  { name: 'นางสาว จิราภา พานชัย', pos: 'ครู', major: 'ภาษาไทย', posNum: '2753', phone: '0640049333', cat: 'teacher', wg: 'budget', image: 'https://drive.google.com/file/d/1XuqXKA4CSvzZtQwu9o2c58oIKIPhxSx6/view?usp=sharing' },
  { name: 'นางสาว อาริษา ฉิมสุพร', pos: 'ครู', major: 'พลศึกษา', posNum: '2837', phone: '0645502691', cat: 'teacher', wg: 'personnel', image: 'https://drive.google.com/file/d/1a5Hk1Co6mOxbhf_4BX3zfJ52gLnN8z48/view?usp=sharing' },
  { name: 'นางสาว นริศรา ทำจิตรเหมาะ', pos: 'ครู', major: 'ภาษาไทย', posNum: '2284', phone: '0808185056', cat: 'teacher', wg: 'academic', image: 'https://drive.google.com/file/d/1qOLwT0yG9Y6ZmFjCnYmMMlOzZ_3CIeh7/view?usp=sharing' },
  { name: 'นางสาว ธิดารัตน์ แรตสอน', pos: 'ครู', major: 'การศึกษาปฐมวัย', posNum: '2297', phone: '0951287927', cat: 'teacher', wg: 'budget', image: 'https://drive.google.com/file/d/1wmJBAZpF5JWBFOD3aCNE6SoF9IxL1axR/view?usp=sharing' },
  { name: 'นาย อนันตชัย เพ็ชรรี่', pos: 'ครู', major: 'คอมพิวเตอร์', posNum: '4595', phone: '0638233966', cat: 'teacher', wg: 'general', image: 'https://drive.google.com/file/d/1BLj84VWJu3xEoe9zkdklGOXsYNu6h5nJ/view?usp=sharing' },
  { name: 'นางสาว ไอยรดา อาจจีน', pos: 'ครู', major: 'นาฏศิลป์ไทย', posNum: '4083', phone: '0983395228', cat: 'teacher', wg: 'budget', image: 'https://drive.google.com/file/d/1ZN5TTDWcE1BwC51OO7IUdK9IMcNbF8Ep/view?usp=sharing' },
  { name: 'นาย ธิติวุฒิ เตยไธสง', pos: 'ครู', major: 'สังคมศึกษา', posNum: '3005', phone: '0992392089', cat: 'teacher', wg: 'student', image: 'https://drive.google.com/file/d/1f8XkwcB41U7z6_HZ3084gmq5hvH9WxuG/view?usp=sharing' },
  { name: 'นาย นวพานิชณ์ วังคีรี', pos: 'ครูผู้ช่วย', major: 'การประถมศึกษา', posNum: '575', phone: '0863345994', cat: 'teacher', wg: 'general', image: 'https://drive.google.com/file/d/1FMmEg_GYPbkhW4TpxYlQS1_E1hg9L-z5/view?usp=sharing' },
  { name: 'นาย อรรถชัย แก้วเอี่ยม', pos: 'ครูผู้ช่วย', major: 'ภาษาอังกฤษ/การสอนภาษาอังกฤษ', posNum: '2849', phone: '0801463897', cat: 'teacher', wg: 'academic', image: 'https://drive.google.com/file/d/1szY_y-l3Vo_dxqrPSFe9cDj7OFdCq4hQ/view?usp=sharing' },
  { name: 'นาย พิศุทธิ์ เชาวลิตโรจน์', pos: 'ครูผู้ช่วย', major: 'วิทยาศาสตร์ (เคมี)', posNum: '4850', phone: '0806404134', cat: 'teacher', wg: 'student', image: 'https://drive.google.com/file/d/1W1VJMrNok3Ee5XdOa9KKIY-KhvRbdW7T/view?usp=sharing' },
  { name: 'นางสาว ธญาภรณ์ คล้ายเพ็ง', pos: 'ครูผู้ช่วย', major: 'ภาษาอังกฤษ', posNum: '2098', phone: '0933068071', cat: 'teacher', wg: 'budget', image: 'https://drive.google.com/file/d/1YmOaNdXfKhxBq_Pb9dOnKRPNuGcRFtZH/view?usp=sharing' },
  { name: 'นางสาว ณัฐณิชา ภักดี', pos: 'ครูผู้ช่วย', major: 'การศึกษาปฐมวัย', posNum: '2092', phone: '0910264479', cat: 'teacher', wg: 'personnel', image: 'https://drive.google.com/file/d/1a1HJV0Y5Dv6gRLdygujl5aOe7D38yxUK/view?usp=sharing' },
  { name: 'นางสาว ภัทรสุดา สุหงษา', pos: 'ธุรการ', major: 'สังคมศึกษา', posNum: 'จ2100671', phone: '0982368502', cat: 'support', wg: 'general', image: 'https://drive.google.com/file/d/1RlVmDHxBuYvh_VXbO2OuFLRm-0Ugr432/view?usp=sharing' },
  { name: 'นาย เมธี ตรียาวรรณ', pos: 'ลูกจ้างประจำ', major: 'ช่างปูน', posNum: '3595', phone: '0645507085', cat: 'support', wg: 'general', image: 'https://drive.google.com/file/d/1KeMbP4adYc8eowCzIGW7I0P-KQS_oAHN/view?usp=sharing' },
];

/** ตัดคำนำหน้าและช่องว่างออก เพื่อเทียบชื่อที่พิมพ์ต่างกันเล็กน้อยได้ */
export function normalizePersonName(name: string): string {
  return String(name || '')
    .replace(/\s+/g, '')
    .replace(/^(นางสาว|นาง|นาย|ดร\.|ว่าที่ร้อยตรี)/, '');
}

/** แปลงเป็นรูปแบบเอกสารที่ใช้ใน collection "personnel" */
export function toPersonnelDoc(person: OfficialPerson, order: number) {
  return {
    name: person.name,
    position: person.pos,
    major: person.major,
    positionNumber: person.posNum,
    phone: person.phone,
    category: person.cat,
    workGroup: person.wg,
    image: person.image || '',
    order,
    isHead: person.cat === 'director',
  };
}
