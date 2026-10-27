import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc, collection, addDoc } from 'firebase/firestore';

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

async function testUndefined() {
  console.log('Testing addDoc with undefined value...');
  try {
    await addDoc(collection(db, 'personnel'), {
      name: 'Test',
      major: undefined
    });
    console.log('SUCCESS?');
  } catch (err) {
    console.error('CAUGHT EXPECTED FIRESTORE ERROR:', err.message);
  }
  process.exit(0);
}

testUndefined();
