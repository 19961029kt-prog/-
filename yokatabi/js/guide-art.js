// YT.GuideArt … 案内人の3匹の絵。運営の設定画（2026年10月、運営が自分で用意した動く絵）を、描き直さずにそのまま使う（依頼「そのまま採用」）。
// - 絵は img/guides/ の WebP。tools/guide-sprites.py が設定画（tools/guides-source.gif・30コマ・1コマ100ms）から
//   3匹を1匹ずつ切り抜いて作る（背景を透明にするだけで、色も形も変えない）。動きも設定画のまま（まばたき・地図をひらく・跳ねる・羽ばたく）。
// - 全身（歓迎の窓）と、吹き出しの顔（顔のまわりを、顔の動きを追いかけて切り出した 112px）の2種類。
// - 「視差効果を減らす」の端末では、動かない1コマ目を出す（<picture> の media で選ぶので、動く絵は読まない）。
(function () {
  'use strict';
  const YT = (window.YT = window.YT || {});
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const BASE = 'img/guides/';
  const IDS = ['tsushimaru', 'gorota', 'kachisuke'];
  // 全身の絵の大きさ（px）。3匹は設定画の中で同じ縮尺なので、並べるときは高さ272を基準にそろえる（ゴロ太が少し小さい）
  const SIZE = { tsushimaru: [211, 272], gorota: [172, 219], kachisuke: [280, 272] };
  const FACE_PX = 112;
  const TALL = 272;
  const reduced = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const src = (id, full, still) => `${BASE}${id}${full ? '' : '-face'}${still ? '-still' : ''}.webp`;

  // full: 全身（歓迎の窓など）／そうでなければ吹き出しの顔。label があれば絵の名前として読み上げる
  function html(id, { full = false, label = '' } = {}) {
    if (!SIZE[id]) return '';
    const [w, h] = full ? SIZE[id] : [FACE_PX, FACE_PX];
    const scale = full ? ` style="--w:${(w / TALL).toFixed(3)}"` : '';
    const alt = label ? ` alt="${esc(label)}"` : ' alt="" aria-hidden="true"';
    return `<picture class="gart gart-${id}${full ? ' gart-full' : ''}"${scale}>`
      + `<source srcset="${src(id, full, true)}" media="(prefers-reduced-motion: reduce)">`
      + `<img src="${src(id, full, false)}" width="${w}" height="${h}"${alt} decoding="async" draggable="false"></picture>`;
  }

  // 先に読んでおく（登録フォームをひらいたときに全身を読んでおけば、登録した直後の歓迎の窓で絵が遅れて出ない）
  const loaded = {};
  function preload(full) {
    const still = reduced();
    IDS.forEach((id) => {
      const u = src(id, full, still);
      if (loaded[u]) return;
      loaded[u] = true;
      const im = new Image();
      im.decoding = 'async';
      im.src = u;
    });
  }

  YT.GuideArt = { html, preload, ids: IDS };
})();
