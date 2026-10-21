// オーナー権への立候補：お買い物・宿の予約のスクショ（旅のレシート）で、その駅の購入実績を記録する。
//   1) 寄り道手帖のショップ・宿のボタンを押す → 「視察・手配中」（押した時刻・駅・ショップを保存）
//   2) 別タブから戻ってきたとき、15秒未満なら「まだ寄り道の途中」の案内。15秒以上なら立候補シートをひらく
//   3) 立候補シート：注文完了・予約完了のスクショを置く → 「AIスマート読取」で金額とショップを読み取り、確認フォームに入れる
//      （読み取りは端末の中の文字認識。違っていたら直せる）→ 「オーナー権を確定する」で査収のハンコが押され、実績に加わる
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
  const viaIcon = (p) => (p.via === 'stay' ? '♨' : '🎁');
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
        api.toast('🧭 まだ寄り道の途中（ショップ視察中）のようです。注文や予約が済んだら、スクショでオーナー権に立候補しましょう', 'toast-green');
        api.refreshModal(p.stationId);
        return;
      }
      Owner.openSheet(p.stationId);
    }, 250);
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
    return `<svg viewBox="-60 -60 120 120" class="seal-svg" aria-hidden="true">
      <defs><path id="seal-arc-${s.id}" d="M-41,0 A41,41 0 0 1 41,0"/></defs>
      <circle r="56" class="seal-foil"/>
      <circle r="51" class="seal-ink-ring"/><circle r="45" class="seal-ink-ring seal-ink-thin"/>
      <text class="seal-arc"><textPath href="#seal-arc-${s.id}" startOffset="50%" text-anchor="middle">九州よりみち トップオーナー</textPath></text>
      <path d="M-30,14 L-16,-2 L-8,6 L4,-10 L20,10 L30,14" class="seal-art"/>
      <path d="M-32,22 Q-24,18 -16,22 T0,22 T16,22 T32,22" class="seal-art"/>
      <text y="2" text-anchor="middle" class="seal-name">${api.esc(s.name)}</text>
      <text y="38" text-anchor="middle" class="seal-date">${api.esc(date)}</text>
    </svg>`;
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
    const shops = D.meta.owner.shops;
    const defShop = p ? shops.find((x) => x.label === p.provider) || shops.find((x) => x.id === p.providerId) : null;
    return `
      <article class="deed deed-apply" role="dialog" aria-modal="true" aria-labelledby="deed-title" style="--pref:${color}">
        <div class="deed-inner">
          <p class="deed-kicker">九州よりみち　オーナー権 立候補届</p>
          <h2 id="deed-title" class="deed-title">購入実績を記録する</h2>
          <div class="deed-station">
            <span class="chip chip-pref">${esc(s.prefecture)}</span>
            <p class="deed-name">${esc(s.name)}<small>駅</small></p>
            <p class="deed-value">いまのトップオーナー <b>${esc(top.icon)} ${esc(top.userName)}</b>（累計 ${yenJP(top.totalAmount)}）${me ? `／あなた ${me.rank}位（${yenJP(me.totalAmount)}）` : ''}</p>
            ${upset ? `<p class="deed-bonus">⚔ 下克上ボーナス：いまの1位ではないので、申告額を <b>×${D.meta.owner.upsetBonus}</b> で数えます</p>` : ''}
          </div>
          <label class="drop" data-drop>
            <input type="file" accept="image/*" data-file hidden>
            <span class="drop-empty">
              <span class="drop-icon" aria-hidden="true">🧾</span>
              <b>注文完了・予約完了の画面のスクショを、ここに置いてください</b>
              <small>ドラッグ＆ドロップ、またはタップして画像を選ぶ</small>
              <span class="drop-ai">✨ AIスマート読取：金額とショップを自動で読み取ります（端末の中だけで処理）</span>
            </span>
            <span class="drop-preview" hidden>
              <img alt="置いたスクショ" data-preview>
              <span class="scan" aria-hidden="true"><i></i></span>
              <span class="drop-stamp" aria-hidden="true">${Receipts.receiptStampSvg(api.fmtDate(new Date().toISOString()))}</span>
            </span>
          </label>
          <p class="scan-status" data-status aria-live="polite"></p>
          <div class="apply-form" data-form hidden>
            <div class="apply-row">
              <label>金額 <span class="amount-field">¥<input type="text" inputmode="numeric" autocomplete="off" data-amount aria-label="購入金額（円）"></span></label>
              <label>ショップ <select data-shop>${shops.map((x) => `<option value="${esc(x.id)}" ${defShop && defShop.id === x.id ? 'selected' : ''}>${esc(x.label)}</option>`).join('')}</select></label>
            </div>
            <p class="apply-candidates" data-cands></p>
            <p class="apply-preview" data-preview-line></p>
          </div>
          <button class="stamp-btn" data-confirm disabled>オーナー権を確定する</button>
          <button class="link-btn deed-later" data-deed-later>あとで立候補する</button>
          <p class="deed-note">※ スクショはこの端末の中にだけ保存され、どこにも送信されません（文字の読み取りも端末の中で行います）。同じスクショは二度使えません。実際の購入の内容は確かめていないので、ご自分の購入だけを記録してください。ランキングと配当はゲームの中だけのもので、お金の価値はありません。</p>
        </div>
      </article>`;
  }

  const $ = (sel) => document.querySelector(`#owner-sheet ${sel}`);
  function amountValue() {
    const v = Number(String($('[data-amount]').value).replace(/[^\d]/g, ''));
    return v > 0 && v <= D.meta.owner.maxAmount ? v : 0;
  }
  // 金額を変えるたびに、ランキングでどうなるかを見せる
  function updatePreview() {
    const v = amountValue();
    const line = $('[data-preview-line]');
    $('[data-confirm]').disabled = !(sheet.file && sheet.done && v);
    if (!v) {
      line.textContent = '金額を確かめてください（1円〜100万円）';
      return;
    }
    const pv = Ownership.preview(sheet.id, v);
    line.innerHTML = `ランキングに入る額 <b>${yenJP(pv.scored)}</b>${pv.upset ? `（${yenJP(v)} × 下克上 ${D.meta.owner.upsetBonus}）` : ''} → 累計 ${yenJP(pv.total)}、<b>${pv.rankAfter}位</b>${
      pv.rankAfter === 1 ? '　👑 トップオーナーになります！' : `（1位まであと ${yenJP(pv.toTop)}＝お買い物 ${yenJP(pv.needToTop)} ぶん）`
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
      status.textContent = '⚠ このスクショは、もう記録されています。別のお買い物・予約のスクショを置いてください';
      return;
    }
    let loaded;
    try {
      loaded = await Receipts.loadImage(file);
    } catch (e) {
      status.textContent = '画像を読み込めませんでした';
      return;
    }
    Object.assign(sheet, { file, hash, url: loaded.url, img: loaded.img, done: false });
    $('[data-preview]').src = loaded.url;
    $('.drop-empty').hidden = true;
    $('.drop-preview').hidden = false;
    $('[data-drop]').classList.add('is-scanning');
    $('[data-form]').hidden = true;
    status.innerHTML = '<b class="scan-label">AIスマート読取</b>🔍 旅のレシート・スクショから購入実績を解析中…';
    Sound.click();
    // 心地よく待てるよう、読み取りが速く終わっても1秒は解析の演出を見せる
    const minWait = new Promise((r) => setTimeout(r, 1000));
    let parsed = { amount: null, shop: null, candidates: [] };
    let failed = false;
    try {
      const text = await Receipts.recognize(file, (m) => {
        if (!isSheetOpen() || !sheet) return;
        const pct = Math.round((m.progress || 0) * 100);
        if (/loading|initializ/.test(m.status)) status.innerHTML = `<b class="scan-label">AIスマート読取</b>🔍 解析中…（初回だけ、文字認識の準備をしています ${pct}%）`;
        else if (/recogniz/.test(m.status)) status.innerHTML = `<b class="scan-label">AIスマート読取</b>🔍 旅のレシート・スクショから購入実績を解析中… ${pct}%`;
      });
      parsed = Receipts.parse(text, D.meta.owner.shops, D.meta.owner.maxAmount);
    } catch (e) {
      failed = true;
    }
    await minWait;
    if (!sheet || sheet.file !== file) return; // 途中で別の画像に替えた・閉じた
    sheet.done = true;
    $('[data-drop]').classList.remove('is-scanning');
    $('[data-form]').hidden = false;
    // スマホでは確認フォームが画面の下に隠れやすいので、読み取りが終わったら見える位置まで送る
    $('[data-form]').scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    if (parsed.amount) $('[data-amount]').value = parsed.amount.toLocaleString('ja-JP');
    if (parsed.shop) $('[data-shop]').value = parsed.shop;
    $('[data-cands]').innerHTML =
      parsed.candidates.length > 1
        ? `ほかに見つかった金額：${parsed.candidates.map((v) => `<button type="button" class="cand" data-cand="${v}">${yenJP(v)}</button>`).join('')}`
        : '';
    status.innerHTML = failed
      ? '自動で読み取れませんでした（通信や画像の状態によります）。金額を確かめて入力してください'
      : parsed.amount
        ? `✨ 読み取りました：<b>${yenJP(parsed.amount)}</b>${parsed.shop ? `・${api.esc(D.meta.owner.shops.find((x) => x.id === parsed.shop).label)}` : ''}　違っていたら直してください`
        : '金額が見つかりませんでした。スクショの合計金額を入力してください';
    Sound.diceSettle();
    updatePreview();
    if (!parsed.amount) $('[data-amount]').focus();
  }

  // 「オーナー権を確定する」：査収のハンコを押してから記録する
  async function confirm() {
    const v = amountValue();
    if (!sheet || !sheet.file || !sheet.done || !v) return;
    const id = sheet.id;
    const shopId = $('[data-shop]').value;
    const shop = D.meta.owner.shops.find((x) => x.id === shopId);
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
      const result = Ownership.register(id, { id: imageId, at: new Date().toISOString(), amount: v, shop: shop.label, shopId, via, item, imageId: thumb ? imageId : null, hash: sheet.hash });
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
      if (p && ready()) setTimeout(() => Owner.openSheet(p.stationId), 600);
    },
    sealSvg,
    pending,
    canApply,
    isPendingFor: (id) => !!(pending() && pending().stationId === id),

    // ショップ・宿のボタンを押した（リンクは新しいタブで開く。preventDefault しない）
    start(id, btn) {
      Store.recordAction(id, btn.dataset.via);
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
          <div class="pending-compass" aria-hidden="true"><span>🧭</span></div>
          <div class="pending-body">
            <p class="pending-title">現在ショップ・宿を視察手配中です…</p>
            <p class="pending-sub"><span class="via-badge">${viaIcon(p)} ${esc(viaLabel(p))}</span>「${esc(p.item)}」 <span class="pending-time">視察 <b data-owner-elapsed>${elapsedText()}</b></span></p>
            <p class="pending-msg">${
              early
                ? 'まだ寄り道の途中（ショップ視察中）のようです。じっくり選んで、注文や予約が済んだら、完了画面のスクショでオーナー権に立候補しましょう！'
                : '注文や予約が済んだら、完了画面のスクショを撮って、この画面に戻ってきてください。オーナー権の立候補届がひらきます。'
            }</p>
            <div class="pending-actions">
              <button class="primary-btn" data-candidacy="${esc(id)}">🧾 オーナー権に立候補する（購入実績を記録）</button>
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
        const cand = e.target.closest('[data-cand]');
        if (cand) {
          $('[data-amount]').value = Number(cand.dataset.cand).toLocaleString('ja-JP');
          return updatePreview();
        }
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
