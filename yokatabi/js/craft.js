// 鉄道クラフト工房と旅人アバター：パーツの一覧（stations.json の meta.craft）・クラフト資金・SVG の絵。
// 列車もアバターも、絵文字や画像ではなくこのファイルの SVG で描く（マップの列車トークン・ガレージ・ヘッダー・証明カードで共用）。
// 実在の列車の名前・ロゴ・紋章は使わない。色づかいだけを九州の観光列車の雰囲気から借り、形と紋章はオリジナル。
(function () {
  'use strict';
  const YT = (window.YT = window.YT || {});
  let D = null;

  // ---------- パーツと資金 ----------
  const slots = () => [...D.meta.craft.train, ...D.meta.craft.avatar];
  const slotDef = (slot) => slots().find((s) => s.slot === slot);
  const item = (slot, id) => (slotDef(slot).items.find((i) => i.id === id) || slotDef(slot).items[0]);
  const isFree = (slot, id) => item(slot, id).price === 0;
  const owns = (slot, id) => isFree(slot, id) || YT.Store.isOwned(slot, id);

  // 稼いだ額（残高はそこから使った額を引く。保存せず毎回数える）
  //   初到着ごとの発見ボーナス ＋ オーナー・共同株主の配当（js/ownership.js）
  //   ＋ 旅の便りの投函・いいね（js/postcards.js）＋ シェアカードの発信ボーナス（js/sharecard.js）
  function breakdown() {
    const st = YT.Store.get();
    const visited = D.stations.filter((s) => st.visited[s.id]).length;
    const pc = YT.Postcards ? YT.Postcards.earnings() : { post: 0, given: 0, received: 0 };
    return {
      discovery: visited * D.meta.craft.discoveryBonus,
      dividends: YT.Ownership.totalDividends(),
      post: pc.post,
      likesGiven: pc.given,
      likesReceived: pc.received,
      share: (st.shareDays || []).length * D.meta.craft.shareBonus,
      // 旅のゲーム：スポットライト駅のご祝儀・サプライズ／ハプニング・週末の大精算の観光収益（js/game.js）
      rewards: (st.ledger || []).filter((e) => e.kind !== 'settle').reduce((n, e) => n + e.amount, 0),
      settle: (st.ledger || []).filter((e) => e.kind === 'settle').reduce((n, e) => n + e.amount, 0),
    };
  }
  const earned = () => Object.values(breakdown()).reduce((a, b) => a + b, 0);
  const balance = () => Math.max(0, earned() - YT.Store.get().spent);

  // よりみち切符：高級車両・連結車両（ticket: true）を1つでもアンロックすると、1日 ticketMax（3）回まで使える
  function ticketsPerDay() {
    const has = D.meta.craft.train.some((s) => s.items.some((i) => i.ticket && YT.Store.isOwned(s.slot, i.id)));
    return has ? D.meta.craft.ticketMax : 0;
  }
  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const ticketsLeft = () => Math.max(0, ticketsPerDay() - YT.Store.ticketsUsed(today()));

  // アンロック：残高が足りれば買って装備する。{ ok, reason }
  function buy(slot, id) {
    const it = item(slot, id);
    if (owns(slot, id)) return { ok: false, reason: 'owned' };
    if (balance() < it.price) return { ok: false, reason: 'short', short: it.price - balance() };
    const before = ticketsPerDay();
    YT.Store.unlock(slot, id, it.price);
    YT.Store.equip(slot, id);
    return { ok: true, ticketUp: ticketsPerDay() > before };
  }
  const equipped = () => YT.Store.get().equipped;

  // ---------- 列車の絵（横から見た姿・右向き） ----------
  // 1両は x −60〜60、y −46〜0（0 がレールの高さ）。マップでは縮めて、線路の向きに回して使う。
  const LIVERY = {
    hidamari: { body: '#d96b43', upper: '#faf0e0', line: '#d49a35', win: '#3d4c52', roof: '#9a8574', trim: '#b5482a' },
    forest: { body: '#1e4d3b', upper: '#1e4d3b', line: '#d4a84b', win: '#2c3d37', roof: '#15382b', trim: '#e7c873' },
    gullwing: { body: '#f7f4ee', upper: '#f7f4ee', line: '#c2352b', win: '#2e3a40', roof: '#d9d3ca', trim: '#c2352b' },
    caldera: { body: '#221e1b', upper: '#221e1b', line: '#c9a14a', win: '#f2d58a', roof: '#151210', trim: '#c9a14a' },
    patisserie: { body: '#b8913e', upper: '#2a221b', line: '#f1dca0', win: '#3a2a1e', roof: '#2a211a', trim: '#f1dca0' },
    royal: { body: '#4a1525', upper: '#4a1525', line: '#d4a84b', win: '#2a1a14', roof: '#2e0d17', trim: '#e2c06a' },
  };
  const pal = (id) => LIVERY[id] || LIVERY.hidamari;

  function bogies(x1 = -36, x2 = 36) {
    const wheel = (x) => `<circle cx="${x}" cy="-5" r="5" fill="#2b2622"/><circle cx="${x}" cy="-5" r="1.8" fill="#c9a14a"/>`;
    return `<g class="tr-bogie">
      <rect x="${x1 - 13}" y="-12" width="26" height="5" rx="2" fill="#3a322b"/>${wheel(x1 - 7)}${wheel(x1 + 7)}
      <rect x="${x2 - 13}" y="-12" width="26" height="5" rx="2" fill="#3a322b"/>${wheel(x2 - 7)}${wheel(x2 + 7)}
    </g>`;
  }
  const windows = (xs, y, w, h, fill, r = 2.5) =>
    xs.map((x) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"/><rect x="${x + 1.2}" y="${y + 1.2}" width="${w * 0.35}" height="${h - 2.4}" rx="1" fill="#fff" opacity=".18"/>`).join('');

  // 1両目（先頭車）
  function frontCar(id) {
    const p = pal(id);
    if (id === 'caldera') return steamLoco(p);
    if (id === 'gullwing') {
      return `${bogies(-34, 30)}
        <path d="M-58,-12 L-58,-38 Q-58,-42 -54,-42 L20,-42 Q44,-42 58,-20 Q61,-14 56,-12 Z" fill="${p.body}" stroke="#cfc8bd" stroke-width=".8"/>
        <path d="M-58,-17 L52,-17 Q57,-15 56,-12 L-58,-12 Z" fill="${p.line}"/>
        <path d="M24,-40 Q42,-38 52,-24 L36,-24 Q30,-34 22,-36 Z" fill="${p.win}"/>
        <rect x="-52" y="-33" width="70" height="9" rx="3" fill="${p.win}"/>
        <path d="M-52,-21 L-20,-21 Q0,-22 18,-27 L18,-24 Q0,-19 -20,-19 L-52,-19 Z" fill="${p.line}" opacity=".9"/>
        <circle cx="53" cy="-16" r="1.8" fill="#fff3c4"/>
        <rect x="-40" y="-46" width="22" height="4" rx="2" fill="${p.roof}"/>`;
    }
    if (id === 'forest') {
      return `${bogies()}
        <path d="M-58,-12 L-58,-40 Q-58,-44 -54,-44 L36,-44 Q50,-44 56,-30 L58,-16 Q58,-12 54,-12 Z" fill="${p.body}"/>
        <rect x="-58" y="-22" width="113" height="3" fill="${p.line}"/>
        <rect x="-58" y="-15" width="114" height="1.4" fill="${p.line}" opacity=".7"/>
        ${windows([-52, -38, -24, -10, 4, 18], -38, 11, 12, p.win)}
        <path d="M34,-40 Q48,-40 52,-28 L36,-28 Z" fill="${p.win}"/>
        <rect x="-58" y="-45" width="96" height="3" rx="1.5" fill="${p.roof}"/>
        <circle cx="55" cy="-18" r="1.8" fill="#fff3c4"/>
        <path d="M-6,-21 l2,-2 2,2 -2,2z" fill="${p.trim}"/>`;
    }
    if (id === 'patisserie') {
      return `${bogies()}
        <defs><pattern id="tr-lattice" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="7" height="7" fill="${p.body}"/><path d="M0,0 H7 M0,0 V7" stroke="${p.upper}" stroke-width="1.3"/></pattern></defs>
        <path d="M-58,-12 L-58,-38 Q-58,-44 -52,-44 L44,-44 Q56,-44 58,-34 L58,-16 Q58,-12 54,-12 Z" fill="${p.body}"/>
        <rect x="-58" y="-21" width="116" height="9" fill="url(#tr-lattice)"/>
        <rect x="-58" y="-23" width="116" height="2" fill="${p.trim}"/>
        ${[-50, -32, -14, 4, 22].map((x) => `<path d="M${x},-26 L${x},-34 Q${x + 6},-41 ${x + 12},-34 L${x + 12},-26 Z" fill="${p.win}" stroke="${p.trim}" stroke-width="1"/>`).join('')}
        <path d="M40,-40 Q54,-40 55,-30 L42,-30 Z" fill="${p.win}"/>
        <rect x="-58" y="-46" width="110" height="3" rx="1.5" fill="${p.upper}"/>
        <circle cx="56" cy="-17" r="1.8" fill="#fff3c4"/>`;
    }
    if (id === 'royal') {
      return `${bogies()}
        <path d="M-58,-12 L-58,-40 Q-58,-44 -54,-44 L42,-44 Q55,-44 58,-30 L58,-16 Q58,-12 54,-12 Z" fill="${p.body}"/>
        <rect x="-58" y="-17" width="116" height="1.2" fill="${p.line}"/>
        <rect x="-58" y="-41" width="110" height="1" fill="${p.line}" opacity=".8"/>
        ${windows([-52, -36, -20, 16], -37, 12, 11, p.win, 1.5)}
        ${[-52, -36, -20, 16].map((x) => `<rect x="${x - 0.8}" y="-37.8" width="13.6" height="12.6" rx="2" fill="none" stroke="${p.line}" stroke-width=".9"/>`).join('')}
        ${emblem(4, -28, 6.5, p.line)}
        <path d="M40,-40 Q53,-40 55,-29 L42,-29 Z" fill="${p.win}"/>
        <rect x="-58" y="-46" width="104" height="3" rx="1.5" fill="${p.roof}"/>
        <circle cx="56" cy="-18" r="1.8" fill="#fff3c4"/>`;
    }
    // ひだまりローカル気動車（初期）
    return `${bogies()}
      <path d="M-58,-12 L-58,-40 Q-58,-44 -54,-44 L48,-44 Q56,-44 57,-36 L58,-16 Q58,-12 54,-12 Z" fill="${p.upper}" stroke="#d9c7ae" stroke-width=".8"/>
      <path d="M-58,-24 L58,-24 L58,-16 Q58,-12 54,-12 L-58,-12 Z" fill="${p.body}"/>
      <rect x="-58" y="-26" width="116" height="2" fill="${p.line}"/>
      ${windows([-52, -38, -24, -6, 8], -39, 11, 11, p.win)}
      <rect x="-21" y="-39" width="12" height="27" rx="1.5" fill="${p.body}" opacity=".9"/><rect x="-19" y="-37" width="8" height="10" rx="1" fill="${p.win}"/>
      <path d="M38,-40 L52,-40 Q55,-40 55,-36 L55,-28 L38,-28 Z" fill="${p.win}"/>
      <rect x="-30" y="-48" width="26" height="4" rx="2" fill="${p.roof}"/>
      <circle cx="55" cy="-18" r="1.8" fill="#fff3c4"/>`;
  }

  // オリジナルの紋章：楠の葉を8枚めぐらせた丸紋（実在の列車の紋章には似せない）
  function emblem(cx, cy, r, color) {
    const leaves = Array.from({ length: 8 }, (_, i) => `<ellipse cx="0" cy="${-r * 0.62}" rx="${r * 0.16}" ry="${r * 0.34}" transform="rotate(${i * 45})" fill="${color}"/>`).join('');
    return `<g transform="translate(${cx} ${cy})"><circle r="${r}" fill="none" stroke="${color}" stroke-width="1"/>${leaves}<circle r="${r * 0.22}" fill="${color}"/></g>`;
  }

  function steamLoco(p) {
    const big = (x) => `<circle cx="${x}" cy="-10" r="9.5" fill="#1a1714" stroke="${p.line}" stroke-width="1.4"/>
      ${[0, 45, 90, 135].map((a) => `<rect x="-0.6" y="-8.5" width="1.2" height="17" transform="translate(${x} -10) rotate(${a})" fill="#5b4f45"/>`).join('')}
      <circle cx="${x}" cy="-10" r="2" fill="${p.line}"/>`;
    return `<g class="tr-bogie">
        ${big(-6)}${big(15)}${big(36)}
        <rect x="-8" y="-11.5" width="46" height="2.4" rx="1.2" fill="${p.line}"/>
        <circle cx="52" cy="-5" r="4.5" fill="#1a1714"/><circle cx="-44" cy="-5" r="5" fill="#1a1714"/><circle cx="-30" cy="-5" r="5" fill="#1a1714"/>
      </g>
      <path d="M60,-6 L52,-6 L49,-14 L60,-14 Z" fill="#3a322b"/>
      <rect x="-16" y="-36" width="70" height="20" rx="9" fill="${p.body}"/>
      <rect x="-16" y="-27" width="70" height="1.4" fill="${p.line}" opacity=".7"/>
      <rect x="50" y="-36" width="7" height="20" rx="2" fill="#151210"/>
      <rect x="41" y="-50" width="7" height="15" rx="1" fill="${p.line}"/><rect x="39" y="-52" width="11" height="3.5" rx="1.5" fill="${p.line}"/>
      <path d="M16,-36 Q16,-44 22,-44 Q28,-44 28,-36 Z" fill="${p.line}"/>
      <rect x="-58" y="-46" width="44" height="34" rx="3" fill="${p.body}"/>
      <rect x="-61" y="-49" width="50" height="4" rx="2" fill="${p.roof}"/>
      ${windows([-52, -34], -41, 12, 11, p.win, 2)}
      <rect x="-58" y="-18" width="114" height="5" rx="1.5" fill="#2e2924"/>
      <rect x="-58" y="-19" width="114" height="1.2" fill="${p.line}"/>
      <circle cx="56" cy="-30" r="2.2" fill="#fff3c4" stroke="${p.line}" stroke-width=".8"/>`;
  }

  // 2両目（連結車両）：1両目の塗装の色で、車両ごとの形を描く
  function carriageCar(id, liveryId) {
    const p = pal(liveryId);
    const steam = liveryId === 'caldera';
    const body = steam ? '#2a1f19' : p.body;
    const upper = steam ? '#2a1f19' : p.upper;
    const base = `<path d="M-58,-12 L-58,-40 Q-58,-44 -54,-44 L54,-44 Q58,-44 58,-40 L58,-12 Z" fill="${upper}" stroke="${liveryId === 'gullwing' || liveryId === 'hidamari' ? '#d9c7ae' : 'none'}" stroke-width=".8"/>`;
    const lower = `<path d="M-58,-22 L58,-22 L58,-12 L-58,-12 Z" fill="${body}"/><rect x="-58" y="-24" width="116" height="2" fill="${p.line}"/>`;
    if (id === 'panorama') {
      return `${bogies()}${base}${lower}
        <path d="M-52,-26 L-52,-38 Q-52,-42 -46,-42 L46,-42 Q52,-42 52,-38 L52,-26 Z" fill="${p.win}" opacity=".92"/>
        ${[-30, -8, 14, 36].map((x) => `<rect x="${x}" y="-42" width="1.6" height="16" fill="${upper}"/>`).join('')}
        <path d="M-48,-40 L-36,-40 L-44,-28 L-52,-28 Z" fill="#fff" opacity=".16"/>
        <path d="M-58,-44 Q0,-52 58,-44" fill="none" stroke="${p.line}" stroke-width="1.4"/>
        <text x="0" y="-15" text-anchor="middle" font-size="5" fill="${p.trim}" font-family="serif">展望</text>`;
    }
    if (id === 'ashiyu') {
      return `${bogies()}
        <path d="M-58,-12 L-58,-28 L58,-28 L58,-12 Z" fill="${body}"/>
        <rect x="-58" y="-30" width="116" height="2.4" fill="${p.line}"/>
        <rect x="-50" y="-38" width="100" height="10" rx="2" fill="#e2c08d" stroke="#b58c58" stroke-width="1"/>
        ${[-38, -22, -6, 10, 26, 42].map((x) => `<rect x="${x}" y="-38" width="1" height="10" fill="#b58c58" opacity=".7"/>`).join('')}
        <path d="M-47,-36 Q-30,-38 -14,-36 T18,-36 T47,-36 L47,-33 L-47,-33 Z" fill="#8fc4c0"/>
        <rect x="-56" y="-50" width="112" height="3" rx="1.5" fill="${p.roof}"/>
        <rect x="-52" y="-48" width="2" height="10" fill="${p.roof}"/><rect x="50" y="-48" width="2" height="10" fill="${p.roof}"/>
        <g class="tr-steam" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".85">
          <path d="M-24,-40 q-3,-4 0,-8 t0,-8"/><path d="M2,-40 q-3,-4 0,-8 t0,-8"/><path d="M28,-40 q-3,-4 0,-8 t0,-8"/>
        </g>
        <text x="0" y="-16" text-anchor="middle" font-size="6" fill="${p.trim}" font-family="serif">♨ 足湯</text>`;
    }
    if (id === 'chaya') {
      const lattice = (x) => `<g transform="translate(${x} -40)"><rect width="18" height="14" rx="1" fill="#f3e6cc"/>
        <path d="M0,4.7 H18 M0,9.3 H18 M6,0 V14 M12,0 V14" stroke="#8a5a36" stroke-width="1.1"/>
        <path d="M0,0 H18 V4 Q13.5,6 9,4 Q4.5,6 0,4 Z" fill="#2f4b7c"/></g>`;
      return `${bogies()}${base}
        <path d="M-58,-22 L58,-22 L58,-12 L-58,-12 Z" fill="#8a5a36"/>
        ${[-44, -20, 4, 28].map((x) => `<rect x="${x}" y="-22" width="1.2" height="10" fill="#6d4429"/>`).join('')}
        <rect x="-58" y="-24" width="116" height="2" fill="${p.line}"/>
        ${[-50, -26, 6, 30].map(lattice).join('')}
        <rect x="-58" y="-47" width="116" height="4" rx="2" fill="#6d4429"/>
        <circle cx="-8" cy="-34" r="3.6" fill="#c2352b"/><text x="-8" y="-32.3" text-anchor="middle" font-size="4" fill="#fff" font-family="serif">茶</text>`;
    }
    return '';
  }

  // マップ・ガレージ用の列車トークン：<g> の中身（1両目は原点、2両目は別の <g> で後ろに置く）
  function trainSvg(liveryId = equipped().livery) {
    return `<g class="tr-car tr-${liveryId}"><ellipse cx="0" cy="1" rx="58" ry="3.2" fill="#3a322b" opacity=".18"/>${frontCar(liveryId)}</g>`;
  }
  function carriageSvg(carriageId = equipped().carriage, liveryId = equipped().livery) {
    if (!carriageId || carriageId === 'none') return '';
    return `<g class="tr-car tr-carriage tr-${carriageId}"><ellipse cx="0" cy="1" rx="58" ry="3.2" fill="#3a322b" opacity=".18"/>${carriageCar(carriageId, liveryId)}</g>`;
  }
  // 煙・湯けむりの出る位置（1両目の座標）
  const chimney = (liveryId) => (liveryId === 'caldera' ? [44, -54] : [-17, -50]);

  // ---------- トレイル（走ったあとに浮かぶもの） ----------
  // layer の (x, y) に1つ浮かべて、アニメーションが終わったら消す。dir は進行方向（1 右 / −1 左）
  const NS = 'http://www.w3.org/2000/svg';
  function spawnTrail(layer, x, y, trailId = equipped().trail, scale = 1, dir = 1) {
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${scale})`);
    const fx = document.createElementNS(NS, 'g');
    fx.setAttribute('class', `fx fx-${trailId}`);
    const r = Math.random();
    fx.style.setProperty('--dx', `${(-dir * (8 + r * 16)).toFixed(1)}px`);
    fx.style.setProperty('--dy', `${(-18 - r * 16).toFixed(1)}px`);
    fx.style.setProperty('--rot', `${((r - 0.5) * 220).toFixed(0)}deg`);
    if (trailId === 'leaves') {
      const c = ['#7fae5a', '#a9c97a', '#5b8266'][Math.floor(r * 3)];
      fx.innerHTML = `<path d="M0,-5 Q4.5,-1 0,5 Q-4.5,-1 0,-5 Z" fill="${c}"/><path d="M0,-4 V4" stroke="#3f6b3c" stroke-width=".6"/>`;
    } else if (trailId === 'steam') {
      fx.innerHTML = `<path d="M0,0 q-4,-5 0,-10 t0,-10" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".85"/>`;
    } else if (trailId === 'stardust') {
      const s = 2.5 + r * 3;
      fx.innerHTML = `<path d="M0,${-s} L${s * 0.28},${-s * 0.28} L${s},0 L${s * 0.28},${s * 0.28} L0,${s} L${-s * 0.28},${s * 0.28} L${-s},0 L${-s * 0.28},${-s * 0.28} Z" fill="${r > 0.5 ? '#e2b54d' : '#f1d78a'}"/>`;
    } else {
      const s = 4 + r * 3;
      fx.innerHTML = `<circle r="${s}" fill="#fff"/><circle cx="${s * 0.8}" cy="${s * 0.3}" r="${s * 0.7}" fill="#fff"/><circle cx="${-s * 0.7}" cy="${s * 0.35}" r="${s * 0.6}" fill="#fff"/>`;
    }
    g.appendChild(fx);
    layer.appendChild(g);
    setTimeout(() => g.remove(), 1700);
  }

  // ---------- 旅人アバター ----------
  // viewBox 0 0 120 140（胸から上）。crop: true でヘッダー用に顔まわりだけを切り出す
  function avatarSvg(eq = equipped(), { crop = false, id = 'av' } = {}) {
    const skin = '#f4d7b8', hair = '#4a3326';
    const vb = crop ? '18 8 84 84' : '0 0 120 140';
    return `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" class="avatar-svg" aria-hidden="true">
      ${outfitBack(eq.outfit)}
      ${outfit(eq.outfit)}
      <rect x="53" y="74" width="14" height="12" rx="5" fill="${skin}"/>
      <path d="M33,52 Q33,26 60,26 Q87,26 87,52 Q87,80 60,80 Q33,80 33,52 Z" fill="${skin}"/>
      <path d="M33,54 Q31,30 52,25 Q68,21 80,30 Q90,38 87,56 Q82,44 72,40 Q58,46 40,42 Q35,46 33,54 Z" fill="${hair}"/>
      <ellipse cx="48" cy="58" rx="2.6" ry="3.2" fill="#3a2a20"/><ellipse cx="72" cy="58" rx="2.6" ry="3.2" fill="#3a2a20"/>
      <circle cx="48.8" cy="57" r=".9" fill="#fff"/><circle cx="72.8" cy="57" r=".9" fill="#fff"/>
      <ellipse cx="42" cy="66" rx="5" ry="3" fill="#efa58f" opacity=".55"/><ellipse cx="78" cy="66" rx="5" ry="3" fill="#efa58f" opacity=".55"/>
      <path d="M54,67 Q60,72 66,67" fill="none" stroke="#a5573f" stroke-width="2" stroke-linecap="round"/>
      ${hat(eq.hat)}
      ${crop ? '' : buddy(eq.buddy, id)}
    </svg>`;
  }

  function outfitBack(o) {
    if (o === 'canvas') return '<rect x="22" y="88" width="76" height="46" rx="14" fill="#a88f63"/>';
    if (o === 'yukata') return '<path d="M18,140 L24,98 Q30,86 60,86 Q90,86 96,98 L102,140 Z" fill="#7a4e35"/>';
    return '';
  }
  function outfit(o) {
    const torso = (fill) => `<path d="M24,140 L28,102 Q32,86 60,86 Q88,86 92,102 L96,140 Z" fill="${fill}"/>`;
    if (o === 'blazer') {
      return `${torso('#234236')}
        <path d="M50,86 L60,112 L70,86 Z" fill="#faf6f0"/><path d="M57,90 L60,96 L63,90 L60,88 Z" fill="#d49a35"/><path d="M58.5,96 L61.5,96 L62,110 L60,113 L58,110 Z" fill="#d49a35"/>
        <path d="M50,86 L44,92 L54,118 L60,112 Z" fill="#1a3329"/><path d="M70,86 L76,92 L66,118 L60,112 Z" fill="#1a3329"/>
        <circle cx="60" cy="122" r="2" fill="#d49a35"/><circle cx="60" cy="132" r="2" fill="#d49a35"/>
        <rect x="74" y="104" width="9" height="2" rx="1" fill="#d49a35"/>`;
    }
    if (o === 'yukata') {
      return `${torso('#2f4b7c')}
        ${[[36, 106], [52, 124], [74, 112], [84, 132], [42, 134], [66, 136]].map(([x, y]) => `<path d="M${x},${y - 4} l3.5,4 -3.5,4 -3.5,-4z" fill="none" stroke="#dfe7f2" stroke-width="1"/>`).join('')}
        <path d="M46,86 L60,118 L74,86 L69,86 L60,106 L51,86 Z" fill="#f3efe6"/>
        <rect x="28" y="120" width="64" height="8" fill="#c9893f"/>
        <path d="M28,102 L40,88 L46,92 L36,140 L26,140 Z" fill="#7a4e35"/><path d="M92,102 L80,88 L74,92 L84,140 L94,140 Z" fill="#7a4e35"/>
        <circle cx="52" cy="104" r="1.6" fill="#f3efe6"/><circle cx="68" cy="104" r="1.6" fill="#f3efe6"/><path d="M52,104 Q60,108 68,104" fill="none" stroke="#f3efe6" stroke-width="1"/>`;
    }
    if (o === 'tuxedo') {
      return `${torso('#1f1d1c')}
        <path d="M50,86 L60,120 L70,86 Z" fill="#fbf8f2"/>
        <path d="M50,86 L42,94 L56,124 L60,120 Z" fill="#33302d"/><path d="M70,86 L78,94 L64,124 L60,120 Z" fill="#33302d"/>
        <path d="M53,90 L60,93 L67,90 L67,97 L60,94 L53,97 Z" fill="#4a1525"/>
        <circle cx="60" cy="104" r="1.3" fill="#1f1d1c"/><circle cx="60" cy="111" r="1.3" fill="#1f1d1c"/>
        <path d="M74,104 L82,104 L80,108 L76,108 Z" fill="#d49a35"/>`;
    }
    // キャンバスの旅リュック姿（初期）
    return `${torso('#f3ebdd')}
      <path d="M50,86 L60,98 L70,86 Z" fill="#e4d6bf"/><path d="M48,86 L56,100 L60,96 Z" fill="#faf6f0"/><path d="M72,86 L64,100 L60,96 Z" fill="#faf6f0"/>
      <path d="M50,88 Q60,96 70,88 L68,94 Q60,100 52,94 Z" fill="#d96b43"/>
      <rect x="34" y="92" width="8" height="48" rx="3" fill="#c9b48a"/><rect x="78" y="92" width="8" height="48" rx="3" fill="#c9b48a"/>
      <rect x="35" y="112" width="6" height="4" rx="1" fill="#8c7451"/><rect x="79" y="112" width="6" height="4" rx="1" fill="#8c7451"/>`;
  }
  function hat(h) {
    if (h === 'conductor') {
      return `<path d="M36,40 Q36,22 60,20 Q84,22 84,40 Z" fill="#2c3e50"/>
        <rect x="36" y="37" width="48" height="5" fill="#1d2a36"/><rect x="36" y="38.5" width="48" height="1.4" fill="#d49a35"/>
        <path d="M38,42 Q60,52 86,42 Q82,46 60,48 Q42,47 38,42 Z" fill="#141c24"/>
        <circle cx="60" cy="30" r="4.5" fill="#d49a35"/><path d="M57,30 h6 M60,27 v6" stroke="#2c3e50" stroke-width="1.2"/>`;
    }
    if (h === 'tenugui') {
      return `<path d="M42,30 Q60,20 78,30 L76,36 Q60,28 44,36 Z" fill="#faf6f0" stroke="#d8cfc0" stroke-width=".6"/>
        ${[46, 54, 62, 70].map((x) => `<path d="M${x},28 L${x + 2},34" stroke="#2f4b7c" stroke-width="2"/>`).join('')}
        <path d="M76,33 L84,38 L80,40 Z" fill="#faf6f0"/>`;
    }
    if (h === 'kinghat') {
      return `<ellipse cx="60" cy="38" rx="30" ry="6" fill="#a8772a"/>
        <path d="M43,37 L45,10 Q60,6 75,10 L77,37 Z" fill="#d49a35"/>
        <path d="M44,31 L76,31 L76,25 L44.5,25 Z" fill="#4a1525"/>
        <path d="M48,12 Q60,9 72,12 L72,16 Q60,13 48,16 Z" fill="#f1d78a" opacity=".7"/>
        <path d="M60,15 l1.8,3.6 4,.6 -2.9,2.8 .7,4 -3.6,-1.9 -3.6,1.9 .7,-4 -2.9,-2.8 4,-.6z" fill="#f1d78a"/>`;
    }
    // 旅の麦わら帽子（初期）
    return `<ellipse cx="60" cy="38" rx="38" ry="9" fill="#e8c77e"/>
      <path d="M40,38 Q40,16 60,16 Q80,16 80,38 Z" fill="#edd08e"/>
      <path d="M40,32 Q60,36 80,32 L80,38 Q60,41 40,38 Z" fill="#d96b43"/>
      ${[48, 56, 64, 72].map((x) => `<path d="M${x},18 Q${x - 2},27 ${x},33" fill="none" stroke="#caa55a" stroke-width=".8"/>`).join('')}
      <path d="M26,40 Q60,50 94,40" fill="none" stroke="#caa55a" stroke-width=".8"/>`;
  }
  function buddy(b) {
    if (b === 'camera') {
      return `<g transform="translate(92 104)">
        <rect x="-12" y="-14" width="24" height="30" rx="3" fill="#2b2622"/><rect x="-12" y="-14" width="24" height="5" rx="2" fill="#4a423b"/>
        <circle cy="-1" r="6" fill="#1a1714" stroke="#c9a14a" stroke-width="1.4"/><circle cy="-1" r="2.6" fill="#3d5662"/>
        <circle cy="11" r="5" fill="#1a1714" stroke="#c9a14a" stroke-width="1.2"/><circle cy="11" r="2.2" fill="#3d5662"/>
        <path d="M-11,-13 Q-17,-22 -24,-17" fill="none" stroke="#8a5a36" stroke-width="2"/></g>`;
    }
    if (b === 'bento') {
      return `<g transform="translate(94 122)">
        <ellipse cx="0" cy="4" rx="17" ry="8" fill="#c99b62"/><rect x="-17" y="-6" width="34" height="10" fill="#d9b27c"/>
        <ellipse cx="0" cy="-6" rx="17" ry="8" fill="#f7f1e3"/><ellipse cx="0" cy="-6" rx="13" ry="5.5" fill="#fbf8f0"/>
        <circle cx="-4" cy="-7" r="2.6" fill="#c2352b"/><rect x="2" y="-9" width="8" height="4" rx="1.5" fill="#d49a35"/><path d="M-10,-4 q3,-3 6,0" stroke="#5b8266" stroke-width="2" fill="none"/>
        <rect x="-17" y="-2" width="34" height="2" fill="#a8763f"/>
        <path d="M-14,-20 L16,-9 M-12,-22 L17,-11" stroke="#8a5a36" stroke-width="1.6" stroke-linecap="round"/></g>`;
    }
    if (b === 'cat') {
      return `<g transform="translate(94 116)">
        <path d="M-14,22 Q-16,4 -8,-2 L8,-2 Q16,4 14,22 Z" fill="#faf6f0"/>
        <path d="M-14,22 Q-16,8 -10,2 Q-4,10 -8,22 Z" fill="#d98a3f"/><path d="M14,22 Q15,10 9,4 Q6,14 8,22 Z" fill="#3a322b"/>
        <path d="M14,18 Q24,14 22,4" fill="none" stroke="#d98a3f" stroke-width="3.4" stroke-linecap="round"/>
        <circle cx="0" cy="-8" r="10" fill="#faf6f0"/><path d="M-9,-12 L-8,-22 L-2,-16 Z" fill="#d98a3f"/><path d="M9,-12 L8,-22 L2,-16 Z" fill="#3a322b"/>
        <path d="M-8,-11 Q-4,-16 0,-12 Q-3,-6 -8,-11 Z" fill="#d98a3f"/>
        <circle cx="-3.5" cy="-8" r="1.2" fill="#3a2a20"/><circle cx="3.5" cy="-8" r="1.2" fill="#3a2a20"/>
        <path d="M-1.2,-5 L1.2,-5 L0,-3.6 Z" fill="#c76a5a"/>
        <path d="M-7,-17 Q0,-22 7,-17 L7,-14 L-7,-14 Z" fill="#2c3e50"/><rect x="-8" y="-15" width="16" height="2" fill="#1d2a36"/><circle cy="-17.5" r="1.4" fill="#d49a35"/></g>`;
    }
    return '';
  }

  // サムネイル（ガレージの一覧用）
  function thumb(slot, id) {
    const eq = Object.assign({}, equipped());
    if (['livery', 'carriage'].includes(slot)) {
      const car = slot === 'livery' ? trainSvg(id) : carriageSvg(id, eq.livery) || '<text x="0" y="-18" text-anchor="middle" font-size="16" fill="#9a8574">1両で運行</text>';
      return `<svg viewBox="-66 -60 132 66" class="thumb-svg" aria-hidden="true"><rect x="-66" y="-1" width="132" height="3" fill="#b8a68e"/>${car}</svg>`;
    }
    if (slot === 'trail') return trailArt(id);
    eq[slot] = id;
    return avatarSvg(eq, { id: `th-${slot}-${id}` });
  }

  // トレイルのサムネイル：浮かぶものを止めた絵で（空色の背景に）
  function trailArt(id) {
    let art;
    if (id === 'leaves') {
      art = [[-16, -6, 30, '#7fae5a'], [4, -14, -40, '#a9c97a'], [16, 4, 70, '#5b8266'], [-4, 10, 140, '#a9c97a'], [-26, 10, -20, '#5b8266']]
        .map(([x, y, r, c]) => `<g transform="translate(${x} ${y}) rotate(${r}) scale(1.4)"><path d="M0,-5 Q4.5,-1 0,5 Q-4.5,-1 0,-5 Z" fill="${c}"/><path d="M0,-4 V4" stroke="#3f6b3c" stroke-width=".6"/></g>`).join('')
        + '<path d="M-34,0 Q-10,-8 10,0 T34,-2" fill="none" stroke="#fff" stroke-width="1.4" opacity=".8"/>';
    } else if (id === 'steam') {
      art = [-14, 0, 14].map((x, i) => `<path d="M${x},18 q-6,-7 0,-14 t0,-14 t0,-12" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity="${0.95 - i * 0.12}"/>`).join('')
        + '<ellipse cx="0" cy="22" rx="26" ry="5" fill="#9cc7c0" opacity=".6"/>';
    } else if (id === 'stardust') {
      const star = (x, y, s, c) => `<path transform="translate(${x} ${y})" d="M0,${-s} L${s * 0.28},${-s * 0.28} L${s},0 L${s * 0.28},${s * 0.28} L0,${s} L${-s * 0.28},${s * 0.28} L${-s},0 L${-s * 0.28},${-s * 0.28} Z" fill="${c}"/>`;
      art = star(-14, -6, 9, '#e2b54d') + star(10, -14, 6, '#f1d78a') + star(16, 8, 8, '#e2b54d') + star(-4, 14, 5, '#f1d78a') + star(-26, 12, 4, '#e2b54d');
    } else {
      art = [[-14, 4, 9], [0, -4, 12], [14, 4, 9], [-24, 12, 6], [26, 12, 6]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff"/>`).join('');
    }
    return `<svg viewBox="-40 -30 80 60" class="thumb-svg thumb-trail" aria-hidden="true"><rect x="-40" y="-30" width="80" height="60" fill="#d8ecea"/>${art}</svg>`;
  }

  YT.Craft = {
    init(data) {
      D = data;
    },
    slots,
    slotDef,
    item,
    owns,
    earned,
    breakdown,
    balance,
    buy,
    equipped,
    ticketsPerDay,
    ticketsLeft,
    today,
    useTicket: () => YT.Store.useDayTicket(today()),
    trainSvg,
    carriageSvg,
    chimney,
    spawnTrail,
    avatarSvg,
    thumb,
  };
})();
