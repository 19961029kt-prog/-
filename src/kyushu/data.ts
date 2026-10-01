export type PrefId =
  | 'fukuoka'
  | 'saga'
  | 'nagasaki'
  | 'kumamoto'
  | 'oita'
  | 'miyazaki'
  | 'kagoshima'
  | 'okinawa';

export interface Prefecture {
  id: PrefId;
  name: string;
  /** 県名の短縮表記(「福岡」など) */
  short: string;
  /** 県ごとのアクセントカラー(Tailwindのクラス) */
  chip: string;
  dot: string;
  /** 県別マップ上の配置(3列グリッド) */
  gridArea: string;
  catchphrase: string;
}

export const PREFECTURES: Prefecture[] = [
  { id: 'fukuoka', name: '福岡県', short: '福岡', chip: 'bg-rose-100 text-rose-700', dot: 'bg-rose-500', gridArea: '1 / 2', catchphrase: '屋台と明太子の街' },
  { id: 'saga', name: '佐賀県', short: '佐賀', chip: 'bg-lime-100 text-lime-700', dot: 'bg-lime-500', gridArea: '1 / 1', catchphrase: '有田焼と呼子のイカ' },
  { id: 'oita', name: '大分県', short: '大分', chip: 'bg-sky-100 text-sky-700', dot: 'bg-sky-500', gridArea: '1 / 3', catchphrase: 'おんせん県' },
  { id: 'nagasaki', name: '長崎県', short: '長崎', chip: 'bg-violet-100 text-violet-700', dot: 'bg-violet-500', gridArea: '2 / 1', catchphrase: '坂と教会と夜景' },
  { id: 'kumamoto', name: '熊本県', short: '熊本', chip: 'bg-red-100 text-red-700', dot: 'bg-red-500', gridArea: '2 / 2', catchphrase: '阿蘇の大地と熊本城' },
  { id: 'miyazaki', name: '宮崎県', short: '宮崎', chip: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500', gridArea: '2 / 3', catchphrase: '日本のひなた' },
  { id: 'kagoshima', name: '鹿児島県', short: '鹿児島', chip: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500', gridArea: '3 / 2', catchphrase: '桜島と黒豚と焼酎' },
  { id: 'okinawa', name: '沖縄県', short: '沖縄', chip: 'bg-teal-100 text-teal-700', dot: 'bg-teal-500', gridArea: '3 / 3', catchphrase: '青い海と島時間' },
];

export const PREF_BY_ID = Object.fromEntries(PREFECTURES.map((p) => [p.id, p])) as Record<PrefId, Prefecture>;

export type CategoryId = 'gourmet' | 'scenery' | 'onsen' | 'festival' | 'dialect' | 'hidden' | 'other';

export const CATEGORIES: { id: CategoryId; label: string; emoji: string }[] = [
  { id: 'gourmet', label: 'グルメ', emoji: '🍜' },
  { id: 'scenery', label: '絶景', emoji: '🌄' },
  { id: 'onsen', label: '温泉', emoji: '♨️' },
  { id: 'festival', label: '祭り・行事', emoji: '🏮' },
  { id: 'dialect', label: '方言', emoji: '💬' },
  { id: 'hidden', label: '穴場', emoji: '🗝️' },
  { id: 'other', label: 'その他', emoji: '✨' },
];

export const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Record<
  CategoryId,
  (typeof CATEGORIES)[number]
>;

export interface User {
  id: string;
  name: string;
  pref: PrefId;
  bio: string;
}

export interface Comment {
  id: string;
  authorId: string;
  authorName: string;
  authorPref: PrefId;
  text: string;
  createdAt: number;
}

export interface Post {
  id: string;
  authorId: string;
  authorName: string;
  authorPref: PrefId;
  /** 投稿で紹介している県(投稿者の出身県とは別) */
  pref: PrefId;
  category: CategoryId;
  text: string;
  /** 縮小済み画像のdata URL */
  image?: string;
  createdAt: number;
  /** 「よかね!」を押したユーザーID */
  likes: string[];
  comments: Comment[];
}

const MIN = 60 * 1000;
const HOUR = 60 * MIN;

/** 初回起動時に表示するサンプル投稿。 */
export function createSeedPosts(now: number): Post[] {
  const p = (
    id: string,
    authorName: string,
    authorPref: PrefId,
    pref: PrefId,
    category: CategoryId,
    text: string,
    ago: number,
    likeCount: number,
    comments: Omit<Comment, 'id' | 'createdAt'>[] = [],
  ): Post => ({
    id: `seed-${id}`,
    authorId: `seed-user-${authorName}`,
    authorName,
    authorPref,
    pref,
    category,
    text,
    createdAt: now - ago,
    likes: Array.from({ length: likeCount }, (_, i) => `seed-liker-${i}`),
    comments: comments.map((c, i) => ({ ...c, id: `seed-${id}-c${i}`, createdAt: now - ago + (i + 1) * 20 * MIN })),
  });

  return [
    p('1', '博多っ子', 'fukuoka', 'fukuoka', 'gourmet',
      '中洲の屋台、最近は観光客だけじゃなくて地元民も戻ってきとるよ。〆はやっぱり豚骨ラーメンの替え玉「バリカタ」一択やね！',
      25 * MIN, 12, [
        { authorId: 'seed-user-くまモン推し', authorName: 'くまモン推し', authorPref: 'kumamoto', text: '熊本ラーメンのマー油も忘れんでね〜！' },
      ]),
    p('2', '湯けむり旅人', 'oita', 'oita', 'onsen',
      '別府の地獄めぐり、海地獄の青さは何回見ても感動する。鉄輪の地獄蒸しプリンもおすすめ♨️',
      2 * HOUR, 20),
    p('3', 'くまモン推し', 'kumamoto', 'kumamoto', 'scenery',
      '阿蘇の大観峰から見る雲海、早起きした人だけのご褒美ばい。秋の朝が狙い目！',
      5 * HOUR, 31, [
        { authorId: 'seed-user-ひなた暮らし', authorName: 'ひなた暮らし', authorPref: 'miyazaki', text: '写真で見たことあるけど本物見てみたい…！' },
        { authorId: 'seed-user-湯けむり旅人', authorName: '湯けむり旅人', authorPref: 'oita', text: 'やまなみハイウェイ経由で大分から来ると最高よ' },
      ]),
    p('4', 'ちゃんぽん男子', 'nagasaki', 'nagasaki', 'scenery',
      '稲佐山の夜景は「世界新三大夜景」。ロープウェイで上がるとき、街の灯りがだんだん広がっていくのがたまらん。',
      9 * HOUR, 18),
    p('5', 'ひなた暮らし', 'miyazaki', 'miyazaki', 'gourmet',
      'チキン南蛮は発祥の店で食べるとタルタルの概念が変わるっちゃ。あと冷や汁も夏の定番！',
      14 * HOUR, 15),
    p('6', '桜島ウォッチャー', 'kagoshima', 'kagoshima', 'dialect',
      '鹿児島弁クイズ：「だれやめ」ってどういう意味でしょう？\n答え：晩酌（疲れ＝だれ を止める）。焼酎文化らしか言葉です🍶',
      26 * HOUR, 27, [
        { authorId: 'seed-user-博多っ子', authorName: '博多っ子', authorPref: 'fukuoka', text: '素敵な言葉！今日から使お' },
      ]),
    p('7', 'がばいさがんもん', 'saga', 'saga', 'hidden',
      '呼子の朝市→イカの活き造りのコースは鉄板。透き通ったイカ、ゲソは天ぷらにしてもらえるとよ。',
      2 * 24 * HOUR, 22),
    p('8', '島んちゅ', 'okinawa', 'okinawa', 'scenery',
      '古宇利大橋を渡るときの海の色、写真じゃ伝わらんくらいの青さ。九州から沖縄、フェリー旅もおすすめ！',
      3 * 24 * HOUR, 19),
    p('9', '湯けむり旅人', 'oita', 'saga', 'onsen',
      '大分県民ばってん、佐賀の嬉野温泉の「とろける湯」はほんとにお肌すべすべになる。湯豆腐も絶品。',
      4 * 24 * HOUR, 11),
    p('10', '博多っ子', 'fukuoka', 'fukuoka', 'festival',
      '博多祇園山笠の追い山、早朝4時59分スタート。街全体が「オイサッ」の掛け声に包まれる瞬間は鳥肌もの。',
      5 * 24 * HOUR, 24),
  ];
}
