import { flaskData } from '@/app/api/admin/_lib/flask'
import { postSeriesDiscord } from '@/app/lib/seriesDiscord'
import {
  courseForRoute,
  ensureSeries,
  listSeriesViews,
  matchingFeedEvent,
  plannedSeriesRoute,
  savePublishedEvent,
  seriesDiscordHeader,
  SeriesError,
  type SeriesId,
} from '@/app/lib/seriesSchedule'
import { addDays, displayDate } from '@/packages/shared/seriesRotation'
import { categoryLine, copenhagenDay, routeLine, sprintLine } from '@/packages/shared/seriesAutomation'

export type RouteJob = {
  series: SeriesId
  name: string
  status: 'idle' | 'waiting' | 'applied' | 'error'
  date?: string
  label?: string
  route?: string
  eventId?: number
  discordError?: string
  message?: string
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

export async function applySeriesDate(seriesId: SeriesId, date: string, chosenRouteId?: number) {
  const routeName = await plannedSeriesRoute(seriesId, date)
  const event = await matchingFeedEvent(seriesId, date)
  const course = await courseForRoute(
    seriesId,
    routeName,
    chosenRouteId && chosenRouteId > 0 ? chosenRouteId : undefined
  )
  const payload: { routeId: number; laps?: number; distanceMeters?: number } = { routeId: course.routeId }
  if ('laps' in course) payload.laps = course.laps
  else payload.distanceMeters = course.distanceMeters

  const updated = await flaskData(`/api/zwift/events/${event.id}/course`, { method: 'POST', body: payload })
  if (updated.status >= 400) {
    throw new SeriesError(String(updated.body?.error || 'Zwift update failed'), updated.status >= 500 ? 502 : updated.status)
  }

  await savePublishedEvent(seriesId, date, String(event.id), course.route)

  let discordError = ''
  try {
    await postSeriesDiscord(seriesId, date, course.route, String(event.id))
  } catch (error) {
    discordError = error instanceof Error ? error.message : 'Discord post failed'
  }

  return {
    date,
    label: displayDate(date),
    eventId: event.id,
    route: course.route,
    discordError,
  }
}

function nextSubject(dates: string[], today: string) {
  const latest = dates[dates.length - 1]
  if (!latest) return { latest: '', subject: '' }
  return { latest, subject: latest >= today ? latest : addDays(latest, 7) }
}

export async function automationLines(seriesId: SeriesId, now = new Date()) {
  const stored = await ensureSeries(seriesId)
  const dates = Object.keys(stored.events).sort()
  const today = copenhagenDay(now)
  const { latest, subject } = nextSubject(dates, today)
  if (!latest || !subject) return ['Route: no saved race yet.']
  const starts = new Map<string, Promise<Date | null>>()
  const startOf = (eventId: string) => {
    const cached = starts.get(eventId)
    if (cached) return cached
    const pending = eventStart(eventId)
    starts.set(eventId, pending)
    return pending
  }
  const saved = stored.events[subject]
  const route = saved?.route || (await plannedSeriesRoute(seriesId, subject))
  const previousStart = saved ? null : await startOf(stored.events[latest].id)
  const lines = [
    routeLine({
      label: displayDate(subject),
      route,
      saved: Boolean(saved),
      now,
      previousStart,
      nextDate: subject,
    }),
  ]
  if (seriesId !== 'zwifty-fifty') return lines

  const sprintEvent = latest >= today ? stored.events[latest] : null
  lines.push(sprintLine({ set: Boolean(sprintEvent?.primesFix), publishedAt: sprintEvent?.publishedAt, now }))

  const yesterday = addDays(today, -1)
  const recent = dates.filter((date) => date === today || date === yesterday).sort()
  const future = dates.filter((date) => date > today).sort()
  const categoryDate = recent[recent.length - 1] || future[0] || ''
  const categoryEvent = categoryDate ? stored.events[categoryDate] : null
  const start = categoryEvent ? await startOf(categoryEvent.id) : null
  lines.push(categoryLine({ checked: Boolean(categoryEvent?.resultsFix), start, now }))
  return lines
}

export async function listSeriesViewsWithAutomation() {
  const series = await listSeriesViews()
  return Promise.all(
    series.map(async (view) => {
      if (view.error) return { ...view, automation: [] as string[] }
      try {
        return { ...view, automation: await automationLines(view.id) }
      } catch {
        return { ...view, automation: [] as string[] }
      }
    })
  )
}

export async function runDueRouteUpdates(now = new Date()): Promise<RouteJob[]> {
  const jobs: RouteJob[] = []
  for (const seriesId of ['after-party', 'zwifty-fifty'] as const) {
    jobs.push(await dueRouteJob(seriesId, now))
  }
  return jobs
}

async function dueRouteJob(seriesId: SeriesId, now: Date): Promise<RouteJob> {
  const name = seriesDiscordHeader(seriesId)
  try {
    const stored = await ensureSeries(seriesId)
    const dates = Object.keys(stored.events).sort()
    const today = copenhagenDay(now)
    const { latest, subject } = nextSubject(dates, today)
    if (!latest || !subject || stored.events[subject] || today >= subject) {
      return { series: seriesId, name, status: 'idle', date: subject }
    }
    const start = await eventStart(stored.events[latest].id)
    if (!start) {
      return { series: seriesId, name, status: 'error', date: subject, message: 'Could not read the previous race start' }
    }
    const route = await plannedSeriesRoute(seriesId, subject)
    const openAt = new Date(start.getTime() + 24 * 60 * 60 * 1000)
    if (now < openAt) return { series: seriesId, name, status: 'idle', date: subject, route }
    try {
      const applied = await applySeriesDate(seriesId, subject)
      return { series: seriesId, name, status: 'applied', ...applied }
    } catch (error) {
      if (error instanceof SeriesError && error.status === 409 && /not created/i.test(error.message)) {
        return { series: seriesId, name, status: 'waiting', date: subject, route }
      }
      const message = error instanceof Error ? error.message : 'Route update failed'
      return { series: seriesId, name, status: 'error', date: subject, route, message }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Route update failed'
    return { series: seriesId, name, status: 'error', message }
  }
}
