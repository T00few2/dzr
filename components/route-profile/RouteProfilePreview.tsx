'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Area, AreaChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Box, Spinner, Stack, Text } from '@chakra-ui/react'
import type { ProfileSegment, ProfileZoom, RaceProfile } from '@/packages/shared/routeProfile'
import { profileImageSrc } from '@/packages/shared/routeProfile'

const COLORS = { sprint: '#56A845', climb: '#ed2324', segment: '#718096' }

type ProfileRequest = {
  world: string
  route: string
  laps?: string
  distance?: string
  finish?: string
  climbs?: string[]
}

function pointsIn(profile: RaceProfile, fromKm: number, toKm: number) {
  return profile.distanceKm
    .map((distance, index) => ({ distance, altitude: profile.altitudeM[index] || 0 }))
    .filter((point) => point.distance >= fromKm - 0.05 && point.distance <= toKm + 0.05)
}

function segmentsIn(segments: ProfileSegment[], fromKm: number, toKm: number) {
  return segments.filter((segment) => segment.toKm >= fromKm && segment.fromKm <= toKm && segment.type !== 'segment')
}

function ProfileChart({
  profile,
  fromKm,
  toKm,
  height = 220,
}: {
  profile: RaceProfile
  fromKm: number
  toKm: number
  height?: number
}) {
  const data = pointsIn(profile, fromKm, toKm)
  const bands = segmentsIn(profile.segments, fromKm, toKm)
  if (data.length < 2) return <Text color="gray.500">No elevation in this section.</Text>
  return (
    <Box h={`${height}px`} w="100%">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <XAxis dataKey="distance" stroke="#A0AEC0" tick={{ fill: '#A0AEC0', fontSize: 12 }} unit=" km" />
          <YAxis stroke="#A0AEC0" tick={{ fill: '#A0AEC0', fontSize: 12 }} width={48} unit=" m" />
          <Tooltip
            contentStyle={{ background: '#1A202C', border: '1px solid #4A5568' }}
            labelFormatter={(label) => `${Number(label).toFixed(1)} km`}
            formatter={(value) => [`${Math.round(Number(value))} m`, 'Elevation']}
          />
          <Area type="monotone" dataKey="altitude" stroke="#E2E8F0" fill="#4A5568" dot={false} />
          {bands.map((segment) =>
            segment.toKm - segment.fromKm < 0.05 ? (
              <ReferenceLine
                key={`${segment.name}-${segment.fromKm}`}
                x={segment.fromKm}
                stroke={COLORS[segment.type]}
                strokeWidth={2}
              />
            ) : (
              <ReferenceArea
                key={`${segment.name}-${segment.fromKm}`}
                x1={segment.fromKm}
                x2={segment.toKm}
                fill={COLORS[segment.type]}
                fillOpacity={0.45}
                strokeOpacity={0}
              />
            )
          )}
        </AreaChart>
      </ResponsiveContainer>
    </Box>
  )
}

function ZoomBlock({ profile, zoom }: { profile: RaceProfile; zoom: ProfileZoom }) {
  return (
    <Box>
      <Text color="white" fontWeight="semibold" mb={1}>
        {zoom.title}
      </Text>
      {zoom.matched ? (
        <ProfileChart profile={profile} fromKm={zoom.fromKm} toKm={zoom.toKm} height={180} />
      ) : (
        <Text color="orange.300">No matching segment on this route.</Text>
      )}
    </Box>
  )
}

export function useProfileImage(series: 'after-party' | 'zwifty-fifty', routeName: string) {
  const src = profileImageSrc(series, routeName)
  const [state, setState] = useState<'checking' | 'yes' | 'no'>('checking')
  useEffect(() => {
    let cancelled = false
    setState('checking')
    const image = new Image()
    image.onload = () => {
      if (!cancelled) setState('yes')
    }
    image.onerror = () => {
      if (!cancelled) setState('no')
    }
    image.src = src
    return () => {
      cancelled = true
    }
  }, [src])
  return state
}

export function KeepExistingImages({
  series,
  routeName,
  children,
  fallback,
}: {
  series: 'after-party' | 'zwifty-fifty'
  routeName: string
  children: ReactNode
  fallback: ReactNode
}) {
  const image = useProfileImage(series, routeName)
  if (image === 'checking') return <Spinner mx="auto" color="white" />
  if (image === 'yes') return <>{children}</>
  return <>{fallback}</>
}

export function RouteProfilePreview({
  request,
  showFinish,
  showClimbs,
  onProfile,
}: {
  request: ProfileRequest | null
  showFinish?: boolean
  showClimbs?: boolean
  onProfile?: (profile: RaceProfile | null) => void
}) {
  const [profile, setProfile] = useState<RaceProfile | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const key = request
    ? [request.world, request.route, request.laps, request.distance, request.finish, (request.climbs || []).join('|')].join('\n')
    : ''

  useEffect(() => {
    if (!request?.world || !request.route) {
      setProfile(null)
      setError('')
      onProfile?.(null)
      return
    }
    let cancelled = false
    const handle = window.setTimeout(() => {
      const params = new URLSearchParams({
        world: request.world,
        route: request.route,
        laps: request.laps || '',
        distance: request.distance || '',
        finish: request.finish || '',
        climbs: (request.climbs || []).join(','),
      })
      setLoading(true)
      setError('')
      void fetch(`/api/route-profile?${params.toString()}`)
        .then(async (res) => {
          const body = await res.json().catch(() => ({}))
          if (!res.ok) throw new Error(String(body.error || 'Could not load the route profile'))
          return body as RaceProfile
        })
        .then((body) => {
          if (cancelled) return
          setProfile(body)
          onProfile?.(body)
        })
        .catch((err: unknown) => {
          if (cancelled) return
          setProfile(null)
          onProfile?.(null)
          setError(err instanceof Error ? err.message : 'Could not load the route profile')
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 300)
    return () => {
      cancelled = true
      window.clearTimeout(handle)
    }
    // The request fields are folded into key. onProfile is a refresh callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  if (!request?.route) return null
  return (
    <Stack spacing={4}>
      <Text color="gray.400" fontSize="sm">
        Profile preview. Green is a sprint, red is a climb.
      </Text>
      {loading ? <Text color="gray.400">Loading profile…</Text> : null}
      {error ? <Text color="red.300">{error}</Text> : null}
      {profile && profile.distanceKm.length > 1 ? (
        <>
          <Box>
            <Text color="white" fontWeight="semibold" mb={1}>
              Profile
            </Text>
            <ProfileChart profile={profile} fromKm={0} toKm={profile.raceKm || profile.distanceKm[profile.distanceKm.length - 1]} />
          </Box>
          {showFinish && profile.finish ? <ZoomBlock profile={profile} zoom={profile.finish} /> : null}
          {showClimbs
            ? profile.climbs.map((climb) => <ZoomBlock key={`${climb.title}-${climb.fromKm}`} profile={profile} zoom={climb} />)
            : null}
        </>
      ) : null}
    </Stack>
  )
}
