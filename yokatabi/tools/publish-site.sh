#!/usr/bin/env bash
# 公開用のリポジトリ（<組織>.github.io）のチェックアウトに、公開するファイルだけを並べる。
#   bash yokatabi/tools/publish-site.sh <公開用リポジトリのフォルダ>
# そのあと、公開用リポジトリで commit → push すると数分で公開される（公開は OK をもらってから）。
# 開発用の tools/・firebase/ と CLAUDE.md は公開しない。公開用リポジトリの .git と CNAME（独自ドメインを使う場合）は残す。
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
dest="${1:?使い方: bash yokatabi/tools/publish-site.sh <公開用リポジトリのフォルダ>}"
[ -d "$dest/.git" ] || { echo "公開用リポジトリのチェックアウトではありません: $dest" >&2; exit 1; }

(cd "$here" && node tools/build-fallback.mjs --check && node tools/test-trip.mjs | tail -1)

find "$dest" -mindepth 1 -maxdepth 1 ! -name .git ! -name CNAME -exec rm -rf {} +
cp -r "$here"/. "$dest"/
rm -rf "$dest/tools" "$dest/CLAUDE.md" "$dest/firebase" # firebase/ はルールとテスト（node_modules を含む）なので公開しない
touch "$dest/.nojekyll" # Jekyll の変換を通さず、ファイルをそのまま配信する
echo "公開用のファイルを並べました: $dest"
