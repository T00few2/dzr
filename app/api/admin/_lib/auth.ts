import { getToken } from 'next-auth/jwt'
import { NextResponse } from 'next/server'

export async function requireAdmin(req: Request) {
  const token = await getToken({ req: req as any, secret: process.env.NEXTAUTH_SECRET })
  if (!token) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  if (!(token as any).isAdmin) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  }
  return { token }
}

/**
 * The Zwift event editor is limited to one Discord account, not every admin.
 * A missing env var keeps it closed.
 */
export function isEventEditor(token: { discordId?: unknown } | null | undefined): boolean {
  const allowed = String(process.env.ZWIFT_EVENT_EDITOR_DISCORD_ID || '').trim()
  if (!allowed || !token) return false
  return String(token.discordId || '').trim() === allowed
}

export async function requireEventEditor(req: Request) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth
  if (!isEventEditor(auth.token as { discordId?: unknown })) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  }
  return auth
}
