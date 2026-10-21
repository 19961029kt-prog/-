// 旅のゲームの仕組み（上品な「旅の手帖」のまま、思わず声が出る5つの仕掛け）
//   1) 🎯 スポットライト駅：いつも1駅が「次に目指す駅」に選ばれる。ダイスでピタリと止まると、一番乗りのご祝儀（クラフト資金）とレア切符。
//      すぐにルーレットで次のスポットライト駅が決まる
//   2) 特別切符の手札（最大5枚）：二連・三連・四連（クルーズ周遊は3回つづけて）のダイス、ピタリ指定切符（1〜6を選ぶ）。
//      駅に止まったとき・ご祝儀・工房の切符売り場で手に入る
//   3) 👑 ライン制覇：ラインの全駅で上位3名に入ると、そのラインの配当が2倍になり、路線が金色に光る
//   4) 📊 週末の大精算まつり：ダイス7回（旅の1週間）ごとに、観光収益といいねの収益をカウントアップして振り込む
//   5) 🎉 旅のごほうびサプライズ／寄り道ハプニング（止まった駅で約25%）と、⚡ 王座奪還の演出（1位を追い越した瞬間）
// お金は、すべてゲームの中だけのクラフト資金（Store.ledger に入出金として残し、残高は毎回数え直す）。
(function () {
  'use strict';
  const YT = (window.YT = window.YT || {});
  let D = null, api = null;
  const G = () => D.meta.game;
  const $ = (sel, r = document) => r.querySelector(sel);
  const esc = (s) => api.esc(s);
  const rnd = (n) => Math.floor(Math.random() * n);
  const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = (ms) => new Promise((r) => setTimeout(r, reduce() ? Math.min(ms, 120) : ms));

  // ---------- 演出の重ね（ひとつずつ順番に出す） ----------
  let closing = null; // いま出ている演出を閉じる関数
  let seq = 0; // 何番目の演出か（閉じたあとの片づけが、次にひらいた演出を消さないように）
  function overlay(html, { cls = '', onOpen } = {}) {
    const layer = $('#game-layer');
    const my = ++seq;
    return new Promise((resolve) => {
      layer.innerHTML = `<div class="gm-box ${cls}" role="alertdialog" aria-modal="true">${html}</div>`;
      layer.hidden = false;
      requestAnimationFrame(() => layer.classList.add('is-open'));
      document.body.classList.add('modal-open');
      const done = (v) => {
        if (!closing) return;
        closing = null;
        layer.classList.remove('is-open');
        document.body.classList.remove('modal-open');
        setTimeout(() => {
          if (seq !== my) return; // もう次の演出がひらいている
          layer.hidden = true;
          layer.innerHTML = '';
        }, 220);
        resolve(v);
      };
      closing = done;
      layer.onclick = (e) => {
        const b = e.target.closest('[data-gm-close]');
        if (b) done(b.dataset.gmClose || true);
      };
      if (onOpen) onOpen(layer.firstElementChild, done);
      setTimeout(() => {
        const f = layer.querySelector('[data-gm-close], button');
        if (f) f.focus({ preventScroll: true });
      }, 60);
    });
  }
  // 金の紙吹雪（たくさん）
  function goldRain(root, n = 70) {
    if (reduce()) return;
    const box = document.createElement('div');
    box.className = 'gm-rain';
    for (let i = 0; i < n; i++) {
      const p = document.createElement('i');
      p.style.left = `${Math.random() * 100}%`;
      p.style.setProperty('--d', `${Math.random() * 1.4}s`);
      p.style.setProperty('--x', `${(Math.random() - 0.5) * 160}px`);
      p.style.setProperty('--r', `${Math.random() * 720 - 360}deg`);
      p.style.background = ['#f3d58c', '#d49a35', '#fff3cf', '#d96b43', '#e2b54d'][i % 5];
      box.appendChild(p);
    }
    root.appendChild(box);
    setTimeout(() => box.remove(), 4200);
  }
  // 数字のカウントアップ（チャリン、チャリン）
  function countUp(el, to, { ms = 1100, sound = true } = {}) {
    return new Promise((resolve) => {
      const t0 = performance.now();
      let lastTick = 0;
      const d = reduce() ? 80 : ms;
      const step = (now) => {
        const t = Math.min(1, (now - t0) / d);
        const v = Math.round(to * (1 - Math.pow(1 - t, 3)));
        el.textContent = `+${api.yenBig(v)}`;
        if (sound && now - lastTick > 120 && t < 1) {
          lastTick = now;
          YT.Sound.charin(Math.round(t * 6));
        }
        if (t < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
  }

  // ---------- 1) スポットライト駅 ----------
  const hops = (a, b) => {
    const p = YT.Data.shortestPath(D, a, b);
    return p ? p.length - 1 : null;
  };
  const THEME = () => YT.Scenery.THEMES;
  function candidates(from, exclude) {
    const min = G().spotlight.minHops;
    let list = D.stations.filter((s) => s.id !== from && s.id !== exclude && (hops(from, s.id) || 0) >= min);
    if (!list.length) list = D.stations.filter((s) => s.id !== from && s.id !== exclude);
    return list;
  }
  // 旬のテーマ（温泉・火山・海・森・都市）をひとつ選び、半分の確率でそのテーマの駅から選ぶ
  function pick(from, exclude) {
    const list = candidates(from, exclude);
    const themes = [...new Set(list.map((s) => s.regionTheme))];
    const theme = themes[rnd(themes.length)];
    const inTheme = list.filter((s) => s.regionTheme === theme);
    const s = Math.random() < 0.5 && inTheme.length ? inTheme[rnd(inTheme.length)] : list[rnd(list.length)];
    return { id: s.id, theme: s.regionTheme, setAt: new Date().toISOString() };
  }
  const spot = () => YT.Store.get().spotlight;
  function ensureSpotlight() {
    const sp = spot();
    if (!sp || !D.byId[sp.id] || sp.id === YT.Store.get().currentStationId) YT.Store.setSpotlight(pick(YT.Store.get().currentStationId, sp && sp.id));
  }
  function renderBar() {
    const bar = $('#spotlight-bar');
    const sp = spot();
    if (!bar || !sp) return;
    const s = D.byId[sp.id];
    const n = hops(YT.Store.get().currentStationId, sp.id);
    const t = THEME()[sp.theme] || { icon: '🎯', label: '' };
    bar.innerHTML = `<span class="sb-target">🎯 スポットライト駅：<b>${esc(s.name)}駅</b>まで最短あと<b class="sb-n">${n == null ? '—' : n}</b>マス！</span>
      <span class="sb-theme">今週の旬 ${t.icon} ${esc(t.label)}</span>
      <span class="sb-hint">ピタリと止まると、一番乗りのご祝儀 ${api.yenBig(G().spotlight.rewardMin)}〜${api.yenBig(G().spotlight.rewardMax)}＋レア切符</span>`;
    YT.Map.setSpotlight(sp.id);
  }

  async function jackpot(id) {
    const s = D.byId[id];
    const { rewardMin, rewardMax } = G().spotlight;
    const reward = rewardMin + rnd(Math.floor((rewardMax - rewardMin) / 500) + 1) * 500;
    const kind = drawKind(true);
    const t = YT.Store.addTicket(kind, G().deckMax);
    YT.Store.addLedger('spotlight', `${s.name}駅 一番乗りのご祝儀`, reward);
    YT.Sound.jackpot();
    const def = ticketDef(kind);
    await overlay(
      `<p class="gm-kicker">🎯 スポットライト駅にピタ止め！</p>
       <h2 class="gm-title gm-jackpot">🎉 ${esc(s.name)}駅<br>一番乗り到着！！</h2>
       <p class="gm-msg">駅の観光案内所から、ようこそ記念のご祝儀をいただきました！</p>
       <p class="gm-amount" data-amount>+0万円</p>
       <div class="gm-ticket ${t ? '' : 'is-full'}">${ticketCard(kind)}<p>${t ? `レア切符『${esc(def.name)}』を手に入れた！` : '手札がいっぱいで、レア切符は受け取れませんでした'}</p></div>
       <button class="primary-btn" data-gm-close>🎡 次のスポットライト駅を決める</button>`,
      {
        cls: 'gm-gold',
        onOpen: (box) => {
          goldRain(box.parentNode, 90);
          setTimeout(() => countUp($('[data-amount]', box), reward, { ms: 1400 }), 600);
          api.renderAll();
        },
      }
    );
    await roulette(id);
  }
  // ルーレット：駅の名前がくるくる回って、だんだんゆっくり止まる
  async function roulette(from) {
    const next = pick(YT.Store.get().currentStationId, from);
    const names = candidates(YT.Store.get().currentStationId, from).map((s) => s.name);
    const seq = [];
    const steps = reduce() ? 3 : 22;
    for (let i = 0; i < steps; i++) seq.push(names[rnd(names.length)]);
    seq.push(D.byId[next.id].name);
    await overlay(
      `<p class="gm-kicker">🎡 次のスポットライト駅は…</p>
       <div class="gm-roulette"><span data-roll>…</span></div>
       <p class="gm-msg" data-roll-msg>&nbsp;</p>
       <button class="ghost-btn" data-gm-close hidden data-roll-done>旅をつづける</button>`,
      {
        onOpen: async (box) => {
          const el = $('[data-roll]', box);
          for (let i = 0; i < seq.length; i++) {
            el.textContent = `${seq[i]}駅`;
            el.classList.remove('is-tick');
            void el.offsetWidth;
            el.classList.add('is-tick');
            YT.Sound.tick();
            await wait(50 + Math.pow(i / seq.length, 3) * 380);
          }
          el.classList.add('is-final');
          YT.Store.setSpotlight(next);
          renderBar();
          YT.Sound.surprise();
          const t = THEME()[next.theme] || { icon: '', label: '' };
          $('[data-roll-msg]', box).innerHTML = `今週の旬は ${t.icon} ${esc(t.label)}。<b>${esc(D.byId[next.id].name)}駅</b>まで最短あと<b>${hops(YT.Store.get().currentStationId, next.id)}</b>マス！`;
          $('[data-roll-done]', box).hidden = false;
          $('[data-roll-done]', box).focus({ preventScroll: true });
        },
      }
    );
  }

  // ---------- 2) 特別切符の手札 ----------
  const ticketDef = (kind) => G().tickets.find((t) => t.id === kind);
  // 重み（weight）で1枚引く。rare=true ならレアの中から
  function drawKind(rare = false) {
    const pool = G().tickets.filter((t) => (rare ? t.rare : true));
    let r = Math.random() * pool.reduce((n, t) => n + t.weight, 0);
    for (const t of pool) if ((r -= t.weight) < 0) return t.id;
    return pool[0].id;
  }
  function grant(kind, why) {
    const t = YT.Store.addTicket(kind, G().deckMax);
    const def = ticketDef(kind);
    if (!t) {
      api.toast(`🎫 手札がいっぱい（${G().deckMax}枚）なので、『${def.name}』は受け取れませんでした。切符を使ってから集めましょう`);
      return null;
    }
    YT.Sound.ticket();
    api.toast(`${def.icon} ${why}『${def.name}』を手に入れた！（手札 ${YT.Store.get().deck.length}/${G().deckMax}）`, 'toast-green');
    renderDeck();
    return t;
  }
  function ticketCard(kind, { uid = '', armed = false, small = false } = {}) {
    const d = ticketDef(kind);
    return `<span class="tk-card tk-${esc(kind)} ${armed ? 'is-armed' : ''} ${small ? 'is-small' : ''}" ${uid ? `data-deck="${esc(uid)}" role="button" tabindex="0" aria-pressed="${armed}"` : ''} title="${esc(d.desc)}">
        <span class="tk-icon" aria-hidden="true">${d.icon}</span>
        <span class="tk-name">${esc(d.name)}</span>
        <span class="tk-dice">${d.pick ? '出目を選ぶ' : `ダイス×${d.dice}${d.turns ? `・${d.turns}回` : ''}`}</span>
      </span>`;
  }
  function renderDeck() {
    const box = $('#ticket-deck');
    if (!box) return;
    const st = YT.Store.get();
    const cruise = st.cruiseLeft > 0;
    box.innerHTML = `<p class="td-head"><span>🎫 特別切符</span><small>手札 ${st.deck.length}/${G().deckMax}</small></p>
      ${cruise ? `<p class="td-cruise">✨ クルーズ周遊中：あと<b>${st.cruiseLeft}</b>回、ダイス4個で振れます</p>` : ''}
      <div class="td-cards">${st.deck.length ? st.deck.map((t) => ticketCard(t.kind, { uid: t.uid, armed: st.armed === t.uid, small: true })).join('') : '<span class="td-empty">駅に止まったときや、スポットライト駅のご祝儀、工房の切符売り場で手に入ります</span>'}</div>
      ${st.armed && !cruise ? `<p class="td-armed">次のダイスで『${esc(ticketDef(st.deck.find((t) => t.uid === st.armed).kind).name)}』を使います（もう一度押すと取り消し）</p>` : ''}`;
  }
  function onDeckClick(e) {
    const c = e.target.closest('[data-deck]');
    if (!c || api.isBusy()) return;
    const st = YT.Store.get();
    if (st.cruiseLeft > 0) return api.toast('✨ クルーズ周遊中は、ほかの切符は使えません');
    YT.Store.arm(st.armed === c.dataset.deck ? null : c.dataset.deck);
    YT.Sound.click();
    renderDeck();
    api.renderDiceHint();
  }
  // 次のダイスの振り方：{ count（ダイスの数）, pick（出目を選ぶ）, label, consume（振ったら切符を使う） }
  function nextRoll() {
    const st = YT.Store.get();
    if (st.cruiseLeft > 0) return { count: 4, label: '✨ クルーズ周遊', consume: () => YT.Store.setCruise(st.cruiseLeft - 1) };
    const t = st.deck.find((x) => x.uid === st.armed);
    if (!t) return { count: 1, label: '', consume: () => {} };
    const d = ticketDef(t.kind);
    return {
      count: d.dice || 1,
      pick: !!d.pick,
      label: `${d.icon} ${d.name}`,
      consume: () => {
        YT.Store.useTicket(t.uid);
        if (d.turns) YT.Store.setCruise(d.turns - 1); // 使った1回を含めて turns 回
        renderDeck();
      },
    };
  }
  // ピタリ指定切符：1〜6 の目を選ぶ（スポットライト駅までのマスがわかるように添える）
  function pickNumber() {
    const sp = spot();
    const n = sp ? hops(YT.Store.get().currentStationId, sp.id) : null;
    return overlay(
      `<p class="gm-kicker">🎯 ピタリ指定切符</p>
       <h2 class="gm-title">出目を選んでください</h2>
       ${sp ? `<p class="gm-msg">スポットライト駅 <b>${esc(D.byId[sp.id].name)}駅</b>まで、最短あと<b>${n}</b>マス${n >= 1 && n <= 6 ? '。ピタ止めのチャンス！' : ''}</p>` : ''}
       <div class="gm-picks">${[1, 2, 3, 4, 5, 6].map((v) => `<button class="gm-pick ${v === n ? 'is-hint' : ''}" data-gm-close="${v}">${v}</button>`).join('')}</div>
       <button class="link-btn" data-gm-close="cancel">やめる（切符は使わない）</button>`,
      { cls: 'gm-small' }
    ).then((v) => (v === 'cancel' || v === true || v === undefined ? null : Number(v)));
  }

  // 工房の切符売り場：クラフト資金で切符を買う
  function renderShop() {
    const box = $('#ticket-shop');
    if (!box) return;
    const bal = YT.Craft.balance();
    const full = YT.Store.get().deck.length >= G().deckMax;
    box.innerHTML = `<section class="panel shop">
        <h2 class="shop-title">🎫 鉄道クラフト工房の切符売り場</h2>
        <p class="shop-lead">クラフト資金で特別切符を買えます（手札は最大${G().deckMax}枚。いま ${YT.Store.get().deck.length}枚）。</p>
        <div class="shop-grid">${G().tickets
          .map(
            (t) => `<div class="shop-item">${ticketCard(t.id)}<p class="shop-desc">${esc(t.desc)}</p>
              <button class="primary-btn btn-sm" data-buy-ticket="${esc(t.id)}" ${bal >= t.price && !full ? '' : 'disabled'}>${api.yen(t.price)}で買う</button></div>`
          )
          .join('')}</div>
      </section>`;
  }
  function onShopClick(e) {
    const b = e.target.closest('[data-buy-ticket]');
    if (!b || b.disabled) return;
    const def = ticketDef(b.dataset.buyTicket);
    if (YT.Craft.balance() < def.price) return;
    if (!YT.Store.addTicket(def.id, G().deckMax)) return api.toast('手札がいっぱいです');
    YT.Store.spend(def.price);
    YT.Sound.craft();
    api.toast(`${def.icon} 『${def.name}』を買いました（−${api.yen(def.price)}）`, 'toast-green');
    api.renderAll();
  }

  // ---------- 3) ライン制覇 ----------
  function paintLines() {
    YT.Map.setGoldLines(YT.Ownership.clearedLines().map((l) => new Set(l.stations)));
  }
  async function celebrateLines() {
    paintLines();
    const fresh = YT.Ownership.clearedLines().filter((l) => !YT.Store.get().linesSeen[l.id]);
    for (const l of fresh) {
      YT.Store.markLine(l.id);
      YT.Sound.stamp();
      setTimeout(() => YT.Sound.fanfare(), 300);
      await overlay(
        `<p class="gm-kicker">👑 ライン制覇</p>
         <div class="gm-stamp" aria-hidden="true"><svg viewBox="0 0 220 220"><circle cx="110" cy="110" r="100" class="ls-ring"/><circle cx="110" cy="110" r="88" class="ls-ring ls-thin"/>
           <text x="110" y="92" text-anchor="middle" class="ls-crown">👑</text><text x="110" y="128" text-anchor="middle" class="ls-big">完全制覇</text>
           <text x="110" y="156" text-anchor="middle" class="ls-small">ライン配当 ×${G().lineBonus}</text></svg></div>
         <h2 class="gm-title">${esc(l.name)}<br>完全制覇！！</h2>
         <p class="gm-msg">${l.stations.map((id) => `${esc(D.byId[id].name)}駅`).join('・')}のすべてで共同株主以上に。<br>このラインの配当が<b>${G().lineBonus}倍</b>になり、地図の路線が金色に輝きます。</p>
         <button class="primary-btn" data-gm-close>旅をつづける</button>`,
        { cls: 'gm-gold', onOpen: (box) => goldRain(box.parentNode, 50) }
      );
      api.renderAll();
    }
  }

  // ---------- 4) 週末の大精算まつり ----------
  const settleDue = () => YT.Store.get().rolls >= (YT.Store.get().settled + 1) * G().settleEvery;
  function settlementRows() {
    const rows = [];
    D.stations.forEach((s) => {
      const me = YT.Ownership.you(s.id);
      if (!me || !me.dividend) return;
      const amount = Math.round((me.dividend * G().tourismRate) / 10) * 10;
      if (amount > 0) rows.push({ label: `${s.name}駅`, sub: `${me.rank === 1 ? '👑 トップオーナー' : `📈 ${me.rank}位・共同株主`}${me.lineBonus ? `・${me.lineBonus}制覇×${G().lineBonus}` : ''}`, amount });
    });
    return rows;
  }
  async function settle() {
    const week = YT.Store.get().settled + 1;
    const rows = settlementRows();
    const tourism = rows.reduce((n, r) => n + r.amount, 0);
    const likesNow = YT.Postcards.totalLikes();
    const newLikes = Math.max(0, likesNow - (YT.Store.get().likesBanked || 0));
    const likeMoney = newLikes * D.meta.craft.likeReceivedBonus;
    const total = tourism + likeMoney;
    YT.Sound.drumroll();
    await overlay(
      `<p class="gm-kicker">📊 旅の1週間（ダイス${G().settleEvery}回）おつかれさまでした</p>
       <h2 class="gm-title">週末の大精算まつり<small>第${week}週</small></h2>
       <ol class="gm-ledger">
         <li class="gl-sec">① オーナー・株主の駅の観光収益</li>
         ${rows.length ? rows.map((r, i) => `<li class="gl-row" data-row="${i}"><span>${esc(r.label)}<small>${esc(r.sub)}</small></span><b data-v="${r.amount}">+0万円</b></li>`).join('') : '<li class="gl-row gl-empty"><span>まだありません（オーナーや共同株主になると、毎週ここに入ります）</span><b>—</b></li>'}
         <li class="gl-sec">② 旅の便りに届いたいいねの収益</li>
         <li class="gl-row" data-row="likes"><span>❤️ ${newLikes}いいね<small>1いいね ${api.yen(D.meta.craft.likeReceivedBonus)}</small></span><b data-v="${likeMoney}">+0万円</b></li>
       </ol>
       <p class="gm-total">合計 <b data-total>+0万円</b></p>
       <p class="gm-msg" data-settle-msg>&nbsp;</p>
       <button class="primary-btn" data-gm-close hidden data-settle-done>受け取って旅をつづける</button>`,
      {
        cls: 'gm-settle',
        onOpen: async (box) => {
          await wait(900);
          for (const b of box.querySelectorAll('[data-v]')) {
            const v = Number(b.dataset.v);
            b.closest('.gl-row').classList.add('is-on');
            await countUp(b, v, { ms: 520 });
            YT.Sound.charin(4);
            await wait(120);
          }
          await countUp($('[data-total]', box), total, { ms: 900 });
          // 振り込み：ドカン！
          YT.Store.addLedger('settle', `第${week}週の観光収益`, tourism);
          YT.Store.settle(likesNow);
          YT.Sound.dokan();
          goldRain(box.parentNode, 40);
          $('[data-total]', box).classList.add('is-paid');
          $('[data-settle-msg]', box).innerHTML = `💰 ドカン！ <b>${api.yenBig(total)}</b>をクラフト資金へ振り込みました`;
          api.renderAll();
          $('[data-settle-done]', box).hidden = false;
          $('[data-settle-done]', box).focus({ preventScroll: true });
        },
      }
    );
  }

  // ---------- 5) 旅のごほうびサプライズ／寄り道ハプニング ----------
  function mine() {
    return D.stations.filter((s) => {
      const r = YT.Ownership.yourRank(s.id);
      return r && r <= D.meta.owner.shareholders;
    });
  }
  const EVENTS = [
    {
      id: 'buzz', kind: 'good', weight: 3,
      when: () => mine().length > 0,
      run: () => {
        const list = mine();
        const s = list[rnd(list.length)];
        const amount = Math.max(1000, Math.round((s.assetValue * 0.6) / 500) * 500);
        return { title: '🎉 旅のごほうびサプライズ！', msg: `あなたが株主の『${s.name}駅』の${s.products[0].name}が、海外で話題沸騰！ 臨時ボーナスが届きました。`, amount };
      },
    },
    {
      id: 'cover', kind: 'good', weight: 2,
      when: () => Object.keys(YT.Store.getPostcards()).length > 0,
      run: () => {
        const ids = Object.keys(YT.Store.getPostcards());
        const s = D.byId[ids[rnd(ids.length)]];
        return { title: '📸 旅のごほうびサプライズ！', msg: `あなたが投函した『${s.name}駅』のポストカードが、九州の観光ガイドの表紙に選ばれました！ 特別賞与です。`, amount: 2500 };
      },
    },
    {
      id: 'market', kind: 'good', weight: 2,
      when: () => true,
      run: (here) => ({ title: '🧺 旅のごほうびサプライズ！', msg: `${here.name}駅の近くで、地元の方から「旅のおみやげに」と${here.products[1] ? here.products[1].name : here.products[0].name}をどっさり。旅人仲間に配ったら、お礼がたくさん届きました。`, amount: 1000 + rnd(3) * 500 }),
    },
    {
      id: 'gift', kind: 'good', weight: 2,
      when: () => YT.Store.get().deck.length < G().deckMax,
      run: () => ({ title: '🚃 旅のごほうびサプライズ！', msg: '駅のホームで出会った車掌さんから「よかったら旅のお供に」と、特別切符をいただきました。', ticket: 'express2' }),
    },
    {
      id: 'feast', kind: 'oops', weight: 2,
      when: () => true,
      run: (here) => ({
        title: '🍜 寄り道ハプニング！',
        msg: `${here.name}駅の名物「${here.products[0].name}」の誘惑に負けて、ついハシゴ……お代 −${api.yen(300)}。と思いきや、店の大将と意気投合して、特別切符をもらいました！`,
        amount: -300,
        ticket: YT.Store.get().deck.length < G().deckMax ? 'express2' : null,
      }),
    },
    {
      id: 'updraft', kind: 'oops', weight: 1,
      when: () => D.stations.some((s) => s.regionTheme === 'onsen'),
      run: () => ({ title: '🌋 寄り道ハプニング！', msg: '桜島の気まぐれな上昇気流に、列車ごとふわり。好きな温泉駅へひとっ飛びできます！', warp: true }),
    },
  ];
  async function maybeSurprise(id) {
    if (Math.random() >= G().surpriseChance) return null;
    const here = D.byId[id];
    const list = EVENTS.filter((e) => e.when(here));
    let r = Math.random() * list.reduce((n, e) => n + e.weight, 0);
    const ev = list.find((e) => (r -= e.weight) < 0) || list[0];
    return runEvent(ev, here);
  }
  async function runEvent(ev, here) {
    const out = ev.run(here);
    if (ev.kind === 'good') YT.Sound.surprise();
    else YT.Sound.oops();
    if (out.warp) {
      const onsen = D.stations.filter((s) => s.regionTheme === 'onsen' && s.id !== here.id);
      const v = await overlay(
        `<p class="gm-kicker">${esc(out.title)}</p><p class="gm-msg">${esc(out.msg)}</p>
         <div class="gm-warps">${onsen.map((s) => `<button class="gm-warp" data-gm-close="${esc(s.id)}">♨ ${esc(s.name)}駅</button>`).join('')}</div>
         <button class="link-btn" data-gm-close="stay">いまの駅にとどまる</button>`,
        { cls: 'gm-small' }
      );
      if (v && v !== 'stay' && v !== true && D.byId[v]) return { warp: v };
      return null;
    }
    if (out.amount) YT.Store.addLedger(ev.kind === 'good' ? 'surprise' : 'happening', out.msg.slice(0, 40), out.amount);
    const t = out.ticket ? YT.Store.addTicket(out.ticket, G().deckMax) : null;
    await overlay(
      `<p class="gm-kicker">${esc(out.title)}</p>
       <p class="gm-msg">${esc(out.msg)}</p>
       ${out.amount ? `<p class="gm-amount ${out.amount < 0 ? 'is-minus' : ''}" data-amount>${out.amount < 0 ? `−${api.yen(-out.amount)}` : '+0万円'}</p>` : ''}
       ${t ? `<div class="gm-ticket">${ticketCard(t.kind)}<p>『${esc(ticketDef(t.kind).name)}』を手に入れた！</p></div>` : ''}
       <button class="primary-btn" data-gm-close>旅をつづける</button>`,
      {
        cls: ev.kind === 'good' ? 'gm-gold' : 'gm-oops',
        onOpen: (box) => {
          if (out.amount > 0) {
            goldRain(box.parentNode, 40);
            setTimeout(() => countUp($('[data-amount]', box), out.amount, { ms: 900 }), 300);
          }
          api.renderAll();
        },
      }
    );
    renderDeck();
    return null;
  }

  // ---------- 王座奪還 ----------
  async function throneSteal(id, prev) {
    const s = D.byId[id];
    const av = prev && prev.avatarConfig ? YT.Craft.avatarSvg(prev.avatarConfig, { crop: true, id: 'ts-prev' }) : '';
    const crown = '<svg viewBox="0 0 120 80" class="ts-crown-svg"><path d="M8,70 L8,22 L34,46 L60,6 L86,46 L112,22 L112,70 Z" fill="#d49a35" stroke="#7a5a1e" stroke-width="4" stroke-linejoin="round"/><circle cx="60" cy="40" r="7" fill="#c2352b"/></svg>';
    await overlay(
      `<p class="gm-kicker">⚡ 王座奪還</p>
       <div class="ts-stage" aria-hidden="true">
         <div class="ts-prev"><span class="ts-av">${av}</span><span class="ts-name">${esc(prev ? `${prev.icon} ${prev.userName}` : '前のオーナー')}</span></div>
         <div class="ts-crown"><span class="ts-half ts-l">${crown}</span><span class="ts-half ts-r">${crown}</span></div>
         <svg viewBox="0 0 60 140" class="ts-bolt"><path d="M38,0 L10,74 L30,74 L18,140 L54,52 L32,52 L48,0 Z"/></svg>
       </div>
       <h2 class="gm-title">${esc(s.name)}駅の王座を奪還！</h2>
       <p class="gm-msg">下克上で、${esc(prev ? prev.userName : '前のオーナー')}さんの王冠がパリン！ 新しいトップオーナーは、あなたです。</p>
       <button class="primary-btn" data-gm-close>王冠を駅に打ちこむ</button>`,
      {
        cls: 'gm-steal',
        onOpen: (box) => {
          setTimeout(() => {
            box.classList.add('is-break');
            YT.Sound.shatter();
          }, reduce() ? 0 : 700);
        },
      }
    );
    // 自分の王冠とアバターが、地図の駅にドスン！
    YT.Map.dropCrown(id, YT.Craft.avatarSvg(undefined, { crop: true, id: 'ts-me' }));
    setTimeout(() => YT.Sound.thud(), reduce() ? 0 : 700);
    await wait(1300);
  }

  // ---------- 止まった駅のあとの流れ ----------
  // ピタ止め → 切符 → サプライズ（ワープ）→ 精算 → ライン制覇の順。返り値：手帖をひらく駅
  async function afterArrival(id) {
    let at = id;
    if (spot() && spot().id === id) await jackpot(id);
    else if (Math.random() < G().arrivalTicketChance) grant(drawKind(false), `${D.byId[id].name}駅の窓口で、`);
    const r = await maybeSurprise(id);
    if (r && r.warp) {
      at = r.warp;
      await api.warpTo(at);
      if (spot() && spot().id === at) await jackpot(at);
    }
    if (settleDue()) await settle();
    await celebrateLines();
    ensureSpotlight();
    render();
    return at;
  }

  function render() {
    renderBar();
    renderDeck();
    renderShop();
    paintLines();
  }

  YT.Game = {
    init(data, a) {
      D = data;
      api = a;
      ensureSpotlight();
      document.addEventListener('click', (e) => {
        if (e.target.closest('#ticket-deck')) onDeckClick(e);
        if (e.target.closest('#ticket-shop')) onShopClick(e);
      });
      document.addEventListener('keydown', (e) => {
        if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('#ticket-deck [data-deck]')) {
          e.preventDefault();
          onDeckClick(e);
        }
      });
    },
    render,
    ensureSpotlight,
    nextRoll,
    pickNumber,
    afterArrival,
    throneSteal,
    celebrateLines,
    grant,
    drawKind,
    settle,
    settleDue,
    runEvent: (id, here) => runEvent(EVENTS.find((e) => e.id === id), D.byId[here]),
    isOpen: () => !!closing,
    // Esc：演出を閉じる（ルーレットや精算の途中は、閉じるボタンが出てから）
    close() {
      const layer = $('#game-layer');
      if (!closing || layer.hidden) return false;
      // 出目やワープ先を選ぶ画面では「やめる」を押したことにする（Esc で勝手に選ばないように）
      const b = layer.querySelector('[data-gm-close="cancel"], [data-gm-close="stay"]') || layer.querySelector('[data-gm-close]:not([hidden])');
      if (b) b.click();
      return true;
    },
  };
})();
