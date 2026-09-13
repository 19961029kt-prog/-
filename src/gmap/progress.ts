import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { createElement } from 'react';
import type { SubjectData, SubjectKey } from './types';
import { questionId } from './types';

const STORAGE_KEY = 'gmap_progress_v1';

interface AnswerRecord {
  timesAnswered: number;
  timesCorrect: number;
  lastCorrect: boolean;
  lastAnsweredAt: number;
}

interface ProgressState {
  answers: Record<string, AnswerRecord>;
  studiedUnits: Record<string, true>;
}

function emptyState(): ProgressState {
  return { answers: {}, studiedUnits: {} };
}

function loadState(): ProgressState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<ProgressState>;
    return { answers: parsed.answers ?? {}, studiedUnits: parsed.studiedUnits ?? {} };
  } catch {
    return emptyState();
  }
}

function saveState(state: ProgressState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ブラウザのストレージが使えない場合は進捗保存を諦める(閲覧自体は継続可能)
  }
}

function unitKey(subject: SubjectKey, topicNumber: number): string {
  return `${subject}|${topicNumber}`;
}

interface ProgressContextValue {
  state: ProgressState;
  recordAnswer: (subject: SubjectKey, topicNumber: number, quizIndex: number, correct: boolean) => void;
  markUnitStudied: (subject: SubjectKey, topicNumber: number) => void;
  isUnitStudied: (subject: SubjectKey, topicNumber: number) => boolean;
  resetProgress: () => void;
}

const ProgressContext = createContext<ProgressContextValue | null>(null);

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ProgressState>(() => loadState());

  useEffect(() => {
    saveState(state);
  }, [state]);

  const recordAnswer = useCallback(
    (subject: SubjectKey, topicNumber: number, quizIndex: number, correct: boolean) => {
      const id = questionId(subject, topicNumber, quizIndex);
      setState((prev) => {
        const existing = prev.answers[id];
        const next: AnswerRecord = {
          timesAnswered: (existing?.timesAnswered ?? 0) + 1,
          timesCorrect: (existing?.timesCorrect ?? 0) + (correct ? 1 : 0),
          lastCorrect: correct,
          lastAnsweredAt: Date.now(),
        };
        return { ...prev, answers: { ...prev.answers, [id]: next } };
      });
    },
    [],
  );

  const markUnitStudied = useCallback((subject: SubjectKey, topicNumber: number) => {
    const key = unitKey(subject, topicNumber);
    setState((prev) => {
      if (prev.studiedUnits[key]) return prev;
      return { ...prev, studiedUnits: { ...prev.studiedUnits, [key]: true } };
    });
  }, []);

  const isUnitStudied = useCallback(
    (subject: SubjectKey, topicNumber: number) => Boolean(state.studiedUnits[unitKey(subject, topicNumber)]),
    [state.studiedUnits],
  );

  const resetProgress = useCallback(() => setState(emptyState()), []);

  const value = useMemo<ProgressContextValue>(
    () => ({ state, recordAnswer, markUnitStudied, isUnitStudied, resetProgress }),
    [state, recordAnswer, markUnitStudied, isUnitStudied, resetProgress],
  );

  return createElement(ProgressContext.Provider, { value }, children);
}

export function useProgress(): ProgressContextValue {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error('useProgress must be used within ProgressProvider');
  return ctx;
}

export interface SubjectStats {
  totalUnits: number;
  studiedUnits: number;
  totalQuestions: number;
  answeredQuestions: number;
  correctQuestions: number;
}

export function computeSubjectStats(
  subject: SubjectKey,
  data: SubjectData,
  progress: ProgressState,
): SubjectStats {
  let totalQuestions = 0;
  let answeredQuestions = 0;
  let correctQuestions = 0;
  let studiedUnits = 0;

  for (const unit of data.units) {
    if (progress.studiedUnits[unitKey(subject, unit.topicNumber)]) studiedUnits += 1;
    unit.quiz.forEach((_, qIndex) => {
      totalQuestions += 1;
      const rec = progress.answers[questionId(subject, unit.topicNumber, qIndex)];
      if (rec) {
        answeredQuestions += 1;
        if (rec.lastCorrect) correctQuestions += 1;
      }
    });
  }

  return { totalUnits: data.units.length, studiedUnits, totalQuestions, answeredQuestions, correctQuestions };
}

export interface WrongQuestionRef {
  subject: SubjectKey;
  topicNumber: number;
  quizIndex: number;
}

/** 直近の解答が不正解だった問題を、科目横断で一覧する(復習モード用)。 */
export function getWrongQuestions(progress: ProgressState): WrongQuestionRef[] {
  const refs: WrongQuestionRef[] = [];
  for (const id of Object.keys(progress.answers)) {
    const rec = progress.answers[id];
    if (!rec.lastCorrect) {
      const [subject, topicNumberStr, quizIndexStr] = id.split('|');
      refs.push({
        subject: subject as SubjectKey,
        topicNumber: Number(topicNumberStr),
        quizIndex: Number(quizIndexStr),
      });
    }
  }
  return refs;
}
