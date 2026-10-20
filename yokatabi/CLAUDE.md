# よか旅すごろく九州 — プロジェクトガイド

〜サイコロ片手に巡る、ローカル美食と秘湯の旅〜

九州の路線図をすごろく盤にしたインタラクティブマップ。遊びながら各駅のローカル1次情報・特産品・宿を発見できる体験型メディア（MVP）。

このディレクトリ（`yokatabi/`）は、リポジトリ直下の Vite + React アプリとは**完全に独立した静的サイト**。ビルド工程はなく、ファイルをそのまま GitHub Pages で配信する。

---

## 1. North Star（すべての判断基準）

ユーザーが九州を **「気になる ➔ 購入する（お取り寄せ） ➔ 訪れる（旅行） ➔ 関係性がつづく」** の4段階でたどること。

| 段階 | プロダクト上の行動 | 記録先（localStorage） |
|---|---|---|
| 気になる | 駅に到着して物件カードを読む | `visited` |
| 購入する | 名産品物件のボタン（Amazon／楽天市場／Yahoo!ショッピング）を押す | `actions[id].product` |
| 訪れる | 宿泊・体験物件のボタン（楽天トラベル／じゃらん）を押す | `actions[id].stay` |
| つづく | 推し駅に登録する | `favorites` |

物件カード上部の「ジャーニー」表示は、この4段階の達成状況をそのまま映す。新機能を足すときは、どの段階を前に進める機能なのかを説明できること。

## 2. 絶対ルール（法務・権利）

- **既存ゲーム（『桃太郎電鉄』等）の固有名称・画像・キャラクター・セリフ回し・ゲーム用語は一切使わない。** 世界観・UI・用語はすべてオリジナル。
- 使ってよい独自用語：**名産品物件／湯けむり物件／宿泊・体験物件／買収完了／正式オーナー／王国経営度／総資産額／九州踏破率／現地調査メモ／コレクション手帳／特別航路／分かれ道**。
- 使わない語（既存作品を想起させる語）：社長、独占、決算、目的地（ゲームの仕組みとしての）、カード名・キャラ名・イベント名の流用全般。迷ったら新しい言葉を作る。
- 鉄道会社のロゴ・車両の画像・公式路線図は使わない。列車は絵文字（🚂）、地図は自作SVG。
- **ステマ規制への対応**：アフィリエイトを含む箇所には必ず【PR】表記を置く（`meta.affiliate.disclosure`、フッター）。リンクには `rel="sponsored noopener"` を付ける。
- 実在しない「駅」を扱う場合（黒川温泉＝バス停、高千穂＝旧駅、屋久島＝航路）は `note` に明記し、画面にも出す。

## 3. マネタイズとインテント泥棒対策

**インテント泥棒** ＝ ユーザーが商品名だけ覚えて、別タブで直接検索して離脱すること。これを防ぐため、ゲーム上のご褒美を **モーダル内のアフィリエイトボタンを押すこと** にだけ結びつける。

- 物件カード内のボタンを押す → 新しいタブで販売・予約サイトが開く ＋ その駅が **買収完了**（初回のみ）。
- 買収完了で起きること：
  1. マップの駅ノードが **ゴールド** になる（金のリング・光輪・王冠・脈打つオーラ）
  2. コレクション手帳に **ホログラム風プレミアムスタンプカード**（評価額・買収日・買収ルートつき）が加わる
  3. ヘッダーの **王国経営度（買収率％）＆ 総資産額（万円）** がカウントアップする
  4. Xシェア文面が「〇〇駅に到着！」から **「【〇〇駅】の物件（評価額：〇〇万円）を完全買収しました！✨」** に変わる
- 実際に購入したかどうかは検証しない（MVPは「ボタン経由で行動した」ことを買収とする）。本番でコンバージョンを検証する場合も、ゲーム体験側は「ボタンを押したら即買収」のまま保つ。
- リンクは新しいタブで開くので、`preventDefault` しない（ポップアップブロック対策）。買収の演出は元のタブ側で再生され、戻ってきたときに見える。

## 4. アーキテクチャ（ランニングコスト0円）

```
yokatabi/
├── index.html               画面の骨格（Tailwind CDN＋Google Fonts）
├── stations.json            駅・物件マスター（唯一の正）
├── css/style.css            独自スタイル（盤面・ゴールド・ホログラム・サイコロ・モーダル）
├── js/
│   ├── stations-fallback.js 自動生成：stations.json と同じデータ（file:// 用）※手で編集しない
│   ├── sound.js             YT.Sound  … Web Audio API で合成する効果音
│   ├── store.js             YT.Store  … localStorage（進捗）
│   ├── data.js              YT.Data   … データ読み込み・路線グラフ探索
│   ├── map.js               YT.Map    … SVG盤面・駅ノード・列車アニメーション
│   └── app.js               UI全体（ヘッダー・サイコロ・物件カード・買収演出・手帳・Xシェア）
└── tools/build-fallback.mjs stations.json の検証とフォールバックの生成
```

- **技術スタック**：HTML5 / Tailwind CSS（Play CDN、バージョン固定）/ Vanilla JS / インラインSVG。npm もビルドも不要。
- **スクリプトは classic script（`<script src>`）で読み込む。** ES Modules は `file://` で開くと CORS で止まるため使わない。モジュール間は `window.YT` 名前空間で受け渡す。読み込み順は `index.html` の末尾にある順のまま。
- **データ読み込み**：`fetch('stations.json')` を試し、`file://` や通信エラーのときは `window.YOKATABI_FALLBACK_DATA` を使う（`YT.Data.load()`）。フッターに「stations.json 読込済み／内蔵データで起動中」が出る。
- **効果音**：外部の音声ファイルは使わない。サイコロ（コトン・コロコロ）、出目の確定音、発車・到着チャイム、買収ファンファーレをすべて OscillatorNode とノイズバッファで合成する。AudioContext は最初のユーザー操作で作る。ミュート状態は保存する。
- **localStorage** のキーは `yokatabi.kyushu.v1`。読み書きはすべて try/catch で囲み、使えない環境ではメモリ上の状態で動かす。構造を変えるときは `version` を上げて移行処理を書く。

```jsonc
{
  "version": 1,
  "currentStationId": "hakata",
  "visited":   { "hakata": "2026-10-20T08:00:00.000Z" },
  "acquired":  { "beppu": { "at": "…", "via": "product", "provider": "楽天市場", "item": "地獄蒸しプリン" } },
  "actions":   { "beppu": { "product": "…", "stay": "…" } },
  "favorites": { "beppu": true },
  "rolls": 3,
  "muted": false
}
```

## 5. データ構造（stations.json）

```jsonc
{
  "schemaVersion": 1,
  "meta": {
    "viewBox": [0, 0, 560, 820],       // SVG座標系。駅の x/y はこの中の値
    "startStationId": "hakata",
    "prefectures": { "福岡": { "color": "#e4572e" }, … },   // ノードやカードの県カラー
    "shareHashtags": ["よか旅すごろく九州", "九州旅"],
    "affiliate": {
      "disclosure": "【PR】…",
      "products": [ { "id", "label", "url": "…{kw}…", "params": { "tag": "" }, "wrap": "", "className" } ],
      "stays":    [ … 同上 … ]
    }
  },
  "routeOverrides": [                   // 区間の見た目（省略時は鉄道・直線）
    { "between": ["kagoshima-chuo", "yakushima"], "type": "ferry", "via": [305, 725] }
  ],
  "stations": [
    {
      "id": "hakata",                   // 半角英小文字とハイフン。変更すると保存データとずれるので変えない
      "name": "博多", "kana": "はかた", "prefecture": "福岡",
      "x": 204, "y": 145, "labelDir": "right",          // top | bottom | left | right
      "connections": ["mojiko", …],                    // 隣の駅のID（双方向に書く）
      "assetValue": 5000,                              // 物件評価額（万円）
      "propertyType": "名産品物件",                     // または「湯けむり物件」
      "tagline": "…", "memo": "100〜150文字の現地調査メモ",
      "note": "（任意）実在の駅ではない等の注記",
      "special": "ferry",                             // （任意）特別航路の駅
      "products": [ { "name", "desc", "keyword" } ],   // keyword＝各ストアの検索語
      "stay": { "name", "kind", "desc", "keyword" }
    }
  ]
}
```

### アフィリエイトURLの組み立て（`app.js` の `buildUrl`）
1. `url` の `{kw}` を URL エンコードしたキーワードに置き換える
2. `params` のうち値が空でないものをクエリに足す（例：Amazon アソシエイトの `tag`）
3. `wrap` があれば、`{url}` に組み立てたURLを入れてくるむ（例：楽天アフィリエイトの `https://hb.afl.rakuten.co.jp/hgc/<ID>/?pc={url}`、バリューコマース等）

**本番前のTODO**：各サービスのアフィリエイトIDを `params`／`wrap` に設定する。楽天トラベル・じゃらんの検索URLの形式は各サービスの公式ガイドに照らして確認する（MVPでは仮のキーワード検索URL）。

### 駅を追加するとき（100駅以上への拡張）
1. `stations.json` の `stations` に1件足す（座標は `viewBox` 内。九州シルエットとの位置関係を画面で確かめる）
2. 接続する駅の `connections` にも **お互いに** IDを書く
3. `node tools/build-fallback.mjs` を実行する（検証：必須項目・memo の文字数・接続先の存在と双方向性 → `js/stations-fallback.js` を生成）
4. 地図の外側に置く離島などは、`routeOverrides` で `type: "ferry"` と `via`（曲線の制御点）を指定する
- 駅が増えて盤面が混み合ったら、`viewBox` を広げるか、地方ごとの盤面に分ける（`meta` に盤面定義を足す）。ロジックは駅数に依存しない。

## 6. ゲームロジック

- **サイコロ**：出目 n に対し、**同じ駅を二度通らない n 区間の道のり** の終点を行き先候補にする（行き止まりなら届く最長距離）。盤面全体が光らないよう、候補は **ランダムに最大3駅**（分かれ道）。候補が1駅なら自動で出発する。
- **駅を直接タップ**：最短経路（BFS）で移動する。
- **列車アニメーション**：経路の各区間の SVG パスを `getPointAtLength` でなぞる。1区間 約0.8秒＋1区間増えるごとに0.3秒。進行方向に合わせて🚂を左右反転する。到着後にチャイム → 物件カードを開く。
- **指標**：九州踏破率＝訪問駅数／全駅、王国経営度＝買収駅数／全駅、総資産額＝買収した駅の `assetValue` の合計（全15駅で67,500万円）。

## 7. ローカルでの動作確認

```bash
cd yokatabi
python3 -m http.server 8000     # → http://localhost:8000/
# または: npx http-server -p 8000
```

- `index.html` をダブルクリック（`file://`）で開いても、内蔵データで動く。
- 進捗のリセット：コレクション手帳の「旅の記録をリセット」、または DevTools で `localStorage.removeItem('yokatabi.kyushu.v1')`。
- コミット前に：`node tools/build-fallback.mjs --check`（stations.json とフォールバックがずれていないか）。

## 8. デプロイ

リポジトリ直下の `.github/workflows/deploy-pages.yml` が、Vite のビルド結果に `yokatabi/` を丸ごとコピーして公開する（公開URL：`https://<user>.github.io/<repo>/yokatabi/`）。`tools/` と `CLAUDE.md` は公開物から除く。

## 9. コーディング規約

- 依存ライブラリを増やさない（Tailwind CDN と Google Fonts のみ）。CDN の URL はバージョンを固定する。
- 文字列を HTML に差し込むときは必ず `esc()` を通す（データは自前でも、将来の外部データ化に備える）。
- 画面の文言は日本語。コメントも日本語で、ねらい（なぜそうするか）を書く。
- アニメーションは `prefers-reduced-motion` で弱める（`style.css` の末尾）。
- キーボードで操作できること：駅ノードは Tab で選べて Enter で動く。モーダルは Esc で閉じる。
- 1次情報（現地調査メモ）は、確かめられる事実だけを書く。営業時間・料金・所要時間など変わりやすい数字はなるべく書かず、書く場合は「約」をつける。
