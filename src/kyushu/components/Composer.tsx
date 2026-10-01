import { useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { CATEGORIES, PREFECTURES, type CategoryId, type PrefId, type User } from '../data';
import type { NewPostInput } from '../store';
import { resizeImage } from '../utils';

const MAX_LENGTH = 280;

interface Props {
  user: User;
  onSubmit: (input: NewPostInput) => void;
  onClose: () => void;
}

export default function Composer({ user, onSubmit, onClose }: Props) {
  const [pref, setPref] = useState<PrefId>(user.pref);
  const [category, setCategory] = useState<CategoryId>('gourmet');
  const [text, setText] = useState('');
  const [image, setImage] = useState<string | undefined>();
  const [imageError, setImageError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const canSubmit = text.trim().length > 0 && text.length <= MAX_LENGTH;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="魅力を投稿する"
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-stone-900">九州のよかとこを投稿</h2>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-stone-500 hover:bg-stone-100" aria-label="閉じる">
            <X size={20} />
          </button>
        </div>

        <form
          className="mt-4 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!canSubmit) return;
            onSubmit({ pref, category, text: text.trim(), image });
          }}
        >
          <div>
            <p className="text-xs font-bold text-stone-500">どこの話？</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {PREFECTURES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPref(p.id)}
                  aria-pressed={pref === p.id}
                  className={`rounded-full px-3 py-1 text-sm font-bold transition ${
                    pref === p.id ? `${p.dot} text-white` : 'bg-stone-100 text-stone-600'
                  }`}
                >
                  {p.short}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-stone-500">ジャンル</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategory(c.id)}
                  aria-pressed={category === c.id}
                  className={`rounded-full px-3 py-1 text-sm font-bold transition ${
                    category === c.id ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-600'
                  }`}
                >
                  {c.emoji} {c.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              autoFocus
              placeholder="地元の自慢、おすすめのお店、好きな景色、方言…なんでも語ってね"
              className="w-full resize-none rounded-xl border border-stone-300 p-3 leading-relaxed outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            />
            <p className={`text-right text-xs ${text.length > MAX_LENGTH ? 'font-bold text-red-500' : 'text-stone-400'}`}>
              {text.length} / {MAX_LENGTH}
            </p>
          </div>

          {image ? (
            <div className="relative">
              <img src={image} alt="添付画像のプレビュー" className="max-h-64 w-full rounded-xl object-cover" />
              <button
                type="button"
                onClick={() => setImage(undefined)}
                className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white"
                aria-label="画像を外す"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-stone-300 py-3 text-sm font-bold text-stone-500 hover:border-orange-400 hover:text-orange-500"
            >
              <ImagePlus size={18} /> 写真を追加
            </button>
          )}
          {imageError && <p className="text-sm text-red-500">{imageError}</p>}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              try {
                setImage(await resizeImage(file));
                setImageError('');
              } catch {
                setImageError('画像を読み込めませんでした。別の画像を試してください。');
              }
            }}
          />

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full rounded-xl bg-orange-500 py-3 font-bold text-white shadow-lg shadow-orange-500/30 disabled:opacity-40"
          >
            投稿する
          </button>
        </form>
      </div>
    </div>
  );
}
