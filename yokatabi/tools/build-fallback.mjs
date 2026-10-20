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
