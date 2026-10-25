// YT.Cloud … 遊んだ記録をデータベース（Firestore の saves/{uid}）にも保存する。
// - 端末の localStorage はそのまま使い（すぐ読めて、通信が切れても遊べる）、変わったら少し待ってデータベースへ送る。
// - ログインしたとき：データベースの記録のほうが新しければ（別の端末で遊んだなど）それに入れ替えて、画面を読み込み直す。
//   端末に別の人の記録が残っていたら（ログインを切り替えた）、混ぜずに入れ替えるか、まっさらにする。
// - 旅の便りの写真（IndexedDB）は重いので送らない（記録の中には写真の ID だけ）。
// - 守りは firebase/firestore.rules（本人だけが読み書き・大きさの上限）。
(function () {
  'use strict';
  const YT = (window.YT = window.YT || {});
  const LIMIT = 400000; // ルールの上限と同じ（文字数）
  const WAIT = 2500; // 変わってから送るまでの待ち（ダイスを続けて振っても、まとめて1回）
  let fb = null, uid = null, timer = 0, sending = false, again = false;

  const ref = () => fb.fs.doc(fb.db, 'saves', uid);

  async function push() {
    if (!fb || !uid) return;
    if (sending) return (again = true);
    const Store = YT.Store;
    const s = Store.get();
    if (s.cloudUid !== uid) return; // 別の人の記録は送らない
    const json = Store.toJSON();
    if (json.length > LIMIT) return; // 上限を超える記録は送らない（端末には残る）
    sending = true;
    try {
      await fb.fs.setDoc(ref(), { data: json, version: s.version, progress: Store.progress(), savedAt: Math.floor(s.savedAt || Date.now()), updatedAt: fb.fs.serverTimestamp() });
    } catch (e) {
      /* 通信できないときは、次に変わったときにまた送る */
    }
    sending = false;
    if (again) { again = false; schedule(); }
  }
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(push, WAIT);
  }

  // ログインした直後に1回。'reload' を返したら、呼ぶ側は何もしない（すぐ読み込み直す）
  async function onLogin(firebase, user) {
    const Store = YT.Store;
    fb = firebase;
    uid = null;
    let remote = null;
    try {
      const snap = await fb.fs.getDoc(fb.fs.doc(fb.db, 'saves', user.uid));
      remote = snap.exists() ? snap.data() : null;
    } catch (e) {
      // 読めないとき（通信が切れたなど）は、端末の記録で遊び続ける。送るのは次に読めたとき
      return 'offline';
    }
    const local = Store.get();
    const foreign = local.cloudUid && local.cloudUid !== user.uid;
    // どちらを残すか：
    // - この人の記録どうし（端末もこの人のもの）なら、あとで保存したほう
    // - 端末の記録がまだだれのものでもない（はじめての端末・ログイン前に遊んだ記録）なら、進み具合の大きいほう。
    //   はじめての端末は起動しただけで保存の時刻が新しくなるので、時刻では比べない（同じなら、データベースのほう）
    const remoteWins = remote && (foreign
      || (local.cloudUid === user.uid ? (remote.savedAt || 0) > (local.savedAt || 0) : (remote.progress || 0) >= Store.progress(local)));
    if (remoteWins) {
      if (Store.adopt(remote.data, user.uid)) {
        location.reload();
        return 'reload';
      }
    }
    if (foreign) {
      Store.clearForeign(user.uid);
      location.reload();
      return 'reload';
    }
    Store.claim(user.uid);
    uid = user.uid;
    schedule();
    return 'ok';
  }
  function onLogout() {
    clearTimeout(timer);
    uid = null;
  }

  // 記録が変わるたびに、少し待って送る。タブを閉じる・別のアプリへ移るときは、すぐ送る
  function watch() {
    if (!YT.Store) return;
    YT.Store.onChange(() => uid && schedule());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && uid) {
        clearTimeout(timer);
        push();
      }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch);
  else watch();

  YT.Cloud = { onLogin, onLogout, flush: push };
})();
