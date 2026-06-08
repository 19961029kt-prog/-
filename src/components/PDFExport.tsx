import { Document, Font, Page, PDFDownloadLink, StyleSheet, Text, View } from '@react-pdf/renderer';
import { useMemo } from 'react';
import { telegramRequirement } from '../utils/telegramRequirement';
import { computeSummaryRows } from '../utils/summaryRows';
import { EQUIPMENT_TYPE_LABEL, type GroundCoilRecord, type Telegram } from '../types';

// 日本語表示のためフォントを登録（罫線・表組みを多用するため和文フォント必須）
Font.register({
  family: 'NotoSansJP',
  fonts: [
    { src: 'https://cdn.jsdelivr.net/gh/googlefonts/noto-cjk@main/Sans/Variable/OTC/NotoSansCJK-VF.otf.ttc', fontWeight: 400 },
  ],
});
Font.register({
  family: 'NotoSansJP-Fallback',
  fonts: [{ src: 'https://fonts.gstatic.com/ea/notosansjp/v6/NotoSansJP-Regular.otf' }],
});

const BORDER = '1px solid #000';
const THICK_BORDER = '1.4pt solid #000';

const baseFont = { fontFamily: 'NotoSansJP-Fallback' } as const;

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 9, ...baseFont, color: '#111' },
  title: { fontSize: 14, fontWeight: 700, marginBottom: 4 },
  subText: { fontSize: 9, marginBottom: 8 },
  row: { flexDirection: 'row' },
  cell: { borderRight: BORDER, borderBottom: BORDER, padding: 3 },
  headerCell: { borderRight: BORDER, borderBottom: BORDER, padding: 3, backgroundColor: '#e5e5e5', fontWeight: 700 },
  table: { borderTop: THICK_BORDER, borderLeft: THICK_BORDER },
  byteBox: {
    width: 26,
    height: 18,
    border: THICK_BORDER,
    marginRight: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const fmtDate = (d: Date) => `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;

// ---------------------------------------------------------------------------
// 個別作業確認表（単票）
// ---------------------------------------------------------------------------

function ByteRow({ label, bytes, grayedOut }: { label: string; bytes: string[]; grayedOut: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}>
      <Text style={{ width: 110, color: grayedOut ? '#999' : '#111' }}>{label}</Text>
      <View style={{ flexDirection: 'row' }}>
        {bytes.map((byte, i) => (
          <View
            key={i}
            style={[styles.byteBox, grayedOut ? { backgroundColor: '#e5e5e5', borderColor: '#999' } : {}]}
          >
            <Text style={{ color: grayedOut ? '#999' : '#111' }}>{byte || ' '}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function TelegramSection({ title, telegram, grayedOut }: { title: string; telegram: Telegram; grayedOut: boolean }) {
  return (
    <View style={{ flex: 1, border: THICK_BORDER, padding: 6, backgroundColor: grayedOut ? '#f3f3f3' : '#fff' }}>
      <Text style={{ fontWeight: 700, marginBottom: 4, color: grayedOut ? '#999' : '#111' }}>
        {title}
        {grayedOut ? '（対象外）' : ''}
      </Text>
      {telegram.kind === 'UNPOWERED' && (
        <>
          <ByteRow label="電池残量 有り時" bytes={telegram.batteryHigh} grayedOut={grayedOut} />
          <ByteRow label="電池残量 無し時" bytes={telegram.batteryLow} grayedOut={grayedOut} />
        </>
      )}
      {telegram.kind === 'POWERED' &&
        telegram.conditions.map((c) => (
          <ByteRow key={c.label} label={`${c.label}（${c.condition}）`} bytes={c.bytes} grayedOut={grayedOut} />
        ))}
      {telegram.kind === 'ENCODER' &&
        telegram.entries.map((e) => (
          <ByteRow key={e.label} label={`${e.label}（${e.condition}）`} bytes={e.bytes} grayedOut={grayedOut} />
        ))}
    </View>
  );
}

function IndividualPdfDocument({ record }: { record: GroundCoilRecord }) {
  const requirement = telegramRequirement(record);
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{EQUIPMENT_TYPE_LABEL[record.equipmentType]} 作業確認表</Text>

        <View style={[styles.table, { marginBottom: 10 }]}>
          {[
            ['説明図番号', String(record.id), '所属箇所', record.location],
            ['キロ程', record.mileage, '地上子名称', record.name],
            ['作業目的', record.workPurpose, '設置位置', record.installPosition ?? '-'],
            ['切替当日作業①', record.workType1 || '-', '切替当日作業②', record.workType2 || '-'],
            ['電文ファイル名', record.fileName ?? '-', '', ''],
          ].map((cells, ri) => (
            <View key={ri} style={styles.row}>
              <Text style={[styles.headerCell, { width: 90 }]}>{cells[0]}</Text>
              <Text style={[styles.cell, { width: 160 }]}>{cells[1]}</Text>
              <Text style={[styles.headerCell, { width: 90 }]}>{cells[2]}</Text>
              <Text style={[styles.cell, { width: 160 }]}>{cells[3]}</Text>
            </View>
          ))}
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TelegramSection title="【現】電文" telegram={record.currentTelegram} grayedOut={!requirement.current} />
          <TelegramSection title="【新】電文" telegram={record.newTelegram} grayedOut={!requirement.next} />
        </View>

        <View style={{ marginTop: 14, flexDirection: 'row', gap: 16 }}>
          <Text>□ 現在の電文切替SW設定確認</Text>
          <Text>□ 切替後の電文確認</Text>
        </View>
      </Page>
    </Document>
  );
}

export function IndividualPdfButton({ record }: { record: GroundCoilRecord }) {
  const doc = useMemo(() => <IndividualPdfDocument record={record} />, [record]);
  return (
    <PDFDownloadLink document={doc} fileName={`個別作業確認表_${record.id}_${record.name}.pdf`}>
      {({ loading }) => (
        <span className="inline-block rounded bg-blue-700 px-4 py-1.5 text-white hover:bg-blue-600">
          {loading ? 'PDF生成中…' : 'PDF出力（個別確認表）'}
        </span>
      )}
    </PDFDownloadLink>
  );
}

// ---------------------------------------------------------------------------
// 作業確認表 一覧（承認用一覧表）
// ---------------------------------------------------------------------------

const sumStyles = StyleSheet.create({
  page: { padding: 24, fontSize: 8, ...baseFont, color: '#111' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  stampTable: { border: THICK_BORDER, flexDirection: 'row' },
  stampCell: { width: 50, borderRight: THICK_BORDER },
  stampLabel: { textAlign: 'center', borderBottom: THICK_BORDER, padding: 2, fontSize: 8, fontWeight: 700 },
  stampBox: { height: 50 },
  table: { borderTop: THICK_BORDER, borderLeft: THICK_BORDER },
  th: { borderRight: THICK_BORDER, borderBottom: THICK_BORDER, padding: 3, backgroundColor: '#dcdcdc', fontWeight: 700, textAlign: 'center' },
  td: { borderRight: THICK_BORDER, borderBottom: THICK_BORDER, padding: 3 },
});

const COL_WIDTHS = [90, 60, 70, 130, 90, 90];
const COL_LABELS = ['所属箇所', '説明図番号', 'キロ程', '名称', '切替当日作業①', '切替当日作業②'];
const ROWS_PER_PAGE = 28;

function SummaryHeaderRow() {
  return (
    <View style={sumStyles.table}>
      <View style={{ flexDirection: 'row' }}>
        {COL_LABELS.map((label, i) => (
          <Text key={label} style={[sumStyles.th, { width: COL_WIDTHS[i] }]}>
            {label}
          </Text>
        ))}
      </View>
    </View>
  );
}

function SummaryPdfDocument({ records, today }: { records: GroundCoilRecord[]; today: string }) {
  const rows = useMemo(() => computeSummaryRows(records), [records]);
  // ページごとに分割（各ページの先頭に見出し行を再描画する）
  const pages = useMemo(() => {
    const chunks: typeof rows[] = [];
    for (let i = 0; i < rows.length; i += ROWS_PER_PAGE) chunks.push(rows.slice(i, i + ROWS_PER_PAGE));
    return chunks.length > 0 ? chunks : [[]];
  }, [rows]);

  return (
    <Document>
      {pages.map((pageRows, pageIndex) => (
        <Page key={pageIndex} size="A4" style={sumStyles.page}>
          {pageIndex === 0 && (
            <View style={sumStyles.headerRow}>
              <View>
                <Text style={{ fontSize: 14, fontWeight: 700 }}>熊本DB化 作業確認表 一覧</Text>
                <Text style={{ marginTop: 4 }}>最終出力日：{today}</Text>
              </View>
              <View style={sumStyles.stampTable}>
                {['作成', '確認', '承認'].map((label, i, arr) => (
                  <View key={label} style={[sumStyles.stampCell, i === arr.length - 1 ? { borderRight: 'none' } : {}]}>
                    <Text style={sumStyles.stampLabel}>{label}</Text>
                    <View style={sumStyles.stampBox} />
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* 各ページの先頭に見出し行を繰り返す */}
          <SummaryHeaderRow />
          <View style={[sumStyles.table, { borderTop: 'none' }]}>
            {pageRows.map(({ record, locationRowSpan }, idx) => {
              // PDFはネイティブの rowSpan を持たないため、結合先頭行のみセルを描画し、
              // 結合される行は左端セルを空白（罫線なし）にして縦の連続性を表現する
              const isFirstOfGroup = locationRowSpan !== null;
              return (
                <View key={record.id} style={{ flexDirection: 'row' }}>
                  <View style={[sumStyles.td, { width: COL_WIDTHS[0], justifyContent: 'center' }, isFirstOfGroup ? {} : { borderRightColor: '#000', borderTopWidth: 0 }]}>
                    {isFirstOfGroup && <Text>{record.location}</Text>}
                  </View>
                  <Text style={[sumStyles.td, { width: COL_WIDTHS[1], textAlign: 'right' }]}>{record.id}</Text>
                  <Text style={[sumStyles.td, { width: COL_WIDTHS[2] }]}>{record.mileage}</Text>
                  <Text style={[sumStyles.td, { width: COL_WIDTHS[3] }]}>{record.name}</Text>
                  <Text style={[sumStyles.td, { width: COL_WIDTHS[4] }]}>{record.workType1 || '-'}</Text>
                  <Text style={[sumStyles.td, { width: COL_WIDTHS[5] }]}>{record.workType2 || '-'}</Text>
                  {idx === 0 && null}
                </View>
              );
            })}
          </View>

          <Text style={{ position: 'absolute', bottom: 16, right: 24, fontSize: 8, color: '#666' }} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
        </Page>
      ))}
    </Document>
  );
}

export function SummaryPdfButton({ records }: { records: GroundCoilRecord[] }) {
  const today = useMemo(() => fmtDate(new Date()), []);
  const doc = useMemo(() => <SummaryPdfDocument records={records} today={today} />, [records, today]);
  return (
    <PDFDownloadLink document={doc} fileName="作業確認表一覧.pdf">
      {({ loading }) => (
        <span className="inline-block rounded bg-green-700 px-4 py-1.5 text-white hover:bg-green-600">
          {loading ? 'PDF生成中…' : 'PDF出力（一覧表）'}
        </span>
      )}
    </PDFDownloadLink>
  );
}
