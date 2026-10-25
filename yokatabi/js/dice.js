// よりみちダイス：CSS 3D（preserve-3d）で組んだ、6面のメープル材のサイコロ。
// 1の目は赤い焼き印、2〜6は真鍮の目。振ると大きく弾んで3軸に回り、コロン、コロンと減速して出目の面が正面で止まる。
// いつもは1個。ダイス切符を使うと、トレイに2〜4個を並べて同時に振る（少しずつずらして投げ入れ、ジャラッとばらける）。
(function () {
  'use strict';
  const YT = (window.YT = window.YT || {});

  // 目の位置（3×3 のマスの番号）
  const PIPS = { 1: [5], 2: [3, 7], 3: [3, 5, 7], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
  // 各面を立方体のどこに置くか（向かい合う面の和が7）と、その面を正面に向けるための立方体の回転
  const FACES = {
    1: { place: 'rotateY(0deg)', show: [0, 0] },
    6: { place: 'rotateY(180deg)', show: [0, 180] },
    3: { place: 'rotateY(90deg)', show: [0, -90] },
    4: { place: 'rotateY(-90deg)', show: [0, 90] },
    2: { place: 'rotateX(90deg)', show: [-90, 0] },
    5: { place: 'rotateX(-90deg)', show: [90, 0] },
  };
  const ROLL_MS = 1200;
  // 革のトレイに当たるタイミング（ロール全体に対する割合）と強さ
  const HITS = [[0.3, 1], [0.58, 0.7], [0.8, 0.45], [0.93, 0.25]];

  function faceHtml(n) {
    const cells = Array.from({ length: 9 }, (_, i) => `<i class="${PIPS[n].includes(i + 1) ? (n === 1 ? 'pip pip-red' : 'pip') : 'pip is-off'}"></i>`).join('');
    return `<div class="die-face die-f${n}" style="transform:${FACES[n].place} translateZ(var(--half))">${cells}</div>`;
  }

  // 1個のサイコロ
  function createDie(root) {
    root.innerHTML = `
      <div class="die-shadow"></div>
      <div class="die-bounce">
        <div class="die-tilt">
          <div class="die-cube">${[1, 2, 3, 4, 5, 6].map(faceHtml).join('')}</div>
        </div>
      </div>`;
    const cube = root.querySelector('.die-cube');
    const bounce = root.querySelector('.die-bounce');
    const shadow = root.querySelector('.die-shadow');
    let rot = { x: 0, y: 0, z: 0 };
    const tf = (r) => `rotateX(${r.x}deg) rotateY(${r.y}deg) rotateZ(${r.z}deg)`;

    function show(n) {
      const [x, y] = FACES[n].show;
      rot = { x, y, z: 0 };
      cube.style.transform = tf(rot);
      root.dataset.face = n;
    }

    // n の面で止まるまで転がす。当たるたびに onHit(強さ) を呼ぶ。delay だけ遅れて投げ入れる
    function roll(n, onHit, delay = 0) {
      return new Promise((resolve) => {
        const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const [tx, ty] = FACES[n].show;
        // 前の向きから、何周か余分に回って目的の向きへ（回転の関数の並びをそろえて、角度をそのまま補間させる）
        const spinsX = 2 + Math.floor(Math.random() * 2), spinsY = 2 + Math.floor(Math.random() * 2);
        const end = { x: tx + 360 * (Math.round(rot.x / 360) + spinsX), y: ty + 360 * (Math.round(rot.y / 360) + spinsY), z: 360 * (Math.round(rot.z / 360) + 1) };
        const mid = {
          x: rot.x + (end.x - rot.x) * 0.72 + (Math.random() * 60 - 30),
          y: rot.y + (end.y - rot.y) * 0.68 + (Math.random() * 60 - 30),
          z: rot.z + (end.z - rot.z) * 0.8,
        };
        const dur = reduce ? 300 : ROLL_MS;
        const opts = { duration: dur, delay: reduce ? 0 : delay };
        root.classList.add('is-rolling');
        root.dataset.face = '';
        const spin = cube.animate(
          [{ transform: tf(rot) }, { transform: tf(mid), offset: 0.42 }, { transform: tf(end) }],
          { ...opts, easing: 'cubic-bezier(.2,.65,.25,1)', fill: 'forwards' }
        );
        if (!reduce) {
          // 大きく弾んで、コロン、コロンと小さくなっていく（高さは1個ずつ少し変えて、そろわないように）
          // 弾む高さはサイコロの大きさに合わせる（トレイの縁から飛び出さないように。2〜4個のときは小さく弾む）
          const size = parseFloat(getComputedStyle(root).getPropertyValue('--size')) || 64;
          const hop = size * (0.62 + Math.random() * 0.16);
          bounce.animate(
            [
              { transform: 'translateY(0) scale(1)' },
              { transform: `translateY(-${hop.toFixed(0)}px) scale(1.06)`, offset: 0.15, easing: 'cubic-bezier(.4,0,1,1)' },
              { transform: 'translateY(0) scale(1.08, .9)', offset: 0.3, easing: 'cubic-bezier(0,0,.6,1)' },
              { transform: `translateY(-${(hop * 0.42).toFixed(0)}px) scale(1)`, offset: 0.44, easing: 'cubic-bezier(.4,0,1,1)' },
              { transform: 'translateY(0) scale(1.05, .94)', offset: 0.58, easing: 'cubic-bezier(0,0,.6,1)' },
              { transform: `translateY(-${(hop * 0.16).toFixed(0)}px) scale(1)`, offset: 0.69, easing: 'cubic-bezier(.4,0,1,1)' },
              { transform: 'translateY(0) scale(1.03, .97)', offset: 0.8 },
              { transform: `translateY(-${(hop * 0.05).toFixed(0)}px)`, offset: 0.87 },
              { transform: 'translateY(0) scale(1)', offset: 0.93 },
              { transform: 'translateY(0) scale(1)' },
            ],
            opts
          );
          shadow.animate(
            [
              { transform: 'scale(1)', opacity: 0.5 },
              { transform: 'scale(.45)', opacity: 0.18, offset: 0.15 },
              { transform: 'scale(1.05)', opacity: 0.55, offset: 0.3 },
              { transform: 'scale(.7)', opacity: 0.3, offset: 0.44 },
              { transform: 'scale(1)', opacity: 0.5, offset: 0.58 },
              { transform: 'scale(1)', opacity: 0.5 },
            ],
            opts
          );
          HITS.forEach(([at, s]) => setTimeout(() => onHit && onHit(s), delay + dur * at));
        }
        spin.onfinish = () => {
          rot = end;
          cube.style.transform = tf(end);
          spin.cancel();
          root.classList.remove('is-rolling');
          root.dataset.face = n;
          root.classList.remove('is-landed');
          void root.offsetWidth;
          root.classList.add('is-landed');
          resolve();
        };
      });
    }
    return { root, show, roll };
  }

  const MAX = 4;
  let tray = null, dice = [];

  const Dice = {
    MAX,
    mount(el) {
      tray = el;
      tray.classList.add('dice-tray');
      tray.innerHTML = '';
      dice = Array.from({ length: MAX }, () => {
        const d = document.createElement('div');
        d.className = 'die3d';
        tray.appendChild(d);
        return createDie(d);
      });
      Dice.show(1);
    },
    // ならべる個数（使わないサイコロは隠す）
    setCount(n) {
      tray.dataset.count = n;
      dice.forEach((d, i) => (d.root.hidden = i >= n));
    },
    // アニメーションなしで面を見せる（1個にもどす）
    show(n) {
      Dice.setCount(1);
      dice[0].show(n);
    },
    // 1個を n の面で止める
    roll(n, onHit) {
      Dice.setCount(1);
      return dice[0].roll(n, onHit);
    },
    // 複数を同時に：values の数だけ並べて、少しずつずらして投げ入れる。当たりの音は2個ぶんだけ（にぎやかすぎないように）
    rollMany(values, onHit) {
      Dice.setCount(values.length);
      return Promise.all(values.map((v, i) => dice[i].roll(v, i === 0 ? onHit : i === 1 && onHit ? (s) => onHit(s * 0.6) : null, i * 110)));
    },
  };

  YT.Dice = Dice;
})();
