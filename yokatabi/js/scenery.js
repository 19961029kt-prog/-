// ご当地の車窓と環境の演出：駅ごとの地域テーマ（stations.json の regionTheme）に合わせて、
//   ・画面上部のミニ車窓バナー（#scenery）を、走っている地域の風景に切り替える
//   ・走行中は列車のまわり、到着したときは駅のまわりに、その地域らしいものを浮かべる
// テーマ：onsen（湯けむり）・volcano（噴煙と風）・ocean（波しぶきとカモメ）・forest（木漏れ日と木の葉）・city（灯りときらめき）
(function () {
  'use strict';
  const YT = (window.YT = window.YT || {});
  const NS = 'http://www.w3.org/2000/svg';
  let D = null, banner = null, current = null;
  const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const THEMES = {
    onsen: { label: '温泉郷', icon: '♨️', line: '湯けむりの里を走行中' },
    volcano: { label: 'カルデラと火山', icon: '🌋', line: '火の山の風を受けて走行中' },
    ocean: { label: '潮風と海', icon: '🌊', line: '潮風の海辺を走行中' },
    forest: { label: '神話と千年の森', icon: '🌲', line: '木漏れ日の森を走行中' },
    city: { label: '都市と異国浪漫', icon: '🏮', line: '灯りのともる街を走行中' },
  };
  const themeOf = (id) => (D && D.byId[id] && THEMES[D.byId[id].regionTheme] ? D.byId[id].regionTheme : 'city');

  // ---------- ミニ車窓バナー ----------
  // 横長の窓の中に、地域の風景（遠景のシルエット）と、ゆっくり動くもの（湯けむり・噴煙・カモメ・木の葉・灯り）
  const SKY = {
    onsen: ['#f6e6d4', '#e9d3c0'],
    volcano: ['#efe0cf', '#d9c4ae'],
    ocean: ['#d8ecf0', '#bcdfe6'],
    forest: ['#e5ecd6', '#cfdcbf'],
    city: ['#f3e2cf', '#e3c9b0'],
  };
  function scene(theme) {
    const [a, b] = SKY[theme];
    const hills = {
      onsen: '<path d="M0,64 Q60,30 120,52 T240,46 T360,54 T480,40 L480,90 L0,90 Z" fill="#b9a58c" opacity=".55"/><path d="M0,74 Q80,54 160,70 T320,66 T480,72 L480,90 L0,90 Z" fill="#9c8a72" opacity=".6"/>',
      volcano: '<path d="M90,78 L170,22 Q180,16 190,22 L270,78 Z" fill="#8f7a66" opacity=".75"/><path d="M0,80 Q100,60 200,76 T480,70 L480,90 L0,90 Z" fill="#7d6b58" opacity=".7"/>',
      ocean: '<path d="M0,58 L480,58 L480,90 L0,90 Z" fill="#7fb3bd" opacity=".55"/><path d="M300,58 Q340,40 390,58 Z" fill="#8a9e86" opacity=".7"/>',
      forest: '<path d="M0,70 Q40,40 80,64 T160,58 T240,66 T320,52 T400,62 T480,56 L480,90 L0,90 Z" fill="#6f8f62" opacity=".6"/>' +
        Array.from({ length: 9 }, (_, i) => `<path d="M${20 + i * 55},84 l12,-34 l12,34 Z" fill="#4e6e4a" opacity=".55"/>`).join(''),
      city: Array.from({ length: 12 }, (_, i) => `<rect x="${i * 40 + 4}" y="${50 + ((i * 37) % 22)}" width="30" height="${40 - ((i * 37) % 22)}" fill="#8c705a" opacity=".55"/>`).join(''),
    }[theme];
    const movers = {
      onsen: Array.from({ length: 6 }, (_, i) => `<path class="sc-steam" style="--i:${i}" d="M${50 + i * 75},84 q-7,-9 0,-18 t0,-18" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/>`).join('') +
        '<text class="sc-mark" x="440" y="40" font-size="20">♨</text>',
      volcano: '<g class="sc-plume"><circle cx="180" cy="16" r="9" fill="#cfc3b6"/><circle cx="192" cy="6" r="12" fill="#d8cdc1"/><circle cx="210" cy="-4" r="15" fill="#e2d8cd"/></g>' +
        Array.from({ length: 4 }, (_, i) => `<path class="sc-wind" style="--i:${i}" d="M-60,${30 + i * 12} q30,-6 60,0 t60,0" fill="none" stroke="#fffaf2" stroke-width="2" stroke-linecap="round" opacity=".8"/>`).join(''),
      ocean: Array.from({ length: 3 }, (_, i) => `<path class="sc-gull" style="--i:${i}" d="M0,0 q6,-6 12,0 q6,-6 12,0" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>`).join('') +
        Array.from({ length: 8 }, (_, i) => `<circle class="sc-spark" style="--i:${i}" cx="${30 + i * 58}" cy="${64 + (i % 3) * 7}" r="2.2" fill="#fff"/>`).join(''),
      forest: Array.from({ length: 4 }, (_, i) => `<path class="sc-ray" style="--i:${i}" d="M${90 + i * 100},-10 L${120 + i * 100},-10 L${70 + i * 100},90 L${40 + i * 100},90 Z" fill="#f6dc8a"/>`).join('') +
        Array.from({ length: 6 }, (_, i) => `<path class="sc-leaf" style="--i:${i}" transform="translate(${40 + i * 75} -6)" d="M0,-5 Q4.5,-1 0,5 Q-4.5,-1 0,-5 Z" fill="${['#7fae5a', '#a9c97a', '#d4b04a'][i % 3]}"/>`).join(''),
      city: Array.from({ length: 7 }, (_, i) => `<g class="sc-lamp" style="--i:${i}" transform="translate(${30 + i * 68} ${40 + (i % 2) * 10})"><circle r="9" fill="#f7c86a" opacity=".35"/><rect x="-4" y="-6" width="8" height="12" rx="3" fill="#e0703f"/></g>`).join('') +
        Array.from({ length: 8 }, (_, i) => `<circle class="sc-twinkle" style="--i:${i}" cx="${20 + i * 60}" cy="${14 + (i % 3) * 8}" r="1.8" fill="#fff6d8"/>`).join(''),
    }[theme];
    return `<svg viewBox="0 0 480 90" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs><linearGradient id="sc-sky-${theme}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
        <rect width="480" height="90" fill="url(#sc-sky-${theme})"/>${hills}${movers}
        <rect y="84" width="480" height="6" fill="#5b4a3c" opacity=".55"/>
      </svg>`;
  }
  function show(id, moving) {
    if (!banner) return;
    const theme = themeOf(id);
    const t = THEMES[theme];
    const s = D.byId[id];
    banner.dataset.theme = theme;
    if (current !== theme) {
      current = theme;
      banner.querySelector('.scenery-view').innerHTML = scene(theme);
    }
    banner.querySelector('.scenery-text').innerHTML = `<span class="scenery-icon" aria-hidden="true">${t.icon}</span><b>${t.label}</b><span>${moving ? t.line : '停車中'}・${s.name}${moving ? '付近' : '駅'}</span>`;
    banner.classList.toggle('is-moving', !!moving);
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
    g.innerHTML = {
      onsen: `<path d="M0,0 q-5,-6 0,-12 t0,-12" fill="none" stroke="#fff" stroke-width="${big ? 4 : 3}" stroke-linecap="round" opacity=".9"/>`,
      volcano: `<circle r="${big ? 7 : 5}" fill="#c9bcae"/><circle cx="6" cy="-4" r="${big ? 6 : 4}" fill="#ddd2c6"/>`,
      ocean: r > 0.6 ? '<path d="M-6,0 q3,-4 6,0 q3,-4 6,0" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>' : `<circle r="${big ? 2.6 : 2}" fill="#e9f7f8"/>`,
      forest: r > 0.5 ? `<path d="M0,-4 Q3.6,-1 0,4 Q-3.6,-1 0,-4 Z" fill="${r > 0.75 ? '#d4b04a' : '#8fbf68'}"/>` : '<circle r="1.8" fill="#f6dc8a"/>',
      city: `<circle r="${big ? 3 : 2.2}" fill="#f7c86a"/><circle r="${big ? 7 : 5}" fill="#f7c86a" opacity=".28"/>`,
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
      if (banner) banner.innerHTML = '<div class="scenery-view"></div><p class="scenery-text" aria-live="polite"></p>';
    },
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
