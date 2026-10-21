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
      acquired: {},  // { stationId: { at, via: 'product'|'stay', provider, item, joy } } … オーナー刻印済み
      actions: {},   // { stationId: { product?: ISO, stay?: ISO } } … ジャーニー「購入する」「訪れる」
      favorites: {}, // { stationId: true }  … 「つづく」：推し駅登録
      itineraries: [], // マイ旅しおり：[{ id, savedAt, departDate, title, seq: { g1, day1, day2, g2 } }]
      tripPrompted: false, // 「旅しおりが作れます」の提案を一度出したか
      rankSeen: null, // カットインを出し終えた称号の段階（0〜）。null は未初期化（既存データの移行用）
      rolls: 0,
      muted: false,
      // オーナー刻印の手配中（ショップ・宿のボタンを押してから、刻印シートで押印するまで）
      // { stationId, via, providerId, provider, item, clickedAt（ミリ秒） }。押しただけでは刻印にしない
      pendingOwner: null,
      // クラフト資金：残高は「発見ボーナス × 初到着の駅数 ＋ 刻印した駅の評価額 − 使った額」で毎回計算する
      spent: 0,
      owned: {},     // { 'livery:forest': ISO日時, … } … アンロック済みのパーツ（初期装備は持っている扱い）
      equipped: { livery: 'hidamari', carriage: 'none', trail: 'puff', hat: 'straw', outfit: 'canvas', buddy: 'none' },
      tickets: { date: '', used: 0 }, // よりみち切符：その日に使った枚数
    };
  }

  let state = blank();
  const listeners = [];

  // 旧URL（19961029kt-prog.github.io/-/yokatabi/）から移ってきた人の記録の引き継ぎ。
  // localStorage はドメインごとに別なので、旧URLの転送ページ（tools/build-redirect.mjs）が
  // 記録を URL の # に載せて渡す（# の後ろはサーバーに送られない）。
  const CARRY = '#carry=';
  function takeCarried() {
    if (!location.hash.startsWith(CARRY)) return null;
    let data = null;
    try {
      const b64 = location.hash.slice(CARRY.length).replace(/-/g, '+').replace(/_/g, '/');
      const json = new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
      const parsed = JSON.parse(json);
      if (parsed && parsed.version === 1) data = parsed;
    } catch (e) {
      /* 壊れていたら引き継がない */
    }
    try {
      history.replaceState(null, '', location.pathname + location.search); // 再読み込みやURLの共有で記録が出回らないように消す
    } catch (e) {
      /* 消せなくても続行 */
    }
    return data;
  }
  // 旅の進み具合。新しいURLで先に遊んでいた場合は、進んでいるほうを残す
  const progress = (s) =>
    Object.keys(s.acquired || {}).length * 100 + (s.itineraries || []).length * 10 + Object.keys(s.visited || {}).length;

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.version === 1) {
          const b = blank();
          state = Object.assign(b, parsed);
          state.equipped = Object.assign(b.equipped, parsed.equipped || {}); // 新しく増えた装備欄は初期装備で埋める
        }
      }
    } catch (e) {
      /* 読めなくても初期状態で続行 */
    }
    const carried = takeCarried();
    if (carried && progress(carried) > progress(state)) {
      state = Object.assign(blank(), carried);
      try {
        localStorage.setItem(KEY, JSON.stringify(state));
      } catch (e) {
        /* 保存できない環境ではセッション中のみ保持 */
      }
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
    // ショップ・宿のボタンを押した：ジャーニー（購入する／訪れる）の一歩として記録する。刻印はまだ
    recordAction(id, via) {
      state.actions[id] = state.actions[id] || {};
      if (!state.actions[id][via]) state.actions[id][via] = new Date().toISOString();
      save();
    },
    // 手配中の記録（刻印シートで押印するまで、再読み込みしても残す）
    setPendingOwner(info) {
      state.pendingOwner = info;
      save();
    },
    getPendingOwner: () => state.pendingOwner,
    clearPendingOwner() {
      state.pendingOwner = null;
      save();
    },
    // オーナー刻印：刻印シートで押印したときだけ呼ぶ。初めての刻印なら true を返す
    // info = { via: 'product'|'stay', provider, item, joy }。2回目以降は記録を上書きしない
    acquire(id, info) {
      state.actions[id] = state.actions[id] || {};
      if (!state.actions[id][info.via]) state.actions[id][info.via] = new Date().toISOString();
      if (state.pendingOwner && state.pendingOwner.stationId === id) state.pendingOwner = null;
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
    setRankSeen(i) {
      state.rankSeen = i;
      save();
    },
    markTripPrompted() {
      state.tripPrompted = true;
      save();
    },
    countRoll() {
      state.rolls += 1;
      save();
    },
    // クラフト：アンロック（残高の確認は呼び出し側で行う）と装備
    unlock(slot, id, price) {
      const key = `${slot}:${id}`;
      if (state.owned[key]) return false;
      state.owned[key] = new Date().toISOString();
      state.spent += price;
      save();
      return true;
    },
    isOwned: (slot, id) => !!state.owned[`${slot}:${id}`],
    equip(slot, id) {
      state.equipped[slot] = id;
      save();
    },
    // よりみち切符：日付が変わったら使った枚数を0に戻す
    ticketsUsed(today) {
      return state.tickets.date === today ? state.tickets.used : 0;
    },
    useTicket(today) {
      if (state.tickets.date !== today) state.tickets = { date: today, used: 0 };
      state.tickets.used += 1;
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
