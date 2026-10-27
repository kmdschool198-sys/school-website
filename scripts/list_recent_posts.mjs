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

async function check() {
  const snap = await getDocs(query(collection(db, 'posts'), orderBy('date', 'desc')));
  const list = [];
  snap.forEach(d => {
    const data = d.data();
    if (data.date >= '2026-07-20') {
      list.push({ id: d.id, date: data.date, title: data.title, category: data.category, img: data.imageUrl?.slice(0, 40) });
    }
  });
  console.log('Posts >= 2026-07-20 (Total ' + list.length + '):');
  list.forEach(p => console.log(`[${p.date}] [${p.category}] ${p.title} (${p.img})`));
  process.exit(0);
}
check();
