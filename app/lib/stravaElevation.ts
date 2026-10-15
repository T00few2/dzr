import { adminDb } from '@/app/utils/firebaseAdminConfig'

type Streams = { distance: number[]; altitude: number[] }

let accessToken = ''
let accessTokenExpiry = 0

function downsample(distance: number[], altitude: number[], target: number): Streams {
  if (distance.length <= target) return { distance, altitude }
  const step = Math.max(1, Math.floor(distance.length / target))
  const outDistance: number[] = []
  const outAltitude: number[] = []
  for (let i = 0; i < distance.length; i += step) {
    outDistance.push(distance[i] || 0)
    outAltitude.push(altitude[i] || 0)
  }
  const last = distance.length - 1
  if (outDistance[outDistance.length - 1] !== distance[last]) {
    outDistance.push(distance[last] || 0)
    outAltitude.push(altitude[last] || 0)
  }
  return { distance: outDistance, altitude: outAltitude }
}

async function refreshToken() {
  const clientId = process.env.STRAVA_CLIENT_ID
  const clientSecret = process.env.STRAVA_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('Strava is not configured')

  const stored = await adminDb.collection('system').doc('strava_service_token').get()
  const refresh =
    String(stored.data()?.refresh_token || '') ||
    process.env.STRAVA_REFRESH_TOKEN ||
    process.env.STRAVA_SERVICE_REFRESH_TOKEN ||
    ''
  if (!refresh) throw new Error('Set STRAVA_REFRESH_TOKEN to load route elevation')

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refresh,
  })
  const res = await fetch('https://www.strava.com/oauth/token', { method: 'POST', body })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.access_token) throw new Error('Strava did not accept the refresh token')
  accessToken = String(data.access_token)
  accessTokenExpiry = Number(data.expires_at || 0) * 1000 - 5 * 60 * 1000
  if (data.refresh_token) {
    await adminDb.collection('system').doc('strava_service_token').set(
      { refresh_token: String(data.refresh_token), expires_at: Number(data.expires_at || 0) },
      { merge: true }
    )
  }
  return accessToken
}

async function stravaToken() {
  if (accessToken && Date.now() < accessTokenExpiry) return accessToken
  return refreshToken()
}

async function fetchStreams(segmentId: number): Promise<Streams> {
  const token = await stravaToken()
  const url = `https://www.strava.com/api/v3/segments/${segmentId}/streams?keys=distance,altitude&key_by_type=true`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error('Strava did not return elevation for this route')
  const data = await res.json()
  const distance = Array.isArray(data?.distance?.data) ? data.distance.data.map(Number) : []
  const altitude = Array.isArray(data?.altitude?.data) ? data.altitude.data.map(Number) : []
  if (distance.length < 2 || altitude.length !== distance.length) {
    throw new Error('Strava did not return elevation for this route')
  }
  return downsample(distance, altitude, 400)
}

export async function elevationForSegment(segmentId: number): Promise<Streams> {
  const ref = adminDb.collection('route_elevation').doc(String(segmentId))
  const cached = await ref.get()
  const stored = cached.data()
  if (Array.isArray(stored?.distance) && Array.isArray(stored?.altitude) && stored.distance.length > 1) {
    return { distance: stored.distance.map(Number), altitude: stored.altitude.map(Number) }
  }
  const streams = await fetchStreams(segmentId)
  await ref.set({ ...streams, fetchedAt: new Date().toISOString() })
  return streams
}
