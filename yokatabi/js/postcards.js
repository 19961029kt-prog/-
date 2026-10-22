// 旅の便り＆マイフォト地図（04 / POSTCARD のタブ）
//   ・投函：駅をプルダウンで選んで（その駅にいなくてもよい）、写真と一言（60文字まで）をポラロイド風のポストカードにする。
//     1駅に1枚（投函し直すと差し替え）。最初に投函したとき、地域発信ボーナスとしてクラフト資金 +1,000万円
//   ・わたしの九州フォトマップ：投函した駅の上に、写真の小さなポラロイドのピンが浮かぶ。タップで駅に金の波紋と拡大ポストカード
//   ・旅人たちのポストカード：ゲームの中の架空の旅人の便り（stations.json の postcards。絵はイラスト）。
//     ダイスでその駅に止まったことがあるときだけ見られて、「素敵ね」を押すと応援ボーナス +10万円
//   ・自分のポストカードには、旅人たちから時間とともに「いいね」が届く（1つ +50万円、1枚につき最大20）。
//     振り込みは、ダイス7回ごとの「週末の大精算まつり」（js/game.js）でまとめて
// 写真は端末の中だけ（IndexedDB。js/receipts.js の保存を使う）。どこにも送らない。
(function () {
  'use strict';
  const YT = (window.YT = window.YT || {});
  let D = null, api = null, root = null;
  const $ = (sel, r = document) => r.querySelector(sel);
  const esc = (s) => api.esc(s);
  const C = () => D.meta.craft;

  // ---------- 旅人たちのポストカード（架空・初期データ） ----------
  const seeds = () => (D.postcards || []).map((p, i) => ({ ...p, id: `seed-${p.stationId}-${i}` })).filter((p) => D.byId[p.stationId]);
  const rival = (id) => D.meta.rivals.find((r) => r.id === id) || { name: '旅人', icon: 'suitcase' };
  const I = (name, opts) => YT.Icon.svg(name, opts); // 線画のアイコン（絵文字は使わない）
  const unlocked = (stationId) => YT.Store.isVisited(stationId) || YT.Store.get().currentStationId === stationId;
  const seedLikes = (p) => p.likes + (YT.Store.hasLiked(p.id) ? 1 : 0);

  // ---------- 自分のポストカードに届く「いいね」 ----------
  // 旅人たち（架空）が時間とともに見つけてくれる想定：投函した直後に1〜3、そのあと約40分ごとに1つ、最大 likeReceivedMax
  const hash = (s) => [...String(s)].reduce((h, c) => (Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0), 2166136261);
  function likesOf(card) {
    const mins = Math.max(0, (Date.now() - Date.parse(card.postedAt)) / 60000);
    return Math.min(C().likeReceivedMax, 1 + (hash(card.id) % 3) + Math.floor(mins / 40));
  }
  // いいねをくれた旅人（表示用）
  function likersOf(card, n) {
    const order = [...D.meta.rivals].sort((a, b) => hash(card.id + a.id) - hash(card.id + b.id));
    return order.slice(0, Math.min(n, order.length));
  }
  const mine = () => YT.Store.getPostcards();

  function earnings() {
    if (!D) return { post: 0, given: 0, received: 0 };
    const own = Object.values(mine());
    const seedIds = new Set(seeds().map((p) => p.id));
    return {
      post: own.length * C().postBonus,
      given: Object.keys(YT.Store.get().liked || {}).filter((id) => seedIds.has(id)).length * C().likeGivenBonus,
      received: Math.min(totalLikes(), YT.Store.get().likesBanked || 0) * C().likeReceivedBonus,
    };
  }
  // 届いたいいねの合計（まだ振り込まれていないものも含む）
  const totalLikes = () => Object.values(mine()).reduce((n, c) => n + likesOf(c), 0);

  // ---------- 絵：ポストカードのイラスト（架空の旅人の便り用）と風景印 ----------
  // 架空の旅人の便りの絵は、銅版画（エッチング）の調子：生成りの紙にセピアのインクの線とハッチング、差し色は1色だけ
  function illust(scene, color, seed) {
    const r = (k) => ((hash(seed + k) % 1000) / 1000);
    const INK = '#3b2f28', PAPER = '#f1e8d6', id = `pg-${seed}`;
    const accent = scene === 'shrine' ? '#a8382b' : color;
    const ln = (d, w = 1.4, o = 0.85, c = INK) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" opacity="${o}"/>`;
    const fill = (d, pat = 'h1', stroke = true) => `<path d="${d}" fill="url(#${id}-${pat})"/>${stroke ? ln(d, 1.3) : ''}`;
    const rows = (y0, y1, gap, w = 0.7, o = 0.45) => Array.from({ length: Math.floor((y1 - y0) / gap) }, (_, i) => ln(`M0,${y0 + i * gap} H300`, w, o)).join('');
    const defs = `<pattern id="${id}-h1" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(40)"><path d="M0,0 V5" stroke="${INK}" stroke-width=".8" opacity=".5"/></pattern>
      <pattern id="${id}-h2" width="3.4" height="3.4" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)"><path d="M0,0 V3.4" stroke="${INK}" stroke-width=".8" opacity=".6"/></pattern>
      <pattern id="${id}-x" width="4" height="4" patternUnits="userSpaceOnUse"><path d="M0,0 L4,4 M4,0 L0,4" stroke="${INK}" stroke-width=".6" opacity=".55"/></pattern>
      <pattern id="${id}-sky" width="8" height="4" patternUnits="userSpaceOnUse"><path d="M0,.5 H8" stroke="${INK}" stroke-width=".5" opacity=".25"/></pattern>`;
    const parts = {
      steam: fill('M0,170 Q80,120 160,150 T300,140 L300,220 L0,220 Z') +
        [60, 120, 190, 240].map((x) => `<path d="M${x},160 q-10,-14 0,-28 t0,-28" fill="none" stroke="${PAPER}" stroke-width="7" stroke-linecap="round"/>${ln(`M${x},160 q-10,-14 0,-28 t0,-28`, 0.8, 0.6)}`).join('') +
        ln('M200,178 l26,-16 l26,16 M206,178 v22 M246,178 v22 M196,200 h64', 1.3) + `<circle cx="244" cy="62" r="14" fill="none" stroke="${accent}" stroke-width="1.6"/>`,
      sea: rows(132, 220, 6, 0.8, 0.5) + ln('M0,130 H300', 1.4) +
        [0, 1, 2, 3].map((i) => ln(`M${10 + i * 70},${150 + (i % 2) * 18} q12,-8 24,0 t24,0`, 1.1, 0.7)).join('') +
        ln('M60,70 q8,-8 16,0 q8,-8 16,0 M150,50 q7,-7 14,0 q7,-7 14,0', 1.2) +
        `<circle cx="240" cy="64" r="20" fill="none" stroke="${accent}" stroke-width="1.6"/>` + Array.from({ length: 10 }, (_, i) => ln(`M${240 + Math.cos(i * 0.63) * 25},${64 + Math.sin(i * 0.63) * 25} L${240 + Math.cos(i * 0.63) * 32},${64 + Math.sin(i * 0.63) * 32}`, 0.8, 0.6, accent)).join(''),
      mountain: fill('M0,170 L80,80 L130,130 L190,60 L300,170 L300,220 L0,220 Z') + `<path d="M190,60 L172,84 L182,80 L190,88 L198,80 L208,84 Z" fill="${PAPER}"/>` +
        fill('M0,192 Q150,162 300,192 L300,220 L0,220 Z', 'h2') + `<path d="M0,196 Q150,166 300,196" fill="none" stroke="${accent}" stroke-width="1.4" opacity=".8"/>`,
      volcano: fill('M40,190 L130,80 Q150,66 170,80 L260,190 Z') + ln('M134,90 l10,24 M160,88 l-8,30 M150,80 v28', 0.9, 0.6) +
        [[150, 58, 16], [170, 40, 22], [196, 24, 18]].map(([x, y, rr]) => `<circle cx="${x}" cy="${y}" r="${rr}" fill="${PAPER}" stroke="${INK}" stroke-width="1"/>`).join('') +
        fill('M0,196 Q150,176 300,196 L300,220 L0,220 Z', 'h2') + `<path d="M118,104 Q150,96 182,104" fill="none" stroke="${accent}" stroke-width="1.6"/>`,
      forest: [0, 1, 2, 3, 4, 5].map((i) => fill(`M${10 + i * 50},200 l25,${-90 - (i % 3) * 20} l25,${90 + (i % 3) * 20} Z`, i % 2 ? 'h2' : 'h1')).join('') +
        `<path d="M120,0 L160,0 L110,200 L80,200 Z" fill="#faf0ca" opacity=".55"/>` + ln('M0,200 H300', 1.4) + `<circle cx="260" cy="40" r="10" fill="none" stroke="${accent}" stroke-width="1.4"/>`,
      city: [0, 1, 2, 3, 4, 5, 6].map((i) => {
        const y = 90 + (i * 29) % 50;
        return `<rect x="${i * 44}" y="${y}" width="38" height="140" fill="url(#${id}-${i % 2 ? 'h2' : 'h1'})"/>${ln(`M${i * 44},220 V${y} H${i * 44 + 38} V220`, 1.2)}` +
          [0, 1, 2].map((k) => `<rect x="${i * 44 + 8}" y="${y + 12 + k * 22}" width="8" height="10" fill="${PAPER}" stroke="${INK}" stroke-width=".6"/><rect x="${i * 44 + 22}" y="${y + 12 + k * 22}" width="8" height="10" fill="${PAPER}" stroke="${INK}" stroke-width=".6"/>`).join('');
      }).join('') + [30, 110, 190, 260].map((x) => `<circle cx="${x}" cy="78" r="5" fill="none" stroke="${accent}" stroke-width="1.4"/>`).join(''),
      pottery: fill('M0,160 H300 V220 H0 Z', 'h2', false) + ln('M0,160 H300', 1.3) +
        `<path d="M110,160 Q90,110 120,90 L180,90 Q210,110 190,160 Z" fill="${PAPER}" stroke="${INK}" stroke-width="1.6"/>` + ln('M118,120 Q150,104 182,120 M114,136 Q150,124 186,136', 1.3, 0.8, accent) + `<circle cx="150" cy="135" r="7" fill="none" stroke="${accent}" stroke-width="1.4"/>`,
      shrine: fill('M0,180 L300,180 L300,220 L0,220 Z', 'h2') +
        `<g fill="${PAPER}" stroke="${accent}" stroke-width="1.6"><rect x="95" y="80" width="12" height="100"/><rect x="193" y="80" width="12" height="100"/><path d="M66,68 Q150,56 234,68 L232,80 L68,80 Z"/><rect x="85" y="96" width="130" height="8"/></g>` + ln('M150,82 v14', 1.2, 0.8, accent),
      sunset: `<circle cx="150" cy="140" r="38" fill="none" stroke="${accent}" stroke-width="1.8"/>` + Array.from({ length: 6 }, (_, i) => ln(`M${118 + i * 2},${118 + i * 8} H${182 - i * 2}`, 0.8, 0.5, accent)).join('') +
        fill('M0,150 H300 V220 H0 Z', 'h1', false) + ln('M0,150 H300', 1.4) + ln('M0,162 Q150,148 300,162', 1, 0.6),
      night: `<rect width="300" height="220" fill="url(#${id}-x)"/>` + [0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<circle cx="${20 + i * 37}" cy="${20 + (i * 41) % 70}" r="1.6" fill="${PAPER}"/>`).join('') +
        `<circle cx="240" cy="50" r="16" fill="${PAPER}" stroke="${INK}" stroke-width="1"/>` + `<path d="M0,170 Q150,140 300,170 L300,220 L0,220 Z" fill="${INK}" opacity=".8"/>` +
        [40, 100, 170, 230].map((x) => `<rect x="${x}" y="152" width="9" height="9" fill="${accent}"/>`).join(''),
      food: fill('M0,150 H300 V220 H0 Z', 'h2', false) + ln('M0,150 H300', 1.3) +
        `<ellipse cx="150" cy="150" rx="90" ry="34" fill="${PAPER}" stroke="${INK}" stroke-width="1.5"/><ellipse cx="150" cy="146" rx="70" ry="22" fill="none" stroke="${accent}" stroke-width="1.6"/>` +
        ln('M118,140 q10,-10 20,0 M150,148 q8,-8 16,0 M172,138 q6,-6 12,0', 1.2) + ln('M232,96 L198,150 M246,104 L206,152', 1.3),
      train: ln('M0,176 H300 M0,182 H300', 1.2) + Array.from({ length: 16 }, (_, i) => ln(`M${i * 20 + 4},182 v4`, 1, 0.6)).join('') +
        `<path d="M40,166 V116 Q40,108 50,108 H232 Q244,108 244,120 V166 Z" fill="${PAPER}" stroke="${INK}" stroke-width="1.6"/>` +
        `<path d="M40,150 H244" stroke="${accent}" stroke-width="3"/><path d="M40,155 H244" stroke="${accent}" stroke-width="1"/>` +
        [58, 102, 146, 190].map((x) => `<rect x="${x}" y="120" width="32" height="20" fill="none" stroke="${INK}" stroke-width="1.2"/>`).join('') +
        [80, 200].map((x) => `<circle cx="${x}" cy="170" r="8" fill="${PAPER}" stroke="${INK}" stroke-width="1.4"/><circle cx="${x}" cy="170" r="2" fill="${INK}"/>`).join(''),
    };
    return `<svg viewBox="0 0 300 220" preserveAspectRatio="xMidYMid slice" class="pol-illust" aria-hidden="true">
        <defs>${defs}</defs>
        <rect width="300" height="220" fill="${PAPER}"/><rect width="300" height="120" fill="url(#${id}-sky)"/>${parts[scene] || parts.train}
        <circle cx="${(30 + r(1) * 240).toFixed(0)}" cy="${(20 + r(2) * 30).toFixed(0)}" r="1.2" fill="${INK}" opacity=".4"/>
      </svg>`;
  }
  // 風景印（駅名と日付の丸い消印）：二重の輪・日付の刻印・少し傾けて押した朱肉のかすれ
  function stampSvg(s, date) {
    const color = (D.meta.prefectures[s.prefecture] || {}).color || '#a8382b';
    const fid = `pol-ink-${s.id}-${hash(date + s.id) % 997}`;
    return `<svg viewBox="0 0 80 80" class="pol-stamp-svg" aria-hidden="true">
        <defs>${YT.Receipts.inkFilter(fid, hash(s.id) % 11)}</defs>
        <g filter="url(#${fid})" transform="rotate(-6 40 40)">
          <circle cx="40" cy="40" r="35" fill="none" stroke="${color}" stroke-width="2.2"/>
          <circle cx="40" cy="40" r="30" fill="none" stroke="${color}" stroke-width=".9" stroke-dasharray="2 1.6"/>
          <text x="40" y="37" text-anchor="middle" font-size="${s.name.length > 4 ? 10 : 13}" font-weight="700" fill="${color}" font-family="Shippori Mincho, serif">${esc(s.name)}</text>
          <path d="M16,42 H64" stroke="${color}" stroke-width=".9"/>
          <text x="40" y="53" text-anchor="middle" font-size="9" font-weight="600" fill="${color}" font-family="Cormorant Garamond, serif" letter-spacing=".08em">${esc(date)}</text>
          <path d="M14,60 Q40,70 66,60" fill="none" stroke="${color}" stroke-width="1.1"/>
        </g>
      </svg>`;
  }

  // ---------- ポラロイド風ポストカード ----------
  // card = { kind: 'seed'|'mine', stationId, memo, date, byName, avatar, likes, liked?, imageId?, scene?, id, locked? }
  function polaroid(card, size = '') {
    const s = D.byId[card.stationId];
    const color = (D.meta.prefectures[s.prefecture] || {}).color;
    const tilt = ((hash(card.id) % 7) - 3) * 0.6;
    const photo = card.imageId
      ? `<img alt="${esc(s.name)}駅の写真" data-pc-img="${esc(card.imageId)}">`
      : illust(card.scene || 'train', color, card.id.replace(/[^a-z0-9-]/gi, ''));
    const av = card.avatar ? YT.Craft.avatarSvg(card.avatar, { crop: true, id: `pa-${card.id}` }) : '';
    return `<figure class="polaroid ${size ? `pol-${size}` : ''} ${card.locked ? 'is-locked' : ''}" style="--pref:${color};--tilt:${tilt.toFixed(1)}deg" data-pc="${esc(card.id)}">
        <div class="pol-photo">${photo}
          ${card.locked ? `<span class="pol-lock">${I('lock')} ${esc(s.name)}駅に停車すると閲覧できます</span>` : ''}
        </div>
        <figcaption class="pol-cap">
          <span class="pol-stamp">${stampSvg(s, card.date)}</span>
          <p class="pol-memo">${card.locked ? '…' : esc(card.memo || '')}</p>
          <p class="pol-by"><span class="pol-av">${av}</span>${esc(card.byName)}<span class="pol-station">${esc(s.name)}駅</span></p>
        </figcaption>
        ${
          card.kind === 'seed'
            ? `<button class="pol-like ${card.liked ? 'is-on' : ''}" data-like="${esc(card.id)}" ${card.locked || card.liked ? 'disabled' : ''} aria-label="素敵ね（いいね）">${I('heart')} <b>${card.likes}</b>${card.liked ? '<small>素敵ね済み</small>' : card.locked ? '' : '<small>素敵ね</small>'}</button>`
            : `<span class="pol-like is-mine">${I('heart')} <b>${card.likes}</b><small>いいね・${api.yen(card.likes * C().likeReceivedBonus)}</small></span>`
        }
      </figure>`;
  }
  const seedCard = (p) => {
    const r = rival(p.rivalId);
    return { kind: 'seed', id: p.id, stationId: p.stationId, memo: p.comment, scene: p.scene, date: '2026.10', byName: r.name, avatar: r.avatar, likes: seedLikes(p), liked: YT.Store.hasLiked(p.id), locked: !unlocked(p.stationId) };
  };
  const mineCard = (stationId, c) => ({ kind: 'mine', id: c.id, stationId, memo: c.memo, imageId: c.imageId, date: api.fmtDate(c.at), byName: YT.Ownership.youName(), avatar: { ...YT.Store.get().equipped }, likes: likesOf(c) });

  // 写真の差し込み（IndexedDB の画像は、描いたあとで URL を入れる）
  function loadImages(r = root) {
    r.querySelectorAll('img[data-pc-img]').forEach((img) => {
      YT.Receipts.thumbUrl(img.dataset.pcImg).then((u) => {
        if (u) img.src = u;
      });
    });
    r.querySelectorAll('image[data-pc-img]').forEach((img) => {
      YT.Receipts.thumbUrl(img.dataset.pcImg).then((u) => u && img.setAttribute('href', u));
    });
  }

  // ---------- 画面 ----------
  let form = { stationId: null, file: null, url: null, memo: '' };
  let filter = 'all';

  function stationOptions(sel) {
    const byPref = {};
    D.stations.forEach((s) => (byPref[s.prefecture] ||= []).push(s));
    return Object.entries(byPref)
      .map(([pref, list]) => `<optgroup label="${esc(pref)}">${list.map((s) => `<option value="${esc(s.id)}" ${s.id === sel ? 'selected' : ''}>${esc(s.name)}駅${mine()[s.id] ? '（投函済み）' : ''}</option>`).join('')}</optgroup>`)
      .join('');
  }

  function formHtml() {
    const sid = form.stationId || YT.Store.get().currentStationId;
    const s = D.byId[sid];
    const has = !!mine()[sid];
    const preview = {
      kind: 'mine', id: 'preview', stationId: sid, memo: form.memo || 'ひとことを書いてみましょう', date: api.fmtDate(new Date().toISOString()),
      byName: YT.Ownership.youName(), avatar: { ...YT.Store.get().equipped }, likes: 0,
    };
    return `<section class="panel lt-post">
        <h2 class="lt-title"><span class="eyebrow"><i>No. 04</i>Post a Letter</span>旅の便りを投函する</h2>
        <p class="lt-lead">駅を選んで、写真と一言を送ると、風景印つきのポラロイドになります。いまその駅にいなくても投函できます。${has ? '' : `最初の1枚で<b>地域発信ボーナス +${api.yen(C().postBonus)}</b>。`}</p>
        <div class="lt-form">
          <div class="lt-fields">
            <label class="lt-label">駅<select data-pc-station>${stationOptions(sid)}</select></label>
            <label class="lt-drop ${form.url ? 'has-photo' : ''}">
              <input type="file" accept="image/*" data-pc-file hidden>
              <span>${I('camera')} ${form.url ? '写真を選び直す' : '写真を選ぶ（ドラッグ＆ドロップもできます）'}</span>
            </label>
            <label class="lt-label">ひとこと<span class="lt-count" data-pc-count>${[...form.memo].length}/60</span>
              <textarea data-pc-memo maxlength="60" rows="2" placeholder="湯けむりの向こうに、夕焼けが…">${esc(form.memo)}</textarea></label>
            <button class="primary-btn" data-pc-submit ${form.file ? '' : 'disabled'}>${has ? `${I('refresh')} ${esc(s.name)}駅のポストカードを差し替える` : `${I('postcard')} ${esc(s.name)}駅に投函する（+${api.yen(C().postBonus)}）`}</button>
            <p class="lt-note">※写真はこの端末の中だけに保存されます（どこにも送信されません）。1駅に1枚で、投函し直すと差し替えになります。人の顔や住所が写った写真は避けましょう。</p>
          </div>
          <div class="lt-preview">${polaroidPreview(preview)}</div>
        </div>
      </section>`;
  }
  function polaroidPreview(card) {
    const html = polaroid(card, 'preview');
    return form.url ? html.replace(/<div class="pol-photo">[\s\S]*?<\/div>/, `<div class="pol-photo"><img alt="選んだ写真" src="${form.url}"></div>`) : html.replace(/<div class="pol-photo">[\s\S]*?<\/div>/, `<div class="pol-photo pol-empty"><span>${I('camera')}</span></div>`);
  }

  // わたしの九州フォトマップ：盤面と同じ地図（js/geo.js）を淡く描き、投函した駅にポラロイドのピンを浮かべる
  function photoMapSvg() {
    const G = window.YOKATABI_GEO;
    const vb = '100 -60 620 1020'; // 九州のまわりだけ（左右の海を切る。北の駅のピンが上で切れないよう、上に海を少し足す）
    const st = YT.Store.get();
    const own = mine();
    const routes = G ? Object.values(G.routes).map((d) => `<path d="${d}" class="pm-route"/>`).join('') : '';
    const dots = D.stations
      .map((s) => `<g class="pm-st ${st.visited[s.id] ? 'is-visited' : ''} ${st.acquired[s.id] ? 'is-owned' : ''}" transform="translate(${s.x} ${s.y})" data-pm-station="${esc(s.id)}">
          <circle r="5.5"/>${st.acquired[s.id] ? '<path d="M-6,-9 L-3,-15 L0,-10 L3,-15 L6,-9 Z" class="pm-crown"/>' : ''}
        </g>`)
      .join('');
    return `<svg viewBox="${vb}" class="pm-svg" role="group" aria-label="わたしの九州フォトマップ">
        <rect x="-800" y="-960" width="2400" height="2880" class="pm-sea"/>
        ${G ? `<path d="${G.land.join('')}" class="pm-land"/>${G.borders.map((d) => `<path d="${d}" class="pm-border"/>`).join('')}` : ''}
        ${routes}${dots}<g class="pm-ripples"></g><g class="pm-pins"></g>
      </svg>`;
  }

  // ---------- フォトマップのカメラと、写真ピンの束ね表示 ----------
  // 全体を見ているとき、画面の上で近い（約56px以内）ピンは「×3枚の思い出」の束にまとめる。
  // 束をタップすると、その駅たちが収まるまで寄って、1枚ずつのピンにほどける。いちばん寄ったら（4倍）束ねない
  let pmCam = null; // { cx, cy, z }（描き直してもカメラの位置を残す）
  let pmCamera = null;
  let pmKey = '';
  const PM_BASE = { x: 100, y: -60, w: 620, h: 1020 }; // photoMapSvg の viewBox と同じ
  function pinHtml(id, c, i, s) {
    const st = D.byId[id];
    return `<g class="pm-pin" transform="translate(${st.x} ${st.y}) scale(${s.toFixed(3)})" data-pm-open="${esc(id)}" tabindex="0" role="button" aria-label="${esc(st.name)}駅のポストカード">
        <g class="pm-float" style="--i:${i % 5}">
          <line x1="0" y1="0" x2="0" y2="-26" class="pm-stem"/>
          <g transform="translate(-22 -78) rotate(${((hash(c.id) % 9) - 4).toFixed(0)} 22 26)">
            <rect width="44" height="52" rx="2" class="pm-frame"/>
            <image x="4" y="4" width="36" height="34" preserveAspectRatio="xMidYMid slice" data-pc-img="${esc(c.imageId)}"/>
            <text x="22" y="48" text-anchor="middle" class="pm-name">${esc(st.name)}</text>
          </g>
        </g>
      </g>`;
  }
  function bundleHtml(group, s) {
    const cx = group.reduce((n, g) => n + D.byId[g.id].x, 0) / group.length;
    const cy = group.reduce((n, g) => n + D.byId[g.id].y, 0) / group.length;
    const top = group[0];
    const frames = [[-9, -6], [7, 4], [0, 0]]
      .map(([rot, dx], k) => `<g transform="translate(${-22 + dx} -80) rotate(${rot} 22 26)"><rect width="44" height="52" rx="2" class="pm-frame"/>${k === 2 ? `<image x="4" y="4" width="36" height="34" preserveAspectRatio="xMidYMid slice" data-pc-img="${esc(top.c.imageId)}"/>` : '<rect x="4" y="4" width="36" height="34" class="pm-frame-blank"/>'}</g>`)
      .join('');
    return `<g class="pm-bundle" transform="translate(${cx.toFixed(1)} ${cy.toFixed(1)}) scale(${s.toFixed(3)})" data-pm-cluster="${esc(group.map((g) => g.id).join(','))}" tabindex="0" role="button" aria-label="${group.length}枚の思い出（${esc(group.map((g) => D.byId[g.id].name).join('・'))}駅）。タップで広げる">
        <g class="pm-float"><line x1="0" y1="0" x2="0" y2="-26" class="pm-stem"/>${frames}
          <g transform="translate(0 -16)"><rect x="-54" y="-12" width="108" height="24" rx="12" class="pm-bundle-pill"/><g transform="translate(-47 -7) scale(.58)" class="pm-bundle-ico">${YT.Icon.paths('camera').map((d) => (d[0] === '.' ? `<path d="${d.slice(1)}" class="f"/>` : `<path d="${d}"/>`)).join('')}</g><text x="7" y="4.6" text-anchor="middle" class="pm-bundle-text">×${group.length}枚の思い出</text></g>
        </g>
      </g>`;
  }
  function clusterPins() {
    const svg = root && root.querySelector('.pm-svg');
    const layer = svg && svg.querySelector('.pm-pins');
    if (!layer || !pmCamera) return;
    const cam = pmCamera.get();
    const s = Math.pow(cam.z, -0.78);
    svg.style.setProperty('--lw', Math.pow(cam.z, -0.6).toFixed(3));
    svg.querySelectorAll('.pm-st').forEach((g) => {
      const st = D.byId[g.dataset.pmStation];
      g.setAttribute('transform', `translate(${st.x} ${st.y}) scale(${s.toFixed(3)})`);
    });
    const items = Object.entries(mine()).map(([id, c]) => ({ id, c }));
    const pxPerUnit = (svg.clientWidth || 1) / (PM_BASE.w / cam.z);
    const thr = cam.z >= 3.9 ? 0 : 56 / pxPerUnit; // 画面で56pxより近いピンは束ねる
    const groups = [];
    const used = new Set();
    items.forEach((a) => {
      if (used.has(a.id)) return;
      const A = D.byId[a.id];
      const g = items.filter((b) => !used.has(b.id) && Math.hypot(D.byId[b.id].x - A.x, D.byId[b.id].y - A.y) <= thr);
      g.forEach((b) => used.add(b.id));
      groups.push(g.length ? g : [a]);
    });
    // ピンと束は、地図の幅が狭くても画面で約40pxの大きさを保つ（×1で盤面1単位が1pxに満たないときだけ大きくする）
    const boost = Math.min(1.8, Math.max(1, 0.9 / ((svg.clientWidth || PM_BASE.w) / PM_BASE.w)));
    const ps = s * boost;
    const key = `${groups.map((g) => g.map((x) => x.id).join('+')).join('|')}@${ps.toFixed(2)}`;
    if (key === pmKey) return;
    pmKey = key;
    layer.innerHTML = groups.map((g, i) => (g.length > 1 ? bundleHtml(g, ps) : pinHtml(g[0].id, g[0].c, i, ps))).join('');
    loadImages(layer);
  }
  function mountPhotoCamera() {
    const svg = root.querySelector('.pm-svg');
    if (!svg) return;
    pmKey = '';
    pmCamera = YT.Camera.create(svg, {
      base: () => ({ ...PM_BASE }),
      min: 1,
      max: 4,
      onChange: (cam, final) => {
        pmCam = { ...cam };
        if (final) clusterPins();
      },
    });
    if (pmCam) pmCamera.set(pmCam, 0);
    clusterPins();
  }
  // 束をタップ：その駅たちがちょうど収まるところまで寄る（寄ると、ピンがほどける）
  function openBundle(ids) {
    const pts = ids.map((id) => D.byId[id]);
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    const box = { x: Math.min(...xs), y: Math.min(...ys) - 40, w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) + 40 };
    YT.Sound.click();
    const fit = pmCamera.fit(box, { pad: 30 });
    // いちばん近い2駅のあいだが画面で56pxを超える倍率まで寄せて、1回のタップで全部ほどく（4倍でも足りないときは束ねない設定になる）
    let dMin = Infinity;
    pts.forEach((a, i) => pts.slice(i + 1).forEach((b) => (dMin = Math.min(dMin, Math.hypot(a.x - b.x, a.y - b.y)))));
    const svg = root.querySelector('.pm-svg');
    const unitPx = (svg && svg.clientWidth ? svg.clientWidth : 1) / PM_BASE.w;
    const zNeed = dMin > 0 ? (60 / (dMin * unitPx)) : 4;
    pmCamera.set({ ...fit, z: Math.min(4, Math.max(fit.z, zNeed * 1.05, pmCamera.get().z * 1.4)) }, 650);
  }

  function render() {
    if (!root) return;
    const own = Object.entries(mine());
    const e = earnings();
    const list = seeds().map(seedCard);
    const shown = list.filter((c) => (filter === 'open' ? !c.locked : filter === 'locked' ? c.locked : true)).sort((a, b) => a.locked - b.locked);
    const totalLikes = own.reduce((n, [, c]) => n + likesOf(c), 0);
    root.innerHTML = `
      ${formHtml()}
      <section class="panel lt-map">
        <div class="lt-map-head">
          <div>
            <h2 class="lt-title"><span class="eyebrow"><i>No. 04</i>My Photo Atlas</span>わたしの九州フォトマップ</h2>
            <p class="lt-lead">投函した駅に、写真のピンが浮かびます。ピンか下のカードをタップすると、その駅が光ります。</p>
          </div>
          <button class="share-card-btn" data-sharecard>${I('camera')} 手帖カードをシェア</button>
        </div>
        <dl class="lt-nums">
          <div><dt>投函した駅</dt><dd>${own.length}<small> / ${D.stations.length}駅</small></dd></div>
          <div><dt>届いたいいね</dt><dd>${I('heart')} ${totalLikes}</dd></div>
          <div><dt>旅の便りの収益</dt><dd>${api.yen(e.post + e.given + e.received)}</dd></div>
        </dl>
        <div class="lt-map-body">
          <div class="pm-wrap">${photoMapSvg()}
            <div class="cam-ctrl pm-cam"><button class="cam-btn" data-pm-cam="all" title="九州全体を一望">${I('kyushu')}<span class="cam-text">全体</span></button>
              <span class="cam-zoom-row"><button class="cam-btn cam-sq" data-pm-cam="out" aria-label="縮小">${I('minus')}</button><button class="cam-btn cam-sq" data-pm-cam="in" aria-label="拡大">${I('plus')}</button></span></div>
          </div>
          ${own.length ? `<div class="lt-mine">${own.map(([id, c]) => `<button class="lt-mine-card" data-pm-open="${esc(id)}">${polaroid(mineCard(id, c), 'mini')}</button>`).join('')}</div>` : '<p class="lt-empty">まだ投函したポストカードはありません。上のフォームから、旅の一枚を送ってみましょう。投函した駅には、地図の上に写真のピンが浮かびます。</p>'}
        </div>
      </section>
      <section class="panel lt-board">
        <div class="lt-map-head">
          <div>
            <h2 class="lt-title"><span class="eyebrow"><i>No. 04</i>Letters from Travellers</span>旅人たちのポストカード</h2>
            <p class="lt-lead">ダイスでその駅に止まったことがあると、写真がくっきり見えて「素敵ね」を押せます（応援ボーナス +${api.yen(C().likeGivenBonus)}）。</p>
          </div>
          <div class="seg seg-sm" role="tablist" aria-label="ポストカードの絞り込み">
            ${[['all', 'すべて'], ['open', '見られる'], ['locked', 'まだ']].map(([k, l]) => `<button class="seg-btn ${filter === k ? 'is-active' : ''}" data-pc-filter="${k}">${l}</button>`).join('')}
          </div>
        </div>
        <div class="lt-grid">${shown.map((c) => polaroid(c)).join('') || '<p class="lt-empty">ここに出せるポストカードはまだありません。</p>'}</div>
        <p class="lt-note">※ほかの旅人のポストカードは、ゲームの中の架空の旅人が送ったもので、絵はイラストです。</p>
      </section>`;
    loadImages();
    mountPhotoCamera();
  }

  // 寄り道手帖の中の「現地スナップ」（その駅の旅人たちのポストカードと、自分の1枚）
  function stationSnapsHtml(id) {
    const list = seeds().filter((p) => p.stationId === id).map(seedCard);
    const c = mine()[id];
    if (!list.length && !c) return '';
    return `<section class="modal-sec">
        <h3 class="sec-title">${I('camera')}現地スナップ <em>${unlocked(id) ? '旅人たちの便り' : '停車すると解放'}</em></h3>
        <div class="snaps">${c ? polaroid(mineCard(id, c), 'mini') : ''}${list.map((x) => polaroid(x, 'mini')).join('')}</div>
        <p class="snaps-foot"><button class="link-btn" data-letters-post="${esc(id)}">${I('postcard')} この駅に旅の便りを投函する</button></p>
      </section>`;
  }

  // 拡大ポストカード（フォトマップのピン・カードから）
  function openViewer(id) {
    const c = mine()[id];
    if (!c) return;
    const s = D.byId[id];
    const n = likesOf(c);
    const v = $('#pc-viewer');
    v.innerHTML = `<div class="pcv-box" role="dialog" aria-modal="true" aria-label="${esc(s.name)}駅のポストカード">
        <button class="modal-close" data-pcv-close aria-label="閉じる">×</button>
        ${polaroid(mineCard(id, c), 'big')}
        <div class="pcv-stats">
          <p><b>${I('heart')} ${n}</b> いいね <span class="pcv-earn">クリエイター評価配当 ${api.yen(n * C().likeReceivedBonus)}</span></p>
          <p class="pcv-likers">配当は、ダイス7回ごとの「週末の大精算まつり」でまとめて振り込まれます</p>
          <p class="pcv-likers">${likersOf(c, Math.min(n, 5)).map((r) => esc(r.name)).join('・')}${n > 5 ? ` ほか${n - 5}人` : ''}がいいねしました</p>
          <p class="pcv-actions"><button class="ghost-btn" data-letters-post="${esc(id)}">${I('refresh')} 写真を差し替える</button><button class="ghost-btn" data-pcv-close>閉じる</button></p>
        </div>
      </div>`;
    v.hidden = false;
    requestAnimationFrame(() => v.classList.add('is-open'));
    loadImages(v);
    setTimeout(() => $('[data-pcv-close]', v).focus({ preventScroll: true }), 50);
  }
  function closeViewer() {
    const v = $('#pc-viewer');
    if (v.hidden) return false;
    v.classList.remove('is-open');
    setTimeout(() => (v.hidden = true), 200);
    return true;
  }
  // フォトマップの駅に金の波紋
  function ripple(id) {
    const g = root.querySelector('.pm-ripples');
    if (!g) return;
    const s = D.byId[id];
    [0, 1, 2].forEach((i) => {
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('cx', s.x);
      c.setAttribute('cy', s.y);
      c.setAttribute('r', 8);
      c.setAttribute('class', 'pm-ripple');
      c.style.setProperty('--i', i);
      g.appendChild(c);
      setTimeout(() => c.remove(), 1800);
    });
    root.querySelectorAll('.pm-pin').forEach((p) => p.classList.toggle('is-hl', p.dataset.pmOpen === id));
  }

  // 「素敵ね」：ハートが舞って、応援ボーナス
  function like(cardId, btn) {
    if (!YT.Store.like(cardId)) return;
    YT.Sound.coin();
    hearts(btn);
    api.toast(`素敵ね！ 応援ボーナス +${api.yen(C().likeGivenBonus)}（クラフト資金）`, 'toast-gold', 'heart');
    setTimeout(() => {
      api.renderAll();
      render();
      api.refreshModal && api.refreshModal(YT.Store.get().currentStationId);
    }, 650);
  }
  function hearts(btn) {
    if (!btn || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const r = btn.getBoundingClientRect();
    for (let i = 0; i < 10; i++) {
      const h = document.createElement('span');
      h.className = 'heart-fx';
      h.innerHTML = I('heart');
      h.style.left = `${r.left + r.width / 2}px`;
      h.style.top = `${r.top}px`;
      h.style.setProperty('--dx', `${(Math.random() - 0.5) * 120}px`);
      h.style.setProperty('--dy', `${-50 - Math.random() * 90}px`);
      h.style.setProperty('--d', `${i * 40}ms`);
      document.body.appendChild(h);
      setTimeout(() => h.remove(), 1400);
    }
  }

  // 写真を投函用に整える（長い辺 1000px の JPEG）
  async function prepare(file) {
    const { img, url } = await YT.Receipts.loadImage(file);
    const k = Math.min(1, 1000 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k);
    c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(url);
    return new Promise((resolve) => c.toBlob((b) => resolve(b), 'image/jpeg', 0.85));
  }
  async function submit() {
    if (!form.file) return;
    const sid = form.stationId || YT.Store.get().currentStationId;
    const blob = await prepare(form.file).catch(() => null);
    if (!blob) return api.toast('写真を読み込めませんでした。別の画像でお試しください');
    const imageId = `pcimg-${Date.now().toString(36)}`;
    await YT.Receipts.put(imageId, blob);
    const { first, oldImageId } = YT.Store.putPostcard(sid, { memo: form.memo.trim(), imageId });
    if (oldImageId) YT.Receipts.del(oldImageId); // 差し替えた古い写真は消す
    if (form.url) URL.revokeObjectURL(form.url);
    form = { stationId: sid, file: null, url: null, memo: '' };
    const s = D.byId[sid];
    if (first) {
      YT.Sound.fanfare();
      api.toast(`${s.name}駅に旅の便りを投函しました！ 地域発信ボーナス +${api.yen(C().postBonus)}（クラフト資金）`, 'toast-gold');
    } else {
      YT.Sound.stamp();
      api.toast(`${s.name}駅のポストカードを差し替えました（いいねはそのまま）`);
    }
    api.renderAll();
    render();
    setTimeout(() => {
      root.querySelector('.lt-map').scrollIntoView({ block: 'start', behavior: 'smooth' });
      ripple(sid);
    }, 200);
  }

  // 自分のポストカードに新しく届いたいいねを、ひらいたときにお知らせ
  function announceLikes() {
    const own = mine();
    let fresh = 0;
    for (const [id, c] of Object.entries(own)) {
      const n = likesOf(c);
      if (n > (c.seenLikes || 0)) {
        fresh += n - (c.seenLikes || 0);
        YT.Store.markPostcardSeen(id, n);
      }
    }
    if (fresh) setTimeout(() => api.toast(`あなたのポストカードに、旅人たちから${fresh}つのいいね！ クリエイター評価配当 ${api.yen(fresh * C().likeReceivedBonus)}は、次の週末の大精算で振り込まれます`, 'toast-gold'), 900);
  }

  function onClick(e) {
    const lk = e.target.closest('[data-like]');
    if (lk && !lk.disabled) {
      like(lk.dataset.like, lk);
      return true;
    }
    const bd = e.target.closest('[data-pm-cluster]');
    if (bd && root.contains(bd)) {
      openBundle(bd.dataset.pmCluster.split(','));
      return true;
    }
    const pc = e.target.closest('[data-pm-cam]');
    if (pc && pmCamera) {
      const c = pmCamera.get();
      if (pc.dataset.pmCam === 'all') pmCamera.set({ cx: PM_BASE.x + PM_BASE.w / 2, cy: PM_BASE.y + PM_BASE.h / 2, z: 1 }, 600);
      else pmCamera.set({ z: c.z * (pc.dataset.pmCam === 'in' ? 1.6 : 1 / 1.6) }, 300);
      return true;
    }
    const op = e.target.closest('[data-pm-open]');
    if (op && root.contains(op)) {
      ripple(op.dataset.pmOpen);
      YT.Sound.click();
      setTimeout(() => openViewer(op.dataset.pmOpen), 380);
      return true;
    }
    const post = e.target.closest('[data-letters-post]');
    if (post) {
      form.stationId = post.dataset.lettersPost;
      closeViewer();
      api.closeModal();
      api.showView('letters');
      setTimeout(() => root.querySelector('.lt-post').scrollIntoView({ block: 'start', behavior: 'smooth' }), 60);
      return true;
    }
    if (e.target.closest('[data-pcv-close]') || e.target.id === 'pc-viewer') return closeViewer();
    const f = e.target.closest('[data-pc-filter]');
    if (f) {
      filter = f.dataset.pcFilter;
      render();
      return true;
    }
    if (e.target.closest('[data-pc-submit]')) {
      submit();
      return true;
    }
    return false;
  }

  function setFile(file) {
    if (!file || !/^image\//.test(file.type)) return api.toast('画像のファイルを選んでください');
    if (form.url) URL.revokeObjectURL(form.url);
    form.file = file;
    form.url = URL.createObjectURL(file);
    render();
  }

  YT.Postcards = {
    init(data, a, el) {
      D = data;
      api = a;
      root = el;
      document.addEventListener('click', onClick);
      root.addEventListener('change', (e) => {
        if (e.target.matches('[data-pc-station]')) {
          form.stationId = e.target.value;
          render();
        }
        if (e.target.matches('[data-pc-file]')) setFile(e.target.files[0]);
      });
      root.addEventListener('input', (e) => {
        if (!e.target.matches('[data-pc-memo]')) return;
        form.memo = [...e.target.value].slice(0, 60).join('');
        const cnt = root.querySelector('[data-pc-count]');
        if (cnt) cnt.textContent = `${[...form.memo].length}/60`;
        const memo = root.querySelector('.lt-preview .pol-memo');
        if (memo) memo.textContent = form.memo || 'ひとことを書いてみましょう';
      });
      root.addEventListener('dragover', (e) => {
        if (e.target.closest('.lt-drop')) e.preventDefault();
      });
      root.addEventListener('drop', (e) => {
        if (!e.target.closest('.lt-drop')) return;
        e.preventDefault();
        setFile(e.dataTransfer.files[0]);
      });
      root.addEventListener('keydown', (e) => {
        const p = e.target.closest('.pm-pin, .pm-bundle');
        if (p && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          p.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        }
      });
      announceLikes();
      setInterval(() => {
        if (!document.hidden) announceLikes();
      }, 60000);
    },
    render,
    earnings,
    likesOf,
    totalLikes,
    stationSnapsHtml,
    loadImages,
    closeViewer,
    illust,
    seeds,
    unlocked,
  };
})();
