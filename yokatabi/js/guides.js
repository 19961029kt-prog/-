// YT.Guides … 案内人の3匹（ツシマヤマネコのツシ丸・ムツゴロウのゴロ太・カササギのカチ助）の吹き出し。
// 夕暮れのローカル線の待合室にある「駅ノート」の世界観で、登録・駅ノート・手帖の要所に1言ずつ出す。
// - 絵は js/icons.js の線画（絵文字は使わない）。セリフは esc() を通して文字として出す。
// - 実在の動物の名前ではなく、九州の生きものの種類をもとにしたオリジナルの案内人。
(function () {
  'use strict';
  const YT = (window.YT = window.YT || {});
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const WHO = {
    tsushimaru: { name: 'ツシ丸', role: 'ツシマヤマネコ・裏路地の案内人' },
    gorota: { name: 'ゴロ太', role: 'ムツゴロウ・思い出とごはんの案内人' },
    kachisuke: { name: 'カチ助', role: 'カササギ・手帖の案内人' },
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
  };

  // 吹き出し1つ。id は WHO の名前、text はセリフ（small: 小さめ）
  function say(id, text, { small = false } = {}) {
    const w = WHO[id];
    const face = YT.Icon ? YT.Icon.svg(id) : '';
    return `<div class="guide guide-${id}${small ? ' guide-sm' : ''}">
        <span class="guide-face" title="${esc(w.name)}（${esc(w.role)}）">${face}</span>
        <p class="guide-say"><b class="guide-name">${esc(w.name)}</b>${esc(text)}</p>
      </div>`;
  }
  // 決まった場面のセリフ
  const line = (scene, opts) => say(LINES[scene][0], LINES[scene][1], opts);

  YT.Guides = { say, line, WHO, LINES };
})();
