// 機器種別
export type EquipmentType = 'UNPOWERED' | 'POWERED' | 'ENCODER';

// 16進数2桁のバイト列（マス目1つ＝1バイト）
export type HexBytes = string[];

// 無電源用：電池残量「有り時」「無し時」の電文（各6バイト）
export interface UnpoweredTelegram {
  kind: 'UNPOWERED';
  batteryHigh: HexBytes; // 電池残量 有り時
  batteryLow: HexBytes; // 電池残量 無し時
}

// 有電源用：正極／負極／断の送信条件電文（各6バイト＋条件名）
export interface PoweredCondition {
  label: '正極' | '負極' | '断';
  bytes: HexBytes;
  condition: string; // 例: "1RC", "1RC以外", "停止現示"
}
export interface PoweredTelegram {
  kind: 'POWERED';
  conditions: PoweredCondition[];
}

// エンコーダ用：電文1〜4（各6バイト＋番線等の条件名）
export interface EncoderEntry {
  label: string; // 例: "電文1"
  bytes: HexBytes;
  condition: string; // 例: "1番線"
}
export interface EncoderTelegram {
  kind: 'ENCODER';
  entries: EncoderEntry[];
}

// ポリモーフィックな電文型（機器種別に応じて構造が変化する）
export type Telegram = UnpoweredTelegram | PoweredTelegram | EncoderTelegram;

// 作業目的（不要項目のグレーアウト判定に利用）
export type WorkPurpose = '電文切替作業' | '使用停止' | 'SK→DK化' | 'カバー取付' | 'その他';

// マスタデータ（地上子1台分のレコード）
export interface GroundCoilRecord {
  id: number; // 説明図番号
  location: string; // 所属箇所（駅・区間）
  name: string; // 地上子名称
  mileage: string; // キロ程
  equipmentType: EquipmentType; // 機器種別
  workPurpose: WorkPurpose; // 作業目的
  workType1: string; // 切替当日作業①
  workType2: string; // 切替当日作業②
  installPosition?: string; // 設置位置
  fileName?: string; // 地上子電文ファイル名
  currentTelegram: Telegram; // 【現】電文
  newTelegram: Telegram; // 【新】電文
}

export const EQUIPMENT_TYPE_LABEL: Record<EquipmentType, string> = {
  UNPOWERED: 'ATS-DK無電源用地上子',
  POWERED: 'ATS-DK有電源用地上子',
  ENCODER: 'ATS-DK有電源エンコーダ用地上子',
};
