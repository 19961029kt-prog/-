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
  // 文字認識の前の下ごしらえ：白黒にして、暗い横帯（注文画面の濃い色のヘッダー・ダークモード）を反転し、
  // どこも「明るい地に暗い字」にそろえる（文字認識は暗い地の白い字をよく取りこぼすため）。小さい画像は2倍にする
  async function prepare(file) {
    try {
      const bmp = await createImageBitmap(file);
      const k = bmp.width < 900 ? 2 : 1;
      const c = document.createElement('canvas');
      c.width = bmp.width * k;
      c.height = bmp.height * k;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(bmp, 0, 0, c.width, c.height);
      const img = ctx.getImageData(0, 0, c.width, c.height);
      const px = img.data, W = c.width;
      // 行の地の色は、明るさの中央値で見る（白い字が通る行も、地が暗ければ反転する。平均だと字の行だけ反転しそこねる）
      const hist = new Uint32Array(256);
      for (let y = 0; y < c.height; y++) {
        hist.fill(0);
        const row = y * W * 4;
        for (let x = 0; x < W; x++) {
          const i = row + x * 4;
          const l = (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) | 0;
          px[i] = px[i + 1] = px[i + 2] = l;
          hist[l]++;
        }
        let n = 0, median = 0;
        while (median < 255 && (n += hist[median]) < W / 2) median++;
        // 暗い地は反転し、どの行も地の色が白になるように明るさを引きのばす（赤や紺の帯の字も、白地に黒い字にする）
        const inv = median < 128;
        const bg = inv ? 255 - median : median;
        const k = bg > 40 ? 255 / bg : 1;
        for (let x = 0; x < W; x++) {
          const i = row + x * 4;
          const v = Math.min(255, (inv ? 255 - px[i] : px[i]) * k);
          px[i] = px[i + 1] = px[i + 2] = v;
        }
      }
      ctx.putImageData(img, 0, 0);
      return c;
    } catch (e) {
      return file; // 下ごしらえできない環境では、元の画像のまま読む
    }
  }

  // 画像の文字を読む（60秒で打ち切る）
  async function recognize(file, progress) {
    onProgress = progress;
    const run = Promise.all([worker(), prepare(file)]).then(([w, src]) => w.recognize(src)).then((r) => r.data.text);
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

  // ---------- 注文日・予約日を読む（厳格チェック②） ----------
  // 「ご注文日：2026年10月21日」「予約日 2026/10/21」のように、注文日・予約日の言葉の近くにある日付を優先する。
  // 「お届け予定 10月24日」のような、注文日ではない日付を拾わないため、年のない日付は言葉が近くにあるときだけ使う。
  const DATE_WORDS = /(ご?注文日時?|注文確定日|ご?予約日|予約受付日|お?申込日|お?申し込み日|ご?購入日|受付日時?|決済日)/;
  // お届け・発送・宿泊の日は、注文した日ではない（同じ行にあれば、その日付は使わない）
  const NOT_ORDER = /(お?届け|配送|発送|到着|予定|チェックイン|宿泊日|ご?利用日|ご?宿泊)/;
  const pad2 = (n) => String(n).padStart(2, '0');
  function findDates(text, year = new Date().getFullYear()) {
    const lines = normalizeText(text).split(/\n+/);
    const near = [], full = [];
    const ok = (y, m, d) => m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 2000 && y <= 2100;
    lines.forEach((line, i) => {
      const keyword = !NOT_ORDER.test(line) && (DATE_WORDS.test(line) || DATE_WORDS.test(lines[i - 1] || ''));
      if (NOT_ORDER.test(line)) return;
      const withYear = /(20\d{2})\s*[年\/.\-]\s*(\d{1,2})\s*[月\/.\-]\s*(\d{1,2})/g;
      let m;
      while ((m = withYear.exec(line))) {
        const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
        if (!ok(y, mo, d)) continue;
        const v = `${y}-${pad2(mo)}-${pad2(d)}`;
        (keyword ? near : full).push(v);
      }
      if (!keyword) return;
      const md = /(?:^|[^\d\/.\-])(\d{1,2})\s*月\s*(\d{1,2})\s*日/g;
      while ((m = md.exec(line))) {
        const [mo, d] = [Number(m[1]), Number(m[2])];
        if (ok(year, mo, d)) near.push(`${year}-${pad2(mo)}-${pad2(d)}`);
      }
    });
    return { near: [...new Set(near)], full: [...new Set(full)] };
  }

  // ---------- その駅に関係する注文か（厳格チェック①の後半） ----------
  // 駅の名産品・宿の名前と検索語・駅名から、2文字以上の言葉を取り出し、読み取った文字の中にあるかを見る
  const GENERIC = new Set(['旅館', 'ホテル', '冷凍', '高級', '老舗', '温泉', '宿', '駅弁', 'お土産', 'セット', '詰め合わせ', 'お取り寄せ', '通販', 'ギフト']);
  function stationWords(s) {
    const src = [s.name, ...s.products.flatMap((p) => [p.name, p.keyword]), s.stay.keyword, s.stay.name];
    return [...new Set(src.flatMap((t) => String(t).split(/[\s　・、（）()]+/)).filter((w) => [...w].length >= 2 && !GENERIC.has(w)))];
  }
  function matchItem(text, s) {
    const flat = normalizeText(text).replace(/\s+/g, '').toLowerCase();
    return stationWords(s).find((w) => flat.includes(w.toLowerCase())) || null;
  }

  // ---------- 査収スタンプ（Q-TRIP 旅の領収書・到着日と駅名・検証済みのしるし）----------
  function receiptStampSvg(date, stationName = '') {
    return `<svg viewBox="0 0 170 124" class="receipt-stamp-svg" aria-hidden="true">
      <rect x="4" y="4" width="162" height="116" rx="12" class="rs-ring"/>
      <rect x="10" y="10" width="150" height="104" rx="8" class="rs-ring rs-thin"/>
      <text x="85" y="38" text-anchor="middle" class="rs-big">【査収済】</text>
      <text x="85" y="58" text-anchor="middle" class="rs-mid">Q-TRIP 旅の領収書</text>
      <line x1="24" y1="67" x2="146" y2="67" class="rs-line"/>
      <text x="85" y="86" text-anchor="middle" class="rs-date">${stationName ? `${stationName}駅 ` : ''}${date}</text>
      <g transform="translate(85 102)"><circle r="9" class="rs-ring rs-thin"/><path d="M-4.5,0 L-1,3.6 L5,-3.6" class="rs-check"/></g>
      <text x="100" y="106" class="rs-verified">検証済</text>
    </svg>`;
  }

  YT.Receipts = { put, get, del, clear, thumbUrl, fingerprint, loadImage, thumbnail, recognize, parse, normalizeText, findDates, matchItem, stationWords, receiptStampSvg, TESS };
})();
