// ご当地の車窓と環境の演出：駅ごとの地域テーマ（stations.json の regionTheme）に合わせて、
//   ・マップの上の車窓パノラマ（#scenery）を、走っている地域の風景に切り替え、列車の速さに合わせて流す
//   ・走行中は列車のまわり、到着したときは駅のまわりに、その地域らしいものを浮かべる
// テーマ：onsen（湯けむり）・volcano（噴煙と風）・ocean（波しぶきとカモメ）・forest（木漏れ日と木の葉）・city（灯りときらめき）
(function () {
  'use strict';
  const YT = (window.YT = window.YT || {});
  const NS = 'http://www.w3.org/2000/svg';
  let D = null, banner = null, current = null;
  const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // icon は js/icons.js の線画の名前（絵文字は使わない）
  const THEMES = {
    onsen: { label: '温泉郷', icon: 'onsen', line: '湯けむりの里を走行中' },
    volcano: { label: 'カルデラと火山', icon: 'volcano', line: '火の山の風を受けて走行中' },
    ocean: { label: '潮風と海', icon: 'wave', line: '潮風の海辺を走行中' },
    forest: { label: '神話と千年の森', icon: 'forest', line: '木漏れ日の森を走行中' },
    city: { label: '都市と異国浪漫', icon: 'lantern', line: '灯りのともる街を走行中' },
  };
  const themeOf = (id) => (D && D.byId[id] && THEMES[D.byId[id].regionTheme] ? D.byId[id].regionTheme : 'city');

  // ---------- 車窓パノラマ（マップの上に常設する横長の窓） ----------
  // 木の窓枠に、銅版画（エッチング）のような地域の風景。奥の山並み（far）・まちや海（mid）・手前の電柱と柵（near）の
  // 3枚の帯を、列車の速さに合わせて別々の速さで流す（手前ほど速い）。駅でブレーキをかけると景色もゆっくり止まる。
  // 帯は 480×90 の絵を「そのまま・左右反転」の順に並べるので、継ぎ目が出ない（反転した絵の端は元の絵の端と同じ高さ）。
  const INK = '#2c2523', BRASS = '#b8860b', PAPER = '#f4efe6';
  // 絵は 480×90 で描くが、窓（高さ68px）では上の空を少し切って 16〜90 だけを見せ、線が細くなりすぎないようにする
  const TW = 480, TH = 90, VY = 16, VH = TH - VY;
  const line = (d, w = 1.1, o = 0.8, c = INK) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" opacity="${o}"/>`;
  function defs(id) {
    return `<pattern id="${id}-sky" width="6" height="3.2" patternUnits="userSpaceOnUse"><path d="M0,.5 H6" stroke="${INK}" stroke-width=".35" opacity=".2"/></pattern>
      <pattern id="${id}-hatch" width="3.4" height="3.4" patternUnits="userSpaceOnUse" patternTransform="rotate(38)"><path d="M0,0 V3.4" stroke="${INK}" stroke-width=".8" opacity=".5"/></pattern>
      <pattern id="${id}-hatch2" width="2.6" height="2.6" patternUnits="userSpaceOnUse" patternTransform="rotate(-30)"><path d="M0,0 V2.6" stroke="${INK}" stroke-width=".7" opacity=".55"/></pattern>
      <pattern id="${id}-far" width="3.6" height="3.6" patternUnits="userSpaceOnUse" patternTransform="rotate(60)"><path d="M0,0 V3.6" stroke="${INK}" stroke-width=".65" opacity=".42"/></pattern>`;
  }
  const land = (id, d, fill, w = 1) => `<path d="${d}" fill="url(#${id}-${fill})"/>${line(d.replace(/ L480,90 L0,90 Z| Z$/g, ''), w)}`;
  // 空（動かない）：夕暮れの街だけ、低い太陽と茜の横線
  function sky(theme) {
    const id = `sk-${theme}`;
    const dusk = theme === 'city';
    return `<svg class="pano-sky" viewBox="0 ${VY} ${TW} ${VH}" preserveAspectRatio="none" aria-hidden="true"><defs>${defs(id)}
        <linearGradient id="${id}-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${dusk ? '#f3dcc0' : PAPER}"/><stop offset="1" stop-color="${dusk ? '#f7ecd6' : '#f8f3ea'}"/></linearGradient>
        <linearGradient id="${id}-fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="1"/><stop offset=".7" stop-color="#fff" stop-opacity="0"/></linearGradient>
        <mask id="${id}-m"><rect width="${TW}" height="${TH}" fill="url(#${id}-fade)"/></mask></defs>
        <rect width="${TW}" height="${TH}" fill="url(#${id}-g)"/><rect width="${TW}" height="${TH}" fill="url(#${id}-sky)" mask="url(#${id}-m)"/>
        ${dusk ? `<circle cx="330" cy="58" r="22" fill="#e6c665" opacity=".55"/><circle cx="330" cy="58" r="22" fill="none" stroke="${BRASS}" stroke-width=".7" opacity=".7"/>${Array.from({ length: 5 }, (_, i) => line(`M${250 - i * 8},${40 + i * 6} H${410 + i * 8}`, 0.45, 0.35, '#a8382b')).join('')}` : ''}
      </svg>`;
  }
  // 奥の山並み・中景（流れる帯の1枚ぶん）
  function far(theme) {
    const id = `fa-${theme}`;
    const body = {
      // 阿蘇の外輪山：横に長い平らな稜線と、真ん中の山から立ちのぼる噴煙
      volcano: land(id, 'M0,54 Q40,40 90,42 L150,38 Q200,30 240,34 Q262,22 280,30 L330,36 Q400,40 480,54 L480,90 L0,90 Z', 'far', 1) +
        line('M250,30 l4,-6 l5,4 l4,-7', 0.6, 0.6),
      onsen: land(id, 'M0,58 Q60,30 120,46 T240,40 T360,50 T480,58 L480,90 L0,90 Z', 'far', 1),
      ocean: land(id, 'M0,58 Q60,52 120,56 Q150,44 190,50 Q230,56 260,58 L480,58 L480,90 L0,90 Z', 'far', 0.9),
      forest: land(id, 'M0,58 Q40,36 80,50 T160,42 T240,52 T320,38 T400,48 T480,58 L480,90 L0,90 Z', 'far', 1),
      city: land(id, 'M0,62 Q120,48 240,56 T480,62 L480,90 L0,90 Z', 'far', 0.9),
    }[theme];
    return `<svg viewBox="0 ${VY} ${TW} ${VH}" preserveAspectRatio="none" aria-hidden="true"><defs>${defs(id)}</defs>${body}</svg>`;
  }
  function mid(theme) {
    const id = `mi-${theme}`;
    const body = {
      // 別府の湯けむり：山すその湯の町の屋根から、白い湯けむりが何本も
      onsen: land(id, 'M0,74 Q80,60 160,68 T320,66 T480,74 L480,90 L0,90 Z', 'hatch2') +
        [40, 150, 230, 330, 420].map((x, i) => line(`M${x},76 l12,-7 l12,7 M${x + 4},76 v8 M${x + 20},76 v8`, 0.8, 0.85)).join('') +
        [52, 162, 242, 342, 432].map((x, i) => `<path class="sc-steam" style="--i:${i}" d="M${x},70 q-7,-9 0,-18 t0,-18" fill="none" stroke="${PAPER}" stroke-width="3.6" stroke-linecap="round"/><path class="sc-steam" style="--i:${i}" d="M${x},70 q-7,-9 0,-18 t0,-18" fill="none" stroke="${INK}" stroke-width=".8" stroke-linecap="round" opacity=".65"/>`).join(''),
      volcano: land(id, 'M0,76 Q100,64 200,72 T400,70 T480,76 L480,90 L0,90 Z', 'hatch2') +
        `<g class="sc-plume" fill="${PAPER}" stroke="${INK}" stroke-width=".6"><circle cx="262" cy="20" r="7"/><circle cx="272" cy="11" r="10"/><circle cx="288" cy="2" r="13"/></g>` +
        [60, 180, 380].map((x) => line(`M${x},76 l5,-10 l5,10 M${x + 5},70 v-2`, 0.7, 0.7)).join(''),
      // 海面とカモメ：波の細い線と、真鍮のきらめき
      ocean: Array.from({ length: 6 }, (_, i) => line(`M0,${62 + i * 4.5} Q120,${59 + i * 4.5} 240,${62 + i * 4.5} T480,${62 + i * 4.5}`, 0.8, 0.5)).join('') +
        line('M0,58 H480', 0.8, 0.7) + line('M420,58 l3,-20 h6 l3,20 M422,46 h10 M426,38 v-4', 0.8, 0.85) +
        Array.from({ length: 8 }, (_, i) => `<circle class="sc-spark" style="--i:${i}" cx="${30 + i * 58}" cy="${66 + (i % 3) * 7}" r="1.2" fill="${BRASS}"/>`).join(''),
      forest: Array.from({ length: 9 }, (_, i) => line(`M${20 + i * 52},84 l12,-30 l12,30 M${32 + i * 52},84 v4 M${24 + i * 52},74 h16 M${27 + i * 52},64 h10`, 0.8, 0.8)).join('') +
        Array.from({ length: 3 }, (_, i) => `<path class="sc-ray" style="--i:${i}" d="M${100 + i * 140},-10 L${130 + i * 140},-10 L${80 + i * 140},90 L${50 + i * 140},90 Z" fill="#faf0ca"/>`).join(''),
      // 夕暮れの街並み：屋根と窓の灯り
      city: Array.from({ length: 12 }, (_, i) => {
        const x = i * 40 + 4, y = 50 + ((i * 37) % 20), h = 40 - ((i * 37) % 20);
        return `<rect x="${x}" y="${y}" width="30" height="${h}" fill="url(#${id}-hatch2)"/>${line(`M${x},90 V${y} H${x + 30} V90`, 0.8, 0.8)}` +
          Array.from({ length: Math.floor(h / 10) }, (_, k) => `<rect class="sc-window" style="--i:${(i + k) % 5}" x="${x + 6}" y="${y + 5 + k * 10}" width="5" height="4" fill="#e6c665"/><rect x="${x + 18}" y="${y + 5 + k * 10}" width="5" height="4" fill="${PAPER}"/>`).join('');
      }).join(''),
    }[theme];
    return `<svg viewBox="0 ${VY} ${TW} ${VH}" preserveAspectRatio="none" aria-hidden="true"><defs>${defs(id)}</defs>${body}</svg>`;
  }
  // 手前：電柱と架線、低い柵（どの地域でも同じ。流れの速さがいちばんよくわかる帯）
  function near() {
    const poles = [60, 300].map((x) => line(`M${x},90 V22 M${x - 9},28 H${x + 9} M${x - 6},34 H${x + 6}`, 1.1, 0.75)).join('');
    const wires = line('M60,28 Q180,40 300,28 Q390,40 480,34 M0,34 Q30,40 60,28', 0.45, 0.55) + line('M60,34 Q180,44 300,34 Q390,44 480,39 M0,39 Q30,44 60,34', 0.4, 0.45);
    const fence = Array.from({ length: 16 }, (_, i) => line(`M${i * 30 + 8},90 V80`, 0.7, 0.55)).join('') + line('M0,82.5 H480', 0.5, 0.5);
    return `<svg viewBox="0 ${VY} ${TW} ${VH}" preserveAspectRatio="none" aria-hidden="true">${wires}${poles}${fence}</svg>`;
  }
  // ゆっくり動くもの（流れに乗らない）：カモメ・風・灯り・木の葉
  function drift(theme) {
    const g = {
      ocean: Array.from({ length: 3 }, (_, i) => `<path class="sc-gull" style="--i:${i}" d="M0,0 q6,-6 12,0 q6,-6 12,0" fill="none" stroke="${INK}" stroke-width="1" stroke-linecap="round"/>`).join(''),
      volcano: Array.from({ length: 3 }, (_, i) => `<path class="sc-wind" style="--i:${i}" d="M-60,${22 + i * 10} q30,-6 60,0 t60,0" fill="none" stroke="${INK}" stroke-width=".6" stroke-linecap="round" opacity=".5"/>`).join(''),
      forest: Array.from({ length: 5 }, (_, i) => `<path class="sc-leaf" style="--i:${i}" transform="translate(${40 + i * 90} -6)" d="M0,-5 Q4.5,-1 0,5 Q-4.5,-1 0,-5 Z M0,-4 V4" fill="${PAPER}" stroke="${i % 2 ? BRASS : INK}" stroke-width=".6"/>`).join(''),
      city: Array.from({ length: 7 }, (_, i) => `<circle class="sc-twinkle" style="--i:${i}" cx="${20 + i * 66}" cy="${12 + (i % 3) * 7}" r="1" fill="${BRASS}"/>`).join(''),
      onsen: '',
    }[theme];
    return `<svg class="pano-drift" viewBox="0 0 ${TW} ${TH}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${g}</svg>`;
  }

  // 帯：同じ絵を「そのまま・反転」の順に、窓の幅より少し多めに並べる
  const BANDS = [
    { key: 'far', k: 0.14 },
    { key: 'mid', k: 0.42 },
    { key: 'near', k: 1 },
  ];
  function band(cls, svgStr, count) {
    const tiles = Array.from({ length: count }, (_, i) => `<div class="pano-tile${i % 2 ? ' is-flip' : ''}">${svgStr}</div>`).join('');
    return `<div class="pano-band pano-${cls}"><div class="pano-track">${tiles}</div></div>`;
  }
  function sceneEl(theme) {
    const wrap = document.createElement('div');
    wrap.className = 'pano-scene';
    wrap.dataset.theme = theme;
    const h = banner.clientHeight || 68;
    const tw = (h * TW) / VH;
    const count = 2 * Math.ceil((banner.clientWidth || 800) / tw / 2 + 1) + 2;
    wrap.innerHTML = sky(theme) + band('far', far(theme), count) + band('mid', mid(theme), count) + drift(theme) + band('near', near(), count);
    wrap.style.setProperty('--tw', `${tw.toFixed(2)}px`);
    return wrap;
  }

  // 流れる速さ：target（列車の速さ 0〜1）に、v がゆっくり追いつく（止まるときは、景色もすうっと止まる）
  const flow = { v: 0, target: 0, x: 0, raf: 0, last: 0 };
  const PX = 0.3; // 速さ1のときの手前の帯の速さ（px／ミリ秒）
  function tick(now) {
    const dt = flow.last ? Math.min(64, now - flow.last) : 16;
    flow.last = now;
    const ease = flow.target > flow.v ? 380 : 900; // 止まるほうを長めに
    flow.v += (flow.target - flow.v) * Math.min(1, dt / ease);
    flow.x += flow.v * PX * dt;
    const view = banner && banner.querySelector('.pano-scene:last-of-type');
    if (view) {
      const period = 2 * parseFloat(view.style.getPropertyValue('--tw') || 362);
      view.querySelectorAll('.pano-band').forEach((b, i) => {
        const off = (flow.x * BANDS[i].k) % period;
        b.firstElementChild.style.transform = `translate3d(${(-off).toFixed(1)}px,0,0)`;
      });
    }
    banner && banner.classList.toggle('is-moving', flow.v > 0.04);
    if (flow.v < 0.002 && flow.target === 0) {
      flow.v = 0;
      flow.raf = 0;
      flow.last = 0;
      return;
    }
    flow.raf = requestAnimationFrame(tick);
  }
  function setSpeed(k) {
    flow.target = reduce() ? 0 : Math.max(0, Math.min(1, k || 0));
    if (!flow.raf && (flow.target > 0 || flow.v > 0)) flow.raf = requestAnimationFrame(tick);
  }

  function show(id, moving) {
    if (!banner) return;
    const theme = themeOf(id);
    const t = THEMES[theme];
    const s = D.byId[id];
    banner.dataset.theme = theme;
    if (current !== theme) {
      current = theme;
      // 地域が変わったら、新しい景色を重ねて、古い景色はふわっと消す
      const box = banner.querySelector('.pano-view');
      const old = [...box.children];
      const el = sceneEl(theme);
      box.appendChild(el);
      if (old.length) {
        el.classList.add('is-entering');
        requestAnimationFrame(() => el.classList.remove('is-entering'));
        setTimeout(() => old.forEach((o) => o.remove()), 900);
      }
      if (flow.raf === 0) tick(performance.now()); // 止まっていても、新しい帯の位置をそろえる
    }
    banner.querySelector('.scenery-text').innerHTML = `<span class="scenery-icon" aria-hidden="true">${YT.Icon.svg(t.icon)}</span><b>${t.label}</b><span>${moving ? t.line : '停車中'}・${s.name}${moving ? '付近' : '駅'}</span>`;
  }

  // ---------- 地図の上の演出 ----------
  function spawn(layer, x, y, theme, big) {
    if (!layer || reduce()) return;
    const g = document.createElementNS(NS, 'g');
    const r = Math.random();
    g.setAttribute('class', `rfx rfx-${theme}${big ? ' is-big' : ''}`);
    g.setAttribute('transform', `translate(${(x + (r - 0.5) * (big ? 46 : 22)).toFixed(1)} ${(y + (big ? 4 : -4)).toFixed(1)})`);
    g.style.setProperty('--dx', `${((r - 0.5) * 30).toFixed(1)}px`);
    g.style.setProperty('--r', r.toFixed(2));
    // 地図の上の粒も、生成り・真鍮・インクの細い線で（原色は使わない）
    g.innerHTML = {
      onsen: `<path d="M0,0 q-5,-6 0,-12 t0,-12" fill="none" stroke="#fbf8f2" stroke-width="${big ? 3.2 : 2.4}" stroke-linecap="round" opacity=".95"/><path d="M0,0 q-5,-6 0,-12 t0,-12" fill="none" stroke="#2c2523" stroke-width=".5" stroke-linecap="round" opacity=".45"/>`,
      volcano: `<g fill="#f4efe6" stroke="#5a4e45" stroke-width=".6"><circle r="${big ? 6 : 4.5}"/><circle cx="6" cy="-4" r="${big ? 5 : 3.6}"/></g>`,
      ocean: r > 0.6 ? '<path d="M-6,0 q3,-4 6,0 q3,-4 6,0" fill="none" stroke="#2c2523" stroke-width=".8" stroke-linecap="round" opacity=".7"/>' : `<circle r="${big ? 1.8 : 1.4}" fill="#b8860b"/>`,
      forest: r > 0.5 ? `<path d="M0,-4 Q3.6,-1 0,4 Q-3.6,-1 0,-4 Z M0,-3.4 V3.4" fill="#faf0ca" stroke="${r > 0.75 ? '#b8860b' : '#44543f'}" stroke-width=".6"/>` : '<circle r="1.3" fill="#d4af37"/>',
      city: `<circle r="${big ? 6 : 4.5}" fill="#e6c665" opacity=".25"/><circle r="${big ? 2 : 1.5}" fill="#b8860b"/>`,
    }[theme];
    layer.appendChild(g);
    setTimeout(() => g.remove(), 1900);
  }
  let fxTick = 0;

  YT.Scenery = {
    THEMES,
    themeOf,
    init(data, el) {
      D = data;
      banner = el;
      if (!banner) return;
      banner.innerHTML = '<div class="pano-view"></div><div class="pano-frame" aria-hidden="true"></div><p class="scenery-text" aria-live="polite"></p>';
      // 窓の幅が変わったら、帯の枚数を数え直す
      let rt = 0;
      window.addEventListener('resize', () => {
        clearTimeout(rt);
        rt = setTimeout(() => {
          const id = YT.Store.get().currentStationId;
          current = null;
          if (id) show(id, flow.v > 0.04);
        }, 200);
      });
    },
    // 列車の速さ（0〜1）。走っているあいだ毎フレーム呼ばれ、景色の流れる速さがそれに追いつく
    setSpeed,
    // 停車中の駅の風景にする
    show: (id) => show(id, false),
    // 途中の駅を通りすぎた：その先の地域の風景に切り替える
    pass(id) {
      show(id, true);
      const [x, y] = YT.Map.stationXY(id);
      for (let i = 0; i < 3; i++) spawn(YT.Map.regionLayer(), x, y, themeOf(id), false);
    },
    // 走行中：列車のまわりに、向かっている駅の地域のものを少しずつ（間引いて軽く）
    trainFx(x, y, toId) {
      fxTick += 1;
      if (fxTick % 2) return;
      if (banner && banner.dataset.theme !== themeOf(toId)) show(toId, true);
      spawn(YT.Map.regionLayer(), x, y, themeOf(toId), false);
    },
    // 到着：駅のまわりに大きめにふわっと
    arrive(id) {
      show(id, false);
      const [x, y] = YT.Map.stationXY(id);
      const theme = themeOf(id);
      for (let i = 0; i < 9; i++) setTimeout(() => spawn(YT.Map.regionLayer(), x, y, theme, true), i * 120);
    },
  };
})();
