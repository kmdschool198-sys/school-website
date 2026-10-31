// Read-only full backup of every Firestore collection (including subcollections) to
// private/backups/firestore-<timestamp>/<collection>.json. Run before any data-model change.
// It never writes to Firestore.
//
// Usage: npm run backup:firestore
import fs from 'node:fs';
import path from 'node:path';
import { adminDb } from './lib/adminApp.mjs';
import { Timestamp } from 'firebase-admin/firestore';

const root = process.cwd();

const db = adminDb();

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = path.join(root, 'private', 'backups', `firestore-${stamp}`);
fs.mkdirSync(outDir, { recursive: true });

const summary = {};
for (const col of await db.listCollections()) {
  const docs = await dumpCollection(col);
  fs.writeFileSync(path.join(outDir, `${col.id}.json`), JSON.stringify(docs, null, 2));
  summary[col.id] = docs.length;
  console.log(`${col.id}: ${docs.length} เอกสาร`);
}
fs.writeFileSync(path.join(outDir, '_summary.json'), JSON.stringify({ projectId, createdAt: new Date().toISOString(), summary }, null, 2));
console.log(`สำรองข้อมูลไว้ที่ ${outDir}`);

async function dumpCollection(colRef) {
  const snap = await colRef.get();
  const out = [];
  for (const d of snap.docs) {
    const entry = { id: d.id, data: plain(d.data()) };
    const subs = await d.ref.listCollections();
    if (subs.length) {
      entry.subcollections = {};
      for (const sub of subs) entry.subcollections[sub.id] = await dumpCollection(sub);
    }
    out.push(entry);
  }
  return out;
}

// Timestamps become ISO strings tagged so a restore can turn them back into Timestamps
function plain(value) {
  if (value instanceof Timestamp) return { __timestamp: value.toDate().toISOString() };
  if (Array.isArray(value)) return value.map(plain);
  if (value && typeof value === 'object') {
    if (typeof value.path === 'string' && typeof value.id === 'string' && value.firestore) return { __ref: value.path };
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plain(v)]));
  }
  return value;
}
