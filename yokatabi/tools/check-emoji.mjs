// 絵文字ゼロの検査：画面に出るファイル（HTML・CSS・JS・stations.json）に、OS の絵文字になりうる字が1つもないことを確かめる。
// アイコンはすべて js/icons.js の線画で描く決まり（CLAUDE.md「装丁」）。node tools/check-emoji.mjs で、見つかれば失敗する。
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// 絵文字として描かれうる字（Extended_Pictographic）と、絵文字の異体字セレクタ・結合子・肌色・旗の字
const EMOJI = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{1F3FB}-\u{1F3FF}\u{1F1E6}-\u{1F1FF}\u{20E3}]/u;
const files = ['index.html', 'stations.json', ...readdirSync(join(root, 'css')).map((f) => `css/${f}`), ...readdirSync(join(root, 'js')).filter((f) => f.endsWith('.js') && f !== 'geo.js' && f !== 'stations-fallback.js').map((f) => `js/${f}`)];
let found = 0;
for (const f of files) {
  readFileSync(join(root, f), 'utf8').split('\n').forEach((line, i) => {
    for (const ch of line) {
      if (EMOJI.test(ch)) {
        found++;
        if (found <= 60) console.log(`${f}:${i + 1}  ${ch}  U+${ch.codePointAt(0).toString(16).toUpperCase()}  ${line.trim().slice(0, 70)}`);
      }
    }
  });
}
if (found) {
  console.error(`NG: 絵文字になりうる字が ${found} 個あります（js/icons.js の線画に置きかえてください）`);
  process.exit(1);
}
console.log(`OK: 絵文字はありません（${files.length} ファイル）`);
