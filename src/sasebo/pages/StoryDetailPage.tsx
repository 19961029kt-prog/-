import { Link, Navigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Quote } from 'lucide-react';
import { STORY_CHAPTERS } from '../data';
import { NOISE_URL } from '../ui';
import { HistoryIllustration, CultureIllustration, NatureIllustration } from '../illustrations';

const CHAPTER_ILLUSTRATIONS = {
  history: HistoryIllustration,
  culture: CultureIllustration,
  nature: NatureIllustration,
};

const ACCENT_TEXT: Record<string, string> = {
  sunrise: 'text-sunrise-400',
  amber: 'text-sunrise-400',
  sky: 'text-sky-400',
};

export default function StoryDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const index = STORY_CHAPTERS.findIndex((c) => c.slug === slug);

  if (index === -1) {
    return <Navigate to={`/story/${STORY_CHAPTERS[0].slug}`} replace />;
  }

  const chapter = STORY_CHAPTERS[index];
  const Icon = chapter.icon;
  const Illustration = CHAPTER_ILLUSTRATIONS[chapter.slug as keyof typeof CHAPTER_ILLUSTRATIONS];
  const next = STORY_CHAPTERS[(index + 1) % STORY_CHAPTERS.length];
  const accent = ACCENT_TEXT[chapter.accent];

  return (
    <div className="bg-navy-950">
      <section className="relative flex h-[70vh] min-h-[520px] w-full items-end overflow-hidden">
        <div className="absolute inset-0">
          <Illustration className="h-full w-full" />
          <div
            className="pointer-events-none absolute inset-0 mix-blend-overlay opacity-30"
            style={{ backgroundImage: NOISE_URL }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-950/40 to-navy-950/10" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="relative z-10 mx-auto w-full max-w-4xl px-6 pb-16"
        >
          <Link to="/" className="mb-6 inline-flex items-center gap-1.5 text-xs font-bold tracking-widest text-slate-300 hover:text-white">
            <ArrowLeft className="h-3.5 w-3.5" />
            HOME
          </Link>
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-sunrise-500/50 bg-navy-950/70 backdrop-blur">
              <Icon className={`h-4 w-4 ${accent}`} />
            </span>
            <span className={`text-xs font-bold tracking-[0.25em] ${accent}`}>{chapter.era}</span>
          </div>
          <h1 className="mt-5 font-display text-4xl font-black leading-tight text-white sm:text-6xl">
            {chapter.title}
          </h1>
          <p className="mt-4 max-w-xl font-mono text-[11px] tracking-widest text-slate-400">{chapter.coords}</p>
        </motion.div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-20">
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.6 }}
          className="text-lg font-bold leading-relaxed text-white sm:text-xl"
        >
          {chapter.lead}
        </motion.p>

        <div className="mt-10 flex flex-col gap-6">
          {chapter.body.map((paragraph, i) => (
            <motion.p
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.6, delay: i * 0.05 }}
              className="text-sm leading-relaxed text-slate-400 sm:text-base"
            >
              {paragraph}
            </motion.p>
          ))}
        </div>

        <motion.blockquote
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.6 }}
          className="relative mt-14 rounded-2xl border border-white/10 bg-navy-900/60 p-8"
        >
          <Quote className="h-6 w-6 text-sunrise-500" />
          <p className="mt-4 font-display text-xl font-bold leading-snug text-white sm:text-2xl">{chapter.quote}</p>
        </motion.blockquote>
      </section>

      <section className="border-t border-white/10 bg-navy-900 py-14">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6">
          <span className="text-xs font-bold tracking-widest text-slate-500">NEXT CHAPTER</span>
          <Link
            to={`/story/${next.slug}`}
            className="group flex items-center gap-2 rounded-full border border-white/15 px-5 py-3 text-sm font-bold text-white transition-colors duration-300 hover:border-sunrise-500 hover:text-sunrise-400"
          >
            {next.title}
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </div>
      </section>
    </div>
  );
}
