// 旅の軌跡・手帖シェアカード：自分の九州フォトマップ・オーナーの駅・改造列車・アバターを、
// 1200×630 の「大人の旅手帖の見開き／硬券切符／活版印刷の紙面」の1枚絵（PNG）にして、保存・共有できるようにする。
// 外部のサーバーも画像も使わず <canvas> だけで描く（紙の粒子・朱肉のかすれも Canvas で作る）。
//   左の半券：古地図・真鍮の路線図の調子の九州（踏破した駅＝茜、トップオーナーの駅＝真鍮の二重リングと金箔の菱形と駅名標、
//            投函した駅＝金箔の糸でつないだ小さなポラロイド）と、その人の旅から選ぶ縦書きの一文
//   右上：愛車編成（1両目＋2両目＋トレイル）を車窓の枠に、旅人アバターを楕円の肖像の枠に
//   右下：旅人名・二つ名（金箔の字）・総資産額（¥ 150,000,000 の組み）・踏破率・投函したスナップ・トップオーナーの駅
//   隅：今日の日付の朱の風景印（二重の輪・傾き・かすれ）と、公開URLのクレジット
// 発行またはシェアすると、1日1回だけ「九州の魅力発信ボーナス」（meta.craft.shareBonus）がクラフト資金に入る。
(function () {
  'use strict';
  const YT = (window.YT = window.YT || {});
  const W = 1200, H = 630;
  const SITE = 'https://q-trip.github.io/';
  let D = null, api = null, layer = null;
  let made = null; // { canvas, blob, file, text }
  const $ = (sel, r = document) => r.querySelector(sel);
  const I = (name, opts) => YT.Icon.svg(name, opts); // 線画のアイコン（絵文字は使わない）
  // 書体：数字・金額・欧文＝Cormorant Garamond、駅名・見出し・一文＝しっぽり明朝、小さな注釈＝Zen Kaku Gothic New（index.html が読み込む）
  const SERIF = '"Cormorant Garamond", "Times New Roman", serif';
  const MINCHO = '"Shippori Mincho", "Hiragino Mincho ProN", serif';
  const UI = '"Zen Kaku Gothic New", "Hiragino Sans", sans-serif';
  // 紙面の色（style.css の :root のトークンと同じ値。Canvas は CSS 変数を読めないので、ここに写す）
  const C = {
    ivory: '#FAF6F0', paper2: '#F3ECE1', ink: '#2C2523', ink2: '#4E433C', ink3: '#857668',
    rule: '#C8B9A6', perf: '#B8A68E', plate: '#6E5D4F', brass: '#B8860B', gold: '#C59B27', leaf: '#D4AF37',
    akane: '#A8382B', forest: '#234236', sea: '#DFECEA', land: '#F3ECE1', shu: '#B03A2B',
  };

  // ---------- 数字と二つ名 ----------
  function facts() {
    const st = YT.Store.get();
    const owned = D.stations.filter((s) => st.acquired[s.id]);
    const visited = D.stations.filter((s) => st.visited[s.id]);
    const cards = Object.keys(YT.Store.getPostcards()).filter((id) => D.byId[id]);
    const eq = YT.Craft.equipped();
    const livery = YT.Craft.item('livery', eq.livery);
    const carriage = YT.Craft.item('carriage', eq.carriage);
    const assets = owned.reduce((n, s) => n + s.assetValue, 0);
    return {
      st, owned, visited, cards, eq, assets,
      trainName: `${livery.name}${eq.carriage !== 'none' ? ` ＋ ${carriage.name}` : ''}`,
      visitedPct: Math.round((visited.length / D.stations.length) * 100),
      name: YT.Ownership.youName(),
    };
  }
  // 二つ名：オーナーの駅の地域・投函した駅の県の数・装備から、当てはまるもののうち一番上を選ぶ
  function nickname(f) {
    const by = (theme) => f.owned.filter((s) => s.regionTheme === theme).length;
    const prefs = new Set(f.cards.map((id) => D.byId[id].prefecture)).size;
    const rules = [
      [f.eq.livery === 'royal' && f.owned.length >= 3, '九州をめぐるクルーズの主'],
      [prefs >= 7, '九州七県をめぐる鉄道写真家'],
      [by('onsen') >= 2, '湯けむり路線のトップオーナー'],
      [by('volcano') >= 2, '火の国カルデラの守り人'],
      [by('ocean') >= 2, '潮風ルートの港町オーナー'],
      [by('forest') >= 2, '千年の森を旅する語り部'],
      [by('city') >= 2, '灯りの街のハイカラ株主'],
      [f.cards.length >= 3, '車窓の思い出を綴る写真家'],
      [f.visitedPct >= 80, '九州踏破まであと一歩の旅人'],
      [f.owned.length >= 1, 'はじめての駅オーナー'],
    ];
    const hit = rules.find(([ok]) => ok);
    return hit ? hit[1] : 'よりみち上手の九州旅人';
  }
  const yenBig = (man) => (man >= 10000 ? `${Math.floor(man / 10000)}億${man % 10000 ? (man % 10000).toLocaleString('ja-JP') + '万' : ''}円` : `${man.toLocaleString('ja-JP')}万円`);
  // 金額は活版の数字の組みで「¥ 150,000,000」（評価額は万円なので円に直す）
  const yenFigure = (man) => `¥ ${(man * 10000).toLocaleString('en-US')}`;

  // 縦書きの一文：その人の旅でいちばん思い出に残りそうな駅（評価額の高いオーナーの駅 → いまいる駅）の地域から選ぶ。
  // 同じ駅なら毎回同じ一文になるよう、駅IDから選ぶ（発行するたびに変わると、手帖の言葉らしくない）
  const LINES = {
    onsen: ['朝霧けむる、湯のまちの記憶。', '湯けむりの向こうに、{n}の灯。', '湯の香に、ほどけてゆく旅の刻。'],
    volcano: ['噴煙たなびく、火の国の空。', '火の山の風に、旅の頁をめくる。', '{n}の大地に、遠い鼓動をきく。'],
    ocean: ['潮騒をききながら、港町の夕暮れ。', '潮風のこる、{n}の記憶。', '水平線に、汽笛がとけてゆく。'],
    forest: ['苔むす森に、千年の時をきく。', '木漏れ日の道、{n}の記憶。', '杉の香に、旅の足どりがゆるむ。'],
    city: ['ガス灯ともる、{n}の宵。', '石畳に、旅のはじまりの靴音。', '{n}の灯りに、旅の頁をひらく。'],
  };
  const hash = (s) => [...s].reduce((h, ch) => (Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0), 2166136261);
  function verse(f) {
    const cur = D.byId[f.st.currentStationId];
    const pick = [...f.owned].sort((a, b) => b.assetValue - a.assetValue)[0] || (cur && f.st.visited[cur.id] ? cur : null);
    if (!pick) return { line: 'まだ白い頁に、旅のはじまりをしるす。', at: `${(cur || D.stations[0]).name}駅より` };
    const list = (LINES[pick.regionTheme] || LINES.city).map((t) => t.replace('{n}', pick.name)).filter((t) => t.length <= 19);
    return { line: list[hash(pick.id) % list.length] || LINES.city[1], at: `${pick.name}駅にて` };
  }
  // 漢数字の年月（縦書きの添え書き用）：2026年10月 → 二〇二六年十月
  const KAN = '〇一二三四五六七八九';
  function kanjiMonth(d = new Date()) {
    const y = [...String(d.getFullYear())].map((n) => KAN[n]).join('');
    const m = d.getMonth() + 1;
    return `${y}年${m < 10 ? KAN[m] : m === 10 ? '十' : '十' + KAN[m - 10]}月`;
  }

  // ---------- 描画の道具 ----------
  function svgImage(markup, w, h) {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }));
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.width = w;
      img.height = h;
      img.src = url;
    });
  }
  function rounded(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function fitText(ctx, text, maxW) {
    if (ctx.measureText(text).width <= maxW) return text;
    let t = text;
    while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
    return t + '…';
  }
  // 字送り（活版の字間）。letterSpacing のないブラウザでは何もしない
  const track = (ctx, px) => {
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${px}px`;
  };
  // 決まった種の乱数（同じ日の同じ旅なら、紙の粒子もかすれも同じ形になる）
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const line = (ctx, x1, y1, x2, y2) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };
  // ミシン目（#B8A68E の破線）
  function perf(ctx, x1, y1, x2, y2) {
    ctx.save();
    ctx.strokeStyle = C.perf;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    line(ctx, x1, y1, x2, y2);
    ctx.restore();
  }
  // 小さな菱形（真鍮の飾り・トップオーナーの駅のしるし）
  function diamond(ctx, x, y, s, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(x, y - s);
    ctx.lineTo(x + s * 0.7, y);
    ctx.lineTo(x, y + s);
    ctx.lineTo(x - s * 0.7, y);
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
  }

  // 硬券切符の形：四隅を丸く切り欠き、半券のミシン目の上下にパンチ穴（半円の切り欠き）。
  // inset だけ内側の線は、切り欠きと同心の弧でまわりこむ（外枠と二重の細線が、穴のまわりで途切れずに沿う）
  const PAPER = { x0: 14, y0: 14, x1: W - 14, y1: H - 14, rc: 16, rn: 13 };
  const SPLIT = 404; // 半券（地図）と本券のあいだのミシン目
  function ticketPath(ctx, i) {
    const { x0, y0, x1, y1 } = PAPER;
    const rc = PAPER.rc + i, rn = PAPER.rn + i;
    const ac = Math.asin(i / rc), an = Math.asin(i / rn);
    const P = Math.PI;
    ctx.beginPath();
    ctx.arc(x0, y0, rc, P / 2 - ac, ac, true); // 左上
    ctx.arc(SPLIT, y0, rn, P - an, an, true); // 上のパンチ穴
    ctx.arc(x1, y0, rc, P - ac, P / 2 + ac, true); // 右上
    ctx.arc(x1, y1, rc, (3 * P) / 2 - ac, P + ac, true); // 右下
    ctx.arc(SPLIT, y1, rn, 2 * P - an, P + an, true); // 下のパンチ穴
    ctx.arc(x0, y1, rc, 2 * P - ac, (3 * P) / 2 + ac, true); // 左下
    ctx.closePath();
  }

  // 紙：生成りの地に、ごく薄い粒子と細い繊維（外部の画像を使わず、点と短い線で漉き紙の肌を出す）
  function paper(ctx, rand) {
    const g = ctx.createRadialGradient(W * 0.55, H * 0.45, 80, W / 2, H / 2, W * 0.68);
    g.addColorStop(0, C.ivory);
    g.addColorStop(1, C.paper2);
    ticketPath(ctx, 0);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.save();
    ticketPath(ctx, 0);
    ctx.clip();
    for (let n = 0; n < 9000; n++) {
      const dark = rand() < 0.72;
      ctx.fillStyle = dark ? `rgba(110,93,79,${(0.03 + rand() * 0.07).toFixed(3)})` : `rgba(255,255,255,${(0.25 + rand() * 0.35).toFixed(3)})`;
      const s = 0.5 + rand() * 0.9;
      ctx.fillRect(rand() * W, rand() * H, s, s);
    }
    ctx.lineCap = 'round';
    for (let n = 0; n < 340; n++) {
      const x = rand() * W, y = rand() * H, len = 4 + rand() * 14, a = rand() * Math.PI;
      ctx.strokeStyle = `rgba(120,100,80,${(0.04 + rand() * 0.06).toFixed(3)})`;
      ctx.lineWidth = 0.4 + rand() * 0.4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + Math.cos(a) * len * 0.5 + (rand() - 0.5) * 4, y + Math.sin(a) * len * 0.5 + (rand() - 0.5) * 4, x + Math.cos(a) * len, y + Math.sin(a) * len);
      ctx.stroke();
    }
    // 端の焼け：手帖の紙のふちが、わずかに色づく
    const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, W * 0.62);
    v.addColorStop(0, 'rgba(160,130,95,0)');
    v.addColorStop(1, 'rgba(160,130,95,.12)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  // 表紙：深緑のクロス装（細い織り目）。パンチ穴から、この表紙がのぞく
  function cover(ctx, rand) {
    ctx.fillStyle = C.forest;
    ctx.fillRect(0, 0, W, H);
    ctx.lineWidth = 1;
    for (let y = 0; y < H; y += 2) {
      ctx.strokeStyle = `rgba(0,0,0,${(0.05 + rand() * 0.06).toFixed(3)})`;
      line(ctx, 0, y + 0.5, W, y + 0.5);
    }
    for (let x = 0; x < W; x += 3) {
      ctx.strokeStyle = `rgba(255,255,255,${(0.015 + rand() * 0.02).toFixed(3)})`;
      line(ctx, x + 0.5, 0, x + 0.5, H);
    }
  }

  // コンパスローズ（線画）：二重の輪に32方位の目盛り、東西南北の細い剣先（半分を塗る銅版画の描き方）
  function compassRose(ctx, x, y, r) {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = C.plate;
    ctx.fillStyle = C.plate;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.arc(0, 0, r - 3, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * Math.PI * 2, l = i % 4 === 0 ? 3 : 1.6;
      line(ctx, Math.cos(a) * (r - 3), Math.sin(a) * (r - 3), Math.cos(a) * (r - 3 - l), Math.sin(a) * (r - 3 - l));
    }
    const point = (a, len, w) => {
      const ca = Math.cos(a), sa = Math.sin(a), cp = Math.cos(a + Math.PI / 2), sp = Math.sin(a + Math.PI / 2);
      // 片側だけ塗って、もう片側は線だけ（光の当たる面と影の面）
      ctx.beginPath();
      ctx.moveTo(ca * len, sa * len);
      ctx.lineTo(cp * w, sp * w);
      ctx.lineTo(0, 0);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(ca * len, sa * len);
      ctx.lineTo(-cp * w, -sp * w);
      ctx.lineTo(0, 0);
      ctx.closePath();
      ctx.stroke();
    };
    ctx.lineWidth = 0.6;
    for (let i = 0; i < 4; i++) point(Math.PI / 4 + (i * Math.PI) / 2, r * 0.55, r * 0.09);
    for (let i = 0; i < 4; i++) point(-Math.PI / 2 + (i * Math.PI) / 2, r * 0.92, r * 0.13);
    ctx.beginPath();
    ctx.arc(0, 0, 1.6, 0, Math.PI * 2);
    ctx.fillStyle = C.ivory;
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = C.plate;
    ctx.font = `italic 600 12px ${SERIF}`;
    ctx.textAlign = 'center';
    ctx.fillText('N', 0, -r - 4);
    ctx.restore();
  }

  // 縦書き：1字ずつ縦に置く。句読点は右上へ寄せ、長音と括弧は90度まわす（縦組みの約物の決まり）
  function vertical(ctx, text, x, y, size, gap = 1.12) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let cy = y + size / 2;
    for (const ch of text) {
      if ('、。'.includes(ch)) {
        ctx.fillText(ch, x + size * 0.58, cy - size * 0.52);
      } else if ('ー〜…「」『』（）'.includes(ch)) {
        ctx.save();
        ctx.translate(x, cy);
        ctx.rotate(Math.PI / 2);
        ctx.fillText(ch, 0, 0);
        ctx.restore();
      } else if ('ぁぃぅぇぉっゃゅょァィゥェォッャュョ'.includes(ch)) {
        ctx.fillText(ch, x + size * 0.12, cy - size * 0.1);
      } else {
        ctx.fillText(ch, x, cy);
      }
      cy += size * gap;
    }
    ctx.restore();
    return cy - size / 2;
  }

  // 朱の風景印：二重の輪・輪に沿う欧文・日付の刻印を別のキャンバスに押し、ランダムな点でかすれさせ、
  // 少しずらした二度押しを重ねて、−6度に傾けて紙に置く（朱肉が紙の目に入りきらない感じ）
  function postmark(ctx, x, y, r, date, rand) {
    const S = Math.ceil(r * 2 + 16);
    const off = document.createElement('canvas');
    off.width = S;
    off.height = S;
    const o = off.getContext('2d');
    o.translate(S / 2, S / 2);
    o.strokeStyle = C.shu;
    o.fillStyle = C.shu;
    o.lineWidth = 2.6;
    o.beginPath();
    o.arc(0, 0, r, 0, Math.PI * 2);
    o.stroke();
    o.lineWidth = 0.9;
    o.beginPath();
    o.arc(0, 0, r - 4.5, 0, Math.PI * 2);
    o.stroke();
    o.lineWidth = 1.3;
    o.beginPath();
    o.arc(0, 0, r - 23, 0, Math.PI * 2);
    o.stroke();
    // 輪に沿う欧文（字の幅に合わせて送り、下に小さな菱形の区切り）
    const text = 'Q-TRIP KYUSHU OFFICIAL TRAVELBOOK';
    o.font = `700 11px ${SERIF}`;
    const rt = r - 17;
    const gapA = 0.62;
    const widths = [...text].map((ch) => o.measureText(ch).width);
    const sum = widths.reduce((a, b) => a + b, 0);
    const spare = (Math.PI * 2 - gapA) * rt - sum;
    const sp = spare / (text.length - 1);
    let a = Math.PI / 2 + gapA / 2; // 下の区切りのすぐ右（左回りで見て）から、時計回りに一周
    o.textAlign = 'center';
    o.textBaseline = 'alphabetic';
    [...text].forEach((ch, i) => {
      const half = widths[i] / 2 / rt;
      a += half;
      o.save();
      o.rotate(a + Math.PI / 2);
      o.fillText(ch, 0, -rt + 4);
      o.restore();
      a += half + sp / rt;
    });
    o.lineWidth = 0.8;
    diamond(o, 0, r - 13.5, 3.2, C.shu);
    // 中：地名（九州）・日付の刻印・二本の罫・「旅の軌跡 認定」（風景印の組み）
    o.textAlign = 'center';
    o.font = `700 12px ${MINCHO}`;
    track(o, 5);
    o.fillText('九州', 2.5, -15);
    track(o, 0);
    o.lineWidth = 1;
    line(o, -(r - 27), -6, r - 27, -6);
    line(o, -(r - 27), 13, r - 27, 13);
    o.textAlign = 'center';
    o.font = `700 17px ${SERIF}`;
    track(o, 0.5);
    o.fillText(date, 0, 9);
    track(o, 0);
    o.font = `700 9.5px ${MINCHO}`;
    o.fillText('旅の軌跡 認定', 0, 27);
    // かすれ：点で朱を抜く（輪のまわりは強く、片側は全体に薄く＝押す力のむら）
    o.setTransform(1, 0, 0, 1, 0, 0);
    o.globalCompositeOperation = 'destination-out';
    for (let n = 0; n < 620; n++) {
      const rr = 0.3 + rand() * (n < 70 ? 2 : 1);
      o.fillStyle = `rgba(0,0,0,${(0.35 + rand() * 0.65).toFixed(2)})`;
      o.beginPath();
      o.arc(rand() * S, rand() * S, rr, 0, Math.PI * 2);
      o.fill();
    }
    for (let n = 0; n < 26; n++) {
      // 紙の目に沿った細いかすれ
      const sx = rand() * S, sy = rand() * S;
      o.strokeStyle = `rgba(0,0,0,${(0.3 + rand() * 0.5).toFixed(2)})`;
      o.lineWidth = 0.6 + rand() * 0.8;
      line(o, sx, sy, sx + 6 + rand() * 14, sy + (rand() - 0.5) * 3);
    }
    const fade = o.createLinearGradient(0, 0, S, S * 0.6);
    fade.addColorStop(0, 'rgba(0,0,0,0)');
    fade.addColorStop(1, 'rgba(0,0,0,.3)');
    o.fillStyle = fade;
    o.fillRect(0, 0, S, S);
    // 紙に置く：二度押しのずれ（薄く）→ 本押し。multiply で紙の地に朱がしみこむ
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((-6 * Math.PI) / 180);
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.25;
    ctx.drawImage(off, -S / 2 + 1.6, -S / 2 - 1.1);
    ctx.globalAlpha = 1;
    ctx.drawImage(off, -S / 2, -S / 2);
    ctx.restore();
  }

  // ---------- 地図（古地図・真鍮の路線図） ----------
  // 盤面の座標系は map.js と同じ（geo.js の proj）。左右の海を少し切って、九州を半券いっぱいに描く
  const VIEW = { x: 140, y: 0, w: 560, h: 960 };
  async function drawMap(ctx, f, box, rand) {
    const G = window.YOKATABI_GEO;
    const k = box.w / VIEW.w;
    const P = (x, y) => [box.x + (x - VIEW.x) * k, box.y + (y - VIEW.y) * k];
    const proj = G && G.proj;
    const ll = (lat, lng) => (proj ? P(proj.cx + (lng - proj.lng0) * proj.cos * proj.k, proj.top + (proj.bounds.north - lat) * proj.k) : [0, 0]);
    const bh = VIEW.h * k;

    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.w, bh);
    ctx.clip();
    ctx.fillStyle = C.sea;
    ctx.fillRect(box.x, box.y, box.w, bh);
    if (G) {
      const land = new Path2D(G.land.join(''));
      const shore = new Path2D([...G.land, ...(G.neighbor || [])].join(''));
      ctx.save();
      ctx.translate(box.x, box.y);
      ctx.scale(k, k);
      ctx.translate(-VIEW.x, -VIEW.y);
      ctx.lineJoin = 'round';
      // 海岸に沿う等深線（外から順に、細い線と海の色を交互に重ねて同心の線を残す）
      [13, 8, 4].forEach((d, i) => {
        ctx.lineWidth = (2 * d + 0.7) / k;
        ctx.strokeStyle = `rgba(78,120,118,${0.14 + i * 0.05})`;
        ctx.stroke(shore);
        ctx.lineWidth = (2 * d - 0.7) / k;
        ctx.strokeStyle = C.sea;
        ctx.stroke(shore);
      });
      ctx.restore();
      // 細い平行ハッチング（銅版画の海）
      ctx.strokeStyle = 'rgba(78,120,118,.14)';
      ctx.lineWidth = 0.6;
      for (let y = box.y + 2; y < box.y + bh; y += 4) line(ctx, box.x, y + 0.5, box.x + box.w, y + 0.5);
      ctx.save();
      ctx.translate(box.x, box.y);
      ctx.scale(k, k);
      ctx.translate(-VIEW.x, -VIEW.y);
      // 対岸（山口・愛媛）は少しくすんだ紙の色で
      (G.neighbor || []).forEach((d) => {
        const p = new Path2D(d);
        ctx.fillStyle = '#ECE5D8';
        ctx.fill(p);
        ctx.strokeStyle = 'rgba(110,93,79,.45)';
        ctx.lineWidth = 0.6 / k;
        ctx.stroke(p);
      });
      ctx.fillStyle = C.land;
      ctx.fill(land);
      // 海岸線の内側の細い二重線（陸に clip して、太い線を陸の色で細く抜く）
      ctx.save();
      ctx.clip(land);
      ctx.lineWidth = 7 / k;
      ctx.strokeStyle = 'rgba(184,166,142,.75)';
      ctx.stroke(land);
      ctx.lineWidth = 5.6 / k;
      ctx.strokeStyle = C.land;
      ctx.stroke(land);
      // 山地：等高線を、ごく薄い墨で（高いほど少し濃く）
      (G.mountains || []).forEach((m) => {
        const p = new Path2D(m.d);
        ctx.fillStyle = `rgba(110,93,79,${m.level >= 1200 ? 0.07 : m.level >= 800 ? 0.05 : 0.035})`;
        ctx.fill(p);
        ctx.strokeStyle = 'rgba(110,93,79,.22)';
        ctx.lineWidth = 0.45 / k;
        ctx.stroke(p);
      });
      ctx.restore();
      ctx.strokeStyle = C.plate;
      ctx.lineWidth = 0.9 / k;
      ctx.stroke(land);
      ctx.strokeStyle = C.perf;
      ctx.lineWidth = 0.8 / k;
      ctx.setLineDash([3 / k, 3 / k]);
      G.borders.forEach((d) => ctx.stroke(new Path2D(d)));
      ctx.setLineDash([]);
      // すごろくの路線：新幹線は細い二重線、幹線・ローカル線は墨の線、航路・バスは点線（真鍮の路線図の描き分け）
      const edges = D.edges || [];
      edges.forEach((e) => {
        const d = G.routes[e.key];
        if (!d) return;
        const p = new Path2D(d);
        ctx.setLineDash([]);
        if (e.type === 'shinkansen') {
          ctx.strokeStyle = C.ink2;
          ctx.lineWidth = 2.8 / k;
          ctx.stroke(p);
          ctx.strokeStyle = C.land;
          ctx.lineWidth = 1.2 / k;
          ctx.stroke(p);
        } else if (e.type === 'ferry' || e.type === 'bus') {
          ctx.strokeStyle = 'rgba(78,67,60,.75)';
          ctx.lineWidth = 1 / k;
          ctx.setLineDash([2 / k, 2.5 / k]);
          ctx.stroke(p);
        } else {
          ctx.strokeStyle = e.type === 'trunk' ? 'rgba(44,37,35,.8)' : 'rgba(78,67,60,.7)';
          ctx.lineWidth = (e.type === 'trunk' ? 1.3 : 1) / k;
          ctx.stroke(p);
        }
      });
      ctx.setLineDash([]);
      ctx.restore();
      // 経緯線と度数（31°N・130°E）
      ctx.strokeStyle = 'rgba(110,93,79,.28)';
      ctx.lineWidth = 0.6;
      ctx.setLineDash([1.5, 3]);
      ctx.font = `italic 600 11px ${SERIF}`;
      ctx.fillStyle = C.plate;
      [31, 32, 33].forEach((lat) => {
        const [, y] = ll(lat, 130);
        line(ctx, box.x, y, box.x + box.w, y);
        ctx.save();
        ctx.setLineDash([]);
        ctx.textAlign = 'left';
        ctx.fillText(`${lat}°N`, box.x + 9, y - 3);
        ctx.restore();
      });
      [130, 131, 132].forEach((lng) => {
        const [x] = ll(32, lng);
        line(ctx, x, box.y, x, box.y + bh);
        ctx.save();
        ctx.setLineDash([]);
        ctx.textAlign = 'center';
        ctx.fillText(`${lng}°E`, x, box.y + bh - 9);
        ctx.restore();
      });
      ctx.setLineDash([]);
    }
    ctx.restore();

    // 図郭：二重の細線のあいだに、10分ごとの白黒の目盛り（古地図の縁）
    ctx.strokeStyle = C.plate;
    ctx.lineWidth = 1;
    ctx.strokeRect(box.x + 0.5, box.y + 0.5, box.w - 1, bh - 1);
    ctx.lineWidth = 0.75;
    ctx.strokeRect(box.x - 4, box.y - 4, box.w + 8, bh + 8);
    if (proj) {
      ctx.fillStyle = C.plate;
      const step = (proj.k * k) / 6; // 緯度10分（経度は cos 倍）
      // 白黒を交互に：基準の度（34°N・130°E）から10分ごとに数え、偶数番目を塗る
      const bars = (from, lo, hi, st, put) => {
        const n0 = Math.ceil((from - lo) / st);
        for (let i = -n0, t = from - n0 * st; t < hi; i++, t += st) {
          const a = Math.max(t, lo), b = Math.min(t + st, hi);
          if (b > a && ((i % 2) + 2) % 2 === 0) put(a, b - a);
        }
      };
      const [, y34] = ll(34, 130);
      bars(y34, box.y, box.y + bh, step, (a, len) => (ctx.fillRect(box.x - 3.5, a, 3, len), ctx.fillRect(box.x + box.w + 0.5, a, 3, len)));
      const [x130] = ll(32, 130);
      bars(x130, box.x, box.x + box.w, step * proj.cos, (a, len) => (ctx.fillRect(a, box.y - 3.5, len, 3), ctx.fillRect(a, box.y + bh + 0.5, len, 3)));
    }

    // コンパスローズ（日向灘の沖）と縮尺（甑島の南の海）
    if (proj) {
      const [cx, cy] = ll(30.86, 131.92);
      compassRose(ctx, cx, cy, 25);
      const [sx, sy] = ll(30.32, 129.62);
      const km50 = (50 / 0.45) * k; // 盤面1単位 ≒ 0.45km
      ctx.strokeStyle = C.plate;
      ctx.lineWidth = 0.8;
      ctx.strokeRect(sx, sy, km50, 3);
      ctx.fillStyle = C.plate;
      ctx.fillRect(sx, sy, km50 / 2, 3);
      ctx.font = `italic 500 10px ${SERIF}`;
      ctx.textAlign = 'left';
      ctx.fillText('0', sx - 1, sy - 3);
      ctx.textAlign = 'right';
      ctx.fillText('50 km', sx + km50 + 2, sy - 3);
    }

    // ---- 駅（時刻表の駅記号）：まだ＝白抜きの小円、踏破＝茜、トップオーナー＝真鍮の二重リングに金箔の菱形 ----
    const taken = []; // 札・ポラロイドがぶつからないように、置いた矩形を覚える
    const hit = (r) => taken.some((t) => r.x < t.x + t.w && r.x + r.w > t.x && r.y < t.y + t.h && r.y + r.h > t.y);
    const inBox = (r) => r.x > box.x + 2 && r.x + r.w < box.x + box.w - 2 && r.y > box.y + 2 && r.y + r.h < box.y + bh - 2;
    // 候補のうち、はみ出さず重ならない最初の位置。どれも重なるなら、重なりのいちばん少ない位置（図郭の中を優先）
    const overlap = (r) => taken.reduce((n, t) => n + Math.max(0, Math.min(r.x + r.w, t.x + t.w) - Math.max(r.x, t.x)) * Math.max(0, Math.min(r.y + r.h, t.y + t.h) - Math.max(r.y, t.y)), 0);
    function place(cands) {
      const r = cands.find((c) => inBox(c) && !hit(c)) || [...cands].sort((a, b) => (inBox(b) - inBox(a)) || overlap(a) - overlap(b))[0];
      taken.push(r);
      return r;
    }
    D.stations.forEach((s) => {
      const [x, y] = P(s.x, s.y);
      ctx.beginPath();
      if (f.st.visited[s.id]) {
        ctx.arc(x, y, 3.6, 0, Math.PI * 2);
        ctx.fillStyle = C.akane;
        ctx.fill();
        ctx.strokeStyle = C.ivory;
        ctx.lineWidth = 1;
        ctx.stroke();
      } else {
        ctx.arc(x, y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = C.ivory;
        ctx.fill();
        ctx.strokeStyle = C.plate;
        ctx.lineWidth = 0.9;
        ctx.stroke();
      }
      taken.push({ x: x - 4, y: y - 4, w: 8, h: 8 });
    });
    f.owned.forEach((s) => {
      const [x, y] = P(s.x, s.y);
      ctx.strokeStyle = C.brass;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.arc(x, y, 7.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(250,246,240,.85)';
      ctx.fill();
      ctx.stroke();
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(x, y, 5.2, 0, Math.PI * 2);
      ctx.stroke();
      diamond(ctx, x, y, 3.6, C.leaf, C.brass);
      taken.push({ x: x - 8, y: y - 8, w: 16, h: 16 });
    });

    // トップオーナーの駅名標：生成りの地に細い枠（#6E5D4F）、しっぽり明朝の駅名
    ctx.font = `600 11px ${MINCHO}`;
    f.owned.forEach((s) => {
      const [x, y] = P(s.x, s.y);
      const tw = ctx.measureText(s.name).width + 10, th = 16;
      const opts = [[11, -th / 2], [-11 - tw, -th / 2], [-tw / 2, 10], [-tw / 2, -10 - th], [9, 6], [-9 - tw, 6], [9, -6 - th], [-9 - tw, -6 - th]];
      const r = place(opts.map(([dx, dy]) => ({ x: x + dx, y: y + dy, w: tw, h: th })));
      taken.push(r);
      ctx.fillStyle = C.ivory;
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = C.plate;
      ctx.lineWidth = 0.9;
      ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
      ctx.strokeStyle = 'rgba(110,93,79,.45)';
      ctx.lineWidth = 0.5;
      line(ctx, r.x + 2.5, r.y + r.h - 3, r.x + r.w - 2.5, r.y + r.h - 3);
      ctx.fillStyle = C.ink;
      ctx.textAlign = 'left';
      ctx.fillText(s.name, r.x + 5, r.y + 11.5);
    });

    // 投函した駅：金箔の糸でつないだ小さなポラロイド（写真は端末の中の画像から）
    const cardsMap = YT.Store.getPostcards();
    for (const id of f.cards) {
      const s = D.byId[id];
      const [x, y] = P(s.x, s.y);
      const pw = 22, ph = 26;
      const spots = [[10, -40], [-32, -40], [12, 8], [-34, 6], [16, -16], [-38, -16]];
      const at = place(spots.map(([dx, dy]) => ({ x: x + dx, y: y + dy, w: pw, h: ph })));
      ctx.strokeStyle = C.leaf;
      ctx.lineWidth = 0.9;
      line(ctx, x, y, at.x + pw / 2, at.y + (at.y < y ? ph : 0));
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.save();
      ctx.translate(at.x + pw / 2, at.y + ph / 2);
      ctx.rotate(((hash(id) % 7) - 3) * 0.025);
      ctx.fillStyle = 'rgba(44,37,35,.14)';
      ctx.fillRect(-pw / 2 + 1, -ph / 2 + 1.5, pw, ph); // 紙の上の薄い影（ぼかさない）
      ctx.fillStyle = '#FBF8F2';
      ctx.fillRect(-pw / 2, -ph / 2, pw, ph);
      ctx.strokeStyle = C.rule;
      ctx.lineWidth = 0.75;
      ctx.strokeRect(-pw / 2 + 0.4, -ph / 2 + 0.4, pw - 0.8, ph - 0.8);
      const card = cardsMap[id];
      const blob = card && (await YT.Photos.get(card.imageId));
      let drawn = false;
      if (blob) {
        try {
          const bmp = await createImageBitmap(blob);
          const sz = Math.min(bmp.width, bmp.height);
          ctx.drawImage(bmp, (bmp.width - sz) / 2, (bmp.height - sz) / 2, sz, sz, -pw / 2 + 2, -ph / 2 + 2, pw - 4, pw - 4);
          drawn = true;
        } catch (e) {
          /* 読めない写真は、空の窓だけにする */
        }
      }
      if (!drawn) {
        ctx.fillStyle = C.sea;
        ctx.fillRect(-pw / 2 + 2, -ph / 2 + 2, pw - 4, pw - 4);
      }
      ctx.strokeStyle = C.leaf;
      ctx.lineWidth = 0.6;
      ctx.strokeRect(-pw / 2 + 2, -ph / 2 + 2, pw - 4, pw - 4);
      ctx.restore();
    }

    return bh;
  }

  // ---------- カードを描く ----------
  async function draw() {
    const f = facts();
    const nick = nickname(f);
    const today = YT.Store.localDate().replace(/-/g, '.');
    const v = verse(f);
    const signed = `${kanjiMonth()}　${v.at}`;
    const prefs = new Set(f.cards.map((id) => D.byId[id].prefecture)).size;
    const ownedLine = f.owned.length ? f.owned.map((s) => s.name).join('・') : 'まだありません（旅の途中）';
    const avatarParts = f.eq.buddy && f.eq.buddy !== 'none' ? `旅の相棒・${YT.Craft.item('buddy', f.eq.buddy).name}` : '旅人の肖像';
    const words = [f.name, nick, f.trainName, v.line, signed, ownedLine, avatarParts, yenBig(f.assets), 'オーナーの駅はこれから', ...D.stations.map((s) => s.name),
      '旅の軌跡・公式認定手帖カード わたしの九州制覇＆フォトマップ 愛車編成 旅人 総資産額 九州踏破率 トップオーナーの駅 投函したスナップ 枚 駅 県から 踏破した駅 投函した駅 認定 なし まだありません（旅の途中） ・＋『』、。 Q-TRIP 九州よりみちダイス 旅人の肖像'].join('');
    const latin = `0123456789.,%¥°NE km/ — ${SITE} Q-TRIP KYUSHU OFFICIAL TRAVELBOOK ROUTE MAP LOCOMOTIVE LEDGER`;
    try {
      await Promise.race([
        Promise.all([
          document.fonts.load(`700 28px ${MINCHO}`, words), document.fonts.load(`600 18px ${MINCHO}`, words), document.fonts.load(`500 14px ${MINCHO}`, words),
          document.fonts.load(`400 12px ${UI}`, words), document.fonts.load(`500 12px ${UI}`, words), document.fonts.load(`700 12px ${UI}`, words),
          document.fonts.load(`600 30px ${SERIF}`, latin), document.fonts.load(`700 30px ${SERIF}`, latin), document.fonts.load(`500 30px ${SERIF}`, latin),
          document.fonts.load(`italic 600 30px ${SERIF}`, latin), document.fonts.load(`italic 500 30px ${SERIF}`, latin),
        ]),
        new Promise((r) => setTimeout(r, 2500)),
      ]);
    } catch (e) {
      /* 書体が読めなくても、手元の書体で描く */
    }
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d');
    const rand = rng(hash(`${today}|${f.name}|${f.visited.length}|${f.owned.length}`));

    // 表紙・紙・外枠と内側の二重の細線（パンチ穴にそってまわりこむ）
    cover(ctx, rand);
    paper(ctx, rand);
    ctx.strokeStyle = C.rule;
    ctx.lineWidth = 1;
    ticketPath(ctx, 14);
    ctx.stroke();
    ctx.lineWidth = 0.75;
    ticketPath(ctx, 18);
    ctx.stroke();
    // 半券と本券のあいだのミシン目（上下のパンチ穴をつなぐ）
    perf(ctx, SPLIT + 0.5, PAPER.y0 + PAPER.rn + 22, SPLIT + 0.5, PAPER.y1 - PAPER.rn - 22);

    // ---- 左の半券：地図 ----
    const box = { x: 48, y: 56, w: 288 };
    const bh = await drawMap(ctx, f, box, rand);
    // 地図の見出しと凡例（図郭の上と下）
    ctx.textAlign = 'left';
    ctx.fillStyle = C.brass;
    ctx.font = `italic 600 13px ${SERIF}`;
    track(ctx, 1.5);
    ctx.fillText('01 / ROUTE MAP', box.x - 4, box.y - 14);
    track(ctx, 0);
    const ly = box.y + bh + 26;
    let lx = box.x - 4;
    const legend = (drawSym, label, val) => {
      drawSym(lx + 5, ly - 4);
      ctx.fillStyle = C.ink3;
      ctx.font = `500 10.5px ${UI}`;
      ctx.textAlign = 'left';
      ctx.fillText(label, lx + 14, ly);
      lx += 14 + ctx.measureText(label).width + 3;
      ctx.fillStyle = C.ink;
      ctx.font = `600 15px ${SERIF}`;
      ctx.fillText(val, lx, ly + 0.5);
      lx += ctx.measureText(val).width + 12;
    };
    legend((x, y) => {
      ctx.beginPath();
      ctx.arc(x, y, 3.6, 0, Math.PI * 2);
      ctx.fillStyle = C.akane;
      ctx.fill();
    }, '踏破', String(f.visited.length));
    legend((x, y) => {
      ctx.lineWidth = 1;
      ctx.strokeStyle = C.brass;
      ctx.beginPath();
      ctx.arc(x, y, 5.5, 0, Math.PI * 2);
      ctx.stroke();
      diamond(ctx, x, y, 3, C.leaf, C.brass);
    }, 'トップオーナー', String(f.owned.length));
    legend((x, y) => {
      ctx.fillStyle = '#FBF8F2';
      ctx.fillRect(x - 4.5, y - 6, 9, 11);
      ctx.strokeStyle = C.leaf;
      ctx.lineWidth = 0.9;
      ctx.strokeRect(x - 4.5, y - 6, 9, 11);
    }, '投函', String(f.cards.length));

    // 縦書きの一文と、年月・駅の添え書き（半券の右の余白に、1字ずつ縦に組む）
    const vx = 376;
    YT.Icon.draw(ctx, 'leaf', vx - 7, 46, 14, C.brass, 1.1);
    ctx.fillStyle = C.ink;
    ctx.font = `600 19px ${MINCHO}`;
    vertical(ctx, v.line, vx, 70, 19, 1.14);
    ctx.fillStyle = C.brass;
    ctx.font = `500 10.5px ${MINCHO}`;
    const sigH = [...signed].length * 10.5 * 1.22;
    vertical(ctx, signed, vx - 22, H - 46 - sigH, 10.5, 1.22);

    // ---- 右の本券 ----
    const R0 = 424, R1 = 1156;
    // 見出し
    ctx.textAlign = 'left';
    ctx.fillStyle = C.akane;
    ctx.font = `700 12px ${UI}`;
    track(ctx, 2);
    ctx.fillText('旅の軌跡・公式認定手帖カード', R0, 62);
    track(ctx, 0);
    ctx.fillStyle = C.ink;
    ctx.font = `700 28px ${MINCHO}`;
    track(ctx, 1);
    ctx.fillText('わたしの九州制覇＆フォトマップ', R0 - 2, 100);
    track(ctx, 0);
    ctx.textAlign = 'right';
    ctx.fillStyle = C.brass;
    ctx.font = `italic 600 13px ${SERIF}`;
    track(ctx, 2);
    ctx.fillText('KYUSHU ROUTES & ROOTS', R1, 62);
    track(ctx, 0);
    ctx.fillStyle = C.ink3;
    ctx.font = `500 11.5px ${UI}`;
    ctx.fillText('Q-TRIP 九州よりみちダイス', R1, 82);
    ctx.fillStyle = C.ink2;
    ctx.font = `600 15px ${SERIF}`;
    track(ctx, 1);
    ctx.fillText(`No. ${String(f.visited.length).padStart(2, '0')} / ${D.stations.length}   ${today}`, R1, 100);
    track(ctx, 0);
    perf(ctx, R0, 118.5, R1, 118.5);

    // ---- 右上：車窓の枠の中の愛車編成 ----
    const win = { x: R0, y: 134, w: 466, h: 172 };
    rounded(ctx, win.x, win.y, win.w, win.h, 12);
    ctx.fillStyle = '#EFE7DA';
    ctx.fill();
    ctx.save();
    rounded(ctx, win.x, win.y, win.w, win.h, 12);
    ctx.clip();
    const sky = ctx.createLinearGradient(0, win.y, 0, win.y + win.h);
    sky.addColorStop(0, '#F4EFE6');
    sky.addColorStop(1, '#E9DFCF');
    ctx.fillStyle = sky;
    ctx.fillRect(win.x, win.y, win.w, win.h);
    // 空の彫り線（銅版画の細い横線）
    ctx.strokeStyle = 'rgba(110,93,79,.09)';
    ctx.lineWidth = 0.6;
    for (let y = win.y + 6; y < win.y + 96; y += 3.5) line(ctx, win.x, y, win.x + win.w, y);
    // 遠い山並み（噴煙の火山）と近い丘：線画に薄い紙の色
    const ridge = (pts, fill, stroke) => {
      ctx.beginPath();
      ctx.moveTo(win.x, win.y + win.h);
      pts.forEach(([x, y], i) => (i ? ctx.quadraticCurveTo(win.x + (pts[i - 1][0] + x) / 2, win.y + Math.min(pts[i - 1][1], y) - 4, win.x + x, win.y + y) : ctx.lineTo(win.x + x, win.y + y)));
      ctx.lineTo(win.x + win.w, win.y + win.h);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 0.9;
      ctx.stroke();
    };
    ridge([[0, 98], [60, 84], [120, 92], [190, 58], [215, 52], [240, 60], [300, 86], [360, 76], [420, 90], [466, 82]], '#E6DCCB', 'rgba(110,93,79,.55)');
    ctx.strokeStyle = 'rgba(110,93,79,.45)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(win.x + 214, win.y + 50);
    ctx.bezierCurveTo(win.x + 206, win.y + 36, win.x + 226, win.y + 30, win.x + 218, win.y + 16);
    ctx.stroke();
    ridge([[0, 128], [80, 116], [170, 124], [260, 110], [350, 122], [466, 112]], '#E2D7C3', 'rgba(110,93,79,.5)');
    // 線路：2本のレールと枕木
    const railY = win.y + 150;
    ctx.fillStyle = '#DCD0BC';
    ctx.fillRect(win.x, railY - 2, win.w, win.h);
    ctx.strokeStyle = C.plate;
    ctx.lineWidth = 0.9;
    for (let x = win.x + 3; x < win.x + win.w; x += 9) line(ctx, x, railY + 1, x - 2, railY + 7);
    ctx.lineWidth = 1.1;
    line(ctx, win.x, railY + 0.5, win.x + win.w, railY + 0.5);
    line(ctx, win.x, railY + 5.5, win.x + win.w, railY + 5.5);
    const trainSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-200 -78 270 86"><g transform="translate(-128 0)">${YT.Craft.carriageSvg()}</g>${YT.Craft.trainSvg()}</svg>`;
    const trainImg = await svgImage(trainSvg, 540, 172);
    const tw = 410, th = tw * (86 / 270);
    const tx = win.x + 22, ty = railY + 1 - th * (78 / 86);
    if (trainImg) ctx.drawImage(trainImg, tx, ty, tw, th);
    // トレイル：煙突のあたりから、選んだトレイルの線画をふたつ
    const trailIco = { puff: 'cloud', leaves: 'leaf', steam: 'steam', stardust: 'sparkle' }[f.eq.trail] || 'cloud';
    const chimX = tx + ((200 - 17) / 270) * tw, chimY = ty + ((78 - 50) / 86) * th;
    YT.Icon.draw(ctx, trailIco, chimX - 9, chimY - 24, 18, 'rgba(110,93,79,.7)', 1.1);
    YT.Icon.draw(ctx, trailIco, chimX - 28, chimY - 42, 13, 'rgba(110,93,79,.45)', 1);
    ctx.restore();
    // 車窓の枠：外 1px＋3px あけた内側の細線
    ctx.strokeStyle = C.plate;
    ctx.lineWidth = 1;
    rounded(ctx, win.x + 0.5, win.y + 0.5, win.w - 1, win.h - 1, 12);
    ctx.stroke();
    ctx.strokeStyle = C.rule;
    ctx.lineWidth = 0.75;
    rounded(ctx, win.x + 4.5, win.y + 4.5, win.w - 9, win.h - 9, 9);
    ctx.stroke();
    // 車窓の中の札（02 / LOCOMOTIVE）と、車窓の下の編成名
    ctx.textAlign = 'left';
    ctx.fillStyle = C.brass;
    ctx.font = `italic 600 13px ${SERIF}`;
    track(ctx, 1.5);
    ctx.fillText('02 / LOCOMOTIVE', win.x + 16, win.y + 24);
    track(ctx, 0);
    ctx.fillStyle = C.ink3;
    ctx.font = `500 11px ${UI}`;
    ctx.fillText('愛車編成', R0, 328);
    YT.Icon.draw(ctx, 'locomotive', R0 + 50, 316, 15, C.brass, 1.1);
    ctx.fillStyle = C.ink;
    ctx.font = `600 14px ${MINCHO}`;
    ctx.fillText(fitText(ctx, f.trainName, win.w - 74), R0 + 72, 328.5);

    // ---- 右上の右：旅人の肖像（楕円の二重枠） ----
    const av = { cx: 1034, cy: 220, rx: 74, ry: 86 };
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(av.cx, av.cy, av.rx, av.ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#EDE4D4';
    ctx.fill();
    ctx.clip();
    ctx.strokeStyle = 'rgba(110,93,79,.08)';
    ctx.lineWidth = 0.6;
    for (let y = av.cy - av.ry; y < av.cy + av.ry; y += 3.5) line(ctx, av.cx - av.rx, y, av.cx + av.rx, y);
    const avImg = await svgImage(YT.Craft.avatarSvg(f.eq, { id: 'sc-av' }).replace('<svg ', '<svg width="240" height="280" '), 240, 280);
    if (avImg) ctx.drawImage(avImg, av.cx - 80, av.cy - 82, 160, 187);
    ctx.restore();
    ctx.strokeStyle = C.brass;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.ellipse(av.cx, av.cy, av.rx, av.ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = C.rule;
    ctx.lineWidth = 0.75;
    ctx.beginPath();
    ctx.ellipse(av.cx, av.cy, av.rx + 4, av.ry + 4, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 0.8;
    diamond(ctx, av.cx, av.cy - av.ry - 4, 4, C.leaf, C.brass);
    diamond(ctx, av.cx, av.cy + av.ry + 4, 4, C.leaf, C.brass);
    ctx.textAlign = 'center';
    ctx.fillStyle = C.ink3;
    ctx.font = `500 11px ${UI}`;
    ctx.fillText(fitText(ctx, avatarParts, 230), av.cx, 328);
    perf(ctx, R0, 344.5, R1, 344.5);

    // ---- 右下：旅人のステータス（03 / LEDGER） ----
    ctx.textAlign = 'left';
    ctx.fillStyle = C.brass;
    ctx.font = `italic 600 13px ${SERIF}`;
    track(ctx, 1.5);
    ctx.fillText('03 / LEDGER', R0, 370);
    track(ctx, 0);
    ctx.fillStyle = C.ink3;
    ctx.font = `500 11px ${UI}`;
    ctx.fillText('旅人', R0 + 96, 370);
    ctx.fillStyle = C.ink;
    ctx.font = `700 34px ${MINCHO}`;
    track(ctx, 2);
    const nameText = fitText(ctx, f.name, 300);
    ctx.fillText(nameText, R0, 412);
    const nameW = ctx.measureText(nameText).width;
    track(ctx, 0);
    // 二つ名：金箔の字（真鍮〜金箔のグラデーション）を、細い罫と菱形で挟む
    ctx.font = `600 18px ${MINCHO}`;
    const nickText = fitText(ctx, `『${nick}』`, R1 - 170 - (R0 + nameW + 40));
    const nx = R0 + nameW + 24;
    const nkW = ctx.measureText(nickText).width;
    let nickX = nx, nickY = 410;
    if (nx + nkW > R1 - 150) {
      nickX = R0;
      nickY = 444;
    }
    const foil = ctx.createLinearGradient(nickX, nickY - 18, nickX + nkW, nickY);
    foil.addColorStop(0, '#9C7417');
    foil.addColorStop(0.45, C.leaf);
    foil.addColorStop(0.55, '#E6C665');
    foil.addColorStop(1, C.brass);
    ctx.fillStyle = foil;
    ctx.fillText(nickText, nickX, nickY);
    // 二つ名の下の細い金の罫（箔押しの帯）
    ctx.strokeStyle = C.gold;
    ctx.lineWidth = 0.75;
    line(ctx, nickX + 8, nickY + 7, nickX + nkW - 8, nickY + 7);
    ctx.lineWidth = 0.6;
    diamond(ctx, nickX + nkW / 2, nickY + 7, 2.6, C.leaf, C.brass);

    // 数字：活版の数字（Cormorant）を、細い縦罫で区切った3段の帳簿に
    const ny = 476;
    const cols = [
      { x: R0, w: 250, label: '総資産額', val: yenFigure(f.assets), sub: f.assets ? `${yenBig(f.assets)}・オーナー ${f.owned.length}駅` : 'オーナーの駅はこれから', it: false },
      { x: R0 + 266, w: 150, label: '九州踏破率', val: `${f.visitedPct}%`, sub: `${f.visited.length} / ${D.stations.length} 駅`, it: true },
      { x: R0 + 432, w: 150, label: '投函したスナップ', val: String(f.cards.length), unit: '枚', sub: prefs ? `${prefs}県から` : 'まだありません', it: true },
    ];
    cols.forEach((col, i) => {
      if (i) {
        ctx.strokeStyle = C.rule;
        ctx.lineWidth = 0.75;
        line(ctx, col.x - 9.5, ny - 6, col.x - 9.5, ny + 62);
      }
      ctx.textAlign = 'left';
      ctx.fillStyle = C.ink3;
      ctx.font = `500 11px ${UI}`;
      ctx.fillText(col.label, col.x, ny + 6);
      ctx.fillStyle = C.ink;
      ctx.font = `${col.it ? 'italic ' : ''}600 32px ${SERIF}`;
      const val = fitText(ctx, col.val, col.w - 10);
      ctx.fillText(val, col.x, ny + 40);
      if (col.unit) {
        const vw = ctx.measureText(val).width;
        ctx.font = `500 13px ${MINCHO}`;
        ctx.fillText(col.unit, col.x + vw + 4, ny + 40);
      }
      ctx.fillStyle = C.ink3;
      ctx.font = `400 10.5px ${UI}`;
      ctx.fillText(fitText(ctx, col.sub, col.w - 10), col.x, ny + 58);
    });
    // トップオーナーの駅
    perf(ctx, R0, 552.5, R0 + 572, 552.5);
    ctx.fillStyle = C.ink3;
    ctx.font = `500 11px ${UI}`;
    ctx.textAlign = 'left';
    ctx.fillText('トップオーナーの駅', R0, 578);
    YT.Icon.draw(ctx, 'crown', R0 + 104, 566, 14, C.brass, 1.1);
    ctx.fillStyle = C.ink;
    ctx.font = `600 14.5px ${MINCHO}`;
    ctx.fillText(fitText(ctx, ownedLine, 440), R0 + 124, 578.5);

    // ---- 隅：風景印とクレジット ----
    postmark(ctx, 1078, 470, 64, today, rand);
    ctx.fillStyle = C.ink3;
    ctx.font = `italic 500 14px ${SERIF}`;
    ctx.textAlign = 'right';
    track(ctx, 0.5);
    ctx.fillText(SITE, R1, 579);
    track(ctx, 0);
    ctx.textAlign = 'left';

    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    const file = blob ? new File([blob], `qtrip-techo-${today.replace(/\./g, '')}.png`, { type: 'image/png' }) : null;
    const top = f.owned[0];
    const liveryName = YT.Craft.item('livery', f.eq.livery).name;
    const text = top
      ? `現在の総資産${yenBig(f.assets)}。${top.name}駅のトップオーナーとして『${liveryName}』で九州旅の途中です。二つ名は『${nick}』`
      : `九州踏破率${f.visitedPct}%。『${liveryName}』で九州よりみち旅の途中です。二つ名は『${nick}』`;
    return { canvas: c, blob, file, text, nick };
  }

  // ---------- 画面（プレビューのダイアログ） ----------
  const intentUrl = (text) =>
    `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&hashtags=${encodeURIComponent(D.meta.shareHashtags.slice(0, 2).join(','))}${/^https?:$/.test(location.protocol) ? `&url=${encodeURIComponent(SITE)}` : ''}`;
  const canShareFile = () => !!(made && made.file && navigator.canShare && navigator.canShare({ files: [made.file] }));

  function bonus() {
    if (!YT.Store.claimShareDay(YT.Store.localDate())) return;
    YT.Sound.fanfare();
    api.toast(`九州の魅力発信ボーナス +${api.yen(D.meta.craft.shareBonus)}（クラフト資金・1日1回）`, 'toast-gold');
    api.renderAll();
  }
  function download() {
    if (!made) return;
    const a = document.createElement('a');
    a.href = made.canvas.toDataURL('image/png');
    a.download = made.file ? made.file.name : 'qtrip-techo.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  async function share() {
    if (!made) return;
    if (canShareFile()) {
      try {
        await navigator.share({ files: [made.file], title: 'Q-TRIP 九州よりみちダイス', text: `${made.text} #九州よりみちダイス #QTRIP ${SITE}` });
        bonus();
      } catch (e) {
        /* 共有シートを閉じただけ */
      }
      return;
    }
    // PC など：画像を保存しつつ、X の投稿画面をひらく（画像はあとから添付してもらう）
    window.open(intentUrl(made.text), '_blank', 'noopener');
    download();
    bonus();
    api.toast('手帖カードを保存しました。X の投稿画面に画像を添付してシェアしてください');
  }

  async function open() {
    layer.innerHTML = `<div class="sc-box" role="dialog" aria-modal="true" aria-labelledby="sc-title">
        <button class="modal-close" data-sc-close aria-label="閉じる">${I('close')}</button>
        <p class="sc-kicker">旅の軌跡・公式認定手帖カード</p>
        <h2 id="sc-title" class="sc-title">${I('camera')} 手帖カードを発行する</h2>
        <div class="sc-preview"><p class="sc-loading">手帖カードを描いています…</p></div>
        <div class="sc-actions">
          <button class="primary-btn" data-sc-save disabled>${I('download')} 手帖画像を保存（PNG）</button>
          <button class="share-btn" data-sc-share disabled>${I('share')}<span class="sc-share-label">Xなどでシェアする</span></button>
        </div>
        <p class="sc-note">カードを発行・シェアすると、1日1回だけ「九州の魅力発信ボーナス」+${api.yen(D.meta.craft.shareBonus)}がクラフト資金に入ります。投函した写真は、このカードに小さく入ります（画像を保存・共有するまで、どこにも送られません）。</p>
      </div>`;
    layer.hidden = false;
    requestAnimationFrame(() => layer.classList.add('is-open'));
    document.body.classList.add('modal-open');
    made = await draw();
    if (layer.hidden) return;
    const pv = $('.sc-preview', layer);
    pv.innerHTML = '';
    made.canvas.className = 'sc-canvas';
    made.canvas.setAttribute('role', 'img');
    made.canvas.setAttribute('aria-label', `手帖カード：${YT.Ownership.youName()}『${made.nick}』`);
    pv.appendChild(made.canvas);
    $('[data-sc-save]', layer).disabled = false;
    $('[data-sc-share]', layer).disabled = false;
    $('[data-sc-share]', layer).lastChild.textContent = canShareFile() ? 'シェアする（画像つき）' : 'Xでシェアする';
    bonus(); // カードの発行でも、1日1回のボーナス
    $('[data-sc-save]', layer).focus({ preventScroll: true });
  }
  function close() {
    if (!layer || layer.hidden) return false;
    layer.classList.remove('is-open');
    document.body.classList.remove('modal-open');
    setTimeout(() => (layer.hidden = true), 200);
    return true;
  }

  YT.ShareCard = {
    init(data, a, el) {
      D = data;
      api = a;
      layer = el;
      document.addEventListener('click', (e) => {
        if (e.target.closest('[data-sharecard], #btn-sharecard')) return open();
        if (!layer.contains(e.target)) return;
        if (e.target.closest('[data-sc-close]') || e.target === layer) return close();
        if (e.target.closest('[data-sc-save]')) {
          download();
          bonus();
          api.toast('手帖カードを保存しました');
        }
        if (e.target.closest('[data-sc-share]')) share();
      });
    },
    open,
    close,
    draw,
    nickname: () => nickname(facts()),
  };
})();
