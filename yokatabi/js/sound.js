// Web Audio API だけで合成する、アコースティック風の効果音。外部の音声ファイルは使わない。
// 電子音のピコピコではなく、木・革・紙・弦・オルゴールのような手ざわりの音を、ノイズとフィルター・倍音の重ね方でつくる。
// AudioContext はブラウザの自動再生制限のため、最初のユーザー操作時に生成する。
(function () {
  'use strict';
  const YT = (window.YT = window.YT || {});

  let ctx = null;
  let master = null; // すべての音の出口
  let echo = null; // チャイム・和音に薄くかけるディレイ（駅の構内に響く感じ）
  let noiseBuf = null;
  let muted = false;

  // iPhone（Safari 17〜）：消音スイッチがオンでも鳴るよう、音声の種類を「再生」にする。
  // 既定の種類だと、消音スイッチで Web Audio の音がすべて消える。
  function preferPlayback() {
    try {
      if (navigator.audioSession && navigator.audioSession.type !== 'playback') navigator.audioSession.type = 'playback';
    } catch (e) {
      /* 未対応のブラウザでは何もしない */
    }
  }

  function ensure() {
    if (muted) return null;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      preferPlayback();
      ctx = new AC();
      // スマホの小さなスピーカーでも聞こえるよう、コンプレッサーで音量をそろえて持ち上げる
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.knee.value = 12;
      comp.ratio.value = 4;
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(comp).connect(ctx.destination);
      // ディレイ：こもった反射音を2〜3回だけ返す（フィードバックの中にローパスを入れて、だんだん丸くする）
      const delay = ctx.createDelay(1);
      delay.delayTime.value = 0.21;
      const fb = ctx.createGain();
      fb.gain.value = 0.32;
      const damp = ctx.createBiquadFilter();
      damp.type = 'lowpass';
      damp.frequency.value = 2400;
      echo = ctx.createGain();
      echo.gain.value = 0.5;
      echo.connect(delay);
      delay.connect(damp).connect(fb).connect(delay);
      damp.connect(master);
      // ホワイトノイズ（木の打撃・レールの継ぎ目・紙の音のもと）は1つ作って使い回す
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    // 'suspended'（自動再生の制限）と 'interrupted'（iPhone で別タブ・別アプリから戻ったとき）の両方から復帰させる
    if (ctx.state !== 'running' && ctx.state !== 'closed') ctx.resume().catch(() => {});
    return ctx;
  }

  // 無音を一瞬だけ鳴らして、iPhone の音声出力を確実に起こす（ユーザー操作の中で呼ぶ）
  function warmUp() {
    const c = ensure();
    if (!c) return;
    const src = c.createBufferSource();
    src.buffer = c.createBuffer(1, 1, c.sampleRate);
    src.connect(c.destination);
    src.start(0);
  }

  // どこを触っても音が使えるようにする（タブやボタンが最初の操作でも鳴る）。
  // touchstart は iPhone では音の許可にならないので、指を離したとき・クリック・キー操作で行う。
  ['pointerup', 'touchend', 'click', 'keydown'].forEach((type) =>
    window.addEventListener(type, () => !muted && (!ctx || ctx.state !== 'running') && warmUp(), { capture: true, passive: true })
  );
  // ショップや宿のタブから戻ったとき
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && ctx && !muted && ctx.state !== 'running') ctx.resume().catch(() => {});
  });

  // ---------- 音のもと ----------
  // フィルターをかけたノイズの一打（木・革・紙・鉄の手ざわり）
  function hit(at, { type = 'bandpass', freq = 1200, q = 4, gain = 0.5, dur = 0.06, attack = 0.002, curve = 3, send = 0 } = {}) {
    const t0 = ctx.currentTime + at;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t0);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    g.gain.setTargetAtTime(0.0001, t0 + attack, dur / curve);
    src.connect(f).connect(g).connect(master);
    if (send) g.connect(sendGain(send));
    src.start(t0, Math.random() * 0.5);
    src.stop(t0 + dur * 2 + 0.05);
  }
  // 倍音つきの単音。type を変えるとオルゴール・エレピ・弦・金管っぽくなる
  function note(freq, at, dur, { type = 'sine', gain = 0.2, attack = 0.006, release = null, detune = 0, send = 0, slideTo = null } = {}) {
    const t0 = ctx.currentTime + at;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    o.detune.value = detune;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    g.gain.setTargetAtTime(0.0001, t0 + attack, release || dur / 4);
    o.connect(g).connect(master);
    if (send) g.connect(sendGain(send));
    o.start(t0);
    o.stop(t0 + dur + 0.1);
  }
  function sendGain(v) {
    const s = ctx.createGain();
    s.gain.value = v;
    s.connect(echo);
    return s;
  }
  const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

  // オルゴール／エレピ：サイン波の基音＋三角波の2倍音＋かすかな高い倍音（ベルのような立ち上がり）
  function bell(midi, at, { gain = 0.22, dur = 1.6, send = 0.55 } = {}) {
    const f = hz(midi);
    note(f, at, dur, { type: 'sine', gain, attack: 0.004, release: dur / 3.2, send });
    note(f * 2, at, dur * 0.7, { type: 'triangle', gain: gain * 0.32, attack: 0.003, release: dur / 6, send });
    note(f * 4.02, at, dur * 0.25, { type: 'sine', gain: gain * 0.12, attack: 0.002, release: 0.05, send: send * 0.5 });
  }
  // 弦をはじいた音（ギター・ウクレレ風）：三角波＋のこぎり波をローパスで丸め、音量と明るさを速く落とす
  function pluck(midi, at, { gain = 0.16, dur = 1.2, send = 0.3 } = {}) {
    const t0 = ctx.currentTime + at;
    const f = hz(midi);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(Math.min(8000, f * 8), t0);
    lp.frequency.exponentialRampToValueAtTime(Math.max(300, f * 1.5), t0 + dur * 0.6);
    lp.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.004);
    g.gain.setTargetAtTime(0.0001, t0 + 0.004, dur / 4);
    [['triangle', 0], ['sawtooth', 4]].forEach(([type, det]) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      o.detune.value = det;
      const og = ctx.createGain();
      og.gain.value = type === 'sawtooth' ? 0.35 : 1;
      o.connect(og).connect(lp);
      o.start(t0);
      o.stop(t0 + dur + 0.1);
    });
    lp.connect(g).connect(master);
    if (send) g.connect(sendGain(send));
  }
  // やわらかい金管・アコーディオン風の和音の1音（ゆっくり立ち上がる）
  function warmPad(midi, at, dur, gain = 0.07) {
    const t0 = ctx.currentTime + at;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(900, t0);
    lp.frequency.linearRampToValueAtTime(2200, t0 + 0.25);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.08);
    g.gain.setTargetAtTime(0.0001, t0 + dur * 0.6, dur / 5);
    [-6, 6].forEach((det) => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = hz(midi);
      o.detune.value = det;
      o.connect(lp);
      o.start(t0);
      o.stop(t0 + dur + 0.2);
    });
    lp.connect(g).connect(master);
    g.connect(sendGain(0.25));
  }

  const play = (fn) => (...args) => ensure() && fn(...args); // 強さ・高さなどの引数もそのまま渡す

  const Sound = {
    setMuted(v) {
      muted = !!v;
      if (master) master.gain.value = muted ? 0 : 0.9;
    },
    unlock: () => ensure(),

    // ---- サイコロ ----
    // 手の中で振る「カラカラ」（ダイスを振り始めたとき）
    diceShake: play(() => {
      for (let i = 0; i < 4; i++) hit(i * 0.045, { freq: 2600 + Math.random() * 600, q: 6, gain: 0.12, dur: 0.03 });
    }),
    // 木のサイコロが革のトレイに当たる「コロン」：乾いた中域のノイズ＋木の胴鳴り（短い三角波）
    diceHit: play((strength = 1) => {
      hit(0, { freq: 1100 + Math.random() * 300, q: 3, gain: 0.55 * strength, dur: 0.05 });
      hit(0, { type: 'lowpass', freq: 380, q: 1, gain: 0.35 * strength, dur: 0.07 });
      note(520 + Math.random() * 60, 0, 0.08, { type: 'triangle', gain: 0.12 * strength, attack: 0.001, release: 0.02 });
    }),
    // 出目が決まった：木琴のような2音
    diceSettle: play(() => {
      bell(76, 0, { gain: 0.16, dur: 0.6, send: 0.3 });
      bell(83, 0.09, { gain: 0.14, dur: 0.8, send: 0.35 });
    }),

    // ---- 列車 ----
    // 発車：やわらかい汽笛（2つの音を少しずらして重ねた、息の多い音）
    depart: play(() => {
      [62, 66].forEach((m, i) => {
        note(hz(m), 0.02 * i, 0.7, { type: 'triangle', gain: 0.07, attack: 0.08, release: 0.18, send: 0.3 });
      });
      hit(0, { type: 'bandpass', freq: 1500, q: 0.8, gain: 0.05, dur: 0.6, attack: 0.08, curve: 2 });
    }),
    // レールの継ぎ目「ガタン、ゴトン」：こもった低いノイズの2連打。
    // ブレーキで遅くなるほど、2打の間も「ガタン……ゴトン」と開き、音も少しこもる
    railJoint: play((speed = 1) => {
      const k = Math.max(0, Math.min(1, speed));
      const g = 0.12 + 0.1 * k;
      const gap = 0.085 + 0.16 * (1 - k);
      hit(0, { type: 'lowpass', freq: 220 + 100 * k, q: 1.2, gain: g, dur: 0.07 });
      hit(0, { freq: 1800, q: 5, gain: g * 0.18, dur: 0.02 });
      hit(gap, { type: 'lowpass', freq: 180 + 80 * k, q: 1.2, gain: g * 0.85, dur: 0.08 });
    }),
    // 停車：空気ブレーキの「プシュー」と、車体が沈む低い「ゴトン」
    brake: play(() => {
      hit(0, { type: 'lowpass', freq: 200, q: 1.4, gain: 0.16, dur: 0.12 });
      hit(0.05, { type: 'highpass', freq: 3200, q: 0.7, gain: 0.05, dur: 0.75, attack: 0.03, curve: 2 });
      note(70, 0.02, 0.3, { type: 'sine', gain: 0.12, attack: 0.004, release: 0.1, slideTo: 46 });
    }),
    // 通過駅の「チンッ」：澄んだ高いベル（倍音を少し）
    passBell: play(() => {
      bell(96, 0, { gain: 0.11, dur: 0.9, send: 0.35 });
      bell(103, 0.012, { gain: 0.04, dur: 0.6, send: 0.3 });
    }),
    // 分かれ道のポイントが切り替わる「ガシャン！」：重い金具の打撃2つと、レールのきしみ
    points: play(() => {
      hit(0, { type: 'lowpass', freq: 420, q: 1.4, gain: 0.32, dur: 0.1 });
      hit(0, { freq: 2200, q: 6, gain: 0.12, dur: 0.05 });
      hit(0.07, { type: 'lowpass', freq: 300, q: 1.2, gain: 0.26, dur: 0.12 });
      hit(0.07, { freq: 3100, q: 9, gain: 0.07, dur: 0.08 });
      note(hz(40), 0, 0.22, { type: 'sine', gain: 0.14, attack: 0.003, release: 0.08, slideTo: 32 });
    }),
    // 駅名標が下りてきて止まる「カシャン」：金具の高い2打と、板の小さな響き
    clack: play(() => {
      hit(0, { freq: 2600, q: 9, gain: 0.12, dur: 0.035 });
      hit(0.055, { freq: 1900, q: 7, gain: 0.1, dur: 0.05 });
      hit(0.055, { type: 'lowpass', freq: 520, q: 1, gain: 0.12, dur: 0.07 });
      note(hz(79), 0.06, 0.25, { type: 'triangle', gain: 0.03, attack: 0.002, release: 0.08 });
    }),
    // 駅に到着：メジャーセブンスのアルペジオ（ポーン・ポーン・ポーン・ポーン）をオルゴール風に
    arrive: play(() => {
      [65, 69, 72, 76].forEach((m, i) => bell(m, i * 0.19, { gain: 0.2, dur: 1.8 }));
      bell(53, 0, { gain: 0.08, dur: 2.2, send: 0.4 });
    }),

    // ---- オーナー刻印 ----
    // 刻印シートに印を押す「バン！」：重い低音（音程が下がるサイン波）＋紙と木の打撃
    stamp: play(() => {
      note(120, 0, 0.35, { type: 'sine', gain: 0.6, attack: 0.002, release: 0.09, slideTo: 48 });
      hit(0, { type: 'lowpass', freq: 600, q: 0.8, gain: 0.5, dur: 0.12 });
      hit(0, { freq: 2400, q: 1.5, gain: 0.12, dur: 0.05 });
    }),
    // 刻印のあとのファンファーレ：弦をかき鳴らす和音（ストローク）＋オルゴールの上昇音型
    fanfare: play(() => {
      const strum = (chord, at) => chord.forEach((m, i) => pluck(m, at + i * 0.022, { gain: 0.13, dur: 1.6 }));
      strum([48, 55, 60, 64, 67, 72], 0.12);
      strum([53, 57, 60, 65, 69, 72], 0.62);
      strum([55, 59, 62, 67, 71, 74], 0.98);
      strum([48, 55, 60, 64, 67, 72, 76], 1.34);
      [72, 76, 79, 84].forEach((m, i) => bell(m, 1.34 + i * 0.09, { gain: 0.11, dur: 1.4 }));
      [60, 64, 67].forEach((m) => warmPad(m, 1.34, 1.6, 0.05));
    }),
    // 待機パネルの案内（やさしい2音）
    gentle: play(() => {
      bell(72, 0, { gain: 0.12, dur: 0.8 });
      bell(69, 0.16, { gain: 0.11, dur: 1 });
    }),

    // ---- クラフト ----
    // 車両改造のファンファーレ：工具の「カン、カン」→ 明るい和音のストローク → ベル
    craft: play(() => {
      [0, 0.12].forEach((at, i) => {
        note(1760 + i * 220, at, 0.25, { type: 'triangle', gain: 0.08, attack: 0.001, release: 0.05 });
        hit(at, { freq: 3200, q: 8, gain: 0.08, dur: 0.04 });
      });
      [55, 59, 62, 67, 71].forEach((m, i) => pluck(m, 0.3 + i * 0.03, { gain: 0.13, dur: 1.4 }));
      [79, 83, 86].forEach((m, i) => bell(m, 0.5 + i * 0.08, { gain: 0.1, dur: 1.2 }));
    }),
    // パーツを付け替えた「カチッ」＋ひとはじき
    equip: play(() => {
      hit(0, { freq: 2200, q: 4, gain: 0.18, dur: 0.03 });
      pluck(67, 0.03, { gain: 0.1, dur: 0.7 });
    }),
    // よりみち切符にパンチを入れる「パチン」
    ticket: play(() => {
      hit(0, { freq: 3400, q: 2, gain: 0.25, dur: 0.03 });
      hit(0.01, { type: 'lowpass', freq: 700, q: 1, gain: 0.18, dur: 0.05 });
      bell(84, 0.06, { gain: 0.09, dur: 0.6 });
    }),
    // 発見ボーナス：小さな鈴の「ちりん」
    coin: play(() => {
      bell(88, 0, { gain: 0.09, dur: 0.7 });
      bell(91, 0.07, { gain: 0.08, dur: 0.9 });
    }),
    // ボタンなどの軽い「コトッ」
    click: play(() => {
      hit(0, { freq: 1500, q: 3, gain: 0.16, dur: 0.035 });
    }),
    // 称号ランクアップ：小太鼓のロール → 弦と金管の和音 → ベルの上昇
    rankUp: play(() => {
      for (let i = 0; i < 14; i++) hit(i * 0.045, { freq: 1800, q: 1.2, gain: 0.05 + i * 0.008, dur: 0.04 });
      hit(0.66, { type: 'lowpass', freq: 160, q: 1, gain: 0.6, dur: 0.3 });
      [48, 55, 60, 64, 67, 72].forEach((m, i) => pluck(m, 0.66 + i * 0.02, { gain: 0.13, dur: 2 }));
      [60, 64, 67, 72].forEach((m) => warmPad(m, 0.66, 2.2, 0.06));
      [79, 84, 88, 91].forEach((m, i) => bell(m, 1.1 + i * 0.1, { gain: 0.1, dur: 1.6 }));
    }),

    // ---- 旅のゲーム（スポットライト駅・精算・サプライズ・王座奪還） ----
    // ピタ止めのご祝儀：小太鼓のロール → 金管風の和音を2回 → オルゴールの上昇と、ちりんの鈴
    jackpot: play(() => {
      for (let i = 0; i < 18; i++) hit(i * 0.04, { freq: 1700, q: 1.2, gain: 0.05 + i * 0.007, dur: 0.04 });
      hit(0.74, { type: 'lowpass', freq: 150, q: 1, gain: 0.7, dur: 0.35 });
      [[48, 55, 60, 64, 67], [53, 57, 60, 65, 69], [55, 59, 62, 67, 71], [60, 64, 67, 72, 76]].forEach((ch, k) => {
        const at = 0.74 + k * 0.32;
        ch.forEach((m) => warmPad(m, at, k === 3 ? 2.4 : 0.5, 0.075));
        ch.forEach((m, i) => pluck(m, at + i * 0.018, { gain: 0.1, dur: 1.4 }));
      });
      [84, 88, 91, 96, 100].forEach((m, i) => bell(m, 1.8 + i * 0.08, { gain: 0.1, dur: 1.6 }));
    }),
    // 精算のドラムロール（だんだん強く）
    drumroll: play(() => {
      for (let i = 0; i < 26; i++) hit(i * 0.038, { freq: 1600 + (i % 2) * 200, q: 1.1, gain: 0.035 + i * 0.004, dur: 0.04 });
    }),
    // 「チャリン！」：金の鈴を2つ重ねる。pitch で少しずつ高く
    charin: play((pitch = 0) => {
      bell(91 + pitch, 0, { gain: 0.09, dur: 0.5, send: 0.3 });
      bell(98 + pitch, 0.04, { gain: 0.07, dur: 0.6, send: 0.3 });
      hit(0, { freq: 6000, q: 6, gain: 0.05, dur: 0.02 });
    }),
    // 振り込みの「ドカン」：低い太鼓と和音
    dokan: play(() => {
      note(90, 0, 0.5, { type: 'sine', gain: 0.65, attack: 0.002, release: 0.14, slideTo: 40 });
      hit(0, { type: 'lowpass', freq: 400, q: 0.8, gain: 0.55, dur: 0.2 });
      [60, 64, 67, 72].forEach((m, i) => pluck(m, 0.05 + i * 0.02, { gain: 0.12, dur: 1.6 }));
      [84, 88, 91].forEach((m, i) => bell(m, 0.2 + i * 0.07, { gain: 0.1, dur: 1.2 }));
    }),
    // ルーレットの「カチ」
    tick: play(() => {
      hit(0, { freq: 2600, q: 5, gain: 0.12, dur: 0.02 });
    }),
    // サプライズ：明るい3音
    surprise: play(() => {
      [76, 79, 84].forEach((m, i) => bell(m, i * 0.09, { gain: 0.12, dur: 1 }));
      [64, 67, 72].forEach((m, i) => pluck(m, i * 0.05, { gain: 0.09, dur: 1 }));
    }),
    // ハプニング：とぼけた下がる2音
    oops: play(() => {
      pluck(67, 0, { gain: 0.13, dur: 0.6 });
      pluck(62, 0.18, { gain: 0.13, dur: 0.9 });
    }),
    // 王冠が砕ける「パリン」と稲妻：高いノイズのきらめき＋ガラスの破片
    shatter: play(() => {
      hit(0, { type: 'highpass', freq: 3000, q: 0.7, gain: 0.35, dur: 0.25 });
      for (let i = 0; i < 7; i++) note(2400 + Math.random() * 2400, 0.02 + i * 0.035, 0.18, { type: 'triangle', gain: 0.04, attack: 0.001, release: 0.04 });
      hit(0, { type: 'lowpass', freq: 220, q: 1, gain: 0.45, dur: 0.4 });
    }),
    // 自分の王冠が駅に刺さる「ドスン」
    thud: play(() => {
      note(70, 0, 0.45, { type: 'sine', gain: 0.7, attack: 0.002, release: 0.12, slideTo: 34 });
      hit(0, { type: 'lowpass', freq: 300, q: 0.8, gain: 0.6, dur: 0.22 });
    }),
  };

  YT.Sound = Sound;
})();
