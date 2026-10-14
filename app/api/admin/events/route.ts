import { NextResponse } from 'next/server'
import { requireEventEditor } from '@/app/api/admin/_lib/auth'
import { loadUpcomingDzrEvents } from '@/app/lib/zwiftPublicEvents'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: Request) {
  const auth = await requireEventEditor(req)
  if (auth.error) return auth.error
  try {
    const events = await loadUpcomingDzrEvents()
    return NextResponse.json({ events, unavailable: false })
  } catch (err) {
    console.warn('admin events: zwift feed unavailable', err)
    return NextResponse.json({ events: [], unavailable: true })
  }
}
