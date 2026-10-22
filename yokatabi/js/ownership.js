// 駅のオーナー権：累計出資額ランキングで決める（トップオーナー制＋下克上ボーナス＋上位3名の共同株主）。
// サーバーはないので、競う相手は stations.json の「ライバル旅人」（駅ごとの rivals。金額は万円）。
// 自分の実績は、クラフト資金で出資した記録（Store.purchases。保存データの項目名は旧名のまま。レシート時代の記録もそのまま数える）。
//   ・1位（totalAmount がいちばん高い）＝ その駅の正式なオーナー（地図の金の王冠・称号の総資産額に入る）
//   ・いまの1位でない人が出資するときは、出資額に下克上ボーナス（meta.owner.upsetBonus＝1.3倍）を掛けて数える
//   ・上位3名（meta.owner.shareholders）は共同株主。配当は駅の評価額（万円）× meta.owner.dividendRates
//     （1位＝評価額そのまま、2位・3位の理事＝その3割・1割5分）
// 配当はゲームの中だけのクラフト資金（お金の価値はない）。
(function () {
  'use strict';
  const YT = (window.YT = window.YT || {});
  const { Store } = YT;
  let D = null;

  const cfg = () => D.meta.owner;
  const rivalById = () => Object.fromEntries(D.meta.rivals.map((r) => [r.id, r]));
  const youName = () => Store.get().profile.name || 'あなた';

  // ownersHistory：その駅の出資額ランキング（金額の大きい順。同じ額ならライバルが先＝追い越さないと上がらない）
  // baseRanking はライン制覇の倍率をかける前。ranking は、制覇したラインの駅の自分の配当を lineBonus 倍にする
  function baseRanking(id) {
    const s = D.byId[id];
    const R = rivalById();
    const rows = (s.rivals || []).map((r) => ({
      userId: `rival:${r.id}`,
      userName: (R[r.id] || {}).name || r.id,
      icon: (R[r.id] || {}).icon || 'suitcase',
      avatarConfig: (R[r.id] || {}).avatar || null,
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
        icon: 'bag',
        avatarConfig: { ...Store.get().equipped },
        isYou: true,
        totalAmount: mine.reduce((n, p) => n + p.scored, 0),
        lastUpdated: mine[mine.length - 1].at,
        receiptImages: mine.map((p) => p.imageId).filter(Boolean),
      });
    }
    rows.sort((a, b) => b.totalAmount - a.totalAmount || (a.isYou ? 1 : 0) - (b.isYou ? 1 : 0));
    const top = rows.slice(0, cfg().shareholders);
    const pool = top.reduce((n, r) => n + r.totalAmount, 0) || 1;
    const rates = cfg().dividendRates;
    rows.forEach((r, i) => {
      r.rank = i + 1;
      r.share = i < cfg().shareholders ? r.totalAmount / pool : 0; // 上位3名の中での出資額の割合（表示用）
      r.dividend = i < cfg().shareholders ? Math.round(s.assetValue * (rates[i] || 0)) : 0; // 万円（ゲーム内のクラフト資金）
    });
    return rows;
  }
  const baseRank = (id) => (baseRanking(id).find((r) => r.isYou) || {}).rank || null;

  // ライン制覇：ラインの全駅で上位3名（共同株主以上）に入っている（meta.game.lines）
  const lines = () => (D.meta.game && D.meta.game.lines) || [];
  const clearedLines = () => lines().filter((l) => l.stations.every((id) => (baseRank(id) || 99) <= cfg().shareholders));
  const lineOf = (id) => lines().find((l) => l.stations.includes(id)) || null;
  function ranking(id) {
    const rows = baseRanking(id);
    const l = lineOf(id);
    if (l && clearedLines().some((c) => c.id === l.id)) {
      rows.forEach((r) => {
        if (r.isYou && r.dividend) {
          r.dividend *= (D.meta.game.lineBonus || 2);
          r.lineBonus = l.name;
        }
      });
    }
    return rows;
  }
  const you = (id) => ranking(id).find((r) => r.isYou) || null;
  const yourRank = (id) => baseRank(id);
  const owner = (id) => ranking(id)[0];

  // 出資する前の見込み：この金額を足すと何位になるか
  function preview(id, amount) {
    const before = yourRank(id);
    const upset = before !== 1;
    const scored = Math.round(amount * (upset ? cfg().upsetBonus : 1));
    const rows = ranking(id).filter((r) => !r.isYou);
    const mine = (you(id) || { totalAmount: 0 }).totalAmount + scored;
    const rankAfter = rows.filter((r) => r.totalAmount >= mine).length + 1;
    const leader = rows[0] ? rows[0].totalAmount : 0;
    const toTop = Math.max(0, leader - mine + 1);
    // 次の出資でも1位でなければ下克上ボーナスが付くので、実際に必要な出資額は toTop ÷ 1.3（切り上げ）
    const needToTop = rankAfter === 1 ? 0 : Math.ceil(toTop / cfg().upsetBonus);
    return { before, upset, scored, total: mine, rankAfter, toTop, needToTop };
  }

  // rank 位以内に入るのに、あといくら出資すればよいか（万円。下克上ボーナスも見込む。もう入っていれば 0）
  function needFor(id, rank) {
    const now = yourRank(id);
    if (now && now <= rank) return 0;
    const rows = ranking(id).filter((r) => !r.isYou);
    const target = rows[rank - 1];
    if (!target) return 1;
    const mine = (you(id) || { totalAmount: 0 }).totalAmount;
    const k = now === 1 ? 1 : cfg().upsetBonus;
    return Math.max(1, Math.ceil((target.totalAmount - mine + 1) / k));
  }

  // 出資を記録する。返り値で、1位を取ったか（王座交代）がわかる
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
    needFor,
    register,
    sync,
    totalDividends,
    shareholderOf,
    clearedLines,
    lineOf,
    youName,
  };
})();
