import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore';

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

const awardKeywords = [
  'รางวัลชนะเลิศ',
  'รางวัลรองชนะเลิศ',
  'เหรียญทอง',
  'เหรียญเงิน',
  'เหรียญทองแดง',
  'ขอแสดงความยินดีกับนักเรียนที่ได้รับรางวัล',
  'ศิลปหัตถกรรมนักเรียน'
];

async function updateAwardCategories() {
  const snap = await getDocs(collection(db, 'posts'));
  let updatedCount = 0;
  for (const d of snap.docs) {
    const data = d.data();
    const title = data.title || '';
    const isAward = awardKeywords.some(k => title.includes(k));
    if (isAward && data.category !== 'ผลงานรางวัล') {
      await updateDoc(doc(db, 'posts', d.id), { category: 'ผลงานรางวัล' });
      console.log(`Updated to ผลงานรางวัล: [${data.date}] ${title} (ID: ${d.id})`);
      updatedCount++;
    }
  }
  console.log(`Total updated to ผลงานรางวัล: ${updatedCount}`);
  process.exit(0);
}
updateAwardCategories();
