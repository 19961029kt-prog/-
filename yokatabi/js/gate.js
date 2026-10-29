// YT.Gate … ログインの関所。Q-TRIP は「人と人とのつながり」の旅なので、ログインしてから遊ぶ（Google かメールリンク）。
// ログインした人は、遊びながら寄り道手帖から「地元の人の声」を送れる（js/voices.js）。
// - 守りの本体は Security Rules と App Check。この関所は画面の入口で、静的なページそのものを隠すしくみではない。
// - 遊んだ記録は端末の中（localStorage）と、データベースの本人だけの場所（js/cloud.js）。
// - 手元の開発（localhost で ?emulator・?live なし）と file:// では関所を出さない（どこにもつながないため）。
(function () {
  'use strict';
  const YT = (window.YT = window.YT || {});
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const EMAIL_KEY = 'qtrip.login.email'; // メールリンクでログインするあいだだけ覚えておく
  const listeners = [];
  const Gate = { user: null, profile: null, isAdmin: false, ready: false, offline: !!(YT.Firebase && YT.Firebase.offline), onChange: (fn) => listeners.push(fn) };
  let fbRef = null;
  YT.Gate = Gate;

  function failText(e) {
    const code = (e && e.code) || '';
    const msg = (e && e.message) || '';
    // 原因を確かめられるよう、決まった言葉のあとに Firebase の番号（auth/…）を小さく添える
    // internal-error などは、サーバーの返した理由（customData）があれば短く添える（原因を絞り込むため。esc() は say() が通す）
    const cd = e && e.customData ? (e.customData._serverResponse || e.customData.message || '') : '';
    const detail = cd ? ` ${String(typeof cd === 'string' ? cd : JSON.stringify(cd)).slice(0, 160)}` : '';
    const tag = code ? `（${code}${detail}）` : '';
    if (e) console.error('[Q-TRIP ログイン]', code, msg);
    if (/popup-closed|cancelled-popup/.test(code)) return 'ログインを取りやめました。';
    if (/popup-blocked/.test(code)) return 'ポップアップが止められました。ブラウザの設定でこのサイトのポップアップを許してください。';
    if (/invalid-email/.test(code)) return 'メールアドレスの形を確かめてください。';
    if (/invalid-action-code|expired-action-code/.test(code)) return 'ログインのリンクの期限が切れているか、すでに使われています。もう一度メールを送ってください。';
    if (/network|unavailable/.test(code)) return '通信できませんでした。通信のよいところで、もう一度お試しください。';
    if (/app-check/i.test(code + msg)) return `安全の確認（App Check）が通りませんでした。運営が設定を確かめています。${tag}`;
    if (/unauthorized-domain/.test(code)) return `このサイトからのログインが、まだ許可されていません。${tag}`;
    if (/operation-not-allowed/.test(code)) return `このログインの方法は、いま使えません。もうひとつの方法をお試しください。${tag}`;
    if (/web-storage-unsupported/.test(code)) return `ブラウザの設定（サイト越えのトラッキングを防ぐ・プライベートブラウズなど）でログインが止められました。${tag}`;
    return `ログインできませんでした。時間をおいて、もう一度お試しください。${tag}`;
  }

  // 失敗を案内する。App Check が原因のときは、App Check の SDK が返した理由も添える（reCAPTCHA が止められた、など）
  async function sayFail(e) {
    let text = failText(e);
    if (/app-check|internal-error/i.test(((e && e.code) || '') + ((e && e.message) || '')) && YT.Firebase.appCheckReason) {
      const why = await YT.Firebase.appCheckReason();
      if (why) text += ` 安全の確認の理由：${why.slice(0, 200)}`;
    }
    say(text);
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

  // 手帖の上の「ログイン中・登録内容・ログアウト」（運営には「審査」も）
  function renderLine() {
    const line = $('#techo-login');
    if (!line) return;
    line.hidden = !Gate.user;
    if (!Gate.user) return;
    const name = Gate.profile ? `${esc(Gate.profile.displayName)} さん` : '';
    line.innerHTML = `<span>${name}ログイン中</span><button class="link-btn" data-gate-edit>登録内容</button><button class="link-btn" data-gate-signout>ログアウト</button>${
      Gate.isAdmin ? `<a class="link-btn" href="review.html${YT.Firebase.emulator ? '?emulator' : ''}">運営の審査</a>` : ''}`;
  }

  // ---------- 登録（はじめてログインしたとき・手帖の「登録内容」から） ----------
  // 名前（手帖に載る）・年代・性別・出身地・現在の所在地。名前のほかは画面に出さない（九州を訪れる人の傾向の集計にだけ使う）
  function opts(list, sel) {
    return list.map(([v, t]) => `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${esc(t)}</option>`).join('');
  }
  function countryOpts(sel) {
    const c = YT.Places.countries();
    const o = (x) => `<option value="${esc(x.code)}" ${x.code === sel ? 'selected' : ''}>${esc(x.name)}</option>`;
    return `<option value="">選んでください</option><optgroup label="よく選ばれる国・地域">${c.first.map(o).join('')}</optgroup><optgroup label="そのほかの国・地域（五十音順）">${c.rest.map(o).join('')}</optgroup>`;
  }
  const prefOpts = (sel) => `<option value="">都道府県を選んでください</option>${YT.Places.prefs().map((p) => `<option value="${p.code}" ${p.code === sel ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}`;
  function registerHtml(p, edit) {
    p = p || {};
    const same = edit ? p.homeCountry === p.liveCountry && p.homePref === p.livePref : false;
    return `<form id="gate-reg" class="gate-reg" novalidate>
        <h2 class="gate-reg-title">${edit ? '登録内容' : '旅人の登録'}</h2>
        <p class="gate-reg-lead">${edit ? '直したいところを変えて、保存してください。' : 'はじめに、あなたのことを少しだけ教えてください。'}</p>
        <label for="reg-name">手帖に載せる名前（40字まで・ペンネームでかまいません）</label>
        <input id="reg-name" type="text" maxlength="40" required value="${esc(p.displayName || '')}" placeholder="例：くまの旅人">
        <div class="gate-reg-2">
          <div><label for="reg-age">年代</label><select id="reg-age" required><option value="">選んでください</option>${opts(YT.Places.AGES, p.ageGroup)}</select></div>
          <div><label for="reg-gender">性別</label><select id="reg-gender" required><option value="">選んでください</option>${opts(YT.Places.GENDERS, p.gender)}</select></div>
        </div>
        <fieldset class="gate-reg-place"><legend>出身地</legend>
          <select id="reg-home-country" required aria-label="出身地の国・地域">${countryOpts(p.homeCountry || '')}</select>
          <select id="reg-home-pref" aria-label="出身地の都道府県" ${p.homeCountry === 'JP' ? '' : 'hidden'}>${prefOpts(p.homePref || '')}</select>
        </fieldset>
        <fieldset class="gate-reg-place"><legend>現在の所在地</legend>
          <label class="gate-reg-same"><input type="checkbox" id="reg-same" ${same ? 'checked' : ''}> 出身地と同じ</label>
          <div id="reg-live" ${same ? 'hidden' : ''}>
            <select id="reg-live-country" aria-label="現在の所在地の国・地域">${countryOpts(p.liveCountry || '')}</select>
            <select id="reg-live-pref" aria-label="現在の所在地の都道府県" ${p.liveCountry === 'JP' ? '' : 'hidden'}>${prefOpts(p.livePref || '')}</select>
          </div>
        </fieldset>
        <p class="gate-note">手帖やランキングに出るのは名前だけです。年代・性別・出身地・所在地は画面には出さず、九州を訪れる人の傾向を知るための集計にだけ使います（見られるのは運営だけです）。</p>
        <div class="gate-row"><button class="primary-btn gate-btn" type="submit">${edit ? '保存する' : '登録して旅をはじめる'}</button>${edit ? '<button class="ghost-btn" type="button" data-reg-cancel>やめる</button>' : ''}</div>
        <div id="reg-msg" aria-live="polite"></div>
      </form>`;
  }
  function showRegister(edit) {
    open();
    $('#gate-actions').hidden = true;
    say('');
    const box = $('#gate-register');
    box.hidden = false;
    box.innerHTML = registerHtml(Gate.profile, edit);
    const sync = () => {
      const hc = $('#reg-home-country').value, lc = $('#reg-live-country').value;
      $('#reg-home-pref').hidden = hc !== 'JP';
      $('#reg-live-pref').hidden = lc !== 'JP';
      $('#reg-live').hidden = $('#reg-same').checked;
    };
    box.querySelectorAll('select, input[type="checkbox"]').forEach((x) => x.addEventListener('change', sync));
    const cancel = box.querySelector('[data-reg-cancel]');
    if (cancel) cancel.addEventListener('click', () => { box.hidden = true; close(); });
    $('#gate-reg').addEventListener('submit', (ev) => { ev.preventDefault(); saveRegister(edit); });
    setTimeout(() => $('#reg-name').focus({ preventScroll: true }), 50);
  }
  async function saveRegister(edit) {
    const v = (id) => $(id).value.trim();
    const msg = (t) => ($('#reg-msg').innerHTML = `<p class="gate-msg">${esc(t)}</p>`);
    const d = { displayName: v('#reg-name'), ageGroup: v('#reg-age'), gender: v('#reg-gender'), homeCountry: v('#reg-home-country'), homePref: '' };
    if (!d.displayName) return msg('手帖に載せる名前を書いてください。');
    if (!d.ageGroup || !d.gender) return msg('年代と性別を選んでください（性別は「回答しない」も選べます）。');
    if (!d.homeCountry) return msg('出身地の国・地域を選んでください。');
    if (d.homeCountry === 'JP') {
      d.homePref = v('#reg-home-pref');
      if (!d.homePref) return msg('出身地の都道府県を選んでください。');
    }
    if ($('#reg-same').checked) {
      d.liveCountry = d.homeCountry;
      d.livePref = d.homePref;
    } else {
      d.liveCountry = v('#reg-live-country');
      d.livePref = d.liveCountry === 'JP' ? v('#reg-live-pref') : '';
      if (!d.liveCountry) return msg('現在の所在地の国・地域を選んでください。');
      if (d.liveCountry === 'JP' && !d.livePref) return msg('現在の所在地の都道府県を選んでください。');
    }
    const btn = $('#gate-reg button[type="submit"]');
    btn.disabled = true;
    try {
      const { fs, db } = fbRef;
      const ref = fs.doc(db, 'profiles', Gate.user.uid);
      if (edit && Gate.profile) await fs.updateDoc(ref, d);
      else await fs.setDoc(ref, { ...d, createdAt: fs.serverTimestamp() });
      Gate.profile = Object.assign({}, Gate.profile, d);
      // ランキングに出る旅人名が空なら、登録の名前（12字まで）を入れておく
      if (YT.Store && !YT.Store.get().profile.name && YT.Store.setProfileName) YT.Store.setProfileName(d.displayName);
      $('#gate-register').hidden = true;
      renderLine();
      close();
      // 登録が済んだ（名前が変わった）ことを、旅の便りなどの画面にも知らせる
      listeners.forEach((fn) => { try { fn(Gate.user); } catch (e2) { /* 画面の一部の失敗で登録を止めない */ } });
    } catch (e) {
      btn.disabled = false;
      msg('保存できませんでした。通信のよいところで、もう一度お試しください。');
    }
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
        await sayFail(e);
      }
      const clean = new URL(location.href);
      ['apiKey', 'oobCode', 'mode', 'lang', 'continueUrl'].forEach((k) => clean.searchParams.delete(k));
      history.replaceState(null, '', clean.pathname + clean.search + clean.hash);
    }
    $('#gate-actions').hidden = false;
    if ($('#gate-msg .is-wait')) say('');
    $('#gate-google').addEventListener('click', async () => {
      setBusy(true);
      try { await authMod.signInWithPopup(auth, new authMod.GoogleAuthProvider()); } catch (e) { await sayFail(e); }
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
        await sayFail(e);
      }
      setBusy(false);
    });
    document.addEventListener('click', (ev) => {
      if (ev.target.closest('[data-gate-signout]')) {
        if (YT.Cloud) YT.Cloud.flush();
        authMod.signOut(auth);
      } else if (ev.target.closest('[data-gate-edit]')) showRegister(true);
    });
    fbRef = fb;
    authMod.onAuthStateChanged(auth, async (u) => {
      Gate.user = u;
      Gate.profile = null;
      Gate.isAdmin = false;
      if (!u) {
        if (YT.Cloud) YT.Cloud.onLogout();
        $('#gate-register').hidden = true;
        $('#gate-actions').hidden = false;
        open();
        renderLine();
        listeners.forEach((fn) => { try { fn(u); } catch (e) { /* 画面の一部の失敗で関所を止めない */ } });
        return;
      }
      $('#gate-actions').hidden = true;
      say('旅の手帖をひらいています…');
      // ① 遊んだ記録：データベースのほうが新しければ入れ替えて読み込み直す
      if (YT.Cloud && (await YT.Cloud.onLogin(fb, u)) === 'reload') return;
      // ② 登録：まだなら登録してもらう（登録するまで遊べない）
      try {
        const [p, a] = await Promise.all([fb.fs.getDoc(fb.fs.doc(fb.db, 'profiles', u.uid)), fb.fs.getDoc(fb.fs.doc(fb.db, 'admins', u.uid))]);
        Gate.profile = p.exists() ? p.data() : null;
        Gate.isAdmin = a.exists();
      } catch (e) {
        say('つながりませんでした。通信のよいところで、ページを読み込み直してください。');
        return;
      }
      Gate.ready = true;
      renderLine();
      listeners.forEach((fn) => { try { fn(u); } catch (e) { /* 画面の一部の失敗で関所を止めない */ } });
      if (!Gate.profile) return showRegister(false);
      say('');
      close();
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
