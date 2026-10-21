// インラインSVGの九州すごろく盤：海（水彩・経緯線・コンパス・船）・陸・山地・県境・県名・線路・駅・SVG列車。
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
    ['福岡県', 33.6, 130.82], ['佐賀県', 33.33, 130.05], ['長崎県', 32.87, 129.76], ['熊本県', 32.6, 130.82],
    ['大分県', 33.57, 131.6], ['宮崎県', 32.06, 131.17], ['鹿児島県', 31.43, 130.37],
  ];
  // 海の名前 [名前, 緯度, 経度, 小さい字か]
  const SEAS = [
    ['玄 界 灘', 33.92, 129.95], ['周 防 灘', 33.86, 131.38], ['日 向 灘', 32.0, 131.85], ['東 シ ナ 海', 31.9, 129.55],
    ['有明海', 33.02, 130.33, 1], ['大村湾', 32.97, 129.86, 1], ['八代海', 32.32, 130.38, 1], ['豊後水道', 33.08, 132.05, 1],
    ['錦江湾', 31.4, 130.69, 1], ['大隅海峡', 30.85, 130.85, 1], ['太 平 洋', 30.75, 131.75],
  ];
  // 山の名前と小さな山のしるし [名前, 緯度, 経度]
  const PEAKS = [
    ['阿蘇山', 32.88, 131.1], ['くじゅう連山', 33.1, 131.25], ['雲仙岳', 32.76, 130.29], ['霧島山', 31.93, 130.87],
    ['祖母山', 32.83, 131.35], ['英彦山', 33.48, 130.93], ['開聞岳', 31.18, 130.53], ['宮之浦岳', 30.34, 130.5],
    ['桜島', 31.58, 130.66], ['市房山', 32.31, 131.1],
  ];
  // 経由駅の名前を出さないもの（すごろくの駅のすぐそばで、名前が重なる）
  const WAYPOINT_QUIET = new Set(['早岐', '大分', '隼人']);

  function el(name, attrs = {}, parent) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  const f1 = (v) => (Math.round(v * 10) / 10).toString();

  let D, svg, layers, handlers;
  const nodes = {}; // id -> <g>
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

  function buildDefs() {
    const defs = el('defs', {}, svg);
    defs.innerHTML = `
      <linearGradient id="g-sea" x1="0" y1="0" x2=".3" y2="1">
        <stop offset="0" stop-color="#d8eceb"/><stop offset=".55" stop-color="#cbe6e4"/><stop offset="1" stop-color="#bfe0df"/>
      </linearGradient>
      <filter id="f-watercolor" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency=".006 .009" numOctaves="3" seed="4" result="n"/>
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 .55  0 0 0 0 .78  0 0 0 0 .8  0 0 0 1.1 -.42"/>
      </filter>
      <filter id="f-paper" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="3" seed="11" result="n"/>
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 .45  0 0 0 0 .36  0 0 0 0 .22  0 0 0 .45 0"/>
      </filter>
      <filter id="f-land" x="-5%" y="-5%" width="110%" height="110%">
        <feDropShadow dx="0" dy="2.5" stdDeviation="3" flood-color="#7a6449" flood-opacity=".22"/>
      </filter>
      <pattern id="p-wave" width="60" height="30" patternUnits="userSpaceOnUse">
        <path d="M2 20 Q9 15 16 20 T30 20" fill="none" stroke="#ffffff" stroke-opacity=".5" stroke-width="1.1" stroke-linecap="round"/>
        <path d="M34 7 Q41 2 48 7" fill="none" stroke="#8dbcbd" stroke-opacity=".35" stroke-width="1" stroke-linecap="round"/>
      </pattern>
      <radialGradient id="g-seal" cx=".38" cy=".32" r=".8">
        <stop offset="0" stop-color="#f3d58c"/><stop offset=".6" stop-color="#d49a35"/><stop offset="1" stop-color="#a8772a"/>
      </radialGradient>`;
  }

  // 盤面：海（水彩・波・経緯線）→ 船とコンパス → 対岸 → 浅瀬 → 陸地（影つき）→ 県のうす色・山地・和紙の質感 →
  //       海岸線・県境の破線 → 実在の線路網 → 山の名前・海の名前（経由駅と県名は、線路の上の別の層）
  function buildBoard() {
    const [vx, vy, vw, vh] = D.meta.viewBox;
    const sea = { x: vx - vw, y: vy - vh, width: vw * 3, height: vh * 3 };
    el('rect', { ...sea, fill: 'url(#g-sea)' }, layers.bg);
    el('rect', { ...sea, filter: 'url(#f-watercolor)', class: 'sea-wash' }, layers.bg);
    el('rect', { ...sea, fill: 'url(#p-wave)' }, layers.bg);
    buildGraticule();
    buildShips();
    if (!GEO) return;

    const defs = svg.querySelector('defs');
    const clip = el('clipPath', { id: 'c-land' }, defs);
    GEO.land.forEach((d) => el('path', { d }, clip));
    const coast = GEO.land.join('');

    GEO.neighbor.forEach((d) => el('path', { d, class: 'land-neighbor' }, layers.bg));
    const shore = el('g', { class: 'shore' }, layers.bg);
    el('path', { d: coast, class: 'shore-far' }, shore);
    el('path', { d: coast, class: 'shore-near' }, shore);
    el('path', { d: coast, class: 'land', filter: 'url(#f-land)' }, layers.bg);

    const inner = el('g', { 'clip-path': 'url(#c-land)' }, layers.bg);
    (GEO.tint || []).forEach((l) => {
      const color = (D.meta.prefectures[l.pref] || {}).color;
      if (color) el('path', { d: l.d, class: 'land-tint', style: `--pref:${color}` }, inner);
    });
    (GEO.mountains || []).forEach((m, i) => el('path', { d: m.d, class: `mount mount-${i}`, 'fill-rule': 'evenodd' }, inner));
    el('rect', { x: vx, y: vy, width: vw, height: vh, filter: 'url(#f-paper)', class: 'land-texture' }, inner);
    el('path', { d: coast, class: 'coast' }, layers.bg);
    GEO.borders.forEach((d) => el('path', { d, class: 'pref-border' }, layers.bg));

    const net = el('g', { class: 'rail-network', 'aria-hidden': 'true' }, layers.bg);
    el('path', { d: GEO.network.filter((n) => !n.shin).map((n) => n.d).join(' '), class: 'net-line' }, net);
    el('path', { d: GEO.network.filter((n) => n.shin).map((n) => n.d).join(' '), class: 'net-line net-shin' }, net);

    PEAKS.forEach(([name, lat, lng]) => {
      const [x, y] = latLngToSvg(lat, lng);
      const g = el('g', { class: 'peak', transform: `translate(${f1(x)} ${f1(y)})` }, layers.bg);
      el('path', { d: 'M-7,3 L-1.5,-5 L1,-2 L3,-4.5 L8,3 Z', class: 'peak-mark' }, g);
      el('text', { y: 14, 'text-anchor': 'middle', class: 'peak-label' }, g).textContent = name;
    });
    // 桜島の噴煙
    const [sx, sy] = latLngToSvg(31.585, 130.66);
    const smoke = el('g', { class: 'smoke', transform: `translate(${f1(sx)} ${f1(sy - 6)})` }, layers.bg);
    [0, 1, 2].forEach((i) => el('circle', { r: 3 + i, style: `--i:${i}` }, smoke));

    SEAS.forEach(([name, lat, lng, small]) => {
      const [x, y] = latLngToSvg(lat, lng);
      el('text', { x: f1(x), y: f1(y), 'text-anchor': 'middle', class: small ? 'sea-label sea-label-sm' : 'sea-label' }, layers.bg).textContent = name;
    });
  }

  // 細い経緯線（0.5度ごと。1度ごとは少し濃く）と、盤面のふちの度数、コンパス
  function buildGraticule() {
    const g = el('g', { class: 'graticule', 'aria-hidden': 'true' }, layers.bg);
    const [vx, vy, vw, vh] = D.meta.viewBox;
    for (let lat = 30; lat <= 34.5; lat += 0.5) {
      const [, y] = latLngToSvg(lat, 130);
      if (y < vy - 5 || y > vy + vh + 5) continue;
      el('line', { x1: vx - vw, x2: vx + vw * 2, y1: f1(y), y2: f1(y), class: lat % 1 ? 'grat' : 'grat grat-major' }, g);
      if (lat % 1 === 0) el('text', { x: vx + 132, y: f1(y - 4), class: 'grat-label' }, g).textContent = `北緯${lat}°`;
    }
    for (let lng = 128.5; lng <= 133; lng += 0.5) {
      const [x] = latLngToSvg(32, lng);
      el('line', { x1: f1(x), x2: f1(x), y1: vy - vh, y2: vy + vh * 2, class: lng % 1 ? 'grat' : 'grat grat-major' }, g);
      if (lng % 1 === 0 && x > vx + 20 && x < vx + vw - 20) el('text', { x: f1(x + 4), y: vy + vh - 8, class: 'grat-label' }, g).textContent = `東経${lng}°`;
    }
    const [cx, cy] = latLngToSvg(30.5, 131.68);
    const c = el('g', { class: 'compass', transform: `translate(${f1(cx)} ${f1(cy)})` }, layers.bg);
    c.innerHTML = `<circle r="34" class="compass-ring"/><circle r="27" class="compass-ring compass-ring-in"/>
      ${Array.from({ length: 16 }, (_, i) => `<line y1="-34" y2="${i % 4 ? -30 : -26}" transform="rotate(${i * 22.5})" class="compass-tick"/>`).join('')}
      <path d="M-28,0 L0,5 L28,0 L0,-5 Z" class="compass-needle compass-ew"/>
      <path d="M0,-30 L6,0 L0,30 L-6,0 Z" class="compass-needle"/><path d="M0,-30 L6,0 L-6,0 Z" class="compass-north"/>
      <circle r="3" class="compass-pin"/><text y="-40" text-anchor="middle" class="compass-n">北</text>`;
  }

  // 船の線画（海の飾り）：帆船と、小さな客船
  function buildShips() {
    const ship = (lat, lng, kind, flip) => {
      const [x, y] = latLngToSvg(lat, lng);
      const g = el('g', { class: 'ship', transform: `translate(${f1(x)} ${f1(y)}) scale(${flip ? -1 : 1} 1)` }, layers.bg);
      g.innerHTML =
        kind === 'sail'
          ? '<path d="M-22,6 L22,6 L15,14 L-15,14 Z"/><path d="M-2,4 L-2,-34 M-2,-32 Q14,-16 2,4 M-4,-28 Q-20,-12 -6,4"/><path d="M-30,18 Q-20,15 -10,18 T10,18 T30,18"/>'
          : '<path d="M-26,4 L26,4 L20,13 L-22,13 Z"/><path d="M-14,4 L-14,-6 L12,-6 L12,4 M-8,-6 L-8,-12 L6,-12 L6,-6"/><path d="M-2,-12 L-2,-18"/><path d="M-34,18 Q-24,15 -14,18 T6,18 T26,18"/>';
    };
    ship(31.75, 129.38, 'sail');
    ship(32.9, 131.98, 'liner', true);
    ship(30.95, 129.95, 'liner');
  }

  // 路線種別ごとの線のつくり（下から順に重ねる）
  const ROUTE_STYLES = {
    // 新幹線：枕木の上に二重のレール。細い光ではなく、生成りの帯がゆっくり流れる
    shinkansen: ['shin-ties', 'shin-rail-out', 'shin-rail-gap', 'shin-flow'],
    // 特急幹線：ダークブラウンの線路（細かい枕木つき）
    trunk: ['trunk-ties', 'trunk-rail'],
    // ローカル線：深緑の細い線路
    local: ['local-ties', 'local-rail'],
    // 観光列車：テラコッタの線路に山吹の飾り線
    scenic: ['scenic-ties', 'scenic-rail', 'scenic-gold'],
    // 航路：浅葱の点線が海の上を流れる
    ferry: ['ferry-wake', 'ferry-line'],
    // バス：テラコッタの丸い点線
    bus: ['bus-outline', 'bus-dots'],
  };
  const ROUTE_BADGE = { scenic: '✦', ferry: '⛴', bus: '🚌' };

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
        const b = el('g', { class: `route-badge badge-${type}`, transform: `translate(${f1(m.x)} ${f1(m.y)})` }, layers.badges);
        el('circle', { r: 9 }, b);
        el('text', { y: 3.6, 'text-anchor': 'middle' }, b).textContent = ROUTE_BADGE[type];
      });
    // 経由駅：路線がどこを通っているかの目印（すごろくのマスではない）
    (GEO ? GEO.waypoints : []).forEach((w) => {
      const g = el('g', { class: 'waypoint', transform: `translate(${w.x} ${w.y})` }, layers.badges);
      el('circle', { r: 3.2 }, g);
      if (!WAYPOINT_QUIET.has(w.name)) el('text', { x: 6, y: 3.5, class: 'waypoint-label' }, g).textContent = w.name;
    });
    // 県名：線路の上・駅の下に置き、太い白フチで地図帳のように読ませる
    PREF_LABELS.forEach(([name, lat, lng]) => {
      const [x, y] = latLngToSvg(lat, lng);
      el('text', { x: f1(x), y: f1(y), 'text-anchor': 'middle', class: 'pref-label' }, layers.labels).textContent = name;
    });
  }

  const LABEL_OFFSET = {
    top: [0, -20, 'middle'],
    bottom: [0, 28, 'middle'],
    left: [-17, 5.5, 'end'],
    right: [17, 5.5, 'start'],
  };

  function buildNodes() {
    D.stations.forEach((s) => {
      const color = (D.meta.prefectures[s.prefecture] || {}).color || '#888';
      const g = el('g', {
        class: 'station',
        transform: `translate(${s.x} ${s.y})`,
        tabindex: '0',
        role: 'button',
        'data-id': s.id,
        'aria-label': `${s.name}駅（${s.prefecture}）`,
        style: `--pref:${color}`,
      }, layers.nodes);
      el('circle', { r: 24, class: 'station-hit' }, g);
      [0, 1, 2].forEach((i) => el('circle', { r: 12, class: 'station-wave', style: `--i:${i}` }, g));
      el('circle', { r: 17, class: 'station-candidate' }, g);
      // 駅のしるし：県の色のふちどりをした、生成りの丸いスタンプ台
      const token = el('g', { class: 'station-token' }, g);
      el('circle', { cy: 2, r: 11.5, class: 'station-shadow' }, token);
      el('circle', { r: 11, class: 'station-ring' }, token);
      el('circle', { r: 6.4, class: 'station-core' }, token);
      // トップオーナーの駅：山吹の封蝋のような丸い台に、金の王冠
      const seal = el('g', { class: 'station-seal' }, g);
      el('circle', { r: 12.5, fill: 'url(#g-seal)', class: 'seal-disc' }, seal);
      el('circle', { r: 9, class: 'seal-ring' }, seal);
      el('path', { d: 'M-6.5,3.5 L-6.5,-3 L-3.2,0.2 L0,-5.5 L3.2,0.2 L6.5,-3 L6.5,3.5 Z', class: 'seal-crown' }, seal);
      // 共同株主（2〜3位）：駅のしるしの右上に小さな「株」の札
      const share = el('g', { class: 'station-share', transform: 'translate(10 -10)' }, g);
      el('circle', { r: 6.5, class: 'share-disc' }, share);
      el('text', { y: 3.2, 'text-anchor': 'middle', class: 'share-char' }, share).textContent = '株';
      const [dx, dy, anchor] = LABEL_OFFSET[s.labelDir] || LABEL_OFFSET.right;
      el('text', { x: dx, y: dy, 'text-anchor': anchor, class: 'station-label' }, g).textContent = s.name;

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

  // ---------- 列車（SVG のミニチュア）----------
  // 1両目・2両目を線路の向きに回して置く。車両の絵は YT.Craft（クラフト工房で選んだもの）
  const CAR = 0.42; // 車両の絵（長さ120）の縮尺 → 盤面で約50単位
  const GAP = 54; // 1両目と2両目の中心の間隔（盤面の単位）
  const STOP = 30; // 駅の手前で止まる距離（先頭が駅のしるしにかかる位置）
  let car1, car2, carG1, carG2, fx;
  const pose = { segs: null, d: 0, running: false };

  function buildTrain() {
    fx = el('g', { class: 'train-fx', 'aria-hidden': 'true' }, layers.train);
    carG2 = el('g', { class: 'train-car train-car2', 'aria-hidden': 'true' }, layers.train);
    carG1 = el('g', { class: 'train-car train-car1', 'aria-hidden': 'true' }, layers.train);
    car2 = el('g', {}, carG2);
    car1 = el('g', {}, carG1);
    refreshTrain();
  }
  function refreshTrain() {
    const C = YT.Craft;
    car1.innerHTML = C.trainSvg();
    car2.innerHTML = C.carriageSvg();
    carG2.style.display = car2.innerHTML ? '' : 'none';
  }

  // 経路の区間をつないだ1本の道のり
  function makeSegs(path) {
    layers.trail.innerHTML = '';
    const segs = [];
    let total = 0;
    for (let i = 0; i < path.length - 1; i++) {
      const p = el('path', { d: segmentD(path[i], path[i + 1]), class: 'trail-line' }, layers.trail);
      const len = p.getTotalLength();
      segs.push({ p, len, start: total, to: path[i + 1] });
      total += len;
    }
    segs.total = total;
    return segs;
  }
  // 道のりの距離 d の点と向き。d が範囲の外なら、端の向きにまっすぐ延ばす（2両目が出発駅の手前にいるとき）
  function pointAt(segs, d) {
    const clamp = Math.max(0, Math.min(segs.total, d));
    const seg = segs.find((s) => clamp <= s.start + s.len) || segs[segs.length - 1];
    const local = Math.max(0, Math.min(seg.len, clamp - seg.start));
    const a = seg.p.getPointAtLength(Math.max(0, local - 2));
    const b = seg.p.getPointAtLength(Math.min(seg.len, local + 2));
    const pt = seg.p.getPointAtLength(local);
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    const over = d - clamp;
    return { x: pt.x + Math.cos(ang) * over, y: pt.y + Math.sin(ang) * over, ang };
  }
  // 車両を置く：左へ向かうときは絵を裏返して、上下さかさまにならないようにする。返り値は向き（1 右 / −1 左）
  function placeCar(g, p, sway = 0, bob = 0) {
    let deg = (p.ang * 180) / Math.PI;
    const left = Math.abs(deg) > 90;
    if (left) deg += deg > 0 ? -180 : 180;
    g.setAttribute('transform', `translate(${f1(p.x)} ${f1(p.y + bob)}) rotate(${(deg + sway).toFixed(2)}) scale(${left ? -CAR : CAR} ${CAR})`);
    return left ? -1 : 1;
  }
  // 先頭車の煙突の位置（盤面の座標）
  function chimneyAt(p) {
    const [lx, ly] = YT.Craft.chimney(YT.Craft.equipped().livery);
    let ang = p.ang;
    let x = lx;
    if (Math.abs(ang) > Math.PI / 2) {
      ang += ang > 0 ? -Math.PI : Math.PI;
      x = -lx;
    }
    const c = Math.cos(ang), s = Math.sin(ang);
    return [p.x + (x * c - ly * s) * CAR, p.y + (x * s + ly * c) * CAR];
  }
  function setPose(d, now = 0, speedK = 0) {
    pose.d = d;
    const p1 = pointAt(pose.segs, d);
    const p2 = pointAt(pose.segs, d - GAP);
    // 走っているあいだは、線路の継ぎ目に合わせて小さく揺れる
    const sway = Math.sin(now / 95) * 1.4 * speedK;
    const bob = Math.abs(Math.sin(now / 70)) * -0.8 * speedK;
    const dir = placeCar(carG1, p1, sway, bob);
    placeCar(carG2, p2, -sway * 0.8, bob);
    return { p1, dir };
  }

  // 駅に止まっている姿：その駅へ入ってくる区間の上、駅の少し手前に置く
  function park(id) {
    const from = [...(D.adj[id] || [])][0];
    if (!from) return;
    pose.segs = makeSegs([from, id]);
    layers.trail.innerHTML = '';
    setPose(Math.max(0, pose.segs.total - STOP));
  }

  // 停車中も、ときどきふわっとトレイルを浮かべる
  let idleTimer = null;
  function idleFx() {
    clearInterval(idleTimer);
    idleTimer = setInterval(() => {
      if (pose.running || !pose.segs || document.hidden) return;
      const [x, y] = chimneyAt(pointAt(pose.segs, pose.d));
      YT.Craft.spawnTrail(fx, x, y, undefined, 0.7, 1);
    }, 1600);
  }

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
      ['bg', 'routes', 'badges', 'labels', 'course', 'trail', 'nodes', 'region', 'train'].forEach((k) => (layers[k] = el('g', { class: `layer-${k}` }, svg)));
      buildBoard();
      buildRoutes();
      buildNodes();
      buildTrain();
      idleFx();
      Map.fit();
      window.addEventListener('resize', Map.fit);
    },

    // スマホ（幅639px以下）では左右の海を少し切って、九州を大きく見せる（座標系は 800×960 のまま）
    fit() {
      const narrow = window.matchMedia('(max-width: 639px)').matches;
      svg.setAttribute('viewBox', narrow ? '118 0 584 960' : D.meta.viewBox.join(' '));
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

    // サイコロの行き先候補：波紋のようにやさしく光らせる
    setCandidates(ids) {
      candidates = ids ? new Set(ids) : null;
      svg.classList.toggle('is-choosing', !!candidates);
      D.stations.forEach((s) => nodes[s.id].classList.toggle('is-candidate', !!(candidates && candidates.has(s.id))));
    },
    isCandidate: (id) => !!(candidates && candidates.has(id)),

    placeTrain(id) {
      if (D.byId[id]) park(id);
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

    // 経路 [a, b, c, ...] の線路の上を走る。1駅ずつ経由しながら、出発と到着で加減速し、途中の駅の前では少しゆるめる。
    // opts.onJoint(速さ 0〜1)：レールの継ぎ目を通ったとき、opts.onPass(駅ID)：途中の駅を通りすぎたとき
    moveTrain(path, opts = {}) {
      return new Promise((resolve) => {
        if (!path || path.length < 2) return resolve();
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const segs = makeSegs(path);
        pose.segs = segs;
        pose.running = true;
        const end = Math.max(0, segs.total - STOP);
        const stops = segs.slice(0, -1).map((s) => s.start + s.len); // 途中の駅の位置
        const VMAX = reduce ? 2.2 : 0.42; // 盤面の単位／ミリ秒
        const RAMP = 70;
        let d = 0, last = null, nextJoint = 26, passed = 0, fxAcc = 0;
        carG1.classList.add('is-running');
        carG2.classList.add('is-running');
        const step = (now) => {
          const dt = last === null ? 16 : Math.min(48, now - last);
          last = now;
          const kStart = 0.16 + 0.84 * Math.min(1, d / RAMP) ** 0.6;
          const kEnd = 0.06 + 0.94 * Math.min(1, Math.max(0, end - d) / RAMP) ** 0.7;
          const kStop = stops.reduce((k, s) => Math.min(k, 0.38 + 0.62 * Math.min(1, Math.abs(d - s) / 46)), 1);
          const k = Math.max(0.04, Math.min(kStart, kEnd, kStop));
          d = Math.min(end, d + VMAX * k * dt);
          const { p1, dir } = setPose(d, now, k);
          if (d >= nextJoint) {
            nextJoint += 26;
            if (opts.onJoint) opts.onJoint(k);
          }
          while (passed < stops.length && d >= stops[passed]) if (opts.onPass) opts.onPass(segs[passed++].to);
          else passed++;
          // トレイル：速く走っているほど、たくさん浮かぶ
          fxAcc += dt * (0.4 + k);
          if (fxAcc > 120) {
            fxAcc = 0;
            const [x, y] = chimneyAt(p1);
            YT.Craft.spawnTrail(fx, x, y, undefined, 0.75, dir);
            // 走っている区間の地域の演出（湯けむり・噴煙・カモメ…）を、列車のまわりに少しずつ
            if (opts.onFx) opts.onFx(p1.x, p1.y, segs.find((sg) => d <= sg.start + sg.len) || segs[segs.length - 1]);
          }
          if (d < end) return requestAnimationFrame(step);
          pose.running = false;
          carG1.classList.remove('is-running');
          carG2.classList.remove('is-running');
          setTimeout(() => [...layers.trail.children].forEach((c) => c.classList.add('is-fading')), 200);
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
        const g = el('g', { class: `course-pin${id === overnight ? ' is-overnight' : ''}`, transform: `translate(${s.x + 14} ${s.y - 14})` }, layers.course);
        el('circle', { r: 9 }, g);
        el('text', { y: 3.8, 'text-anchor': 'middle' }, g).textContent = id === overnight ? '泊' : String(i + 1);
      });
    },

    // 地域の演出を置く層（js/scenery.js が使う）
    regionLayer: () => layers.region,

    // スポットライト駅：金のビーコン（ゆっくり広がる輪）と「🎯 ゴール」の旗
    setSpotlight(id) {
      D.stations.forEach((s) => nodes[s.id].classList.toggle('is-spotlight', s.id === id));
      svg.querySelectorAll('.spot-flag').forEach((f) => f.remove());
      if (!id || !nodes[id]) return;
      const g = el('g', { class: 'spot-flag', 'aria-hidden': 'true' }, nodes[id]);
      [0, 1, 2].forEach((i) => el('circle', { r: 14, class: 'spot-beacon', style: `--i:${i}` }, g));
      // 盤面の上のふちに近い駅（門司港など）は、旗が切れないよう駅の下に立てる
      const pos = el('g', { transform: D.byId[id].y < 70 ? 'translate(-30 50)' : 'translate(8 -16)' }, g);
      const f = el('g', { class: 'spot-pennant' }, pos); // はためく動きは内側だけ（位置の transform を上書きしないように）
      el('line', { x1: 0, y1: 0, x2: 0, y2: -30, class: 'spot-pole' }, f);
      el('path', { d: 'M0,-30 L34,-24 L0,-17 Z', class: 'spot-cloth' }, f);
      el('text', { x: 4, y: -21.5, class: 'spot-text' }, f).textContent = '🎯 ゴール';
      nodes[id].parentNode.appendChild(nodes[id]); // ほかの駅の名前の上に出す
    },

    // ライン制覇：そのラインの区間（両端がラインの駅）を金色に光らせる
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

    // 王座奪還：自分の金の王冠とアバターが、上から駅にドスン！と刺さる
    dropCrown(id, avatarMarkup) {
      const g = nodes[id];
      if (!g) return;
      const pin = el('g', { class: 'crown-drop', 'aria-hidden': 'true', transform: 'scale(1.6)' }, g); // スマホでも見えるよう大きめに
      pin.innerHTML = `<g class="crown-drop-body"><circle r="17" cy="-30" class="crown-drop-disc"/>
          <foreignObject x="-15" y="-45" width="30" height="30"><div xmlns="http://www.w3.org/1999/xhtml" class="crown-drop-av">${avatarMarkup}</div></foreignObject>
          <path d="M-11,-48 L-11,-56 L-5.5,-51 L0,-60 L5.5,-51 L11,-56 L11,-48 Z" class="crown-drop-crown"/></g>
        <ellipse rx="22" ry="6" class="crown-drop-dust"/>`;
      g.parentNode.appendChild(g);
      setTimeout(() => pin.classList.add('is-landed'), 700);
      setTimeout(() => pin.remove(), 5200);
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
