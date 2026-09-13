import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, signInAnonymously, type Auth } from 'firebase/auth';
import { doc, getFirestore, onSnapshot, setDoc, type Firestore } from 'firebase/firestore';
import { firebaseConfig, isFirebaseConfigured } from './firebaseConfig';

interface FirebaseCtx {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
}

let ctx: FirebaseCtx | null = null;

function ensureInit(): FirebaseCtx | null {
  if (!isFirebaseConfigured()) return null;
  if (!ctx) {
    const app = initializeApp(firebaseConfig);
    ctx = { app, auth: getAuth(app), db: getFirestore(app) };
  }
  return ctx;
}

/** 名前+生年月日から、デバイス間でデータを同期するためのキーを導出する(パスワードではない)。 */
export async function deriveProfileKey(name: string, birthday: string): Promise<string> {
  const normalized = `${name.trim().toLowerCase()}|${birthday.trim()}`;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** profiles/{profileKey} ドキュメントをリアルタイム購読する。Firebase未設定時は何もしない。 */
export function subscribeProfile(
  profileKey: string,
  onData: (data: Record<string, unknown>) => void,
): () => void {
  const firebase = ensureInit();
  if (!firebase) return () => {};

  let unsubscribeSnapshot: (() => void) | null = null;
  let cancelled = false;

  signInAnonymously(firebase.auth)
    .then(() => {
      if (cancelled) return;
      unsubscribeSnapshot = onSnapshot(
        doc(firebase.db, 'profiles', profileKey),
        (snap) => {
          if (snap.exists()) onData(snap.data());
        },
        (err) => console.error('GMAP cloud sync: snapshot error', err),
      );
    })
    .catch((err) => console.error('GMAP cloud sync: anonymous sign-in failed', err));

  return () => {
    cancelled = true;
    unsubscribeSnapshot?.();
  };
}

export async function writeProfile(profileKey: string, data: Record<string, unknown>): Promise<void> {
  const firebase = ensureInit();
  if (!firebase) return;
  await setDoc(doc(firebase.db, 'profiles', profileKey), data);
}

export { isFirebaseConfigured };
