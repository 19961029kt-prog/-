// 進捗の保存（localStorage）。プライベートブラウズ等で使えない場合はメモリ上だけで動く。
// レシートの画像そのものは重いので、ここではなく IndexedDB（js/receipts.js）に置き、ここには画像のIDだけを持つ。
(function () {
  'use strict';
  const YT = (window.YT = window.YT || {});

  const KEY = 'yokatabi.kyushu.v1';
  const VERSION = 3;

  function blank() {
    return {
      version: VERSION,
      currentStationId: null,
      visited: {},   // { stationId: ISO日時（初到着） }
      // いちばん最近その駅に止まった日（その端末の日付 YYYY-MM-DD）。レシートの「到着日＝注文日」の確かめに使う
      arrivals: {},  // { stationId: 'YYYY-MM-DD' }
      // いまトップオーナー（購入実績1位）の駅。順位から計算して書き戻す（js/ownership.js）。称号・旅しおり・地図の金色が使う
      acquired: {},  // { stationId: { at（1位になった日時）, via, provider, item } }
      // 駅ごとの購入実績（レシートで立候補した記録）。ランキングはこれとライバル旅人の実績から計算する
      purchases: {}, // { stationId: [{ id, at, amount（読み取った金額・円）, scored（ランキングに入れた額）, upset（下克上ボーナス）, shop, via, item, imageId, hash }] }
      legacyStamps: {}, // 旧版（ボタンと刻印シートで取れた頃）のオーナー刻印。記念としてアルバムにだけ残す
      profile: { name: '' }, // ランキングに出る自分の旅人名（空なら「あなた」）
      // 旅の便り（自分が投函したポストカード）。1駅に1枚（投函し直すと写真と一言を差し替える）。画像は IndexedDB
      postcards: {}, // { stationId: { id, at, memo, imageId, postedAt（最初に投函した日時。いいねの数はここから数える） } }
      liked: {},     // { 旅人のポストカードID: ISO日時 } … 自分が押した「素敵ね」
      shareDays: [], // シェアカードの発信ボーナスを受け取った日（YYYY-MM-DD）。1日1回
      // ---- 旅のゲーム（js/game.js） ----
      spotlight: null, // いまのスポットライト駅 { id, theme, setAt }
      deck: [],        // 特別切符の手札（最大 meta.game.deckMax 枚）[{ uid, kind }]
      armed: null,     // 次に振るときに使う切符の uid
      cruiseLeft: 0,   // クルーズ周遊切符：4個のダイスをあと何回振れるか
      ledger: [],      // 臨時の入出金（ご祝儀・サプライズ・ハプニング・精算の観光収益）[{ at, kind, label, amount（万円） }]
      likesBanked: 0,  // 精算で振り込み済みの「届いたいいね」の数
      settled: 0,      // 週末の大精算を何回したか（ダイス7回ごとに1回）
      linesSeen: {},   // 制覇の演出を出し終えたライン { lineId: ISO }
      actions: {},   // { stationId: { product?: ISO, stay?: ISO } } … ジャーニー「購入する」「訪れる」
      favorites: {}, // { stationId: true }  … 「つづく」：推し駅登録
      itineraries: [], // マイ旅しおり：[{ id, savedAt, departDate, title, seq: { g1, day1, day2, g2 } }]
      tripPrompted: false, // 「旅しおりが作れます」の提案を一度出したか
      rankSeen: null, // カットインを出し終えた称号の段階（0〜）。null は未初期化（既存データの移行用）
      rolls: 0,
      muted: false,
      // ショップ・宿のボタンを押してから、レシートで立候補するまで
      // { stationId, via, providerId, provider, item, clickedAt（ミリ秒） }
      pendingOwner: null,
      // クラフト資金：残高は「発見ボーナス × 初到着の駅数 ＋ 共同株主の配当 − 使った額」で毎回計算する
      spent: 0,
      owned: {},     // { 'livery:forest': ISO日時, … } … アンロック済みのパーツ（初期装備は持っている扱い）
      equipped: { livery: 'hidamari', carriage: 'none', trail: 'puff', hat: 'straw', outfit: 'canvas', buddy: 'none' },
      tickets: { date: '', used: 0 }, // よりみち切符：その日に使った枚数
    };
  }

  // 保存データを今の形にそろえる。version 1（ボタンと刻印シートだけでオーナーになれた頃）の刻印は、
  // 購入実績がないので順位には入れず、記念の刻印としてアルバムに残す。パーツは持ったまま、使った額は0に戻す
  // （配当の計算が変わって残高がマイナスにならないように）。
  function normalize(parsed) {
    if (!parsed || ![1, 2, VERSION].includes(parsed.version)) return null;
    const b = blank();
    const s = Object.assign(b, parsed);
    s.equipped = Object.assign(blank().equipped, parsed.equipped || {}); // 新しく増えた装備欄は初期装備で埋める
    if (parsed.version === 1) {
      s.legacyStamps = parsed.acquired || {};
      s.acquired = {};
      s.purchases = {};
      s.spent = 0;
      s.pendingOwner = null;
      s.rankSeen = null; // 称号は購入実績から数え直すので、カットインの段階も今の称号にそろえ直す
    }
    // version 2 まで：到着日の記録がないので、初到着の日を到着日として入れておく（今日の注文は、今日もう一度止まれば確かめられる）
    if (parsed.version < 3) {
      s.arrivals = Object.fromEntries(Object.entries(s.visited || {}).map(([id, iso]) => [id, localDate(iso)]));
      s.version = VERSION;
    }
    return s;
  }

  // その端末の暦での日付（YYYY-MM-DD）。UTC にすると日本の朝9時前が前の日になってしまう
  function localDate(v = new Date()) {
    const d = new Date(v);
    if (isNaN(d)) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
      data = normalize(JSON.parse(json));
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
    Object.values(s.purchases || {}).reduce((n, l) => n + l.length, 0) * 100 +
    Object.keys(s.legacyStamps || {}).length * 50 +
    Object.keys(s.postcards || {}).length * 20 +
    (s.itineraries || []).length * 10 +
    Object.keys(s.visited || {}).length;

  function write() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      /* 保存できない環境ではセッション中のみ保持 */
    }
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const s = normalize(JSON.parse(raw));
        if (s) {
          const migrated = JSON.parse(raw).version !== VERSION;
          state = s;
          if (migrated) write();
        }
      }
    } catch (e) {
      /* 読めなくても初期状態で続行 */
    }
    const carried = takeCarried();
    if (carried && progress(carried) > progress(state)) {
      state = carried;
      write();
    }
    return state;
  }

  function save() {
    write();
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
    // ダイスで止まった：到着日を今日にする。初到着なら true を返す
    visit(id) {
      const first = !state.visited[id];
      if (first) state.visited[id] = new Date().toISOString();
      state.arrivals[id] = localDate();
      state.currentStationId = id;
      save();
      return first;
    },
    isVisited: (id) => !!state.visited[id],
    arrivalDate: (id) => state.arrivals[id] || null,
    localDate,
    // ショップ・宿のボタンを押した：ジャーニー（購入する／訪れる）の一歩として記録する
    // providerId（押したショップ）も残す：レシートの厳格チェック①で「押したショップのレシートか」を確かめる
    recordAction(id, via, providerId) {
      state.actions[id] = state.actions[id] || {};
      if (!state.actions[id][via]) state.actions[id][via] = new Date().toISOString();
      if (providerId) (state.actions[id].shops ||= {})[providerId] = new Date().toISOString();
      save();
    },
    // 手配中の記録（レシートで立候補するまで、再読み込みしても残す）
    setPendingOwner(info) {
      state.pendingOwner = info;
      save();
    },
    getPendingOwner: () => state.pendingOwner,
    clearPendingOwner() {
      state.pendingOwner = null;
      save();
    },
    // 購入実績（レシート）を1件足す
    addPurchase(id, rec) {
      (state.purchases[id] ||= []).push(rec);
      state.actions[id] = state.actions[id] || {};
      if (!state.actions[id][rec.via]) state.actions[id][rec.via] = rec.at;
      if (!state.visited[id]) state.visited[id] = rec.at;
      if (state.pendingOwner && state.pendingOwner.stationId === id) state.pendingOwner = null;
      save();
    },
    getPurchases: (id) => state.purchases[id] || [],
    allPurchases: () => Object.entries(state.purchases).flatMap(([stationId, list]) => list.map((r) => ({ stationId, ...r }))),
    hasReceiptHash: (hash) => Object.values(state.purchases).some((l) => l.some((r) => r.hash === hash)),
    // トップオーナーの駅を、順位の計算結果に合わせて書き戻す（1位になった日時は、最初に1位になったときのまま）
    syncOwners(top) {
      let changed = false;
      for (const id of Object.keys(state.acquired)) if (!top[id]) (delete state.acquired[id]), (changed = true);
      for (const [id, info] of Object.entries(top)) if (!state.acquired[id]) (state.acquired[id] = info), (changed = true);
      if (changed) save();
    },
    isAcquired: (id) => !!state.acquired[id],
    getAcquisition: (id) => state.acquired[id] || null,
    getActions: (id) => state.actions[id] || {},
    // 旅の便り：投函（同じ駅なら差し替え。最初に投函した日時といいねの数え始めは残す）
    putPostcard(id, { memo, imageId }) {
      const prev = state.postcards[id];
      const now = new Date().toISOString();
      state.postcards[id] = { id: prev ? prev.id : `pc-${Date.now().toString(36)}`, at: now, memo, imageId, postedAt: prev ? prev.postedAt : now };
      save();
      return { card: state.postcards[id], first: !prev, oldImageId: prev && prev.imageId };
    },
    getPostcards: () => state.postcards,
    // ひらいたときに「新しく届いたいいね」をお知らせするため、見せ終えた数を覚えておく
    markPostcardSeen(id, n) {
      if (!state.postcards[id]) return;
      state.postcards[id].seenLikes = n;
      write();
    },
    like(cardId) {
      if (state.liked[cardId]) return false;
      state.liked[cardId] = new Date().toISOString();
      save();
      return true;
    },
    hasLiked: (cardId) => !!state.liked[cardId],
    // シェアカードの発信ボーナス：今日まだなら記録して true
    claimShareDay(today) {
      if (state.shareDays.includes(today)) return false;
      state.shareDays.push(today);
      save();
      return true;
    },
    // ---- 旅のゲーム ----
    setSpotlight(v) {
      state.spotlight = v;
      save();
    },
    addTicket(kind, max) {
      if (state.deck.length >= max) return null;
      const t = { uid: `tk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`, kind };
      state.deck.push(t);
      save();
      return t;
    },
    useTicket(uid) {
      const t = state.deck.find((x) => x.uid === uid);
      state.deck = state.deck.filter((x) => x.uid !== uid);
      if (state.armed === uid) state.armed = null;
      save();
      return t || null;
    },
    arm(uid) {
      state.armed = uid;
      save();
    },
    setCruise(n) {
      state.cruiseLeft = Math.max(0, n);
      save();
    },
    addLedger(kind, label, amount) {
      state.ledger.push({ at: new Date().toISOString(), kind, label, amount });
      save();
    },
    spend(amount) {
      state.spent += amount;
      save();
    },
    settle(likesBanked) {
      state.settled += 1;
      state.likesBanked = likesBanked;
      save();
    },
    markLine(id) {
      state.linesSeen[id] = new Date().toISOString();
      save();
    },
    setProfileName(name) {
      state.profile.name = String(name || '').trim().slice(0, 12);
      save();
    },
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
    useDayTicket(today) {
      if (state.tickets.date !== today) state.tickets = { date: today, used: 0 };
      state.tickets.used += 1;
      save();
    },
    setMuted(v) {
      state.muted = !!v;
      save();
    },
    // 旅の記録をリセット（購入実績・レシート・ポストカードの記録も消す。画像は呼び出し側で IndexedDB から消す）
    reset() {
      const { muted, itineraries, profile } = state;
      state = blank();
      state.muted = muted;
      state.itineraries = itineraries; // 保存した旅しおりは旅の記録のリセットでは消さない
      state.profile = profile;
      save();
    },
  };

  YT.Store = Store;
})();
