import { NextResponse } from 'next/server'
import { requireEventEditor } from '@/app/api/admin/_lib/auth'
import { suggestZwiftRoutes } from '@/app/lib/zwiftRouteLookup'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: Request) {
  const auth = await requireEventEditor(req)
  if (auth.error) return auth.error
  const name = new URL(req.url).searchParams.get('name') || ''
  if (name.trim().length < 2) return NextResponse.json({ error: 'Enter a route name' }, { status: 400 })
  try {
    return NextResponse.json(await suggestZwiftRoutes(name))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Route search failed'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
