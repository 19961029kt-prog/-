// 地図のカメラ：SVG の viewBox をなめらかに動かして、拡大（1〜4倍）・移動する。すごろくマップとマイフォトマップで使う。
//   ・マウスのホイールで拡大縮小（カーソルの位置を中心に）。ドラッグで移動
//   ・スマホは2本指のピンチで拡大縮小、拡大中は1本指のドラッグで移動（1倍のときの1本指はページのスクロールに残す）
//   ・ドラッグしたあとのクリックは駅のタップとして扱わない
//   ・cam = { cx, cy, z }（盤面の座標での中心と倍率）。base（倍率1のときに見える範囲）の外には出さない
//   ・なめらかに見せる工夫：アニメーションのあいだは SVG を描き直さず、描いた絵を CSS の transform で動かすだけにする
//     （GPU で動くので軽い）。最後に viewBox を書き換えて（commit）くっきり描き直す。始めと終わりの両方が入る範囲を
//     先に描いておくので、動いているあいだに絵の外（空白）は見えない。列車の追従は、ときどき（約8回/秒）描き直す
(function () {
  'use strict';
  const YT = (window.YT = window.YT || {});
  const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  function create(svg, { base, min = 1, max = 4, onChange } = {}) {
    let B = base(); // { x, y, w, h }
    let cam = { cx: B.x + B.w / 2, cy: B.y + B.h / 2, z: 1 };
    let committed = { ...cam }; // いま viewBox に書いてある（描いてある）カメラ
    let lastCommitAt = 0;
    svg.style.transformOrigin = '0 0';
    svg.style.willChange = 'transform';
    let anim = null;
    let userMoved = false; // 自動のカメラ（追従など）より、人の操作を優先する
    let lastDragAt = 0;

    // 拡大しているときは、ふちの駅（門司港・屋久島など）も真ん中に置けるよう、盤面の外の海を少しだけ見せてよい
    function clamp(c) {
      const z = Math.max(min, Math.min(max, c.z));
      const w = B.w / z, h = B.h / z;
      const slack = z > min + 0.001 ? Math.min(140, w * 0.4) * Math.min(1, (z - min) / 0.6) : 0;
      const cx = Math.max(B.x + w / 2 - slack, Math.min(B.x + B.w - w / 2 + slack, c.cx));
      const cy = Math.max(B.y + h / 2 - slack, Math.min(B.y + B.h - h / 2 + slack, c.cy));
      return { cx, cy, z };
    }
    const origin = (c) => ({ x: c.cx - B.w / c.z / 2, y: c.cy - B.h / c.z / 2 });
    // 描き直す：viewBox を c にして、transform を外す
    function commit(c) {
      cam = clamp(c);
      committed = { ...cam };
      lastCommitAt = performance.now();
      const o = origin(cam), w = B.w / cam.z, h = B.h / cam.z;
      svg.setAttribute('viewBox', `${o.x.toFixed(2)} ${o.y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)}`);
      svg.style.transform = '';
      if (onChange) onChange(cam, true);
    }
    // 見た目だけ c にする：描いてある絵（committed）を、拡大・移動して見せる
    function visual(c) {
      cam = clamp(c);
      const s = cam.z / committed.z;
      const k0 = (svg.clientWidth || 1) / (B.w / committed.z); // 描いてある絵の、盤面1単位あたりの px
      const o0 = origin(committed), o1 = origin(cam);
      svg.style.transform = `translate(${((o0.x - o1.x) * k0 * s).toFixed(2)}px, ${((o0.y - o1.y) * k0 * s).toFixed(2)}px) scale(${s.toFixed(4)})`;
      if (onChange) onChange(cam, false);
    }
    // 2つのカメラの見える範囲を両方ふくむ、いちばん寄ったカメラ
    function union(a, b) {
      const box = (c) => ({ x0: c.cx - B.w / c.z / 2, y0: c.cy - B.h / c.z / 2, x1: c.cx + B.w / c.z / 2, y1: c.cy + B.h / c.z / 2 });
      const A = box(a), C = box(b);
      const x0 = Math.min(A.x0, C.x0), y0 = Math.min(A.y0, C.y0), x1 = Math.max(A.x1, C.x1), y1 = Math.max(A.y1, C.y1);
      const z = Math.max(min, Math.min(B.w / (x1 - x0), B.h / (y1 - y0)));
      return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, z };
    }
    // ホイール・ピンチ・ドラッグ：指に吸いつくよう見た目をすぐ動かし、手が止まったら（約0.14秒）描き直す。
    // 縮小しすぎたり大きく動かしたりして、描いてある絵の外が見えそうなときは、その場で描き直す
    let idle = 0;
    function apply(c) {
      visual(c);
      const s = cam.z / committed.z;
      const o0 = origin(committed), o1 = origin(cam);
      const off = Math.max(Math.abs(o0.x - o1.x) / (B.w / cam.z), Math.abs(o0.y - o1.y) / (B.h / cam.z));
      clearTimeout(idle);
      if (s < 0.92 || off > 0.18) commit(cam);
      else idle = setTimeout(() => commit(cam), 140);
    }
    // ms をかけて目標へ。終わったら resolve
    function set(target, ms = 650) {
      cancelAnimationFrame(anim);
      const to = clamp({ ...cam, ...target });
      if (!ms || reduce()) {
        commit(to);
        return Promise.resolve();
      }
      const from = { ...cam };
      // 始めと終わりの両方が入る範囲を先に描いて、そこから見た目だけ動かす
      commit(union(from, to));
      visual(from);
      const t0 = performance.now();
      return new Promise((resolve) => {
        const step = (now) => {
          const t = Math.min(1, (now - t0) / ms);
          const k = ease(t);
          // 倍率は対数で補間すると、拡大・縮小の速さが自然に見える
          const z = Math.exp(Math.log(from.z) + (Math.log(to.z) - Math.log(from.z)) * k);
          visual({ cx: from.cx + (to.cx - from.cx) * k, cy: from.cy + (to.cy - from.cy) * k, z });
          if (t < 1) anim = requestAnimationFrame(step);
          else {
            anim = null;
            commit(to);
            resolve();
          }
        };
        anim = requestAnimationFrame(step);
      });
    }
    // 長方形（盤面の座標）が収まる倍率と中心
    function fit(box, { pad = 40, zMin = min, zMax = max } = {}) {
      const z = Math.max(zMin, Math.min(zMax, Math.min(B.w / (box.w + pad * 2), B.h / (box.h + pad * 2))));
      return { cx: box.x + box.w / 2, cy: box.y + box.h / 2, z };
    }
    // 画面の位置（px）→ 盤面の座標
    function toUser(clientX, clientY) {
      const m = svg.getScreenCTM();
      if (!m) return { x: cam.cx, y: cam.cy };
      const p = new DOMPoint(clientX, clientY).matrixTransform(m.inverse());
      return { x: p.x, y: p.y };
    }
    // (clientX, clientY) の点を動かさずに倍率を f 倍する
    function zoomAt(clientX, clientY, f) {
      const p = toUser(clientX, clientY);
      const z = Math.max(min, Math.min(max, cam.z * f));
      const k = cam.z / z;
      apply({ cx: p.x + (cam.cx - p.x) * k, cy: p.y + (cam.cy - p.y) * k, z });
    }
    const pxPerUnit = () => svg.getBoundingClientRect().width / (B.w / cam.z);

    // ---------- 操作 ----------
    svg.addEventListener(
      'wheel',
      (e) => {
        // 1倍でさらに縮小しようとしたときだけは、ページのスクロールに任せる
        if (cam.z <= min + 0.001 && e.deltaY > 0) return;
        e.preventDefault();
        cancelAnimationFrame(anim);
        userMoved = true;
        zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0018)));
      },
      { passive: false }
    );
    // マウスのドラッグ
    let drag = null;
    svg.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      drag = { x: e.clientX, y: e.clientY, cx: cam.cx, cy: cam.cy, moved: false };
    });
    window.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 5) return;
      drag.moved = true;
      svg.classList.add('is-dragging');
      cancelAnimationFrame(anim);
      userMoved = true;
      const k = pxPerUnit();
      apply({ cx: drag.cx - dx / k, cy: drag.cy - dy / k, z: cam.z });
    });
    window.addEventListener('pointerup', () => {
      if (drag && drag.moved) lastDragAt = Date.now();
      drag = null;
      svg.classList.remove('is-dragging');
    });
    // スマホ：ピンチと、拡大中の1本指ドラッグ
    let touch = null;
    const mid = (t) => ({ x: (t[0].clientX + t[1].clientX) / 2, y: (t[0].clientY + t[1].clientY) / 2, d: Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY) });
    svg.addEventListener(
      'touchstart',
      (e) => {
        if (e.touches.length === 2) touch = { pinch: mid(e.touches), z: cam.z, moved: false };
        else if (e.touches.length === 1 && cam.z > min + 0.01) touch = { x: e.touches[0].clientX, y: e.touches[0].clientY, cx: cam.cx, cy: cam.cy, moved: false };
        else touch = null;
      },
      { passive: true }
    );
    svg.addEventListener(
      'touchmove',
      (e) => {
        if (!touch) return;
        if (touch.pinch && e.touches.length === 2) {
          e.preventDefault();
          cancelAnimationFrame(anim);
          userMoved = true;
          const m = mid(e.touches);
          const p = toUser(m.x, m.y);
          const z = Math.max(min, Math.min(max, touch.z * (m.d / touch.pinch.d)));
          const k = cam.z / z;
          // 2本指の真ん中を中心に拡大し、真ん中が動いたぶんだけ移動
          const shift = { x: (m.x - touch.pinch.x) / pxPerUnit(), y: (m.y - touch.pinch.y) / pxPerUnit() };
          touch.pinch.x = m.x;
          touch.pinch.y = m.y;
          touch.moved = true;
          apply({ cx: p.x + (cam.cx - p.x) * k - shift.x, cy: p.y + (cam.cy - p.y) * k - shift.y, z });
        } else if (!touch.pinch && e.touches.length === 1) {
          const dx = e.touches[0].clientX - touch.x, dy = e.touches[0].clientY - touch.y;
          if (!touch.moved && Math.hypot(dx, dy) < 6) return;
          e.preventDefault();
          touch.moved = true;
          cancelAnimationFrame(anim);
          userMoved = true;
          const k = pxPerUnit();
          apply({ cx: touch.cx - dx / k, cy: touch.cy - dy / k, z: cam.z });
        }
      },
      { passive: false }
    );
    svg.addEventListener('touchend', () => {
      if (touch && touch.moved) lastDragAt = Date.now();
      if (!touch || !touch.pinch) touch = null;
    });
    // ドラッグ・ピンチの直後のクリックは捨てる（駅をタップしたことにしない）
    svg.addEventListener(
      'click',
      (e) => {
        if (Date.now() - lastDragAt < 350) {
          e.stopPropagation();
          e.preventDefault();
        }
      },
      true
    );

    commit(cam);
    return {
      get: () => ({ ...cam }),
      set,
      fit,
      zoomAt,
      // 画面の大きさや、倍率1で見せる範囲が変わったとき
      rebase() {
        const r = cam.z;
        B = base();
        commit({ cx: cam.cx, cy: cam.cy, z: r });
      },
      base: () => ({ ...B }),
      userMoved: () => userMoved,
      resetUser: () => (userMoved = false),
      // 自動のカメラ：毎フレーム、目標の点へ少しずつ寄せる（列車の追従）
      follow(x, y, k = 0.14) {
        if (anim) return; // ズームの途中は待つ
        const next = { cx: cam.cx + (x - cam.cx) * k, cy: cam.cy + (y - cam.cy) * k, z: cam.z };
        // 描いてある範囲から少しはみ出しそう、または前に描いてから120ms たったら描き直す。それ以外は見た目だけ動かす
        const o0 = origin(committed), o1 = origin(next);
        const off = Math.max(Math.abs(o0.x - o1.x) / (B.w / cam.z), Math.abs(o0.y - o1.y) / (B.h / cam.z));
        if (off > 0.03 || performance.now() - lastCommitAt > 120) commit(next);
        else visual(next);
      },
    };
  }

  YT.Camera = { create };
})();
