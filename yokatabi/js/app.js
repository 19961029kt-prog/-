// UI全体の結線：ヘッダー指標・サイコロ・物件カード（モーダル）・買収演出・コレクション手帳・Xシェア。
(function () {
  'use strict';
  const { Data, Store, Sound, Map, Trip } = window.YT;

  let D = null;
  let busy = false; // 列車走行中・サイコロ回転中
  let pending = null; // サイコロ後の行き先候補 { id: path }
  let modalStationId = null;
  let lastFocus = null;

  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const yen = (man) => `${Number(man).toLocaleString('ja-JP')}万円`;
  const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);
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
    return {
      n,
      visited,
      visitedPct: pct(visited, n),
      acquiredCount: acquired.length,
      acquiredPct: pct(acquired.length, n),
      assets,
    };
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
    const dur = 900;
    elm.classList.add('is-counting');
    const step = (now) => {
      const t = Math.min(1, (now - t0) / dur);
      const v = Math.round(from + (to - from) * (1 - Math.pow(1 - t, 3)));
      elm.textContent = format(v);
      if (t < 1) tweens.set(elm, requestAnimationFrame(step));
      else elm.classList.remove('is-counting');
    };
    tweens.set(elm, requestAnimationFrame(step));
  }

  function renderHeader() {
    const s = stats();
    countTo($('#stat-visited'), s.visitedPct, (v) => `${v}%`);
    countTo($('#stat-kingdom'), s.acquiredPct, (v) => `${v}%`);
    countTo($('#stat-assets'), s.assets, (v) => v.toLocaleString('ja-JP'));
    $('#stat-visited-bar').style.width = `${s.visitedPct}%`;
    $('#stat-kingdom-bar').style.width = `${s.acquiredPct}%`;
    $('#stat-visited-sub').textContent = `${s.visited}/${s.n}駅`;
    $('#stat-kingdom-sub').textContent = `${s.acquiredCount}/${s.n}物件`;
  }

  function renderCurrent() {
    const st = Store.get();
    const s = D.byId[st.currentStationId];
    if (!s) return;
    $('#current-name').textContent = `${s.name}駅`;
    $('#current-pref').textContent = s.prefecture;
    $('#current-tagline').textContent = s.tagline;
    $('#current-status').innerHTML = st.acquired[s.id]
      ? '<span class="chip chip-gold">♛ 買収済み</span>'
      : '<span class="chip">未買収</span>';
  }

  function renderAll() {
    Map.refresh(Store.get());
    renderHeader();
    renderCurrent();
    renderMini();
    renderCollection();
    renderTripCta();
    renderRank();
  }

  // ---------- 称号（買収総額でランクアップ） ----------
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
  // 1億以上は「1億2,000万円」と読みやすく
  const yenBig = (man) => {
    if (man < 10000) return yen(man);
    const oku = Math.floor(man / 10000), rest = man % 10000;
    return `${oku}億${rest ? rest.toLocaleString('ja-JP') + '万' : ''}円`;
  };

  function emblemHtml(rank, size = '') {
    const i = ranks().indexOf(rank);
    return `<span class="emblem emblem-${esc(rank.metal)} ${size ? `emblem-${size}` : ''}" aria-hidden="true">
        <span class="emblem-ribbon"></span>
        <span class="emblem-face"><span class="emblem-icon">${esc(rank.icon)}</span></span>
        <span class="emblem-stars">${'★'.repeat(i + 1)}</span>
      </span>`;
  }

  function renderRank() {
    const { assets } = stats();
    const info = rankInfo(assets);
    $('#rank-chip-emblem').innerHTML = emblemHtml(info.rank, 'sm');
    $('#rank-chip-title').textContent = info.rank.title;
    $('#rank-chip-bar').style.width = `${Math.round(info.progress * 100)}%`;
    $('#rank-chip').className = `rank-chip rank-${info.rank.metal}`;
    $('#rank-chip').setAttribute(
      'aria-label',
      `称号 ${info.rank.title}${info.next ? `。次の「${info.next.title}」まであと${yenBig(info.toNext)}` : '。最高位です'}`
    );
    $('#rank-ladder').innerHTML = `
      <div class="ladder-head">
        <h3 class="ladder-title">🎖 称号の道</h3>
        <p class="ladder-next">${
          info.next
            ? `次の称号「<b>${esc(info.next.title)}</b>」まで、買収総額あと <b>${yenBig(info.toNext)}</b>`
            : '👑 最高位「九州鉄道王」に到達！ 九州のレールはあなたのものです'
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
                <p class="ladder-min">${r.min ? `買収総額 ${yenBig(r.min)}〜` : 'スタート'}</p>
                <p class="ladder-note">${note}</p>
              </li>`;
          })
          .join('')}
      </ol>
      <div class="ladder-bar"><i style="width:${Math.min(100, (assets / D.totalAsset) * 100)}%"></i>
        ${ranks()
          .slice(1)
          .map((r) => `<span class="ladder-mark" style="left:${(r.min / D.totalAsset) * 100}%"></span>`)
          .join('')}
      </div>`;
  }

  // 既存データ（rankSeen 未設定）は、いまの称号を「見せ済み」としてそろえる（読み込み直後に演出を出さない）
  function syncRankSeen() {
    if (Store.get().rankSeen === null) Store.setRankSeen(rankInfo(stats().assets).index);
  }

  // 買収のたびに呼ぶ：称号が上がっていたらカットインを出す
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
    const share = shareUrl(`【称号ランクアップ】九州の物件を買収し続けて、称号「${rank.title}」に昇格しました！👑\n総資産 ${yen(assets)}`);
    layer.className = `cutin rank-${rank.metal}`;
    layer.innerHTML = `
      <div class="cutin-flash" aria-hidden="true"></div>
      <div class="cutin-band" role="alertdialog" aria-labelledby="cutin-title" aria-describedby="cutin-flavor">
        <div class="cutin-speed" aria-hidden="true"></div>
        <div class="cutin-inner">
          <div class="cutin-emblem"><div class="cutin-rays" aria-hidden="true"></div>${emblemHtml(rank, 'xl')}</div>
          <div class="cutin-text">
            <p class="cutin-kicker">称号がひとつ上がりました</p>
            <p class="cutin-from">${esc(from.title)} <i>➔</i></p>
            <h2 id="cutin-title" class="cutin-title" aria-label="${esc(rank.title)}">${chars}</h2>
            <p id="cutin-flavor" class="cutin-flavor">${esc(rank.flavor)}</p>
          </div>
        </div>
      </div>
      <div class="cutin-sparks" aria-hidden="true">${Array.from({ length: 24 }, (_, i) =>
        `<i style="--x:${(Math.random() * 100).toFixed(1)}%;--y:${(20 + Math.random() * 60).toFixed(1)}%;--d:${(0.4 + Math.random() * 1.2).toFixed(2)}s;--s:${(0.6 + Math.random()).toFixed(2)}"></i>`
      ).join('')}</div>
      <div class="cutin-actions">
        <a class="share-btn is-gold" href="${esc(share)}" target="_blank" rel="noopener" data-cutin-share><span class="x-logo">𝕏</span>称号を自慢する</a>
        <button class="ghost-btn ghost-light" data-cutin-close>閉じる</button>
      </div>`;
    layer.hidden = false;
    Sound.rankUp();
    requestAnimationFrame(() => layer.classList.add('is-open'));
    $('[data-cutin-close]', layer).focus({ preventScroll: true });
    // 7秒で自動的に閉じる（シェアを押したら閉じない）
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

  // 右側のミニ手帳：買収した順に並べ、新しく加わったカードだけ裏返しから登場させる
  let miniShown = null;
  function renderMini() {
    const st = Store.get();
    const s = stats();
    const owned = D.stations
      .filter((stn) => st.acquired[stn.id])
      .sort((a, b) => st.acquired[b.id].at.localeCompare(st.acquired[a.id].at));
    $('#mini-count').textContent = `${s.acquiredCount} / ${s.n}`;
    $('#mini-assets').textContent = yen(s.assets);
    const grid = $('#mini-grid');
    grid.innerHTML = owned.length
      ? owned.map((stn) => holoCard(stn, st.acquired[stn.id], 'mini', miniShown && !miniShown.has(stn.id) ? 'is-new' : '')).join('')
      : '<p class="mini-empty">カード内のボタンからお取り寄せ・予約すると、ここに旅のスタンプカードが加わります。</p>';
    miniShown = new Set(owned.map((stn) => stn.id));
  }

  // ---------- トースト ----------
  function toast(msg, kind = '') {
    const box = $('#toasts');
    const t = document.createElement('div');
    t.className = `toast ${kind}`;
    t.textContent = msg;
    box.appendChild(t);
    setTimeout(() => t.classList.add('is-out'), 2600);
    setTimeout(() => t.remove(), 3100);
  }

  function setGuide(html) {
    $('#guide').innerHTML = html;
  }

  // ---------- 移動 ----------
  async function travel(path) {
    busy = true;
    document.body.classList.add('is-busy');
    Sound.depart();
    await Map.moveTrain(path);
    busy = false;
    document.body.classList.remove('is-busy');
    arrive(path[path.length - 1], path.length - 1);
  }

  function arrive(id, hops) {
    const s = D.byId[id];
    const first = Store.visit(id);
    Sound.arrive();
    renderAll();
    Map.placeTrain(id);
    if (first) toast(`🎉 ${s.name}駅に初到着！ 九州踏破率アップ`, 'toast-blue');
    setGuide(
      hops
        ? `🚉 <b>${esc(s.name)}駅</b>に到着（${hops}区間）。物件カードを開いています…`
        : `🚉 <b>${esc(s.name)}駅</b>の物件カード`
    );
    setTimeout(() => openModal(id), hops ? 250 : 0);
  }

  function onStationClick(id) {
    if (busy) return;
    Sound.unlock();
    if (pending) {
      if (!pending[id]) {
        toast('🎲 光っている駅から行き先を選んでね');
        return;
      }
      const path = pending[id];
      clearPending();
      travel(path);
      return;
    }
    const cur = Store.get().currentStationId;
    if (id === cur) return openModal(id);
    const path = Data.shortestPath(D, cur, id);
    if (!path) return openModal(id);
    travel(path);
  }

  function clearPending() {
    pending = null;
    Map.setCandidates(null);
    $('#btn-dice').disabled = false;
  }

  // ---------- サイコロ ----------
  const PIPS = {
    1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9],
  };
  function drawDie(n) {
    const die = $('#die');
    die.innerHTML = '';
    for (let i = 1; i <= 9; i++) {
      const p = document.createElement('span');
      p.className = PIPS[n].includes(i) ? 'pip' : 'pip is-off';
      die.appendChild(p);
    }
    die.dataset.face = n;
  }

  function rollDice() {
    if (busy || pending) return;
    Sound.unlock();
    busy = true;
    const btn = $('#btn-dice');
    btn.disabled = true;
    const die = $('#die');
    die.classList.add('is-rolling');
    Sound.dice();
    const n = 1 + Math.floor(Math.random() * 6);
    let ticks = 0;
    const iv = setInterval(() => {
      drawDie(1 + Math.floor(Math.random() * 6));
      if (++ticks >= 9) {
        clearInterval(iv);
        drawDie(n);
        die.classList.remove('is-rolling');
        die.classList.add('is-landed');
        setTimeout(() => die.classList.remove('is-landed'), 500);
        Sound.pip();
        Store.countRoll();
        busy = false;
        afterRoll(n);
      }
    }, 75);
  }

  function afterRoll(n) {
    const cur = Store.get().currentStationId;
    const dests = Data.diceDestinations(D, cur, n);
    const ids = Object.keys(dests);
    $('#dice-result').textContent = `${n}`;
    const hops = dests[ids[0]].length - 1;
    const reach = hops < n ? `線路の果てまで${hops}区間。` : `${n}区間先の`;
    if (ids.length === 1) {
      setGuide(`🎲 <b>${n}</b>！ ${reach}<b>${esc(D.byId[ids[0]].name)}駅</b>へ出発進行！`);
      setTimeout(() => travel(dests[ids[0]]), 450);
      return;
    }
    pending = dests;
    Map.setCandidates(ids);
    setGuide(
      `🎲 <b>${n}</b>！ ${reach}分かれ道です。光っている<span class="t-gold font-bold">${ids.length}駅</span>から行き先を選んでね。` +
        ` <button class="link-btn" id="btn-cancel-choice">やめる</button>`
    );
    $('#btn-cancel-choice').addEventListener('click', () => {
      clearPending();
      setGuide('サイコロを振るか、地図の駅をタップして旅を続けよう。');
    });
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

  function affButtons(providers, keyword, via, item, stationId = '') {
    return providers
      .map(
        (p) =>
          `<a class="aff-btn ${esc(p.className || '')}" href="${esc(buildUrl(p, keyword))}" target="_blank"
              rel="sponsored noopener" data-via="${via}" data-provider="${esc(p.id)}" data-label="${esc(p.label)}"
              data-item="${esc(item)}" data-station-id="${esc(stationId)}">${esc(p.label)}<span aria-hidden="true">↗</span></a>`
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
    if (Store.isAcquired(s.id)) {
      return `【${s.name}駅】を評価額${yen(s.assetValue)}で完全買収しました！✨\n称号「${rankInfo(st.assets).rank.title}」／王国経営度 ${st.acquiredPct}%／総資産 ${yen(st.assets)}`;
    }
    return `${s.name}駅に到着！🚂 ${s.tagline}\n九州踏破率 ${st.visitedPct}% で旅の途中です。`;
  }

  // ---------- 物件カード（モーダル） ----------
  function journeyStep(done, icon, label, sub) {
    return `<li class="journey-step ${done ? 'is-done' : ''}"><span class="journey-icon">${done ? '✓' : icon}</span>
      <span class="journey-label">${label}</span><span class="journey-sub">${sub}</span></li>`;
  }

  function renderModal(id) {
    const s = D.byId[id];
    const st = Store.get();
    const acq = Store.getAcquisition(id);
    const actions = Store.getActions(id);
    const color = (D.meta.prefectures[s.prefecture] || {}).color;
    const aff = D.meta.affiliate;
    const card = $('#modal-card');
    card.style.setProperty('--pref', color);
    card.classList.toggle('is-acquired', !!acq);

    card.innerHTML = `
      <header class="modal-head">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="chip chip-pref">${esc(s.prefecture)}</span>
          <span class="chip">${esc(s.propertyType)}</span>
          ${s.special === 'ferry' ? '<span class="chip chip-sea">⛴ 特別航路</span>' : ''}
        </div>
        <h2 id="modal-title" class="modal-title">${esc(s.name)}<small>駅</small></h2>
        <p class="modal-kana">${esc(s.kana)} ／ ${esc(s.tagline)}</p>
        <div class="modal-value">
          <span>物件評価額</span><b>${yen(s.assetValue)}</b>
          ${acq ? `<span class="chip chip-gold">♛ 買収完了 ${fmtDate(acq.at)}</span>` : '<span class="chip chip-dim">オーナー募集中</span>'}
        </div>
        ${s.note ? `<p class="modal-note">※${esc(s.note)}</p>` : ''}
        <button class="modal-close" data-close aria-label="閉じる">×</button>
      </header>

      <ol class="journey" aria-label="旅のジャーニー">
        ${journeyStep(!!st.visited[id], '👀', '気になる', '到着')}
        ${journeyStep(!!actions.product, '🎁', '購入する', 'お取り寄せ')}
        ${journeyStep(!!actions.stay, '♨', '訪れる', '宿を予約')}
        ${journeyStep(!!st.favorites[id], '🔔', 'つづく', '推し駅')}
      </ol>

      ${
        acq
          ? `<div class="owner-banner is-owner">♛ あなたはこの駅の<b>正式オーナー</b>です（${acq.via === 'stay' ? '宿泊・体験' : '名産品'}ルートで買収）</div>`
          : `<div class="owner-banner">🔑 <b>このカード内のボタン</b>からお取り寄せ・予約へ進むと、${esc(s.name)}駅の<b>正式オーナー（買収完了）</b>に！
             <small>※商品名で別に検索しても買収にはなりません</small></div>`
      }

      <section class="modal-sec">
        <h3 class="sec-title"><span>📝</span>現地調査メモ</h3>
        <p class="memo">${esc(s.memo)}</p>
      </section>

      <section class="modal-sec">
        <h3 class="sec-title"><span>🎁</span>名産品物件 <em>お取り寄せで買収</em></h3>
        <div class="grid gap-3">
          ${s.products
            .map(
              (p) => `<div class="item">
                <div class="item-name">${esc(p.name)}</div>
                <p class="item-desc">${esc(p.desc)}</p>
                <div class="aff-row">${affButtons(aff.products, p.keyword, 'product', p.name)}</div>
              </div>`
            )
            .join('')}
        </div>
      </section>

      <section class="modal-sec">
        <h3 class="sec-title"><span>♨</span>宿泊・体験物件 <em>予約で買収</em></h3>
        <div class="item">
          <div class="item-name">${esc(s.stay.name)} <span class="chip chip-dim">${esc(s.stay.kind)}</span></div>
          <p class="item-desc">${esc(s.stay.desc)}</p>
          <div class="aff-row">${affButtons(aff.stays, s.stay.keyword, 'stay', s.stay.name)}</div>
        </div>
      </section>

      <p class="disclosure">${esc(aff.disclosure)}</p>

      <footer class="modal-foot">
        <a class="share-btn ${acq ? 'is-gold' : ''}" href="${esc(shareUrl(stationShareText(s)))}" target="_blank" rel="noopener">
          <span class="x-logo" aria-hidden="true">𝕏</span>${acq ? '買収を自慢する' : '到着をシェア'}
        </a>
        <button class="fav-btn ${st.favorites[id] ? 'is-on' : ''}" data-fav>${st.favorites[id] ? '🔔 推し駅に登録済み' : '🔔 推し駅にする'}</button>
        <button class="ghost-btn" data-close>旅を続ける</button>
      </footer>`;
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
    setGuide('サイコロを振るか、地図の駅をタップして旅を続けよう。');
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }

  function onModalClick(ev) {
    if (ev.target.closest('[data-close]') || ev.target === $('#modal')) return closeModal();
    const fav = ev.target.closest('[data-fav]');
    if (fav) {
      const on = Store.toggleFavorite(modalStationId);
      Sound.click();
      toast(on ? '🔔 推し駅に登録しました。旅のつづきはここから' : '推し駅の登録を外しました');
      renderModal(modalStationId);
      renderAll();
      return;
    }
    const a = ev.target.closest('.aff-btn');
    if (a) {
      // リンク自体は通常どおり新しいタブで開く（ポップアップブロック回避のため preventDefault しない）
      const id = modalStationId;
      const first = Store.acquire(id, {
        via: a.dataset.via,
        provider: a.dataset.label,
        item: a.dataset.item,
      });
      if (first) {
        setTimeout(() => celebrate(id), 120);
      } else {
        toast(`${a.dataset.label} を開きました（${D.byId[id].name}駅は買収済み）`);
      }
      // クリック処理（新規タブを開く既定動作）が終わってからカードを描き直す
      setTimeout(() => {
        if (modalStationId === id) renderModal(id);
        renderAll();
      }, 0);
    }
  }

  // ---------- 買収完了演出 ----------
  function celebrate(id) {
    const s = D.byId[id];
    Sound.fanfare();
    Map.burst(id);
    // 買収ファンファーレが鳴り終わるころに、称号のカットインを重ねる
    checkRankUp(2300);
    const layer = $('#celebrate');
    layer.innerHTML = `
      <div class="confetti" aria-hidden="true">${Array.from({ length: 40 }, (_, i) =>
        `<i style="--i:${i};--x:${Math.random() * 100}%;--d:${(Math.random() * 0.8).toFixed(2)}s;--h:${Math.floor(Math.random() * 360)}"></i>`
      ).join('')}</div>
      <div class="celebrate-box" role="alertdialog" aria-labelledby="celebrate-title">
        <p class="celebrate-kicker">おめでとうございます</p>
        <h2 id="celebrate-title" class="celebrate-title">買収完了！</h2>
        ${holoCard(s, Store.getAcquisition(id), 'big')}
        <p class="celebrate-msg"><b>${esc(s.name)}駅</b>の正式オーナーになりました。<br>総資産に <b>${yen(s.assetValue)}</b> が加算されます。</p>
        <div class="flex flex-wrap gap-2 justify-center">
          <a class="share-btn is-gold" href="${esc(shareUrl(stationShareText(s)))}" target="_blank" rel="noopener"><span class="x-logo">𝕏</span>買収を自慢する</a>
          ${canMakeTrip() ? '<button class="ghost-btn ghost-light trip-glow" data-go-trip>🧳 買収駅で旅しおりを作る</button>' : ''}
          <button class="ghost-btn ghost-light" data-go-collection>コレクション手帳へ</button>
          <button class="ghost-btn ghost-light" data-dismiss>カードに戻る</button>
        </div>
      </div>`;
    layer.hidden = false;
    requestAnimationFrame(() => layer.classList.add('is-open'));
    attachTilt(layer);
    const close = () => {
      layer.classList.remove('is-open');
      setTimeout(() => {
        layer.hidden = true;
        layer.innerHTML = '';
      }, 250);
    };
    $('[data-dismiss]', layer).addEventListener('click', close);
    $('[data-go-collection]', layer).addEventListener('click', () => {
      close();
      closeModal();
      showView('collection');
    });
    const goTrip = $('[data-go-trip]', layer);
    if (goTrip) {
      goTrip.addEventListener('click', () => {
        close();
        closeModal();
        openTrip();
      });
    }
    // 買収駅が旅しおりの条件に届いた瞬間に、一度だけ提案する
    if (canMakeTrip() && !Store.get().tripPrompted) {
      Store.markTripPrompted();
      setTimeout(() => toast('🧳 買収駅が増えました！買収した駅を巡る1泊2日のモデルコースを作れます', 'toast-gold'), 900);
    }
    $('[data-dismiss]', layer).focus();
  }

  // ---------- ホログラム風スタンプカード ----------
  // size: '' | 'big'（買収完了演出）| 'mini'（右側の手帳）
  function holoCard(s, acq, size = '', extraClass = '') {
    const color = (D.meta.prefectures[s.prefecture] || {}).color;
    const via = acq.via === 'stay' ? `♨ ${acq.provider}で${acq.item}を予約` : `🎁 ${acq.provider}で${acq.item}をお取り寄せ`;
    return `
      <article class="holo ${size ? `holo-${size}` : ''} ${extraClass}" style="--pref:${color}" data-station="${esc(s.id)}" tabindex="0">
        <div class="holo-inner">
          <div class="holo-top"><span>${esc(s.prefecture)}</span><span>${esc(s.propertyType)}</span></div>
          <div class="holo-stamp" aria-hidden="true"><span class="holo-stamp-ring">買収済</span><span class="holo-stamp-name">${esc(s.name)}</span><span class="holo-stamp-date">${fmtDate(acq.at)}</span></div>
          <h3 class="holo-name">${esc(s.name)}<small>駅</small></h3>
          <p class="holo-tagline">${esc(s.tagline)}</p>
          <div class="holo-value"><span>資産評価額</span><b>${yen(s.assetValue)}</b></div>
          <p class="holo-via">${esc(via)}</p>
          <div class="holo-foot"><span>九州 物件オーナー証</span><span>第${String(D.stations.indexOf(s) + 1).padStart(3, '0')}号</span></div>
        </div>
        <span class="holo-art" aria-hidden="true">${s.propertyType === '湯けむり物件' ? '♨️' : '🎁'}</span>
        <div class="holo-foil" aria-hidden="true"></div>
        <div class="holo-glare" aria-hidden="true"></div>
      </article>`;
  }

  // カードをポインタに合わせて傾け、ホログラムの光を動かす
  function attachTilt(root) {
    root.querySelectorAll('.holo').forEach((card) => {
      if (card.dataset.tilt) return;
      card.dataset.tilt = '1';
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        // 光の角度で色が変わるよう、傾きを大きめに取る
        card.style.setProperty('--rx', `${(0.5 - py) * 24}deg`);
        card.style.setProperty('--ry', `${(px - 0.5) * 30}deg`);
        card.style.setProperty('--mx', `${px * 100}%`);
        card.style.setProperty('--my', `${py * 100}%`);
      });
      card.addEventListener('pointerleave', () => {
        ['--rx', '--ry', '--mx', '--my'].forEach((k) => card.style.removeProperty(k));
      });
    });
  }

  // ---------- コレクション手帳 ----------
  function renderCollection() {
    const st = Store.get();
    const s = stats();
    $('#col-kingdom').textContent = `${s.acquiredPct}%`;
    $('#col-assets').textContent = yen(s.assets);
    $('#col-count').textContent = `${s.acquiredCount} / ${s.n}`;
    $('#col-max').textContent = yen(D.totalAsset);
    $('#col-share').href = shareUrl(
      s.acquiredCount
        ? `称号「${rankInfo(s.assets).rank.title}」として九州の${s.acquiredCount}物件を買収し、王国経営度 ${s.acquiredPct}%・総資産 ${yen(s.assets)} に到達しました！👑`
        : `サイコロ片手に九州の旅をはじめました🎲 九州踏破率 ${s.visitedPct}%`
    );
    const grid = $('#collection-grid');
    grid.innerHTML = D.stations
      .map((stn) => {
        const acq = st.acquired[stn.id];
        if (acq) return holoCard(stn, acq);
        const visited = !!st.visited[stn.id];
        return `<article class="locked-card" data-station="${esc(stn.id)}" tabindex="0">
            <div class="locked-q">?</div>
            <div class="locked-name">${esc(stn.name)}駅</div>
            <div class="locked-pref">${esc(stn.prefecture)}・${esc(stn.propertyType)}</div>
            <div class="locked-value">評価額 ${yen(stn.assetValue)}</div>
            <div class="locked-state">${visited ? '👀 訪問済み・未買収' : '未踏の地'}</div>
          </article>`;
      })
      .join('');
    attachTilt(grid);
  }

  function showView(name) {
    document.querySelectorAll('[data-view]').forEach((v) => (v.hidden = v.dataset.view !== name));
    document.querySelectorAll('[data-tab]').forEach((t) => {
      const on = t.dataset.tab === name;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', on);
    });
    if (name === 'collection') renderCollection();
    if (name === 'trip') renderTrip();
    try {
      sessionStorage.setItem('yokatabi.view', name);
    } catch (e) {
      /* noop */
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ---------- マイ旅しおり ----------
  // 買収した駅から 1泊2日のモデルコースを自動生成（js/trip.js）し、宿をまとめて比較・保存・共有する
  const RIDE_ICON = { shinkansen: '🚄', trunk: '🚆', local: '🚃', scenic: '🚞', ferry: '⛴', bus: '🚌' };
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
    showView('trip');
  }

  function renderTripCta() {
    const btn = $('#btn-trip-cta');
    if (!btn) return;
    const need = D.meta.trip.minAcquired - acquiredIds().length;
    btn.disabled = need > 0;
    btn.innerHTML = need > 0 ? `🧳 あと${need}駅の買収で旅しおりが作れます` : '🧳 買収駅で1泊2日の旅しおりを作る';
    btn.classList.toggle('trip-glow', need <= 0);
  }

  function legHtml(it) {
    const lg = it.leg;
    const via = lg.path.slice(1, -1).map((id) => D.byId[id].name);
    return `<li class="tl-leg">
        <div class="tl-time">${it.depart}<br><span>↓</span><br>${it.arrive}</div>
        <div class="ticket">
          ${lg.rides
            .map(
              (r) => `<div class="ticket-ride ride-${esc(r.type)}">
                <span class="ride-icon" aria-hidden="true">${RIDE_ICON[r.type] || '🚃'}</span>
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
    const icon = { start: '🚩', end: '🏁', stop: '📍', stay: '🛏', morning: '☀', free: '🧭' }[it.kind];
    const name = it.kind === 'start' || it.kind === 'end' ? s.gateway || `${s.name}駅` : `${s.name}`;
    const owned = Store.isAcquired(s.id) && (it.kind === 'stop' || it.kind === 'stay');
    return `<li class="tl-stop tl-${it.kind}" style="--pref:${color}">
        <div class="tl-time">${esc(it.time)}${it.until ? `<br><span>〜${esc(it.until)}</span>` : ''}</div>
        <div class="tl-body">
          <span class="tl-dot" aria-hidden="true">${icon}</span>
          <div class="tl-head">
            <button class="tl-name" data-open-station="${esc(s.id)}">${esc(name)}</button>
            <span class="chip chip-pref">${esc(s.prefecture)}</span>
            ${owned ? '<span class="chip chip-gold">♛ あなたの物件</span>' : ''}
            ${it.kind === 'free' && it.suggest ? '<span class="chip chip-sea">寄り道候補・未買収</span>' : ''}
          </div>
          <p class="tl-text">${esc(it.text)}</p>
          ${it.kind === 'free' && it.suggest ? `<p class="tl-sub">買収すると、次の旅しおりのコースに入ります。<button class="link-btn" data-open-station="${esc(s.id)}">物件カードを見る</button></p>` : ''}
          ${it.kind === 'stop' ? `<p class="tl-sub">🎁 おみやげ候補：${s.products.map((p) => esc(p.name)).join('・')}</p>` : ''}
          ${it.kind === 'stay' ? `<p class="tl-sub">🏨 ${esc(s.stay.name)}（${esc(s.stay.kind)}） <a href="#trip-stays" class="link-btn">宿を比較する ↓</a></p>` : ''}
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
              <div class="flex items-center gap-2 flex-wrap">
                <b class="stay-station">${esc(s.name)}</b>
                <span class="chip chip-pref">${esc(s.prefecture)}</span>
                <span class="chip">${esc(s.propertyType)}</span>
                ${i === 0 ? '<span class="chip chip-gold">このプランの宿泊地</span>' : '<span class="chip chip-dim">ほかのプランの宿泊地</span>'}
              </div>
              <p class="stay-name">${esc(s.stay.name)} <small>${esc(s.stay.kind)}</small></p>
              <p class="stay-desc">${esc(s.stay.desc)}</p>
              ${check ? `<p class="stay-date">📅 チェックイン ${check}・1泊（日付は予約サイトで指定してください）</p>` : ''}
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
            <div class="flex gap-2">
              <button class="ghost-btn" data-open-saved="${esc(it.id)}">ひらく</button>
              <button class="ghost-btn danger-btn" data-delete-saved="${esc(it.id)}" aria-label="${esc(it.title)}を削除">削除</button>
            </div>
          </article>`;
      })
      .join('');
  }

  function tripShareText(plan) {
    const route = plan.visits.map((id) => (id === plan.overnight ? `${D.byId[id].name}（泊）` : D.byId[id].name)).join('→');
    return `【マイ旅しおり】買収した九州の駅を巡る1泊2日🧳\n${route}\n物件の評価額合計 ${yen(plan.asset)}`;
  }

  function renderTrip() {
    const root = $('#trip-root');
    const cfg = D.meta.trip;
    const ids = acquiredIds();
    const { plan, saved } = currentPlan();
    const r = tripResult();

    // 買収駅が足りない：あと何駅で作れるかを見せる
    if (!plan && !saved && r.reason === 'few') {
      root.innerHTML = `
        <div class="booklet booklet-locked">
          <p class="booklet-kicker">マイ旅しおり</p>
          <h2 class="booklet-title">マイ旅しおり</h2>
          <p class="mt-2">買収した駅が <b>${cfg.minAcquired}駅</b> になると、その駅を巡る<b>リアル九州旅行モデルコース（1泊2日）</b>を自動でつくり、宿をまとめて比較できます。</p>
          <div class="lock-progress"><i style="width:${pct(ids.length, cfg.minAcquired)}%"></i></div>
          <p class="text-sm mt-1">いまの買収駅 <b>${ids.length}</b> / ${cfg.minAcquired}駅 ── あと<b>${r.need}駅</b></p>
          <button class="dice-btn mt-4" data-tab-go="map">🎲 すごろくで買収しにいく</button>
        </div>
        <section class="saved-sec"><h3 class="sec-title"><span>📚</span>保存した旅しおり</h3>${savedListHtml()}</section>`;
      return;
    }

    const tabs = saved
      ? `<div class="plan-tabs"><span class="chip chip-gold">📚 保存したしおりを表示中</span><button class="link-btn" data-back-plans>自動提案のプランに戻る</button></div>`
      : `<div class="plan-tabs" role="tablist" aria-label="モデルコースの候補">${r.plans
          .map((p, i) => {
            const st = D.byId[p.overnight];
            return `<button class="plan-tab ${i === trip.index ? 'is-active' : ''}" role="tab" aria-selected="${i === trip.index}" data-plan="${i}">
                <span class="plan-letter">プラン${'ABC'[i]}</span>
                <span class="plan-sum">${st.propertyType === '湯けむり物件' ? '♨' : '🏨'} ${esc(st.name)}泊・${p.visits.length}駅</span>
                <span class="plan-moved">移動 ${p.moved}</span>
              </button>`;
          })
          .join('')}</div>`;

    if (!plan) {
      root.innerHTML = `${tabs}<div class="booklet"><p>買収した駅どうしが離れていて、1泊2日に収まるコースが見つかりませんでした。もう少し近い駅を買収すると提案できます。</p></div>
        <section class="saved-sec"><h3 class="sec-title"><span>📚</span>保存した旅しおり</h3>${savedListHtml()}</section>`;
      return;
    }

    const left = ids.filter((id) => !plan.visits.includes(id));
    const otherOvernights = saved ? [] : r.plans.map((p) => p.overnight);
    root.innerHTML = `
      ${tabs}
      <article class="booklet" id="booklet">
        <div class="booklet-ribbon" aria-hidden="true">1泊2日</div>
        <p class="booklet-kicker">マイ旅しおり ── 買収した駅を巡るリアル九州旅行モデルコース</p>
        <h2 class="booklet-title">${esc(plan.title)}</h2>
        <p class="booklet-route">${plan.visits
          .map((id) => `<span class="${id === plan.overnight ? 'is-night' : ''}">${esc(D.byId[id].name)}${id === plan.overnight ? '<small>泊</small>' : ''}</span>`)
          .join('<i>→</i>')}</p>
        <dl class="booklet-stats">
          <div><dt>巡る買収駅</dt><dd>${plan.visits.length}駅</dd></div>
          <div><dt>移動時間（目安）</dt><dd>${plan.moved}</dd></div>
          <div><dt>物件の評価額合計</dt><dd>${yen(plan.asset)}</dd></div>
        </dl>
        <div class="booklet-actions">
          <label class="date-field">出発日 <input type="date" id="trip-date" value="${esc(trip.departDate)}"></label>
          <button class="ghost-btn" data-show-course>🗾 地図でルートを見る</button>
          <button class="ghost-btn gold-btn" data-save-trip>${saved ? '💾 保存済み（日付を更新）' : '💾 しおりに保存'}</button>
          <a class="share-btn" href="${esc(shareUrl(tripShareText(plan)))}" target="_blank" rel="noopener"><span class="x-logo">𝕏</span>しおりをシェア</a>
          <button class="ghost-btn" data-print>🖨 印刷する</button>
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
        ${left.length ? `<p class="booklet-left">🧭 今回のコースに入りきらなかった買収駅：<b>${left.map((id) => esc(D.byId[id].name)).join('・')}</b>（2泊以上の旅や、別のプランでどうぞ）</p>` : ''}
        <p class="booklet-notice">※${esc(cfg.notice)}</p>
      </article>

      <section class="stay-compare" id="trip-stays">
        <h3 class="sec-title"><span>🏨</span>宿をまとめて比較する <em>楽天トラベル・じゃらん</em></h3>
        <p class="text-xs t-dim mb-3">このプランの宿泊地と、ほかの候補プランの宿泊地を並べています。ボタンを押すと各サイトで同じ条件の宿を探せます。</p>
        <div class="grid gap-3">${stayRows(plan, otherOvernights)}</div>
        <p class="disclosure">${esc(D.meta.affiliate.disclosure)}</p>
      </section>

      <section class="saved-sec"><h3 class="sec-title"><span>📚</span>保存した旅しおり</h3>${savedListHtml()}</section>`;
  }

  function showCourseOnMap(plan) {
    const legs = [];
    plan.days.forEach((d) => d.items.forEach((it) => it.kind === 'leg' && legs.push(it.leg.path)));
    showView('map');
    Map.showCourse(legs, plan.visits, plan.overnight);
    const chip = $('#course-chip');
    chip.hidden = false;
    $('#course-chip-title').textContent = plan.title;
    toast('🗾 モデルコースを地図に表示しました（数字は巡る順番、泊は宿泊地）');
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
      Sound.pip();
      toast(created ? '💾 旅しおりを保存しました' : '💾 保存済みのしおりを更新しました', 'toast-gold');
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
    // 宿比較のボタン：リンクは新しいタブで開き、「訪れる（宿を予約）」の一歩として記録する
    const a = t.closest('.aff-btn');
    if (a && a.dataset.stationId) {
      const id = a.dataset.stationId;
      const first = Store.acquire(id, { via: 'stay', provider: a.dataset.label, item: a.dataset.item });
      if (first) setTimeout(() => celebrate(id), 120);
      else toast(`🏨 ${a.dataset.label}で${D.byId[id].name}の宿を探しています`);
      setTimeout(renderAll, 0);
    }
  }

  // ---------- ミュート ----------
  function renderMute() {
    const m = Store.get().muted;
    const b = $('#btn-mute');
    b.textContent = m ? '🔇' : '🔊';
    b.setAttribute('aria-label', m ? 'サウンドをオンにする' : 'サウンドをミュートする');
    b.setAttribute('aria-pressed', m);
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

    Sound.setMuted(Store.get().muted);
    renderMute();
    syncRankSeen();

    const st = Store.get();
    if (!D.byId[st.currentStationId]) {
      Store.visit(D.meta.startStationId);
    }
    Map.init($('#map'), D, { onStationClick });
    Map.placeTrain(Store.get().currentStationId);
    drawDie(1);
    renderAll();
    setGuide('サイコロを振るか、地図の駅をタップして旅を続けよう。');

    $('#btn-dice').addEventListener('click', rollDice);
    $('#btn-mute').addEventListener('click', () => {
      Store.setMuted(!Store.get().muted);
      Sound.setMuted(Store.get().muted);
      renderMute();
      Sound.click();
    });
    $('#btn-open-current').addEventListener('click', () => !busy && openModal(Store.get().currentStationId));
    $('#modal').addEventListener('click', onModalClick);
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!$('#cutin').hidden) return closeCutIn();
      if (!$('#celebrate').hidden) return $('#celebrate [data-dismiss]').click();
      if (!$('#modal').hidden) return closeModal();
      if (pending) clearPending();
    });
    document.querySelectorAll('[data-tab]').forEach((t) => t.addEventListener('click', () => showView(t.dataset.tab)));
    document.querySelectorAll('[data-tab-jump]').forEach((b) => b.addEventListener('click', () => showView(b.dataset.tabJump)));
    $('#btn-trip-cta').addEventListener('click', openTrip);
    $('#trip-root').addEventListener('click', onTripClick);
    $('#trip-root').addEventListener('change', (e) => {
      if (e.target.id !== 'trip-date') return;
      trip.departDate = e.target.value;
      renderTrip();
    });
    $('#btn-clear-course').addEventListener('click', clearCourse);
    $('#mini-grid').addEventListener('click', (e) => {
      const c = e.target.closest('[data-station]');
      if (c && !busy) openModal(c.dataset.station);
    });
    $('#collection-grid').addEventListener('click', (e) => {
      const c = e.target.closest('[data-station]');
      if (c) openModal(c.dataset.station);
    });
    $('#collection-grid').addEventListener('keydown', (e) => {
      const c = e.target.closest('[data-station]');
      if (c && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        openModal(c.dataset.station);
      }
    });
    $('#btn-reset').addEventListener('click', () => {
      if (!confirm('旅の記録（訪問・買収・推し駅）をすべてリセットします。よろしいですか？')) return;
      Store.reset();
      Store.visit(D.meta.startStationId);
      syncRankSeen();
      clearPending();
      Map.placeTrain(D.meta.startStationId);
      renderAll();
      toast('旅の記録をリセットしました。博多から再出発！');
    });

    let view = 'map';
    try {
      view = sessionStorage.getItem('yokatabi.view') || 'map';
    } catch (e) {
      /* noop */
    }
    showView(['collection', 'trip'].includes(view) ? view : 'map');
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
