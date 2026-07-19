import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  motion,
  useInView,
  useMotionValue,
  useMotionValueEvent,
  useScroll,
  useSpring,
} from 'framer-motion';

export const NOISE_SVG =
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>";
export const NOISE_URL = `url("data:image/svg+xml,${NOISE_SVG.replace(/#/g, '%23')}")`;

export function Grain() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-[70] opacity-[0.05] mix-blend-overlay"
      style={{ backgroundImage: NOISE_URL }}
    />
  );
}

export function ScrollProgressBar() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 200, damping: 40, restDelta: 0.001 });
  return (
    <motion.div
      style={{ scaleX }}
      className="fixed inset-x-0 top-0 z-[80] h-[3px] origin-left bg-sunrise-gradient"
    />
  );
}

export function Marquee({
  text,
  className,
  duration = 'animate-marquee',
}: {
  text: string;
  className?: string;
  duration?: string;
}) {
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

export function MagneticButton({
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
    <motion.div ref={ref} onMouseMove={handleMove} onMouseLeave={reset} style={{ x: springX, y: springY }} className="inline-block">
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

export function TiltCard({ children, className }: { children: ReactNode; className?: string }) {
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

export function CountUp({ target, suffix }: { target: number; suffix: string }) {
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

const NAV_LINKS = [
  { to: '/', match: '/', label: 'HOME' },
  { to: '/story/history', match: '/story', label: 'STORY' },
  { to: '/challengers', match: '/challengers', label: 'CHALLENGERS' },
];

export function Header() {
  const { scrollY } = useScroll();
  const [solid, setSolid] = useState(false);
  const location = useLocation();

  useMotionValueEvent(scrollY, 'change', (v) => {
    setSolid(v > 80);
  });

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 flex items-center justify-between px-6 py-5 transition-colors duration-300 sm:px-10 ${
        solid ? 'bg-navy-950/80 backdrop-blur-md' : 'bg-transparent'
      }`}
    >
      <Link to="/" className="text-sm font-black tracking-[0.2em] text-white">
        SASEBO/
      </Link>
      <nav className="flex items-center gap-6">
        {NAV_LINKS.map((link) => {
          const active = link.match === '/' ? location.pathname === '/' : location.pathname.startsWith(link.match);
          return (
            <Link
              key={link.to}
              to={link.to}
              className={`text-[11px] font-bold tracking-[0.2em] transition-colors duration-200 ${
                active ? 'text-sunrise-400' : 'text-slate-400 hover:text-white'
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="bg-navy-950 py-10 text-center text-xs tracking-widest text-slate-500">
      SASEBO BRANDING PROJECT — FOR THE NEXT GENERATION
    </footer>
  );
}
