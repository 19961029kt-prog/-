// 「🚂 車両クラフト＆アバター」タブ：鉄道クラフト工房（My Train Garage）と旅人アバター着せ替え（Traveler Studio）。
// 真ん中のプレビューステージで、いまのアバターと改造した列車（1両目＋2両目）が九州の風景の前を走る。
// パーツを切り替えた瞬間に、見た目と効果音が変わる。
(function () {
  'use strict';
  const YT = (window.YT = window.YT || {});
  const { Store, Sound, Craft } = YT;

  let D = null;
  let api = null; // app.js から：{ esc, yen, yenBig, toast, renderAll, confetti }
  let root = null;
  let mode = 'train'; // 'train'（鉄道クラフト工房）| 'avatar'（旅人アバター）
  let raf = null;

  // ---------- プレビューステージ ----------
  // 九州の風景（山並み・噴煙の火山・海・高原）を描き、線路の上を列車がゆっくり走りぬける
  function stageSvg() {
    return `<svg viewBox="0 0 800 300" class="stage-svg" role="img" aria-label="いまの列車とアバターのプレビュー">
      <defs>
        <linearGradient id="st-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6e6cf"/><stop offset=".6" stop-color="#e7efe6"/><stop offset="1" stop-color="#d8ecea"/></linearGradient>
        <linearGradient id="st-sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bfe0df"/><stop offset="1" stop-color="#a9d2d0"/></linearGradient>
      </defs>
      <rect width="800" height="300" fill="url(#st-sky)"/>
      <circle cx="660" cy="70" r="30" fill="#f7d79a" opacity=".85"/>
      <path d="M0,170 Q60,120 130,140 T260,118 Q300,96 340,112 L400,150 Q470,108 540,126 T680,112 Q740,104 800,128 L800,210 L0,210 Z" fill="#c9d9bd"/>
      <path d="M470,150 L520,92 L536,96 L590,150 Z" fill="#b6c9a6"/>
      <g class="stage-smoke" fill="#fff" opacity=".85"><circle cx="528" cy="84" r="7"/><circle cx="538" cy="72" r="9"/><circle cx="552" cy="58" r="11"/></g>
      <path d="M0,196 Q120,160 240,182 T480,176 T800,180 L800,232 L0,232 Z" fill="#d5e2c8"/>
      <rect x="0" y="226" width="800" height="22" fill="url(#st-sea)"/>
      <path d="M10,234 q10,-4 20,0 t20,0 M200,238 q10,-4 20,0 t20,0 M520,236 q10,-4 20,0 t20,0 M690,240 q10,-4 20,0 t20,0" fill="none" stroke="#fff" stroke-width="1.4" opacity=".8"/>
      <g class="stage-ship" transform="translate(600 228)"><path d="M-16,2 L16,2 L11,8 L-11,8 Z" fill="#5f8f93"/><path d="M-1,1 L-1,-18 M-1,-17 Q9,-8 1,1" fill="none" stroke="#5f8f93" stroke-width="1.4"/></g>
      <rect x="0" y="248" width="800" height="52" fill="#efe3cc"/>
      <g class="stage-track">
        ${Array.from({ length: 41 }, (_, i) => `<rect x="${i * 20 - 4}" y="258" width="10" height="8" rx="1.5" fill="#b8a68e"/>`).join('')}
        <rect x="0" y="257" width="800" height="2.6" fill="#6e5d4f"/><rect x="0" y="264" width="800" height="2.6" fill="#6e5d4f"/>
      </g>
      <g class="stage-fx"></g>
      <g class="stage-train"><g class="stage-car2"></g><g class="stage-car1"></g></g>
      <g class="stage-platform"><rect x="0" y="246" width="190" height="14" rx="2" fill="#a88a68"/><rect x="0" y="244" width="190" height="4" fill="#c9ab84"/>
        ${[30, 70, 110, 150].map((x) => `<rect x="${x}" y="248" width="1.5" height="12" fill="#8a6d4e"/>`).join('')}
        <rect x="150" y="196" width="4" height="50" fill="#6e5d4f"/><rect x="128" y="186" width="48" height="16" rx="3" fill="#fffdf9" stroke="#6e5d4f" stroke-width="1.5"/>
        <text x="152" y="198" text-anchor="middle" font-size="9" font-family="serif" fill="#3a322b">よりみち駅</text></g>
      <g class="stage-avatar" transform="translate(16 104)"></g>
    </svg>`;
  }

  // 列車を左から右へ走らせ、走りながらトレイルを浮かべる（タブが見えているあいだだけ動かす）
  function runStage() {
    cancelAnimationFrame(raf);
    const svg = root.querySelector('.stage-svg');
    if (!svg) return;
    const train = svg.querySelector('.stage-train');
    const fx = svg.querySelector('.stage-fx');
    const S = 1.35; // 車両の縮尺
    const span = 800 + 360;
    let t0 = null, acc = 0, last = 0;
    const step = (now) => {
      if (!root.isConnected || root.closest('[hidden]')) return;
      if (t0 === null) t0 = now;
      const x = (((now - t0) * 0.09 + 520) % span) - 200; // 最初から画面の中ほどに見えるよう、少し進めた位置から
      const bob = Math.sin(now / 90) * 0.8;
      train.setAttribute('transform', `translate(${x.toFixed(1)} ${(262 + bob).toFixed(1)})`);
      acc += now - last;
      last = now;
      if (acc > 140) {
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
    const S = 1.35;
    svg.querySelector('.stage-car1').innerHTML = `<g transform="scale(${S})">${Craft.trainSvg()}</g>`;
    const c2 = Craft.carriageSvg();
    svg.querySelector('.stage-car2').innerHTML = c2 ? `<g transform="translate(${-128 * S} 0) scale(${S})">${c2}</g>` : '';
    svg.querySelector('.stage-avatar').innerHTML = `<g class="stage-avatar-bob">${Craft.avatarSvg(undefined, { id: 'stage' }).replace('<svg ', '<svg width="120" height="140" ')}</g>`;
  }

  // ---------- パーツの一覧 ----------
  function itemCard(slot, it) {
    const esc = api.esc;
    const eq = Craft.equipped()[slot] === it.id;
    const owned = Craft.owns(slot, it.id);
    const bal = Craft.balance();
    let btn;
    if (eq) btn = '<span class="part-state is-equipped">✓ 装備中</span>';
    else if (owned) btn = `<button class="part-btn" data-equip="${esc(slot)}:${esc(it.id)}">装備する</button>`;
    else if (bal >= it.price) btn = `<button class="part-btn is-buy" data-buy="${esc(slot)}:${esc(it.id)}">${api.yen(it.price)}でアンロック</button>`;
    else btn = `<button class="part-btn is-short" data-buy="${esc(slot)}:${esc(it.id)}" aria-label="${esc(it.name)}：あと${api.yen(it.price - bal)}">🔒 ${api.yen(it.price)}<small>あと${api.yen(it.price - bal)}</small></button>`;
    return `<article class="part-card ${eq ? 'is-equipped' : ''} ${owned ? 'is-owned' : 'is-locked'}">
        <div class="part-thumb">${Craft.thumb(slot, it.id)}</div>
        <div class="part-info">
          <p class="part-name">${esc(it.name)}</p>
          <p class="part-desc">${esc(it.desc)}</p>
          ${it.ticket ? '<p class="part-perk">🎫 よりみち切符が1日1枚ふえる</p>' : ''}
          <p class="part-price">${it.price ? api.yen(it.price) : '初期装備'}</p>
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
            <p class="card-kicker"><span>よりみち工房</span></p>
            <h2 class="garage-title">車両クラフト＆アバター</h2>
            <p class="garage-lead">貯めたクラフト資金で、列車を改造したり、旅人の装いを着せ替えたりできます。使っても総資産額（栄誉の記録）は減りません。</p>
          </div>
          <dl class="garage-wallet">
            <div><dt>クラフト資金</dt><dd data-g-funds></dd></div>
            <div><dt>よりみち切符</dt><dd data-g-tickets></dd></div>
          </dl>
        </header>
        <div class="stage">${stageSvg()}<p class="stage-caption" data-g-caption></p></div>
        <div class="seg" role="tablist" aria-label="工房の切り替え">
          <button class="seg-btn" role="tab" data-mode="train">🚂 鉄道クラフト工房</button>
          <button class="seg-btn" role="tab" data-mode="avatar">🎒 旅人アバター</button>
        </div>
        <div data-g-parts></div>
        <section class="earn-guide">
          <h3 class="sec-title"><span>💰</span>クラフト資金の貯めかた</h3>
          <ul>
            <li>はじめての駅に着くと <b>よりみち発見ボーナス ${api.yen(D.meta.craft.discoveryBonus)}</b></li>
            <li>オーナー刻印を押すと、その駅の <b>資産評価額（${api.yen(Math.min(...D.stations.map((s) => s.assetValue)))}〜${api.yen(Math.max(...D.stations.map((s) => s.assetValue)))}）</b></li>
          </ul>
        </section>`;
      drawStage();
    }
    root.querySelector('[data-g-funds]').innerHTML = `${api.yenBig(Craft.balance())}`;
    root.querySelector('[data-g-tickets]').innerHTML = perDay ? `1日 <b>${perDay}</b> 枚（今日はあと ${Craft.ticketsLeft()} 枚）` : '<small>高級車両・連結車両をアンロックすると使えます</small>';
    const eq = Craft.equipped();
    root.querySelector('[data-g-caption]').textContent = `${Craft.item('livery', eq.livery).name}${eq.carriage !== 'none' ? ` ＋ ${Craft.item('carriage', eq.carriage).name}` : ''} ／ ${Craft.item('trail', eq.trail).name}`;
    root.querySelectorAll('[data-mode]').forEach((b) => {
      b.classList.toggle('is-active', b.dataset.mode === mode);
      b.setAttribute('aria-selected', b.dataset.mode === mode);
    });
    root.querySelector('[data-g-parts]').innerHTML = sections
      .map(
        (sec) => `<section class="part-sec">
          <h3 class="sec-title"><span>${sec.icon}</span>${esc(sec.label)}</h3>
          <div class="part-grid">${sec.items.map((it) => itemCard(sec.slot, it)).join('')}</div>
        </section>`
      )
      .join('');
  }

  // 変わったところに、小さな紙吹雪
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
          api.toast(`💰 クラフト資金があと${api.yen(r.short)}足りません。駅を発見したり、オーナー刻印を押したりして貯めましょう`);
        }
        return;
      }
      Sound.craft();
      api.toast(`🔧 「${it.name}」をアンロックして装備しました！`, 'toast-gold');
      if (r.ticketUp) setTimeout(() => api.toast(`🎫 よりみち切符が1日${Craft.ticketsPerDay()}枚に増えました（サイコロの目を±1できます）`, 'toast-green'), 900);
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
