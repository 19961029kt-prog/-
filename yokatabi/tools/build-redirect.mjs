// 旧URL（https://19961029kt-prog.github.io/-/yokatabi/）に置く転送ページを作る。
//   node yokatabi/tools/build-redirect.mjs <新しいURL> <出力フォルダ>
// 開いた人を新しいURLへ移し、その人の遊んだ記録（localStorage）を URL の # に載せて渡す。
// 新しいURL側では js/store.js が # から記録を受け取る。検索エンジン向けには canonical で新しいURLを示す。
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [url, out] = process.argv.slice(2);
if (!/^https?:\/\/.+\/$/.test(url || '') || !out) {
  console.error('使い方: node build-redirect.mjs https://<新しいURL>/ <出力フォルダ>');
  process.exit(1);
}
const KEY = 'yokatabi.kyushu.v1';
const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Q-TRIP 九州よりみちダイスは新しいURLに移りました</title>
  <link rel="canonical" href="${esc(url)}">
  <meta http-equiv="refresh" content="3;url=${esc(url)}">
  <script>
    // 記録を # に載せて移る（# の後ろはサーバーに送られない）。読めない環境では記録なしで移る
    (function () {
      var to = ${JSON.stringify(url)};
      try {
        var raw = localStorage.getItem(${JSON.stringify(KEY)});
        if (raw) {
          var bytes = new TextEncoder().encode(raw), bin = '';
          for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
          to += '#carry=' + btoa(bin).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '');
        }
      } catch (e) {}
      location.replace(to);
    })();
  </script>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #fbf6ec; color: #4a3a2c;
      font-family: 'Hiragino Maru Gothic ProN', 'Zen Maru Gothic', sans-serif; text-align: center; padding: 16px; box-sizing: border-box; }
    a { color: #b9582a; font-weight: 700; word-break: break-all; }
  </style>
</head>
<body>
  <main>
    <p>「Q-TRIP 九州よりみちダイス」（旧名：よか旅すごろく九州）は、新しいURLに移りました。</p>
    <p><a href="${esc(url)}">${esc(url)}</a></p>
  </main>
</body>
</html>
`;
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'index.html'), html);
console.log(`転送ページを作りました: ${join(out, 'index.html')} → ${url}`);
