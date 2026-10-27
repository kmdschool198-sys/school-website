import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc } from 'firebase/firestore';

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

const postUpdates = [
  { id: '5TYfoMgh2fddcFyoYyV0', fileId: '17Z29s4ojGI8i7YqrqXx46PNwfTyzpZVz', title: 'กีฬาสีภายใน กฤษณาเกมส์ 2569' },
  { id: 'ZeA19awYG2dL2lS9fho5', fileId: '12-aAqIVf6nYVDeGGbpYcLU81lsLXf2j0', title: 'การประเมิน PA 2569' },
  { id: 'rsH6ko1gGLtlRfX4Brt7', fileId: '12-aAqIVf6nYVDeGGbpYcLU81lsLXf2j0', title: 'เตรียมความพร้อมการประเมิน PA' },
  { id: 'tL0Fo6haUT0pjd70EZB0', fileId: '1xP8cEijtOZqMABmKFSEpDMhPF_CyvnT6', title: 'ตลาดนัด KPP2 รวมใจ น้ำปั่นอะโวคาโด' },
  { id: 'rgcvMeMhTHqPwvTQotPj', fileId: '1xP8cEijtOZqMABmKFSEpDMhPF_CyvnT6', title: 'รางวัลชนะเลิศเหรียญทอง The School CEO เสน่ห์ผ้าทอปกาเกอะญอ' },
  { id: 'fIwJDCxJGIkAubSAdBpB', fileId: '17Z29s4ojGI8i7YqrqXx46PNwfTyzpZVz', title: 'KMD ESPORTS' },
  { id: 'gwIxahA6H6jfguT4b4I8', fileId: '1Uub5cbcjBDGf1uPTDUPfcpgWoMKngThV', title: 'อบรมความปลอดภัยในสถานศึกษา' },
  { id: 'nuBBwUaBlCmSww0C5prW', fileId: '1ZQ1gu_9dDdy3WJPuYsqZ96npMUxrRD6b', title: 'แหล่งท่องเที่ยวเกาะเสือ' },
  { id: 'TnWw4J0dMWRJcCbCA0nq', fileId: '1vq_aUasiE0Sz705nvv0VpfRHn4Hqt1Ow', title: 'รองชนะเลิศอันดับ 2 เปตอง' },
  { id: 'leFA1SqruRImIkz510Rq', fileId: '1CHp6Tm9-JZ95eJCTT66m1uxxnrDmTumw', title: 'สัปดาห์ห้องสมุด 2569' },
  { id: 'ThV3FYLJQ6dedCAmMnNB', fileId: '1_TIBqjeg_vrETui6R3OBfg5kYpDpY678', title: 'ปลูกต้นไม้ 99,993 ต้น' },
  { id: 'x8d9PpmswbTGyuOyHtKv', fileId: '1kyFjXogUdx65kW8_53uwtMWfg04qY2Au', title: 'ศิลปหัตถกรรมนักเรียน ครั้งที่ 74' },
  { id: 'ZH7VlZSd9KgBmvKX1YTB', fileId: '1xVgy2-dfEhnLCYFm4ypflwTENvBJgxEA', title: 'เฉลิมพระเกียรติ วันแม่แห่งชาติ 2569' }
];

async function update() {
  console.log('Updating Firestore posts with Google Drive URLs...');
  for (const item of postUpdates) {
    const driveUrl = 'https://drive.google.com/file/d/' + item.fileId + '/view?usp=drivesdk';
    const docRef = doc(db, 'posts', item.id);
    await updateDoc(docRef, { imageUrl: driveUrl });
    console.log('Updated ' + item.id + ' (' + item.title + '): ' + driveUrl);
  }
  console.log('All posts updated successfully!');
  process.exit(0);
}

update().catch(console.error);
