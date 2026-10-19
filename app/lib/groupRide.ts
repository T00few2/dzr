import { admin, adminDb } from '@/app/utils/firebaseAdminConfig'
import { flaskData } from '@/app/api/admin/_lib/flask'
import { routeOfTheWeek } from '@/app/lib/routeOfTheWeek'
import { loadUpcomingDzrEvents } from '@/app/lib/zwiftPublicEvents'
import { groupRideRoute, type GroupRideRoute } from '@/packages/shared/groupRide'
import { copenhagenDay, routeLine, routePhase } from '@/packages/shared/seriesAutomation'
import { displayDate, listSeriesDates, parseIsoDate } from '@/packages/shared/seriesRotation'

const COLLECTION = 'group_ride_schedules'
const DOC = 'always-a-race'

export class GroupRideError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

type SavedRide = { id: string; routeA: string; routeB: string; publishedAt: string | null }

type StoredRide = {
  anchorDate: string
  anchorIndex: number
  routes: GroupRideRoute[]
  overrides: Record<string, number>
  events: Record<string, SavedRide>
}

export type GroupRideDate = {
  date: string
  label: string
  routeA: string
  routeAId: number | null
  overridden: boolean
  routeB: string
  routeBUrl: string
  routeBWarning: string
  eventId: string
  feedEventId: number | null
}

export type GroupRideView = {
  anchorDate: string
  routes: GroupRideRoute[]
  dates: GroupRideDate[]
  feedUnavailable: boolean
  automation: string[]
}

function ref() {
  return adminDb.collection(COLLECTION).doc(DOC)
}

function asRoute(value: unknown): GroupRideRoute | null {
  if (!value || typeof value !== 'object') return null
  const row = value as { routeId?: unknown; name?: unknown; world?: unknown }
  const routeId = Number(row.routeId)
  const name = String(row.name || '').trim()
  if (!routeId || !name) return null
  return { routeId, name, world: row.world ? String(row.world) : null }
}

function asStored(data: Record<string, unknown> | undefined): StoredRide {
  const routes = Array.isArray(data?.routes) ? data.routes.map(asRoute).filter((route): route is GroupRideRoute => Boolean(route)) : []
  const overrides: Record<string, number> = {}
  const rawOverrides = data?.overrides && typeof data.overrides === 'object' ? (data.overrides as Record<string, unknown>) : {}
  for (const [date, routeId] of Object.entries(rawOverrides)) {
    if (parseIsoDate(date) && Number(routeId) > 0) overrides[date] = Number(routeId)
  }
  const events: Record<string, SavedRide> = {}
  const rawEvents = data?.events && typeof data.events === 'object' ? (data.events as Record<string, unknown>) : {}
  for (const [date, value] of Object.entries(rawEvents)) {
    if (!parseIsoDate(date) || !value || typeof value !== 'object') continue
    const row = value as { id?: unknown; routeA?: unknown; routeB?: unknown; publishedAt?: unknown }
    const id = String(row.id || '').trim()
    if (!id) continue
    const publishedAt = String(row.publishedAt || '').trim()
    events[date] = {
      id,
      routeA: String(row.routeA || ''),
      routeB: String(row.routeB || ''),
      publishedAt: publishedAt || null,
    }
  }
  return {
    anchorDate: parseIsoDate(data?.anchorDate) || '',
    anchorIndex: Number.isFinite(Number(data?.anchorIndex)) ? Number(data?.anchorIndex) : 0,
    routes,
    overrides,
    events,
  }
}

async function readRide() {
  const snap = await ref().get()
  return asStored(snap.exists ? snap.data() : undefined)
}

function naturalRoute(stored: StoredRide, date: string) {
  return groupRideRoute(stored.routes, stored.anchorDate, stored.anchorIndex, {}, date)
}

async function eventStart(eventId: string) {
  if (!/^\d+$/.test(eventId)) return null
  try {
    const result = await flaskData(`/api/zwift/events/${eventId}`)
    if (result.status >= 400) return null
    const date = new Date(result.body?.eventStart)
    return Number.isNaN(date.getTime()) ? null : date
  } catch {
    return null
  }
}

async function feedEvents() {
  try {
    return { events: await loadUpcomingDzrEvents(), unavailable: false }
  } catch {
    return { events: [], unavailable: true }
  }
}

function rideOn(events: { id: number; name: string; eventDate: string }[], date: string) {
  return events.filter((event) => /always a race/i.test(event.name) && event.eventDate === date)
}

export async function groupRideView(now = new Date()): Promise<GroupRideView> {
  const stored = await readRide()
  const feed = await feedEvents()
  const dates = stored.anchorDate ? listSeriesDates(stored.anchorDate, Object.keys(stored.events), 6) : []
  const rows = await Promise.all(
    dates.map(async (date) => {
      const planned = groupRideRoute(stored.routes, stored.anchorDate, stored.anchorIndex, stored.overrides, date)
      const natural = naturalRoute(stored, date)
      let routeB = ''
      let routeBUrl = ''
      let routeBWarning = ''
      try {
        const week = await routeOfTheWeek(date)
        routeB = week.route?.name || week.name
        routeBUrl = week.url
        routeBWarning = week.route ? '' : week.warning || 'Could not match that route on Zwift'
      } catch (error) {
        routeBWarning = error instanceof Error ? error.message : 'Route of the week is unavailable'
      }
      const hits = rideOn(feed.events, date)
      return {
        date,
        label: displayDate(date),
        routeA: planned?.name || '',
        routeAId: planned?.routeId || null,
        overridden: Boolean(planned && natural && planned.routeId !== natural.routeId),
        routeB,
        routeBUrl,
        routeBWarning,
        eventId: stored.events[date]?.id || '',
        feedEventId: hits.length === 1 ? hits[0].id : null,
      }
    })
  )
  return {
    anchorDate: stored.anchorDate,
    routes: stored.routes,
    dates: rows,
    feedUnavailable: feed.unavailable,
    automation: await automationLines(stored, rows, now),
  }
}

async function automationLines(stored: StoredRide, rows: GroupRideDate[], now: Date) {
  if (!stored.routes.length || !stored.anchorDate) return ['Category A: add the route list and a start date.']
  const today = copenhagenDay(now)
  const savedDates = Object.keys(stored.events).sort()
  const latest = savedDates[savedDates.length - 1] || ''
  const subject = !latest ? rows[0]?.date || stored.anchorDate : latest >= today ? latest : addWeek(latest)
  const row = rows.find((item) => item.date === subject)
  const planned = groupRideRoute(stored.routes, stored.anchorDate, stored.anchorIndex, stored.overrides, subject)
  const saved = stored.events[subject]
  const previous = latest && latest !== subject ? stored.events[latest] : null
  const previousStart = !saved && previous ? await eventStart(previous.id) : null
  const categoryB = row?.routeB ? `Category B: ${row.routeB}.` : 'Category B: route of the week.'
  if (!latest) {
    return [
      `Category A: ${displayDate(subject)}, ${planned?.name || 'the first route'}. Apply the first ride, then the next ones follow 24 hours after each start.`,
      categoryB,
    ]
  }
  const route = routeLine({
    label: displayDate(subject),
    route: saved?.routeA || planned?.name || 'Category A',
    saved: Boolean(saved),
    now,
    previousStart,
    nextDate: subject,
  }).replace(/^Route:/, 'Category A:')
  return [route, categoryB]
}

function addWeek(iso: string) {
  return listSeriesDates(iso, [iso], 2)[1]
}

export async function saveGroupRideRoutes(anchorDate: string, routes: unknown) {
  const iso = parseIsoDate(anchorDate)
  if (!iso) throw new GroupRideError('Start date must be YYYY-MM-DD')
  const list = Array.isArray(routes) ? routes.map(asRoute).filter((route): route is GroupRideRoute => Boolean(route)) : []
  if (!list.length) throw new GroupRideError('Add at least one category A route')
  const stored = await readRide()
  const keep: Record<string, number> = {}
  for (const [date, routeId] of Object.entries(stored.overrides)) {
    if (list.some((route) => route.routeId === routeId)) keep[date] = routeId
  }
  await ref().set(
    {
      anchorDate: iso,
      anchorIndex: 0,
      routes: list,
      overrides: keep,
      events: stored.events,
    },
    { merge: true }
  )
  return groupRideView()
}

export async function setGroupRideOverride(date: string, routeId: number) {
  const iso = parseIsoDate(date)
  if (!iso) throw new GroupRideError('Date must be YYYY-MM-DD')
  const stored = await readRide()
  const chosen = stored.routes.find((route) => route.routeId === routeId)
  if (!chosen) throw new GroupRideError('Route is not in the category A list')
  const natural = naturalRoute(stored, iso)
  const field = `overrides.${iso}`
  if (natural && natural.routeId === chosen.routeId) {
    await ref().update({ [field]: admin.firestore.FieldValue.delete() })
  } else {
    await ref().update({ [field]: chosen.routeId })
  }
  return groupRideView()
}

async function matchingRide(date: string) {
  let events
  try {
    events = await loadUpcomingDzrEvents()
  } catch {
    throw new GroupRideError('The public event list is unavailable', 502)
  }
  const hits = rideOn(events, date)
  if (!hits.length) throw new GroupRideError('Zwift has not created this event yet', 409)
  if (hits.length > 1) throw new GroupRideError('More than one Zwift event matches this date')
  return hits[0]
}

export async function applyGroupRide(date: string) {
  const iso = parseIsoDate(date)
  if (!iso) throw new GroupRideError('Date must be YYYY-MM-DD')
  const stored = await readRide()
  const planned = groupRideRoute(stored.routes, stored.anchorDate, stored.anchorIndex, stored.overrides, iso)
  if (!planned) throw new GroupRideError('Category A has no route for that date')
  let week
  try {
    week = await routeOfTheWeek(iso)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Route of the week is unavailable'
    throw new GroupRideError(message, /does not list/i.test(message) ? 409 : 502)
  }
  if (!week.route) throw new GroupRideError(week.warning || 'Route of the week did not match a Zwift route')
  const event = await matchingRide(iso)
  const inspected = await flaskData(`/api/zwift/events/${event.id}`)
  if (inspected.status >= 400) {
    throw new GroupRideError(String(inspected.body?.error || 'Could not read the Zwift event'), inspected.status)
  }
  const subgroups = Array.isArray(inspected.body?.subgroups) ? inspected.body.subgroups : []
  const category = (label: string) =>
    subgroups.find((row: { label?: unknown; id?: unknown }) => String(row?.label || '').trim().toUpperCase() === label)
  const categoryA = category('A')
  const categoryB = category('B')
  if (!categoryA?.id || !categoryB?.id) throw new GroupRideError('This ride needs a category A and a category B')
  const updated = await flaskData(`/api/zwift/events/${event.id}/course`, {
    method: 'POST',
    body: {
      subgroupRoutes: [
        { id: categoryA.id, routeId: planned.routeId },
        { id: categoryB.id, routeId: week.route.routeId },
      ],
    },
  })
  if (updated.status >= 400) {
    throw new GroupRideError(String(updated.body?.error || 'Zwift update failed'), updated.status >= 500 ? 502 : updated.status)
  }
  await ref().set(
    {
      events: {
        ...stored.events,
        [iso]: {
          id: String(event.id),
          routeA: planned.name,
          routeB: week.route.name,
          publishedAt: new Date().toISOString(),
        },
      },
    },
    { merge: true }
  )
  return {
    date: iso,
    label: displayDate(iso),
    eventId: event.id,
    route: `A ${planned.name}, B ${week.route.name}`,
    channelPost: false as const,
  }
}

export async function runDueGroupRide(now = new Date()) {
  const name = "It's always a race"
  try {
    const stored = await readRide()
    const dates = Object.keys(stored.events).sort()
    const latest = dates[dates.length - 1] || ''
    if (!latest || !stored.anchorDate || !stored.routes.length) {
      return { series: 'always-a-race', name, status: 'idle' as const }
    }
    const today = copenhagenDay(now)
    const subject = latest >= today ? latest : addWeek(latest)
    if (stored.events[subject] || today >= subject) {
      return { series: 'always-a-race', name, status: 'idle' as const, date: subject }
    }
    const start = await eventStart(stored.events[latest].id)
    if (!start) {
      return {
        series: 'always-a-race',
        name,
        status: 'error' as const,
        date: subject,
        message: 'Could not read the previous ride start',
      }
    }
    if (routePhase(now, start, subject).phase !== 'open') {
      return { series: 'always-a-race', name, status: 'idle' as const, date: subject }
    }
    try {
      const applied = await applyGroupRide(subject)
      return { series: 'always-a-race', name, status: 'applied' as const, ...applied }
    } catch (error) {
      if (error instanceof GroupRideError && error.status === 409) {
        return { series: 'always-a-race', name, status: 'waiting' as const, date: subject }
      }
      const message = error instanceof Error ? error.message : 'Ride update failed'
      return { series: 'always-a-race', name, status: 'error' as const, date: subject, message }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ride update failed'
    return { series: 'always-a-race', name, status: 'error' as const, message }
  }
}
