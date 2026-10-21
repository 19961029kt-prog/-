// インラインSVGの九州すごろく盤：海・九州シルエット・路線・駅ノード・特急列車。
// 座標系は stations.json の meta.viewBox（既定 560×820）。駅の x/y もこの座標系。
(function () {
  'use strict';
  const YT = (window.YT = window.YT || {});
  const NS = 'http://www.w3.org/2000/svg';

  // 地図の形（海岸線・県境・線路網・区間の線形）は、実在の地理データから tools/build-geo.mjs で作った js/geo.js を使う。
  const GEO = window.YOKATABI_GEO || null;
  // 経度・緯度 → 盤面の座標（geo.js と同じ投影）。屋久島まわりは、縮尺はそのままで左下の枠へずらす。
  function project(lon, lat) {
    const p = GEO.proj;
    let x = lon * p.cos * p.k + p.ox, y = p.oy - lat * p.k;
    const b = GEO.yaku.box;
    if (lon > b.west && lon < b.east && lat > b.south && lat < b.north) (x += GEO.yaku.shift[0]), (y += GEO.yaku.shift[1]);
    return [x, y];
  }
  // 1km あたりの盤面の長さ（山や外輪山の大きさを実寸で決めるため）
  const km = () => GEO.proj.k / 111.32;

  // 山地・高原：実際の位置に、等高線つきのやわらかい起伏として描く
  // [経度, 緯度, 東西の半径km, 南北の半径km, 回転, 名前]
  const HIGHLANDS = [
    [131.18, 32.48, 30, 52, -28, '九州山地'],
    [131.25, 33.09, 14, 9, -8, ''],
    [130.88, 31.92, 14, 10, -30, '霧島'],
    [130.29, 32.76, 8, 7, 0, ''],
    [130.93, 33.47, 11, 7, 0, ''],
    [131.36, 32.82, 12, 9, -20, ''],
    [130.5, 30.34, 10, 8, 0, ''],
  ];
  // 山のアイコン [経度, 緯度, 大きさ, 名前]
  const PEAKS = [
    [131.24, 33.09, 1.0, 'くじゅう'],
    [130.87, 31.93, 1.0, ''],
    [130.29, 32.76, 0.85, '雲仙'],
    [131.36, 32.83, 0.85, '祖母山'],
    [131.08, 32.42, 0.95, ''],
    [130.93, 33.48, 0.8, '英彦山'],
    [130.53, 31.18, 0.8, '開聞岳'],
    [130.5, 30.34, 0.8, '宮之浦岳'],
  ];
  // 阿蘇のカルデラ（東西約18km・南北約25km）
  const ASO_CALDERA = [131.06, 32.93, 9, 12.5];
  // 桜島の噴煙を出す位置（南岳付近）
  const SAKURAJIMA_TOP = [130.66, 31.58];
  // 県名ラベル [県名, 経度, 緯度]（盤面の「エリア名」として大きく淡く置く）
  const PREF_LABELS = [
    ['福岡', 130.66, 33.62], ['佐賀', 130.2, 33.33], ['長崎', 130.21, 32.64], ['熊本', 130.82, 32.62],
    ['大分', 131.45, 33.12], ['宮崎', 131.2, 32.2], ['鹿児島', 130.48, 31.82],
  ];
  // 海の名前 [名前, 経度, 緯度, 小さい字か]
  const SEAS = [
    ['玄界灘', 129.82, 33.86], ['周防灘', 131.32, 33.82], ['日向灘', 131.82, 32.05], ['東シナ海', 129.62, 32.05],
    ['有明海', 130.33, 33.05, 1], ['大村湾', 129.85, 32.97, 1], ['八代海', 130.38, 32.3, 1], ['豊後水道', 132.04, 33.02, 1], ['錦江湾', 130.68, 31.38, 1],
  ];

  function el(name, attrs = {}, parent) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  let D, svg, layers, handlers;
  const nodes = {}; // id -> <g>
  let train, trainEmoji;
  let candidates = null;

  // a→b 方向の区間パス。geo.js に実際の線形があればそれを、なければ直線（via があれば2次ベジェ）で結ぶ。
  // geo.js の線形は「キーの前の駅 → 後ろの駅」の向きなので、逆向きのときは点列を反転する。
  const reversed = {};
  function segmentD(a, b) {
    const key = YT.Data.edgeKey(a, b);
    const d = GEO && GEO.routes[key];
    if (d) {
      if (key.startsWith(`${a}|`)) return d;
      return (reversed[key] = reversed[key] || 'M' + d.slice(1).split('L').reverse().join('L'));
    }
    const A = D.byId[a], B = D.byId[b];
    const o = D.overrides[key];
    if (o && o.via) return `M${A.x},${A.y} Q${o.via[0]},${o.via[1]} ${B.x},${B.y}`;
    return `M${A.x},${A.y} L${B.x},${B.y}`;
  }

  function buildDefs() {
    const defs = el('defs', {}, svg);
    defs.innerHTML = `
      <pattern id="p-wave" width="56" height="28" patternUnits="userSpaceOnUse">
        <path d="M0 18 Q14 10 28 18 T56 18" fill="none" stroke="#ffffff" stroke-opacity=".38" stroke-width="1.3" stroke-linecap="round"/>
        <path d="M-14 5 Q-7 1 0 5 T14 5" fill="none" stroke="#5c8f97" stroke-opacity=".12" stroke-width="1" stroke-linecap="round"/>
      </pattern>
      <linearGradient id="g-land" x1="0" y1="0" x2=".6" y2="1">
        <stop offset="0" stop-color="#f4ecd2"/><stop offset=".55" stop-color="#ece3c4"/><stop offset="1" stop-color="#e3d8b4"/>
      </linearGradient>
      <linearGradient id="g-neighbor" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ebe3cc"/><stop offset="1" stop-color="#e2d9bf"/>
      </linearGradient>
      <radialGradient id="g-highland">
        <stop offset="0" stop-color="#9dbb84" stop-opacity=".75"/>
        <stop offset=".6" stop-color="#b6c994" stop-opacity=".4"/>
        <stop offset="1" stop-color="#cfd8a8" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="g-peak" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#8fae76"/><stop offset="1" stop-color="#5f8456"/>
      </linearGradient>
      <radialGradient id="g-gold" cx=".35" cy=".3" r=".8">
        <stop offset="0" stop-color="#fff6d8"/><stop offset=".35" stop-color="#ffd877"/><stop offset=".75" stop-color="#e8a93a"/><stop offset="1" stop-color="#b9761c"/>
      </radialGradient>
      <filter id="f-paper" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency=".75" numOctaves="3" seed="11" result="n"/>
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 .45  0 0 0 0 .36  0 0 0 0 .22  0 0 0 .5 0"/>
      </filter>
      <filter id="f-soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="6"/></filter>
      <filter id="f-railshadow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.6"/></filter>
      <radialGradient id="g-gloss" cx=".35" cy=".28" r=".75">
        <stop offset="0" stop-color="#fff" stop-opacity=".85"/><stop offset=".4" stop-color="#fff" stop-opacity=".18"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="g-rays">
        <stop offset="0" stop-color="#fff3cf" stop-opacity=".9"/><stop offset=".55" stop-color="#ffcf6b" stop-opacity=".45"/><stop offset="1" stop-color="#ffcf6b" stop-opacity="0"/>
      </radialGradient>
      <filter id="f-glow" x="-100%" y="-100%" width="300%" height="300%">
        <feGaussianBlur stdDeviation="3" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="f-shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#6b5236" flood-opacity=".28"/>
      </filter>
      <radialGradient id="g-tail">
        <stop offset="0" stop-color="#ffffff" stop-opacity=".95"/><stop offset=".6" stop-color="#fbf4e6" stop-opacity=".7"/><stop offset="1" stop-color="#efe3cc" stop-opacity="0"/>
      </radialGradient>`;
    // 駅ごとのボタン：県の色を、光の当たる明るい面からやわらかく沈ませる
    Object.entries(D.meta.prefectures).forEach(([, { color }], i) => {
      el('radialGradient', { id: `gem-${i}`, cx: '.36', cy: '.3', r: '.85' }, defs).innerHTML = `
        <stop offset="0" stop-color="${mix(color, '#ffffff', 0.7)}"/>
        <stop offset=".45" stop-color="${mix(color, '#ffffff', 0.15)}"/>
        <stop offset="1" stop-color="${mix(color, '#5a3d2b', 0.3)}"/>`;
    });
  }

  // 16進カラーを割合 k で混ぜる（ボタンの明暗用）
  function mix(a, b, k) {
    const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const [x, y] = [p(a), p(b)];
    return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * k).toString(16).padStart(2, '0')).join('');
  }

  // 盤面：海 → 浅瀬のにじみ → 対岸 → 島（影つき）→ 和紙の質感 → 山地 → 県境・県名 → 線路網 → 山アイコン → 地名・装飾
  function buildBoard() {
    // 海は viewBox の外まで広げ、枠の縦横比が違っても余白が出ないようにする（svg は overflow: visible）
    const [vx, vy, vw, vh] = D.meta.viewBox;
    const sea = { x: vx - vw, y: vy - vh, width: vw * 3, height: vh * 3 };
    // 下地の色は .map-board の背景（CSS）に任せ、ここでは波模様だけ敷く
    el('rect', { ...sea, fill: 'url(#p-wave)' }, layers.bg);
    if (!GEO) return;

    const lands = GEO.land.map((l) => l.d);
    const defs = svg.querySelector('defs');
    const clip = el('clipPath', { id: 'c-land' }, defs);
    lands.forEach((d) => el('path', { d }, clip));

    // 浅瀬：海岸線のまわりに水色のにじみを2重に（水彩のように）
    const shore = el('g', { class: 'shore' }, layers.bg);
    const coast = lands.join(' ');
    el('path', { d: coast, class: 'shore-far' }, shore);
    el('path', { d: coast, class: 'shore-near' }, shore);
    // 対岸（山口県・愛媛県）は淡く置いて、九州が海に浮かぶ位置関係を見せる
    GEO.neighbor.forEach((d) => el('path', { d, class: 'land-neighbor' }, layers.bg));

    // 海岸線：県ごとの輪のふちを太く描き、その上に塗りを重ねる。県どうしの継ぎ目の線は塗りに隠れ、
    // 海に面したふちの外側半分だけが海岸線として残る。
    const land = el('g', { filter: 'url(#f-shadow)' }, layers.bg);
    el('path', { d: coast, class: 'land-coast' }, land);
    GEO.land.forEach((l) => el('path', { d: l.d, class: l.yaku ? 'land land-forest' : 'land' }, land));

    // 島の内側だけに描くもの（和紙の質感・山地・県境）
    const inner = el('g', { 'clip-path': 'url(#c-land)' }, layers.bg);
    // 県ごとに、県の色をほんのり重ねる（どこの県かが色でわかるように）
    (GEO.tint || []).forEach((l) => {
      const color = (D.meta.prefectures[l.pref] || {}).color;
      if (color) el('path', { d: l.d, class: 'land-tint', style: `--pref:${color}` }, inner);
    });
    el('rect', { x: vx, y: vy, width: vw, height: vh, filter: 'url(#f-paper)', class: 'land-texture' }, inner);
    const u = km();
    HIGHLANDS.forEach(([lon, lat, rxKm, ryKm, rot, name]) => {
      const [x, y] = project(lon, lat);
      const rx = rxKm * u, ry = ryKm * u;
      const g = el('g', { transform: `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot})` }, inner);
      el('ellipse', { rx: rx * 1.25, ry: ry * 1.25, fill: 'url(#g-highland)', filter: 'url(#f-soft)' }, g);
      [0.95, 0.68, 0.42].forEach((k) => el('ellipse', { rx: rx * k, ry: ry * k, class: 'contour' }, g));
      if (name) {
        const t = el('text', { y: 4, 'text-anchor': 'middle', transform: `rotate(${-rot})`, class: 'terrain-label terrain-label-lg' }, g);
        t.textContent = name;
      }
    });
    // 阿蘇の外輪山：カルデラをぐるりと囲むリング（実寸）
    {
      const [lon, lat, rxKm, ryKm] = ASO_CALDERA;
      const [cx, cy] = project(lon, lat);
      el('ellipse', { cx, cy, rx: rxKm * u, ry: ryKm * u, class: 'caldera' }, inner);
      el('ellipse', { cx, cy, rx: rxKm * u, ry: ryKm * u, class: 'caldera-rim' }, inner);
    }
    // 県境（点線）と県名（エリア名）
    GEO.borders.forEach((d) => el('path', { d, class: 'pref-border' }, inner));
    PREF_LABELS.forEach(([name, lon, lat]) => {
      const [x, y] = project(lon, lat);
      const color = (D.meta.prefectures[name] || {}).color || '#8a7a58';
      const t = el('text', { x: x.toFixed(1), y: y.toFixed(1), 'text-anchor': 'middle', class: 'pref-label', style: `--pref:${color}` }, inner);
      t.textContent = name;
    });

    // 実在の線路網：九州の鉄道をすべて細く描き、すごろくの路線はその上に重ねる
    const net = el('g', { class: 'rail-network', 'aria-hidden': 'true' }, layers.bg);
    el('path', { d: GEO.network.filter((n) => !n.shin).map((n) => n.d).join(' '), class: 'net-line' }, net);
    el('path', { d: GEO.network.filter((n) => n.shin).map((n) => n.d).join(' '), class: 'net-line net-shin' }, net);

    const peaks = el('g', { class: 'peaks' }, layers.bg);
    PEAKS.forEach(([lon, lat, k, name]) => {
      const [x, y] = project(lon, lat);
      const g = el('g', { transform: `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${k})`, class: 'peak' }, peaks);
      el('path', { d: 'M-12 6 Q-6 -4 -2 -9 Q1 -11 3 -8 Q7 -3 12 6 Z', fill: 'url(#g-peak)' }, g);
      el('path', { d: 'M-4 -5 Q-1 -10 3 -8 L5 -5 Q2 -3 0 -5 Q-2 -3 -4 -5 Z', class: 'peak-snow' }, g);
      if (name) {
        const t = el('text', { y: 17, 'text-anchor': 'middle', class: 'terrain-label' }, g);
        t.textContent = name;
      }
    });
    // 桜島の噴煙
    const [sx, sy] = project(...SAKURAJIMA_TOP);
    const smoke = el('g', { class: 'smoke', transform: `translate(${sx.toFixed(1)} ${(sy - 4).toFixed(1)})` }, layers.bg);
    [0, 1, 2].forEach((i) => el('circle', { r: 3 + i, style: `--i:${i}` }, smoke));

    // 屋久島の枠：縮尺はそのままで、位置だけ左下にずらしていることを示す
    const [ix, iy] = project(130.53, 30.35);
    el('rect', { x: (ix - 58).toFixed(1), y: (iy - 46).toFixed(1), width: 116, height: 98, rx: 12, class: 'inset-frame' }, layers.bg);
    const t = el('text', { x: (ix - 50).toFixed(1), y: (iy - 32).toFixed(1), class: 'inset-label' }, layers.bg);
    t.textContent = '屋久島（位置をずらして表示）';

    // 方位と海の名前
    const deco = el('g', { class: 'map-deco', transform: `translate(${vx + vw - 34} ${vy + vh - 40})` }, layers.bg);
    deco.innerHTML = `<circle r="20" class="compass"/><path d="M0 -15 L5 0 L0 15 L-5 0Z" class="compass-needle"/>
      <path d="M0 -15 L5 0 L-5 0Z" class="compass-north"/>
      <text y="-25" text-anchor="middle" class="compass-n">N</text>`;
    SEAS.forEach(([name, lon, lat, small]) => {
      const [x, y] = project(lon, lat);
      const s = el('text', { x: x.toFixed(1), y: y.toFixed(1), 'text-anchor': 'middle', class: small ? 'sea-label sea-label-sm' : 'sea-label' }, layers.bg);
      s.textContent = name;
    });
  }

  // 路線種別ごとの線のつくり。線は下から順に重ねる。
  const ROUTE_STYLES = {
    // 新幹線：いちばん太いダークグレーの複線。立体の影を落とし、青い光の筋が高速で流れる
    shinkansen: ['track-shadow', 'shin-bed', 'shin-rails', 'shin-gap', 'shin-streak'],
    // 特急幹線：ダークグレーの複線＋立体の影
    trunk: ['track-shadow', 'trunk-bed', 'trunk-rails', 'trunk-gap'],
    // ローカル線：細い二重線（2本のレール）
    local: ['local-rails', 'local-gap'],
    // 観光列車：枕木の上を、えんじ色のレールと金の飾り線が走る
    scenic: ['scenic-ties', 'scenic-rail', 'scenic-gold'],
    // 航路：海の上にうっすら航跡を描き、点線が流れる
    ferry: ['ferry-wake', 'ferry-line'],
    // バス連絡：オレンジの丸い点線
    bus: ['bus-outline', 'bus-dots'],
  };
  const ROUTE_BADGE = { scenic: '✨', ferry: '⛴', bus: '🚌' };

  function buildRoutes() {
    const order = ['ferry', 'bus', 'local', 'scenic', 'trunk', 'shinkansen']; // 新幹線が一番上に来るよう描画順をそろえる
    const types = D.routeTypes || {};
    [...D.edges]
      .sort((x, y) => order.indexOf(routeType(x)) - order.indexOf(routeType(y)))
      .forEach((e) => {
        const d = segmentD(e.a, e.b);
        const type = routeType(e);
        const g = el('g', { class: `route route-${type}`, 'data-edge': e.key }, layers.routes);
        const title = el('title', {}, g);
        title.textContent = `${(types[type] || {}).label || ''}｜${e.name || ''}（${D.byId[e.a].name}〜${D.byId[e.b].name}）`;
        ROUTE_STYLES[type].forEach((cls) => el('path', { d, class: cls }, g));
        if (ROUTE_BADGE[type]) {
          const p = el('path', { d }, layers.routes);
          const len = p.getTotalLength();
          const m = p.getPointAtLength(len / 2);
          p.remove();
          if (len < 60) return; // 短い区間はしるしを置くと駅名とぶつかるので省く
          const b = el('g', { class: `route-badge badge-${type}`, transform: `translate(${m.x.toFixed(1)} ${m.y.toFixed(1)})` }, layers.badges);
          el('circle', { r: 8.5 }, b);
          const t = el('text', { y: 4, 'text-anchor': 'middle' }, b);
          t.textContent = ROUTE_BADGE[type];
        }
      });
  }

  // 旧データの "rail" は在来線として扱う
  function routeType(e) {
    const t = e.type === 'rail' || !e.type ? 'local' : e.type;
    return ROUTE_STYLES[t] ? t : 'local';
  }

  const LABEL_OFFSET = {
    top: [0, -20, 'middle'],
    bottom: [0, 28, 'middle'],
    left: [-17, 5, 'end'],
    right: [17, 5, 'start'],
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
      const gem = `url(#gem-${Object.keys(D.meta.prefectures).indexOf(s.prefecture)})`;
      el('circle', { r: 22, class: 'station-hit' }, g);
      el('circle', { r: 19, class: 'station-candidate' }, g);
      el('circle', { r: 16, class: 'station-aura' }, g);
      el('path', { d: raysPath(36, 12), class: 'station-rays' }, g);
      el('circle', { r: 17, class: 'station-gold-ring' }, g);
      // 買収済みの駅のまわりに広がる光の波紋（3重・時間差）
      [0, 1, 2].forEach((i) => el('circle', { r: 13, class: 'station-ripple', style: `--i:${i}` }, g));
      // 立体トークン（宝石・金貨）：接地影と厚み、カット面、光沢。ホバーでトークンごと拡大する
      const token = el('g', { class: 'station-token' }, g);
      el('ellipse', { cy: 5, rx: 12, ry: 10, class: 'station-ground' }, token);
      el('circle', { cy: 3, r: 11, class: 'station-side' }, token);
      el('circle', { r: 11, class: 'station-ring', fill: gem }, token);
      // テーブルカット：中央の八角形の面と、そこから伸びるファセットの線
      el('path', { d: octagon(5.2), class: 'station-core' }, token);
      el('path', { d: facets(5.2, 10.4), class: 'station-facets' }, token);
      el('circle', { r: 10, class: 'station-gloss' }, token);
      const crown = el('text', { y: -15, 'text-anchor': 'middle', class: 'station-crown' }, g);
      crown.textContent = '♛';
      const [dx, dy, anchor] = LABEL_OFFSET[s.labelDir] || LABEL_OFFSET.right;
      const label = el('text', { x: dx, y: dy, 'text-anchor': anchor, class: 'station-label' }, g);
      label.textContent = s.name;

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

  function octagon(r) {
    return Array.from({ length: 8 }, (_, i) => {
      const a = Math.PI / 8 + (i * Math.PI) / 4;
      return `${i ? 'L' : 'M'}${(Math.cos(a) * r).toFixed(2)},${(Math.sin(a) * r).toFixed(2)}`;
    }).join(' ') + 'Z';
  }
  function facets(r1, r2) {
    return Array.from({ length: 8 }, (_, i) => {
      const a = Math.PI / 8 + (i * Math.PI) / 4;
      return `M${(Math.cos(a) * r1).toFixed(2)},${(Math.sin(a) * r1).toFixed(2)} L${(Math.cos(a) * r2).toFixed(2)},${(Math.sin(a) * r2).toFixed(2)}`;
    }).join(' ');
  }

  // 後光：中心から放射状に伸びる細い三角形
  function raysPath(r, n) {
    let d = '';
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, w = Math.PI / n / 2.2;
      const p = (ang, rr) => `${(Math.cos(ang) * rr).toFixed(1)},${(Math.sin(ang) * rr).toFixed(1)}`;
      d += `M${p(a - w, 9)} L${p(a, r)} L${p(a + w, 9)} Z `;
    }
    return d;
  }

  let trainBody, trainShadow, tail;
  const TAIL = 14; // 光の尾の粒の数
  function buildTrain() {
    // 光の尾（テールライト）：走った軌跡に、だんだん小さく薄くなる光の粒を並べる
    tail = el('g', { class: 'train-tail', 'aria-hidden': 'true' }, layers.train);
    for (let i = 0; i < TAIL; i++) el('circle', { r: 0, fill: 'url(#g-tail)' }, tail);
    train = el('g', { class: 'train', 'aria-hidden': 'true' }, layers.train);
    trainShadow = el('ellipse', { cy: 22, rx: 12, ry: 3.5, class: 'train-shadow' }, train);
    trainBody = el('g', { class: 'train-body' }, train);
    el('circle', { r: 15, class: 'train-bg' }, trainBody);
    trainEmoji = el('text', { 'text-anchor': 'middle', y: 7, class: 'train-emoji' }, trainBody);
    trainEmoji.textContent = '🚂';
  }

  // hop：跳ねている高さ（0〜1）。影は高く跳ぶほど小さく薄くなる
  function setTrainPos(x, y, facingRight, hop = 0) {
    train.setAttribute('transform', `translate(${x} ${y - 26})`);
    trainBody.setAttribute('transform', `translate(0 ${(-hop * 11).toFixed(2)}) scale(${(1 - hop * 0.06).toFixed(3)} ${(1 + hop * 0.1).toFixed(3)})`);
    trainShadow.setAttribute('rx', (12 - hop * 4).toFixed(2));
    trainShadow.style.opacity = (0.45 - hop * 0.25).toFixed(2);
    // 🚂 は多くのフォントで左向きなので、右へ進むときだけ反転
    if (facingRight !== undefined) trainEmoji.setAttribute('transform', facingRight ? 'scale(-1 1)' : '');
  }

  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  const Map = {
    init(svgEl, data, h) {
      D = data;
      svg = svgEl;
      handlers = h;
      svg.setAttribute('viewBox', D.meta.viewBox.join(' '));
      svg.innerHTML = '';
      buildDefs();
      layers = {};
      ['bg', 'routes', 'badges', 'course', 'trail', 'nodes', 'train'].forEach((k) => (layers[k] = el('g', { class: `layer-${k}` }, svg)));
      buildBoard();
      buildRoutes();
      buildNodes();
      buildTrain();
    },

    refresh(state) {
      D.stations.forEach((s) => {
        const g = nodes[s.id];
        g.classList.toggle('is-visited', !!state.visited[s.id]);
        g.classList.toggle('is-acquired', !!state.acquired[s.id]);
        g.classList.toggle('is-current', state.currentStationId === s.id);
        g.classList.toggle('is-favorite', !!state.favorites[s.id]);
      });
    },

    setCandidates(ids) {
      candidates = ids ? new Set(ids) : null;
      svg.classList.toggle('is-choosing', !!candidates);
      D.stations.forEach((s) => nodes[s.id].classList.toggle('is-candidate', !!(candidates && candidates.has(s.id))));
    },
    isCandidate: (id) => !!(candidates && candidates.has(id)),

    placeTrain(id) {
      const s = D.byId[id];
      if (s) setTrainPos(s.x, s.y);
    },

    // 経路 [a, b, c, ...] に沿って列車を走らせる。1区間 約0.8秒、区間が増えるごとに少しずつ足す。
    moveTrain(path) {
      return new Promise((resolve) => {
        if (!path || path.length < 2) return resolve();
        layers.trail.innerHTML = '';
        const segs = [];
        let total = 0;
        for (let i = 0; i < path.length - 1; i++) {
          const p = el('path', { d: segmentD(path[i], path[i + 1]), class: 'trail-line' }, layers.trail);
          const len = p.getTotalLength();
          segs.push({ p, len, start: total });
          total += len;
        }
        const duration = 800 + 300 * (segs.length - 1);
        train.classList.add('is-running');
        tail.classList.remove('is-fading');
        const history = [];
        let t0 = null;
        const step = (now) => {
          if (t0 === null) t0 = now;
          const t = Math.min(1, (now - t0) / duration);
          const dist = ease(t) * total;
          const seg = segs.find((s) => dist <= s.start + s.len) || segs[segs.length - 1];
          const local = Math.min(seg.len, Math.max(0, dist - seg.start));
          const pt = seg.p.getPointAtLength(local);
          const ahead = seg.p.getPointAtLength(Math.min(seg.len, local + 1));
          const dx = ahead.x - pt.x;
          // 1区間につき3回、ぴょんぴょん跳ねながら進む
          const hop = Math.abs(Math.sin(t * Math.PI * 3 * segs.length));
          setTrainPos(pt.x, pt.y, Math.abs(dx) > 0.01 ? dx > 0 : undefined, hop);
          // 光の尾：直近の位置ほど大きく明るく
          history.unshift([pt.x, pt.y - 26]);
          history.length = Math.min(history.length, TAIL * 2);
          [...tail.children].forEach((c, i) => {
            const h = history[i * 2];
            if (!h) return c.setAttribute('r', 0);
            c.setAttribute('cx', h[0].toFixed(1));
            c.setAttribute('cy', h[1].toFixed(1));
            c.setAttribute('r', (13 * (1 - i / TAIL)).toFixed(1));
            c.setAttribute('opacity', (0.9 * (1 - i / TAIL)).toFixed(2));
          });
          if (t < 1) requestAnimationFrame(step);
          else {
            train.classList.remove('is-running');
            // 到着時に「むぎゅっ」とつぶれて着地
            train.classList.remove('is-landing');
            void train.getBBox();
            train.classList.add('is-landing');
            setTimeout(() => (layers.trail.innerHTML = ''), 600);
            tail.classList.add('is-fading');
            setTimeout(() => [...tail.children].forEach((c) => c.setAttribute('r', 0)), 500);
            resolve();
          }
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
        const g = el('g', { class: `course-pin${id === overnight ? ' is-overnight' : ''}`, transform: `translate(${s.x + 13} ${s.y - 13})` }, layers.course);
        el('circle', { r: 8 }, g);
        const t = el('text', { y: 3.5, 'text-anchor': 'middle' }, g);
        t.textContent = id === overnight ? '泊' : String(i + 1);
      });
    },

    // 買収完了時：ノードにバーストエフェクト
    burst(id) {
      const g = nodes[id];
      if (!g) return;
      const b = el('circle', { r: 12, class: 'station-burst' }, g);
      setTimeout(() => b.remove(), 1400);
    },
  };

  YT.Map = Map;
})();
