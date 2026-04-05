import { NextResponse } from 'next/server'
import { applyOnboardingCookie, ensureOnboardingSession, getOnboardingSessionFromRequest, pickUtm } from '@/app/api/onboarding/_lib/session'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function readUtmFromUrl(url: string): Record<string, string> {
  const params = new URL(url).searchParams
  return pickUtm(Object.fromEntries(params.entries()))
}

export async function GET(req: Request) {
  try {
    const session = await getOnboardingSessionFromRequest(req)
    if (!session) return NextResponse.json({ session: null }, { status: 200 })
    return NextResponse.json({ session: session.session }, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to load onboarding session' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any))
    const utm = {
      ...readUtmFromUrl(req.url),
      ...pickUtm(body?.utm || {}),
    }

    const ensured = await ensureOnboardingSession(req, utm)
    const res = NextResponse.json({ session: ensured.session }, { status: 200 })
    applyOnboardingCookie(res, ensured.cookieValue, ensured.session.expiresAt)
    return res
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to initialize onboarding session' }, { status: 500 })
  }
}
