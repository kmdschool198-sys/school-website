import { initializeApp } from 'firebase/app';
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc,
  collection, addDoc, getDocs, writeBatch
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyDMQ21IocDvKkkgb-3HnHlz9OF4Nc-q7jk',
  authDomain: 'web-site-kmd.firebaseapp.com',
  projectId: 'web-site-kmd',
  storageBucket: 'web-site-kmd.firebasestorage.app',
  messagingSenderId: '1084529861236',
  appId: '1:1084529861236:web:e05c9ba62099c9ff036721'
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function testAllOperations() {
  const results = {};

  // 1. Test personnel: Add, Update, Delete
  try {
    const pRef = await addDoc(collection(db, 'personnel'), { name: 'Test Pers', position: 'ครู', order: 99 });
    await updateDoc(doc(db, 'personnel', pRef.id), { name: 'Test Pers Updated' });
    await deleteDoc(doc(db, 'personnel', pRef.id));
    results.personnel = 'OK';
  } catch (e) {
    results.personnel = 'FAIL: ' + e.message;
  }

  // 2. Test posts: Add, Update, Delete
  try {
    const postRef = await addDoc(collection(db, 'posts'), { title: 'Test Post', content: 'test', date: '2026-10-26' });
    await updateDoc(doc(db, 'posts', postRef.id), { title: 'Test Post Updated' });
    await deleteDoc(doc(db, 'posts', postRef.id));
    results.posts = 'OK';
  } catch (e) {
    results.posts = 'FAIL: ' + e.message;
  }

  // 3. Test clubs: Add, Update, Delete
  try {
    const cRef = doc(db, 'clubs', 'test_club_123');
    await setDoc(cRef, { name: 'Test Club', members: [] });
    await updateDoc(cRef, { name: 'Test Club Up' });
    await deleteDoc(cRef);
    results.clubs = 'OK';
  } catch (e) {
    results.clubs = 'FAIL: ' + e.message;
  }

  // 4. Test config/attendance_classes (Roster): Update
  try {
    const snap = await getDoc(doc(db, 'config', 'attendance_classes'));
    const old = snap.data();
    await updateDoc(doc(db, 'config', 'attendance_classes'), { testPing: Date.now() });
    results.attendance_classes = 'OK';
  } catch (e) {
    results.attendance_classes = 'FAIL: ' + e.message;
  }

  // 5. Test config/students_count: Update
  try {
    await updateDoc(doc(db, 'config', 'students_count'), { testPing: Date.now() });
    results.students_count = 'OK';
  } catch (e) {
    results.students_count = 'FAIL: ' + e.message;
  }

  // 6. Test config/timetable: Update
  try {
    await updateDoc(doc(db, 'config', 'timetable'), { testPing: Date.now() });
    results.timetable = 'OK';
  } catch (e) {
    results.timetable = 'FAIL: ' + e.message;
  }

  // 7. Test pages: Update
  try {
    const pageRef = doc(db, 'pages', 'test_page_123');
    await setDoc(pageRef, { title: 'Test Page', updatedAt: Date.now() });
    await deleteDoc(pageRef);
    results.pages = 'OK';
  } catch (e) {
    results.pages = 'FAIL: ' + e.message;
  }

  // 8. Test activities: Add, Update, Delete
  try {
    const aRef = await addDoc(collection(db, 'activities'), { title: 'Test Act', date: '2026-10-26' });
    await updateDoc(doc(db, 'activities', aRef.id), { title: 'Test Act Up' });
    await deleteDoc(doc(db, 'activities', aRef.id));
    results.activities = 'OK';
  } catch (e) {
    results.activities = 'FAIL: ' + e.message;
  }

  // 9. Test attendance: Add, Update, Delete
  try {
    const attRef = doc(db, 'attendance', 'test_p1_1_2026-10-26');
    await setDoc(attRef, { classId: 'p1_1', date: '2026-10-26', records: {} });
    await deleteDoc(attRef);
    results.attendance = 'OK';
  } catch (e) {
    results.attendance = 'FAIL: ' + e.message;
  }

  console.log('RESULTS:', JSON.stringify(results, null, 2));
  process.exit(0);
}

testAllOperations();
