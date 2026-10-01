import { Clock, Flame, Search, X } from 'lucide-react';
import { CATEGORIES, PREF_BY_ID, PREFECTURES, type Post, type User } from '../data';
import type { KyushuStore } from '../store';
import { EMPTY_FILTER, type TimelineFilter } from '../filter';
import PostCard from './PostCard';

interface Props {
  user: User;
  store: KyushuStore;
  filter: TimelineFilter;
  onFilterChange: (filter: TimelineFilter) => void;
}

function score(post: Post) {
  return post.likes.length + post.commentCount * 2;
}

export default function Timeline({ user, store, filter, onFilterChange }: Props) {
  const set = (patch: Partial<TimelineFilter>) => onFilterChange({ ...filter, ...patch });
  const query = filter.query.trim().toLowerCase();

  const visible = store.posts
    .filter((p) => !filter.pref || p.pref === filter.pref)
    .filter((p) => !filter.category || p.category === filter.category)
    .filter((p) => !query || p.text.toLowerCase().includes(query) || p.authorName.toLowerCase().includes(query))
    .sort((a, b) => (filter.sort === 'popular' ? score(b) - score(a) : 0) || b.createdAt - a.createdAt);

  const chipClass = (active: boolean) =>
    `shrink-0 rounded-full px-3 py-1 text-sm font-bold transition ${
      active ? 'bg-stone-800 text-white' : 'bg-white text-stone-600 ring-1 ring-stone-200'
    }`;

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
        <input
          value={filter.query}
          onChange={(e) => set({ query: e.target.value })}
          placeholder="キーワードで探す（ラーメン、温泉…）"
          className="w-full rounded-full border border-stone-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-orange-500"
        />
      </div>

      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
        <button type="button" className={chipClass(filter.pref === null)} onClick={() => set({ pref: null })}>
          九州ぜんぶ
        </button>
        {PREFECTURES.map((p) => (
          <button key={p.id} type="button" className={chipClass(filter.pref === p.id)} onClick={() => set({ pref: p.id })}>
            {p.short}
          </button>
        ))}
      </div>

      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
        <button type="button" className={chipClass(filter.category === null)} onClick={() => set({ category: null })}>
          すべて
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            className={chipClass(filter.category === c.id)}
            onClick={() => set({ category: c.id })}
          >
            {c.emoji} {c.label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-stone-500">
          {filter.pref ? `${PREF_BY_ID[filter.pref].name}の投稿` : '九州・沖縄の投稿'}（{visible.length}件）
        </p>
        <div className="flex rounded-full bg-stone-200/70 p-0.5 text-xs font-bold">
          {(
            [
              ['new', '新着', Clock],
              ['popular', '人気', Flame],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              onClick={() => set({ sort: key })}
              className={`flex items-center gap-1 rounded-full px-3 py-1 ${
                filter.sort === key ? 'bg-white text-orange-600 shadow-sm' : 'text-stone-500'
              }`}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center text-stone-500 ring-1 ring-stone-200/70">
          <p className="text-3xl">🌋</p>
          <p className="mt-2 font-bold">まだ投稿がなかよ</p>
          <p className="mt-1 text-sm">最初のひとりになって、魅力を語ってみらんね？</p>
          {(filter.pref || filter.category || filter.query) && (
            <button
              type="button"
              onClick={() => onFilterChange({ ...EMPTY_FILTER, sort: filter.sort })}
              className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-orange-600"
            >
              <X size={14} /> 絞り込みを解除
            </button>
          )}
        </div>
      ) : (
        visible.map((post) => (
          <PostCard key={post.id} post={post} user={user} store={store} onSelectPref={(pref) => set({ pref })} />
        ))
      )}
    </div>
  );
}
