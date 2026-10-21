#!/usr/bin/env bash
# 盤面の地図（js/geo.js）を作るための元データをダウンロードする。
#   bash tools/fetch-geo-data.sh <データのフォルダ>
#   node tools/build-geo.mjs <データのフォルダ>
#
# n03/ … 国土数値情報「行政区域（N03）」2020年版を都道府県ごとの GeoJSON にしたもの（niiyz/JapanCityGeoJson）。
#        九州7県と、対岸として見える山口県・愛媛県。間引きはしていない（build-geo.mjs が盤面に合わせて間引く）。
#        国土交通省の配布元（https://nlftp.mlit.go.jp/ksj/）から直接取った GeoJSON を置いてもよい。
# sd/  … station_database（CC BY 4.0）。駅の緯度経度と、路線の線形（国土数値情報「鉄道（N02）」を加工）。
# n02/ … （任意）国土数値情報「鉄道（N02）」の *RailroadSection*.geojson を手で置くと、下地の線路網をそこから作る。
set -euo pipefail
dir="${1:?使い方: bash tools/fetch-geo-data.sh <データのフォルダ>}"
mkdir -p "$dir/n03" "$dir/sd" "$dir/n02"

for p in 40 41 42 43 44 45 46 35 38; do
  curl -fsSL --retry 3 -o "$dir/n03/$p.json" \
    "https://raw.githubusercontent.com/niiyz/JapanCityGeoJson/master/geojson/prefectures/$p.json"
  echo "n03/$p.json"
done

curl -fsSL --retry 3 -o "$dir/sd/json.zip" \
  "https://raw.githubusercontent.com/Seo-4d696b75/station_database/main/out/extra/json.zip"
python3 -c "import sys, zipfile; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])" "$dir/sd/json.zip" "$dir/sd"
echo "sd/json/"
