import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createElement } from 'react';
import type { SubjectData, SubjectKey } from './types';
import { questionId } from './types';
import { clearProfile, loadProfile, saveProfile } from './profile';
import type { Profile } from './profile';
import { isFirebaseConfigured, subscribeProfile, writeProfile } from './cloudSync';

const STORAGE_KEY = 'gmap_progress_v1';
const SYNC_DEBOUNCE_MS = 1500;

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

/** ローカルとクラウド(他端末)の進捗をマージする。回答は新しい方を採用、学習済みフラグは和集合。 */
function mergeState(local: ProgressState, remote: Partial<ProgressState>): ProgressState {
  const answers: Record<string, AnswerRecord> = { ...local.answers };
  for (const [id, remoteRecord] of Object.entries(remote.answers ?? {})) {
    const localRecord = answers[id];
    if (!localRecord || remoteRecord.lastAnsweredAt > localRecord.lastAnsweredAt) {
      answers[id] = remoteRecord;
    }
  }
  return {
    answers,
    studiedUnits: { ...(remote.studiedUnits ?? {}), ...local.studiedUnits },
  };
}

function statesEqual(a: ProgressState, b: ProgressState): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function unitKey(subject: SubjectKey, topicNumber: number): string {
  return `${subject}|${topicNumber}`;
}

interface ProgressContextValue {
  state: ProgressState;
  profile: Profile | null;
  cloudSyncEnabled: boolean;
  login: (profile: Profile) => void;
  logout: () => void;
  recordAnswer: (subject: SubjectKey, topicNumber: number, quizIndex: number, correct: boolean) => void;
  markUnitStudied: (subject: SubjectKey, topicNumber: number) => void;
  isUnitStudied: (subject: SubjectKey, topicNumber: number) => boolean;
  resetProgress: () => void;
}

const ProgressContext = createContext<ProgressContextValue | null>(null);

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(() => loadProfile());
  const [state, setState] = useState<ProgressState>(() => loadState());
  const isApplyingRemote = useRef(false);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ローカルキャッシュへの保存(常時)
  useEffect(() => {
    saveState(state);
  }, [state]);

  // クラウド購読: ログイン中のプロフィールがあればFirestoreの変更を購読し、ローカルへマージする
  useEffect(() => {
    if (!profile) return undefined;
    const unsubscribe = subscribeProfile(profile.profileKey, (remote) => {
      setState((prev) => {
        const merged = mergeState(prev, remote as Partial<ProgressState>);
        if (statesEqual(merged, prev)) return prev;
        isApplyingRemote.current = true;
        return merged;
      });
    });
    return unsubscribe;
  }, [profile]);

  // クラウドへの書き込み: リモート由来の更新では書き込まない(往復ループ防止)。デバウンスして送信。
  useEffect(() => {
    if (!profile) return undefined;
    if (isApplyingRemote.current) {
      isApplyingRemote.current = false;
      return undefined;
    }
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      writeProfile(profile.profileKey, { answers: state.answers, studiedUnits: state.studiedUnits }).catch((err) =>
        console.error('GMAP cloud sync: write failed', err),
      );
    }, SYNC_DEBOUNCE_MS);
    return () => {
      if (syncTimer.current) clearTimeout(syncTimer.current);
    };
  }, [state, profile]);

  const login = useCallback((newProfile: Profile) => {
    saveProfile(newProfile);
    setProfile(newProfile);
  }, []);

  const logout = useCallback(() => {
    clearProfile();
    setProfile(null);
  }, []);

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
    () => ({
      state,
      profile,
      cloudSyncEnabled: isFirebaseConfigured(),
      login,
      logout,
      recordAnswer,
      markUnitStudied,
      isUnitStudied,
      resetProgress,
    }),
    [state, profile, login, logout, recordAnswer, markUnitStudied, isUnitStudied, resetProgress],
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
