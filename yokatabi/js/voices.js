// YT.Voices … 寄り道手帖の「地元の人のおすすめスポット」。
// - 読む：運営が承認したおすすめ（Firestore の voices）だけ。読んだ文字はすべて esc() を通して文字として出す。
// - 紹介する：ログインした人は、遊びながら「地元の人」としてこの駅のおすすめスポットを紹介できる（審査待ち voicesPending へ。
//   載るのは運営が確かめてから）。名前は登録の名前（js/gate.js）、この駅とのつながりは自己申告。
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

  const canSend = () => !!(YT.Gate && YT.Gate.user && YT.Gate.profile);
  const openBtn = (id, name) => `<button class="ghost-btn btn-sm" data-voice-open="${esc(id)}" data-name="${esc(name)}">${I('pin')} この駅のおすすめを紹介する</button>`;

  // 手帖の中の枠だけを先に出す。中身は fill() があとから入れる
  function sectionHtml(id, stationName = '') {
    return `<section class="modal-sec voices-sec" data-voices="${esc(id)}" aria-live="polite">
        <h3 class="sec-title">${I('megaphone')}地元の人のおすすめ <em>この町を知る人から</em></h3>
        <div class="voices-body"><p class="voices-empty">地元の人のおすすめを読み込んでいます…</p></div>
        <p class="voices-note">旅をしている人が「地元の人」として紹介したスポットを、運営が一件ずつ確かめてから載せています。</p>
        ${canSend() ? `<div class="voices-send">${openBtn(id, stationName)}</div>` : ''}
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
        ${v.spot ? `<p class="voice-spot">${I('pin')}<span>${esc(v.spot)}</span></p>` : ''}
        <p class="voice-body">${esc(v.body)}</p>
        <p class="voice-by"><span class="voice-name">${esc(v.name)}</span>${v.title ? `<small>${esc(v.title)}</small>` : ''}</p>
      </li>`;
  }

  // root（手帖のカード）の中の枠に、駅 id のおすすめを入れる。手帖を閉じたり別の駅に替えたりしていたら何もしない
  async function fill(root, id) {
    const sec = root && root.querySelector(`[data-voices="${CSS.escape(id)}"]`);
    if (!sec) return;
    const body = sec.querySelector('.voices-body');
    try {
      const list = await load(id);
      if (!sec.isConnected) return;
      body.innerHTML = list.length
        ? `<ul class="voices-list">${list.map(itemHtml).join('')}</ul>`
        : '<p class="voices-empty">この駅のおすすめは、まだ届いていません。この町を知っている方は、ぜひ紹介してください。</p>';
    } catch (e) {
      if (!sec.isConnected) return;
      body.innerHTML = '<p class="voices-empty">いまは地元の人のおすすめを読み込めません。通信のよいところで、もう一度ひらいてください。</p>';
    }
  }

  // ---------- おすすめを紹介する ----------
  function openForm(btn) {
    const id = btn.dataset.voiceOpen;
    const name = btn.dataset.name || '';
    const p = YT.Gate.profile;
    btn.closest('.voices-send').innerHTML = `<form class="voice-form" data-voice-form="${esc(id)}" data-name="${esc(name)}">
        <p class="vf-fixed">「${esc(p.displayName)}」として紹介します（名前は手帖の「登録内容」で変えられます）。</p>
        <label for="vf-spot">スポットの名前（40字まで）</label>
        <input type="text" id="vf-spot" maxlength="40" required placeholder="例：駅前の共同湯／角のパン屋／城下の路面電車">
        <label for="vf-body">おすすめの理由・楽しみ方（${MAX}字まで）</label>
        <textarea id="vf-body" rows="5" maxlength="${MAX}" required placeholder="例：朝いちばんは地元の人と同じ時間に。湯上がりに海まで歩くと、潮風が気持ちいいです。"></textarea>
        <label for="vf-title">${esc(name)}駅とのつながり（60字まで・なくてもよい）</label>
        <input type="text" id="vf-title" maxlength="60" placeholder="例：この町に住んで十年／駅前の宿の者です">
        <label class="vf-consent"><input type="checkbox" id="vf-consent" required> 運営が確かめたうえで、このおすすめを名前（と駅とのつながり）を添えて寄り道手帖に載せることに同意します。</label>
        <p class="vf-help">お店の宣伝だけの文、ほかの方のお名前・連絡先、確かめられないことは載せられません。営業時間や料金は変わることがあるので、書くときは「約」をつけてください。</p>
        <div class="vf-row"><button class="primary-btn btn-sm" type="submit">${I('check')} 運営に送る</button><button class="link-btn" type="button" data-voice-cancel>やめる</button><span class="vf-count"><span data-vf-count>0</span> / ${MAX}字</span></div>
        <div data-vf-msg></div>
      </form>`;
    const first = document.querySelector('#vf-spot');
    if (first) first.focus({ preventScroll: true });
  }

  function failText(e) {
    const code = (e && e.code) || '';
    if (/permission-denied/.test(code)) return '送れませんでした。内容を確かめてください。続けて送るときは、前の紹介から3分ほどあけてください。';
    if (/unavailable|network|deadline/.test(code)) return '送れませんでした。通信のよいところで、もう一度お試しください。';
    return '送れませんでした。時間をおいて、もう一度お試しください。';
  }

  async function send(form) {
    const id = form.dataset.voiceForm;
    const msg = form.querySelector('[data-vf-msg]');
    const say = (t, ok) => (msg.innerHTML = `<p class="vf-msg ${ok ? 'is-ok' : ''}">${esc(t)}</p>`);
    const spot = form.querySelector('#vf-spot').value.trim();
    const body = form.querySelector('#vf-body').value.trim();
    const title = form.querySelector('#vf-title').value.trim();
    if (!spot) return say('スポットの名前を書いてください。');
    if (!body || body.length > MAX) return say(`おすすめの理由は1〜${MAX}字で書いてください。`);
    if (!form.querySelector('#vf-consent').checked) return say('掲載への同意にチェックを入れてください。');
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      const { fs, db } = await YT.Firebase.boot({ auth: true });
      const uid = YT.Gate.user.uid;
      // 審査待ちの作成と、登録の「最後に紹介した時刻」を今にする更新を1回の一括書き込みで（ルールの連投の歯止め）
      const b = fs.writeBatch(db);
      b.set(fs.doc(fs.collection(db, 'voicesPending')), { uid, stationId: id, spot, body, name: YT.Gate.profile.displayName, title, consent: true, createdAt: fs.serverTimestamp() });
      b.update(fs.doc(db, 'profiles', uid), { lastPostAt: fs.serverTimestamp() });
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
      form.parentElement.innerHTML = openBtn(form.dataset.voiceForm, form.dataset.name || '');
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
