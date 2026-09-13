import { useState } from 'react';
import type { FormEvent } from 'react';
import { deriveProfileKey } from '../cloudSync';
import type { Profile } from '../profile';

interface LoginGateProps {
  cloudSyncEnabled: boolean;
  onLogin: (profile: Profile) => void;
}

export function LoginGate({ cloudSyncEnabled, onLogin }: LoginGateProps) {
  const [name, setName] = useState('');
  const [birthday, setBirthday] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !birthday || busy) return;
    setBusy(true);
    try {
      const profileKey = await deriveProfileKey(name, birthday);
      onLogin({ name: name.trim(), birthday, profileKey });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-10">
      <h1 className="text-xl font-bold text-slate-900">GMAP対策</h1>
      <p className="mt-2 text-sm text-slate-500">
        名前と生年月日を入力してください。同じ組み合わせを別の端末でも入力すると、学習の進捗が引き継がれます。
      </p>

      {!cloudSyncEnabled && (
        <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-700 ring-1 ring-amber-200">
          現在クラウド同期は未設定のため、この端末のみに進捗が保存されます。
        </p>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="gmap-login-name">
            名前
          </label>
          <input
            id="gmap-login-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例: 山田太郎"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="gmap-login-birthday">
            生年月日
          </label>
          <input
            id="gmap-login-birthday"
            type="date"
            value={birthday}
            onChange={(e) => setBirthday(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={busy || !name.trim() || !birthday}
          className="w-full rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
        >
          はじめる
        </button>
      </form>

      <p className="mt-4 text-xs text-slate-400">
        ※これはパスワードではありません。同じ名前・生年月日を知っている人は学習データを見られる可能性があるため、他人と共有しないでください。
      </p>
    </div>
  );
}
