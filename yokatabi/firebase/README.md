# 地元の人の声（承認制）— Firebase の設計とテスト

公開サイトには載せない開発用のフォルダ（`tools/publish-site.sh` が除く）。
ここにあるのは Firestore の Security Rules・Storage の Rules・エミュレーターの設定・ルールのテストだけで、
本物の Firebase プロジェクトにはまだつないでいない。

## データの形（Firestore）

審査待ちと承認済みを**別のコレクション**に分ける。ひとつのコレクションの `status` で分けると、
問い合わせやルールの書き間違いひとつで審査待ちが一般の旅人に漏れるため。

| コレクション | 中身 | 読める人 | 書ける人 |
|---|---|---|---|
| `admins/{uid}` | 運営（審査する人）の印 | 本人の1件だけ | だれも（Firebase コンソールで作る） |
| `contributors/{uid}` | 地元の人の名簿：`name`（1〜40字）・`title`（肩書き 0〜60字）・`stationIds`（担当の駅）・`active`・`consentAt`（掲載の同意をもらった日時）・`lastPostAt` | 本人と運営 | 運営。本人は `lastPostAt` を今にすることだけ |
| `profiles/{uid}` | 遊ぶ人の投稿用：`displayName`（手帖に載せる名前 1〜40字）・`lastPostAt` | 本人と運営 | 本人（投稿時刻は「今」だけ。本人は消せない） |
| `voicesPending/{voiceId}` | 審査待ち：`uid`・`stationId`（26駅だけ）・`body`（1〜400字）・`name`・`title`（0〜60字）・`verified`（名簿の人は true）・`consent`（true）・`createdAt` | 本人と運営 | 作成は登録された地元の人。書き換えはだれも不可。削除は本人（取り下げ）と運営（審査の記録つき） |
| `voices/{voiceId}` | 承認済み：審査待ちの項目＋`approvedAt`・`approvedBy` | だれでも | 作成は運営の承認だけ。書き換え不可。削除は本人（同意の撤回）と運営 |
| `moderationLog/{voiceId}` | 審査の記録：`action`（approve／reject）・`by`・`at`・`reason`（0〜200字） | 運営 | 作成は運営。書き換え・削除はだれも不可 |
| それ以外 | — | だれも | だれも |

### 流れ
1. **登録**：運営が地元の人に会い、掲載の同意をもらってから、`contributors/{uid}` を作る（担当の駅を決める）。
2. **投稿（遊ぶ人）**：ゲームにログインした人（メール確認済み）は、寄り道手帖から `voicesPending` の作成と、自分の `profiles/{uid}`（名前・`lastPostAt` を今に）の更新を1回の一括書き込みで送る。前の投稿から3分（推定の値）あける。`verified` は false だけ（札は自分でつけられない）。
2. **投稿（名簿の地元の人）**：地元の人は、`voicesPending/{新しいid}` の作成と、自分の `contributors` の `lastPostAt` を今にする更新を、**1回の一括書き込み（writeBatch）**で送る。前の投稿から60秒たっていないと通らない。名前・肩書きは名簿と同じでないと通らない（なりすまし防止）。
3. **承認**：運営は、`voices/{同じid}` の作成（審査待ちの文面をそのまま写す）・`voicesPending/{id}` の削除・`moderationLog/{id}`（approve）の作成を、1回の一括書き込みで行う。**文面・名前・駅を書き換えた承認は通らない**（「人が確かめた、その人の言葉」を運営も改変しない）。直したいときは却下して出し直してもらう。
4. **却下**：`moderationLog/{id}`（reject と理由）を作って、`voicesPending/{id}` を消す（1回の一括書き込み）。
5. **取り下げ**：本人はいつでも、審査待ちも承認済みも消せる。

### 画面に出すとき（これから作る）
- 承認済みの声も、必ず `esc()` を通して文字として表示する（HTML として差し込まない）。
- 名前と肩書きを添えて「地元の人の声」として出し、運営が承認したものであることを書く。

## 守りの決めごと

- **ルールに書いていないことはすべて禁止**（最後の `match /{document=**}`）。
- **App Check**：ルールからは見えないので、Firebase コンソールで Firestore と Authentication に「適用（Enforce）」を必ず入れる。ウェブは reCAPTCHA Enterprise を使う。エミュレーターでは確かめられないので、本番の公開前のチェックリストに入れる。
- **ウェブの設定値（`firebaseConfig`）**はページに載せても秘密ではない（守りはルールと App Check が受け持つ）。サービスアカウントの鍵・管理者の鍵は、ページにもリポジトリにも置かない。
- **Firestore の場所**は作成後に変えられないので、作るときに東京（`asia-northeast1`）を選ぶ（推定：個人情報の説明がしやすい）。
- **費用の歯止め**：予算のアラートを設定する。連投の歯止めはルール（60秒）で、名簿の `active` を false にすればすぐ止められる。
- **Storage** は使わない（`storage.rules` はすべて禁止）。写真を扱うと決めたら、そのときに設計とテストを足す。
- 運営（`admins`）の登録はコンソールだけで行い、2段階認証を使う。

## ローカルのエミュレーターでテストする

本物のプロジェクトにはつながない（projectId は `demo-qtrip`。`demo-` で始まる名前はエミュレーター専用）。
Java（11以上）と Node.js が要る。

```bash
cd yokatabi/firebase
npm install          # firebase-tools と @firebase/rules-unit-testing（版は package.json で固定）
npm test             # エミュレーターを立てて test/*.test.mjs を走らせ、終わったら止める
```

- 画面の通しのテスト：`npm run e2e`（Auth・Firestore のエミュレーターにつなぎ、`local.html?emulator` と `index.html?emulator` を Playwright で動かす。13件）。
- テストは `test/voices.rules.test.mjs`。「できるべきこと」と「できてはいけないこと」を両方確かめる（23件）。
- ルールを変えたら必ず `npm test` を通す。新しいコレクションを足すときは、ルールとテストを同時に書く。
- 手で触って確かめたいとき：`npx firebase emulators:start --only firestore --project demo-qtrip`。

## 本番のプロジェクト（q-trip-a127e）

- `.firebaserc` の既定のプロジェクトは `q-trip-a127e`。ウェブの設定値は `js/firebase-config.js`（`YT.firebaseConfig`。まだ画面では読み込んでいない。`measurementId` は使わない）。
- **ルールを本番に出す**（テストが通ったときだけ出る）：
  ```bash
  cd yokatabi/firebase
  npx firebase login          # 運営の Google アカウントで（2段階認証つき）
  npm run deploy:rules        # npm test → firestore.rules と storage.rules を q-trip-a127e へ
  ```
  コマンドを使わない場合は、Firebase コンソールの Firestore → ルール、Storage → ルールに、それぞれのファイルの中身を貼って公開する。
- サービスアカウントの鍵（JSON）は作らない・渡さない・リポジトリに置かない。

### 画面を作る前に、コンソールで設定すること
1. Firestore：東京（`asia-northeast1`）で作成済みか確かめる。
2. Authentication：ログイン方法に「メールリンク」を有効にする。承認済みドメインに `q-trip.github.io` を足す。
3. App Check：ウェブアプリに reCAPTCHA Enterprise を登録し、Firestore と Authentication を「適用（Enforce）」にする（サイトキーは秘密ではないので、画面に書く）。
4. 予算のアラート、運営のアカウントの2段階認証。
5. 運営の印：Firestore のコンソールで `admins/{運営の uid}` を1件作る。
