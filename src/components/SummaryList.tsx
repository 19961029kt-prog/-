import { useMemo } from 'react';
import { useMasterData } from '../context/useMasterData';
import { computeSummaryRows } from '../utils/summaryRows';

const formatDate = (d: Date) =>
  `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;

const TH = 'border border-black bg-gray-100 px-2 py-1.5 text-sm font-bold text-gray-900';
const TD = 'border border-black px-2 py-1 text-sm text-gray-900';

function StampBoxes() {
  const labels = ['作成', '確認', '承認'];
  return (
    <table className="border-collapse">
      <tbody>
        <tr>
          {labels.map((label) => (
            <td key={label} className="border-2 border-black px-1 pb-1 pt-0.5 text-center text-xs font-medium text-gray-800">
              {label}
            </td>
          ))}
        </tr>
        <tr>
          {labels.map((label) => (
            <td key={label} className="h-16 w-16 border-2 border-black" />
          ))}
        </tr>
      </tbody>
    </table>
  );
}

export function SummaryList() {
  const { records } = useMasterData();
  const rows = useMemo(() => computeSummaryRows(records), [records]);
  const today = useMemo(() => formatDate(new Date()), []);

  return (
    <div id="summary-list-content" className="flex flex-col gap-4 bg-white p-5">
      {/* ヘッダーセクション（承認欄） */}
      <div className="flex items-start justify-between border-b-2 border-black pb-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">熊本DB化 作業確認表 一覧</h2>
          <p className="mt-1 text-sm text-gray-700">最終出力日：{today}</p>
        </div>
        <StampBoxes />
      </div>

      {/* テーブルセクション（一覧表） */}
      <table className="w-full border-collapse text-left">
        <thead>
          <tr>
            <th className={TH}>所属箇所</th>
            <th className={TH}>説明図番号</th>
            <th className={TH}>キロ程</th>
            <th className={TH}>名称</th>
            <th className={TH}>切替当日作業①</th>
            <th className={TH}>切替当日作業②</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ record, locationRowSpan }) => (
            <tr key={record.id}>
              {locationRowSpan !== null && (
                <td className={`${TD} align-middle font-medium`} rowSpan={locationRowSpan}>
                  {record.location}
                </td>
              )}
              <td className={`${TD} text-right`}>{record.id}</td>
              <td className={TD}>{record.mileage}</td>
              <td className={TD}>{record.name}</td>
              <td className={TD}>{record.workType1 || '-'}</td>
              <td className={TD}>{record.workType2 || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
