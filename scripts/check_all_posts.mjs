import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, orderBy } from 'firebase/firestore';

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

async function checkAll() {
  const snap = await getDocs(query(collection(db, 'posts'), orderBy('date', 'desc')));
  console.log('Total posts in Firestore:', snap.size);
  
  const months = {};
  const allList = [];
  snap.forEach(d => {
    const data = d.data();
    const ym = (data.date || 'unknown').slice(0, 7);
    months[ym] = (months[ym] || 0) + 1;
    allList.push({ id: d.id, date: data.date, title: data.title, fb: data.facebookUrl });
  });
  console.log('Posts per month:', months);

  console.log('\nAll 2026-08 and 2026-09 posts:');
  allList.filter(p => p.date >= '2026-08-01').forEach(p => {
    console.log(`- [${p.date}] ${p.title} (FB: ${p.fb ? 'yes' : 'no'})`);
  });

  process.exit(0);
}
checkAll().catch(console.error);
