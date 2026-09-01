import { NextResponse } from 'next/server'
import { requireAdmin } from '@/app/api/admin/_lib/auth'
import { deleteSignupBoard } from '@/app/api/admin/_lib/signupBoards'

export async function DELETE(_req: Request, { params }: { params: { boardId: string } }) {
  const auth = await requireAdmin(_req)
  if (auth.error) return auth.error
  const boardId = String(params.boardId || '').trim()
  if (!boardId) return NextResponse.json({ error: 'boardId is required' }, { status: 400 })

  const result = await deleteSignupBoard(boardId)
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({
    ok: true,
    discordDeleted: result.discordDeleted,
    warning: result.discordError || undefined,
    message: result.discordError
      ? 'Panel deleted from Firestore; Discord message could not be deleted'
      : 'Panel deleted',
  })
}
