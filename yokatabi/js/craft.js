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

  // ---------- 絵の共通の道具 ----------
  // 色は SVG の属性に直接書く（シェアカードでは SVG を画像にして描くので、CSS の変数が届かない）
  const INK = '#2C2523'; // 万年筆のインク
  const INK2 = '#5A4E45';
  const INK3 = '#8A7D70';
  const PAPER = '#FBF8F2';
  const PAPER2 = '#F3ECE1';
  const PAPER3 = '#E9DFCF';
  const GOLD = '#C59B27'; // 細い金線
  const BRASS = '#B8860B';
  const AKANE = '#A8382B'; // アバターの差し色はこの1色だけ
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

  // ---------- 旅人アバター ----------
  // 万年筆のインクの線画のポートレート（胸から上）。インクの濃淡とハッチングに、差し色は茜の1色だけ。
  // viewBox 0 0 120 140。crop: true でヘッダー用に顔まわり（18 8 84 84）だけを切り出す。
  // ランキングの小さな丸（約26px）でも見分けられるよう、髪・帽子はインクの塊、顔の輪郭は太め（1.7）にする。
  const FACE = 'M60,27 C74.5,27 83.5,37.5 83,52.5 C82.5,66.5 73.5,78.5 60,79 C46.5,78.5 37.5,66.5 37,52.5 C36.5,37.5 45.5,27 60,27 Z';
  function avatarSvg(eq = equipped(), { crop = false, id = 'av' } = {}) {
    const vb = crop ? '18 8 84 84' : '0 0 120 140';
    return `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" class="avatar-svg" aria-hidden="true" stroke-linecap="round" stroke-linejoin="round">
      ${outfit(eq.outfit, id)}
      ${head(id)}
      ${hat(eq.hat, id)}
      ${crop ? '' : buddy(eq.buddy, id)}
    </svg>`;
  }
  function head(id) {
    return `<path d="M53,75 V89 Q60,93 67,89 V75" fill="${PAPER}" stroke="${INK}" stroke-width="1.3"/>
      ${hatch(`${id}-nk`, 'M53,76 H67 V86 Q60,82 53,86 Z', { step: 1.6, angle: 20, w: 0.4, op: 0.7 })}
      <path d="M37.6,50 C33,49 32.4,57 35.4,60.4 C36.6,61.8 38.2,62 39,61" fill="${PAPER}" stroke="${INK}" stroke-width="1.2"/>
      <path d="M82.4,50 C87,49 87.6,57 84.6,60.4 C83.4,61.8 81.8,62 81,61" fill="${PAPER}" stroke="${INK}" stroke-width="1.2"/>
      <path d="${FACE}" fill="${PAPER}" stroke="${INK}" stroke-width="1.7"/>
      ${hatch(`${id}-ch`, 'M74,58 C79,58 81.6,62 80.4,67 C78,72 74,75 70,76.6 C74,70 75,64 74,58 Z', { step: 1.5, angle: 60, w: 0.35, op: 0.55 })}
      <path d="M37.2,50 C35.4,33 46,23.6 60,23.6 C75,23.6 85,33.4 82.8,50 C81,43 77,38.4 70.5,36.4 C64,41.4 50,41 42.4,43.8 C40,45.6 38.4,47.6 37.2,50 Z" fill="${INK}"/>
      <path d="M45,32 C51,27.6 60,26.6 67,28.4 M47.4,36.4 C54,32.6 62,32 68.6,33.6 M72,30.6 C76,32.6 79,36 80.4,40" fill="none" stroke="${PAPER}" stroke-width=".45" opacity=".7"/>
      <path d="M43.4,49.2 Q48,46.4 53,48.4 M67,48.4 Q72,46.4 76.6,49.2" fill="none" stroke="${INK}" stroke-width="1.3"/>
      <path d="M44.2,55.6 Q48,52.8 52,55.4 M68,55.4 Q72,52.8 75.8,55.6" fill="none" stroke="${INK}" stroke-width="1"/>
      <circle cx="48.2" cy="56.6" r="1.7" fill="${INK}"/><circle cx="71.8" cy="56.6" r="1.7" fill="${INK}"/>
      <path d="M60.4,56 L58.4,64 Q59.6,65.6 62.4,64.6" fill="none" stroke="${INK}" stroke-width=".9"/>
      <path d="M54.6,70 Q60,72.8 65.4,70" fill="none" stroke="${INK}" stroke-width="1.15"/>
      <path d="M57.6,73.6 Q60,74.6 62.4,73.6" fill="none" stroke="${INK}" stroke-width=".55"/>`;
  }

  // 衣装：胴の形はどれも同じで、襟・生地の線・ハッチングで見分ける
  const TORSO = 'M19,140 C20,112 29,97 47,90 L60,95 L73,90 C91,97 100,112 101,140 Z';
  function outfit(o, id) {
    if (o === 'blazer') {
      // 深緑ブレザー：斜めの細いハッチングで中間の調子に。襟の折り返し・茜のタイ・金ボタンは白抜きの丸
      return `<path d="${TORSO}" fill="${PAPER3}" stroke="${INK}" stroke-width="1.4"/>
        ${hatch(`${id}-bz`, TORSO, { step: 1.7, angle: 55, w: 0.5, box: [0, 80, 120, 70] })}
        <path d="M50,90.5 L60,95 L70,90.5 L66,104 L60,110 L54,104 Z" fill="${PAPER}" stroke="${INK}" stroke-width=".9"/>
        <path d="M57.6,96 L60,99 L62.4,96 L60,94.6 Z M58.6,99 L61.4,99 L62.4,110 L60,113 L57.6,110 Z" fill="${AKANE}" stroke="${INK}" stroke-width=".5"/>
        <path d="M47,90 L41,96 L47,100 L44,104 L56,124 L60,110 L54,104 L50,90.5 Z" fill="${PAPER}" stroke="${INK}" stroke-width="1"/>
        <path d="M73,90 L79,96 L73,100 L76,104 L64,124 L60,110 L66,104 L70,90.5 Z" fill="${PAPER}" stroke="${INK}" stroke-width="1"/>
        ${hatch(`${id}-bl`, 'M47,90 L41,96 L47,100 L44,104 L56,124 L60,110 L54,104 L50,90.5 Z M73,90 L79,96 L73,100 L76,104 L64,124 L60,110 L66,104 L70,90.5 Z', { step: 1.3, angle: -35, w: 0.45, box: [30, 85, 60, 45] })}
        <path d="M60,110 V140" stroke="${INK}" stroke-width=".9"/>
        ${[124, 133].map((y) => `<circle cx="63.6" cy="${y}" r="1.8" fill="${PAPER}" stroke="${INK}" stroke-width=".8"/>`).join('')}
        <path d="M74,111 L84,109.6" stroke="${INK}" stroke-width="1.1"/>
        <path d="M80,105.6 L81.6,103 L83.2,105.6 L81.6,108 Z" fill="${PAPER}" stroke="${INK}" stroke-width=".6"/>`;
    }
    if (o === 'yukata') {
      // 浴衣に羽織：右前（見る側から、右肩から左下へ上前の襟）。浴衣は井桁の細い柄、羽織は濃いハッチング、帯は茜
      const haoriL = 'M19,140 C20,112 29,97 47,90 L51,92 L44,140 Z';
      const haoriR = 'M101,140 C100,112 91,97 73,90 L69,92 L76,140 Z';
      return `<path d="${TORSO}" fill="${PAPER}" stroke="${INK}" stroke-width="1.4"/>
        ${[[50, 112], [62, 104], [56, 122], [68, 120], [62, 134], [48, 130], [72, 132]].map(([x, y]) => `<path d="M${x - 2.4},${y - 1} h4.8 M${x - 2.4},${y + 1} h4.8 M${x - 1},${y - 2.4} v4.8 M${x + 1},${y - 2.4} v4.8" stroke="${INK2}" stroke-width=".45"/>`).join('')}
        <path d="M50,90.6 L60,106 L60,95 Z" fill="${PAPER2}" stroke="${INK}" stroke-width=".8"/>
        <path d="M70,90.6 L51,126" fill="none" stroke="${INK}" stroke-width="1.6"/><path d="M66.4,91.4 L49,124" fill="none" stroke="${INK}" stroke-width=".6"/>
        <path d="M44,124 L76,124 L76.6,132 L43.4,132 Z" fill="${AKANE}" stroke="${INK}" stroke-width=".8"/>
        <path d="M44,128 H76.4" stroke="${PAPER}" stroke-width=".4" opacity=".7"/>
        <path d="${haoriL}" fill="${INK2}" stroke="${INK}" stroke-width="1.2"/><path d="${haoriR}" fill="${INK2}" stroke="${INK}" stroke-width="1.2"/>
        ${hatch(`${id}-hl`, haoriL, { step: 1.6, angle: 75, color: INK, w: 0.5, box: [15, 85, 40, 60] })}${hatch(`${id}-hr`, haoriR, { step: 1.6, angle: 105, color: INK, w: 0.5, box: [65, 85, 40, 60] })}
        <path d="M51,92 L44,140 M69,92 L76,140" stroke="${PAPER}" stroke-width=".6"/>
        <circle cx="47" cy="110" r="1.5" fill="${PAPER}" stroke="${INK}" stroke-width=".6"/><circle cx="73" cy="110" r="1.5" fill="${PAPER}" stroke="${INK}" stroke-width=".6"/>
        <path d="M48.4,110.4 Q60,115 71.6,110.4" fill="none" stroke="${INK}" stroke-width=".7"/>`;
    }
    if (o === 'tuxedo') {
      // タキシード：インクの黒、拝絹の襟は白い細線のつやで。胸のひだ・飾りボタン・茜の蝶ネクタイ
      const lapL = 'M47,90 L42,97 L56,126 L60,113 L51,91.6 Z';
      const lapR = 'M73,90 L78,97 L64,126 L60,113 L69,91.6 Z';
      return `<path d="${TORSO}" fill="${INK}" stroke="${INK}" stroke-width="1.4"/>
        <path d="M51,91.6 L60,95 L69,91.6 L60,122 Z" fill="${PAPER}" stroke="${INK}" stroke-width=".8"/>
        ${[-3, 3].map((d) => `<path d="M${60 + d},100 L${60 + d * 0.5},115" stroke="${INK3}" stroke-width=".4"/>`).join('')}
        ${[103, 109].map((y) => `<circle cx="60" cy="${y}" r="1" fill="${INK}"/>`).join('')}
        <path d="${lapL}" fill="#3A322B" stroke="${PAPER}" stroke-width=".5"/><path d="${lapR}" fill="#3A322B" stroke="${PAPER}" stroke-width=".5"/>
        <path d="M45.6,96 L56.4,120 M74.4,96 L63.6,120" stroke="${PAPER}" stroke-width=".35" opacity=".6"/>
        <path d="M52.6,93.2 L59,96.4 L52.6,99.8 Z M67.4,93.2 L61,96.4 L67.4,99.8 Z" fill="${AKANE}" stroke="${INK}" stroke-width=".5"/>
        <rect x="58.2" y="94.8" width="3.6" height="3.2" rx=".8" fill="${AKANE}" stroke="${INK}" stroke-width=".5"/>
        <path d="M76,110 L84,108.6 L82.6,112.6 Z" fill="${PAPER}"/>
        <path d="M60,122 V140" stroke="#3A322B" stroke-width=".8"/>`;
    }
    // キャンバスの旅リュック姿（初期）：生成りのシャツの開襟、茜のネッカチーフ、帆布のリュックの肩ひも
    const strapL = 'M34,101 C37,114 37.6,127 36.4,140 H44 C45.2,127 44.4,113 41.6,98 Z';
    const strapR = 'M86,101 C83,114 82.4,127 83.6,140 H76 C74.8,127 75.6,113 78.4,98 Z';
    return `<path d="${TORSO}" fill="${PAPER}" stroke="${INK}" stroke-width="1.4"/>
      <path d="M52,91.6 L60,104 L68,91.6 Q60,96 52,91.6 Z" fill="${AKANE}" stroke="${INK}" stroke-width=".7"/>
      <path d="M47,90 L53.6,103 L60,95 M73,90 L66.4,103 L60,95" fill="none" stroke="${INK}" stroke-width="1"/>
      <path d="M60,104 V140" stroke="${INK}" stroke-width=".6"/>
      ${[112, 122, 132].map((y) => `<circle cx="61.8" cy="${y}" r=".9" fill="none" stroke="${INK}" stroke-width=".6"/>`).join('')}
      <path d="M64.6,112 H72.4 V120 H64.6 Z M64.6,114 H72.4" fill="none" stroke="${INK}" stroke-width=".6"/>
      <path d="M50,118 Q53,124 51,132 M70,126 Q68,132 70,138" fill="none" stroke="${INK3}" stroke-width=".45"/>
      <path d="${strapL}" fill="${PAPER3}" stroke="${INK}" stroke-width="1"/><path d="${strapR}" fill="${PAPER3}" stroke="${INK}" stroke-width="1"/>
      ${hatch(`${id}-sl`, strapL, { step: 1.4, angle: 45, w: 0.35, op: 0.8, box: [30, 95, 20, 48] })}${hatch(`${id}-sr`, strapR, { step: 1.4, angle: 135, w: 0.35, op: 0.8, box: [70, 95, 20, 48] })}
      <rect x="35.6" y="116" width="8" height="5" fill="${PAPER}" stroke="${INK}" stroke-width=".7"/><rect x="76.4" y="116" width="8" height="5" fill="${PAPER}" stroke="${INK}" stroke-width=".7"/>`;
  }

  function hat(h, id) {
    if (h === 'conductor') {
      // 車掌の制帽：インクの冠に白いつや線、茜のパイピング、白抜きの翼つき車輪の帽章（オリジナルの図柄）
      return `<path d="M37.6,38.4 C36.4,27 44.6,19.4 60,19.4 C76,19.4 84.6,26 83.4,38 Z" fill="${INK}" stroke="${INK}" stroke-width="1"/>
        <path d="M44,25.4 C52,22 68,22 77,25.4" fill="none" stroke="${PAPER}" stroke-width=".45" opacity=".7"/>
        <path d="M37.8,33.4 H83 V38.4 H37.8 Z" fill="#3A322B"/><path d="M37.8,35.6 H83" stroke="${AKANE}" stroke-width="1"/>
        <path d="M37.4,38.2 C47,44.4 72,44.4 84.2,37.6 C81.4,42.4 70.6,46.4 58.6,46.2 C47.4,46 40.4,42.6 37.4,38.2 Z" fill="${INK}"/>
        <path d="M44,42.4 C52,44.6 66,44.8 76,42" fill="none" stroke="${PAPER}" stroke-width=".5" opacity=".75"/>
        <g transform="translate(60 28.6)" fill="none" stroke="${PAPER}" stroke-width=".7">
          <circle r="2.8"/><path d="M-2.8,0 H2.8 M0,-2.8 V2.8"/>
          <path d="M-3.4,-.6 C-6,-2.4 -8.6,-2.2 -10.4,-1 M-3.4,.8 C-5.8,-.4 -8,-.2 -9.4,.8 M3.4,-.6 C6,-2.4 8.6,-2.2 10.4,-1 M3.4,.8 C5.8,-.4 8,-.2 9.4,.8"/>
        </g>`;
    }
    if (h === 'tenugui') {
      // 手ぬぐい乗せ：たたんだ布の縞（インクの細線と、茜の二本）、右に結び目のはし
      const cloth = 'M39.4,34 C42,21.6 78,21.6 80.6,34 L78,37.4 C69,31.6 51,31.6 42,37.4 Z';
      return `<path d="${cloth}" fill="${PAPER}" stroke="${INK}" stroke-width="1.2"/>
        ${hatch(`${id}-tg`, cloth, { step: 3, angle: 80, color: INK2, w: 0.5, box: [36, 18, 48, 22] })}
        <path d="M43.6,28.4 C52,24.8 68,24.8 76.4,28.4 M42.2,31 C51,27.4 69,27.4 77.8,31" fill="none" stroke="${AKANE}" stroke-width="1"/>
        <path d="M78.6,32 L88.6,28.6 L86.6,35.4 Z M79,35 L87.6,40.2 L83,41.4 Z" fill="${PAPER}" stroke="${INK}" stroke-width=".9"/>
        <path d="M82,31.4 L86,30.4 M82.6,37 L85.6,39" stroke="${INK2}" stroke-width=".5"/>`;
    }
    if (h === 'kinghat') {
      // 鉄道王のシルクハット：インクの冠に縦のつや線、反り返ったつば、茜の帯に白抜きの星
      return `<path d="M42.8,38 L44.4,11 Q60,7.6 75.6,11 L77.2,38 Z" fill="${INK}"/>
        <path d="M44.4,11 Q60,14.2 75.6,11" fill="none" stroke="${PAPER}" stroke-width=".5" opacity=".8"/>
        <path d="M49.4,13.4 L48.6,29 M52.6,12.8 L52,29 M70.4,13.4 L71.2,29" stroke="${PAPER}" stroke-width=".45" opacity=".6"/>
        <path d="M43.4,29.2 Q60,31.4 76.6,29.2 L77,36.6 Q60,38.8 43,36.6 Z" fill="${AKANE}" stroke="${INK}" stroke-width=".6"/>
        <path d="M60,30.8 l1.1,2.2 2.4,.3 -1.8,1.6 .5,2.3 -2.2,-1.2 -2.2,1.2 .5,-2.3 -1.8,-1.6 2.4,-.3 z" fill="${PAPER}"/>
        <path d="M28.6,37 Q60,45.6 91.4,37 Q92.6,41.4 87.6,42.6 Q60,48.6 32.4,42.6 Q27.4,41.4 28.6,37 Z" fill="${INK}"/>
        <path d="M34,41.6 Q60,46.4 86,41.6" fill="none" stroke="${PAPER}" stroke-width=".45" opacity=".7"/>`;
    }
    // 旅の麦わら帽子（初期）：生成りの麦わらに編み目の細線、茜のリボン
    const crown = 'M41,39 C41,22 48,16.6 60,16.6 C72,16.6 79,22 79,39 Z';
    return `<ellipse cx="60" cy="37.6" rx="38.6" ry="7.6" fill="${PAPER2}" stroke="${INK}" stroke-width="1.4"/>
      <ellipse cx="60" cy="37.6" rx="33" ry="6" fill="none" stroke="${INK3}" stroke-width=".4"/>
      <ellipse cx="60" cy="37.6" rx="27" ry="4.8" fill="none" stroke="${INK3}" stroke-width=".4"/>
      <path d="${crown}" fill="${PAPER2}" stroke="${INK}" stroke-width="1.3"/>
      ${hatch(`${id}-sw`, crown, { step: 2.2, angle: 30, color: INK3, w: 0.35, box: [38, 14, 44, 28] })}${hatch(`${id}-sw2`, crown, { step: 2.2, angle: 150, color: INK3, w: 0.35, box: [38, 14, 44, 28] })}
      <path d="M41,32.6 C50,35.4 70,35.4 79,32.6 L79,38.6 C70,41.2 50,41.2 41,38.6 Z" fill="${AKANE}" stroke="${INK}" stroke-width=".7"/>
      <path d="M74,36 L79.4,42.6 L76,43 Z M75,36.4 L82.6,41 L79.8,42.8" fill="${AKANE}" stroke="${INK}" stroke-width=".6"/>
      <path d="M21.6,38.6 Q60,49.4 98.4,38.6" fill="none" stroke="${INK}" stroke-width=".7"/>`;
  }

  function buddy(b, id) {
    if (b === 'camera') {
      // 二眼レフ：箱のかたちに、上下に並んだふたつのレンズ（中はハッチング）、茜のストラップ
      const lens = (cy, r) => `<circle cx="0" cy="${cy}" r="${r}" fill="${PAPER}" stroke="${INK}" stroke-width="1"/>
        <circle cx="0" cy="${cy}" r="${n1(r * 0.68)}" fill="${INK}"/>
        <circle cx="${n1(-r * 0.22)}" cy="${n1(cy - r * 0.22)}" r="${n1(r * 0.16)}" fill="${PAPER}"/>`;
      return `<g transform="translate(93 108)">
        <path d="M-6,-14 Q-12,-24 -26,-20" fill="none" stroke="${AKANE}" stroke-width="1.4"/>
        <rect x="-11" y="-14" width="22" height="34" rx="1.6" fill="${PAPER2}" stroke="${INK}" stroke-width="1.2"/>
        ${hatch(`${id}-cm`, 'M-11,-14 H11 V20 H-11 Z', { step: 1.8, angle: 90, color: INK3, w: 0.35, box: [-12, -15, 24, 36] })}
        <path d="M-11,-8.6 H11 M-11,15 H11" stroke="${INK}" stroke-width=".7"/>
        <path d="M-9,-14 L-7,-19 H7 L9,-14" fill="${PAPER}" stroke="${INK}" stroke-width=".9"/>
        ${lens(-2.6, 4.6)}${lens(9.4, 5.2)}
        <circle cx="8" cy="-11.4" r="1.2" fill="none" stroke="${INK}" stroke-width=".6"/></g>`;
    }
    if (b === 'bento') {
      // 曲げわっぱ：楕円のふたと側板に杉の木目、茜の掛け紐、のせた箸
      return `<g transform="translate(94 122)">
        <path d="M-18,-6 V5 C-18,10 18,10 18,5 V-6" fill="${PAPER2}" stroke="${INK}" stroke-width="1.1"/>
        ${hatch(`${id}-wp`, 'M-18,-6 V5 C-18,10 18,10 18,5 V-6 Z', { step: 1.6, angle: 88, color: INK3, w: 0.35, box: [-19, -8, 38, 18] })}
        <path d="M2,-3 V8.6" stroke="${INK}" stroke-width=".7"/>
        <ellipse cx="0" cy="-6" rx="18" ry="7" fill="${PAPER}" stroke="${INK}" stroke-width="1.1"/>
        <ellipse cx="0" cy="-6" rx="13" ry="4.6" fill="none" stroke="${INK3}" stroke-width=".45"/>
        <path d="M-6,-12.8 C-5,-6 -5,0 -6,8.8 M-4,-12.9 C-3,-6 -3,0 -4,8.9" fill="none" stroke="${AKANE}" stroke-width=".9"/>
        <path d="M-15,-19 L17,-8 M-13.4,-21 L18,-10.4" stroke="${INK}" stroke-width="1.2"/></g>`;
    }
    if (b === 'cat') {
      // 三毛猫の見習い駅長：座った姿の線画。黒の柄はインク、茶の柄はハッチング、帽子に茜の帯
      const patch = 'M-9,-13 C-6,-16 -2,-14 -2.4,-10 C-4,-8 -8,-8.4 -9,-13 Z M3,4 C8,1 13,6 12.4,14 C8,15 4,10 3,4 Z';
      return `<g transform="translate(94 116)">
        <path d="M13,20 C22,18 24,8 19,4" fill="none" stroke="${INK}" stroke-width="2.4"/>
        <path d="M-13,22 C-15,8 -9,-1 0,-1 C9,-1 15,8 13,22 Z" fill="${PAPER}" stroke="${INK}" stroke-width="1.2"/>
        <path d="M-6,22 C-6,16 -3,13 -2,10 M6,22 C6,16 3,13 2,10" fill="none" stroke="${INK}" stroke-width=".7"/>
        <circle cx="0" cy="-8.4" r="9.6" fill="${PAPER}" stroke="${INK}" stroke-width="1.2"/>
        <path d="M-8.4,-12 L-8,-21.4 L-2.4,-16.4 Z" fill="${PAPER}" stroke="${INK}" stroke-width="1"/>
        <path d="M8.4,-12 L8,-21.4 L2.4,-16.4 Z" fill="${INK}" stroke="${INK}" stroke-width="1"/>
        ${hatch(`${id}-ct`, patch, { step: 1.2, angle: 40, color: INK, w: 0.45, box: [-12, -18, 28, 36] })}
        <path d="M-5.6,-8.6 Q-3.6,-10 -1.8,-8.6 M1.8,-8.6 Q3.6,-10 5.6,-8.6" fill="none" stroke="${INK}" stroke-width=".8"/>
        <path d="M-1,-5.6 H1 L0,-4.4 Z" fill="${INK}"/>
        <path d="M0,-4.4 Q-1.6,-2.6 -3,-3.4 M0,-4.4 Q1.6,-2.6 3,-3.4 M-4,-5 L-11,-6 M-4,-4 L-10.6,-3 M4,-5 L11,-6 M4,-4 L10.6,-3" fill="none" stroke="${INK}" stroke-width=".45"/>
        <path d="M-7.4,-16.6 Q0,-22.4 7.4,-16.6 L7.4,-14.4 H-7.4 Z" fill="${INK}"/>
        <path d="M-7.4,-15.4 H7.4" stroke="${AKANE}" stroke-width=".9"/>
        <path d="M-8.4,-14.4 Q0,-11.4 8.4,-14.4" fill="none" stroke="${INK}" stroke-width="1.2"/></g>`;
    }
    return '';
  }

  // サムネイル（ガレージの一覧用）：線路の上の車両／止めた絵のトレイル／着せ替えたアバター
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
    eq[slot] = id;
    return avatarSvg(eq, { id: `th-${slot}-${id}` });
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
