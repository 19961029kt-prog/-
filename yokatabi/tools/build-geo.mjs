#!/usr/bin/env node
// 実在の地理データから、盤面の地図（海岸線・県境・山地・線路網・区間の線形）と駅の座標を作る。
// 手描きの近似ではなく、九州の形と線路の位置を実際の地図に合わせるためのツール。
//
//   bash tools/fetch-geo-data.sh <データのフォルダ>   … 元データをダウンロード（初回だけ）
//   node tools/build-geo.mjs <データのフォルダ>
//
// データのフォルダの中身（どれも公開データ。大きいのでリポジトリには入れない）
//   n03/*.json     … 国土数値情報「行政区域（N03）」の都道府県ごとの GeoJSON（九州7県＋山口県・愛媛県）。
//                    国土交通省の配布元（nlftp.mlit.go.jp）の GeoJSON か、それを都道府県ごとに分けた
//                    niiyz/JapanCityGeoJson の geojson/prefectures/XX.json（2020年版・間引きなし）を置く。
//                    属性 N03_001（都道府県名）で県を見分けるので、どちらの形でも読める。
//   sd/json/       … Seo-4d696b75/station_database（CC BY 4.0）。駅の緯度経度（駅データ.jp 由来）と、
//                    路線の線形（国土数値情報「鉄道（N02）」を加工したもの）を使う。
//   n02/*.geojson  … （任意）国土数値情報「鉄道（N02）」の RailroadSection。置いてあれば、下地の線路網を
//                    これから作る（九州旅客鉄道の区間だけ）。無ければ station_database の線形を使う。
//   dem/9/x/y.png  … 標高タイル Terrain Tiles（Mapzen／AWS Open Data、Terrarium 形式）。山地の等高線を作る。
//
// 投影 latLngToSvg：盤面（viewBox 800×960）に、北緯 30.15〜34.05°・東経 129.35〜132.05° の範囲が収まるよう、
//       正距円筒図法（範囲の中央の緯度で経度を cos 倍に縮める）で縦横同じ倍率に変換する。
//       縦横を別々の倍率で引き伸ばすと九州の形が横に太るので、倍率は1つにして、左右の余白は海として見せる。
//       海岸線・県境・山地・線路・駅を、すべて同じ式で盤面の座標にする（駅が線路から浮かないように）。
//
// 出力：
//   js/geo.js       … window.YOKATABI_GEO（投影の定数・陸地・県の塗り・県境・山地・線路網・区間ごとの線形・経由駅・出典）
//   stations.json   … 各駅の x / y を実際の位置に書き換える（ほかの項目には触れない）
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = resolve(process.argv[2] || '');
if (!process.argv[2] || !existsSync(join(dataDir, 'n03')) || !existsSync(join(dataDir, 'sd/json'))) {
  console.error('使い方: node tools/build-geo.mjs <n03/ と sd/json/ を置いたフォルダ>（tools/fetch-geo-data.sh でそろえられます）');
  process.exit(1);
}
const sdDir = join(dataDir, 'sd/json');
const stationsPath = resolve(root, 'stations.json');
const data = JSON.parse(readFileSync(stationsPath, 'utf8'));
const [VX, VY, VW, VH] = data.meta.viewBox;

// ---------- 投影 ----------
const BOUNDS = { south: 30.15, north: 34.05, west: 129.35, east: 132.05 };
const LAT0 = (BOUNDS.south + BOUNDS.north) / 2;
const LNG0 = (BOUNDS.west + BOUNDS.east) / 2;
const COS = Math.cos((LAT0 * Math.PI) / 180);
const K = Math.min(VW / ((BOUNDS.east - BOUNDS.west) * COS), VH / (BOUNDS.north - BOUNDS.south));
const CX = VX + VW / 2;
const TOP = VY + (VH - (BOUNDS.north - BOUNDS.south) * K) / 2;
const latLngToSvg = (lat, lng) => [CX + (lng - LNG0) * COS * K, TOP + (BOUNDS.north - lat) * K];
const proj = ([lon, lat]) => latLngToSvg(lat, lon);

// ---------- 小道具 ----------
const r1 = (v) => Math.round(v * 10) / 10;
const fmt = (pts) => pts.map(([x, y]) => `${r1(x)},${r1(y)}`).join(' ');
const pathOpen = (pts) => 'M' + fmt(pts).replace(/ /g, 'L');
const pathClosed = (pts) => pathOpen(pts) + 'Z';

// Douglas-Peucker：見た目が変わらない範囲で点を間引く（tol は盤面の単位）
function simplify(pts, tol) {
  if (pts.length < 3) return pts.slice();
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy || 1e-9;
    let best = -1, bestD = 0;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = pts[i];
      const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
      const ex = ax + t * dx - px, ey = ay + t * dy - py;
      const d = ex * ex + ey * ey;
      if (d > bestD) (bestD = d), (best = i);
    }
    if (best > 0 && bestD > tol * tol) {
      keep[best] = 1;
      stack.push([a, best], [best, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}
// 閉じた輪は、いちばん遠い2点で分けてから間引く（始点の位置で形が崩れないように）
function simplifyRing(pts, tol) {
  const ring = pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1] ? pts.slice(0, -1) : pts;
  let far = 0, fd = 0;
  ring.forEach((p, i) => {
    const d = (p[0] - ring[0][0]) ** 2 + (p[1] - ring[0][1]) ** 2;
    if (d > fd) (fd = d), (far = i);
  });
  const a = simplify(ring.slice(0, far + 1), tol);
  const b = simplify(ring.slice(far).concat([ring[0]]), tol);
  return a.concat(b.slice(1, -1));
}
const area = (pts) => Math.abs(pts.reduce((s, p, i) => {
  const q = pts[(i + 1) % pts.length];
  return s + p[0] * q[1] - q[0] * p[1];
}, 0)) / 2;
const visible = (pts, m = 70) => pts.some(([x, y]) => x > VX - m && x < VX + VW + m && y > VY - m && y < VY + VH + m);

// 線分の集まりをつないで折れ線にする（端点が3本以上集まる点で切る）
function chain(segments) {
  const adj = new Map();
  const add = (k, s) => (adj.get(k) || adj.set(k, []).get(k)).push(s);
  segments.forEach((s, i) => {
    s.i = i;
    add(s.a, s);
    add(s.b, s);
  });
  const used = new Uint8Array(segments.length);
  const lines = [];
  const walk = (start, seg) => {
    const out = [start];
    let cur = start;
    while (seg && !used[seg.i]) {
      used[seg.i] = 1;
      cur = seg.a === cur ? seg.b : seg.a;
      out.push(cur);
      const next = (adj.get(cur) || []).filter((s) => !used[s.i]);
      seg = adj.get(cur).length === 2 ? next[0] : null;
    }
    return out;
  };
  // 分岐点・端点から歩き始め、最後に残った輪を拾う
  for (const [k, list] of adj) if (list.length !== 2) list.forEach((s) => !used[s.i] && lines.push(walk(k, s)));
  segments.forEach((s) => !used[s.i] && lines.push(walk(s.a, s)));
  return lines.map((keys) => keys.map(unkey));
}

// ---------- 陸地と県境（国土数値情報 行政区域 N03） ----------
// 県ごとの輪を線分に分け、同じ県の中で2回出てくる線分（市町村どうしの境・穴）を消すと県の外周が残る。
// さらに2県の外周に共通する線分が県境、残りが海岸線になる。座標は 1e-5 度（約1m）にそろえてから比べる。
const PREF_IDS = { 福岡県: 40, 佐賀県: 41, 長崎県: 42, 熊本県: 43, 大分県: 44, 宮崎県: 45, 鹿児島県: 46, 山口県: 35, 愛媛県: 38 };
const KYUSHU = [40, 41, 42, 43, 44, 45, 46];
const NEIGHBOR = [35, 38]; // 山口県・愛媛県（盤面のふちに見える対岸）
const PREF_NAME = { 40: '福岡', 41: '佐賀', 42: '長崎', 43: '熊本', 44: '大分', 45: '宮崎', 46: '鹿児島' };
const Q = 1e5;
const qkey = ([lon, lat]) => `${Math.round(lon * Q)},${Math.round(lat * Q)}`;
const unkey = (k) => k.split(',').map((v) => v / Q);

const n03Dir = join(dataDir, 'n03');
if (!existsSync(n03Dir)) throw new Error(`${n03Dir} がありません（tools/fetch-geo-data.sh でダウンロードできます）`);
const prefRings = {};
const n03Files = readdirSync(n03Dir).filter((f) => /\.(geo)?json$/.test(f));
for (const file of n03Files) {
  const fc = JSON.parse(readFileSync(join(n03Dir, file), 'utf8'));
  for (const f of fc.features || []) {
    const id = PREF_IDS[f.properties && f.properties.N03_001];
    if (!id || !f.geometry) continue;
    const polys = f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [f.geometry.coordinates];
    (prefRings[id] ||= []).push(...polys.flat());
  }
}
for (const id of [...KYUSHU, ...NEIGHBOR]) if (!prefRings[id]) throw new Error(`N03 のデータに県コード ${id} が見つかりません`);

// 輪の集まり → 外周の線分（奇数回出てくる線分）
function outline(rings) {
  const segs = new Map();
  for (const r of rings) {
    for (let i = 0; i < r.length - 1; i++) {
      const a = qkey(r[i]), b = qkey(r[i + 1]);
      if (a === b) continue;
      const k = a < b ? `${a}|${b}` : `${b}|${a}`;
      const s = segs.get(k);
      if (s) s.n++;
      else segs.set(k, { a, b, n: 1 });
    }
  }
  for (const [k, s] of segs) if (s.n % 2 === 0) segs.delete(k);
  return segs;
}
// 線分の集まり → 閉じた輪（使っていない線分をたどって、出発点に戻るまで歩く）
function ringsFrom(segList) {
  const adj = new Map();
  segList.forEach((s, i) => {
    s.i = i;
    (adj.get(s.a) || adj.set(s.a, []).get(s.a)).push(s);
    (adj.get(s.b) || adj.set(s.b, []).get(s.b)).push(s);
  });
  const used = new Uint8Array(segList.length);
  const rings = [];
  for (const s0 of segList) {
    if (used[s0.i]) continue;
    used[s0.i] = 1;
    const ring = [s0.a, s0.b];
    let cur = s0.b;
    while (cur !== s0.a) {
      const next = adj.get(cur).find((s) => !used[s.i]);
      if (!next) break;
      used[next.i] = 1;
      cur = next.a === cur ? next.b : next.a;
      ring.push(cur);
    }
    rings.push(ring.map(unkey));
  }
  return rings;
}

const prefOutline = {};
for (const id of [...KYUSHU, ...NEIGHBOR]) prefOutline[id] = outline(prefRings[id]);
// 2県の外周に共通する線分 = 県境
const seen = new Map();
for (const id of KYUSHU) for (const k of prefOutline[id].keys()) seen.set(k, (seen.get(k) || 0) + 1);
const borderSegs = [];
const coastSegs = [];
for (const id of KYUSHU) {
  for (const [k, s] of prefOutline[id]) {
    if (seen.get(k) > 1) borderSegs.push({ a: s.a, b: s.b, k });
    else coastSegs.push({ a: s.a, b: s.b });
  }
}
// 県境は両側の県で2回入るので、1本にする
const borderUniq = [...new Map(borderSegs.map((s) => [s.k, s])).values()];

// 盤面に入る島だけを描く（重心が盤面の外にある島＝対馬・五島の西側などは描かない）。
const centroid = (pts) => pts.reduce((c, p) => [c[0] + p[0] / pts.length, c[1] + p[1] / pts.length], [0, 0]);
const onBoard = ([x, y], m = 6) => x > VX - m && x < VX + VW + m && y > VY - m && y < VY + VH + m;
function shapes(rings, tol, minArea) {
  const out = [];
  for (const ring of rings) {
    if (ring.length < 4) continue;
    const pts = simplifyRing(ring.map(proj), tol);
    if (pts.length < 3 || area(pts) < minArea || !onBoard(centroid(pts))) continue;
    out.push({ pts, area: area(pts) });
  }
  return out.sort((a, b) => b.area - a.area);
}

// 陸地（九州全体の海岸線）：塗りと海岸線の太線・浅瀬のにじみに使う
const land = shapes(ringsFrom(coastSegs), 0.3, 0.8).map((l) => pathClosed(l.pts));
// 県ごとの塗り（県の色をほんのり重ねる）。陸地の内側だけに描くので、少し粗くてよい
const tint = [];
for (const id of KYUSHU) {
  for (const l of shapes(ringsFrom([...prefOutline[id].values()]), 1.2, 6)) tint.push({ d: pathClosed(l.pts), pref: PREF_NAME[id] });
}
const borders = chain(borderUniq)
  .map((lonlat) => simplify(lonlat.map(proj), 0.5))
  .filter((pts) => pts.length > 1 && visible(pts, 0))
  .map(pathOpen);
const neighbor = [];
for (const id of NEIGHBOR) {
  for (const ring of ringsFrom([...prefOutline[id].values()])) {
    const pts = simplifyRing(ring.map(proj), 0.9);
    if (pts.length < 3 || area(pts) < 4 || !visible(pts, 40)) continue;
    neighbor.push(pathClosed(pts));
  }
}

// ---------- 山地（標高タイル Terrain Tiles） ----------
// 標高を格子に並べ、標高が LEVELS 以上のマスの外周をたどって等高線の輪にする（N03 の外周と同じ考え方：
// マスの辺のうち、内側と外側の境にある辺だけを残してつなぐ）。階段状のふちは Chaikin でなめらかにしてから間引く。
const LEVELS = [400, 800, 1200]; // m。低い山並み・山地・高い峰の3段
const demDir = join(dataDir, 'dem/9');
const mountains = [];
let demSource = '';
if (existsSync(demDir)) {
  const Z = 9, TILE = 256;
  const xs = readdirSync(demDir).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  const ys = readdirSync(join(demDir, String(xs[0]))).map((f) => parseInt(f, 10)).filter(Number.isFinite).sort((a, b) => a - b);
  const W = xs.length * TILE, H = ys.length * TILE;
  const elev = new Float32Array(W * H);
  for (const [i, tx] of xs.entries()) {
    for (const [j, ty] of ys.entries()) {
      const img = readPng(readFileSync(join(demDir, String(tx), `${ty}.png`)));
      for (let y = 0; y < TILE; y++) {
        for (let x = 0; x < TILE; x++) {
          const o = (y * TILE + x) * img.bpp;
          // Terrarium 形式：標高 = (R×256 + G + B/256) − 32768
          elev[(j * TILE + y) * W + i * TILE + x] = img.data[o] * 256 + img.data[o + 1] + img.data[o + 2] / 256 - 32768;
        }
      }
    }
  }
  // 細かいでこぼこを均す（3×3 の平均を2回）
  const blur = (src) => {
    const out = new Float32Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let sum = 0, n = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < W && yy < H) (sum += src[yy * W + xx]), n++;
        }
        out[y * W + x] = sum / n;
      }
    }
    return out;
  };
  const smooth = blur(blur(elev));
  // 格子の角（px, py）→ 経度・緯度（ウェブメルカトルのタイル座標から）
  const N = TILE * 2 ** Z;
  const cornerLonLat = (px, py) => {
    const gx = xs[0] * TILE + px, gy = ys[0] * TILE + py;
    return [(gx / N) * 360 - 180, (Math.atan(Math.sinh(Math.PI * (1 - (2 * gy) / N))) * 180) / Math.PI];
  };
  const chaikin = (pts, n) => {
    for (let k = 0; k < n; k++) {
      const out = [];
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i], q = pts[(i + 1) % pts.length];
        out.push([p[0] * 0.75 + q[0] * 0.25, p[1] * 0.75 + q[1] * 0.25], [p[0] * 0.25 + q[0] * 0.75, p[1] * 0.25 + q[1] * 0.75]);
      }
      pts = out;
    }
    return pts;
  };
  for (const level of LEVELS) {
    const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H && smooth[y * W + x] >= level;
    // 内側を右手に見る向きで、境の辺を有向の辺として集める（角の番号 = y×(W+1)+x）
    const from = [], to = [];
    const V = (x, y) => y * (W + 1) + x;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!inside(x, y)) continue;
        if (!inside(x, y - 1)) from.push(V(x, y)), to.push(V(x + 1, y));
        if (!inside(x + 1, y)) from.push(V(x + 1, y)), to.push(V(x + 1, y + 1));
        if (!inside(x, y + 1)) from.push(V(x + 1, y + 1)), to.push(V(x, y + 1));
        if (!inside(x - 1, y)) from.push(V(x, y + 1)), to.push(V(x, y));
      }
    }
    const out = new Map();
    from.forEach((a, i) => (out.get(a) || out.set(a, []).get(a)).push(i));
    const used = new Uint8Array(from.length);
    const rings = [];
    for (let i = 0; i < from.length; i++) {
      if (used[i]) continue;
      const ring = [];
      let e = i;
      while (e !== undefined && !used[e]) {
        used[e] = 1;
        ring.push(from[e]);
        e = (out.get(to[e]) || []).find((k) => !used[k]);
      }
      if (ring.length > 8) rings.push(ring);
    }
    const ds = [];
    for (const ring of rings) {
      const pts = ring.map((v) => proj(cornerLonLat(v % (W + 1), Math.floor(v / (W + 1)))));
      const sm = simplifyRing(chaikin(pts, 2), 0.35);
      if (sm.length < 4 || area(sm) < 3 || !visible(sm, 0)) continue;
      ds.push(pathClosed(sm));
    }
    mountains.push({ level, d: ds.join('') });
  }
  demSource = '／山地：Terrain Tiles（Mapzen・AWS Open Data。SRTM・GMTED2010 は U.S. Geological Survey、ETOPO1 は NOAA 提供）の標高を加工';
}

// PNG（8bit・インターレースなし）を読む。標高タイルを読むためだけの小さな読み込み器
function readPng(buf) {
  let p = 8, w = 0, h = 0, bpp = 0;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8), body = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') {
      w = body.readUInt32BE(0);
      h = body.readUInt32BE(4);
      bpp = { 2: 3, 6: 4 }[body[9]];
      if (body[8] !== 8 || !bpp || body[12]) throw new Error('対応していない PNG です（8bit の RGB／RGBA・インターレースなしのみ）');
    } else if (type === 'IDAT') idat.push(body);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * bpp, data = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)], src = y * (stride + 1) + 1, dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? data[dst + x - bpp] : 0, b = y ? data[dst - stride + x] : 0, c = y && x >= bpp ? data[dst - stride + x - bpp] : 0;
      let v = raw[src + x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      data[dst + x] = v & 255;
    }
  }
  return { w, h, bpp, data };
}

// ---------- 駅と路線 ----------
const allStations = JSON.parse(readFileSync(join(sdDir, 'station.json'), 'utf8'));
const lines = JSON.parse(readFileSync(join(sdDir, 'line.json'), 'utf8'));
// 九州の駅名で引く（「長崎(長崎)」のような括弧つきの名前も「長崎」で見つかるように）
function station(name, line) {
  const hit = allStations.filter((s) => !s.closed && (s.name === name || s.name.startsWith(name + '(')) && s.prefecture >= 35 && s.prefecture <= 46 && (!line || s.lines.includes(line)));
  if (!hit.length) throw new Error(`駅が見つかりません: ${name}${line ? `（路線 ${line}）` : ''}`);
  return [hit[0].lng, hit[0].lat];
}
const polyCache = new Map();
function polylines(code) {
  if (!polyCache.has(code)) {
    const fc = JSON.parse(readFileSync(join(sdDir, 'polyline', `${code}.json`), 'utf8'));
    polyCache.set(code, fc.features.map((f) => f.geometry.coordinates));
  }
  return polyCache.get(code);
}

// 指定した路線の線形をグラフにして、2駅のあいだの最短の線路をたどる（ダイクストラ）
function railBetween(codes, from, to) {
  const key = (p) => `${p[0].toFixed(5)},${p[1].toFixed(5)}`;
  const nodes = new Map(); // key -> [lon, lat]
  const adj = new Map();
  const link = (a, b) => {
    const d = Math.hypot((a[0] - b[0]) * COS, a[1] - b[1]);
    const ka = key(a), kb = key(b);
    nodes.set(ka, a);
    nodes.set(kb, b);
    (adj.get(ka) || adj.set(ka, []).get(ka)).push([kb, d]);
    (adj.get(kb) || adj.set(kb, []).get(kb)).push([ka, d]);
  };
  for (const c of codes) for (const ls of polylines(c)) for (let i = 0; i < ls.length - 1; i++) link(ls[i], ls[i + 1]);
  // 路線どうしの継ぎ目：別々の線形の端点が約150m以内なら、つながっているとみなす
  const ends = [...nodes.entries()].filter(([k]) => adj.get(k).length === 1);
  for (const [ka, a] of ends) {
    for (const [kb, b] of nodes) {
      if (ka !== kb && Math.hypot((a[0] - b[0]) * COS, a[1] - b[1]) < 0.0015) link(a, b);
    }
  }
  const nearest = (p) => {
    let best = null, bd = Infinity;
    for (const [k, q] of nodes) {
      const d = Math.hypot((p[0] - q[0]) * COS, p[1] - q[1]);
      if (d < bd) (bd = d), (best = k);
    }
    return best;
  };
  const s = nearest(from), t = nearest(to);
  const dist = new Map([[s, 0]]), prev = new Map();
  const done = new Set();
  const queue = [[0, s]];
  while (queue.length) {
    queue.sort((x, y) => x[0] - y[0]);
    const [d, k] = queue.shift();
    if (done.has(k)) continue;
    done.add(k);
    if (k === t) break;
    for (const [n, w] of adj.get(k)) {
      const nd = d + w;
      if (nd < (dist.get(n) ?? Infinity)) {
        dist.set(n, nd);
        prev.set(n, k);
        queue.push([nd, n]);
      }
    }
  }
  if (!done.has(t)) throw new Error(`線路がつながりません: 路線 ${codes.join(',')}`);
  const out = [];
  for (let k = t; k; k = prev.get(k)) out.unshift(nodes.get(k));
  return [from, ...out, to];
}

// 旅のマスの実際の位置（[経度, 緯度]）。鉄道駅は駅データから、それ以外は代表地点を書く。
const PLACES = {
  hakata: station('博多', 11902),
  mojiko: station('門司港'),
  karatsu: station('唐津', 11921),
  'ureshino-onsen': station('嬉野温泉'),
  nagasaki: station('長崎', 1012),
  'huis-ten-bosch': station('ハウステンボス'),
  aso: station('阿蘇', 11923),
  'kurokawa-onsen': [131.1405, 33.0757], // 黒川温泉バス停付近（温泉街の中心）
  beppu: station('別府', 11906),
  yufuin: station('由布院'),
  miyazaki: station('宮崎', 11907),
  takachiho: [131.3076, 32.7119], // 高千穂町の中心（旧 高千穂駅付近）
  'kagoshima-chuo': station('鹿児島中央'),
  ibusuki: station('指宿'),
  yakushima: [130.5715, 30.4255], // 宮之浦港
};

// 経由駅：すごろくのマスではないが、路線がどこを通っているかの目印として小さく描く駅（実際の駅の位置）
const WAYPOINTS = ['小倉', '行橋', '中津', '鳥栖', '久留米', '日田', '佐賀', '早岐', '諫早', '熊本', '立野', '大分', '延岡', '都城', '川内'].map((name) => {
  const [lng, lat] = station(name);
  const [x, y] = proj([lng, lat]);
  return { name, x: r1(x), y: r1(y) };
});

// 区間の線形。鉄道は [路線コード, 発駅, 着駅] を順につなぎ、バス・航路は通る地点（経度緯度）で曲線にする。
const LEGS = {
  'hakata|mojiko': [[[11902], '博多', '門司港']],
  'hakata|karatsu': [[[99905], '博多', '姪浜'], [[11909], '姪浜', '唐津']],
  'hakata|ureshino-onsen': [[[11903], '博多', '鳥栖'], [[11905], '鳥栖', '江北'], [[11918], '江北', '武雄温泉'], [[1012], '武雄温泉', '嬉野温泉']],
  'nagasaki|ureshino-onsen': [[[1012], '嬉野温泉', '長崎']],
  'hakata|kagoshima-chuo': [[[1010], '博多', '鹿児島中央']],
  'aso|hakata': [[[11903], '博多', '熊本'], [[11923], '熊本', '阿蘇']],
  'hakata|yufuin': [[[11903], '博多', '久留米'], [[11913], '久留米', '由布院']],
  'huis-ten-bosch|karatsu': [[[11921], '唐津', '山本'], [[11920], '山本', '伊万里'], [[99911], '伊万里', '佐世保'], [[11918], '佐世保', '早岐'], [[11922], '早岐', 'ハウステンボス']],
  'huis-ten-bosch|ureshino-onsen': [[[1012], '嬉野温泉', '武雄温泉'], [[11918], '武雄温泉', '早岐'], [[11922], '早岐', 'ハウステンボス']],
  'huis-ten-bosch|nagasaki': [[[11922], 'ハウステンボス', '諫早'], [[11905], '諫早', '長崎']],
  'beppu|mojiko': [[[11906], '門司港', '別府']],
  'beppu|yufuin': [[[11906], '別府', '大分'], [[11913], '大分', '由布院']],
  'aso|beppu': [[[11923], '阿蘇', '大分'], [[11906], '大分', '別府']],
  'beppu|miyazaki': [[[11906], '別府', '佐伯'], [[11907], '佐伯', '宮崎']],
  'kagoshima-chuo|miyazaki': [[[11907], '宮崎', '鹿児島中央']],
  'ibusuki|kagoshima-chuo': [[[11930], '鹿児島中央', '指宿']],
  // バス：道路のデータは使わないので、実際の経路が通る地点を結ぶゆるやかな曲線にする
  'aso|kurokawa-onsen': [{ via: [[131.1, 33.0]] }],
  'kurokawa-onsen|yufuin': [{ via: [[131.24, 33.12], [131.3, 33.22]] }],
  'aso|takachiho': [{ via: [[131.17, 32.83]] }],
  // 高千穂→延岡はバス、延岡→宮崎は日豊本線
  'miyazaki|takachiho': [{ via: [[131.45, 32.66]], to: '延岡', start: 'takachiho' }, [[11907], '延岡', '宮崎']],
  // 航路：鹿児島港から錦江湾を南へ抜け、大隅海峡を渡って宮之浦港へ（通る地点は航路のイメージ）
  'kagoshima-chuo|yakushima': [{ via: [[130.575, 31.585], [130.67, 31.38], [130.7, 31.13], [130.66, 30.86], [130.6, 30.6]], sea: true }],
  'ibusuki|yakushima': [{ via: [[130.665, 31.24], [130.67, 31.0], [130.62, 30.68]], sea: true }],
};

// 曲線の通過点を、Catmull-Rom で細かい点列にする（列車がなめらかに走れるように）
function spline(pts, steps = 10) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let s = 0; s < steps; s++) {
      const t = s / steps, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map((j) => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

const dist = (p, q) => Math.hypot((p[0] - q[0]) * COS, p[1] - q[1]);
const ids = Object.keys(PLACES);
const XY = Object.fromEntries(ids.map((id) => [id, proj(PLACES[id])]));
const edgeKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const routes = {};
const routeTracks = {};
for (const s of data.stations) {
  for (const c of s.connections) {
    const k = edgeKey(s.id, c);
    if (routes[k]) continue;
    const legs = LEGS[k];
    if (!legs) throw new Error(`区間の線形が未定義です: ${k}`);
    const [a, b] = k.split('|');
    // 線形は書いた向き（start → end）で組み立て、最後にキーの向き（a → b）へそろえる
    const first = legs[0];
    const start = Array.isArray(first)
      ? ([a, b].sort((x, y) => dist(PLACES[x], station(first[1], first[0][0])) - dist(PLACES[y], station(first[1], first[0][0])))[0])
      : first.start || a;
    const end = start === a ? b : a;
    let pts = [XY[start]];
    for (const leg of legs) {
      if (Array.isArray(leg)) {
        const [codes, from, to] = leg;
        const lonlat = railBetween(codes, station(from, codes[0]), station(to, codes[codes.length - 1]));
        pts.push(...lonlat.map(proj));
        // 検証用：駅の点を除いた、線路そのものの点列
        (routeTracks[k] ||= []).push(lonlat.slice(1, -1).map(proj));
      } else {
        const endXY = leg.to ? proj(station(leg.to)) : XY[end];
        const ctrl = [pts[pts.length - 1], ...leg.via.map(proj), endXY];
        pts.push(...spline(ctrl).slice(1));
      }
    }
    pts.push(XY[end]);
    if (start !== a) pts.reverse();
    // 駅の点に線の端をそろえ、見た目が変わらない範囲で間引く
    pts = simplify(pts.filter((p, i) => i === 0 || Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) > 0.05), 0.25);
    routes[k] = pathOpen(pts);
  }
}

// 線路網（盤面の下地）：JR九州の路線をそのまま細く描き、すごろくの路線はその上に重ねる。
// n02/ に国土数値情報「鉄道（N02）」の RailroadSection があればそれを、無ければ station_database の線形
// （N02 を加工したもの）を使う。どちらも運営会社が JR九州の区間だけ。
const network = [];
const n02Dir = join(dataDir, 'n02');
const n02Files = existsSync(n02Dir) ? readdirSync(n02Dir).filter((f) => /RailroadSection.*\.geojson$/i.test(f)) : [];
let networkSource;
if (n02Files.length) {
  // N02 の属性：N02_002 事業者種別（1=JR新幹線, 2=JR在来線）、N02_003 路線名、N02_004 運営会社
  for (const file of n02Files) {
    const fc = JSON.parse(readFileSync(join(n02Dir, file), 'utf8'));
    for (const f of fc.features) {
      const pr = f.properties || {};
      if (pr.N02_004 !== '九州旅客鉄道' || !f.geometry) continue;
      const parts = f.geometry.type === 'MultiLineString' ? f.geometry.coordinates : [f.geometry.coordinates];
      for (const ls of parts) {
        const pts = simplify(ls.map(proj), 0.4);
        if (pts.length > 1 && visible(pts, 0)) network.push({ d: pathOpen(pts), shin: String(pr.N02_002) === '1' || undefined, pts });
      }
    }
  }
  networkSource = '国土数値情報「鉄道（N02）」';
} else {
  const JR_KYUSHU = 6; // station_database の company_code
  for (const l of lines) {
    if (l.closed || l.company_code !== JR_KYUSHU) continue;
    for (const ls of polylines(l.code)) {
      const pts = simplify(ls.map(proj), 0.4);
      if (pts.length > 1 && visible(pts, 0)) network.push({ d: pathOpen(pts), shin: l.code < 2000 || undefined, pts });
    }
  }
  networkSource = 'station_database の線形（国土数値情報「鉄道（N02）」を加工したもの）';
}

// ---------- 検証：駅が線路の上にあるか ----------
// 鉄道の駅は、(1) 下地の JR 線路網からの距離、(2) その駅から出る区間の線路（駅の点そのものを除く）からの距離 を測る。
// 盤面1単位 ≒ 0.45km。1単位を超えると、画面で駅が線路から浮いて見えはじめる。
const segDist = ([px, py], [ax, ay], [bx, by]) => {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1e-9;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
  return Math.hypot(ax + t * dx - px, ay + t * dy - py);
};
const nearestOn = (p, polys) => {
  let best = Infinity;
  for (const pts of polys) for (let i = 0; i < pts.length - 1; i++) best = Math.min(best, segDist(p, pts[i], pts[i + 1]));
  return best;
};
const NOT_RAIL = new Set(['kurokawa-onsen', 'takachiho', 'yakushima']); // バス停・旧駅・港（旅のマス）
const check = [];
for (const s of data.stations) {
  if (NOT_RAIL.has(s.id)) continue;
  const p = XY[s.id];
  const toNet = nearestOn(p, network.map((n) => n.pts));
  // この駅から出る鉄道の区間の線路のうち、いちばん近いもの（駅は線路の上にあるはず）
  const tracks = s.connections.flatMap((c) => routeTracks[edgeKey(s.id, c)] || []);
  const toLeg = tracks.length ? nearestOn(p, tracks) : 0;
  check.push({ name: s.name, toNet, toLeg });
}
// 経由駅も、線路網の上にあるかを測る
for (const w of WAYPOINTS) check.push({ name: `${w.name}（経由駅）`, toNet: nearestOn([w.x, w.y], network.map((n) => n.pts)), toLeg: 0 });
network.forEach((n) => delete n.pts);
const LIMIT = 1.0;
const bad = check.filter((c) => c.toNet > LIMIT || c.toLeg > LIMIT);

const geo = {
  source: `海岸線・県境：国土数値情報「行政区域（N03）」（国土交通省）を加工${demSource}／線路：${networkSource}／駅の位置：station_database（CC BY 4.0、駅データ.jp 由来）`,
  // map.js の latLngToSvg が同じ式を使う：x = cx + (lng - lng0)·cos·k、y = top + (north - lat)·k
  proj: { bounds: BOUNDS, lat0: LAT0, lng0: LNG0, cos: +COS.toFixed(6), k: +K.toFixed(4), cx: CX, top: +TOP.toFixed(3) },
  land,
  tint,
  borders,
  neighbor,
  mountains,
  network,
  routes,
  waypoints: WAYPOINTS,
};
const js = `// 自動生成：node tools/build-geo.mjs で作る。手で編集しない。\n// ${geo.source}\nwindow.YOKATABI_GEO = ${JSON.stringify(geo)};\n`;
writeFileSync(resolve(root, 'js/geo.js'), js);

// stations.json の x / y を実際の位置に更新する。
// 手で整えた書式を崩さないよう、JSON を書き直さずに各駅の "x" と "y" の数字だけを置き換える。
let text = readFileSync(stationsPath, 'utf8');
for (const s of data.stations) {
  const p = XY[s.id];
  if (!p) throw new Error(`位置が未定義の駅: ${s.id}`);
  s.x = r1(p[0]);
  s.y = r1(p[1]);
  const at = text.indexOf(`"id": "${s.id}"`);
  const re = /"x":\s*-?[\d.]+(,\s*)"y":\s*-?[\d.]+/g;
  re.lastIndex = at;
  const m = re.exec(text);
  if (at < 0 || !m) throw new Error(`stations.json で ${s.id} の x / y が見つかりません`);
  text = text.slice(0, m.index) + `"x": ${s.x}${m[1]}"y": ${s.y}` + text.slice(m.index + m[0].length);
}
JSON.parse(text); // 置き換えで壊れていないことを確かめる
writeFileSync(stationsPath, text);

console.log(`js/geo.js: 陸地 ${land.length}・県境 ${borders.length}・山地 ${mountains.map((m) => `${m.level}m ${(m.d.length / 1024).toFixed(0)}KB`).join('・')}・線路網 ${network.length}・区間 ${Object.keys(routes).length}・経由駅 ${WAYPOINTS.length}（${(js.length / 1024).toFixed(0)}KB）`);
console.log('倍率', K.toFixed(2), '（盤面1単位 ≒', (111.32 / K).toFixed(2), 'km）');
console.log('出典:', geo.source);
console.log('駅と線路の距離（盤面単位・1≒0.45km）：駅\t線路網まで\t区間の線路まで');
for (const c of check) console.log(`  ${c.name}\t${c.toNet.toFixed(2)}\t${c.toLeg.toFixed(2)}`);
if (bad.length) {
  console.error(`線路から ${LIMIT} 単位以上離れている駅があります: ${bad.map((c) => c.name).join('、')}`);
  process.exit(1);
}
