import { useState } from 'react';
import { PREFECTURES, type PrefId, type User } from '../data';
import type { ProfileInput } from '../store';

interface Props {
  initial?: User | null;
  submitLabel: string;
  onSubmit: (input: ProfileInput) => Promise<boolean>;
  onCancel?: () => void;
}

export default function ProfileForm({ initial, submitLabel, onSubmit, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [pref, setPref] = useState<PrefId | null>(initial?.pref ?? null);
  const [bio, setBio] = useState(initial?.bio ?? '');
  const [saving, setSaving] = useState(false);

  const canSubmit = name.trim().length > 0 && pref !== null && !saving;

  return (
    <form
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!canSubmit) return;
        setSaving(true);
        await onSubmit({ name: name.trim(), pref, bio: bio.trim() });
        setSaving(false);
      }}
    >
      <label className="block">
        <span className="text-sm font-bold text-stone-700">ニックネーム</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={20}
          placeholder="例：博多っ子"
          className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
        />
      </label>

      <fieldset>
        <legend className="text-sm font-bold text-stone-700">地元（ゆかりのある県）</legend>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {PREFECTURES.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPref(p.id)}
              aria-pressed={pref === p.id}
              className={`rounded-xl border-2 px-1 py-2 text-sm font-bold transition ${
                pref === p.id ? `border-transparent ${p.dot} text-white` : 'border-stone-200 bg-white text-stone-700'
              }`}
            >
              {p.short}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className="text-sm font-bold text-stone-700">ひとこと（任意）</span>
        <input
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={60}
          placeholder="例：週末は温泉めぐりしとります"
          className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
        />
      </label>

      <div className="flex gap-2">
        {onCancel && (
          <button type="button" onClick={onCancel} className="flex-1 rounded-xl bg-stone-200 py-3 font-bold text-stone-700">
            キャンセル
          </button>
        )}
        <button
          type="submit"
          disabled={!canSubmit}
          className="flex-1 rounded-xl bg-orange-500 py-3 font-bold text-white shadow-lg shadow-orange-500/30 transition disabled:opacity-40"
        >
          {saving ? '保存中…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
