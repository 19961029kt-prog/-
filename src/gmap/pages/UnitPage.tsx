import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { getSubject } from '../data';
import { useProgress } from '../progress';
import { resolveDiagramUrl } from '../diagramAssets';
import type { DiagramRef, SubjectKey, Term } from '../types';

function DiagramFigure({ diagram }: { diagram: DiagramRef }) {
  const url = resolveDiagramUrl(diagram.file);
  if (!url) return null;
  return (
    <figure className="overflow-hidden rounded-lg bg-white ring-1 ring-slate-200">
      <img src={url} alt={diagram.caption} className="w-full" loading="lazy" />
      {diagram.caption && (
        <figcaption className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
          {diagram.caption}
        </figcaption>
      )}
    </figure>
  );
}

function TermCard({ term }: { term: Term }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setFlipped((f) => !f)}
      className="w-full rounded-lg bg-white px-4 py-3 text-left shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50"
    >
      {!flipped ? (
        <p className="text-sm font-semibold text-indigo-700">{term.term}</p>
      ) : (
        <p className="text-sm text-slate-700">{term.definition}</p>
      )}
      <p className="mt-1 text-[10px] text-slate-400">{flipped ? 'クリックで用語を表示' : 'クリックで意味を表示'}</p>
    </button>
  );
}

export function UnitPage() {
  const { subject, topicNumber } = useParams<{ subject: string; topicNumber: string }>();
  const meta = getSubject(subject ?? '');
  const { markUnitStudied } = useProgress();
  const unit = meta?.data.units.find((u) => u.topicNumber === Number(topicNumber));

  useEffect(() => {
    if (meta && unit) markUnitStudied(meta.key as SubjectKey, unit.topicNumber);
  }, [meta, unit, markUnitStudied]);

  if (!meta || !unit) return <Navigate to="/" replace />;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link to={`/s/${meta.key}`} className="text-sm text-slate-500 underline">
        ← {meta.label}の単元一覧へ
      </Link>
      <p className="mt-2 text-xs font-medium text-indigo-600">
        {unit.part} {unit.chapter ? `/ ${unit.chapter}` : ''}
      </p>
      <h1 className="text-xl font-bold text-slate-900">
        {unit.topicNumber}. {unit.topicTitle}
      </h1>

      <section className="mt-4">
        <h2 className="text-sm font-semibold text-slate-700">要点</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
          {unit.summary.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      </section>

      {unit.diagrams && unit.diagrams.length > 0 && (
        <section className="mt-5">
          <h2 className="text-sm font-semibold text-slate-700">図解(教科書より)</h2>
          <div className="mt-2 space-y-3">
            {unit.diagrams.map((d, i) => (
              <DiagramFigure key={i} diagram={d} />
            ))}
          </div>
        </section>
      )}

      {unit.formulas.length > 0 && (
        <section className="mt-5">
          <h2 className="text-sm font-semibold text-slate-700">公式</h2>
          <ul className="mt-2 space-y-2">
            {unit.formulas.map((f, i) => (
              <li key={i} className="rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
                <p className="text-sm font-semibold text-slate-800">{f.name}</p>
                <p className="mt-1 font-mono text-sm text-indigo-700">{f.expression}</p>
                <p className="mt-1 text-xs text-slate-500">{f.note}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {unit.terms.length > 0 && (
        <section className="mt-5">
          <h2 className="text-sm font-semibold text-slate-700">重要用語(タップで意味を表示)</h2>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {unit.terms.map((t, i) => (
              <TermCard key={i} term={t} />
            ))}
          </div>
        </section>
      )}

      <Link
        to={`/s/${meta.key}/u/${unit.topicNumber}/quiz`}
        className="mt-6 block rounded-xl bg-indigo-600 px-5 py-3 text-center font-semibold text-white shadow-sm transition hover:bg-indigo-700"
      >
        この単元の問題を解く({unit.quiz.length}問)
      </Link>
    </div>
  );
}
