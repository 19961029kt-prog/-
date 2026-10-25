# Q-TRIP の Firebase — データの形・Security Rules・テスト

公開サイトには載せない開発用のフォルダ（`tools/publish-site.sh` が除く）。
Firestore の Security Rules・Storage の Rules・エミュレーターの設定・ルールと画面のテストがある。AI は使わない。

## データの形（Firestore）

| コレクション | 中身 | 読める人 | 書ける人 |
|---|---|---|---|
| `admins/{uid}` | 運営（審査する人）の印 | 本人の1件だけ | だれも（Firebase コンソールで作る） |
| `profiles/{uid}` | 登録：`displayName`（1〜40字）・`ageGroup`（10s〜60s・70plus）・`gender`（female／male／other／noanswer）・`homeCountry`・`homePref`・`liveCountry`・`livePref`（国は ISO の2文字、日本だけ都道府県 01〜47、海外は空）・`createdAt`・`lastPostAt` | 本人と運営 | 本人（メール確認済み。登録日は変えられない・投稿時刻は「今」だけ・本人は消せない） |
| `saves/{uid}` | 遊んだ記録：`data`（localStorage と同じ JSON・40万字まで）・`version`・`progress`・`savedAt`（端末の保存時刻 ms）・`updatedAt` | 本人だけ（運営も読まない） | 本人（メール確認済み） |
| `voicesPending/{id}` | おすすめスポットの審査待ち：`uid`・`stationId`（26駅だけ）・`spot`（1〜40字）・`body`（1〜400字）・`name`（登録の名前）・`title`（駅とのつながり 0〜60字）・`consent`（true）・`createdAt` | 本人と運営 | 作成は登録済みの人（3分あける）。書き換えはだれも不可。削除は本人（取り下げ）と運営（審査の記録つき） |
| `voices/{id}` | 承認済み：審査待ちの項目＋`approvedAt`・`approvedBy` | だれでも | 作成は運営の承認だけ（文面そのまま）。書き換え不可。削除は本人と運営 |
| `moderationLog/{id}` | 審査の記録：`action`（approve／reject）・`by`・`at`・`reason` | 運営 | 作成は運営。書き換え・削除はだれも不可 |
| それ以外 | — | だれも | だれも |

### 流れ
1. **ログイン → 登録**：index.html の関所でログイン（Google・メールリンク）。登録がなければ登録フォーム（`profiles` を作る）。
2. **記録**：`js/cloud.js` が localStorage の記録を `saves/{uid}` に送る。ログインしたときに新しいほう（または進んでいるほう）に入れ替える。
3. **紹介**：寄り道手帖の「この駅のおすすめを紹介する」→ `voicesPending` の作成と `profiles` の `lastPostAt` を今に、を1回の一括書き込みで。
4. **承認**：review.html で、`voices` の作成（文面そのまま）・`voicesPending` の削除・`moderationLog`（approve）を1回の一括書き込みで。却下は記録（reject と理由）を残して消す。

## 守りの決めごと

- **ルールに書いていないことはすべて禁止**（以前の地元の人の名簿 `contributors` も、いまは読み書きできない）。
- **App Check**：ルールからは見えないので、Firebase コンソールで Firestore と Authentication に「適用（Enforce）」を入れる。
- **ウェブの設定値（`firebaseConfig`）**は秘密ではない。サービスアカウントの鍵・管理者の鍵は、ページにもリポジトリにも置かない。
- **登録の年代・性別・出身地・所在地は画面に出さない**（本人と運営だけが読める）。集計に使うときも、少人数で人が特定されないようにまとめる（推定の方針）。
- 画面に出す文字は、必ず `esc()` を通して文字として表示する。
- **Storage** は使わない（`storage.rules` はすべて禁止）。

## ローカルのエミュレーターでテストする

本物のプロジェクトにはつながない（projectId は `demo-qtrip`）。Java（11以上）・Node.js・Python・Playwright が要る。

```bash
cd yokatabi/firebase
npm install
npm test        # ルールのテスト（test/rules.test.mjs・24件）
npm run e2e     # 画面の通し（test/e2e.mjs・22件。Auth と Firestore のエミュレーターに index.html?emulator・review.html?emulator をつなぐ）
```

- ルールを変えたら必ず `npm test` を通す。新しいコレクションを足すときは、ルールとテストを同時に書く。
- 手で触って確かめたいとき：`npx firebase emulators:start --only auth,firestore --project demo-qtrip`。

## 本番のプロジェクト（q-trip-a127e）

- `.firebaserc` の既定のプロジェクトは `q-trip-a127e`。ウェブの設定値は `js/firebase-config.js`（`YT.firebaseConfig`。`measurementId` は使わない）。
- **ルールを本番に出す**（テストが通ったときだけ出る）：
  ```bash
  cd yokatabi/firebase
  npx firebase login          # 運営の Google アカウントで（2段階認証つき）
  npm run deploy:rules        # npm test → firestore.rules と storage.rules を q-trip-a127e へ
  ```
  コマンドを使わない場合は、Firebase コンソールの Firestore → ルール、Storage → ルールに、それぞれのファイルの中身を貼って公開する。
- サービスアカウントの鍵（JSON）は作らない・渡さない・リポジトリに置かない。

### コンソールで設定すること（済んでいるかの確認用）
1. Firestore：東京（`asia-northeast1`）で作成済みか確かめる。
2. Authentication：ログイン方法に「メールリンク」を有効にする。承認済みドメインに `q-trip.github.io` を足す。
3. App Check：ウェブアプリに reCAPTCHA Enterprise を登録し、Firestore と Authentication を「適用（Enforce）」にする（サイトキーは秘密ではないので、画面に書く）。
4. 予算のアラート、運営のアカウントの2段階認証。
5. 運営の印：Firestore のコンソールで `admins/{運営の uid}` を1件作る（uid は review.html にログインすると出る）。
