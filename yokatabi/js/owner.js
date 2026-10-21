// オーナー刻印の2段階フロー：ショップ・宿のボタンを押しただけでは刻印にしない。
//   1) ボタンを押す → 「視察・手配中」（押した時刻・駅・ショップを保存）
//   2) 別タブから戻ってきたとき、15秒未満なら「まだ寄り道の途中」の案内。15秒以上なら刻印シートをひらく
//      （待機パネルの「手配完了を報告して…」ボタンも、押してから15秒たつと使える）
//   3) 刻印シートで、手配先の確認・旅の楽しみ・宣誓チェック → 「オーナー刻印を押す」で初めて刻印（資産登録）
// 実際に購入・予約したかどうかは確かめられないので、すぐ戻っただけでは取れないこと＋本人の宣誓で、気持ちよく線を引く。
(function () {
  'use strict';
  const YT = (window.YT = window.YT || {});
  const { Store, Sound } = YT;

  let D = null;
  let api = null; // app.js から：{ esc, yen, toast, renderAll, refreshModal, celebrate, fmtDate }
  let early = false; // 15秒未満で戻ってきたことがある（待機パネルに案内を出す）
  let returnTimer = null;

  const minAway = () => (D.meta.owner.minAwaySeconds || 15) * 1000;
  const pending = () => Store.getPendingOwner();
  const elapsed = () => (pending() ? Date.now() - pending().clickedAt : 0);
  const ready = () => elapsed() >= minAway();
  const leftSec = () => Math.max(0, Math.ceil((minAway() - elapsed()) / 1000));
  const viaLabel = (p) => (p.via === 'stay' ? `${p.provider}で予約手配` : `${p.provider}で手配`);
  const viaIcon = (p) => (p.via === 'stay' ? '♨' : '🎁');

  // 別タブ（ショップ・宿）から戻ってきた：visibilitychange と focus の両方が来るので、少しまとめてから判定する
  function onReturn() {
    if (document.visibilityState !== 'visible') return;
    clearTimeout(returnTimer);
    returnTimer = setTimeout(() => {
      const p = pending();
      if (!p || Store.isAcquired(p.stationId) || isSheetOpen()) return;
      if (!ready()) {
        early = true;
        Sound.gentle();
        api.toast('🧭 まだ寄り道の途中（ショップ視察中）のようです。手配が済んだら、オーナー刻印へ進みましょう', 'toast-green');
        api.refreshModal(p.stationId);
        return;
      }
      Owner.openSheet();
    }, 250);
  }

  const reportLabel = () => (ready() ? '📮 手配完了を報告してオーナー刻印へ進む' : `📮 手配完了を報告してオーナー刻印へ進む<small>あと${leftSec()}秒</small>`);
  const elapsedText = () => {
    const s = Math.floor(elapsed() / 1000);
    return s < 60 ? `${s}秒` : `${Math.floor(s / 60)}分${s % 60}秒`;
  };
  // 待機パネルの秒読み（1秒ごとに、ボタンの「あと◯秒」と視察の時間を進める）
  function tick() {
    if (!pending()) return;
    document.querySelectorAll('[data-owner-report]').forEach((b) => {
      b.disabled = !ready();
      b.innerHTML = reportLabel();
    });
    document.querySelectorAll('[data-owner-elapsed]').forEach((e) => (e.textContent = elapsedText()));
  }

  const isSheetOpen = () => !document.getElementById('owner-sheet').hidden;

  // 風景印：駅名・日付・山と波の絵を二重の輪で囲んだ、丸い記念の印（朱の印肉＋金の箔押しの輪）
  function sealSvg(s, date) {
    return `<svg viewBox="-60 -60 120 120" class="seal-svg" aria-hidden="true">
      <defs><path id="seal-arc-${s.id}" d="M-41,0 A41,41 0 0 1 41,0"/></defs>
      <circle r="56" class="seal-foil"/>
      <circle r="51" class="seal-ink-ring"/><circle r="45" class="seal-ink-ring seal-ink-thin"/>
      <text class="seal-arc"><textPath href="#seal-arc-${s.id}" startOffset="50%" text-anchor="middle">九州よりみち オーナー刻印</textPath></text>
      <path d="M-30,14 L-16,-2 L-8,6 L4,-10 L20,10 L30,14" class="seal-art"/>
      <path d="M-32,22 Q-24,18 -16,22 T0,22 T16,22 T32,22" class="seal-art"/>
      <text y="2" text-anchor="middle" class="seal-name">${api.esc(s.name)}</text>
      <text y="38" text-anchor="middle" class="seal-date">${api.esc(date)}</text>
    </svg>`;
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
      if (p && !Store.isAcquired(p.stationId) && ready()) setTimeout(() => Owner.openSheet(), 600);
    },
    sealSvg,
    pending,
    isPendingFor: (id) => !!(pending() && pending().stationId === id),

    // ショップ・宿のボタンを押した（リンクは新しいタブで開く。preventDefault しない）
    start(id, btn) {
      Store.recordAction(id, btn.dataset.via);
      if (Store.isAcquired(id)) {
        api.toast(`${btn.dataset.label} を開きました（${D.byId[id].name}駅はオーナー刻印済み）`);
        return;
      }
      early = false;
      Store.setPendingOwner({
        stationId: id,
        via: btn.dataset.via,
        providerId: btn.dataset.provider,
        provider: btn.dataset.label,
        item: btn.dataset.item,
        clickedAt: Date.now(),
      });
      // リンクを開く処理が終わってから描き直す
      setTimeout(() => {
        api.renderAll();
        api.refreshModal(id);
      }, 0);
    },

    // 物件カード（寄り道手帖）の中の待機パネル
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
                ? 'まだ寄り道の途中（ショップ視察中）のようです。じっくり選んで注文や予約の手配が済んだら、下のボタンからオーナー刻印へ進みましょう！'
                : 'ショップ・宿のページで注文や予約の手配が済んだら、この画面に戻ってきてください。オーナー刻印シートがひらきます。'
            }</p>
            <div class="pending-actions">
              <button class="primary-btn" data-owner-report ${ready() ? '' : 'disabled'}>${reportLabel()}</button>
              <button class="link-btn" data-owner-cancel>手配をとりやめる</button>
            </div>
          </div>
        </section>`;
    },

    // 待機パネル・刻印シートのボタン（物件カードのクリック処理から呼ぶ）。処理したら true
    onClick(e) {
      if (e.target.closest('[data-owner-report]')) {
        if (ready()) Owner.openSheet();
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

    // ---------- オーナー権利証・刻印シート ----------
    openSheet() {
      const p = pending();
      if (!p || !ready()) return;
      const s = D.byId[p.stationId];
      const esc = api.esc;
      const color = (D.meta.prefectures[s.prefecture] || {}).color;
      const root = document.getElementById('owner-sheet');
      const joys = D.meta.owner.joys;
      root.innerHTML = `
        <article class="deed" role="dialog" aria-modal="true" aria-labelledby="deed-title" style="--pref:${color}">
          <div class="deed-inner">
            <p class="deed-kicker">九州よりみち　オーナー権利証</p>
            <h2 id="deed-title" class="deed-title">オーナー権利証・刻印シート</h2>
            <div class="deed-station">
              <span class="chip chip-pref">${esc(s.prefecture)}</span>
              <p class="deed-name">${esc(s.name)}<small>駅</small></p>
              <p class="deed-value">資産評価額 <b>${api.yen(s.assetValue)}</b></p>
            </div>
            <dl class="deed-rows">
              <div><dt>手配先</dt><dd><span class="via-badge">${viaIcon(p)} ${esc(viaLabel(p))}</span></dd></div>
              <div><dt>手配したもの</dt><dd>${esc(p.item)}</dd></div>
            </dl>
            <fieldset class="deed-joy">
              <legend>この旅の楽しみ <small>ひとつ選んでください</small></legend>
              <div class="joy-row">${joys
                .map((j) => `<button type="button" class="joy-btn" data-joy="${esc(j.id)}" aria-pressed="false"><span aria-hidden="true">${j.icon}</span>${esc(j.label)}</button>`)
                .join('')}</div>
            </fieldset>
            <label class="deed-oath"><input type="checkbox" data-oath> <span>${esc(D.meta.owner.oath)}</span></label>
            <div class="deed-stamp-area" aria-hidden="true"><span class="deed-stamp-guide">刻印欄</span><div class="deed-seal">${sealSvg(s, api.fmtDate(new Date().toISOString()))}</div></div>
            <button class="stamp-btn" data-stamp disabled>オーナー刻印を押す（資産登録）</button>
            <button class="link-btn deed-later" data-deed-later>まだ手配の途中なので、あとで押す</button>
            <p class="deed-note">※ 実際の購入・予約の内容は確かめていません。手配が済んだときに押してください。刻印すると、総資産額とクラフト資金に ${api.yen(s.assetValue)} が加わります。</p>
          </div>
        </article>`;
      root.hidden = false;
      requestAnimationFrame(() => root.classList.add('is-open'));
      Sound.gentle();
      const stampBtn = root.querySelector('[data-stamp]');
      let joy = null;
      const sync = () => (stampBtn.disabled = !(joy && root.querySelector('[data-oath]').checked));
      root.onclick = (e) => {
        const j = e.target.closest('[data-joy]');
        if (j) {
          joy = j.dataset.joy;
          root.querySelectorAll('[data-joy]').forEach((b) => b.setAttribute('aria-pressed', b === j));
          Sound.click();
          sync();
          return;
        }
        if (e.target.closest('[data-deed-later]') || e.target === root) return Owner.closeSheet();
        if (e.target.closest('[data-stamp]') && !stampBtn.disabled) Owner.stamp(p, joy);
      };
      root.querySelector('[data-oath]').addEventListener('change', () => {
        Sound.click();
        sync();
      });
      setTimeout(() => root.querySelector('[data-joy]').focus({ preventScroll: true }), 80);
    },

    closeSheet() {
      const root = document.getElementById('owner-sheet');
      if (root.hidden) return;
      root.classList.remove('is-open');
      setTimeout(() => {
        root.hidden = true;
        root.innerHTML = '';
      }, 250);
    },

    // 押印：「バン！」と印が手帖に押されてから、刻印（資産登録）する
    stamp(p, joy) {
      const root = document.getElementById('owner-sheet');
      const deed = root.querySelector('.deed');
      root.querySelector('[data-stamp]').disabled = true;
      deed.classList.add('is-stamping');
      setTimeout(() => {
        Sound.stamp();
        deed.classList.add('is-stamped');
      }, 380);
      setTimeout(() => {
        const first = Store.acquire(p.stationId, { via: p.via, provider: p.provider, item: p.item, joy });
        early = false;
        Owner.closeSheet();
        api.renderAll();
        api.refreshModal(p.stationId);
        if (first) api.celebrate(p.stationId);
      }, 1500);
    },
  };

  YT.Owner = Owner;
})();
