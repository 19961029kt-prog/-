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
  /** Firebase AuthenticationのUID */
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
  commentCount: number;
}
