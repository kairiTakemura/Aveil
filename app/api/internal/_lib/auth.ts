import { env } from '@/lib/env'

export function assertInternalAuth(req: Request) {
  const auth = req.headers.get('authorization') || ''
  const token = auth.replace('Bearer ', '')
  if (!token || token !== env.CRON_SECRET) {
    throw new Error('Unauthorized')
  }
}
