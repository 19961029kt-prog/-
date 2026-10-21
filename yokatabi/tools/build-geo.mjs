#!/usr/bin/env node
// 実在の地理データから、盤面の地図（海岸線・県境・線路網・区間の線形）と駅の座標を作る。
// 手描きの近似ではなく、九州の形と線路の位置を実際の地図に合わせるためのツール。
//
//   node tools/build-geo.mjs <データのフォルダ>
//
// データのフォルダには次の2つを置く（どちらも公開データ。リポジトリには入れない）。
//   japan.geojson … 都道府県の形（dataofjapan/land。国土数値情報 行政区域データを加工したもの）
//                   https://raw.githubusercontent.com/dataofjapan/land/master/japan.geojson
//   sd/json/      … 駅と路線の線形（Seo-4d696b75/station_database、CC BY 4.0）
//                   https://raw.githubusercontent.com/Seo-4d696b75/station_database/main/out/extra/json.zip を展開
//
// 出力：
//   js/geo.js       … window.YOKATABI_GEO（投影の定数・陸地・県境・線路網・区間ごとの線形）
//   stations.json   … 各駅の x / y を実際の位置に書き換える（ほかの項目には触れない）
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = resolve(process.argv[2] || '');
if (!process.argv[2] || !existsSync(join(dataDir, 'japan.geojson'))) {
  console.error('使い方: node tools/build-geo.mjs <japan.geojson と sd/json を置いたフォルダ>');
  process.exit(1);
}
const sdDir = join(dataDir, 'sd/json');
const stationsPath = resolve(root, 'stations.json');
const data = JSON.parse(readFileSync(stationsPath, 'utf8'));
const [VX, VY, VW, VH] = data.meta.viewBox;

// ---------- 投影 ----------
// 九州の広さなら、中央の緯度で経度を縮める正距円筒図法で、見た目の歪みはほぼ出ない。
// 本土（平戸〜佐伯、佐多岬〜門司）が盤面いっぱいに入るよう倍率と原点を決める。
const LAT0 = 32.5;
const COS = Math.cos((LAT0 * Math.PI) / 180);
const BOX = { west: 129.47, east: 132.1, south: 30.97, north: 34.0 };
const K = Math.min((VW - 8) / ((BOX.east - BOX.west) * COS), (VH - 60) / (BOX.north - BOX.south));
const OX = VX + (VW - (BOX.east - BOX.west) * COS * K) / 2 - BOX.west * COS * K;
const OY = VY + 34 + BOX.north * K;
const proj = ([lon, lat]) => [lon * COS * K + OX, OY - lat * K];

// 屋久島は本土から約60km南にあり、そのままでは盤面からはみ出す。
// 縮尺はそのままに、薩摩半島の西の海（盤面の左下）へ位置だけずらして置く。
const YAKU_BOX = { west: 130.3, east: 130.75, south: 30.2, north: 30.5 };
const inYaku = ([lon, lat]) => lon > YAKU_BOX.west && lon < YAKU_BOX.east && lat > YAKU_BOX.south && lat < YAKU_BOX.north;
const yakuCenter = proj([130.53, 30.35]);
const YAKU_TARGET = [VX + 70, VY + VH - 62];
const YAKU_SHIFT = [YAKU_TARGET[0] - yakuCenter[0], YAKU_TARGET[1] - yakuCenter[1]];
const projAny = (p) => {
  const q = proj(p);
  return inYaku(p) ? [q[0] + YAKU_SHIFT[0], q[1] + YAKU_SHIFT[1]] : q;
};

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
  return lines.map((keys) => keys.map((k) => k.split(',').map(Number)));
}

// ---------- 陸地と県境 ----------
const japan = JSON.parse(readFileSync(join(dataDir, 'japan.geojson'), 'utf8'));
const ringsOf = (f) => (f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates.flat() : f.geometry.coordinates);
const KYUSHU = new Set([40, 41, 42, 43, 44, 45, 46]);
const NEIGHBOR = new Set([35, 38]); // 山口県・愛媛県（盤面のふちに見える対岸）

// 九州7県の輪を線分に分け、2県が共有する線分を県境とする
const segCount = new Map();
for (const f of japan.features) {
  if (!KYUSHU.has(f.properties.id)) continue;
  for (const ring of ringsOf(f)) {
    for (let i = 0; i < ring.length - 1; i++) {
      const a = ring[i].join(','), b = ring[i + 1].join(',');
      if (a === b) continue;
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      const s = segCount.get(key) || { a, b, n: 0 };
      s.n++;
      segCount.set(key, s);
    }
  }
}
const borderSegs = [];
for (const s of segCount.values()) if (s.n === 2) borderSegs.push({ a: s.a, b: s.b });

// 陸地は県ごとの輪をそのまま塗る（隣り合う県の輪を重ねて塗れば、全体で九州の形になる）。
// 海岸線は、輪のふちを太く描いた上に塗りを重ね、外側にはみ出した半分だけを見せる（CSS 側）。
const PREF_NAME = { 40: '福岡', 41: '佐賀', 42: '長崎', 43: '熊本', 44: '大分', 45: '宮崎', 46: '鹿児島' };
const land = [];
for (const f of japan.features) {
  const id = f.properties.id;
  if (!KYUSHU.has(id)) continue;
  for (const ring of ringsOf(f)) {
    const pts = simplifyRing(ring.map(projAny), 0.3);
    if (pts.length < 3 || area(pts) < 1.2 || !visible(pts)) continue;
    land.push({ d: pathClosed(pts), pref: PREF_NAME[id], yaku: inYaku(ring[0]) || undefined, area: Math.round(area(pts)) });
  }
}
land.sort((a, b) => b.area - a.area);
land.forEach((l) => delete l.area);

const borders = chain(borderSegs)
  .map((lonlat) => simplify(lonlat.map(proj), 0.5))
  .filter((pts) => pts.length > 1 && visible(pts, 0))
  .map(pathOpen);

const neighbor = [];
for (const f of japan.features) {
  if (!NEIGHBOR.has(f.properties.id)) continue;
  for (const ring of ringsOf(f)) {
    const pts = simplifyRing(ring.map(proj), 0.5);
    if (pts.length < 3 || area(pts) < 2 || !visible(pts, 40)) continue;
    neighbor.push(pathClosed(pts));
  }
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
  // 航路：錦江湾を南へ抜けて屋久島（ずらして置いた位置）へ
  'kagoshima-chuo|yakushima': [{ via: [[130.57, 31.58], [130.66, 31.3], [130.66, 31.08], [130.45, 30.95]], sea: true }],
  'ibusuki|yakushima': [{ via: [[130.66, 31.2], [130.5, 31.0]], sea: true }],
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
const XY = Object.fromEntries(ids.map((id) => [id, projAny(PLACES[id])]));
const edgeKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const routes = {};
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

// 線路網（盤面の下地）：九州の鉄道をすべて薄く描き、本物の地図らしさを出す。路面電車・地下鉄は省く。
const SKIP = /地下鉄|電軌|市電|七隈|箱崎|空港線|北九州高速/;
const network = [];
for (const l of lines) {
  if (l.closed || SKIP.test(l.name)) continue;
  const file = join(sdDir, 'line', `${l.code}.json`);
  if (!existsSync(file)) continue;
  const st = JSON.parse(readFileSync(file, 'utf8')).station_list || [];
  if (!st.some((s) => s.prefecture >= 40 && s.prefecture <= 46)) continue;
  for (const ls of polylines(l.code)) {
    const pts = simplify(ls.map(proj), 0.4);
    if (pts.length > 1 && visible(pts, 0)) network.push({ d: pathOpen(pts), shin: l.code < 2000 || undefined });
  }
}

const geo = {
  source: '地形：国土数値情報（行政区域）を加工した dataofjapan/land／線路・駅：station_database（CC BY 4.0）',
  proj: { lat0: LAT0, cos: +COS.toFixed(6), k: +K.toFixed(4), ox: +OX.toFixed(3), oy: +OY.toFixed(3) },
  yaku: { box: YAKU_BOX, shift: YAKU_SHIFT.map(r1) },
  land,
  borders,
  neighbor,
  network,
  routes,
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

console.log(`js/geo.js: 陸地 ${land.length}・県境 ${borders.length}・線路網 ${network.length}・区間 ${Object.keys(routes).length}（${(js.length / 1024).toFixed(0)}KB）`);
console.log('倍率', K.toFixed(2), '（盤面1単位 ≒', (111.32 / K).toFixed(2), 'km）');
for (const s of data.stations) console.log(`  ${s.name}\t${s.x}\t${s.y}`);
