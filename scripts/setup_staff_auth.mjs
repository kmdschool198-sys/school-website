import fs from 'node:fs';
import path from 'node:path';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

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

const auth = getAuth();
const firestore = getFirestore();

const staffAccounts = [
  {
    username: 'adminkmd',
    email: process.env.VITE_KMD_ADMIN_EMAIL || process.env.VITE_KMD_TEACHER_EMAIL || 'adminkmd@web-site-kmd.firebaseapp.com',
    password: process.env.KMD_ADMIN_PASSWORD || process.env.KMD_TEACHER_PASSWORD,
    displayName: 'ครู (Admin)',
    claims: { role: 'admin', admin: true },
  },
  {
    username: 'jameskmd',
    email: process.env.VITE_KMD_SUPER_EMAIL || 'jameskmd@web-site-kmd.firebaseapp.com',
    password: process.env.KMD_SUPER_PASSWORD,
    displayName: 'ผู้ดูแลระบบ',
    claims: { role: 'super', admin: true },
  },
];

const selected = process.argv.slice(2);
const accounts = selected.length
  ? staffAccounts.filter(account => selected.includes(account.username))
  : staffAccounts;

if (!accounts.length) {
  fail(`ไม่พบ username ที่ระบุ (${selected.join(', ')})`);
}

for (const account of accounts) {
  if (!account.password || account.password === 'change-this-strong-password') {
    fail(`กรุณาตั้ง password ของ ${account.username} ใน .env.local ก่อน เช่น KMD_ADMIN_PASSWORD=...`);
  }
  if (account.password.length < 8) {
    fail(`password ของ ${account.username} ต้องยาวอย่างน้อย 8 ตัวอักษร`);
  }

  let user;
  try {
    user = await auth.getUserByEmail(account.email);
    await auth.updateUser(user.uid, {
      email: account.email,
      password: account.password,
      displayName: account.displayName,
      disabled: false,
    });
  } catch (error) {
    if (error?.code !== 'auth/user-not-found') throw error;
    user = await auth.createUser({
      email: account.email,
      password: account.password,
      displayName: account.displayName,
      disabled: false,
    });
  }

  await auth.setCustomUserClaims(user.uid, account.claims);
  await auth.revokeRefreshTokens(user.uid);
  await firestore.collection('staff_users').doc(account.email).set({
    email: account.email,
    uid: user.uid,
    name: account.displayName,
    role: account.claims.role,
    active: true,
    provider: 'password',
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  console.log(`OK ${account.username} -> ${account.email} claims=${JSON.stringify(account.claims)}`);
}

console.log('\nเสร็จแล้ว: ปิด/เปิดหน้าเว็บใหม่ แล้ว login ด้วย username เดิมหรืออีเมลใน .env.local');

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
