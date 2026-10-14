import {
  compactZwiftEvents,
  DZR_UPCOMING_EVENTS_URL,
  type ZwiftEventSummary,
} from '@/packages/shared/zwiftEvents'

const CACHE_MS = 10 * 60 * 1000
const FETCH_TIMEOUT_MS = 6000

let cache: { at: number; events: ZwiftEventSummary[] } | null = null

/**
 * Upcoming DZR events from the public Zwift feed.
 *
 * One cache for the member calendar, the Discord link helper, and the admin list.
 * A failure throws so each caller can decide what to show.
 */
export async function loadUpcomingDzrEvents(): Promise<ZwiftEventSummary[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.events

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(DZR_UPCOMING_EVENTS_URL, { signal: controller.signal, cache: 'no-store' })
    if (!res.ok) throw new Error(`zwift feed responded ${res.status}`)
    const events = compactZwiftEvents(await res.json())
    cache = { at: Date.now(), events }
    return events
  } finally {
    clearTimeout(timer)
  }
}
