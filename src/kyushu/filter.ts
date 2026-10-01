import type { CategoryId, PrefId } from './data';

export interface TimelineFilter {
  pref: PrefId | null;
  category: CategoryId | null;
  query: string;
  sort: 'new' | 'popular';
}

export const EMPTY_FILTER: TimelineFilter = { pref: null, category: null, query: '', sort: 'new' };
