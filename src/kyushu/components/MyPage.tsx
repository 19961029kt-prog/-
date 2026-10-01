import { useState } from 'react';
import { PREF_BY_ID, type User } from '../data';
import type { KyushuStore } from '../store';
import PostCard from './PostCard';
import ProfileForm from './ProfileForm';
import { Avatar } from './ui';

export default function MyPage({ user, store }: { user: User; store: KyushuStore }) {
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<'mine' | 'liked'>('mine');

  const mine = store.posts.filter((p) => p.authorId === user.id);
  const liked = store.posts.filter((p) => p.likes.includes(user.id));
  const receivedLikes = mine.reduce((sum, p) => sum + p.likes.length, 0);
  const list = tab === 'mine' ? mine : liked;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-white p-5 ring-1 ring-stone-200/70">
        {editing ? (
          <ProfileForm
            initial={user}
            submitLabel="保存する"
            onSubmit={(next) => {
              store.setUser(next);
              setEditing(false);
            }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <>
            <div className="flex items-center gap-4">
              <Avatar name={user.name} pref={user.pref} size={64} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xl font-black text-stone-900">{user.name}</p>
                <p className="text-sm text-stone-500">{PREF_BY_ID[user.pref].name}出身</p>
              </div>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded-full bg-stone-100 px-4 py-2 text-sm font-bold text-stone-700"
              >
                編集
              </button>
            </div>
            {user.bio && <p className="mt-3 text-stone-700">{user.bio}</p>}
            <div className="mt-4 grid grid-cols-3 divide-x divide-stone-100 text-center">
              {[
                ['投稿', mine.length],
                ['もらったよかね！', receivedLikes],
                ['よかね！した', liked.length],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-xl font-black text-stone-900">{value}</p>
                  <p className="text-[11px] text-stone-500">{label}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <div className="flex rounded-full bg-stone-200/70 p-1 text-sm font-bold">
        {(
          [
            ['mine', '自分の投稿'],
            ['liked', 'よかね！した投稿'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex-1 rounded-full py-2 ${tab === key ? 'bg-white text-orange-600 shadow-sm' : 'text-stone-500'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <p className="py-8 text-center text-sm text-stone-500">
          {tab === 'mine' ? 'まだ投稿しとらんよ。右下の＋ボタンから投稿してみてね！' : 'まだ「よかね！」した投稿はありません'}
        </p>
      ) : (
        list.map((post) => <PostCard key={post.id} post={post} user={user} store={store} />)
      )}
    </div>
  );
}
