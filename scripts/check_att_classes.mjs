import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

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

async function checkAttendanceClasses() {
  const snap = await getDoc(doc(db, 'config', 'attendance_classes'));
  console.log('Exists:', snap.exists());
  if (snap.exists()) {
    const data = snap.data();
    console.log('UpdatedAt:', data.updatedAt);
    console.log('Classes count:', data.classes?.length);
    if (data.classes) {
      data.classes.forEach(c => {
        console.log(`Class ${c.label} (${c.classId}): ${c.students?.length} students`);
      });
    }
  } else {
    console.log('config/attendance_classes DOES NOT EXIST IN FIRESTORE!');
  }
  process.exit(0);
}

checkAttendanceClasses().catch(console.error);
