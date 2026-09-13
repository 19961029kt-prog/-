// Firebaseコンソール(https://console.firebase.google.com/)でプロジェクトを作成し、
// 「プロジェクトの設定 > 全般 > マイアプリ > ウェブアプリを追加」で表示される
// firebaseConfig の値をここに貼り付けてください。
//
// この値はクライアント側で公開される情報であり、秘密鍵ではありません
// (アクセス制御はFirestoreのセキュリティルール側で行います)。
export const firebaseConfig = {
  apiKey: 'AIzaSyDx5pVFTpE5cqhEWLAb9OgswasTWKG5XOs',
  authDomain: 'gmap-498a1.firebaseapp.com',
  projectId: 'gmap-498a1',
  storageBucket: 'gmap-498a1.firebasestorage.app',
  messagingSenderId: '929987493368',
  appId: '1:929987493368:web:2b04380f9885b07d70ea0d',
};

/** firebaseConfig が実際の値に置き換えられているかどうか。 */
export function isFirebaseConfigured(): boolean {
  return Boolean(firebaseConfig.apiKey) && firebaseConfig.apiKey !== 'YOUR_API_KEY';
}
