// UI全体の結線：ヘッダー指標・サイコロ・物件カード（モーダル）・買収演出・コレクション手帳・Xシェア。
(function () {
  'use strict';
  const { Data, Store, Sound, Map } = window.YT;

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
    renderCollection();
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
      `🎲 <b>${n}</b>！ ${reach}分かれ道です。光っている<span class="text-amber-600 font-bold">${ids.length}駅</span>から行き先を選んでね。` +
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

  function affButtons(providers, keyword, via, item) {
    return providers
      .map(
        (p) =>
          `<a class="aff-btn ${esc(p.className || '')}" href="${esc(buildUrl(p, keyword))}" target="_blank"
              rel="sponsored noopener" data-via="${via}" data-provider="${esc(p.id)}" data-label="${esc(p.label)}"
              data-item="${esc(item)}">${esc(p.label)}<span aria-hidden="true">↗</span></a>`
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
      return `【${s.name}駅】の物件（評価額：${yen(s.assetValue)}）を完全買収しました！✨\n王国経営度 ${st.acquiredPct}%／総資産 ${yen(st.assets)}`;
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
    const layer = $('#celebrate');
    layer.innerHTML = `
      <div class="confetti" aria-hidden="true">${Array.from({ length: 40 }, (_, i) =>
        `<i style="--i:${i};--x:${Math.random() * 100}%;--d:${(Math.random() * 0.8).toFixed(2)}s;--h:${Math.floor(Math.random() * 360)}"></i>`
      ).join('')}</div>
      <div class="celebrate-box" role="alertdialog" aria-labelledby="celebrate-title">
        <p class="celebrate-kicker">ACQUISITION COMPLETE</p>
        <h2 id="celebrate-title" class="celebrate-title">買収完了！</h2>
        ${holoCard(s, Store.getAcquisition(id), true)}
        <p class="celebrate-msg"><b>${esc(s.name)}駅</b>の正式オーナーになりました。<br>総資産に <b>${yen(s.assetValue)}</b> が加算されます。</p>
        <div class="flex flex-wrap gap-2 justify-center">
          <a class="share-btn is-gold" href="${esc(shareUrl(stationShareText(s)))}" target="_blank" rel="noopener"><span class="x-logo">𝕏</span>買収を自慢する</a>
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
    $('[data-dismiss]', layer).focus();
  }

  // ---------- ホログラム風スタンプカード ----------
  function holoCard(s, acq, big = false) {
    const color = (D.meta.prefectures[s.prefecture] || {}).color;
    const via = acq.via === 'stay' ? `♨ ${acq.provider}で${acq.item}を予約` : `🎁 ${acq.provider}で${acq.item}をお取り寄せ`;
    return `
      <article class="holo ${big ? 'holo-big' : ''}" style="--pref:${color}" data-station="${esc(s.id)}" tabindex="0">
        <div class="holo-inner">
          <div class="holo-top"><span>${esc(s.prefecture)}</span><span>${esc(s.propertyType)}</span></div>
          <div class="holo-stamp" aria-hidden="true"><span class="holo-stamp-ring">買収済</span><span class="holo-stamp-name">${esc(s.name)}</span><span class="holo-stamp-date">${fmtDate(acq.at)}</span></div>
          <h3 class="holo-name">${esc(s.name)}<small>駅</small></h3>
          <p class="holo-tagline">${esc(s.tagline)}</p>
          <div class="holo-value"><span>資産評価額</span><b>${yen(s.assetValue)}</b></div>
          <p class="holo-via">${esc(via)}</p>
          <div class="holo-foot"><span>KYUSHU OWNER'S CERTIFICATE</span><span>No.${String(D.stations.indexOf(s) + 1).padStart(3, '0')}</span></div>
        </div>
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
        card.style.setProperty('--rx', `${(0.5 - py) * 14}deg`);
        card.style.setProperty('--ry', `${(px - 0.5) * 18}deg`);
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
        ? `九州の${s.acquiredCount}物件を買収し、王国経営度 ${s.acquiredPct}%・総資産 ${yen(s.assets)} に到達しました！👑`
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
    try {
      sessionStorage.setItem('yokatabi.view', name);
    } catch (e) {
      /* noop */
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

    Sound.setMuted(Store.get().muted);
    renderMute();

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
      if (!$('#celebrate').hidden) return $('#celebrate [data-dismiss]').click();
      if (!$('#modal').hidden) return closeModal();
      if (pending) clearPending();
    });
    document.querySelectorAll('[data-tab]').forEach((t) => t.addEventListener('click', () => showView(t.dataset.tab)));
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
    showView(view === 'collection' ? 'collection' : 'map');
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
