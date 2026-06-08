import { useContext } from 'react';
import { MasterDataContext } from './masterDataContextDef';

export function useMasterData() {
  const ctx = useContext(MasterDataContext);
  if (!ctx) throw new Error('useMasterData must be used within MasterDataProvider');
  return ctx;
}
