// 地元の人と運営の窓口（local.html）。
// - 地元の人：ログイン → 担当の駅を選んで声を書く → 審査待ちに送る。自分の審査待ち・掲載中の声は、いつでも取り下げられる。
// - 運営：審査待ちを読んで、承認（文面はそのまま）か却下（理由つき）。地元の人の名簿の登録・停止。掲載中の声の削除。
// 書き込みの形は firebase/firestore.rules とそのテストに合わせてある（ルールが守りの本体で、この画面は案内役）。
// 文字はすべて esc() を通して出す。AI は使わない。
(function () {
  'use strict';
  const YT = window.YT;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const I = (n) => (YT.Icon ? YT.Icon.svg(n) : '');
  const EMAIL_KEY = 'qtrip.local.email'; // メールリンクでログインするあいだだけ、この端末にメールアドレスを覚えておく
  const MAX = 400;
  let fb = null, user = null, isAdmin = false, me = null, stations = {};

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
  // ルールに断られたときなどの言葉（エラーの中身は画面に出さない）
  function failText(e, what) {
    const code = (e && e.code) || '';
    if (/permission-denied/.test(code)) return `${what}できませんでした。内容を確かめてください。続けて送るときは、前の投稿から1分ほどあけてください。`;
    if (/unavailable|network|deadline/.test(code)) return `${what}できませんでした。通信のよいところで、もう一度お試しください。`;
    if (/popup-closed|cancelled-popup/.test(code)) return 'ログインを取りやめました。';
    if (/invalid-email/.test(code)) return 'メールアドレスの形を確かめてください。';
    if (/invalid-action-code|expired-action-code/.test(code)) return 'ログインのリンクの期限が切れているか、すでに使われています。もう一度メールを送ってください。';
    return `${what}できませんでした。時間をおいて、もう一度お試しください。`;
  }
  function say(el, text, kind = '') {
    el.innerHTML = text ? `<p class="lp-msg ${kind}">${esc(text)}</p>` : '';
  }

  // ---------- ログイン ----------
  function renderSignedOut(msg) {
    $('#lp-contrib').hidden = $('#lp-admin').hidden = true;
    $('#lp-auth').innerHTML = `
      <h2 class="lp-h2">${I('lock')}ログイン</h2>
      <p class="lp-muted">運営から窓口のご案内を受けた方は、ログインしてください。はじめての方は、ログインのあとに出る「あなたの番号」を運営にお知らせください。</p>
      <div class="lp-row"><button class="primary-btn" data-act="google">Google でログイン</button></div>
      <form class="lp-form" data-form="email">
        <label class="lp-label" for="lp-email">メールアドレスでログイン（ログイン用のリンクをお送りします）</label>
        <div class="lp-row"><input id="lp-email" type="email" autocomplete="email" required maxlength="200" placeholder="you@example.com"><button class="ghost-btn" type="submit">リンクを送る</button></div>
      </form>
      <div data-msg>${msg ? `<p class="lp-msg">${esc(msg)}</p>` : ''}</div>`;
  }
  function renderSignedIn() {
    $('#lp-auth').innerHTML = `
      <h2 class="lp-h2">${I('check')}ログイン中</h2>
      <p class="lp-muted">${isAdmin ? '運営として' : me && me.active ? `${esc(me.name)} さんとして` : ''}ログインしています。</p>
      <p class="lp-id"><span>あなたの番号</span><code data-uid>${esc(user.uid)}</code><button class="link-btn" data-act="copy">写す</button></p>
      <p class="lp-muted lp-small">番号は、運営が名簿に登録するときに使います。メールアドレスはお知らせいただかなくてかまいません。</p>
      <div class="lp-row"><button class="ghost-btn btn-sm" data-act="signout">ログアウト</button></div>`;
  }

  async function onAuthClick(act) {
    const { authMod, auth } = fb;
    if (act === 'google') {
      try { await authMod.signInWithPopup(auth, new authMod.GoogleAuthProvider()); }
      catch (e) { say($('#lp-auth [data-msg]'), failText(e, 'ログイン')); }
    } else if (act === 'signout') {
      await authMod.signOut(auth);
    } else if (act === 'copy') {
      const btn = $('#lp-auth [data-act="copy"]');
      try { await navigator.clipboard.writeText(user.uid); if (btn) btn.textContent = '写しました'; } catch (e) { /* 写せない環境では、番号を長押しで選んでもらう */ }
    }
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
  // メールのリンクからひらいたとき：覚えておいたメールアドレスでログインを仕上げ、URL からリンクの印を消す
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

  // ---------- 地元の人 ----------
  async function renderContrib() {
    const box = $('#lp-contrib');
    if (!me) {
      box.hidden = isAdmin; // 運営だけの人には出さない
      box.innerHTML = `<h2 class="lp-h2">${I('megaphone')}地元の人の声を送る</h2>
        <p class="lp-muted">まだ地元の人として登録されていません。運営に「あなたの番号」をお知らせください。運営がお会いして、掲載のご同意をいただいてから登録します。</p>`;
      return;
    }
    box.hidden = false;
    if (!me.active) {
      box.innerHTML = `<h2 class="lp-h2">${I('megaphone')}地元の人の声を送る</h2><p class="lp-muted">いまは投稿をお休みしています。再開したいときは、運営にご連絡ください。</p>${await mineHtml()}`;
      return;
    }
    box.innerHTML = `
      <h2 class="lp-h2">${I('megaphone')}地元の人の声を送る</h2>
      <p class="lp-muted">寄り道手帖には「${esc(me.name)}${me.title ? `（${esc(me.title)}）` : ''}」のお名前で載ります。お店の宣伝だけの文や、ほかの方のお名前・連絡先は載せられません。</p>
      <form class="lp-form" data-form="post">
        <label class="lp-label" for="lp-station">駅</label>
        <select id="lp-station" required>${me.stationIds.map((id) => `<option value="${esc(id)}">${esc(stName(id))}</option>`).join('')}</select>
        <label class="lp-label" for="lp-body">旅の人に伝えたいこと（${MAX}字まで）</label>
        <textarea id="lp-body" rows="6" maxlength="${MAX}" required placeholder="例：朝いちばんの共同湯は、地元の人と同じ時間に。路地の角のパン屋は、焼きたてが並ぶ七時ごろが一番です。"></textarea>
        <p class="lp-count"><span data-count>0</span> / ${MAX}字</p>
        <div class="lp-row"><button class="primary-btn" type="submit">${I('check')}運営に送る</button></div>
        <div data-msg></div>
      </form>
      ${await mineHtml()}`;
  }
  async function mineHtml() {
    const { fs, db } = fb;
    const [p, v] = await Promise.all([
      fs.getDocs(fs.query(fs.collection(db, 'voicesPending'), fs.where('uid', '==', user.uid))),
      fs.getDocs(fs.query(fs.collection(db, 'voices'), fs.where('uid', '==', user.uid))),
    ]);
    const row = (d, kind) => `<li class="lp-item">
        <p class="lp-item-meta"><span class="chip">${esc(stName(d.data().stationId))}</span>${kind === 'pending' ? '<span class="chip chip-dim">審査待ち</span>' : '<span class="chip chip-gold">掲載中</span>'}<small>${esc(fmt(d.data().createdAt))}</small></p>
        <p class="lp-item-body">${esc(d.data().body)}</p>
        <div class="lp-row"><button class="link-btn" data-act="${kind === 'pending' ? 'withdraw-pending' : 'withdraw-voice'}" data-id="${esc(d.id)}">取り下げる</button></div>
      </li>`;
    const items = [...p.docs.map((d) => row(d, 'pending')), ...v.docs.map((d) => row(d, 'voice'))];
    return `<h3 class="lp-h3">送った声</h3>${items.length ? `<ul class="lp-list">${items.join('')}</ul>` : '<p class="lp-muted">まだありません。</p>'}`;
  }
  async function post(form) {
    const { fs, db } = fb;
    const msg = $('[data-msg]', form);
    const body = $('#lp-body', form).value.trim();
    const stationId = $('#lp-station', form).value;
    if (!body || body.length > MAX) return say(msg, `1〜${MAX}字で書いてください。`);
    const btn = $('button[type="submit"]', form);
    btn.disabled = true;
    try {
      // 審査待ちの作成と、名簿の「投稿した時刻」を今にする更新を、1回の一括書き込みで（ルールの連投の歯止め）
      const b = fs.writeBatch(db);
      b.set(fs.doc(fs.collection(db, 'voicesPending')), { uid: user.uid, stationId, body, name: me.name, title: me.title, verified: true, consent: true, createdAt: fs.serverTimestamp() });
      b.update(fs.doc(db, 'contributors', user.uid), { lastPostAt: fs.serverTimestamp() });
      await b.commit();
      await renderContrib();
      say($('#lp-contrib [data-msg]'), 'お送りしました。運営が確かめてから寄り道手帖に載せます。ありがとうございます。', 'is-ok');
    } catch (e) {
      btn.disabled = false;
      say(msg, failText(e, '送信'));
    }
  }

  // ---------- 運営 ----------
  async function renderAdmin() {
    const box = $('#lp-admin');
    box.hidden = !isAdmin;
    if (!isAdmin) return (box.innerHTML = '');
    const { fs, db } = fb;
    const [pend, contribs, voices] = await Promise.all([
      fs.getDocs(fs.collection(db, 'voicesPending')),
      fs.getDocs(fs.collection(db, 'contributors')),
      fs.getDocs(fs.collection(db, 'voices')),
    ]);
    const byTime = (a, b) => (a.data().createdAt ? a.data().createdAt.toMillis() : 0) - (b.data().createdAt ? b.data().createdAt.toMillis() : 0);
    const pendRows = pend.docs.sort(byTime).map((d) => {
      const v = d.data();
      return `<li class="lp-item" data-pending="${esc(d.id)}">
          <p class="lp-item-meta"><span class="chip">${esc(stName(v.stationId))}</span><b>${esc(v.name)}</b>${v.title ? `<small>${esc(v.title)}</small>` : ''}${v.verified ? '<span class="chip chip-gold">確かめた地元の人</span>' : '<span class="chip chip-dim">自己申告</span>'}<small>${esc(fmt(v.createdAt))}</small></p>
          <p class="lp-item-body">${esc(v.body)}</p>
          <div class="lp-row">
            <button class="primary-btn btn-sm" data-act="approve" data-id="${esc(d.id)}">${I('check')}このまま承認する</button>
            <input type="text" maxlength="200" placeholder="却下の理由（200字まで・運営だけが見る）" data-reason>
            <button class="ghost-btn btn-sm" data-act="reject" data-id="${esc(d.id)}">却下する</button>
          </div>
        </li>`;
    });
    const stationBoxes = Object.keys(stations)
      .map((id) => `<label class="lp-check"><input type="checkbox" name="st" value="${esc(id)}">${esc(stations[id])}</label>`)
      .join('');
    const contribRows = contribs.docs.map((d) => {
      const c = d.data();
      return `<li class="lp-item"><p class="lp-item-meta"><b>${esc(c.name)}</b>${c.title ? `<small>${esc(c.title)}</small>` : ''}<span class="chip ${c.active ? '' : 'chip-dim'}">${c.active ? '投稿できる' : '停止中'}</span></p>
          <p class="lp-small lp-muted">担当：${esc((c.stationIds || []).map(stName).join('・'))}｜同意：${esc(fmt(c.consentAt))}｜番号：<code>${esc(d.id)}</code></p>
          <div class="lp-row"><button class="link-btn" data-act="${c.active ? 'stop' : 'resume'}" data-id="${esc(d.id)}">${c.active ? '投稿を停止する' : '投稿を再開する'}</button></div></li>`;
    });
    const voiceRows = voices.docs.map((d) => {
      const v = d.data();
      return `<li class="lp-item"><p class="lp-item-meta"><span class="chip">${esc(stName(v.stationId))}</span><b>${esc(v.name)}</b><small>承認 ${esc(fmt(v.approvedAt))}</small></p>
          <p class="lp-item-body">${esc(v.body)}</p>
          <div class="lp-row"><button class="link-btn" data-act="remove-voice" data-id="${esc(d.id)}">掲載をやめる</button></div></li>`;
    });
    const today = new Date().toISOString().slice(0, 10);
    box.innerHTML = `
      <h2 class="lp-h2">${I('stamp')}運営の審査</h2>
      <p class="lp-muted">承認すると、送られた文面がそのまま寄り道手帖に載ります（運営も書き換えられません）。直してほしいところがあるときは却下して、出し直していただきます。「自己申告」は、ゲームで遊ぶ人が寄り道手帖から送った声です（名前と駅とのつながりは本人の申告）。</p>
      <div data-msg></div>
      <h3 class="lp-h3">審査待ち（${pend.size}件）</h3>
      ${pendRows.length ? `<ul class="lp-list">${pendRows.join('')}</ul>` : '<p class="lp-muted">いまはありません。</p>'}
      <h3 class="lp-h3">地元の人を登録する</h3>
      <p class="lp-muted lp-small">お会いして掲載のご同意をいただいた方だけを登録します。番号は、その方がこの窓口にログインしたときに出る「あなたの番号」です。</p>
      <form class="lp-form" data-form="register">
        <label class="lp-label" for="lp-r-uid">番号</label><input id="lp-r-uid" required maxlength="128" pattern="[A-Za-z0-9]{10,128}">
        <label class="lp-label" for="lp-r-name">手帖に載せるお名前（40字まで）</label><input id="lp-r-name" required maxlength="40">
        <label class="lp-label" for="lp-r-title">肩書き（60字まで・なくてもよい）</label><input id="lp-r-title" maxlength="60" placeholder="例：別府の土産物店">
        <fieldset class="lp-stations"><legend class="lp-label">担当の駅</legend>${stationBoxes}</fieldset>
        <label class="lp-label" for="lp-r-consent">掲載のご同意をいただいた日</label><input id="lp-r-consent" type="date" required value="${today}">
        <div class="lp-row"><button class="primary-btn" type="submit">登録する</button></div>
      </form>
      <h3 class="lp-h3">地元の人の名簿（${contribs.size}人）</h3>
      ${contribRows.length ? `<ul class="lp-list">${contribRows.join('')}</ul>` : '<p class="lp-muted">まだいません。</p>'}
      <h3 class="lp-h3">掲載中の声（${voices.size}件）</h3>
      ${voiceRows.length ? `<ul class="lp-list">${voiceRows.join('')}</ul>` : '<p class="lp-muted">まだありません。</p>'}`;
  }

  async function adminAct(act, id, li) {
    const { fs, db } = fb;
    const msg = $('#lp-admin [data-msg]');
    try {
      if (act === 'approve') {
        // 審査待ちの文面をそのまま写す・審査待ちを消す・記録を残す、を1回の一括書き込みで（ルールが文面の同一を確かめる）
        const snap = await fs.getDoc(fs.doc(db, 'voicesPending', id));
        if (!snap.exists()) return renderAdmin();
        const v = snap.data();
        const b = fs.writeBatch(db);
        b.set(fs.doc(db, 'voices', id), { uid: v.uid, stationId: v.stationId, body: v.body, name: v.name, title: v.title, verified: v.verified, consent: v.consent, createdAt: v.createdAt, approvedAt: fs.serverTimestamp(), approvedBy: user.uid });
        b.delete(fs.doc(db, 'voicesPending', id));
        b.set(fs.doc(db, 'moderationLog', id), { action: 'approve', by: user.uid, at: fs.serverTimestamp() });
        await b.commit();
        await renderAdmin();
        say($('#lp-admin [data-msg]'), '承認しました。寄り道手帖に載りました。', 'is-ok');
      } else if (act === 'reject') {
        const reason = ((li && $('[data-reason]', li).value) || '').trim().slice(0, 200);
        if (!window.confirm('この声を却下しますか？（地元の方には、運営から理由をお伝えください）')) return;
        const b = fs.writeBatch(db);
        b.delete(fs.doc(db, 'voicesPending', id));
        b.set(fs.doc(db, 'moderationLog', id), { action: 'reject', by: user.uid, at: fs.serverTimestamp(), reason });
        await b.commit();
        await renderAdmin();
        say($('#lp-admin [data-msg]'), '却下しました。', 'is-ok');
      } else if (act === 'stop' || act === 'resume') {
        await fs.updateDoc(fs.doc(db, 'contributors', id), { active: act === 'resume' });
        await renderAdmin();
      } else if (act === 'remove-voice') {
        if (!window.confirm('この声の掲載をやめますか？（元には戻せません）')) return;
        await fs.deleteDoc(fs.doc(db, 'voices', id));
        await renderAdmin();
      }
    } catch (e) {
      say(msg, failText(e, '操作'));
    }
  }
  async function register(form) {
    const { fs, db } = fb;
    const ids = [...form.querySelectorAll('input[name="st"]:checked')].map((x) => x.value);
    const msg = $('#lp-admin [data-msg]');
    if (!ids.length) return say(msg, '担当の駅を1つ以上選んでください。');
    const uid = $('#lp-r-uid', form).value.trim();
    try {
      await fs.setDoc(fs.doc(db, 'contributors', uid), {
        name: $('#lp-r-name', form).value.trim(),
        title: $('#lp-r-title', form).value.trim(),
        stationIds: ids,
        active: true,
        consentAt: fs.Timestamp.fromDate(new Date(`${$('#lp-r-consent', form).value}T00:00:00+09:00`)),
      });
      await renderAdmin();
      say($('#lp-admin [data-msg]'), '登録しました。', 'is-ok');
    } catch (e) {
      say(msg, failText(e, '登録'));
    }
  }

  // ---------- 起動 ----------
  async function refresh() {
    const { fs, db } = fb;
    try {
      const [a, c] = await Promise.all([fs.getDoc(fs.doc(db, 'admins', user.uid)), fs.getDoc(fs.doc(db, 'contributors', user.uid))]);
      isAdmin = a.exists();
      me = c.exists() ? c.data() : null;
      renderSignedIn();
      await Promise.all([renderContrib(), renderAdmin()]);
    } catch (e) {
      renderSignedIn();
      say($('#lp-contrib'), failText(e, '読み込み'));
      $('#lp-contrib').hidden = false;
    }
  }

  document.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-act]');
    if (!b || !fb) return;
    const act = b.dataset.act, id = b.dataset.id;
    if (['google', 'signout', 'copy'].includes(act)) return onAuthClick(act);
    if (act === 'withdraw-pending' || act === 'withdraw-voice') {
      if (!window.confirm('この声を取り下げますか？')) return;
      const col = act === 'withdraw-pending' ? 'voicesPending' : 'voices';
      return fb.fs.deleteDoc(fb.fs.doc(fb.db, col, id)).then(renderContrib, (e) => say($('#lp-contrib'), failText(e, '取り下げ')));
    }
    adminAct(act, id, b.closest('.lp-item'));
  });
  document.addEventListener('submit', (ev) => {
    const f = ev.target.closest('[data-form]');
    if (!f) return;
    ev.preventDefault();
    if (f.dataset.form === 'email') sendEmailLink(f);
    else if (f.dataset.form === 'post') post(f);
    else if (f.dataset.form === 'register') register(f);
  });
  document.addEventListener('input', (ev) => {
    if (ev.target.id === 'lp-body') $('#lp-contrib [data-count]').textContent = ev.target.value.trim().length;
  });

  (async () => {
    try {
      const res = await fetch('stations.json');
      const data = await res.json();
      data.stations.forEach((s) => (stations[s.id] = s.name));
    } catch (e) { /* 駅名が読めなくても、id で表示して続ける */ }
    try {
      fb = await YT.Firebase.boot({ auth: true });
    } catch (e) {
      $('#lp-auth').innerHTML = '<p class="lp-msg">窓口をひらけませんでした。通信のよいところで、ページを読み込み直してください。</p>';
      return;
    }
    await finishEmailLink();
    fb.authMod.onAuthStateChanged(fb.auth, (u) => {
      user = u;
      if (!u) return renderSignedOut();
      refresh();
    });
  })();
})();
