import { db } from './firebase';
import { collection, addDoc } from 'firebase/firestore';
import { OFFICIAL_PERSONNEL, toPersonnelDoc } from './data/personnelRoster';

// เติมบุคลากรทั้งหมดลง Firestore (ใช้กับฐานข้อมูลเปล่าเท่านั้น)
// ถ้ามีข้อมูลอยู่แล้วให้ใช้ปุ่ม "ตรวจสอบรายชื่อบุคลากร" ในหน้าแอดมินแทน
// เพราะฟังก์ชันนี้เพิ่มทุกคนโดยไม่เช็คของเดิม จะได้ข้อมูลซ้ำ
export const seedPersonnel = async () => {
  console.log('Seeding personnel...');
  for (let i = 0; i < OFFICIAL_PERSONNEL.length; i++) {
    await addDoc(collection(db, 'personnel'), toPersonnelDoc(OFFICIAL_PERSONNEL[i], i + 1));
  }
  console.log('Seeding complete!');
};
