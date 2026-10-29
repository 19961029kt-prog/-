// YT.SharedCards … 旅の便り（写真のポストカード）を、ログインした人どうしで見せ合う（Firestore の postcards）。
// - 審査はしない。気になる写真は「通報」でき、通報が3件そろうと自動で見えなくなる（運営が review.html で確かめて、戻すか消す）。
// - 写真は投函のときに作った切手と消印つきの JPEG を、長い辺900pxまで縮め直して data URL で送る（50万字まで）。
//   Canvas で描き直すので、撮った場所などの情報（Exif）は残らない。
// - 素敵ね（本物の旅人どうし）は1人1回。数はルールが確かめる。ゲームのクラフト資金には入れない（架空の旅人の便りだけ）。
// - 守りは firebase/firestore.rules。読んだ文字は postcards.js が esc() を通して出す。AI は使わない。
(function () {
  'use strict';
  const YT = (window.YT = window.YT || {});
  const LIMIT = 480000; // ルールの上限（50万字）より少し小さく
  const TTL = 2 * 60 * 1000; // 同じ駅は2分は読み直さない
  const cache = {};
  let recent = null;

  const ready = () => !!(YT.Gate && YT.Gate.user && YT.Gate.profile && !YT.Firebase.offline);
  const uid = () => YT.Gate.user.uid;
  const pidOf = (stationId, u = uid()) => `${u}_${stationId}`;

  // JPEG の Blob → 送る大きさの data URL（大きすぎれば、画質と大きさを下げて作り直す）
  async function toDataUrl(blob) {
    const url = URL.createObjectURL(blob);
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    URL.revokeObjectURL(url);
    for (const [side, q] of [[900, 0.8], [900, 0.7], [760, 0.68], [640, 0.62]]) {
      const k = Math.min(1, side / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * k);
      c.height = Math.round(img.naturalHeight * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      const d = c.toDataURL('image/jpeg', q);
      if (d.length <= LIMIT) return d;
    }
    throw new Error('too-large');
  }

  // 投函した1枚を、ほかの旅人にも見せる（1人1駅1枚。すでにあれば差し替え）
  async function share(stationId, blob, memo) {
    if (!ready()) throw new Error('not-ready');
    const { fs, db } = await YT.Firebase.boot({ auth: true });
    const image = await toDataUrl(blob);
    const ref = fs.doc(db, 'postcards', pidOf(stationId));
    const name = YT.Gate.profile.displayName;
    const snap = await fs.getDoc(ref).catch(() => null);
    if (snap && snap.exists()) await fs.updateDoc(ref, { memo, image, name, updatedAt: fs.serverTimestamp() });
    else await fs.setDoc(ref, { uid: uid(), stationId, memo, image, name, createdAt: fs.serverTimestamp(), updatedAt: fs.serverTimestamp(), likeCount: 0, reportCount: 0, hidden: false });
    delete cache[stationId];
    recent = null;
  }
  async function unshare(stationId) {
    if (!ready()) return;
    const { fs, db } = await YT.Firebase.boot({ auth: true });
    await fs.deleteDoc(fs.doc(db, 'postcards', pidOf(stationId)));
    delete cache[stationId];
    recent = null;
  }

  const rows = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((c) => c.uid !== uid());
  const byNew = (a, b) => (b.updatedAt ? b.updatedAt.toMillis() : 0) - (a.updatedAt ? a.updatedAt.toMillis() : 0);
  // その駅のほかの旅人の便り（隠れていないもの）
  async function forStation(stationId) {
    if (!ready()) return [];
    const hit = cache[stationId];
    if (hit && Date.now() - hit.at < TTL) return hit.list;
    const { fs, db } = await YT.Firebase.boot({ auth: true });
    const snap = await fs.getDocs(fs.query(fs.collection(db, 'postcards'), fs.where('stationId', '==', stationId), fs.where('hidden', '==', false), fs.limit(30)));
    const list = rows(snap).sort(byNew);
    cache[stationId] = { at: Date.now(), list };
    return list;
  }
  // 九州じゅうの新しい便り（旅の便りのタブ用。並べ替えは手元で：複合インデックスを作らずにすむ）
  async function latest() {
    if (!ready()) return [];
    if (recent && Date.now() - recent.at < TTL) return recent.list;
    const { fs, db } = await YT.Firebase.boot({ auth: true });
    const snap = await fs.getDocs(fs.query(fs.collection(db, 'postcards'), fs.where('hidden', '==', false), fs.limit(80)));
    const list = rows(snap).sort(byNew);
    recent = { at: Date.now(), list };
    return list;
  }

  // 素敵ね：いいねの印を作って、数を1つ増やす（1回の一括書き込み。ルールが1人1回を確かめる）
  async function like(card) {
    const { fs, db } = await YT.Firebase.boot({ auth: true });
    const b = fs.writeBatch(db);
    b.set(fs.doc(db, 'postcards', card.id, 'likes', uid()), { at: fs.serverTimestamp() });
    b.update(fs.doc(db, 'postcards', card.id), { likeCount: fs.increment(1) });
    await b.commit();
    card.likeCount = (card.likeCount || 0) + 1;
  }
  // 通報：通報を作って、通報の数を1つ増やす（3件目で隠れる）。読んだときの数が古ければ、読み直してもう一度
  async function report(card, reason, note) {
    const { fs, db } = await YT.Firebase.boot({ auth: true });
    const ref = fs.doc(db, 'postcards', card.id);
    for (let i = 0; i < 2; i++) {
      const now = i === 0 ? card.reportCount || 0 : ((await fs.getDoc(ref)).data() || {}).reportCount || 0;
      const b = fs.writeBatch(db);
      b.set(fs.doc(db, 'reports', `${uid()}_${card.id}`), { postcardId: card.id, reporter: uid(), reason, note, createdAt: fs.serverTimestamp() });
      b.update(ref, { reportCount: now + 1, hidden: now + 1 >= 3 });
      try {
        await b.commit();
        Object.keys(cache).forEach((k) => delete cache[k]);
        recent = null;
        return;
      } catch (e) {
        if (i === 1) throw e;
      }
    }
  }

  const REASONS = [['face', '人の顔や、だれかがわかるものが写っている'], ['private', '住所・車のナンバーなど個人の情報が写っている'], ['copyright', 'ほかの人が撮った写真・著作物のようだ'], ['inappropriate', '不快・不適切な写真や言葉'], ['other', 'その他']];
  YT.SharedCards = { ready, share, unshare, forStation, latest, like, report, REASONS, pidOf };
})();
