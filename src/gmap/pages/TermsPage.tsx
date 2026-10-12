import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { getSubject } from '../data';
import { useProgress } from '../progress';
import type { SubjectKey } from '../types';

interface MaskableProps {
  text: string;
  masked: boolean;
  onToggle: () => void;
  emphasize?: boolean;
}

function Maskable({ text, masked, onToggle, emphasize }: MaskableProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`block w-full rounded px-2 py-1.5 text-left text-sm transition ${
        emphasize ? 'font-semibold text-indigo-700' : 'text-slate-700'
      } ${masked ? 'bg-slate-800 text-transparent selection:bg-transparent' : 'bg-transparent hover:bg-slate-50'}`}
    >
      {text}
    </button>
  );
}

interface TermRowProps {
  subject: SubjectKey;
  topicNumber: number;
  termIndex: number;
  term: string;
  definition: string;
  initialMasked: boolean;
}

function TermRow({ subject, topicNumber, termIndex, term, definition, initialMasked }: TermRowProps) {
  const { toggleTermKnown, isTermKnown } = useProgress();
  const [termMasked, setTermMasked] = useState(initialMasked);
  const [defMasked, setDefMasked] = useState(initialMasked);
  const known = isTermKnown(subject, topicNumber, termIndex);

  return (
    <li className={`rounded-lg bg-white p-3 shadow-sm ring-1 ring-slate-200 ${known ? 'opacity-50' : ''}`}>
      <div className="flex items-start gap-2">
        <label className="mt-1.5 flex shrink-0 items-center gap-1.5 text-[10px] text-slate-400">
          <input
            type="checkbox"
            checked={known}
            onChange={() => toggleTermKnown(subject, topicNumber, termIndex)}
            className="h-3.5 w-3.5"
          />
        </label>
        <div className={`min-w-0 flex-1 ${known ? 'line-through decoration-slate-400' : ''}`}>
          <Maskable text={term} masked={termMasked} onToggle={() => setTermMasked((m) => !m)} emphasize />
          <Maskable text={definition} masked={defMasked} onToggle={() => setDefMasked((m) => !m)} />
        </div>
      </div>
    </li>
  );
}

export function TermsPage() {
  const { subject } = useParams<{ subject: string }>();
  const meta = getSubject(subject ?? '');
  const [maskCommand, setMaskCommand] = useState<{ mode: 'show' | 'hide'; id: number } | null>(null);

  if (!meta) return <Navigate to="/" replace />;

  const groups = meta.data.units
    .map((unit, unitIndex) => ({ unit, unitIndex, terms: unit.terms }))
    .filter((g) => g.terms.length > 0);

  const totalTerms = groups.reduce((sum, g) => sum + g.terms.length, 0);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link to={`/s/${meta.key}`} className="text-sm text-slate-500 underline">
        ← {meta.label}の単元一覧へ
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">{meta.label} 用語一覧</h1>
      <p className="mt-1 text-sm text-slate-500">
        全{totalTerms}語。用語・意味はタップすると見え消し(隠す/表示)を切り替えられます。覚えたらチェックを入れてください。
      </p>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => setMaskCommand((c) => ({ mode: 'hide', id: (c?.id ?? 0) + 1 }))}
          className="flex-1 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white"
        >
          すべて隠す
        </button>
        <button
          type="button"
          onClick={() => setMaskCommand((c) => ({ mode: 'show', id: (c?.id ?? 0) + 1 }))}
          className="flex-1 rounded-lg bg-slate-200 px-4 py-2 text-sm font-medium text-slate-800"
        >
          すべて表示
        </button>
      </div>

      <div className="mt-6 space-y-6">
        {groups.map(({ unit, unitIndex, terms }) => (
          <section key={unit.topicNumber}>
            <h2 className="text-xs font-semibold text-indigo-600">
              {unitIndex + 1}. {unit.topicTitle}
            </h2>
            <ul className="mt-2 space-y-2">
              {terms.map((t, termIndex) => (
                <TermRow
                  key={`${termIndex}-${maskCommand?.id ?? 0}`}
                  subject={meta.key}
                  topicNumber={unit.topicNumber}
                  termIndex={termIndex}
                  term={t.term}
                  definition={t.definition}
                  initialMasked={maskCommand?.mode === 'hide'}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
