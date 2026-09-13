import type { SubjectData, SubjectMeta } from '../types';

import marketing from './marketing.json';
import strategy from './strategy.json';
import hrm from './hrm.json';
import ob from './ob.json';
import accounting from './accounting.json';
import finance from './finance.json';

// 出題順はGMAP公式スケジュール(マーケティング→経営戦略→人的資源管理→組織行動学→企業会計→ファイナンス)に合わせている
export const SUBJECTS: SubjectMeta[] = [
  { key: 'marketing', label: 'マーケティング', data: marketing as SubjectData },
  { key: 'strategy', label: '経営戦略', data: strategy as SubjectData },
  { key: 'hrm', label: '人的資源管理', data: hrm as SubjectData },
  { key: 'ob', label: '組織行動学', data: ob as SubjectData },
  { key: 'accounting', label: '企業会計', data: accounting as SubjectData },
  { key: 'finance', label: 'ファイナンス', data: finance as SubjectData },
];

export function getSubject(key: string): SubjectMeta | undefined {
  return SUBJECTS.find((s) => s.key === key);
}
