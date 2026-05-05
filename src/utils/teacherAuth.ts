// ─── Shared authentication for ALL teacher systems ───
// Login once → access attendance, leave, training, body-metrics, etc.
import { useState, useEffect } from 'react';

export const AUTH_KEY = 'teacher_auth_v1';
export const ROLE_KEY = 'teacher_role_v1';
export const NAME_KEY = 'teacher_name_v1';

export type Role = 'teacher' | 'super';

export const ACCOUNTS: Record<string, { pass: string; role: Role; name: string }> = {
  adminkmd: { pass: '12345678kmd', role: 'teacher', name: 'ครู (Admin)' },
  jameskmd: { pass: '12345678kmd', role: 'super',   name: 'ผู้ดูแลระบบ' },
};

export interface AuthState {
  authed: boolean;
  role: Role;
  name: string;
}

export function readAuth(): AuthState {
  return {
    authed: sessionStorage.getItem(AUTH_KEY) === '1',
    role: (sessionStorage.getItem(ROLE_KEY) as Role) || 'teacher',
    name: sessionStorage.getItem(NAME_KEY) || 'ครู',
  };
}

export function setAuth(user: string): boolean {
  const acc = ACCOUNTS[user.trim()];
  if (!acc) return false;
  sessionStorage.setItem(AUTH_KEY, '1');
  sessionStorage.setItem(ROLE_KEY, acc.role);
  sessionStorage.setItem(NAME_KEY, acc.name);
  // Notify other tabs/components
  window.dispatchEvent(new Event('teacher-auth-changed'));
  return true;
}

export function clearAuth() {
  sessionStorage.removeItem(AUTH_KEY);
  sessionStorage.removeItem(ROLE_KEY);
  sessionStorage.removeItem(NAME_KEY);
  window.dispatchEvent(new Event('teacher-auth-changed'));
}

// React hook to subscribe to auth changes
export function useTeacherAuth(): AuthState & { logout: () => void } {
  const [state, setState] = useState(readAuth);
  useEffect(() => {
    const update = () => setState(readAuth());
    window.addEventListener('teacher-auth-changed', update);
    window.addEventListener('storage', update);
    return () => {
      window.removeEventListener('teacher-auth-changed', update);
      window.removeEventListener('storage', update);
    };
  }, []);
  return { ...state, logout: clearAuth };
}
