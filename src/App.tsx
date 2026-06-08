import { useRef, useState } from 'react';
import { MasterDataProvider } from './context/MasterDataContext';
import { useMasterData } from './context/useMasterData';
import { IndividualForm } from './components/IndividualForm';
import { SummaryList } from './components/SummaryList';
import { IndividualPdfButton, SummaryPdfButton } from './components/PDFExport';
import { readMasterFile } from './utils/importMaster';
import type { GroundCoilRecord } from './types';

type TabKey = 'individual' | 'summary';

function ImportButton() {
  const { setRecords, records } = useMasterData();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [importedCount, setImportedCount] = useState<number | null>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      const imported = await readMasterFile(file);
      if (imported.length === 0) {
        setError('インポート可能なデータが見つかりませんでした。列名（id, location, name, mileage, equipmentType ...）をご確認ください。');
        return;
      }
      setRecords(imported);
      setImportedCount(imported.length);
    } catch {
      setError('ファイルの読み込みに失敗しました。CSV/Excel形式をご確認ください。');
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={(e) => handleFile(e.target.files?.[0])}
          className="text-sm"
        />
        <span className="text-xs text-gray-500">マスタ取込（CSV / Excel） 現在 {records.length} 件</span>
      </div>
      {importedCount !== null && !error && (
        <p className="text-xs text-green-700">{importedCount} 件のマスタデータを取り込みました。</p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function IndividualView() {
  const [activeRecord, setActiveRecord] = useState<GroundCoilRecord | undefined>(undefined);
  return (
    <section className="flex flex-col gap-4">
      <IndividualForm onRecordChange={setActiveRecord} />
      {activeRecord && (
        <div className="flex justify-end">
          <IndividualPdfButton record={activeRecord} />
        </div>
      )}
    </section>
  );
}

function SummaryView() {
  const { records } = useMasterData();
  return (
    <section className="flex flex-col gap-4">
      <div className="flex justify-end">
        <SummaryPdfButton records={records} />
      </div>
      <SummaryList />
    </section>
  );
}

function AppShell() {
  const [tab, setTab] = useState<TabKey>('individual');

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-5 px-4 py-6">
      <header className="flex flex-col gap-3 border-b border-gray-300 pb-4">
        <h1 className="text-2xl font-bold text-gray-900">ATS-DK地上子 作業確認表 作成システム</h1>
        <ImportButton />
        <nav className="flex gap-2">
          <button
            type="button"
            onClick={() => setTab('individual')}
            className={`rounded-t px-4 py-2 text-sm font-medium ${
              tab === 'individual' ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            View A：個別確認表モード
          </button>
          <button
            type="button"
            onClick={() => setTab('summary')}
            className={`rounded-t px-4 py-2 text-sm font-medium ${
              tab === 'summary' ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            View B：一覧表生成モード
          </button>
        </nav>
      </header>

      {tab === 'individual' ? <IndividualView /> : <SummaryView />}
    </div>
  );
}

function App() {
  return (
    <MasterDataProvider>
      <AppShell />
    </MasterDataProvider>
  );
}

export default App;
