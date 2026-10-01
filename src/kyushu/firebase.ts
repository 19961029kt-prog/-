import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { firebaseConfig } from '../gmap/firebaseConfig';

// GMAP対策アプリと同じFirebaseプロジェクトを使い、コレクション名(kyushu_*)でデータを分けている
const app = initializeApp(firebaseConfig, 'kyushu');

export const auth = getAuth(app);
export const db = getFirestore(app);

// `VITE_FIREBASE_EMULATOR=1 npm run dev` で起動すると、本番ではなくローカルのエミュレータにつなぐ
if (import.meta.env.VITE_FIREBASE_EMULATOR) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}

export const USERS = 'kyushu_users';
export const POSTS = 'kyushu_posts';
export const COMMENTS = 'comments';
