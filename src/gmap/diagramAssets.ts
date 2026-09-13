// 教科書から抽出した図解画像を、ユニットデータ内のファイル参照(例: "diagrams/marketing_1_p96.png")
// からビルド後の実URLへ解決するためのヘルパー。Vite の import.meta.glob で全画像を静的に取り込む。
const modules = import.meta.glob('./assets/diagrams/*.jpg', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

export function resolveDiagramUrl(relativePath: string): string | undefined {
  const fileName = relativePath.split('/').pop();
  if (!fileName) return undefined;
  const key = Object.keys(modules).find((k) => k.endsWith(`/${fileName}`));
  return key ? modules[key] : undefined;
}
