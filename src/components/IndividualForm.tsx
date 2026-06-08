import { useMemo, useState } from 'react';
import { useMasterData } from '../context/useMasterData';
import { EQUIPMENT_TYPE_LABEL, type GroundCoilRecord, type Telegram } from '../types';
import { HexByteGrid } from './HexByteGrid';
import { telegramRequirement } from '../utils/telegramRequirement';

function TelegramBlock({ title, telegram, grayedOut }: { title: string; telegram: Telegram; grayedOut: boolean }) {
  return (
    <div className={`rounded border p-3 ${grayedOut ? 'border-gray-300 bg-gray-50' : 'border-gray-700 bg-white'}`}>
      <h4 className={`mb-2 text-sm font-bold ${grayedOut ? 'text-gray-400' : 'text-gray-800'}`}>
        {title}
        {grayedOut && <span className="ml-2 text-xs font-normal">（今回作業では対象外）</span>}
      </h4>
      <div className="flex flex-col gap-2">
        {telegram.kind === 'UNPOWERED' && (
          <>
            <HexByteGrid label="電池残量 有り時" bytes={telegram.batteryHigh} grayedOut={grayedOut} />
            <HexByteGrid label="電池残量 無し時" bytes={telegram.batteryLow} grayedOut={grayedOut} />
          </>
        )}
        {telegram.kind === 'POWERED' &&
          telegram.conditions.map((c) => (
            <HexByteGrid key={c.label} label={`${c.label}（${c.condition}）`} bytes={c.bytes} grayedOut={grayedOut} />
          ))}
        {telegram.kind === 'ENCODER' &&
          telegram.entries.map((e) => (
            <HexByteGrid key={e.label} label={`${e.label}（${e.condition}）`} bytes={e.bytes} grayedOut={grayedOut} />
          ))}
      </div>
    </div>
  );
}

interface IndividualFormProps {
  onRecordChange?: (record: GroundCoilRecord | undefined) => void;
}

export function IndividualForm({ onRecordChange }: IndividualFormProps = {}) {
  const { findById } = useMasterData();
  const [idInput, setIdInput] = useState('');
  const [activeId, setActiveId] = useState<number | null>(null);

  const record = useMemo(() => (activeId !== null ? findById(activeId) : undefined), [activeId, findById]);
  const requirement = record ? telegramRequirement(record) : null;

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(idInput);
    const id = Number.isFinite(n) ? n : null;
    setActiveId(id);
    onRecordChange?.(id !== null ? findById(id) : undefined);
  };

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleLookup} className="flex items-end gap-2">
        <label className="flex flex-col text-sm text-gray-700">
          説明図番号 (id)
          <input
            type="number"
            value={idInput}
            onChange={(e) => setIdInput(e.target.value)}
            className="mt-1 w-40 rounded border border-gray-400 px-2 py-1"
            placeholder="例: 1"
          />
        </label>
        <button type="submit" className="rounded bg-gray-800 px-4 py-1.5 text-white hover:bg-gray-700">
          呼び出し
        </button>
      </form>

      {activeId !== null && !record && (
        <p className="text-red-600">説明図番号 {activeId} のデータが見つかりません。</p>
      )}

      {record && requirement && (
        <div id="individual-form-content" className="flex flex-col gap-4 rounded border border-gray-300 bg-white p-5">
          <header className="border-b border-gray-300 pb-3">
            <h2 className="text-lg font-bold text-gray-900">{EQUIPMENT_TYPE_LABEL[record.equipmentType]} 作業確認表</h2>
            <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-gray-700 sm:grid-cols-3">
              <div><dt className="inline font-medium">説明図番号：</dt><dd className="inline">{record.id}</dd></div>
              <div><dt className="inline font-medium">所属箇所：</dt><dd className="inline">{record.location}</dd></div>
              <div><dt className="inline font-medium">キロ程：</dt><dd className="inline">{record.mileage}</dd></div>
              <div><dt className="inline font-medium">地上子名称：</dt><dd className="inline">{record.name}</dd></div>
              <div><dt className="inline font-medium">作業目的：</dt><dd className="inline">{record.workPurpose}</dd></div>
              <div><dt className="inline font-medium">設置位置：</dt><dd className="inline">{record.installPosition ?? '-'}</dd></div>
              <div className="col-span-2 sm:col-span-3"><dt className="inline font-medium">切替当日作業：</dt><dd className="inline">{[record.workType1, record.workType2].filter(Boolean).join(' / ') || '-'}</dd></div>
              <div className="col-span-2 sm:col-span-3"><dt className="inline font-medium">地上子電文ファイル名：</dt><dd className="inline">{record.fileName ?? '-'}</dd></div>
            </dl>
          </header>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <TelegramBlock title="【現】電文" telegram={record.currentTelegram} grayedOut={!requirement.current} />
            <TelegramBlock title="【新】電文" telegram={record.newTelegram} grayedOut={!requirement.next} />
          </div>

          <div className="flex gap-4 border-t border-gray-300 pt-3 text-sm text-gray-700">
            <label className="flex items-center gap-2"><span className="inline-block h-5 w-5 border border-gray-700">□</span>現在の電文切替SW設定確認</label>
            <label className="flex items-center gap-2"><span className="inline-block h-5 w-5 border border-gray-700">□</span>切替後の電文確認</label>
          </div>
        </div>
      )}
    </div>
  );
}
