import { useMemo, useState, type ReactNode } from 'react';
import type { GroundCoilRecord } from '../types';
import { sampleRecords } from '../data/sampleData';
import { MasterDataContext, type MasterDataContextValue } from './masterDataContextDef';

export function MasterDataProvider({ children }: { children: ReactNode }) {
  const [records, setRecords] = useState<GroundCoilRecord[]>(sampleRecords);

  const value = useMemo<MasterDataContextValue>(
    () => ({
      records,
      setRecords,
      findById: (id: number) => records.find((r) => r.id === id),
    }),
    [records],
  );

  return <MasterDataContext.Provider value={value}>{children}</MasterDataContext.Provider>;
}
