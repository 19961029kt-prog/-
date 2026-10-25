// 地元の人の声の画面を、エミュレーター（Auth・Firestore、projectId demo-qtrip）につないで通しで確かめる。
// 実行：cd yokatabi/firebase && npm run e2e（Playwright と Python が要る。本物のプロジェクトには触れない）
// 流れ：地元の人がメールリンクでログイン → 運営が名簿に登録 → 投稿 → すぐの2件目は断られる → 運営が承認 → 寄り道手帖に文字として出る
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

// ルールを通さない管理者の書き込み（エミュレーターだけの「owner」）。運営が Firebase コンソールでする作業の代わり
async function ownerSet(path, fields) {
  const res = await fetch(`${FS}/${path}`, { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }) });
  if (!res.ok) throw new Error(`owner write ${path}: ${res.status} ${await res.text()}`);
}
const str = (v) => ({ stringValue: v });

// メールリンクでログイン：ページでリンクを送り、エミュレーターが受け取ったリンクを同じページでひらく
async function emailLogin(page, email) {
  await page.goto(`${ORIGIN}/local.html?emulator`);
  await page.fill('#lp-email', email);
  await page.click('[data-form="email"] button[type="submit"]');
  await page.waitForSelector('#lp-auth .lp-msg.is-ok');
  const codes = await (await fetch(`${AUTH}/emulator/v1/projects/demo-qtrip/oobCodes`)).json();
  const code = codes.oobCodes.filter((c) => c.email === email && c.requestType === 'EMAIL_SIGNIN').pop();
  await page.goto(`${ORIGIN}/local.html?emulator&apiKey=demo-key&oobCode=${code.oobCode}&mode=signIn&lang=ja`);
  await page.waitForSelector('[data-uid]');
  return page.textContent('[data-uid]');
}

const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: SITE, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
// この開発環境ではブラウザが /opt/pw-browsers にある。手元では Playwright が入れたものを使う
const browser = await chromium.launch(existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
try {
  const errors = [];
  const ctx = async () => {
    const c = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const p = await c.newPage();
    p.on('pageerror', (e) => errors.push(e.message));
    p.on('console', (m) => m.type() === 'error' && !/permission-denied|PERMISSION_DENIED|Missing or insufficient permissions|status of 403/.test(m.text()) && errors.push(m.text()));
    return p;
  };

  // 1. 地元の人：ログイン（まだ名簿にいない）
  const local = await ctx();
  const localUid = (await emailLogin(local, 'shop@example.com')).trim();
  check(/^[A-Za-z0-9]{10,}$/.test(localUid), `地元の人の番号が出る（${localUid}）`);
  check(/まだ地元の人として登録されていません/.test(await local.textContent('#lp-contrib')), '名簿にいない人には投稿フォームが出ない');

  // 2. 運営：ログインして、コンソールで admins に入れてもらった体にする → 窓口から地元の人を登録
  const admin = await ctx();
  const adminUid = (await emailLogin(admin, 'admin@example.com')).trim();
  await ownerSet(`admins/${adminUid}`, { note: str('コンソールから登録（テスト）') });
  await admin.reload();
  await admin.waitForSelector('[data-form="register"]');
  await admin.fill('#lp-r-uid', localUid);
  await admin.fill('#lp-r-name', '湯けむり商店');
  await admin.fill('#lp-r-title', '別府の土産物店');
  await admin.check('input[name="st"][value="beppu"]');
  await admin.click('[data-form="register"] button[type="submit"]');
  await admin.waitForSelector('#lp-admin .lp-msg.is-ok');
  check(/湯けむり商店/.test(await admin.textContent('#lp-admin')), '運営が窓口から地元の人を登録できる');

  // 3. 地元の人：投稿（文字として出ることを確かめるため、タグのような文字も混ぜる）
  const BODY = '路地の角の共同湯は、朝いちばんが静かです。<img src=x onerror="window.__xss=1"> 湯上がりに海まで歩いてみてください。';
  await local.reload();
  await local.waitForSelector('[data-form="post"]');
  check((await local.$$eval('#lp-station option', (o) => o.map((x) => x.value))).join() === 'beppu', '投稿できる駅は担当の駅だけ');
  await local.fill('#lp-body', BODY);
  await local.click('[data-form="post"] button[type="submit"]');
  await local.waitForSelector('#lp-contrib .lp-msg.is-ok');
  check(/審査待ち/.test(await local.textContent('#lp-contrib')), '投稿は「審査待ち」に入る');
  if (OUT) await local.screenshot({ path: `${OUT}/local-contrib.png`, fullPage: true });
  // すぐの2件目はルールに断られ、画面にやさしい言葉が出る
  await local.fill('#lp-body', '2件目');
  await local.click('[data-form="post"] button[type="submit"]');
  await local.waitForSelector('[data-form="post"] .lp-msg:not(.is-ok)');
  check(/1分ほどあけて/.test(await local.textContent('[data-form="post"] .lp-msg')), '60秒以内の2件目は断られる');

  // 4. ゲームで遊ぶ人：ログインしないと遊べない（関所）。ログインすると盤面に入れる
  const traveler = await ctx();
  await traveler.addInitScript(() => { if (!localStorage.getItem('yokatabi.kyushu.v1')) localStorage.setItem('yokatabi.kyushu.v1', JSON.stringify({ version: 3, prefaceSeen: true, currentStationId: 'beppu', visited: { beppu: new Date().toISOString() }, muted: true })); });
  await traveler.goto(`${ORIGIN}/index.html?emulator`);
  await traveler.waitForSelector('#gate-actions:not([hidden])');
  check(await traveler.isVisible('#login-gate') && (await traveler.evaluate(() => document.getElementById('app').inert)), 'ログインしないと関所が出て、盤面はさわれない');
  if (OUT) await traveler.screenshot({ path: `${OUT}/gate.png` });
  await traveler.fill('#gate-email', 'player@example.com');
  await traveler.click('#gate-email-form button[type="submit"]');
  await traveler.waitForSelector('#gate-msg .gate-msg.is-ok');
  const codes = await (await fetch(`${AUTH}/emulator/v1/projects/demo-qtrip/oobCodes`)).json();
  const code = codes.oobCodes.filter((c) => c.email === 'player@example.com').pop();
  await traveler.goto(`${ORIGIN}/index.html?emulator&apiKey=demo-key&oobCode=${code.oobCode}&mode=signIn&lang=ja`);
  await traveler.waitForSelector('#login-gate', { state: 'hidden', timeout: 15000 });
  check(!(await traveler.evaluate(() => document.getElementById('app').inert)) && !/oobCode/.test(traveler.url()), 'メールリンクでログインすると盤面に入れる（URL からリンクの印も消える）');
  const openTecho = async (reload = true) => {
    if (reload) await traveler.goto(`${ORIGIN}/index.html?emulator`);
    await traveler.waitForSelector('#login-gate', { state: 'hidden', timeout: 15000 });
    await traveler.waitForSelector('#btn-open-current');
    await traveler.click('#btn-open-current');
    await traveler.waitForSelector('[data-voices="beppu"] .voices-body :is(ul, .voices-empty:not(:has-text("読み込んでいます")))', { timeout: 15000 });
  };
  await openTecho();
  check(!/共同湯/.test(await traveler.textContent('[data-voices="beppu"]')), '承認前の声は寄り道手帖に出ない');

  // 5. 遊ぶ人が、寄り道手帖から声を届ける（名前は自分で決める・駅とのつながりは自己申告・掲載の同意つき）
  await traveler.click('[data-voice-open="beppu"]');
  await traveler.waitForSelector('[data-voice-form="beppu"]');
  await traveler.fill('#vf-name', '湯の町の常連');
  await traveler.fill('#vf-title', '別府に通って二十年');
  await traveler.fill('#vf-body', '鉄輪の湯けむりは、夕方に坂の上から見ると町じゅうが白く霞んできれいです。');
  // 同意のチェックがないと、ブラウザの入力チェックで送信そのものが止まる
  await traveler.click('[data-voice-form="beppu"] button[type="submit"]');
  await traveler.waitForTimeout(400);
  check(!(await traveler.$('[data-voices="beppu"] .vf-msg.is-ok')) && !(await traveler.$eval('#vf-consent', (e) => e.validity.valid)), '掲載の同意がないと送れない');
  await traveler.check('#vf-consent');
  if (OUT) { await traveler.evaluate(() => document.querySelector('[data-voice-form]').scrollIntoView()); await traveler.screenshot({ path: `${OUT}/techo-send.png` }); }
  await traveler.click('[data-voice-form="beppu"] button[type="submit"]');
  await traveler.waitForSelector('[data-voices="beppu"] .vf-msg.is-ok');
  check(true, '遊ぶ人が寄り道手帖から声を送れる（審査待ちへ）');

  // 6. 運営：審査待ちの2件（確かめた地元の人・自己申告）を、どちらも文面のまま承認する
  await admin.reload();
  await admin.waitForSelector('[data-act="approve"]');
  check(/審査待ち（2件）/.test(await admin.textContent('#lp-admin')) && /自己申告/.test(await admin.textContent('#lp-admin')), '運営の審査に、遊ぶ人の声も「自己申告」として並ぶ');
  if (OUT) await admin.screenshot({ path: `${OUT}/local-admin.png`, fullPage: true });
  for (const n of [1, 2]) {
    await admin.click('[data-act="approve"]');
    await admin.waitForFunction((k) => document.querySelector('#lp-admin').textContent.includes(`掲載中の声（${k}件）`), n);
  }
  check(/掲載中の声（2件）/.test(await admin.textContent('#lp-admin')) && /審査待ち（0件）/.test(await admin.textContent('#lp-admin')), '承認すると掲載中になる');

  // 7. 旅人の寄り道手帖に、文字のまま出る（タグとして動かない）。札は確かめた地元の人だけ
  await openTecho();
  const items = await traveler.$$eval('[data-voices="beppu"] .voice', (els) => els.map((e) => ({ body: e.querySelector('.voice-body').textContent, by: e.querySelector('.voice-by').textContent, badge: !!e.querySelector('.voice-badge') })));
  const shop = items.find((x) => /湯けむり商店/.test(x.by)), fan = items.find((x) => /湯の町の常連/.test(x.by));
  check(shop && shop.body === BODY, '承認した文面がそのまま出る');
  check(shop && shop.badge && /別府の土産物店/.test(shop.by), '確かめた地元の人には札と肩書きがつく');
  check(fan && !fan.badge && /別府に通って二十年/.test(fan.by), '遊ぶ人の声は自己申告のつながりを添え、札はつかない');
  check((await traveler.$$('[data-voices="beppu"] img')).length === 0 && !(await traveler.evaluate(() => window.__xss)), '投稿の中のタグは画面で動かない');
  if (OUT) {
    await traveler.evaluate(() => document.querySelector('[data-voices="beppu"]').scrollIntoView());
    await traveler.screenshot({ path: `${OUT}/techo-voices.png` });
  }

  // 8. 手帖の「ログアウト」で関所に戻る
  await traveler.keyboard.press('Escape');
  await traveler.click('[data-tab="collection"]');
  await traveler.click('[data-gate-signout]');
  await traveler.waitForSelector('#login-gate:not([hidden]) #gate-actions:not([hidden])');
  check(await traveler.evaluate(() => document.getElementById('app').inert), 'ログアウトすると関所に戻る');

  // 9. 地元の人は掲載中の声を取り下げられる
  await local.reload();
  await local.waitForSelector('[data-act="withdraw-voice"]');
  local.once('dialog', (d) => d.accept());
  await local.click('[data-act="withdraw-voice"]');
  await local.waitForFunction(() => !document.querySelector('[data-act="withdraw-voice"]'));
  check(true, '地元の人は掲載中の声を取り下げられる');

  check(errors.length === 0, `画面のエラーなし${errors.length ? '：' + errors.join(' / ') : ''}`);
} finally {
  await browser.close();
  server.kill();
}
console.log(fails.length ? `\n${fails.length} 件失敗` : '\nすべて通りました');
process.exit(fails.length ? 1 : 0);
