import { getSupabaseAdmin } from '@/lib/supabase/admin'

export async function startJob(jobType: string, idempotencyKey?: string) {
  const supabaseAdmin = getSupabaseAdmin()

  // 同一キーで再実行された場合はサフィックスを付けて衝突回避
  const baseKey = idempotencyKey ?? null

  for (let attempt = 0; attempt < 3; attempt++) {
    const key =
      baseKey === null
        ? null
        : attempt === 0
          ? baseKey
          : `${baseKey}-retry-${attempt}-${Date.now()}`

    const { data, error } = await supabaseAdmin
      .from('job_runs')
      .insert({ job_type: jobType, status: 'running', idempotency_key: key })
      .select()
      .single()

    if (!error) return data

    // unique_violation (23505) のときだけ再試行
    if ((error as { code?: string }).code !== '23505') {
      throw error
    }
  }

  throw new Error('Failed to create job run due to repeated idempotency key collisions')
}

export async function finishJob(id: string, ok: boolean, message?: string, meta?: Record<string, unknown>) {
  const supabaseAdmin = getSupabaseAdmin()
  const { error } = await supabaseAdmin
    .from('job_runs')
    .update({
      status: ok ? 'success' : 'failed_retryable',
      ended_at: new Date().toISOString(),
      message: message ?? null,
      meta: meta ?? {},
    })
    .eq('id', id)
  if (error) throw error
}
