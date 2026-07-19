import type { ComponentType } from 'react';
import { Anchor, Music, Waves, Rocket, Users, Compass, Ship, Sparkles, MapPin, Landmark, Timer, Flag } from 'lucide-react';

export type StoryChapter = {
  slug: string;
  era: string;
  title: string;
  lead: string;
  body: string[];
  quote: string;
  coords: string;
  icon: ComponentType<{ className?: string }>;
  accent: 'sunrise' | 'sky' | 'amber';
};

export const STORY_CHAPTERS: StoryChapter[] = [
  {
    slug: 'history',
    era: 'HISTORY — 1889〜',
    title: '鉄と海が、この街の血になった。',
    lead: '鎮守府が置かれ、日本有数の軍港として名を馳せた佐世保。錆びついた戦艦を蘇らせてきた造船の技術は、いまも港のクレーンに、街の誇りとして宿っている。',
    body: [
      '1889年、佐世保に鎮守府が開庁した日から、この街の時計は「鉄」を軸に回り始めた。人口はわずか数年で数倍に膨れ上がり、静かな漁村は日本有数の軍港都市へと姿を変えた。',
      '戦艦を生み、直し、送り出してきた造船の技術は、単なる産業遺産ではない。ミリ単位の精度を人の手で叩き出す職人気質は、いまも重工業の現場に受け継がれ、次の時代のものづくりを支えている。',
      '港に並ぶ巨大なクレーンは、過去の栄光を懐かしむための置物ではない。今日も現役で船を組み上げ続ける、佐世保の「現在進行形の歴史」だ。',
    ],
    quote: '衰退の記憶ではなく、更新され続ける技術として。',
    coords: '33.1608°N, 129.7233°E',
    icon: Anchor,
    accent: 'sunrise',
  },
  {
    slug: 'culture',
    era: 'CULTURE — 1950s〜',
    title: 'ジャズが流れ、世界が交差した。',
    lead: '基地の街として、この街には「日本のどこにもない匂い」が流れ込んだ。佐世保バーガーの誕生も、路地に響くジャズも、異国と地元がぶつかり合って生まれた副産物。',
    body: [
      '米海軍基地の存在は、佐世保に良くも悪くも「異物」を運び続けた。戦後まもなく、基地の兵士たちが持ち込んだ本場のハンバーガーは、地元の食堂の手によって独自の進化を遂げ、「佐世保バーガー」という固有名詞になった。',
      '夜の路地には、本場仕込みのジャズが流れる店が今も点在する。生演奏の熱量は、観光地化されたノスタルジーではなく、いまを生きるミュージシャンたちの現在進行形のステージだ。',
      '和と洋、地元と異国。相反する二つの文化が同じ通りで共存できるのは、佐世保という街が持つ独特の「懐の深さ」の証明でもある。',
    ],
    quote: '混ざりものであることは、この街では弱点じゃない。武器だ。',
    coords: 'SASEBO / SHIMPOJI ST.',
    icon: Music,
    accent: 'amber',
  },
  {
    slug: 'nature',
    era: 'NATURE — 208 islands',
    title: '208の島が、静かに手招きする。',
    lead: '九十九島の多島美は、世界に誇れる「なんでもない日常の絶景」。人の営みのすぐ隣に、圧倒的な自然が当たり前の顔をして広がっている。',
    body: [
      '「九十九島」という名前が付いているが、実際に浮かぶ島の数は208。数える気を失うほどの数の島々が、リアス式海岸に沿って静かに横たわっている。',
      '観光客がわざわざ写真を撮りに来る夕景を、地元の高校生は自転車通学の途中に、当たり前の顔をして通り過ぎていく。その温度差こそが、佐世保の自然の本当の価値だ。',
      '遊覧船に乗らなくても、街のいたるところの高台から多島美を見渡せる。特別な予定がなくても、圧倒的な景色に出会えてしまう街に住むということ。',
    ],
    quote: '絶景は、非日常じゃない。佐世保では日常の一部だ。',
    coords: 'KUJUKUSHIMA PEARL SEA',
    icon: Waves,
    accent: 'sky',
  },
];

export type Feature = {
  title: string;
  body: string;
  tag: string;
  icon: ComponentType<{ className?: string }>;
  pattern: 'grid' | 'radial' | 'waves' | 'nodes' | 'contour' | 'mix';
  big?: boolean;
};

export const FEATURES: Feature[] = [
  {
    title: '世界と直結する港',
    body: '軍港から続く国際航路の血脈。ここにいながら、世界とつながる感覚がある。',
    tag: 'GLOBAL',
    icon: Ship,
    pattern: 'nodes',
    big: true,
  },
  {
    title: '30分で全部揃う密度',
    body: '海も、山も、繁華街も、車で30分圏内。移動時間に人生を溶かさなくていい。',
    tag: 'COMPACT',
    icon: Compass,
    pattern: 'contour',
  },
  {
    title: '挑戦者を歓迎する土壌',
    body: '基地文化とベンチャー気質が混在する街。新参者に優しいのは、昔からずっとそう。',
    tag: 'OPEN',
    icon: Rocket,
    pattern: 'radial',
  },
  {
    title: '濃度の高い人間関係',
    body: '人口は多すぎず、少なすぎない。顔が見える距離感で、本気の仲間が見つかる。',
    tag: 'CLOSE',
    icon: Users,
    pattern: 'nodes',
  },
  {
    title: '日常が絶景という反則',
    body: '通学路の途中に、観光客が写真を撮る夕景がある。それが佐世保の当たり前。',
    tag: 'SCENIC',
    icon: MapPin,
    pattern: 'waves',
  },
  {
    title: '混ざりものが正義',
    body: '和と洋、軍と民、都市と自然。相反するものが同居する街だけが持てる自由がある。',
    tag: 'MIX',
    icon: Sparkles,
    pattern: 'mix',
  },
];

export type Stat = {
  value: number;
  suffix: string;
  label: string;
  note: string;
  icon: ComponentType<{ className?: string }>;
};

export const STATS: Stat[] = [
  { value: 208, suffix: '島', label: '九十九島の島数', note: 'KUJUKUSHIMA ISLANDS', icon: Waves },
  { value: 130, suffix: '年+', label: '鎮守府開庁からの歴史', note: 'SINCE 1889', icon: Landmark },
  { value: 30, suffix: '分', label: '海も山も繁華街も', note: 'ALL WITHIN REACH', icon: Timer },
  { value: 1946, suffix: '', label: '異国文化が根付いた年', note: 'US NAVY BASE ERA', icon: Flag },
];

export type Challenger = {
  slug: string;
  name: string;
  age: number;
  role: string;
  initial: string;
  quote: string;
  body: string;
  tag: string;
};

export const CHALLENGERS: Challenger[] = [
  {
    slug: 'shipwright',
    name: '造船の現場から',
    age: 27,
    role: '溶接工 / 三代目',
    initial: '鉄',
    quote: '祖父が直した戦艦を、俺は次の船で超える。',
    body: '祖父も父も造船所で働いた家に生まれた。同じ現場に立つと決めたのは、古いからじゃない。ミリ単位で船体を組む技術は、どんなロボットもまだ真似できない。伝統は、更新し続けるから伝統になる。',
    tag: 'SHIPYARD',
  },
  {
    slug: 'jazzbar',
    name: '路地のジャズバーから',
    age: 34,
    role: '奏者 / バーオーナー',
    initial: '音',
    quote: '東京から来て気づいた。ここの夜は、自由に鳴っている。',
    body: '都会のジャズは「聴かせる」演奏だった。佐世保に来て、初めて「鳴らす」演奏を覚えた。基地の街だから流れ着いた音楽が、いまは地元のミュージシャンの手で新しい曲になっている。',
    tag: 'MUSIC',
  },
  {
    slug: 'islandtour',
    name: '九十九島の船上から',
    age: 24,
    role: '漁師 / 観光ガイド',
    initial: '海',
    quote: '観光客が驚く景色が、俺の通勤路。それに気づいたら人生変わった。',
    body: '漁を継ぐだけのつもりだった。でも船に乗せた旅行者の顔を見て、当たり前だと思っていた景色の価値に気づいた。いまは漁の合間に、島々を案内するツアーを自分でつくっている。',
    tag: 'SEA',
  },
];
