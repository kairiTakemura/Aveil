import { assertInternalAuth } from '../_lib/auth'
import { startJob, finishJob } from '../_lib/jobRun'

export async function POST(req: Request) {
  try {
    assertInternalAuth(req)
    const run = await startJob('collect', `collect-${new Date().toISOString().slice(0, 10)}`)
    // TODO: implement robots/terms-aware scraping and raw upsert
    await finishJob(run.id, true, 'collect stub done')
    return Response.json({ ok: true, jobId: run.id })
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}
