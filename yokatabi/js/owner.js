// 駅のオーナー権への出資と、「15秒覗くだけ」の急行切符ボーナス。
//   出資：寄り道手帖の「クラフト資金で出資する」→ 出資届（金額を選ぶ・ランキングの見込み）→「出資して刻印する」で朱の印が押され、
//         クラフト資金から出資額を払って、その駅の累計出資額に加える（順位の計算は js/ownership.js）。1位になったら王座交代の演出。
//         オーナー権はゲームの中の資金だけで決まり、お買い物やその証明（スクショなど）は一切いらない。
//   急行切符ボーナス：名産品・宿のカードの「この駅の逸品を覗いて…」を押すと、ショップの検索ページを別タブでひらき、
//         15秒たつと（別タブから戻ったときに確かめる）特別切符とクラフト資金を受け取れる。1駅につき1日1回。
//         ご褒美はページを「覗いた」ことに対するもので、購入とは関係しない。ひらくのは紹介料のつかない普通の検索ページ
//         （meta.peek.affiliate が false のとき。広告のリンクを押すことに見返りをつけないため）。
(function () {
  'use strict';
  const YT = (window.YT = window.YT || {});
  const { Store, Sound, Ownership } = YT;

  let D = null;
  let api = null; // app.js から：{ esc, yen, toast, renderAll, refreshModal, afterInvest, buildUrl }
  const I = (name, opts) => YT.Icon.svg(name, opts); // 線画のアイコン（絵文字は使わない）
  const $ = (sel) => document.querySelector(`#owner-sheet ${sel}`);
  const cfg = () => D.meta.owner;
  const peekCfg = () => D.meta.peek;
  // 出資できるのは、その駅に停車中のときだけ（ダイスでたどり着いた駅の手帖から）
  const canInvest = (id) => Store.get().currentStationId === id;

  // 風景印：駅名・日付・山と波の絵を二重の輪で囲んだ、丸い記念の印（朱の印肉＋金の箔押しの輪）。オーナー証の切手の消印に使う
  function sealSvg(s, date) {
    const fid = `seal-ink-${s.id}-${Math.random().toString(36).slice(2, 7)}`;
    // 消印は少し傾けて、朱肉のかすれ（photos.js のフィルタ）をかける
    return `<svg viewBox="-60 -60 120 120" class="seal-svg" aria-hidden="true">
      <defs><path id="seal-arc-${s.id}" d="M-41,0 A41,41 0 0 1 41,0"/>${YT.Photos.inkFilter(fid, 5)}</defs>
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

  // ---------- 出資届 ----------
  let sheet = null; // { id, amount }
  const step = () => cfg().investStep || 100;
  const roundUp = (v) => Math.ceil(v / step()) * step();

  function sheetHtml(id) {
    const s = D.byId[id];
    const esc = api.esc;
    const color = (D.meta.prefectures[s.prefecture] || {}).color;
    const me = Ownership.you(id);
    const top = Ownership.owner(id);
    const upset = (me ? me.rank : null) !== 1;
    const bal = YT.Craft.balance();
    // 金額の札：何位に届くかの目安（下克上ボーナス込みで、追い越すのに足りる額を切り上げ）
    const presets = [3, 2, 1]
      .map((r) => ({ r, v: Ownership.needFor(id, r) }))
      .filter((p) => p.v > 0)
      .map((p) => ({ ...p, v: roundUp(p.v) }));
    return `
      <article class="deed deed-apply" role="dialog" aria-modal="true" aria-labelledby="deed-title" style="--pref:${color}">
        <div class="deed-inner">
          <p class="deed-kicker">九州よりみち　オーナー権 出資届</p>
          <h2 id="deed-title" class="deed-title">クラフト資金で出資する</h2>
          <div class="deed-station">
            <span class="chip chip-pref">${esc(s.prefecture)}</span>
            <p class="deed-name">${esc(s.name)}<small>駅</small></p>
            <p class="deed-value">いまのトップオーナー <b>${esc(top.userName)}</b>（累計 ${api.yen(top.totalAmount)}）${me ? `／あなた ${me.rank}位（${api.yen(me.totalAmount)}）` : ''}</p>
            ${upset ? `<p class="deed-bonus">${I('swords')} 下克上ボーナス：いまの1位ではないので、出資額を <b>×${cfg().upsetBonus}</b> で数えます</p>` : ''}
            <p class="deed-arrival">${I('coins')} 使えるクラフト資金：<b class="num-it">${api.yen(bal)}</b></p>
          </div>
          <div class="invest-presets" role="group" aria-label="出資額の目安">
            ${presets
              .map((p) => `<button class="invest-chip${p.v > bal ? ' is-short' : ''}" data-invest-amt="${p.v}"><span>${p.r === 1 ? `${I('crown')}トップオーナー` : `<i class="num-it">${p.r}</i>位に入る`}</span><b>${api.yen(p.v)}</b></button>`)
              .join('')}
          </div>
          <div class="apply-form">
            <div class="apply-row">
              <label>出資額 <span class="amount-field"><input type="text" inputmode="numeric" autocomplete="off" data-amount aria-label="出資額（万円）" value="${presets.length ? Math.min(presets[0].v, Math.max(step(), Math.floor(bal / step()) * step())) : step()}"><small>万円</small></span></label>
              <span class="invest-steps"><button class="ticket-btn" data-invest-step="-1" aria-label="${step()}万円へらす">−</button><button class="ticket-btn" data-invest-step="1" aria-label="${step()}万円ふやす">＋</button></span>
            </div>
            <p class="apply-preview" data-preview-line></p>
            <p class="apply-verdict" data-verdict></p>
          </div>
          <div class="deed-stamp-spot" aria-hidden="true" data-stamp-art></div>
          <button class="stamp-btn" data-confirm disabled>出資して刻印する</button>
          <button class="link-btn deed-later" data-deed-later>今回は見送る</button>
          <p class="deed-note">※ 出資はゲームの中のクラフト資金だけで行います（お金やお買い物は一切いりません）。出資した資金は戻りませんが、上位3名に入ると共同株主として配当を受け取れます。ランキング・配当・クラフト資金はゲームの中だけのもので、お金の価値はありません。</p>
        </div>
      </article>`;
  }

  function amountValue() {
    const v = Number(String($('[data-amount]').value).replace(/[^\d]/g, ''));
    return v > 0 ? v : 0;
  }
  // 金額を変えるたびに、ランキングでどうなるかを見せる。残高の範囲なら確定できる
  function updatePreview() {
    const v = amountValue();
    const bal = YT.Craft.balance();
    const line = $('[data-preview-line]');
    const verdict = $('[data-verdict]');
    const ok = v >= step() && v <= bal;
    $('[data-confirm]').disabled = !ok;
    verdict.className = `apply-verdict ${ok ? 'is-ok' : 'is-ng'}`;
    verdict.innerHTML = !v
      ? `出資額を入れてください（${api.yen(step())}から）`
      : v > bal
        ? `${I('warning')} クラフト資金が ${api.yen(v - bal)} 足りません。発見ボーナス・配当・旅の便りなどで貯めましょう`
        : v < step()
          ? `${api.yen(step())}から出資できます`
          : `${I('seal')} 「出資して刻印する」で、朱の印を押して記録します`;
    if (!v) return (line.textContent = '');
    const pv = Ownership.preview(sheet.id, v);
    line.innerHTML = `ランキングに入る額 <b>${api.yen(pv.scored)}</b>${pv.upset ? `（${api.yen(v)} × 下克上 ${cfg().upsetBonus}）` : ''} → 累計 ${api.yen(pv.total)}、<b>${pv.rankAfter}位</b>${
      pv.rankAfter === 1 ? `　${I('crown')} トップオーナーになります！` : `（1位まであと 出資 ${api.yen(roundUp(pv.needToTop))} ぶん）`
    }${pv.rankAfter <= cfg().shareholders && pv.rankAfter > 1 ? '　共同株主として配当を受け取れます' : ''}`;
  }

  // 「出資して刻印する」：朱の印を押してから、資金を払って記録する
  function confirm() {
    const v = amountValue();
    if (!sheet || v < step() || v > YT.Craft.balance()) return;
    const id = sheet.id;
    const s = D.byId[id];
    $('[data-confirm]').disabled = true;
    const d = new Date();
    $('[data-stamp-art]').innerHTML = sealSvg(s, `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`);
    setTimeout(() => {
      Sound.stamp();
      $('.deed').classList.add('is-stamped');
    }, 300);
    setTimeout(() => {
      Store.spend(v);
      const result = Ownership.register(id, { id: `iv-${Date.now().toString(36)}`, at: d.toISOString(), amount: v, via: 'funds', shop: 'クラフト資金', item: '出資' });
      Owner.closeSheet();
      api.renderAll();
      api.refreshModal(id);
      api.afterInvest(id, result, v);
    }, 1300);
  }

  // ---------- 15秒覗くだけの急行切符ボーナス ----------
  // peek = { id, at（ひらいた時刻）, timer }。ページを閉じたら忘れる（覗いたあと戻ってきた人にだけ渡す）
  let peek = null;
  const today = () => Store.localDate();
  const peekedToday = (id) => Store.peekedOn(id) === today();
  const peekMs = () => (peekCfg().seconds || 15) * 1000;
  const ticketName = () => ((D.meta.game.tickets || []).find((t) => t.id === peekCfg().ticket) || {}).name || '特別切符';
  // 覗くページ：紹介料のつかない普通の検索ページ（meta.peek.affiliate が true なら、アフィリエイトのURL）
  function peekUrl(providerId, keyword) {
    const aff = D.meta.affiliate;
    const p = [...aff.products, ...aff.stays].find((x) => x.id === providerId);
    if (!p) return '#';
    return peekCfg().affiliate ? api.buildUrl(p, keyword) : p.url.replace('{kw}', encodeURIComponent(keyword));
  }
  // 名産品・宿のカードに置くボタン（受け取ったあとは、あすの案内）
  function peekHtml(id, via, keyword) {
    if (peekedToday(id)) return `<p class="peek-done">${I('ticket')} きょうの急行切符は受け取りました（あすまた、この駅で受け取れます）</p>`;
    const providerId = via === 'stay' ? peekCfg().stays : peekCfg().products;
    const waiting = peek && peek.id === id;
    return `<a class="peek-btn${waiting ? ' is-waiting' : ''}" href="${api.esc(peekUrl(providerId, keyword))}" target="_blank" rel="noopener${peekCfg().affiliate ? ' sponsored' : ''}" data-peek="${api.esc(id)}" data-peek-via="${via}">
        <span class="peek-icon" aria-hidden="true">${I('ticket')}</span>
        <span class="peek-text"><span>この駅の逸品を覗いて<b>「${api.esc(ticketName())}」</b>を受け取る</span><small>${waiting ? '別のタブで覗いています…15秒たつと受け取れます' : `ショップのページを15秒覗くだけ・クラフト資金 ＋${api.yen(peekCfg().funds)}つき（1駅1日1回）`}</small></span>
      </a>`;
  }
  function startPeek(id) {
    if (peekedToday(id)) return;
    clearTimeout(peek && peek.timer);
    peek = { id, at: Date.now() };
    // 15秒たったとき、この画面が見えていればその場で渡す（別のタブにいれば、戻ってきたときに渡す）
    peek.timer = setTimeout(checkPeek, peekMs() + 50);
    setTimeout(() => api.refreshModal(id), 0);
  }
  function checkPeek() {
    if (!peek || document.visibilityState !== 'visible') return;
    const left = peekMs() - (Date.now() - peek.at);
    if (left > 0) {
      Sound.gentle();
      api.toast(`まだ覗きはじめたところです。あと${Math.ceil(left / 1000)}秒ほどで急行切符を受け取れます`, 'toast-green', 'hourglass');
      clearTimeout(peek.timer);
      peek.timer = setTimeout(checkPeek, left + 50);
      return;
    }
    const id = peek.id;
    peek = null;
    if (peekedToday(id)) return;
    Store.claimPeek(id, today());
    const s = D.byId[id];
    const funds = peekCfg().funds || 0;
    if (funds) Store.addLedger('peek', `${s.name}駅の逸品めぐり`, funds);
    YT.Sound.coin();
    const t = YT.Game.grant(peekCfg().ticket, `${s.name}駅の逸品を覗いて、急行切符ボーナス！ `);
    if (!t) api.toast(`${s.name}駅の逸品めぐり：クラフト資金 ＋${api.yen(funds)}`, 'toast-gold', 'coins');
    else if (funds) setTimeout(() => api.toast(`逸品めぐりのお礼：クラフト資金 ＋${api.yen(funds)}`, 'toast-gold', 'coins'), 700);
    api.renderAll();
    api.refreshModal(id);
  }

  const Owner = {
    init(data, uiApi) {
      D = data;
      api = uiApi;
      // 別タブ（ショップ）から戻ってきた：visibilitychange と focus の両方が来るので、少しまとめてから確かめる
      let t = 0;
      const onReturn = () => {
        clearTimeout(t);
        t = setTimeout(checkPeek, 250);
      };
      document.addEventListener('visibilitychange', onReturn);
      window.addEventListener('focus', onReturn);
    },
    sealSvg,
    canInvest,
    peekHtml,

    // 寄り道手帖のクリック（出資・覗く）。処理したら true
    onClick(e) {
      const c = e.target.closest('[data-invest]');
      if (c) {
        Owner.openSheet(c.dataset.invest);
        return true;
      }
      const p = e.target.closest('[data-peek]');
      if (p) {
        // リンクは新しいタブで開く（ポップアップブロック対策で preventDefault しない）
        Store.recordAction(p.dataset.peek, p.dataset.peekVia);
        startPeek(p.dataset.peek);
        return true;
      }
      return false;
    },

    openSheet(id) {
      if (!id || !D.byId[id]) return;
      if (!canInvest(id)) {
        api.toast('出資は、ダイスでその駅に停車しているときだけできます');
        return;
      }
      const root = document.getElementById('owner-sheet');
      sheet = { id };
      root.innerHTML = sheetHtml(id);
      root.hidden = false;
      requestAnimationFrame(() => root.classList.add('is-open'));
      Sound.gentle();
      $('[data-amount]').addEventListener('input', updatePreview);
      root.onclick = (e) => {
        if (e.target.closest('[data-deed-later]') || e.target === root) return Owner.closeSheet();
        if (e.target.closest('[data-confirm]')) return confirm();
        const a = e.target.closest('[data-invest-amt]');
        if (a) {
          $('[data-amount]').value = a.dataset.investAmt;
          Sound.click();
          return updatePreview();
        }
        const st = e.target.closest('[data-invest-step]');
        if (st) {
          $('[data-amount]').value = Math.max(step(), amountValue() + Number(st.dataset.investStep) * step());
          Sound.click();
          updatePreview();
        }
      };
      updatePreview();
      setTimeout(() => $('[data-amount]').focus({ preventScroll: true }), 80);
    },

    closeSheet() {
      const root = document.getElementById('owner-sheet');
      if (root.hidden) return;
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
