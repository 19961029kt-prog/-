import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Quote } from 'lucide-react';
import { CHALLENGERS } from '../data';
import { Avatar, CtaIllustration } from '../illustrations';
import { NOISE_URL, MagneticButton } from '../ui';

export default function ChallengersPage() {
  const navigate = useNavigate();

  return (
    <div className="bg-navy-950">
      <section className="relative flex min-h-[50vh] items-end overflow-hidden py-24">
        <div className="pointer-events-none absolute inset-0 opacity-40">
          <CtaIllustration className="h-full w-full" />
        </div>
        <div
          className="pointer-events-none absolute inset-0 mix-blend-overlay opacity-20"
          style={{ backgroundImage: NOISE_URL }}
        />
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="relative z-10 mx-auto w-full max-w-4xl px-6"
        >
          <Link to="/" className="mb-6 inline-flex items-center gap-1.5 text-xs font-bold tracking-widest text-slate-300 hover:text-white">
            <ArrowLeft className="h-3.5 w-3.5" />
            HOME
          </Link>
          <p className="text-xs font-bold tracking-[0.3em] text-sunrise-500">CHALLENGERS</p>
          <h1 className="mt-4 font-display text-4xl font-black leading-tight text-white sm:text-6xl">
            すでに、佐世保で
            <br />
            挑戦している先輩がいる。
          </h1>
          <p className="mt-6 max-w-xl text-sm leading-relaxed text-slate-400 sm:text-base">
            移住者も、地元に残った人も関係ない。この街をおもしろがれるかどうかだけが、たった一つの条件だった。
          </p>
        </motion.div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-20">
        <div className="flex flex-col gap-16">
          {CHALLENGERS.map((person, i) => (
            <motion.div
              key={person.slug}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.6 }}
              className={`flex flex-col items-center gap-10 rounded-3xl border border-white/10 bg-navy-900/50 p-8 sm:p-10 lg:flex-row ${
                i % 2 === 1 ? 'lg:flex-row-reverse' : ''
              }`}
            >
              <div className="flex w-full max-w-[220px] flex-col items-center gap-4 lg:w-56 lg:shrink-0">
                <Avatar initial={person.initial} className="w-32 sm:w-40" />
                <span className="rounded-full border border-white/15 px-3 py-1 text-[10px] font-bold tracking-widest text-slate-400">
                  {person.tag}
                </span>
              </div>

              <div className="flex-1 text-center lg:text-left">
                <h2 className="font-display text-xl font-black text-white sm:text-2xl">{person.name}</h2>
                <p className="mt-1 text-sm text-slate-400">
                  {person.role} / {person.age}歳
                </p>

                <div className="mt-5 flex justify-center gap-2 lg:justify-start">
                  <Quote className="mt-1 h-5 w-5 shrink-0 text-sunrise-500" />
                  <p className="font-display text-lg font-bold leading-snug text-sunrise-400 sm:text-xl">
                    {person.quote}
                  </p>
                </div>

                <p className="mt-5 text-sm leading-relaxed text-slate-400 sm:text-base">{person.body}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="border-t border-white/10 bg-navy-900 py-24 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-2xl px-6"
        >
          <h2 className="font-display text-3xl font-black text-white sm:text-4xl">
            次に挑戦するのは、<span className="text-sunrise-400">あなた</span>かもしれない。
          </h2>
          <div className="mt-8">
            <MagneticButton onClick={() => navigate('/')} className="hover:brightness-110">
              佐世保のストーリーに戻る
              <ArrowRight className="h-4 w-4" />
            </MagneticButton>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
