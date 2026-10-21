// 旅のレシート（注文完了・予約完了のスクショ）：端末の中だけに保存し、画像から金額とショップ名を読み取る。
//   ・保存：IndexedDB（縮小したサムネイルだけ）。画像はどこにも送信しない（注文画面には名前・住所・注文番号が写るため）
//   ・同じ画像の二重登録を防ぐため、元の画像のバイト列から指紋（ハッシュ）を作って記録する
//   ・読み取り：Tesseract.js（ブラウザで動くオープンソースの文字認識）を、画像を置いたときにだけ CDN から読み込む
//     初回は約6MB（認識エンジンと日本語のモデル）。読み込めない・読み取れないときは、確認フォームで金額を直せる
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

  // ---------- 画像の下ごしらえ ----------
  // 指紋：FNV-1a（32bit）を2通りの初期値で回して並べる。暗号用ではなく、同じ画像かどうかを見分けるためのもの
  async function fingerprint(file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let a = 0x811c9dc5, b = 0x01000193 ^ bytes.length;
    for (let i = 0; i < bytes.length; i++) {
      a = Math.imul(a ^ bytes[i], 16777619) >>> 0;
      b = Math.imul(b ^ bytes[bytes.length - 1 - i], 16777619) >>> 0;
    }
    return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
  }
  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const u = URL.createObjectURL(file);
      img.onload = () => resolve({ img, url: u });
      img.onerror = () => reject(new Error('画像を読み込めませんでした'));
      img.src = u;
    });
  }
  // サムネイル：長い辺を 480px にした JPEG（アルバム用。読み取りには元の画像を使う）
  async function thumbnail(img) {
    const k = Math.min(1, 480 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k);
    c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return new Promise((resolve) => c.toBlob((b) => resolve(b), 'image/jpeg', 0.82));
  }

  // ---------- 文字の読み取り（Tesseract.js） ----------
  // CDN の版は固定する（キャッシュが効き、ある日突然動きが変わらないように）
  const TESS = {
    script: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js',
    workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js',
    corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1',
    langPath: 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/jpn@1.0.0/4.0.0_best_int',
  };
  let libp = null, workerp = null, onProgress = null;
  function loadLib() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    if (!libp) {
      libp = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = TESS.script;
        s.onload = () => resolve(window.Tesseract);
        s.onerror = () => ((libp = null), reject(new Error('文字認識の読み込みに失敗しました')));
        document.head.appendChild(s);
      });
    }
    return libp;
  }
  function worker() {
    if (!workerp) {
      workerp = loadLib()
        .then((T) =>
          T.createWorker('jpn', 1, {
            workerPath: TESS.workerPath,
            corePath: TESS.corePath,
            langPath: TESS.langPath,
            logger: (m) => onProgress && onProgress(m),
          })
        )
        .catch((e) => {
          workerp = null;
          throw e;
        });
    }
    return workerp;
  }
  // 画像の文字を読む（60秒で打ち切る）
  async function recognize(file, progress) {
    onProgress = progress;
    const run = worker().then((w) => w.recognize(file)).then((r) => r.data.text);
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('読み取りに時間がかかりすぎました')), 60000));
    try {
      return await Promise.race([run, timeout]);
    } finally {
      onProgress = null;
    }
  }

  // ---------- 読み取った文字から、金額とショップを取り出す ----------
  // 文字認識は「¥4, 800」「4 800円」「注文 合計」のように空白や全角が混じり、¥ は「\」、桁の「,」は「.」に
  // 読まれやすい（日本語の文字コードでは ¥ と \ が同じ場所にあるため。「30.,000」のように両方出ることもある）。まずそろえてから探す
  function normalizeText(t) {
    const JA = '\u3000-\u30ff\u4e00-\u9fff\uff01-\uff60';
    return String(t || '')
      .replace(new RegExp(`([${JA}])[ \t]+(?=[${JA}])`, 'g'), '$1')
      .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
      .replace(/[，、]/g, ',')
      .replace(/[￥\\＼]/g, '¥')
      .replace(/(\d)[ \t]*[.,][ \t.,]*(?=\d{3}(?!\d))/g, '$1,') // 「4.800」「4, 800」「30.,000」→ 桁の「,」
      .replace(/(\d) (?=\d{3}\b)/g, '$1')
      .replace(/[ \t]+/g, ' ');
  }
  const KEYWORDS = [
    [/(ご請求額|ご請求金額|お支払い?金額|お支払い?合計|支払い?金額|注文合計|ご注文合計|総合計|合計金額|お支払総額|ご利用金額|総額|合計)/, 3],
    [/(小計|商品代金|宿泊料金|料金)/, 1],
  ];
  function parse(text, shops, maxAmount = 1000000) {
    const t = normalizeText(text);
    const lines = t.split(/\n+/);
    const money = /(?:¥\s*([\d,]{2,9})|([\d,]{2,9})\s*円)/g;
    const toNum = (s) => Number(String(s).replace(/,/g, ''));
    const found = [];
    lines.forEach((line, i) => {
      let m;
      money.lastIndex = 0;
      while ((m = money.exec(line))) {
        const v = toNum(m[1] || m[2]);
        if (!(v >= 50 && v <= maxAmount)) continue;
        // 同じ行かすぐ上の行に「合計」「お支払い金額」などがあれば、それを優先する
        const near = `${lines[i - 1] || ''} ${line.slice(0, m.index)}`;
        const weight = KEYWORDS.reduce((w, [re, k]) => (re.test(near) ? Math.max(w, k) : w), 0);
        found.push({ v, weight, i });
      }
    });
    found.sort((a, b) => b.weight - a.weight || b.i - a.i || b.v - a.v);
    const amount = found.length ? (found[0].weight ? found[0].v : Math.max(...found.map((f) => f.v))) : null;
    const lower = t.toLowerCase();
    const shop = (shops || []).find((s) => new RegExp(s.match, 'i').test(lower)) || null;
    return { amount, shop: shop ? shop.id : null, candidates: [...new Set(found.map((f) => f.v))].slice(0, 6) };
  }

  // ---------- 査収スタンプ（Q-TRIP 旅の領収書）----------
  function receiptStampSvg(date) {
    return `<svg viewBox="0 0 160 110" class="receipt-stamp-svg" aria-hidden="true">
      <rect x="4" y="4" width="152" height="102" rx="12" class="rs-ring"/>
      <rect x="10" y="10" width="140" height="90" rx="8" class="rs-ring rs-thin"/>
      <text x="80" y="42" text-anchor="middle" class="rs-big">【査収】</text>
      <text x="80" y="64" text-anchor="middle" class="rs-mid">Q-TRIP 旅の領収書</text>
      <line x1="26" y1="74" x2="134" y2="74" class="rs-line"/>
      <text x="80" y="92" text-anchor="middle" class="rs-date">${date}</text>
    </svg>`;
  }

  YT.Receipts = { put, get, clear, thumbUrl, fingerprint, loadImage, thumbnail, recognize, parse, normalizeText, receiptStampSvg, TESS };
})();
