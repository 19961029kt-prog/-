import type { GroundCoilRecord } from '../types';

export interface SummaryRow {
  record: GroundCoilRecord;
  locationRowSpan: number | null; // null = このセルは前の行に結合されるため描画しない
}

// 連続する行で「所属箇所」が同じ場合に rowSpan でグループ化するための行情報を計算する
export function computeSummaryRows(records: GroundCoilRecord[]): SummaryRow[] {
  const rows: SummaryRow[] = records.map((record) => ({ record, locationRowSpan: 1 }));
  let groupStart = 0;
  for (let i = 1; i <= rows.length; i++) {
    const sameAsPrev = i < rows.length && rows[i].record.location === rows[groupStart].record.location;
    if (!sameAsPrev) {
      const groupSize = i - groupStart;
      rows[groupStart].locationRowSpan = groupSize;
      for (let j = groupStart + 1; j < i; j++) rows[j].locationRowSpan = null;
      groupStart = i;
    }
  }
  return rows;
}
