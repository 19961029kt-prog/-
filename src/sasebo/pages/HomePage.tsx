import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useMotionValueEvent, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { STORY_CHAPTERS, FEATURES, STATS } from '../data';
import { CountUp, Marquee, MagneticButton, TiltCard, NOISE_URL } from '../ui';
import { HeroIllustration, HistoryIllustration, CultureIllustration, NatureIllustration, CtaIllustration, FeaturePattern } from '../illustrations';

const CHAPTER_ILLUSTRATIONS = {
  history: HistoryIllustration,
  culture: CultureIllustration,
  nature: NatureIllustration,
};

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
        <HeroIllustration className="h-full w-full" />
        <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-950/60 to-navy-950/20" />
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

function StoryTeaser() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ['start start', 'end end'] });
  const [active, setActive] = useState(0);

  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    const index = Math.min(STORY_CHAPTERS.length - 1, Math.floor(v * STORY_CHAPTERS.length));
    setActive(index);
  });

  const ActiveIcon = STORY_CHAPTERS[active].icon;
  const ActiveIllustration = CHAPTER_ILLUSTRATIONS[STORY_CHAPTERS[active].slug as keyof typeof CHAPTER_ILLUSTRATIONS];

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
            const Illustration = CHAPTER_ILLUSTRATIONS[chapter.slug as keyof typeof CHAPTER_ILLUSTRATIONS];
            return (
              <motion.div
                key={chapter.slug}
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
                  {chapter.lead}
                </p>
                <Link
                  to={`/story/${chapter.slug}`}
                  className="group relative mt-5 inline-flex w-fit items-center gap-1.5 text-sm font-bold text-sunrise-400"
                >
                  続きを読む
                  <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
                </Link>

                <div className="relative mt-6 overflow-hidden rounded-2xl border border-white/10 shadow-2xl lg:hidden">
                  <Illustration className="h-48 w-full" />
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="relative hidden lg:block">
          <div className="sticky top-24 h-[70vh] w-full">
            <div className="relative h-full w-full overflow-hidden rounded-3xl border border-white/10 shadow-2xl shadow-black/50">
              <AnimatePresence mode="sync">
                <motion.div
                  key={STORY_CHAPTERS[active].slug}
                  initial={{ opacity: 0, scale: 1.1 }}
                  animate={{ opacity: 1, scale: 1.02 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.1, ease: 'easeOut' }}
                  className="absolute inset-0 h-full w-full"
                >
                  <ActiveIllustration className="h-full w-full" />
                </motion.div>
              </AnimatePresence>

              <div
                className="pointer-events-none absolute inset-0 mix-blend-overlay opacity-40"
                style={{ backgroundImage: NOISE_URL }}
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-navy-950/90 via-transparent to-navy-950/40" />

              <span className="absolute left-6 top-6 flex h-8 w-8 items-center justify-center rounded-full border-2 border-sunrise-500 bg-navy-950/80 backdrop-blur">
                <ActiveIcon className="h-4 w-4 text-sunrise-400" />
              </span>

              <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between">
                <span className="font-mono text-[10px] tracking-widest text-slate-300">
                  {STORY_CHAPTERS[active].coords}
                </span>
                <div className="flex gap-1.5">
                  {STORY_CHAPTERS.map((c, i) => (
                    <span
                      key={c.slug}
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
                  <FeaturePattern
                    variant={feature.pattern}
                    className="h-full w-full transition-transform duration-700 group-hover:scale-110"
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
      <div className="pointer-events-none absolute inset-0 opacity-40">
        <CtaIllustration className="h-full w-full" />
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
        <div className="mt-6">
          <Link to="/challengers" className="text-sm font-bold text-sunrise-400 underline underline-offset-4">
            すでに挑戦している先輩たちを見る →
          </Link>
        </div>
        <div className="mt-8">
          <MagneticButton onClick={scrollToTop} className="hover:brightness-110">
            もう一度、佐世保をたどる
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </MagneticButton>
        </div>
      </motion.div>
    </section>
  );
}

export default function HomePage() {
  return (
    <>
      <Hero />
      <StoryTeaser />
      <Stats />
      <Features />
      <Cta />
    </>
  );
}
