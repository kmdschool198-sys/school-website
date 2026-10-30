// Firebase Admin setup shared by the data scripts in scripts/ (reads .env / .env.local)
import fs from 'node:fs';
import path from 'node:path';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const root = process.cwd();

export function adminDb() {
  loadEnvFile('.env');
  loadEnvFile('.env.local');
  if (!getApps().length) {
    initializeApp({ credential: cert(loadServiceAccount()), projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'web-site-kmd' });
  }
  return getFirestore();
}

function loadEnvFile(fileName) {
  const filePath = path.join(root, fileName);
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx < 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!process.env[key]) process.env[key] = value;
  }
}

function loadServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    return JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8'));
  }
  const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credentialPath) fail('กรุณาระบุ GOOGLE_APPLICATION_CREDENTIALS ใน .env.local ให้ชี้ไปที่ service account JSON');
  const resolved = path.resolve(root, credentialPath);
  if (!fs.existsSync(resolved)) fail(`ไม่พบ service account JSON: ${resolved}`);
  return JSON.parse(fs.readFileSync(resolved, 'utf8'));
}

export function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}
