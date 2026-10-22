// UI全体の結線：ヘッダー（称号・踏破率・総資産額・クラフト資金・アバター）・よりみちダイス・寄り道手帖（モーダル）・
// 購入実績ランキング・王座交代の演出・オーナー刻印手帖（切手・レシートアルバム）・マイ旅しおり・Xシェア。
// 立候補（スクショの読み取り）は owner.js、順位の計算は ownership.js、工房は garage.js。
(function () {
  'use strict';
  const { Data, Store, Sound, Map, Trip, Craft, Dice, Owner, Garage, Ownership, Receipts, Scenery, Postcards, ShareCard, Game } = window.YT;

  let D = null;
  let busy = false; // 列車走行中・ダイス回転中
  let choice = null; // ダイスのあと、よりみち切符で出目を変えられるあいだ { n }
  let modalStationId = null;
  let lastFocus = null;

  const $ = (sel, root = document) => root.querySelector(sel);
  const I = (name, opts) => YT.Icon.svg(name, opts); // 線画のアイコン（絵文字は使わない）
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const yen = (man) => `${Number(man).toLocaleString('ja-JP')}万円`;
  // 1億以上は「1億2,000万円」と読みやすく
  const yenBig = (man) => {
    if (man < 10000) return yen(man);
    const oku = Math.floor(man / 10000), rest = man % 10000;
    return `${oku}億${rest ? rest.toLocaleString('ja-JP') + '万' : ''}円`;
  };
  const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);
  const yenJP = (v) => `¥${Number(v).toLocaleString('ja-JP')}`;
  // 大きな金額は欧文の組み（¥ 150,000,000）で。万円の値を円になおす
  const yenFull = (man) => `¥ ${(Number(man) * 10000).toLocaleString('en-US')}`;
  const fmtDate = (iso) => {
    const d = new Date(iso);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  };

  // ---------- 指標 ----------
  function stats() {
    const st = Store.get();
    const n = D.stations.length;
    const visited = D.stations.filter((s) => st.visited[s.id]).length;
    const acquired = D.stations.filter((s) => st.acquired[s.id]);
    const assets = acquired.reduce((sum, s) => sum + s.assetValue, 0);
    return { n, visited, visitedPct: pct(visited, n), acquiredCount: acquired.length, acquiredPct: pct(acquired.length, n), assets, funds: Craft.balance() };
  }

  // 数字のカウントアップ
  const tweens = new WeakMap();
  function countTo(elm, to, format) {
    const from = Number(elm.dataset.value || 0);
    elm.dataset.value = to;
    if (from === to) {
      elm.textContent = format(to);
      return;
    }
    cancelAnimationFrame(tweens.get(elm));
    const t0 = performance.now();
    elm.classList.add('is-counting');
    const step = (now) => {
      const t = Math.min(1, (now - t0) / 900);
      elm.textContent = format(Math.round(from + (to - from) * (1 - Math.pow(1 - t, 3))));
      if (t < 1) tweens.set(elm, requestAnimationFrame(step));
      else elm.classList.remove('is-counting');
    };
    tweens.set(elm, requestAnimationFrame(step));
  }

  function renderHeader() {
    const s = stats();
    const num = (v) => v.toLocaleString('ja-JP');
    countTo($('#stat-visited'), s.visitedPct, (v) => `${v}%`);
    countTo($('#stat-assets'), s.assets, num);
    countTo($('#stat-funds'), s.funds, num);
    $('#stat-visited-bar').style.width = `${s.visitedPct}%`;
    $('#stat-visited-sub').textContent = `${s.visited}/${s.n}駅`;
    $('#hdr-avatar').innerHTML = Craft.avatarSvg(undefined, { crop: true });
    $('#hdr-name').textContent = Ownership.youName();
  }

  function renderCurrent() {
    const st = Store.get();
    const s = D.byId[st.currentStationId];
    if (!s) return;
    $('#current-name').innerHTML = `${esc(s.name)}<small>駅</small>`;
    $('#current-pref').textContent = s.prefecture;
    $('#current-pref').style.setProperty('--pref', (D.meta.prefectures[s.prefecture] || {}).color);
    $('#current-tagline').textContent = s.tagline;
    $('#current-status').innerHTML = rankChip(s.id);
    // 手配中の駅を別の駅で忘れないよう、パネルの下に小さく出す
    const p = Owner.pending();
    const chip = $('#pending-chip');
    chip.hidden = !p;
    if (!chip.hidden) {
      chip.innerHTML = `<span>${I('compass')} <b>${esc(D.byId[p.stationId].name)}駅</b>を${esc(p.provider)}で視察・手配中</span><button class="link-btn" data-candidacy-open="${esc(p.stationId)}">スクショで立候補する</button>`;
    }
  }

  function renderAll() {
    Map.refresh(Store.get());
    renderHeader();
    renderCurrent();
    renderMini();
    renderTickets();
    renderTripCta();
    renderRank();
    if (!$('[data-view="collection"]').hidden) renderCollection();
    if (!$('[data-view="garage"]').hidden) Garage.render();
    if (!$('[data-view="letters"]').hidden) Postcards.render();
    Game.render();
    renderDiceHint();
  }
  // ダイスのボタンの字：特別切符を使うときは、何個振るかを書く
  function renderDiceHint() {
    const plan = Game.nextRoll();
    $('#btn-dice').innerHTML = plan.pick
      ? `${I('target')} ピタリ指定切符で出目を選ぶ`
      : plan.count > 1
        ? `${I(plan.count === 2 ? 'dice2' : 'dice3')} ダイス${plan.count}個を同時に振る`
        : `${I('dice')} よりみちダイスを振る`;
  }

  // ---------- 称号（トップオーナーの駅の評価額の合計でランクアップ） ----------
  // meta.ranks：九州旅人 ➔ 九州開拓使 ➔ 九州大名 ➔ 九州鉄道王。min は総資産額（万円）のしきい値
  const ranks = () => D.meta.ranks;
  function rankInfo(assets) {
    const list = ranks();
    let index = 0;
    list.forEach((r, i) => assets >= r.min && (index = i));
    const rank = list[index];
    const next = list[index + 1] || null;
    const progress = next ? (assets - rank.min) / (next.min - rank.min) : 1;
    return { index, rank, next, toNext: next ? next.min - assets : 0, progress };
  }

  function emblemHtml(rank, size = '') {
    const i = ranks().indexOf(rank);
    return `<span class="emblem emblem-${esc(rank.metal)} ${size ? `emblem-${size}` : ''}" aria-hidden="true">
        <span class="emblem-ribbon"></span>
        <span class="emblem-face"><span class="emblem-icon">${I(rank.icon)}</span></span>
        <span class="emblem-stars">${I('star').repeat(i + 1)}</span>
      </span>`;
  }

  function renderRank() {
    const { assets } = stats();
    const info = rankInfo(assets);
    $('#rank-chip-emblem').innerHTML = emblemHtml(info.rank, 'sm');
    $('#rank-chip-title').textContent = info.rank.title;
    $('#rank-chip-bar').style.width = `${Math.round(info.progress * 100)}%`;
    $('#rank-chip').className = `rank-chip rank-${info.rank.metal}`;
    $('#rank-chip').setAttribute('aria-label', `称号 ${info.rank.title}${info.next ? `。次の「${info.next.title}」まであと${yenBig(info.toNext)}` : '。最高位です'}`);
    $('#rank-ladder').innerHTML = `
      <div class="ladder-head">
        <h3 class="ladder-title">称号の道</h3>
        <p class="ladder-next">${
          info.next
            ? `次の称号「<b>${esc(info.next.title)}</b>」まで、トップオーナーの駅の資産あと <b>${yenBig(info.toNext)}</b>`
            : '最高位「九州鉄道王」に到達しました。九州のレールは、どこまでもあなたの旅路です'
        }</p>
      </div>
      <ol class="ladder">
        ${ranks()
          .map((r, i) => {
            const state = i < info.index ? 'is-done' : i === info.index ? 'is-current' : 'is-locked';
            const note = i < info.index ? '達成' : i === info.index ? 'いまの称号' : `あと${yenBig(r.min - assets)}`;
            return `<li class="ladder-step ${state}">
                ${emblemHtml(r, 'md')}
                <p class="ladder-name">${esc(r.title)}</p>
                <p class="ladder-min">${r.min ? `総資産 ${yenBig(r.min)}〜` : 'スタート'}</p>
                <p class="ladder-note">${note}</p>
              </li>`;
          })
          .join('')}
      </ol>
      <div class="ladder-bar"><i style="width:${Math.min(100, (assets / D.totalAsset) * 100)}%"></i>
        ${ranks().slice(1).map((r) => `<span class="ladder-mark" style="left:${(r.min / D.totalAsset) * 100}%"></span>`).join('')}
      </div>`;
  }

  // 既存データ（rankSeen 未設定）は、いまの称号を「見せ済み」としてそろえる（読み込み直後に演出を出さない）
  function syncRankSeen() {
    if (Store.get().rankSeen === null) Store.setRankSeen(rankInfo(stats().assets).index);
  }

  // トップオーナーになるたびに呼ぶ：称号が上がっていたらカットインを出す
  function checkRankUp(delay) {
    const before = Store.get().rankSeen ?? 0;
    const now = rankInfo(stats().assets).index;
    if (now <= before) return;
    Store.setRankSeen(now);
    setTimeout(() => cutIn(before, now), delay);
  }

  let cutinTimer = null;
  function cutIn(fromIndex, toIndex) {
    const from = ranks()[fromIndex], rank = ranks()[toIndex];
    const { assets } = stats();
    const layer = $('#cutin');
    const chars = [...rank.title].map((c, i) => `<span style="--c:${i}">${esc(c)}</span>`).join('');
    const share = shareUrl(`【称号ランクアップ】九州の駅のトップオーナーになりつづけて、称号「${rank.title}」になりました！\n総資産 ${yenBig(assets)}`);
    layer.className = `cutin rank-${rank.metal}`;
    layer.innerHTML = `
      <div class="cutin-band" role="alertdialog" aria-labelledby="cutin-title" aria-describedby="cutin-flavor">
        <div class="cutin-inner">
          <div class="cutin-emblem">${emblemHtml(rank, 'xl')}</div>
          <div class="cutin-text">
            <p class="cutin-kicker">称号がひとつ上がりました</p>
            <p class="cutin-from">${esc(from.title)} ${I('arrow')}</p>
            <h2 id="cutin-title" class="cutin-title" aria-label="${esc(rank.title)}">${chars}</h2>
            <p id="cutin-flavor" class="cutin-flavor">${esc(rank.flavor)}</p>
          </div>
        </div>
      </div>
      <div class="cutin-confetti" aria-hidden="true"></div>
      <div class="cutin-actions">
        <a class="share-btn" href="${esc(share)}" target="_blank" rel="noopener" data-cutin-share><span class="x-logo">𝕏</span>称号をシェア</a>
        <button class="ghost-btn ghost-light" data-cutin-close>閉じる</button>
      </div>`;
    layer.hidden = false;
    confetti($('.cutin-confetti', layer), 36);
    Sound.rankUp();
    requestAnimationFrame(() => layer.classList.add('is-open'));
    $('[data-cutin-close]', layer).focus({ preventScroll: true });
    clearTimeout(cutinTimer);
    cutinTimer = setTimeout(closeCutIn, 7000);
    $('[data-cutin-share]', layer).addEventListener('click', () => clearTimeout(cutinTimer));
    layer.onclick = (e) => {
      if (!e.target.closest('[data-cutin-share]')) closeCutIn();
    };
    renderRank();
    const chip = $('#rank-chip');
    chip.classList.remove('is-ranked-up');
    void chip.offsetWidth;
    chip.classList.add('is-ranked-up');
  }

  function closeCutIn() {
    const layer = $('#cutin');
    if (layer.hidden) return;
    clearTimeout(cutinTimer);
    layer.classList.remove('is-open');
    setTimeout(() => {
      layer.hidden = true;
      layer.innerHTML = '';
    }, 300);
  }

  // ---------- 金箔の舞（紙吹雪の代わり） ----------
  // 原色の紙片はやめ、金箔・真鍮のリーフが、ひらりと裏返りながらゆっくり落ちていく
  const LEAF = ['#d4af37', '#e6c665', '#faf0ca', '#c59b27', '#b8860b'];
  function confetti(container, n = 28) {
    if (!container) return;
    const box = document.createElement('div');
    box.className = 'gold-leaf';
    box.setAttribute('aria-hidden', 'true');
    const count = Math.round(n * 0.7); // 金箔は数を控えめにして、一枚ずつの舞を見せる
    box.innerHTML = Array.from({ length: count }, () => {
      const c = LEAF[Math.floor(Math.random() * LEAF.length)];
      const dur = 3.4 + Math.random() * 2.2;
      return `<i style="--c:${c};--x:${(Math.random() * 100).toFixed(1)}%;--dx:${((Math.random() - 0.5) * 120).toFixed(0)}px;--d:${(Math.random() * 0.9).toFixed(2)}s;--t:${dur.toFixed(2)}s;--r:${(Math.random() * 300 - 150).toFixed(0)}deg;--w:${(6 + Math.random() * 7).toFixed(1)}px"></i>`;
    }).join('');
    container.appendChild(box);
    setTimeout(() => box.remove(), 6600);
  }

  // ---------- ミニ手帖（右側） ----------
  let miniShown = null;
  function renderMini() {
    const st = Store.get();
    const s = stats();
    const owned = D.stations.filter((stn) => st.acquired[stn.id]).sort((a, b) => st.acquired[b.id].at.localeCompare(st.acquired[a.id].at));
    $('#mini-count').textContent = `${s.acquiredCount} / ${s.n}`;
    $('#mini-assets').textContent = yenBig(s.assets);
    $('#mini-grid').innerHTML = owned.length
      ? owned.map((stn) => stampCard(stn, st.acquired[stn.id], 'mini', miniShown && !miniShown.has(stn.id) ? 'is-new' : '')).join('')
      : '<p class="mini-empty">寄り道手帖のボタンからお買い物・予約をして、完了画面のスクショで立候補し、購入実績で1位になると、ここにトップオーナーの切手が増えていきます。</p>';
    miniShown = new Set(owned.map((stn) => stn.id));
  }

  // ---------- トースト ----------
  // 知らせの札。種類ごとに、頭に小さな線画のしるし（金＝印、緑＝切符、ふつう＝しおり）
  const TOAST_ICON = { 'toast-gold': 'seal', 'toast-green': 'ticket' };
  function toast(msg, kind = '', icon) {
    const box = $('#toasts');
    const t = document.createElement('div');
    t.className = `toast ${kind}`;
    t.innerHTML = `${I(icon || TOAST_ICON[kind] || 'info')}<span>${esc(msg)}</span>`;
    box.appendChild(t);
    setTimeout(() => t.classList.add('is-out'), 3200);
    setTimeout(() => t.remove(), 3700);
  }

  function setGuide(html) {
    $('#guide').innerHTML = html;
  }
  const IDLE_GUIDE = 'よりみちダイスを振って旅をつづけましょう。地図の駅をタップすると、望遠鏡でのぞけます。';

  // ---------- 移動（よりみちダイスで1駅ずつ。駅を直接タップしても列車は動かない） ----------
  // move = { n（出目）, left（残りのマス）, at（列車のいる駅）, seen（この移動で通った駅。同じ駅を二度通らない）, waiting（分かれ道の候補） }
  let move = null;

  function setBusy(on) {
    busy = on;
    document.body.classList.toggle('is-busy', on);
    $('#btn-dice').disabled = on || !!choice;
  }

  // ダイスのあと：すぐ出発する（よりみち切符が残っていれば、±1 を選んでから「出発する」）
  function startMove(n) {
    clearChoice();
    const cur = Store.get().currentStationId;
    move = { n, left: n, at: cur, seen: new Set([cur]), waiting: null };
    setBusy(true);
    Sound.depart();
    showBoardCenter();
    // 走り出す瞬間に、カメラが列車のまわりへズームインして追いかける
    Map.followStart().then(() => advance());
  }

  // カメラは列車を盤面の真ん中に置くので、盤面の真ん中が画面から外れていたら（スマホでダイスの欄まで下りているときなど）そこまで送る
  function showBoardCenter() {
    const r = $('.map-board').getBoundingClientRect();
    const mid = r.top + r.height / 2, top = 90, bottom = window.innerHeight - 40;
    if (mid >= top && mid <= bottom) return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollBy({ top: mid - window.innerHeight / 2, behavior: reduce ? 'auto' : 'smooth' });
  }

  // 分かれ道か、残りのマスが0になるか、行き止まりまで、まとめて走る（つながった区間はなめらかに1本で走る）
  async function advance(first) {
    const path = [move.at];
    const stepTo = (id) => {
      path.push(id);
      move.at = id;
      move.seen.add(id);
      move.left -= 1;
    };
    if (first) stepTo(first);
    while (move.left > 0) {
      const opts = [...(D.adj[move.at] || [])].filter((id) => !move.seen.has(id));
      if (!opts.length) break; // 行き止まり：届くところまで
      if (opts.length > 1) {
        if (path.length > 1) await run(path);
        return askDirection(opts);
      }
      stepTo(opts[0]);
    }
    if (path.length > 1) await run(path);
    finishMove();
  }

  function run(path) {
    setGuide(`${I('train')} <b>${esc(D.byId[path[path.length - 1]].name)}</b>方面へ走行中…（あと${move.left}マス）`);
    return Map.moveTrain(path, {
      onJoint: (k) => Sound.railJoint(k),
      onPass: (id) => Scenery.pass(id),
      onFx: (x, y, seg) => Scenery.trainFx(x, y, seg.to),
      follow: true,
    });
  }

  // 方角の矢印（盤面の上が北）。8方位に丸めた線画の矢印を、その向きに回す
  function arrowOf(a, b) {
    const [ax, ay] = Map.stationXY(a), [bx, by] = Map.stationXY(b);
    return I('arrow', { rotate: YT.Icon.arrowDeg(bx - ax, by - ay) });
  }
  // 「由布院・大分方面」：隣の駅と、その先にひとつ道が続くならその駅も
  function directionLabel(from, to) {
    const seen = new Set([from, to]);
    let at = to, far = null;
    for (let i = 0; i < 3; i++) {
      const next = [...(D.adj[at] || [])].filter((x) => !seen.has(x));
      if (next.length !== 1) break;
      far = next[0];
      seen.add(far);
      at = far;
    }
    return `${D.byId[to].name}${far ? '・' + D.byId[far].name : ''}方面`;
  }

  // 分かれ道：行き先がそろって見える角度でカメラを止め、それぞれの路線の少し先に「（矢印）由布院・大分方面」のボタンを出す
  async function askDirection(opts) {
    move.waiting = opts;
    Map.setCandidates(opts);
    await Map.frame([move.at, ...opts]);
    if (!move || move.waiting !== opts) return;
    placeDirButtons(opts);
    Sound.click();
    // 同じ選択肢を、ダイスの欄にも一覧で出す（地図のボタンが重なったり、画面の外に出たりしても選べるように）
    setGuide(
      `${I('route')} <b>${esc(D.byId[move.at].name)}駅</b>は分かれ道。あと<b>${move.left}</b>マス、進む路線を選んでください。` +
        `<span class="dir-list">${opts.map((id) => `<button class="dir-chip" data-dir="${esc(id)}">${arrowOf(move.at, id)} ${esc(directionLabel(move.at, id))}</button>`).join('')}</span>`
    );
    const btn = $('#map-overlay .dir-btn');
    if (btn) btn.focus({ preventScroll: true });
  }
  // 地図の上の行き先ボタン（カメラが動いたら置き直す）
  function placeDirButtons(opts) {
    const layer = $('#map-overlay');
    layer.innerHTML = opts
      .map((id) => {
        const [x, y] = Map.along(move.at, id, 64 / Math.max(1, Map.camera().get().z * 0.8));
        const { left, top } = Map.toBoard(x, y);
        const e = D.edgeOf(move.at, id);
        return `<button class="dir-btn" data-dir="${esc(id)}" style="left:${left.toFixed(0)}px;top:${top.toFixed(0)}px">
            <span class="dir-arrow" aria-hidden="true">${arrowOf(move.at, id)}</span>${esc(directionLabel(move.at, id))}${e && e.name ? `<small>${esc(e.name)}</small>` : ''}
          </button>`;
      })
      .join('');
    layer.hidden = false;
    // 今いる駅のしるしは隠さない（動かない障害物として、ボタンだけを押しのける）
    const here = Map.toBoard(D.byId[move.at].x, D.byId[move.at].y);
    spreadButtons(layer, [{ x: here.left, y: here.top, w: 84, h: 54 }]); // 駅名の字のぶんも少し広めに
  }
  // 行き先ボタンが重なったら、互いに押しのけて離す（盤面の枠からははみ出さない）
  function spreadButtons(layer, fixed = []) {
    const W = layer.clientWidth, H = layer.clientHeight;
    const btns = [...layer.querySelectorAll('.dir-btn')].map((el) => ({ el, x: parseFloat(el.style.left), y: parseFloat(el.style.top), w: el.offsetWidth + 6, h: el.offsetHeight + 6 }));
    const items = [...btns, ...fixed.map((f) => ({ ...f, fixed: true }))];
    for (let it = 0; it < 80; it++) {
      let moved = false;
      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          const a = items[i], b = items[j];
          if (a.fixed && b.fixed) continue;
          const ox = (a.w + b.w) / 2 - Math.abs(a.x - b.x), oy = (a.h + b.h) / 2 - Math.abs(a.y - b.y);
          if (ox <= 0 || oy <= 0) continue;
          moved = true;
          // 重なりの少ない向き（たいていは縦）にずらす。ふたつとも動けるなら半分ずつ、片方が駅なら動ける側だけ
          const ka = a.fixed ? 0 : b.fixed ? 2 : 1, kb = b.fixed ? 0 : a.fixed ? 2 : 1;
          if (oy < ox) {
            const d = (oy / 2 + 1) * (a.y <= b.y ? -1 : 1);
            a.y += d * ka;
            b.y -= d * kb;
          } else {
            const d = (ox / 2 + 1) * (a.x <= b.x ? -1 : 1);
            a.x += d * ka;
            b.x -= d * kb;
          }
        }
      }
      btns.forEach((b) => {
        b.x = Math.max(b.w / 2 + 4, Math.min(W - b.w / 2 - 4, b.x));
        b.y = Math.max(b.h / 2 + 4, Math.min(H - b.h / 2 - 4, b.y));
      });
      if (!moved) break;
    }
    btns.forEach((b) => {
      b.el.style.left = `${b.x.toFixed(0)}px`;
      b.el.style.top = `${b.y.toFixed(0)}px`;
    });
  }
  function pickDirection(id) {
    if (!move || !move.waiting || !move.waiting.includes(id)) return;
    move.waiting = null;
    $('#map-overlay').innerHTML = '';
    $('#map-overlay').hidden = true;
    Map.setCandidates(null);
    // カメラが寄るあいだも、選んだ方面をすぐ見せる（古い行き先ボタンを残さない）
    setGuide(`${I('train')} <b>${esc(D.byId[id].name)}</b>方面へ出発…`);
    Sound.click();
    showBoardCenter(); // 下の欄の行き先ボタンで選んだときも、走る列車が見えるように
    Map.followStart().then(() => advance(id)); // 選んだ方向へ、また列車を追いかける
  }

  function finishMove() {
    const { at, n, left } = move;
    move = null;
    setBusy(false);
    arrive(at, n - left, left > 0);
  }

  function landAt(id) {
    const s = D.byId[id];
    const first = Store.visit(id);
    Sound.arrive();
    Scenery.arrive(id);
    renderAll();
    if (first) {
      setTimeout(() => {
        Sound.coin();
        toast(`${s.name}駅に初めて到着！ よりみち発見ボーナス ＋${yen(D.meta.craft.discoveryBonus)}（クラフト資金）`, 'toast-gold');
      }, 500);
    }
  }
  // 止まった駅：スポットライト駅のピタ止め・切符・サプライズ・週末の精算・ライン制覇（js/game.js）を順に見せてから、寄り道手帖をひらく
  async function arrive(id, hops, deadEnd) {
    const s = D.byId[id];
    setBusy(true);
    landAt(id);
    setGuide(`<b>${esc(s.name)}駅</b>に到着（${hops}マス${deadEnd ? '・線路の果てで止まりました' : ''}）。寄り道手帖と現地スナップが解放されました。`);
    await Promise.all([Map.arriveZoom(id), new Promise((r) => setTimeout(r, 500))]);
    await arrivalTitle(s);
    const at = await Game.afterArrival(id);
    setBusy(false);
    renderAll();
    openModal(at);
  }
  // 到着のタイトル：映画のタイトルバックのように、縦書きの駅名と情緒の一文を、しっとり浮かべて消す（タップ・キーで飛ばせる）
  function arrivalTitle(s) {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const el = document.createElement('div');
    el.className = 'arrival';
    el.setAttribute('role', 'status');
    el.innerHTML = `<div class="arrival-inner">
        <p class="arrival-tate">${esc(s.tagline)}</p>
        <div class="arrival-name"><span class="arrival-no">Arrival — No. ${String(D.stations.indexOf(s) + 1).padStart(2, '0')}</span><b>${esc(s.name)}</b><span class="arrival-kana">${esc(s.kana)}</span></div>
      </div>`;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('is-open'));
    confetti(el, 22);
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        el.classList.remove('is-open');
        el.classList.add('is-closing');
        document.removeEventListener('keydown', finish);
        setTimeout(() => {
          el.remove();
          resolve();
        }, reduce ? 0 : 520);
      };
      el.addEventListener('click', finish);
      document.addEventListener('keydown', finish);
      setTimeout(finish, reduce ? 500 : 2100);
    });
  }
  // サプライズのワープ：列車を別の駅へ（その駅に止まったことにする）
  async function warpTo(id) {
    Map.placeTrain(id);
    landAt(id);
    setGuide(`${I('volcano')} 上昇気流に乗って、<b>${esc(D.byId[id].name)}駅</b>へひとっ飛び！`);
    await new Promise((r) => setTimeout(r, 900));
  }

  // 駅をタップ：分かれ道ならその方面へ。いまいる駅なら手帖、それ以外は望遠鏡でのぞくだけ（移動しない）
  function onStationClick(id) {
    Sound.unlock();
    if (move && move.waiting) {
      if (move.waiting.includes(id)) return pickDirection(id);
      toast('分かれ道です。地図のボタンか、波紋の駅から進む路線を選んでください');
      return;
    }
    if (busy) return;
    const cur = Store.get().currentStationId;
    if (id === cur) return openModal(id);
    showScope(id);
  }

  // 望遠鏡：まだ止まっていない駅（と、通りすぎた駅）を小さな手帖の吹き出しでのぞく
  function showScope(id) {
    const s = D.byId[id];
    const cur = Store.get().currentStationId;
    const path = Data.shortestPath(D, cur, id);
    const hops = path ? path.length - 1 : null;
    const top = Ownership.owner(id);
    const visited = Store.isVisited(id);
    const [x, y] = Map.stationXY(id);
    const { left, top: ty } = Map.toBoard(x, y);
    const box = $('#map-scope');
    box.innerHTML = `
      <button class="scope-x" data-scope-close aria-label="閉じる">×</button>
      <p class="scope-title">${I(visited ? 'here' : 'lock')} <b>${esc(s.name)}駅</b>${hops ? `<small>（現在地から約${hops}マス）</small>` : ''}</p>
      <p class="scope-owner">いまのトップオーナー：${esc(top.userName)}（累計${yenJP(top.totalAmount)}）</p>
      <p class="scope-note">${visited ? '訪れたことのある駅です。手帖は読めますが、手配と立候補はこの駅に停車中だけです。' : '※ダイスを振ってこの駅に停車すると、寄り道手帖と現地スナップが解放されます'}</p>
      ${visited ? `<button class="link-btn" data-read-techo="${esc(id)}">${I('book')} 手帖を読む（閲覧のみ）</button>` : ''}`;
    box.hidden = false;
    const w = box.offsetWidth, bw = box.parentElement.clientWidth;
    box.style.left = `${Math.max(8, Math.min(bw - w - 8, left - w / 2)).toFixed(0)}px`;
    box.style.top = `${Math.max(8, ty + 22).toFixed(0)}px`;
    box.classList.toggle('is-above', ty + 22 + box.offsetHeight > box.parentElement.clientHeight);
    if (box.classList.contains('is-above')) box.style.top = `${Math.max(8, ty - box.offsetHeight - 22).toFixed(0)}px`;
    Sound.click();
  }
  function hideScope() {
    $('#map-scope').hidden = true;
  }

  function clearChoice() {
    choice = null;
    Map.setCandidates(null);
    $('#btn-dice').disabled = busy;
    $('#dice-badge').hidden = true;
    renderTickets();
  }

  // ---------- よりみちダイス ----------
  // 特別切符（js/game.js）を使うと、2〜4個を同時に振る。ピタリ指定切符は出目を選ぶ
  async function rollDice() {
    if (busy || choice) return;
    Sound.unlock();
    hideScope();
    const plan = Game.nextRoll();
    let values;
    if (plan.pick) {
      const v = await Game.pickNumber();
      if (!v) return; // やめた：切符は使わない
      plan.consume();
      values = [v];
    } else {
      plan.consume();
      values = Array.from({ length: plan.count }, () => 1 + Math.floor(Math.random() * 6));
    }
    busy = true;
    $('#btn-dice').disabled = true;
    $('#dice-result').textContent = '…';
    Sound.diceShake();
    if (values.length > 1) {
      Sound.diceShake();
      await Dice.rollMany(values, (s) => Sound.diceHit(s));
    } else await Dice.roll(values[0], (s) => Sound.diceHit(s));
    Sound.diceSettle();
    Store.countRoll();
    busy = false;
    confetti($('#dice-confetti'), 24 + values.length * 10);
    Game.render();
    showResult(values.reduce((a, b) => a + b, 0), values, plan.label);
  }

  // 出目 n を見せる。よりみち切符が残っていれば、すぐには出発せず ±1 を選べるようにする
  function showResult(n, values = [n], label = '') {
    $('#dice-result').textContent = `${n}`;
    const badge = $('#dice-badge');
    badge.classList.toggle('is-multi', values.length > 1);
    badge.innerHTML = values.length > 1
      ? `${label ? `<small>${esc(label)}</small>` : ''}<span class="db-sum">${values.join('＋')}＝</span><b>${n}</b>！！<span class="db-go">${n}マスすすむ！</span>`
      : `${label ? `<small>${esc(label)}</small>` : ''}<b>${n}</b>マスすすむ！`;
    badge.hidden = false;
    badge.classList.remove('is-pop');
    void badge.offsetWidth;
    badge.classList.add('is-pop');
    if (Craft.ticketsLeft() <= 0) {
      setGuide(`<b>${n}</b>の目！ 線路に沿って1駅ずつ進みます。分かれ道では進む路線を選べます。`);
      setTimeout(() => startMove(n), 800);
      return;
    }
    choice = { n, values };
    $('#btn-dice').disabled = true;
    renderTickets();
    setGuide(`<b>${n}</b>の目！ よりみち切符で出目を±1できます。 <button class="primary-btn btn-sm" id="btn-depart">${I('train')} ${n}マス進む</button>`);
    $('#btn-depart').addEventListener('click', () => startMove(choice.n));
  }

  // よりみち切符：出目を ±1 する（高級車両・連結車両をひとつでもアンロックすると、1日3回まで）
  function renderTickets() {
    const bar = $('#ticket-bar');
    const per = Craft.ticketsPerDay();
    if (!per) {
      bar.innerHTML = `<p class="ticket-hint">${I('ticket')} よりみち切符：高級車両や連結車両をひとつアンロックすると、出目を±1できる切符が1日3回使えます</p>`;
      return;
    }
    const left = Craft.ticketsLeft();
    const holes = Array.from({ length: per }, (_, i) => `<i class="${i < per - left ? 'is-used' : ''}"></i>`).join('');
    const active = !!choice && left > 0;
    bar.innerHTML = `<div class="ticket">
        <span class="ticket-name">よりみち切符</span><span class="ticket-holes" aria-label="今日はあと${left}回">${holes}</span>
        <span class="ticket-btns">
          <button class="ticket-btn" data-ticket="-1" ${active && choice.n > 1 ? '' : 'disabled'} aria-label="出目を1へらす">−1</button>
          <button class="ticket-btn" data-ticket="1" ${active ? '' : 'disabled'} aria-label="出目を1ふやす">＋1</button>
        </span>
      </div>
      <p class="ticket-hint">${active ? '出目を±1して、狙った駅に止まれます（今日はあと' + left + '回）' : left ? `ダイスを振ったあとに使えます（今日はあと${left}回）` : '今日の切符は使い切りました。また明日'}</p>`;
  }
  function useTicket(delta) {
    if (!choice || Craft.ticketsLeft() <= 0) return;
    const n = Math.max(1, choice.n + delta);
    if (n === choice.n) return;
    Craft.useTicket();
    Sound.ticket();
    const values = choice.values || [choice.n];
    choice = null;
    if (values.length === 1) Dice.show(Math.min(6, n));
    toast(`よりみち切符を使って、出目を${n}にしました`, 'toast-green');
    showResult(n, values.length > 1 ? [...values.slice(0, -1), values[values.length - 1] + (n - values.reduce((a, b) => a + b, 0))] : [n]);
  }

  // ---------- アフィリエイトURL ----------
  function buildUrl(provider, keyword) {
    let url = provider.url.replace('{kw}', encodeURIComponent(keyword));
    const params = Object.entries(provider.params || {}).filter(([, v]) => v);
    if (params.length) {
      const q = params.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
      url += (url.includes('?') ? '&' : '?') + q;
    }
    if (provider.wrap) url = provider.wrap.replace('{url}', encodeURIComponent(url));
    return url;
  }

  function affButtons(providers, keyword, via, item, stationId) {
    return providers
      .map(
        (p) =>
          `<a class="aff-btn ${esc(p.className || '')}" href="${esc(buildUrl(p, keyword))}" target="_blank"
              rel="sponsored noopener" data-via="${via}" data-provider="${esc(p.id)}" data-label="${esc(p.label)}"
              data-item="${esc(item)}" data-station-id="${esc(stationId)}">${esc(p.label)}${I('arrow', { rotate: -45 })}</a>`
      )
      .join('');
  }

  // ---------- Xシェア ----------
  function shareUrl(text) {
    // URLSearchParams は空白を + にするため、encodeURIComponent で %20 に揃える
    const q = [['text', text], ['hashtags', D.meta.shareHashtags.join(',')]];
    if (/^https?:$/.test(location.protocol)) q.push(['url', location.origin + location.pathname]);
    return `https://x.com/intent/post?${q.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')}`;
  }

  function stationShareText(s) {
    const st = stats();
    const me = Ownership.you(s.id);
    if (me && me.rank === 1) {
      return `【${s.name}駅】のトップオーナーになりました。累計購入 ${yenJP(me.totalAmount)}\n称号「${rankInfo(st.assets).rank.title}」／トップオーナー ${st.acquiredCount}駅／総資産 ${yenBig(st.assets)}`;
    }
    if (me && me.rank <= D.meta.owner.shareholders) return `【${s.name}駅】の共同株主（${me.rank}位）になりました。1位まで下克上をねらいます\n九州踏破率 ${st.visitedPct}%`;
    return `${s.name}駅に寄り道中。${s.tagline}\n九州踏破率 ${st.visitedPct}%`;
  }

  // ---------- 寄り道手帖（モーダル） ----------
  function journeyStep(done, icon, label, sub) {
    return `<li class="journey-step ${done ? 'is-done' : ''}"><span class="journey-icon">${I(done ? 'check' : icon)}</span>
      <span class="journey-label">${label}</span><span class="journey-sub">${sub}</span></li>`;
  }

  function renderModal(id) {
    const s = D.byId[id];
    const st = Store.get();
    const acq = Store.getAcquisition(id);
    const actions = Store.getActions(id);
    const color = (D.meta.prefectures[s.prefecture] || {}).color;
    const aff = D.meta.affiliate;
    const pendingHere = Owner.isPendingFor(id);
    const me = Ownership.you(id);
    const here = st.currentStationId === id; // 手配（ショップ・宿のボタン）は、この駅に停車中だけ
    const locked = `<p class="aff-locked">${I('lock')} 手配は、この駅に停車中のときだけできます</p>`;
    const card = $('#modal-card');
    card.style.setProperty('--pref', color);
    card.classList.toggle('is-acquired', !!acq);

    card.innerHTML = `
      <header class="modal-head">
        <!-- 縦書きの駅名標：ホーローの白い札に、インクの細枠。上に欧文の駅番号 -->
        <div class="eki-plate" aria-hidden="true">
          <span class="eki-no">No.<b>${String(D.stations.indexOf(s) + 1).padStart(2, '0')}</b></span>
          <span class="eki-name">${esc(s.name)}</span>
          <span class="eki-kana">${esc(s.kana)}</span>
        </div>
        <div class="modal-head-body">
          <div class="chips">
            <span class="chip chip-pref">${esc(s.prefecture)}</span>
            <span class="chip">${esc(s.propertyType)}</span>
            ${s.special === 'ferry' ? `<span class="chip chip-sea">${I('ferry')} 特別航路</span>` : ''}
          </div>
          <p class="modal-kicker"><span class="eyebrow">Yorimichi Notebook</span>寄り道手帖${here ? '' : '<span class="kicker-ro">（閲覧のみ）</span>'}</p>
          <h2 id="modal-title" class="modal-title">${esc(s.name)}<small>駅</small></h2>
          <p class="modal-kana">${esc(s.kana)}</p>
          <div class="modal-value">
            <span>資産評価額</span><b class="num-it">${yenFull(s.assetValue)}</b>
            ${rankChip(id)}
          </div>
          ${s.note ? `<p class="modal-note">※${esc(s.note)}</p>` : ''}
        </div>
        <!-- 情緒の一文は縦書きで -->
        <p class="modal-tate">${esc(s.tagline)}</p>
        <button class="modal-close" data-close aria-label="閉じる">${I('close')}</button>
      </header>

      <ol class="journey" aria-label="旅のジャーニー">
        ${journeyStep(!!st.visited[id], 'eye', '気になる', '到着')}
        ${journeyStep(!!actions.product, 'gift', '購入する', 'お取り寄せ')}
        ${journeyStep(!!actions.stay, 'onsen', '訪れる', '宿を予約')}
        ${journeyStep(!!st.favorites[id], 'bell', 'つづく', '推し駅')}
      </ol>

      ${
        pendingHere
          ? Owner.panelHtml(id)
          : acq
            ? `<div class="owner-banner is-owner">${I('crown')} あなたはこの駅の<b>トップオーナー</b>です（累計 ${yenJP(me.totalAmount)}）。追い越されないよう、旅の買い物を楽しんでください</div>`
            : `<div class="owner-banner">${I('receipt')} <b>この手帖の中のボタン</b>からお取り寄せ・宿の予約をしたら、<b>注文完了画面のスクショ</b>でオーナー権に立候補できます。累計購入金額の<b>1位がトップオーナー</b>、上位3名は共同株主です。
               <small>※ボタンを押しただけ・商品名で別に検索しただけでは記録になりません。同じスクショは二度使えません</small></div>`
      }

      ${rankingHtml(id)}

      <section class="modal-sec">
        <h3 class="sec-title">${I('train')}車窓とまちの寄り道ノート</h3>
        <p class="memo">${esc(s.memo)}</p>
      </section>

      ${Postcards.stationSnapsHtml(id)}

      <section class="modal-sec">
        <h3 class="sec-title">${I('gift')}名産品物件 <em>お取り寄せで立候補へ</em></h3>
        <div class="items">
          ${s.products
            .map(
              (p) => `<div class="item">
                <div class="item-name">${esc(p.name)}</div>
                <p class="item-desc">${esc(p.desc)}</p>
                ${here ? `<div class="aff-row">${affButtons(aff.products, p.keyword, 'product', p.name, id)}</div>` : locked}
              </div>`
            )
            .join('')}
        </div>
      </section>

      <section class="modal-sec">
        <h3 class="sec-title">${I('onsen')}宿泊・体験物件 <em>宿の予約で立候補へ</em></h3>
        <div class="item">
          <div class="item-name">${esc(s.stay.name)} <span class="chip chip-dim">${esc(s.stay.kind)}</span></div>
          <p class="item-desc">${esc(s.stay.desc)}</p>
          ${here ? `<div class="aff-row">${affButtons(aff.stays, s.stay.keyword, 'stay', s.stay.name, id)}</div>` : locked}
        </div>
      </section>

      <p class="disclosure">${esc(aff.disclosure)}</p>

      <footer class="modal-foot">
        <a class="share-btn" href="${esc(shareUrl(stationShareText(s)))}" target="_blank" rel="noopener">
          <span class="x-logo" aria-hidden="true">𝕏</span>${me && me.rank <= D.meta.owner.shareholders ? 'オーナー権をシェア' : '寄り道をシェア'}
        </a>
        <button class="fav-btn ${st.favorites[id] ? 'is-on' : ''}" data-fav>${I('bell')} ${st.favorites[id] ? '推し駅' : '推し駅にする'}</button>
        <button class="ghost-btn" data-close>旅をつづける</button>
      </footer>`;
    loadThumbs(card);
    Postcards.loadImages(card);
  }

  // 順位のチップ（いまいる駅・寄り道手帖）
  function rankChip(id) {
    const me = Ownership.you(id);
    if (me && me.rank === 1) return `<span class="chip chip-gold">${I('crown')} トップオーナー</span>`;
    if (me && me.rank <= D.meta.owner.shareholders) return `<span class="chip chip-share">${I('chart')} ${me.rank}位・共同株主</span>`;
    if (me) return `<span class="chip">${me.rank}位</span>`;
    if (Owner.isPendingFor(id)) return `<span class="chip chip-green">${I('compass')} 視察・手配中</span>`;
    return '<span class="chip chip-dim">オーナー募集中</span>';
  }

  // オーナー権ランキング（累計購入金額）。上位3名が共同株主で、駅の評価額を金額の割合で配当として分け合う
  function rankingHtml(id) {
    const s = D.byId[id];
    const cfg = D.meta.owner;
    const rows = Ownership.ranking(id);
    const me = rows.find((r) => r.isYou);
    const shown = rows.slice(0, cfg.shareholders);
    if (me && me.rank > cfg.shareholders) shown.push(me);
    const mine = Store.getPurchases(id);
    return `<section class="modal-sec">
        <h3 class="sec-title">${I('crown')}オーナー権ランキング <em>累計購入金額</em></h3>
        <ol class="ranking">${shown
          .map(
            (r) => `<li class="rk rk-${r.rank} ${r.isYou ? 'is-you' : ''}">
              <span class="rk-no">${r.rank === 1 ? I('crown') : r.rank}</span>
              <span class="rk-name">${r.avatarConfig ? `<span class="rk-av">${Craft.avatarSvg(r.avatarConfig, { crop: true, id: `rk-${id}-${r.rank}` })}</span>` : ''}${esc(r.userName)}${r.isYou ? '<small>（あなた）</small>' : ''}</span>
              <span class="rk-amt">${yenJP(r.totalAmount)}</span>
              <span class="rk-share">${r.rank <= cfg.shareholders ? `${r.rank === 1 ? 'トップオーナー' : `共同株主（${r.rank}位理事）`}・配当 ${yen(r.dividend)}` : '株主の圏外'}${r.lastUpdated ? `・最終 ${fmtDate(r.lastUpdated)}` : ''}</span>
            </li>`
          )
          .join('')}</ol>
        <p class="rank-note">1位がこの駅のトップオーナー（地図の金の王冠）で、評価額 ${yen(s.assetValue)} ぶんのクラフト資金を受け取ります。2位・3位は共同株主（理事）として、その${Math.round(cfg.dividendRates[1] * 100)}%・${Math.round(cfg.dividendRates[2] * 100)}%の配当。いまの1位でない人の申告額は、<b>下克上ボーナス×${cfg.upsetBonus}</b>で数えます。</p>
        <div class="rank-actions">
          <button class="primary-btn" data-candidacy="${esc(id)}" ${Owner.canApply(id) ? '' : 'disabled'}>${I('receipt')} オーナー権に立候補する</button>
          ${Owner.canApply(id) ? '' : '<small>この手帖のショップ・宿のボタンからお買い物・予約をすると、立候補できます</small>'}
        </div>
        ${
          mine.length
            ? `<div class="mini-receipts" aria-label="この駅のレシート">${mine
                .slice()
                .reverse()
                .map((r) => receiptCard(id, r, 'mini'))
                .join('')}</div>`
            : ''
        }
      </section>`;
  }

  // 切手風の領収証カード（スクショのサムネイル・金額・ショップ・査収のハンコ）
  function receiptCard(stationId, r, size = '') {
    const s = D.byId[stationId];
    const color = (D.meta.prefectures[s.prefecture] || {}).color;
    return `<article class="receipt ${size ? `receipt-${size}` : ''}" style="--pref:${color}">
        <div class="receipt-paper">
          <div class="receipt-thumb">${r.imageId ? `<img alt="${esc(s.name)}駅のレシート" data-thumb="${esc(r.imageId)}">` : `<span>${I('receipt')}</span>`}</div>
          <div class="receipt-body">
            <p class="receipt-station">${esc(s.name)}<small>駅</small></p>
            <p class="receipt-amount">${yenJP(r.amount)}</p>
            <p class="receipt-shop">${I(r.via === 'stay' ? 'onsen' : 'gift')} ${esc(r.shop)}${size === 'mini' ? '' : `・${esc(r.item || '')}`}</p>
            <p class="receipt-meta">${r.arrival ? `駅到着日＝購入日 ${fmtDate(r.arrival)}` : fmtDate(r.at)}${r.upset ? `　下克上×${D.meta.owner.upsetBonus} → ${yenJP(r.scored)}` : ''}</p>
          </div>
        </div>
        <div class="receipt-stamp" aria-hidden="true">${Receipts.receiptStampSvg(fmtDate(r.arrival || r.at), size === 'mini' ? '' : s.name)}</div>
      </article>`;
  }
  // 端末の中に保存したサムネイルを、あとから差し込む
  function loadThumbs(root) {
    root.querySelectorAll('img[data-thumb]').forEach((img) => {
      Receipts.thumbUrl(img.dataset.thumb).then((u) => {
        if (u) img.src = u;
        else img.replaceWith(Object.assign(document.createElement('span'), { innerHTML: I('receipt') }));
      });
    });
  }

  // 手帖をひらいている駅だけ描き直す（立候補の流れから呼ぶ）
  function refreshModal(id) {
    if (modalStationId === id) {
      const top = $('#modal-card').scrollTop;
      renderModal(id);
      $('#modal-card').scrollTop = top;
    }
  }

  // 手帖をひらく：いまいる駅は全部、訪れたことのある駅は閲覧だけ、まだの駅は鍵がかかっている
  function openTecho(id) {
    if (id === Store.get().currentStationId || Store.isVisited(id)) return openModal(id);
    Sound.gentle();
    toast(`${D.byId[id].name}駅は、ダイスでたどり着くとひらけます`);
  }

  function openModal(id) {
    modalStationId = id;
    lastFocus = document.activeElement;
    renderModal(id);
    const m = $('#modal');
    m.hidden = false;
    requestAnimationFrame(() => m.classList.add('is-open'));
    document.body.classList.add('modal-open');
    $('#modal-card').scrollTop = 0;
    setTimeout(() => $('#modal-card .modal-close').focus({ preventScroll: true }), 50);
  }

  function closeModal() {
    const m = $('#modal');
    if (m.hidden) return;
    m.classList.remove('is-open');
    document.body.classList.remove('modal-open');
    setTimeout(() => (m.hidden = true), 200);
    modalStationId = null;
    if (!choice && !busy) setGuide(IDLE_GUIDE);
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }

  function onModalClick(ev) {
    if (ev.target.closest('[data-close]') || ev.target === $('#modal')) return closeModal();
    if (Owner.onClick(ev)) return;
    if (ev.target.closest('[data-candidacy]')) return;
    const fav = ev.target.closest('[data-fav]');
    if (fav) {
      const on = Store.toggleFavorite(modalStationId);
      Sound.click();
      toast(on ? '推し駅に登録しました。旅のつづきはここから' : '推し駅の登録を外しました');
      renderModal(modalStationId);
      renderAll();
      return;
    }
    const a = ev.target.closest('.aff-btn');
    // リンク自体は通常どおり新しいタブで開く（ポップアップブロック回避のため preventDefault しない）
    if (a) Owner.start(a.dataset.stationId, a);
  }

  // ---------- 立候補のあと ----------
  // 1位を取ったら王座交代の演出。それ以外は、何位になったかと配当をお知らせする
  async function afterCandidacy(id, result, amount) {
    const s = D.byId[id];
    if (result.tookThrone) {
      // 王冠が駅に刺さるところが見えるよう、手帖を閉じて地図をその駅まで送ってから
      closeModal();
      if ($('[data-view="map"]').hidden) showView('map');
      $('.map-board').scrollIntoView({ block: 'center', behavior: 'smooth' });
      await Game.throneSteal(id, Ownership.ranking(id)[1]);
      await Game.celebrateLines();
      return celebrate(id, result);
    }
    setTimeout(() => Game.celebrateLines(), 2600);
    const me = Ownership.you(id);
    if (result.after <= D.meta.owner.shareholders) Sound.coin();
    else Sound.gentle();
    toast(
      `${s.name}駅に購入実績 ${yenJP(amount)}${result.upset ? `（下克上×${D.meta.owner.upsetBonus}で ${yenJP(result.scored)}）` : ''}を記録しました。いま${result.after}位${
        result.after === 1 ? '（トップオーナーのまま）' : result.after <= D.meta.owner.shareholders ? `・共同株主（配当 ${yen(me.dividend)}）` : `・1位まであと お買い物 ${yenJP(Ownership.preview(id, 0).needToTop)} ぶん`
      }`,
      result.after <= D.meta.owner.shareholders ? 'toast-gold' : ''
    );
  }

  // ---------- 王座交代（トップオーナーになった）の演出 ----------
  function celebrate(id, result) {
    const s = D.byId[id];
    const me = Ownership.you(id);
    const prev = Ownership.ranking(id)[1];
    Sound.fanfare();
    Map.burst(id);
    checkRankUp(2600);
    const layer = $('#celebrate');
    layer.innerHTML = `
      <div class="celebrate-box" role="alertdialog" aria-labelledby="celebrate-title">
        <p class="celebrate-kicker">王座交代</p>
        <h2 id="celebrate-title" class="celebrate-title">トップオーナー就任！</h2>
        <div class="celebrate-card">${stampCard(s, Store.getAcquisition(id), 'big')}</div>
        <p class="celebrate-msg"><b>${esc(s.name)}駅</b>の購入実績で1位になりました${prev ? `（${esc(prev.userName)}さんを追い越しました）` : ''}。<br>累計 <b>${yenJP(me.totalAmount)}</b>${result && result.upset ? `（下克上ボーナス×${D.meta.owner.upsetBonus}込み）` : ''}・配当 <b>${yen(me.dividend)}</b>／総資産額に <b>${yen(s.assetValue)}</b></p>
        <div class="celebrate-actions">
          <a class="share-btn" href="${esc(shareUrl(stationShareText(s)))}" target="_blank" rel="noopener"><span class="x-logo">𝕏</span>オーナー権をシェア</a>
          ${canMakeTrip() ? `<button class="ghost-btn ghost-light" data-go-trip>${I('suitcase')} オーナーの駅で旅しおりを作る</button>` : ''}
          <button class="ghost-btn ghost-light" data-go-garage>${I('locomotive')} クラフト工房へ</button>
          <button class="ghost-btn ghost-light" data-dismiss>手帖に戻る</button>
        </div>
      </div>`;
    layer.hidden = false;
    confetti(layer, 44);
    requestAnimationFrame(() => layer.classList.add('is-open'));
    const close = () => {
      layer.classList.remove('is-open');
      setTimeout(() => {
        layer.hidden = true;
        layer.innerHTML = '';
      }, 250);
    };
    $('[data-dismiss]', layer).addEventListener('click', close);
    $('[data-go-garage]', layer).addEventListener('click', () => {
      close();
      closeModal();
      showView('garage');
    });
    const goTrip = $('[data-go-trip]', layer);
    if (goTrip) {
      goTrip.addEventListener('click', () => {
        close();
        closeModal();
        openTrip();
      });
    }
    // オーナーの駅が旅しおりの条件に届いた瞬間に、一度だけ提案する
    if (canMakeTrip() && !Store.get().tripPrompted) {
      Store.markTripPrompted();
      setTimeout(() => toast('トップオーナーの駅が2つになりました。その駅を巡る1泊2日のモデルコースを作れます', 'toast-gold'), 1100);
    }
    $('[data-dismiss]', layer).focus();
  }

  // ---------- 切手風のスタンプカード ----------
  // size: '' | 'big'（王座交代の演出）| 'mini'（右側の手帖）
  function stampCard(s, acq, size = '', extraClass = '') {
    const color = (D.meta.prefectures[s.prefecture] || {}).color;
    const me = Ownership.you(s.id);
    const via = me ? `累計購入 ${yenJP(me.totalAmount)}・レシート${Store.getPurchases(s.id).length}枚` : '旧版の記念刻印';
    const no = String(D.stations.indexOf(s) + 1).padStart(3, '0');
    return `
      <article class="stamp ${size ? `stamp-${size}` : ''} ${extraClass}" style="--pref:${color}" data-station="${esc(s.id)}" tabindex="0" aria-label="${esc(s.name)}駅のトップオーナーの切手">
        <div class="stamp-paper">
          <div class="stamp-art" aria-hidden="true">${stampArt(s)}</div>
          <div class="stamp-top"><span>${esc(s.prefecture)}</span><span>${esc(s.propertyType)}</span></div>
          <div class="stamp-value"><b>${Number(s.assetValue).toLocaleString('ja-JP')}</b><small>万円</small></div>
          <h3 class="stamp-name">${esc(s.name)}<small>駅</small></h3>
          ${size === 'mini' ? '' : `<p class="stamp-tagline">${esc(s.tagline)}</p><p class="stamp-via">${esc(via)}</p>`}
          ${size === 'mini' ? '' : `<div class="stamp-foot"><span class="stamp-owner">${Craft.avatarSvg(undefined, { crop: true })}</span><span>${me ? `${I('crown')} トップオーナー・配当 ${yen(me.dividend)}` : '九州よりみちオーナー証'}</span><span>第${no}号</span></div>`}
        </div>
        <div class="stamp-cancel" aria-hidden="true">${Owner.sealSvg(s, fmtDate(acq.at))}</div>
      </article>`;
  }
  // 切手の絵柄：湯けむり物件は湯けむりと山、名産品物件は海と山と駅舎の屋根（どちらも線画）
  function stampArt(s) {
    const hot = s.propertyType === '湯けむり物件';
    return `<svg viewBox="0 0 100 70" preserveAspectRatio="xMidYMid slice">
      <rect width="100" height="70" fill="var(--pref)" opacity=".16"/>
      <path d="M0,52 Q16,30 30,40 T56,30 Q70,20 86,34 L100,40 L100,70 L0,70 Z" fill="var(--pref)" opacity=".28"/>
      <path d="M0,60 Q20,50 40,58 T80,56 T100,58 L100,70 L0,70 Z" fill="var(--pref)" opacity=".4"/>
      ${
        hot
          ? '<g fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".9"><path d="M38,48 q-5,-6 0,-12 t0,-12"/><path d="M50,48 q-5,-6 0,-12 t0,-12"/><path d="M62,48 q-5,-6 0,-12 t0,-12"/></g>'
          : '<g fill="#fff" opacity=".85"><path d="M36,44 L50,34 L64,44 Z"/><rect x="40" y="44" width="20" height="10"/></g><circle cx="78" cy="16" r="6" fill="#fff" opacity=".7"/>'
      }
    </svg>`;
  }

  // ---------- オーナー刻印手帖 ----------
  let techoSub = 'stamps';
  function renderCollection() {
    const st = Store.get();
    const s = stats();
    const info = rankInfo(s.assets);
    $('#techo-owner').innerHTML = `
      <div class="owner-card">
        <div class="owner-avatar">${Craft.avatarSvg()}</div>
        <div>
          <p class="owner-kicker">九州よりみち　オーナー証</p>
          <p class="owner-title">${emblemHtml(info.rank, 'sm')} ${esc(info.rank.title)}</p>
          <p class="owner-sub">トップオーナー ${s.acquiredCount}駅 ／ 共同株主 ${Ownership.shareholderOf().length}駅 ／ 九州踏破率 ${s.visitedPct}%</p>
          <label class="owner-name">旅人名 <input type="text" maxlength="12" value="${esc(st.profile.name)}" placeholder="あなた" data-profile-name></label>
        </div>
      </div>`;
    $('#col-kingdom').textContent = `${s.acquiredPct}%`;
    $('#col-assets').textContent = yenBig(s.assets);
    $('#col-count').textContent = `${s.acquiredCount} / ${s.n}`;
    $('#col-max').textContent = yenBig(D.totalAsset);
    $('#col-share').href = shareUrl(
      s.acquiredCount
        ? `称号「${info.rank.title}」として、九州の${s.acquiredCount}駅のトップオーナーになりました。総資産 ${yenBig(s.assets)}`
        : `よりみちダイス片手に、九州の旅をはじめました。九州踏破率 ${s.visitedPct}%`
    );
    $('#collection-grid').innerHTML = D.stations
      .map((stn) => {
        const acq = st.acquired[stn.id];
        if (acq) return stampCard(stn, acq);
        const visited = !!st.visited[stn.id];
        const pend = Owner.isPendingFor(stn.id);
        const me = Ownership.you(stn.id);
        const top = Ownership.owner(stn.id);
        return `<article class="stamp-blank" data-station="${esc(stn.id)}" tabindex="0" style="--pref:${(D.meta.prefectures[stn.prefecture] || {}).color}">
            <div class="blank-q" aria-hidden="true">${me ? me.rank : pend ? I('compass') : '？'}</div>
            <div class="blank-name">${esc(stn.name)}<small>駅</small></div>
            <div class="blank-pref">${esc(stn.prefecture)}・${esc(stn.propertyType)}</div>
            <div class="blank-value">評価額 ${yen(stn.assetValue)}</div>
            <div class="blank-state">${me ? `${me.rank}位${me.rank <= D.meta.owner.shareholders ? '・共同株主' : ''}（1位まで お買い物 ${yenJP(Ownership.preview(stn.id, 0).needToTop)} ぶん）` : pend ? '視察・手配中' : visited ? '訪問済み・まだ立候補していません' : 'まだ訪れていない駅'}</div>
            <div class="blank-top">いまのオーナー：${esc(top.userName)}</div>
          </article>`;
      })
      .join('');
    document.querySelectorAll('[data-sub]').forEach((v) => (v.hidden = v.dataset.sub !== techoSub));
    document.querySelectorAll('[data-sub-tab]').forEach((b) => {
      b.classList.toggle('is-active', b.dataset.subTab === techoSub);
      b.setAttribute('aria-selected', b.dataset.subTab === techoSub);
    });
    if (techoSub === 'trip') renderTrip();
    if (techoSub === 'album') renderAlbum();
  }

  // 切手風レシートアルバム：立候補に使ったスクショを、新しい順にファイリングする
  function renderAlbum() {
    const list = Store.allPurchases().sort((a, b) => b.at.localeCompare(a.at));
    const legacy = Object.entries(Store.get().legacyStamps || {}).filter(([id]) => D.byId[id]);
    const total = list.reduce((n, r) => n + r.amount, 0);
    $('#album-root').innerHTML = `
      <div class="album-head">
        <h3 class="sec-title">${I('receipt')}旅のレシートアルバム <em>端末の中だけに保存</em></h3>
        <p class="album-sum">${list.length ? `レシート <b>${list.length}</b>枚・購入実績の合計 <b>${yenJP(total)}</b>` : 'まだレシートはありません。寄り道手帖のショップ・宿のボタンからお買い物をして、完了画面のスクショで立候補すると、ここに切手のように並びます。'}</p>
      </div>
      <div class="album-grid">${list.map((r) => receiptCard(r.stationId, r)).join('')}</div>
      ${
        legacy.length
          ? `<section class="legacy-sec"><h3 class="sec-title">${I('postcard')}旧版の記念刻印 <em>購入実績には入りません</em></h3>
              <p class="album-sum">以前の版（ボタンと刻印シートでオーナーになれた頃）に押した刻印です。いまのランキングには入りませんが、記念に残しています。</p>
              <div class="legacy-list">${legacy.map(([id, a]) => `<span class="chip">${I('stamp')} ${esc(D.byId[id].name)}駅 ${fmtDate(a.at)}</span>`).join('')}</div></section>`
          : ''
      }`;
    loadThumbs($('#album-root'));
  }

  function showView(name) {
    document.querySelectorAll('[data-view]').forEach((v) => (v.hidden = v.dataset.view !== name));
    document.querySelectorAll('[data-tab]').forEach((t) => {
      const on = t.dataset.tab === name;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', on);
    });
    if (name === 'collection') renderCollection();
    if (name === 'garage') Garage.show();
    if (name === 'letters') Postcards.render();
    try {
      sessionStorage.setItem('yokatabi.view', name);
    } catch (e) {
      /* noop */
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ---------- マイ旅しおり（オーナー刻印手帖の中） ----------
  // トップオーナーの駅から 1泊2日のモデルコースを自動生成（js/trip.js）し、宿をまとめて比較・保存・共有する
  const RIDE_ICON = { shinkansen: 'shinkansen', trunk: 'train', local: 'train', scenic: 'sparkle', ferry: 'ferry', bus: 'bus' };
  const WEEK = ['日', '月', '火', '水', '木', '金', '土'];
  const trip = { key: null, result: null, index: 0, savedId: null, departDate: '' };

  const acquiredIds = () => D.stations.filter((s) => Store.isAcquired(s.id)).map((s) => s.id);
  const canMakeTrip = () => acquiredIds().length >= D.meta.trip.minAcquired;

  function tripResult() {
    const ids = acquiredIds();
    const key = ids.join(',');
    if (trip.key !== key) {
      trip.key = key;
      trip.result = Trip.generate(D, ids);
      trip.index = 0;
    }
    return trip.result;
  }

  // 表示中のプラン（保存済みを開いているときはそちら）
  function currentPlan() {
    if (trip.savedId) {
      const item = Store.getItineraries().find((i) => i.id === trip.savedId);
      if (item) return { plan: Trip.build(D, null, item.seq, acquiredIds()), saved: item };
      trip.savedId = null;
    }
    const r = tripResult();
    return { plan: r.plans[trip.index] || null, saved: null };
  }

  function dayLabel(offset) {
    if (!trip.departDate) return '';
    const d = new Date(`${trip.departDate}T00:00:00`);
    if (isNaN(d)) return '';
    d.setDate(d.getDate() + offset);
    return `${d.getMonth() + 1}/${d.getDate()}（${WEEK[d.getDay()]}）`;
  }

  function openTrip() {
    trip.savedId = null;
    techoSub = 'trip';
    showView('collection');
  }

  function renderTripCta() {
    const btn = $('#btn-trip-cta');
    const need = D.meta.trip.minAcquired - acquiredIds().length;
    btn.disabled = need > 0;
    btn.innerHTML = `${I('suitcase')} ${need > 0 ? `あと${need}駅のトップオーナーで旅しおりが作れます` : 'オーナーの駅で1泊2日の旅しおりを作る'}`;
    btn.classList.toggle('is-ready', need <= 0);
  }

  function legHtml(it) {
    const lg = it.leg;
    const via = lg.path.slice(1, -1).map((id) => D.byId[id].name);
    return `<li class="tl-leg">
        <div class="tl-time">${it.depart}<br><span>↓</span><br>${it.arrive}</div>
        <div class="ticket-card">
          ${lg.rides
            .map(
              (r) => `<div class="ticket-ride ride-${esc(r.type)}">
                <span class="ride-icon" aria-hidden="true">${I(RIDE_ICON[r.type] || 'train')}</span>
                <span class="ride-name"><b>${esc(((D.routeTypes || {})[r.type] || {}).label || '')}</b>${esc(r.name)}</span>
                <span class="ride-min">${Trip.duration(r.minutes)}</span>
              </div>`
            )
            .join('')}
          <div class="ticket-foot">所要 ${Trip.duration(lg.minutes)}${lg.transfers ? `（乗り換え${lg.transfers}回）` : ''}${via.length ? ` ／ ${esc(via.join('・'))} 経由` : ''}</div>
        </div>
      </li>`;
  }

  function stopHtml(it) {
    const s = D.byId[it.id];
    const color = (D.meta.prefectures[s.prefecture] || {}).color;
    const icon = I({ start: 'flag', end: 'flag', stop: 'here', stay: 'bed', morning: 'clock', free: 'compass' }[it.kind]);
    const name = it.kind === 'start' || it.kind === 'end' ? s.gateway || `${s.name}駅` : `${s.name}`;
    const owned = Store.isAcquired(s.id) && (it.kind === 'stop' || it.kind === 'stay');
    return `<li class="tl-stop tl-${it.kind}" style="--pref:${color}">
        <div class="tl-time">${esc(it.time)}${it.until ? `<br><span>〜${esc(it.until)}</span>` : ''}</div>
        <div class="tl-body">
          <span class="tl-dot" aria-hidden="true">${icon}</span>
          <div class="tl-head">
            <button class="tl-name" data-open-station="${esc(s.id)}">${esc(name)}</button>
            <span class="chip chip-pref">${esc(s.prefecture)}</span>
            ${owned ? `<span class="chip chip-gold">${I('crown')} トップオーナー</span>` : ''}
            ${it.kind === 'free' && it.suggest ? '<span class="chip chip-sea">寄り道候補・まだオーナーではない駅</span>' : ''}
          </div>
          <p class="tl-text">${esc(it.text)}</p>
          ${it.kind === 'free' && it.suggest ? `<p class="tl-sub">トップオーナーになると、次の旅しおりのコースに入ります。<button class="link-btn" data-open-station="${esc(s.id)}">寄り道手帖を見る</button></p>` : ''}
          ${it.kind === 'stop' ? `<p class="tl-sub">${I('gift')} おみやげ候補：${s.products.map((p) => esc(p.name)).join('・')}</p>` : ''}
          ${it.kind === 'stay' ? `<p class="tl-sub">${I('bed')} ${esc(s.stay.name)}（${esc(s.stay.kind)}） <a href="#trip-stays" class="link-btn">宿を比較する ↓</a></p>` : ''}
        </div>
      </li>`;
  }

  function stayRows(plan, others) {
    const aff = D.meta.affiliate;
    const ids = [plan.overnight, ...others.filter((id) => id !== plan.overnight)];
    const check = dayLabel(0);
    return ids
      .map((id, i) => {
        const s = D.byId[id];
        const color = (D.meta.prefectures[s.prefecture] || {}).color;
        return `<div class="stay-row ${i === 0 ? 'is-main' : ''}" style="--pref:${color}">
            <div class="stay-info">
              <div class="chips">
                <b class="stay-station">${esc(s.name)}</b>
                <span class="chip chip-pref">${esc(s.prefecture)}</span>
                <span class="chip">${esc(s.propertyType)}</span>
                ${i === 0 ? '<span class="chip chip-gold">このプランの宿泊地</span>' : '<span class="chip chip-dim">ほかのプランの宿泊地</span>'}
              </div>
              <p class="stay-name">${esc(s.stay.name)} <small>${esc(s.stay.kind)}</small></p>
              <p class="stay-desc">${esc(s.stay.desc)}</p>
              ${check ? `<p class="stay-date">${I('calendar')} チェックイン ${check}・1泊（日付は予約サイトで指定してください）</p>` : ''}
            </div>
            <div class="aff-row stay-btns">${affButtons(aff.stays, s.stay.keyword, 'stay', s.stay.name, s.id)}</div>
          </div>`;
      })
      .join('');
  }

  function savedListHtml() {
    const list = Store.getItineraries();
    if (!list.length) return '<p class="saved-empty">まだ保存した旅しおりはありません。気に入ったコースは「しおりに保存」で残せます。</p>';
    return list
      .map((it) => {
        const names = [...it.seq.day1, ...it.seq.day2].map((id) => (D.byId[id] ? D.byId[id].name : id));
        return `<article class="saved-card ${trip.savedId === it.id ? 'is-active' : ''}">
            <div>
              <p class="saved-title">${esc(it.title)}</p>
              <p class="saved-route">${esc(names.join(' → '))}</p>
              <p class="saved-meta">${it.departDate ? `出発 ${esc(it.departDate)} ／ ` : ''}保存 ${fmtDate(it.savedAt)}</p>
            </div>
            <div class="saved-btns">
              <button class="ghost-btn" data-open-saved="${esc(it.id)}">ひらく</button>
              <button class="ghost-btn danger-btn" data-delete-saved="${esc(it.id)}" aria-label="${esc(it.title)}を削除">削除</button>
            </div>
          </article>`;
      })
      .join('');
  }

  function tripShareText(plan) {
    const route = plan.visits.map((id) => (id === plan.overnight ? `${D.byId[id].name}（泊）` : D.byId[id].name)).join('→');
    return `【マイ旅しおり】トップオーナーになった九州の駅を巡る1泊2日\n${route}\n資産評価額の合計 ${yenBig(plan.asset)}`;
  }

  function renderTrip() {
    const root = $('#trip-root');
    const cfg = D.meta.trip;
    const ids = acquiredIds();
    const { plan, saved } = currentPlan();
    const r = tripResult();
    const savedSec = `<section class="saved-sec"><h3 class="sec-title">${I('books')}保存した旅しおり</h3>${savedListHtml()}</section>`;

    if (!plan && !saved && r.reason === 'few') {
      root.innerHTML = `
        <div class="booklet booklet-locked">
          <p class="booklet-kicker">マイ旅しおり</p>
          <h2 class="booklet-title">マイ旅しおり</h2>
          <p class="booklet-lead">トップオーナーの駅が <b>${cfg.minAcquired}駅</b> になると、その駅を巡る<b>リアル九州旅行のモデルコース（1泊2日）</b>を自動でつくり、宿をまとめて比較できます。</p>
          <div class="lock-progress"><i style="width:${pct(ids.length, cfg.minAcquired)}%"></i></div>
          <p class="booklet-lead">いまトップオーナーの駅 <b>${ids.length}</b> / ${cfg.minAcquired}駅 ── あと<b>${r.need}駅</b></p>
          <button class="dice-btn" data-tab-go="map">${I('map')} すごろくマップへ</button>
        </div>${savedSec}`;
      return;
    }

    const tabs = saved
      ? `<div class="plan-tabs"><span class="chip chip-gold">${I('books')} 保存したしおりを表示中</span><button class="link-btn" data-back-plans>自動提案のプランに戻る</button></div>`
      : `<div class="plan-tabs" role="tablist" aria-label="モデルコースの候補">${r.plans
          .map((p, i) => {
            const st = D.byId[p.overnight];
            return `<button class="plan-tab ${i === trip.index ? 'is-active' : ''}" role="tab" aria-selected="${i === trip.index}" data-plan="${i}">
                <span class="plan-letter">プラン${'ABC'[i]}</span>
                <span class="plan-sum">${I(st.propertyType === '湯けむり物件' ? 'onsen' : 'bed')} ${esc(st.name)}泊・${p.visits.length}駅</span>
                <span class="plan-moved">移動 ${p.moved}</span>
              </button>`;
          })
          .join('')}</div>`;

    if (!plan) {
      root.innerHTML = `${tabs}<div class="booklet"><p>オーナーの駅どうしが離れていて、1泊2日に収まるコースが見つかりませんでした。もう少し近い駅のオーナーになると提案できます。</p></div>${savedSec}`;
      return;
    }

    const left = ids.filter((id) => !plan.visits.includes(id));
    const otherOvernights = saved ? [] : r.plans.map((p) => p.overnight);
    root.innerHTML = `
      ${tabs}
      <article class="booklet" id="booklet">
        <div class="booklet-ribbon" aria-hidden="true">1泊2日</div>
        <p class="booklet-kicker">マイ旅しおり ── トップオーナーの駅を巡るリアル九州旅行のモデルコース</p>
        <h2 class="booklet-title">${esc(plan.title)}</h2>
        <p class="booklet-route">${plan.visits
          .map((id) => `<span class="${id === plan.overnight ? 'is-night' : ''}">${esc(D.byId[id].name)}${id === plan.overnight ? '<small>泊</small>' : ''}</span>`)
          .join('<i>→</i>')}</p>
        <dl class="booklet-stats">
          <div><dt>巡るオーナー駅</dt><dd>${plan.visits.length}駅</dd></div>
          <div><dt>移動時間（目安）</dt><dd>${plan.moved}</dd></div>
          <div><dt>資産評価額の合計</dt><dd>${yenBig(plan.asset)}</dd></div>
        </dl>
        <div class="booklet-actions">
          <label class="date-field">出発日 <input type="date" id="trip-date" value="${esc(trip.departDate)}"></label>
          <button class="ghost-btn" data-show-course>${I('map')} 地図でルートを見る</button>
          <button class="ghost-btn gold-btn" data-save-trip>${I('save')} ${saved ? '保存済み（日付を更新）' : 'しおりに保存'}</button>
          <a class="share-btn" href="${esc(shareUrl(tripShareText(plan)))}" target="_blank" rel="noopener"><span class="x-logo">𝕏</span>しおりをシェア</a>
          <button class="ghost-btn" data-print>${I('printer')} 印刷する</button>
        </div>
        <div class="days">
          ${plan.days
            .map(
              (d, i) => `<section class="day">
                <h3 class="day-title"><span>${d.label}</span>${dayLabel(i) ? `<small>${dayLabel(i)}</small>` : ''}</h3>
                <ol class="timeline">${d.items.map((it) => (it.kind === 'leg' ? legHtml(it) : stopHtml(it))).join('')}</ol>
              </section>`
            )
            .join('')}
        </div>
        ${left.length ? `<p class="booklet-left">${I('compass')} 今回のコースに入りきらなかったオーナー駅：<b>${left.map((id) => esc(D.byId[id].name)).join('・')}</b>（2泊以上の旅や、別のプランでどうぞ）</p>` : ''}
        <p class="booklet-notice">※${esc(cfg.notice)}</p>
      </article>

      <section class="stay-compare" id="trip-stays">
        <h3 class="sec-title">${I('bed')}宿をまとめて比較する <em>楽天トラベル・じゃらん</em></h3>
        <p class="stay-lead">このプランの宿泊地と、ほかの候補プランの宿泊地を並べています。ボタンを押すと各サイトで同じ条件の宿を探せます（予約のあと、完了画面のスクショでその駅のオーナー権に立候補できます）。</p>
        <div class="stay-list">${stayRows(plan, otherOvernights)}</div>
        <p class="disclosure">${esc(D.meta.affiliate.disclosure)}</p>
      </section>
      ${savedSec}`;
  }

  function showCourseOnMap(plan) {
    const legs = [];
    plan.days.forEach((d) => d.items.forEach((it) => it.kind === 'leg' && legs.push(it.leg.path)));
    showView('map');
    Map.showCourse(legs, plan.visits, plan.overnight);
    $('#course-chip').hidden = false;
    $('#course-chip-title').textContent = plan.title;
    toast('モデルコースを地図に表示しました（数字は巡る順番、泊は宿泊地）');
  }

  function clearCourse() {
    Map.showCourse(null);
    $('#course-chip').hidden = true;
  }

  function onTripClick(e) {
    const t = e.target;
    const planBtn = t.closest('[data-plan]');
    if (planBtn) {
      trip.index = Number(planBtn.dataset.plan);
      Sound.click();
      return renderTrip();
    }
    if (t.closest('[data-back-plans]')) {
      trip.savedId = null;
      return renderTrip();
    }
    if (t.closest('[data-tab-go]')) return showView(t.closest('[data-tab-go]').dataset.tabGo);
    const st = t.closest('[data-open-station]');
    if (st) return openModal(st.dataset.openStation);
    const { plan, saved } = currentPlan();
    if (t.closest('[data-show-course]') && plan) return showCourseOnMap(plan);
    if (t.closest('[data-print]')) return window.print();
    if (t.closest('[data-save-trip]') && plan) {
      const { created } = Store.saveItinerary({ title: plan.title, seq: plan.seq, departDate: trip.departDate });
      Sound.click();
      toast(created ? '旅しおりを保存しました' : '保存済みのしおりを更新しました', 'toast-gold');
      if (saved) trip.savedId = saved.id;
      return renderTrip();
    }
    const open = t.closest('[data-open-saved]');
    if (open) {
      const item = Store.getItineraries().find((i) => i.id === open.dataset.openSaved);
      trip.savedId = item.id;
      trip.departDate = item.departDate || '';
      renderTrip();
      return $('#booklet').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    const del = t.closest('[data-delete-saved]');
    if (del) {
      if (!confirm('この旅しおりを削除しますか？')) return;
      Store.deleteItinerary(del.dataset.deleteSaved);
      if (trip.savedId === del.dataset.deleteSaved) trip.savedId = null;
      return renderTrip();
    }
    // 宿比較のボタン：リンクは新しいタブで開き、その駅の「視察・手配中」にする（立候補は戻ってきてから）
    const a = t.closest('.aff-btn');
    if (a && a.dataset.stationId) {
      Owner.start(a.dataset.stationId, a);
      toast(`${a.dataset.label}で${D.byId[a.dataset.stationId].name}の宿を視察中。予約が済んだら、完了画面のスクショを持って戻ってきてください`);
    }
  }

  // ---------- ミュート ----------
  function renderMute() {
    const m = Store.get().muted;
    const b = $('#btn-mute');
    b.innerHTML = I(m ? 'mute' : 'sound');
    b.setAttribute('aria-label', m ? 'サウンドをオンにする' : 'サウンドをミュートする');
    b.setAttribute('aria-pressed', m);
    b.classList.toggle('is-muted', m);
  }

  // ---------- 起動 ----------
  async function boot() {
    Store.load();
    try {
      D = await Data.load();
    } catch (e) {
      $('#guide').textContent = '駅データを読み込めませんでした。ページを再読み込みしてください。';
      console.error(e);
      return;
    }
    $('#data-source').textContent = D.source === 'fallback' ? '内蔵データで起動中' : 'stations.json 読込済み';
    // 地図の出典は、地図データ（js/geo.js）に書かれたものをそのまま出す（元データを変えても表記がずれないように）
    if (window.YOKATABI_GEO && window.YOKATABI_GEO.source) $('#geo-source').textContent = window.YOKATABI_GEO.source;

    Craft.init(D);
    Ownership.init(D);
    // 旅の便り（ポストカードのいいね）もクラフト資金に入るので、最初の計算より前にデータを渡しておく
    const api = { esc, yen, yenBig, fmtDate, toast, renderAll, refreshModal, afterCandidacy, confetti, showView, closeModal };
    Postcards.init(D, api, $('#letters-root'));
    Sound.setMuted(Store.get().muted);
    renderMute();
    syncRankSeen();

    const st = Store.get();
    if (!D.byId[st.currentStationId]) Store.visit(D.meta.startStationId);
    Map.init($('#map'), D, {
      onStationClick,
      currentId: () => Store.get().currentStationId,
      spotlightId: () => (Store.get().spotlight || {}).id,
      // カメラが動いたら：分かれ道のボタンを置き直し、望遠鏡の吹き出しは閉じる
      onCamera: () => {
        if (move && move.waiting && !$('#map-overlay').hidden) placeDirButtons(move.waiting);
        hideScope();
      },
    });
    Map.placeTrain(Store.get().currentStationId);
    Dice.mount($('#die'));
    Owner.init(D, api);
    Garage.init(D, api, $('#garage-root'));
    Scenery.init(D, $('#scenery'));
    Scenery.show(Store.get().currentStationId);
    ShareCard.init(D, api, $('#sharecard'));
    Game.init(D, { ...api, isBusy: () => busy || !!choice || !!move, renderDiceHint, warpTo });
    renderAll();
    setGuide(IDLE_GUIDE);

    $('#btn-dice').addEventListener('click', rollDice);
    $('#ticket-bar').addEventListener('click', (e) => {
      const b = e.target.closest('[data-ticket]');
      if (b && !b.disabled) useTicket(Number(b.dataset.ticket));
    });
    $('#btn-mute').addEventListener('click', () => {
      Store.setMuted(!Store.get().muted);
      Sound.setMuted(Store.get().muted);
      renderMute();
      Sound.click();
    });
    $('#btn-open-current').addEventListener('click', () => !busy && openModal(Store.get().currentStationId));
    $('#modal').addEventListener('click', onModalClick);
    document.addEventListener('click', (e) => {
      const c = e.target.closest('[data-candidacy-open]');
      if (c) return Owner.openSheet(c.dataset.candidacyOpen);
      const o = e.target.closest('#pending-chip [data-open-station], #collection-grid [data-station], #mini-grid [data-station]');
      if (o && !busy) openTecho(o.dataset.openStation || o.dataset.station);
      const r = e.target.closest('[data-read-techo]');
      if (r) {
        hideScope();
        openModal(r.dataset.readTecho);
      }
      if (e.target.closest('[data-scope-close]') || (!e.target.closest('#map-scope') && !e.target.closest('.station'))) hideScope();
    });
    document.addEventListener('click', (e) => {
      const b = e.target.closest('#map-overlay [data-dir], #guide [data-dir]');
      if (b) pickDirection(b.dataset.dir);
    });
    // 画面の大きさが変わったら、分かれ道のボタンを置き直す（望遠鏡はいったん閉じる）
    window.addEventListener('resize', () => {
      hideScope();
      if (move && move.waiting) placeDirButtons(move.waiting);
    });
    $('#collection-grid').addEventListener('keydown', (e) => {
      const c = e.target.closest('[data-station]');
      if (c && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        openTecho(c.dataset.station);
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!$('#cutin').hidden) return closeCutIn();
      if (Game.close()) return;
      if (ShareCard.close()) return;
      if (Postcards.closeViewer()) return;
      if (!$('#owner-sheet').hidden) return Owner.closeSheet();
      if (!$('#celebrate').hidden) return $('#celebrate [data-dismiss]').click();
      if (!$('#modal').hidden) return closeModal();
      if (!$('#map-scope').hidden) return hideScope();
    });
    document.querySelectorAll('[data-tab]').forEach((t) => t.addEventListener('click', () => showView(t.dataset.tab)));
    document.querySelectorAll('[data-tab-jump]').forEach((b) => b.addEventListener('click', () => showView(b.dataset.tabJump)));
    document.querySelectorAll('[data-sub-tab]').forEach((b) =>
      b.addEventListener('click', () => {
        techoSub = b.dataset.subTab;
        Sound.click();
        renderCollection();
      })
    );
    $('#btn-trip-cta').addEventListener('click', openTrip);
    $('#techo-owner').addEventListener('change', (e) => {
      if (!e.target.matches('[data-profile-name]')) return;
      Store.setProfileName(e.target.value);
      toast(`旅人名を「${Ownership.youName()}」にしました（ランキングに出ます）`);
    });
    $('#trip-root').addEventListener('click', onTripClick);
    $('#trip-root').addEventListener('change', (e) => {
      if (e.target.id !== 'trip-date') return;
      trip.departDate = e.target.value;
      renderTrip();
    });
    $('#btn-clear-course').addEventListener('click', clearCourse);
    $('#btn-course-trip').addEventListener('click', openTrip);
    $('#btn-reset').addEventListener('click', () => {
      if (!confirm('旅の記録（訪問・購入実績とレシート・旅の便りの写真・推し駅・クラフト工房のパーツ）をすべてリセットします。よろしいですか？')) return;
      Store.reset();
      Receipts.clear();
      Store.visit(D.meta.startStationId);
      syncRankSeen();
      clearChoice();
      Map.refreshTrain();
      Map.placeTrain(D.meta.startStationId);
      Scenery.show(D.meta.startStationId);
      Game.ensureSpotlight();
      renderAll();
      toast('旅の記録をリセットしました。博多から再出発です');
    });

    let view = 'map';
    try {
      view = sessionStorage.getItem('yokatabi.view') || 'map';
    } catch (e) {
      /* noop */
    }
    showView(['collection', 'garage', 'letters'].includes(view) ? view : 'map');
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
