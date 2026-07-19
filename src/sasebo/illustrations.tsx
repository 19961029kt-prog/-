import { useId } from 'react';

type SvgProps = { className?: string };

export function HeroIllustration({ className }: SvgProps) {
  const id = useId();
  return (
    <svg viewBox="0 0 1200 700" className={className} preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#04070f" />
          <stop offset="55%" stopColor="#0b1226" />
          <stop offset="100%" stopColor="#101a36" />
        </linearGradient>
        <radialGradient id={`${id}-sun`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fbbf6d" />
          <stop offset="45%" stopColor="#f97316" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-water`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f97316" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#04070f" stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect width="1200" height="700" fill={`url(#${id}-sky)`} />

      {Array.from({ length: 40 }).map((_, i) => (
        <circle
          key={i}
          cx={(i * 191) % 1200}
          cy={(i * 83) % 380}
          r={i % 5 === 0 ? 1.6 : 0.9}
          fill="#ffffff"
          opacity={0.15 + (i % 4) * 0.08}
        />
      ))}

      <circle cx="960" cy="430" r="230" fill={`url(#${id}-sun)`} />
      <circle cx="960" cy="430" r="70" fill="#fbbf6d" opacity="0.9" />

      <rect x="0" y="430" width="1200" height="270" fill={`url(#${id}-water)`} />
      {Array.from({ length: 8 }).map((_, i) => (
        <rect key={i} x="0" y={450 + i * 26} width="1200" height="1.5" fill="#fbbf6d" opacity={0.12 - i * 0.012} />
      ))}

      <g opacity="0.9">
        <rect x="40" y="330" width="26" height="110" fill="#182548" />
        <rect x="90" y="300" width="20" height="140" fill="#101a36" />
        <rect x="130" y="350" width="34" height="90" fill="#182548" />
        <path d="M180 440 L180 260 L188 260 L188 300 L230 300 L230 308 L188 308 L188 440 Z" fill="#101a36" />
        <rect x="260" y="370" width="60" height="70" fill="#182548" />
      </g>

      <g opacity="0.95">
        <path d="M700 440 L700 250 L710 250 L710 290 L760 290 L760 300 L710 300 L710 440 Z" fill="#0b1226" />
        <rect x="640" y="400" width="240" height="40" rx="4" fill="#0b1226" />
        <path d="M640 400 L700 360 L900 360 L880 400 Z" fill="#101a36" />
        <rect x="820" y="330" width="16" height="70" fill="#0b1226" />
      </g>
    </svg>
  );
}

export function HistoryIllustration({ className }: SvgProps) {
  const id = useId();
  return (
    <svg viewBox="0 0 700 900" className={className} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0b1226" />
          <stop offset="100%" stopColor="#04070f" />
        </linearGradient>
        <linearGradient id={`${id}-glow`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#f97316" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="700" height="900" fill={`url(#${id}-bg)`} />

      <rect x="0" y="620" width="700" height="280" fill="#101a36" />
      {Array.from({ length: 10 }).map((_, i) => (
        <rect key={i} x="0" y={640 + i * 24} width="700" height="1" fill="#f97316" opacity={0.08} />
      ))}

      <rect x="120" y="120" width="14" height="520" fill="#182548" />
      <path d="M127 120 L127 260 L340 340 L340 356 L127 276 Z" fill="#101a36" />
      <rect x="118" y="620" width="18" height="24" fill="#0b1226" />

      <path
        d="M180 700 C 220 560, 480 560, 520 700 L 520 760 C 480 780, 400 790, 350 790 C 300 790, 220 780, 180 760 Z"
        fill="#0b1226"
        stroke="#f97316"
        strokeOpacity="0.35"
        strokeWidth="2"
      />
      <rect x="300" y="560" width="20" height="90" fill="#0b1226" stroke="#f97316" strokeOpacity="0.35" />
      <rect x="380" y="580" width="16" height="70" fill="#0b1226" stroke="#f97316" strokeOpacity="0.35" />

      {Array.from({ length: 6 }).map((_, i) => (
        <circle key={i} cx={220 + i * 55} cy={700 + (i % 2) * 20} r="4" fill="#f97316" opacity="0.5" />
      ))}

      <rect x="0" y="0" width="700" height="900" fill={`url(#${id}-glow)`} opacity="0.5" />
      <circle cx="560" cy="200" r="120" fill="#f97316" opacity="0.08" />
    </svg>
  );
}

export function CultureIllustration({ className }: SvgProps) {
  const id = useId();
  return (
    <svg viewBox="0 0 700 900" className={className} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#101a36" />
          <stop offset="100%" stopColor="#04070f" />
        </linearGradient>
        <radialGradient id={`${id}-neon`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fb923c" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#fb923c" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="700" height="900" fill={`url(#${id}-bg)`} />
      <circle cx="350" cy="260" r="260" fill={`url(#${id}-neon)`} />

      <g stroke="#fbbf6d" strokeWidth="6" fill="none" strokeLinecap="round">
        <path d="M260 220 C 250 300, 300 340, 340 400 C 380 460, 420 520, 400 580 C 390 610, 350 620, 330 600" />
        <circle cx="270" cy="230" r="16" fill="none" />
        <circle cx="330" cy="600" r="14" fill="none" />
      </g>
      <circle cx="270" cy="230" r="6" fill="#fbbf6d" />

      <g opacity="0.8">
        <path d="M470 150 q10 -18 20 0 q10 18 -10 18 q6 12 -10 10" stroke="#f97316" strokeWidth="3" fill="none" />
        <path d="M520 190 q8 -14 16 0 q8 14 -8 14 q5 10 -8 8" stroke="#f97316" strokeWidth="3" fill="none" />
      </g>

      <g transform="translate(220 700)">
        <ellipse cx="90" cy="10" rx="100" ry="16" fill="#182548" />
        <rect x="10" y="-30" width="160" height="18" rx="9" fill="#fbbf6d" />
        <rect x="0" y="-10" width="180" height="22" rx="11" fill="#0b1226" />
        <rect x="10" y="10" width="160" height="16" rx="8" fill="#f97316" />
        {Array.from({ length: 6 }).map((_, i) => (
          <circle key={i} cx={30 + i * 24} cy={-1} r="3" fill="#fde68a" />
        ))}
      </g>

      <rect x="60" y="60" width="180" height="60" rx="8" fill="none" stroke="#fb923c" strokeWidth="2" opacity="0.6" />
      <text x="150" y="98" textAnchor="middle" fontSize="22" fill="#fbbf6d" opacity="0.85" fontFamily="monospace">
        JAZZ
      </text>
    </svg>
  );
}

export function NatureIllustration({ className }: SvgProps) {
  const id = useId();
  return (
    <svg viewBox="0 0 700 900" className={className} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#082f49" />
          <stop offset="100%" stopColor="#04070f" />
        </linearGradient>
        <radialGradient id={`${id}-sun`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#7dd3fc" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#7dd3fc" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="700" height="900" fill={`url(#${id}-sky)`} />
      <circle cx="480" cy="260" r="220" fill={`url(#${id}-sun)`} />
      <circle cx="480" cy="260" r="60" fill="#bae6fd" opacity="0.8" />

      <rect x="0" y="560" width="700" height="340" fill="#0c4a6e" opacity="0.5" />
      {Array.from({ length: 7 }).map((_, i) => (
        <rect key={i} x="0" y={580 + i * 24} width="700" height="1.5" fill="#38bdf8" opacity={0.14 - i * 0.014} />
      ))}

      <ellipse cx="150" cy="640" rx="90" ry="26" fill="#101a36" />
      <ellipse cx="130" cy="600" rx="34" ry="14" fill="#101a36" />
      <ellipse cx="330" cy="670" rx="130" ry="30" fill="#0b1226" />
      <ellipse cx="290" cy="630" rx="46" ry="18" fill="#0b1226" />
      <ellipse cx="380" cy="620" rx="26" ry="12" fill="#0b1226" />
      <ellipse cx="540" cy="650" rx="80" ry="22" fill="#101a36" />
      <ellipse cx="600" cy="700" rx="60" ry="20" fill="#0b1226" />

      <g stroke="#e0f2fe" strokeWidth="3" fill="none" opacity="0.6">
        <path d="M120 200 q14 -12 28 0 q14 -12 28 0" />
        <path d="M420 140 q10 -9 20 0 q10 -9 20 0" />
      </g>
    </svg>
  );
}

export function CtaIllustration({ className }: SvgProps) {
  const id = useId();
  return (
    <svg viewBox="0 0 1200 500" className={className} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-sun`} cx="50%" cy="100%" r="75%">
          <stop offset="0%" stopColor="#fbbf6d" stopOpacity="0.9" />
          <stop offset="45%" stopColor="#f97316" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1200" height="500" fill={`url(#${id}-sun)`} />
      <circle cx="600" cy="430" r="150" fill="#fbbf6d" opacity="0.5" />
      {Array.from({ length: 16 }).map((_, i) => {
        const angle = (i / 16) * Math.PI;
        const x2 = 600 + Math.cos(angle) * 900;
        const y2 = 430 - Math.sin(angle) * 900;
        return <line key={i} x1="600" y1="430" x2={x2} y2={y2} stroke="#f97316" strokeOpacity="0.06" strokeWidth="3" />;
      })}
      {Array.from({ length: 8 }).map((_, i) => (
        <rect key={i} x="0" y={440 + i * 8} width="1200" height="1" fill="#fde68a" opacity={0.1 - i * 0.01} />
      ))}
    </svg>
  );
}

const PATTERN_COLOR = '#f97316';

export function FeaturePattern({ variant, className }: { variant: 'grid' | 'radial' | 'waves' | 'nodes' | 'contour' | 'mix'; className?: string }) {
  const id = useId();

  if (variant === 'radial') {
    return (
      <svg viewBox="0 0 400 240" className={className} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <rect width="400" height="240" fill="#0b1226" />
        {[30, 60, 90, 120, 150].map((r) => (
          <circle key={r} cx="320" cy="60" r={r} fill="none" stroke={PATTERN_COLOR} strokeOpacity="0.18" strokeWidth="1.5" />
        ))}
        <circle cx="320" cy="60" r="8" fill={PATTERN_COLOR} opacity="0.5" />
      </svg>
    );
  }

  if (variant === 'waves') {
    return (
      <svg viewBox="0 0 400 240" className={className} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <rect width="400" height="240" fill="#0b1226" />
        {Array.from({ length: 7 }).map((_, i) => (
          <path
            key={i}
            d={`M0 ${60 + i * 22} Q 100 ${30 + i * 22} 200 ${60 + i * 22} T 400 ${60 + i * 22}`}
            fill="none"
            stroke={PATTERN_COLOR}
            strokeOpacity={0.22 - i * 0.02}
            strokeWidth="2"
          />
        ))}
      </svg>
    );
  }

  if (variant === 'nodes') {
    const pts = [
      [40, 60], [140, 40], [260, 70], [340, 130], [200, 160], [90, 180], [320, 200], [60, 110],
    ];
    return (
      <svg viewBox="0 0 400 240" className={className} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <rect width="400" height="240" fill="#0b1226" />
        <g stroke={PATTERN_COLOR} strokeOpacity="0.3" strokeWidth="1.5">
          {pts.map(([x, y], i) => {
            const [x2, y2] = pts[(i + 1) % pts.length];
            return <line key={i} x1={x} y1={y} x2={x2} y2={y2} />;
          })}
        </g>
        {pts.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="4" fill={PATTERN_COLOR} opacity="0.6" />
        ))}
      </svg>
    );
  }

  if (variant === 'contour') {
    return (
      <svg viewBox="0 0 400 240" className={className} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <rect width="400" height="240" fill="#0b1226" />
        {[1, 2, 3, 4, 5].map((n) => (
          <ellipse
            key={n}
            cx="180"
            cy="140"
            rx={30 * n}
            ry={18 * n}
            fill="none"
            stroke={PATTERN_COLOR}
            strokeOpacity={0.26 - n * 0.03}
            strokeWidth="1.5"
          />
        ))}
      </svg>
    );
  }

  if (variant === 'mix') {
    return (
      <svg viewBox="0 0 400 240" className={className} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <rect width="400" height="240" fill="#0b1226" />
        <circle cx="150" cy="110" r="70" fill="none" stroke="#f97316" strokeOpacity="0.35" strokeWidth="1.5" />
        <circle cx="230" cy="130" r="70" fill="none" stroke="#38bdf8" strokeOpacity="0.3" strokeWidth="1.5" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 400 240" className={className} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="400" height="240" fill="#0b1226" />
      <defs>
        <pattern id={`${id}-grid`} width="28" height="28" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.4" fill={PATTERN_COLOR} opacity="0.3" />
        </pattern>
      </defs>
      <rect width="400" height="240" fill={`url(#${id}-grid)`} />
    </svg>
  );
}

export function Avatar({ initial, className }: { initial: string; className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-grad`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#fbbf6d" />
        </linearGradient>
      </defs>
      <circle cx="60" cy="60" r="58" fill="#101a36" stroke={`url(#${id}-grad)`} strokeWidth="2" />
      <text x="60" y="76" textAnchor="middle" fontSize="44" fontWeight="900" fill={`url(#${id}-grad)`}>
        {initial}
      </text>
    </svg>
  );
}
