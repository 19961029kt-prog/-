// Firebase の SDK（ブラウザ用の ESM ビルド）を、サイトの中（js/vendor/firebase-<版>/）に写す。
// 実行時に Google の CDN から読まないので、サイトで動くコードはすべてこのリポジトリにあるものだけになる。
// 使い方：cd yokatabi/firebase && npm install && cd .. && node tools/vendor-firebase.mjs
// 版は firebase/package.json の devDependencies.firebase（固定）に合わせる。
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkgDir = join(root, 'firebase', 'node_modules', 'firebase');
const version = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8')).version;
const want = JSON.parse(readFileSync(join(root, 'firebase', 'package.json'), 'utf8')).devDependencies.firebase;
if (version !== want) throw new Error(`firebase の版が package.json（${want}）と違います：${version}`);

// 使うものだけ：アプリ・App Check・ログイン・Firestore（軽い lite 版。リアルタイム購読は使わない）
const FILES = ['firebase-app.js', 'firebase-app-check.js', 'firebase-auth.js', 'firebase-firestore-lite.js'];
const out = join(root, 'js', 'vendor', `firebase-${version}`);
if (existsSync(join(root, 'js', 'vendor'))) rmSync(join(root, 'js', 'vendor'), { recursive: true });
mkdirSync(out, { recursive: true });
const cdn = `https://www.gstatic.com/firebasejs/${version}/`;
for (const f of FILES) {
  let src = readFileSync(join(pkgDir, f), 'utf8');
  src = src.split(cdn).join('./'); // CDN の参照を、同じフォルダの写しに向ける
  src = src.replace(/\n?\/\/# sourceMappingURL=.*$/m, '');
  if (/https:\/\/www\.gstatic\.com\/firebasejs\//.test(src)) throw new Error(`${f} に CDN の参照が残っています`);
  writeFileSync(join(out, f), src);
}
writeFileSync(join(out, 'LICENSE.txt'), `Firebase JavaScript SDK ${version}\nCopyright Google LLC\nLicensed under the Apache License, Version 2.0 (https://www.apache.org/licenses/LICENSE-2.0)\nこのフォルダは tools/vendor-firebase.mjs が npm の firebase パッケージから写したもの。手で編集しない。\n`);
console.log(`写しました：js/vendor/firebase-${version}/（${FILES.join('・')}）`);
