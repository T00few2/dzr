'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Area, AreaChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, usePlotArea, XAxis, YAxis } from 'recharts'
import { Box, HStack, Spinner, Stack, Text } from '@chakra-ui/react'
import type { ProfileSegment, ProfileZoom, RaceProfile } from '@/packages/shared/routeProfile'
import { bonusNamesMatch, profileImageSrc } from '@/packages/shared/routeProfile'

const COLORS = { sprint: '#56A845', climb: '#ed2324', segment: '#718096', bonus: '#C9A227' }
const GRADE_BANDS = [
  { label: '<4%', color: '#3CB44A' },
  { label: '4–7%', color: '#2E6BFF' },
  { label: '7–10%', color: '#E10600' },
  { label: '10%+', color: '#7A1020' },
]

type BonusSprint = { name: string; laps?: string }

type ProfileRequest = {
  world: string
  route: string
  laps?: string
  distance?: string
  finish?: string
  climbs?: string[]
}

function wantsReverse(value: string) {
  return /\b(reverse|rev\.?)\b/i.test(value)
}

function gradeColor(grade: number) {
  if (grade < 4) return GRADE_BANDS[0].color
  if (grade < 7) return GRADE_BANDS[1].color
  if (grade < 10) return GRADE_BANDS[2].color
  return GRADE_BANDS[3].color
}

function segmentId(segment: ProfileSegment) {
  return `${segment.name}|${segment.direction}|${segment.fromKm.toFixed(3)}`
}

function isReverse(segment: ProfileSegment) {
  return segment.direction === 'reverse' || wantsReverse(segment.name)
}

function bonusNames(segments: ProfileSegment[], bonusSprints: BonusSprint[], lapKm: number) {
  const labels = new Map<string, string>()
  for (const row of bonusSprints) {
    const query = row.name.trim()
    if (!query) continue
    let candidates = segments.filter((segment) => bonusNamesMatch(segment.name, query))
    const hint = /\blong\b/i.test(query) ? 'long' : /\bshort\b/i.test(query) ? 'short' : ''
    if (hint && candidates.length > 1) {
      const sorted = [...candidates].sort((left, right) => left.toKm - left.fromKm - (right.toKm - right.fromKm))
      candidates = [hint === 'short' ? sorted[0] : sorted[sorted.length - 1]]
    } else if (wantsReverse(query) || /\bforward\b/i.test(query)) {
      const directed = candidates.filter((segment) => isReverse(segment) === wantsReverse(query))
      if (directed.length) candidates = directed
    } else {
      const forwards = candidates.filter((segment) => !isReverse(segment))
      if (forwards.length) candidates = forwards
    }
    const laps = String(row.laps || '')
      .split(',')
      .map((part) => Number(part.trim()))
      .filter((value) => value > 0)
    for (const segment of candidates) {
      const lap = lapKm > 0 ? Math.floor(segment.fromKm / lapKm) + 1 : 1
      if (laps.length && !laps.includes(lap)) continue
      labels.set(segmentId(segment), query)
    }
  }
  return labels
}

function segmentLabel(segment: ProfileSegment, bonusName: string | undefined) {
  if (!bonusName) return segment.name
  return segment.type === 'climb' ? `Bonus: ${bonusName}` : `Bonus Sprint: ${bonusName}`
}

function SegmentNames({
  bands,
  bonusLabels,
  xDomain,
}: {
  bands: ProfileSegment[]
  bonusLabels: Map<string, string>
  xDomain: [number, number]
}) {
  const plot = usePlotArea()
  if (!plot || plot.width <= 0) return null
  const [x0, x1] = xDomain
  const span = x1 - x0 || 1
  const placed: { x: number; y: number; text: string; fill: string }[] = []
  for (const segment of bands) {
    const bonusName = bonusLabels.get(segmentId(segment))
    const text = segmentLabel(segment, bonusName)
    const width = text.length * 6.4
    const mid = (segment.fromKm + segment.toKm) / 2
    const raw = plot.x + ((mid - x0) / span) * plot.width
    const x = Math.min(plot.x + plot.width - width / 2, Math.max(plot.x + width / 2, raw))
    const row = placed.filter((label) => Math.abs(label.x - x) < (text.length + label.text.length) * 3.2).length
    placed.push({ x, y: 15 + row * 14, text, fill: bonusName ? '#E6C35C' : 'white' })
  }
  return (
    <g>
      {placed.map((label) => (
        <text key={`${label.text}-${label.x}`} x={label.x} y={label.y} textAnchor="middle" fill={label.fill} fontSize={12} fontWeight={600}>
          {label.text}
        </text>
      ))}
    </g>
  )
}

function elevationDomain(points: { altitude: number }[]): [number, number] {
  const altitudes = points.map((point) => point.altitude)
  const low = Math.min(...altitudes)
  const high = Math.max(...altitudes)
  const step = high - low > 120 ? 20 : 10
  const floor = low < 40 ? 0 : Math.floor((low - step) / step) * step
  const ceil = Math.ceil((high + step * 0.4) / step) * step
  return [floor, Math.max(ceil, floor + step)]
}

function GradeStroke({
  points,
  xDomain,
  yDomain,
}: {
  points: { distance: number; altitude: number }[]
  xDomain: [number, number]
  yDomain: [number, number]
}) {
  const plot = usePlotArea()
  if (!plot || plot.width <= 0 || plot.height <= 0 || points.length < 2) return null
  const [x0, x1] = xDomain
  const [y0, y1] = yDomain
  const xSpan = x1 - x0 || 1
  const ySpan = y1 - y0 || 1
  const pieces = []
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index]
    const end = points[index + 1]
    const run = (end.distance - start.distance) * 1000
    const grade = ((end.altitude - start.altitude) / Math.max(0.001, run)) * 100
    const xStart = plot.x + ((start.distance - x0) / xSpan) * plot.width
    const xEnd = plot.x + ((end.distance - x0) / xSpan) * plot.width
    const yStart = plot.y + (1 - (start.altitude - y0) / ySpan) * plot.height
    const yEnd = plot.y + (1 - (end.altitude - y0) / ySpan) * plot.height
    if (![xStart, xEnd, yStart, yEnd].every((value) => Number.isFinite(value))) continue
    pieces.push(
      <line key={index} x1={xStart} y1={yStart} x2={xEnd} y2={yEnd} stroke={gradeColor(grade)} strokeWidth={4} strokeLinecap="round" />
    )
  }
  return <g>{pieces}</g>
}

function pointsIn(profile: RaceProfile, fromKm: number, toKm: number) {
  return profile.distanceKm
    .map((distance, index) => ({ distance, altitude: profile.altitudeM[index] || 0 }))
    .filter((point) => point.distance >= fromKm - 0.05 && point.distance <= toKm + 0.05)
}

function segmentsIn(segments: ProfileSegment[], fromKm: number, toKm: number, bonusLabels: Map<string, string>) {
  return segments.filter(
    (segment) =>
      segment.toKm >= fromKm &&
      segment.fromKm <= toKm &&
      (segment.type !== 'segment' || bonusLabels.has(segmentId(segment)))
  )
}

function ProfileChart({
  profile,
  fromKm,
  toKm,
  height = 220,
  bonusSprints = [],
  colorByGrade = false,
  named = false,
}: {
  profile: RaceProfile
  fromKm: number
  toKm: number
  height?: number
  bonusSprints?: BonusSprint[]
  colorByGrade?: boolean
  named?: boolean
}) {
  const data = pointsIn(profile, fromKm, toKm)
  const bonusLabels = bonusNames(profile.segments, bonusSprints, profile.lapKm)
  const bands = segmentsIn(profile.segments, fromKm, toKm, bonusLabels)
  if (data.length < 2) return <Text color="gray.500">No elevation in this section.</Text>
  const xDomain: [number, number] = [fromKm, toKm]
  const yRange = elevationDomain(data)
  return (
    <Box h={`${height}px`} w="100%">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: named ? 46 : 8, right: 8, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="distance"
            type="number"
            domain={xDomain}
            allowDataOverflow
            stroke="#A0AEC0"
            tick={{ fill: '#A0AEC0', fontSize: 12 }}
            unit=" km"
          />
          <YAxis
            type="number"
            domain={colorByGrade ? yRange : undefined}
            allowDataOverflow={colorByGrade}
            stroke="#A0AEC0"
            tick={{ fill: '#A0AEC0', fontSize: 12 }}
            width={48}
            unit=" m"
          />
          <Tooltip
            contentStyle={{ background: '#1A202C', border: '1px solid #4A5568' }}
            labelFormatter={(label) => `${Number(label).toFixed(1)} km`}
            formatter={(value) => [`${Math.round(Number(value))} m`, 'Elevation']}
          />
          <Area type="monotone" dataKey="altitude" stroke={colorByGrade ? 'none' : '#E2E8F0'} fill="#2D3748" fillOpacity={0.9} dot={false} />
          {colorByGrade ? <GradeStroke points={data} xDomain={xDomain} yDomain={yRange} /> : null}
          {named ? <SegmentNames bands={bands} bonusLabels={bonusLabels} xDomain={xDomain} /> : null}
          {colorByGrade
            ? null
            : bands.map((segment) => {
                const bonusName = bonusLabels.get(segmentId(segment))
                const color = bonusName ? COLORS.bonus : COLORS[segment.type] || COLORS.segment
                return segment.toKm - segment.fromKm < 0.05 ? (
                  <ReferenceLine
                    key={`${segment.name}-${segment.fromKm}`}
                    x={segment.fromKm}
                    stroke={color}
                    strokeWidth={3}
                    ifOverflow="visible"
                  />
                ) : (
                  <ReferenceArea
                    key={`${segment.name}-${segment.fromKm}`}
                    x1={segment.fromKm}
                    x2={segment.toKm}
                    fill={color}
                    fillOpacity={bonusName ? 0.72 : 0.4}
                    stroke={color}
                    strokeWidth={2}
                    ifOverflow="visible"
                  />
                )
              })}
        </AreaChart>
      </ResponsiveContainer>
    </Box>
  )
}

function GradeLegend() {
  return (
    <HStack spacing={3} mb={1} flexWrap="wrap">
      {GRADE_BANDS.map((band) => (
        <HStack key={band.label} spacing={1}>
          <Box w="12px" h="12px" bg={band.color} rounded="sm" />
          <Text color="gray.300" fontSize="xs">
            {band.label}
          </Text>
        </HStack>
      ))}
    </HStack>
  )
}

function ZoomBlock({ profile, zoom, climb }: { profile: RaceProfile; zoom: ProfileZoom; climb?: boolean }) {
  return (
    <Box>
      <Text color="white" fontWeight="semibold" mb={1}>
        {zoom.title}
      </Text>
      {zoom.matched && climb ? <GradeLegend /> : null}
      {zoom.matched ? (
        <ProfileChart profile={profile} fromKm={zoom.fromKm} toKm={zoom.toKm} height={180} colorByGrade={climb} />
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
  bonusSprints = [],
  onProfile,
}: {
  request: ProfileRequest | null
  showFinish?: boolean
  showClimbs?: boolean
  bonusSprints?: BonusSprint[]
  onProfile?: (profile: RaceProfile | null) => void
}) {
  const [profile, setProfile] = useState<RaceProfile | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const key = request
    ? [request.world, request.route, request.laps, request.distance, request.finish, (request.climbs || []).join('|')].join('\n')
    : ''

  useEffect(() => {
    if (!request?.route) {
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
        Profile preview. Green is a sprint, red is a climb, gold awards bonus seconds. A climb close-up is colored by gradient.
      </Text>
      {loading ? <Text color="gray.400">Loading profile…</Text> : null}
      {error ? <Text color="red.300">{error}</Text> : null}
      {profile && profile.distanceKm.length > 1 ? (
        <>
          <Box>
            <Text color="white" fontWeight="semibold" mb={1}>
              Profile
            </Text>
            <ProfileChart
              profile={profile}
              fromKm={0}
              toKm={profile.raceKm || profile.distanceKm[profile.distanceKm.length - 1]}
              bonusSprints={bonusSprints}
              named
            />
          </Box>
          {showFinish && profile.finish ? <ZoomBlock profile={profile} zoom={profile.finish} /> : null}
          {showClimbs
            ? profile.climbs.map((climb) => (
                <ZoomBlock key={`${climb.title}-${climb.fromKm}`} profile={profile} zoom={climb} climb />
              ))
            : null}
        </>
      ) : null}
    </Stack>
  )
}
