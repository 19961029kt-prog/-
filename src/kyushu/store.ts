import { useState } from 'react';
import { createSeedPosts, type CategoryId, type Post, type PrefId, type User } from './data';

const USER_KEY = 'kyushu-sns:user';
const POSTS_KEY = 'kyushu-sns:posts';

function load<T>(key: string, fallback: () => T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch (err) {
    console.error('よかとこ九州: 読み込みに失敗しました', err);
  }
  return fallback();
}

function save(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.error('よかとこ九州: 保存に失敗しました', err);
    return false;
  }
}

export function newId(): string {
  return crypto.randomUUID();
}

export interface NewPostInput {
  pref: PrefId;
  category: CategoryId;
  text: string;
  image?: string;
}

/**
 * ユーザーと投稿をブラウザ(localStorage)に保存する簡易ストア。
 * 将来Firestoreなどのバックエンドに置き換える際は、このフックの中身だけを差し替えればよい。
 */
export function useKyushuStore() {
  const [user, setUserState] = useState<User | null>(() => load<User | null>(USER_KEY, () => null));
  const [posts, setPosts] = useState<Post[]>(() => load(POSTS_KEY, () => createSeedPosts(Date.now())));
  const [storageError, setStorageError] = useState(false);

  const commitPosts = (next: Post[]) => {
    setPosts(next);
    // 画像を多く投稿すると容量上限(約5MB)に達するため、失敗を画面に伝える
    setStorageError(!save(POSTS_KEY, next));
  };

  const updatePost = (postId: string, fn: (post: Post) => Post) => {
    commitPosts(posts.map((p) => (p.id === postId ? fn(p) : p)));
  };

  const addPost = (input: NewPostInput) => {
    if (!user) return;
    const post: Post = {
      id: newId(),
      authorId: user.id,
      authorName: user.name,
      authorPref: user.pref,
      ...input,
      createdAt: Date.now(),
      likes: [],
      comments: [],
    };
    commitPosts([post, ...posts]);
  };

  const deletePost = (postId: string) => {
    commitPosts(posts.filter((p) => p.id !== postId));
  };

  const toggleLike = (postId: string) => {
    if (!user) return;
    updatePost(postId, (p) => ({
      ...p,
      likes: p.likes.includes(user.id) ? p.likes.filter((id) => id !== user.id) : [...p.likes, user.id],
    }));
  };

  const addComment = (postId: string, text: string) => {
    if (!user) return;
    updatePost(postId, (p) => ({
      ...p,
      comments: [
        ...p.comments,
        { id: newId(), authorId: user.id, authorName: user.name, authorPref: user.pref, text, createdAt: Date.now() },
      ],
    }));
  };

  const deleteComment = (postId: string, commentId: string) => {
    updatePost(postId, (p) => ({ ...p, comments: p.comments.filter((c) => c.id !== commentId) }));
  };

  /** プロフィールを保存し、過去の投稿・コメントの表示名にも反映する */
  const setUser = (next: User) => {
    setUserState(next);
    save(USER_KEY, next);
    commitPosts(
      posts.map((p) => ({
        ...p,
        ...(p.authorId === next.id ? { authorName: next.name, authorPref: next.pref } : {}),
        comments: p.comments.map((c) =>
          c.authorId === next.id ? { ...c, authorName: next.name, authorPref: next.pref } : c,
        ),
      })),
    );
  };

  return { user, posts, storageError, setUser, addPost, deletePost, toggleLike, addComment, deleteComment };
}

export type KyushuStore = ReturnType<typeof useKyushuStore>;
