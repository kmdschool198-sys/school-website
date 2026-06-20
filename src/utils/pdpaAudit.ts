import { addDoc, collection, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

type AnyRecord = Record<string, unknown>;

export type PdpaRequestType = 'access' | 'correct' | 'delete' | 'withdraw' | 'breach' | 'complaint' | 'other';

type PdpaRequestInput = {
  type: PdpaRequestType;
  requesterName: string;
  contact: string;
  relation: string;
  detail: string;
};

function pageContext() {
  if (typeof window === 'undefined') return {};
  return {
    path: window.location.pathname,
    userAgent: window.navigator.userAgent,
  };
}

function actorContext() {
  const user = auth.currentUser;
  if (!user) return null;
  return {
    actorUid: user.uid,
    actorEmail: user.email || '',
    actorName: user.displayName || user.email || '',
  };
}

export async function recordPdpaAudit(action: string, target: string, metadata: AnyRecord = {}) {
  const actor = actorContext();
  if (!actor) return;

  try {
    await addDoc(collection(db, 'pdpa_audit_logs'), {
      action,
      target,
      metadata,
      ...actor,
      ...pageContext(),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.warn('PDPA audit log failed', error);
  }
}

export async function recordConsentDecision(input: {
  consentKey: string;
  title: string;
  accepted: boolean;
  context?: AnyRecord;
}) {
  const actor = actorContext();
  if (!actor) return;

  const id = `${actor.actorUid}_${input.consentKey}`;
  const payload = {
    consentKey: input.consentKey,
    title: input.title,
    accepted: input.accepted,
    status: input.accepted ? 'accepted' : 'withdrawn',
    context: input.context || {},
    ...actor,
    ...pageContext(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'pdpa_consents', id), payload, { merge: true });
    await recordPdpaAudit(input.accepted ? 'consent.accepted' : 'consent.withdrawn', input.consentKey, {
      title: input.title,
      context: input.context || {},
    });
  } catch (error) {
    console.warn('PDPA consent log failed', error);
  }
}

export async function recordDataExport(input: {
  kind: string;
  title: string;
  fileName: string;
  collections: string[];
}) {
  await recordPdpaAudit('data.export.csv', input.kind, input);
}

export async function createPdpaRequest(input: PdpaRequestInput) {
  const trimmed = {
    type: input.type,
    requesterName: input.requesterName.trim(),
    contact: input.contact.trim(),
    relation: input.relation.trim(),
    detail: input.detail.trim(),
  };

  await addDoc(collection(db, 'pdpa_requests'), {
    ...trimmed,
    status: 'new',
    source: 'privacy-page',
    ...pageContext(),
    createdAt: serverTimestamp(),
  });
}
