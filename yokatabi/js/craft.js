// 鉄道クラフト工房と旅の紋章：パーツの一覧（stations.json の meta.craft）・クラフト資金・SVG の絵。
// 列車も旅の紋章（革の旅行鞄と懐中時計。関数名は旧名の avatarSvg のまま）も、絵文字や画像ではなくこのファイルの SVG で描く（マップの列車トークン・ガレージ・ヘッダー・証明カードで共用）。
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

  // ---------- 絵の共通の道具 ----------
  // 色は SVG の属性に直接書く（シェアカードでは SVG を画像にして描くので、CSS の変数が届かない）
  const INK = '#2C2523'; // 万年筆のインク
  const INK2 = '#5A4E45';
  const INK3 = '#8A7D70';
  const GOLD = '#C59B27'; // 細い金線
  const BRASS = '#B8860B';
  const AKANE = '#A8382B'; // 茜：紋章の札・根付の組紐の差し色
  // 同じ絵がひとつのページに何枚も並ぶ（ヘッダー・ランキング・サムネイル）ので、clipPath の id は呼ぶたびに新しくする
  let seq = 0;
  const uid = (p) => `${String(p).replace(/[^\w-]/g, '')}-${(++seq).toString(36)}`;
  const n1 = (v) => (Math.round(v * 100) / 100).toString();

  // 平行のハッチング（銅版画の陰影）。clip の形の中だけに、angle 度の線を step おきに引く
  function hatch(idp, clipD, { step = 2.4, angle = 45, color = INK, w = 0.45, op = 1, box = [-70, -70, 140, 140] } = {}) {
    const id = uid(idp);
    const [bx, by, bw, bh] = box;
    const cx = bx + bw / 2, cy = by + bh / 2, L = Math.hypot(bw, bh) / 2;
    const a = (angle * Math.PI) / 180, dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx;
    let d = '';
    for (let t = -L; t <= L; t += step) {
      const x0 = cx + nx * t, y0 = cy + ny * t;
      d += `M${n1(x0 - dx * L)},${n1(y0 - dy * L)}L${n1(x0 + dx * L)},${n1(y0 + dy * L)}`;
    }
    return `<clipPath id="${id}"><path d="${clipD}"/></clipPath><path clip-path="url(#${id})" d="${d}" stroke="${color}" stroke-width="${w}" opacity="${op}" fill="none"/>`;
  }

  // オリジナルの紋章：二重の輪の中に、三行脈の楠の葉を三枚めぐらせ、葉のあいだに実を置いた丸紋
  // （実在の列車・会社の紋章には似せない。CLAUDE.md の「楠の葉の丸紋」）
  function emblem(cx, cy, r, color, bg) {
    const leaf = (deg) => `<g transform="rotate(${deg})">
        <path d="M0,${n1(-r * 0.14)} C${n1(r * 0.36)},${n1(-r * 0.32)} ${n1(r * 0.3)},${n1(-r * 0.66)} 0,${n1(-r * 0.8)} C${n1(-r * 0.3)},${n1(-r * 0.66)} ${n1(-r * 0.36)},${n1(-r * 0.32)} 0,${n1(-r * 0.14)} Z" fill="${color}"/>
        <path d="M0,${n1(-r * 0.2)} V${n1(-r * 0.7)} M0,${n1(-r * 0.3)} L${n1(r * 0.13)},${n1(-r * 0.52)} M0,${n1(-r * 0.3)} L${n1(-r * 0.13)},${n1(-r * 0.52)}" stroke="${bg}" stroke-width="${n1(r * 0.045)}" fill="none"/>
      </g>`;
    const berry = (deg) => `<circle cx="0" cy="${n1(-r * 0.5)}" r="${n1(r * 0.07)}" fill="${color}" transform="rotate(${deg})"/>`;
    return `<g transform="translate(${cx} ${cy})">
        <circle r="${r}" fill="${bg}" stroke="${color}" stroke-width="${n1(r * 0.09)}"/>
        <circle r="${n1(r * 0.85)}" fill="none" stroke="${color}" stroke-width="${n1(r * 0.04)}"/>
        ${[0, 120, 240].map(leaf).join('')}${[60, 180, 300].map(berry).join('')}
        <circle r="${n1(r * 0.1)}" fill="${color}"/>
      </g>`;
  }
  // 唐草の飾り：ひと巻きの蔓と小さな葉。dir＝1 右へ伸びる / −1 左へ
  function scroll(x, y, s, dir, color) {
    return `<path transform="translate(${x} ${y}) scale(${dir * s} ${s})" d="M0,0 C3,-2.6 7.5,-2.8 9.5,-.4 C11,1.6 9.4,3.4 7.8,2.4 C6.8,1.7 7.4,.4 8.4,.8 M3.6,-1.5 C3.2,-3.4 4.6,-4.6 6,-4 C5.4,-2.8 4.6,-2 3.6,-1.5 M6.2,-2.2 C7.6,-3.2 9.2,-2.6 9.4,-1.6" fill="none" stroke="${color}" stroke-width="${n1(0.5 / s)}" stroke-linecap="round"/>`;
  }

  // ---------- 列車の絵（横から見た姿・右向き） ----------
  // 1両は x −60〜60、y −54〜0（0 がレールの高さ）。マップでは縮めて（約50単位）、線路の向きに回して使う。
  // 盤面では 1両が 40〜70px ほどになるので、車体の色の塊・窓の帯・屋根・車輪の太い線で形を見せ、
  // 金線（0.5〜0.7）の窓枠・帯・唐草・紋章は、工房のプレビューやシェアカードで大きく見たときに効く。
  //   body 車体 / upper 窓まわり / roof 屋根 / edge 輪郭 / line 金線 / glass 窓 / band 差しの帯
  const LIVERY = {
    // ひだまりローカル気動車：煉瓦がかったテラコッタの腰と、生成りの窓まわり
    hidamari: { body: '#8E4A33', upper: '#EFE6D4', roof: '#6E5D4F', edge: '#2C2523', line: '#C59B27', glass: '#3A4446', light: false },
    // フォレスト・ハイランド号：深緑に金の二本線
    forest: { body: '#234236', upper: '#234236', roof: '#182E25', edge: '#14251E', line: '#C59B27', glass: '#E2D3AE', light: true },
    // 白磁ストリームライン号：白磁の車体に茜の帯、真鍮の細線
    gullwing: { body: '#F6F3EC', upper: '#F6F3EC', roof: '#D9D2C4', edge: '#6E5D4F', line: '#B8860B', glass: '#2F3A3E', band: '#A8382B', light: false },
    // カルデラ・スチーム号：漆黒の黒鉄と真鍮
    caldera: { body: '#1E1A18', upper: '#1E1A18', roof: '#14110F', edge: '#0E0C0B', line: '#C59B27', glass: '#E2D3AE', light: true },
    // ゴールデン・パティスリー号：アンティークゴールドに漆黒の格子
    patisserie: { body: '#A8873F', upper: '#1E1A18', roof: '#1E1A18', edge: '#2C2523', line: '#E6C665', glass: '#E8D9B4', light: true },
    // ロイヤル・マルーン号：ロイヤルマルーンに金の紋章と唐草
    royal: { body: '#5E1F2B', upper: '#5E1F2B', roof: '#3A121A', edge: '#2A0C13', line: '#C59B27', glass: '#E6D6B0', light: true },
  };
  const pal = (id) => LIVERY[id] || LIVERY.hidamari;

  // 車輪：黒鉄の円に金のふち・スポーク・軸
  function wheel(x, cy = -5, r = 4.6) {
    // スポークは1本の path にまとめる（盤面で毎フレーム動かすので、要素の数を抑える）
    const k = r * 0.78, c = n1(k * 0.5), s = n1(k * 0.866);
    const sp = `M${n1(-k)},0H${n1(k)}M-${c},-${s}L${c},${s}M${c},-${s}L-${c},${s}`;
    return `<g transform="translate(${x} ${cy})"><circle r="${r}" fill="#221D1A"/><circle r="${n1(r - 0.4)}" fill="none" stroke="${GOLD}" stroke-width=".55"/>
      <path d="${sp}" stroke="${GOLD}" stroke-width=".35" opacity=".85"/><circle r="${n1(r * 0.22)}" fill="${GOLD}"/></g>`;
  }
  // 台車：二つの車輪の上に、金線で縁どった側枠と枕ばね
  function bogie(cx) {
    return `<g class="tr-bogie">${wheel(cx - 7)}${wheel(cx + 7)}
      <path d="M${cx - 13.5},-11.2 H${cx + 13.5} L${cx + 11.5},-7.4 H${cx - 11.5} Z" fill="#2A2420" stroke="${GOLD}" stroke-width=".5"/>
      <rect x="${cx - 2.4}" y="-10.6" width="4.8" height="2.6" fill="none" stroke="${GOLD}" stroke-width=".45"/>
      <path d="M${cx - 9},-9.3 h3.4 M${cx + 5.6},-9.3 h3.4" stroke="${GOLD}" stroke-width=".4"/></g>`;
  }
  // 床下：台枠・機器箱・連結器
  function underframe(p, x1 = -54, x2 = 54) {
    return `<rect x="${x1}" y="-12.6" width="${x2 - x1}" height="2.4" fill="#2A2420"/>
      <rect x="-15" y="-11" width="30" height="4" fill="#2A2420" stroke="${GOLD}" stroke-width=".4"/>
      <path d="M-11,-9 h22" stroke="${GOLD}" stroke-width=".3"/>
      <path d="M-58,-10.4 h-3 M58,-10.4 h3" stroke="#2A2420" stroke-width="2"/>`;
  }
  // 窓：ガラスに金の窓枠、うすい映りこみ
  function win(x, y, w, h, p, r = 1.2) {
    const glint = p.light ? '#FFF8E6' : '#FFFFFF';
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${p.glass}" stroke="${p.line}" stroke-width=".6"/>
      <path d="M${n1(x + 1.4)},${n1(y + h - 1.2)} L${n1(x + w * 0.5)},${n1(y + 1.2)}" stroke="${glint}" stroke-opacity=".35" stroke-width=".5"/>`;
  }
  // 前照灯
  const lamp = (x, y, p) => `<circle cx="${x}" cy="${y}" r="1.9" fill="#F5E7BE" stroke="${p.line}" stroke-width=".55"/>`;

  // 1両目（先頭車）
  function frontCar(id) {
    const p = pal(id);
    if (id === 'caldera') return steamLoco(p);
    if (id === 'gullwing') {
      // 海沿いの流線形特急：長く伸びた鼻先と、窓を一本につないだリボンの窓
      const shell = 'M-58,-12 V-39 Q-58,-43 -54,-43 H12 C32,-43 49,-35 57.5,-19 Q60,-13 55,-12 Z';
      return `${bogie(-34)}${bogie(30)}${underframe(p)}
        <path d="${shell}" fill="${p.body}" stroke="${p.edge}" stroke-width="1"/>
        <path d="M-58,-23 H22 C36,-23 48,-24 56.5,-21 L58.2,-16.5 C46,-18.5 34,-18 22,-18 H-58 Z" fill="${p.band}"/>
        <path d="M-58,-24.6 H22 C37,-24.6 49,-25.5 56,-22.8" fill="none" stroke="${p.line}" stroke-width=".6"/>
        <path d="M-58,-16.2 H22 C35,-16.2 46,-16.6 58.4,-14.6" fill="none" stroke="${p.line}" stroke-width=".5"/>
        <rect x="-52" y="-37" width="62" height="8.6" rx="2.2" fill="${p.glass}" stroke="${p.line}" stroke-width=".6"/>
        ${[-40, -28, -16, -4].map((x) => `<path d="M${x},-37 v8.6" stroke="${p.body}" stroke-width="1.1"/>`).join('')}
        <path d="M-50,-30 L-46,-36 M-26,-30 L-22,-36" stroke="#fff" stroke-opacity=".3" stroke-width=".5"/>
        <path d="M18,-41 C31,-40.5 42,-35 48.5,-27.5 L36,-27.5 C31,-33 25,-36.5 18,-37.5 Z" fill="${p.glass}" stroke="${p.line}" stroke-width=".6"/>
        <path d="M-56,-44.6 H10 C24,-44.6 33,-42.8 38,-41" fill="none" stroke="${p.line}" stroke-width=".5"/>
        <rect x="-21" y="-46.6" width="8" height="3.4" rx="1" fill="${p.roof}" stroke="${p.edge}" stroke-width=".5"/>
        ${lamp(54.5, -18.8, p)}`;
    }
    if (id === 'forest') {
      // 高原の気動車：前へ寝かせた運転台と、六つ並んだ灯りの窓。腰に金の二本線と紋章
      return `${bogie(-36)}${bogie(36)}${underframe(p)}
        <path d="M-58,-12 V-41 Q-58,-45 -54,-45 H33 Q47,-45 54.5,-32 L58.2,-17 Q58.4,-12 54,-12 Z" fill="${p.body}" stroke="${p.edge}" stroke-width="1"/>
        <rect x="-58.5" y="-48" width="92" height="3.2" rx="1" fill="${p.roof}" stroke="${p.edge}" stroke-width=".6"/>
        <path d="M-58,-44.6 H33 Q46,-44.6 53,-33" fill="none" stroke="${p.line}" stroke-width=".55"/>
        <rect x="-21" y="-51.5" width="8" height="3.6" rx="1" fill="${p.roof}" stroke="${p.line}" stroke-width=".45"/>
        ${[-52, -39, -26, -13, 0, 13].map((x) => win(x, -39.5, 10, 12, p)).join('')}
        <path d="M27,-40 H35 Q44,-40 49.5,-29 H27 Z" fill="${p.glass}" stroke="${p.line}" stroke-width=".6"/>
        <path d="M-58,-24.4 H55.6 M-58,-22.4 H56.2" stroke="${p.line}" stroke-width=".7"/>
        <path d="M-58,-14.2 H57.6" stroke="${p.line}" stroke-width=".45"/>
        ${scroll(-11.5, -18.2, 0.8, -1, p.line)}${scroll(11.5, -18.2, 0.8, 1, p.line)}
        ${emblem(0, -18.2, 3.6, p.line, p.body)}
        ${lamp(56, -18.6, p)}`;
    }
    if (id === 'patisserie') {
      // 甘い香りの観光列車：二段屋根（明かり取りの窓つき）、アーチの窓、腰には漆黒の斜め格子
      const lower = 'M-58,-22 H58 V-16 Q58,-12 54,-12 H-58 Z';
      return `${bogie(-36)}${bogie(36)}${underframe(p)}
        <path d="M-58,-12 V-40 Q-58,-44 -53,-44 H48 Q57,-44 58,-35 V-16 Q58,-12 54,-12 Z" fill="${p.body}" stroke="${p.edge}" stroke-width="1"/>
        ${hatch('lat', lower, { step: 3.2, angle: 45, color: p.upper, w: 0.9 })}${hatch('lat', lower, { step: 3.2, angle: -45, color: p.upper, w: 0.9 })}
        <path d="M-58,-22.6 H58 M-58,-24.4 H58" stroke="${p.upper}" stroke-width=".9"/><path d="M-58,-23.5 H58" stroke="${p.line}" stroke-width=".5"/>
        <path d="M-56,-44 H54 L52,-47.4 H-54 Z" fill="${p.roof}"/>
        <rect x="-40" y="-51" width="70" height="3.8" fill="${p.roof}" stroke="${p.line}" stroke-width=".45"/>
        ${[-36, -24, -12, 0, 12, 24].map((x) => `<rect x="${x}" y="-50.2" width="5" height="2.2" fill="${p.glass}"/>`).join('')}
        ${[-51, -35, -19, -3, 13].map((x) => `<path d="M${x},-27 V-35 Q${x},-40.5 ${x + 5.5},-40.5 Q${x + 11},-40.5 ${x + 11},-35 V-27 Z" fill="${p.glass}" stroke="${p.upper}" stroke-width="1.1"/>
          <path d="M${x + 1.2},-27.8 V-35 Q${x + 1.2},-39.3 ${x + 5.5},-39.3 Q${x + 9.8},-39.3 ${x + 9.8},-35 V-27.8 Z" fill="none" stroke="${p.line}" stroke-width=".45"/>`).join('')}
        <path d="M33,-40 H47 Q54,-40 55.2,-32 V-29 H33 Z" fill="${p.glass}" stroke="${p.upper}" stroke-width="1"/>
        ${lamp(56.2, -18.8, p)}`;
    }
    if (id === 'royal') {
      // 最高峰のクルーズトレイン：二段屋根、金縁の縦長窓、中央に大きな楠の葉の丸紋、腰と裾に唐草
      return `${bogie(-36)}${bogie(36)}${underframe(p)}
        <path d="M-58,-12 V-40 Q-58,-44 -54,-44 H42 Q55,-44 58,-30 L58.4,-16 Q58.4,-12 54,-12 Z" fill="${p.body}" stroke="${p.edge}" stroke-width="1"/>
        <path d="M-57,-44 H44 L41,-47.6 H-55 Z" fill="${p.roof}" stroke="${p.line}" stroke-width=".45"/>
        <rect x="-44" y="-51.2" width="72" height="3.6" fill="${p.roof}" stroke="${p.line}" stroke-width=".45"/>
        ${[-40, -30, -20, 6, 16].map((x) => `<rect x="${x}" y="-50.4" width="5" height="2" fill="${p.glass}" opacity=".8"/>`).join('')}
        <path d="M-58,-41.6 H44" stroke="${p.line}" stroke-width=".5"/>
        ${[-52, -38, -24, 13, 27].map((x) => `${win(x, -39, 10, 13, p, 0.8)}<rect x="${x - 1.2}" y="-40.2" width="12.4" height="15.4" rx="1.4" fill="none" stroke="${p.line}" stroke-width=".45"/>`).join('')}
        ${emblem(-5.5, -31.5, 6.6, p.line, p.body)}
        <path d="M42,-40 Q53,-40 55.4,-29 H42 Z" fill="${p.glass}" stroke="${p.line}" stroke-width=".6"/>
        <path d="M-58,-22.6 H57.8 M-58,-21 H58" stroke="${p.line}" stroke-width=".55"/>
        ${[-50, -30, 20, 40].map((x, i) => scroll(x, -17.2, 0.9, i % 2 ? -1 : 1, p.line)).join('')}
        ${scroll(-9.5, -17.2, 0.9, -1, p.line)}${scroll(-1.5, -17.2, 0.9, 1, p.line)}
        <path d="M-58,-13.6 H58" stroke="${p.line}" stroke-width=".5"/>
        ${lamp(56.4, -18.6, p)}`;
    }
    // ひだまりローカル気動車（初期）：箱形の小さな気動車。生成りの窓まわりと煉瓦色の腰、真ん中に扉
    return `${bogie(-36)}${bogie(36)}${underframe(p)}
      <path d="M-58,-12 V-41 Q-58,-44 -55,-44 H52 Q56,-44 57,-40 L58.5,-16 Q58.5,-12 55,-12 Z" fill="${p.upper}" stroke="${p.edge}" stroke-width="1"/>
      <path d="M-58,-25 H58 L58.5,-16 Q58.5,-12 55,-12 H-58 Z" fill="${p.body}"/>
      <path d="M-58,-25.3 H58.1" stroke="${p.line}" stroke-width=".7"/><path d="M-58,-14.2 H58.4" stroke="${p.line}" stroke-width=".45"/>
      <rect x="-57" y="-47.4" width="108" height="3.4" rx="1" fill="${p.roof}" stroke="${p.edge}" stroke-width=".5"/>
      <rect x="-20" y="-52" width="6" height="4.6" fill="${p.roof}" stroke="${p.edge}" stroke-width=".5"/><path d="M-21,-52 h8" stroke="${p.edge}" stroke-width=".8"/>
      <rect x="20" y="-50" width="16" height="2.6" rx=".8" fill="${p.roof}" stroke="${p.edge}" stroke-width=".4"/>
      ${[-52, -40, -28].map((x) => win(x, -39, 9, 10.5, p)).join('')}
      <rect x="-15.5" y="-40.5" width="11" height="27.5" fill="none" stroke="${p.edge}" stroke-width=".7"/><path d="M-10,-40.5 V-13" stroke="${p.edge}" stroke-width=".4"/>
      ${win(-14.3, -38.5, 4.2, 8.5, p, 0.6)}${win(-9.1, -38.5, 4.2, 8.5, p, 0.6)}
      ${[2, 14, 26].map((x) => win(x, -39, 9, 10.5, p)).join('')}
      <path d="M41,-40 H52 Q55.4,-40 55.6,-36.5 L56,-29 H41 Z" fill="${p.glass}" stroke="${p.line}" stroke-width=".6"/>
      ${emblem(32, -18.6, 3.2, p.line, p.body)}
      ${lamp(56.2, -18.4, p)}`;
  }

  // 蒸気機関車：運転室・ボイラー・蒸気溜め・真鍮の煙突・三つの動輪と金の連結棒
  function steamLoco(p) {
    const big = (x) => `<g transform="translate(${x} -10)"><circle r="9.4" fill="#16120F" stroke="${p.line}" stroke-width=".9"/>
        <circle r="7.9" fill="none" stroke="${p.line}" stroke-width=".35"/>
        <path d="${[0, 30, 60, 90, 120, 150].map((a) => { const c = n1(7.6 * Math.cos((a * Math.PI) / 180)), s = n1(7.6 * Math.sin((a * Math.PI) / 180)); return `M${-c},${-s}L${c},${s}`; }).join('')}" stroke="${p.line}" stroke-width=".45" opacity=".85"/>
        <path d="M-6.6,3.4 A7.4,7.4 0 0 0 6.6,3.4 Z" fill="#16120F" stroke="${p.line}" stroke-width=".35"/>
        <circle r="1.8" fill="${p.line}"/></g>`;
    return `<g class="tr-bogie">
        ${wheel(-44, -5, 4.8)}${wheel(-30, -5, 4.8)}${wheel(51, -4.6, 4.2)}
        ${big(-6)}${big(15)}${big(36)}
        <path d="M-6,-6.6 H36" stroke="${p.line}" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M36,-6.6 L47,-11" stroke="${p.line}" stroke-width="1.2" stroke-linecap="round"/>
      </g>
      <rect x="40" y="-19" width="14" height="8" rx="1.5" fill="${p.body}" stroke="${p.line}" stroke-width=".5"/>
      <path d="M54,-6 L60,-6 L60,-9 L55,-15 L52,-15 Z" fill="#2A2420" stroke="${p.line}" stroke-width=".45"/>
      <path d="M55.5,-7 L58.5,-11 M53.5,-7 L56,-11" stroke="${p.line}" stroke-width=".35"/>
      <rect x="-60" y="-19.4" width="116" height="3.6" fill="#2A2420" stroke="${p.line}" stroke-width=".5"/>
      <path d="M-18,-19.4 V-34 Q-18,-37 -15,-37 H46 V-19.4 Z" fill="${p.body}" stroke="${p.edge}" stroke-width="1"/>
      ${[-6, 8, 22, 34].map((x) => `<path d="M${x},-37 V-19.4" stroke="${p.line}" stroke-width=".5"/>`).join('')}
      <path d="M-18,-36.2 H46" stroke="${p.line}" stroke-width=".4" opacity=".7"/>
      <path d="M45,-39 H55 Q57,-39 57,-37 V-21 Q57,-19.4 55,-19.4 H45 Z" fill="#14110F" stroke="${p.line}" stroke-width=".6"/>
      <circle cx="51" cy="-29" r="3.2" fill="none" stroke="${p.line}" stroke-width=".45"/>
      <path d="M41.5,-37 L40.5,-50 H48.5 L47.5,-37 Z" fill="${p.line}" stroke="#6E5418" stroke-width=".5"/>
      <rect x="39" y="-53.6" width="11" height="3.6" rx="1" fill="${p.line}" stroke="#6E5418" stroke-width=".5"/>
      <path d="M41,-46 H48" stroke="#6E5418" stroke-width=".4"/>
      <path d="M15,-37 Q15,-44.5 21,-44.5 Q27,-44.5 27,-37 Z" fill="${p.line}" stroke="#6E5418" stroke-width=".5"/>
      <path d="M1,-37 Q1,-41.5 4.5,-41.5 Q8,-41.5 8,-37 Z" fill="${p.body}" stroke="${p.line}" stroke-width=".5"/>
      <path d="M-14,-37 V-40.5 M-11,-37 V-39.6" stroke="${p.line}" stroke-width=".6"/>
      <rect x="-58" y="-46" width="40" height="26.6" rx="1.2" fill="${p.body}" stroke="${p.edge}" stroke-width="1"/>
      <path d="M-61,-46 Q-38,-51.5 -15,-46 L-15,-44.6 Q-38,-49.6 -61,-44.6 Z" fill="${p.roof}" stroke="${p.line}" stroke-width=".5"/>
      ${win(-55, -42, 10, 10, p, 1)}${win(-30, -42, 9, 10, p, 1)}
      <rect x="-56" y="-43.6" width="36" height="22.6" fill="none" stroke="${p.line}" stroke-width=".45"/>
      ${emblem(-37.5, -27, 4.1, p.line, p.body)}
      ${lamp(55, -41.6, p)}`;
  }

  // 2両目（連結車両）：1両目の塗装の色で、車両ごとの形を描く
  function carriageCar(id, liveryId) {
    const p = pal(liveryId);
    const body = liveryId === 'caldera' ? '#2B2320' : p.body;
    const upper = liveryId === 'caldera' ? '#2B2320' : p.upper;
    const box = 'M-58,-12 V-41 Q-58,-44 -55,-44 H55 Q58,-44 58,-41 V-12 Z';
    const ends = `<path d="M-60,-38 H-58 V-16 H-60 Z M58,-38 H60 V-16 H58 Z" fill="#2A2420"/>`;
    const roof = `<path d="M-57,-44 H57 L55,-47.6 H-55 Z" fill="${p.roof}" stroke="${p.line}" stroke-width=".45"/>`;
    const waist = `<path d="M-58,-23.4 H58" stroke="${p.line}" stroke-width=".7"/><path d="M-58,-14.2 H58" stroke="${p.line}" stroke-width=".45"/>`;
    if (id === 'panorama') {
      // 展望サロン車：天井まで回りこむ大きな窓（細い方立て）と、天窓の帯
      return `${bogie(-36)}${bogie(36)}${underframe(p)}${ends}
        <path d="${box}" fill="${upper}" stroke="${p.edge}" stroke-width="1"/>
        <path d="M-58,-24 H58 V-12 H-58 Z" fill="${body}"/>
        <path d="M-57,-44 Q0,-50 57,-44" fill="${p.roof}" stroke="${p.line}" stroke-width=".5"/>
        <path d="M-50,-45 Q0,-49.4 50,-45 L49,-43.6 Q0,-47.6 -49,-43.6 Z" fill="${p.glass}" opacity=".9"/>
        <rect x="-53" y="-41" width="106" height="15" rx="2" fill="${p.glass}" stroke="${p.line}" stroke-width=".65"/>
        ${[-31.8, -10.6, 10.6, 31.8].map((x) => `<path d="M${x},-41 V-26" stroke="${upper}" stroke-width="1.4"/><path d="M${x - 0.9},-41 V-26 M${x + 0.9},-41 V-26" stroke="${p.line}" stroke-width=".3"/>`).join('')}
        <path d="M-50,-28 L-44,-39 M-29,-28 L-23,-39 M11.5,-28 L17.5,-39" stroke="#fff" stroke-opacity=".3" stroke-width=".55"/>
        ${waist}${scroll(-8, -18.6, 0.8, -1, p.line)}${scroll(8, -18.6, 0.8, 1, p.line)}
        <path d="M-3.2,-18.6 L0,-21.4 L3.2,-18.6 L0,-15.8 Z" fill="none" stroke="${p.line}" stroke-width=".5"/>`;
    }
    if (id === 'ashiyu') {
      // 走る足湯：低い腰板の上に木の湯船、柱と屋根、ゆらぐ湯けむり（生成りの細い線）
      return `${bogie(-36)}${bogie(36)}${underframe(p)}${ends}
        <path d="M-58,-12 V-28 H58 V-12 Z" fill="${body}" stroke="${p.edge}" stroke-width="1"/>
        <path d="M-58,-26.2 H58" stroke="${p.line}" stroke-width=".7"/><path d="M-58,-14.2 H58" stroke="${p.line}" stroke-width=".45"/>
        ${[-36, 0, 36].map((x) => emblem(x, -20, 3, p.line, body)).join('')}
        <path d="M-50,-28 V-37 H50 V-28 Z" fill="#8A6A48" stroke="#4A3525" stroke-width=".8"/>
        ${[-38, -26, -14, -2, 10, 22, 34].map((x) => `<path d="M${x},-37 V-28" stroke="#4A3525" stroke-width=".4"/>`).join('')}
        <path d="M-50,-33 H50" stroke="#4A3525" stroke-width=".35"/>
        <path d="M-48,-36.4 Q-36,-38 -24,-36.4 T0,-36.4 T24,-36.4 T48,-36.4" fill="none" stroke="#9FBDB8" stroke-width="1.2"/>
        <path d="M-57,-50 H57 L55,-53 H-55 Z" fill="${p.roof}" stroke="${p.line}" stroke-width=".45"/>
        ${[-54, -18, 18, 52].map((x) => `<path d="M${x},-50 V-37" stroke="${p.roof}" stroke-width="1.6"/><path d="M${x},-50 V-37" stroke="${p.line}" stroke-width=".3"/>`).join('')}
        <g class="tr-steam" fill="none" stroke-linecap="round">
          ${[-30, -6, 18, 40].map((x) => `<path d="M${x},-39 q-2.6,-3 0,-6 t0,-6" stroke="#C8B9A6" stroke-width="1.6" opacity=".45"/><path d="M${x},-39 q-2.6,-3 0,-6 t0,-6" stroke="#FBF8F2" stroke-width=".8"/>`).join('')}
        </g>`;
    }
    if (id === 'chaya') {
      // 茶屋・食堂車：木組みの格子窓にのれん、板張りの腰、瓦の軒と小さな提灯
      const lattice = (x) => `<g transform="translate(${x} -40)">
          <rect width="17" height="14" fill="#E8D9B4" stroke="${p.line}" stroke-width=".6"/>
          <path d="M0,4.7 H17 M0,9.3 H17 M4.25,0 V14 M8.5,0 V14 M12.75,0 V14" stroke="#4A3525" stroke-width=".7"/>
          <path d="M0,0 H17 V4.6 Q14.8,5.6 12.75,4.6 Q10.6,5.6 8.5,4.6 Q6.4,5.6 4.25,4.6 Q2.1,5.6 0,4.6 Z" fill="${body}" stroke="${p.line}" stroke-width=".35"/>
        </g>`;
      return `${bogie(-36)}${bogie(36)}${underframe(p)}${ends}
        <path d="${box}" fill="${upper}" stroke="${p.edge}" stroke-width="1"/>
        <path d="M-58,-23 H58 V-12 H-58 Z" fill="#5B4030"/>
        ${Array.from({ length: 15 }, (_, i) => `<path d="M${-52 + i * 7.4},-23 V-12" stroke="#3E2A1E" stroke-width=".5"/>`).join('')}
        <path d="M-58,-23.4 H58" stroke="${p.line}" stroke-width=".7"/><path d="M-58,-14.2 H58" stroke="${p.line}" stroke-width=".35" opacity=".8"/>
        ${[-51, -27, 10, 34].map(lattice).join('')}
        <path d="M-58,-44 H58 L60,-46.4 H-60 Z" fill="#4A3525"/>
        <path d="M-60,-46.4 ${Array.from({ length: 20 }, (_, i) => `q3,-2.4 6,0`).join(' ')}" fill="none" stroke="#2C2523" stroke-width=".8"/>
        <path d="M-56,-48 H56 L54,-50.6 H-54 Z" fill="#3A2A1E" stroke="${p.line}" stroke-width=".4"/>
        <path d="M-1.5,-41 V-38.6" stroke="${p.line}" stroke-width=".4"/>
        <rect x="-4.2" y="-38.6" width="5.4" height="7.4" rx="2.4" fill="${AKANE}" stroke="${p.line}" stroke-width=".45"/>
        <path d="M-4.2,-36.4 H1.2 M-4.2,-33.4 H1.2" stroke="${p.line}" stroke-width=".3"/>`;
    }
    return '';
  }

  // マップ・ガレージ用の列車トークン：<g> の中身（1両目は原点、2両目は別の <g> で後ろに置く）
  // 影は紙に落ちるうすい楕円だけ（ドロップシャドウは使わない）
  const shadow = '<ellipse cx="0" cy="1" rx="58" ry="2.4" fill="#2C2523" opacity=".14"/>';
  function trainSvg(liveryId = equipped().livery) {
    return `<g class="tr-car tr-${liveryId}">${shadow}${frontCar(liveryId)}</g>`;
  }
  function carriageSvg(carriageId = equipped().carriage, liveryId = equipped().livery) {
    if (!carriageId || carriageId === 'none') return '';
    return `<g class="tr-car tr-carriage tr-${carriageId}">${shadow}${carriageCar(carriageId, liveryId)}</g>`;
  }
  // 煙・湯けむりの出る位置（1両目の座標）：蒸気機関車は真鍮の煙突、ほかは屋根の排気筒
  const chimney = (liveryId) => (liveryId === 'caldera' ? [44.5, -55] : [-17, -52]);

  // ---------- トレイル（走ったあとに浮かぶもの） ----------
  // 原色はやめ、生成り・真鍮・金箔の淡い粒と細い線にする。layer の (x, y) に1つ浮かべて、
  // アニメーションが終わったら消す。dir は進行方向（1 右 / −1 左）
  const NS = 'http://www.w3.org/2000/svg';
  const LEAFC = ['#E6C665', '#FAF0CA', '#D4AF37'];
  const leafPath = (c) => `<path d="M0,-5 Q4.2,-1.4 0,5 Q-4.2,-1.4 0,-5 Z" fill="${c}" fill-opacity=".85" stroke="${BRASS}" stroke-width=".5"/><path d="M0,-4 V4.2 M0,-1 L1.8,-2.6 M0,1.4 L-1.8,-.2" stroke="${BRASS}" stroke-width=".4" fill="none"/>`;
  const starPath = (s, c) => `<path d="M0,${n1(-s)} C${n1(s * 0.14)},${n1(-s * 0.14)} ${n1(s * 0.14)},${n1(-s * 0.14)} ${n1(s)},0 C${n1(s * 0.14)},${n1(s * 0.14)} ${n1(s * 0.14)},${n1(s * 0.14)} 0,${n1(s)} C${n1(-s * 0.14)},${n1(s * 0.14)} ${n1(-s * 0.14)},${n1(s * 0.14)} ${n1(-s)},0 C${n1(-s * 0.14)},${n1(-s * 0.14)} ${n1(-s * 0.14)},${n1(-s * 0.14)} 0,${n1(-s)} Z" fill="${c}" stroke="${BRASS}" stroke-width=".35"/>`;
  const puffPath = (s) => `<g fill="#FBF8F2" fill-opacity=".9" stroke="#B8A68E" stroke-width=".45"><circle cx="${n1(-s * 0.7)}" cy="${n1(s * 0.35)}" r="${n1(s * 0.6)}"/><circle cx="${n1(s * 0.8)}" cy="${n1(s * 0.3)}" r="${n1(s * 0.7)}"/><circle r="${n1(s)}"/></g><path d="M${n1(-s * 0.5)},${n1(-s * 0.2)} q${n1(s * 0.5)},${n1(-s * 0.5)} ${n1(s)},0" fill="none" stroke="#B8A68E" stroke-width=".35"/>`;
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
      fx.innerHTML = leafPath(LEAFC[Math.floor(r * 3)]);
    } else if (trailId === 'steam') {
      fx.innerHTML = `<path d="M0,0 q-4,-5 0,-10 t0,-10" fill="none" stroke="#B8A68E" stroke-width="2.6" stroke-linecap="round" opacity=".35"/><path d="M0,0 q-4,-5 0,-10 t0,-10" fill="none" stroke="#FBF8F2" stroke-width="1.2" stroke-linecap="round"/>`;
    } else if (trailId === 'stardust') {
      fx.innerHTML = r > 0.4 ? starPath(2.6 + r * 2.6, r > 0.7 ? '#D4AF37' : '#E6C665') : `<circle r="${(0.9 + r * 1.2).toFixed(2)}" fill="#FAF0CA" stroke="${BRASS}" stroke-width=".35"/>`;
    } else {
      fx.innerHTML = puffPath(3.6 + r * 2.6);
    }
    g.appendChild(fx);
    layer.appendChild(g);
    setTimeout(() => g.remove(), 1700);
  }

  // ---------- 旅の紋章（革の旅行鞄と真鍮の懐中時計） ----------
  // 人の顔や体は描かない（2026年10月の依頼で、旅人の肖像をやめて紋章にした）。
  // 真鍮の細い二重線の丸の中に、革のトランク（ベルト・留め金・持ち手・角の金具）と、前に重なる懐中時計（文字盤・針・竜頭・鎖）。
  // 装備スロットの意味：outfit＝鞄の革／hat＝鞄の札（タグ）／buddy＝鞄の根付。id・価格・保存データの形は着せ替えの頃のまま。
  // 塗りはフラット（グラデーションは使わない）。色は革の色と真鍮・生成り・インクに絞る。
  // viewBox は 0 0 120 140（丸の中心 60,64・半径52、下に真鍮のリボン）。crop: true は丸だけを切り出し（4 8 112 112）、
  // ランキングの約24pxの丸でも鞄と時計の形がわかるよう、縫い目・目盛り・ビーズ・文字の線を省いて、輪とふちの線を太くする。
  const GOLD_DK = '#8A6A12'; // 真鍮の陰の線（金具・時計の縁）
  const IVORY = '#FAF6F0';
  const EC = { x: 60, y: 64, r: 52, r2: 48.5 }; // 紋章の丸
  // 鞄の革：body 胴・lid ふた・belt ベルト・line ふちの線・stitch 縫い目（tuxedo だけ、ふちとふたの継ぎ目を金で縁取る）
  const LEATHER = {
    canvas: { body: '#E6DAC0', lid: '#D9CAA8', belt: '#7A5235', line: '#5A4E45', stitch: '#8A7D70', so: 0.9 },
    blazer: { body: '#2C5142', lid: '#234236', belt: '#4A3525', line: '#16291F', stitch: GOLD, so: 0.75 },
    yukata: { body: '#2E4A6E', lid: '#253D5D', belt: '#4A3525', line: '#18263A', stitch: '#F3ECE1', so: 0.7 },
    tuxedo: { body: '#1E1A18', lid: '#2A2420', belt: '#3A322B', line: GOLD, stitch: GOLD, so: 0.85, gilt: true },
  };
  const leather = (o) => LEATHER[o] || LEATHER.canvas;
  // トランクの寸法（紋章の座標）。札は持ち手の左の金具に、根付は底の真鍮の環に、時計の鎖は持ち手の右の金具につなぐ。
  // 持ち手と札で上に重さが寄るので、胴は丸の中心より少し下に置く
  const TK = { x0: 22, x1: 90, y0: 44, y1: 86, lid: 56, hx: 56 };
  const BELTS = [33, 74]; // ベルトの左の端（幅5）

  // 革のトランク。detail＝false で縫い目・ベルトの穴・鍵穴を省く
  function trunk(o, detail = true) {
    const p = leather(o);
    const { x0, x1, y0, y1, lid, hx } = TK;
    const w = x1 - x0, h = y1 - y0;
    const sw = detail ? 1 : 1.8;
    // 角の金具：L字に回りこむ真鍮の当て金（丸い鋲を1つ）
    const corner = (cx, cy, sx, sy) => `<path d="M${cx},${cy + sy * 7} V${cy + sy * 2.2} Q${cx},${cy} ${cx + sx * 2.2},${cy} H${cx + sx * 7} L${cx + sx * 7},${cy + sy * 2.4} H${cx + sx * 2.4} V${cy + sy * 7} Z" fill="${GOLD}" stroke="${GOLD_DK}" stroke-width=".5"/>${detail ? `<circle cx="${cx + sx * 3.6}" cy="${cy + sy * 3.6}" r=".7" fill="${GOLD_DK}"/>` : ''}`;
    const belt = (bx) => `<rect x="${bx}" y="${y0}" width="5" height="${h}" fill="${p.belt}"/>
      <path d="M${bx},${y0} V${y1} M${bx + 5},${y0} V${y1}" stroke="${p.gilt ? GOLD : p.line}" stroke-width=".5" opacity=".8"/>
      <rect x="${bx - 1.2}" y="${lid + 3}" width="7.4" height="6" rx=".6" fill="none" stroke="${GOLD}" stroke-width="${detail ? 1.1 : 1.6}"/>
      ${detail ? `<path d="M${bx + 2.5},${lid + 3.6} V${lid + 8.4}" stroke="${GOLD}" stroke-width=".7"/>${[0, 1, 2].map((k) => `<circle cx="${bx + 2.5}" cy="${lid + 14 + k * 4}" r=".55" fill="${p.line === GOLD ? '#14110F' : p.line}" opacity=".8"/>`).join('')}` : ''}`;
    return `<g class="em-trunk">
      <path d="M${hx - 8},${y0 + 0.5} V${y0 - 3.6} Q${hx - 8},${y0 - 9} ${hx - 2.6},${y0 - 9} H${hx + 2.6} Q${hx + 8},${y0 - 9} ${hx + 8},${y0 - 3.6} V${y0 + 0.5}" fill="none" stroke="${p.belt}" stroke-width="3"/>
      ${detail ? `<path d="M${hx - 6.2},${y0 - 4} Q${hx - 6.2},${y0 - 7.4} ${hx - 2.6},${y0 - 7.4} H${hx + 2.6} Q${hx + 6.2},${y0 - 7.4} ${hx + 6.2},${y0 - 4}" fill="none" stroke="${p.gilt ? GOLD : IVORY}" stroke-width=".35" opacity=".55"/>` : ''}
      <rect x="${hx - 10.4}" y="${y0 - 2.2}" width="4.6" height="2.8" fill="${GOLD}" stroke="${GOLD_DK}" stroke-width=".5"/><rect x="${hx + 5.8}" y="${y0 - 2.2}" width="4.6" height="2.8" fill="${GOLD}" stroke="${GOLD_DK}" stroke-width=".5"/>
      <rect x="${x0}" y="${y0}" width="${w}" height="${h}" rx="2.4" fill="${p.body}"/>
      <path d="M${x0},${lid} V${y0 + 2.4} Q${x0},${y0} ${x0 + 2.4},${y0} H${x1 - 2.4} Q${x1},${y0} ${x1},${y0 + 2.4} V${lid} Z" fill="${p.lid}"/>
      ${detail ? `<rect x="${x0 + 2.2}" y="${y0 + 2.2}" width="${w - 4.4}" height="${lid - y0 - 4.4}" rx="1" fill="none" stroke="${p.stitch}" stroke-width=".45" stroke-dasharray="1.4 1" opacity="${p.so}"/>
      <rect x="${x0 + 2.2}" y="${lid + 2.2}" width="${w - 4.4}" height="${y1 - lid - 4.4}" rx="1" fill="none" stroke="${p.stitch}" stroke-width=".45" stroke-dasharray="1.4 1" opacity="${p.so}"/>` : ''}
      ${BELTS.map(belt).join('')}
      <path d="M${x0},${lid} H${x1}" stroke="${p.line}" stroke-width="${p.gilt ? 0.9 : 0.8}"/>
      <rect x="${x0}" y="${y0}" width="${w}" height="${h}" rx="2.4" fill="none" stroke="${p.line}" stroke-width="${sw}"/>
      ${corner(x0, y0, 1, 1)}${corner(x1, y0, -1, 1)}${corner(x0, y1, 1, -1)}${corner(x1, y1, -1, -1)}
      <rect x="${hx - 3.6}" y="${lid - 3.4}" width="7.2" height="7.4" rx=".8" fill="${GOLD}" stroke="${GOLD_DK}" stroke-width=".55"/>
      ${detail ? `<circle cx="${hx}" cy="${lid + 0.6}" r=".9" fill="${GOLD_DK}"/><path d="M${hx},${lid + 1} V${lid + 2.6}" stroke="${GOLD_DK}" stroke-width=".7"/>` : ''}
    </g>`;
  }

  // ---------- 鞄の形（bag のスロット。2026年10月に追加） ----------
  // トランクのほかに、バックパッカーのリュック・ボストンバッグ・肩掛けのサコッシュ・風呂敷包み。色は「鞄の革」（outfit）の色を使う。
  // どの形も、札（tag）・時計の鎖（chain）・根付（charm）をつなぐ場所を持つ（BAG_AT）。塗りはフラット、線はトランクと同じ太さ。
  const BAG_AT = {
    trunk: { tag: [TK.hx - 8, TK.y0 - 2], chain: [TK.hx + 8, TK.y0 - 0.6], charm: [44, TK.y1] },
    backpack: { tag: [52, 31], chain: [60, 31], charm: [44, 88] },
    boston: { tag: [47, 41], chain: [66, 41], charm: [44, 86] },
    sacoche: { tag: [40, 43], chain: [78, 43], charm: [44, 88] },
    furoshiki: { tag: [50, 44], chain: [65, 44], charm: [44, 88] },
  };
  const bagAt = (b) => BAG_AT[b] || BAG_AT.trunk;
  function bagArt(b, o, detail = true) {
    const p = leather(o);
    const sw = detail ? 1 : 1.8;
    const stitch = (d) => (detail ? `<path d="${d}" fill="none" stroke="${p.stitch}" stroke-width=".45" stroke-dasharray="1.4 1" opacity="${p.so}"/>` : '');
    const buckle = (x, y) => `<rect x="${x - 2.6}" y="${y - 2}" width="5.2" height="4" rx=".6" fill="none" stroke="${GOLD}" stroke-width="${detail ? 1 : 1.5}"/>`;
    if (b === 'backpack') {
      // バックパッカーのリュック：丸い肩の胴に、かぶせのふた・2本のベルトと真鍮の尾錠・前のポケット・上の持ち手。両わきに肩ベルト
      return `<g class="em-bag em-backpack">
        <path d="M30,50 C23,58 23,76 29,84 M82,50 C89,58 89,76 83,84" fill="none" stroke="${p.belt}" stroke-width="${detail ? 3 : 4}"/>
        <path d="M52,33 V28 Q52,25 55,25 H57 Q60,25 60,28 V33" fill="none" stroke="${p.belt}" stroke-width="2.6"/>
        <path d="M30,46 Q30,34 42,32 H70 Q82,34 82,46 V84 Q82,88 78,88 H34 Q30,88 30,84 Z" fill="${p.body}"/>
        <path d="M31,46 Q31,35 42,33.5 H70 Q81,35 81,46 V56 Q81,58.5 78.5,58.5 H33.5 Q31,58.5 31,56 Z" fill="${p.lid}"/>
        ${stitch('M34,46 Q34,38 43,36.6 H69 Q78,38 78,46 V55.4 H34 Z')}
        <rect x="40" y="56" width="4.4" height="13" fill="${p.belt}"/><rect x="67.6" y="56" width="4.4" height="13" fill="${p.belt}"/>
        ${buckle(42.2, 63)}${buckle(69.8, 63)}
        <rect x="37" y="70" width="38" height="15" rx="3" fill="${p.lid}" stroke="${p.line}" stroke-width=".7"/>
        ${stitch('M39.4,72.4 H72.6 V82.6 H39.4 Z')}
        <path d="M37,74.4 H75" stroke="${p.line}" stroke-width=".5" opacity=".7"/>
        <path d="M30,46 Q30,34 42,32 H70 Q82,34 82,46 V84 Q82,88 78,88 H34 Q30,88 30,84 Z" fill="none" stroke="${p.line}" stroke-width="${sw}"/>
        <path d="M31,58.5 H81" stroke="${p.line}" stroke-width=".7"/>
      </g>`;
    }
    if (b === 'boston') {
      // ボストンバッグ：横長の胴に、上のファスナー（真鍮の点線）・両はしの丸い当て革・弧の持ち手2本
      return `<g class="em-bag em-boston">
        <path d="M45,47 Q45,31 56.5,31 Q68,31 68,47" fill="none" stroke="${p.belt}" stroke-width="3"/>
        <path d="M49,47 Q49,35 56.5,35 Q64,35 64,47" fill="none" stroke="${p.belt}" stroke-width="2.2" opacity=".85"/>
        <path d="M21,60 Q21,47 33,47 H87 Q99,47 99,60 V80 Q99,86 93,86 H27 Q21,86 21,80 Z" fill="${p.body}"/>
        <path d="M27,51 Q33,49 40,49 H80 Q87,49 93,51" fill="none" stroke="${GOLD}" stroke-width="${detail ? 1.2 : 1.6}" stroke-dasharray="${detail ? '1.2 1' : '2 1.4'}"/>
        <ellipse cx="26" cy="68" rx="5" ry="13" fill="${p.lid}" stroke="${p.line}" stroke-width=".7"/><ellipse cx="94" cy="68" rx="5" ry="13" fill="${p.lid}" stroke="${p.line}" stroke-width=".7"/>
        <rect x="42" y="47" width="5" height="39" fill="${p.belt}"/><rect x="66" y="47" width="5" height="39" fill="${p.belt}"/>
        ${stitch('M31,56 H89 M31,80 H89')}
        <path d="M21,60 Q21,47 33,47 H87 Q99,47 99,60 V80 Q99,86 93,86 H27 Q21,86 21,80 Z" fill="none" stroke="${p.line}" stroke-width="${sw}"/>
      </g>`;
    }
    if (b === 'sacoche') {
      // 肩掛けのサコッシュ：薄い胴にかぶせのふたと真鍮のホック。上を長い肩ひもが弧を描いて越える
      return `<g class="em-bag em-sacoche">
        <path d="M33,58 C33,30 83,30 83,58" fill="none" stroke="${p.belt}" stroke-width="${detail ? 2.6 : 3.6}"/>
        ${detail ? `<path d="M33,58 C33,30 83,30 83,58" fill="none" stroke="${p.stitch}" stroke-width=".4" stroke-dasharray="1.2 1" opacity="${p.so}"/>` : ''}
        <rect x="29" y="56" width="58" height="32" rx="4" fill="${p.body}"/>
        <path d="M29,60 Q29,56 33,56 H83 Q87,56 87,60 V71 Q58,78 29,71 Z" fill="${p.lid}"/>
        ${stitch('M32,60 H84 V69.4 Q58,75.6 32,69.4 Z')}
        <circle cx="58" cy="73" r="2.6" fill="${GOLD}" stroke="${GOLD_DK}" stroke-width=".5"/>
        <rect x="29" y="56" width="58" height="32" rx="4" fill="none" stroke="${p.line}" stroke-width="${sw}"/>
        <rect x="30.6" y="54.6" width="4.4" height="4" fill="${GOLD}" stroke="${GOLD_DK}" stroke-width=".4"/><rect x="81" y="54.6" width="4.4" height="4" fill="${GOLD}" stroke="${GOLD_DK}" stroke-width=".4"/>
      </g>`;
    }
    if (b === 'furoshiki') {
      // 風呂敷包み：四角い包みに、上で結んだ二つの耳。地に細い唐草の線（革の色の縫い目の色で）
      const vine = detail
        ? `<path d="M34,62 c4,-5 9,-5 11,0 s7,5 11,0 s7,-5 11,0 s7,5 11,0 M34,76 c4,-5 9,-5 11,0 s7,5 11,0 s7,-5 11,0 s7,5 11,0" fill="none" stroke="${p.stitch}" stroke-width=".6" opacity="${p.so}"/>`
        : '';
      return `<g class="em-bag em-furoshiki">
        <path d="M28,58 Q28,47 40,46 H80 Q92,47 92,58 V80 Q92,88 84,88 H36 Q28,88 28,80 Z" fill="${p.body}"/>
        ${vine}
        <path d="M44,47 L58,58 L72,47" fill="none" stroke="${p.line}" stroke-width=".7" opacity=".7"/>
        <path d="M28,58 Q28,47 40,46 H80 Q92,47 92,58 V80 Q92,88 84,88 H36 Q28,88 28,80 Z" fill="none" stroke="${p.line}" stroke-width="${sw}"/>
        <path d="M57.5,45 C50,44 44,38 46,32 C51,34 55,39 57.5,45 Z" fill="${p.lid}" stroke="${p.line}" stroke-width=".7"/>
        <path d="M58.5,45 C66,44 72,38 70,32 C65,34 61,39 58.5,45 Z" fill="${p.lid}" stroke="${p.line}" stroke-width=".7"/>
        <ellipse cx="58" cy="46" rx="4.2" ry="3" fill="${p.belt}" stroke="${p.line}" stroke-width=".6"/>
      </g>`;
    }
    return trunk(o, detail);
  }

  // 真鍮の懐中時計（中心 cx,cy・半径 r）。針は10時8分（時計の広告の決まりの、いちばん形の見える角度）
  function watch(cx, cy, r, detail = true) {
    const hand = (deg, len, wd) => {
      const a = ((deg - 90) * Math.PI) / 180;
      return `<path d="M${cx},${cy} L${n1(cx + Math.cos(a) * len)},${n1(cy + Math.sin(a) * len)}" stroke="${INK}" stroke-width="${wd}" stroke-linecap="round"/>`;
    };
    const ticks = detail
      ? Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2, big = i % 3 === 0;
          const r1 = r * 0.7, r2 = r * (big ? 0.56 : 0.62);
          return `M${n1(cx + Math.cos(a) * r1)},${n1(cy + Math.sin(a) * r1)}L${n1(cx + Math.cos(a) * r2)},${n1(cy + Math.sin(a) * r2)}`;
        }).join('')
      : '';
    return `<g class="em-watch">
      <circle cx="${cx}" cy="${n1(cy - r - 3.4)}" r="2.6" fill="none" stroke="${GOLD}" stroke-width="${detail ? 1.3 : 1.8}"/>
      <rect x="${n1(cx - 2.2)}" y="${n1(cy - r - 1.6)}" width="4.4" height="2.4" rx=".6" fill="${GOLD}" stroke="${GOLD_DK}" stroke-width=".5"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="${GOLD}" stroke="${GOLD_DK}" stroke-width="${detail ? 0.7 : 1.2}"/>
      <circle cx="${cx}" cy="${cy}" r="${n1(r * 0.8)}" fill="${IVORY}" stroke="${GOLD_DK}" stroke-width=".5"/>
      ${detail ? `<circle cx="${cx}" cy="${cy}" r="${n1(r * 0.74)}" fill="none" stroke="${INK3}" stroke-width=".3"/><path d="${ticks}" stroke="${INK}" stroke-width=".55" fill="none"/>` : ''}
      ${hand(300, r * 0.42, detail ? 1.1 : 1.6)}${hand(48, r * 0.6, detail ? 0.75 : 1.2)}
      <circle cx="${cx}" cy="${cy}" r="${detail ? 0.9 : 1.3}" fill="${INK}"/>
    </g>`;
  }
  // 時計の鎖：持ち手の右の金具から竜頭の輪まで、たるんで垂れる真鍮の小さな輪の連なり（点線の丸い端で描く）
  const chain = (x1, y1, x2, y2, detail = true) => `<path d="M${x1},${y1} C${x1 + 10},${y1 + 4} ${x2 + 7},${y2 - 6} ${x2},${y2}" fill="none" stroke="${GOLD}" stroke-width="${detail ? 1.1 : 1.6}" stroke-dasharray="${detail ? '.1 1.7' : '.1 2.2'}" stroke-linecap="round"/>`;

  // 鞄の札（hat のスロット）。ひもの付け根を原点に、下へ垂れる形（呼ぶ側で傾ける）
  function tagArt(h, detail = true) {
    const hole = (fill) => `<circle cx="0" cy="8.6" r="1.7" fill="${fill}" stroke="${GOLD_DK}" stroke-width=".5"/><circle cx="0" cy="8.6" r=".7" fill="#F4EFE6"/>`;
    const tagPath = 'M-5.4,9 L-2.6,5.6 H2.6 L5.4,9 V24 Q5.4,25 4.4,25 H-4.4 Q-5.4,25 -5.4,24 Z';
    if (h === 'conductor') {
      // 真鍮の札：角を丸めた細長い板に、彫りの細い枠と鋲。小さな輪の鎖で吊る
      return `<path d="M0,0 V7" stroke="${GOLD}" stroke-width="1" stroke-dasharray=".1 1.5" stroke-linecap="round"/>
        <rect x="-4.6" y="6" width="9.2" height="19" rx="4.6" fill="${GOLD}" stroke="${GOLD_DK}" stroke-width="${detail ? 0.6 : 1}"/>
        ${detail ? `<rect x="-3.3" y="11.4" width="6.6" height="11.6" rx="3.3" fill="none" stroke="${GOLD_DK}" stroke-width=".4"/><path d="M-1.8,15.6 H1.8 M-1.8,18 H1.8" stroke="${GOLD_DK}" stroke-width=".45"/>` : ''}
        <circle cx="0" cy="8.6" r="1.1" fill="#F4EFE6" stroke="${GOLD_DK}" stroke-width=".5"/>`;
    }
    if (h === 'tenugui') {
      // 手ぬぐいの結び：持ち手に結んだ白い木綿の、結び目と二本のはし（藍の細い縞）
      return `<path d="M-1.2,1.6 C-3.6,7 -5.6,13 -9.4,18.6 L-4.8,20.2 C-2.4,14.4 -0.6,8.6 1.2,2.6 Z" fill="#F6F3EC" stroke="#2E4A6E" stroke-width=".7"/>
        <path d="M1,1.8 C3,6 4.6,10.6 5.4,15.4 L9.2,13.8 C7.6,9.6 5.2,5.4 2.6,1.2 Z" fill="#F6F3EC" stroke="#2E4A6E" stroke-width=".7"/>
        ${detail ? '<path d="M-2.2,6 C-4,11 -5.6,14.4 -7.8,18.4 M3.4,5.8 C4.8,8.8 6,11.4 6.8,14.4" fill="none" stroke="#2E4A6E" stroke-width=".55"/><path d="M-9.4,18.6 L-4.8,20.2 M5.4,15.4 L9.2,13.8" stroke="#2E4A6E" stroke-width=".9"/>' : ''}
        <ellipse cx="0" cy="1.4" rx="3.4" ry="2.6" fill="#F6F3EC" stroke="#2E4A6E" stroke-width=".8"/>
        ${detail ? '<path d="M-1.8,.4 Q0,2.6 1.8,.4" fill="none" stroke="#2E4A6E" stroke-width=".45"/>' : ''}`;
    }
    if (h === 'kinghat') {
      // 金の王冠の札：金箔の荷札に、真鍮の陰の色で王冠のシルエット。ひもは茜の組紐
      return `<path d="M0,0 C-1.6,2.6 1.6,5 0,7.4" fill="none" stroke="${AKANE}" stroke-width="1"/>
        <path d="${tagPath}" fill="#D4AF37" stroke="${GOLD_DK}" stroke-width="${detail ? 0.6 : 1}"/>
        ${detail ? `<path d="M-4,10.4 L-2.2,7.2 H2.2 L4,10.4 V23.6 H-4 Z" fill="none" stroke="${GOLD_DK}" stroke-width=".35"/>` : ''}
        <path d="M-3.4,20.4 V15 L-1.7,17.2 L0,13.8 L1.7,17.2 L3.4,15 V20.4 Z" fill="${GOLD_DK}"/>
        ${detail ? `<path d="M-3.4,21.8 H3.4" stroke="${GOLD_DK}" stroke-width=".7"/><circle cx="0" cy="13.2" r=".6" fill="${GOLD_DK}"/>` : ''}
        ${hole('#D4AF37')}`;
    }
    // 麻ひもの荷札（初期）：生成りの厚紙に、ペンの書きつけ2行。ひもは麻の撚り
    return `<path d="M0,0 C-1.4,2.4 1.4,5 0,7.6" fill="none" stroke="#9C7A4F" stroke-width="1"/>
      ${detail ? '<path d="M0,0 C1.4,2.6 -1.2,5 .4,7.6" fill="none" stroke="#C4A574" stroke-width=".5"/>' : ''}
      <path d="${tagPath}" fill="#E9DBBA" stroke="#7A5A2E" stroke-width="${detail ? 0.6 : 1}"/>
      ${detail ? `<path d="M-3.2,15 H3.2 M-3.2,18 H2 M-3.2,21 H2.6" stroke="${INK3}" stroke-width=".45"/>` : ''}
      ${hole('#E9DBBA')}`;
  }

  // 鞄の根付（buddy のスロット）。ベルトの下の付け根を原点に、組紐と玉の下に吊る
  function charmArt(b, detail = true) {
    if (!b || b === 'none') return '';
    const cord = `<path d="M0,0 V5.6" stroke="${AKANE}" stroke-width="${detail ? 0.9 : 1.3}"/><circle cx="0" cy="6.2" r="${detail ? 1.3 : 1.6}" fill="${AKANE}"/>`;
    if (b === 'camera') {
      // 二眼レフ：インクの箱に、上下に並んだふたつのレンズ（真鍮の縁）と、上のフード
      return `${cord}<rect x="-3.8" y="7.6" width="7.6" height="1.6" fill="${INK2}"/>
        <rect x="-5" y="9" width="10" height="13.4" rx=".9" fill="${INK}"/>
        <circle cx="0" cy="12.6" r="2.2" fill="#3A322B" stroke="${GOLD}" stroke-width=".7"/>
        <circle cx="0" cy="18.2" r="2.8" fill="#3A322B" stroke="${GOLD}" stroke-width=".8"/>
        ${detail ? `<circle cx="-.7" cy="17.5" r=".6" fill="${IVORY}" opacity=".7"/><circle cx="3.3" cy="10.4" r=".55" fill="${GOLD}"/>` : ''}`;
    }
    if (b === 'bento') {
      // 曲げわっぱ：杉の側板と楕円のふた、茜の掛け紐
      return `${cord}<path d="M-7,11.6 V18.4 C-7,21.4 7,21.4 7,18.4 V11.6 Z" fill="#C9A26B" stroke="#7A5A2E" stroke-width=".6"/>
        ${detail ? '<path d="M-4.4,13.4 V20 M-1.4,13.8 V20.6 M3.6,13.4 V20.2" stroke="#7A5A2E" stroke-width=".3" opacity=".7"/>' : ''}
        <ellipse cx="0" cy="11.6" rx="7" ry="2.6" fill="#DDBE88" stroke="#7A5A2E" stroke-width=".6"/>
        <path d="M1.2,9 V20.8" stroke="${AKANE}" stroke-width="${detail ? 0.9 : 1.2}"/>`;
    }
    if (b === 'cat') {
      // 三毛猫の見習い駅長：座った猫のシルエット（インク）に、茜の小さな駅長帽と、胸の白い毛・背の三毛のぶち
      return `${cord}<g>
        <path d="M5,22 C9.4,21.8 10,17 7.4,15.4" fill="none" stroke="${INK}" stroke-width="1.3" stroke-linecap="round"/>
        <path d="M-2.8,14.2 C-6.4,15.6 -6.8,20.4 -5.8,22.6 H5.8 C6.8,20.4 6.4,15.6 2.8,14.2 Z" fill="${INK}"/>
        <path d="M-3.6,11 L-3.4,7.2 L-1,9.4 Z M3.6,11 L3.4,7.2 L1,9.4 Z" fill="${INK}"/>
        <circle cx="0" cy="11.6" r="3.7" fill="${INK}"/>
        ${detail ? `<path d="M-1.6,16.4 Q0,15.4 1.6,16.4 L1,21 H-1 Z" fill="${IVORY}"/><path d="M3.2,16 C5,16.8 5.6,18.6 5.2,20.4 C4,19.6 3.4,18 3.2,16 Z" fill="#B8742F"/>` : ''}
        <path d="M-2.6,8.6 Q0,6.6 2.6,8.6 V9.4 H-2.6 Z" fill="${AKANE}"/><path d="M-3,9.4 H1.4" stroke="${GOLD}" stroke-width=".6"/>
      </g>`;
    }
    return '';
  }

  // 札の吊り位置と傾き（tenugui は持ち手に結ぶので傾けない）
  const tagAt = (h, b) => `translate(${bagAt(b).tag[0]} ${bagAt(b).tag[1]}) rotate(${h === 'tenugui' ? 0 : 42})`;
  // 根付は胴の底の左寄り（左のベルトと留め金のあいだ）。丸の内側に収まるよう少し小さく吊る
  const CHARM = { x: 44, y: TK.y1, s: 0.9 };
  const charmAt = (b) => `translate(${bagAt(b).charm[0]} ${bagAt(b).charm[1]}) scale(${CHARM.s})`;
  const WATCH = { x: 79, y: 85, r: 14.4 };

  function avatarSvg(eq = equipped(), { crop = false, id = 'av' } = {}) {
    const d = !crop;
    const clip = uid(`${id}-em`);
    const vb = crop ? '4 8 112 112' : '0 0 120 140';
    // 外の輪のビーズ（硬貨のふちのような小さな粒）。小さいときは省く
    const beads = d
      ? Array.from({ length: 40 }, (_, i) => {
          const a = (i / 40) * Math.PI * 2, rr = (EC.r + EC.r2) / 2;
          return `<circle cx="${n1(EC.x + Math.cos(a) * rr)}" cy="${n1(EC.y + Math.sin(a) * rr)}" r=".5"/>`;
        }).join('')
      : '';
    // 下の真鍮のリボン（全身のときだけ）：生成りの帯に金の細線と、三つの菱形
    const ribbon = d
      ? `<g class="em-ribbon">
        <path d="M30,115 H19 L22.6,120.6 L19,126.2 H32 Z M90,115 H101 L97.4,120.6 L101,126.2 H88 Z" fill="#EDE4D4" stroke="${GOLD}" stroke-width=".8"/>
        <path d="M30,113 Q60,117.4 90,113 V124.6 Q60,129 30,124.6 Z" fill="${IVORY}" stroke="${GOLD}" stroke-width="1"/>
        <path d="M32.6,115.6 Q60,119.8 87.4,115.6 M32.6,122.2 Q60,126.4 87.4,122.2" fill="none" stroke="${GOLD}" stroke-width=".4"/>
        ${[48, 60, 72].map((x) => `<path d="M${x},${x === 60 ? 116.8 : 116.4} l1.8,2.6 -1.8,2.6 -1.8,-2.6 Z" fill="${GOLD}"/>`).join('')}
        <path d="M38,119.2 H44 M76,119.2 H82" stroke="${GOLD}" stroke-width=".45"/>
      </g>`
      : '';
    return `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" class="avatar-svg emblem-svg" aria-hidden="true" stroke-linecap="round" stroke-linejoin="round">
      <defs><clipPath id="${clip}"><circle cx="${EC.x}" cy="${EC.y}" r="${EC.r2 - 0.6}"/></clipPath></defs>
      <circle cx="${EC.x}" cy="${EC.y}" r="${EC.r}" fill="#F4EFE6"/>
      <circle cx="${EC.x}" cy="${EC.y}" r="${EC.r2}" fill="${IVORY}"/>
      <g clip-path="url(#${clip})">
        ${bagArt(eq.bag, eq.outfit, d)}
        ${chain(bagAt(eq.bag).chain[0], bagAt(eq.bag).chain[1], WATCH.x, n1(WATCH.y - WATCH.r - 6), d)}
        ${watch(WATCH.x, WATCH.y, WATCH.r, d)}
        ${eq.buddy && eq.buddy !== 'none' ? `<path d="M${bagAt(eq.bag).charm[0] - 1.6},${bagAt(eq.bag).charm[1]} a1.6,1.6 0 0 0 3.2,0" fill="none" stroke="${GOLD}" stroke-width="${d ? 0.9 : 1.3}"/>` : ''}
        <g transform="${charmAt(eq.bag)}">${charmArt(eq.buddy, d)}</g>
        <g transform="${tagAt(eq.hat, eq.bag)}">${tagArt(eq.hat, d)}</g>
      </g>
      <circle cx="${EC.x}" cy="${EC.y}" r="${EC.r}" fill="none" stroke="${GOLD}" stroke-width="${d ? 1.25 : 3}"/>
      <circle cx="${EC.x}" cy="${EC.y}" r="${EC.r2}" fill="none" stroke="${GOLD}" stroke-width="${d ? 0.7 : 1.6}"/>
      ${d ? `<g fill="${GOLD}">${beads}</g>` : ''}
      ${ribbon}
    </svg>`;
  }

  // サムネイル（ガレージの一覧用）：線路の上の車両／止めた絵のトレイル／紋章のパーツだけを大きく（鞄の革・札・根付）
  function thumb(slot, id) {
    const eq = Object.assign({}, equipped());
    if (['livery', 'carriage'].includes(slot)) {
      const rail = `<g stroke="#6E5D4F" fill="none"><path d="M-66,.6 H66" stroke-width="1"/>${Array.from({ length: 12 }, (_, i) => `<path d="M${-62 + i * 11.4},.8 v2.6" stroke-width=".6"/>`).join('')}<path d="M-66,3.6 H66" stroke-width=".4" stroke="#B8A68E"/></g>`;
      const empty = `<g fill="none" stroke="#6E5D4F" stroke-width=".8"><path d="M-6,0 V-14 H6 V0 M-9,-14 H9 M-6,-9 H6"/><path d="M-9,-11.5 h-4 M9,-11.5 h4" stroke-width="1.6"/></g>
        <text x="0" y="-24" text-anchor="middle" font-size="9" letter-spacing="2" fill="#8A7D70" font-family="'Shippori Mincho', serif">1両で運行</text>`;
      const car = slot === 'livery' ? trainSvg(id) : carriageSvg(id, eq.livery) || empty;
      return `<svg viewBox="-66 -60 132 66" class="thumb-svg" aria-hidden="true">${rail}${car}</svg>`;
    }
    if (slot === 'trail') return trailArt(id);
    const svg = (vb, body) => `<svg viewBox="${vb}" class="thumb-svg thumb-emblem" aria-hidden="true" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
    // 下に敷く細い二重の罫（棚の板）。札と根付は、上の細い横木（持ち手の革・ベルトの端）から吊る
    const shelf = (x1, x2, y) => `<path d="M${x1},${y} H${x2}" stroke="#C8B9A6" stroke-width=".6"/><path d="M${x1 + 4},${y + 2} H${x2 - 4}" stroke="#C8B9A6" stroke-width=".35"/>`;
    if (slot === 'outfit') return svg('10 30 92 64', `${shelf(14, 98, TK.y1 + 3.4)}${bagArt(eq.bag, id)}`);
    if (slot === 'bag') return svg('12 20 96 74', `${shelf(16, 104, 91)}${bagArt(id, eq.outfit)}`);
    if (slot === 'hat') {
      return svg('-22 -6 44 34', `<path d="M-14,-1.6 H14" stroke="${leather(eq.outfit).belt}" stroke-width="3"/><rect x="-2.6" y="-3.2" width="5.2" height="3.2" fill="${GOLD}" stroke="${GOLD_DK}" stroke-width=".5"/>
        <g transform="translate(0 .2)${id === 'tenugui' ? ' scale(1.05)' : ''}">${tagArt(id)}</g>`);
    }
    const strap = `<rect x="-3" y="-8" width="6" height="8" fill="${leather(eq.outfit).belt}"/><path d="M-3,-8 V0 M3,-8 V0" stroke="${leather(eq.outfit).line}" stroke-width=".4"/><path d="M-15,-8 H15" stroke="#C8B9A6" stroke-width=".6"/>`;
    if (id === 'none') {
      return svg('-22 -8 44 32', `${strap}<circle cx="0" cy="2.2" r="2.2" fill="none" stroke="${GOLD}" stroke-width=".9"/>
        <text x="0" y="16" text-anchor="middle" font-size="5.4" letter-spacing="1.2" fill="#8A7D70" font-family="'Shippori Mincho', serif">根付なし</text>`);
    }
    return svg('-22 -8 44 32', `${strap}${charmArt(id)}`);
  }

  // トレイルのサムネイル：浮かぶものを止めた絵で（紙の地に、細い風の線）
  function trailArt(id) {
    let art;
    const wind = '<path d="M-34,6 C-18,-2 -2,10 14,2 S30,-2 36,2" fill="none" stroke="#B8A68E" stroke-width=".6" stroke-dasharray="2 2"/>';
    if (id === 'leaves') {
      art = [[-18, -6, 30, 0], [2, -14, -40, 1], [16, 4, 70, 2], [-4, 10, 140, 1], [-26, 12, -20, 2]]
        .map(([x, y, r, c]) => `<g transform="translate(${x} ${y}) rotate(${r}) scale(1.5)">${leafPath(LEAFC[c])}</g>`).join('') + wind;
    } else if (id === 'steam') {
      art = [-14, 0, 14].map((x, i) => `<path d="M${x},18 q-6,-7 0,-14 t0,-14 t0,-12" fill="none" stroke="#B8A68E" stroke-width="3.4" stroke-linecap="round" opacity=".35"/><path d="M${x},18 q-6,-7 0,-14 t0,-14 t0,-12" fill="none" stroke="#FBF8F2" stroke-width="1.6" stroke-linecap="round" opacity="${0.95 - i * 0.1}"/>`).join('')
        + '<path d="M-26,22 C-14,19 14,19 26,22" fill="none" stroke="#6E5D4F" stroke-width=".7"/><path d="M-20,24.4 C-8,22.6 8,22.6 20,24.4" fill="none" stroke="#B8A68E" stroke-width=".5"/>';
    } else if (id === 'stardust') {
      const star = (x, y, s, c) => `<g transform="translate(${x} ${y})">${starPath(s, c)}</g>`;
      art = star(-14, -6, 9, '#D4AF37') + star(10, -14, 6, '#E6C665') + star(16, 8, 8, '#D4AF37') + star(-4, 14, 5, '#FAF0CA') + star(-26, 12, 4, '#E6C665')
        + [[-24, -14], [24, -4], [4, 0], [-10, 20], [28, 18]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1" fill="#FAF0CA" stroke="#B8860B" stroke-width=".35"/>`).join('');
    } else {
      art = [[-14, 4, 8], [2, -4, 11], [16, 5, 8], [-26, 12, 5], [27, 12, 5]].map(([x, y, r]) => `<g transform="translate(${x} ${y})">${puffPath(r)}</g>`).join('') + wind;
    }
    const sky = Array.from({ length: 13 }, (_, i) => `<path d="M-40,${-28 + i * 4.6} H40" stroke="#C8B9A6" stroke-width=".35" opacity="${(0.65 - i * 0.04).toFixed(2)}"/>`).join('');
    return `<svg viewBox="-40 -30 80 60" class="thumb-svg thumb-trail" aria-hidden="true"><rect x="-40" y="-30" width="80" height="60" fill="#F4EFE6"/>${sky}${art}</svg>`;
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
