// YT.Gate … ログインの関所。Q-TRIP は「人と人とのつながり」の旅なので、ログインしてから遊ぶ（Google かメールリンク）。
// ログインした人は、遊びながら寄り道手帖から「地元の人の声」を送れる（js/voices.js）。
// - 守りの本体は Security Rules と App Check。この関所は画面の入口で、静的なページそのものを隠すしくみではない。
// - 遊んだ記録はこれまでどおり端末の中（localStorage）。ログインの情報はゲームの記録とは混ぜない。
// - 手元の開発（localhost で ?emulator・?live なし）と file:// では関所を出さない（どこにもつながないため）。
(function () {
  'use strict';
  const YT = (window.YT = window.YT || {});
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const EMAIL_KEY = 'qtrip.login.email'; // メールリンクでログインするあいだだけ覚えておく
  const listeners = [];
  const Gate = { user: null, ready: false, offline: !!(YT.Firebase && YT.Firebase.offline), onChange: (fn) => listeners.push(fn) };
  YT.Gate = Gate;

  function failText(e) {
    const code = (e && e.code) || '';
    if (/popup-closed|cancelled-popup/.test(code)) return 'ログインを取りやめました。';
    if (/popup-blocked/.test(code)) return 'ポップアップが止められました。ブラウザの設定でこのサイトのポップアップを許してください。';
    if (/invalid-email/.test(code)) return 'メールアドレスの形を確かめてください。';
    if (/invalid-action-code|expired-action-code/.test(code)) return 'ログインのリンクの期限が切れているか、すでに使われています。もう一度メールを送ってください。';
    if (/network|unavailable/.test(code)) return '通信できませんでした。通信のよいところで、もう一度お試しください。';
    return 'ログインできませんでした。時間をおいて、もう一度お試しください。';
  }

  function el() { return $('#login-gate'); }
  function lock(on) {
    const app = $('#app');
    if (app) app.inert = on;
    const fab = $('#btn-dice');
    if (fab) fab.inert = on;
    document.body.classList.toggle('is-gated', on);
  }
  function close() {
    const g = el();
    if (!g || g.hidden) return;
    g.classList.add('is-closing');
    lock(false);
    setTimeout(() => (g.hidden = true), 480);
  }
  function open() {
    const g = el();
    if (!g) return;
    g.hidden = false;
    g.classList.remove('is-closing');
    lock(true);
  }
  function say(text, ok) {
    const m = $('#gate-msg');
    if (m) m.innerHTML = text ? `<p class="gate-msg ${ok ? 'is-ok' : ''}">${esc(text)}</p>` : '';
  }
  function setBusy(on) {
    document.querySelectorAll('#login-gate button, #login-gate input').forEach((b) => (b.disabled = on));
  }

  // 手帖の上の「ログイン中・ログアウト」
  function renderLine() {
    const line = $('#techo-login');
    if (!line) return;
    line.hidden = !Gate.user;
    if (!Gate.user) return;
    line.innerHTML = `<span>ログイン中</span><button class="link-btn" data-gate-signout>ログアウト</button><a class="link-btn" href="local.html${YT.Firebase.emulator ? '?emulator' : ''}">地元の人の窓口</a>`;
  }

  async function start() {
    if (Gate.offline || location.protocol === 'file:') {
      // 手元の開発・テストでは関所を出さずに遊べる（本番にもエミュレーターにもつながない）
      const g = el();
      if (g) g.hidden = true;
      Gate.ready = true;
      return;
    }
    open();
    let fb;
    try {
      fb = await YT.Firebase.boot({ auth: true });
    } catch (e) {
      $('#gate-actions').hidden = true;
      say('つながりませんでした。通信のよいところで、ページを読み込み直してください。');
      return;
    }
    const { authMod, auth } = fb;
    // メールのリンクからひらいたとき：ログインを仕上げて、URL からリンクの印を消す
    if (authMod.isSignInWithEmailLink(auth, location.href)) {
      const email = localStore('get') || window.prompt('確認のため、ログインに使ったメールアドレスを入力してください') || '';
      try {
        await authMod.signInWithEmailLink(auth, email.trim(), location.href);
        localStore('del');
      } catch (e) {
        say(failText(e));
      }
      const clean = new URL(location.href);
      ['apiKey', 'oobCode', 'mode', 'lang', 'continueUrl'].forEach((k) => clean.searchParams.delete(k));
      history.replaceState(null, '', clean.pathname + clean.search + clean.hash);
    }
    $('#gate-actions').hidden = false;
    if ($('#gate-msg .is-wait')) say('');
    $('#gate-google').addEventListener('click', async () => {
      setBusy(true);
      try { await authMod.signInWithPopup(auth, new authMod.GoogleAuthProvider()); } catch (e) { say(failText(e)); }
      setBusy(false);
    });
    $('#gate-email-form').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const email = $('#gate-email').value.trim();
      setBusy(true);
      try {
        await authMod.sendSignInLinkToEmail(auth, email, { url: location.origin + location.pathname + location.search, handleCodeInApp: true });
        localStore('set', email);
        say('ログイン用のリンクをお送りしました。この端末の、このブラウザでメールのリンクをひらいてください。', true);
      } catch (e) {
        say(failText(e));
      }
      setBusy(false);
    });
    document.addEventListener('click', (ev) => {
      if (!ev.target.closest('[data-gate-signout]')) return;
      authMod.signOut(auth);
    });
    authMod.onAuthStateChanged(auth, (u) => {
      Gate.user = u;
      Gate.ready = true;
      if (u) close();
      else open();
      renderLine();
      listeners.forEach((fn) => { try { fn(u); } catch (e) { /* 画面の一部の失敗で関所を止めない */ } });
    });
  }
  function localStore(op, v) {
    try {
      if (op === 'get') return localStorage.getItem(EMAIL_KEY);
      if (op === 'set') return localStorage.setItem(EMAIL_KEY, v);
      return localStorage.removeItem(EMAIL_KEY);
    } catch (e) { return null; }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
