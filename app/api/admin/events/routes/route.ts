import { NextResponse } from 'next/server'
import { requireEventEditor } from '@/app/api/admin/_lib/auth'
import { flaskJson } from '@/app/api/admin/_lib/flask'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: Request) {
  const auth = await requireEventEditor(req)
  if (auth.error) return auth.error
  const q = new URL(req.url).searchParams.get('q') || ''
  if (!q.trim()) return NextResponse.json([])
  return flaskJson(`/api/zwift/routes?q=${encodeURIComponent(q)}`)
}
