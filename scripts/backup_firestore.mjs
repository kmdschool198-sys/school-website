// Read-only full backup of every Firestore collection (including subcollections) to
// private/backups/firestore-<timestamp>/<collection>.json. Run before any data-model change.
// It never writes to Firestore.
//
// Usage: npm run backup:firestore
import fs from 'node:fs';
import path from 'node:path';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const root = process.cwd();
loadEnvFile('.env');
loadEnvFile('.env.local');

const projectId = process.env.VITE_FIREBASE_PROJECT_ID || 'web-site-kmd';
if (!getApps().length) {
  initializeApp({ credential: cert(loadServiceAccount()), projectId });
}
const db = getFirestore();

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

function loadEnvFile(fileName) {
  const filePath = path.join(root, fileName);
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx < 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function loadServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  }

  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    return JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8'));
  }

  const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credentialPath) {
    fail('กรุณาระบุ GOOGLE_APPLICATION_CREDENTIALS ใน .env.local ให้ชี้ไปที่ service account JSON');
  }

  const resolved = path.resolve(root, credentialPath);
  if (!fs.existsSync(resolved)) {
    fail(`ไม่พบ service account JSON: ${resolved}`);
  }

  return JSON.parse(fs.readFileSync(resolved, 'utf8'));
}

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}
