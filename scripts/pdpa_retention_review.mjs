import fs from 'node:fs';
import path from 'node:path';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';

const root = process.cwd();

loadEnvFile('.env');
loadEnvFile('.env.local');

const projectId = process.env.VITE_FIREBASE_PROJECT_ID || 'web-site-kmd';
const serviceAccount = loadServiceAccount();

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount),
    projectId,
  });
}

const db = getFirestore();

const policies = [
  { collection: 'pdpa_audit_logs', dateField: 'createdAt', reviewAfterDays: 730, reason: 'audit logs older than 2 years' },
  { collection: 'pdpa_consents', dateField: 'updatedAt', reviewAfterDays: 730, reason: 'consent records older than 2 years' },
  { collection: 'pdpa_requests', dateField: 'createdAt', reviewAfterDays: 365, reason: 'PDPA requests older than 1 year' },
  { collection: 'result_announcements', dateField: 'publishedAt', reviewAfterDays: 730, reason: 'public result announcements older than 2 years' },
  { collection: 'log_body_metrics', dateField: 'createdAt', reviewAfterDays: 1095, reason: 'health metrics older than 3 years' },
  { collection: 'log_saving', dateField: 'createdAt', reviewAfterDays: 1095, reason: 'saving logs older than 3 years' },
];

const reportDate = new Date().toISOString().slice(0, 10);
const results = [];

for (const policy of policies) {
  const cutoffDate = new Date(Date.now() - policy.reviewAfterDays * 24 * 60 * 60 * 1000);
  const cutoff = Timestamp.fromDate(cutoffDate);
  const snap = await db.collection(policy.collection)
    .where(policy.dateField, '<', cutoff)
    .limit(500)
    .get();

  results.push({
    ...policy,
    cutoff: cutoffDate.toISOString(),
    candidateCount: snap.size,
    sampleIds: snap.docs.slice(0, 20).map(doc => doc.id),
  });
}

await db.collection('pdpa_retention_reviews').doc(reportDate).set({
  reportDate,
  projectId,
  results,
  status: 'review_required',
  note: 'Review candidates before deletion. This script does not delete data automatically.',
  createdAt: FieldValue.serverTimestamp(),
}, { merge: true });

console.log(`PDPA retention review written: pdpa_retention_reviews/${reportDate}`);
for (const item of results) {
  console.log(`${item.collection}: ${item.candidateCount} candidates (${item.reason})`);
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
    fail('Set GOOGLE_APPLICATION_CREDENTIALS in .env.local to a Firebase service account JSON path.');
  }

  const resolved = path.resolve(root, credentialPath);
  if (!fs.existsSync(resolved)) {
    fail(`Service account JSON not found: ${resolved}`);
  }

  return JSON.parse(fs.readFileSync(resolved, 'utf8'));
}

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}
