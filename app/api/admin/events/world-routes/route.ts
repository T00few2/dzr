import { NextResponse } from 'next/server'
import { requireEventEditor } from '@/app/api/admin/_lib/auth'
import { listWorldRoutes } from '@/app/lib/zwiftCatalog'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: Request) {
  const auth = await requireEventEditor(req)
  if (auth.error) return auth.error
  return NextResponse.json({ worlds: listWorldRoutes() })
}
