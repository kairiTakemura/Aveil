export default function HomePage() {
  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: 24 }}>
      <h1 style={{ fontSize: 28, marginBottom: 12 }}>Aveil Trend Analyzer</h1>
      <p style={{ marginBottom: 16 }}>
        デプロイ確認用の最小トップページです。内部APIは <code>/api/internal/*</code> に実装済みです。
      </p>
      <ul>
        <li>POST /api/internal/collect</li>
        <li>POST /api/internal/normalize</li>
        <li>POST /api/internal/analyze</li>
        <li>POST /api/internal/generate-images</li>
        <li>POST /api/internal/revalidate</li>
      </ul>
    </main>
  )
}
