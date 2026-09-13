import { Link, Navigate, useParams } from 'react-router-dom';
import { getSubject } from '../data';
import { useProgress } from '../progress';
import type { SubjectKey } from '../types';

export function SubjectPage() {
  const { subject } = useParams<{ subject: string }>();
  const meta = getSubject(subject ?? '');
  const { isUnitStudied } = useProgress();

  if (!meta) return <Navigate to="/" replace />;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link to="/" className="text-sm text-slate-500 underline">
        ← ダッシュボードへ
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">{meta.label}</h1>
      <p className="mt-1 text-sm text-slate-500">{meta.data.units.length}単元</p>

      <Link
        to={`/s/${meta.key}/quiz`}
        className="mt-4 block rounded-xl bg-indigo-600 px-5 py-3 text-center font-semibold text-white shadow-sm transition hover:bg-indigo-700"
      >
        この科目の問題を解く(ランダム15問)
      </Link>

      <ul className="mt-6 space-y-2">
        {meta.data.units.map((unit) => {
          const studied = isUnitStudied(meta.key as SubjectKey, unit.topicNumber);
          return (
            <li key={unit.topicNumber}>
              <Link
                to={`/s/${meta.key}/u/${unit.topicNumber}`}
                className="flex items-center justify-between rounded-lg bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50"
              >
                <span className="text-sm text-slate-800">
                  <span className="mr-2 text-slate-400">{unit.topicNumber}.</span>
                  {unit.topicTitle}
                </span>
                {studied && <span className="text-xs font-medium text-emerald-600">学習済み</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
