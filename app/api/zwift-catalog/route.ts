import { NextResponse } from 'next/server'
import { zwiftCatalogPayload } from '@/app/lib/zwiftCatalog'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Public route catalog from the website's zwift-data package. The bot reads this and does not ship its own copy. */
export function GET() {
  return NextResponse.json(zwiftCatalogPayload(), {
    headers: { 'Cache-Control': 'public, max-age=3600' },
  })
}
