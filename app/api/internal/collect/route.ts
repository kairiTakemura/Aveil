import crypto from 'node:crypto'
import { assertInternalAuth } from '../_lib/auth'
import { startJob, finishJob } from '../_lib/jobRun'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

const DEFAULT_TARGET_URL = 'https://www.shop-shimamura.com/disp/recommend/?size=1'
const USER_AGENT = 'AveilTrendBot/1.0 (+contact: admin@example.com)'
const REQUEST_INTERVAL_MS = 2500
const REQUEST_TIMEOUT_MS = 10000
const MAX_RETRY = 2

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchWithRetry(url: string): Promise<string> {
  let lastError: unknown

  for (let i = 0; i <= MAX_RETRY; i++) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml',
        },
        signal: controller.signal,
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} at ${url}`)
      }

      const text = await res.text()
      clearTimeout(timeout)
      return text
    } catch (error) {
      clearTimeout(timeout)
      lastError = error
      if (i < MAX_RETRY) {
        await sleep(1500 * (i + 1))
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('fetch failed')
}

function isAllowedByRobots(robotsTxt: string, targetPath: string) {
  // 最小実装（User-agent: * の Disallow を判定）
  const lines = robotsTxt.split('\n').map((l) => l.trim())
  let inGlobalAgent = false
  const disallows: string[] = []

  for (const line of lines) {
    if (!line || line.startsWith('#')) continue
    const lower = line.toLowerCase()

    if (lower.startsWith('user-agent:')) {
      const ua = line.split(':')[1]?.trim() ?? ''
      inGlobalAgent = ua === '*'
      continue
    }

    if (inGlobalAgent && lower.startsWith('disallow:')) {
      const path = line.split(':')[1]?.trim() ?? ''
      if (path) disallows.push(path)
    }
  }

  return !disallows.some((rule) => rule !== '/' && targetPath.startsWith(rule))
}

function extractCandidateLinks(html: string, base: string) {
  const hrefMatches = Array.from(html.matchAll(/href=["']([^"']+)["']/gi)).map((m) => m[1])

  const urls = hrefMatches
    .map((href) => {
      try {
        return new URL(href, base).toString()
      } catch {
        return null
      }
    })
    .filter((u): u is string => Boolean(u))

  const uniq = Array.from(new Set(urls))
  const sameHost = uniq.filter((u) => u.startsWith('https://www.shop-shimamura.com/'))

  const prioritized = sameHost.filter(
    (u) => u.includes('/disp/item/') || u.includes('/disp/coord/') || u.includes('/disp/recommend/')
  )

  return (prioritized.length > 0 ? prioritized : sameHost).slice(0, 30)
}

function toSourceProductId(productUrl: string) {
  try {
    const url = new URL(productUrl)
    const fromQuery = url.searchParams.get('id')
    if (fromQuery) return fromQuery
    const m = url.pathname.match(/\/([0-9]{6,})\/?$/)
    return m?.[1] ?? null
  } catch {
    return null
  }
}

export async function POST(req: Request) {
  try {
    assertInternalAuth(req)

    const body = (await req.json().catch(() => ({}))) as { targetUrl?: string }
    const targetUrl = body.targetUrl || DEFAULT_TARGET_URL
    const target = new URL(targetUrl)

    const run = await startJob('collect', `collect-${new Date().toISOString().slice(0, 10)}`)
    const supabaseAdmin = getSupabaseAdmin()

    // 1) robots.txt チェック
    const robotsUrl = `${target.origin}/robots.txt`
    const robotsTxt = await fetchWithRetry(robotsUrl)
    const allowed = isAllowedByRobots(robotsTxt, target.pathname)

    if (!allowed) {
      await finishJob(run.id, false, 'Blocked by robots.txt', {
        targetUrl,
        robotsUrl,
      })
      return Response.json({ ok: false, reason: 'robots_disallow', targetUrl }, { status: 403 })
    }

    // 2) 一覧ページ取得
    const html = await fetchWithRetry(targetUrl)
    const links = extractCandidateLinks(html, target.origin)

    let inserted = 0
    for (const link of links) {
      const nameGuess = link.split('/').filter(Boolean).pop() ?? 'unknown'
      const dedupeKey = crypto.createHash('sha256').update(link).digest('hex')

      const { error } = await supabaseAdmin.from('raw_products').upsert(
        {
          source_site: 'shop-shimamura',
          source_product_id: toSourceProductId(link),
          product_url: link,
          product_name: nameGuess,
          category_raw: 'coordinate',
          description_raw: 'collected from recommend page',
          crawl_run_id: run.id,
          raw_html_hash: crypto.createHash('sha256').update(html).digest('hex'),
          dedupe_key: dedupeKey,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: 'source_site,product_url' }
      )

      if (!error) inserted += 1
      await sleep(REQUEST_INTERVAL_MS)
    }

    await finishJob(run.id, true, `collect done: links=${links.length}, upserted=${inserted}`, {
      targetUrl,
      linksFound: links.length,
      upserted: inserted,
    })

    return Response.json({ ok: true, jobId: run.id, linksFound: links.length, upserted: inserted })
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}
