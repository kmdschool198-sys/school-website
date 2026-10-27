import { initializeApp } from 'firebase/app';
import {
  getFirestore, doc, collection, addDoc, setDoc, getDoc, deleteDoc, getDocs, query, orderBy
} from 'firebase/firestore';

// Read config from src/firebase.ts
import { db } from '../src/firebase.ts';

async function runTests() {
  console.log('--- Starting CRUD Verification Test ---');

  // 1. Personnel: Add -> Edit -> Read -> Delete
  console.log('\n[1] Testing Personnel CRUD:');
  const testPersonData = {
    name: 'ทดสอบ บุคลากร',
    position: 'ครูผู้ช่วยทดสอบ',
    major: 'ทดสอบ',
    positionNumber: '9999',
    phone: '0999999999',
    websiteUrl: 'https://test.school',
    email: 'test@school.ac.th',
    category: 'teacher',
    workGroup: 'academic',
    image: '',
    isHead: false,
    order: 999
  };
  const pRef = await addDoc(collection(db, 'personnel'), testPersonData);
  console.log('✓ Added personnel:', pRef.id);

  await setDoc(doc(db, 'personnel', pRef.id), { ...testPersonData, position: 'ครูชำนาญการทดสอบ' }, { merge: true });
  console.log('✓ Updated personnel');

  const pSnap = await getDoc(doc(db, 'personnel', pRef.id));
  if (pSnap.data().position !== 'ครูชำนาญการทดสอบ') throw new Error('Personnel edit mismatch');
  console.log('✓ Verified updated personnel data');

  await deleteDoc(doc(db, 'personnel', pRef.id));
  const pDeleted = await getDoc(doc(db, 'personnel', pRef.id));
  if (pDeleted.exists()) throw new Error('Personnel delete failed');
  console.log('✓ Deleted personnel successfully');

  // 2. Posts: Add -> Edit -> Delete
  console.log('\n[2] Testing Posts CRUD:');
  const testPostData = {
    title: 'ทดสอบข่าวสารด่วน',
    content: 'รายละเอียดทดสอบ',
    category: 'ข่าวประชาสัมพันธ์',
    imageUrl: '',
    imageType: 'image',
    albumUrl: '',
    tiktokUrl: '',
    facebookUrl: '',
    websiteUrl: '',
    documentUrl: '',
    date: '2026-10-26'
  };
  const postRef = await addDoc(collection(db, 'posts'), testPostData);
  console.log('✓ Added post:', postRef.id);

  await setDoc(doc(db, 'posts', postRef.id), { ...testPostData, title: 'ทดสอบข่าวสารด่วน (แก้ไข)' }, { merge: true });
  console.log('✓ Updated post');

  await deleteDoc(doc(db, 'posts', postRef.id));
  console.log('✓ Deleted post successfully');

  // 3. Highlights: Add -> Edit -> Delete
  console.log('\n[3] Testing Highlights CRUD:');
  const testHData = {
    badge: 'Excellence',
    title: 'ทดสอบสไลด์',
    titleAccent: 'เน้นสีส้ม',
    description: 'คำอธิบายสไลด์',
    buttonText: 'ดูเพิ่มเติม',
    imageUrl: '',
    imageType: 'image',
    order: 999
  };
  const hRef = await addDoc(collection(db, 'highlights'), testHData);
  console.log('✓ Added highlight:', hRef.id);

  await setDoc(doc(db, 'highlights', hRef.id), { ...testHData, title: 'ทดสอบสไลด์แก้ไข' }, { merge: true });
  console.log('✓ Updated highlight');

  await deleteDoc(doc(db, 'highlights', hRef.id));
  console.log('✓ Deleted highlight successfully');

  // 4. Activities: Add -> Edit -> Delete
  console.log('\n[4] Testing Activities CRUD:');
  const testActData = {
    date: '2026-11-01',
    title: 'ทดสอบกิจกรรม',
    description: 'รายละเอียดกิจกรรม',
    location: 'หอประชุม',
    time: '08:30 - 15:30',
    isHoliday: false,
    color: '#FF6A01'
  };
  const actRef = await addDoc(collection(db, 'activities'), testActData);
  console.log('✓ Added activity:', actRef.id);

  await setDoc(doc(db, 'activities', actRef.id), { ...testActData, title: 'ทดสอบกิจกรรมแก้ไข' }, { merge: true });
  console.log('✓ Updated activity');

  await deleteDoc(doc(db, 'activities', actRef.id));
  console.log('✓ Deleted activity successfully');

  // 5. Clubs: Add -> Edit -> Delete
  console.log('\n[5] Testing Clubs CRUD:');
  const testClubId = `test_club_${Date.now()}`;
  const testClubData = {
    id: testClubId,
    name: 'ชมรมทดสอบ',
    type: 'ชุมนุม',
    advisor: 'ครูทดสอบ',
    description: 'รายละเอียดชุมนุมทดสอบ',
    members: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  await setDoc(doc(db, 'clubs', testClubId), testClubData, { merge: true });
  console.log('✓ Added club:', testClubId);

  await setDoc(doc(db, 'clubs', testClubId), { ...testClubData, name: 'ชมรมทดสอบแก้ไข' }, { merge: true });
  console.log('✓ Updated club');

  await deleteDoc(doc(db, 'clubs', testClubId));
  console.log('✓ Deleted club successfully');

  console.log('\n====================================');
  console.log(' ALL 5 DATABASE CRUD CHECKS PASSED!');
  console.log('====================================');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
