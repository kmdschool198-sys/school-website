import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import { AUTH_CHANGE_EVENT } from './teacherAuth';

// Staff-only data (rosters, DMC details, scores, leave records) is loaded only for someone signed
// in, so a visitor's browser never downloads it, whatever the Firestore rules allow. Staff accounts
// exist only in Firebase Auth; the dev-only test session (see useTeacherAuth) counts in `npm run dev`.

function devSession(): boolean {
  if (!import.meta.env.DEV) return false;
  try {
    return !!JSON.parse(localStorage.getItem('kmd_teacher_auth_v1') || 'null')?.authed;
  } catch {
    return false;
  }
}

export function useSignedIn(): boolean {
  const [signedIn, setSignedIn] = useState(() => !!auth.currentUser || devSession());
  useEffect(() => {
    const sync = (event: Event) => {
      if ((event as CustomEvent<{ loggedOut?: boolean }>).detail?.loggedOut) {
        setSignedIn(false);
        return;
      }
      setSignedIn(!!auth.currentUser || devSession());
    };
    const unsub = onAuthStateChanged(auth, user => setSignedIn(!!user || devSession()));
    window.addEventListener(AUTH_CHANGE_EVENT, sync);
    return () => {
      unsub();
      window.removeEventListener(AUTH_CHANGE_EVENT, sync);
    };
  }, []);
  return signedIn;
}
