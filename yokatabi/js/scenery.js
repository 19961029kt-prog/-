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

  // icon は js/icons.js の線画の名前（絵文字は使わない）
  const THEMES = {
    onsen: { label: '温泉郷', icon: 'onsen', line: '湯けむりの里を走行中' },
    volcano: { label: 'カルデラと火山', icon: 'volcano', line: '火の山の風を受けて走行中' },
    ocean: { label: '潮風と海', icon: 'wave', line: '潮風の海辺を走行中' },
    forest: { label: '神話と千年の森', icon: 'forest', line: '木漏れ日の森を走行中' },
    city: { label: '都市と異国浪漫', icon: 'lantern', line: '灯りのともる街を走行中' },
  };
  const themeOf = (id) => (D && D.byId[id] && THEMES[D.byId[id].regionTheme] ? D.byId[id].regionTheme : 'city');

  // ---------- ミニ車窓バナー ----------
  // 横長の窓に、銅版画（エッチング）のような地域の風景：空は細い横線のハッチング、山や街は線とケバで描き、
  // ゆっくり動くもの（湯けむり・噴煙・カモメ・木漏れ日・灯り）も生成りと真鍮の細い線にする
  const INK = '#2c2523', BRASS = '#b8860b', PAPER = '#f4efe6';
  function scene(theme) {
    const id = `sc-${theme}`;
    // 空のハッチング（上ほど密）と、山肌の斜めのケバ
    const defs = `<pattern id="${id}-sky" width="6" height="3.2" patternUnits="userSpaceOnUse"><path d="M0,.5 H6" stroke="${INK}" stroke-width=".35" opacity=".2"/></pattern>
      <pattern id="${id}-hatch" width="3.4" height="3.4" patternUnits="userSpaceOnUse" patternTransform="rotate(38)"><path d="M0,0 V3.4" stroke="${INK}" stroke-width=".55" opacity=".45"/></pattern>
      <pattern id="${id}-hatch2" width="2.4" height="2.4" patternUnits="userSpaceOnUse" patternTransform="rotate(-30)"><path d="M0,0 V2.4" stroke="${INK}" stroke-width=".5" opacity=".55"/></pattern>
      <linearGradient id="${id}-fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="1"/><stop offset=".7" stop-color="#fff" stop-opacity="0"/></linearGradient>
      <mask id="${id}-skym"><rect width="480" height="90" fill="url(#${id}-fade)"/></mask>`;
    const line = (d, w = 0.9, o = 0.8) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" opacity="${o}"/>`;
    const land = (d, fill) => `<path d="${d}" fill="url(#${id}-${fill})"/>${line(d.replace(/ L480,90 L0,90 Z| Z$/g, ''), 0.9)}`;
    const hills = {
      onsen:
        land('M0,58 Q60,26 120,46 T240,40 T360,50 T480,36 L480,90 L0,90 Z', 'hatch') +
        land('M0,72 Q80,52 160,66 T320,62 T480,70 L480,90 L0,90 Z', 'hatch2') +
        // 湯の宿の屋根
        line('M300,70 l16,-9 l16,9 M304,70 v10 M328,70 v10 M296,80 h40', 0.8, 0.85),
      volcano:
        land('M90,78 L168,24 Q180,16 192,24 L270,78 Z', 'hatch') + line('M170,30 l6,10 M186,28 l-4,12 M178,24 v14', 0.6, 0.6) +
        land('M0,80 Q100,62 200,76 T480,70 L480,90 L0,90 Z', 'hatch2'),
      ocean:
        `<path d="M0,58 H480 V90 H0 Z" fill="url(#${id}-sky)"/>` +
        Array.from({ length: 6 }, (_, i) => line(`M${-20 + i * 8},${62 + i * 4.5} Q120,${58 + i * 4.5} 240,${62 + i * 4.5} T500,${62 + i * 4.5}`, 0.5, 0.45)).join('') +
        land('M300,58 Q340,38 392,58 Z', 'hatch') + line('M0,58 H480', 0.8, 0.7) +
        // 灯台
        line('M430,58 l3,-22 h6 l3,22 M432,44 h10 M436,36 v-4', 0.8, 0.85),
      forest:
        land('M0,68 Q40,40 80,62 T160,56 T240,64 T320,50 T400,60 T480,54 L480,90 L0,90 Z', 'hatch') +
        Array.from({ length: 9 }, (_, i) => line(`M${20 + i * 55},84 l12,-32 l12,32 M${32 + i * 55},84 v4 M${24 + i * 55},74 h16 M${27 + i * 55},64 h10`, 0.8, 0.8)).join(''),
      city:
        Array.from({ length: 12 }, (_, i) => {
          const x = i * 40 + 4, y = 48 + ((i * 37) % 22), h = 42 - ((i * 37) % 22);
          return `<rect x="${x}" y="${y}" width="30" height="${h}" fill="url(#${id}-hatch2)"/>${line(`M${x},90 V${y} H${x + 30} V90`, 0.8, 0.8)}` +
            Array.from({ length: Math.floor(h / 10) }, (_, k) => `<rect x="${x + 6}" y="${y + 5 + k * 10}" width="5" height="4" fill="${PAPER}"/><rect x="${x + 18}" y="${y + 5 + k * 10}" width="5" height="4" fill="${PAPER}"/>`).join('');
        }).join(''),
    }[theme];
    const movers = {
      onsen: Array.from({ length: 6 }, (_, i) => `<path class="sc-steam" style="--i:${i}" d="M${50 + i * 75},84 q-7,-9 0,-18 t0,-18" fill="none" stroke="${PAPER}" stroke-width="3.2" stroke-linecap="round"/><path class="sc-steam" style="--i:${i}" d="M${50 + i * 75},84 q-7,-9 0,-18 t0,-18" fill="none" stroke="${INK}" stroke-width=".5" stroke-linecap="round" opacity=".5"/>`).join(''),
      volcano: `<g class="sc-plume" fill="${PAPER}" stroke="${INK}" stroke-width=".6"><circle cx="180" cy="16" r="8"/><circle cx="192" cy="7" r="11"/><circle cx="210" cy="-3" r="14"/></g>` +
        Array.from({ length: 4 }, (_, i) => `<path class="sc-wind" style="--i:${i}" d="M-60,${30 + i * 12} q30,-6 60,0 t60,0" fill="none" stroke="${INK}" stroke-width=".6" stroke-linecap="round" opacity=".55"/>`).join(''),
      ocean: Array.from({ length: 3 }, (_, i) => `<path class="sc-gull" style="--i:${i}" d="M0,0 q6,-6 12,0 q6,-6 12,0" fill="none" stroke="${INK}" stroke-width="1" stroke-linecap="round"/>`).join('') +
        Array.from({ length: 8 }, (_, i) => `<circle class="sc-spark" style="--i:${i}" cx="${30 + i * 58}" cy="${66 + (i % 3) * 7}" r="1.2" fill="${BRASS}"/>`).join(''),
      forest: Array.from({ length: 4 }, (_, i) => `<path class="sc-ray" style="--i:${i}" d="M${90 + i * 100},-10 L${120 + i * 100},-10 L${70 + i * 100},90 L${40 + i * 100},90 Z" fill="#faf0ca"/>`).join('') +
        Array.from({ length: 6 }, (_, i) => `<path class="sc-leaf" style="--i:${i}" transform="translate(${40 + i * 75} -6)" d="M0,-5 Q4.5,-1 0,5 Q-4.5,-1 0,-5 Z M0,-4 V4" fill="${PAPER}" stroke="${i % 2 ? BRASS : INK}" stroke-width=".6"/>`).join(''),
      city: Array.from({ length: 7 }, (_, i) => `<g class="sc-lamp" style="--i:${i}" transform="translate(${30 + i * 68} ${40 + (i % 2) * 10})"><circle r="9" fill="#e6c665" opacity=".28"/><path d="M-4,-6 h8 l1,12 h-10 Z M0,-6 v-3" fill="${PAPER}" stroke="${BRASS}" stroke-width=".8"/></g>`).join('') +
        Array.from({ length: 8 }, (_, i) => `<circle class="sc-twinkle" style="--i:${i}" cx="${20 + i * 60}" cy="${14 + (i % 3) * 8}" r="1" fill="${BRASS}"/>`).join(''),
    }[theme];
    return `<svg viewBox="0 0 480 90" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>${defs}</defs>
        <rect width="480" height="90" fill="${PAPER}"/><rect width="480" height="90" fill="url(#${id}-sky)" mask="url(#${id}-skym)"/>${hills}${movers}
        <path d="M0,84.5 H480 M0,87 H480" stroke="${INK}" stroke-width=".7" opacity=".7"/>
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
    banner.querySelector('.scenery-text').innerHTML = `<span class="scenery-icon" aria-hidden="true">${YT.Icon.svg(t.icon)}</span><b>${t.label}</b><span>${moving ? t.line : '停車中'}・${s.name}${moving ? '付近' : '駅'}</span>`;
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
