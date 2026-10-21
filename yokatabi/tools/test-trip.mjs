#!/usr/bin/env node
// マイ旅しおり（js/trip.js）のモデルコース生成を検証する。
//   node tools/test-trip.mjs
// - 買収駅が足りないときは提案しない
// - どの2駅の組み合わせでもコースが作れるか（作れない組み合わせは一覧で出す）
// - すべてのプランが時間割（1日目の出発〜2日目の解散）に収まり、時刻が前後しないか
// - 全駅を買収した状態でも十分速く計算できるか
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ctx = { window: {}, console };
vm.createContext(ctx);
for (const f of ['js/data.js', 'js/trip.js']) vm.runInContext(readFileSync(resolve(root, f), 'utf8'), ctx, { filename: f });
const { Data, Trip } = ctx.window.YT;
const D = Data.index(JSON.parse(readFileSync(resolve(root, 'stations.json'), 'utf8')), 'test');
const cfg = D.meta.trip;
const toMin = (s) => (s === '夜' ? null : Number(s.slice(0, 2)) * 60 + Number(s.slice(3)));

let failures = 0;
const fail = (msg) => {
  failures++;
  console.error('  ✗ ' + msg);
};

function checkPlan(p, acquired, label) {
  const ids = new Set(acquired);
  p.visits.forEach((id) => ids.has(id) || fail(`${label}: 未買収の駅 ${id} を巡っている`));
  if (new Set(p.visits).size !== p.visits.length) fail(`${label}: 同じ駅を二度巡っている`);
  if (!ids.has(p.overnight)) fail(`${label}: 泊まる駅 ${p.overnight} が買収駅ではない`);
  if (!D.byId[p.seq.g1].gateway || !D.byId[p.seq.g2].gateway) fail(`${label}: 出発・解散が gateway ではない`);
  const [d1, d2] = p.days;
  const first = toMin(d1.items[0].time);
  if (first !== toMin(cfg.day1Start)) fail(`${label}: 1日目の出発が ${d1.items[0].time}`);
  const end = d2.items[d2.items.length - 1];
  if (end.kind !== 'end' || toMin(end.time) > toMin(cfg.day2End)) fail(`${label}: 2日目の解散が ${end.time}（${cfg.day2End} まで）`);
  for (const day of p.days) {
    let last = -1;
    for (const it of day.items) {
      const t = toMin(it.time ?? it.depart);
      if (t === null) continue;
      if (t < last) fail(`${label}: ${day.label} の時刻が前後している（${it.time ?? it.depart}）`);
      last = toMin(it.until ?? it.arrive ?? it.time) ?? t;
    }
  }
  const stayAt = d1.items.filter((i) => i.kind === 'stop').pop();
  if (toMin(stayAt.until) > toMin(cfg.day1End) + 60) fail(`${label}: 1日目の最後の観光が ${stayAt.until} まで続く`);
}

console.log('1) 買収駅が1駅のときは提案しない');
const one = Trip.generate(D, ['hakata']);
if (one.plans.length || one.reason !== 'few' || one.need !== 1) fail('1駅でもプランが出ている');

console.log('2) すべての2駅の組み合わせ');
const ids = D.stations.map((s) => s.id);
const far = [];
let pairs = 0;
for (let i = 0; i < ids.length; i++) {
  for (let j = i + 1; j < ids.length; j++) {
    pairs++;
    const acq = [ids[i], ids[j]];
    const r = Trip.generate(D, acq);
    if (!r.plans.length) far.push(acq.join('+'));
    r.plans.forEach((p, k) => checkPlan(p, acq, `${acq.join('+')} プラン${k + 1}`));
    if (r.plans.length > 1 && r.plans.some((p) => p.visits.length < r.plans[0].visits.length)) fail(`${acq.join('+')}: 巡る駅の少ないプランが混ざっている`);
    if (r.plans[0] && r.plans[0].visits.length < 2) far.push(`${acq.join('+')}（1駅のみ）`);
  }
}
console.log(`   ${pairs}組中、両方を1泊2日で巡れない組み合わせ ${far.length}組`);
if (far.length) console.log('   ' + far.join(' / '));

console.log('3) 全駅を買収した状態');
const t0 = Date.now();
const all = Trip.generate(D, ids);
const ms = Date.now() - t0;
console.log(`   ${all.plans.length}プラン・${ms}ms`);
all.plans.forEach((p, k) => {
  checkPlan(p, ids, `全駅 プラン${k + 1}`);
  console.log(`   - ${p.title}：${p.visits.map((id) => D.byId[id].name).join('→')}（移動 ${p.moved}）`);
});
if (all.plans.length !== 3) fail('全駅買収で3プラン出ていない');
if (new Set(all.plans.map((p) => p.overnight)).size !== all.plans.length) fail('3プランの泊まる駅が重なっている');
if (ms > 3000) fail(`計算に ${ms}ms かかっている`);

console.log('4) 保存した道順から同じ旅程を組み立て直せる');
const rebuilt = Trip.build(D, null, all.plans[0].seq);
if (JSON.stringify(rebuilt.days) !== JSON.stringify(all.plans[0].days)) fail('build() の再構成が一致しない');

if (failures) {
  console.error(`\n${failures}件の失敗`);
  process.exit(1);
}
console.log('\nOK: すべての検証に通りました');
