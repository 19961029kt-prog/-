// YT.SharedCards … 旅の便り（写真のポストカード）を、ログインした人どうしで見せ合う（Firestore の postcards）。
// - 審査はしない。気になる写真は「通報」でき、通報が3件そろうと自動で見えなくなる（運営が review.html で確かめて、戻すか消す）。
// - 写真は投函のときに作った切手と消印つきの JPEG を Canvas で描き直して data URL で送る（撮った場所などの Exif は残らない）。
//   一覧に出す小さな写真（長い辺360px・6万字まで）は postcards に、拡大したときの大きな写真（900px・50万字まで）は postcardImages に分ける。
//   一覧は新しい順に20枚ずつ（「もっと見る」で続き）、大きな写真は拡大したときだけ1枚読む。人が増えても読み込みの量とお金を抑えるため。
// - 素敵ね（本物の旅人どうし）は1人1回。数はルールが確かめる。ゲームのクラフト資金には入れない（架空の旅人の便りだけ）。
// - 守りは firebase/firestore.rules。読んだ文字は postcards.js が esc() を通して出す。AI は使わない。
(function () {
  'use strict';
  const YT = (window.YT = window.YT || {});
  const BIG = { limit: 480000, steps: [[900, 0.8], [900, 0.7], [760, 0.68], [640, 0.62]] }; // ルールの上限（50万字）より少し小さく
  const THUMB = { limit: 56000, steps: [[360, 0.72], [320, 0.66], [280, 0.6], [240, 0.55]] }; // ルールの上限（6万字）より少し小さく
  const PAGE = 20; // 旅の便りのタブで一度に読む枚数
  const PER_STATION = 12; // 現地スナップで読む枚数
  const TTL = 10 * 60 * 1000; // 同じ一覧は10分は読み直さない
  const cache = {};
  const fullCache = {}; // 大きな写真（id → { at: 更新の時刻, image }）。同じ写真は読み直さない
  let recent = null;

  const ready = () => !!(YT.Gate && YT.Gate.user && YT.Gate.profile && !YT.Firebase.offline);
  const uid = () => YT.Gate.user.uid;
  const pidOf = (stationId, u = uid()) => `${u}_${stationId}`;

  // JPEG の Blob → 送る大きさの data URL（大きすぎれば、画質と大きさを下げて作り直す）
  async function toDataUrl(blob, { limit, steps }) {
    const url = URL.createObjectURL(blob);
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    URL.revokeObjectURL(url);
    for (const [side, q] of steps) {
      const k = Math.min(1, side / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * k);
      c.height = Math.round(img.naturalHeight * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      const d = c.toDataURL('image/jpeg', q);
      if (d.length <= limit) return d;
    }
    throw new Error('too-large');
  }

  // 投函した1枚を、ほかの旅人にも見せる（1人1駅1枚。すでにあれば差し替え）。小さな写真と大きな写真を1回の一括書き込みで
  async function share(stationId, blob, memo) {
    if (!ready()) throw new Error('not-ready');
    const { fs, db } = await YT.Firebase.boot({ auth: true });
    const [thumb, image] = await Promise.all([toDataUrl(blob, THUMB), toDataUrl(blob, BIG)]);
    const pid = pidOf(stationId);
    const ref = fs.doc(db, 'postcards', pid);
    const name = YT.Gate.profile.displayName;
    const snap = await fs.getDoc(ref).catch(() => null);
    const b = fs.writeBatch(db);
    if (snap && snap.exists()) b.update(ref, { memo, thumb, name, updatedAt: fs.serverTimestamp() });
    else b.set(ref, { uid: uid(), stationId, memo, thumb, name, createdAt: fs.serverTimestamp(), updatedAt: fs.serverTimestamp(), likeCount: 0, reportCount: 0, hidden: false });
    b.set(fs.doc(db, 'postcardImages', pid), { uid: uid(), image, updatedAt: fs.serverTimestamp() });
    await b.commit();
    forget();
  }
  async function unshare(stationId) {
    if (!ready()) return;
    const { fs, db } = await YT.Firebase.boot({ auth: true });
    const pid = pidOf(stationId);
    const b = fs.writeBatch(db);
    b.delete(fs.doc(db, 'postcards', pid));
    b.delete(fs.doc(db, 'postcardImages', pid));
    await b.commit();
    forget();
  }
  function forget() {
    Object.keys(cache).forEach((k) => delete cache[k]);
    recent = null;
  }

  const rows = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((c) => c.uid !== uid());
  const newest = (fs) => [fs.where('hidden', '==', false), fs.orderBy('updatedAt', 'desc')];
  // その駅のほかの旅人の便り（隠れていないもの・新しい順に12枚）
  async function forStation(stationId) {
    if (!ready()) return [];
    const hit = cache[stationId];
    if (hit && Date.now() - hit.at < TTL) return hit.list;
    const { fs, db } = await YT.Firebase.boot({ auth: true });
    const snap = await fs.getDocs(fs.query(fs.collection(db, 'postcards'), fs.where('stationId', '==', stationId), ...newest(fs), fs.limit(PER_STATION)));
    const list = rows(snap);
    cache[stationId] = { at: Date.now(), list };
    return list;
  }
  // 九州じゅうの新しい便り（旅の便りのタブ用）。20枚ずつ。more で続きを読む。{ list: これまでに読んだぶん, more: 続きがあるか }
  async function latest({ more = false } = {}) {
    if (!ready()) return { list: [], more: false };
    if (!more && recent && Date.now() - recent.at < TTL) return { list: recent.list, more: !!recent.last };
    const { fs, db } = await YT.Firebase.boot({ auth: true });
    const after = more && recent && recent.last ? [fs.startAfter(recent.last)] : [];
    const snap = await fs.getDocs(fs.query(fs.collection(db, 'postcards'), ...newest(fs), ...after, fs.limit(PAGE)));
    const list = (more && recent ? recent.list : []).concat(rows(snap));
    recent = { at: Date.now(), list, last: snap.docs.length === PAGE ? snap.docs[snap.docs.length - 1] : null };
    return { list, more: !!recent.last };
  }
  // 拡大したときの大きな写真（読めなければ小さな写真のまま）
  async function fullImage(card) {
    const at = card.updatedAt ? card.updatedAt.toMillis() : 0;
    const hit = fullCache[card.id];
    if (hit && hit.at === at) return hit.image;
    const { fs, db } = await YT.Firebase.boot({ auth: true });
    const d = await fs.getDoc(fs.doc(db, 'postcardImages', card.id));
    const image = d.exists() ? d.data().image : '';
    if (image) fullCache[card.id] = { at, image };
    return image;
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
        forget();
        return;
      } catch (e) {
        if (i === 1) throw e;
      }
    }
  }

  const REASONS = [['face', '人の顔や、だれかがわかるものが写っている'], ['private', '住所・車のナンバーなど個人の情報が写っている'], ['copyright', 'ほかの人が撮った写真・著作物のようだ'], ['inappropriate', '不快・不適切な写真や言葉'], ['other', 'その他']];
  YT.SharedCards = { ready, share, unshare, forStation, latest, fullImage, like, report, REASONS, pidOf };
})();
