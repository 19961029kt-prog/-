// インラインSVGの九州すごろく盤：海・九州シルエット・路線・駅ノード・特急列車。
// 座標系は stations.json の meta.viewBox（既定 560×820）。駅の x/y もこの座標系。
(function () {
  'use strict';
  const YT = (window.YT = window.YT || {});
  const NS = 'http://www.w3.org/2000/svg';

  // 九州本土の海岸線（おおまかな手描きトレース。緯度経度を簡易投影した点列を滑らかにつなぐ）
  const MAINLAND = [
    [308, 60], [332, 92], [352, 138], [400, 130], [448, 140], [460, 176], [446, 198], [442, 214],
    [452, 226], [490, 220], [494, 262], [480, 302], [464, 340], [448, 372], [440, 412], [422, 470],
    [412, 524], [394, 590], [382, 643], [352, 630], [332, 630], [316, 668], [290, 702], [256, 730],
    [266, 690], [272, 650], [264, 612], [250, 578], [240, 566], [234, 590], [236, 630], [246, 652],
    [260, 670], [246, 692], [222, 690], [182, 670], [164, 620], [158, 560], [162, 502], [190, 462],
    [214, 430], [240, 392], [232, 350], [224, 305], [206, 282], [178, 252], [152, 262], [148, 286],
    [152, 306], [192, 322], [192, 364], [160, 374], [134, 354], [114, 362], [88, 388], [70, 352],
    [80, 322], [60, 290], [52, 266], [62, 238], [40, 216], [28, 200], [60, 190], [82, 182],
    [112, 166], [150, 140], [188, 134], [206, 118], [222, 90], [250, 76], [280, 64],
  ];
  const AMAKUSA = [[176, 392], [204, 384], [216, 410], [198, 442], [170, 430]];
  const SAKURAJIMA = [[246, 584], [256, 581], [262, 590], [252, 599], [244, 594]];
  // 屋久島は縮尺外の枠内に、丸みのある「森の島」として大きめに置く
  const YAKUSHIMA = [[174, 768], [184, 752], [202, 748], [220, 756], [226, 774], [216, 792], [196, 798], [178, 790]];
  const TANEGASHIMA = [[262, 752], [270, 744], [276, 770], [266, 800], [258, 788]];

  // 山地・高原：本島シルエットの内側に、等高線つきのやわらかい起伏として描く
  // [中心x, 中心y, 半径x, 半径y, 回転, 名前]
  const HIGHLANDS = [
    [368, 440, 50, 84, -18, ''],
    [348, 262, 52, 40, -10, ''],
    [302, 548, 30, 22, 10, '霧島'],
    [172, 346, 18, 14, 0, ''],
    [178, 194, 36, 14, -12, ''],
    [300, 642, 22, 18, 0, ''],
    [446, 318, 26, 30, 0, ''],
  ];
  // 山のアイコン [x, y, 大きさ, 名前]
  const PEAKS = [
    [296, 214, 1.0, 'くじゅう'],
    [302, 540, 1.1, ''],
    [172, 342, 0.85, '雲仙'],
    [338, 424, 1.0, ''],
    [360, 446, 0.85, '九州山地'],
    [214, 766, 0.75, ''],
  ];

  // 九州7県の県境（おおまかなイメージ線。海岸線の内側だけに描く）
  const PREF_BORDERS = [
    [[136, 150], [168, 178], [204, 204], [212, 228], [194, 250]],             // 福岡｜佐賀
    [[72, 192], [92, 224], [112, 256], [142, 290]],                           // 佐賀｜長崎
    [[356, 140], [330, 190], [318, 220], [324, 244]],                         // 福岡｜大分
    [[324, 244], [282, 256], [242, 262], [206, 280]],                         // 福岡｜熊本
    [[324, 244], [350, 232], [370, 242], [374, 274], [372, 308]],             // 大分｜熊本
    [[372, 308], [420, 318], [474, 310]],                                     // 大分｜宮崎
    [[372, 308], [346, 332], [330, 382], [306, 432], [300, 480]],             // 熊本｜宮崎
    [[300, 480], [252, 478], [194, 466]],                                     // 熊本｜鹿児島
    [[300, 480], [318, 526], [326, 572], [342, 630]],                         // 宮崎｜鹿児島
  ];
  // 県名ラベル [県名, x, y]（盤面の「エリア名」として大きく淡く置く）
  const PREF_LABELS = [
    ['福岡', 262, 206], ['佐賀', 150, 222], ['長崎', 112, 300], ['熊本', 270, 330],
    ['大分', 452, 256], ['宮崎', 432, 392], ['鹿児島', 214, 520],
  ];

  // 点列を Catmull-Rom → 3次ベジェで開いた滑らかな線にする
  function smoothOpen(pts) {
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0]},${p2[1]}`;
    }
    return d;
  }

  // 点列を Catmull-Rom → 3次ベジェで閉じた滑らかなパスにする
  function smoothClosed(pts) {
    const n = pts.length;
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0]},${p2[1]}`;
    }
    return d + 'Z';
  }

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

  // a→b 方向の区間パス（routeOverrides の via があれば2次ベジェ）
  function segmentD(a, b) {
    const A = D.byId[a], B = D.byId[b];
    const o = D.overrides[YT.Data.edgeKey(a, b)];
    if (o && o.via) return `M${A.x},${A.y} Q${o.via[0]},${o.via[1]} ${B.x},${B.y}`;
    return `M${A.x},${A.y} L${B.x},${B.y}`;
  }

  function buildDefs() {
    const defs = el('defs', {}, svg);
    defs.innerHTML = `
      <pattern id="p-wave" width="44" height="22" patternUnits="userSpaceOnUse">
        <path d="M0 14 Q11 7 22 14 T44 14" fill="none" stroke="#ffffff" stroke-opacity=".08" stroke-width="1.6"/>
        <path d="M-22 3 Q-11 -4 0 3 T22 3 T44 3" fill="none" stroke="#ffffff" stroke-opacity=".04" stroke-width="1.2"/>
      </pattern>
      <linearGradient id="g-land" x1="0" y1="0" x2=".7" y2="1">
        <stop offset="0" stop-color="#fbf1d8"/><stop offset=".5" stop-color="#f0e0bb"/><stop offset="1" stop-color="#e3cd9c"/>
      </linearGradient>
      <radialGradient id="g-highland">
        <stop offset="0" stop-color="#a9c98a" stop-opacity=".95"/>
        <stop offset=".6" stop-color="#c3d9a4" stop-opacity=".6"/>
        <stop offset="1" stop-color="#d9e6bd" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="g-forest" cx=".45" cy=".4" r=".7">
        <stop offset="0" stop-color="#8fc27a"/><stop offset=".7" stop-color="#5e9a5f"/><stop offset="1" stop-color="#3f7a4b"/>
      </radialGradient>
      <linearGradient id="g-peak" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#7fa66a"/><stop offset="1" stop-color="#4f7d4f"/>
      </linearGradient>
      <radialGradient id="g-gold" cx=".35" cy=".3" r=".8">
        <stop offset="0" stop-color="#fff7c2"/><stop offset=".45" stop-color="#f7c948"/><stop offset="1" stop-color="#b7791f"/>
      </radialGradient>
      <filter id="f-paper" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="7" result="n"/>
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 .45  0 0 0 0 .36  0 0 0 0 .2  0 0 0 .5 0"/>
      </filter>
      <filter id="f-soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="6"/></filter>
      <filter id="f-railshadow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.2"/></filter>
      <radialGradient id="g-gloss" cx=".35" cy=".28" r=".75">
        <stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset=".35" stop-color="#fff" stop-opacity=".25"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="g-rays">
        <stop offset="0" stop-color="#fff6c4" stop-opacity=".95"/><stop offset=".55" stop-color="#ffd34d" stop-opacity=".5"/><stop offset="1" stop-color="#ffd34d" stop-opacity="0"/>
      </radialGradient>
      <filter id="f-glow" x="-100%" y="-100%" width="300%" height="300%">
        <feGaussianBlur stdDeviation="4" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="f-shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="2" dy="8" stdDeviation="6" flood-color="#023038" flood-opacity=".55"/>
      </filter>`;
  }

  // 盤面：海 → 浅瀬のにじみ → 島（影つき）→ 紙の質感 → 山地の等高線 → 山アイコン → 装飾
  function buildBoard() {
    // 海は viewBox の外まで広げ、枠の縦横比が違っても余白が出ないようにする（svg は overflow: visible）
    const [vx, vy, vw, vh] = D.meta.viewBox;
    const sea = { x: vx - vw, y: vy - vh, width: vw * 3, height: vh * 3 };
    // 下地の色は .map-frame の背景（CSS）に任せ、ここでは波模様だけ敷く
    el('rect', { ...sea, fill: 'url(#p-wave)' }, layers.bg);

    const islands = [MAINLAND, AMAKUSA, TANEGASHIMA, SAKURAJIMA].map(smoothClosed);
    const yaku = smoothClosed(YAKUSHIMA);
    const defs = svg.querySelector('defs');
    const clip = el('clipPath', { id: 'c-land' }, defs);
    [...islands, yaku].forEach((d) => el('path', { d }, clip));

    // 浅瀬：海岸線のまわりに水色のにじみを2重に
    const shore = el('g', { class: 'shore' }, layers.bg);
    [...islands, yaku].forEach((d) => {
      el('path', { d, class: 'shore-far' }, shore);
      el('path', { d, class: 'shore-near' }, shore);
    });

    const land = el('g', { filter: 'url(#f-shadow)' }, layers.bg);
    islands.forEach((d, i) => el('path', { d, class: i === 3 ? 'land land-volcano' : 'land' }, land));
    el('path', { d: yaku, class: 'land land-forest' }, land);

    // 島の内側だけに描くもの（紙の質感・山地）
    const inner = el('g', { 'clip-path': 'url(#c-land)' }, layers.bg);
    el('rect', { x: vx, y: vy, width: vw, height: vh, filter: 'url(#f-paper)', class: 'land-texture' }, inner);
    HIGHLANDS.forEach(([x, y, rx, ry, rot, name]) => {
      const g = el('g', { transform: `translate(${x} ${y}) rotate(${rot})` }, inner);
      el('ellipse', { rx: rx * 1.25, ry: ry * 1.25, fill: 'url(#g-highland)', filter: 'url(#f-soft)' }, g);
      [0.95, 0.68, 0.42].forEach((k) => el('ellipse', { rx: rx * k, ry: ry * k, class: 'contour' }, g));
      if (name) {
        const t = el('text', { y: ry * 0.95 + 12, 'text-anchor': 'middle', transform: `rotate(${-rot})`, class: 'terrain-label' }, g);
        t.textContent = name;
      }
    });
    // 阿蘇の外輪山：カルデラをぐるりと囲むリング
    const aso = D.byId.aso;
    if (aso) {
      el('ellipse', { cx: aso.x + 2, cy: aso.y - 4, rx: 34, ry: 28, class: 'caldera' }, inner);
      el('ellipse', { cx: aso.x + 2, cy: aso.y - 4, rx: 34, ry: 28, class: 'caldera-rim' }, inner);
    }
    // 県境（点線）と県名（エリア名）
    PREF_BORDERS.forEach((pts) => el('path', { d: smoothOpen(pts), class: 'pref-border' }, inner));
    PREF_LABELS.forEach(([name, x, y]) => {
      const color = (D.meta.prefectures[name] || {}).color || '#8a7a58';
      const t = el('text', { x, y, 'text-anchor': 'middle', class: 'pref-label', style: `--pref:${color}` }, inner);
      t.textContent = name;
    });
    // 島のふち：内側に細い白のハイライト（紙の盤面を切り抜いたような立体感）
    [...islands, yaku].forEach((d) => el('path', { d, class: 'land-rim' }, inner));

    const peaks = el('g', { class: 'peaks' }, layers.bg);
    PEAKS.forEach(([x, y, k, name]) => {
      const g = el('g', { transform: `translate(${x} ${y}) scale(${k})`, class: 'peak' }, peaks);
      el('path', { d: 'M-13 7 Q-7 -4 -2 -10 Q1 -12 3 -9 Q8 -3 13 7 Z', fill: 'url(#g-peak)' }, g);
      el('path', { d: 'M-4 -6 Q-1 -11 3 -9 L5 -6 Q2 -4 0 -6 Q-2 -4 -4 -6 Z', class: 'peak-snow' }, g);
      if (name) {
        const t = el('text', { y: 18, 'text-anchor': 'middle', class: 'terrain-label' }, g);
        t.textContent = name;
      }
    });
    // 桜島の噴煙
    const smoke = el('g', { class: 'smoke', transform: 'translate(254 578)' }, layers.bg);
    [0, 1, 2].forEach((i) => el('circle', { r: 3 + i, style: `--i:${i}` }, smoke));

    // 縮尺外の離島枠
    el('rect', { x: 150, y: 736, width: 140, height: 72, rx: 10, class: 'inset-frame' }, layers.bg);
    const t = el('text', { x: 158, y: 750, class: 'inset-label' }, layers.bg);
    t.textContent = '特別航路・縮尺外';

    // 方位と装飾
    const deco = el('g', { class: 'map-deco', transform: 'translate(500 60)' }, layers.bg);
    deco.innerHTML = `<circle r="20" class="compass"/><path d="M0 -16 L5 0 L0 16 L-5 0Z" class="compass-needle"/>
      <text y="-24" text-anchor="middle" class="compass-n">N</text>`;
    [['玄界灘', 40, 120], ['日向灘', 470, 470], ['東シナ海', 40, 520], ['有明海', 190, 276]].forEach(([name, x, y], i) => {
      const s = el('text', { x, y, class: i === 3 ? 'sea-label sea-label-sm' : 'sea-label' }, layers.bg);
      s.textContent = name;
    });
    // 海に浮かぶ波しるし（盤面のにぎやかし）
    [[96, 470], [480, 600], [470, 160], [120, 640], [330, 760], [500, 380]].forEach(([x, y]) =>
      el('path', { d: `M${x} ${y} q5 -6 10 0 t10 0 t10 0`, class: 'wave-mark' }, layers.bg)
    );
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
      el('circle', { r: 22, class: 'station-hit' }, g);
      el('circle', { r: 19, class: 'station-candidate' }, g);
      el('circle', { r: 16, class: 'station-aura' }, g);
      el('path', { d: raysPath(36, 12), class: 'station-rays' }, g);
      el('circle', { r: 17, class: 'station-gold-ring' }, g);
      // 立体トークン：下に厚み（側面）と接地影、上面に光沢。ホバーでトークンごと拡大する
      const token = el('g', { class: 'station-token' }, g);
      el('ellipse', { cy: 5, rx: 12, ry: 10, class: 'station-ground' }, token);
      el('circle', { cy: 3, r: 11, class: 'station-side' }, token);
      el('circle', { r: 11, class: 'station-ring' }, token);
      el('circle', { r: 7, class: 'station-core' }, token);
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

  let trainBody, trainShadow;
  function buildTrain() {
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
    trainBody.setAttribute('transform', `translate(0 ${(-hop * 8).toFixed(2)})`);
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
          if (t < 1) requestAnimationFrame(step);
          else {
            train.classList.remove('is-running');
            // 到着時に「むぎゅっ」とつぶれて着地
            train.classList.remove('is-landing');
            void train.getBBox();
            train.classList.add('is-landing');
            setTimeout(() => (layers.trail.innerHTML = ''), 600);
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
