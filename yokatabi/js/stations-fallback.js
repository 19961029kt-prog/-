// 自動生成ファイル：直接編集しないこと。stations.json を編集して
//   node tools/build-fallback.mjs
// を実行すると再生成されます。
window.YOKATABI_FALLBACK_DATA = {
  "schemaVersion": 1,
  "meta": {
    "title": "Q-TRIP 九州よりみちダイス",
    "subtitle": "KYUSHU ROUTES & ROOTS",
    "catch": "サイコロ片手に巡る、ローカル美食と秘湯の旅",
    "viewBox": [
      0,
      0,
      800,
      960
    ],
    "startStationId": "hakata",
    "currencyUnit": "万円",
    "shareHashtags": [
      "九州よりみちダイス",
      "QTRIP",
      "九州旅"
    ],
    "ranks": [
      {
        "id": "traveler",
        "title": "九州旅人",
        "min": 0,
        "icon": "🎒",
        "metal": "bronze",
        "flavor": "サイコロ片手に、九州の旅が始まった。"
      },
      {
        "id": "pioneer",
        "title": "九州開拓使",
        "min": 10000,
        "icon": "🧭",
        "metal": "silver",
        "flavor": "まだ見ぬ駅へ。あなたの足跡が、九州の地図を塗り替えていく。"
      },
      {
        "id": "daimyo",
        "title": "九州大名",
        "min": 30000,
        "icon": "🏯",
        "metal": "gold",
        "flavor": "城下に湯けむり、領地に名産。九州じゅうにあなたの名がとどろく。"
      },
      {
        "id": "railking",
        "title": "九州鉄道王",
        "min": 55000,
        "icon": "🚂",
        "metal": "platinum",
        "flavor": "九州のレールは、すべてあなたの王国へ通じている。"
      }
    ],
    "trip": {
      "minAcquired": 2,
      "day1Start": "09:00",
      "day1End": "18:00",
      "morningMinutes": 60,
      "day2Start": "08:30",
      "day2End": "17:30",
      "transferMinutes": 10,
      "maxStops": 6,
      "notice": "所要時間は乗り換えを含むおおよその目安です。運行本数・時刻・運休は各社の最新情報をご確認ください。"
    },
    "owner": {
      "minAwaySeconds": 15,
      "joys": [
        {
          "id": "arrive",
          "icon": "📦",
          "label": "届くのが楽しみ！"
        },
        {
          "id": "visit",
          "icon": "🧳",
          "label": "現地へ泊まりに行く予定！"
        },
        {
          "id": "cheer",
          "icon": "📣",
          "label": "応援買い！"
        }
      ],
      "oath": "ショップでの注文、または宿の予約手配を完了しました"
    },
    "craft": {
      "discoveryBonus": 200,
      "ticketMax": 3,
      "train": [
        {
          "slot": "livery",
          "label": "車体フォルム＆塗装",
          "icon": "🚃",
          "items": [
            {
              "id": "hidamari",
              "name": "ひだまりローカル気動車",
              "price": 0,
              "desc": "テラコッタとクリームの、ぽかぽか温かい1両編成。"
            },
            {
              "id": "forest",
              "name": "フォレスト・ハイランド号",
              "price": 1500,
              "ticket": true,
              "desc": "深いフォレストグリーンに金の帯。高原を渡るクラシカルな気動車。"
            },
            {
              "id": "gullwing",
              "name": "ホワイト・ガルウィング号",
              "price": 3000,
              "ticket": true,
              "desc": "白磁のように白いボディに茜色のライン。海沿いを駆ける流線形の特急。"
            },
            {
              "id": "caldera",
              "name": "カルデラ・スチーム号",
              "price": 5000,
              "ticket": true,
              "desc": "漆黒の黒鉄と真鍮の煙突。山あいに汽笛を響かせる蒸気機関車。"
            },
            {
              "id": "patisserie",
              "name": "ゴールデン・パティスリー号",
              "price": 8000,
              "ticket": true,
              "desc": "アンティークゴールドに黒の格子。甘い香りを運ぶスイーツ観光列車。"
            },
            {
              "id": "royal",
              "name": "ロイヤル・セブンズ号",
              "price": 15000,
              "ticket": true,
              "desc": "深いロイヤルマルーンに金の紋章。九州をめぐる最高峰のクルーズトレイン。"
            }
          ]
        },
        {
          "slot": "carriage",
          "label": "2両目・連結車両",
          "icon": "🔗",
          "items": [
            {
              "id": "none",
              "name": "連結なし（1両ワンマン運行）",
              "price": 0,
              "desc": "身軽な1両で、どこへでも。"
            },
            {
              "id": "chaya",
              "name": "木組みの茶屋・食堂車",
              "price": 2500,
              "ticket": true,
              "desc": "木組みの格子とのれん。湯気の立つお茶と駅弁の香りがする食堂車。"
            },
            {
              "id": "panorama",
              "name": "パノラマ展望サロン車",
              "price": 4500,
              "ticket": true,
              "desc": "大きな窓いっぱいに車窓が広がる、ソファ席の展望車。"
            },
            {
              "id": "ashiyu",
              "name": "源泉かけ流し足湯車両",
              "price": 7000,
              "ticket": true,
              "desc": "木の湯船にお湯をはった、走る足湯。湯けむりをなびかせて走る。"
            }
          ]
        },
        {
          "slot": "trail",
          "label": "走行トレイル",
          "icon": "☁",
          "items": [
            {
              "id": "puff",
              "name": "白い綿雲のパフ",
              "price": 0,
              "desc": "ぽわん、ぽわんと浮かぶ白い蒸気。"
            },
            {
              "id": "leaves",
              "name": "新緑の木の葉と風",
              "price": 800,
              "desc": "若葉がくるくる舞う、高原の風。発見ボーナスだけでも手が届くお試し枠。"
            },
            {
              "id": "steam",
              "name": "別府・由布院の湯けむり",
              "price": 2000,
              "desc": "ゆらゆら立ちのぼる、温泉街の湯けむり。"
            },
            {
              "id": "stardust",
              "name": "黄金のスパークル星屑",
              "price": 6000,
              "desc": "走ったあとに、金色の星くずがきらりと残る。"
            }
          ]
        }
      ],
      "avatar": [
        {
          "slot": "hat",
          "label": "帽子・頭",
          "icon": "👒",
          "items": [
            {
              "id": "straw",
              "name": "旅の麦わら帽子",
              "price": 0,
              "desc": "日ざしをやさしくさえぎる、旅のはじまりの帽子。"
            },
            {
              "id": "conductor",
              "name": "レトロ車掌キャップ",
              "price": 600,
              "desc": "つばの光る、昔ながらの車掌さんの帽子。"
            },
            {
              "id": "tenugui",
              "name": "温泉手ぬぐい乗せ",
              "price": 1500,
              "desc": "頭にちょこんと手ぬぐい。湯上がりの気分。"
            },
            {
              "id": "kinghat",
              "name": "黄金の鉄道王ハット",
              "price": 5000,
              "desc": "金の帯をしめたシルクハット。九州じゅうのレールを見渡す帽子。"
            }
          ]
        },
        {
          "slot": "outfit",
          "label": "衣装",
          "icon": "🧥",
          "items": [
            {
              "id": "canvas",
              "name": "キャンバスの旅リュック姿",
              "price": 0,
              "desc": "生成りのシャツに帆布のリュック。どこへでも歩いていける。"
            },
            {
              "id": "blazer",
              "name": "観光列車の深緑ブレザー制服",
              "price": 2000,
              "desc": "金ボタンの深緑ブレザー。観光列車のアテンダント気分。"
            },
            {
              "id": "yukata",
              "name": "温泉街の羽織＆浴衣",
              "price": 3500,
              "desc": "藍の浴衣に羽織をはおって、湯の町をそぞろ歩き。"
            },
            {
              "id": "tuxedo",
              "name": "クルーズトレインのタキシード",
              "price": 8000,
              "desc": "蝶ネクタイのタキシード。特別な列車の晩餐会へ。"
            }
          ]
        },
        {
          "slot": "buddy",
          "label": "旅の相棒",
          "icon": "🐾",
          "items": [
            {
              "id": "none",
              "name": "なし",
              "price": 0,
              "desc": "ひとり旅も、また気楽。"
            },
            {
              "id": "camera",
              "name": "二眼レフカメラ",
              "price": 400,
              "desc": "上からのぞく、四角いファインダーのクラシックカメラ。"
            },
            {
              "id": "bento",
              "name": "曲げわっぱ駅弁",
              "price": 1200,
              "desc": "杉の香りの曲げわっぱに、ふっくらご飯と旅のおかず。"
            },
            {
              "id": "cat",
              "name": "三毛猫の見習い駅長",
              "price": 4000,
              "desc": "小さな駅長帽をかぶった三毛猫。旅のお供にどこへでもついてくる。"
            }
          ]
        }
      ]
    },
    "prefectures": {
      "福岡": {
        "color": "#c65d3b"
      },
      "佐賀": {
        "color": "#3f8a7c"
      },
      "長崎": {
        "color": "#4b79a1"
      },
      "熊本": {
        "color": "#8c6a9e"
      },
      "大分": {
        "color": "#c9893f"
      },
      "宮崎": {
        "color": "#6e9a4a"
      },
      "鹿児島": {
        "color": "#b5506e"
      }
    },
    "affiliate": {
      "disclosure": "【PR】このカード内のボタンはアフィリエイト（広告）リンクを含みます。購入・予約によって運営者が紹介料を受け取る場合があります。",
      "products": [
        {
          "id": "amazon",
          "label": "Amazon",
          "url": "https://www.amazon.co.jp/s?k={kw}",
          "params": {
            "tag": ""
          },
          "wrap": "",
          "className": "btn-amazon"
        },
        {
          "id": "rakuten",
          "label": "楽天市場",
          "url": "https://search.rakuten.co.jp/search/mall/{kw}/",
          "params": {},
          "wrap": "",
          "className": "btn-rakuten"
        },
        {
          "id": "yahoo",
          "label": "Yahoo!ショッピング",
          "url": "https://shopping.yahoo.co.jp/search?p={kw}",
          "params": {},
          "wrap": "",
          "className": "btn-yahoo"
        }
      ],
      "stays": [
        {
          "id": "rakuten_travel",
          "label": "楽天トラベル",
          "url": "https://kw.travel.rakuten.co.jp/keyword/Search.do?charset=utf-8&f_query={kw}",
          "params": {},
          "wrap": "",
          "className": "btn-rakuten-travel"
        },
        {
          "id": "jalan",
          "label": "じゃらん",
          "url": "https://www.jalan.net/uw/uwp2011/uww2011search.do?keyword={kw}",
          "params": {},
          "wrap": "",
          "className": "btn-jalan"
        }
      ]
    }
  },
  "routeTypes": {
    "shinkansen": {
      "label": "新幹線"
    },
    "trunk": {
      "label": "特急幹線"
    },
    "local": {
      "label": "ローカル線"
    },
    "scenic": {
      "label": "観光列車"
    },
    "ferry": {
      "label": "航路"
    },
    "bus": {
      "label": "バス連絡"
    }
  },
  "routeOverrides": [
    {
      "between": [
        "hakata",
        "kagoshima-chuo"
      ],
      "type": "shinkansen",
      "name": "九州新幹線",
      "minutes": 80
    },
    {
      "between": [
        "ureshino-onsen",
        "nagasaki"
      ],
      "type": "shinkansen",
      "name": "西九州新幹線",
      "minutes": 25
    },
    {
      "between": [
        "hakata",
        "yufuin"
      ],
      "type": "scenic",
      "name": "久大本線（観光特急が走る高原ルート）",
      "minutes": 130
    },
    {
      "between": [
        "aso",
        "beppu"
      ],
      "type": "scenic",
      "name": "豊肥本線（観光特急が走るカルデラルート）",
      "minutes": 120
    },
    {
      "between": [
        "kagoshima-chuo",
        "ibusuki"
      ],
      "type": "scenic",
      "name": "指宿枕崎線（観光特急が走る海辺ルート）",
      "minutes": 55
    },
    {
      "between": [
        "huis-ten-bosch",
        "nagasaki"
      ],
      "type": "scenic",
      "name": "大村線（海沿いの観光列車ルート）",
      "minutes": 80
    },
    {
      "between": [
        "hakata",
        "mojiko"
      ],
      "type": "trunk",
      "name": "鹿児島本線",
      "minutes": 60
    },
    {
      "between": [
        "hakata",
        "karatsu"
      ],
      "type": "local",
      "name": "筑肥線",
      "minutes": 85
    },
    {
      "between": [
        "hakata",
        "aso"
      ],
      "type": "local",
      "name": "鹿児島本線・豊肥本線",
      "minutes": 120
    },
    {
      "between": [
        "hakata",
        "ureshino-onsen"
      ],
      "type": "trunk",
      "name": "長崎本線・佐世保線（リレー特急）",
      "minutes": 60
    },
    {
      "between": [
        "karatsu",
        "huis-ten-bosch"
      ],
      "type": "local",
      "name": "筑肥線・松浦鉄道",
      "minutes": 140
    },
    {
      "between": [
        "ureshino-onsen",
        "huis-ten-bosch"
      ],
      "type": "local",
      "name": "佐世保線・大村線",
      "minutes": 60
    },
    {
      "between": [
        "mojiko",
        "beppu"
      ],
      "type": "trunk",
      "name": "日豊本線",
      "minutes": 90
    },
    {
      "between": [
        "beppu",
        "yufuin"
      ],
      "type": "local",
      "name": "久大本線",
      "minutes": 50
    },
    {
      "between": [
        "beppu",
        "miyazaki"
      ],
      "type": "trunk",
      "name": "日豊本線",
      "minutes": 200
    },
    {
      "between": [
        "miyazaki",
        "kagoshima-chuo"
      ],
      "type": "trunk",
      "name": "日豊本線",
      "minutes": 130
    },
    {
      "between": [
        "kagoshima-chuo",
        "yakushima"
      ],
      "type": "ferry",
      "name": "鹿児島港〜宮之浦港 航路（高速船・フェリー）",
      "minutes": 130
    },
    {
      "between": [
        "ibusuki",
        "yakushima"
      ],
      "type": "ferry",
      "name": "指宿港〜屋久島 航路（高速船）",
      "minutes": 100
    },
    {
      "between": [
        "aso",
        "kurokawa-onsen"
      ],
      "type": "bus",
      "name": "路線バス",
      "minutes": 60
    },
    {
      "between": [
        "kurokawa-onsen",
        "yufuin"
      ],
      "type": "bus",
      "name": "路線バス（やまなみハイウェイ）",
      "minutes": 100
    },
    {
      "between": [
        "aso",
        "takachiho"
      ],
      "type": "bus",
      "name": "路線バス",
      "minutes": 90
    },
    {
      "between": [
        "takachiho",
        "miyazaki"
      ],
      "type": "bus",
      "name": "バス＋鉄道連絡（延岡経由）",
      "minutes": 170
    }
  ],
  "stations": [
    {
      "id": "hakata",
      "name": "博多",
      "kana": "はかた",
      "prefecture": "福岡",
      "x": 341.7,
      "y": 113.2,
      "labelDir": "left",
      "connections": [
        "mojiko",
        "karatsu",
        "ureshino-onsen",
        "aso",
        "yufuin",
        "kagoshima-chuo"
      ],
      "assetValue": 5000,
      "propertyType": "名産品物件",
      "tagline": "九州の旅はいつもここから",
      "memo": "改札を抜けると、豚骨スープの湯気と人波の熱がふわりと頬にふれる。駅ビルの屋上広場で行き交う列車を見送ったら、夕暮れの那珂川へ。川面に屋台の提灯が揺れはじめ、木の長椅子に肩を寄せれば、隣の誰かの笑い声まで旅の音になる。九州の旅を、街ごと「よか」と送り出してくれる玄関口。",
      "products": [
        {
          "name": "博多ラーメン",
          "desc": "細麺×濃厚豚骨。替え玉前提のお取り寄せセット。",
          "keyword": "博多ラーメン 豚骨 お取り寄せ"
        },
        {
          "name": "辛子明太子",
          "desc": "白ごはんの相棒。贈答にも喜ばれる博多の定番。",
          "keyword": "博多 辛子明太子"
        }
      ],
      "gateway": "福岡空港・博多駅",
      "plan": {
        "minutes": 120,
        "day": "博多ラーメンやうどんの食べ歩きと、櫛田神社まわりの博多の街歩き",
        "evening": "中洲の屋台で、博多の夜をはしご酒で締めくくる",
        "morning": "駅ビルの屋上広場で、列車を見送りながら朝のコーヒー"
      },
      "stay": {
        "name": "博多駅前の都市型ホテル",
        "kind": "都市型ホテル",
        "desc": "新幹線改札から徒歩圏。屋台はしごの拠点に。",
        "keyword": "博多駅 ホテル"
      }
    },
    {
      "id": "mojiko",
      "name": "門司港",
      "kana": "もじこう",
      "prefecture": "福岡",
      "x": 454.5,
      "y": 25.8,
      "labelDir": "right",
      "connections": [
        "hakata",
        "beppu"
      ],
      "assetValue": 2500,
      "propertyType": "名産品物件",
      "tagline": "大正ロマンと関門海峡の終着駅",
      "memo": "駅舎を出て振り返ると、左右対称のネオ・ルネサンス様式の木造駅舎が、大正のやわらかな光をまとって立っている。線路の終わりから数分歩けば関門海峡。大きな船の汽笛がお腹の底まで響き、対岸の下関がすぐそこに見える。潮風にまじる焼きカレーの香ばしさに誘われて、レンガの路地へ寄り道したくなる。",
      "products": [
        {
          "name": "門司港焼きカレー",
          "desc": "チーズと卵をのせてオーブンで焼く港町の味。",
          "keyword": "門司港 焼きカレー"
        },
        {
          "name": "ふぐ加工品",
          "desc": "関門名物のふぐを、ひれ酒や一夜干しで。",
          "keyword": "ふぐ 一夜干し 関門"
        }
      ],
      "plan": {
        "minutes": 120,
        "day": "門司港レトロの洋館めぐりと関門海峡の散策。ランチは焼きカレー",
        "evening": "ライトアップされたレトロ地区と、海峡の夜景を散歩",
        "morning": "海峡沿いの遊歩道で、朝の潮風と行き交う船を眺める"
      },
      "stay": {
        "name": "門司港レトロのクラシックホテル",
        "kind": "クラシックホテル",
        "desc": "海峡の夜景と汽笛を、窓辺で独り占め。",
        "keyword": "門司港 ホテル"
      }
    },
    {
      "id": "karatsu",
      "name": "唐津",
      "kana": "からつ",
      "prefecture": "佐賀",
      "x": 247.4,
      "y": 148.7,
      "labelDir": "top",
      "connections": [
        "hakata",
        "huis-ten-bosch"
      ],
      "assetValue": 3000,
      "propertyType": "名産品物件",
      "tagline": "城と松原、そして呼子のイカ",
      "memo": "秋、唐津くんちの曳山が「エンヤ、ヨイサ」の掛け声とともに城下町を練り歩く。松林を渡る風は、松やにと潮の匂い。虹の松原の緑が弓なりに海岸を縁どり、その先に唐津城の白い天守がのぞく。呼子の朝市では、透きとおったイカの活き造りが、玄界灘の冷たい青をそのまま運んでくる。",
      "products": [
        {
          "name": "佐賀牛",
          "desc": "きめ細かな霜降り。すき焼き・焼肉用が人気。",
          "keyword": "佐賀牛 すき焼き"
        },
        {
          "name": "呼子のイカ",
          "desc": "いかしゅうまいや一夜干しで呼子の味を自宅に。",
          "keyword": "呼子 イカ しゅうまい"
        }
      ],
      "plan": {
        "minutes": 150,
        "day": "唐津城と虹の松原、足を延ばして呼子でイカの活き造り",
        "evening": "海辺の宿で、玄界灘の魚介づくしの夕食",
        "morning": "虹の松原の木陰を朝さんぽ"
      },
      "stay": {
        "name": "玄界灘を望む海辺の料理宿",
        "kind": "海辺の料理宿",
        "desc": "朝獲れの魚介が主役。波音を聞きながら眠る。",
        "keyword": "唐津 料理旅館"
      }
    },
    {
      "id": "ureshino-onsen",
      "name": "嬉野温泉",
      "kana": "うれしのおんせん",
      "prefecture": "佐賀",
      "x": 253.8,
      "y": 232.2,
      "labelDir": "right",
      "connections": [
        "hakata",
        "nagasaki",
        "huis-ten-bosch"
      ],
      "assetValue": 3500,
      "propertyType": "湯けむり物件",
      "tagline": "茶畑の丘と、とろとろ美肌の湯",
      "memo": "ホームに降りると、茶畑を渡ってきた若葉の青い香り。とろりと肌にまとわりつく湯は日本三大美肌の湯のひとつで、手のひらですくうと、なめらかにほどけていく。この湯の町ならではの温泉湯豆腐は、白くにごったスープの中でふるふると崩れ、食後の嬉野茶の一服が、体の芯までじんわり温めてくれる。",
      "products": [
        {
          "name": "嬉野茶",
          "desc": "勾玉のような丸い茶葉。甘みとコクが深い玉緑茶。",
          "keyword": "嬉野茶 玉緑茶"
        },
        {
          "name": "温泉湯豆腐",
          "desc": "温泉水で炊くととろける、名物の湯どうふセット。",
          "keyword": "嬉野 温泉湯豆腐"
        }
      ],
      "plan": {
        "minutes": 120,
        "day": "茶畑の丘と温泉街の散策。名物の温泉湯どうふを味わう",
        "evening": "とろりとした美肌の湯に、時間を忘れて浸かる",
        "morning": "嬉野茶を淹れて、茶畑を眺めるおだやかな朝"
      },
      "stay": {
        "name": "美肌自慢の老舗湯宿",
        "kind": "老舗湯宿",
        "desc": "源泉かけ流しの客室露天で、肌もこころもつるり。",
        "keyword": "嬉野温泉 旅館"
      }
    },
    {
      "id": "nagasaki",
      "name": "長崎",
      "kana": "ながさき",
      "prefecture": "長崎",
      "x": 226.7,
      "y": 319.4,
      "labelDir": "bottom",
      "connections": [
        "ureshino-onsen",
        "huis-ten-bosch"
      ],
      "assetValue": 4500,
      "propertyType": "名産品物件",
      "tagline": "坂と路面電車と、宝石の夜景",
      "memo": "坂の上から降りてくる風は、港の潮とちゃんぽんの湯気の匂い。チンチンと鐘を鳴らして路面電車が通りすぎ、石畳の坂道には異国の色をした屋根が重なっていく。日が暮れたら稲佐山へ。港を抱くようにまたたく夜景は、指先でなぞりたくなるほど細やかで、宝石箱をそっと開けたよう。",
      "products": [
        {
          "name": "長崎カステラ",
          "desc": "底のざらめがじゃりっと香る、職人仕込みの一本。",
          "keyword": "長崎 カステラ"
        },
        {
          "name": "長崎ちゃんぽん",
          "desc": "野菜たっぷり、太麺と白湯スープの郷土の味。",
          "keyword": "長崎ちゃんぽん お取り寄せ"
        }
      ],
      "gateway": "長崎空港・長崎駅",
      "plan": {
        "minutes": 150,
        "day": "路面電車で出島・グラバー園・中華街をめぐり、ちゃんぽんを",
        "evening": "稲佐山の夜景と、港のそぞろ歩き",
        "morning": "眼鏡橋から中島川沿いを朝さんぽ"
      },
      "stay": {
        "name": "夜景が見える高台ホテル",
        "kind": "高台ホテル",
        "desc": "客室から港の灯りを一望。夜更かし必至。",
        "keyword": "長崎 夜景 ホテル"
      }
    },
    {
      "id": "huis-ten-bosch",
      "name": "ハウステンボス",
      "kana": "はうすてんぼす",
      "prefecture": "長崎",
      "x": 211.6,
      "y": 235.8,
      "labelDir": "top",
      "connections": [
        "karatsu",
        "ureshino-onsen",
        "nagasaki"
      ],
      "assetValue": 4800,
      "propertyType": "名産品物件",
      "tagline": "運河と風車の、海辺のヨーロッパ",
      "memo": "大村湾の凪いだ水面を背に、駅を出るとすぐに風車の羽根がゆっくりと回っている。運河を渡る風には、季節の花の甘い香り。石畳を歩く靴音までどこか異国めいて、夜には光の粒が運河をなぞるように灯る。とろけるチーズの湯気を両手で包めば、海辺のヨーロッパの夜がやさしく更けていく。",
      "products": [
        {
          "name": "長崎のチーズ",
          "desc": "牧場仕込みのフレッシュチーズとスモークチーズ。",
          "keyword": "長崎 チーズ"
        },
        {
          "name": "長崎ワイン",
          "desc": "県産ぶどうで醸す、軽やかな白とロゼ。",
          "keyword": "長崎 ワイン"
        }
      ],
      "plan": {
        "minutes": 180,
        "day": "運河と花の街を散策し、チーズとワインでひと休み",
        "evening": "運河を照らすイルミネーションの中を散歩",
        "morning": "人の少ない朝の運河沿いをのんびり歩く"
      },
      "stay": {
        "name": "園内オフィシャルホテル",
        "kind": "オフィシャルホテル",
        "desc": "閉園後の静かな運河を散歩できる宿泊者の特権。",
        "keyword": "ハウステンボス ホテル"
      }
    },
    {
      "id": "aso",
      "name": "阿蘇",
      "kana": "あそ",
      "prefecture": "熊本",
      "x": 479.2,
      "y": 273.9,
      "labelDir": "right",
      "connections": [
        "hakata",
        "kurokawa-onsen",
        "beppu",
        "takachiho"
      ],
      "assetValue": 4200,
      "propertyType": "名産品物件",
      "tagline": "カルデラの真ん中で、草原の風を浴びる",
      "memo": "ホームに立つと、ぐるりと地平を囲む外輪山。草の匂いを含んだ風が、カルデラの底をゆったりと渡っていく。遠くで中岳がうっすらと噴煙を上げ、草千里では牛たちが首を垂れて草をはむ。昼は肉汁のしみたあか牛丼をほおばって、空の大きさに、しばらく言葉をなくしてしまう。",
      "products": [
        {
          "name": "阿蘇あか牛",
          "desc": "赤身のうまみが濃い、草原育ちの褐毛和種。",
          "keyword": "阿蘇 あか牛"
        },
        {
          "name": "ジャージー牛乳",
          "desc": "高原の牧場から。濃厚なのに後味すっきり。",
          "keyword": "阿蘇 ジャージー牛乳"
        }
      ],
      "plan": {
        "minutes": 150,
        "day": "草千里と中岳周辺の展望を楽しみ、ランチはあか牛丼",
        "evening": "高原の宿で、満天の星を眺める",
        "morning": "条件がそろえば外輪山の雲海に出会える早朝の展望所へ"
      },
      "stay": {
        "name": "外輪山を望む絶景高原リゾート",
        "kind": "高原リゾート",
        "desc": "朝は雲海、夜は満天の星。カルデラを独り占め。",
        "keyword": "阿蘇 リゾート ホテル"
      }
    },
    {
      "id": "kurokawa-onsen",
      "name": "黒川温泉",
      "kana": "くろかわおんせん",
      "prefecture": "熊本",
      "x": 491.9,
      "y": 239.8,
      "labelDir": "left",
      "note": "ゲーム上の駅（実際の最寄りはバス停）",
      "connections": [
        "aso",
        "yufuin"
      ],
      "assetValue": 5500,
      "propertyType": "湯けむり物件",
      "tagline": "入湯手形で、露天風呂はしご",
      "memo": "杉木立に囲まれた谷あいに、湯けむりと木造の宿がひっそりと寄り添う。首から下げた木の入湯手形がからんと鳴るたびに、次の露天風呂へ。川のせせらぎを聞きながら肩まで沈めば、湯の香りと木の葉のざわめきが、旅のこわばりを一枚ずつほどいていく。派手な看板のない、昔話のような湯の里。",
      "products": [
        {
          "name": "馬刺し",
          "desc": "熊本の郷土の味。甘い九州醤油とおろし生姜で。",
          "keyword": "熊本 馬刺し"
        },
        {
          "name": "温泉コスメ",
          "desc": "温泉水を使ったミストや石けんで、湯上がり肌を自宅でも。",
          "keyword": "黒川温泉 コスメ"
        }
      ],
      "plan": {
        "minutes": 150,
        "day": "入湯手形で、宿の露天風呂を2〜3軒はしご",
        "evening": "離れの露天風呂で、谷の音だけを聴く夜",
        "morning": "朝の温泉街をそぞろ歩き、もうひと湯"
      },
      "stay": {
        "name": "離れのある秘境宿",
        "kind": "秘境の離れ宿",
        "desc": "客室ごとの露天風呂で、谷の音だけを聴く夜。",
        "keyword": "黒川温泉 離れ 旅館"
      }
    },
    {
      "id": "beppu",
      "name": "別府",
      "kana": "べっぷ",
      "prefecture": "大分",
      "x": 566.9,
      "y": 189.6,
      "labelDir": "top",
      "connections": [
        "mojiko",
        "yufuin",
        "aso",
        "miyazaki"
      ],
      "assetValue": 5200,
      "propertyType": "湯けむり物件",
      "tagline": "街じゅうが湯けむり、源泉の都",
      "memo": "改札を出たとたん、ほんのりと湯の香り。見上げれば街のあちこちから白い湯けむりが立ちのぼる。源泉の数も湧く湯の量も日本一の温泉都市では、駅前の手湯に指先をひたすのが旅のはじまりの合図。地獄の蒸気でふっくら仕上がったプリンは、ほろ苦いカラメルが湯けむりの街の空気によく合う。",
      "products": [
        {
          "name": "地獄蒸しプリン",
          "desc": "温泉の蒸気でじっくり蒸した、固めの昔ながらプリン。",
          "keyword": "別府 地獄蒸しプリン"
        },
        {
          "name": "カボス",
          "desc": "大分特産の香酸かんきつ。焼き魚や焼酎にきゅっと。",
          "keyword": "大分 カボス"
        }
      ],
      "gateway": "大分空港・別府駅",
      "plan": {
        "minutes": 150,
        "day": "地獄めぐりと地獄蒸し料理、湯けむりの展望スポット",
        "evening": "展望露天から、湯けむりの立つ夜景を",
        "morning": "駅前の手湯や朝湯で、旅の疲れをほぐす"
      },
      "stay": {
        "name": "展望露天の老舗旅館",
        "kind": "老舗旅館",
        "desc": "別府湾を見下ろす露天風呂で、湯けむりの夜景を。",
        "keyword": "別府温泉 旅館 露天風呂"
      }
    },
    {
      "id": "yufuin",
      "name": "由布院",
      "kana": "ゆふいん",
      "prefecture": "大分",
      "x": 536.6,
      "y": 193.8,
      "labelDir": "left",
      "connections": [
        "hakata",
        "beppu",
        "kurokawa-onsen"
      ],
      "assetValue": 6000,
      "propertyType": "湯けむり物件",
      "tagline": "由布岳のふもと、朝霧の湯の町",
      "memo": "黒い柱と高い吹き抜けの駅舎は、木の香りがする小さな美術館のよう。正面に由布岳がどっしりと構え、秋から冬の朝には、金鱗湖から立ちのぼる霧が町じゅうを乳白色に包みこむ。湯の坪街道をそぞろ歩けば、焼き菓子やロールケーキの甘い香りに、何度でも足が止まってしまう。",
      "products": [
        {
          "name": "由布院ロールケーキ",
          "desc": "ふわふわ生地にたっぷりクリーム。湯の町の手みやげ。",
          "keyword": "由布院 ロールケーキ"
        },
        {
          "name": "大分の干し椎茸",
          "desc": "肉厚でうまみが濃い、生産量日本一の産地から。",
          "keyword": "大分 干し椎茸"
        }
      ],
      "plan": {
        "minutes": 150,
        "day": "湯の坪街道の食べ歩きと、金鱗湖のほとりを散策",
        "evening": "由布岳を望む離れ宿で、静かな夜",
        "morning": "朝霧の金鱗湖を見に、少し早起き"
      },
      "stay": {
        "name": "由布岳を望む高級離れ宿",
        "kind": "高級離れ宿",
        "desc": "全室離れ・源泉露天。霧の朝を部屋で迎える。",
        "keyword": "由布院 離れ 高級旅館"
      }
    },
    {
      "id": "miyazaki",
      "name": "宮崎",
      "kana": "みやざき",
      "prefecture": "宮崎",
      "x": 552.6,
      "y": 525.4,
      "labelDir": "right",
      "connections": [
        "beppu",
        "takachiho",
        "kagoshima-chuo"
      ],
      "assetValue": 3800,
      "propertyType": "名産品物件",
      "tagline": "ヤシ並木と、太陽のマンゴー",
      "memo": "改札を出ると、ヤシの葉が乾いた音を立てて揺れ、空がひときわ高い。潮の香りを含んだ南の風が、シャツの裾をふくらませる。少し足を延ばせば、青島の「鬼の洗濯板」に波が白くほどけ、日南海岸の青がどこまでも続く。夜は炭火で焼いた地頭鶏の香ばしい煙が、街の路地をやさしく満たしていく。",
      "products": [
        {
          "name": "宮崎完熟マンゴー",
          "desc": "樹上で熟して自然に落ちるまで待つ、太陽の果実。",
          "keyword": "宮崎 完熟マンゴー"
        },
        {
          "name": "みやざき地頭鶏",
          "desc": "歯ごたえとうまみ。炭火焼きのお取り寄せが人気。",
          "keyword": "地頭鶏 炭火焼"
        }
      ],
      "gateway": "宮崎空港・宮崎駅",
      "plan": {
        "minutes": 150,
        "day": "青島と日南海岸の青い海へ。ランチは地頭鶏の炭火焼",
        "evening": "繁華街で地頭鶏の炭火焼とチキン南蛮",
        "morning": "日向灘から昇る朝日を眺める"
      },
      "stay": {
        "name": "日向灘の南国リゾートホテル",
        "kind": "南国リゾートホテル",
        "desc": "朝日が海から昇るオーシャンビューの客室へ。",
        "keyword": "宮崎 リゾートホテル"
      }
    },
    {
      "id": "takachiho",
      "name": "高千穂",
      "kana": "たかちほ",
      "prefecture": "宮崎",
      "x": 526.7,
      "y": 329.4,
      "labelDir": "right",
      "note": "旧高千穂鉄道の駅（現在は観光カートが発着）",
      "connections": [
        "aso",
        "miyazaki"
      ],
      "assetValue": 4000,
      "propertyType": "名産品物件",
      "tagline": "神話の峡谷と、夜神楽の里",
      "memo": "線路の消えたかつての終着駅から、観光カートが鉄橋へ向かってそろりと走り出す。峡谷の底では、柱状節理の断崖から真名井の滝が流れ落ち、手こぎボートで近づけば冷たい霧が頬にふれる。夜、神社の神楽殿に笛と太鼓が響きはじめると、山あいの闇がふっと神話の時間に戻っていく。",
      "products": [
        {
          "name": "高千穂牛",
          "desc": "山あいで育つ宮崎牛の名産地。ステーキで味わいたい。",
          "keyword": "高千穂牛"
        },
        {
          "name": "釜炒り茶",
          "desc": "鉄釜で炒る昔ながらの製法。香ばしく澄んだ味。",
          "keyword": "高千穂 釜炒り茶"
        }
      ],
      "plan": {
        "minutes": 150,
        "day": "高千穂峡のボートと真名井の滝、観光カートで鉄橋へ",
        "evening": "高千穂神社の夜神楽を鑑賞する",
        "morning": "神話の里を朝さんぽし、天岩戸神社へ"
      },
      "stay": {
        "name": "峡谷の静かな和風旅館",
        "kind": "和風旅館",
        "desc": "夜神楽の帰り道、星空の下で湯に浸かる。",
        "keyword": "高千穂 旅館"
      }
    },
    {
      "id": "kagoshima-chuo",
      "name": "鹿児島中央",
      "kana": "かごしまちゅうおう",
      "prefecture": "鹿児島",
      "x": 367,
      "y": 607.1,
      "labelDir": "left",
      "connections": [
        "hakata",
        "miyazaki",
        "ibusuki",
        "yakushima"
      ],
      "assetValue": 4600,
      "propertyType": "名産品物件",
      "tagline": "桜島を望む、新幹線の南の終点",
      "memo": "新幹線の南の終点に降り立つと、光がひときわやわらかい。駅ビルの屋上の観覧車でてっぺんまで昇れば、錦江湾の向こうで桜島が悠然と煙をたなびかせる。ときおり街に降る灰さえ、ここでは暮らしの景色のひとつ。天文館の灯りの下、黒豚しゃぶと芋焼酎のお湯割りが一日をほっこりと締めくくる。",
      "products": [
        {
          "name": "かごしま黒豚",
          "desc": "甘くてさっぱりした脂。しゃぶしゃぶ用が定番。",
          "keyword": "鹿児島 黒豚 しゃぶしゃぶ"
        },
        {
          "name": "芋焼酎",
          "desc": "お湯割りで香り立つ、薩摩の蔵元の一本。",
          "keyword": "鹿児島 芋焼酎"
        }
      ],
      "gateway": "鹿児島空港・鹿児島中央駅",
      "plan": {
        "minutes": 120,
        "day": "天文館の街歩きと黒豚料理、フェリーで桜島へ",
        "evening": "天文館で、黒豚しゃぶと芋焼酎のお湯割り",
        "morning": "観覧車や城山展望台から、朝の桜島を眺める"
      },
      "stay": {
        "name": "桜島ビューホテル",
        "kind": "シティホテル",
        "desc": "錦江湾越しの桜島を、朝焼けとともに眺める。",
        "keyword": "鹿児島 桜島 眺望 ホテル"
      }
    },
    {
      "id": "ibusuki",
      "name": "指宿",
      "kana": "いぶすき",
      "prefecture": "鹿児島",
      "x": 388,
      "y": 692.4,
      "labelDir": "right",
      "connections": [
        "kagoshima-chuo",
        "yakushima"
      ],
      "assetValue": 3900,
      "propertyType": "湯けむり物件",
      "tagline": "砂に埋もれる、南国のあったか湯",
      "memo": "ヤシと花々に彩られた南国の駅へ、白と黒に塗り分けられた観光特急が、扉からふわりと白いミストを吹いて到着する。海辺の砂むし温泉では、浴衣のまま波打ち際の温かな砂に埋もれて十分ほど。じわりと汗ばむ重たい温もりと潮騒に包まれて、旅の時間までゆっくりと溶けていく。",
      "products": [
        {
          "name": "本枯節",
          "desc": "カビ付けを重ねた最高級のかつお節。だしの格が変わる。",
          "keyword": "本枯節 鹿児島"
        },
        {
          "name": "さつま揚げ",
          "desc": "魚のすり身を揚げた“つけあげ”。甘めの味わいが郷土流。",
          "keyword": "さつま揚げ 鹿児島"
        }
      ],
      "plan": {
        "minutes": 120,
        "day": "名物の砂むし温泉と、開聞岳を望む海辺の散策",
        "evening": "温泉宿で海を眺めながら、湯上がりの一杯",
        "morning": "朝の砂むしで、体の芯から温まる"
      },
      "stay": {
        "name": "砂むし温泉直結の宿",
        "kind": "温泉ホテル",
        "desc": "浴衣のまま砂むし会館へ。湯上がりは海を眺めて。",
        "keyword": "指宿 砂むし ホテル"
      }
    },
    {
      "id": "yakushima",
      "name": "屋久島",
      "kana": "やくしま",
      "prefecture": "鹿児島",
      "x": 373.2,
      "y": 892.2,
      "labelDir": "right",
      "special": "ferry",
      "note": "特別航路接続（高速船・フェリー／地図は縮尺外）",
      "connections": [
        "kagoshima-chuo",
        "ibusuki"
      ],
      "assetValue": 7000,
      "propertyType": "名産品物件",
      "tagline": "特別航路の先、千年の森",
      "memo": "鹿児島港から高速船で約2時間。宮之浦港に降り立つと、雨と苔と杉の匂いをたっぷり含んだ空気が胸の奥まで満ちていく。「洋上のアルプス」の山々は雲をまとい、白谷雲水峡の苔むした緑のトンネルでは、足もとの水音だけが道しるべ。樹齢千年を超える屋久杉が、静かに旅人を見守っている。",
      "products": [
        {
          "name": "トビウオ加工品",
          "desc": "水揚げ量日本有数の島から、干物やつけ揚げで。",
          "keyword": "屋久島 トビウオ"
        },
        {
          "name": "たんかん",
          "desc": "冬に熟す島のかんきつ。濃い甘みと香り。",
          "keyword": "屋久島 たんかん"
        }
      ],
      "plan": {
        "minutes": 240,
        "day": "白谷雲水峡で、苔むす森をトレッキング",
        "evening": "森のコテージで、雨音と星空に包まれる",
        "morning": "鳥の声を聞きながら、朝の森をゆっくり散策"
      },
      "stay": {
        "name": "森のコテージ・ロッジ",
        "kind": "コテージ・ロッジ",
        "desc": "雨音と鳥の声で目覚める、森に抱かれた一棟貸し。",
        "keyword": "屋久島 コテージ"
      }
    }
  ]
};
