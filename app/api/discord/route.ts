import { postLatestSeriesDiscord } from '@/app/lib/seriesDiscord'
import { seriesIdFromDiscord } from '@/app/lib/seriesSchedule'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Posts the latest published race for a series.
 * The weekly cron that calls this should be turned off. Apply on /admin/events posts the new race.
 */
export async function POST(req: Request) {
  const seriesId = seriesIdFromDiscord(req.headers.get('raceseries'))
  if (!seriesId) return new Response('Invalid or missing race series', { status: 400 })
  const raceSeries = seriesId === 'after-party' ? 'DZR After Party' : 'The Zwifty Fifty'
  try {
    await postLatestSeriesDiscord(seriesId)
    return new Response(`Discord message sent to: ${raceSeries}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : `Error sending Discord message to: ${raceSeries}`
    return new Response(message, { status: 500 })
  }
}
