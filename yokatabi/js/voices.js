// YT.Voices … 寄り道手帖の「地元の人の声」。運営が地元の方に会って掲載の同意をいただき、内容を確かめて承認した声（Firestore の voices）だけを読む。
// 書き込みはしない（投稿と審査は local.html の窓口）。読んだ文字はすべて esc() を通して文字として出す。
// 通信できないとき・file:// のときは、手帖のほかの部分の邪魔をしないよう静かに「いまは読み込めません」とだけ出す。
(function () {
  'use strict';
  const YT = (window.YT = window.YT || {});
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const I = (n) => (YT.Icon ? YT.Icon.svg(n) : '');
  const SHOW = 5; // 1駅に出す数
  const TTL = 10 * 60 * 1000; // 同じ駅を何度ひらいても、10分は読み直さない（読み取りの回数を抑える）
  const cache = {};

  // 手帖の中の枠だけを先に出す。中身は fill() があとから入れる
  function sectionHtml(id) {
    return `<section class="modal-sec voices-sec" data-voices="${esc(id)}" aria-live="polite">
        <h3 class="sec-title">${I('megaphone')}地元の人の声 <em>この駅に暮らす人から</em></h3>
        <div class="voices-body"><p class="voices-empty">地元の人の声を読み込んでいます…</p></div>
        <p class="voices-note">運営が地元の方にお会いして掲載の同意をいただき、内容を確かめてから載せています。</p>
      </section>`;
  }

  async function load(id) {
    const hit = cache[id];
    if (hit && Date.now() - hit.at < TTL) return hit.list;
    const { fs, db } = await YT.Firebase.boot();
    const snap = await fs.getDocs(fs.query(fs.collection(db, 'voices'), fs.where('stationId', '==', id), fs.limit(20)));
    // 新しく承認されたものから（並べ替えは手元で。複合インデックスを作らずにすむ）
    const list = snap.docs
      .map((d) => d.data())
      .sort((a, b) => (b.approvedAt ? b.approvedAt.toMillis() : 0) - (a.approvedAt ? a.approvedAt.toMillis() : 0))
      .slice(0, SHOW);
    cache[id] = { at: Date.now(), list };
    return list;
  }

  function itemHtml(v) {
    return `<li class="voice">
        <p class="voice-body">${esc(v.body)}</p>
        <p class="voice-by"><span class="voice-name">${esc(v.name)}</span>${v.title ? `<small>${esc(v.title)}</small>` : ''}</p>
      </li>`;
  }

  // root（手帖のカード）の中の枠に、駅 id の声を入れる。手帖を閉じたり別の駅に替えたりしていたら何もしない
  async function fill(root, id) {
    const sec = root && root.querySelector(`[data-voices="${CSS.escape(id)}"]`);
    if (!sec) return;
    const body = sec.querySelector('.voices-body');
    try {
      const list = await load(id);
      if (!sec.isConnected) return;
      body.innerHTML = list.length
        ? `<ul class="voices-list">${list.map(itemHtml).join('')}</ul>`
        : '<p class="voices-empty">この駅には、まだ地元の人の声が届いていません。</p>';
    } catch (e) {
      if (!sec.isConnected) return;
      body.innerHTML = '<p class="voices-empty">いまは地元の人の声を読み込めません。通信のよいところで、もう一度ひらいてください。</p>';
    }
  }

  YT.Voices = { sectionHtml, fill };
})();
