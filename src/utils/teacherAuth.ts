// Shared Firebase Authentication helpers for all teacher/staff systems.
import { useEffect, useState } from 'react';
import {
  GoogleAuthProvider,
  getIdTokenResult,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

export type Role = 'owner' | 'admin' | 'editor' | 'teacher' | 'super';
export type StaffManageRole = Exclude<Role, 'super'>;

export interface AuthState {
  authed: boolean;
  loading: boolean;
  role: Role;
  name: string;
  email: string;
}

export type StaffProfile = {
  email: string;
  role: Role;
  name: string;
  active?: boolean;
};

export const STAFF_USERS_COLLECTION = 'staff_users';
export const STAFF_ROLE_OPTIONS: StaffManageRole[] = ['owner', 'admin', 'editor', 'teacher'];
export const STAFF_ROLE_LABELS: Record<StaffManageRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  editor: 'Editor',
  teacher: 'Teacher',
};

const STAFF_PROFILES: Record<string, StaffProfile> = {
  adminkmd: {
    email: import.meta.env.VITE_KMD_ADMIN_EMAIL || import.meta.env.VITE_KMD_TEACHER_EMAIL || 'adminkmd@web-site-kmd.firebaseapp.com',
    role: 'admin',
    name: 'ครู (Admin)',
  },
  jameskmd: {
    email: import.meta.env.VITE_KMD_SUPER_EMAIL || 'jameskmd@web-site-kmd.firebaseapp.com',
    role: 'owner',
    name: 'ผู้ดูแลระบบ',
  },
};

const DEFAULT_AUTH_STATE: AuthState = {
  authed: false,
  loading: true,
  role: 'teacher',
  name: 'ครู',
  email: '',
};

export function resolveStaffEmail(usernameOrEmail: string): string {
  const value = usernameOrEmail.trim();
  if (value.includes('@')) return value;
  return STAFF_PROFILES[value]?.email || value;
}

export function roleFromClaim(value: unknown): Role | null {
  if (value === 'owner' || value === 'admin' || value === 'editor' || value === 'teacher' || value === 'super') return value;
  return null;
}

export function roleLabel(role: Role | null | undefined): string {
  if (role === 'super') return STAFF_ROLE_LABELS.owner;
  return role ? STAFF_ROLE_LABELS[role] : '';
}

export function canManageStaffUsers(role: Role | null | undefined): boolean {
  return role === 'owner' || role === 'admin' || role === 'super';
}

export function canUseWebsiteAdmin(role: Role | null | undefined): boolean {
  return canManageStaffUsers(role) || role === 'editor';
}

function fallbackProfile(user: User): StaffProfile | null {
  const email = user.email || '';
  return Object.values(STAFF_PROFILES).find(profile => profile.email === email) || null;
}

async function listedStaffProfile(user: User): Promise<StaffProfile | null> {
  const email = user.email?.trim();
  if (!email) return null;

  try {
    const snap = await getDoc(doc(db, STAFF_USERS_COLLECTION, email));
    if (!snap.exists()) return null;

    const data = snap.data() as Partial<StaffProfile> & { displayName?: string };
    if (data.active === false) return null;

    return {
      email,
      role: roleFromClaim(data.role) || 'teacher',
      name: data.name || data.displayName || user.displayName || email,
      active: data.active,
    };
  } catch (error) {
    console.error('Unable to read staff allowlist profile', error);
    return null;
  }
}

export async function getAuthorizedStaffProfile(user: User): Promise<StaffProfile | null> {
  const token = await getIdTokenResult(user, true);
  const fallback = fallbackProfile(user);
  const listed = await listedStaffProfile(user);
  const role =
    roleFromClaim(token.claims.role) ||
    (token.claims.admin === true ? 'admin' : null) ||
    listed?.role ||
    fallback?.role ||
    null;

  if (!role) return null;

  return {
    email: user.email || listed?.email || fallback?.email || '',
    role,
    name: listed?.name || user.displayName || fallback?.name || user.email || 'ครู',
    active: listed?.active,
  };
}

async function stateFromUser(user: User | null): Promise<AuthState> {
  if (!user) return { ...DEFAULT_AUTH_STATE, loading: false };

  const profile = await getAuthorizedStaffProfile(user);
  if (!profile) return { ...DEFAULT_AUTH_STATE, loading: false };

  return {
    authed: true,
    loading: false,
    role: profile.role,
    name: profile.name,
    email: profile.email,
  };
}

export async function signInTeacher(usernameOrEmail: string, password: string) {
  const credential = await signInWithEmailAndPassword(auth, resolveStaffEmail(usernameOrEmail), password);
  const profile = await getAuthorizedStaffProfile(credential.user);
  if (!profile) {
    await signOut(auth);
    throw new Error('อีเมลนี้ยังไม่อยู่ในรายชื่อครูที่อนุญาต');
  }
}

export async function signInTeacherWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const credential = await signInWithPopup(auth, provider);
  const profile = await getAuthorizedStaffProfile(credential.user);
  if (!profile) {
    await signOut(auth);
    throw new Error('อีเมล Google นี้ยังไม่อยู่ในรายชื่อครูที่อนุญาต');
  }
}

export async function clearAuth() {
  await signOut(auth);
}

export function useTeacherAuth(): AuthState & { logout: () => void } {
  const [state, setState] = useState<AuthState>(DEFAULT_AUTH_STATE);

  useEffect(() => {
    let alive = true;
    const unsubscribe = onAuthStateChanged(auth, async user => {
      try {
        const next = await stateFromUser(user);
        if (user && !next.authed) {
          await signOut(auth);
        }
        if (alive) setState(next);
      } catch (err) {
        console.error('Unable to read Firebase auth state', err);
        if (alive) setState({ ...DEFAULT_AUTH_STATE, loading: false });
      }
    });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  return {
    ...state,
    logout: () => {
      void clearAuth();
    },
  };
}
