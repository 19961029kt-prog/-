// Q-TRIP の Security Rules を、ローカルの Firestore エミュレーターで確かめる。
// 実行：cd yokatabi/firebase && npm test（firebase emulators:exec がエミュレーターを立ててから node --test を走らせる）
// 本物の Firebase プロジェクトには一切つながない（projectId は demo- で始まる、エミュレーター専用の名前）。
import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, test } from 'node:test';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { Timestamp, collection, deleteDoc, doc, getDoc, getDocs, increment, limit, orderBy, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';

let env;
const ADMIN = 'admin-1', P1 = 'player-1', P2 = 'player-2', NEWBIE = 'player-new';
const T0 = Timestamp.fromDate(new Date('2026-10-01T00:00:00Z'));
const PROFILE = { displayName: 'くまの旅人', ageGroup: '30s', gender: 'female', homeCountry: 'JP', homePref: '43', liveCountry: 'JP', livePref: '43', createdAt: T0 };

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-qtrip',
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
after(async () => env && env.cleanup());

// 毎回まっさらにして、運営1人・登録済みの遊ぶ人2人・承認済みのおすすめ1件を、ルールを通さずに置く
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'admins', ADMIN), { note: 'コンソールから登録' });
    await setDoc(doc(db, 'profiles', P1), PROFILE);
    await setDoc(doc(db, 'profiles', P2), { ...PROFILE, displayName: '湯の町の常連', homeCountry: 'KR', homePref: '', liveCountry: 'JP', livePref: '44' });
    await setDoc(doc(db, 'voices', 'v-approved'), { uid: P2, stationId: 'yufuin', spot: '金鱗湖', body: '朝霧の金鱗湖は、少し早起きして。', name: '湯の町の常連', title: '由布院に通って十年', consent: true, createdAt: T0, approvedAt: T0, approvedBy: ADMIN });
  });
});

// ゲームで遊ぶ人（Google・メールリンク＝メール確認済み）／メール未確認／ログインなし
const player = (uid) => env.authenticatedContext(uid, { email_verified: true }).firestore();
const unverified = (uid) => env.authenticatedContext(uid, { email_verified: false }).firestore();
const anon = () => env.unauthenticatedContext().firestore();
const admin = () => env.authenticatedContext(ADMIN, { email_verified: true }).firestore();

const spot = (uid, over = {}) => ({ uid, stationId: 'kumamoto', spot: '城下の路面電車', body: '夕方の窓から見るお城がいちばん。', name: 'くまの旅人', title: '熊本に住んで十年', consent: true, createdAt: serverTimestamp(), ...over });
// 投稿は「審査待ちの作成」と「自分の登録の lastPostAt を今に」を1回の一括書き込みで（画面も同じ形）
function post(db, uid, id, over = {}, { bump = true } = {}) {
  const b = writeBatch(db);
  b.set(doc(db, 'voicesPending', id), spot(uid, over));
  if (bump) b.update(doc(db, 'profiles', uid), { lastPostAt: serverTimestamp() });
  return b.commit();
}
async function seedPending(id = 'v-new', uid = P1) {
  await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'voicesPending', id), { ...spot(uid), createdAt: Timestamp.fromDate(new Date('2026-10-20T00:00:00Z')) }));
}
async function pendingData(id) {
  let data;
  await env.withSecurityRulesDisabled(async (ctx) => { data = (await getDoc(doc(ctx.firestore(), 'voicesPending', id))).data(); });
  return data;
}
function approve(db, id, data, { log = true, removePending = true, edit = {} } = {}) {
  const b = writeBatch(db);
  b.set(doc(db, 'voices', id), { ...data, ...edit, approvedAt: serverTimestamp(), approvedBy: ADMIN });
  if (removePending) b.delete(doc(db, 'voicesPending', id));
  if (log) b.set(doc(db, 'moderationLog', id), { action: 'approve', by: ADMIN, at: serverTimestamp() });
  return b.commit();
}
const newProfile = (over = {}) => ({ ...PROFILE, displayName: 'はじめての旅人', createdAt: serverTimestamp(), ...over });

describe('登録（名前・年代・性別・出身地・現在の所在地）', () => {
  test('メール確認済みの人は、自分の登録を作れる（日本は都道府県つき・海外は空）', async () => {
    await assertSucceeds(setDoc(doc(player(NEWBIE), 'profiles', NEWBIE), newProfile()));
    await assertSucceeds(setDoc(doc(player('p-kr'), 'profiles', 'p-kr'), newProfile({ homeCountry: 'KR', homePref: '', liveCountry: 'TW', livePref: '' })));
  });
  test('メール未確認・ログインなし・他人の番号では作れない', async () => {
    await assertFails(setDoc(doc(unverified(NEWBIE), 'profiles', NEWBIE), newProfile()));
    await assertFails(setDoc(doc(anon(), 'profiles', NEWBIE), newProfile()));
    await assertFails(setDoc(doc(player(P2), 'profiles', NEWBIE), newProfile()));
  });
  test('選択肢にない値・日本なのに県がない・海外なのに県がある・項目の足りない登録は通らない', async () => {
    const db = player(NEWBIE), ref = doc(db, 'profiles', NEWBIE);
    await assertFails(setDoc(ref, newProfile({ ageGroup: '25' })));
    await assertFails(setDoc(ref, newProfile({ gender: 'x' })));
    await assertFails(setDoc(ref, newProfile({ homePref: '' })));
    await assertFails(setDoc(ref, newProfile({ homePref: '48' })));
    await assertFails(setDoc(ref, newProfile({ liveCountry: 'US', livePref: '13' })));
    await assertFails(setDoc(ref, newProfile({ homeCountry: 'Japan' })));
    await assertFails(setDoc(ref, newProfile({ displayName: '' })));
    await assertFails(setDoc(ref, newProfile({ email: 'a@example.com' })));
    const { gender, ...noGender } = newProfile();
    await assertFails(setDoc(ref, noGender));
    await assertFails(setDoc(ref, newProfile({ createdAt: T0 })));
    await assertFails(setDoc(ref, newProfile({ lastPostAt: Timestamp.fromDate(new Date('2020-01-01')) })));
  });
  test('本人は登録を直せる。登録日と投稿の時刻はごまかせず、本人は消せない', async () => {
    const db = player(P1), ref = doc(db, 'profiles', P1);
    await assertSucceeds(updateDoc(ref, { displayName: '熊本の案内人', liveCountry: 'JP', livePref: '40' }));
    await assertFails(updateDoc(ref, { createdAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { lastPostAt: Timestamp.fromDate(new Date('2020-01-01')) }));
    await assertFails(deleteDoc(ref));
  });
  test('登録は本人と運営だけが読める（年代・性別・出身地は公開しない）', async () => {
    await assertSucceeds(getDoc(doc(player(P1), 'profiles', P1)));
    await assertSucceeds(getDoc(doc(admin(), 'profiles', P1)));
    await assertFails(getDoc(doc(player(P2), 'profiles', P1)));
    await assertFails(getDoc(doc(anon(), 'profiles', P1)));
    await assertFails(getDocs(collection(player(P1), 'profiles')));
  });
});

describe('遊んだ記録（本人だけ）', () => {
  const save = (over = {}) => ({ data: JSON.stringify({ version: 3, visited: { hakata: 'x' } }), version: 3, progress: 1, savedAt: Date.now(), updatedAt: serverTimestamp(), ...over });
  test('本人は記録を書いて、読んで、消せる', async () => {
    const ref = doc(player(P1), 'saves', P1);
    await assertSucceeds(setDoc(ref, save()));
    await assertSucceeds(getDoc(ref));
    await assertSucceeds(setDoc(ref, save({ progress: 5 })));
    await assertSucceeds(deleteDoc(ref));
  });
  test('他人・ログインなし・メール未確認は読み書きできない。一覧もできない', async () => {
    await assertSucceeds(setDoc(doc(player(P1), 'saves', P1), save()));
    await assertFails(getDoc(doc(player(P2), 'saves', P1)));
    await assertFails(setDoc(doc(player(P2), 'saves', P1), save()));
    await assertFails(getDoc(doc(anon(), 'saves', P1)));
    await assertFails(setDoc(doc(unverified(P1), 'saves', P1), save()));
    await assertFails(getDocs(collection(player(P1), 'saves')));
    await assertFails(getDoc(doc(admin(), 'saves', P1))); // 運営も見ない
  });
  test('大きすぎる記録・形の違う記録・時刻のごまかしは通らない', async () => {
    const ref = doc(player(P1), 'saves', P1);
    await assertFails(setDoc(ref, save({ data: 'x'.repeat(400001) })));
    await assertFails(setDoc(ref, save({ data: { visited: {} } })));
    await assertFails(setDoc(ref, save({ updatedAt: T0 })));
    await assertFails(setDoc(ref, save({ email: 'a@example.com' })));
    await assertFails(setDoc(ref, save({ version: 'v3' })));
  });
});

describe('だれでも読めるのは承認済みのおすすめだけ', () => {
  test('ログインしていない人も、承認済みは読める', async () => {
    await assertSucceeds(getDoc(doc(anon(), 'voices', 'v-approved')));
    await assertSucceeds(getDocs(collection(anon(), 'voices')));
  });
  test('審査待ちは、ほかの人には見えない', async () => {
    await seedPending();
    await assertFails(getDoc(doc(anon(), 'voicesPending', 'v-new')));
    await assertFails(getDoc(doc(player(P2), 'voicesPending', 'v-new')));
    await assertFails(getDocs(collection(player(P2), 'voicesPending')));
  });
  test('運営の一覧・審査の記録・以前の名簿（contributors）・書いていないコレクションは、だれも触れない', async () => {
    await assertFails(getDocs(collection(admin(), 'admins')));
    await assertFails(getDocs(collection(player(P1), 'moderationLog')));
    await assertFails(getDoc(doc(admin(), 'contributors', P1)));
    await assertFails(setDoc(doc(admin(), 'contributors', P1), { name: 'x' }));
    await assertFails(setDoc(doc(admin(), 'anything', 'x'), { a: 1 }));
  });
});

describe('ログインした人が、地元の人としておすすめスポットを紹介する（承認制）', () => {
  test('登録済み・メール確認済みの人は、登録の名前で投稿できる', async () => {
    await assertSucceeds(post(player(P1), P1, 'p-1'));
    await assertSucceeds(getDoc(doc(player(P1), 'voicesPending', 'p-1')));
    await assertSucceeds(getDocs(query(collection(player(P1), 'voicesPending'), where('uid', '==', P1))));
  });
  test('登録していない・メール未確認・ログインしていない人は投稿できない', async () => {
    await assertFails(post(player(NEWBIE), NEWBIE, 'p-n', {}, { bump: false }));
    await assertFails(post(unverified(P1), P1, 'p-u'));
    await assertFails(setDoc(doc(anon(), 'voicesPending', 'p-a'), spot('x')));
  });
  test('名前が登録と違う・他人になりすます・同意がない投稿は通らない', async () => {
    await assertFails(post(player(P1), P1, 'p-n', { name: '湯の町の常連' }));
    await assertFails(post(player(P1), P1, 'p-o', { uid: P2 }));
    await assertFails(post(player(P1), P1, 'p-c', { consent: false }));
  });
  test('ゲームにない駅・スポット名なし／41字・本文401字・長すぎるつながり・余計な項目は通らない', async () => {
    await assertFails(post(player(P1), P1, 'p-s', { stationId: 'tokyo' }));
    await assertFails(post(player(P1), P1, 'p-e', { spot: '' }));
    await assertFails(post(player(P1), P1, 'p-l', { spot: 'あ'.repeat(41) }));
    await assertFails(post(player(P1), P1, 'p-b', { body: 'あ'.repeat(401) }));
    await assertFails(post(player(P1), P1, 'p-t', { title: 'あ'.repeat(61) }));
    await assertFails(post(player(P1), P1, 'p-x', { verified: true }));
    await assertFails(post(player(P1), P1, 'p-d', { createdAt: T0 }));
  });
  test('連投の歯止め：3分以内の2件目、時刻を更新しない投稿は通らない', async () => {
    await assertSucceeds(post(player(P1), P1, 'p-1'));
    await assertFails(post(player(P1), P1, 'p-2'));
    await env.withSecurityRulesDisabled(async (ctx) => updateDoc(doc(ctx.firestore(), 'profiles', P1), { lastPostAt: Timestamp.fromDate(new Date('2026-01-01')) }));
    await assertFails(post(player(P1), P1, 'p-3', {}, { bump: false }));
    await assertSucceeds(post(player(P1), P1, 'p-4'));
  });
  test('審査中の書き換えはだれもできない。本人は取り下げられる', async () => {
    await seedPending();
    await assertFails(updateDoc(doc(player(P1), 'voicesPending', 'v-new'), { body: '書き換え' }));
    await assertFails(updateDoc(doc(admin(), 'voicesPending', 'v-new'), { body: '書き換え' }));
    await assertFails(deleteDoc(doc(player(P2), 'voicesPending', 'v-new')));
    await assertSucceeds(deleteDoc(doc(player(P1), 'voicesPending', 'v-new')));
  });
  test('遊ぶ人は、承認済み（voices）や審査の記録・運営の印に直接書けない', async () => {
    await assertFails(setDoc(doc(player(P1), 'voices', 'v-direct'), { ...spot(P1), approvedAt: serverTimestamp(), approvedBy: P1 }));
    await assertFails(setDoc(doc(player(P1), 'moderationLog', 'v-direct'), { action: 'approve', by: P1, at: serverTimestamp() }));
    await assertFails(setDoc(doc(player(P1), 'admins', P1), { note: 'x' }));
  });
});

describe('承認と却下（運営）', () => {
  test('文面そのまま・審査待ちを消す・記録を残す、の一括書き込みで承認できる', async () => {
    await seedPending();
    await assertSucceeds(approve(admin(), 'v-new', await pendingData('v-new')));
    await assertSucceeds(getDoc(doc(anon(), 'voices', 'v-new')));
  });
  test('運営でも、スポット名・文面・名前・駅を書き換えて承認することはできない', async () => {
    await seedPending();
    const data = await pendingData('v-new');
    for (const edit of [{ spot: '別の店' }, { body: '運営が書き換えた文' }, { name: '別の名前' }, { stationId: 'beppu' }]) {
      await assertFails(approve(admin(), 'v-new', data, { edit }));
    }
  });
  test('審査待ちを残したまま・記録なし・審査待ちがないものは承認できない。運営でない人は承認できない', async () => {
    await seedPending();
    const data = await pendingData('v-new');
    await assertFails(approve(admin(), 'v-new', data, { removePending: false }));
    await assertFails(approve(admin(), 'v-new', data, { log: false }));
    await assertFails(approve(admin(), 'v-ghost', data));
    await assertFails(approve(player(P2), 'v-new', data));
  });
  test('却下：記録を残して審査待ちを消す。記録なしでは消せない', async () => {
    await seedPending();
    const db = admin();
    await assertFails(deleteDoc(doc(db, 'voicesPending', 'v-new')));
    const b = writeBatch(db);
    b.delete(doc(db, 'voicesPending', 'v-new'));
    b.set(doc(db, 'moderationLog', 'v-new'), { action: 'reject', by: ADMIN, at: serverTimestamp(), reason: '店舗の宣伝のみのため' });
    await assertSucceeds(b.commit());
  });
  test('審査の記録はあとから書き換え・削除できない（運営でも）', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'moderationLog', 'v-old'), { action: 'approve', by: ADMIN, at: Timestamp.now() }));
    await assertFails(updateDoc(doc(admin(), 'moderationLog', 'v-old'), { action: 'reject' }));
    await assertFails(deleteDoc(doc(admin(), 'moderationLog', 'v-old')));
    await assertFails(setDoc(doc(admin(), 'moderationLog', 'v-fake'), { action: 'approve', by: 'someone-else', at: serverTimestamp() }));
  });
  test('承認済みはだれも書き換えられない。本人と運営は取り下げられる', async () => {
    await assertFails(updateDoc(doc(admin(), 'voices', 'v-approved'), { body: '改変' }));
    await assertFails(updateDoc(doc(player(P2), 'voices', 'v-approved'), { body: '改変' }));
    await assertFails(deleteDoc(doc(player(P1), 'voices', 'v-approved')));
    await assertFails(deleteDoc(doc(anon(), 'voices', 'v-approved')));
    await assertSucceeds(deleteDoc(doc(player(P2), 'voices', 'v-approved')));
  });
});

describe('旅の便り（写真）：ログインした人どうしで見せ合う・素敵ね・通報（3件で隠れる）', () => {
  const IMG = 'data:image/jpeg;base64,' + 'A'.repeat(2000);
  const BIG = 'data:image/jpeg;base64,' + 'B'.repeat(200000);
  const card = (uid, st = 'beppu', over = {}) => ({ uid, stationId: st, memo: '湯けむりの朝', thumb: IMG, name: uid === P1 ? 'くまの旅人' : '湯の町の常連', createdAt: serverTimestamp(), updatedAt: serverTimestamp(), likeCount: 0, reportCount: 0, hidden: false, ...over });
  const id = (uid, st = 'beppu') => `${uid}_${st}`;
  async function seedCard(uid = P2, over = {}) {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'postcards', id(uid)), { ...card(uid), createdAt: T0, updatedAt: T0, ...over });
      await setDoc(doc(ctx.firestore(), 'postcardImages', id(uid)), { uid, image: BIG, updatedAt: T0 });
    });
  }
  // 投函：小さな写真のポストカードと、大きな写真を1回の一括書き込みで
  function post(db, uid, { over = {}, image = BIG, withImage = true, st = 'beppu' } = {}) {
    const b = writeBatch(db);
    b.set(doc(db, 'postcards', id(uid, st)), card(uid, st, over));
    if (withImage) b.set(doc(db, 'postcardImages', id(uid, st)), { uid, image, updatedAt: serverTimestamp() });
    return b.commit();
  }
  function likeIt(db, pid, uid, { bump = true, mark = true } = {}) {
    const b = writeBatch(db);
    if (mark) b.set(doc(db, 'postcards', pid, 'likes', uid), { at: serverTimestamp() });
    if (bump) b.update(doc(db, 'postcards', pid), { likeCount: increment(1) });
    return b.commit();
  }
  function report(db, pid, uid, now, { reason = 'face', mark = true } = {}) {
    const b = writeBatch(db);
    if (mark) b.set(doc(db, 'reports', `${uid}_${pid}`), { postcardId: pid, reporter: uid, reason, note: '', createdAt: serverTimestamp() });
    b.update(doc(db, 'postcards', pid), { reportCount: now + 1, hidden: now + 1 >= 3 });
    return b.commit();
  }
  async function cardData(pid) {
    let d;
    await env.withSecurityRulesDisabled(async (ctx) => { d = (await getDoc(doc(ctx.firestore(), 'postcards', pid))).data(); });
    return d;
  }

  test('登録済みの人は、自分の1駅1枚を投函できる。ログインした人は見られる', async () => {
    await assertFails(setDoc(doc(player(P1), 'postcards', id(P1)), card(P1))); // 大きな写真なしでは投函できない
    await assertSucceeds(post(player(P1), P1));
    await assertSucceeds(getDoc(doc(player(P2), 'postcards', id(P1))));
    await assertSucceeds(getDoc(doc(player(P2), 'postcardImages', id(P1))));
    await assertFails(getDocs(collection(player(P2), 'postcardImages'))); // 大きな写真をまとめて読むことはできない（運営だけ）
    await assertFails(getDoc(doc(anon(), 'postcardImages', id(P1))));
    await assertSucceeds(getDocs(query(collection(player(P2), 'postcards'), where('stationId', '==', 'beppu'), where('hidden', '==', false))));
    await assertFails(getDoc(doc(anon(), 'postcards', id(P1))));
  });
  test('他人の名前・他人の番号の文書・名前違い・ゲームにない駅・写真でない・大きすぎ・いいねの水増しは通らない', async () => {
    const db = player(P1);
    await assertFails(post(db, P2));
    await assertFails(post(db, P1, { over: { name: '湯の町の常連' } }));
    await assertFails(post(db, P1, { st: 'tokyo' }));
    await assertFails(post(db, P1, { over: { thumb: 'data:text/html;base64,PHNjcmlwdD4=' } }));
    await assertFails(post(db, P1, { over: { thumb: 'javascript:alert(1)' } }));
    await assertFails(post(db, P1, { over: { thumb: 'data:image/jpeg;base64,' + 'A'.repeat(60000) } })); // 小さな写真は6万字まで
    await assertFails(post(db, P1, { image: 'data:text/html;base64,PHNjcmlwdD4=' }));
    await assertFails(post(db, P1, { image: 'data:image/jpeg;base64,' + 'A'.repeat(500000) }));
    await assertFails(post(db, P1, { over: { likeCount: 99 } }));
    await assertFails(post(db, P1, { over: { memo: 'あ'.repeat(61) } }));
    await assertFails(post(player(NEWBIE), NEWBIE));
    await assertFails(post(unverified(P1), P1));
    // 他人のポストカードの大きな写真を、すり替えることはできない
    await seedCard(P2);
    await assertFails(setDoc(doc(db, 'postcardImages', id(P2)), { uid: P1, image: BIG, updatedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(db, 'postcardImages', id(P2)), { uid: P2, image: BIG, updatedAt: serverTimestamp() }));
    await assertFails(deleteDoc(doc(db, 'postcardImages', id(P2))));
  });
  test('本人は差し替え・削除できる（30秒あける）。いいね・通報・隠れは本人も変えられない。他人は差し替え・削除できない', async () => {
    await seedCard(P1);
    const ref = doc(player(P1), 'postcards', id(P1));
    const db1 = player(P1);
    const swap = () => {
      const b = writeBatch(db1);
      b.update(doc(db1, 'postcards', id(P1)), { memo: '差し替えた一言', thumb: IMG + 'C', updatedAt: serverTimestamp() });
      b.set(doc(db1, 'postcardImages', id(P1)), { uid: P1, image: BIG, updatedAt: serverTimestamp() });
      return b.commit();
    };
    await assertFails(updateDoc(ref, { thumb: IMG + 'B', updatedAt: serverTimestamp() })); // 小さな写真だけ差し替えて、大きな写真をそのままにはできない
    await assertSucceeds(swap());
    await assertFails(updateDoc(ref, { memo: 'すぐもう一度', updatedAt: serverTimestamp() }));
    await env.withSecurityRulesDisabled(async (ctx) => updateDoc(doc(ctx.firestore(), 'postcards', id(P1)), { updatedAt: T0 }));
    await assertFails(updateDoc(ref, { likeCount: 50, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { reportCount: 3, hidden: true, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(player(P2), 'postcards', id(P1)), { memo: 'のっとり', updatedAt: serverTimestamp() }));
    await assertFails(deleteDoc(doc(player(P2), 'postcards', id(P1))));
    await assertSucceeds(deleteDoc(ref));
    await assertSucceeds(deleteDoc(doc(db1, 'postcardImages', id(P1))));
  });
  test('素敵ね：ほかの人は1回だけ1つ増やせる。自分の便り・印なし・2回目・2つ増やすは通らない', async () => {
    await seedCard(P2);
    const pid = id(P2);
    await assertFails(likeIt(player(P2), pid, P2));
    await assertFails(likeIt(player(P1), pid, P1, { mark: false }));
    await assertFails(likeIt(player(P1), pid, P1, { bump: false }));
    await assertSucceeds(likeIt(player(P1), pid, P1));
    await assertFails(likeIt(player(P1), pid, P1));
    const nb = player(NEWBIE);
    const b = writeBatch(nb);
    b.set(doc(nb, 'postcards', pid, 'likes', NEWBIE), { at: serverTimestamp() });
    b.update(doc(nb, 'postcards', pid), { likeCount: increment(2) });
    await assertFails(b.commit());
    if ((await cardData(pid)).likeCount !== 1) throw new Error('いいねの数がずれた');
    await assertFails(getDoc(doc(player(P2), 'postcards', pid, 'likes', P1)));
  });
  test('通報：1人1回。3件そろうと自動で隠れて、ほかの人には見えなくなる（本人と運営には見える）', async () => {
    await seedCard(P2);
    const pid = id(P2);
    await assertFails(report(player(P2), pid, P2, 0));
    await assertFails(report(player(P1), pid, P1, 0, { mark: false }));
    await assertFails(report(player(P1), pid, P1, 0, { reason: 'dislike' }));
    await assertSucceeds(report(player(P1), pid, P1, 0));
    await assertFails(report(player(P1), pid, P1, 1));
    await assertSucceeds(report(player(NEWBIE), pid, NEWBIE, 1));
    // 3件目なのに隠さない（hidden: false のまま）書き込みは通らない
    const px = player('p-x');
    const bx = writeBatch(px);
    bx.set(doc(px, 'reports', `p-x_${pid}`), { postcardId: pid, reporter: 'p-x', reason: 'private', note: '', createdAt: serverTimestamp() });
    bx.update(doc(px, 'postcards', pid), { reportCount: 3, hidden: false });
    await assertFails(bx.commit());
    await assertSucceeds(report(player('p-y'), pid, 'p-y', 2));
    await assertFails(getDoc(doc(player(P1), 'postcards', pid)));
    await assertFails(getDoc(doc(player(P1), 'postcardImages', pid))); // 隠れた写真は、大きな写真も見えない
    await assertSucceeds(getDoc(doc(player(P2), 'postcardImages', pid)));
    await assertSucceeds(getDoc(doc(admin(), 'postcardImages', pid)));
    await assertFails(getDocs(query(collection(player(P1), 'postcards'), where('stationId', '==', 'beppu'))));
    await assertSucceeds(getDoc(doc(player(P2), 'postcards', pid)));
    await assertSucceeds(getDoc(doc(admin(), 'postcards', pid)));
    await assertFails(getDocs(collection(player(P1), 'reports')));
    await assertSucceeds(getDocs(collection(admin(), 'reports')));
  });
  test('運営は「問題なし」で戻すか、消せる。遊ぶ人は通報を0に戻せない', async () => {
    await seedCard(P2, { reportCount: 3, hidden: true });
    const pid = id(P2);
    await assertFails(updateDoc(doc(player(P2), 'postcards', pid), { reportCount: 0, hidden: false }));
    await assertSucceeds(updateDoc(doc(admin(), 'postcards', pid), { reportCount: 0, hidden: false }));
    await assertSucceeds(getDoc(doc(player(P1), 'postcards', pid)));
    await assertSucceeds(deleteDoc(doc(admin(), 'postcards', pid)));
    await assertSucceeds(deleteDoc(doc(admin(), 'postcardImages', pid)));
  });
  test('一覧は新しい順に少しずつ読める（隠れていないものだけ）', async () => {
    await seedCard(P2);
    await assertSucceeds(getDocs(query(collection(player(P1), 'postcards'), where('hidden', '==', false), orderBy('updatedAt', 'desc'), limit(20))));
    await assertSucceeds(getDocs(query(collection(player(P1), 'postcards'), where('stationId', '==', 'beppu'), where('hidden', '==', false), orderBy('updatedAt', 'desc'), limit(12))));
    await assertFails(getDocs(query(collection(player(P1), 'postcards'), orderBy('updatedAt', 'desc'), limit(20))));
  });
});
