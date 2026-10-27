import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc, deleteDoc, addDoc, collection, getDocs, query, where } from 'firebase/firestore';

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

async function syncAndClean() {
  console.log('--- Step 1: Deleting invalid / duplicate posts ---');
  const toDelete = [
    { id: '5TYfoMgh2fddcFyoYyV0', reason: 'Fake/hallucinated Kritsana Games with mismatched anti-drug photo' },
    { id: 'rsH6ko1gGLtlRfX4Brt7', reason: 'Duplicate of ZeA19awYG2dL2lS9fho5 (PA Evaluation)' },
    { id: 'tL0Fo6haUT0pjd70EZB0', reason: 'Duplicate of rgcvMeMhTHqPwvTQotPj (School CEO / Avocado confusion)' },
    { id: 'fIwJDCxJGIkAubSAdBpB', reason: 'Invalid ESPORTS post with mismatched anti-drug photo' }
  ];

  for (const item of toDelete) {
    try {
      await deleteDoc(doc(db, 'posts', item.id));
      console.log(`[DELETED] ${item.id} - ${item.reason}`);
    } catch (e) {
      console.log(`[DELETE ERROR] ${item.id}:`, e.message);
    }
  }

  console.log('\n--- Step 2: Updating Dental checkup post title & content ---');
  try {
    await updateDoc(doc(db, 'posts', 'gwIxahA6H6jfguT4b4I8'), {
      title: 'กิจกรรมบริการตรวจสุขภาพช่องปากและฟันนักเรียน โดยหน่วยทันตกรรมเคลื่อนที่ โรงเรียนบ้านคลองมดแดง',
      content: '🦷✨ กิจกรรมบริการตรวจสุขภาพช่องปากและฟันนักเรียน โรงเรียนบ้านคลองมดแดง ✨🦷\n\nหน่วยบริการทันตกรรมเคลื่อนที่ได้เข้าให้บริการตรวจสุขภาพช่องปากและฟัน พร้อมให้คำแนะนำในการดูแลรักษาความสะอาดช่องปากและฟันอย่างถูกวิธีแก่เด็กนักเรียนโรงเรียนบ้านคลองมดแดง เพื่อส่งเสริมสุขอนามัยที่ดี รอยยิ้มสดใส และสุขภาพฟันที่แข็งแรงสมบูรณ์ โดยบรรยากาศเต็มไปด้วยความอบอุ่นและรอยยิ้มของเด็ก ๆ "น้อง ๆ ที่นี่ดูแลฟันกันดีมากๆ"',
      imageUrl: 'https://drive.google.com/file/d/1Uub5cbcjBDGf1uPTDUPfcpgWoMKngThV/view?usp=drivesdk',
      imageType: 'image'
    });
    console.log('[UPDATED] gwIxahA6H6jfguT4b4I8 to match dental health checkup photo');
  } catch (e) {
    console.log('[UPDATE ERROR] gwIxahA6H6jfguT4b4I8:', e.message);
  }

  console.log('\n--- Step 3: Checking / Adding Green Culture Award Post ---');
  const snap = await getDocs(query(collection(db, 'posts'), where('facebookUrl', '==', 'https://www.facebook.com/BnKhlngMddang/posts/1571630398093140/')));
  if (snap.empty) {
    const newDoc = await addDoc(collection(db, 'posts'), {
      title: 'โรงเรียนบ้านคลองมดแดง ได้รับรางวัลชมเชย การประกวดคลิปวิดีโอ "Green Culture: Caring for Our Common Home" ผลงาน "ถ้าโลกพูดได้..."',
      date: '2026-08-18',
      category: 'ผลงานรางวัล',
      content: '🌱✨ รางวัลชมเชยระดับประเทศ การประกวดคลิปวิดีโอ "Green Culture: Caring for Our Common Home" ✨🌱\n\nคณะกรรมาธิการการศาสนา คุณธรรม จริยธรรม ศิลปะและวัฒนธรรม วุฒิสภา ร่วมกับ สมาคมคาทอลิกแห่งประเทศไทย สื่อมวลชนคาทอลิกประเทศไทย และมูลนิธิ ดร.เทียม โชควัฒนา ขอมอบเกียรติบัตรฉบับนี้ไว้เพื่อแสดงว่า\n\nโรงเรียนบ้านคลองมดแดง\nได้รับรางวัลชมเชยการประกวดคลิปวิดีโอ หัวข้อ "Green Culture: Caring for Our Common Home" ประเภทองค์กร โรงเรียน หรือหน่วยงาน\n\nโครงการ "พลังแห่งศาสนสถาน : ศรัทธาและภูมิปัญญา ขับเคลื่อนสิ่งแวดล้อมที่ยั่งยืนด้วยวิถีพอเพียง" จากการสร้างสรรค์ผลงาน "ถ้าโลกพูดได้..." ที่สะท้อนคุณธรรม จริยธรรม และความรับผิดชอบต่อสิ่งแวดล้อมอย่างยั่งยืน',
      imageUrl: 'https://drive.google.com/file/d/167b8ryGDvKnznQPp_FiPyF0gzuDbPhAI/view?usp=drivesdk',
      imageType: 'image',
      facebookUrl: 'https://www.facebook.com/BnKhlngMddang/posts/1571630398093140/',
      albumUrl: '',
      tiktokUrl: '',
      documentUrl: '',
      websiteUrl: ''
    });
    console.log(`[ADDED] Green Culture Award post added with ID: ${newDoc.id}`);
  } else {
    console.log('[EXISTS] Green Culture post already exists in Firestore');
  }

  console.log('\n--- Sync and clean completed! ---');
  process.exit(0);
}

syncAndClean();
