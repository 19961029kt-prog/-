# Mods 公式資料メモ（確認日：2026-10-09）

## 出典
- 公式ドキュメント「Mods overview」：https://code.claude.com/docs/en/plugins/mods/overview
- Anthropic記事「Customize Claude Code with mods」（2026-10-01付）：https://claude.com/resources/articles/claude-code-mods
- サンプルMod：https://github.com/anthropics/claude-code-playground/tree/main/claude-code/mods
- 標準Modのソース：https://github.com/anthropics/claude-code/tree/main/mods

## 要点（公式ドキュメントより）
- Modは、Claude Codeの見た目や動きを変えるプラグイン。JavaScript/TypeScriptのイベント処理で書く。
- できること：画面にペインや帯を描く／Claude Code自身の表示を描き替える／ツール呼び出しや送信内容に割り込む／Claudeを介さず動く独自コマンド。
- 動く場所：ターミナルのCLIとデスクトップアプリのCodeタブ。VS Code拡張や `claude -p`、クラウドセッションでは処理は動くが画面には描かれない。
- 必要な版：ターミナルは v2.1.287 以降、デスクトップアプリは v2.1.286 以降。Modは標準でオン。
- 入れ方：マーケットプレイスから。セッション内で `/plugin install 名前@マーケットプレイス`、シェルで `claude plugin install 名前@マーケットプレイス`。
- 確認：`/plugin` で、読み込まれたModの数と名前が表示される。
- 止め方：1つなら `/plugin` の Installed タブで無効化／1回だけ全部止めるなら `--safe-mode` で起動／全セッションで止めるなら `~/.claude/settings.json` に `"disableAllHooks": true`。
- 入れる前の確認：`claude plugin validate ./フォルダ` で、Modが何をするか（hooks: と calls:）を実行せずに一覧できる。
- 安全：Modはサンドボックス化されず、あなたの権限でファイル読み書き、プロセス起動、通信ができる。秘密情報も読める。信頼できる作者・マーケットプレイスのものだけ入れる。
- 標準で入っているMod：cc-plugin-agents-md、cc-plugin-diff、cc-plugin-plugin-authoring、cc-plugin-sec-default、cc-plugin-telemetry、cc-plugin-you-should-know。
- cc-plugin-you-should-know：長めの作業中に横で見守る補助エージェント。見落としそうな大事なことがあれば、入力欄の上にメモを出す。標準では無効。`/plugin enable cc-plugin-you-should-know@builtin` で有効化。
- サンプルMod：token-weather（コンテキストの埋まり具合を天気予報のように入力欄の上に表示）、blast-radius（危険なシェルコマンドを止めて影響を見せる）、replay-theater（`/replay` で直前の編集を振り返る）。サポート対象外のサンプル。

## 要点（Anthropic記事より）
- 記事の日付は2026年10月1日。
- Team / Enterprise プランなどでは sec-default が先に読み込まれ、ユーザーが入れたModが拒否ルールを上書きするのを防ぐ。
- `/diff` は標準Modになり、`/plugin` で無効化や差し替えができる。
