// 「車両クラフト＆アバター」タブ：鉄道クラフト工房（My Train Garage）と旅人アバター着せ替え（Traveler Studio）。
// 真ん中のプレビューステージ（銅版画の風景）で、改造した列車（1両目＋2両目）が小さな駅に入ってきて、アバターがホームで待つ。
// パーツは硬券の切符のようなカードに並べ、切り替えた瞬間に、見た目と効果音が変わる。絵文字は使わず、アイコンは YT.Icon の線画。
(function () {
  'use strict';
  const YT = (window.YT = window.YT || {});
  const { Store, Sound, Craft } = YT;
  const I = (name, opts) => YT.Icon.svg(name, opts);

  let D = null;
  let api = null; // app.js から：{ esc, yen, yenBig, toast, renderAll, confetti }
  let root = null;
  let mode = 'train'; // 'train'（鉄道クラフト工房）| 'avatar'（旅人アバター）
  let raf = null;

  // ---------- プレビューステージ ----------
  // 銅版画（エッチング）のような風景：細い線とハッチングで、山並み・噴煙の火山・高原・海・小さな駅を描く。
  // 色は紙の生成りに、陸 #F3ECE1・海 #DFECEA のうすい地を敷くだけ。線はインクの濃淡。
  const INK = '#2C2523', INK2 = '#5A4E45', INK3 = '#8A7D70', RULE = '#C8B9A6', BRASS = '#B8860B';
  // 決まった乱数（描き直しても同じ風景になるように）
  const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const n1 = (v) => (Math.round(v * 10) / 10).toString();
  // ある形の中だけに、平行のハッチングを引く
  function hatchIn(id, d, { step = 3, angle = 45, w = 0.5, color = INK2, op = 0.6, box = [0, 0, 800, 300] } = {}) {
    const [bx, by, bw, bh] = box;
    const cx = bx + bw / 2, cy = by + bh / 2, L = Math.hypot(bw, bh) / 2;
    const a = (angle * Math.PI) / 180, dx = Math.cos(a), dy = Math.sin(a);
    let p = '';
    for (let t = -L; t <= L; t += step) {
      const x0 = cx - dy * t, y0 = cy + dx * t;
      p += `M${n1(x0 - dx * L)},${n1(y0 - dy * L)}L${n1(x0 + dx * L)},${n1(y0 + dy * L)}`;
    }
    return `<clipPath id="${id}"><path d="${d}"/></clipPath><path clip-path="url(#${id})" d="${p}" fill="none" stroke="${color}" stroke-width="${w}" opacity="${op}"/>`;
  }
  function stageSvg() {
    const r = rng(29);
    // 空：上ほど濃い、横の細い彫り線（太陽のまわりはあける）
    let sky = '';
    for (let y = 8; y < 150; y += 4.2) {
      const op = Math.max(0.06, 0.42 - y / 330);
      const gap = Math.abs(y - 70) < 42 ? Math.sqrt(42 * 42 - (y - 70) ** 2) + 6 : 0;
      sky += gap ? `<path d="M0,${n1(y)} H${n1(650 - gap)} M${n1(650 + gap)},${n1(y)} H800" stroke="${INK3}" stroke-width=".45" opacity="${op.toFixed(2)}"/>` : `<path d="M0,${n1(y)} H800" stroke="${INK3}" stroke-width=".45" opacity="${op.toFixed(2)}"/>`;
    }
    const rays = Array.from({ length: 32 }, (_, i) => {
      const a = (i / 32) * Math.PI * 2, r1 = 30, r2 = i % 2 ? 36 : 40;
      return `M${n1(650 + Math.cos(a) * r1)},${n1(70 + Math.sin(a) * r1)}L${n1(650 + Math.cos(a) * r2)},${n1(70 + Math.sin(a) * r2)}`;
    }).join('');
    // 雲：輪郭の線と、下に数本のハッチング
    const cloud = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-30,6 C-36,6 -36,-4 -28,-4 C-28,-14 -12,-16 -8,-8 C-4,-18 14,-18 16,-6 C24,-8 30,0 24,6 Z" fill="#F4EFE6" stroke="${INK3}" stroke-width=".7"/><path d="M-22,3 H16 M-14,0 H8" stroke="${INK3}" stroke-width=".4" opacity=".7"/></g>`;
    // 遠い山並み・火山・高原
    const far = 'M0,168 C40,140 70,128 110,134 C150,140 170,112 210,108 C250,104 280,124 320,118 C360,112 380,100 420,112 L470,150 L800,150 L800,210 L0,210 Z';
    const volcano = 'M436,160 C462,132 492,104 512,94 L520,90 L532,90 L540,95 C560,108 590,136 618,160 Z';
    const volShade = 'M526,92 L540,95 C560,108 590,136 618,160 L540,160 C542,130 536,108 526,92 Z';
    const farTop = 'M0,168 C40,140 70,128 110,134 C150,140 170,112 210,108 C250,104 280,124 320,118 C360,112 380,100 420,112 L470,150';
    const ridgeTop = 'M560,160 C600,140 650,120 700,120 C740,120 770,116 800,122';
    const ridge = `${ridgeTop} L800,210 L560,210 Z`;
    const hill = 'M0,198 C80,170 150,166 230,180 C300,192 360,170 450,172 C540,174 600,186 680,178 C730,173 770,176 800,180 L800,232 L0,232 Z';
    const ticks = Array.from({ length: 70 }, () => {
      const x = r() * 800, y = 186 + r() * 40;
      return `M${n1(x)},${n1(y)} l1.4,-3.4 M${n1(x + 2.4)},${n1(y)} l-.8,-2.6`;
    }).join('');
    // 針葉樹と広葉樹（線とハッチング）
    const pine = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0,-22 L7,-8 L4,-8 L9,0 L-9,0 L-4,-8 L-7,-8 Z" fill="#F3ECE1" stroke="${INK2}" stroke-width=".7"/><path d="M0,-18 L0,4 M-3,-10 L3,-10 M-5,-3 L5,-3" stroke="${INK2}" stroke-width=".45"/></g>`;
    const tree = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0,0 V-8" stroke="${INK2}" stroke-width=".8"/><path d="M-8,-9 C-11,-17 -4,-23 1,-20 C6,-24 12,-17 9,-10 C10,-5 -6,-4 -8,-9 Z" fill="#F3ECE1" stroke="${INK2}" stroke-width=".7"/><path d="M2,-19 L7,-12 M4,-20 L9,-14 M0,-17 L5,-9" stroke="${INK2}" stroke-width=".4"/></g>`;
    // 海：長さのそろわない横の彫り線
    let sea = '';
    for (let y = 228; y < 248; y += 2.6) {
      let x = -10 + r() * 30;
      while (x < 800) {
        const len = 30 + r() * 90;
        sea += `M${n1(x)},${n1(y)}h${n1(len)}`;
        x += len + 6 + r() * 26;
      }
    }
    // 線路：枕木の輪郭と二本のレール
    const sleepers = Array.from({ length: 41 }, (_, i) => `<rect x="${i * 20 - 4}" y="258.6" width="11" height="7" fill="#E9DFCF" stroke="${INK2}" stroke-width=".55"/>`).join('');
    const ballast = Array.from({ length: 160 }, () => `<circle cx="${n1(r() * 800)}" cy="${n1(266 + r() * 8)}" r="${n1(0.4 + r() * 0.7)}"/>`).join('');
    const grass = Array.from({ length: 90 }, () => {
      const x = r() * 800, y = 280 + r() * 18;
      return `M${n1(x)},${n1(y)} q1,-4 2.6,-6 M${n1(x + 2)},${n1(y)} q.2,-3 -1,-5`;
    }).join('');
    return `<svg viewBox="0 0 800 300" preserveAspectRatio="xMinYMax slice" class="stage-svg" role="img" aria-label="いまの列車とアバターのプレビュー">
      <rect width="800" height="300" fill="#F4EFE6"/>
      ${sky}
      <circle cx="650" cy="70" r="26" fill="#F7EFD9" stroke="${BRASS}" stroke-width=".8"/><circle cx="650" cy="70" r="21" fill="none" stroke="${BRASS}" stroke-width=".4"/>
      <path d="${rays}" stroke="${BRASS}" stroke-width=".6"/>
      ${cloud(250, 52, 1.2)}${cloud(470, 34, 0.9)}${cloud(90, 84, 0.8)}
      <path d="${far}" fill="#EFE8DC"/>
      ${hatchIn('st-far', far, { step: 2.6, angle: 0, w: 0.4, color: INK3, op: 0.5 })}
      <path d="${farTop}" fill="none" stroke="${INK3}" stroke-width=".7"/>
      <path d="${ridge}" fill="#EFE8DC"/>
      ${hatchIn('st-rdg', ridge, { step: 2.6, angle: 0, w: 0.4, color: INK3, op: 0.5 })}
      <path d="${ridgeTop}" fill="none" stroke="${INK3}" stroke-width=".7"/>
      <g class="stage-smoke" fill="#F4EFE6" stroke="${INK3}" stroke-width=".6">
        <path d="M526,86 c-6,-2 -6,-10 1,-10 c0,-6 10,-6 10,0 c6,0 6,8 0,9 z"/>
        <path d="M534,66 c-8,-2 -8,-13 1,-13 c1,-8 13,-8 13,0 c8,0 8,11 0,12 z"/>
        <path d="M548,42 c-9,-2 -9,-15 1,-15 c1,-9 15,-9 15,0 c9,0 9,13 0,14 z"/>
      </g>
      <path d="${volcano}" fill="#F3ECE1" stroke="${INK2}" stroke-width=".8"/>
      ${hatchIn('st-vol', volShade, { step: 2.2, angle: 70, w: 0.5, color: INK2, op: 0.75 })}
      <path d="M512,94 C520,98 532,98 540,95 M520,90 C524,92 530,92 532,90" fill="none" stroke="${INK2}" stroke-width=".6"/>
      <path d="M490,120 L500,150 M470,140 L476,158 M560,126 L568,152" stroke="${INK2}" stroke-width=".45" opacity=".6"/>
      <path d="${hill}" fill="#F3ECE1" stroke="${INK2}" stroke-width=".8"/>
      ${hatchIn('st-hil', 'M0,212 C120,200 240,214 360,206 C480,198 620,214 800,204 L800,232 L0,232 Z', { step: 2.8, angle: 0, w: 0.4, color: INK3, op: 0.5 })}
      <path d="${ticks}" stroke="${INK2}" stroke-width=".45" opacity=".55" fill="none"/>
      ${pine(300, 190, 1)}${pine(316, 192, 0.8)}${pine(690, 186, 1.1)}${pine(708, 188, 0.85)}${tree(400, 180, 1)}${tree(560, 184, 0.9)}${tree(770, 182, 1)}
      <rect x="0" y="226" width="800" height="22" fill="#DFECEA"/>
      <path d="${sea}" stroke="#5F8A8B" stroke-width=".5" opacity=".7" fill="none"/>
      <path d="M0,226 H800" stroke="${INK2}" stroke-width=".6"/>
      <g class="stage-ship"><g transform="translate(610 236)">
        <path d="M-16,0 L16,0 L11,6 L-11,6 Z" fill="#F4EFE6" stroke="${INK2}" stroke-width=".8"/>
        <path d="M-1,0 V-20 M-1,-19 Q10,-10 2,0 M-1,-16 Q-10,-8 -4,0" fill="#FBF8F2" stroke="${INK2}" stroke-width=".7"/>
        <path d="M-12,3 H12" stroke="${INK2}" stroke-width=".4"/></g></g>
      <rect x="0" y="248" width="800" height="52" fill="#EFE6D6"/>
      <path d="M0,248 H800" stroke="${INK2}" stroke-width=".7"/>
      <g fill="${INK3}" opacity=".55">${ballast}</g>
      <path d="${grass}" stroke="${INK3}" stroke-width=".45" fill="none" opacity=".7"/>
      <g class="stage-track">${sleepers}
        <path d="M0,257.6 H800 M0,264.6 H800" stroke="${INK}" stroke-width="1.6"/><path d="M0,256.6 H800 M0,263.6 H800" stroke="#FBF8F2" stroke-width=".4" opacity=".7"/>
      </g>
      <g class="stage-fx"></g>
      <g class="stage-train"><g class="stage-car2"></g><g class="stage-car1"></g></g>
      <g class="stage-platform">
        <path d="M0,244 H196 L192,260 H0 Z" fill="#E9DFCF" stroke="${INK2}" stroke-width=".8"/>
        <path d="M0,247 H195" stroke="${INK2}" stroke-width=".5"/>
        ${[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => `<path d="M${i * 22 + 8},247 V260" stroke="${INK2}" stroke-width=".4"/>`).join('')}
        ${hatchIn('st-plt', 'M0,248 H195 L192,260 H0 Z', { step: 2, angle: 0, w: 0.35, color: INK3, op: 0.6, box: [0, 240, 200, 24] })}
        <path d="M6,244 V96 M184,244 V96" stroke="${INK2}" stroke-width="1.6"/>
        <path d="M-4,96 H196 L190,88 H2 Z" fill="#F3ECE1" stroke="${INK2}" stroke-width=".8"/>
        ${hatchIn('st-roof', 'M-4,96 H196 L190,88 H2 Z', { step: 1.8, angle: 0, w: 0.4, color: INK3, op: 0.7, box: [0, 84, 200, 16] })}
        <path d="M-4,96 ${Array.from({ length: 25 }, () => 'q4,5 8,0').join(' ')}" fill="#FBF8F2" stroke="${INK2}" stroke-width=".7"/>
        <path d="M6,104 L18,96 M184,104 L172,96" stroke="${INK2}" stroke-width=".8"/>
        <g transform="translate(166 150)">
          <path d="M0,0 V94" stroke="${INK2}" stroke-width="1.2"/>
          <path d="M-5,-10 H5 L3,0 H-3 Z" fill="#FBF8F2" stroke="${INK2}" stroke-width=".7"/><path d="M-6,-10 H6 L0,-15 Z" fill="#F3ECE1" stroke="${INK2}" stroke-width=".7"/>
          <circle cx="0" cy="-5" r="1.6" fill="#F7EFD9" stroke="${BRASS}" stroke-width=".5"/>
        </g>
        <g transform="translate(122 176)">
          <path d="M8,22 V68 M56,22 V68" stroke="#6E5D4F" stroke-width="1.2"/>
          <rect x="0" y="0" width="64" height="24" fill="#FAF6F0" stroke="#6E5D4F" stroke-width="1.2"/>
          <rect x="2.4" y="2.4" width="59.2" height="19.2" fill="none" stroke="#6E5D4F" stroke-width=".4"/>
          <text x="32" y="13.6" text-anchor="middle" font-size="10" letter-spacing="1.5" font-family="'Shippori Mincho', serif" font-weight="700" fill="${INK}">よりみち</text>
          <path d="M8,17.4 H56" stroke="#6E5D4F" stroke-width=".6"/>
          <text x="32" y="21" text-anchor="middle" font-size="3.6" letter-spacing=".6" font-family="'Shippori Mincho', serif" fill="${INK2}">ひだまり　・　たかはら</text>
        </g>
      </g>
      <g class="stage-avatar" transform="translate(16 104)"></g>
    </svg>`;
  }

  // 列車：左から入ってきて、しっとり減速してホームの先に止まり、しばらく停車してから加速して右へ出ていく。
  // 停車中もときどき煙突からトレイルを浮かべる。タブが見えているあいだだけ動かす。
  const S = 1.35; // 車両の縮尺
  const STOP_X = 452; // 1両目の中心の停車位置
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const easeIn = (t) => t * t * t;
  // 1周の時刻 t（ms）から、列車の位置と速さ（0〜1）を返す
  const CYCLE = [
    { d: 5200, from: -300, to: STOP_X, f: easeOut }, // 入線
    { d: 3000, from: STOP_X, to: STOP_X }, // 停車
    { d: 4600, from: STOP_X, to: 1120, f: easeIn }, // 発車
    { d: 700, from: 1120, to: 1120 }, // 次の列車まで
  ];
  const CYCLE_MS = CYCLE.reduce((n, c) => n + c.d, 0);
  function trainAt(t) {
    let rest = t % CYCLE_MS;
    for (const c of CYCLE) {
      if (rest <= c.d) {
        if (!c.f) return { x: c.from, v: 0 };
        const k = rest / c.d, e = c.f(k), e2 = c.f(Math.min(1, k + 0.01));
        return { x: c.from + (c.to - c.from) * e, v: Math.min(1, Math.abs(e2 - e) * 60) };
      }
      rest -= c.d;
    }
    return { x: STOP_X, v: 0 };
  }
  function runStage() {
    cancelAnimationFrame(raf);
    const svg = root.querySelector('.stage-svg');
    if (!svg) return;
    const train = svg.querySelector('.stage-train');
    const fx = svg.querySelector('.stage-fx');
    const still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (still) {
      train.setAttribute('transform', `translate(${STOP_X} 262)`);
      return;
    }
    let t0 = null, acc = 0, last = 0;
    const step = (now) => {
      if (!root.isConnected || root.closest('[hidden]')) return;
      if (t0 === null) t0 = now - 2600; // 最初から画面の中ほどに見えるよう、少し進めた位置から
      const { x, v } = trainAt(now - t0);
      const bob = Math.sin(now / 110) * 0.5 * v;
      train.setAttribute('transform', `translate(${x.toFixed(1)} ${(262 + bob).toFixed(1)})`);
      acc += now - last;
      last = now;
      // 走っているときは細かく、停車中はゆっくり浮かべる
      if (acc > (v > 0.05 ? 150 : 700) && x > -120 && x < 900) {
        acc = 0;
        const [cx, cy] = Craft.chimney(Craft.equipped().livery);
        Craft.spawnTrail(fx, x + cx * S, 262 + cy * S, undefined, 1.4, 1);
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }

  function drawStage() {
    const svg = root.querySelector('.stage-svg');
    if (!svg) return;
    svg.querySelector('.stage-car1').innerHTML = `<g transform="scale(${S})">${Craft.trainSvg()}</g>`;
    const c2 = Craft.carriageSvg();
    svg.querySelector('.stage-car2').innerHTML = c2 ? `<g transform="translate(${-128 * S} 0) scale(${S})">${c2}</g>` : '';
    svg.querySelector('.stage-avatar').innerHTML = `<g class="stage-avatar-bob">${Craft.avatarSvg(undefined, { id: 'stage' }).replace('<svg ', '<svg width="120" height="140" ')}</g>`;
  }

  // ---------- パーツの一覧（硬券の切符） ----------
  // 金額は Cormorant の数字に、単位だけ小さな和文で
  const price = (man) => `<span class="num">${Number(man).toLocaleString('ja-JP')}</span><small>万円</small>`;
  // 欄の欧文の見出し（タブの「03 / LOCOMOTIVE」に続く通し番号）
  const EN = { livery: 'LIVERY', carriage: 'CARRIAGE', trail: 'TRAIL', hat: 'HAT', outfit: 'ATTIRE', buddy: 'COMPANION' };

  function itemCard(slot, it, no) {
    const esc = api.esc;
    const eq = Craft.equipped()[slot] === it.id;
    const owned = Craft.owns(slot, it.id);
    const bal = Craft.balance();
    let btn;
    if (eq) btn = `<span class="part-state is-equipped">${I('check')}<span>装備中</span></span>`;
    else if (owned) btn = `<button class="part-btn" data-equip="${esc(slot)}:${esc(it.id)}">装備する</button>`;
    else if (bal >= it.price) btn = `<button class="part-btn is-buy" data-buy="${esc(slot)}:${esc(it.id)}">${price(it.price)}<span class="part-btn-ja">でアンロック</span></button>`;
    else btn = `<button class="part-btn is-short" data-buy="${esc(slot)}:${esc(it.id)}" aria-label="${esc(it.name)}：あと${api.yen(it.price - bal)}">${I('lock')}<span class="part-btn-price">${price(it.price)}</span><small>あと${api.yen(it.price - bal)}</small></button>`;
    return `<article class="part-card ${eq ? 'is-equipped' : ''} ${owned ? 'is-owned' : 'is-locked'}">
        <div class="part-thumb">${Craft.thumb(slot, it.id)}<span class="part-no num-it">No.${String(no).padStart(2, '0')}</span>${eq ? '<span class="part-seal" aria-hidden="true">装備中</span>' : ''}</div>
        <div class="part-info">
          <p class="part-name">${esc(it.name)}</p>
          <p class="part-desc">${esc(it.desc)}</p>
          ${it.ticket ? `<p class="part-perk">${I('ticket')}<span>よりみち切符が1日1枚ふえる</span></p>` : ''}
          <p class="part-price">${it.price ? price(it.price) : '<span class="part-free">初期装備</span>'}</p>
        </div>
        <div class="part-action">${btn}</div>
      </article>`;
  }

  function render() {
    if (!root) return;
    const esc = api.esc;
    const sections = mode === 'train' ? D.meta.craft.train : D.meta.craft.avatar;
    const perDay = Craft.ticketsPerDay();
    const hadStage = !!root.querySelector('.stage-svg');
    if (!hadStage) {
      root.innerHTML = `
        <header class="garage-head">
          <div>
            <p class="eyebrow garage-eyebrow"><i>03</i>/ LOCOMOTIVE<span>よりみち工房</span></p>
            <h2 class="garage-title">車両クラフト＆アバター</h2>
            <p class="garage-lead">貯めたクラフト資金で、列車を改造したり、旅人の装いを着せ替えたりできます。使っても総資産額（栄誉の記録）は減りません。</p>
          </div>
          <dl class="garage-wallet">
            <div><dt>${I('coins')}クラフト資金</dt><dd data-g-funds></dd></div>
            <div><dt>${I('ticket')}よりみち切符</dt><dd data-g-tickets></dd></div>
          </dl>
        </header>
        <div class="stage">${stageSvg()}<p class="stage-caption" data-g-caption></p></div>
        <div class="seg garage-seg" role="tablist" aria-label="工房の切り替え">
          <button class="seg-btn" role="tab" data-mode="train">${I('locomotive')}<span>鉄道クラフト工房</span></button>
          <button class="seg-btn" role="tab" data-mode="avatar">${I('hat')}<span>旅人アバター</span></button>
        </div>
        <div data-g-parts></div>
        <section class="earn-guide">
          <h3 class="sec-title">${I('coins')}クラフト資金の貯めかた</h3>
          <ul>
            <li>はじめての駅に着くと <b>よりみち発見ボーナス ${api.yen(D.meta.craft.discoveryBonus)}</b></li>
            <li>駅の出資額ランキングで <b>上位3名（共同株主）</b>に入ると、その駅の評価額（${api.yen(Math.min(...D.stations.map((s) => s.assetValue)))}〜${api.yen(Math.max(...D.stations.map((s) => s.assetValue)))}）を、上位3名の中での金額の割合で <b>配当</b>として受け取れます（1位ほど多い）</li>
            <li>クラフト資金はゲームの中だけのもので、お金の価値はありません</li>
          </ul>
        </section>`;
      drawStage();
    }
    root.querySelector('[data-g-funds]').innerHTML = `${api.yenBig(Craft.balance())}`;
    root.querySelector('[data-g-tickets]').innerHTML = perDay ? `1日 <b>${perDay}</b> 枚<small>（今日はあと ${Craft.ticketsLeft()} 枚）</small>` : '<small>高級車両・連結車両をアンロックすると使えます</small>';
    const eq = Craft.equipped();
    root.querySelector('[data-g-caption]').textContent = `${Craft.item('livery', eq.livery).name}${eq.carriage !== 'none' ? ` ＋ ${Craft.item('carriage', eq.carriage).name}` : ''} ／ ${Craft.item('trail', eq.trail).name}`;
    root.querySelectorAll('[data-mode]').forEach((b) => {
      b.classList.toggle('is-active', b.dataset.mode === mode);
      b.setAttribute('aria-selected', b.dataset.mode === mode);
    });
    const base = mode === 'train' ? 0 : D.meta.craft.train.length;
    root.querySelector('[data-g-parts]').innerHTML = sections
      .map(
        (sec, i) => `<section class="part-sec">
          <h3 class="sec-title part-sec-title">${I(sec.icon)}<span class="eyebrow"><i>03-${base + i + 1}</i>/ ${EN[sec.slot] || ''}</span><span class="part-sec-ja">${esc(sec.label)}</span></h3>
          <div class="part-grid">${sec.items.map((it, k) => itemCard(sec.slot, it, k + 1)).join('')}</div>
        </section>`
      )
      .join('');
  }

  // 変わったところに、金箔をすこし
  function sparkle(target) {
    if (!target) return;
    api.confetti(target, 14);
  }

  function onClick(e) {
    const m = e.target.closest('[data-mode]');
    if (m) {
      mode = m.dataset.mode;
      Sound.click();
      return render();
    }
    const eqBtn = e.target.closest('[data-equip]');
    if (eqBtn) {
      const [slot, id] = eqBtn.dataset.equip.split(':');
      Store.equip(slot, id);
      Sound.equip();
      afterChange();
      return;
    }
    const buyBtn = e.target.closest('[data-buy]');
    if (buyBtn) {
      const [slot, id] = buyBtn.dataset.buy.split(':');
      const it = Craft.item(slot, id);
      const r = Craft.buy(slot, id);
      if (!r.ok) {
        if (r.reason === 'short') {
          Sound.click();
          api.toast(`クラフト資金があと${api.yen(r.short)}足りません。駅を発見したり、共同株主になったりして貯めましょう`);
        }
        return;
      }
      Sound.craft();
      api.toast(`「${it.name}」をアンロックして装備しました`, 'toast-gold');
      if (r.ticketUp) setTimeout(() => api.toast(`よりみち切符が1日${Craft.ticketsPerDay()}枚に増えました（サイコロの目を±1できます）`, 'toast-green'), 900);
      afterChange();
    }
  }
  function afterChange() {
    drawStage();
    render();
    YT.Map.refreshTrain();
    api.renderAll();
    sparkle(root.querySelector('.stage'));
  }

  YT.Garage = {
    init(data, uiApi, el) {
      D = data;
      api = uiApi;
      root = el;
      root.addEventListener('click', onClick);
    },
    show() {
      render();
      runStage();
    },
    render,
  };
})();
