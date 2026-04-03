import { assertInternalAuth } from '../_lib/auth'
import { revalidatePath } from 'next/cache'

export async function POST(req: Request) {
  try {
    assertInternalAuth(req)
    revalidatePath('/')
    revalidatePath('/trends')
    revalidatePath('/compare')
    return Response.json({ ok: true })
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error).message }, { status: 401 })
  }
}
