# Aveil Trend Analyzer (Skeleton)

Next.js + Supabase + GitHub Actions 構成の実装雛形です。

## 含まれる内容
- Supabase 初期マイグレーション
- `/api/internal/*` のジョブRoute雛形
- 週次バッチ用 GitHub Actions

## Internal APIs
- `POST /api/internal/collect`
- `POST /api/internal/normalize`
- `POST /api/internal/analyze`
- `POST /api/internal/generate-images`
- `POST /api/internal/revalidate`

すべて `Authorization: Bearer <CRON_SECRET>` が必要です。
