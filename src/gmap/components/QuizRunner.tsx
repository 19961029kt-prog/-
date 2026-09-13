import { useState } from 'react';
import { useProgress } from '../progress';
import type { QuizQuestion, SubjectKey } from '../types';

export interface QuizItem {
  subject: SubjectKey;
  subjectLabel: string;
  topicNumber: number;
  topicTitle: string;
  quizIndex: number;
  question: QuizQuestion;
}

interface QuizRunnerProps {
  items: QuizItem[];
  title: string;
  onExit: () => void;
}

export function QuizRunner({ items, title, onExit }: QuizRunnerProps) {
  const { recordAnswer } = useProgress();
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [missed, setMissed] = useState<QuizItem[]>([]);
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);

  const current = items[index];

  const handleSelect = (choiceIndex: number) => {
    if (selected !== null || !current) return;
    setSelected(choiceIndex);
    const isCorrect = choiceIndex === current.question.answerIndex;
    recordAnswer(current.subject, current.topicNumber, current.quizIndex, isCorrect);
    if (isCorrect) {
      setCorrectCount((c) => c + 1);
    } else {
      setMissed((m) => [...m, current]);
    }
  };

  const handleNext = () => {
    if (index + 1 >= items.length) {
      setFinished(true);
    } else {
      setIndex((i) => i + 1);
      setSelected(null);
    }
  };

  const handleRestart = () => {
    setIndex(0);
    setSelected(null);
    setMissed([]);
    setCorrectCount(0);
    setFinished(false);
  };

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 text-center">
        <p className="text-slate-600">出題できる問題がありません。</p>
        <button type="button" onClick={onExit} className="mt-4 rounded-lg bg-slate-800 px-4 py-2 text-white">
          戻る
        </button>
      </div>
    );
  }

  if (finished) {
    const total = items.length;
    const accuracy = Math.round((correctCount / total) * 100);
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h2 className="text-xl font-bold text-slate-900">{title} 結果</h2>
        <div className="mt-4 rounded-xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
          <p className="text-4xl font-bold text-indigo-600">{accuracy}%</p>
          <p className="mt-1 text-sm text-slate-500">
            {total}問中 {correctCount}問正解
          </p>
        </div>

        {missed.length > 0 && (
          <div className="mt-6">
            <h3 className="font-semibold text-slate-800">間違えた問題の復習</h3>
            <ul className="mt-3 space-y-4">
              {missed.map((m) => (
                <li key={`${m.subject}-${m.topicNumber}-${m.quizIndex}`} className="rounded-lg bg-rose-50 p-4 ring-1 ring-rose-200">
                  <p className="text-xs font-medium text-rose-700">
                    {m.subjectLabel} / {m.topicTitle}
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-800">{m.question.question}</p>
                  <p className="mt-1 text-sm text-emerald-700">
                    正解: {m.question.choices[m.question.answerIndex]}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">{m.question.explanation}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button type="button" onClick={handleRestart} className="rounded-lg bg-indigo-600 px-4 py-2 text-white">
            もう一度解く
          </button>
          <button type="button" onClick={onExit} className="rounded-lg bg-slate-200 px-4 py-2 text-slate-800">
            戻る
          </button>
        </div>
      </div>
    );
  }

  const q = current.question;
  const isAnswered = selected !== null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        <span className="text-sm text-slate-500">
          {index + 1} / {items.length}
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-indigo-500 transition-all"
          style={{ width: `${((index + (isAnswered ? 1 : 0)) / items.length) * 100}%` }}
        />
      </div>

      <p className="mt-4 text-xs font-medium text-indigo-600">
        {current.subjectLabel} / {current.topicTitle}
      </p>
      <p className="mt-2 text-lg font-medium text-slate-900">{q.question}</p>

      <div className="mt-4 space-y-2">
        {q.choices.map((choice, i) => {
          let style = 'border-slate-200 bg-white hover:bg-slate-50';
          if (isAnswered) {
            if (i === q.answerIndex) style = 'border-emerald-400 bg-emerald-50';
            else if (i === selected) style = 'border-rose-400 bg-rose-50';
            else style = 'border-slate-200 bg-white opacity-60';
          }
          return (
            <button
              key={i}
              type="button"
              disabled={isAnswered}
              onClick={() => handleSelect(i)}
              className={`w-full rounded-lg border px-4 py-3 text-left text-sm font-medium text-slate-800 transition ${style}`}
            >
              {choice}
            </button>
          );
        })}
      </div>

      {isAnswered && (
        <div className="mt-4 rounded-lg bg-slate-50 p-4 ring-1 ring-slate-200">
          <p className={`text-sm font-semibold ${selected === q.answerIndex ? 'text-emerald-700' : 'text-rose-700'}`}>
            {selected === q.answerIndex ? '正解です' : '不正解です'}
          </p>
          <p className="mt-1 text-sm text-slate-600">{q.explanation}</p>
          <button type="button" onClick={handleNext} className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white">
            {index + 1 >= items.length ? '結果を見る' : '次の問題へ'}
          </button>
        </div>
      )}

      <button type="button" onClick={onExit} className="mt-6 text-sm text-slate-500 underline">
        中断して戻る
      </button>
    </div>
  );
}
