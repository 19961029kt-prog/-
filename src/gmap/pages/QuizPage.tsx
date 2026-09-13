import { useMemo } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { getSubject } from '../data';
import { QuizRunner } from '../components/QuizRunner';
import type { QuizItem } from '../components/QuizRunner';
import { shuffle } from '../utils';

const SUBJECT_QUIZ_LIMIT = 15;

export function QuizPage() {
  const { subject, topicNumber } = useParams<{ subject: string; topicNumber?: string }>();
  const navigate = useNavigate();
  const meta = getSubject(subject ?? '');

  const items = useMemo<QuizItem[]>(() => {
    if (!meta) return [];
    const units = topicNumber
      ? meta.data.units.filter((u) => u.topicNumber === Number(topicNumber))
      : meta.data.units;

    const all: QuizItem[] = [];
    for (const unit of units) {
      unit.quiz.forEach((question, quizIndex) => {
        all.push({
          subject: meta.key,
          subjectLabel: meta.label,
          topicNumber: unit.topicNumber,
          topicTitle: unit.topicTitle,
          quizIndex,
          question,
        });
      });
    }

    const shuffled = shuffle(all);
    return topicNumber ? shuffled : shuffled.slice(0, SUBJECT_QUIZ_LIMIT);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta?.key, topicNumber]);

  if (!meta) return <Navigate to="/" replace />;

  const backTo = topicNumber ? `/s/${meta.key}/u/${topicNumber}` : `/s/${meta.key}`;
  const title = topicNumber
    ? `${meta.label} / ${meta.data.units.find((u) => u.topicNumber === Number(topicNumber))?.topicTitle ?? ''}`
    : `${meta.label} 演習`;

  return <QuizRunner items={items} title={title} onExit={() => navigate(backTo)} />;
}
