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

async function checkStudentsCount() {
  const snap = await getDoc(doc(db, 'config', 'students_count'));
  console.log('Exists:', snap.exists());
  if (snap.exists()) {
    const data = snap.data();
    console.log('Title:', data.title);
    console.log('Rows count:', data.rows?.length);
    console.log('Rows:', data.rows);
  }
  process.exit(0);
}

checkStudentsCount().catch(console.error);
