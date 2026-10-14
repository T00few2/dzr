import { NextResponse } from 'next/server'
import { requireEventEditor } from '@/app/api/admin/_lib/auth'
import { routeOfTheWeek } from '@/app/lib/routeOfTheWeek'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: Request) {
  const auth = await requireEventEditor(req)
  if (auth.error) return auth.error
  const date = new URL(req.url).searchParams.get('date') || ''
  try {
    return NextResponse.json(await routeOfTheWeek(date))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not read the route of the week'
    const status = message.includes('does not list') ? 404 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
