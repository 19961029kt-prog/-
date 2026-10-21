// 駅のオーナー権：累計購入金額ランキングで決める（トップオーナー制＋下克上ボーナス＋上位3名の共同株主）。
// サーバーはないので、競う相手は stations.json の「ライバル旅人」（駅ごとの rivals）。自分の実績はレシートで立候補した記録（Store.purchases）。
//   ・1位（totalAmount がいちばん高い）＝ その駅の正式なオーナー（地図の金の印・称号の総資産額に入る）
//   ・いまの1位でない人が立候補するときは、申告額に下克上ボーナス（meta.owner.upsetBonus＝1.3倍）を掛けて数える
//   ・上位3名（meta.owner.shareholders）は共同株主。駅の評価額（万円）を、上位3名の中での金額の割合で配当として分け合う
// 配当はゲームの中だけのクラフト資金（お金の価値はない）。
(function () {
  'use strict';
  const YT = (window.YT = window.YT || {});
  const { Store } = YT;
  let D = null;

  const cfg = () => D.meta.owner;
  const rivalById = () => Object.fromEntries(D.meta.rivals.map((r) => [r.id, r]));
  const youName = () => Store.get().profile.name || 'あなた';

  // ownersHistory：その駅の購入実績ランキング（金額の大きい順。同じ額ならライバルが先＝追い越さないと上がらない）
  function ranking(id) {
    const s = D.byId[id];
    const R = rivalById();
    const rows = (s.rivals || []).map((r) => ({
      userId: `rival:${r.id}`,
      userName: (R[r.id] || {}).name || r.id,
      icon: (R[r.id] || {}).icon || '🧳',
      isYou: false,
      totalAmount: r.amount,
      lastUpdated: null,
      receiptImages: [],
    }));
    const mine = Store.getPurchases(id);
    if (mine.length) {
      rows.push({
        userId: 'you',
        userName: youName(),
        icon: '🎒',
        isYou: true,
        totalAmount: mine.reduce((n, p) => n + p.scored, 0),
        lastUpdated: mine[mine.length - 1].at,
        receiptImages: mine.map((p) => p.imageId).filter(Boolean),
      });
    }
    rows.sort((a, b) => b.totalAmount - a.totalAmount || (a.isYou ? 1 : 0) - (b.isYou ? 1 : 0));
    const top = rows.slice(0, cfg().shareholders);
    const pool = top.reduce((n, r) => n + r.totalAmount, 0) || 1;
    rows.forEach((r, i) => {
      r.rank = i + 1;
      r.share = i < cfg().shareholders ? r.totalAmount / pool : 0;
      r.dividend = Math.round(s.assetValue * r.share); // 万円（ゲーム内のクラフト資金）
    });
    return rows;
  }
  const you = (id) => ranking(id).find((r) => r.isYou) || null;
  const yourRank = (id) => (you(id) || {}).rank || null;
  const owner = (id) => ranking(id)[0];

  // 立候補する前の見込み：この金額を足すと何位になるか
  function preview(id, amount) {
    const before = yourRank(id);
    const upset = before !== 1;
    const scored = Math.round(amount * (upset ? cfg().upsetBonus : 1));
    const rows = ranking(id).filter((r) => !r.isYou);
    const mine = (you(id) || { totalAmount: 0 }).totalAmount + scored;
    const rankAfter = rows.filter((r) => r.totalAmount >= mine).length + 1;
    const leader = rows[0] ? rows[0].totalAmount : 0;
    const toTop = Math.max(0, leader - mine + 1);
    // 次の立候補でも1位でなければ下克上ボーナスが付くので、実際に必要な購入額は toTop ÷ 1.3（切り上げ）
    const needToTop = rankAfter === 1 ? 0 : Math.ceil(toTop / cfg().upsetBonus);
    return { before, upset, scored, total: mine, rankAfter, toTop, needToTop };
  }

  // 立候補を記録する。返り値で、1位を取ったか（王座交代）がわかる
  function register(id, rec) {
    const p = preview(id, rec.amount);
    Store.addPurchase(id, { ...rec, scored: p.scored, upset: p.upset });
    sync();
    const after = yourRank(id);
    return { ...p, after, tookThrone: after === 1 && p.before !== 1 };
  }

  // 1位の駅を Store.acquired に書き戻す（称号・旅しおり・地図の金色がこれを見る）
  function sync() {
    const top = {};
    for (const s of D.stations) {
      if (yourRank(s.id) !== 1) continue;
      const list = Store.getPurchases(s.id);
      const last = list[list.length - 1];
      top[s.id] = { at: last.at, via: last.via, provider: last.shop, item: last.item };
    }
    Store.syncOwners(top);
  }

  // 共同株主としての配当の合計（クラフト資金に入る）
  const totalDividends = () => D.stations.reduce((n, s) => n + ((you(s.id) || {}).dividend || 0), 0);
  const shareholderOf = () => D.stations.filter((s) => (yourRank(s.id) || 99) <= cfg().shareholders).map((s) => s.id);

  YT.Ownership = {
    init(data) {
      D = data;
      sync();
    },
    ranking,
    you,
    yourRank,
    owner,
    preview,
    register,
    sync,
    totalDividends,
    shareholderOf,
    youName,
  };
})();
