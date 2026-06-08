import * as XLSX from 'xlsx';
import type {
  EncoderTelegram,
  EquipmentType,
  GroundCoilRecord,
  PoweredTelegram,
  Telegram,
  UnpoweredTelegram,
  WorkPurpose,
} from '../types';

// インポート用フラットフォーマットの列定義
// 1行＝1地上子。電文バイト列はハイフン区切りの16進数文字列（例: "68-62-11-F4-00-00"）。
// equipmentType に応じて必要な列のみ参照する。
//   UNPOWERED : currentBatteryHigh / currentBatteryLow / newBatteryHigh / newBatteryLow
//   POWERED   : current正極/current負極/current断 / new正極/new負極/new断 (各 "条件名|バイト列")
//   ENCODER   : current電文1..4 / new電文1..4 (各 "条件名|バイト列")

const splitBytes = (s: unknown): string[] => {
  const str = String(s ?? '').trim();
  if (!str) return ['', '', '', '', '', ''];
  const parts = str.split(/[-,\s]+/).filter(Boolean);
  while (parts.length < 6) parts.push('');
  return parts.slice(0, 6);
};

const parseConditionBytes = (s: unknown): { condition: string; bytes: string[] } => {
  const str = String(s ?? '').trim();
  const [condition, byteStr] = str.includes('|') ? str.split('|') : ['', str];
  return { condition: condition.trim(), bytes: splitBytes(byteStr) };
};

function buildUnpoweredTelegram(row: Record<string, unknown>, prefix: 'current' | 'new'): UnpoweredTelegram {
  return {
    kind: 'UNPOWERED',
    batteryHigh: splitBytes(row[`${prefix}BatteryHigh`]),
    batteryLow: splitBytes(row[`${prefix}BatteryLow`]),
  };
}

function buildPoweredTelegram(row: Record<string, unknown>, prefix: 'current' | 'new'): PoweredTelegram {
  const labels: Array<'正極' | '負極' | '断'> = ['正極', '負極', '断'];
  return {
    kind: 'POWERED',
    conditions: labels.map((label) => {
      const { condition, bytes } = parseConditionBytes(row[`${prefix}${label}`]);
      return { label, condition, bytes };
    }),
  };
}

function buildEncoderTelegram(row: Record<string, unknown>, prefix: 'current' | 'new'): EncoderTelegram {
  const entries = [1, 2, 3, 4].map((n) => {
    const { condition, bytes } = parseConditionBytes(row[`${prefix}電文${n}`]);
    return { label: `電文${n}`, condition, bytes };
  });
  return { kind: 'ENCODER', entries };
}

function buildTelegram(equipmentType: EquipmentType, row: Record<string, unknown>, prefix: 'current' | 'new'): Telegram {
  switch (equipmentType) {
    case 'UNPOWERED':
      return buildUnpoweredTelegram(row, prefix);
    case 'POWERED':
      return buildPoweredTelegram(row, prefix);
    case 'ENCODER':
      return buildEncoderTelegram(row, prefix);
  }
}

const normalizeEquipmentType = (v: unknown): EquipmentType => {
  const s = String(v ?? '').toUpperCase();
  if (s.includes('ENCODER') || s.includes('エンコーダ')) return 'ENCODER';
  if (s.includes('POWERED') && !s.includes('UN')) return 'POWERED';
  if (s.includes('UNPOWERED') || s.includes('無電源')) return 'UNPOWERED';
  if (s.includes('有電源')) return 'POWERED';
  return 'UNPOWERED';
};

const normalizeWorkPurpose = (v: unknown): WorkPurpose => {
  const s = String(v ?? '').trim();
  if (s === '電文切替作業' || s === '使用停止' || s === 'SK→DK化' || s === 'カバー取付') return s as WorkPurpose;
  return 'その他';
};

export function parseMasterWorkbook(data: ArrayBuffer): GroundCoilRecord[] {
  const workbook = XLSX.read(data, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

  return rows
    .filter((row) => row.id !== '' && row.id !== undefined)
    .map((row): GroundCoilRecord => {
      const equipmentType = normalizeEquipmentType(row.equipmentType);
      return {
        id: Number(row.id),
        location: String(row.location ?? ''),
        name: String(row.name ?? ''),
        mileage: String(row.mileage ?? ''),
        equipmentType,
        workPurpose: normalizeWorkPurpose(row.workPurpose),
        workType1: String(row.workType1 ?? ''),
        workType2: String(row.workType2 ?? ''),
        installPosition: row.installPosition ? String(row.installPosition) : undefined,
        fileName: row.fileName ? String(row.fileName) : undefined,
        currentTelegram: buildTelegram(equipmentType, row, 'current'),
        newTelegram: buildTelegram(equipmentType, row, 'new'),
      };
    });
}

export async function readMasterFile(file: File): Promise<GroundCoilRecord[]> {
  const buffer = await file.arrayBuffer();
  return parseMasterWorkbook(buffer);
}
