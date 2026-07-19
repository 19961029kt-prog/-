import { useEffect, useRef, useState } from 'react';
import type { ComponentType, ReactNode } from 'react';
import {
  motion,
  useInView,
  useMotionValue,
  useMotionValueEvent,
  useScroll,
  useSpring,
  useTransform,
  AnimatePresence,
} from 'framer-motion';
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
  Landmark,
  Timer,
  Flag,
} from 'lucide-react';

type StoryChapter = {
  id: string;
  era: string;
  title: string;
  body: string;
  image: string;
  coords: string;
  icon: ComponentType<{ className?: string }>;
};

type Feature = {
  title: string;
  body: string;
  tag: string;
  image: string;
  icon: ComponentType<{ className?: string }>;
  big?: boolean;
};

type Stat = {
  value: number;
  suffix: string;
  label: string;
  note: string;
  icon: ComponentType<{ className?: string }>;
};

const NOISE_SVG =
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>";
const NOISE_URL = `url("data:image/svg+xml,${NOISE_SVG.replace(/#/g, '%23')}")`;

const STORY_CHAPTERS: StoryChapter[] = [
  {
    id: 'history',
    era: 'HISTORY — 1889〜',
    title: '鉄と海が、この街の血になった。',
    body: '鎮守府が置かれ、日本有数の軍港として名を馳せた佐世保。錆びついた戦艦を蘇らせてきた造船の技術は、いまも港のクレーンに、街の誇りとして宿っている。',
    image: 'https://placehold.co/900x1100/0b1226/f97316?text=Sasebo+Naval+Port+1889',
    coords: '33.1608°N, 129.7233°E',
    icon: Anchor,
  },
  {
    id: 'culture',
    era: 'CULTURE — 1950s〜',
    title: 'ジャズが流れ、世界が交差した。',
    body: '基地の街として、この街には「日本のどこにもない匂い」が流れ込んだ。佐世保バーガーの誕生も、路地に響くジャズも、異国と地元がぶつかり合って生まれた副産物。',
    image: 'https://placehold.co/900x1100/101a36/fb923c?text=Sasebo+Jazz+%26+Burger',
    coords: 'SASEBO / SHIMPOJI ST.',
    icon: Music,
  },
  {
    id: 'nature',
    era: 'NATURE — 208 islands',
    title: '208の島が、静かに手招きする。',
    body: '九十九島の多島美は、世界に誇れる「なんでもない日常の絶景」。人の営みのすぐ隣に、圧倒的な自然が当たり前の顔をして広がっている。',
    image: 'https://placehold.co/900x1100/082f49/38bdf8?text=Kujukushima+208+Islands',
    coords: 'KUJUKUSHIMA PEARL SEA',
    icon: Waves,
  },
];

const FEATURES: Feature[] = [
  {
    title: '世界と直結する港',
    body: '軍港から続く国際航路の血脈。ここにいながら、世界とつながる感覚がある。',
    tag: 'GLOBAL',
    image: 'https://placehold.co/900x700/0b1226/f97316?text=Global+Port',
    icon: Ship,
    big: true,
  },
  {
    title: '30分で全部揃う密度',
    body: '海も、山も、繁華街も、車で30分圏内。移動時間に人生を溶かさなくていい。',
    tag: 'COMPACT',
    image: 'https://placehold.co/700x500/101a36/fb923c?text=30min+Radius',
    icon: Compass,
  },
  {
    title: '挑戦者を歓迎する土壌',
    body: '基地文化とベンチャー気質が混在する街。新参者に優しいのは、昔からずっとそう。',
    tag: 'OPEN',
    image: 'https://placehold.co/700x500/0b1226/fbbf6d?text=Challenger+Friendly',
    icon: Rocket,
  },
  {
    title: '濃度の高い人間関係',
    body: '人口は多すぎず、少なすぎない。顔が見える距離感で、本気の仲間が見つかる。',
    tag: 'CLOSE',
    image: 'https://placehold.co/700x500/082f49/38bdf8?text=Real+Connections',
    icon: Users,
  },
  {
    title: '日常が絶景という反則',
    body: '通学路の途中に、観光客が写真を撮る夕景がある。それが佐世保の当たり前。',
    tag: 'SCENIC',
    image: 'https://placehold.co/700x500/0b1226/f97316?text=Everyday+Scenery',
    icon: MapPin,
  },
  {
    title: '混ざりものが正義',
    body: '和と洋、軍と民、都市と自然。相反するものが同居する街だけが持てる自由がある。',
    tag: 'MIX',
    image: 'https://placehold.co/700x500/101a36/fbbf6d?text=Cultural+Mix',
    icon: Sparkles,
  },
];

const STATS: Stat[] = [
  { value: 208, suffix: '島', label: '九十九島の島数', note: 'KUJUKUSHIMA ISLANDS', icon: Waves },
  { value: 130, suffix: '年+', label: '鎮守府開庁からの歴史', note: 'SINCE 1889', icon: Landmark },
  { value: 30, suffix: '分', label: '海も山も繁華街も', note: 'ALL WITHIN REACH', icon: Timer },
  { value: 1946, suffix: '', label: '異国文化が根付いた年', note: 'US NAVY BASE ERA', icon: Flag },
];

function Grain() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-[70] opacity-[0.05] mix-blend-overlay"
      style={{ backgroundImage: NOISE_URL }}
    />
  );
}

function ScrollProgressBar() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 200, damping: 40, restDelta: 0.001 });
  return (
    <motion.div
      style={{ scaleX }}
      className="fixed inset-x-0 top-0 z-[80] h-[3px] origin-left bg-sunrise-gradient"
    />
  );
}

function Marquee({ text, className, duration = 'animate-marquee' }: { text: string; className?: string; duration?: string }) {
  const block = (key: number) => (
    <span key={key} className="flex shrink-0 items-center">
      {Array.from({ length: 8 }).map((_, i) => (
        <span key={i} className="mx-6 shrink-0">
          {text}
        </span>
      ))}
    </span>
  );
  return (
    <div className={`relative flex overflow-hidden whitespace-nowrap ${className ?? ''}`}>
      <div className={`flex shrink-0 ${duration}`}>
        {block(0)}
        {block(1)}
      </div>
    </div>
  );
}

function MagneticButton({
  children,
  onClick,
  href,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 200, damping: 15, mass: 0.4 });
  const springY = useSpring(y, { stiffness: 200, damping: 15, mass: 0.4 });

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    x.set((e.clientX - rect.left - rect.width / 2) * 0.35);
    y.set((e.clientY - rect.top - rect.height / 2) * 0.35);
  };
  const reset = () => {
    x.set(0);
    y.set(0);
  };

  const Tag = href ? 'a' : 'button';

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={reset}
      style={{ x: springX, y: springY }}
      className="inline-block"
    >
      <Tag
        href={href}
        onClick={onClick}
        className={`group inline-flex items-center gap-2 rounded-full bg-sunrise-gradient px-9 py-4 text-sm font-bold tracking-wide text-navy-950 shadow-lg shadow-sunrise-500/40 ${className ?? ''}`}
      >
        {children}
      </Tag>
    </motion.div>
  );
}

function TiltCard({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const springRX = useSpring(rotateX, { stiffness: 180, damping: 18 });
  const springRY = useSpring(rotateY, { stiffness: 180, damping: 18 });

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    rotateY.set(px * 10);
    rotateX.set(py * -10);
  };
  const reset = () => {
    rotateX.set(0);
    rotateY.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={reset}
      style={{ rotateX: springRX, rotateY: springRY, transformPerspective: 900 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function CountUp({ target, suffix }: { target: number; suffix: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.6 });
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    let raf: number;
    let start: number | null = null;
    const duration = 1600;
    const step = (ts: number) => {
      if (start === null) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      setValue(Math.floor(progress * target));
      if (progress < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [isInView, target]);

  return (
    <span ref={ref} className="font-display text-5xl font-black text-white sm:text-6xl">
      {value.toLocaleString()}
      <span className="ml-1 text-2xl font-bold text-sunrise-400 sm:text-3xl">{suffix}</span>
    </span>
  );
}

function Hero() {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const bgY = useTransform(scrollYProgress, [0, 1], ['0%', '30%']);
  const textOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const textScale = useTransform(scrollYProgress, [0, 1], [1, 1.08]);

  const [spot, setSpot] = useState({ x: 50, y: 50 });
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = heroRef.current?.getBoundingClientRect();
    if (!rect) return;
    setSpot({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  };

  return (
    <section
      ref={heroRef}
      onMouseMove={handleMouseMove}
      className="relative flex h-screen min-h-[720px] w-full items-center justify-center overflow-hidden bg-navy-950"
    >
      <motion.div style={{ y: bgY }} className="pointer-events-none absolute inset-0 scale-110">
        <img
          src="https://placehold.co/1920x1200/04070f/1e293b?text=Sasebo+Night+Sea"
          alt=""
          className="h-full w-full object-cover opacity-50"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-950/70 to-navy-950/30" />
        <div className="absolute inset-0 bg-gradient-to-r from-navy-950/80 via-transparent to-navy-950/80" />
      </motion.div>

      <div
        className="pointer-events-none absolute inset-0 opacity-70 transition-opacity duration-300"
        style={{
          background: `radial-gradient(650px circle at ${spot.x}% ${spot.y}%, rgba(249,115,22,0.16), transparent 55%)`,
        }}
      />

      <div className="pointer-events-none absolute -left-40 top-10 h-96 w-96 rounded-full bg-sunrise-600/20 blur-3xl animate-blob" />
      <div className="pointer-events-none absolute -right-32 bottom-0 h-[28rem] w-[28rem] rounded-full bg-sky-500/10 blur-3xl animate-blob-delay" />

      <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 select-none">
        <Marquee
          text="SASEBO　"
          duration="animate-marquee-slow"
          className="text-[16vw] font-black leading-none text-white/[0.04] sm:text-[13vw]"
        />
      </div>

      <motion.div
        style={{ opacity: textOpacity, scale: textScale }}
        initial="hidden"
        animate="visible"
        transition={{ staggerChildren: 0.15, delayChildren: 0.2 }}
        className="relative z-10 mx-auto flex max-w-5xl flex-col items-center px-6 text-center"
      >
        <motion.span
          variants={{ hidden: { opacity: 0, y: 40 }, visible: { opacity: 1, y: 0 } }}
          transition={{ duration: 0.7 }}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-sunrise-500/40 bg-sunrise-500/10 px-4 py-1.5 text-xs font-bold tracking-[0.3em] text-sunrise-400 backdrop-blur"
        >
          SASEBO / NEXT GENERATION
        </motion.span>

        <motion.h1
          variants={{ hidden: { opacity: 0, y: 40 }, visible: { opacity: 1, y: 0 } }}
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
          variants={{ hidden: { opacity: 0, y: 40 }, visible: { opacity: 1, y: 0 } }}
          transition={{ duration: 0.8 }}
          className="mt-8 max-w-2xl text-base font-medium leading-relaxed text-slate-300 sm:text-lg"
        >
          鉄の記憶、異国の音、208の島。佐世保は、退屈な地方都市じゃない。
          <br />
          まだ誰も気づいていない、ポテンシャルの塊だ。
        </motion.p>

        <motion.div
          variants={{ hidden: { opacity: 0, y: 40 }, visible: { opacity: 1, y: 0 } }}
          transition={{ duration: 0.8 }}
          className="mt-12"
        >
          <MagneticButton href="#story" className="hover:brightness-110">
            街の正体を見にいく
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </MagneticButton>
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
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ['start start', 'end end'] });
  const [active, setActive] = useState(0);

  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    const index = Math.min(STORY_CHAPTERS.length - 1, Math.floor(v * STORY_CHAPTERS.length));
    setActive(index);
  });

  const ActiveIcon = STORY_CHAPTERS[active].icon;

  return (
    <section id="story" className="relative bg-navy-900 py-32">
      <div className="mx-auto max-w-4xl px-6 text-center">
        <p className="text-xs font-bold tracking-[0.3em] text-sunrise-500">OUR STORY</p>
        <h2 className="mt-4 font-display text-3xl font-black text-white sm:text-5xl">
          過去が、いまの佐世保をつくった。
        </h2>
      </div>

      <div ref={containerRef} className="relative mx-auto mt-24 grid max-w-6xl grid-cols-1 gap-x-16 px-6 lg:grid-cols-2">
        <div className="flex flex-col gap-[18vh] pb-[20vh]">
          {STORY_CHAPTERS.map((chapter, index) => {
            const Icon = chapter.icon;
            return (
              <motion.div
                key={chapter.id}
                initial={{ opacity: 0, y: 60 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.5 }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
                className="relative flex min-h-[40vh] flex-col justify-center"
              >
                <span className="pointer-events-none absolute -left-4 -top-10 font-display text-[8rem] font-black leading-none text-white/[0.04] sm:text-[10rem]">
                  {String(index + 1).padStart(2, '0')}
                </span>

                <div className="relative flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-sunrise-500/50 bg-navy-950">
                    <Icon className="h-4 w-4 text-sunrise-400" />
                  </span>
                  <span className="text-xs font-bold tracking-[0.25em] text-sunrise-500">{chapter.era}</span>
                </div>

                <h3 className="relative mt-5 font-display text-3xl font-black leading-snug text-white sm:text-4xl">
                  {chapter.title}
                </h3>
                <p className="relative mt-4 max-w-md text-sm leading-relaxed text-slate-400 sm:text-base">
                  {chapter.body}
                </p>

                <div className="relative mt-6 flex items-center gap-2 lg:hidden">
                  <img
                    src={chapter.image}
                    alt={chapter.title}
                    className="w-full rounded-2xl border border-white/10 shadow-2xl"
                  />
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="relative hidden lg:block">
          <div className="sticky top-24 h-[70vh] w-full">
            <div className="relative h-full w-full overflow-hidden rounded-3xl border border-white/10 shadow-2xl shadow-black/50">
              <AnimatePresence mode="sync">
                <motion.img
                  key={STORY_CHAPTERS[active].id}
                  src={STORY_CHAPTERS[active].image}
                  alt={STORY_CHAPTERS[active].title}
                  initial={{ opacity: 0, scale: 1.15 }}
                  animate={{ opacity: 1, scale: 1.05 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.1, ease: 'easeOut' }}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </AnimatePresence>

              <div
                className="pointer-events-none absolute inset-0 mix-blend-overlay opacity-40"
                style={{ backgroundImage: NOISE_URL }}
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-navy-950/90 via-transparent to-navy-950/40" />

              <span className="absolute left-6 top-6 h-8 w-8 rounded-full border-2 border-sunrise-500 bg-navy-950/80 backdrop-blur">
                <ActiveIcon className="m-auto h-4 w-4 translate-y-2 text-sunrise-400" />
              </span>

              <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between">
                <span className="font-mono text-[10px] tracking-widest text-slate-300">
                  {STORY_CHAPTERS[active].coords}
                </span>
                <div className="flex gap-1.5">
                  {STORY_CHAPTERS.map((c, i) => (
                    <span
                      key={c.id}
                      className={`h-1.5 rounded-full transition-all duration-500 ${
                        i === active ? 'w-6 bg-sunrise-500' : 'w-1.5 bg-white/30'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <span className="absolute left-4 top-4 h-4 w-4 border-l-2 border-t-2 border-white/40" />
              <span className="absolute bottom-4 right-4 h-4 w-4 border-b-2 border-r-2 border-white/40" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Stats() {
  return (
    <section className="relative overflow-hidden bg-navy-950 py-24">
      <div className="pointer-events-none absolute inset-0 opacity-[0.03]" style={{ backgroundImage: NOISE_URL }} />
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-6 gap-y-14 px-6 lg:grid-cols-4">
        {STATS.map((stat) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.6 }}
              transition={{ duration: 0.6 }}
              className="flex flex-col items-center text-center"
            >
              <Icon className="mb-3 h-6 w-6 text-sunrise-500" />
              <CountUp target={stat.value} suffix={stat.suffix} />
              <p className="mt-2 text-sm font-bold text-white">{stat.label}</p>
              <p className="mt-1 text-[10px] tracking-[0.2em] text-slate-500">{stat.note}</p>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

function Features() {
  return (
    <section className="relative bg-navy-900 py-32">
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
              transition={{ duration: 0.5 }}
              className={feature.big ? 'sm:col-span-2 lg:row-span-2' : ''}
            >
              <TiltCard className="group relative h-full overflow-hidden rounded-2xl border border-white/10 bg-navy-800/60 shadow-xl">
                <div className={`relative overflow-hidden ${feature.big ? 'h-56 lg:h-[calc(100%-9rem)]' : 'h-40'}`}>
                  <img
                    src={feature.image}
                    alt={feature.title}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-950/10 to-transparent" />
                  <div className="absolute inset-0 bg-sunrise-500/0 transition-colors duration-500 group-hover:bg-sunrise-500/10" />
                  <span className="absolute left-3 top-3 rounded-full border border-white/20 bg-navy-950/70 px-2.5 py-1 text-[10px] font-bold tracking-widest text-slate-200 backdrop-blur">
                    {feature.tag}
                  </span>
                  <div className="absolute bottom-3 left-3 flex h-9 w-9 items-center justify-center rounded-full bg-sunrise-gradient">
                    <Icon className="h-4 w-4 text-navy-950" />
                  </div>
                </div>
                <div className="p-6 text-left">
                  <h3 className="font-display text-lg font-bold text-white">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{feature.body}</p>
                </div>
              </TiltCard>
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
    <section className="relative overflow-hidden bg-navy-950 py-32">
      <div className="pointer-events-none absolute inset-0 opacity-25">
        <img
          src="https://placehold.co/1920x1080/f97316/0b1226?text=Sasebo+Sunrise"
          alt=""
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-navy-950/85" />
      </div>
      <div className="pointer-events-none absolute -left-24 bottom-0 h-80 w-80 rounded-full bg-sunrise-600/20 blur-3xl animate-blob" />
      <div className="pointer-events-none absolute -right-24 top-0 h-80 w-80 rounded-full bg-sky-500/10 blur-3xl animate-blob-delay" />

      <div className="pointer-events-none absolute inset-x-0 top-10 select-none opacity-100">
        <Marquee
          text="CHALLENGE ✦ 挑戦 ✦ SASEBO ✦ 佐世保 ✦"
          className="text-xl font-black tracking-widest text-sunrise-500/20 sm:text-3xl"
        />
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
        <div className="mt-10">
          <MagneticButton onClick={scrollToTop} className="hover:brightness-110">
            もう一度、佐世保をたどる
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </MagneticButton>
        </div>
      </motion.div>
    </section>
  );
}

function Header() {
  const { scrollY } = useScroll();
  const [solid, setSolid] = useState(false);

  useMotionValueEvent(scrollY, 'change', (v) => {
    setSolid(v > 80);
  });

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 flex items-center justify-between px-6 py-5 transition-colors duration-300 sm:px-10 ${
        solid ? 'bg-navy-950/80 backdrop-blur-md' : 'bg-transparent'
      }`}
    >
      <span className="text-sm font-black tracking-[0.2em] text-white">SASEBO/</span>
      <span className="hidden text-xs tracking-[0.2em] text-slate-400 sm:block">NAGASAKI, JAPAN</span>
    </header>
  );
}

export default function SaseboLandingPage() {
  return (
    <div className="min-h-screen w-full bg-navy-950 font-display">
      <Grain />
      <ScrollProgressBar />
      <Header />
      <Hero />
      <StoryTimeline />
      <Stats />
      <Features />
      <Cta />
      <footer className="bg-navy-950 py-10 text-center text-xs tracking-widest text-slate-500">
        SASEBO BRANDING PROJECT — FOR THE NEXT GENERATION
      </footer>
    </div>
  );
}
