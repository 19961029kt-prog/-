// UI全体の結線：ヘッダー（称号・踏破率・総資産額・クラフト資金・アバター）・よりみちダイス・寄り道手帖（モーダル）・
// オーナー刻印の演出・オーナー刻印手帖・マイ旅しおり・Xシェア。刻印の2段階フローは owner.js、工房は garage.js。
(function () {
  'use strict';
  const { Data, Store, Sound, Map, Trip, Craft, Dice, Owner, Garage } = window.YT;

  let D = null;
  let busy = false; // 列車走行中・ダイス回転中
  let choice = null; // ダイスのあとの行き先候補 { n, dests: { id: path } }
  let modalStationId = null;
  let lastFocus = null;

  const $ = (sel, root = document) => root.querySelector(sel);
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
  }

  function renderCurrent() {
    const st = Store.get();
    const s = D.byId[st.currentStationId];
    if (!s) return;
    $('#current-name').innerHTML = `${esc(s.name)}<small>駅</small>`;
    $('#current-pref').textContent = s.prefecture;
    $('#current-pref').style.setProperty('--pref', (D.meta.prefectures[s.prefecture] || {}).color);
    $('#current-tagline').textContent = s.tagline;
    $('#current-status').innerHTML = st.acquired[s.id]
      ? '<span class="chip chip-gold">印 オーナー刻印済み</span>'
      : Owner.isPendingFor(s.id)
        ? '<span class="chip chip-green">🧭 視察・手配中</span>'
        : '<span class="chip">まだ刻印していません</span>';
    // 手配中の駅を別の駅で忘れないよう、パネルの下に小さく出す
    const p = Owner.pending();
    const chip = $('#pending-chip');
    chip.hidden = !p || Store.isAcquired(p.stationId);
    if (!chip.hidden) {
      chip.innerHTML = `<span>🧭 <b>${esc(D.byId[p.stationId].name)}駅</b>を${esc(p.provider)}で視察・手配中</span><button class="link-btn" data-open-station="${esc(p.stationId)}">寄り道手帖をひらく</button>`;
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
  }

  // ---------- 称号（刻印した駅の評価額の合計でランクアップ） ----------
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
    $('#rank-chip').setAttribute('aria-label', `称号 ${info.rank.title}${info.next ? `。次の「${info.next.title}」まであと${yenBig(info.toNext)}` : '。最高位です'}`);
    $('#rank-ladder').innerHTML = `
      <div class="ladder-head">
        <h3 class="ladder-title">称号の道</h3>
        <p class="ladder-next">${
          info.next
            ? `次の称号「<b>${esc(info.next.title)}</b>」まで、刻印した資産あと <b>${yenBig(info.toNext)}</b>`
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

  // オーナー刻印のたびに呼ぶ：称号が上がっていたらカットインを出す
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
    const share = shareUrl(`【称号ランクアップ】九州の駅にオーナー刻印を押しつづけて、称号「${rank.title}」になりました！\n総資産 ${yenBig(assets)}`);
    layer.className = `cutin rank-${rank.metal}`;
    layer.innerHTML = `
      <div class="cutin-band" role="alertdialog" aria-labelledby="cutin-title" aria-describedby="cutin-flavor">
        <div class="cutin-inner">
          <div class="cutin-emblem">${emblemHtml(rank, 'xl')}</div>
          <div class="cutin-text">
            <p class="cutin-kicker">称号がひとつ上がりました</p>
            <p class="cutin-from">${esc(from.title)} <i>➔</i></p>
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

  // ---------- 紙吹雪（テラコッタ・山吹・セージの紙片） ----------
  const PAPER = ['#d96b43', '#d49a35', '#5b8266', '#f1d78a', '#e8a07f', '#faf6f0'];
  function confetti(container, n = 28) {
    if (!container) return;
    const box = document.createElement('div');
    box.className = 'paper-confetti';
    box.setAttribute('aria-hidden', 'true');
    box.innerHTML = Array.from({ length: n }, () => {
      const c = PAPER[Math.floor(Math.random() * PAPER.length)];
      return `<i style="--c:${c};--x:${(Math.random() * 100).toFixed(1)}%;--dx:${((Math.random() - 0.5) * 160).toFixed(0)}px;--d:${(Math.random() * 0.35).toFixed(2)}s;--r:${(Math.random() * 720 - 360).toFixed(0)}deg;--w:${(5 + Math.random() * 6).toFixed(1)}px"></i>`;
    }).join('');
    container.appendChild(box);
    setTimeout(() => box.remove(), 2600);
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
      : '<p class="mini-empty">寄り道手帖のボタンからお取り寄せ・予約の手配をして、オーナー刻印を押すと、ここに切手のようなカードが増えていきます。</p>';
    miniShown = new Set(owned.map((stn) => stn.id));
  }

  // ---------- トースト ----------
  function toast(msg, kind = '') {
    const box = $('#toasts');
    const t = document.createElement('div');
    t.className = `toast ${kind}`;
    t.textContent = msg;
    box.appendChild(t);
    setTimeout(() => t.classList.add('is-out'), 3200);
    setTimeout(() => t.remove(), 3700);
  }

  function setGuide(html) {
    $('#guide').innerHTML = html;
  }
  const IDLE_GUIDE = 'よりみちダイスを振るか、地図の駅をタップして旅をつづけましょう。';

  // ---------- 移動 ----------
  async function travel(path) {
    busy = true;
    document.body.classList.add('is-busy');
    $('#btn-dice').disabled = true;
    Sound.depart();
    await Map.moveTrain(path, { onJoint: (k) => Sound.railJoint(k) });
    busy = false;
    document.body.classList.remove('is-busy');
    $('#btn-dice').disabled = false;
    arrive(path[path.length - 1], path.length - 1);
  }

  function arrive(id, hops) {
    const s = D.byId[id];
    const first = Store.visit(id);
    Sound.arrive();
    renderAll();
    if (first) {
      setTimeout(() => {
        Sound.coin();
        toast(`🧭 ${s.name}駅に初めて到着！ よりみち発見ボーナス ＋${yen(D.meta.craft.discoveryBonus)}（クラフト資金）`, 'toast-gold');
      }, 500);
    }
    setGuide(hops ? `<b>${esc(s.name)}駅</b>に到着しました（${hops}区間）。寄り道手帖をひらきます…` : `<b>${esc(s.name)}駅</b>の寄り道手帖`);
    setTimeout(() => openModal(id), hops ? 450 : 0);
  }

  function onStationClick(id) {
    if (busy) return;
    Sound.unlock();
    if (choice) {
      if (!choice.dests[id]) {
        toast('波紋の広がっている駅から、行き先を選んでください');
        return;
      }
      const path = choice.dests[id];
      clearChoice();
      travel(path);
      return;
    }
    const cur = Store.get().currentStationId;
    if (id === cur) return openModal(id);
    const path = Data.shortestPath(D, cur, id);
    if (!path) return openModal(id);
    travel(path);
  }

  function clearChoice() {
    choice = null;
    Map.setCandidates(null);
    $('#btn-dice').disabled = false;
    $('#dice-badge').hidden = true;
    renderTickets();
  }

  // ---------- よりみちダイス ----------
  async function rollDice() {
    if (busy || choice) return;
    Sound.unlock();
    busy = true;
    $('#btn-dice').disabled = true;
    $('#dice-result').textContent = '…';
    Sound.diceShake();
    const n = 1 + Math.floor(Math.random() * 6);
    await Dice.roll(n, (s) => Sound.diceHit(s));
    Sound.diceSettle();
    Store.countRoll();
    busy = false;
    confetti($('#dice-confetti'), 24);
    showResult(n);
  }

  // 出目 n で行ける駅を出す。よりみち切符が残っていれば、すぐには出発せず ±1 を選べるようにする
  function showResult(n) {
    const cur = Store.get().currentStationId;
    const dests = Data.diceDestinations(D, cur, n);
    const ids = Object.keys(dests);
    $('#dice-result').textContent = `${n}`;
    const hops = dests[ids[0]].length - 1;
    const badge = $('#dice-badge');
    badge.innerHTML = `<b>${hops}</b>マスすすむ！`;
    badge.hidden = false;
    badge.classList.remove('is-pop');
    void badge.offsetWidth;
    badge.classList.add('is-pop');
    const reach = hops < n ? `線路の果てまで${hops}区間。` : `${n}区間先の`;
    const canTicket = Craft.ticketsLeft() > 0;
    choice = { n, dests };
    Map.setCandidates(ids);
    renderTickets();
    if (ids.length === 1 && !canTicket) {
      setGuide(`<b>${n}</b>の目！ ${reach}<b>${esc(D.byId[ids[0]].name)}駅</b>へ出発します。`);
      setTimeout(() => {
        if (!choice) return;
        const path = choice.dests[ids[0]];
        clearChoice();
        travel(path);
      }, 900);
      return;
    }
    setGuide(
      `<b>${n}</b>の目！ ${reach}${ids.length > 1 ? `分かれ道です。波紋の広がる<b>${ids.length}駅</b>から行き先を選んでください。` : `<b>${esc(D.byId[ids[0]].name)}駅</b>をタップすると出発します。`}` +
        ` <button class="link-btn" id="btn-cancel-choice">やめる</button>`
    );
    $('#btn-cancel-choice').addEventListener('click', () => {
      clearChoice();
      setGuide(IDLE_GUIDE);
    });
  }

  // よりみち切符：出目を ±1 する（1日に使える枚数は、アンロックした高級車両・連結車両の数で決まる）
  function renderTickets() {
    const bar = $('#ticket-bar');
    const per = Craft.ticketsPerDay();
    if (!per) {
      bar.innerHTML = '<p class="ticket-hint">🎫 よりみち切符：高級車両や連結車両をアンロックすると、出目を±1できる切符が使えます</p>';
      return;
    }
    const left = Craft.ticketsLeft();
    const holes = Array.from({ length: per }, (_, i) => `<i class="${i < per - left ? 'is-used' : ''}"></i>`).join('');
    const active = !!choice && left > 0;
    bar.innerHTML = `<div class="ticket">
        <span class="ticket-name">よりみち切符</span><span class="ticket-holes" aria-label="今日はあと${left}枚">${holes}</span>
        <span class="ticket-btns">
          <button class="ticket-btn" data-ticket="-1" ${active && choice.n > 1 ? '' : 'disabled'} aria-label="出目を1へらす">−1</button>
          <button class="ticket-btn" data-ticket="1" ${active ? '' : 'disabled'} aria-label="出目を1ふやす">＋1</button>
        </span>
      </div>
      <p class="ticket-hint">${active ? '出目を±1して、狙った駅に止まれます（今日はあと' + left + '枚）' : left ? `ダイスを振ったあとに使えます（今日はあと${left}枚）` : '今日の切符は使い切りました。また明日'}</p>`;
  }
  function useTicket(delta) {
    if (!choice || Craft.ticketsLeft() <= 0) return;
    const n = Math.max(1, choice.n + delta);
    if (n === choice.n) return;
    Craft.useTicket();
    Sound.ticket();
    Map.setCandidates(null);
    choice = null;
    Dice.show(Math.min(6, n));
    toast(`🎫 よりみち切符を使って、出目を${n}にしました`, 'toast-green');
    showResult(n);
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
      return `【${s.name}駅】のオーナー刻印を押しました📮 資産評価額${yen(s.assetValue)}\n称号「${rankInfo(st.assets).rank.title}」／刻印 ${st.acquiredCount}駅／総資産 ${yenBig(st.assets)}`;
    }
    return `${s.name}駅に寄り道中🚃 ${s.tagline}\n九州踏破率 ${st.visitedPct}%`;
  }

  // ---------- 寄り道手帖（モーダル） ----------
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
    const pendingHere = Owner.isPendingFor(id) && !acq;
    const card = $('#modal-card');
    card.style.setProperty('--pref', color);
    card.classList.toggle('is-acquired', !!acq);

    card.innerHTML = `
      <header class="modal-head">
        <div class="chips">
          <span class="chip chip-pref">${esc(s.prefecture)}</span>
          <span class="chip">${esc(s.propertyType)}</span>
          ${s.special === 'ferry' ? '<span class="chip chip-sea">⛴ 特別航路</span>' : ''}
        </div>
        <p class="modal-kicker">寄り道手帖</p>
        <h2 id="modal-title" class="modal-title">${esc(s.name)}<small>駅</small></h2>
        <p class="modal-kana">${esc(s.kana)} ／ ${esc(s.tagline)}</p>
        <div class="modal-value">
          <span>資産評価額</span><b>${yen(s.assetValue)}</b>
          ${acq ? `<span class="chip chip-gold">印 オーナー刻印済み ${fmtDate(acq.at)}</span>` : pendingHere ? '<span class="chip chip-green">🧭 視察・手配中</span>' : '<span class="chip chip-dim">オーナー募集中</span>'}
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
          ? `<div class="owner-banner is-owner">印 あなたはこの駅の<b>オーナー</b>です（${acq.via === 'stay' ? '宿泊・体験' : '名産品'}の手配で刻印）</div>`
          : pendingHere
            ? Owner.panelHtml(id)
            : `<div class="owner-banner">📮 <b>この手帖の中のボタン</b>からお取り寄せ・宿の予約を手配して、戻ってきたら<b>オーナー刻印</b>を押せます。
               <small>※商品名で別に検索しても刻印にはなりません。ボタンを押してすぐ戻っただけでも刻印にはなりません</small></div>`
      }

      <section class="modal-sec">
        <h3 class="sec-title"><span>🚃</span>車窓とまちの寄り道ノート</h3>
        <p class="memo">${esc(s.memo)}</p>
      </section>

      <section class="modal-sec">
        <h3 class="sec-title"><span>🎁</span>名産品物件 <em>お取り寄せで刻印へ</em></h3>
        <div class="items">
          ${s.products
            .map(
              (p) => `<div class="item">
                <div class="item-name">${esc(p.name)}</div>
                <p class="item-desc">${esc(p.desc)}</p>
                <div class="aff-row">${affButtons(aff.products, p.keyword, 'product', p.name, id)}</div>
              </div>`
            )
            .join('')}
        </div>
      </section>

      <section class="modal-sec">
        <h3 class="sec-title"><span>♨</span>宿泊・体験物件 <em>宿の予約で刻印へ</em></h3>
        <div class="item">
          <div class="item-name">${esc(s.stay.name)} <span class="chip chip-dim">${esc(s.stay.kind)}</span></div>
          <p class="item-desc">${esc(s.stay.desc)}</p>
          <div class="aff-row">${affButtons(aff.stays, s.stay.keyword, 'stay', s.stay.name, id)}</div>
        </div>
      </section>

      <p class="disclosure">${esc(aff.disclosure)}</p>

      <footer class="modal-foot">
        <a class="share-btn" href="${esc(shareUrl(stationShareText(s)))}" target="_blank" rel="noopener">
          <span class="x-logo" aria-hidden="true">𝕏</span>${acq ? '刻印をシェア' : '寄り道をシェア'}
        </a>
        <button class="fav-btn ${st.favorites[id] ? 'is-on' : ''}" data-fav>${st.favorites[id] ? '🔔 推し駅' : '🔔 推し駅にする'}</button>
        <button class="ghost-btn" data-close>旅をつづける</button>
      </footer>`;
  }

  // 手帖をひらいている駅だけ描き直す（オーナー刻印の流れから呼ぶ）
  function refreshModal(id) {
    if (modalStationId === id) {
      const top = $('#modal-card').scrollTop;
      renderModal(id);
      $('#modal-card').scrollTop = top;
    }
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
    if (!choice) setGuide(IDLE_GUIDE);
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }

  function onModalClick(ev) {
    if (ev.target.closest('[data-close]') || ev.target === $('#modal')) return closeModal();
    if (Owner.onClick(ev)) return;
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
    // リンク自体は通常どおり新しいタブで開く（ポップアップブロック回避のため preventDefault しない）
    if (a) Owner.start(a.dataset.stationId, a);
  }

  // ---------- オーナー刻印の完了演出 ----------
  function celebrate(id) {
    const s = D.byId[id];
    Sound.fanfare();
    Map.burst(id);
    checkRankUp(2600);
    const layer = $('#celebrate');
    layer.innerHTML = `
      <div class="celebrate-box" role="alertdialog" aria-labelledby="celebrate-title">
        <p class="celebrate-kicker">おめでとうございます</p>
        <h2 id="celebrate-title" class="celebrate-title">オーナー刻印、完了！</h2>
        <div class="celebrate-card">${stampCard(s, Store.getAcquisition(id), 'big')}</div>
        <p class="celebrate-msg"><b>${esc(s.name)}駅</b>のオーナーになりました。<br>総資産額とクラフト資金に <b>${yen(s.assetValue)}</b> が加わりました。</p>
        <div class="celebrate-actions">
          <a class="share-btn" href="${esc(shareUrl(stationShareText(s)))}" target="_blank" rel="noopener"><span class="x-logo">𝕏</span>刻印をシェア</a>
          ${canMakeTrip() ? '<button class="ghost-btn ghost-light" data-go-trip>🧳 刻印した駅で旅しおりを作る</button>' : ''}
          <button class="ghost-btn ghost-light" data-go-garage>🚂 クラフト工房へ</button>
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
    // 刻印した駅が旅しおりの条件に届いた瞬間に、一度だけ提案する
    if (canMakeTrip() && !Store.get().tripPrompted) {
      Store.markTripPrompted();
      setTimeout(() => toast('🧳 刻印した駅が2つになりました。その駅を巡る1泊2日のモデルコースを作れます', 'toast-gold'), 1100);
    }
    $('[data-dismiss]', layer).focus();
  }

  // ---------- 切手風のスタンプカード ----------
  // size: '' | 'big'（刻印の完了演出）| 'mini'（右側の手帖）
  const JOY = () => Object.fromEntries(D.meta.owner.joys.map((j) => [j.id, j]));
  function stampCard(s, acq, size = '', extraClass = '') {
    const color = (D.meta.prefectures[s.prefecture] || {}).color;
    const via = acq.via === 'stay' ? `♨ ${acq.provider}で${acq.item}を予約手配` : `🎁 ${acq.provider}で${acq.item}を手配`;
    const joy = acq.joy && JOY()[acq.joy];
    const no = String(D.stations.indexOf(s) + 1).padStart(3, '0');
    return `
      <article class="stamp ${size ? `stamp-${size}` : ''} ${extraClass}" style="--pref:${color}" data-station="${esc(s.id)}" tabindex="0" aria-label="${esc(s.name)}駅のオーナー刻印カード">
        <div class="stamp-paper">
          <div class="stamp-art" aria-hidden="true">${stampArt(s)}</div>
          <div class="stamp-top"><span>${esc(s.prefecture)}</span><span>${esc(s.propertyType)}</span></div>
          <div class="stamp-value"><b>${Number(s.assetValue).toLocaleString('ja-JP')}</b><small>万円</small></div>
          <h3 class="stamp-name">${esc(s.name)}<small>駅</small></h3>
          ${size === 'mini' ? '' : `<p class="stamp-tagline">${esc(s.tagline)}</p><p class="stamp-via">${esc(via)}</p>`}
          ${size === 'mini' ? '' : `<div class="stamp-foot"><span class="stamp-owner">${Craft.avatarSvg(undefined, { crop: true })}</span><span>${joy ? `${joy.icon} ${esc(joy.label)}` : '九州よりみちオーナー証'}</span><span>第${no}号</span></div>`}
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
          <p class="owner-sub">刻印 ${s.acquiredCount}駅 ／ 九州踏破率 ${s.visitedPct}%</p>
        </div>
      </div>`;
    $('#col-kingdom').textContent = `${s.acquiredPct}%`;
    $('#col-assets').textContent = yenBig(s.assets);
    $('#col-count').textContent = `${s.acquiredCount} / ${s.n}`;
    $('#col-max').textContent = yenBig(D.totalAsset);
    $('#col-share').href = shareUrl(
      s.acquiredCount
        ? `称号「${info.rank.title}」として、九州の${s.acquiredCount}駅にオーナー刻印を押しました📖 総資産 ${yenBig(s.assets)}`
        : `よりみちダイス片手に、九州の旅をはじめました🎲 九州踏破率 ${s.visitedPct}%`
    );
    $('#collection-grid').innerHTML = D.stations
      .map((stn) => {
        const acq = st.acquired[stn.id];
        if (acq) return stampCard(stn, acq);
        const visited = !!st.visited[stn.id];
        const pend = Owner.isPendingFor(stn.id);
        return `<article class="stamp-blank" data-station="${esc(stn.id)}" tabindex="0" style="--pref:${(D.meta.prefectures[stn.prefecture] || {}).color}">
            <div class="blank-q" aria-hidden="true">${pend ? '🧭' : '？'}</div>
            <div class="blank-name">${esc(stn.name)}<small>駅</small></div>
            <div class="blank-pref">${esc(stn.prefecture)}・${esc(stn.propertyType)}</div>
            <div class="blank-value">評価額 ${yen(stn.assetValue)}</div>
            <div class="blank-state">${pend ? '視察・手配中' : visited ? '訪問済み・まだ刻印していません' : 'まだ訪れていない駅'}</div>
          </article>`;
      })
      .join('');
    document.querySelectorAll('[data-sub]').forEach((v) => (v.hidden = v.dataset.sub !== techoSub));
    document.querySelectorAll('[data-sub-tab]').forEach((b) => {
      b.classList.toggle('is-active', b.dataset.subTab === techoSub);
      b.setAttribute('aria-selected', b.dataset.subTab === techoSub);
    });
    if (techoSub === 'trip') renderTrip();
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
    try {
      sessionStorage.setItem('yokatabi.view', name);
    } catch (e) {
      /* noop */
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ---------- マイ旅しおり（オーナー刻印手帖の中） ----------
  // 刻印した駅から 1泊2日のモデルコースを自動生成（js/trip.js）し、宿をまとめて比較・保存・共有する
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
    techoSub = 'trip';
    showView('collection');
  }

  function renderTripCta() {
    const btn = $('#btn-trip-cta');
    const need = D.meta.trip.minAcquired - acquiredIds().length;
    btn.disabled = need > 0;
    btn.innerHTML = need > 0 ? `🧳 あと${need}駅の刻印で旅しおりが作れます` : '🧳 刻印した駅で1泊2日の旅しおりを作る';
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
            ${owned ? '<span class="chip chip-gold">印 オーナー刻印済み</span>' : ''}
            ${it.kind === 'free' && it.suggest ? '<span class="chip chip-sea">寄り道候補・まだ刻印していません</span>' : ''}
          </div>
          <p class="tl-text">${esc(it.text)}</p>
          ${it.kind === 'free' && it.suggest ? `<p class="tl-sub">刻印すると、次の旅しおりのコースに入ります。<button class="link-btn" data-open-station="${esc(s.id)}">寄り道手帖を見る</button></p>` : ''}
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
              <div class="chips">
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
    return `【マイ旅しおり】オーナー刻印した九州の駅を巡る1泊2日🧳\n${route}\n資産評価額の合計 ${yenBig(plan.asset)}`;
  }

  function renderTrip() {
    const root = $('#trip-root');
    const cfg = D.meta.trip;
    const ids = acquiredIds();
    const { plan, saved } = currentPlan();
    const r = tripResult();
    const savedSec = `<section class="saved-sec"><h3 class="sec-title"><span>📚</span>保存した旅しおり</h3>${savedListHtml()}</section>`;

    if (!plan && !saved && r.reason === 'few') {
      root.innerHTML = `
        <div class="booklet booklet-locked">
          <p class="booklet-kicker">マイ旅しおり</p>
          <h2 class="booklet-title">マイ旅しおり</h2>
          <p class="booklet-lead">オーナー刻印した駅が <b>${cfg.minAcquired}駅</b> になると、その駅を巡る<b>リアル九州旅行のモデルコース（1泊2日）</b>を自動でつくり、宿をまとめて比較できます。</p>
          <div class="lock-progress"><i style="width:${pct(ids.length, cfg.minAcquired)}%"></i></div>
          <p class="booklet-lead">いま刻印した駅 <b>${ids.length}</b> / ${cfg.minAcquired}駅 ── あと<b>${r.need}駅</b></p>
          <button class="dice-btn" data-tab-go="map">🎲 すごろくマップへ</button>
        </div>${savedSec}`;
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
      root.innerHTML = `${tabs}<div class="booklet"><p>刻印した駅どうしが離れていて、1泊2日に収まるコースが見つかりませんでした。もう少し近い駅に刻印すると提案できます。</p></div>${savedSec}`;
      return;
    }

    const left = ids.filter((id) => !plan.visits.includes(id));
    const otherOvernights = saved ? [] : r.plans.map((p) => p.overnight);
    root.innerHTML = `
      ${tabs}
      <article class="booklet" id="booklet">
        <div class="booklet-ribbon" aria-hidden="true">1泊2日</div>
        <p class="booklet-kicker">マイ旅しおり ── オーナー刻印した駅を巡るリアル九州旅行のモデルコース</p>
        <h2 class="booklet-title">${esc(plan.title)}</h2>
        <p class="booklet-route">${plan.visits
          .map((id) => `<span class="${id === plan.overnight ? 'is-night' : ''}">${esc(D.byId[id].name)}${id === plan.overnight ? '<small>泊</small>' : ''}</span>`)
          .join('<i>→</i>')}</p>
        <dl class="booklet-stats">
          <div><dt>巡る刻印駅</dt><dd>${plan.visits.length}駅</dd></div>
          <div><dt>移動時間（目安）</dt><dd>${plan.moved}</dd></div>
          <div><dt>資産評価額の合計</dt><dd>${yenBig(plan.asset)}</dd></div>
        </dl>
        <div class="booklet-actions">
          <label class="date-field">出発日 <input type="date" id="trip-date" value="${esc(trip.departDate)}"></label>
          <button class="ghost-btn" data-show-course>🗺️ 地図でルートを見る</button>
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
        ${left.length ? `<p class="booklet-left">🧭 今回のコースに入りきらなかった刻印駅：<b>${left.map((id) => esc(D.byId[id].name)).join('・')}</b>（2泊以上の旅や、別のプランでどうぞ）</p>` : ''}
        <p class="booklet-notice">※${esc(cfg.notice)}</p>
      </article>

      <section class="stay-compare" id="trip-stays">
        <h3 class="sec-title"><span>🏨</span>宿をまとめて比較する <em>楽天トラベル・じゃらん</em></h3>
        <p class="stay-lead">このプランの宿泊地と、ほかの候補プランの宿泊地を並べています。ボタンを押すと各サイトで同じ条件の宿を探せます（まだ刻印していない駅は、予約の手配のあとにオーナー刻印へ進めます）。</p>
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
    toast('🗺️ モデルコースを地図に表示しました（数字は巡る順番、泊は宿泊地）');
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
    // 宿比較のボタン：リンクは新しいタブで開き、その駅の「視察・手配中」にする（刻印は戻ってきてから）
    const a = t.closest('.aff-btn');
    if (a && a.dataset.stationId) {
      Owner.start(a.dataset.stationId, a);
      if (!Store.isAcquired(a.dataset.stationId)) toast(`🏨 ${a.dataset.label}で${D.byId[a.dataset.stationId].name}の宿を視察中。予約の手配が済んだら戻ってきてください`);
    }
  }

  // ---------- ミュート ----------
  function renderMute() {
    const m = Store.get().muted;
    const b = $('#btn-mute');
    b.innerHTML = m
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16.5 8.5q2.5 3.5 0 7M19 6q4.5 6 0 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
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
    Sound.setMuted(Store.get().muted);
    renderMute();
    syncRankSeen();

    const st = Store.get();
    if (!D.byId[st.currentStationId]) Store.visit(D.meta.startStationId);
    Map.init($('#map'), D, { onStationClick });
    Map.placeTrain(Store.get().currentStationId);
    Dice.mount($('#die'));
    const api = { esc, yen, yenBig, fmtDate, toast, renderAll, refreshModal, celebrate, confetti };
    Owner.init(D, api);
    Garage.init(D, api, $('#garage-root'));
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
      const o = e.target.closest('#pending-chip [data-open-station], #collection-grid [data-station], #mini-grid [data-station]');
      if (o && !busy) openModal(o.dataset.openStation || o.dataset.station);
    });
    $('#collection-grid').addEventListener('keydown', (e) => {
      const c = e.target.closest('[data-station]');
      if (c && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        openModal(c.dataset.station);
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!$('#cutin').hidden) return closeCutIn();
      if (!$('#owner-sheet').hidden) return Owner.closeSheet();
      if (!$('#celebrate').hidden) return $('#celebrate [data-dismiss]').click();
      if (!$('#modal').hidden) return closeModal();
      if (choice) clearChoice();
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
    $('#trip-root').addEventListener('click', onTripClick);
    $('#trip-root').addEventListener('change', (e) => {
      if (e.target.id !== 'trip-date') return;
      trip.departDate = e.target.value;
      renderTrip();
    });
    $('#btn-clear-course').addEventListener('click', clearCourse);
    $('#btn-course-trip').addEventListener('click', openTrip);
    $('#btn-reset').addEventListener('click', () => {
      if (!confirm('旅の記録（訪問・オーナー刻印・推し駅・クラフト工房のパーツ）をすべてリセットします。よろしいですか？')) return;
      Store.reset();
      Store.visit(D.meta.startStationId);
      syncRankSeen();
      clearChoice();
      Map.refreshTrain();
      Map.placeTrain(D.meta.startStationId);
      renderAll();
      toast('旅の記録をリセットしました。博多から再出発です');
    });

    let view = 'map';
    try {
      view = sessionStorage.getItem('yokatabi.view') || 'map';
    } catch (e) {
      /* noop */
    }
    showView(['collection', 'garage'].includes(view) ? view : 'map');
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
