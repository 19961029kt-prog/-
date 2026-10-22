#!/usr/bin/env node
// stations.json から js/stations-fallback.js を生成する。
// file:// で開かれて fetch() が失敗した場合に使う「同一データ」を、手書きせず必ずここから作る。
//
//   node tools/build-fallback.mjs          … 生成（上書き）
//   node tools/build-fallback.mjs --check  … 差分があれば exit 1（CI・コミット前チェック用）
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = resolve(root, 'stations.json');
const out = resolve(root, 'js/stations-fallback.js');

const data = JSON.parse(readFileSync(src, 'utf8'));

// 最低限のスキーマ検証：壊れたデータをフォールバックに焼き込まない
const ids = new Set(data.stations.map((s) => s.id));
const errors = [];
for (const s of data.stations) {
  for (const key of ['id', 'name', 'prefecture', 'x', 'y', 'connections', 'assetValue', 'memo', 'products', 'stay']) {
    if (s[key] === undefined) errors.push(`${s.id ?? '?'}: ${key} がありません`);
  }
  const len = [...(s.memo ?? '')].length;
  if (len < 120 || len > 200) errors.push(`${s.id}: memo が ${len} 文字です（120〜200文字）`);
  for (const c of s.connections ?? []) {
    if (!ids.has(c)) errors.push(`${s.id}: 接続先 ${c} が存在しません`);
    else if (!data.stations.find((t) => t.id === c).connections.includes(s.id)) {
      errors.push(`${s.id} ⇄ ${c}: 接続が片方向です`);
    }
  }
}
const types = Object.keys(data.routeTypes ?? {});
for (const o of data.routeOverrides ?? []) {
  const label = (o.between ?? []).join(' ⇄ ');
  if (!o.between || o.between.length !== 2 || !o.between.every((id) => ids.has(id))) {
    errors.push(`routeOverrides ${label}: 駅IDが正しくありません`);
  } else if (!data.stations.find((s) => s.id === o.between[0]).connections.includes(o.between[1])) {
    errors.push(`routeOverrides ${label}: connections に存在しない区間です`);
  }
  if (o.type && !types.includes(o.type)) errors.push(`routeOverrides ${label}: 不明な路線種別 ${o.type}`);
  if (!(o.minutes > 0)) errors.push(`routeOverrides ${label}: 所要時間 minutes（分）がありません`);
}
// マイ旅しおり用：駅ごとの過ごし方と滞在時間
for (const s of data.stations) {
  const p = s.plan ?? {};
  if (!(p.minutes > 0) || !p.day || !p.evening || !p.morning) {
    errors.push(`${s.id}: plan（minutes・day・evening・morning）がそろっていません`);
  }
}
// 称号：0万円から始まり、しきい値が昇順で、全駅買収で最上位に届くこと
const ranks = data.meta.ranks ?? [];
const total = data.stations.reduce((n, s) => n + s.assetValue, 0);
if (!ranks.length || ranks[0].min !== 0) errors.push('meta.ranks の最初の称号は min: 0 にしてください');
ranks.forEach((r, i) => {
  if (!r.id || !r.title || !r.metal) errors.push(`meta.ranks[${i}]: id・title・metal がそろっていません`);
  if (i && !(r.min > ranks[i - 1].min)) errors.push(`meta.ranks[${i}] ${r.title}: min が昇順になっていません`);
});
if (ranks.length && ranks[ranks.length - 1].min > total) errors.push(`最上位の称号（${ranks[ranks.length - 1].min}万円）に全駅買収（${total}万円）でも届きません`);
if (!data.stations.some((s) => s.gateway)) errors.push('gateway（旅の出発・到着地）を持つ駅がありません');
// オーナー権：立候補届をひらくまでの秒数・下克上ボーナス・共同株主の人数・ショップの見分け方
const owner = data.meta.owner ?? {};
if (!(owner.minAwaySeconds > 0)) errors.push('meta.owner.minAwaySeconds（立候補届をひらくまでの秒数）がありません');
if (!(owner.upsetBonus >= 1)) errors.push('meta.owner.upsetBonus（下克上ボーナスの倍率、1以上）がありません');
if (!(owner.shareholders >= 1)) errors.push('meta.owner.shareholders（共同株主の人数）がありません');
if (!(owner.maxAmount > 0)) errors.push('meta.owner.maxAmount（1回に記録できる金額の上限）がありません');
for (const sh of owner.shops ?? []) {
  try {
    new RegExp(sh.match, 'i');
  } catch (e) {
    errors.push(`meta.owner.shops ${sh.id}: match が正規表現になっていません`);
  }
}
if (!(owner.shops ?? []).length) errors.push('meta.owner.shops（レシートから見分けるショップ）がありません');
// ライバル旅人：駅ごとに、いる旅人のIDで、金額は正の数・重複なし・共同株主の人数以上
const rivalIds = new Set((data.meta.rivals ?? []).map((r) => r.id));
for (const s of data.stations) {
  const rv = s.rivals ?? [];
  if (rv.length < (owner.shareholders ?? 3)) errors.push(`${s.id}: rivals（ライバル旅人の実績）が ${owner.shareholders} 人ぶんありません`);
  if (new Set(rv.map((r) => r.id)).size !== rv.length) errors.push(`${s.id}: rivals に同じ旅人が2回出ています`);
  rv.forEach((r) => {
    if (!rivalIds.has(r.id)) errors.push(`${s.id}: rivals の ${r.id} が meta.rivals にいません`);
    if (!(r.amount > 0)) errors.push(`${s.id}: rivals ${r.id} の amount がありません`);
  });
}
// クラフト工房：装備欄ごとに、0円の初期装備がちょうど1つ・IDが重複しない・価格は0以上
// （初期装備のIDは js/store.js の equipped の初期値と同じであること）
const craft = data.meta.craft ?? {};
const DEFAULT_EQUIP = { livery: 'hidamari', carriage: 'none', trail: 'puff', hat: 'straw', outfit: 'canvas', buddy: 'none' };
if (!(craft.discoveryBonus > 0)) errors.push('meta.craft.discoveryBonus（発見ボーナス）がありません');
for (const sec of [...(craft.train ?? []), ...(craft.avatar ?? [])]) {
  const items = sec.items ?? [];
  const free = items.filter((i) => i.price === 0);
  if (free.length !== 1) errors.push(`meta.craft ${sec.slot}: 0円の初期装備がちょうど1つではありません`);
  else if (DEFAULT_EQUIP[sec.slot] !== free[0].id) errors.push(`meta.craft ${sec.slot}: 初期装備 ${free[0].id} が store.js の初期値 ${DEFAULT_EQUIP[sec.slot]} と違います`);
  if (new Set(items.map((i) => i.id)).size !== items.length) errors.push(`meta.craft ${sec.slot}: ID が重複しています`);
  items.forEach((i) => !(i.price >= 0 && i.name) && errors.push(`meta.craft ${sec.slot}/${i.id}: name・price がそろっていません`));
}
for (const slot of Object.keys(DEFAULT_EQUIP)) {
  if (![...(craft.train ?? []), ...(craft.avatar ?? [])].some((s) => s.slot === slot)) errors.push(`meta.craft に装備欄 ${slot} がありません`);
}
// 経済の定数（旅の便り・いいね・シェア）と、オーナーの配当の割合
for (const k of ['postBonus', 'likeGivenBonus', 'likeReceivedBonus', 'likeReceivedMax', 'shareBonus']) if (!(craft[k] > 0)) errors.push(`meta.craft.${k} がありません`);
if (!Array.isArray(owner.dividendRates) || owner.dividendRates.length < (owner.shareholders ?? 3)) errors.push('meta.owner.dividendRates（1位から順の配当の割合）が共同株主の人数ぶんありません');
// ライバル旅人のアバター：工房にあるパーツのID
const itemIds = (slot) => new Set([...(craft.train ?? []), ...(craft.avatar ?? [])].find((s) => s.slot === slot)?.items.map((i) => i.id) ?? []);
for (const r of data.meta.rivals ?? []) {
  for (const slot of ['hat', 'outfit', 'buddy', 'livery']) if (r.avatar && !itemIds(slot).has(r.avatar[slot])) errors.push(`meta.rivals ${r.id}: avatar.${slot} の ${r.avatar[slot]} が工房にありません`);
}
// 駅の階層（3段階のセマンティック・ズームで、駅名を出し始める倍率が変わる）
for (const s of data.stations) if (!['hub', 'tourist', 'local'].includes(s.stationTier)) errors.push(`${s.id}: stationTier が hub/tourist/local のどれでもありません`);
// 地域テーマ：ご当地の車窓と演出（js/scenery.js）
const THEMES = new Set(['onsen', 'volcano', 'ocean', 'forest', 'city']);
for (const s of data.stations) if (!THEMES.has(s.regionTheme)) errors.push(`${s.id}: regionTheme が ${[...THEMES].join('/')} のどれでもありません`);
// 旅人たちのポストカード（架空・初期データ）
const SCENES = new Set(['steam', 'sea', 'mountain', 'volcano', 'forest', 'city', 'pottery', 'shrine', 'sunset', 'night', 'food', 'train']);
(data.postcards ?? []).forEach((p, i) => {
  if (!ids.has(p.stationId)) errors.push(`postcards[${i}]: 駅 ${p.stationId} がありません`);
  if (!rivalIds.has(p.rivalId)) errors.push(`postcards[${i}]: 旅人 ${p.rivalId} が meta.rivals にいません`);
  if (!p.comment || [...p.comment].length > 60) errors.push(`postcards[${i}]: comment（60文字まで）がありません`);
  if (!SCENES.has(p.scene)) errors.push(`postcards[${i}]: scene ${p.scene} は絵がありません`);
  if (!(p.likes >= 0)) errors.push(`postcards[${i}]: likes がありません`);
});
// 旅のゲーム（js/game.js）：切符・ライン・スポットライト駅のご祝儀
const game = data.meta.game ?? {};
if (!(game.deckMax > 0 && game.settleEvery > 0)) errors.push('meta.game の deckMax・settleEvery がありません');
if (!(game.spotlight && game.spotlight.rewardMax >= game.spotlight.rewardMin && game.spotlight.minHops >= 1)) errors.push('meta.game.spotlight（minHops・rewardMin・rewardMax）がそろっていません');
for (const t of game.tickets ?? []) if (!t.id || !t.name || !(t.price > 0) || !(t.weight > 0) || !(t.pick || t.dice >= 2)) errors.push(`meta.game.tickets ${t.id}: id・name・price・weight・dice（2以上）か pick がそろっていません`);
if (!(game.tickets ?? []).some((t) => t.rare)) errors.push('meta.game.tickets にレア切符（rare: true）がありません（ご祝儀で配る）');
const inLines = (game.lines ?? []).flatMap((l) => l.stations);
for (const id of inLines) if (!ids.has(id)) errors.push(`meta.game.lines: 駅 ${id} がありません`);
if (new Set(inLines).size !== inLines.length) errors.push('meta.game.lines: 同じ駅が2つのラインに入っています');
if (errors.length) {
  console.error('stations.json の検証に失敗しました:\n  ' + errors.join('\n  '));
  process.exit(1);
}

const body =
  '// 自動生成ファイル：直接編集しないこと。stations.json を編集して\n' +
  '//   node tools/build-fallback.mjs\n' +
  '// を実行すると再生成されます。\n' +
  'window.YOKATABI_FALLBACK_DATA = ' + JSON.stringify(data, null, 2) + ';\n';

if (process.argv.includes('--check')) {
  const current = existsSync(out) ? readFileSync(out, 'utf8') : '';
  if (current !== body) {
    console.error('js/stations-fallback.js が stations.json と一致しません。node tools/build-fallback.mjs を実行してください。');
    process.exit(1);
  }
  console.log('OK: フォールバックデータは stations.json と一致しています');
} else {
  writeFileSync(out, body);
  console.log(`生成しました: js/stations-fallback.js（${data.stations.length}駅）`);
}
