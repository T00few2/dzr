import { NextResponse } from 'next/server'
import { requireEventEditor } from '@/app/api/admin/_lib/auth'
import { flaskData } from '@/app/api/admin/_lib/flask'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: Request) {
  const auth = await requireEventEditor(req)
  if (auth.error) return auth.error
  const q = new URL(req.url).searchParams.get('q') || ''
  if (q.trim().length < 2) return NextResponse.json({ error: 'Enter a sprint name' }, { status: 400 })
  const result = await flaskData(`/api/zwiftpower/segments?q=${encodeURIComponent(q)}`)
  return NextResponse.json(result.body, { status: result.status })
}
