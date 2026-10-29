// 運営の審査（review.html）。運営（Firestore の admins/{uid}）だけが使う。
// 審査待ちのおすすめスポットを読んで、承認（文面はそのまま）か却下（理由つき）。掲載中のおすすめの取りやめ。
// 書き込みの形は firebase/firestore.rules とそのテストに合わせてある（ルールが守りの本体で、この画面は案内役）。
// 文字はすべて esc() を通して出す。AI は使わない。
(function () {
  'use strict';
  const YT = window.YT;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const I = (n) => (YT.Icon ? YT.Icon.svg(n) : '');
  const EMAIL_KEY = 'qtrip.review.email'; // メールリンクでログインするあいだだけ覚えておく
  let fb = null, user = null, stations = {};

  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* 使えない環境では覚えない */ } },
    del: (k) => { try { localStorage.removeItem(k); } catch (e) { /* 同上 */ } },
  };
  const stName = (id) => (stations[id] ? `${stations[id]}駅` : id);
  const fmt = (ts) => {
    if (!ts || !ts.toDate) return '';
    const d = ts.toDate();
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };
  function failText(e, what) {
    const code = (e && e.code) || '';
    if (/permission-denied/.test(code)) return `${what}できませんでした。運営として登録されているか、内容を確かめてください。`;
    if (/unavailable|network|deadline/.test(code)) return `${what}できませんでした。通信のよいところで、もう一度お試しください。`;
    if (/popup-closed|cancelled-popup/.test(code)) return 'ログインを取りやめました。';
    if (/invalid-action-code|expired-action-code/.test(code)) return 'ログインのリンクの期限が切れているか、すでに使われています。もう一度メールを送ってください。';
    return `${what}できませんでした。時間をおいて、もう一度お試しください。`;
  }
  const say = (el, text, kind = '') => (el.innerHTML = text ? `<p class="lp-msg ${kind}">${esc(text)}</p>` : '');

  // ---------- ログイン ----------
  function renderSignedOut(msg) {
    $('#lp-admin').hidden = true;
    $('#lp-auth').innerHTML = `
      <h2 class="lp-h2">${I('lock')}ログイン</h2>
      <p class="lp-muted">運営のアカウントでログインしてください。</p>
      <div class="lp-row"><button class="primary-btn" data-act="google">Google でログイン</button></div>
      <form class="lp-form" data-form="email">
        <label class="lp-label" for="lp-email">メールアドレスでログイン（ログイン用のリンクをお送りします）</label>
        <div class="lp-row"><input id="lp-email" type="email" autocomplete="email" required maxlength="200" placeholder="you@example.com"><button class="ghost-btn" type="submit">リンクを送る</button></div>
      </form>
      <div data-msg>${msg ? `<p class="lp-msg">${esc(msg)}</p>` : ''}</div>`;
  }
  function renderSignedIn(isAdmin) {
    $('#lp-auth').innerHTML = `
      <h2 class="lp-h2">${I('check')}ログイン中</h2>
      <p class="lp-muted">${isAdmin ? '運営としてログインしています。' : 'このアカウントは運営として登録されていません。審査はできません。'}</p>
      <p class="lp-id"><span>番号</span><code>${esc(user.uid)}</code></p>
      <p class="lp-muted lp-small">運営になるには、Firebase コンソールで Firestore の admins に、この番号の文書を作ります。</p>
      <div class="lp-row"><button class="ghost-btn btn-sm" data-act="signout">ログアウト</button></div>`;
  }
  async function sendEmailLink(form) {
    const email = $('#lp-email', form).value.trim();
    const msg = $('#lp-auth [data-msg]');
    try {
      await fb.authMod.sendSignInLinkToEmail(fb.auth, email, { url: location.origin + location.pathname + location.search, handleCodeInApp: true });
      store.set(EMAIL_KEY, email);
      say(msg, 'ログイン用のリンクをお送りしました。このページと同じ端末・同じブラウザでメールのリンクをひらいてください。', 'is-ok');
    } catch (e) {
      say(msg, failText(e, 'メールの送信'));
    }
  }
  async function finishEmailLink() {
    const { authMod, auth } = fb;
    if (!authMod.isSignInWithEmailLink(auth, location.href)) return;
    const email = store.get(EMAIL_KEY) || window.prompt('確認のため、ログインに使ったメールアドレスを入力してください') || '';
    try {
      await authMod.signInWithEmailLink(auth, email.trim(), location.href);
      store.del(EMAIL_KEY);
    } catch (e) {
      renderSignedOut(failText(e, 'ログイン'));
    }
    const clean = new URL(location.href);
    ['apiKey', 'oobCode', 'mode', 'lang', 'continueUrl'].forEach((k) => clean.searchParams.delete(k));
    history.replaceState(null, '', clean.pathname + clean.search);
  }

  // ---------- 審査 ----------
  async function renderAdmin() {
    const box = $('#lp-admin');
    box.hidden = false;
    const { fs, db } = fb;
    const [pend, voices, reports] = await Promise.all([fs.getDocs(fs.collection(db, 'voicesPending')), fs.getDocs(fs.collection(db, 'voices')), fs.getDocs(fs.collection(db, 'reports'))]);
    // 通報された旅の便り：ポストカードごとにまとめ、写真も読む（運営は隠れたものも読める）
    const REASON = { face: '人の顔・だれかがわかる', private: '個人の情報', copyright: 'ほかの人の写真・著作物', inappropriate: '不快・不適切', other: 'その他' };
    const groups = {};
    reports.docs.forEach((d) => (groups[d.data().postcardId] ||= []).push({ id: d.id, ...d.data() }));
    // 運営は大きな写真で確かめる（postcardImages。読めなければ小さな写真）
    const cards = await Promise.all(Object.keys(groups).map(async (pid) => {
      try {
        const x = await fs.getDoc(fs.doc(db, 'postcards', pid));
        if (!x.exists()) return [pid, null];
        const big = await fs.getDoc(fs.doc(db, 'postcardImages', pid)).catch(() => null);
        return [pid, { ...x.data(), image: big && big.exists() ? big.data().image : x.data().thumb }];
      } catch (e) {
        return [pid, null];
      }
    }));
    const reportRows = cards.map(([pid, c]) => {
      const list = groups[pid];
      return `<li class="lp-item" data-report-pid="${esc(pid)}">
          <p class="lp-item-meta">${c ? `<span class="chip">${esc(stName(c.stationId))}</span><b>${esc(c.name)}</b>` : '<b>（もう消えています）</b>'}<span class="chip ${c && c.hidden ? 'chip-dim' : ''}">${c && c.hidden ? '見えなくなっています' : '見えています'}・通報 ${list.length}件</span></p>
          ${c ? `<img class="lp-photo" alt="通報された写真" src="${esc(c.image)}"><p class="lp-item-body">${esc(c.memo || '')}</p>` : ''}
          <ul class="lp-reasons">${list.map((r) => `<li>${esc(REASON[r.reason] || r.reason)}${r.note ? `：${esc(r.note)}` : ''}<small>${esc(fmt(r.createdAt))}</small></li>`).join('')}</ul>
          <div class="lp-row">${c ? `<button class="ghost-btn btn-sm" data-act="restore-card" data-id="${esc(pid)}">問題なし・見えるように戻す</button><button class="primary-btn btn-sm" data-act="delete-card" data-id="${esc(pid)}">写真を消す</button>` : `<button class="ghost-btn btn-sm" data-act="clear-reports" data-id="${esc(pid)}">通報を片づける</button>`}</div>
        </li>`;
    });
    const byTime = (a, b) => (a.data().createdAt ? a.data().createdAt.toMillis() : 0) - (b.data().createdAt ? b.data().createdAt.toMillis() : 0);
    const pendRows = pend.docs.sort(byTime).map((d) => {
      const v = d.data();
      return `<li class="lp-item">
          <p class="lp-item-meta"><span class="chip">${esc(stName(v.stationId))}</span><b>${esc(v.name)}</b>${v.title ? `<small>${esc(v.title)}</small>` : ''}<small>${esc(fmt(v.createdAt))}</small></p>
          <p class="lp-item-spot">${I('pin')} ${esc(v.spot || '')}</p>
          <p class="lp-item-body">${esc(v.body)}</p>
          <div class="lp-row">
            <button class="primary-btn btn-sm" data-act="approve" data-id="${esc(d.id)}">${I('check')}このまま承認する</button>
            <input type="text" maxlength="200" placeholder="却下の理由（200字まで・運営だけが見る）" data-reason>
            <button class="ghost-btn btn-sm" data-act="reject" data-id="${esc(d.id)}">却下する</button>
          </div>
        </li>`;
    });
    const voiceRows = voices.docs.map((d) => {
      const v = d.data();
      return `<li class="lp-item"><p class="lp-item-meta"><span class="chip">${esc(stName(v.stationId))}</span><b>${esc(v.name)}</b><small>承認 ${esc(fmt(v.approvedAt))}</small></p>
          <p class="lp-item-spot">${I('pin')} ${esc(v.spot || '')}</p>
          <p class="lp-item-body">${esc(v.body)}</p>
          <div class="lp-row"><button class="link-btn" data-act="remove-voice" data-id="${esc(d.id)}">掲載をやめる</button></div></li>`;
    });
    box.innerHTML = `
      <h2 class="lp-h2">${I('stamp')}運営の審査</h2>
      <p class="lp-muted">承認すると、送られた文面がそのまま寄り道手帖に載ります（運営も書き換えられません）。直してほしいところがあるときは却下して、出し直していただきます。名前は本人の登録、駅とのつながりは本人の申告です。</p>
      <div data-msg></div>
      <h3 class="lp-h3">審査待ち（${pend.size}件）</h3>
      ${pendRows.length ? `<ul class="lp-list">${pendRows.join('')}</ul>` : '<p class="lp-muted">いまはありません。</p>'}
      <h3 class="lp-h3">通報された旅の便り（${reportRows.length}枚）</h3>
      <p class="lp-muted lp-small">写真は審査なしで見えます。通報が3件そろった写真は、自動で見えなくなります。確かめて、戻すか消してください。</p>
      ${reportRows.length ? `<ul class="lp-list">${reportRows.join('')}</ul>` : '<p class="lp-muted">いまはありません。</p>'}
      <h3 class="lp-h3">掲載中のおすすめ（${voices.size}件）</h3>
      ${voiceRows.length ? `<ul class="lp-list">${voiceRows.join('')}</ul>` : '<p class="lp-muted">まだありません。</p>'}`;
  }
  async function adminAct(act, id, li) {
    const { fs, db } = fb;
    try {
      if (act === 'approve') {
        // 審査待ちの文面をそのまま写す・審査待ちを消す・記録を残す、を1回の一括書き込みで（ルールが文面の同一を確かめる）
        const snap = await fs.getDoc(fs.doc(db, 'voicesPending', id));
        if (!snap.exists()) return renderAdmin();
        const v = snap.data();
        const b = fs.writeBatch(db);
        b.set(fs.doc(db, 'voices', id), { uid: v.uid, stationId: v.stationId, spot: v.spot, body: v.body, name: v.name, title: v.title, consent: v.consent, createdAt: v.createdAt, approvedAt: fs.serverTimestamp(), approvedBy: user.uid });
        b.delete(fs.doc(db, 'voicesPending', id));
        b.set(fs.doc(db, 'moderationLog', id), { action: 'approve', by: user.uid, at: fs.serverTimestamp() });
        await b.commit();
        await renderAdmin();
        say($('#lp-admin [data-msg]'), '承認しました。寄り道手帖に載りました。', 'is-ok');
      } else if (act === 'reject') {
        const reason = ((li && $('[data-reason]', li).value) || '').trim().slice(0, 200);
        if (!window.confirm('このおすすめを却下しますか？')) return;
        const b = fs.writeBatch(db);
        b.delete(fs.doc(db, 'voicesPending', id));
        b.set(fs.doc(db, 'moderationLog', id), { action: 'reject', by: user.uid, at: fs.serverTimestamp(), reason });
        await b.commit();
        await renderAdmin();
        say($('#lp-admin [data-msg]'), '却下しました。', 'is-ok');
      } else if (act === 'restore-card' || act === 'delete-card' || act === 'clear-reports') {
        // 通報を片づける：その写真への通報をすべて消し、戻すなら通報の数を0に、消すならポストカードを消す（1回の一括書き込み）
        if (act === 'delete-card' && !window.confirm('この写真を消しますか？（元には戻せません）')) return;
        const reps = await fs.getDocs(fs.query(fs.collection(db, 'reports'), fs.where('postcardId', '==', id)));
        const b = fs.writeBatch(db);
        reps.docs.forEach((d) => b.delete(d.ref));
        if (act === 'restore-card') b.update(fs.doc(db, 'postcards', id), { reportCount: 0, hidden: false });
        if (act === 'delete-card') {
          b.delete(fs.doc(db, 'postcards', id));
          b.delete(fs.doc(db, 'postcardImages', id));
        }
        await b.commit();
        await renderAdmin();
        say($('#lp-admin [data-msg]'), act === 'delete-card' ? '写真を消しました。' : act === 'restore-card' ? '見えるように戻しました。' : '片づけました。', 'is-ok');
      } else if (act === 'remove-voice') {
        if (!window.confirm('このおすすめの掲載をやめますか？（元には戻せません）')) return;
        await fs.deleteDoc(fs.doc(db, 'voices', id));
        await renderAdmin();
      }
    } catch (e) {
      say($('#lp-admin [data-msg]'), failText(e, '操作'));
    }
  }

  document.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-act]');
    if (!b || !fb) return;
    const act = b.dataset.act;
    if (act === 'google') return fb.authMod.signInWithPopup(fb.auth, new fb.authMod.GoogleAuthProvider()).catch((e) => say($('#lp-auth [data-msg]'), failText(e, 'ログイン')));
    if (act === 'signout') return fb.authMod.signOut(fb.auth);
    adminAct(act, b.dataset.id, b.closest('.lp-item'));
  });
  document.addEventListener('submit', (ev) => {
    const f = ev.target.closest('[data-form="email"]');
    if (!f) return;
    ev.preventDefault();
    sendEmailLink(f);
  });

  (async () => {
    try {
      const data = await (await fetch('stations.json')).json();
      data.stations.forEach((s) => (stations[s.id] = s.name));
    } catch (e) { /* 駅名が読めなくても、id で表示して続ける */ }
    try {
      fb = await YT.Firebase.boot({ auth: true });
    } catch (e) {
      $('#lp-auth').innerHTML = '<p class="lp-msg">ひらけませんでした。通信のよいところで、ページを読み込み直してください（手元では ?emulator か ?live を付けてください）。</p>';
      return;
    }
    await finishEmailLink();
    fb.authMod.onAuthStateChanged(fb.auth, async (u) => {
      user = u;
      if (!u) return renderSignedOut();
      let isAdmin = false;
      try { isAdmin = (await fb.fs.getDoc(fb.fs.doc(fb.db, 'admins', u.uid))).exists(); } catch (e) { /* 読めなければ運営ではない扱い */ }
      renderSignedIn(isAdmin);
      if (!isAdmin) return ($('#lp-admin').hidden = true);
      try { await renderAdmin(); } catch (e) { say($('#lp-admin'), failText(e, '読み込み')); }
    });
  })();
})();
