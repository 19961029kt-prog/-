import { useState, type ReactNode } from 'react';
import { House, LoaderCircle, Map as MapIcon, Plus, User as UserIcon, X } from 'lucide-react';
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

  if (store.fatal) {
    return (
      <CenteredScreen>
        <p className="text-3xl">🌧️</p>
        <p className="mt-2 font-bold text-stone-800">サーバーにつながりませんでした</p>
        <p className="mt-1 text-sm text-stone-600">{store.fatal}</p>
        <button
          type="button"
          onClick={() => location.reload()}
          className="mt-5 rounded-xl bg-orange-500 px-6 py-2.5 font-bold text-white"
        >
          再読み込み
        </button>
      </CenteredScreen>
    );
  }

  if (!store.ready) {
    return (
      <CenteredScreen>
        <LoaderCircle size={32} className="mx-auto animate-spin text-orange-500" />
        <p className="mt-3 text-sm font-bold text-stone-500">九州につないどるよ…</p>
      </CenteredScreen>
    );
  }

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
            <ProfileForm submitLabel="はじめる" onSubmit={store.saveProfile} />
          </div>
          {store.error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{store.error}</p>}
          <p className="mt-4 text-center text-xs text-stone-400">
            ※ 試作版です。ログイン情報はこのブラウザに保存されるため、別の端末やブラウザでは別のユーザーになります。
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

      {store.error && (
        <div className="mx-auto mt-3 max-w-xl px-4">
          <div role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            <p className="flex-1">{store.error}</p>
            <button type="button" onClick={store.dismissError} aria-label="閉じる" className="text-red-400">
              <X size={16} />
            </button>
          </div>
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
          onSubmit={async (input) => {
            const ok = await store.addPost(input);
            if (ok) {
              setComposing(false);
              setFilter({ ...EMPTY_FILTER, sort: 'new' });
              goTab('home');
            }
            return ok;
          }}
        />
      )}
    </div>
  );
}

function CenteredScreen({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-orange-50 to-amber-50 px-6">
      <div className="max-w-sm text-center">{children}</div>
    </div>
  );
}
