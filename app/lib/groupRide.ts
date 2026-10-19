import { admin, adminDb } from '@/app/utils/firebaseAdminConfig'
import { flaskData } from '@/app/api/admin/_lib/flask'
import { catalogRouteByName, listCatalog } from '@/app/lib/seriesCatalog'
import { routeOfTheWeek } from '@/app/lib/routeOfTheWeek'
import { findZwiftRoute } from '@/app/lib/zwiftRouteLookup'
import { loadUpcomingDzrEvents } from '@/app/lib/zwiftPublicEvents'
import { copenhagenDay, routeLine, routePhase } from '@/packages/shared/seriesAutomation'
import { displayDate, listSeriesDates, parseIsoDate, routeForDate } from '@/packages/shared/seriesRotation'

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
  overrides: Record<string, string>
  events: Record<string, SavedRide>
}

export type GroupRideDate = {
  date: string
  label: string
  routeA: string
  overridden: boolean
  routeB: string
  routeBUrl: string
  routeBWarning: string
  eventId: string
  feedEventId: number | null
}

export type GroupRideView = {
  anchorDate: string
  routes: string[]
  started: boolean
  dates: GroupRideDate[]
  feedUnavailable: boolean
  automation: string[]
}

function ref() {
  return adminDb.collection(COLLECTION).doc(DOC)
}

function asStored(data: Record<string, unknown> | undefined): StoredRide {
  const overrides: Record<string, string> = {}
  const rawOverrides = data?.overrides && typeof data.overrides === 'object' ? (data.overrides as Record<string, unknown>) : {}
  for (const [date, route] of Object.entries(rawOverrides)) {
    const name = String(route || '').trim()
    if (parseIsoDate(date) && name) overrides[date] = name
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
    overrides,
    events,
  }
}

async function readRide() {
  const snap = await ref().get()
  return asStored(snap.exists ? snap.data() : undefined)
}

async function categoryANames() {
  return (await listCatalog(DOC)).map((route) => route.route)
}

function usableOverrides(names: string[], overrides: Record<string, string>) {
  const keep: Record<string, string> = {}
  for (const [date, route] of Object.entries(overrides)) {
    const found = names.find((name) => name.toLowerCase() === route.toLowerCase())
    if (found) keep[date] = found
  }
  return keep
}

function plannedRoute(names: string[], stored: StoredRide, date: string) {
  if (!names.length || !stored.anchorDate) return ''
  return routeForDate(names, stored.anchorDate, stored.anchorIndex, usableOverrides(names, stored.overrides), date)
}

function naturalRoute(names: string[], stored: StoredRide, date: string) {
  if (!names.length || !stored.anchorDate) return ''
  return routeForDate(names, stored.anchorDate, stored.anchorIndex, {}, date)
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
  const names = await categoryANames()
  const feed = await feedEvents()
  const dates = stored.anchorDate && names.length ? listSeriesDates(stored.anchorDate, Object.keys(stored.events), 6) : []
  const rows = await Promise.all(
    dates.map(async (date) => {
      const planned = plannedRoute(names, stored, date)
      const natural = naturalRoute(names, stored, date)
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
        routeA: planned,
        overridden: Boolean(planned && natural && planned !== natural),
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
    routes: names,
    started: Object.keys(stored.events).length > 0,
    dates: rows,
    feedUnavailable: feed.unavailable,
    automation: await automationLines(stored, names, rows, now),
  }
}

async function automationLines(stored: StoredRide, names: string[], rows: GroupRideDate[], now: Date) {
  if (!names.length) return ['Category A: add the routes in Route setup.']
  if (!stored.anchorDate) return ['Category A: choose the date of the first route.']
  const today = copenhagenDay(now)
  const savedDates = Object.keys(stored.events).sort()
  const latest = savedDates[savedDates.length - 1] || ''
  const subject = !latest ? rows[0]?.date || stored.anchorDate : latest >= today ? latest : addWeek(latest)
  const row = rows.find((item) => item.date === subject)
  const planned = plannedRoute(names, stored, subject)
  const saved = stored.events[subject]
  const previous = latest && latest !== subject ? stored.events[latest] : null
  const previousStart = !saved && previous ? await eventStart(previous.id) : null
  const categoryB = row?.routeB ? `Category B: ${row.routeB}.` : 'Category B: route of the week.'
  if (!latest) {
    return [
      `Category A: ${displayDate(subject)}, ${planned || 'the first route'}. Apply the first ride, then the next ones follow 24 hours after each start.`,
      categoryB,
    ]
  }
  const route = routeLine({
    label: displayDate(subject),
    route: saved?.routeA || planned || 'Category A',
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

export async function saveGroupRideAnchor(anchorDate: string) {
  const iso = parseIsoDate(anchorDate)
  if (!iso) throw new GroupRideError('First ride must be YYYY-MM-DD')
  const names = await categoryANames()
  if (!names.length) throw new GroupRideError('Add the category A routes in Route setup first')
  const stored = await readRide()
  if (Object.keys(stored.events).length) throw new GroupRideError('The rotation has already started')
  const snap = await ref().get()
  const payload: Record<string, unknown> = {
    anchorDate: iso,
    anchorIndex: 0,
    overrides: {},
    events: stored.events,
  }
  if (snap.exists && Array.isArray(snap.data()?.routes)) payload.routes = admin.firestore.FieldValue.delete()
  await ref().set(payload, { merge: true })
  return groupRideView()
}

export async function setGroupRideOverride(date: string, routeName: string) {
  const iso = parseIsoDate(date)
  if (!iso) throw new GroupRideError('Date must be YYYY-MM-DD')
  const names = await categoryANames()
  const chosen = names.find((name) => name.toLowerCase() === routeName.trim().toLowerCase())
  if (!chosen) throw new GroupRideError('Route is not in the category A list')
  const stored = await readRide()
  if (!stored.anchorDate) throw new GroupRideError('Choose the date of the first route')
  const natural = naturalRoute(names, stored, iso)
  const field = `overrides.${iso}`
  if (natural === chosen) {
    await ref().update({ [field]: admin.firestore.FieldValue.delete() })
  } else {
    await ref().update({ [field]: chosen })
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

async function categoryARouteId(routeName: string) {
  const entry = await catalogRouteByName(DOC, routeName)
  if (!entry) throw new GroupRideError('Category A has no route for that date')
  if (entry.zwiftRouteId) return entry.zwiftRouteId
  try {
    const hit = await findZwiftRoute(entry.zwiftRouteName || entry.route)
    return hit.routeId
  } catch (error) {
    const message = error instanceof Error ? error.message : `${routeName} has no Zwift route`
    throw new GroupRideError(message)
  }
}

export async function applyGroupRide(date: string) {
  const iso = parseIsoDate(date)
  if (!iso) throw new GroupRideError('Date must be YYYY-MM-DD')
  const stored = await readRide()
  const names = await categoryANames()
  const planned = plannedRoute(names, stored, iso)
  if (!planned) throw new GroupRideError('Category A has no route for that date')
  const routeId = await categoryARouteId(planned)
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
        { id: categoryA.id, routeId },
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
          routeA: planned,
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
    route: `A ${planned}, B ${week.route.name}`,
    channelPost: false as const,
  }
}

export async function runDueGroupRide(now = new Date()) {
  const name = "It's always a race"
  try {
    const stored = await readRide()
    const names = await categoryANames()
    const dates = Object.keys(stored.events).sort()
    const latest = dates[dates.length - 1] || ''
    if (!latest || !stored.anchorDate || !names.length) {
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
