// YT.Privacy … やさしい言葉のプライバシーポリシー（登録フォーム・手帖の「ログイン中」の行から、いつでも小さな窓でひらける）と、
// 退会（登録と記録を消す）の確かめの窓。
// - VERSION を上げたら firebase/firestore.rules の policyVersion() も同じにする（次にひらいたとき、同意し直してもらう）。
// - 本文は自前の決まった文だけ（読み込んだ文字は入れない）。それでも差し込む文字は esc() を通す。
(function () {
  'use strict';
  const YT = (window.YT = window.YT || {});
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const VERSION = 1;
  const UPDATED = '2026年10月';
  // お問い合わせ先は運営が決めたら書く（決まるまでは「準備中」と正直に出す）
  const CONTACT = '';

  const SECTIONS = [
    ['あずかるもの', [
      '手帖に載せる名前（ペンネームでかまいません）',
      '年代・性別・出身地・いま住んでいるところ（国、日本なら都道府県まで）',
      '遊んだ記録（止まった駅・出資・工房のパーツなど）',
      'あなたが送った駅ノートの思い出と、旅の便りの写真',
    ]],
    ['あずからないもの', [
      'メールアドレスは、ログインのしくみ（Google の Firebase Authentication）の中だけにあります。このゲームのデータベースには入れません',
      '位置情報（GPS）は取りません。写真も、写した場所などの情報を消してから送ります',
      '住所・電話番号・本名は、たずねません',
    ]],
    ['だれに見えるか', [
      'ほかの旅人に見えるのは、手帖に載せる名前と、あなたが「載せる」と決めた投稿（運営が確かめた駅ノート・ほかの旅人にも見せる旅の便り）だけです',
      '年代・性別・出身地・いま住んでいるところは、ほかの旅人には見えません。ゲームの画面から読めるのはあなただけです。運営は、集計するときだけ、2段階認証で守った管理用の画面（Firebase のコンソール）で扱います',
    ]],
    ['何に使うか', [
      '年代・性別・出身地・いま住んでいるところは、「どんな人が九州を訪れているか」を知るための集計にだけ使います。少ない人数からだれかが分かってしまわないよう、まとめた数でしか扱いません',
      '広告・販売・ほかの会社への提供・AI の学習には使いません',
    ]],
    ['写真と投稿について', [
      '人の顔・車のナンバー・住所など、だれかが分かるものは写さない・書かないでください',
      '気になる写真はだれでも通報でき、3件そろうと自動で見えなくなります。運営が確かめて、戻すか消します',
      '駅ノートの思い出は、運営が一件ずつ確かめてから載せます',
    ]],
    ['消したいとき', [
      '手帖の「ログイン中」の行の「登録と記録を消す」から、いつでも消せます。登録・統計用の情報・遊んだ記録・あなたの駅ノート・旅の便りの写真を、まとめて消します',
      'ログインの記録（メールアドレス）も、そのとき一緒に消します（消せなかったときは、もう一度ログインして同じボタンを押してください）',
    ]],
  ];

  let layer = null;
  let lastFocus = null;
  function ensure() {
    if (layer) return layer;
    layer = document.createElement('div');
    layer.className = 'pp-layer';
    layer.hidden = true;
    document.body.appendChild(layer);
    layer.addEventListener('click', (e) => {
      if (e.target === layer || e.target.closest('[data-pp-close]')) close();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && layer && !layer.hidden) {
        e.stopPropagation();
        close();
      }
    }, true);
    return layer;
  }
  function show(html, label) {
    const l = ensure();
    lastFocus = document.activeElement;
    l.innerHTML = `<div class="pp-box" role="dialog" aria-modal="true" aria-label="${esc(label)}">
        <button class="modal-close" data-pp-close aria-label="閉じる">×</button>${html}</div>`;
    l.hidden = false;
    requestAnimationFrame(() => l.classList.add('is-open'));
    setTimeout(() => { const f = l.querySelector('[data-pp-focus]') || l.querySelector('[data-pp-close]'); if (f) f.focus({ preventScroll: true }); }, 60);
  }
  function close() {
    if (!layer || layer.hidden) return;
    layer.classList.remove('is-open');
    if (layer._resolve) { layer._resolve(false); layer._resolve = null; }
    setTimeout(() => (layer.hidden = true), 200);
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }

  function policyHtml() {
    const G = YT.Guides;
    return `<p class="eyebrow">Privacy</p>
      <h2 class="pp-title">旅の手帖の、あずかりもの</h2>
      ${G ? G.line('privacy') : ''}
      ${SECTIONS.map(([h, items]) => `<section class="pp-sec"><h3>${esc(h)}</h3><ul>${items.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></section>`).join('')}
      <section class="pp-sec"><h3>お問い合わせ</h3><p>${CONTACT ? esc(CONTACT) : 'お問い合わせの窓口は準備中です。決まりしだい、ここに書きます。'}</p></section>
      <p class="pp-foot">${esc(UPDATED)}・第${VERSION}版。内容を変えたときは、次にひらいたときにお知らせして、もう一度同意をいただきます。この手帖では、生成AIは使っていません。</p>
      <p class="pp-row"><button class="primary-btn btn-sm" data-pp-close data-pp-focus>閉じる</button></p>`;
  }
  const open = () => show(policyHtml(), 'プライバシーポリシー');

  // 退会の確かめ。消すと決めたら true
  function confirmLeave() {
    const G = YT.Guides;
    show(`<p class="eyebrow">Farewell</p>
      <h2 class="pp-title">登録と記録を消す</h2>
      ${G ? G.line('leave') : ''}
      <ul class="pp-list">
        <li>登録（名前・同意）と、年代・性別・出身地・いま住んでいるところ</li>
        <li>データベースの遊んだ記録と、この端末の記録・旅の便りの写真</li>
        <li>あなたの駅ノートの思い出（審査待ち・掲載中）と、ほかの旅人に見せている旅の便り</li>
        <li>ログインの記録（メールアドレス）</li>
      </ul>
      <p class="pp-warn">消したものは元に戻せません。押した「素敵ね」と通報は、だれのものか分からない形で残ります。</p>
      <p class="pp-row"><button class="primary-btn btn-sm pp-danger" data-pp-leave>すべて消す</button><button class="ghost-btn btn-sm" data-pp-close data-pp-focus>やめる</button></p>`, '登録と記録を消す');
    return new Promise((resolve) => {
      layer._resolve = resolve;
      layer.querySelector('[data-pp-leave]').addEventListener('click', () => {
        layer._resolve = null;
        resolve(true);
        close();
      }, { once: true });
    });
  }

  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-privacy-open]')) {
      e.preventDefault();
      open();
    }
  });

  YT.Privacy = { VERSION, open, close, confirmLeave };
})();
