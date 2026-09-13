export type SubjectKey = 'marketing' | 'strategy' | 'hrm' | 'ob' | 'accounting' | 'finance';

export interface QuizQuestion {
  question: string;
  choices: string[];
  answerIndex: number;
  explanation: string;
}

export interface Term {
  term: string;
  definition: string;
}

export interface Formula {
  name: string;
  expression: string;
  note: string;
}

export interface DiagramRef {
  file: string;
  caption: string;
}

export interface Unit {
  subject: string;
  part?: string;
  chapter?: string;
  topicNumber: number;
  topicTitle: string;
  summary: string[];
  terms: Term[];
  formulas: Formula[];
  quiz: QuizQuestion[];
  diagrams?: DiagramRef[];
}

export interface SubjectData {
  subject: string;
  units: Unit[];
}

export interface SubjectMeta {
  key: SubjectKey;
  label: string;
  data: SubjectData;
}

/** Stable identifier for one quiz question, used as the localStorage progress key. */
export function questionId(subject: SubjectKey, topicNumber: number, quizIndex: number): string {
  return `${subject}|${topicNumber}|${quizIndex}`;
}
