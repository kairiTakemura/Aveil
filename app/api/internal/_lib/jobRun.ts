import { supabaseAdmin } from '@/lib/supabase/admin'

export async function startJob(jobType: string, idempotencyKey?: string) {
  const { data, error } = await supabaseAdmin
    .from('job_runs')
    .insert({ job_type: jobType, status: 'running', idempotency_key: idempotencyKey ?? null })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function finishJob(id: string, ok: boolean, message?: string, meta?: Record<string, unknown>) {
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
