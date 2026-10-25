// 「地元の人の声」の Security Rules を、ローカルの Firestore エミュレーターで確かめる。
// 実行：cd yokatabi/firebase && npm test（firebase emulators:exec がエミュレーターを立ててから node --test を走らせる）
// 本物の Firebase プロジェクトには一切つながない（projectId は demo- で始まる、エミュレーター専用の名前）。
import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, test } from 'node:test';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { Timestamp, collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';

let env;
const ADMIN = 'admin-1', LOCAL = 'local-beppu', LOCAL2 = 'local-yufuin', TRAVELER = 'traveler-1', STOPPED = 'local-stopped';
const LOCAL_PROFILE = { name: '湯けむり商店', title: '別府の土産物店', stationIds: ['beppu'] };

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-qtrip',
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
after(async () => env && env.cleanup());

// 毎回まっさらにして、運営1人・地元の人3人（1人は停止中）・承認済みの声1件を、ルールを通さずに置く
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const consentAt = Timestamp.fromDate(new Date('2026-10-01T00:00:00Z'));
    await setDoc(doc(db, 'admins', ADMIN), { note: 'コンソールから登録' });
    await setDoc(doc(db, 'contributors', LOCAL), { ...LOCAL_PROFILE, active: true, consentAt });
    await setDoc(doc(db, 'contributors', LOCAL2), { name: '高原の宿', title: '由布院の宿', stationIds: ['yufuin'], active: true, consentAt });
    await setDoc(doc(db, 'contributors', STOPPED), { name: '休止中の人', title: '', stationIds: ['beppu'], active: false, consentAt });
    await setDoc(doc(db, 'voices', 'v-approved'), { uid: LOCAL2, stationId: 'yufuin', body: '朝霧の金鱗湖は、少し早起きして。', name: '高原の宿', title: '由布院の宿', createdAt: consentAt, approvedAt: consentAt, approvedBy: ADMIN });
  });
});

const as = (uid) => env.authenticatedContext(uid).firestore();
const anon = () => env.unauthenticatedContext().firestore();
const newVoice = (uid, over = {}) => ({ uid, stationId: 'beppu', body: '路地の湯けむりの向こうに、昔ながらの共同湯があります。', name: LOCAL_PROFILE.name, title: LOCAL_PROFILE.title, createdAt: serverTimestamp(), ...over });
// 投稿は「審査待ちの作成」と「名簿の lastPostAt を今に」を1回の一括書き込みで行う（アプリも同じ形にする）
function post(db, uid, id, over = {}, { bump = true } = {}) {
  const b = writeBatch(db);
  b.set(doc(db, 'voicesPending', id), newVoice(uid, over));
  if (bump) b.update(doc(db, 'contributors', uid), { lastPostAt: serverTimestamp() });
  return b.commit();
}
async function seedPending(id = 'v-new', uid = LOCAL) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'voicesPending', id), { ...newVoice(uid), createdAt: Timestamp.fromDate(new Date('2026-10-20T00:00:00Z')) });
  });
}
async function pendingData(id) {
  let data;
  await env.withSecurityRulesDisabled(async (ctx) => { data = (await getDoc(doc(ctx.firestore(), 'voicesPending', id))).data(); });
  return data;
}
// 承認：審査待ちの文面をそのまま voices へ写し、審査待ちを消し、審査の記録を残す（1回の一括書き込み）
function approve(db, id, data, { log = true, removePending = true, edit = {} } = {}) {
  const b = writeBatch(db);
  b.set(doc(db, 'voices', id), { ...data, ...edit, approvedAt: serverTimestamp(), approvedBy: ADMIN });
  if (removePending) b.delete(doc(db, 'voicesPending', id));
  if (log) b.set(doc(db, 'moderationLog', id), { action: 'approve', by: ADMIN, at: serverTimestamp() });
  return b.commit();
}

describe('だれでも読めるのは承認済みだけ', () => {
  test('ログインしていない旅人も、承認済みの声は読める', async () => {
    await assertSucceeds(getDoc(doc(anon(), 'voices', 'v-approved')));
    await assertSucceeds(getDocs(collection(anon(), 'voices')));
  });
  test('審査待ちは、ログインしていない旅人にもほかの旅人にも見えない', async () => {
    await seedPending();
    await assertFails(getDoc(doc(anon(), 'voicesPending', 'v-new')));
    await assertFails(getDoc(doc(as(TRAVELER), 'voicesPending', 'v-new')));
    await assertFails(getDocs(collection(as(TRAVELER), 'voicesPending')));
    await assertFails(getDoc(doc(as(LOCAL2), 'voicesPending', 'v-new')));
  });
  test('名簿・運営の一覧・審査の記録は、一般の旅人には見えない', async () => {
    await assertFails(getDoc(doc(as(TRAVELER), 'contributors', LOCAL)));
    await assertFails(getDocs(collection(as(TRAVELER), 'contributors')));
    await assertFails(getDoc(doc(as(TRAVELER), 'admins', ADMIN)));
    await assertFails(getDocs(collection(as(ADMIN), 'admins')));
    await assertFails(getDocs(collection(as(TRAVELER), 'moderationLog')));
  });
  test('ルールに書いていないコレクションは、だれも読み書きできない', async () => {
    await assertFails(getDoc(doc(as(ADMIN), 'secrets', 'x')));
    await assertFails(setDoc(doc(as(ADMIN), 'anything', 'x'), { a: 1 }));
  });
});

describe('投稿できるのは、登録された地元の人だけ', () => {
  test('登録された地元の人は、担当の駅に投稿できる', async () => {
    await assertSucceeds(post(as(LOCAL), LOCAL, 'v-new'));
  });
  test('登録されていない旅人・ログインしていない人は投稿できない', async () => {
    await assertFails(post(as(TRAVELER), TRAVELER, 'v-x', {}, { bump: false }));
    await assertFails(setDoc(doc(anon(), 'voicesPending', 'v-y'), newVoice('nobody')));
  });
  test('停止された地元の人は投稿できない', async () => {
    await assertFails(post(as(STOPPED), STOPPED, 'v-s', { name: '休止中の人', title: '' }));
  });
  test('担当でない駅には投稿できない', async () => {
    await assertFails(post(as(LOCAL), LOCAL, 'v-new', { stationId: 'yufuin' }));
  });
  test('名前・肩書き・投稿者を偽れない', async () => {
    await assertFails(post(as(LOCAL), LOCAL, 'v-1', { name: '公式観光協会' }));
    await assertFails(post(as(LOCAL), LOCAL, 'v-2', { title: '観光大使' }));
    await assertFails(post(as(LOCAL), LOCAL, 'v-3', { uid: LOCAL2 }));
  });
  test('本文は1〜400文字。余計な項目・時刻の偽装は通らない', async () => {
    await assertSucceeds(post(as(LOCAL), LOCAL, 'v-400', { body: 'あ'.repeat(400) }));
    await env.withSecurityRulesDisabled(async (ctx) => updateDoc(doc(ctx.firestore(), 'contributors', LOCAL), { lastPostAt: Timestamp.fromDate(new Date('2026-01-01')) }));
    await assertFails(post(as(LOCAL), LOCAL, 'v-401', { body: 'あ'.repeat(401) }));
    await assertFails(post(as(LOCAL), LOCAL, 'v-empty', { body: '' }));
    await assertFails(post(as(LOCAL), LOCAL, 'v-extra', { approvedBy: ADMIN }));
    await assertFails(post(as(LOCAL), LOCAL, 'v-time', { createdAt: Timestamp.fromDate(new Date('2020-01-01')) }));
    await assertFails(post(as(LOCAL), LOCAL, 'v-html', { body: 123 }));
  });
  test('連投の歯止め：60秒以内の2件目と、lastPostAt を更新しない投稿は通らない', async () => {
    await assertSucceeds(post(as(LOCAL), LOCAL, 'v-a'));
    await assertFails(post(as(LOCAL), LOCAL, 'v-b'));
    await env.withSecurityRulesDisabled(async (ctx) => updateDoc(doc(ctx.firestore(), 'contributors', LOCAL), { lastPostAt: Timestamp.fromDate(new Date('2026-01-01')) }));
    await assertFails(post(as(LOCAL), LOCAL, 'v-c', {}, { bump: false }));
    await assertSucceeds(post(as(LOCAL), LOCAL, 'v-d'));
  });
  test('地元の人は、名簿の自分の項目を lastPostAt 以外は書き換えられない', async () => {
    await assertFails(updateDoc(doc(as(LOCAL), 'contributors', LOCAL), { stationIds: ['beppu', 'yufuin'] }));
    await assertFails(updateDoc(doc(as(LOCAL), 'contributors', LOCAL), { name: '公式観光協会', lastPostAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(as(LOCAL), 'contributors', LOCAL2), { lastPostAt: serverTimestamp() }));
    await assertFails(setDoc(doc(as(TRAVELER), 'contributors', TRAVELER), { ...LOCAL_PROFILE, active: true, consentAt: Timestamp.now() }));
  });
  test('地元の人が、承認済み（voices）や審査の記録に直接書くことはできない', async () => {
    await assertFails(setDoc(doc(as(LOCAL), 'voices', 'v-direct'), { ...newVoice(LOCAL), approvedAt: serverTimestamp(), approvedBy: LOCAL }));
    await assertFails(setDoc(doc(as(LOCAL), 'moderationLog', 'v-direct'), { action: 'approve', by: LOCAL, at: serverTimestamp() }));
    await assertFails(setDoc(doc(as(LOCAL), 'admins', LOCAL), { note: 'x' }));
  });
});

describe('審査待ちの扱い', () => {
  test('投稿した本人は、自分の審査待ちを読める（uid で絞った問い合わせも）', async () => {
    await seedPending();
    await assertSucceeds(getDoc(doc(as(LOCAL), 'voicesPending', 'v-new')));
    await assertSucceeds(getDocs(query(collection(as(LOCAL), 'voicesPending'), where('uid', '==', LOCAL))));
    await assertFails(getDocs(collection(as(LOCAL), 'voicesPending'))); // 絞らない一覧は他人の分を含みうるので不可
  });
  test('審査中の書き換えはだれもできない。本人は取り下げられる', async () => {
    await seedPending();
    await assertFails(updateDoc(doc(as(LOCAL), 'voicesPending', 'v-new'), { body: '書き換え' }));
    await assertFails(updateDoc(doc(as(ADMIN), 'voicesPending', 'v-new'), { body: '書き換え' }));
    await assertFails(deleteDoc(doc(as(LOCAL2), 'voicesPending', 'v-new')));
    await assertSucceeds(deleteDoc(doc(as(LOCAL), 'voicesPending', 'v-new')));
  });
});

describe('承認と却下（運営）', () => {
  test('文面そのまま・審査待ちを消す・記録を残す、の一括書き込みで承認できる', async () => {
    await seedPending();
    const data = await pendingData('v-new');
    await assertSucceeds(approve(as(ADMIN), 'v-new', data));
    await assertSucceeds(getDoc(doc(anon(), 'voices', 'v-new')));
  });
  test('運営でも、文面や名前を書き換えて承認することはできない', async () => {
    await seedPending();
    const data = await pendingData('v-new');
    await assertFails(approve(as(ADMIN), 'v-new', data, { edit: { body: '運営が書き換えた文' } }));
    await assertFails(approve(as(ADMIN), 'v-new', data, { edit: { name: '別の名前' } }));
    await assertFails(approve(as(ADMIN), 'v-new', data, { edit: { stationId: 'yufuin' } }));
  });
  test('審査待ちを残したまま・記録なし・審査待ちがないものは承認できない', async () => {
    await seedPending();
    const data = await pendingData('v-new');
    await assertFails(approve(as(ADMIN), 'v-new', data, { removePending: false }));
    await assertFails(approve(as(ADMIN), 'v-new', data, { log: false }));
    await assertFails(approve(as(ADMIN), 'v-ghost', data));
  });
  test('運営でない人は承認できない', async () => {
    await seedPending();
    const data = await pendingData('v-new');
    await assertFails(approve(as(LOCAL), 'v-new', data));
    await assertFails(approve(as(TRAVELER), 'v-new', data));
  });
  test('却下：記録を残して審査待ちを消す。記録なしでは消せない', async () => {
    await seedPending();
    await assertFails(deleteDoc(doc(as(ADMIN), 'voicesPending', 'v-new')));
    const db = as(ADMIN);
    const b = writeBatch(db);
    b.delete(doc(db, 'voicesPending', 'v-new'));
    b.set(doc(db, 'moderationLog', 'v-new'), { action: 'reject', by: ADMIN, at: serverTimestamp(), reason: '店舗の宣伝のみのため' });
    await assertSucceeds(b.commit());
  });
  test('審査の記録はあとから書き換え・削除できない（運営でも）', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'moderationLog', 'v-old'), { action: 'approve', by: ADMIN, at: Timestamp.now() }));
    await assertFails(updateDoc(doc(as(ADMIN), 'moderationLog', 'v-old'), { action: 'reject' }));
    await assertFails(deleteDoc(doc(as(ADMIN), 'moderationLog', 'v-old')));
    await assertFails(setDoc(doc(as(ADMIN), 'moderationLog', 'v-fake'), { action: 'approve', by: 'someone-else', at: serverTimestamp() }));
  });
  test('承認済みはだれも書き換えられない。本人と運営は取り下げられる', async () => {
    await assertFails(updateDoc(doc(as(ADMIN), 'voices', 'v-approved'), { body: '改変' }));
    await assertFails(updateDoc(doc(as(LOCAL2), 'voices', 'v-approved'), { body: '改変' }));
    await assertFails(deleteDoc(doc(as(LOCAL), 'voices', 'v-approved')));
    await assertFails(deleteDoc(doc(as(TRAVELER), 'voices', 'v-approved')));
    await assertSucceeds(deleteDoc(doc(as(LOCAL2), 'voices', 'v-approved')));
  });
  test('運営は名簿に地元の人を登録・停止できる。形の崩れた登録は通らない', async () => {
    const consentAt = Timestamp.now();
    await assertSucceeds(setDoc(doc(as(ADMIN), 'contributors', 'local-new'), { name: '港の食堂', title: '桜島の食堂', stationIds: ['sakurajima'], active: true, consentAt }));
    await assertSucceeds(updateDoc(doc(as(ADMIN), 'contributors', 'local-new'), { active: false }));
    await assertFails(setDoc(doc(as(ADMIN), 'contributors', 'local-bad'), { name: '', title: '', stationIds: [], active: true, consentAt }));
    await assertFails(setDoc(doc(as(ADMIN), 'contributors', 'local-bad2'), { name: 'x', title: '', stationIds: ['a'], active: 'yes', consentAt }));
  });
});
