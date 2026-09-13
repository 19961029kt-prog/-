import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { SUBJECTS } from '../data';
import { QuizRunner } from '../components/QuizRunner';
import type { QuizItem } from '../components/QuizRunner';
import { shuffle } from '../utils';

const QUESTIONS_PER_SUBJECT = 5;

export function MockExamPage() {
  const navigate = useNavigate();

  const items = useMemo<QuizItem[]>(() => {
    const all: QuizItem[] = [];
    for (const { key, label, data } of SUBJECTS) {
      const subjectItems: QuizItem[] = [];
      for (const unit of data.units) {
        unit.quiz.forEach((question, quizIndex) => {
          subjectItems.push({
            subject: key,
            subjectLabel: label,
            topicNumber: unit.topicNumber,
            topicTitle: unit.topicTitle,
            quizIndex,
            question,
          });
        });
      }
      all.push(...shuffle(subjectItems).slice(0, QUESTIONS_PER_SUBJECT));
    }
    return all;
  }, []);

  return (
    <QuizRunner items={items} title="模擬試験" onExit={() => navigate('/')} />
  );
}
