import { useEffect, useState } from 'react';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type DocumentSnapshot,
} from 'firebase/firestore';
import { auth, COMMENTS, db, POSTS, USERS } from './firebase';
import type { CategoryId, Comment, Post, PrefId, User } from './data';

/** タイムラインに読み込む最新投稿の件数 */
const POST_LIMIT = 200;

export interface NewPostInput {
  pref: PrefId;
  category: CategoryId;
  text: string;
  image?: string;
}

export type ProfileInput = Omit<User, 'id'>;

/** サーバー側のタイムスタンプ(書き込み直後は未確定なので推定値)をミリ秒にする */
function millis(snap: DocumentSnapshot<DocumentData>): number {
  const ts = snap.get('createdAt', { serverTimestamps: 'estimate' });
  return ts?.toMillis?.() ?? Date.now();
}

function toPost(snap: DocumentSnapshot<DocumentData>): Post {
  const d = snap.data()!;
  return {
    id: snap.id,
    authorId: d.authorId,
    authorName: d.authorName,
    authorPref: d.authorPref,
    pref: d.pref,
    category: d.category,
    text: d.text,
    image: d.image,
    createdAt: millis(snap),
    likes: d.likes ?? [],
    commentCount: d.commentCount ?? 0,
  };
}

function toComment(snap: DocumentSnapshot<DocumentData>): Comment {
  const d = snap.data()!;
  return {
    id: snap.id,
    authorId: d.authorId,
    authorName: d.authorName,
    authorPref: d.authorPref,
    text: d.text,
    createdAt: millis(snap),
  };
}

function describeError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  if (code.includes('permission-denied')) {
    return 'サーバーに保存を断られました。Firestoreのセキュリティルールが設定されているか確認してください。';
  }
  if (code.includes('unavailable')) return 'サーバーにつながりません。電波の状態を確認してください。';
  if (code.includes('admin-restricted-operation') || code.includes('operation-not-allowed')) {
    return 'Firebaseの匿名ログインが有効になっていません。';
  }
  return 'うまくいきませんでした。時間をおいてもう一度試してください。';
}

/**
 * ユーザーと投稿をFirestoreで共有するストア。
 * ログインは匿名認証で、ブラウザごとに1人のユーザーとして扱う。
 */
export function useKyushuStore() {
  const [uid, setUid] = useState<string | null>(null);
  const [profile, setProfile] = useState<{ uid: string; user: User | null } | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoaded, setPostsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);

  useEffect(
    () =>
      onAuthStateChanged(auth, (firebaseUser) => {
        if (firebaseUser) {
          setUid(firebaseUser.uid);
          return;
        }
        signInAnonymously(auth).catch((err) => {
          console.error('よかとこ九州: 匿名ログインに失敗しました', err);
          setFatal(describeError(err));
        });
      }),
    [],
  );

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      doc(db, USERS, uid),
      (snap) => {
        const d = snap.data();
        setProfile({ uid, user: d ? { id: uid, name: d.name, pref: d.pref, bio: d.bio ?? '' } : null });
      },
      (err) => {
        console.error('よかとこ九州: プロフィールの読み込みに失敗しました', err);
        setFatal(describeError(err));
      },
    );
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      query(collection(db, POSTS), orderBy('createdAt', 'desc'), limit(POST_LIMIT)),
      (snap) => {
        setPosts(snap.docs.map(toPost));
        setPostsLoaded(true);
      },
      (err) => {
        console.error('よかとこ九州: 投稿の読み込みに失敗しました', err);
        setFatal(describeError(err));
      },
    );
  }, [uid]);

  const user = profile && profile.uid === uid ? profile.user : null;
  const ready = Boolean(uid && profile?.uid === uid && postsLoaded);

  /** 書き込み処理を実行し、失敗したら画面にエラーを出す。成功したらtrue。 */
  const run = async (label: string, fn: () => Promise<unknown>): Promise<boolean> => {
    try {
      await fn();
      setError(null);
      return true;
    } catch (err) {
      console.error(`よかとこ九州: ${label}に失敗しました`, err);
      setError(`${label}に失敗しました。${describeError(err)}`);
      return false;
    }
  };

  /** プロフィールを保存し、過去の投稿の表示名にも反映する(コメントは書いた時点の名前のまま) */
  const saveProfile = (input: ProfileInput) =>
    run('プロフィールの保存', async () => {
      if (!uid) throw new Error('not signed in');
      const renamed = user && (user.name !== input.name || user.pref !== input.pref);
      await setDoc(doc(db, USERS, uid), { ...input, updatedAt: serverTimestamp() });
      if (!renamed) return;
      const mine = await getDocs(query(collection(db, POSTS), where('authorId', '==', uid)));
      const batch = writeBatch(db);
      mine.docs.forEach((d) => batch.update(d.ref, { authorName: input.name, authorPref: input.pref }));
      await batch.commit();
    });

  const addPost = (input: NewPostInput) =>
    run('投稿', async () => {
      if (!user) throw new Error('no profile');
      await addDoc(collection(db, POSTS), {
        authorId: user.id,
        authorName: user.name,
        authorPref: user.pref,
        pref: input.pref,
        category: input.category,
        text: input.text,
        ...(input.image ? { image: input.image } : {}),
        createdAt: serverTimestamp(),
        likes: [],
        commentCount: 0,
      });
    });

  const deletePost = (postId: string) =>
    run('投稿の削除', async () => {
      const postRef = doc(db, POSTS, postId);
      const comments = await getDocs(collection(postRef, COMMENTS));
      const batch = writeBatch(db);
      comments.docs.forEach((c) => batch.delete(c.ref));
      batch.delete(postRef);
      await batch.commit();
    });

  const toggleLike = (post: Post) =>
    run('よかね！', async () => {
      if (!user) throw new Error('no profile');
      const liked = post.likes.includes(user.id);
      await updateDoc(doc(db, POSTS, post.id), { likes: liked ? arrayRemove(user.id) : arrayUnion(user.id) });
    });

  const addComment = (postId: string, text: string) =>
    run('コメント', async () => {
      if (!user) throw new Error('no profile');
      const postRef = doc(db, POSTS, postId);
      const batch = writeBatch(db);
      batch.set(doc(collection(postRef, COMMENTS)), {
        authorId: user.id,
        authorName: user.name,
        authorPref: user.pref,
        text,
        createdAt: serverTimestamp(),
      });
      batch.update(postRef, { commentCount: increment(1) });
      await batch.commit();
    });

  const deleteComment = (postId: string, commentId: string) =>
    run('コメントの削除', async () => {
      const postRef = doc(db, POSTS, postId);
      const batch = writeBatch(db);
      batch.delete(doc(postRef, COMMENTS, commentId));
      batch.update(postRef, { commentCount: increment(-1) });
      await batch.commit();
    });

  return {
    ready,
    user,
    posts,
    error,
    fatal,
    dismissError: () => setError(null),
    saveProfile,
    addPost,
    deletePost,
    toggleLike,
    addComment,
    deleteComment,
  };
}

export type KyushuStore = ReturnType<typeof useKyushuStore>;

/** 投稿のコメントをリアルタイムに購読する。enabledがfalseの間は読み込まない。 */
export function usePostComments(postId: string, enabled: boolean) {
  const [state, setState] = useState<{ postId: string; comments: Comment[] } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    return onSnapshot(
      query(collection(db, POSTS, postId, COMMENTS), orderBy('createdAt', 'asc')),
      (snap) => setState({ postId, comments: snap.docs.map(toComment) }),
      (err) => console.error('よかとこ九州: コメントの読み込みに失敗しました', err),
    );
  }, [postId, enabled]);

  return state?.postId === postId ? state.comments : null;
}
