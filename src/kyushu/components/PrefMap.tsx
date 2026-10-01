import { Heart } from 'lucide-react';
import { CATEGORY_BY_ID, PREFECTURES, type Post, type PrefId } from '../data';

interface Props {
  posts: Post[];
  onSelectPref: (pref: PrefId) => void;
}

export default function PrefMap({ posts, onSelectPref }: Props) {
  const stats = PREFECTURES.map((p) => {
    const prefPosts = posts.filter((post) => post.pref === p.id);
    const likes = prefPosts.reduce((sum, post) => sum + post.likes.length, 0);
    const top = [...prefPosts].sort((a, b) => b.likes.length - a.likes.length)[0];
    return { pref: p, count: prefPosts.length, likes, top };
  });
  const ranking = [...stats].sort((a, b) => b.likes - a.likes || b.count - a.count);

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-lg font-black text-stone-900">県をえらんで、よかとこを見る</h2>
        <p className="text-sm text-stone-500">タップするとその県の投稿だけ表示されます</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {stats.map(({ pref, count }) => (
            <button
              key={pref.id}
              type="button"
              onClick={() => onSelectPref(pref.id)}
              style={{ gridArea: pref.gridArea }}
              className={`flex aspect-square flex-col items-center justify-center rounded-2xl text-white shadow-md transition hover:scale-[1.03] active:scale-95 ${pref.dot}`}
            >
              <span className="text-lg font-black">{pref.short}</span>
              <span className="text-xs font-bold opacity-90">{count}件</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-black text-stone-900">🏆 よかね！ランキング</h2>
        <ol className="mt-3 space-y-2">
          {ranking.map(({ pref, count, likes, top }, i) => (
            <li key={pref.id}>
              <button
                type="button"
                onClick={() => onSelectPref(pref.id)}
                className="flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left ring-1 ring-stone-200/70 hover:ring-orange-300"
              >
                <span className={`w-6 text-center text-lg font-black ${i < 3 ? 'text-orange-500' : 'text-stone-400'}`}>
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-bold text-stone-900">{pref.name}</span>
                    <span className="truncate text-xs text-stone-400">{pref.catchphrase}</span>
                  </div>
                  <p className="truncate text-xs text-stone-500">
                    {top ? `${CATEGORY_BY_ID[top.category].emoji} ${top.text}` : 'まだ投稿がありません'}
                  </p>
                </div>
                <div className="text-right text-xs">
                  <div className="flex items-center justify-end gap-1 font-bold text-rose-500">
                    <Heart size={12} className="fill-rose-500" /> {likes}
                  </div>
                  <div className="text-stone-400">{count}件</div>
                </div>
              </button>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
