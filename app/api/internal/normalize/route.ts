import { assertInternalAuth } from '../_lib/auth'
import { startJob, finishJob } from '../_lib/jobRun'

export async function POST(req: Request) {
  try {
    assertInternalAuth(req)
    const run = await startJob('normalize')
    // TODO: taxonomy + synonym normalization
    await finishJob(run.id, true, 'normalize stub done')
    return Response.json({ ok: true, jobId: run.id })
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}
