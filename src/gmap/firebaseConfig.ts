// Firebaseコンソール(https://console.firebase.google.com/)でプロジェクトを作成し、
// 「プロジェクトの設定 > 全般 > マイアプリ > ウェブアプリを追加」で表示される
// firebaseConfig の値をここに貼り付けてください。
//
// この値はクライアント側で公開される情報であり、秘密鍵ではありません
// (アクセス制御はFirestoreのセキュリティルール側で行います)。
export const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT_ID.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT_ID.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID',
};

/** firebaseConfig が実際の値に置き換えられているかどうか。 */
export function isFirebaseConfigured(): boolean {
  return Boolean(firebaseConfig.apiKey) && firebaseConfig.apiKey !== 'YOUR_API_KEY';
}
