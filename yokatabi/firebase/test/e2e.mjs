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
const check = (ok, label) => { console.log(`${ok ? 'ok    ' : 'FAIL  '} ${label}`); if (!ok) fails.push(label); };

// ルールを通さない読み書き（エミュレーターだけの「owner」）。運営が Firebase コンソールでする作業の代わり
async function ownerSet(path, fields) {
  const res = await fetch(`${FS}/${path}`, { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }) });
  if (!res.ok) throw new Error(`owner write ${path}: ${res.status}`);
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
async function register(page, { name, home = ['JP', '43'], live = null }) {
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

  // 2. はじめてのログイン → 登録（年代・性別・出身地・現在の所在地）
  await emailLogin(a, 'index.html', 'kuma@example.com');
  await a.waitForSelector('#gate-reg');
  check(await a.evaluate(() => document.getElementById('app').inert), 'はじめてのログインでは、登録するまで遊べない');
  await register(a, { name: 'くまの旅人', home: ['JP', '43'], live: ['KR'] });
  check(await a.isHidden('#reg-live-pref'), '現在の所在地が海外なら、都道府県は出さない');
  await a.selectOption('#reg-live-country', 'JP');
  await a.selectOption('#reg-live-pref', '43');
  if (OUT) await a.screenshot({ path: `${OUT}/register.png`, fullPage: true });
  await a.click('#gate-reg button[type="submit"]');
  await gateGone(a);
  const uidA = await uidOf(a);
  const prof = await ownerGet(`profiles/${uidA}`);
  check(prof && prof.fields.displayName.stringValue === 'くまの旅人' && prof.fields.homePref.stringValue === '43' && prof.fields.livePref.stringValue === '43' && prof.fields.gender.stringValue === 'noanswer', '登録の内容がデータベースに入る（名前・年代・性別・出身地・所在地）');
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

  // 6. 遊びながら「地元の人」としておすすめスポットを紹介する
  const openTecho = async (p) => {
    await p.goto(`${ORIGIN}/index.html?emulator`);
    await gateGone(p);
    await p.waitForSelector('#btn-open-current');
    await p.click('#btn-open-current');
    await p.waitForSelector('[data-voices] .voices-body :is(ul, .voices-empty:not(:has-text("読み込んでいます")))', { timeout: 15000 });
  };
  await openTecho(a);
  const st = await a.evaluate(() => YT.Store.get().currentStationId);
  await a.click(`[data-voice-open="${st}"]`);
  await a.waitForSelector(`[data-voice-form="${st}"]`);
  check(/「くまの旅人」として紹介します/.test(await a.textContent(`[data-voice-form="${st}"]`)), '紹介する名前は登録の名前');
  const BODY = '朝いちばんの湯は地元の人と同じ時間に。<img src=x onerror="window.__xss=1"> 湯上がりに坂の上から町を見下ろしてみて。';
  await a.fill('#vf-spot', '坂の上の共同湯');
  await a.fill('#vf-body', BODY);
  await a.fill('#vf-title', '由布院に住んで十年');
  await a.click(`[data-voice-form="${st}"] button[type="submit"]`);
  await a.waitForTimeout(400);
  check(!(await a.$('[data-voices] .vf-msg.is-ok')) && !(await a.$eval('#vf-consent', (e) => e.validity.valid)), '掲載の同意がないと送れない');
  await a.check('#vf-consent');
  if (OUT) { await a.evaluate(() => document.querySelector('[data-voice-form]').scrollIntoView()); await a.screenshot({ path: `${OUT}/techo-send.png` }); }
  await a.click(`[data-voice-form="${st}"] button[type="submit"]`);
  await a.waitForSelector('[data-voices] .vf-msg.is-ok');
  check(true, '遊ぶ人が寄り道手帖からおすすめを紹介できる（審査待ちへ）');
  await openTecho(a);
  check(!/坂の上の共同湯/.test(await a.textContent('[data-voices]')), '承認前は寄り道手帖に出ない');

  // 7. 運営の審査（review.html）：運営でない人は審査できない → 運営にすると承認できる
  const adm = await ctx(false);
  await emailLogin(adm, 'review.html', 'admin@example.com', { form: '[data-form="email"]', input: '#lp-email', okSel: '#lp-auth .lp-msg.is-ok' });
  await adm.waitForSelector('#lp-auth .lp-id code');
  check(/運営として登録されていません/.test(await adm.textContent('#lp-auth')), '運営でない人には審査を出さない');
  const admUid = (await adm.textContent('#lp-auth .lp-id code')).trim();
  await ownerSet(`admins/${admUid}`, { note: { stringValue: 'コンソールから登録（テスト）' } });
  await adm.reload();
  await adm.waitForSelector('[data-act="approve"]');
  check(/坂の上の共同湯/.test(await adm.textContent('#lp-admin')) && /由布院に住んで十年/.test(await adm.textContent('#lp-admin')), '審査待ちにスポット名・名前・つながりが並ぶ');
  if (OUT) await adm.screenshot({ path: `${OUT}/review.png`, fullPage: true });
  await adm.click('[data-act="approve"]');
  await adm.waitForFunction(() => document.querySelector('#lp-admin').textContent.includes('掲載中のおすすめ（1件）'));
  check(true, '承認すると掲載中になる');

  // 8. 旅人の寄り道手帖に、文字のまま出る（タグとして動かない）
  await openTecho(a);
  const item = await a.$eval('[data-voices] .voice', (e) => ({ spot: e.querySelector('.voice-spot').textContent.trim(), body: e.querySelector('.voice-body').textContent, by: e.querySelector('.voice-by').textContent }));
  check(item.spot === '坂の上の共同湯' && item.body === BODY && /くまの旅人/.test(item.by) && /由布院に住んで十年/.test(item.by), '承認したおすすめが、スポット名・文面・名前・つながりのまま出る');
  check((await a.$$('[data-voices] img')).length === 0 && !(await a.evaluate(() => window.__xss)), '投稿の中のタグは画面で動かない');
  check(!/30s|noanswer|熊本県/.test(await a.textContent('[data-voices]')), '年代・性別・出身地は画面に出ない');
  if (OUT) { await a.evaluate(() => document.querySelector('[data-voices]').scrollIntoView()); await a.screenshot({ path: `${OUT}/techo-voices.png` }); }

  // 9. 登録内容を直せる
  await a.keyboard.press('Escape');
  await a.click('[data-tab="collection"]');
  await a.click('[data-gate-edit]');
  await a.waitForSelector('#gate-reg');
  check((await a.inputValue('#reg-name')) === 'くまの旅人' && (await a.inputValue('#reg-home-pref')) === '43', '登録内容をひらくと、いまの内容が入っている');
  await a.fill('#reg-name', '熊本の案内人');
  await a.click('#gate-reg button[type="submit"]');
  await gateGone(a);
  const prof2 = await ownerGet(`profiles/${uidA}`);
  check(prof2.fields.displayName.stringValue === '熊本の案内人', '登録内容を直すとデータベースも変わる');

  check(errors.length === 0, `画面のエラーなし${errors.length ? '：' + errors.join(' / ') : ''}`);
} finally {
  await browser.close();
  server.kill();
}
console.log(fails.length ? `\n${fails.length} 件失敗` : '\nすべて通りました');
process.exit(fails.length ? 1 : 0);
