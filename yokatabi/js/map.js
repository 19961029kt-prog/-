// インラインSVGの九州すごろく盤：19世紀の航海図と、クラシカルな真鍮の路線図の調子で描く。
//   海（淡い浅葱にごく細い平行線・海岸線から沖へ広がる等深線・経緯線・コンパスローズ・船の線画）→
//   陸（海岸線の内側の細い二重線・山地のケバと等高線）→ 県境・県名 → 路線 → 駅（主要駅は二重リング＋真鍮の菱形、
//   一般駅は時刻表の駅記号）と駅名標 → SVG列車。盤面の縁には、経緯度の目盛りの帯（別の小さな SVG）を重ねる。
// 座標系は stations.json の meta.viewBox（800×960）。駅の x/y もこの座標系で、実際の緯度経度から作ってある。
(function () {
  'use strict';
  const YT = (window.YT = window.YT || {});
  const NS = 'http://www.w3.org/2000/svg';

  // 地図の形（海岸線・県境・山地・線路網・区間の線形）は、実在の地理データから tools/build-geo.mjs で作った js/geo.js を使う。
  const GEO = window.YOKATABI_GEO || null;

  // 緯度・経度 → 盤面の座標（tools/build-geo.mjs と同じ式）。
  // 北緯 30.15〜34.05°・東経 129.35〜132.05° が盤面に収まるよう、縦横同じ倍率で投影する（九州の形を歪めない）。
  function latLngToSvg(lat, lng) {
    const p = GEO.proj;
    return [p.cx + (lng - p.lng0) * p.cos * p.k, p.top + (p.bounds.north - lat) * p.k];
  }

  // 県名ラベル：線路や駅とぶつからない、それぞれの県の空いた場所（半島・内陸）に置く [県名, 緯度, 経度]
  const PREF_LABELS = [
    ['福岡県', 33.6, 130.82], ['佐賀県', 33.3, 129.96], ['長崎県', 32.87, 129.76], ['熊本県', 32.6, 130.82],
    ['大分県', 33.57, 131.6], ['宮崎県', 32.06, 131.17], ['鹿児島県', 31.43, 130.37],
  ];
  // 海の名前 [名前, 緯度, 経度, 小さい字か]
  const SEAS = [
    ['玄 界 灘', 33.92, 129.95], ['周 防 灘', 33.9, 131.55], ['日 向 灘', 32.0, 131.85], ['東 シ ナ 海', 31.9, 129.55],
    ['有明海', 33.02, 130.33, 1], ['大村湾', 32.97, 129.86, 1], ['八代海', 32.32, 130.38, 1], ['豊後水道', 33.08, 132.05, 1],
    ['錦江湾', 31.4, 130.69, 1], ['大隅海峡', 30.85, 130.85, 1], ['太 平 洋', 30.75, 131.75],
  ];
  // 山の名前と小さな山のしるし [名前, 緯度, 経度]
  const PEAKS = [
    ['阿蘇山', 32.88, 131.1], ['くじゅう連山', 33.1, 131.25], ['雲仙岳', 32.76, 130.29], ['霧島山', 31.93, 130.87],
    ['祖母山', 32.83, 131.35], ['英彦山', 33.48, 130.93], ['開聞岳', 31.18, 130.53], ['宮之浦岳', 30.34, 130.5],
    ['桜島', 31.58, 130.66, 1], ['市房山', 32.31, 131.1],
  ]; // 4つ目が 1 の山は、しるしだけ（同じ名前の駅の駅名標とぶつからないように）
  // 経由駅の名前を出さないもの（すごろくの駅のすぐそばで、名前が重なる）
  const WAYPOINT_QUIET = new Set(['早岐', '大分', '隼人']);

  // 等深線：海岸線から沖へ向かって、この距離（盤面の単位 ≒ 0.45km）ごとに細い線を引く。沖ほど間が広い（航海図の水線）
  const SOUNDINGS = [2.6, 5.8, 10.5, 17];
  // 海岸線の内側の二重線（陸の側へこの距離だけ入ったところ）
  const INLINES = [1.5, 3.2];

  function el(name, attrs = {}, parent) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  const f1 = (v) => (Math.round(v * 10) / 10).toString();

  // 線画アイコン（js/icons.js の 24×24 のパス）を、SVG の中に size 単位の大きさで描く。中心が (0, 0)。
  // 線の太さは盤面の単位で sw（縮めても細くなりすぎないよう、アイコンの方眼に換算して入れる）
  function iconG(name, size, cls, parent, sw = 1.1) {
    const k = size / 24;
    const g = el('g', { class: cls, transform: `translate(${f1(-size / 2)} ${f1(-size / 2)}) scale(${k.toFixed(4)})`, 'stroke-width': (sw / k).toFixed(2) }, parent);
    const P = YT.Icon ? YT.Icon.paths(name) : [];
    P.forEach((d) => (d[0] === '.' ? el('path', { d: d.slice(1), class: 'f' }, g) : el('path', { d }, g)));
    return g;
  }

  let D, svg, layers, handlers, camera;
  const nodes = {}; // id -> <g>
  // 拡大しても大きくなりすぎないよう、倍率の逆数で縮める要素（駅・駅名・県名・海や山の名前・経由駅・区間のしるし・コンパス・船）
  const scalables = []; // [{ el, x, y }]
  const scalable = (el, x, y) => (scalables.push({ el, x, y }), el);
  let curScale = 1;
  let candidates = null;

  // a→b 方向の区間パス。geo.js の線形は「キーの前の駅 → 後ろの駅」の向きなので、逆向きのときは点列を反転する。
  const reversed = {};
  function segmentD(a, b) {
    const key = YT.Data.edgeKey(a, b);
    const d = GEO && GEO.routes[key];
    if (d) {
      if (key.startsWith(`${a}|`)) return d;
      return (reversed[key] = reversed[key] || 'M' + d.slice(1).split('L').reverse().join('L'));
    }
    const A = D.byId[a], B = D.byId[b];
    return `M${A.x},${A.y} L${B.x},${B.y}`;
  }

  // 使い回す模様と形。駅が100を超えても重くならないよう、フィルタは使わず、模様（pattern）と <use> だけで描く
  function buildDefs() {
    const defs = el('defs', {}, svg);
    defs.innerHTML = `
      <pattern id="p-sea-hatch" width="16" height="3.2" patternUnits="userSpaceOnUse">
        <path d="M0 1.6H16" stroke="#6f9796" stroke-width=".32"/>
      </pattern>
      <linearGradient id="g-goldleaf" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="54" y2="34" spreadMethod="reflect">
        <stop offset="0" stop-color="#c59b27"/><stop offset=".38" stop-color="#e6c665"/><stop offset=".55" stop-color="#faf0ca"/><stop offset=".75" stop-color="#d4af37"/><stop offset="1" stop-color="#c59b27"/>
      </linearGradient>
      <linearGradient id="g-cone" x1="21" y1="0" x2="70" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="rgb(255,232,163)" stop-opacity=".45"/><stop offset="1" stop-color="rgb(255,232,163)" stop-opacity="0"/></linearGradient>
      <radialGradient id="g-fog"><stop offset="0" stop-color="#f4efe6" stop-opacity=".92"/><stop offset=".55" stop-color="#f4efe6" stop-opacity=".55"/><stop offset="1" stop-color="#f4efe6" stop-opacity="0"/></radialGradient>
      <radialGradient id="g-unveil"><stop offset="0" stop-color="#e6c665" stop-opacity=".5"/><stop offset=".6" stop-color="#d4af37" stop-opacity=".16"/><stop offset="1" stop-color="#d4af37" stop-opacity="0"/></radialGradient>`;
    if (GEO) {
      // 海岸線は 140KB ほどの長いパスなので、1つだけ置いて <use> で使い回す（陸・切り抜き・海岸線）
      el('path', { id: 'geo-coast', d: GEO.land.join('') }, defs);
      const clip = el('clipPath', { id: 'c-land' }, defs);
      el('use', { href: '#geo-coast' }, clip);
      (GEO.mountains || []).forEach((m, i) => el('path', { id: `geo-mt-${i}`, d: m.d, 'fill-rule': 'evenodd' }, defs));
    }
  }

  // 盤面：海（ベタ）→ 等深線 → 細い平行線 → 経緯線 → 船・コンパス → 対岸 → 陸地 → 内側の二重線・県のうす色・山地（ケバ・等高線）→
  //       海岸線・県境 → 実在の線路網 → 山の名前・海の名前（経由駅と県名は、線路の上の別の層）
  function buildBoard() {
    const [vx, vy, vw, vh] = D.meta.viewBox;
    const sea = { x: vx - vw, y: vy - vh, width: vw * 3, height: vh * 3 };
    el('rect', { ...sea, class: 'sea' }, layers.bg);
    el('rect', { ...sea, fill: 'url(#p-sea-hatch)', class: 'sea-hatch' }, layers.bg);
    if (!GEO) return;
    // 等深線（手が空いたときに距離の場から作って、ここに入れる。buildShoreLines）
    shoreG.out = el('g', { class: 'soundings', 'aria-hidden': 'true' }, layers.bg);
    buildGraticule();
    buildShips();
    buildCompass();

    GEO.neighbor.forEach((d) => el('path', { d, class: 'land-neighbor' }, layers.bg));
    el('use', { href: '#geo-coast', class: 'land' }, layers.bg);

    // 海岸線の内側の細い二重線（等深線と同じく、あとから入れる）
    shoreG.in = el('g', { class: 'inlines', 'aria-hidden': 'true' }, layers.bg);
    const inner = el('g', { 'clip-path': 'url(#c-land)' }, layers.bg);
    (GEO.tint || []).forEach((l) => {
      const color = (D.meta.prefectures[l.pref] || {}).color;
      if (color) el('path', { d: l.d, class: 'land-tint', style: `--pref:${color}` }, inner);
    });
    // 山地：ベタの緑ではなく、ごく淡い墨のぼかしに、等高線と、その線に直交する短い刻み（ケバ）を重ねる
    (GEO.mountains || []).forEach((m, i) => {
      el('use', { href: `#geo-mt-${i}`, class: `mount mount-${i}` }, inner);
      el('use', { href: `#geo-mt-${i}`, class: `keba keba-${i}` }, inner);
    });
    el('use', { href: '#geo-coast', class: 'coast' }, layers.bg);
    GEO.borders.forEach((d) => el('path', { d, class: 'pref-border' }, layers.bg));

    const net = el('g', { class: 'rail-network', 'aria-hidden': 'true' }, layers.bg);
    el('path', { d: GEO.network.filter((n) => !n.shin).map((n) => n.d).join(' '), class: 'net-line' }, net);
    el('path', { d: GEO.network.filter((n) => n.shin).map((n) => n.d).join(' '), class: 'net-line net-shin' }, net);

    PEAKS.forEach(([name, lat, lng, quiet]) => {
      const [x, y] = latLngToSvg(lat, lng);
      const g = scalable(el('g', { class: 'peak', transform: `translate(${f1(x)} ${f1(y)})` }, layers.bg), x, y);
      // 山のしるし：銅版画のような、片側に陰の線を入れた小さな三角
      el('path', { d: 'M-6.5,3 L0,-5.5 L6.5,3', class: 'peak-mark' }, g);
      el('path', { d: 'M0.8,-3.6 L1.2,2.6 M2.6,-1.7 L3,2.6 M4.3,0.4 L4.6,2.6', class: 'peak-shade' }, g);
      if (!quiet) el('text', { y: 13, 'text-anchor': 'middle', class: 'peak-label' }, g).textContent = name;
    });
    // 桜島の噴煙：細い線の渦が、ゆっくり立ちのぼる
    const [sx, sy] = latLngToSvg(31.585, 130.66);
    const smoke = scalable(el('g', { class: 'smoke', transform: `translate(${f1(sx)} ${f1(sy - 6)})` }, layers.bg), sx, sy - 6);
    [0, 1, 2].forEach((i) => el('path', { d: `M0,0 c-${2 + i},-2 ${1 + i},-4 0,-${6 + i * 2}`, style: `--i:${i}` }, smoke));

    SEAS.forEach(([name, lat, lng, small]) => {
      const [x, y] = latLngToSvg(lat, lng);
      const g = scalable(el('g', { transform: `translate(${f1(x)} ${f1(y)})`, class: small ? 'sea-name sea-name-sm' : 'sea-name' }, layers.bg), x, y);
      el('text', { 'text-anchor': 'middle', class: small ? 'sea-label sea-label-sm' : 'sea-label' }, g).textContent = name;
    });
  }

  // ---------- 等深線と、海岸線の内側の二重線 ----------
  // 海岸線を太い線で描いて描き戻すやり方は、1万点を超える海岸線を何度も太くなぞるので、カメラを止めるたびの描き直しが重い。
  // そこで、ページを開いて手が空いたときに1回だけ、陸と海の「海岸線からの距離の場」を作り、その等値線（細い線のパス）を引く。
  // 描くのは細い線だけになるので、駅が増えても・寄っても軽い。geo.js を作り直しても、そのまま新しい海岸線に合う
  const shoreG = { out: null, in: null };
  const INF = 1e20;
  // 1次元の距離変換（Felzenszwalb & Huttenlocher）：f の各点から、いちばん近い「0 の点」までの距離の2乗
  function edt1d(f, n, d, v, z) {
    let k = 0;
    v[0] = 0;
    z[0] = -INF;
    z[1] = INF;
    for (let q = 1; q < n; q++) {
      let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) {
        k--;
        s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      }
      k++;
      v[k] = q;
      z[k] = s;
      z[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < n; q++) {
      while (z[k + 1] < q) k++;
      const dq = q - v[k];
      d[q] = dq * dq + f[v[k]];
    }
  }
  // 範囲 box（盤面の単位）を res の格子にして、paths の内側（inside=true）または外側から、海岸線までの距離の2乗の場を作る
  function distanceField(box, res, paths, inside) {
    const W = Math.ceil(box.w / res), H = Math.ceil(box.h / res);
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.setTransform(1 / res, 0, 0, 1 / res, -box.x / res, -box.y / res);
    paths.forEach((d) => ctx.fill(new Path2D(d)));
    const px = ctx.getImageData(0, 0, W, H).data;
    const g = new Float64Array(W * H);
    for (let i = 0; i < W * H; i++) g[i] = (px[i * 4 + 3] >= 128) === inside ? INF : 0;
    const n = Math.max(W, H);
    const f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
    for (let x = 0; x < W; x++) {
      for (let y = 0; y < H; y++) f[y] = g[y * W + x];
      edt1d(f, H, d, v, z);
      for (let y = 0; y < H; y++) g[y * W + x] = d[y];
    }
    for (let y = 0; y < H; y++) {
      const o = y * W;
      for (let x = 0; x < W; x++) f[x] = g[o + x];
      edt1d(f, W, d, v, z);
      for (let x = 0; x < W; x++) g[o + x] = d[x];
    }
    return { g, W, H };
  }
  // 距離 L（格子の単位）の等値線を、マーチング・スクエアで線分にして、つないで折れ線にする
  function isoLines({ g, W, H }, L) {
    const L2 = L * L;
    const idx = new globalThis.Map(); // 辺の番号 → 点の通し番号（この中の Map は YT.Map と名前がぶつかるので globalThis から）
    const X = [], Y = [], A = [], B = []; // 点の座標と、つながる2つの点（-1 = まだ無い）
    // 辺（格子点 i0 → i1、向き dx, dy）の上で、距離がちょうど L になる点
    const pt = (id, i0, i1, x0, y0, dx, dy) => {
      let k = idx.get(id);
      if (k !== undefined) return k;
      const a = Math.sqrt(g[i0]), b = Math.sqrt(g[i1]);
      const t = Math.max(0, Math.min(1, (L - a) / (b - a || 1)));
      k = X.length;
      idx.set(id, k);
      X.push(x0 + dx * t);
      Y.push(y0 + dy * t);
      A.push(-1);
      B.push(-1);
      return k;
    };
    const join = (p, q) => {
      if (A[p] < 0) A[p] = q;
      else B[p] = q;
      if (A[q] < 0) A[q] = p;
      else B[q] = p;
    };
    for (let y = 0; y < H - 1; y++) {
      for (let x = 0; x < W - 1; x++) {
        const i = y * W + x;
        const c = (g[i] >= L2 ? 8 : 0) | (g[i + 1] >= L2 ? 4 : 0) | (g[i + W + 1] >= L2 ? 2 : 0) | (g[i + W] >= L2 ? 1 : 0);
        if (c === 0 || c === 15) continue;
        // 辺の番号：上 = 2i、左 = 2i+1、下 = 2(i+W)、右 = 2(i+1)+1
        const T = c === 1 || c === 14 || c === 2 || c === 13 || c === 3 || c === 12 ? -1 : pt(2 * i, i, i + 1, x, y, 1, 0);
        const Bm = c === 4 || c === 11 || c === 7 || c === 8 || c === 3 || c === 12 ? -1 : pt(2 * (i + W), i + W, i + W + 1, x, y + 1, 1, 0);
        const Lf = c === 2 || c === 13 || c === 4 || c === 11 || c === 6 || c === 9 ? -1 : pt(2 * i + 1, i, i + W, x, y, 0, 1);
        const R = c === 1 || c === 14 || c === 6 || c === 9 || c === 7 || c === 8 ? -1 : pt(2 * (i + 1) + 1, i + 1, i + W + 1, x + 1, y, 0, 1);
        switch (c) {
          case 1: case 14: join(Lf, Bm); break;
          case 2: case 13: join(Bm, R); break;
          case 3: case 12: join(Lf, R); break;
          case 4: case 11: join(T, R); break;
          case 6: case 9: join(T, Bm); break;
          case 7: case 8: join(Lf, T); break;
          case 5: join(Lf, T); join(Bm, R); break;
          case 10: join(Lf, Bm); join(T, R); break;
        }
      }
    }
    // つなぐ：端（つながりが1つ）から先にたどり、残りは閉じた輪
    const n = X.length, seen = new Uint8Array(n), lines = [];
    const walk = (s) => {
      const line = [[X[s], Y[s]]];
      seen[s] = 1;
      let cur = s;
      for (;;) {
        const a = A[cur], b = B[cur];
        const nx = a >= 0 && !seen[a] ? a : b >= 0 && !seen[b] ? b : -1;
        if (nx < 0) break;
        seen[nx] = 1;
        line.push([X[nx], Y[nx]]);
        cur = nx;
      }
      line.closed = line.length > 2 && (A[cur] === s || B[cur] === s);
      lines.push(line);
    };
    for (let k = 0; k < n; k++) if (!seen[k] && B[k] < 0) walk(k);
    for (let k = 0; k < n; k++) if (!seen[k]) walk(k);
    return lines;
  }
  // 折れ線を間引く（Douglas–Peucker）
  function simplify(line, tol) {
    if (line.length < 4) return line;
    const keep = new Uint8Array(line.length);
    keep[0] = keep[line.length - 1] = 1;
    const stack = [[0, line.length - 1]];
    while (stack.length) {
      const [a, b] = stack.pop();
      const [ax, ay] = line[a], [bx, by] = line[b];
      const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
      let far = -1, fd = tol;
      for (let i = a + 1; i < b; i++) {
        const dd = Math.abs((line[i][0] - ax) * dy - (line[i][1] - ay) * dx) / len;
        if (dd > fd) (fd = dd), (far = i);
      }
      if (far > 0) {
        keep[far] = 1;
        stack.push([a, far], [far, b]);
      }
    }
    return line.filter((_, i) => keep[i]);
  }
  // 等値線 → パスの d（格子の座標を盤面の座標へ戻す）
  function linesToD(lines, box, res, tol, minSpan) {
    let d = '';
    lines.forEach((line) => {
      if (line.length < 3) return;
      const xs = line.map((p) => p[0]), ys = line.map((p) => p[1]);
      if (Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) * res < minSpan) return;
      const s = simplify(line, tol / res);
      d += 'M' + s.map(([x, y]) => `${f1(box.x + (x + 0.5) * res)},${f1(box.y + (y + 0.5) * res)}`).join('L') + (line.closed ? 'Z' : '');
    });
    return d;
  }
  // 陸の範囲（盤面の単位）：海岸線の点の最小・最大
  function landBox(pad) {
    const nums = GEO.land.join('').match(/-?\d+(\.\d+)?/g).map(Number);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i + 1 < nums.length; i += 2) {
      x0 = Math.min(x0, nums[i]); x1 = Math.max(x1, nums[i]);
      y0 = Math.min(y0, nums[i + 1]); y1 = Math.max(y1, nums[i + 1]);
    }
    return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + pad * 2, h: y1 - y0 + pad * 2 };
  }
  // 手が空いたときに、等深線（沖）→ 内側の二重線（陸）の順に作って入れる
  function buildShoreLines() {
    if (!GEO || !shoreG.out || typeof document.createElement('canvas').getContext !== 'function') return;
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 60));
    const [vx, vy, vw, vh] = D.meta.viewBox;
    idle(() => {
      try {
        // 沖：寄ったときに見える海の外側（盤面の外へ約150単位）まで。格子は 1.5 単位
        const box = { x: vx - 160, y: vy - 160, w: vw + 320, h: vh + 320 }, res = 1.5;
        const field = distanceField(box, res, [...GEO.land, ...GEO.neighbor], false);
        SOUNDINGS.forEach((dd, i) => {
          const d = linesToD(isoLines(field, dd / res + 0.5), box, res, 0.35, 0);
          if (d) el('path', { d, class: `sounding sd-${i}` }, shoreG.out);
        });
      } catch (e) { /* 等深線は飾りなので、作れなくても盤面はそのまま使える */ }
      idle(() => {
        try {
          // 陸：海岸線の細かな出入りに沿うよう、格子は 0.6 単位
          const box = landBox(4), res = 0.6;
          const field = distanceField(box, res, GEO.land, true);
          INLINES.forEach((dd, i) => {
            const d = linesToD(isoLines(field, dd / res + 0.5), box, res, 0.18, 2.5);
            if (d) el('path', { d, class: `inline in-${i}` }, shoreG.in);
          });
        } catch (e) { /* 同上 */ }
      }, { timeout: 2000 });
    }, { timeout: 1500 });
  }

  // 細い経緯線（0.5度ごと。1度ごとは少し濃く）。度数の字は盤面の縁の目盛りの帯（buildFrame）に出す
  function buildGraticule() {
    const g = el('g', { class: 'graticule', 'aria-hidden': 'true' }, layers.bg);
    const [vx, vy, vw, vh] = D.meta.viewBox;
    for (let lat = 29.5; lat <= 34.5; lat += 0.5) {
      const [, y] = latLngToSvg(lat, 130);
      if (y < vy - vh || y > vy + vh * 2) continue;
      el('line', { x1: vx - vw, x2: vx + vw * 2, y1: f1(y), y2: f1(y), class: lat % 1 ? 'grat' : 'grat grat-major' }, g);
    }
    for (let lng = 128; lng <= 133.5; lng += 0.5) {
      const [x] = latLngToSvg(32, lng);
      el('line', { x1: f1(x), x2: f1(x), y1: vy - vh, y2: vy + vh * 2, class: lng % 1 ? 'grat' : 'grat grat-major' }, g);
    }
  }

  // コンパスローズ：二重の輪に5度ごとの目盛りと32方位の刻み、16方位の星（菱形の針は片側に墨を入れる）、N の飾り字
  function buildCompass() {
    const [cx, cy] = latLngToSvg(30.66, 129.7);
    const c = scalable(el('g', { class: 'compass', 'aria-hidden': 'true', transform: `translate(${f1(cx)} ${f1(cy)})` }, layers.bg), cx, cy);
    const R = 40;
    let deg = '';
    for (let i = 0; i < 72; i++) deg += `<line y1="${-R + 2.6}" y2="${-R}" transform="rotate(${i * 5})"/>`;
    let pts = '';
    for (let i = 0; i < 32; i++) {
      const y1 = i % 8 === 0 ? -29 : i % 4 === 0 ? -31 : i % 2 === 0 ? -32.6 : -34;
      pts += `<line y1="${y1}" y2="-${R - 3.4}" transform="rotate(${i * 11.25})" class="${i % 4 === 0 ? 'cp-tick-main' : ''}"/>`;
    }
    // 針：中心から先端へ、左右の半分を墨と生成りで塗り分けた細い菱形
    const point = (ang, L, w, north) =>
      `<g transform="rotate(${ang})"><path d="M0,0 L${-w},${-w * 1.1} L0,${-L} Z" class="${north ? 'cp-n-dark' : 'cp-dark'}"/><path d="M0,0 L${w},${-w * 1.1} L0,${-L} Z" class="${north ? 'cp-n-light' : 'cp-light'}"/></g>`;
    let star = '';
    for (let i = 0; i < 8; i++) star += point(22.5 + i * 45, 17, 2.1);
    for (let i = 0; i < 4; i++) star += point(45 + i * 90, 24, 3.4);
    for (let i = 0; i < 4; i++) star += point(i * 90, 33, 4.6, i === 0);
    c.innerHTML = `
      <circle r="${R}" class="cp-ring"/><circle r="${R - 2.6}" class="cp-ring cp-ring-thin"/><circle r="${R - 3.4}" class="cp-ring cp-ring-thin"/>
      <g class="cp-ticks cp-deg">${deg}</g><g class="cp-ticks">${pts}</g>
      <circle r="13" class="cp-ring cp-ring-dot"/>
      ${star}
      <circle r="2.2" class="cp-pin"/><circle r=".7" class="cp-pin-dot"/>
      <path d="M-14,-49.5 q5,-3.4 8.6,-.4 M14,-49.5 q-5,-3.4 -8.6,-.4" class="cp-flourish"/>
      <path d="M0,-${R + 1.5} l1.6,2.2 -1.6,2.2 -1.6,-2.2 z" class="cp-n-dark"/>
      <text y="-${R + 6}" text-anchor="middle" class="cp-n">N</text>`;
  }

  // 船の線画（海の飾り）：帆船と、小さな蒸気船。銅版画のような細い線で、水面の短い線を添える
  function buildShips() {
    const ship = (lat, lng, kind, flip) => {
      const [x, y] = latLngToSvg(lat, lng);
      const g = scalable(el('g', { class: 'ship-pos', transform: `translate(${f1(x)} ${f1(y)})` }, layers.bg), x, y);
      const s = el('g', { class: 'ship', transform: flip ? 'scale(-1 1)' : '' }, g);
      s.innerHTML =
        kind === 'sail'
          ? `<path d="M-24,5 Q0,9 22,5 L17,12 Q0,14.5 -18,12 Z"/><path d="M-20,8.6 H18" class="ship-thin"/>
             <path d="M-8,5 V-30 M6,5 V-24 M-8,-30 l0,-3"/>
             <path d="M-17,-24 Q-8,-21 1,-24 Q2,-15 1,-7 Q-8,-9 -17,-7 Q-15,-15 -17,-24 Z" class="ship-sail"/>
             <path d="M-1,-19 Q6,-16.5 13,-19 Q14,-12 13,-5 Q6,-7 -1,-5 Q.5,-12 -1,-19 Z" class="ship-sail"/>
             <path d="M6,-24 L24,3 M-8,-30 L-26,3" class="ship-thin"/><path d="M-8,-33 l5,1.6 -5,1.6" class="ship-thin"/>
             <path d="M-32,17 q4,-2 8,0 t8,0 M4,17 q4,-2 8,0 t8,0 M-14,21 q4,-2 8,0 t8,0" class="ship-thin"/>`
          : `<path d="M-26,3 L24,3 L19,11 Q0,13 -21,11 Z"/><path d="M-22,7 H21" class="ship-thin"/>
             <path d="M-15,3 V-4 H12 V3 M-9,-4 V-9 H5 V-4"/><path d="M-3,-9 V-17 H2 V-9" class="ship-funnel"/>
             <path d="M-11,-.5 h2 M-5,-.5 h2 M1,-.5 h2 M7,-.5 h2" class="ship-thin"/>
             <path d="M0,-19 q-4,-3 1,-6 q5,-3 1,-6" class="ship-thin ship-smoke"/>
             <path d="M-34,16 q4,-2 8,0 t8,0 M8,16 q4,-2 8,0 t8,0" class="ship-thin"/>`;
    };
    ship(31.27, 129.6, 'sail');
    ship(32.9, 131.98, 'liner', true);
    ship(31.3, 131.86, 'liner');
  }

  // 路線種別ごとの線のつくり（下から順に重ねる）。色は墨・真鍮・茜・深緑・浅葱の落ち着いた組み合わせ
  const ROUTE_STYLES = {
    // 新幹線：墨の太い二重線の中に、真鍮の細い帯がゆっくり流れる
    shinkansen: ['shin-case', 'shin-gap', 'shin-flow'],
    // 特急幹線：昔の地図の鉄道記号（墨と生成りが交互に並ぶ、はしご状の線）
    trunk: ['trunk-case', 'trunk-gap', 'trunk-chk'],
    // ローカル線：深緑の細い線に、細かい枕木の刻み
    local: ['local-ties', 'local-rail'],
    // 観光列車：茜の線路に、真鍮の細い点線
    scenic: ['scenic-ties', 'scenic-rail', 'scenic-gold'],
    // 航路：浅葱の破線が海の上をゆっくり流れる
    ferry: ['ferry-wake', 'ferry-line'],
    // バス：茜の小さな丸の点線
    bus: ['bus-outline', 'bus-dots'],
  };
  // 区間のしるし（線画アイコンの名前）
  const ROUTE_BADGE = { scenic: 'sparkle', ferry: 'ferry', bus: 'bus' };

  function routeType(e) {
    const t = e.type === 'rail' || !e.type ? 'local' : e.type;
    return ROUTE_STYLES[t] ? t : 'local';
  }

  function buildRoutes() {
    const order = ['ferry', 'bus', 'local', 'scenic', 'trunk', 'shinkansen'];
    const types = D.routeTypes || {};
    [...D.edges]
      .sort((x, y) => order.indexOf(routeType(x)) - order.indexOf(routeType(y)))
      .forEach((e) => {
        const d = segmentD(e.a, e.b);
        const type = routeType(e);
        const g = el('g', { class: `route route-${type}`, 'data-edge': e.key }, layers.routes);
        el('title', {}, g).textContent = `${(types[type] || {}).label || ''}｜${e.name || ''}（${D.byId[e.a].name}〜${D.byId[e.b].name}）`;
        ROUTE_STYLES[type].forEach((cls) => el('path', { d, class: cls }, g));
        if (!ROUTE_BADGE[type]) return;
        const p = el('path', { d }, layers.routes);
        const len = p.getTotalLength();
        const m = p.getPointAtLength(len / 2);
        p.remove();
        if (len < 70) return; // 短い区間はしるしを置くと駅名とぶつかるので省く
        // 小さな真鍮の輪の札に、線画のしるし（船・バス・きらめき）
        const b = scalable(el('g', { class: `route-badge badge-${type}`, transform: `translate(${f1(m.x)} ${f1(m.y)})` }, layers.badges), m.x, m.y);
        el('circle', { r: 8.6, class: 'rb-disc' }, b);
        el('circle', { r: 7, class: 'rb-ring' }, b);
        iconG(ROUTE_BADGE[type], 10.5, 'rb-ico', b, 0.95);
      });
    // 経由駅：路線がどこを通っているかの目印（すごろくのマスではない）
    (GEO ? GEO.waypoints : []).forEach((w) => {
      const g = scalable(el('g', { class: 'waypoint', transform: `translate(${w.x} ${w.y})` }, layers.badges), w.x, w.y);
      el('circle', { r: 2.8 }, g);
      if (!WAYPOINT_QUIET.has(w.name)) el('text', { x: 6, y: 3.5, class: 'waypoint-label' }, g).textContent = w.name;
    });
    // 県名：線路の上・駅の下に置き、白フチの明朝で地図帳のように読ませる
    if (!GEO) return;
    PREF_LABELS.forEach(([name, lat, lng]) => {
      const [x, y] = latLngToSvg(lat, lng);
      const g = scalable(el('g', { transform: `translate(${f1(x)} ${f1(y)})` }, layers.labels), x, y);
      el('text', { 'text-anchor': 'middle', class: 'pref-label' }, g).textContent = name;
    });
  }

  // ---------- 駅のしるしと駅名標 ----------
  // しるしの半径（主要駅・観光駅・一般駅）
  const TOKEN_R = { hub: 10.5, tourist: 7.6, local: 6 };
  // 駅名標の字の大きさと余白（盤面の単位。スマホでは LABEL_K 倍）
  const LABEL = { hub: { fs: 14, px: 5.5, py: 3.4, gap: 4.2 }, tourist: { fs: 12.4, px: 4.6, py: 2.8, gap: 5 }, local: { fs: 11.8, px: 4.4, py: 2.7, gap: 4.4 } };
  const narrowView = () => window.matchMedia('(max-width: 639px)').matches;
  let labelK = 1;

  // 駅名標：小さな枠付きのプレート（主要駅は二重枠）。字の幅は「字数×字の大きさ」で見積もる（Web フォントの読み込みを待たずに置けるように）
  function buildLabel(s, g) {
    g.querySelectorAll('.station-label, .station-preview').forEach((n) => n.remove());
    const tier = TOKEN_R[s.stationTier] ? s.stationTier : 'local';
    const L = LABEL[tier], K = labelK;
    const fs = L.fs * K, n = [...s.name].length;
    const w = n * fs * 1.06 + L.px * 2 * K, h = fs + L.py * 2 * K;
    const gap = TOKEN_R[tier] + L.gap;
    const dir = LABEL_DIRS.includes(s.labelDir) ? s.labelDir : 'right';
    let place = dir;
    const cx = dir === 'left' ? -(gap + w / 2) : dir === 'right' ? gap + w / 2 : 0;
    let cy = dir === 'top' ? -(gap + h / 2) : dir === 'bottom' ? gap + h / 2 : 0;
    // 盤面の上のふち（経緯度の欄外）にかかる駅（門司港など）は、駅名標を少し下げる（上向きなら下へ回す）
    const minTop = labelK > 1 ? 24 : 18;
    if (s.y + cy - h / 2 < minTop) {
      if (dir === 'top') (place = 'bottom'), (cy = gap + h / 2);
      else cy = minTop - s.y + h / 2;
    }
    const lab = el('g', { class: 'station-label', transform: `translate(${f1(cx)} ${f1(cy)})` }, g);
    el('rect', { x: f1(-w / 2), y: f1(-h / 2), width: f1(w), height: f1(h), class: 'st-plate' }, lab);
    if (tier === 'hub') el('rect', { x: f1(-w / 2 + 1.8 * K), y: f1(-h / 2 + 1.8 * K), width: f1(w - 3.6 * K), height: f1(h - 3.6 * K), class: 'st-plate-in' }, lab);
    el('text', { y: f1(fs * 0.36), 'text-anchor': 'middle', 'font-size': f1(fs), class: `st-name st-name-${tier}` }, lab).textContent = s.name;
    // ローカル寄り道モード（2.5倍〜）で、いまいる駅にだけ出す手帖のひとこと（駅名標の外側に添える）
    const pfs = 8.5 * K;
    const py = place === 'top' ? cy - h / 2 - 4 * K : cy + h / 2 + pfs + 3 * K;
    const px = dir === 'left' ? cx + w / 2 : dir === 'right' ? cx - w / 2 : 0;
    const anchor = dir === 'left' ? 'end' : dir === 'right' ? 'start' : 'middle';
    el('text', { x: f1(px), y: f1(py), 'text-anchor': anchor, 'font-size': f1(pfs), class: 'station-preview' }, g).textContent = s.tagline || '';
  }
  const LABEL_DIRS = ['top', 'bottom', 'left', 'right'];

  function buildNodes() {
    labelK = narrowView() ? 1.4 : 1;
    D.stations.forEach((s) => {
      const color = (D.meta.prefectures[s.prefecture] || {}).color || '#888';
      const tier = TOKEN_R[s.stationTier] ? s.stationTier : 'local';
      const R = TOKEN_R[tier];
      const g = el('g', {
        class: 'station',
        transform: `translate(${s.x} ${s.y})`,
        tabindex: '0',
        role: 'button',
        'data-id': s.id,
        'data-tier': s.stationTier || 'local',
        'aria-label': `${s.name}駅（${s.prefecture}）`,
        style: `--pref:${color}`,
      }, layers.nodes);
      scalable(g, s.x, s.y);
      el('circle', { r: 24, class: 'station-hit' }, g);
      // 霧の解放：まだ訪れていない駅は生成りの霧に沈み、訪れると霧が晴れて真鍮の淡い光がにじむ
      el('circle', { r: R + 13, class: 'st-unveil' }, g);
      el('ellipse', { rx: R + 15, ry: R + 9, cy: 1, class: 'st-fog' }, g);
      // 今いる駅・行き先の候補の波紋：細い輪がしっとり広がる
      [0, 1, 2].forEach((i) => el('circle', { r: R + 1.5, class: 'station-wave', style: `--i:${i}` }, g));
      el('circle', { r: R + 5, class: 'station-candidate' }, g);
      const token = el('g', { class: 'station-token' }, g);
      el('circle', { cy: 1.1, r: R + 0.6, class: 'st-shadow' }, token);
      if (tier === 'hub') {
        // 主要駅：二重リングの間に県の色の細い輪、中に真鍮の菱形（訪れると菱形が真鍮で満ちる）
        el('circle', { r: R, class: 'st-ring' }, token);
        el('circle', { r: R - 2.2, class: 'st-pref' }, token);
        el('circle', { r: R - 3.9, class: 'st-ring2' }, token);
        el('path', { d: 'M0,-4.6 L4.6,0 L0,4.6 L-4.6,0 Z', class: 'st-diamond' }, token);
        el('circle', { r: 0.9, class: 'st-diamond-pin' }, token);
      } else {
        // 一般駅：昔の時刻表の駅記号（白丸に墨の輪）。観光駅は上下に小さな縦棒を添える。訪れると中に県の色の点
        if (tier === 'tourist') el('path', { d: `M0,${-R - 3.4} V${-R} M0,${R} V${R + 3.4}`, class: 'st-bar' }, token);
        el('circle', { r: R, class: `st-ring st-ring-${tier}` }, token);
        el('circle', { r: R - 2.4, class: 'st-pref' }, token);
        el('circle', { r: R - 3.6, class: 'st-core' }, token);
      }
      // トップオーナーの駅：金箔の淡い円盤に、真鍮の線画の王冠
      const SR = Math.max(9.5, R + 2);
      const seal = el('g', { class: 'station-seal' }, g);
      el('circle', { r: SR, class: 'st-seal-disc' }, seal);
      el('circle', { r: SR - 2, class: 'st-seal-ring' }, seal);
      iconG('crown', SR * 1.18, 'st-seal-crown', seal, 1);
      // 共同株主（2〜3位）：駅のしるしの右上に、小さな「株」の札
      const share = el('g', { class: 'station-share', transform: `translate(${f1(R * 0.8 + 3)} ${f1(-R * 0.8 - 3)})` }, g);
      el('rect', { x: -5, y: -5.6, width: 10, height: 11.2, class: 'st-share-tag' }, share);
      el('rect', { x: -3.7, y: -4.3, width: 7.4, height: 8.6, class: 'st-share-in' }, share);
      el('text', { y: 2.5, 'text-anchor': 'middle', class: 'st-share-char' }, share).textContent = '株';
      buildLabel(s, g);

      const activate = () => handlers.onStationClick(s.id);
      g.addEventListener('click', activate);
      g.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          activate();
        }
      });
      nodes[s.id] = g;
    });
  }

  // ---------- 列車（2両編成の SVG トークン）----------
  // 大きさは画面の px で決める（先頭の動力車 44×20px・2両目の展望客車 40×20px）。毎フレーム「盤面1単位が何 px か」を
  // 測って（unitsPerPx）、絵を scale(upp) で縮めて置くので、ズームしても画面の上の大きさは変わらない。
  // 色はクラシカルな深緑（#1E3A2F）に真鍮の飾り帯（#C5A059）、屋根のベンチレーター、暖色（#FFE8A3）に光る4つの窓、
  // 先頭の前へ広がる前照灯の扇形の光（rgba(255,232,163,.45)）
  const PX = { car1: 44, car2: 40, gap: 38, stop: 26 }; // gap：2両目は道のりで 38px うしろ（s − 38px）
  const pose = { segs: null, d: 0, running: false, dive: null };
  let car1, car2, coupler, carG1, carG2, fx, counter = null;
  const upp = () => {
    const m = svg.getScreenCTM();
    return m && m.a ? 1 / Math.hypot(m.a, m.b) : 1;
  };
  function carSvg(kind) {
    const W = kind === 'car1' ? 44 : 40, h = W / 2;
    const win = kind === 'car1' ? [-15, -7.5, 0, 7.5] : [-14, -6, 2, 10];
    const ww = kind === 'car1' ? 5.2 : 6.4;
    return `${kind === 'car1' ? '<path class="tk-cone" d="M21,-1.6 L66,-14 Q71,0 66,14 L21,1.6 Z"/>' : ''}
      <g class="tk-body">
        <rect x="${-h}" y="-6.6" width="${W}" height="12.2" rx="${kind === 'car1' ? 2.4 : 3.6}" class="tk-shell"/>
        ${kind === 'car1' ? `<path d="M${h - 4},-6.6 Q${h + 1.4},-6 ${h + 1.4},-1 L${h + 1.4},3 Q${h + 1},5.6 ${h - 3},5.6" class="tk-nose"/>` : `<path d="M${h - 5},-6 Q${h + 0.6},-5 ${h + 0.6},0 Q${h + 0.6},5 ${h - 5},5.6" class="tk-obs"/>`}
        <rect x="${-h + 2}" y="-9.2" width="${W - 4}" height="2.8" rx="1.3" class="tk-roof"/>
        ${(kind === 'car1' ? [-12, -2, 8] : [-10, 6]).map((x) => `<rect x="${x}" y="-11.2" width="4" height="2.2" rx=".6" class="tk-vent"/>`).join('')}
        ${win.map((x) => `<rect x="${x - ww / 2}" y="-5" width="${ww}" height="4.4" rx=".7" class="tk-win"/>`).join('')}
        <rect x="${-h}" y="1.4" width="${W}" height="1.5" class="tk-band"/>
        <path d="M${-h + 1},-5.8 H${h - 1}" class="tk-pin"/>
        ${kind === 'car1' ? `<circle cx="${h + 0.4}" cy="-.2" r="1.3" class="tk-lamp"/>` : ''}
        ${[-h + 6, -h + 11, h - 11, h - 6].map((x) => `<circle cx="${x}" cy="7.2" r="2.3" class="tk-wheel"/>`).join('')}
      </g>`;
  }
  function buildTrain() {
    fx = el('g', { class: 'train-fx', 'aria-hidden': 'true' }, layers.train);
    coupler = el('line', { class: 'tk-coupler', 'aria-hidden': 'true' }, layers.train);
    carG2 = el('g', { class: 'train-car train-car2', 'aria-hidden': 'true' }, layers.train);
    carG1 = el('g', { class: 'train-car train-car1', 'aria-hidden': 'true' }, layers.train);
    car2 = el('g', {}, carG2);
    car1 = el('g', {}, carG1);
    refreshTrain();
  }
  // 工房の塗装は、盤面では屋根の細い線の色にだけ映す（車体は指定の深緑と真鍮の帯）
  function refreshTrain() {
    car1.innerHTML = carSvg('car1');
    car2.innerHTML = carSvg('car2');
    const acc = { hidamari: '#c65d3b', forest: '#c5a059', gullwing: '#f6f3ec', caldera: '#1e1a18', patisserie: '#d4af37', royal: '#5e1f2b' }[YT.Craft.equipped().livery];
    svg.style.setProperty('--tk-accent', acc || '#c5a059');
  }

  // 経路の区間をつないだ1本の道のり
  function makeSegs(path) {
    layers.trail.innerHTML = '';
    const segs = [];
    let total = 0;
    for (let i = 0; i < path.length - 1; i++) {
      const p = el('path', { d: segmentD(path[i], path[i + 1]), class: 'trail-line' }, layers.trail);
      const len = p.getTotalLength();
      segs.push({ p, len, start: total, from: path[i], to: path[i + 1] });
      total += len;
    }
    segs.total = total;
    return segs;
  }
  // 道のりの距離 d の点と接線の向き θ = atan2(dy, dx)。d が範囲の外なら、端の向きにまっすぐ延ばす
  function pointAt(segs, d) {
    const clamp = Math.max(0, Math.min(segs.total, d));
    const seg = segs.find((s) => clamp <= s.start + s.len) || segs[segs.length - 1];
    const local = Math.max(0, Math.min(seg.len, clamp - seg.start));
    const a = seg.p.getPointAtLength(Math.max(0, local - 1.5));
    const b = seg.p.getPointAtLength(Math.min(seg.len, local + 1.5));
    const pt = seg.p.getPointAtLength(local);
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    const over = d - clamp;
    return { x: pt.x + Math.cos(ang) * over, y: pt.y + Math.sin(ang) * over, ang };
  }
  // 車両を置く：左へ向かうときは絵を裏返して、上下さかさまにしない。bob（px）は上下の揺れ、tilt（度）はブレーキの沈み込み
  function placeCar(g, p, k, bob = 0, tilt = 0) {
    let deg = (p.ang * 180) / Math.PI;
    const left = Math.abs(deg) > 90;
    if (left) deg += deg > 0 ? -180 : 180;
    g.setAttribute('transform', `translate(${f1(p.x)} ${f1(p.y)}) rotate(${deg.toFixed(2)}) scale(${(left ? -k : k).toFixed(4)} ${k.toFixed(4)}) translate(0 ${bob.toFixed(2)}) rotate(${tilt.toFixed(2)})`);
    return left ? -1 : 1;
  }
  // 車体の上の点（px の座標）→ 盤面の座標
  function carPoint(p, k, dir, lx, ly) {
    const c = Math.cos(p.ang), sn = Math.sin(p.ang);
    // 進む向きは常に接線の +x。左向き（絵を裏返したとき）は、接線の向きから見た上下が入れ替わるので y を反転する
    const x = lx * k, y = ly * k * (dir < 0 ? -1 : 1);
    return [p.x + x * c - y * sn, p.y + x * sn + y * c];
  }
  function setPose(d, now = 0, running = false, tilt = 0) {
    pose.d = d;
    const k = upp();
    const p1 = pointAt(pose.segs, d);
    const p2 = pointAt(pose.segs, Math.max(0, d - PX.gap * k)); // 2両目は max(0, s − 38px)
    // 走っているあいだの小刻みなジョイント振動：translateY(sin(now × 0.035) × 1.6px)
    const bob = running ? Math.sin(now * 0.035) * 1.6 : 0;
    const dir = placeCar(carG1, p1, k, bob, tilt);
    placeCar(carG2, p2, k, running ? Math.sin(now * 0.035 + 1.1) * 1.6 : 0, tilt * 0.6);
    carG2.style.display = d - PX.gap * k < -PX.car2 * k ? 'none' : '';
    // 連結幌：1両目の後ろの端と2両目の前の端を、伸び縮みする線で結ぶ（カーブでくの字に折れる）
    const r1 = pointAt(pose.segs, d - (PX.car1 / 2) * k), f2 = pointAt(pose.segs, Math.max(0, d - PX.gap * k) + (PX.car2 / 2) * k);
    coupler.setAttribute('x1', f1(r1.x));
    coupler.setAttribute('y1', f1(r1.y));
    coupler.setAttribute('x2', f1(f2.x));
    coupler.setAttribute('y2', f1(f2.y));
    return { p1, p2, dir, k };
  }

  // 駅に止まっている姿：その駅へ入ってくる区間の上、駅の少し手前に置く
  function park(id, from) {
    const prev = from && (D.adj[id] || new Set()).has(from) ? from : [...(D.adj[id] || [])][0];
    if (!prev) return;
    pose.segs = makeSegs([prev, id]);
    layers.trail.innerHTML = '';
    setPose(Math.max(0, pose.segs.total - PX.stop * upp()));
  }

  // ---------- 走行の粒子（requestAnimationFrame でまとめて動かす）----------
  // steam：煙突からの白い蒸気（半径 3px → 15px にふくらみながら後ろへ流れ、600ms で消える）
  // spark：車輪のあたりからの真鍮の光の粒（#E5C158。重力で少し落ちながらきらきら消える）
  // glow：通りすぎた直後の区間に 1.2 秒だけ残る金の光（stroke #D4AF37・4.5px）
  const parts = [];
  let partRaf = 0;
  function addPart(pt) {
    parts.push(pt);
    if (!partRaf) partRaf = requestAnimationFrame(tickParts);
  }
  function tickParts(now) {
    partRaf = 0;
    const k = upp();
    for (let i = parts.length - 1; i >= 0; i--) {
      const q = parts[i];
      const t = (now - q.t0) / q.life;
      if (t >= 1) {
        q.el.remove();
        parts.splice(i, 1);
        continue;
      }
      if (q.kind === 'steam') {
        const r = 3 + 12 * t; // 3px → 15px
        q.el.setAttribute('cx', f1(q.x + q.vx * t * k));
        q.el.setAttribute('cy', f1(q.y + q.vy * t * k));
        q.el.setAttribute('r', f1(r * k));
        q.el.setAttribute('opacity', (0.62 * (1 - t) * (1 - t)).toFixed(3));
      } else if (q.kind === 'spark') {
        const sec = (now - q.t0) / 1000;
        q.el.setAttribute('cx', f1(q.x + q.vx * sec * k));
        q.el.setAttribute('cy', f1(q.y + (q.vy * sec + 0.5 * 160 * sec * sec) * k)); // 重力 160px/s²
        q.el.setAttribute('opacity', ((1 - t) * (0.55 + 0.45 * Math.abs(Math.sin(now * 0.04 + q.ph)))).toFixed(3));
      } else if (q.kind === 'glow') {
        q.el.setAttribute('opacity', (0.9 * (1 - t)).toFixed(3));
      }
    }
    if (parts.length) partRaf = requestAnimationFrame(tickParts);
  }
  const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function emit(p1, dir, k, now) {
    if (reduceMotion()) return;
    // 煙突（先頭車の前寄りの屋根の上）。進む向きは接線の向き（dir は絵の裏返しだけを表す）
    const [sx, sy] = carPoint(p1, k, dir, 12, -12);
    const back = p1.ang + Math.PI;
    const sc = el('circle', { cx: f1(sx), cy: f1(sy), r: f1(3 * k), class: 'fx-steam' }, fx);
    addPart({ kind: 'steam', el: sc, x: sx, y: sy, vx: Math.cos(back) * 34 + (Math.random() - 0.5) * 8, vy: Math.sin(back) * 34 - 16, t0: now, life: 600 });
    const [wx, wy] = carPoint(p1, k, dir, -10 + Math.random() * 20, 8);
    const sp = el('circle', { cx: f1(wx), cy: f1(wy), r: f1((0.8 + Math.random() * 0.9) * k), class: 'fx-spark' }, fx);
    addPart({ kind: 'spark', el: sp, x: wx, y: wy, vx: Math.cos(back) * (20 + Math.random() * 30) + (Math.random() - 0.5) * 30, vy: -20 - Math.random() * 40, t0: now, life: 520, ph: Math.random() * 6 });
  }
  function glowSeg(seg, now) {
    const g = el('path', { d: seg.p.getAttribute('d'), class: 'seg-glow' }, layers.trail);
    addPart({ kind: 'glow', el: g, t0: now, life: 1200 });
  }

  // ---------- 頭上のカウンター「あと N 駅」（真鍮の枠のピル）----------
  function makeCounter(n, label) {
    const g = el('g', { class: 'run-count', 'aria-hidden': 'true' }, layers.train);
    const body = el('g', {}, g);
    const rect = el('rect', { x: -26, y: -9, width: 52, height: 18, rx: 9, class: 'rc-pill' }, body);
    el('rect', { x: -23.6, y: -6.6, width: 47.2, height: 13.2, rx: 6.6, class: 'rc-in' }, body);
    const t = el('text', { x: 0, y: 3.6, 'text-anchor': 'middle', class: 'rc-text' }, body);
    const c = { g, body, n, bounce: null, label };
    c.set = (m, now) => {
      c.n = m;
      t.textContent = m > 0 ? label(m) : label(0);
      const w = Math.max(52, t.getComputedTextLength() + 20);
      rect.setAttribute('x', f1(-w / 2));
      rect.setAttribute('width', f1(w));
      body.lastElementChild.previousElementSibling.setAttribute('x', f1(-w / 2 + 2.4));
      body.lastElementChild.previousElementSibling.setAttribute('width', f1(w - 4.8));
      c.bounce = now || performance.now();
    };
    c.place = (p1, k, now) => {
      // 数字が減るたびに、ばねのように弾む（減衰する振動：1 + 0.35·e^(−t/90)·cos(t/28)）
      let sc = 1;
      if (c.bounce !== null) {
        const tt = now - c.bounce;
        sc = tt > 700 ? 1 : 1 + 0.35 * Math.exp(-tt / 90) * Math.cos(tt / 28);
      }
      g.setAttribute('transform', `translate(${f1(p1.x)} ${f1(p1.y - 30 * k)}) scale(${(k * sc).toFixed(4)})`);
    };
    c.set(n);
    c.bounce = null;
    return c;
  }

  // 通過した駅：駅のしるしが scale(1.5) に弾けて、二重の金の波紋が広がる（rAF）
  function popStation(id) {
    const g = nodes[id];
    if (!g) return;
    const tok = g.querySelector('.station-token');
    [0, 1].forEach((i) => {
      const c = el('circle', { r: 8, class: 'pass-ripple', style: `--i:${i}` }, g);
      setTimeout(() => c.remove(), 1500);
    });
    if (!tok || reduceMotion()) return;
    const t0 = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - t0) / 520);
      const sc = t < 0.25 ? 1 + 0.5 * (t / 0.25) : 1.5 - 0.5 * easeOut((t - 0.25) / 0.75);
      tok.setAttribute('transform', `scale(${sc.toFixed(3)})`);
      if (t < 1) requestAnimationFrame(step);
      else tok.removeAttribute('transform');
    };
    requestAnimationFrame(step);
  }
  const easeOut = (x) => 1 - Math.pow(1 - x, 3);

  // 停車中も、ときどきふわっと蒸気を浮かべる
  let idleTimer = null;
  function idleFx() {
    clearInterval(idleTimer);
    idleTimer = setInterval(() => {
      if (pose.running || !pose.segs || document.hidden || reduceMotion()) return;
      const k = upp();
      const p = pointAt(pose.segs, pose.d);
      const [sx, sy] = carPoint(p, k, 1, 12, -12);
      const sc = el('circle', { cx: f1(sx), cy: f1(sy), r: f1(3 * k), class: 'fx-steam' }, fx);
      addPart({ kind: 'steam', el: sc, x: sx, y: sy, vx: (Math.random() - 0.5) * 10, vy: -26, t0: performance.now(), life: 900 });
    }, 1600);
  }

  // 倍率1で見せる範囲：スマホ（幅639px以下）では左右の海を少し切って、九州を大きく見せる（座標系は 800×960 のまま）
  function baseView() {
    const narrow = narrowView();
    const [vx, vy, vw, vh] = D.meta.viewBox;
    return narrow ? { x: 118, y: 0, w: 584, h: 960 } : { x: vx, y: vy, w: vw, h: vh };
  }

  // ---------- 盤面の縁の経緯度の目盛り（航海図のネートライン）----------
  // 地図の SVG とは別の小さな SVG を盤面の枠に重ね、いまのカメラで見えている緯度・経度の目盛りを描く。
  // 地図を描き直さずに（見た目の transform のあいだも）カメラに合わせて付け直せるよう、画面の px で描く
  let frameSvg = null, frameRaf = 0, frameCam = null;
  function buildFrame() {
    frameSvg = document.createElementNS(NS, 'svg');
    frameSvg.setAttribute('class', 'map-frame');
    frameSvg.setAttribute('aria-hidden', 'true');
    svg.parentElement.insertBefore(frameSvg, svg.nextSibling);
  }
  function queueFrame(cam) {
    frameCam = cam;
    if (!frameRaf) frameRaf = requestAnimationFrame(() => ((frameRaf = 0), drawFrame(frameCam)));
  }
  const dms = (v, hemi) => {
    const t = Math.round(v * 60);
    const dg = Math.floor(t / 60), mn = t - dg * 60;
    return `${dg}°${mn ? `${String(mn).padStart(2, '0')}′` : ''}${hemi}`;
  };
  function drawFrame(cam) {
    if (!frameSvg || !GEO || !cam) return;
    const W = svg.clientWidth, H = svg.clientHeight;
    if (W < 40 || H < 40) return; // 隠れている・極端に小さいときは描かない（枠の寸法がマイナスになる）
    const B = baseView();
    const P = GEO.proj;
    const vw = B.w / cam.z, vh = B.h / cam.z, ox = cam.cx - vw / 2, oy = cam.cy - vh / 2, k = W / vw;
    const yOf = (lat) => (P.top + (P.bounds.north - lat) * P.k - oy) * k;
    const xOf = (lng) => (P.cx + (lng - P.lng0) * P.cos * P.k - ox) * k;
    const latOf = (y) => P.bounds.north - (y / k + oy - P.top) / P.k;
    const lngOf = (x) => P.lng0 + (x / k + ox - P.cx) / (P.cos * P.k);
    // 欄外（生成りの余白）に度数、その内側に 10′ ごとの墨と生成りの帯、いちばん内側がネートライン（px）
    const narrow = W < 420;
    const M = narrow ? 12 : 15, T = narrow ? 3 : 3.6, b0 = M - T;
    const r1 = (v) => v.toFixed(1);
    const cl = (v, a, c) => r1(Math.max(a, Math.min(c, v)));
    let band = '';
    const latA = latOf(H), latB = latOf(0), lngA = lngOf(0), lngB = lngOf(W);
    // いつも同じ緯度・経度で色が切りかわるよう、絶対の「10′ の番号」で数える
    for (let i = Math.floor(latA * 6); i <= Math.ceil(latB * 6); i++) {
      if (i % 2) continue;
      const ya = cl(yOf((i + 1) / 6), b0, H - b0), yb = cl(yOf(i / 6), b0, H - b0);
      band += `M${b0} ${ya}H${M}V${yb}H${b0}Z M${W - M} ${ya}H${W - b0}V${yb}H${W - M}Z`;
    }
    for (let i = Math.floor(lngA * 6); i <= Math.ceil(lngB * 6); i++) {
      if (i % 2) continue;
      const xa = cl(xOf(i / 6), b0, W - b0), xb = cl(xOf((i + 1) / 6), b0, W - b0);
      band += `M${xa} ${b0}H${xb}V${M}H${xa}Z M${xa} ${H - M}H${xb}V${H - b0}H${xa}Z`;
    }
    // 度数：寄るほど細かく（1°・30′・10′）。左右は縦に回して欄外に収める
    const stepMin = cam.z < 1.7 ? 60 : cam.z < 3.2 ? 30 : 10;
    const fs = narrow ? 8 : 9.5;
    let ticks = '', labs = '';
    for (let mn = Math.ceil((latA * 60) / stepMin) * stepMin; mn <= latB * 60; mn += stepMin) {
      const y = yOf(mn / 60);
      if (y < M + 18 || y > H - M - 18) continue;
      ticks += `M${M} ${r1(y)}h5 M${W - M} ${r1(y)}h-5`;
      const t = dms(mn / 60, 'N');
      labs += `<text transform="translate(${r1(b0 - 1.6)} ${r1(y)}) rotate(-90)" text-anchor="middle">${t}</text>`;
      labs += `<text transform="translate(${r1(W - b0 + 1.6)} ${r1(y)}) rotate(90)" text-anchor="middle">${t}</text>`;
    }
    for (let mn = Math.ceil((lngA * 60) / stepMin) * stepMin; mn <= lngB * 60; mn += stepMin) {
      const x = xOf(mn / 60);
      if (x < M + 22 || x > W - M - 22) continue;
      ticks += `M${r1(x)} ${M}v5 M${r1(x)} ${H - M}v-5`;
      const t = dms(mn / 60, 'E');
      labs += `<text x="${r1(x)}" y="${r1(b0 - 1.6)}" text-anchor="middle">${t}</text>`;
      labs += `<text x="${r1(x)}" y="${r1(H - b0 + fs * 0.78)}" text-anchor="middle">${t}</text>`;
    }
    frameSvg.setAttribute('width', W);
    frameSvg.setAttribute('height', H);
    frameSvg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    frameSvg.style.setProperty('--mf-fs', `${fs}px`);
    frameSvg.innerHTML = `<path d="M0 0H${W}V${H}H0Z M${M} ${M}V${H - M}H${W - M}V${M}Z" class="mf-margin"/>
      <rect x="2.5" y="2.5" width="${W - 5}" height="${H - 5}" class="mf-out"/>
      <path d="${band}" class="mf-band"/><rect x="${b0}" y="${b0}" width="${W - b0 * 2}" height="${H - b0 * 2}" class="mf-thin"/>
      <rect x="${M}" y="${M}" width="${W - M * 2}" height="${H - M * 2}" class="mf-in"/>
      <path d="${ticks}" class="mf-tick"/><g class="mf-lab">${labs}</g>`;
  }

  // ---------- 3段階のセマンティック・ズーム（LOD）----------
  // 1：1〜1.5倍（九州全体）…駅のしるしと路線。駅名は主要ターミナル（hub）・いまいる駅・スポットライト駅・トップオーナーの駅だけ
  // 2：1.6〜2.4倍（エリア）…主要観光駅（tourist）の駅名・ご当地の演出・山の名前・区間のしるし
  // 3：2.5〜4倍（ローカル）…すべての駅名・経由駅の名前・いまいる駅の手帖のひとこと
  const lodOf = (z) => (z < 1.55 ? 1 : z < 2.45 ? 2 : 3);
  let lod = 0;
  let camRaf = 0;
  // final：viewBox を書き換えて描き直したとき（アニメーションの途中は見た目だけなので、重い書き換えはしない）
  function onCamera(cam, final = true) {
    const s = Math.pow(cam.z, -0.78); // 見た目の大きさは 倍率^0.22 だけ大きくなる（4倍でも約1.36倍）
    if (final && Math.abs(s - curScale) > 0.003) {
      curScale = s;
      scalables.forEach((it) => it.el.setAttribute('transform', `translate(${f1(it.x)} ${f1(it.y)}) scale(${s.toFixed(3)})`));
      svg.style.setProperty('--lw', Math.pow(cam.z, -0.6).toFixed(3)); // 線の太さ（4倍でも見た目は約1.7倍まで）
      // 海の平行線は、寄っても画面の上でほぼ同じ細かさに見えるよう、模様のほうを縮める
      const hatch = svg.querySelector('#p-sea-hatch');
      if (hatch) hatch.setAttribute('patternTransform', `scale(${Math.pow(cam.z, -0.8).toFixed(3)})`);
      // 止まっている列車は、画面の上で同じ大きさ（px）のまま置き直す
      if (!pose.running && pose.segs) setPose(Math.max(0, pose.segs.total - PX.stop * upp()));
    }
    const l = lodOf(cam.z);
    if (l !== lod) {
      lod = l;
      svg.dataset.lod = l;
    }
    const zr = document.getElementById('cam-zoom');
    if (zr) zr.textContent = `×${cam.z.toFixed(1)}`;
    queueFrame(cam);
    if (handlers.onCamera && !camRaf) camRaf = requestAnimationFrame(() => ((camRaf = 0), handlers.onCamera(cam)));
  }

  // マップ右下のカメラのボタン：真鍮の細い枠の小さなプレートに、線画のしるしと小さな字
  function buildCameraButtons() {
    const I = (n) => (YT.Icon ? YT.Icon.svg(n) : '');
    const box = document.createElement('div');
    box.className = 'cam-ctrl';
    box.innerHTML = `
      <button class="cam-btn" data-cam="here" title="現在地にフォーカス（×2.5）">${I('here')}<span class="cam-text">現在地</span></button>
      <button class="cam-btn" data-cam="all" title="九州全体を一望（×1.0）">${I('kyushu')}<span class="cam-text">九州全体</span></button>
      <button class="cam-btn" data-cam="spot" title="スポットライト駅を見る">${I('target')}<span class="cam-text">スポットライト駅</span></button>
      <span class="cam-zoom-row"><button class="cam-btn cam-sq" data-cam="out" aria-label="縮小">${I('minus')}</button><span id="cam-zoom" class="cam-zoom">×1.0</span><button class="cam-btn cam-sq" data-cam="in" aria-label="拡大">${I('plus')}</button></span>`;
    svg.parentElement.appendChild(box);
    box.addEventListener('click', (e) => {
      const b = e.target.closest('[data-cam]');
      if (!b) return;
      const c = camera.get();
      const k = b.dataset.cam;
      if (k === 'here') Map.focus(handlers.currentId(), 2.5);
      if (k === 'all') camera.set({ ...centerOf(camera.base()), z: 1 }, 700);
      if (k === 'spot' && handlers.spotlightId()) Map.focus(handlers.spotlightId(), Math.max(c.z, 2));
      if (k === 'in' || k === 'out') camera.set({ z: c.z * (k === 'in' ? 1.5 : 1 / 1.5) }, 300);
    });
  }
  const centerOf = (b) => ({ cx: b.x + b.w / 2, cy: b.y + b.h / 2 });

  const Map = {
    latLngToSvg,
    init(svgEl, data, h) {
      D = data;
      svg = svgEl;
      handlers = h;
      svg.setAttribute('viewBox', D.meta.viewBox.join(' '));
      svg.innerHTML = '';
      buildDefs();
      layers = {};
      ['bg', 'routes', 'badges', 'labels', 'course', 'branch', 'trail', 'nodes', 'region', 'train'].forEach((k) => (layers[k] = el('g', { class: `layer-${k}` }, svg)));
      buildBoard();
      buildRoutes();
      buildNodes();
      buildTrain();
      idleFx();
      buildFrame();
      buildShoreLines();
      camera = YT.Camera.create(svg, { base: baseView, min: 1, max: 4, onChange: onCamera });
      buildCameraButtons();
      queueFrame(camera.get());
      window.addEventListener('resize', Map.fit);
    },

    // 画面の大きさが変わったら、倍率1で見せる範囲を選び直す（スマホ⇔PC をまたいだら、駅名標の大きさも付け直す）
    fit() {
      const k = narrowView() ? 1.4 : 1;
      if (D && k !== labelK) {
        labelK = k;
        D.stations.forEach((s) => nodes[s.id] && buildLabel(s, nodes[s.id]));
      }
      if (camera) camera.rebase();
      if (camera) queueFrame(camera.get());
    },

    refresh(state) {
      const shareholders = new Set(YT.Ownership ? YT.Ownership.shareholderOf() : []);
      D.stations.forEach((s) => {
        const g = nodes[s.id];
        g.classList.toggle('is-visited', !!state.visited[s.id]);
        g.classList.toggle('is-acquired', !!state.acquired[s.id]);
        g.classList.toggle('is-current', state.currentStationId === s.id);
        g.classList.toggle('is-favorite', !!state.favorites[s.id]);
        g.classList.toggle('is-pending', !!(state.pendingOwner && state.pendingOwner.stationId === s.id));
        g.classList.toggle('is-shareholder', !state.acquired[s.id] && shareholders.has(s.id));
      });
    },

    refreshTrain,

    // ---------- カメラ ----------
    camera: () => camera,
    lod: () => lod,
    // 駅を中心に z 倍へ
    focus(id, z, ms = 700) {
      if (!D.byId[id]) return Promise.resolve();
      return camera.set({ cx: D.byId[id].x, cy: D.byId[id].y, z }, ms);
    },
    // ① 映画のようなカメラ：走り出すと同時に、いまの倍率から ×1.65 へなめらかに寄る（走りはじめを待たせない）。
    // 走っているあいだは毎フレーム camX += (trainX − camX) × 0.14 の減衰補間で列車を追う（camera.follow）
    followStart() {
      camera.resetUser();
      const p = Map.trainXY() || [camera.get().cx, camera.get().cy];
      camera.set({ cx: p[0], cy: p[1], z: 1.65 }, 650);
      return Promise.resolve();
    },
    // 分かれ道：いまの駅と行き先の駅がそろって見える角度で止める
    frame(ids, { zMin = 1.6, zMax = 3 } = {}) {
      if (camera.userMoved()) return Promise.resolve();
      const pts = ids.filter((id) => D.byId[id]).map((id) => [D.byId[id].x, D.byId[id].y]);
      const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
      const box = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
      return camera.set(camera.fit(box, { pad: 70, zMin, zMax }), 600);
    },
    // 最後の駅に止まった瞬間：×1.25 に少し引いて、まわりの駅を見渡す
    arriveZoom(id) {
      if (camera.userMoved()) return Promise.resolve();
      return Map.focus(id, 1.25, 800);
    },
    // 盤面1単位が、いま画面で何 px か（の逆数）。画面の px で大きさを決めたいものを盤面に置くときに使う
    unitsPerPx: () => upp(),
    // 言語を切り替えたとき：駅名標を付け直す
    relabel() {
      D.stations.forEach((s) => nodes[s.id] && buildLabel(s, nodes[s.id]));
    },
    // 分かれ道：選べる線路を、金の破線が流れるように光らせる（ids が null なら消す）
    showBranches(at, ids) {
      layers.branch.innerHTML = '';
      (ids || []).forEach((id) => {
        el('path', { d: segmentD(at, id), class: 'branch-hl' }, layers.branch);
        el('path', { d: segmentD(at, id), class: 'branch-hl branch-flow' }, layers.branch);
      });
    },

    // サイコロの行き先候補：波紋のようにやさしく光らせる
    setCandidates(ids) {
      candidates = ids ? new Set(ids) : null;
      svg.classList.toggle('is-choosing', !!candidates);
      D.stations.forEach((s) => nodes[s.id].classList.toggle('is-candidate', !!(candidates && candidates.has(s.id))));
    },
    isCandidate: (id) => !!(candidates && candidates.has(id)),

    placeTrain(id, from) {
      if (D.byId[id]) park(id, from);
    },

    // 盤面の座標 → 盤面の枠（.map-board）の左上からの画面の位置（px）。行き先ボタンや望遠鏡の吹き出しを重ねるのに使う
    toBoard(x, y) {
      const m = svg.getScreenCTM();
      const box = svg.parentElement.getBoundingClientRect();
      if (!m) return { left: 0, top: 0 };
      return { left: m.a * x + m.c * y + m.e - box.left, top: m.b * x + m.d * y + m.f - box.top };
    },
    stationXY: (id) => [D.byId[id].x, D.byId[id].y],
    // a から b へ向かう線路の上、a から dist だけ進んだ点（分かれ道の行き先ボタンを置く場所）
    along(a, b, dist) {
      const p = el('path', { d: segmentD(a, b) }, layers.trail);
      const len = p.getTotalLength();
      const pt = p.getPointAtLength(Math.min(dist, len * 0.6));
      p.remove();
      return [pt.x, pt.y];
    },
    // 今いる駅の位置（列車の位置）。演出を重ねるのに使う
    trainXY() {
      if (!pose.segs) return null;
      const p = pointAt(pose.segs, pose.d);
      return [p.x, p.y];
    },

    // 経路 [a, b, c, ...] の線路の上を走る（つながった区間は1本の道のりで走り、分かれ道か最後の駅で止まる）。
    // ③ 台形の速度：進み具合 p ∈ [0, 1] に対して、0〜0.2 で力強く加速 → 0.2〜0.75 は最高速 → 0.75〜1 で駅の手前へ
    //    なめらかにブレーキ。かかる時間は 1駅あたり約 620ms（550〜700ms のあいだ）。道のりは速度の面積を足して出す。
    // opts.onJoint(速さ 0〜1)：レールの継ぎ目を通ったとき（距離で鳴らすので、速いほど間隔がつまる）
    // opts.onPass(駅ID)：途中の駅を通りすぎたとき、opts.onSpeed(速さ 0〜1)：毎フレーム（車窓のパララックスに使う）
    // opts.remain：頭上のカウンターに出す残りの駅数、opts.label(n)：その字、opts.junction：分かれ道で一時停止する
    moveTrain(path, opts = {}) {
      return new Promise((resolve) => {
        if (!path || path.length < 2) return resolve();
        const reduce = reduceMotion();
        const segs = makeSegs(path);
        pose.segs = segs;
        pose.running = true;
        pose.dive = null;
        const hops = path.length - 1;
        const T = (reduce ? 160 : 620) * hops; // 1駅あたり約620ms
        const A = 0.2, B = 0.75; // 加速の終わり・減速の始まり
        const area = A / 2 + (B - A) + (1 - B) / 2; // 速度の面積（最高速を1としたとき）
        // 進み具合 p までに進んだ割合（0〜1）
        const frac = (p) => {
          if (p <= A) return (p * p) / (2 * A) / area;
          if (p <= B) return (A / 2 + (p - A)) / area;
          const q = 1 - p;
          return (area - (q * q) / (2 * (1 - B))) / area;
        };
        const vel = (p) => (p < A ? p / A : p < B ? 1 : (1 - p) / (1 - B)); // 0〜1
        const stops = segs.map((sg) => sg.start + sg.len); // 各区間の終わり（駅）の位置
        const counter = makeCounter(opts.remain || hops, opts.label || ((n) => `あと ${n} 駅`));
        let t0 = null, passed = 0, nextJoint = 26, lastEmit = 0, lastNow = 0;
        carG1.classList.add('is-running');
        carG2.classList.add('is-running');
        const step = (now) => {
          if (t0 === null) t0 = now;
          const p = Math.min(1, (now - t0) / T);
          const k = upp();
          const end = Math.max(0, segs.total - PX.stop * k); // 駅のしるしを隠さないよう、少し手前で止まる
          const d = end * frac(p);
          const v = vel(p);
          const { p1, dir } = setPose(d, now, p < 1);
          counter.place(p1, k, now);
          // カメラ：列車へ減衰補間で寄せつづける（人がカメラを動かしたら、その回は追わない）
          if (opts.follow && camera && !camera.userMoved()) camera.follow(p1.x, p1.y, 0.14);
          if (opts.onSpeed) opts.onSpeed(p >= 1 ? 0 : v);
          if (d >= nextJoint) {
            nextJoint += 26;
            if (opts.onJoint) opts.onJoint(v);
          }
          // 通過した駅：区間に金の光を残し、駅をはじけさせ、カウンターを1つ減らす
          while (passed < stops.length - 1 && d >= stops[passed]) {
            glowSeg(segs[passed], now);
            popStation(segs[passed].to);
            counter.set(counter.n - 1, now);
            if (opts.onPass) opts.onPass(segs[passed].to);
            passed++;
          }
          // ④ 35ms ごとに、蒸気と真鍮の火の粉を出す
          if (now - lastEmit >= 35 && p < 1) {
            lastEmit = now;
            emit(p1, dir, k, now);
          }
          lastNow = now;
          if (p < 1) return requestAnimationFrame(step);
          // 止まった：最後の区間にも金の光、ブレーキの沈み込み（rotate 2.5deg → 0）
          glowSeg(segs[segs.length - 1], now);
          if (!opts.junction) {
            popStation(segs[segs.length - 1].to);
            counter.set(0, now);
          } else counter.set(counter.n - 1, now);
          pose.running = false;
          carG1.classList.remove('is-running');
          carG2.classList.remove('is-running');
          const dive0 = now;
          const diveStep = (t) => {
            const q = Math.min(1, (t - dive0) / 460);
            const tilt = 2.5 * (1 - easeOut(q)) * (q < 0.18 ? q / 0.18 : 1); // さっと沈んで、ゆっくり戻る
            setPose(pose.d, t, false, dir * tilt);
            counter.place(pointAt(pose.segs, pose.d), upp(), t);
            if (q < 1) requestAnimationFrame(diveStep);
            else {
              setTimeout(() => {
                counter.g.classList.add('is-gone');
                setTimeout(() => counter.g.remove(), 700);
              }, opts.junction ? 200 : 900);
            }
          };
          if (!reduce) requestAnimationFrame(diveStep);
          else counter.g.remove();
          resolve();
        };
        requestAnimationFrame(step);
      });
    },

    // マイ旅しおりのモデルコースを盤面に重ねる。legs = [[駅ID, ...], ...]（行程ごとの経路）、stops = 巡る順の駅ID
    showCourse(legs, stops, overnight) {
      layers.course.innerHTML = '';
      svg.classList.toggle('has-course', !!legs);
      if (!legs) return;
      legs.forEach((path, i) => {
        for (let k = 0; k < path.length - 1; k++) {
          el('path', { d: segmentD(path[k], path[k + 1]), class: 'course-line', style: `--i:${i}` }, layers.course);
        }
      });
      stops.forEach((id, i) => {
        const s = D.byId[id];
        const g = el('g', { class: `course-pin${id === overnight ? ' is-overnight' : ''}`, transform: `translate(${s.x + 14 * curScale} ${s.y - 14 * curScale}) scale(${curScale.toFixed(3)})` }, layers.course);
        el('circle', { r: 9 }, g);
        el('circle', { r: 7.2, class: 'course-pin-in' }, g);
        el('text', { y: 3.8, 'text-anchor': 'middle' }, g).textContent = id === overnight ? '泊' : String(i + 1);
      });
    },

    // 地域の演出を置く層（js/scenery.js が使う）
    regionLayer: () => layers.region,

    // スポットライト駅：真鍮の細い輪がゆっくり広がり、真鍮の線のペナント（「ゴール」の小旗）が立つ
    setSpotlight(id) {
      D.stations.forEach((s) => nodes[s.id].classList.toggle('is-spotlight', s.id === id));
      svg.querySelectorAll('.spot-flag').forEach((f) => f.remove());
      if (!id || !nodes[id]) return;
      const R = TOKEN_R[D.byId[id].stationTier] || TOKEN_R.local;
      const g = el('g', { class: 'spot-flag', 'aria-hidden': 'true' }, nodes[id]);
      [0, 1, 2].forEach((i) => el('circle', { r: R + 3, class: 'spot-beacon', style: `--i:${i}` }, g));
      // 盤面の上のふちに近い駅（門司港など）は、旗が切れないよう駅の下に立てる
      const pos = el('g', { transform: D.byId[id].y < 70 ? 'translate(-30 50)' : `translate(${f1(R * 0.55)} ${f1(-R - 4)})` }, g);
      const f = el('g', { class: 'spot-pennant' }, pos); // はためく動きは内側だけ（位置の transform を上書きしないように）
      el('line', { x1: 0, y1: 2, x2: 0, y2: -31, class: 'spot-pole' }, f);
      el('circle', { cy: -32.6, r: 1.5, class: 'spot-finial' }, f);
      el('path', { d: 'M0,-30.5 L40,-24 L0,-17.5 Z', class: 'spot-cloth' }, f);
      el('path', { d: 'M1.8,-28.4 L31,-24 L1.8,-19.6', class: 'spot-cloth-line' }, f);
      el('text', { x: 4.2, y: -22.3, class: 'spot-text' }, f).textContent = 'ゴール';
      nodes[id].parentNode.appendChild(nodes[id]); // ほかの駅の名前の上に出す
    },

    // ライン制覇：そのラインの区間（両端がラインの駅）の下に、金箔の帯を敷く
    setGoldLines(stationSets) {
      svg.querySelectorAll('.route.is-gold').forEach((r) => r.classList.remove('is-gold'));
      stationSets.forEach((set) => {
        D.edges.forEach((e) => {
          if (set.has(e.a) && set.has(e.b)) {
            const r = svg.querySelector(`.route[data-edge="${e.key}"]`);
            if (!r) return;
            r.classList.add('is-gold');
            if (!r.querySelector('.gold-glow')) r.insertBefore(el('path', { d: segmentD(e.a, e.b), class: 'gold-glow' }), r.querySelector('path')); // 線路の下に敷く
          }
        });
      });
    },

    // 王座奪還：自分の真鍮の王冠と旅の紋章が、上から駅にすっと降りてくる
    dropCrown(id, avatarMarkup) {
      const g = nodes[id];
      if (!g) return;
      const pin = el('g', { class: 'crown-drop', 'aria-hidden': 'true', transform: 'scale(1.6)' }, g); // スマホでも見えるよう大きめに
      pin.innerHTML = `<g class="crown-drop-body"><circle r="17" cy="-30" class="crown-drop-disc"/><circle r="14.6" cy="-30" class="crown-drop-ring"/>
          <foreignObject x="-15" y="-45" width="30" height="30"><div xmlns="http://www.w3.org/1999/xhtml" class="crown-drop-av">${avatarMarkup}</div></foreignObject>
          <path d="M-11,-48 L-12,-57 L-5.5,-52 L0,-60.5 L5.5,-52 L12,-57 L11,-48 Z" class="crown-drop-crown"/><path d="M-10,-50.6 H10" class="crown-drop-band"/></g>
        <ellipse rx="22" ry="6" class="crown-drop-dust"/>`;
      g.parentNode.appendChild(g);
      setTimeout(() => pin.classList.add('is-landed'), 700);
      setTimeout(() => pin.remove(), 5200);
    },

    // 霧の解放：初めて着いた駅の霧が晴れる瞬間、真鍮の光の輪がふわっと広がる
    unveil(id) {
      const g = nodes[id];
      if (!g) return;
      g.classList.add('is-unveiling');
      [0, 1, 2].forEach((i) => {
        const c = el('circle', { r: 8, class: 'pass-ripple is-unveil', style: `--i:${i}` }, g);
        setTimeout(() => c.remove(), 1900);
      });
      setTimeout(() => g.classList.remove('is-unveiling'), 1600);
    },

    // オーナー刻印の瞬間：駅のしるしに、印を押したときの輪が広がる
    burst(id) {
      const g = nodes[id];
      if (!g) return;
      const b = el('circle', { r: 12, class: 'station-burst' }, g);
      setTimeout(() => b.remove(), 1400);
    },
  };

  YT.Map = Map;
})();
