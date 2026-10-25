// YT.Voices … 寄り道手帖の「地元の人の声」。
// - 読む：運営が承認した声（Firestore の voices）だけ。読んだ文字はすべて esc() を通して文字として出す。
// - 送る：ログインした人は、遊びながらこの駅の声を送れる（審査待ち voicesPending へ。載るのは運営が確かめてから）。
//   運営が会って確かめた地元の人（contributors の名簿）は、その名前と肩書きで送り、手帖に「運営が確かめた地元の人」の札がつく。
//   それ以外の人は、手帖に載せる名前（プロフィール）と、この駅とのつながり（自己申告）で送る。札はつかない。
// - 書き込みの形は firebase/firestore.rules とそのテストに合わせてある（守りの本体はルール）。AI は使わない。
(function () {
  'use strict';
  const YT = (window.YT = window.YT || {});
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const I = (n) => (YT.Icon ? YT.Icon.svg(n) : '');
  const SHOW = 5; // 1駅に出す数
  const TTL = 10 * 60 * 1000; // 同じ駅を何度ひらいても、10分は読み直さない（読み取りの回数を抑える）
  const MAX = 400;
  const cache = {};
  let mine = null; // { profile, contributor }：ログインした人の、投稿に使う名前（1回だけ読む）

  const canSend = () => !!(YT.Gate && YT.Gate.user);

  // 手帖の中の枠だけを先に出す。中身は fill() があとから入れる
  function sectionHtml(id, stationName = '') {
    return `<section class="modal-sec voices-sec" data-voices="${esc(id)}" aria-live="polite">
        <h3 class="sec-title">${I('megaphone')}地元の人の声 <em>この駅に暮らす人・訪れた人から</em></h3>
        <div class="voices-body"><p class="voices-empty">地元の人の声を読み込んでいます…</p></div>
        <p class="voices-note">ここに載る声は、運営が一件ずつ確かめてから載せています。「運営が確かめた地元の人」の札は、運営がお会いしてお話をうかがった方です。</p>
        ${canSend() ? `<div class="voices-send"><button class="ghost-btn btn-sm" data-voice-open="${esc(id)}" data-name="${esc(stationName)}">${I('pencil')} この駅の声を届ける</button></div>` : ''}
      </section>`;
  }

  async function load(id) {
    const hit = cache[id];
    if (hit && Date.now() - hit.at < TTL) return hit.list;
    const { fs, db } = await YT.Firebase.boot();
    const snap = await fs.getDocs(fs.query(fs.collection(db, 'voices'), fs.where('stationId', '==', id), fs.limit(20)));
    // 新しく承認されたものから（並べ替えは手元で。複合インデックスを作らずにすむ）
    const list = snap.docs
      .map((d) => d.data())
      .sort((a, b) => (b.approvedAt ? b.approvedAt.toMillis() : 0) - (a.approvedAt ? a.approvedAt.toMillis() : 0))
      .slice(0, SHOW);
    cache[id] = { at: Date.now(), list };
    return list;
  }

  function itemHtml(v) {
    return `<li class="voice">
        <p class="voice-body">${esc(v.body)}</p>
        <p class="voice-by"><span class="voice-name">${esc(v.name)}</span>${v.title ? `<small>${esc(v.title)}</small>` : ''}${v.verified ? '<span class="voice-badge">運営が確かめた地元の人</span>' : ''}</p>
      </li>`;
  }

  // root（手帖のカード）の中の枠に、駅 id の声を入れる。手帖を閉じたり別の駅に替えたりしていたら何もしない
  async function fill(root, id) {
    const sec = root && root.querySelector(`[data-voices="${CSS.escape(id)}"]`);
    if (!sec) return;
    const body = sec.querySelector('.voices-body');
    try {
      const list = await load(id);
      if (!sec.isConnected) return;
      body.innerHTML = list.length
        ? `<ul class="voices-list">${list.map(itemHtml).join('')}</ul>`
        : '<p class="voices-empty">この駅には、まだ声が届いていません。この町を知っている方は、ぜひひとこと届けてください。</p>';
    } catch (e) {
      if (!sec.isConnected) return;
      body.innerHTML = '<p class="voices-empty">いまは地元の人の声を読み込めません。通信のよいところで、もう一度ひらいてください。</p>';
    }
  }

  // ---------- 声を届ける ----------
  async function loadMine(fb) {
    if (mine && mine.uid === YT.Gate.user.uid) return mine;
    const { fs, db } = fb;
    const uid = YT.Gate.user.uid;
    const [p, c] = await Promise.all([fs.getDoc(fs.doc(db, 'profiles', uid)), fs.getDoc(fs.doc(db, 'contributors', uid))]);
    mine = { uid, profile: p.exists() ? p.data() : null, contributor: c.exists() && c.data().active ? c.data() : null };
    return mine;
  }

  async function openForm(btn) {
    const id = btn.dataset.voiceOpen;
    const wrap = btn.closest('.voices-send');
    const name = btn.dataset.name || '';
    btn.disabled = true;
    let fb, m;
    try {
      fb = await YT.Firebase.boot({ auth: true });
      m = await loadMine(fb);
    } catch (e) {
      btn.disabled = false;
      wrap.insertAdjacentHTML('beforeend', '<p class="vf-msg">いまは声を届けられません。通信のよいところで、もう一度お試しください。</p>');
      return;
    }
    const verified = !!(m.contributor && (m.contributor.stationIds || []).includes(id));
    wrap.innerHTML = `<form class="voice-form" data-voice-form="${esc(id)}" data-name="${esc(name)}" data-verified="${verified ? '1' : ''}">
        ${verified
          ? `<p class="vf-fixed">運営が確かめた地元の人「${esc(m.contributor.name)}${m.contributor.title ? `（${esc(m.contributor.title)}）` : ''}」として送ります。</p>`
          : `<label for="vf-name">手帖に載せる名前（40字まで・ペンネームでかまいません）</label>
             <input type="text" id="vf-name" maxlength="40" required value="${esc((m.profile && m.profile.displayName) || '')}" placeholder="例：くまの旅人">
             <label for="vf-title">${esc(name)}駅とのつながり（60字まで・なくてもよい）</label>
             <input type="text" id="vf-title" maxlength="60" placeholder="例：この町に住んで十年／駅前の宿の者です／旅で訪れました">`}
        <label for="vf-body">${esc(name)}駅に来る人へ伝えたいこと（${MAX}字まで）</label>
        <textarea id="vf-body" rows="5" maxlength="${MAX}" required placeholder="例：朝いちばんの共同湯は、地元の人と同じ時間に。路地の角のパン屋は、焼きたてが並ぶ七時ごろが一番です。"></textarea>
        <label class="vf-consent"><input type="checkbox" id="vf-consent" required> 運営が確かめたうえで、この声を名前（と駅とのつながり）を添えて寄り道手帖に載せることに同意します。</label>
        <p class="vf-help">お店の宣伝だけの文、ほかの方のお名前・連絡先、確かめられないことは載せられません。載ったあとも、地元の人の窓口からいつでも取り下げられます。</p>
        <div class="vf-row"><button class="primary-btn btn-sm" type="submit">${I('check')} 運営に送る</button><button class="link-btn" type="button" data-voice-cancel>やめる</button><span class="vf-count"><span data-vf-count>0</span> / ${MAX}字</span></div>
        <div data-vf-msg></div>
      </form>`;
    const first = wrap.querySelector(verified ? '#vf-body' : '#vf-name');
    if (first) first.focus({ preventScroll: true });
  }

  function failText(e) {
    const code = (e && e.code) || '';
    if (/permission-denied/.test(code)) return '送れませんでした。内容を確かめてください。続けて送るときは、前の投稿から3分ほどあけてください。';
    if (/unavailable|network|deadline/.test(code)) return '送れませんでした。通信のよいところで、もう一度お試しください。';
    return '送れませんでした。時間をおいて、もう一度お試しください。';
  }

  async function send(form) {
    const id = form.dataset.voiceForm;
    const verified = !!form.dataset.verified;
    const msg = form.querySelector('[data-vf-msg]');
    const say = (t, ok) => (msg.innerHTML = `<p class="vf-msg ${ok ? 'is-ok' : ''}">${esc(t)}</p>`);
    const body = form.querySelector('#vf-body').value.trim();
    if (!body || body.length > MAX) return say(`1〜${MAX}字で書いてください。`);
    if (!form.querySelector('#vf-consent').checked) return say('掲載への同意にチェックを入れてください。');
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      const fb = await YT.Firebase.boot({ auth: true });
      const { fs, db } = fb;
      const m = await loadMine(fb);
      const uid = m.uid;
      const b = fs.writeBatch(db);
      const ref = fs.doc(fs.collection(db, 'voicesPending'));
      if (verified) {
        // 名簿の名前と肩書きで。名簿の「投稿した時刻」も同じ一括書き込みで今にする（ルールの連投の歯止め）
        b.set(ref, { uid, stationId: id, body, name: m.contributor.name, title: m.contributor.title, verified: true, consent: true, createdAt: fs.serverTimestamp() });
        b.update(fs.doc(db, 'contributors', uid), { lastPostAt: fs.serverTimestamp() });
      } else {
        const name = form.querySelector('#vf-name').value.trim();
        const title = form.querySelector('#vf-title').value.trim();
        if (!name) { btn.disabled = false; return say('手帖に載せる名前を書いてください。'); }
        // プロフィール（名前・最後に投稿した時刻）を同じ一括書き込みで更新する（名前のなりすまし防止と連投の歯止め）
        b.set(ref, { uid, stationId: id, body, name, title, verified: false, consent: true, createdAt: fs.serverTimestamp() });
        b.set(fs.doc(db, 'profiles', uid), { displayName: name, lastPostAt: fs.serverTimestamp() });
        m.profile = { displayName: name };
      }
      await b.commit();
      form.innerHTML = '<p class="vf-msg is-ok">お預かりしました。運営が確かめてから、この手帖に載ります。ありがとうございます。</p>';
    } catch (e) {
      btn.disabled = false;
      say(failText(e));
    }
  }

  document.addEventListener('click', (ev) => {
    const open = ev.target.closest('[data-voice-open]');
    if (open) return openForm(open);
    const cancel = ev.target.closest('[data-voice-cancel]');
    if (cancel) {
      const form = cancel.closest('[data-voice-form]');
      const id = form.dataset.voiceForm;
      form.parentElement.innerHTML = `<button class="ghost-btn btn-sm" data-voice-open="${esc(id)}" data-name="${esc(form.dataset.name || '')}">${I('pencil')} この駅の声を届ける</button>`;
    }
  });
  document.addEventListener('submit', (ev) => {
    const form = ev.target.closest('[data-voice-form]');
    if (!form) return;
    ev.preventDefault();
    send(form);
  });
  document.addEventListener('input', (ev) => {
    if (ev.target.id !== 'vf-body') return;
    const c = ev.target.closest('form').querySelector('[data-vf-count]');
    if (c) c.textContent = ev.target.value.trim().length;
  });

  YT.Voices = { sectionHtml, fill };
})();
