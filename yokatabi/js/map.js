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
  const SAKURAJIMA = [[247, 586], [257, 584], [260, 594], [250, 599]];
  const YAKUSHIMA = [[178, 760], [198, 752], [218, 762], [216, 784], [196, 792], [176, 782]];
  const TANEGASHIMA = [[262, 752], [270, 744], [276, 770], [266, 800], [258, 788]];

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
      <pattern id="p-wave" width="36" height="18" patternUnits="userSpaceOnUse">
        <path d="M0 12 Q9 6 18 12 T36 12" fill="none" stroke="#ffffff" stroke-opacity=".07" stroke-width="1.5"/>
      </pattern>
      <linearGradient id="g-land" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#fbf4e2"/><stop offset=".6" stop-color="#eef0d6"/><stop offset="1" stop-color="#e3ebcf"/>
      </linearGradient>
      <radialGradient id="g-gold" cx=".35" cy=".3" r=".8">
        <stop offset="0" stop-color="#fff7c2"/><stop offset=".45" stop-color="#f7c948"/><stop offset="1" stop-color="#b7791f"/>
      </radialGradient>
      <filter id="f-glow" x="-100%" y="-100%" width="300%" height="300%">
        <feGaussianBlur stdDeviation="4" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="f-shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#04142b" flood-opacity=".45"/>
      </filter>`;
  }

  function buildBoard() {
    // 海は viewBox の外まで広げ、枠の縦横比が違っても余白が出ないようにする（svg は overflow: visible）
    const [vx, vy, vw, vh] = D.meta.viewBox;
    const sea = { x: vx - vw, y: vy - vh, width: vw * 3, height: vh * 3 };
    // 下地の色は .map-frame の背景（CSS）に任せ、ここでは波模様だけ敷く
    el('rect', { ...sea, fill: 'url(#p-wave)' }, layers.bg);

    const land = el('g', { filter: 'url(#f-shadow)' }, layers.bg);
    [MAINLAND, AMAKUSA, YAKUSHIMA, TANEGASHIMA].forEach((pts) =>
      el('path', { d: smoothClosed(pts), class: 'land' }, land)
    );
    el('path', { d: smoothClosed(SAKURAJIMA), class: 'land land-volcano' }, layers.bg);

    // 縮尺外の離島枠
    el('rect', { x: 150, y: 736, width: 140, height: 72, rx: 10, class: 'inset-frame' }, layers.bg);
    const t = el('text', { x: 158, y: 750, class: 'inset-label' }, layers.bg);
    t.textContent = '特別航路・縮尺外';

    // 方位と装飾
    const deco = el('g', { class: 'map-deco', transform: 'translate(500 60)' }, layers.bg);
    deco.innerHTML = `<circle r="20" class="compass"/><path d="M0 -16 L5 0 L0 16 L-5 0Z" class="compass-needle"/>
      <text y="-24" text-anchor="middle" class="compass-n">N</text>`;
    const sea1 = el('text', { x: 40, y: 120, class: 'sea-label' }, layers.bg);
    sea1.textContent = '玄界灘';
    const sea2 = el('text', { x: 470, y: 470, class: 'sea-label' }, layers.bg);
    sea2.textContent = '日向灘';
    const sea3 = el('text', { x: 40, y: 520, class: 'sea-label' }, layers.bg);
    sea3.textContent = '東シナ海';
  }

  function buildRoutes() {
    D.edges.forEach((e) => {
      const d = segmentD(e.a, e.b);
      const type = e.type || 'rail';
      const g = el('g', { class: `route route-${type}`, 'data-edge': e.key }, layers.routes);
      if (type === 'rail') {
        el('path', { d, class: 'rail-base' }, g);
        el('path', { d, class: 'rail-dash' }, g);
      } else {
        el('path', { d, class: `${type}-line` }, g);
      }
    });
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
      el('circle', { r: 17, class: 'station-gold-ring' }, g);
      el('circle', { r: 11, class: 'station-ring' }, g);
      el('circle', { r: 7, class: 'station-core' }, g);
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

  function buildTrain() {
    train = el('g', { class: 'train', 'aria-hidden': 'true' }, layers.train);
    el('circle', { r: 15, class: 'train-bg' }, train);
    trainEmoji = el('text', { 'text-anchor': 'middle', y: 7, class: 'train-emoji' }, train);
    trainEmoji.textContent = '🚂';
  }

  function setTrainPos(x, y, facingRight) {
    train.setAttribute('transform', `translate(${x} ${y - 26})`);
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
      ['bg', 'routes', 'trail', 'nodes', 'train'].forEach((k) => (layers[k] = el('g', { class: `layer-${k}` }, svg)));
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
          setTrainPos(pt.x, pt.y, Math.abs(dx) > 0.01 ? dx > 0 : undefined);
          if (t < 1) requestAnimationFrame(step);
          else {
            train.classList.remove('is-running');
            setTimeout(() => (layers.trail.innerHTML = ''), 600);
            resolve();
          }
        };
        requestAnimationFrame(step);
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
