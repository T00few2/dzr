import { NextResponse } from 'next/server'
import { requireAdmin } from '@/app/api/admin/_lib/auth'
import { removeSignup } from '@/app/api/admin/_lib/signupBoards'

export async function POST(req: Request) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error
  const body = await req.json().catch(() => ({}))
  const boardId = String(body.boardId || '').trim()
  const userId = String(body.userId || '').trim()
  const optionValue = body.optionValue ? String(body.optionValue) : null
  if (!boardId || !userId) {
    return NextResponse.json({ error: 'boardId and userId are required' }, { status: 400 })
  }

  const result = await removeSignup(boardId, userId, optionValue)
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({
    ok: true,
    discordUpdated: result.discordUpdated,
    warning: result.discordError || undefined,
    message: result.discordUpdated
      ? 'Rider removed and Discord panel updated'
      : 'Rider removed from Firestore; Discord panel could not be updated',
  })
}
