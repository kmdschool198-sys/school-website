import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, deleteDoc } from 'firebase/firestore';

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

async function testConfigWrite() {
  console.log('Testing write to config/attendance_classes...');
  try {
    await setDoc(doc(db, 'config', 'test_doc'), { test: true });
    console.log('SUCCESS writing to config/test_doc!');
    await deleteDoc(doc(db, 'config', 'test_doc'));
    console.log('SUCCESS deleting config/test_doc!');
  } catch (e) {
    console.error('ERROR writing to config:', e);
  }

  console.log('Testing write to config/timetable...');
  try {
    await setDoc(doc(db, 'config', 'timetable_test'), { test: true });
    console.log('SUCCESS writing to config/timetable_test!');
    await deleteDoc(doc(db, 'config', 'timetable_test'));
  } catch (e) {
    console.error('ERROR writing timetable_test:', e);
  }

  process.exit(0);
}

testConfigWrite();
