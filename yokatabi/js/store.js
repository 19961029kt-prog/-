// 進捗の保存（localStorage）。プライベートブラウズ等で使えない場合はメモリ上だけで動く。
(function () {
  'use strict';
  const YT = (window.YT = window.YT || {});

  const KEY = 'yokatabi.kyushu.v1';

  function blank() {
    return {
      version: 1,
      currentStationId: null,
      visited: {},   // { stationId: ISO日時（初到着） }
      acquired: {},  // { stationId: { at, via: 'product'|'stay', provider, item } }
      actions: {},   // { stationId: { product?: ISO, stay?: ISO } } … ジャーニー「購入する」「訪れる」
      favorites: {}, // { stationId: true }  … 「つづく」：推し駅登録
      itineraries: [], // マイ旅しおり：[{ id, savedAt, departDate, title, seq: { g1, day1, day2, g2 } }]
      tripPrompted: false, // 「旅しおりが作れます」の提案を一度出したか
      rolls: 0,
      muted: false,
    };
  }

  let state = blank();
  const listeners = [];

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.version === 1) state = Object.assign(blank(), parsed);
      }
    } catch (e) {
      /* 読めなくても初期状態で続行 */
    }
    return state;
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      /* 保存できない環境ではセッション中のみ保持 */
    }
    listeners.forEach((fn) => fn(state));
  }

  const Store = {
    load,
    get: () => state,
    onChange(fn) {
      listeners.push(fn);
    },
    setCurrent(id) {
      state.currentStationId = id;
      save();
    },
    // 初到着なら true を返す
    visit(id) {
      const first = !state.visited[id];
      if (first) state.visited[id] = new Date().toISOString();
      state.currentStationId = id;
      save();
      return first;
    },
    isVisited: (id) => !!state.visited[id],
    // 買収：アフィリエイトボタン経由の行動を記録し、初回の買収なら true を返す
    // info = { via: 'product'|'stay', provider, item }。2回目以降は買収記録を上書きしない
    acquire(id, info) {
      state.actions[id] = state.actions[id] || {};
      if (!state.actions[id][info.via]) state.actions[id][info.via] = new Date().toISOString();
      if (state.acquired[id]) {
        save();
        return false;
      }
      state.acquired[id] = Object.assign({ at: new Date().toISOString() }, info);
      if (!state.visited[id]) state.visited[id] = state.acquired[id].at;
      save();
      return true;
    },
    isAcquired: (id) => !!state.acquired[id],
    getAcquisition: (id) => state.acquired[id] || null,
    getActions: (id) => state.actions[id] || {},
    toggleFavorite(id) {
      if (state.favorites[id]) delete state.favorites[id];
      else state.favorites[id] = true;
      save();
      return !!state.favorites[id];
    },
    isFavorite: (id) => !!state.favorites[id],
    // マイ旅しおり：道順（seq）だけを保存し、表示のたびに最新データで旅程を組み立て直す
    saveItinerary({ title, seq, departDate }) {
      const key = JSON.stringify(seq);
      const dup = state.itineraries.find((i) => JSON.stringify(i.seq) === key);
      if (dup) {
        dup.departDate = departDate || dup.departDate;
        save();
        return { item: dup, created: false };
      }
      const item = { id: `trip-${Date.now().toString(36)}`, savedAt: new Date().toISOString(), departDate: departDate || '', title, seq };
      state.itineraries.unshift(item);
      save();
      return { item, created: true };
    },
    deleteItinerary(id) {
      state.itineraries = state.itineraries.filter((i) => i.id !== id);
      save();
    },
    getItineraries: () => state.itineraries,
    markTripPrompted() {
      state.tripPrompted = true;
      save();
    },
    countRoll() {
      state.rolls += 1;
      save();
    },
    setMuted(v) {
      state.muted = !!v;
      save();
    },
    reset() {
      const { muted, itineraries } = state;
      state = blank();
      state.muted = muted;
      state.itineraries = itineraries; // 保存した旅しおりは旅の記録のリセットでは消さない
      save();
    },
  };

  YT.Store = Store;
})();
