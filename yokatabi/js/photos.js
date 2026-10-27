// 端末の中の画像置き場（旅の便りの写真）と、朱肉のかすれのSVGフィルタ。
//   ・保存：IndexedDB（縮小した JPEG だけ）。写真はここからは送らない（ほかの旅人に見せる写真は shared-cards.js が Firestore に送る）
//   ・IndexedDB の名前 'qtrip-receipts' は、遊んでいる人の保存データを守るため旧名のまま（以前はレシートのスクショも置いていた）
(function () {
  'use strict';
  const YT = (window.YT = window.YT || {});

  // ---------- 端末内の保存（IndexedDB） ----------
  const DB = 'qtrip-receipts', STORE = 'images';
  const memory = new Map(); // IndexedDB が使えない環境（プライベートブラウズ等）では、開いているあいだだけ持つ
  let dbp = null;
  function db() {
    if (!dbp) {
      dbp = new Promise((resolve) => {
        try {
          const req = indexedDB.open(DB, 1);
          req.onupgradeneeded = () => req.result.createObjectStore(STORE);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(null);
        } catch (e) {
          resolve(null);
        }
      });
    }
    return dbp;
  }
  async function tx(mode, fn) {
    const d = await db();
    if (!d) return fn(null);
    return new Promise((resolve) => {
      try {
        const t = d.transaction(STORE, mode);
        const r = fn(t.objectStore(STORE));
        t.oncomplete = () => resolve(r && 'result' in r ? r.result : undefined);
        t.onerror = () => resolve(undefined);
      } catch (e) {
        resolve(undefined);
      }
    });
  }
  const put = (id, blob) => (memory.set(id, blob), tx('readwrite', (s) => s && s.put(blob, id)));
  async function get(id) {
    if (memory.has(id)) return memory.get(id);
    const blob = await tx('readonly', (s) => s && s.get(id));
    if (blob) memory.set(id, blob);
    return blob || null;
  }
  const clear = () => (memory.clear(), tx('readwrite', (s) => s && s.clear()));
  // 1枚だけ消す（旅の便りの写真を差し替えたとき）
  function del(id) {
    memory.delete(id);
    if (urls.has(id)) URL.revokeObjectURL(urls.get(id));
    urls.delete(id);
    return tx('readwrite', (s) => s && s.delete(id));
  }
  // サムネイルの URL（同じ画像は1つの URL を使い回す）
  const urls = new Map();
  async function thumbUrl(id) {
    if (urls.has(id)) return urls.get(id);
    const blob = await get(id);
    if (!blob) return null;
    const u = URL.createObjectURL(blob);
    urls.set(id, u);
    return u;
  }

  // ---------- 画像の読み込みと縮小 ----------
  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const u = URL.createObjectURL(file);
      img.onload = () => resolve({ img, url: u });
      img.onerror = () => reject(new Error('画像を読み込めませんでした'));
      img.src = u;
    });
  }
  // サムネイル：長い辺を 480px にした JPEG
  async function thumbnail(img) {
    const k = Math.min(1, 480 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k);
    c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return new Promise((resolve) => c.toBlob((b) => resolve(b), 'image/jpeg', 0.82));
  }

  // ---------- 朱肉・消印のかすれ ----------
  // feTurbulence で輪郭をゆらし（feDisplacementMap）、細かいノイズで朱肉ののらないところを抜く
  function inkFilter(id, seed) {
    return `<filter id="${id}" x="-8%" y="-8%" width="116%" height="116%">
        <feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="2" seed="${seed}" result="warp"/>
        <feDisplacementMap in="SourceGraphic" in2="warp" scale="2.4" xChannelSelector="R" yChannelSelector="G" result="inked"/>
        <feTurbulence type="fractalNoise" baseFrequency="1.9" numOctaves="1" seed="${seed + 7}" result="grain"/>
        <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.2 1.55" result="holes"/>
        <feComposite in="inked" in2="holes" operator="in"/>
      </filter>`;
  }

  YT.Photos = { put, get, del, clear, thumbUrl, loadImage, thumbnail, inkFilter };
})();
