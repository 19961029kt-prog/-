import { useState } from 'react';
import { House, Map as MapIcon, Plus, User as UserIcon } from 'lucide-react';
import { PREFECTURES } from './data';
import { useKyushuStore } from './store';
import Composer from './components/Composer';
import MyPage from './components/MyPage';
import PrefMap from './components/PrefMap';
import ProfileForm from './components/ProfileForm';
import Timeline from './components/Timeline';
import { EMPTY_FILTER, type TimelineFilter } from './filter';

type Tab = 'home' | 'map' | 'me';

const TABS: { id: Tab; label: string; Icon: typeof House }[] = [
  { id: 'home', label: 'ホーム', Icon: House },
  { id: 'map', label: '県別', Icon: MapIcon },
  { id: 'me', label: 'マイページ', Icon: UserIcon },
];

export default function KyushuApp() {
  const store = useKyushuStore();
  const { user } = store;
  const [tab, setTab] = useState<Tab>('home');
  const [filter, setFilter] = useState<TimelineFilter>(EMPTY_FILTER);
  const [composing, setComposing] = useState(false);

  const goTab = (next: Tab) => {
    setTab(next);
    window.scrollTo({ top: 0 });
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-50 to-amber-50 px-4 py-10">
        <div className="mx-auto max-w-md">
          <div className="text-center">
            <div className="flex justify-center gap-1">
              {PREFECTURES.map((p) => (
                <span key={p.id} className={`h-2 w-6 rounded-full ${p.dot}`} />
              ))}
            </div>
            <h1 className="mt-5 text-4xl font-black tracking-tight text-stone-900">よかとこ九州</h1>
            <p className="mt-2 text-stone-600">
              九州・沖縄の「よかとこ」を、
              <br />
              地元の人どうしで語り合おう。
            </p>
          </div>
          <div className="mt-8 rounded-3xl bg-white p-6 shadow-xl shadow-orange-900/5">
            <ProfileForm submitLabel="はじめる" onSubmit={store.setUser} />
          </div>
          <p className="mt-4 text-center text-xs text-stone-400">
            ※ 現在は試作版です。投稿はこの端末のブラウザにだけ保存されます。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-100 pb-24">
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-3">
          <button type="button" onClick={() => goTab('home')} className="text-xl font-black tracking-tight text-stone-900">
            よかとこ<span className="text-orange-500">九州</span>
          </button>
          <div className="flex gap-0.5" aria-hidden>
            {PREFECTURES.map((p) => (
              <span key={p.id} className={`h-1.5 w-3 rounded-full ${p.dot}`} />
            ))}
          </div>
        </div>
      </header>

      {store.storageError && (
        <div className="mx-auto mt-3 max-w-xl px-4">
          <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
            保存容量がいっぱいです。写真付きの古い投稿を削除すると保存できるようになります。
          </p>
        </div>
      )}

      <main className="mx-auto max-w-xl px-4 py-4">
        {tab === 'home' && <Timeline user={user} store={store} filter={filter} onFilterChange={setFilter} />}
        {tab === 'map' && (
          <PrefMap
            posts={store.posts}
            onSelectPref={(pref) => {
              setFilter({ ...EMPTY_FILTER, pref });
              goTab('home');
            }}
          />
        )}
        {tab === 'me' && <MyPage user={user} store={store} />}
      </main>

      <button
        type="button"
        onClick={() => setComposing(true)}
        className="fixed bottom-20 right-[max(1rem,calc(50%-17rem))] z-40 flex h-14 w-14 items-center justify-center rounded-full bg-orange-500 text-white shadow-xl shadow-orange-500/40 transition hover:scale-105 active:scale-95"
        aria-label="投稿する"
      >
        <Plus size={28} strokeWidth={2.5} />
      </button>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-xl">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => goTab(id)}
              aria-current={tab === id ? 'page' : undefined}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-bold ${
                tab === id ? 'text-orange-600' : 'text-stone-400'
              }`}
            >
              <Icon size={22} />
              {label}
            </button>
          ))}
        </div>
      </nav>

      {composing && (
        <Composer
          user={user}
          onClose={() => setComposing(false)}
          onSubmit={(input) => {
            store.addPost(input);
            setComposing(false);
            setFilter({ ...EMPTY_FILTER, sort: 'new' });
            goTab('home');
          }}
        />
      )}
    </div>
  );
}
