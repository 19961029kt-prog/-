// マイ旅しおり：買収した駅を巡る「リアル九州旅行モデルコース（1泊2日）」を自動生成する。
// 画面には触れない純粋なロジック（tools/test-trip.mjs で node から検証できる）。
//
// 考え方
// - 区間の所要時間（routeOverrides[].minutes）で全駅間の最短経路を出し、路線が変わるごとに乗り換え時間を足す
// - 1日目：空港・主要駅（gateway）を朝に出発 → 買収駅を巡る → 買収駅のどこかに泊まる
// - 2日目：泊まった駅で朝の過ごし方 → 買収駅を巡る → gateway に夕方までに着いて解散
// - 時間内に収まる道順をすべて探し、「巡れる買収駅の数」を最優先に、湯けむり物件泊・評価額・移動の短さで採点する
(function () {
  'use strict';
  const YT = (window.YT = window.YT || {});

  const edgeKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const toMin = (hhmm) => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  };
  const clock = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
  const duration = (min) => {
    const h = Math.floor(min / 60), m = min % 60;
    return h ? `${h}時間${m ? `${m}分` : ''}` : `${m}分`;
  };

  // 全駅間の最短所要時間（Dijkstra）と、乗り換えを含む「行程（leg）」
  function createRouter(D) {
    const edgeBy = {};
    D.edges.forEach((e) => (edgeBy[e.key] = e));
    const ids = D.stations.map((s) => s.id);
    const transfer = D.meta.trip.transferMinutes || 0;
    const trees = {};
    const legs = {};

    function tree(src) {
      if (trees[src]) return trees[src];
      const dist = {}, prev = {};
      ids.forEach((i) => (dist[i] = Infinity));
      dist[src] = 0;
      const open = new Set(ids);
      while (open.size) {
        let u = null;
        open.forEach((i) => {
          if (u === null || dist[i] < dist[u]) u = i;
        });
        open.delete(u);
        if (dist[u] === Infinity) break;
        D.adj[u].forEach((v) => {
          const nd = dist[u] + (edgeBy[edgeKey(u, v)].minutes || 60);
          if (nd < dist[v]) {
            dist[v] = nd;
            prev[v] = u;
          }
        });
      }
      return (trees[src] = { dist, prev });
    }

    // a → b の行程：経路・区間ごとの路線・乗り換え回数・合計時間（分）
    function leg(a, b) {
      if (a === b) return null;
      const k = `${a}>${b}`;
      if (legs[k]) return legs[k];
      const { prev } = tree(a);
      const path = [b];
      while (path[0] !== a) {
        if (prev[path[0]] === undefined) return (legs[k] = null);
        path.unshift(prev[path[0]]);
      }
      const segments = [];
      for (let i = 0; i < path.length - 1; i++) {
        const e = edgeBy[edgeKey(path[i], path[i + 1])];
        segments.push({ from: path[i], to: path[i + 1], type: e.type || 'local', name: e.name || '', minutes: e.minutes || 60 });
      }
      // 同じ路線名が続く区間はひとつの乗車にまとめ、乗り換え回数を数える
      const rides = [];
      segments.forEach((s) => {
        const last = rides[rides.length - 1];
        if (last && last.name === s.name && last.type === s.type) {
          last.to = s.to;
          last.minutes += s.minutes;
        } else rides.push({ ...s });
      });
      const transfers = rides.length - 1;
      const minutes = rides.reduce((n, r) => n + r.minutes, 0) + transfers * transfer;
      return (legs[k] = { from: a, to: b, path, rides, transfers, minutes });
    }

    const travel = (a, b) => (a === b ? 0 : leg(a, b) ? leg(a, b).minutes : Infinity);
    return { leg, travel };
  }

  function generate(D, acquiredIds, { limit = 3 } = {}) {
    const cfg = D.meta.trip;
    const A = acquiredIds.filter((id) => D.byId[id]);
    if (A.length < cfg.minAcquired) return { plans: [], reason: 'few', need: cfg.minAcquired - A.length };

    const router = createRouter(D);
    const gateways = D.stations.filter((s) => s.gateway).map((s) => s.id);
    const d1s = toMin(cfg.day1Start), d1e = toMin(cfg.day1End);
    const d2s = toMin(cfg.day2Start) + cfg.morningMinutes, d2e = toMin(cfg.day2End);
    const stayMin = (id) => D.byId[id].plan.minutes;
    const found = [];

    // dusk：1日目の観光を終えた時刻。早すぎると午後がまるごと空くので減点する
    function record(g1, day1, day2, g2, moved, dusk, end) {
      const visits = [...day1, ...day2];
      const overnight = day1[day1.length - 1];
      const onsen = D.byId[overnight].propertyType === '湯けむり物件';
      const asset = visits.reduce((n, id) => n + D.byId[id].assetValue, 0);
      const idle1 = Math.max(0, d1e - 60 - dusk); // 17:00 より前に1日目が終わる
      const idle2 = Math.max(0, d2s + 240 - end); // 2日目が昼過ぎより前に終わる
      const score = visits.length * 1000 + (onsen ? 120 : 0) + asset / 20 - moved * 1.2 + (g1 === g2 ? 40 : 0) - idle1 * 0.8 - idle2 * 0.3;
      found.push({ g1, g2, day1, day2, overnight, visits, moved, score });
    }

    // 2日目：泊まった駅から買収駅を巡り、gateway で解散
    function day2(cur, t, g1, d1, d2, seen, moved, dusk) {
      gateways.forEach((g2) => {
        const tt = router.travel(cur, g2);
        if (t + tt <= d2e) record(g1, d1, d2, g2, moved + tt, dusk, t + tt);
      });
      if (d1.length + d2.length >= cfg.maxStops) return;
      A.forEach((a) => {
        if (seen.has(a)) return;
        const tt = router.travel(cur, a);
        const leave = t + tt + stayMin(a);
        if (leave > d2e) return;
        seen.add(a);
        day2(a, leave, g1, d1, d2.concat(a), seen, moved + tt, dusk);
        seen.delete(a);
      });
    }

    // 1日目：gateway を出発して買収駅を巡り、どこかに泊まる
    function day1(cur, t, g1, d1, seen, moved) {
      if (d1.length >= cfg.maxStops) return;
      A.forEach((a) => {
        if (seen.has(a)) return;
        const tt = router.travel(cur, a);
        const arrive = t + tt;
        const leave = arrive + stayMin(a);
        if (arrive > d1e) return;
        seen.add(a);
        const next = d1.concat(a);
        // ここに泊まる：昼の過ごし方を夕食前（day1End＋1時間）までに終えられること
        if (leave <= d1e + 60) day2(a, d2s, g1, next, [], seen, moved + tt, leave);
        // まだ先へ進む
        if (leave < d1e) day1(a, leave, g1, next, seen, moved + tt);
        seen.delete(a);
      });
    }

    gateways.forEach((g1) => day1(g1, d1s, g1, [], new Set(), 0));
    found.sort((x, y) => y.score - x.score);

    // 巡れる買収駅がいちばん多いプランより2駅以上少ない案、2駅巡れるのに1駅だけの案は出さない
    const best = found.length ? found[0].visits.length : 0;
    const enough = (p) => p.visits.length >= Math.max(best - 1, Math.min(best, 2));
    // 似たプランばかりにならないよう、泊まる駅が違うものを優先して選ぶ
    const picked = [];
    const sig = (p) => `${p.overnight}:${[...p.visits].sort().join(',')}`;
    for (const strict of [true, false]) {
      for (const p of found) {
        if (picked.length >= limit) break;
        if (!enough(p) || picked.some((q) => sig(q) === sig(p))) continue;
        if (strict && picked.some((q) => q.overnight === p.overnight)) continue;
        picked.push(p);
      }
    }
    const plans = picked.map((p) => build(D, router, p, A));
    return { plans, reason: plans.length ? '' : 'far' };
  }

  // 道順（gateway・1日目・2日目・gateway）から、時刻つきの旅程を組み立てる。保存した旅しおりの再表示にも使う。
  // acquired（買収駅ID）を渡すと、2日目が早く終わるときに「まだ買収していない近くの駅」を寄り道候補として出す。
  function build(D, routerOrNull, seq, acquired = []) {
    const router = routerOrNull || createRouter(D);
    const cfg = D.meta.trip;
    const S = (id) => D.byId[id];
    const overnight = seq.day1[seq.day1.length - 1];
    const visits = [...seq.day1, ...seq.day2];
    const days = [];
    let moved = 0;

    function walk(items, from, to, t) {
      const lg = router.leg(from, to);
      if (!lg) return t;
      items.push({ kind: 'leg', depart: clock(t), arrive: clock(t + lg.minutes), leg: lg });
      moved += lg.minutes;
      return t + lg.minutes;
    }

    // 1日目
    let t = toMin(cfg.day1Start);
    let cur = seq.g1;
    const d1 = [{ kind: 'start', time: clock(t), id: seq.g1, text: `${S(seq.g1).gateway || S(seq.g1).name + '駅'}から旅をスタート` }];
    seq.day1.forEach((id) => {
      t = walk(d1, cur, id, t);
      d1.push({ kind: 'stop', time: clock(t), until: clock(t + S(id).plan.minutes), id, text: S(id).plan.day });
      t += S(id).plan.minutes;
      cur = id;
    });
    d1.push({ kind: 'stay', time: '夜', id: overnight, text: S(overnight).plan.evening });
    days.push({ label: '1日目', items: d1 });

    // 2日目
    t = toMin(cfg.day2Start);
    const d2 = [{ kind: 'morning', time: clock(t), until: clock(t + cfg.morningMinutes), id: overnight, text: S(overnight).plan.morning }];
    t += cfg.morningMinutes;
    cur = overnight;
    seq.day2.forEach((id) => {
      t = walk(d2, cur, id, t);
      d2.push({ kind: 'stop', time: clock(t), until: clock(t + S(id).plan.minutes), id, text: S(id).plan.day });
      t += S(id).plan.minutes;
      cur = id;
    });
    // 2日目が昼前に終わる：フリータイムに、未買収で寄り道できる駅をすすめる（次の買収のきっかけ）
    if (t + router.travel(cur, seq.g2) < toMin('13:00')) {
      const owned = new Set([...acquired, ...visits]);
      const pick = D.stations
        .filter((x) => !owned.has(x.id))
        .map((x) => ({ x, go: router.travel(cur, x.id), total: router.travel(cur, x.id) + x.plan.minutes + router.travel(x.id, seq.g2) }))
        .filter((c) => t + c.total <= toMin(cfg.day2End))
        .sort((a, b) => a.total - b.total)[0];
      d2.push(
        pick
          ? { kind: 'free', time: clock(t), id: pick.x.id, suggest: true,
              text: `フリータイム。足を延ばすなら、まだ買収していない${pick.x.name}へ（片道 約${duration(pick.go)}）。${pick.x.plan.day}` }
          : { kind: 'free', time: clock(t), id: cur, suggest: false, text: 'フリータイム。もうひと湯やおみやげ探しで、ゆっくりどうぞ。' }
      );
    }
    t = walk(d2, cur, seq.g2, t);
    d2.push({ kind: 'end', time: clock(t), id: seq.g2, text: `${S(seq.g2).gateway || S(seq.g2).name + '駅'}で解散。おつかれさまでした！` });
    days.push({ label: '2日目', items: d2 });

    const stayStation = S(overnight);
    const onsen = stayStation.propertyType === '湯けむり物件';
    const title = onsen
      ? `${stayStation.name}の湯に泊まる、湯けむり1泊2日`
      : `${stayStation.name}に泊まる、九州美味めぐり1泊2日`;
    return {
      seq: { g1: seq.g1, day1: seq.day1.slice(), day2: seq.day2.slice(), g2: seq.g2 },
      title,
      overnight,
      visits,
      days,
      movedMinutes: moved,
      moved: duration(moved),
      asset: visits.reduce((n, id) => n + S(id).assetValue, 0),
    };
  }

  YT.Trip = { generate, build, duration };
})();
