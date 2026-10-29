// 画面の通しのテスト：エミュレーター（Auth・Firestore、projectId demo-qtrip）につないで、ログイン・登録・記録の保存・
// おすすめスポットの紹介・運営の審査を確かめる。実行：cd yokatabi/firebase && npm run e2e（本物のプロジェクトには触れない）
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }

const SITE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORT = 8766, ORIGIN = `http://localhost:${PORT}`;
const AUTH = 'http://127.0.0.1:9099', FS = 'http://127.0.0.1:8080/v1/projects/demo-qtrip/databases/(default)/documents';
const OUT = process.env.E2E_OUT || '';
const fails = [];
// まっさらな記録では、はじめに表紙の巻頭言がひらくので閉じる
async function closeCover(p) {
  const go = await p.$('.cover.is-open [data-cover-go]');
  if (go) { await go.click(); await p.waitForSelector('.cover.is-open', { state: 'detached', timeout: 5000 }).catch(() => {}); }
}
const check = (ok, label) => { console.log(`${ok ? 'ok    ' : 'FAIL  '} ${label}`); if (!ok) fails.push(label); };

// ルールを通さない読み書き（エミュレーターだけの「owner」）。運営が Firebase コンソールでする作業の代わり
async function ownerSet(path, fields) {
  const res = await fetch(`${FS}/${path}`, { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }) });
  if (!res.ok) throw new Error(`owner write ${path}: ${res.status}`);
}
async function ownerPatch(path, fields) {
  const mask = Object.keys(fields).map((k) => `updateMask.fieldPaths=${k}`).join('&');
  const res = await fetch(`${FS}/${path}?${mask}`, { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }) });
  if (!res.ok) throw new Error(`owner patch ${path}: ${res.status}`);
}
async function ownerGet(path) {
  const res = await fetch(`${FS}/${path}`, { headers: { Authorization: 'Bearer owner' } });
  return res.ok ? res.json() : null;
}

// メールリンクでログイン：ページでリンクを送り、エミュレーターが受け取ったリンクを同じページでひらく
async function emailLogin(page, path, email, { form = '#gate-email-form', input = '#gate-email', okSel = '#gate-msg .gate-msg.is-ok' } = {}) {
  await page.goto(`${ORIGIN}/${path}?emulator`);
  await page.waitForSelector(form, { state: 'visible', timeout: 15000 });
  await page.fill(input, email);
  await page.click(`${form} button[type="submit"]`);
  await page.waitForSelector(okSel);
  const codes = await (await fetch(`${AUTH}/emulator/v1/projects/demo-qtrip/oobCodes`)).json();
  const code = codes.oobCodes.filter((c) => c.email === email).pop();
  await page.goto(`${ORIGIN}/${path}?emulator&apiKey=demo-key&oobCode=${code.oobCode}&mode=signIn&lang=ja`);
}
async function register(page, { name, home = ['JP', '43'], live = null, agree = true }) {
  await page.waitForSelector('#gate-reg', { timeout: 15000 });
  await page.fill('#reg-name', name);
  await page.selectOption('#reg-age', '30s');
  await page.selectOption('#reg-gender', 'noanswer');
  await page.selectOption('#reg-home-country', home[0]);
  if (home[0] === 'JP') await page.selectOption('#reg-home-pref', home[1]);
  if (live) {
    await page.uncheck('#reg-same');
    await page.selectOption('#reg-live-country', live[0]);
    if (live[0] === 'JP') await page.selectOption('#reg-live-pref', live[1]);
  } else await page.check('#reg-same');
  if (agree) await page.check('#reg-agree');
}
// はじめての登録のあとに出る、3匹のあいさつの窓を閉じる
async function closeWelcome(page) {
  await page.waitForSelector('.gw-layer.is-open [data-gw-close]', { timeout: 8000 });
  await page.click('.gw-layer [data-gw-close]');
  await page.waitForSelector('.gw-layer', { state: 'detached', timeout: 5000 });
}
const gateGone = (page) => page.waitForSelector('#login-gate', { state: 'hidden', timeout: 20000 });
const uidOf = (page) => page.evaluate(() => YT.Gate.user && YT.Gate.user.uid);

const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: SITE, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
// この開発環境ではブラウザが /opt/pw-browsers にある。手元では Playwright が入れたものを使う
const browser = await chromium.launch(existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
try {
  const errors = [];
  const ctx = async (seed = true) => {
    const c = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const p = await c.newPage();
    p.on('pageerror', (e) => errors.push(e.message));
    // 「RPC_ERROR HTTP error has no status」は、ページを移る瞬間に送りかけた記録の通信が打ち切られたもの（端末には残り、次の起動で送り直す）
    p.on('console', (m) => m.type() === 'error' && !/permission-denied|PERMISSION_DENIED|Missing or insufficient permissions|status of 403|status of 400|RPC_ERROR HTTP error has no status/.test(m.text()) && errors.push(m.text().slice(-60) + ' @' + p.url().replace(ORIGIN, '').slice(0, 40)));
    if (seed) await p.addInitScript(() => { if (!localStorage.getItem('yokatabi.kyushu.v1')) localStorage.setItem('yokatabi.kyushu.v1', JSON.stringify({ version: 3, prefaceSeen: true, currentStationId: 'beppu', visited: { beppu: new Date().toISOString() }, muted: true })); });
    return p;
  };

  // 1. 関所：ログインしないと遊べない
  const a = await ctx();
  await a.goto(`${ORIGIN}/index.html?emulator`);
  await a.waitForSelector('#gate-actions:not([hidden])');
  check(await a.evaluate(() => document.getElementById('app').inert), 'ログインしないと関所が出て、盤面はさわれない');
  // Google のログイン：窓を開く部品（popupRedirectResolver）を渡し忘れると、押すたびに auth/argument-error になる
  // （この開発環境は apis.google.com に出られないので窓そのものは開かない。部品があるかだけを確かめる）
  const before = errors.length;
  const popup = a.context().waitForEvent('page', { timeout: 4000 }).catch(() => null);
  await a.click('#gate-google');
  const pw = await popup;
  if (pw) await pw.close();
  await a.waitForTimeout(500);
  check(!/argument-error/.test(await a.textContent('#gate-msg')), 'Google でログインを押しても、設定の不足（argument-error）にならない');
  await a.evaluate(() => (document.getElementById('gate-msg').innerHTML = ''));
  errors.length = before; // 窓が開けなかったことの記録（この環境だけのもの）は、画面のエラーに数えない

  // 2. はじめてのログイン → 登録（年代・性別・出身地・現在の所在地）
  await emailLogin(a, 'index.html', 'kuma@example.com');
  await a.waitForSelector('#gate-reg');
  check(await a.evaluate(() => document.getElementById('app').inert), 'はじめてのログインでは、登録するまで遊べない');
  check(/他の旅人には見えないように俺がしっかり守るニャ/.test(await a.textContent('#gate-reg')), '登録フォームで、ツシ丸が年代や性別を守ると案内する');
  await register(a, { name: 'くまの旅人', home: ['JP', '43'], live: ['KR'], agree: false });
  check(await a.isHidden('#reg-live-pref'), '現在の所在地が海外なら、都道府県は出さない');
  await a.selectOption('#reg-live-country', 'JP');
  await a.selectOption('#reg-live-pref', '43');
  await a.click('#gate-reg button[type="submit"]');
  await a.waitForSelector('#reg-msg .gate-msg');
  check(/プライバシーポリシー/.test(await a.textContent('#reg-msg')) && !(await ownerGet(`profiles/${await uidOf(a)}`)), 'プライバシーポリシーに同意しないと登録できない');
  await a.click('#gate-reg [data-privacy-open]');
  await a.waitForSelector('.pp-layer.is-open .pp-box');
  check(/メールアドレスは、ログインのしくみ/.test(await a.textContent('.pp-box')) && /消したいとき/.test(await a.textContent('.pp-box')), '登録フォームから、やさしい言葉のプライバシーポリシーを読める');
  if (OUT) { await a.waitForTimeout(500); await a.screenshot({ path: `${OUT}/privacy.png` }); }
  await a.keyboard.press('Escape');
  await a.waitForSelector('.pp-layer', { state: 'hidden' });
  await a.check('#reg-agree');
  if (OUT) await a.screenshot({ path: `${OUT}/register.png`, fullPage: true });
  await a.click('#gate-reg button[type="submit"]');
  await gateGone(a);
  await a.waitForSelector('.gw-layer.is-open .gw-one', { timeout: 8000 });
  const gw = await a.textContent('.gw-layer');
  check(/ツシ丸/.test(gw) && /ゴロ太/.test(gw) && /カチ助/.test(gw) && (await a.$$('.gw-layer svg.gart')).length === 3, 'はじめての登録のあと、3匹の案内人があいさつする（線画の全身）');
  if (OUT) { await a.waitForTimeout(1000); await a.screenshot({ path: `${OUT}/welcome.png` }); }
  await closeWelcome(a);
  const uidA = await uidOf(a);
  const prof = await ownerGet(`profiles/${uidA}`);
  const stat = await ownerGet(`privateStats/${uidA}`);
  check(prof && prof.fields.displayName.stringValue === 'くまの旅人' && prof.fields.policyVersion.integerValue === '1' && !!prof.fields.agreedAt, '名前と同意（版と時刻）が登録に入る');
  check(stat && stat.fields.homePref.stringValue === '43' && stat.fields.livePref.stringValue === '43' && stat.fields.gender.stringValue === 'noanswer' && stat.fields.ageGroup.stringValue === '30s', '年代・性別・出身地・所在地は、名前とは別の統計用の文書に入る');
  check(!Object.keys(prof.fields).some((k) => /mail|age|gender|home|live/i.test(k)) && !JSON.stringify(stat).includes('@'), 'メールアドレスはどこにも保存しない・名前の文書に統計用の項目はない');
  check(/くまの旅人 さんログイン中/.test(await a.textContent('#techo-login')), '手帖に「〇〇さん ログイン中」');

  // 3. 遊んだ記録がデータベースに保存される
  await a.evaluate(() => { YT.Store.visit('yufuin'); });
  await a.waitForTimeout(3500);
  const save = await ownerGet(`saves/${uidA}`);
  const saved = save ? JSON.parse(save.fields.data.stringValue) : {};
  check(!!(saved.visited && saved.visited.yufuin && saved.visited.beppu) && saved.cloudUid === uidA, '遊んだ記録がデータベースに保存される');

  // 4. 別の端末（まっさら）で同じ人がログイン → 記録が戻ってくる。登録はもう出ない
  const b = await ctx(false);
  await emailLogin(b, 'index.html', 'kuma@example.com');
  await gateGone(b);
  const stB = await b.evaluate(() => YT.Store.get());
  check(!!(stB.visited.yufuin && stB.visited.beppu) && stB.currentStationId === 'yufuin', '別の端末でログインすると、データベースの記録で続きから遊べる');
  check(!(await b.isVisible('#gate-reg')), '登録済みの人には登録フォームを出さない');

  // 5. 同じ端末で別の人に切り替え → 前の人の記録は混ざらない
  await b.click('[data-tab="collection"]');
  await b.click('[data-gate-signout]');
  await b.waitForSelector('#gate-actions:not([hidden])');
  await emailLogin(b, 'index.html', 'other@example.com');
  await b.waitForSelector('#gate-reg', { timeout: 20000 });
  const stOther = await b.evaluate(() => YT.Store.get());
  check(!stOther.visited.yufuin && stOther.cloudUid !== uidA, 'ログインを切り替えると、前の人の記録は混ざらない');
  await register(b, { name: '湯の町の常連', home: ['KR'] });
  await b.click('#gate-reg button[type="submit"]');
  await gateGone(b);
  await closeWelcome(b);

  // 6. 遊びながら「地元の人」としておすすめスポットを紹介する
  const openTecho = async (p) => {
    await p.goto(`${ORIGIN}/index.html?emulator`);
    await gateGone(p);
    await p.waitForSelector('#btn-open-current');
    await p.click('#btn-open-current');
    await p.waitForSelector('[data-voices] .voices-body :is(ul, .guide, .voices-empty:not(:has-text("めくっています")))', { timeout: 15000 });
  };
  await openTecho(a);
  const st = await a.evaluate(() => YT.Store.get().currentStationId);
  await a.click(`[data-voice-open="${st}"]`);
  await a.waitForSelector(`[data-voice-form="${st}"]`);
  check(/「くまの旅人」として書きます/.test(await a.textContent(`[data-voice-form="${st}"]`)), '紹介する名前は登録の名前');
  check(/立派な九州の宝物ばい/.test(await a.textContent(`[data-voice-form="${st}"]`)) && /みんなの手帖に載せてもよかばい/.test(await a.textContent(`[data-voice-form="${st}"]`)), '駅ノートのフォームで、ゴロ太が思い出を引き出し、掲載の同意をたずねる');
  check(/高校の帰り道/.test(await a.getAttribute('#vf-body', 'placeholder')) && (await a.$$('input[name="vf-bond"]')).length === 4 && !(await a.$('#vf-title')), '例文は懐かしい記憶を引き出す文・つながりは4つの選択肢（自由に書く欄はない）');
  const BODY = '朝いちばんの湯は地元の人と同じ時間に。<img src=x onerror="window.__xss=1"> 湯上がりに坂の上から町を見下ろしてみて。';
  await a.fill('#vf-spot', '坂の上の共同湯');
  await a.fill('#vf-body', BODY);
  await a.check('input[name="vf-bond"][value="homecoming"]');
  await a.click(`[data-voice-form="${st}"] button[type="submit"]`);
  await a.waitForTimeout(400);
  check(!(await a.$('[data-voices] .guide-gorota:has-text("たしかに預かった")')) && !(await a.$eval('#vf-consent', (e) => e.validity.valid)), '掲載の同意がないと送れない');
  await a.check('#vf-consent');
  if (OUT) { await a.evaluate(() => document.querySelector('[data-voice-form]').scrollIntoView()); await a.screenshot({ path: `${OUT}/techo-send.png` }); }
  await a.click(`[data-voice-form="${st}"] button[type="submit"]`);
  await a.waitForSelector('[data-voices] .guide-gorota:has-text("たしかに預かった")');
  check(true, '遊ぶ人が寄り道手帖からおすすめを紹介できる（審査待ちへ・ゴロ太がお礼を言う）');
  await openTecho(a);
  check(!/坂の上の共同湯/.test(await a.textContent('[data-voices]')), '承認前は寄り道手帖に出ない');
  check(/まっさらムツ/.test(await a.textContent('[data-voices]')), '駅ノートが空のときは、ゴロ太が最初のページをお願いする');

  // 7. 運営の審査（review.html）：運営でない人は審査できない → 運営にすると承認できる
  const adm = await ctx(false);
  await emailLogin(adm, 'review.html', 'admin@example.com', { form: '[data-form="email"]', input: '#lp-email', okSel: '#lp-auth .lp-msg.is-ok' });
  await adm.waitForSelector('#lp-auth .lp-id code');
  check(/運営として登録されていません/.test(await adm.textContent('#lp-auth')), '運営でない人には審査を出さない');
  const admUid = (await adm.textContent('#lp-auth .lp-id code')).trim();
  await ownerSet(`admins/${admUid}`, { note: { stringValue: 'コンソールから登録（テスト）' } });
  await adm.reload();
  await adm.waitForSelector('[data-act="approve"]');
  check(/坂の上の共同湯/.test(await adm.textContent('#lp-admin')) && /帰省すると立ち寄る場所/.test(await adm.textContent('#lp-admin')), '審査待ちにスポット名・名前・つながりが並ぶ');
  if (OUT) await adm.screenshot({ path: `${OUT}/review.png`, fullPage: true });
  await adm.click('[data-act="approve"]');
  await adm.waitForFunction(() => document.querySelector('#lp-admin').textContent.includes('掲載中のおすすめ（1件）'));
  check(true, '承認すると掲載中になる');

  // 8. 旅人の寄り道手帖に、文字のまま出る（タグとして動かない）
  await openTecho(a);
  const item = await a.$eval('[data-voices] .voice', (e) => ({ spot: e.querySelector('.voice-spot').textContent.trim(), body: e.querySelector('.voice-body').textContent, by: e.querySelector('.voice-by').textContent }));
  check(item.spot === '坂の上の共同湯' && item.body === BODY && /くまの旅人/.test(item.by) && /帰省すると立ち寄る場所/.test(item.by), '承認したおすすめが、スポット名・文面・名前・つながりのまま出る');
  check((await a.$$('[data-voices] img')).length === 0 && !(await a.evaluate(() => window.__xss)), '投稿の中のタグは画面で動かない');
  check(!/30s|noanswer|熊本県/.test(await a.textContent('[data-voices]')), '年代・性別・出身地は画面に出ない');
  check(/いつでもこの駅に帰ってこられるカチ/.test(await a.textContent('[data-voices]')), '駅ノートの欄で、カチ助が案内する');
  check(/新しく駅ノートが1件届いてたカチ/.test(await a.textContent('[data-voices]')), '前に見たあとで新しく載ったノートを、カチ助が知らせる');
  if (OUT) { await a.evaluate(() => document.querySelector('[data-voices]').scrollIntoView()); await a.screenshot({ path: `${OUT}/techo-voices.png` }); }

  // 9. 登録内容を直せる
  await a.keyboard.press('Escape');
  await a.click('[data-tab="collection"]');
  await a.click('[data-gate-edit]');
  await a.waitForSelector('#gate-reg');
  check((await a.inputValue('#reg-name')) === 'くまの旅人' && (await a.inputValue('#reg-home-pref')) === '43', '登録内容をひらくと、いまの内容が入っている');
  check((await a.isChecked('#reg-agree')), '登録内容を直すときは、同意済みのチェックが入っている');
  await a.fill('#reg-name', '熊本の案内人');
  await a.click('#gate-reg button[type="submit"]');
  await gateGone(a);
  const prof2 = await ownerGet(`profiles/${uidA}`);
  check(prof2.fields.displayName.stringValue === '熊本の案内人', '登録内容を直すとデータベースも変わる');

  // 10. 旅の便り：投函すると、審査なしでほかの旅人にも見える
  const PHOTO = join(dirname(fileURLToPath(import.meta.url)), 'fixture-photo.jpg');
  await a.click('[data-tab="letters"]');
  await a.waitForSelector('[data-pc-station]');
  check(/まだ一枚も届いてないカチ/.test(await a.textContent('.lt-map, body')), '自分の旅の便りが空のときは、カチ助が声をかける');
  check(/甘い醤油の匂い/.test(await a.getAttribute('[data-pc-memo]', 'placeholder')), '旅の便りの一言の例文も、九州の日常の空気');
  await a.selectOption('[data-pc-station]', 'hakata');
  await a.setInputFiles('[data-pc-file]', PHOTO);
  await a.waitForSelector('[data-pc-submit]:not([disabled])');
  check(/審査なしで/.test(await a.textContent('.lt-post')), '投函の欄に、ほかの旅人に見えることと通報のことを書く');
  check(await a.isChecked('[data-pc-share]'), '投函の欄に「ほかの旅人にも見せる」（はじめから選んである）');
  await a.fill('[data-pc-memo]', '駅前の屋台の灯り');
  if (OUT) { await a.evaluate(() => document.querySelector('.lt-post').scrollIntoView()); await a.screenshot({ path: `${OUT}/letters-post.png` }); }
  await a.click('[data-pc-submit]');
  const pid = `${uidA}_hakata`;
  let shared = null;
  for (let i = 0; i < 40 && !shared; i++) { await a.waitForTimeout(250); shared = await ownerGet(`postcards/${pid}`); }
  const sharedBig = shared && (await ownerGet(`postcardImages/${pid}`));
  check(shared && /^data:image\/jpeg;base64,/.test(shared.fields.thumb.stringValue) && shared.fields.memo.stringValue === '駅前の屋台の灯り' && shared.fields.name.stringValue === '熊本の案内人', '投函した写真がデータベースに入る（JPEG・一言・登録の名前）');
  check(shared && shared.fields.thumb.stringValue.length <= 60000 && !shared.fields.image, '一覧に出す文書には、小さな写真だけを入れる（6万字以内）');
  check(sharedBig && /^data:image\/jpeg;base64,/.test(sharedBig.fields.image.stringValue) && sharedBig.fields.image.stringValue.length <= 500000 && sharedBig.fields.image.stringValue.length > shared.fields.thumb.stringValue.length, '大きな写真は別の文書に分けて入れる（50万字以内）');

  // 11. ほかの旅人（b）：旅人たちのポストカードに本物の写真が出る → 素敵ね → 通報
  await b.goto(`${ORIGIN}/index.html?emulator`);
  await gateGone(b);
  await b.click('[data-tab="letters"]');
  await b.waitForSelector(`[data-pc="${pid}"]`, { timeout: 15000 });
  check(await b.$eval(`[data-pc="${pid}"] img`, (img) => img.src.startsWith('data:image/jpeg')), 'ほかの旅人の「旅人たちのポストカード」に、写真が出る');
  // 博多に停車したことにして、ひらき直す（b の記録は入れ替わってまっさらなので、表紙の巻頭言も閉じる）
  await closeCover(b);
  await b.evaluate(() => YT.Store.setCurrent('hakata'));
  await b.click('[data-tab="map"]');
  await b.click('[data-tab="letters"]');
  await b.waitForSelector(`[data-real-like="${pid}"]:not([disabled])`, { timeout: 15000 });
  if (OUT) { await b.evaluate((x) => document.querySelector(`[data-pc="${x}"]`).scrollIntoView({ block: 'center' }), pid); await b.screenshot({ path: `${OUT}/letters-real.png` }); }
  await b.click(`[data-real-like="${pid}"]`);
  await b.waitForFunction((x) => /素敵ね済み/.test(document.querySelector(`[data-real-like="${x}"]`).textContent), pid);
  check((await ownerGet(`postcards/${pid}`)).fields.likeCount.integerValue === '1', '素敵ねで、いいねの数が1つ増える');
  // 写真を押すと拡大し、そのときだけ大きな写真を読む
  await b.click(`[data-real-open="${pid}"]`);
  await b.waitForSelector(`#pc-viewer [data-pc="${pid}"] img[data-full="1"]`, { timeout: 10000 });
  check(await b.$eval(`#pc-viewer [data-pc="${pid}"] img`, (img, n) => img.src.length > n, shared.fields.thumb.stringValue.length), '本物の便りの写真を押すと、大きな写真で拡大する');
  if (OUT) { await b.waitForTimeout(500); await b.screenshot({ path: `${OUT}/real-viewer.png` }); }
  await b.click('#pc-viewer .pcv-actions [data-pcv-close]');
  await b.waitForSelector('#pc-viewer', { state: 'hidden' });
  await b.click(`[data-report="${pid}"]`);
  await b.waitForSelector(`[data-report-form="${pid}"]`);
  if (OUT) await b.screenshot({ path: `${OUT}/report.png` });
  await b.click(`[data-report-form="${pid}"] button[type="submit"]`);
  await b.waitForSelector(`[data-pc="${pid}"] .prf-done`);
  check((await ownerGet(`postcards/${pid}`)).fields.reportCount.integerValue === '1', '通報で、通報の数が1つ増える');

  // 12. 通報が3件そろうと見えなくなる → 運営が確かめて戻す
  await ownerPatch(`postcards/${pid}`, { reportCount: { integerValue: '3' }, hidden: { booleanValue: true } });
  await b.reload();
  await gateGone(b);
  await b.click('[data-tab="letters"]');
  await b.waitForTimeout(2500);
  check(!(await b.$(`[data-pc="${pid}"]`)), '通報が3件そろった写真は、ほかの旅人に見えなくなる');
  await adm.reload();
  await adm.waitForSelector(`[data-act="restore-card"][data-id="${pid}"]`);
  check(/通報された旅の便り（1枚）/.test(await adm.textContent('#lp-admin')) && !!(await adm.$('.lp-photo')), '運営の審査に、通報された写真と理由が並ぶ');
  await adm.click(`[data-act="restore-card"][data-id="${pid}"]`);
  await adm.waitForFunction(() => /見えるように戻しました/.test(document.querySelector('#lp-admin').textContent));
  const back = await ownerGet(`postcards/${pid}`);
  check(back.fields.reportCount.integerValue === '0' && back.fields.hidden.booleanValue === false, '運営が「問題なし」で戻すと、また見えるようになる');

  // 13. 寄り道手帖の現地スナップにも出る。本物が3枚そろった駅は、架空の旅人の便りを外す
  const fake = (n) => ({ uid: { stringValue: `fake${n}` }, stationId: { stringValue: 'hakata' }, memo: { stringValue: `博多の便り${n}` }, thumb: shared.fields.thumb, name: { stringValue: `旅人${n}` }, createdAt: { timestampValue: '2026-10-20T00:00:00Z' }, updatedAt: { timestampValue: '2026-10-20T00:00:00Z' }, likeCount: { integerValue: '0' }, reportCount: { integerValue: '0' }, hidden: { booleanValue: false } });
  const openSnaps = async () => {
    await b.goto(`${ORIGIN}/index.html?emulator`);
    await gateGone(b);
    await closeCover(b);
    await b.evaluate(() => YT.Store.setCurrent('hakata'));
    await b.click('[data-tab="map"]');
    await b.click('#btn-open-current');
    await b.waitForSelector(`[data-real-snaps="hakata"] [data-pc="${pid}"]`, { timeout: 15000 });
  };
  await openSnaps();
  check((await b.$$('[data-real-snaps="hakata"] [data-pc^="seed-"]')).length > 0, '本物の便りが少ないうちは、架空の旅人の便りも並ぶ');
  await ownerSet('postcards/fake1_hakata', fake(1));
  await ownerSet('postcards/fake2_hakata', fake(2));
  await openSnaps();
  check((await b.$$('[data-real-snaps="hakata"] [data-pc^="seed-"]')).length === 0 && (await b.$$('[data-real-snaps="hakata"] [data-real-like]')).length === 3, '本物の便りが3枚そろった駅は、架空の旅人の便りを外す');
  if (OUT) { await b.evaluate(() => document.querySelector('[data-real-snaps]').scrollIntoView({ block: 'center' })); await b.screenshot({ path: `${OUT}/snaps-real.png` }); }

  // 14. 旅の便りのタブは20枚ずつ読み、「もっと見る」で続きを読む
  for (let n = 0; n < 22; n++) {
    const t = new Date(Date.UTC(2026, 9, 1, 0, n)).toISOString();
    await ownerSet(`postcards/many${n}_beppu`, { ...fake(100 + n), uid: { stringValue: `many${n}` }, stationId: { stringValue: 'beppu' }, updatedAt: { timestampValue: t } });
  }
  await b.goto(`${ORIGIN}/index.html?emulator`);
  await gateGone(b);
  await b.click('[data-tab="letters"]');
  await b.waitForSelector('[data-real-more]', { timeout: 15000 });
  const first = (await b.$$('[data-real-board] [data-pc]')).length;
  if (OUT) { await b.evaluate(() => document.querySelector('[data-real-more]').scrollIntoView({ block: 'center' })); await b.screenshot({ path: `${OUT}/real-more.png` }); }
  await b.click('[data-real-more]');
  await b.waitForFunction((n) => document.querySelectorAll('[data-real-board] [data-pc]').length > n, first, { timeout: 10000 });
  const second = (await b.$$('[data-real-board] [data-pc]')).length;
  check(first <= 20 && second > first && !(await b.$('[data-real-more]')), `旅の便りは20枚ずつ読み、「もっと見る」で続きを読む（${first}枚 → ${second}枚）`);

  // 15. 退会：登録と記録を消す（a）。データベースの自分のもの・端末の記録・ログインの記録が消える
  await a.goto(`${ORIGIN}/index.html?emulator`);
  await gateGone(a);
  await closeCover(a);
  await a.click('[data-tab="collection"]');
  await a.click('#techo-login [data-gate-leave]');
  await a.waitForSelector('.pp-layer.is-open [data-pp-leave]');
  if (OUT) { await a.waitForTimeout(500); await a.screenshot({ path: `${OUT}/leave.png` }); }
  await a.click('[data-pp-leave]');
  await a.waitForFunction(() => /すべて消しました|残りました|消せなかった/.test((document.querySelector('#gate-msg') || {}).textContent || ''), null, { timeout: 40000 });
  const leftMsg = await a.textContent('#gate-msg');
  const gone = await Promise.all([`profiles/${uidA}`, `privateStats/${uidA}`, `saves/${uidA}`, `postcards/${uidA}_hakata`, `postcardImages/${uidA}_hakata`].map(ownerGet));
  const vq = await (await fetch(`${FS.replace(/\/documents$/, '')}/documents:runQuery`, { method: 'POST', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'voices' }], where: { fieldFilter: { field: { fieldPath: 'uid' }, op: 'EQUAL', value: { stringValue: uidA } } } } }) })).json();
  const acc = await (await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/projects/demo-qtrip/accounts:lookup`, { method: 'POST', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ localId: [uidA] }) })).json();
  check(gone.every((x) => !x) && !vq.some((r) => r.document), `退会すると、登録・統計用・記録・旅の便り・駅ノートがデータベースから消える${gone.some(Boolean) ? '（残り：' + gone.map((x, i) => (x ? i : '')).join('') + '）' : ''}`);
  check(!(acc.users && acc.users.length) && /すべて消しました/.test(leftMsg), 'ログインの記録（メールアドレス）も消え、関所で知らせる');
  check(await a.evaluate(() => !localStorage.getItem('yokatabi.kyushu.v1') || !JSON.parse(localStorage.getItem('yokatabi.kyushu.v1')).cloudUid), '端末の記録も消える');

  check(errors.length === 0, `画面のエラーなし${errors.length ? '：' + errors.join(' / ') : ''}`);
} finally {
  await browser.close();
  server.kill();
}
console.log(fails.length ? `\n${fails.length} 件失敗` : '\nすべて通りました');
process.exit(fails.length ? 1 : 0);
