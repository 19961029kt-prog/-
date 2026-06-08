import { createContext } from 'react';
import type { GroundCoilRecord } from '../types';

export interface MasterDataContextValue {
  records: GroundCoilRecord[];
  setRecords: (records: GroundCoilRecord[]) => void;
  findById: (id: number) => GroundCoilRecord | undefined;
}

export const MasterDataContext = createContext<MasterDataContextValue | null>(null);
