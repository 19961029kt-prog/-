// オーナー権への立候補：お買い物・宿の予約のスクショ（旅のレシート）で、その駅の購入実績を記録する。
//   1) 寄り道手帖のショップ・宿のボタンを押す → 「視察・手配中」（押した時刻・駅・ショップを保存）
//   2) 別タブから戻ってきたとき、15秒未満なら「まだ寄り道の途中」の案内。15秒以上なら立候補シートをひらく
//   3) 立候補シート：注文完了・予約完了のスクショを置く → 「AIスマート読取」で文字を読み、厳格3点チェック
//      ①押したショップのレシートで、その駅の名産品・宿に関係する注文か ②駅に止まった日（到着日）と注文日が同じか
//      ③購入金額（違っていたら直せる）。①②を満たすと「実績を確定して刻印する」で査収済のハンコが押され、実績に加わる
//   4) 累計購入金額のランキングを計算し直し、1位になったら王座交代の演出（順位の計算は js/ownership.js）
// ボタンを押しただけ・すぐ戻っただけでは何も起きない。同じスクショは二度使えない。
(function () {
  'use strict';
  const YT = (window.YT = window.YT || {});
  const { Store, Sound, Receipts, Ownership } = YT;

  let D = null;
  let api = null; // app.js から：{ esc, yen, yenBig, toast, renderAll, refreshModal, afterCandidacy, fmtDate, confetti }
  let early = false; // 15秒未満で戻ってきたことがある（待機パネルに案内を出す）
  let returnTimer = null;

  const minAway = () => (D.meta.owner.minAwaySeconds || 15) * 1000;
  const pending = () => Store.getPendingOwner();
  const elapsed = () => (pending() ? Date.now() - pending().clickedAt : 0);
  const ready = () => elapsed() >= minAway();
  const viaLabel = (p) => (p.via === 'stay' ? `${p.provider}で予約手配` : `${p.provider}で手配`);
  const I = (name, opts) => YT.Icon.svg(name, opts); // 線画のアイコン（絵文字は使わない）
  const viaIcon = (p) => I(p.via === 'stay' ? 'onsen' : 'gift');
  const yenJP = (v) => `¥${Number(v).toLocaleString('ja-JP')}`;
  const isSheetOpen = () => !document.getElementById('owner-sheet').hidden;
  // 立候補できるのは、この駅の手帖のボタンからショップ・宿をひらいたことがあるとき
  const canApply = (id) => {
    const a = Store.getActions(id);
    return !!(a.product || a.stay || (pending() && pending().stationId === id));
  };

  // 別タブ（ショップ・宿）から戻ってきた：visibilitychange と focus の両方が来るので、少しまとめてから判定する
  function onReturn() {
    if (document.visibilityState !== 'visible') return;
    clearTimeout(returnTimer);
    returnTimer = setTimeout(() => {
      const p = pending();
      if (!p || isSheetOpen()) return;
      if (!ready()) {
        early = true;
        Sound.gentle();
        api.toast('まだ寄り道の途中（ショップ視察中）のようです。注文や予約が済んだら、スクショでオーナー権に立候補しましょう', 'toast-green');
        api.refreshModal(p.stationId);
        return;
      }
      autoOpen(p);
    }, 250);
  }
  // 立候補届を自動でひらくのは、手配1回につき1度だけ（閉じたあとは、ページをひらくたびに出さない）。
  // そのあとは、寄り道手帖の待機パネルや「手配中」の札から、自分でひらける
  function autoOpen(p) {
    if (p.prompted) return;
    Store.setPendingOwner({ ...p, prompted: true });
    Owner.openSheet(p.stationId);
  }

  const elapsedText = () => {
    const s = Math.floor(elapsed() / 1000);
    return s < 60 ? `${s}秒` : `${Math.floor(s / 60)}分${s % 60}秒`;
  };
  function tick() {
    if (!pending()) return;
    document.querySelectorAll('[data-owner-elapsed]').forEach((e) => (e.textContent = elapsedText()));
  }

  // 風景印：駅名・日付・山と波の絵を二重の輪で囲んだ、丸い記念の印（朱の印肉＋金の箔押しの輪）。オーナー証の切手の消印に使う
  function sealSvg(s, date) {
    const fid = `seal-ink-${s.id}-${Math.random().toString(36).slice(2, 7)}`;
    // 消印は少し傾けて、朱肉のかすれ（receipts.js と同じフィルタ）をかける
    return `<svg viewBox="-60 -60 120 120" class="seal-svg" aria-hidden="true">
      <defs><path id="seal-arc-${s.id}" d="M-41,0 A41,41 0 0 1 41,0"/>${Receipts.inkFilter(fid, 5)}</defs>
      <g filter="url(#${fid})" transform="rotate(-6)">
        <circle r="56" class="seal-foil"/>
        <circle r="51" class="seal-ink-ring"/><circle r="45" class="seal-ink-ring seal-ink-thin"/>
        <text class="seal-arc"><textPath href="#seal-arc-${s.id}" startOffset="50%" text-anchor="middle">九州よりみち トップオーナー</textPath></text>
        <path d="M-30,14 L-16,-2 L-8,6 L4,-10 L20,10 L30,14" class="seal-art"/>
        <path d="M-32,22 Q-24,18 -16,22 T0,22 T16,22 T32,22" class="seal-art"/>
        <text y="2" text-anchor="middle" class="seal-name">${api.esc(s.name)}</text>
        <text y="38" text-anchor="middle" class="seal-date">${api.esc(date)}</text>
      </g>
    </svg>`;
  }

  // ---------- 厳格3点チェック ----------
  function checkRow(key, num, title, detail) {
    return `<li class="check is-wait" data-check="${key}"><span class="check-icon" aria-hidden="true">${I('hourglass')}</span>
        <span class="check-body"><b>【チェック${num}：${title}】</b><span class="check-detail">${detail || '審査を待っています'}</span></span></li>`;
  }
  function setCheck(key, state, detail) {
    const li = $(`[data-check="${key}"]`);
    if (!li) return;
    li.className = `check is-${state}`;
    li.querySelector('.check-icon').innerHTML = I({ ok: 'check', ng: 'close', warn: 'warning', wait: 'hourglass' }[state]);
    li.querySelector('.check-detail').innerHTML = detail;
  }
  // スクショの文字から3点を確かめる。ショップは「この駅の手帖から開いたショップ」、日付は「この駅に停車した日」と比べる
  function judge(id, text, parsed, file) {
    const s = D.byId[id];
    const esc = api.esc;
    const shops = D.meta.owner.shops;
    const clicked = new Set(Object.keys(Store.getActions(id).shops || {}));
    if (pending() && pending().stationId === id) clicked.add(pending().providerId);
    const label = (sid) => (shops.find((x) => x.id === sid) || {}).label || sid;
    // ①ショップと関連商品
    const word = text ? Receipts.matchItem(text, s) : null;
    let shop;
    if (!parsed.shop) shop = { ok: false, detail: 'ショップ名が読み取れませんでした。ショップ名が写るように撮ったスクショを置いてください' };
    else if (!clicked.has(parsed.shop)) shop = { ok: false, detail: `読み取ったショップは「${esc(label(parsed.shop))}」です。この駅の手帖から開いたショップ（${[...clicked].map((x) => esc(label(x))).join('・') || 'なし'}）のスクショを置いてください` };
    else if (!word) shop = { ok: false, detail: `${esc(label(parsed.shop))}のスクショですが、${esc(s.name)}駅の名産品・宿に関係する言葉（例：${esc(Receipts.stationWords(s).slice(0, 3).join('・'))}）が見つかりませんでした` };
    else shop = { ok: true, detail: `対象ショップ（${esc(label(parsed.shop))}）・${esc(s.name)}駅の関連商品（「${esc(word)}」）の購入を確認` };
    // ②到着日と注文日
    const arrival = Store.arrivalDate(id);
    const ymd = (v) => v.replace(/-/g, '/');
    const found = text ? Receipts.findDates(text, Number((arrival || Store.localDate()).slice(0, 4))) : { near: [], full: [] };
    const dates = found.near.length ? found.near : found.full;
    const shot = file && file.lastModified ? Store.localDate(file.lastModified) : null;
    let date;
    if (!arrival) date = { ok: false, detail: 'この駅に停車した日の記録がありません。ダイスでこの駅に止まってから立候補してください' };
    else if (dates.includes(arrival)) date = { ok: true, orderDate: arrival, detail: `駅到着日（${ymd(arrival)}）当日の注文であることを確認` };
    else if (dates.length) date = { ok: false, orderDate: dates[0], detail: `スクショの注文日（${ymd(dates[0])}）が、この駅に停車した日（${ymd(arrival)}）と違います。停車した日のお買い物・予約だけが記録できます` };
    else if (shot === arrival) date = { ok: true, orderDate: arrival, viaShot: true, detail: `注文日の表示は見つかりませんでしたが、スクショの撮影日（${ymd(shot)}）が駅到着日と同じことを確認` };
    else date = { ok: false, detail: `注文日・予約日が読み取れませんでした。注文日が写るスクショか、この駅に停車した日（${ymd(arrival)}）に撮ったスクショを置いてください` };
    // ③金額
    const amount = parsed.amount
      ? { ok: true, detail: `購入金額 <b>${yenJP(parsed.amount)}</b> を自動で読み取りました（違っていたら下の欄で直せます）` }
      : { ok: false, detail: '金額が見つかりませんでした。スクショの合計金額を下の欄に入れてください' };
    return { shop, date, amount };
  }

  // ---------- 立候補シート ----------
  let sheet = null; // 開いているシートの状態 { id, file, hash, url, thumb, reading, done }

  function sheetHtml(id) {
    const s = D.byId[id];
    const esc = api.esc;
    const color = (D.meta.prefectures[s.prefecture] || {}).color;
    const p = pending() && pending().stationId === id ? pending() : null;
    const me = Ownership.you(id);
    const top = Ownership.owner(id);
    const upset = (me ? me.rank : null) !== 1;
    const arrival = Store.arrivalDate(id);
    return `
      <article class="deed deed-apply" role="dialog" aria-modal="true" aria-labelledby="deed-title" style="--pref:${color}">
        <div class="deed-inner">
          <p class="deed-kicker">九州よりみち　オーナー権 立候補届</p>
          <h2 id="deed-title" class="deed-title">購入実績を記録する</h2>
          <div class="deed-station">
            <span class="chip chip-pref">${esc(s.prefecture)}</span>
            <p class="deed-name">${esc(s.name)}<small>駅</small></p>
            <p class="deed-value">いまのトップオーナー <b>${esc(top.userName)}</b>（累計 ${yenJP(top.totalAmount)}）${me ? `／あなた ${me.rank}位（${yenJP(me.totalAmount)}）` : ''}</p>
            ${upset ? `<p class="deed-bonus">${I('swords')} 下克上ボーナス：いまの1位ではないので、申告額を <b>×${D.meta.owner.upsetBonus}</b> で数えます</p>` : ''}
            <p class="deed-arrival">${I('calendar')} この駅に停車した日：<b>${arrival ? esc(arrival.replace(/-/g, '/')) : '記録なし'}</b>${p ? `　手配先：<b>${esc(p.provider)}</b>` : ''}</p>
          </div>
          <label class="drop" data-drop>
            <input type="file" accept="image/*" data-file hidden>
            <span class="drop-empty">
              <span class="drop-icon" aria-hidden="true">${I('receipt')}</span>
              <b>注文完了・予約完了の画面のスクショを、ここに置いてください</b>
              <small>ドラッグ＆ドロップ、またはタップして画像を選ぶ</small>
              <span class="drop-ai">${I('search')} AIスマート読取：金額とショップを自動で読み取ります（端末の中だけで処理）</span>
            </span>
            <span class="drop-preview" hidden>
              <img alt="置いたスクショ" data-preview>
              <span class="scan" aria-hidden="true"><i></i></span>
              <span class="drop-stamp" aria-hidden="true" data-stamp-art></span>
            </span>
          </label>
          <p class="scan-status" data-status aria-live="polite"></p>
          <ol class="checks" data-checks hidden aria-label="厳格3点チェック">
            ${checkRow('shop', '①', '対象ショップ・関連商品', '')}
            ${checkRow('date', '②', '駅到着日と注文日', '')}
            ${checkRow('amount', '③', '購入金額', '')}
          </ol>
          <div class="apply-form" data-form hidden>
            <div class="apply-row">
              <label>金額 <span class="amount-field">¥<input type="text" inputmode="numeric" autocomplete="off" data-amount aria-label="購入金額（円）"></span></label>
              <p class="apply-shop">ショップ <b data-shop-label>—</b><small>（スクショから読み取り）</small></p>
            </div>
            <p class="apply-preview" data-preview-line></p>
            <p class="apply-verdict" data-verdict></p>
          </div>
          <button class="stamp-btn" data-confirm disabled>実績を確定して刻印する</button>
          <button class="link-btn deed-later" data-deed-later>あとで立候補する</button>
          <p class="deed-note">※ 審査は、この手帖のボタンから開いたショップのスクショであること・その駅に停車した日の注文であること・金額を、端末の中の文字の読み取りで確かめます（スクショはどこにも送信されません）。同じスクショは二度使えません。文字の読み取りでは実際の購入までは確かめられないので、ご自分の購入だけを記録してください。ランキングと配当はゲームの中だけのもので、お金の価値はありません。</p>
        </div>
      </article>`;
  }

  const $ = (sel) => document.querySelector(`#owner-sheet ${sel}`);
  function amountValue() {
    const v = Number(String($('[data-amount]').value).replace(/[^\d]/g, ''));
    return v > 0 && v <= D.meta.owner.maxAmount ? v : 0;
  }
  // 金額を変えるたびに、ランキングでどうなるかを見せる。①②を満たし、金額が入っていれば確定できる
  function updatePreview() {
    const v = amountValue();
    const line = $('[data-preview-line]');
    const c = sheet.checks;
    const pass = !!(c && c.shop.ok && c.date.ok);
    $('[data-confirm]').disabled = !(sheet.file && sheet.done && v && pass);
    if (c) {
      setCheck('amount', v ? 'ok' : 'warn', v ? (c.amount.ok && v === sheet.parsed.amount ? c.amount.detail : `購入金額 <b>${yenJP(v)}</b>（手で直した金額）`) : c.amount.detail);
      $('[data-verdict]').innerHTML = pass && v ? `${I('seal')} <b>審査基準クリア</b>：「実績を確定して刻印する」で査収済のハンコを押します` : pass ? '金額を入れると確定できます' : `${I('warning')} 審査基準を満たしていません。条件に合うスクショを置き直してください（画像をタップで選び直せます）`;
      $('[data-verdict]').className = `apply-verdict ${pass && v ? 'is-ok' : 'is-ng'}`;
    }
    if (!v) {
      line.textContent = '金額を確かめてください（1円〜100万円）';
      return;
    }
    const pv = Ownership.preview(sheet.id, v);
    line.innerHTML = `ランキングに入る額 <b>${yenJP(pv.scored)}</b>${pv.upset ? `（${yenJP(v)} × 下克上 ${D.meta.owner.upsetBonus}）` : ''} → 累計 ${yenJP(pv.total)}、<b>${pv.rankAfter}位</b>${
      pv.rankAfter === 1 ? `　${I('crown')} トップオーナーになります！` : `（1位まであと ${yenJP(pv.toTop)}＝お買い物 ${yenJP(pv.needToTop)} ぶん）`
    }${pv.rankAfter <= D.meta.owner.shareholders && pv.rankAfter > 1 ? '　共同株主として配当を受け取れます' : ''}`;
  }

  async function onFile(file) {
    const status = $('[data-status]');
    if (!file || !/^image\//.test(file.type)) {
      status.textContent = '画像（スクショ）を選んでください';
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      status.textContent = '画像が大きすぎます（20MBまで）';
      return;
    }
    const hash = await Receipts.fingerprint(file);
    if (Store.hasReceiptHash(hash)) {
      Sound.gentle();
      status.textContent = 'このスクショは、もう記録されています。別のお買い物・予約のスクショを置いてください';
      return;
    }
    let loaded;
    try {
      loaded = await Receipts.loadImage(file);
    } catch (e) {
      status.textContent = '画像を読み込めませんでした';
      return;
    }
    Object.assign(sheet, { file, hash, url: loaded.url, img: loaded.img, done: false, checks: null, parsed: null, text: '' });
    $('[data-preview]').src = loaded.url;
    $('.drop-empty').hidden = true;
    $('.drop-preview').hidden = false;
    $('[data-drop]').classList.add('is-scanning');
    $('[data-form]').hidden = true;
    $('[data-checks]').hidden = false;
    ['shop', 'date', 'amount'].forEach((k) => setCheck(k, 'wait', '審査中…'));
    $('[data-confirm]').disabled = true;
    status.innerHTML = '<b class="scan-label">AIスマート読取</b>' + I('search') + ' 旅のレシート・スクショを厳格審査中…';
    Sound.click();
    // 心地よく待てるよう、読み取りが速く終わっても約1.5秒は審査の演出を見せる
    const minWait = new Promise((r) => setTimeout(r, (D.meta.owner.scanSeconds || 1.5) * 1000));
    let parsed = { amount: null, shop: null, candidates: [] };
    let text = '';
    let failed = false;
    try {
      text = await Receipts.recognize(file, (m) => {
        if (!isSheetOpen() || !sheet) return;
        const pct = Math.round((m.progress || 0) * 100);
        if (/loading|initializ/.test(m.status)) status.innerHTML = `<b class="scan-label">AIスマート読取</b>${I('search')} 厳格審査の準備中…（初回だけ、文字認識を読み込みます ${pct}%）`;
        else if (/recogniz/.test(m.status)) status.innerHTML = `<b class="scan-label">AIスマート読取</b>${I('search')} 旅のレシート・スクショを厳格審査中… ${pct}%`;
      });
      parsed = Receipts.parse(text, D.meta.owner.shops, D.meta.owner.maxAmount);
    } catch (e) {
      failed = true;
    }
    await minWait;
    if (!sheet || sheet.file !== file) return; // 途中で別の画像に替えた・閉じた
    const checks = judge(sheet.id, text, parsed, file);
    Object.assign(sheet, { parsed, checks, text });
    // 判定バッジを ①→②→③ の順に出す
    const order = ['shop', 'date', 'amount'];
    for (const k of order) {
      await new Promise((r) => setTimeout(r, 320));
      if (!sheet || sheet.file !== file) return;
      const c = checks[k];
      setCheck(k, c.ok ? 'ok' : k === 'amount' ? 'warn' : 'ng', c.detail);
      if (c.ok) Sound.click();
    }
    sheet.done = true;
    $('[data-drop]').classList.remove('is-scanning');
    $('[data-form]').hidden = false;
    // スマホでは確認フォームが画面の下に隠れやすいので、読み取りが終わったら見える位置まで送る
    $('[data-form]').scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    if (parsed.amount) $('[data-amount]').value = parsed.amount.toLocaleString('ja-JP');
    $('[data-shop-label]').textContent = parsed.shop ? D.meta.owner.shops.find((x) => x.id === parsed.shop).label : '読み取れませんでした';
    const pass = checks.shop.ok && checks.date.ok;
    status.innerHTML = failed
      ? '自動で読み取れませんでした（通信や画像の状態によります）。もう一度お試しください'
      : pass
        ? `${I('check')} 審査が終わりました。金額を確かめてください`
        : '審査が終わりました。満たしていない項目があります';
    if (pass) Sound.diceSettle();
    else Sound.gentle();
    updatePreview();
    if (pass && !parsed.amount) $('[data-amount]').focus();
  }

  // 「オーナー権を確定する」：査収のハンコを押してから記録する
  async function confirm() {
    const v = amountValue();
    if (!sheet || !sheet.file || !sheet.done || !v) return;
    const id = sheet.id;
    const c = sheet.checks;
    if (!c || !c.shop.ok || !c.date.ok) return;
    const shopId = sheet.parsed.shop;
    const shop = D.meta.owner.shops.find((x) => x.id === shopId);
    const arrival = Store.arrivalDate(id);
    $('[data-stamp-art]').innerHTML = Receipts.receiptStampSvg(arrival.replace(/-/g, '.'), D.byId[id].name);
    const p = pending() && pending().stationId === id ? pending() : null;
    const btn = $('[data-confirm]');
    btn.disabled = true;
    $('[data-drop]').classList.add('is-stamping');
    setTimeout(() => {
      Sound.stamp();
      $('.deed').classList.add('is-stamped');
    }, 380);
    const imageId = `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const thumb = await Receipts.thumbnail(sheet.img);
    if (thumb) await Receipts.put(imageId, thumb);
    const via = ['rakuten_travel', 'jalan'].includes(shopId) ? 'stay' : p ? p.via : 'product';
    const s = D.byId[id];
    const item = p ? p.item : via === 'stay' ? s.stay.name : s.products[0].name;
    setTimeout(() => {
      const result = Ownership.register(id, {
        id: imageId, at: new Date().toISOString(), amount: v, shop: shop.label, shopId, via, item, imageId: thumb ? imageId : null, hash: sheet.hash,
        arrival, orderDate: c.date.orderDate, verified: { word: (Receipts.matchItem(sheet.text || '', D.byId[id]) || ''), byShotDate: !!c.date.viaShot },
      });
      early = false;
      Owner.closeSheet();
      api.renderAll();
      api.refreshModal(id);
      api.afterCandidacy(id, result, v);
    }, 1400);
  }

  const Owner = {
    init(data, uiApi) {
      D = data;
      api = uiApi;
      document.addEventListener('visibilitychange', onReturn);
      window.addEventListener('focus', onReturn);
      setInterval(tick, 1000);
      // 起動時：手配中のまま戻ってきた（スマホでタブが再読み込みされた）ら、そのまま続きから
      const p = pending();
      if (p && ready()) setTimeout(() => autoOpen(p), 600);
    },
    sealSvg,
    pending,
    canApply,
    isPendingFor: (id) => !!(pending() && pending().stationId === id),

    // ショップ・宿のボタンを押した（リンクは新しいタブで開く。preventDefault しない）
    start(id, btn) {
      Store.recordAction(id, btn.dataset.via, btn.dataset.provider);
      early = false;
      Store.setPendingOwner({
        stationId: id,
        via: btn.dataset.via,
        providerId: btn.dataset.provider,
        provider: btn.dataset.label,
        item: btn.dataset.item,
        clickedAt: Date.now(),
      });
      setTimeout(() => {
        api.renderAll();
        api.refreshModal(id);
      }, 0);
    },

    // 寄り道手帖の中の待機パネル（ショップ・宿をひらいたあと）
    panelHtml(id) {
      const p = pending();
      if (!p || p.stationId !== id) return '';
      const esc = api.esc;
      return `<section class="pending-panel" aria-live="polite">
          <div class="pending-compass" aria-hidden="true"><span>${I('compass')}</span></div>
          <div class="pending-body">
            <p class="pending-title">現在ショップ・宿を視察手配中です…</p>
            <p class="pending-sub"><span class="via-badge">${viaIcon(p)} ${esc(viaLabel(p))}</span>「${esc(p.item)}」 <span class="pending-time">視察 <b data-owner-elapsed>${elapsedText()}</b></span></p>
            <p class="pending-msg">${
              early
                ? 'まだ寄り道の途中（ショップ視察中）のようです。じっくり選んで、注文や予約が済んだら、完了画面のスクショでオーナー権に立候補しましょう！'
                : '注文や予約が済んだら、完了画面のスクショを撮って、この画面に戻ってきてください。オーナー権の立候補届がひらきます。'
            }</p>
            <div class="pending-actions">
              <button class="primary-btn" data-candidacy="${esc(id)}">${I('receipt')} オーナー権に立候補する（レシート証明を提出）</button>
              <button class="link-btn" data-owner-cancel>手配をとりやめる</button>
            </div>
          </div>
        </section>`;
    },

    // 寄り道手帖のクリック（立候補・とりやめ）。処理したら true
    onClick(e) {
      const c = e.target.closest('[data-candidacy]');
      if (c) {
        Owner.openSheet(c.dataset.candidacy);
        return true;
      }
      if (e.target.closest('[data-owner-cancel]')) {
        const p = pending();
        Store.clearPendingOwner();
        early = false;
        api.toast('手配をとりやめました。また気になったら、ショップや宿のボタンからどうぞ');
        api.renderAll();
        if (p) api.refreshModal(p.stationId);
        return true;
      }
      return false;
    },

    openSheet(id) {
      if (!id || !D.byId[id]) return;
      if (!canApply(id)) {
        api.toast('まずこの寄り道手帖のショップ・宿のボタンからお買い物・予約をして、完了画面のスクショで立候補してください');
        return;
      }
      const root = document.getElementById('owner-sheet');
      sheet = { id, file: null, done: false };
      root.innerHTML = sheetHtml(id);
      root.hidden = false;
      requestAnimationFrame(() => root.classList.add('is-open'));
      Sound.gentle();
      const drop = $('[data-drop]');
      const input = $('[data-file]');
      input.addEventListener('change', () => input.files[0] && onFile(input.files[0]));
      ['dragenter', 'dragover'].forEach((t) =>
        drop.addEventListener(t, (e) => {
          e.preventDefault();
          drop.classList.add('is-over');
        })
      );
      ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, () => drop.classList.remove('is-over')));
      drop.addEventListener('drop', (e) => {
        e.preventDefault();
        const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (f) onFile(f);
      });
      $('[data-amount]').addEventListener('input', updatePreview);
      root.onclick = (e) => {
        if (e.target.closest('[data-deed-later]') || e.target === root) return Owner.closeSheet();
        if (e.target.closest('[data-confirm]')) confirm();
      };
      setTimeout(() => drop.focus({ preventScroll: true }), 80);
    },

    closeSheet() {
      const root = document.getElementById('owner-sheet');
      if (root.hidden) return;
      if (sheet && sheet.url) URL.revokeObjectURL(sheet.url);
      sheet = null;
      root.classList.remove('is-open');
      setTimeout(() => {
        root.hidden = true;
        root.innerHTML = '';
      }, 250);
    },
  };

  YT.Owner = Owner;
})();
