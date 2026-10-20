'use client'

import { Box, Text } from '@chakra-ui/react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { CHART_HEIGHT } from './ChartCard'
import type { MemberPoint } from '@/app/lib/statsTypes'
import type { ActivityPoint, ChartPoint, DatedPoint } from '@/app/lib/statsSeries'
import { formatChartDate, type ChartTimeline } from '@/app/lib/statsTimeline'

export type GrowthChartPoint = ChartPoint<{
  date: string
  zwift: number | null
  zwiftpower: number | null
}>

export const CHART_COLORS = {
  club: '#FC8181',
  zwiftpower: '#F6AD55',
  members: '#63B3ED',
  clubRole: '#B794F4',
  messages: '#FC8181',
  reactions: '#F6AD55',
  voice: '#68D391',
  interactions: '#B794F4',
  grid: '#2D3748',
  axis: '#A0AEC0',
}

function fmtTick(timestamp: number) {
  return formatChartDate(new Date(timestamp).toISOString().slice(0, 10))
}

function timelineTicks(domain: [number, number]) {
  const day = 86400000
  return [...new Set(Array.from({ length: 4 }, (_, index) =>
    Math.round((domain[0] + (domain[1] - domain[0]) * index / 3) / day) * day,
  ))]
}

function DisplayedRange({ timeline }: { timeline: { start: string; end: string; extended: boolean } }) {
  if (!timeline.extended) return null
  return <Text fontSize="xs" color="gray.400" mt={2}>Displayed: {formatChartDate(timeline.start)}–{formatChartDate(timeline.end)} · includes boundary observations</Text>
}

type TooltipPoint = {
  date?: string
  weekStart?: string
  weekEnd?: string
  sourceDate?: string
  sourceDates?: Partial<Record<string, string>>
  estimated?: boolean
  boundary?: 'before' | 'after'
  openWeek?: boolean
}

function DarkTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { dataKey?: string | number; name?: string; value?: number; color?: string; payload?: TooltipPoint }[]
  label?: string | number
}) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload
  let dateLabel = point?.date ?? label
  if (point?.openWeek && point.weekStart && point.date) dateLabel = `${point.weekStart} – ${point.date} · this week`
  else if (point?.weekStart && point.weekEnd) dateLabel = `${point.weekStart} – ${point.weekEnd}`

  return (
    <Box bg="gray.800" borderWidth="1px" borderColor="gray.600" rounded="md" px={3} py={2} fontSize="sm">
      <Text color="gray.300" mb={1}>{dateLabel}{point?.estimated ? ' · estimated' : ''}</Text>
      {payload.filter(entry => entry.value != null).map(entry => {
        const sourceDate = entry.payload?.sourceDates?.[entry.dataKey ?? ''] ?? entry.payload?.sourceDate
        const showSource = Boolean(sourceDate && (point?.weekStart || sourceDate !== point?.date))
        return (
          <Box key={entry.name}>
            <Text color={entry.color || 'white'}>{entry.name}: {Number(entry.value).toLocaleString()}</Text>
            {showSource && <Text color="gray.400" fontSize="xs">Value from {sourceDate}</Text>}
          </Box>
        )
      })}
    </Box>
  )
}

const axis = {
  tick: { fill: CHART_COLORS.axis, fontSize: 11 },
  stroke: CHART_COLORS.grid,
}

function timeAxis(domain: [number, number]) {
  return {
    ...axis,
    dataKey: 'timestamp',
    type: 'number' as const,
    scale: 'utc' as const,
    domain,
    ticks: timelineTicks(domain),
    tickFormatter: fmtTick,
    minTickGap: 16,
    interval: 'preserveStartEnd' as const,
  }
}

type CountSeries<T> = { key: keyof T & string; name: string; color: string }

function CountChart<T extends DatedPoint>({ timeline, series, curve = 'linear' }: {
  timeline: ChartTimeline<T>
  series: CountSeries<T>[]
  curve?: 'linear' | 'stepAfter'
}) {
  const visibleSeries = series.filter(({ key }) => timeline.points.some(point => point[key] != null))
  const showLegend = visibleSeries.some(({ key }) => key !== series[0].key)
  return (
    <Box>
      <Box h={`${CHART_HEIGHT}px`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={timeline.points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
            <XAxis {...timeAxis(timeline.domain)} />
            <YAxis width={44} tickFormatter={(v) => Number(v).toLocaleString()} {...axis} />
            <Tooltip content={<DarkTooltip />} />
            {showLegend && <Legend wrapperStyle={{ fontSize: 12, color: CHART_COLORS.axis }} />}
            {visibleSeries.map(({ key, name, color }) => (
              <Line
                key={key}
                dataKey={key}
                name={name}
                stroke={color}
                type={curve}
                strokeWidth={2}
                dot={{ r: 2 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </Box>
      <DisplayedRange timeline={timeline} />
    </Box>
  )
}

export function GrowthChart({ timeline }: { timeline: ChartTimeline<GrowthChartPoint> }) {
  return (
    <CountChart timeline={timeline} series={[
      { key: 'zwift', name: 'Zwift', color: CHART_COLORS.club },
      { key: 'zwiftpower', name: 'ZwiftPower', color: CHART_COLORS.zwiftpower },
    ]} />
  )
}

export function MembersChart({ timeline }: { timeline: ChartTimeline<MemberPoint> }) {
  return (
    <CountChart
      timeline={timeline}
      curve="stepAfter"
      series={[
        { key: 'members', name: 'Discord', color: CHART_COLORS.members },
        { key: 'clubMembers', name: 'Club member role', color: CHART_COLORS.clubRole },
      ]}
    />
  )
}

export function ActivityChart({ timeline }: { timeline: ChartTimeline<ActivityPoint> }) {
  const data = timeline.points
  return (
    <Box>
      <Box h={`${CHART_HEIGHT}px`}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
            <XAxis {...timeAxis(timeline.domain)} />
            <YAxis width={36} {...axis} />
            <Tooltip content={<DarkTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12, color: CHART_COLORS.axis }} />
            <Area type="linear" dataKey="messages" name="Messages" stackId="1" stroke={CHART_COLORS.messages} fill={CHART_COLORS.messages} fillOpacity={0.7} strokeWidth={1} dot={false} />
            <Area type="linear" dataKey="reactions" name="Reactions" stackId="1" stroke={CHART_COLORS.reactions} fill={CHART_COLORS.reactions} fillOpacity={0.7} strokeWidth={1} dot={false} />
            <Area type="linear" dataKey="voice" name="Voice" stackId="1" stroke={CHART_COLORS.voice} fill={CHART_COLORS.voice} fillOpacity={0.7} strokeWidth={1} dot={false} />
            <Area type="linear" dataKey="interactions" name="Commands" stackId="1" stroke={CHART_COLORS.interactions} fill={CHART_COLORS.interactions} fillOpacity={0.7} strokeWidth={1} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </Box>
      <DisplayedRange timeline={timeline} />
    </Box>
  )
}

export function BreakdownDonut({
  messages,
  reactions,
  voice,
  interactions,
}: {
  messages: number
  reactions: number
  voice: number
  interactions: number
}) {
  const data = [
    { name: 'Messages', value: messages, color: CHART_COLORS.messages },
    { name: 'Reactions', value: reactions, color: CHART_COLORS.reactions },
    { name: 'Voice', value: voice, color: CHART_COLORS.voice },
    { name: 'Commands', value: interactions, color: CHART_COLORS.interactions },
  ].filter((d) => d.value > 0)
  const total = data.reduce((s, d) => s + d.value, 0)

  return (
    <Box h={`${CHART_HEIGHT}px`} position="relative">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="80%" paddingAngle={2} stroke="none">
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} />
            ))}
          </Pie>
          <Tooltip content={<DarkTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12, color: CHART_COLORS.axis }} />
        </PieChart>
      </ResponsiveContainer>
      <Box position="absolute" top="42%" left="50%" transform="translate(-50%, -50%)" textAlign="center" pointerEvents="none">
        <Text fontSize="xs" color="gray.500">Total</Text>
        <Text fontWeight="semibold">{total.toLocaleString()}</Text>
      </Box>
    </Box>
  )
}
