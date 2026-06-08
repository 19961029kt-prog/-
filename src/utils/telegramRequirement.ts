import type { GroundCoilRecord } from '../types';

// 作業目的に応じて「現電文」「新電文」のどちらが必要かを判定する
// （切替系の作業では現/新の両方、停止・取付系の作業では現電文のみが必要）
export function telegramRequirement(record: GroundCoilRecord): { current: boolean; next: boolean } {
  switch (record.workPurpose) {
    case '電文切替作業':
    case 'SK→DK化':
      return { current: true, next: true };
    case '使用停止':
    case 'カバー取付':
      return { current: true, next: false };
    default:
      return { current: true, next: true };
  }
}
