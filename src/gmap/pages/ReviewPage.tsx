import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSubject } from '../data';
import { getWrongQuestions, useProgress } from '../progress';
import { QuizRunner } from '../components/QuizRunner';
import type { QuizItem } from '../components/QuizRunner';
import { shuffle } from '../utils';

export function ReviewPage() {
  const { state } = useProgress();
  const navigate = useNavigate();

  const items = useMemo<QuizItem[]>(() => {
    const refs = getWrongQuestions(state);
    const resolved: QuizItem[] = [];
    for (const ref of refs) {
      const meta = getSubject(ref.subject);
      const unit = meta?.data.units.find((u) => u.topicNumber === ref.topicNumber);
      const question = unit?.quiz[ref.quizIndex];
      if (meta && unit && question) {
        resolved.push({
          subject: meta.key,
          subjectLabel: meta.label,
          topicNumber: unit.topicNumber,
          topicTitle: unit.topicTitle,
          quizIndex: ref.quizIndex,
          question,
        });
      }
    }
    return shuffle(resolved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <QuizRunner items={items} title="間違えた問題の復習" onExit={() => navigate('/')} />;
}
