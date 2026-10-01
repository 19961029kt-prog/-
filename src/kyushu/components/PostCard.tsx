import { useState } from 'react';
import { Heart, MessageCircle, Send, Trash2 } from 'lucide-react';
import { CATEGORY_BY_ID, PREF_BY_ID, type Post, type User } from '../data';
import { usePostComments, type KyushuStore } from '../store';
import { timeAgo } from '../utils';
import { Avatar, PrefChip } from './ui';

interface Props {
  post: Post;
  user: User;
  store: KyushuStore;
  onSelectPref?: (pref: Post['pref']) => void;
}

export default function PostCard({ post, user, store, onSelectPref }: Props) {
  const [showComments, setShowComments] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const comments = usePostComments(post.id, showComments);
  const liked = post.likes.includes(user.id);
  const category = CATEGORY_BY_ID[post.category];

  const submitComment = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    if (await store.addComment(post.id, text)) setDraft('');
    setSending(false);
  };

  return (
    <article className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200/70">
      <header className="flex items-start gap-3">
        <Avatar name={post.authorName} pref={post.authorPref} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="truncate font-bold text-stone-900">{post.authorName}</span>
            <span className="text-xs text-stone-400">{PREF_BY_ID[post.authorPref].short}出身・{timeAgo(post.createdAt)}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <button type="button" onClick={() => onSelectPref?.(post.pref)} title="この県の投稿を見る">
              <PrefChip pref={post.pref} />
            </button>
            <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-bold text-stone-600">
              {category.emoji} {category.label}
            </span>
          </div>
        </div>
        {post.authorId === user.id && (
          <button
            type="button"
            onClick={() => {
              if (confirm('この投稿を削除しますか？')) store.deletePost(post.id);
            }}
            className="rounded-full p-2 text-stone-400 hover:bg-stone-100 hover:text-red-500"
            aria-label="投稿を削除"
          >
            <Trash2 size={16} />
          </button>
        )}
      </header>

      <p className="mt-3 whitespace-pre-wrap break-words leading-relaxed text-stone-800">{post.text}</p>

      {post.image && (
        <img src={post.image} alt="" className="mt-3 max-h-96 w-full rounded-xl object-cover" loading="lazy" />
      )}

      <footer className="mt-3 flex items-center gap-1 border-t border-stone-100 pt-2">
        <button
          type="button"
          onClick={() => store.toggleLike(post)}
          aria-pressed={liked}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold transition ${
            liked ? 'bg-rose-50 text-rose-500' : 'text-stone-500 hover:bg-stone-100'
          }`}
        >
          <Heart size={18} className={liked ? 'fill-rose-500' : ''} />
          よかね！ {post.likes.length > 0 && post.likes.length}
        </button>
        <button
          type="button"
          onClick={() => setShowComments((v) => !v)}
          aria-expanded={showComments}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold text-stone-500 hover:bg-stone-100"
        >
          <MessageCircle size={18} />
          コメント {post.commentCount > 0 && post.commentCount}
        </button>
      </footer>

      {showComments && (
        <div className="mt-2 space-y-3 rounded-xl bg-stone-50 p-3">
          {comments === null && <p className="text-sm text-stone-400">読み込み中…</p>}
          {comments?.length === 0 && <p className="text-sm text-stone-400">まだコメントはなかよ。一番乗りでどうぞ！</p>}
          {comments?.map((c) => (
            <div key={c.id} className="flex gap-2">
              <Avatar name={c.authorName} pref={c.authorPref} size={28} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-bold text-stone-800">{c.authorName}</span>
                  <PrefChip pref={c.authorPref} size="xs" />
                  <span className="text-stone-400">{timeAgo(c.createdAt)}</span>
                  {c.authorId === user.id && (
                    <button
                      type="button"
                      onClick={() => store.deleteComment(post.id, c.id)}
                      className="ml-auto text-stone-400 hover:text-red-500"
                      aria-label="コメントを削除"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-stone-700">{c.text}</p>
              </div>
            </div>
          ))}
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              submitComment();
            }}
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={200}
              placeholder="コメントを書く…"
              className="min-w-0 flex-1 rounded-full border border-stone-300 bg-white px-4 py-2 text-sm outline-none focus:border-orange-500"
            />
            <button
              type="submit"
              disabled={!draft.trim() || sending}
              className="rounded-full bg-orange-500 p-2 text-white disabled:opacity-40"
              aria-label="コメントを送信"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </article>
  );
}
