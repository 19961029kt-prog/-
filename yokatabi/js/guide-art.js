// YT.GuideArt … 案内人の3匹の絵。運営の設定画（2026年10月、運営が用意した1匹ずつの絵）を、描き直さずにそのまま使う（依頼「そのまま採用」）。
// - 絵は img/guides/ の WebP。tools/guide-cutout.py が設定画（tools/guides/{id}.jpg）の白い背景だけを透明にして作る（色も形も変えない）。
// - 全身（歓迎の窓）と、吹き出しの顔（顔のまわりを正方形に切り出した 168px）の2種類。
// - 動きは CSS（css/style.css の案内人の節）で足す。端末の「視差効果を減らす」では動かさない。
(function () {
  'use strict';
  const YT = (window.YT = window.YT || {});
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const BASE = 'img/guides/';
  const IDS = ['tsushimaru', 'gorota', 'kachisuke'];
  // 全身の絵の大きさ（px）。3枚は設定画どうしと同じ縮尺なので、並べるときはいちばん背の高いツシ丸（361）を基準にそろえる
  const SIZE = { tsushimaru: [273, 361], gorota: [244, 333], kachisuke: [340, 349] };
  const FACE_PX = 168;
  const TALL = 361;
  const src = (id, full) => `${BASE}${id}${full ? '' : '-face'}.webp`;

  // full: 全身（歓迎の窓など）／そうでなければ吹き出しの顔。label があれば絵の名前として読み上げる
  function html(id, { full = false, label = '' } = {}) {
    if (!SIZE[id]) return '';
    const [w, h] = full ? SIZE[id] : [FACE_PX, FACE_PX];
    const scale = full ? ` style="--w:${(w / TALL).toFixed(3)}"` : '';
    const alt = label ? ` alt="${esc(label)}"` : ' alt="" aria-hidden="true"';
    return `<span class="gart gart-${id}${full ? ' gart-full' : ''}"${scale}>`
      + `<img src="${src(id, full)}" width="${w}" height="${h}"${alt} decoding="async" draggable="false"></span>`;
  }

  // 先に読んでおく（登録フォームをひらいたときに全身を読んでおけば、登録した直後の歓迎の窓で絵が遅れて出ない）
  const loaded = {};
  function preload(full) {
    IDS.forEach((id) => {
      const u = src(id, full);
      if (loaded[u]) return;
      loaded[u] = true;
      const im = new Image();
      im.decoding = 'async';
      im.src = u;
    });
  }

  YT.GuideArt = { html, preload, ids: IDS };
})();
