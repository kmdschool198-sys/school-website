import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, deleteDoc, doc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDMQ21IocDvKkkgb-3HnHlz9OF4Nc-q7jk",
  authDomain: "web-site-kmd.firebaseapp.com",
  projectId: "web-site-kmd",
  storageBucket: "web-site-kmd.firebasestorage.app",
  messagingSenderId: "1084529861236",
  appId: "1:1084529861236:web:e05c9ba62099c9ff036721"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function testWrite() {
  try {
    console.log("Attempting to write to 'activities'...");
    const docRef = await addDoc(collection(db, "activities"), {
      title: "Test Write",
      date: "2026-05-18"
    });
    console.log("Write successful! ID:", docRef.id);
    await deleteDoc(doc(db, "activities", docRef.id));
    console.log("Cleanup successful.");
    process.exit(0);
  } catch (err) {
    console.error("Write failed:", err.message);
    process.exit(1);
  }
}

testWrite();
