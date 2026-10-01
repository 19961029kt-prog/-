import { PREF_BY_ID, type PrefId } from '../data';

export function PrefChip({ pref, size = 'sm' }: { pref: PrefId; size?: 'sm' | 'xs' }) {
  const p = PREF_BY_ID[pref];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-bold ${p.chip} ${
        size === 'xs' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-xs'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${p.dot}`} />
      {p.short}
    </span>
  );
}

export function Avatar({ name, pref, size = 40 }: { name: string; pref: PrefId; size?: number }) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-bold text-white ${PREF_BY_ID[pref].dot}`}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
      aria-hidden
    >
      {name.slice(0, 1)}
    </div>
  );
}
