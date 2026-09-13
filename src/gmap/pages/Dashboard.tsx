import { Link } from 'react-router-dom';
import { SUBJECTS } from '../data';
import { computeSubjectStats, getWrongQuestions, useProgress } from '../progress';

export function Dashboard() {
  const { state, profile, cloudSyncEnabled, logout } = useProgress();
  const wrongCount = new Set(getWrongQuestions(state).map((r) => `${r.subject}|${r.topicNumber}|${r.quizIndex}`)).size;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header>
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-2xl font-bold text-slate-900">GMAP対策</h1>
          <div className="text-right">
            <p className="text-xs text-slate-500">{profile?.name} さん</p>
            <p className="text-[10px] text-slate-400">
              {cloudSyncEnabled ? 'クラウド同期 有効' : 'クラウド同期 未設定(この端末のみ)'}
            </p>
            <button type="button" onClick={logout} className="mt-1 text-[10px] text-indigo-500 underline">
              プロフィール切替
            </button>
          </div>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          6科目・合格基準は各科目正答率60%以上。『グロービスMBAマネジメント・ブック』の内容をもとにしたオリジナル解説と演習問題です。
        </p>
      </header>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {SUBJECTS.map(({ key, label, data }) => {
          const stats = computeSubjectStats(key, data, state);
          const studiedPct = Math.round((stats.studiedUnits / stats.totalUnits) * 100) || 0;
          const accuracy = stats.answeredQuestions > 0 ? Math.round((stats.correctQuestions / stats.answeredQuestions) * 100) : null;
          return (
            <Link
              key={key}
              to={`/s/${key}`}
              className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:shadow-md"
            >
              <h2 className="font-bold text-slate-900">{label}</h2>
              <p className="mt-1 text-xs text-slate-500">
                {stats.studiedUnits}/{stats.totalUnits} 単元を学習済み
              </p>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-indigo-500" style={{ width: `${studiedPct}%` }} />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {accuracy === null ? 'まだ演習していません' : `正答率 ${accuracy}%(${stats.answeredQuestions}問回答)`}
              </p>
            </Link>
          );
        })}
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link
          to="/mock"
          className="flex-1 rounded-xl bg-indigo-600 px-5 py-4 text-center font-semibold text-white shadow-sm transition hover:bg-indigo-700"
        >
          模擬試験(6科目連続)を受ける
        </Link>
        <Link
          to="/review"
          className="flex-1 rounded-xl bg-white px-5 py-4 text-center font-semibold text-slate-800 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50"
        >
          間違えた問題を復習する {wrongCount > 0 ? `(${wrongCount}問)` : ''}
        </Link>
      </div>
    </div>
  );
}
