import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Aveil Trend Analyzer',
  description: 'アパレルトレンド分析アプリ',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  )
}
