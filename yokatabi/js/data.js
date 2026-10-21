// 駅マスターの読み込みと、路線グラフの探索。
// stations.json を fetch() し、file:// 等で失敗したら js/stations-fallback.js の同一データを使う。
(function () {
  'use strict';
  const YT = (window.YT = window.YT || {});

  function index(data, source) {
    const byId = {};
    data.stations.forEach((s) => (byId[s.id] = s));
    // 接続は無向グラフとして正規化（片方向の記述ミスがあっても壊れない）
    const adj = {};
    data.stations.forEach((s) => (adj[s.id] = new Set()));
    data.stations.forEach((s) =>
      (s.connections || []).forEach((c) => {
        if (!byId[c]) return;
        adj[s.id].add(c);
        adj[c].add(s.id);
      })
    );
    const overrides = {};
    (data.routeOverrides || []).forEach((o) => (overrides[edgeKey(o.between[0], o.between[1])] = o));
    const edges = [];
    const seen = new Set();
    Object.keys(adj).forEach((a) =>
      adj[a].forEach((b) => {
        const k = edgeKey(a, b);
        if (seen.has(k)) return;
        seen.add(k);
        edges.push({ key: k, a, b, ...(overrides[k] || {}) });
      })
    );
    const totalAsset = data.stations.reduce((n, s) => n + s.assetValue, 0);
    return { ...data, source, byId, adj, edges, overrides, totalAsset };
  }

  function edgeKey(a, b) {
    return a < b ? `${a}|${b}` : `${b}|${a}`;
  }

  async function load() {
    try {
      if (location.protocol === 'file:') throw new Error('file protocol');
      const res = await fetch('stations.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return index(await res.json(), 'stations.json');
    } catch (e) {
      if (window.YOKATABI_FALLBACK_DATA) {
        console.info('[Q-TRIP] stations.json を読めなかったため内蔵データで起動します:', e.message);
        return index(window.YOKATABI_FALLBACK_DATA, 'fallback');
      }
      throw e;
    }
  }

  // 最短経路（BFS）。駅クリックでの移動に使う。
  function shortestPath(D, from, to) {
    if (from === to) return [from];
    const prev = { [from]: null };
    const q = [from];
    while (q.length) {
      const cur = q.shift();
      for (const n of D.adj[cur]) {
        if (n in prev) continue;
        prev[n] = cur;
        if (n === to) {
          const path = [to];
          let p = cur;
          while (p !== null) {
            path.unshift(p);
            p = prev[p];
          }
          return path;
        }
        q.push(n);
      }
    }
    return null;
  }

  // サイコロの出目 n で行ける駅：同じ駅を二度通らない n 区間の道のりの終点。
  // 行き止まりで n 区間に届かない場合は、たどれる最長の道のりの終点で止まる。
  // 盤面全体が光ると選ぶ楽しさが薄れるため、候補は最大 maxChoices 駅に絞る（分かれ道の演出）。
  // 返り値 { 到着駅ID: 経路配列 }。
  function diceDestinations(D, from, n, maxChoices = 3) {
    const byLen = {}; // 区間数 -> { 終点: 経路 }
    (function walk(path) {
      const cur = path[path.length - 1];
      const len = path.length - 1;
      if (len > 0) {
        byLen[len] = byLen[len] || {};
        if (!byLen[len][cur]) byLen[len][cur] = path.slice();
      }
      if (len === n) return;
      D.adj[cur].forEach((x) => {
        if (!path.includes(x)) walk(path.concat(x));
      });
    })([from]);
    const reach = Math.max(0, ...Object.keys(byLen).map(Number).filter((l) => l <= n));
    const all = byLen[reach] || {};
    const ids = Object.keys(all);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    const result = {};
    ids.slice(0, maxChoices).forEach((id) => (result[id] = all[id]));
    return result;
  }

  YT.Data = { load, index, shortestPath, diceDestinations, edgeKey };
})();
