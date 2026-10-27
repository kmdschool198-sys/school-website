import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, doc, deleteDoc, updateDoc } from 'firebase/firestore';

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

async function testWrites() {
  console.log('Testing unauthenticated Firestore write...');
  try {
    // 1. Test personnel collection
    const testDoc = await addDoc(collection(db, 'personnel'), {
      name: '__TEST_PERSONNEL__',
      position: 'ทดสอบ',
      category: 'teacher',
      order: 999
    });
    console.log('SUCCESS addDoc to personnel! ID =', testDoc.id);

    // 2. Test deleteDoc
    await deleteDoc(doc(db, 'personnel', testDoc.id));
    console.log('SUCCESS deleteDoc from personnel!');

    // 3. Test config collection
    const configSnap = await getDocs(collection(db, 'config'));
    console.log('Config docs count:', configSnap.size);

    console.log('ALL UNATHENTICATED WRITES WORK AT FIRESTORE LEVEL!');
  } catch (err) {
    console.error('FIRESTORE ERROR:', err);
  }
  process.exit(0);
}

testWrites();
