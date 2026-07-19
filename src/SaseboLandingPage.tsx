import { useRef } from 'react';
import type { ComponentType } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import {
  Anchor,
  Music,
  Waves,
  Rocket,
  Users,
  Compass,
  Ship,
  Sparkles,
  ArrowRight,
  ChevronDown,
  MapPin,
} from 'lucide-react';

type StoryChapter = {
  id: string;
  era: string;
  title: string;
  body: string;
  image: string;
  icon: ComponentType<{ className?: string }>;
};

type Feature = {
  title: string;
  body: string;
  image: string;
  icon: ComponentType<{ className?: string }>;
};

const STORY_CHAPTERS: StoryChapter[] = [
  {
    id: 'history',
    era: 'HISTORY — 1889〜',
    title: '鉄と海が、この街の血になった。',
    body: '鎮守府が置かれ、日本有数の軍港として名を馳せた佐世保。錆びついた戦艦を蘇らせてきた造船の技術は、いまも港のクレーンに、街の誇りとして宿っている。',
    image: 'https://placehold.co/800x900/0b1226/f97316?text=Sasebo+Naval+Port+1889',
    icon: Anchor,
  },
  {
    id: 'culture',
    era: 'CULTURE — 1950s〜',
    title: 'ジャズが流れ、世界が交差した。',
    body: '基地の街として、この街には「日本のどこにもない匂い」が流れ込んだ。佐世保バーガーの誕生も、路地に響くジャズも、異国と地元がぶつかり合って生まれた副産物。',
    image: 'https://placehold.co/800x900/101a36/fb923c?text=Sasebo+Jazz+%26+Burger+Culture',
    icon: Music,
  },
  {
    id: 'nature',
    era: 'NATURE — 208 islands',
    title: '208の島が、静かに手招きする。',
    body: '九十九島の多島美は、世界に誇れる「なんでもない日常の絶景」。人の営みのすぐ隣に、圧倒的な自然が当たり前の顔をして広がっている。',
    image: 'https://placehold.co/800x900/082f49/38bdf8?text=Kujukushima+208+Islands',
    icon: Waves,
  },
];

const FEATURES: Feature[] = [
  {
    title: '世界と直結する港',
    body: '軍港から続く国際航路の血脈。ここにいながら、世界とつながる感覚がある。',
    image: 'https://placehold.co/600x400/0b1226/f97316?text=Global+Port',
    icon: Ship,
  },
  {
    title: '30分で全部揃う密度',
    body: '海も、山も、繁華街も、車で30分圏内。移動時間に人生を溶かさなくていい。',
    image: 'https://placehold.co/600x400/101a36/fb923c?text=30min+Radius',
    icon: Compass,
  },
  {
    title: '挑戦者を歓迎する土壌',
    body: '基地文化とベンチャー気質が混在する街。新参者に優しいのは、昔からずっとそう。',
    image: 'https://placehold.co/600x400/0b1226/fbbf6d?text=Challenger+Friendly',
    icon: Rocket,
  },
  {
    title: '濃度の高い人間関係',
    body: '人口は多すぎず、少なすぎない。顔が見える距離感で、本気の仲間が見つかる。',
    image: 'https://placehold.co/600x400/082f49/38bdf8?text=Real+Connections',
    icon: Users,
  },
  {
    title: '日常が絶景という反則',
    body: '通学路の途中に、観光客が写真を撮る夕景がある。それが佐世保の当たり前。',
    image: 'https://placehold.co/600x400/0b1226/f97316?text=Everyday+Scenery',
    icon: MapPin,
  },
  {
    title: '混ざりものが正義',
    body: '和と洋、軍と民、都市と自然。相反するものが同居する街だけが持てる自由がある。',
    image: 'https://placehold.co/600x400/101a36/fbbf6d?text=Cultural+Mix',
    icon: Sparkles,
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0 },
};

function Hero() {
  return (
    <section className="relative flex h-screen min-h-[720px] w-full items-center justify-center overflow-hidden bg-navy-950">
      <div className="pointer-events-none absolute inset-0">
        <img
          src="https://placehold.co/1920x1080/04070f/1e293b?text=Sasebo+Night+Sea"
          alt=""
          className="h-full w-full object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-950/60 to-navy-950/20" />
        <div className="absolute inset-0 bg-gradient-to-r from-navy-950/80 via-transparent to-navy-950/80" />
      </div>

      <motion.div
        initial="hidden"
        animate="visible"
        transition={{ staggerChildren: 0.15, delayChildren: 0.2 }}
        className="relative z-10 mx-auto flex max-w-5xl flex-col items-center px-6 text-center"
      >
        <motion.span
          variants={fadeUp}
          transition={{ duration: 0.7 }}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-sunrise-500/40 bg-sunrise-500/10 px-4 py-1.5 text-xs font-bold tracking-[0.3em] text-sunrise-400"
        >
          SASEBO / NEXT GENERATION
        </motion.span>

        <motion.h1
          variants={fadeUp}
          transition={{ duration: 0.8 }}
          className="font-display text-5xl font-black leading-[1.1] tracking-tight text-white sm:text-7xl md:text-8xl"
        >
          この街には、
          <br />
          まだ見ぬ
          <span className="bg-sunrise-gradient bg-clip-text text-transparent">自分</span>
          がいる。
        </motion.h1>

        <motion.p
          variants={fadeUp}
          transition={{ duration: 0.8 }}
          className="mt-8 max-w-2xl text-base font-medium leading-relaxed text-slate-300 sm:text-lg"
        >
          鉄の記憶、異国の音、208の島。佐世保は、退屈な地方都市じゃない。
          <br />
          まだ誰も気づいていない、ポテンシャルの塊だ。
        </motion.p>

        <motion.div variants={fadeUp} transition={{ duration: 0.8 }} className="mt-12">
          <a
            href="#story"
            className="group inline-flex items-center gap-2 rounded-full bg-sunrise-gradient px-8 py-4 text-sm font-bold tracking-wide text-navy-950 shadow-lg shadow-sunrise-500/30 transition-transform duration-300 hover:scale-105"
          >
            街の正体を見にいく
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </a>
        </motion.div>
      </motion.div>

      <motion.div
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute bottom-10 z-10 flex flex-col items-center gap-1 text-slate-400"
      >
        <span className="text-[10px] tracking-[0.3em]">SCROLL</span>
        <ChevronDown className="h-5 w-5" />
      </motion.div>
    </section>
  );
}

function StoryTimeline() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start center', 'end center'],
  });
  const lineScale = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <section id="story" className="relative bg-navy-900 py-32">
      <div className="mx-auto max-w-4xl px-6 text-center">
        <p className="text-xs font-bold tracking-[0.3em] text-sunrise-500">OUR STORY</p>
        <h2 className="mt-4 font-display text-3xl font-black text-white sm:text-5xl">
          過去が、いまの佐世保をつくった。
        </h2>
      </div>

      <div ref={containerRef} className="relative mx-auto mt-24 max-w-3xl px-6">
        <div className="absolute left-6 top-0 h-full w-px bg-slate-700/60 sm:left-1/2" />
        <motion.div
          style={{ scaleY: lineScale }}
          className="absolute left-6 top-0 h-full w-px origin-top bg-sunrise-gradient sm:left-1/2"
        />

        <div className="flex flex-col gap-28">
          {STORY_CHAPTERS.map((chapter, index) => {
            const Icon = chapter.icon;
            const isEven = index % 2 === 0;
            return (
              <motion.div
                key={chapter.id}
                initial={{ opacity: 0, y: 60 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
                className={`relative flex flex-col gap-6 pl-16 sm:pl-0 ${
                  isEven ? 'sm:flex-row' : 'sm:flex-row-reverse'
                } sm:items-center sm:gap-16`}
              >
                <div className="absolute left-6 top-1 z-10 -translate-x-1/2 sm:left-1/2">
                  <motion.div
                    whileInView={{ scale: [0.6, 1.2, 1] }}
                    viewport={{ once: true, amount: 0.6 }}
                    transition={{ duration: 0.6 }}
                    className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-sunrise-500 bg-navy-950 shadow-lg shadow-sunrise-500/40"
                  >
                    <Icon className="h-4 w-4 text-sunrise-400" />
                  </motion.div>
                </div>

                <div className="sm:w-1/2">
                  <img
                    src={chapter.image}
                    alt={chapter.title}
                    className="w-full rounded-2xl border border-white/10 shadow-2xl transition-transform duration-500 hover:scale-[1.03]"
                  />
                </div>

                <div className={`sm:w-1/2 ${isEven ? 'sm:text-left' : 'sm:text-right'}`}>
                  <span className="text-xs font-bold tracking-[0.25em] text-sunrise-500">
                    {chapter.era}
                  </span>
                  <h3 className="mt-3 font-display text-2xl font-black leading-snug text-white sm:text-3xl">
                    {chapter.title}
                  </h3>
                  <p className="mt-4 text-sm leading-relaxed text-slate-400 sm:text-base">
                    {chapter.body}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section className="relative bg-navy-950 py-32">
      <div className="mx-auto max-w-5xl px-6 text-center">
        <p className="text-xs font-bold tracking-[0.3em] text-sunrise-500">POTENTIAL</p>
        <h2 className="mt-4 font-display text-3xl font-black text-white sm:text-5xl">
          退屈だと思っていた日常が、
          <br className="hidden sm:block" />
          実は武器だった。
        </h2>
      </div>

      <div className="mx-auto mt-20 grid max-w-6xl grid-cols-1 gap-6 px-6 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature) => {
          const Icon = feature.icon;
          return (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              whileHover={{ y: -10, scale: 1.02 }}
              transition={{ duration: 0.5 }}
              className="group overflow-hidden rounded-2xl border border-white/10 bg-navy-800/60 shadow-xl"
            >
              <div className="relative h-40 overflow-hidden">
                <img
                  src={feature.image}
                  alt={feature.title}
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-navy-950 to-transparent" />
                <div className="absolute bottom-3 left-3 flex h-9 w-9 items-center justify-center rounded-full bg-sunrise-gradient">
                  <Icon className="h-4 w-4 text-navy-950" />
                </div>
              </div>
              <div className="p-6 text-left">
                <h3 className="font-display text-lg font-bold text-white">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{feature.body}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

function Cta() {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <section className="relative overflow-hidden bg-navy-900 py-32">
      <div className="pointer-events-none absolute inset-0 opacity-30">
        <img
          src="https://placehold.co/1920x1080/f97316/0b1226?text=Sasebo+Sunrise"
          alt=""
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-navy-900/80" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.7 }}
        className="relative z-10 mx-auto max-w-3xl px-6 text-center"
      >
        <h2 className="font-display text-4xl font-black leading-tight text-white sm:text-6xl">
          変わるのは、佐世保じゃない。
          <br />
          <span className="bg-sunrise-gradient bg-clip-text text-transparent">
            佐世保を見る、あなたの目だ。
          </span>
        </h2>
        <p className="mt-6 text-base text-slate-300 sm:text-lg">
          鉄の記憶も、異国の音も、208の島も。
          <br />
          この街の続きは、まだ誰も書いていない。
        </p>
        <button
          onClick={scrollToTop}
          className="group mt-10 inline-flex items-center gap-2 rounded-full bg-sunrise-gradient px-10 py-4 text-sm font-bold tracking-wide text-navy-950 shadow-lg shadow-sunrise-500/40 transition-transform duration-300 hover:scale-105"
        >
          もう一度、佐世保をたどる
          <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
        </button>
      </motion.div>
    </section>
  );
}

export default function SaseboLandingPage() {
  return (
    <div className="min-h-screen w-full bg-navy-950 font-display">
      <header className="fixed inset-x-0 top-0 z-50 flex items-center justify-between px-6 py-5 sm:px-10">
        <span className="text-sm font-black tracking-[0.2em] text-white">SASEBO/</span>
        <span className="hidden text-xs tracking-[0.2em] text-slate-400 sm:block">
          NAGASAKI, JAPAN
        </span>
      </header>
      <Hero />
      <StoryTimeline />
      <Features />
      <Cta />
      <footer className="bg-navy-950 py-10 text-center text-xs tracking-widest text-slate-500">
        SASEBO BRANDING PROJECT — FOR THE NEXT GENERATION
      </footer>
    </div>
  );
}
