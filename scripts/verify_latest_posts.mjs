import { adminDb } from './lib/adminApp.mjs';

const db = adminDb();
const snap = await db.collection('posts').get();
const docs = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

console.log('Total posts in database:', docs.length);
console.log('\nTop 12 latest posts on the website:');
docs.slice(0, 12).forEach((d, i) => {
  console.log(`${i + 1}. [${d.date}] ${d.title}`);
  console.log(`   Img: ${d.imageUrl}`);
  console.log(`   FB: ${d.facebookUrl || '-'}`);
});
process.exit(0);
