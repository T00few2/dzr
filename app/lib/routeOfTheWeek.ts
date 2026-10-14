import { routeOfTheWeek as parseRouteOfTheWeek } from '@/packages/shared/routeOfTheWeek'
import { parseIsoDate } from '@/packages/shared/seriesRotation'
import { findZwiftRoute, type ZwiftRouteHit } from '@/app/lib/zwiftRouteLookup'

const PAGE = 'https://zwiftinsider.com/weekly-challenges/'
const CACHE_MS = 60 * 60 * 1000
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

const cache = new Map<string, { at: number; html: string }>()

export type RouteOfTheWeek = {
  date: string
  name: string
  url: string
  route: ZwiftRouteHit | null
  warning: string
}

async function calendarHtml(date: string) {
  const month = Number(date.slice(5, 7))
  const year = date.slice(0, 4)
  const slug = MONTHS[month - 1]
  if (!slug) throw new Error('Date must be YYYY-MM-DD')
  const url = `${PAGE}?month=${slug}&yr=${year}`
  const cached = cache.get(url)
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.html

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0' },
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(`Zwift Insider responded ${res.status}`)
    const html = await res.text()
    cache.set(url, { at: Date.now(), html })
    return html
  } finally {
    clearTimeout(timer)
  }
}

export async function routeOfTheWeek(date: string): Promise<RouteOfTheWeek> {
  const iso = parseIsoDate(date)
  if (!iso) throw new Error('Date must be YYYY-MM-DD')
  const listed = parseRouteOfTheWeek(await calendarHtml(iso), iso)
  if (!listed) throw new Error('Zwift Insider does not list a route for that date')
  try {
    const route = await findZwiftRoute(listed.name)
    return { ...listed, route, warning: '' }
  } catch (error) {
    const warning = error instanceof Error ? error.message : 'Could not match that route on Zwift'
    return { ...listed, route: null, warning }
  }
}
