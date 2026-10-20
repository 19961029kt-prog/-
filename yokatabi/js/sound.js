// Web Audio API だけで鳴らす軽量サウンド。外部音声ファイルは使わない。
// AudioContext はブラウザの自動再生制限のため、最初のユーザー操作時に生成する。
(function () {
  'use strict';
  const YT = (window.YT = window.YT || {});

  let ctx = null;
  let master = null;
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
  // アフィリエイトのタブなどから戻ったとき
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && ctx && !muted && ctx.state !== 'running') ctx.resume().catch(() => {});
  });

  // 単音：エンベロープ付きのオシレーター
  function tone(freq, start, dur, { type = 'sine', gain = 0.3, attack = 0.005, slideTo = null } = {}) {
    const c = ctx;
    const t0 = c.currentTime + start;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  // 木のサイコロが卓に当たる「コトッ」：短いノイズをバンドパスで木質っぽく
  function knock(start, { freq = 900, gain = 0.6, dur = 0.06 } = {}) {
    const c = ctx;
    const t0 = c.currentTime + start;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const src = c.createBufferSource();
    src.buffer = buf;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = freq;
    bp.Q.value = 4;
    const g = c.createGain();
    g.gain.value = gain;
    src.connect(bp).connect(g).connect(master);
    src.start(t0);
    tone(freq / 4, start, dur * 1.5, { type: 'triangle', gain: gain * 0.25 });
  }

  const Sound = {
    setMuted(v) {
      muted = !!v;
      if (muted && ctx) ctx.suspend();
      if (!muted && ctx) ctx.resume();
    },
    isMuted: () => muted,
    unlock() {
      warmUp();
    },
    // 動作確認用：いまの状態（'running' なら鳴る状態）
    state: () => (ctx ? ctx.state : 'none'),

    // 「コトン、コロコロ…」
    dice() {
      if (!ensure()) return;
      knock(0, { freq: 700, gain: 0.9, dur: 0.09 });
      let t = 0.16;
      let gap = 0.09;
      for (let i = 0; i < 7; i++) {
        knock(t, { freq: 1100 + Math.random() * 900, gain: 0.5 - i * 0.05, dur: 0.04 });
        t += gap;
        gap *= 0.86;
      }
      knock(t + 0.05, { freq: 800, gain: 0.55, dur: 0.07 });
    },

    // 出目の確定「ピコン」
    pip() {
      if (!ensure()) return;
      tone(1320, 0, 0.12, { type: 'square', gain: 0.08 });
      tone(1760, 0.06, 0.16, { type: 'square', gain: 0.06 });
    },

    // 発車チャイム：やさしい2音＋汽笛
    depart() {
      if (!ensure()) return;
      tone(784, 0, 0.28, { type: 'sine', gain: 0.22 });
      tone(659, 0.18, 0.4, { type: 'sine', gain: 0.2 });
      tone(330, 0.05, 0.5, { type: 'sawtooth', gain: 0.04, slideTo: 392 });
    },

    // 到着チャイム：上行する3音
    arrive() {
      if (!ensure()) return;
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
        tone(f, i * 0.11, 0.5, { type: 'triangle', gain: 0.18 });
        tone(f * 2, i * 0.11, 0.25, { type: 'sine', gain: 0.04 });
      });
    },

    // 買収完了ファンファーレ：アルペジオ → 主和音＋きらめき
    fanfare() {
      if (!ensure()) return;
      const C = [523.25, 659.25, 783.99];
      const seq = [
        [392, 0], [523.25, 0.12], [659.25, 0.24], [783.99, 0.36],
        [659.25, 0.5], [783.99, 0.6],
      ];
      seq.forEach(([f, t]) => {
        tone(f, t, 0.22, { type: 'square', gain: 0.09 });
        tone(f / 2, t, 0.22, { type: 'triangle', gain: 0.12 });
      });
      [...C, 1046.5].forEach((f) => {
        tone(f, 0.78, 1.4, { type: 'sawtooth', gain: 0.05, attack: 0.02 });
        tone(f, 0.78, 1.4, { type: 'triangle', gain: 0.1, attack: 0.02 });
      });
      tone(130.81, 0.78, 1.5, { type: 'triangle', gain: 0.25 });
      for (let i = 0; i < 10; i++) {
        tone(2093 + Math.random() * 2000, 0.85 + i * 0.07, 0.15, { type: 'sine', gain: 0.05 });
      }
    },

    // 称号ランクアップ：小太鼓のロール → 金管の和音とシンバル → きらめきの上昇音
    rankUp() {
      if (!ensure()) return;
      let t = 0;
      let gap = 0.07;
      for (let i = 0; i < 16; i++) {
        knock(t, { freq: 1800 + (i % 2) * 300, gain: 0.25 + i * 0.03, dur: 0.05 });
        t += gap;
        gap = Math.max(0.025, gap * 0.9);
      }
      const hit = t + 0.05;
      // 金管風：のこぎり波を重ね、ローパスで角を落とす
      const brass = (f, start, dur, gain) => {
        const c = ctx;
        const t0 = c.currentTime + start;
        const osc = c.createOscillator();
        const lp = c.createBiquadFilter();
        const g = c.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(f * 0.98, t0);
        osc.frequency.linearRampToValueAtTime(f, t0 + 0.06);
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(900, t0);
        lp.frequency.linearRampToValueAtTime(3200, t0 + 0.12);
        lp.frequency.exponentialRampToValueAtTime(1200, t0 + dur);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(gain, t0 + 0.04);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        osc.connect(lp).connect(g).connect(master);
        osc.start(t0);
        osc.stop(t0 + dur + 0.05);
      };
      [[392, 0], [523.25, 0.16], [659.25, 0.32]].forEach(([f, d]) => brass(f, hit + d, 0.3, 0.12));
      [261.63, 392, 523.25, 659.25, 783.99].forEach((f) => brass(f, hit + 0.5, 1.8, 0.09));
      tone(65.41, hit + 0.5, 1.6, { type: 'triangle', gain: 0.35 });
      // シンバル：高域のノイズを長めに減衰
      const c = ctx;
      const t0 = c.currentTime + hit + 0.5;
      const len = Math.floor(c.sampleRate * 1.6);
      const buf = c.createBuffer(1, len, c.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5);
      const src = c.createBufferSource();
      src.buffer = buf;
      const hp = c.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 5000;
      const g = c.createGain();
      g.gain.value = 0.22;
      src.connect(hp).connect(g).connect(master);
      src.start(t0);
      for (let i = 0; i < 12; i++) tone(1046.5 * Math.pow(2, i / 12), hit + 0.7 + i * 0.06, 0.2, { type: 'sine', gain: 0.05 });
    },

    click() {
      if (!ensure()) return;
      tone(880, 0, 0.05, { type: 'triangle', gain: 0.08 });
    },
  };

  YT.Sound = Sound;
})();
