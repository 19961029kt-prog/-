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
  if (len < 100 || len > 150) errors.push(`${s.id}: memo が ${len} 文字です（100〜150文字）`);
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
