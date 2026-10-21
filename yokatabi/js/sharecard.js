// 旅の軌跡・手帖シェアカード：自分の九州フォトマップ・オーナーの駅・改造列車・アバターを、
// 1200×630 の手帖の見開き風の1枚絵（PNG）にして、保存・共有できるようにする。外部のサーバーは使わず <canvas> だけで描く。
//   左：九州の地図（踏破した駅＝テラコッタ、トップオーナーの駅＝金の王冠と駅名、投函した駅＝小さなポラロイド）
//   右上：愛車編成（1両目＋2両目＋トレイル）と旅人アバターを車窓の枠の中に
//   右下：旅人名・二つ名（金の箔押し風）・総資産額・踏破率・オーナーの駅・投函したスナップの数
//   隅：今日の日付の朱の風景印と、公開URLのクレジット
// 発行またはシェアすると、1日1回だけ「九州の魅力発信ボーナス」（meta.craft.shareBonus）がクラフト資金に入る。
(function () {
  'use strict';
  const YT = (window.YT = window.YT || {});
  const W = 1200, H = 630;
  const SITE = 'https://q-trip.github.io/';
  let D = null, api = null, layer = null;
  let made = null; // { canvas, blob, file, text }
  const $ = (sel, r = document) => r.querySelector(sel);
  const MINCHO = '"Shippori Mincho", "Hiragino Mincho ProN", serif';
  const UI = '"Zen Maru Gothic", "Hiragino Maru Gothic ProN", sans-serif';

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
  function crown(ctx, x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.moveTo(-s, 0);
    ctx.lineTo(-s, -s * 0.9);
    ctx.lineTo(-s * 0.45, -s * 0.35);
    ctx.lineTo(0, -s * 1.15);
    ctx.lineTo(s * 0.45, -s * 0.35);
    ctx.lineTo(s, -s * 0.9);
    ctx.lineTo(s, 0);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, -s, 0, 0);
    g.addColorStop(0, '#f3d58c');
    g.addColorStop(1, '#b8862f');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = '#7a5a1e';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  }
  // 朱の風景印（円の内側に英字を回し、中央に今日の日付）
  function officialStamp(ctx, x, y, r, date) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.18);
    ctx.globalAlpha = 0.86;
    ctx.strokeStyle = '#c0392b';
    ctx.fillStyle = '#c0392b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, 0, r - 18, 0, Math.PI * 2);
    ctx.stroke();
    const text = 'Q-TRIP KYUSHU OFFICIAL TRAVELBOOK ・ ';
    ctx.font = `700 11px ${UI}`;
    const step = (Math.PI * 2) / text.length;
    [...text].forEach((c, i) => {
      ctx.save();
      ctx.rotate(i * step);
      ctx.fillText(c, -3, -r + 13);
      ctx.restore();
    });
    ctx.textAlign = 'center';
    ctx.font = `700 16px ${MINCHO}`;
    ctx.fillText(date, 0, 2);
    ctx.font = `700 10px ${UI}`;
    ctx.fillText('旅の軌跡 認定', 0, 20);
    ctx.beginPath();
    ctx.moveTo(-26, -14);
    ctx.lineTo(26, -14);
    ctx.stroke();
    ctx.restore();
  }

  // ---------- カードを描く ----------
  async function draw() {
    const f = facts();
    const nick = nickname(f);
    const today = YT.Store.localDate().replace(/-/g, '.');
    const words = [f.name, nick, f.trainName, ...D.stations.map((s) => s.name), '旅の軌跡・公式認定手帖カード わたしの九州制覇＆フォトマップ 愛車編成 旅人 総資産額 九州踏破率 トップオーナーの駅 投函したスナップ 枚 駅 踏破した駅 0123456789.%億万円 九州よりみちダイス 認定 なし まだありません ・＋'].join('');
    try {
      await Promise.race([
        Promise.all([document.fonts.load(`700 40px ${MINCHO}`, words), document.fonts.load(`700 20px ${UI}`, words), document.fonts.load(`500 16px ${UI}`, words)]),
        new Promise((r) => setTimeout(r, 2500)),
      ]);
    } catch (e) {
      /* 書体が読めなくても、手元の書体で描く */
    }
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d');

    // 表紙（深緑）と見開きの紙
    ctx.fillStyle = '#234236';
    ctx.fillRect(0, 0, W, H);
    rounded(ctx, 22, 22, W - 44, H - 44, 18);
    ctx.fillStyle = '#faf6f0';
    ctx.fill();
    const gutter = ctx.createLinearGradient(W / 2 - 30, 0, W / 2 + 30, 0);
    gutter.addColorStop(0, 'rgba(58,50,43,0)');
    gutter.addColorStop(0.5, 'rgba(58,50,43,.14)');
    gutter.addColorStop(1, 'rgba(58,50,43,0)');
    ctx.fillStyle = gutter;
    ctx.fillRect(W / 2 - 30, 22, 60, H - 44);
    // 紙の罫線
    ctx.strokeStyle = 'rgba(184,166,142,.25)';
    ctx.lineWidth = 1;
    for (let y = 92; y < H - 40; y += 30) {
      ctx.beginPath();
      ctx.moveTo(W / 2 + 34, y);
      ctx.lineTo(W - 50, y);
      ctx.stroke();
    }

    // 見出し
    ctx.fillStyle = '#2c2523';
    ctx.font = `700 15px ${UI}`;
    ctx.fillStyle = '#d96b43';
    ctx.fillText('旅の軌跡・公式認定手帖カード', 52, 62);
    ctx.fillStyle = '#2c2523';
    ctx.font = `700 24px ${MINCHO}`;
    ctx.fillText('わたしの九州制覇＆フォトマップ', 52, 94);

    // ---- 左：地図 ----
    const G = window.YOKATABI_GEO;
    const vx = 118, vy = 0, vw = 584, vh = 960;
    const box = { x: 52, y: 108, w: 300, h: 492 };
    const k = Math.min(box.w / vw, box.h / vh);
    const ox = box.x + (box.w - vw * k) / 2, oy = box.y + (box.h - vh * k) / 2;
    const P = (x, y) => [ox + (x - vx) * k, oy + (y - vy) * k];
    rounded(ctx, box.x - 8, box.y - 6, box.w + 16, box.h + 12, 12);
    ctx.fillStyle = '#d8eceb';
    ctx.fill();
    ctx.save();
    rounded(ctx, box.x - 8, box.y - 6, box.w + 16, box.h + 12, 12);
    ctx.clip();
    ctx.translate(ox, oy);
    ctx.scale(k, k);
    ctx.translate(-vx, -vy);
    if (G) {
      const land = new Path2D(G.land.join(''));
      ctx.fillStyle = '#f4ebd9';
      ctx.fill(land);
      ctx.strokeStyle = '#b8a68e';
      ctx.lineWidth = 1.4 / k / 1.4;
      ctx.stroke(land);
      ctx.setLineDash([4, 4]);
      G.borders.forEach((d) => ctx.stroke(new Path2D(d)));
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(110,82,60,.55)';
      ctx.lineWidth = 2.2;
      Object.values(G.routes).forEach((d) => ctx.stroke(new Path2D(d)));
    }
    ctx.restore();
    // 駅：踏破＝テラコッタ、まだ＝生成り
    D.stations.forEach((s) => {
      const [x, y] = P(s.x, s.y);
      ctx.beginPath();
      ctx.arc(x, y, f.st.visited[s.id] ? 4.6 : 3.2, 0, Math.PI * 2);
      ctx.fillStyle = f.st.visited[s.id] ? '#d96b43' : '#fffdf9';
      ctx.fill();
      ctx.strokeStyle = '#7a6449';
      ctx.lineWidth = 1;
      ctx.stroke();
    });
    // 投函した駅：小さなポラロイドのピン
    for (const id of f.cards) {
      const s = D.byId[id];
      const card = YT.Store.getPostcards()[id];
      const [x, y] = P(s.x, s.y);
      ctx.save();
      ctx.translate(x + 6, y - 34);
      ctx.rotate(((id.length % 5) - 2) * 0.05);
      ctx.shadowColor = 'rgba(58,50,43,.3)';
      ctx.shadowBlur = 4;
      ctx.fillStyle = '#fff';
      ctx.fillRect(-12, -14, 24, 28);
      ctx.shadowBlur = 0;
      const blob = card && (await YT.Receipts.get(card.imageId));
      if (blob) {
        try {
          const bmp = await createImageBitmap(blob);
          const sz = Math.min(bmp.width, bmp.height);
          ctx.drawImage(bmp, (bmp.width - sz) / 2, (bmp.height - sz) / 2, sz, sz, -10, -12, 20, 18);
        } catch (e) {
          ctx.fillStyle = '#cbe6e4';
          ctx.fillRect(-10, -12, 20, 18);
        }
      }
      ctx.restore();
      ctx.strokeStyle = 'rgba(58,50,43,.5)';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 6, y - 20);
      ctx.stroke();
    }
    // トップオーナーの駅：金の王冠と駅名
    ctx.font = `700 12px ${MINCHO}`;
    f.owned.forEach((s) => {
      const [x, y] = P(s.x, s.y);
      crown(ctx, x, y - 6, 7);
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(250,246,240,.95)';
      ctx.strokeText(s.name, x + 9, y + 4);
      ctx.fillStyle = '#6e5d4f';
      ctx.fillText(s.name, x + 9, y + 4);
    });
    // 凡例と数字（地図の右）
    const lx = 372;
    const legend = [
      ['#d96b43', '踏破した駅', `${f.visited.length}駅`],
      ['crown', 'トップオーナーの駅', `${f.owned.length}駅`],
      ['polaroid', '投函したスナップ', `${f.cards.length}枚`],
    ];
    legend.forEach(([kind, label, val], i) => {
      const y = 150 + i * 62;
      if (kind === 'crown') crown(ctx, lx + 8, y + 6, 8);
      else if (kind === 'polaroid') {
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#b8a68e';
        ctx.fillRect(lx, y - 10, 16, 19);
        ctx.strokeRect(lx, y - 10, 16, 19);
      } else {
        ctx.beginPath();
        ctx.arc(lx + 8, y, 6, 0, Math.PI * 2);
        ctx.fillStyle = kind;
        ctx.fill();
      }
      ctx.fillStyle = '#6e5d4f';
      ctx.font = `500 13px ${UI}`;
      ctx.fillText(label, lx + 24, y + 4);
      ctx.fillStyle = '#2c2523';
      ctx.font = `700 24px ${MINCHO}`;
      ctx.fillText(val, lx + 24, y + 34);
    });
    ctx.fillStyle = '#6e5d4f';
    ctx.font = `500 12px ${UI}`;
    ctx.fillText(`九州踏破率 ${f.visitedPct}%`, lx, 352);
    ctx.fillStyle = '#e9dfcf';
    rounded(ctx, lx, 362, 180, 8, 4);
    ctx.fill();
    ctx.fillStyle = '#5b8266';
    rounded(ctx, lx, 362, Math.max(8, 180 * (f.visitedPct / 100)), 8, 4);
    ctx.fill();

    // ---- 右上：愛車編成と旅人 ----
    const rx = W / 2 + 40, ry = 52, rw = W - rx - 52, rh = 236;
    ctx.fillStyle = '#5b4a3c';
    rounded(ctx, rx - 6, ry - 6, rw + 12, rh + 12, 20);
    ctx.fill();
    const sky = ctx.createLinearGradient(0, ry, 0, ry + rh);
    sky.addColorStop(0, '#dcebe6');
    sky.addColorStop(1, '#f4e6cf');
    rounded(ctx, rx, ry, rw, rh, 16);
    ctx.fillStyle = sky;
    ctx.fill();
    ctx.save();
    rounded(ctx, rx, ry, rw, rh, 16);
    ctx.clip();
    // 山並みと線路
    ctx.fillStyle = '#b9c9a5';
    ctx.beginPath();
    ctx.moveTo(rx, ry + 170);
    for (let i = 0; i <= 8; i++) ctx.quadraticCurveTo(rx + i * (rw / 8) - rw / 16, ry + 110 + (i % 2) * 26, rx + i * (rw / 8), ry + 150 + (i % 3) * 8);
    ctx.lineTo(rx + rw, ry + rh);
    ctx.lineTo(rx, ry + rh);
    ctx.fill();
    ctx.fillStyle = '#8f7a66';
    ctx.fillRect(rx, ry + 196, rw, 6);
    for (let x = rx; x < rx + rw; x += 14) ctx.fillRect(x, ry + 202, 7, 4);
    const trainSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-200 -78 270 86"><g transform="translate(-128 0)">${YT.Craft.carriageSvg()}</g>${YT.Craft.trainSvg()}</svg>`;
    const trainImg = await svgImage(trainSvg, 540, 172);
    if (trainImg) ctx.drawImage(trainImg, rx + 8, ry + 52, 400, 400 * (86 / 270));
    // トレイル（ふわっと3つ）
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    [[rx + 300, ry + 66, 12], [rx + 286, ry + 48, 9], [rx + 270, ry + 34, 7]].forEach(([x, y, r]) => {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    });
    const avImg = await svgImage(YT.Craft.avatarSvg(f.eq, { id: 'sc-av' }).replace('<svg ', '<svg width="240" height="280" '), 240, 280);
    if (avImg) ctx.drawImage(avImg, rx + rw - 150, ry + 50, 140, 163);
    ctx.restore();
    ctx.fillStyle = 'rgba(35,66,54,.88)';
    rounded(ctx, rx + 12, ry + 12, rw - 24, 30, 15);
    ctx.fill();
    ctx.fillStyle = '#faf6f0';
    ctx.font = `700 15px ${UI}`;
    ctx.fillText(fitText(ctx, `🚃 愛車編成：${f.trainName}`, rw - 50), rx + 26, ry + 32);

    // ---- 右下：旅人のステータス ----
    const sx = rx, sy = ry + rh + 34;
    ctx.fillStyle = '#6e5d4f';
    ctx.font = `500 13px ${UI}`;
    ctx.fillText('旅人', sx, sy + 8);
    ctx.fillStyle = '#2c2523';
    ctx.font = `700 34px ${MINCHO}`;
    ctx.fillText(fitText(ctx, f.name, 250), sx, sy + 46);
    // 二つ名：金の箔押し風のバッジ
    ctx.font = `700 16px ${MINCHO}`;
    const nw = Math.min(rw - 20, ctx.measureText(`『${nick}』`).width + 36);
    const foil = ctx.createLinearGradient(sx, 0, sx + nw, 0);
    foil.addColorStop(0, '#b8862f');
    foil.addColorStop(0.5, '#f3d58c');
    foil.addColorStop(1, '#b8862f');
    rounded(ctx, sx, sy + 60, nw, 34, 17);
    ctx.fillStyle = foil;
    ctx.fill();
    ctx.strokeStyle = '#8a6420';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#3a2a12';
    ctx.fillText(fitText(ctx, `『${nick}』`, nw - 30), sx + 18, sy + 83);
    // 数字
    const nums = [['総資産額', yenBig(f.assets)], ['九州踏破率', `${f.visitedPct}%`], ['投函したスナップ', `${f.cards.length}枚`]];
    nums.forEach(([label, val], i) => {
      const x = sx + i * (rw / 3);
      ctx.fillStyle = '#6e5d4f';
      ctx.font = `500 12px ${UI}`;
      ctx.fillText(label, x, sy + 124);
      ctx.fillStyle = '#2c2523';
      ctx.font = `700 22px ${MINCHO}`;
      ctx.fillText(fitText(ctx, val, rw / 3 - 10), x, sy + 152);
    });
    ctx.fillStyle = '#6e5d4f';
    ctx.font = `500 12px ${UI}`;
    ctx.fillText('トップオーナーの駅', sx, sy + 180);
    ctx.fillStyle = '#2c2523';
    ctx.font = `700 15px ${MINCHO}`;
    ctx.fillText(fitText(ctx, f.owned.length ? f.owned.map((s) => `${s.name}駅`).join('・') : 'まだありません（旅の途中）', rw - 130), sx, sy + 202);

    // ---- 隅：風景印とクレジット ----
    officialStamp(ctx, W - 108, H - 112, 62, today);
    ctx.fillStyle = 'rgba(110,93,79,.8)';
    ctx.font = `500 13px ${UI}`;
    ctx.textAlign = 'right';
    ctx.fillText(SITE, W - 52, H - 34);
    ctx.textAlign = 'left';
    ctx.fillText('Q-TRIP 九州よりみちダイス', 372, H - 34);

    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    const file = blob ? new File([blob], `qtrip-techo-${today.replace(/\./g, '')}.png`, { type: 'image/png' }) : null;
    const top = f.owned[0];
    const text = top
      ? `🚂 現在の総資産${yenBig(f.assets)}！${top.name}駅のトップオーナーとして『${YT.Craft.item('livery', f.eq.livery).name}』で九州旅の途中です✨ 二つ名は『${nick}』`
      : `🚂 九州踏破率${f.visitedPct}%！『${YT.Craft.item('livery', f.eq.livery).name}』で九州よりみち旅の途中です✨ 二つ名は『${nick}』`;
    return { canvas: c, blob, file, text, nick };
  }

  // ---------- 画面（プレビューのダイアログ） ----------
  const intentUrl = (text) =>
    `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&hashtags=${encodeURIComponent(D.meta.shareHashtags.slice(0, 2).join(','))}${/^https?:$/.test(location.protocol) ? `&url=${encodeURIComponent(SITE)}` : ''}`;
  const canShareFile = () => !!(made && made.file && navigator.canShare && navigator.canShare({ files: [made.file] }));

  function bonus() {
    if (!YT.Store.claimShareDay(YT.Store.localDate())) return;
    YT.Sound.fanfare();
    api.toast(`📣 九州の魅力発信ボーナス +${api.yen(D.meta.craft.shareBonus)}（クラフト資金・1日1回）`, 'toast-gold');
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
    api.toast('💾 手帖カードを保存しました。X の投稿画面に画像を添付してシェアしてください');
  }

  async function open() {
    layer.innerHTML = `<div class="sc-box" role="dialog" aria-modal="true" aria-labelledby="sc-title">
        <button class="modal-close" data-sc-close aria-label="閉じる">×</button>
        <p class="sc-kicker">旅の軌跡・公式認定手帖カード</p>
        <h2 id="sc-title" class="sc-title">📸 手帖カードを発行する</h2>
        <div class="sc-preview"><p class="sc-loading">手帖カードを描いています…</p></div>
        <div class="sc-actions">
          <button class="primary-btn" data-sc-save disabled>💾 手帖画像を保存（PNG）</button>
          <button class="share-btn" data-sc-share disabled><span class="x-logo" aria-hidden="true">𝕏</span>Xなどでシェアする</button>
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
          api.toast('💾 手帖カードを保存しました');
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
