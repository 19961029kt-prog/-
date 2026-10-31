# Q-TRIP の Firebase — データの形・Security Rules・テスト

公開サイトには載せない開発用のフォルダ（`tools/publish-site.sh` が除く）。
Firestore の Security Rules・Storage の Rules・エミュレーターの設定・ルールと画面のテストがある。AI は使わない。

## データの形（Firestore）

| コレクション | 中身 | 読める人 | 書ける人 |
|---|---|---|---|
| `admins/{uid}` | 運営（審査する人）の印 | 本人の1件だけ | だれも（Firebase コンソールで作る） |
| `profiles/{uid}` | 登録（名前と同意だけ）：`displayName`（1〜40字）・`createdAt`・`policyVersion`（いまのプライバシーポリシーの版）・`agreedAt`（同意した時刻）・`lastPostAt` | 本人だけ（運営もアプリからは読まない） | 本人（メール確認済み。登録日・同意の時刻は「今」だけ・投稿時刻は「今」だけ・統計用の項目やメールアドレスは入れられない・本人はいつでも消せる＝退会） |
| `privateStats/{uid}` | 統計用：`ageGroup`（10s〜60s・70plus）・`gender`（female／male／other／noanswer）・`homeCountry`・`homePref`・`liveCountry`・`livePref`（国は ISO の2文字、日本だけ都道府県 01〜47、海外は空）・`updatedAt` | 本人だけ（運営もアプリからは読まない。集計はコンソールで） | 本人（選択肢の値だけ・本人はいつでも消せる） |
| `saves/{uid}` | 遊んだ記録：`data`（localStorage と同じ JSON・40万字まで）・`version`・`progress`・`savedAt`（端末の保存時刻 ms）・`updatedAt` | 本人だけ（運営も読まない） | 本人（メール確認済み） |
| `voicesPending/{id}` | 駅ノートの審査待ち：`uid`・`stationId`（26駅だけ）・`spot`（思い出の場所 1〜40字）・`body`（思い出 1〜400字）・`name`（登録の名前）・`bond`（駅とのつながり：commute／homecoming／everyday／detour）・`consent`（true）・`createdAt` | 本人と運営 | 作成は登録済みの人（3分あける）。書き換えはだれも不可。削除は本人（取り下げ）と運営（審査の記録つき） |
| `voices/{id}` | 承認済み：審査待ちの項目＋`approvedAt`・`approvedBy` | だれでも | 作成は運営の承認だけ（文面そのまま）。書き換え不可。削除は本人と運営 |
| `postcards/{uid}_{駅}` | 見せ合う旅の便り（一覧に出す軽いもの）：`uid`・`stationId`（26駅）・`memo`（0〜60字）・`thumb`（小さな写真 `data:image/jpeg;base64,…`・6万字まで）・`name`（登録の名前）・`createdAt`・`updatedAt`・`likeCount`・`reportCount`・`hidden`（＝通報3件以上） | 登録済みの人（隠れたものは本人と運営だけ） | 作成は本人（数は0から・時刻は今・大きな写真と一緒に）。書き換えは①本人が一言・小さな写真・名前（30秒あける・写真を替えるときは大きな写真も一緒に）②ほかの人が素敵ねで +1（いいねの印と一緒に）③ほかの人が通報で +1（通報と一緒に。3件目で `hidden`）④運営が戻す（0件・見える）。削除は本人と運営 |
| `postcardImages/{uid}_{駅}` | 拡大したときの大きな写真：`uid`・`image`（50万字まで）・`updatedAt` | ポストカードが見える人が1枚ずつ（一覧で読むのは運営だけ） | 本人だけ、ポストカードの作成・差し替えと同じ一括書き込みのとき。削除は本人と運営 |
| `postcards/{id}/likes/{uid}` | 素敵ねの印：`at` | 本人の1件と運営 | 作成だけ（自分の便りには不可・数の +1 と一緒に）。1人1回 |
| `reports/{uid}_{便りの id}` | 通報：`postcardId`・`reporter`・`reason`（face／private／copyright／inappropriate／other）・`note`（0〜200字）・`createdAt` | 運営 | 作成は登録済みの人（自分の便りには不可・数の +1 と一緒に）。1人1枚1回。削除は運営 |
| `moderationLog/{id}` | 審査の記録：`action`（approve／reject）・`by`・`at`・`reason` | 運営 | 作成は運営。書き換え・削除はだれも不可 |
| それ以外 | — | だれも | だれも |

### 流れ
1. **ログイン → 登録**：index.html の関所でログイン（Google・メールリンク）。登録がなければ登録フォーム。プライバシーポリシーへの同意が必須で、`profiles`（名前と同意）と `privateStats`（統計用）を1回の一括書き込みで作る。メールアドレスはどこにも入れない。
2. **記録**：`js/cloud.js` が localStorage の記録を `saves/{uid}` に送る。ログインしたときに新しいほう（または進んでいるほう）に入れ替える。
3. **紹介**：寄り道手帖の「この駅のおすすめを紹介する」→ `voicesPending` の作成と `profiles` の `lastPostAt` を今に、を1回の一括書き込みで。
4. **承認**：review.html で、`voices` の作成（文面そのまま）・`voicesPending` の削除・`moderationLog`（approve）を1回の一括書き込みで。却下は記録（reject と理由）を残して消す。
5. **旅の便り**：投函の「ほかの旅人にも見せる」で `postcards`（小さな写真）と `postcardImages`（大きな写真）を一緒に作る（審査しない）。一覧は新しい順に20枚ずつ読む（複合インデックスは `firestore.indexes.json`）。大きな写真は拡大したときだけ1枚読む。素敵ねは `likes` の印と `likeCount` +1、通報は `reports` と `reportCount` +1 を、それぞれ1回の一括書き込みで（ルールが前後を突き合わせる）。3件目の通報で `hidden` になり、ほかの人の一覧から消える。運営は review.html で写真と理由を見て、戻す（通報を消して `reportCount` 0）か、消す（通報と便りを消す）。

## 守りの決めごと

- **ルールに書いていないことはすべて禁止**（以前の地元の人の名簿 `contributors` も、いまは読み書きできない）。
- **App Check**：ルールからは見えないので、Firebase コンソールで Firestore と Authentication に「適用（Enforce）」を入れる。
- **ウェブの設定値（`firebaseConfig`）**は秘密ではない。サービスアカウントの鍵・管理者の鍵は、ページにもリポジトリにも置かない。
- **登録の年代・性別・出身地・所在地は画面に出さない**（`privateStats` に分け、本人だけが読める。運営もアプリからは読まない）。集計は運営が2段階認証の Firebase コンソールで行い、少人数で人が特定されないようにまとめる（推定の方針）。
- **退会**：本人は、自分の駅ノート・旅の便り・記録・統計用・登録をいつでも消せる（ルールが本人のものだけを許す）。画面は、そのあと Firebase Authentication のアカウントも消す。
- 画面に出す文字は、必ず `esc()` を通して文字として表示する。
- **Storage** は使わない（`storage.rules` はすべて禁止）。旅の便りの写真は、縮めた JPEG の data URL を Firestore の文書に入れる（小さな写真と大きな写真を分けて、読み込みの量を抑える）。

## ローカルのエミュレーターでテストする

本物のプロジェクトにはつながない（projectId は `demo-qtrip`）。Java（11以上）・Node.js・Python・Playwright が要る。

```bash
cd yokatabi/firebase
npm install
npm test        # ルールのテスト（test/rules.test.mjs・36件）
npm run e2e     # 画面の通し（test/e2e.mjs・57件。写真は test/fixture-photo.jpg。Auth と Firestore のエミュレーターに index.html?emulator・review.html?emulator をつなぐ）
```

- ルールを変えたら必ず `npm test` を通す。新しいコレクションを足すときは、ルールとテストを同時に書く。
- 手で触って確かめたいとき：`npx firebase emulators:start --only auth,firestore --project demo-qtrip`。

## 本番のプロジェクト（q-trip-a127e）

- `.firebaserc` の既定のプロジェクトは `q-trip-a127e`。ウェブの設定値は `js/firebase-config.js`（`YT.firebaseConfig`。`measurementId` は使わない）。
- **ルールを本番に出す**（テストが通ったときだけ出る）：
  ```bash
  cd yokatabi/firebase
  npx firebase login          # 運営の Google アカウントで（2段階認証つき）
  npm run deploy:rules        # npm test → firestore.rules と firestore.indexes.json を q-trip-a127e へ（Storage は使わないので出さない）
  ```
  コマンドを使わない場合は、Firebase コンソールの Firestore → ルールにファイルの中身を貼って公開し、Firestore → インデックスに `firestore.indexes.json` の2つの複合インデックス（`hidden`↑・`updatedAt`↓／`stationId`↑・`hidden`↑・`updatedAt`↓）を作る。
- サービスアカウントの鍵（JSON）は作らない・渡さない・リポジトリに置かない。

### コンソールで設定すること（済んでいるかの確認用）
1. Firestore：東京（`asia-northeast1`）で作成済みか確かめる。
2. Authentication：ログイン方法に「メールリンク」を有効にする。承認済みドメインに `q-trip.github.io` を足す。
3. App Check：ウェブアプリに reCAPTCHA Enterprise を登録し、Firestore と Authentication を「適用（Enforce）」にする（サイトキーは秘密ではないので、画面に書く）。
4. 予算のアラート、運営のアカウントの2段階認証。
5. 運営の印：Firestore のコンソールで `admins/{運営の uid}` を1件作る（uid は review.html にログインすると出る）。
