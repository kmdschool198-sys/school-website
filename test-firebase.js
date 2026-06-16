import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

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

async function test() {
  try {
    console.log("Connecting to Firebase...");
    const snap = await getDocs(collection(db, "config"));
    console.log("Connected successfully. Config docs count:", snap.size);
    process.exit(0);
  } catch (err) {
    console.error("Firebase connection error:", err);
    process.exit(1);
  }
}

test();
