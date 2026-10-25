// YT.Firebase … Firebase の起動をひとつにまとめる（地元の人の声のためだけに使う。AI は使わない）。
// - SDK はサイトの中の写し（js/vendor/firebase-<版>/。tools/vendor-firebase.mjs が作る）を、必要になったときだけ import() する。
//   ページを開いただけでは何も読み込まない（寄り道手帖をひらいたとき・窓口のページだけ）。
// - App Check（reCAPTCHA Enterprise）を、Firestore と Authentication より先に必ず起動する。コンソールで「適用」にしてあるので、
//   App Check の証明がない呼び出しはサーバーで断られる。
// - localhost で ?emulator を付けたときだけ、ローカルのエミュレーター（projectId demo-qtrip）につなぐ。本番のデータには触れない。
//   localhost で本番につなぐのは ?live を付けたときだけ（ふだんの開発やテストで本番に通信しないように）。
(function () {
  'use strict';
  const YT = (window.YT = window.YT || {});
  const VERSION = '13.0.0';
  const RECAPTCHA_SITE_KEY = '6Ldf2_8tAAAAACas2lgaNIMcckacg8X6QCHjEjpZ'; // サイトキーは秘密ではない（ページに載る前提の値）
  const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  const params = new URLSearchParams(location.search);
  const emulator = local && params.has('emulator');
  const offline = local && !emulator && !params.has('live'); // 手元で何も付けないときは、どこにもつながない
  let booting = null;

  function base() {
    // index.html と review.html のどちらから呼んでも、サイトの中の写しを指す
    return new URL(`js/vendor/firebase-${VERSION}/`, document.baseURI).href;
  }

  // 起動して { app, fs, db, authMod?, auth? } を返す。file:// や読み込みに失敗したときは reject（呼ぶ側は静かにあきらめる）
  function boot({ auth = false } = {}) {
    if (location.protocol === 'file:' || offline) return Promise.reject(new Error('offline'));
    if (!booting) {
      booting = (async () => {
        const b = base();
        const [appMod, fs] = await Promise.all([import(b + 'firebase-app.js'), import(b + 'firebase-firestore-lite.js')]);
        const config = emulator ? { ...YT.firebaseConfig, projectId: 'demo-qtrip', apiKey: 'demo-key' } : YT.firebaseConfig;
        const app = appMod.initializeApp(config);
        if (!emulator) {
          // 手元（localhost?live）で本番につなぐときは、App Check のデバッグ用トークンを使う（コンソールに登録したものだけが通る）
          if (local) self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
          const ac = await import(b + 'firebase-app-check.js');
          ac.initializeAppCheck(app, { provider: new ac.ReCaptchaEnterpriseProvider(RECAPTCHA_SITE_KEY), isTokenAutoRefreshEnabled: true });
        }
        const db = fs.getFirestore(app);
        if (emulator) fs.connectFirestoreEmulator(db, '127.0.0.1', 8080);
        return { app, fs, db, emulator };
      })();
      booting.catch(() => (booting = null)); // 通信が戻ったら、次に呼んだときにやり直せるように
    }
    if (!auth) return booting;
    return booting.then(async (fb) => {
      if (fb.auth) return fb;
      const authMod = await import(base() + 'firebase-auth.js');
      const a = authMod.initializeAuth(fb.app, { persistence: authMod.browserLocalPersistence });
      if (emulator) authMod.connectAuthEmulator(a, 'http://127.0.0.1:9099', { disableWarnings: true });
      a.languageCode = 'ja';
      return Object.assign(fb, { authMod, auth: a });
    });
  }

  YT.Firebase = { boot, emulator, offline: offline || location.protocol === 'file:' };
})();
