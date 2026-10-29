// YT.Guides … 案内人の3匹（ツシマヤマネコのツシ丸・ムツゴロウのゴロ太・カササギのカチ助）の吹き出し。
// 夕暮れのローカル線の待合室にある「駅ノート」の世界観で、登録・駅ノート・手帖の要所に1言ずつ出す。
// - 絵は js/guide-art.js（運営の設定画の白い背景だけを透明にした絵。絵文字は使わない）。セリフは esc() を通して文字として出す。
// - 動きは CSS：顔が輪の下からのぞき、それぞれの癖で小さく動きつづける。顔を押すと、ぴょんと跳ねる。
// - 役目：ツシ丸＝システム（ログイン・登録・読み込めないとき・プライバシー）と裏路地の深い話、ゴロ太＝投稿とグルメ、カチ助＝ナビと新着の知らせ。
// - 実在の動物の名前ではなく、九州の生きものの種類をもとにしたオリジナルの案内人。
(function () {
  'use strict';
  const YT = (window.YT = window.YT || {});
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const WHO = {
    tsushimaru: { name: 'ツシ丸', role: 'ツシマヤマネコ・システムと裏路地の案内人' },
    gorota: { name: 'ゴロ太', role: 'ムツゴロウ・投稿とグルメの案内人' },
    kachisuke: { name: 'カチ助', role: 'カササギ・ナビと新着の知らせ役' },
  };
  // 決まった場面のセリフ（場面の名前 → [だれ, セリフ]）
  const LINES = {
    gate: ['tsushimaru', '観光ガイドには載ってない、あんただけの『あの頃の景色』を教えてほしいニャ。遠くの街で頑張ってる誰かが、それを見て懐かしくなるかもしれないニャ'],
    register: ['tsushimaru', '入力した年代や性別は、他の旅人には見えないように俺がしっかり守るニャ！'],
    privacy: ['tsushimaru', 'むずかしい言葉は使わんで書いたニャ。気になるところは、いつでも読み直してほしいニャ'],
    note: ['kachisuke', '遠く離れた場所からでも、いつでもこの駅に帰ってこられるカチ。みんなの思い出が詰まった手帖カチ！'],
    post: ['gorota', '放課後に食べたあの味も、駅前の小さな食堂も、立派な九州の宝物ばい！初めての旅人さんにも、この温かい空気ばおすそ分けするムツ！'],
    consent: ['gorota', 'この思い出を、みんなの手帖に載せてもよかばい？'],
    thanks: ['gorota', 'たしかに預かったムツ！運営さんが確かめたら、この駅のノートに載るばい'],
    leave: ['tsushimaru', 'さみしくなるけど、あんたのことは全部きれいに片づけるニャ。また九州に帰ってきてほしいニャ'],
    // 空の画面（まだ何もないとき）
    emptyNote: ['gorota', 'この駅のノートは、まだまっさらムツ…。あんたの「あの頃の味」で、最初のページば埋めてほしいばい！'],
    emptyNoteGuest: ['gorota', 'この駅のノートは、まだまっさらムツ。この町を知っとる人の思い出ば、楽しみに待っとるばい'],
    emptyMine: ['kachisuke', 'まだ一枚も届いてないカチ。空から見てると、あんたの町にもいい景色がいっぱいあるカチ！'],
    emptyBoard: ['kachisuke', 'この便りは、まだ空を飛んでこないカチ。いちばん乗りになるカチ？'],
    emptyTrip: ['tsushimaru', '地図の端っこの道ほど、いい旅になるニャ。気に入ったコースは、ここにしまっとくニャ'],
    // 読み込めないとき
    offline: ['tsushimaru', '電波がひねくれてるニャ。少し歩いて、もう一回ひらいてほしいニャ'],
    // はじめて登録したときの歓迎（3匹が順番に）
    welcome1: ['tsushimaru', 'よう来たニャ。ここは九州の裏路地まで載ってる手帖ニャ。迷ったら、俺に聞くニャ'],
    welcome2: ['gorota', '止まった駅で、あんたの思い出もおいしかもんも、聞かせてほしいばい！'],
    welcome3: ['kachisuke', '新しい便りやノートが届いたら、空から知らせるカチ！さあ、ダイスば振るカチ！'],
  };
  // カチ助の新着の知らせ（数は手元で数えた件数）
  function news({ notes = 0, cards = 0 } = {}) {
    const parts = [];
    if (notes) parts.push(`駅ノートが${notes}件`);
    if (cards) parts.push(`旅の便りが${cards}通`);
    if (!parts.length) return '';
    return say('kachisuke', `この駅に、新しく${parts.join('と')}届いてたカチ！`, { small: true }).replace('class="guide ', 'class="guide guide-news ');
  }

  // 吹き出し1つ。id は WHO の名前、text はセリフ（small: 小さめ）
  function say(id, text, { small = false } = {}) {
    const w = WHO[id];
    // 絵は設定画の顔のまわり（js/guide-art.js）。guide-art.js を読めないときは小さな線画のアイコン
    const face = YT.GuideArt ? YT.GuideArt.html(id) : YT.Icon ? YT.Icon.svg(id) : '';
    return `<div class="guide guide-${id}${small ? ' guide-sm' : ''}">
        <span class="guide-face" title="${esc(w.name)}（${esc(w.role)}）">${face}</span>
        <p class="guide-say"><b class="guide-name">${esc(w.name)}</b>${esc(text)}</p>
      </div>`;
  }
  // 決まった場面のセリフ
  const line = (scene, opts) => say(LINES[scene][0], LINES[scene][1], opts);

  // はじめて登録したときの歓迎の窓（3匹の全身の絵と一言ずつ）。閉じたら終わり（登録の直後に一度だけ呼ぶ）
  function welcome() {
    const A = YT.GuideArt;
    const layer = document.createElement('div');
    layer.className = 'pp-layer gw-layer';
    layer.innerHTML = `<div class="pp-box gw-box" role="dialog" aria-modal="true" aria-label="案内人からのあいさつ">
        <p class="eyebrow">Welcome</p>
        <h2 class="pp-title">九州の案内人たち</h2>
        <div class="gw-row">${['tsushimaru', 'gorota', 'kachisuke'].map((id, i) => `
          <figure class="gw-one gw-${id}" style="--i:${i}">
            <div class="gw-art">${A ? A.html(id, { full: true, label: WHO[id].name }) : ''}</div>
            <figcaption><b>${esc(WHO[id].name)}</b><small>${esc(WHO[id].role)}</small><span>${esc(LINES['welcome' + (i + 1)][1])}</span></figcaption>
          </figure>`).join('')}
        </div>
        <p class="pp-row"><button class="primary-btn" data-gw-close>旅をはじめる</button></p>
      </div>`;
    document.body.appendChild(layer);
    requestAnimationFrame(() => layer.classList.add('is-open'));
    const close = () => {
      layer.classList.remove('is-open');
      setTimeout(() => layer.remove(), 300);
      document.removeEventListener('keydown', onKey, true);
    };
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    document.addEventListener('keydown', onKey, true);
    layer.addEventListener('click', (e) => { if (e.target === layer || e.target.closest('[data-gw-close]')) close(); });
    setTimeout(() => { const b = layer.querySelector('[data-gw-close]'); if (b) b.focus({ preventScroll: true }); }, 60);
  }

  // 顔（吹き出し・歓迎の窓の全身）を押すと、ぴょんと跳ねる。動きを減らす端末では CSS が跳ねさせない
  document.addEventListener('click', (e) => {
    const f = e.target.closest && e.target.closest('.guide-face, .gw-art');
    if (!f || f.classList.contains('is-hop')) return;
    f.classList.add('is-hop');
    setTimeout(() => f.classList.remove('is-hop'), 650);
  });

  YT.Guides = { say, line, news, welcome, WHO, LINES };
})();
