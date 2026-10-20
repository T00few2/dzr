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
import type { ActivityPoint, ChartPoint } from '@/app/lib/statsSeries'
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

function DarkTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { name?: string; value?: number; color?: string; payload?: Record<string, unknown> }[]
  label?: string | number
}) {
  if (!active || !payload?.length) return null
  const estimated = payload[0]?.payload?.estimated
  const point = payload[0]?.payload
  const dateLabel = point?.weekStart && point?.weekEnd ? `${point.weekStart} – ${point.weekEnd}` : typeof point?.date === 'string' ? point.date : label
  return (
    <Box bg="gray.800" borderWidth="1px" borderColor="gray.600" rounded="md" px={3} py={2} fontSize="sm">
      <Text color="gray.300" mb={1}>{dateLabel}{estimated ? ' · estimated' : ''}</Text>
      {typeof point?.sourceDate === 'string' && Boolean(point?.weekStart) && (
        <Text color="gray.400" fontSize="xs">Value from {point.sourceDate}</Text>
      )}
      {Boolean(point?.boundary) && <Text color="yellow.200" fontSize="xs">Observation outside the selected period</Text>}
      {payload.filter((p) => p.value != null).map((p) => (
        <Text key={p.name} color={p.color || 'white'}>
          {p.name}: {Number(p.value || 0).toLocaleString()}
        </Text>
      ))}
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

export function GrowthChart({ timeline }: { timeline: ChartTimeline<GrowthChartPoint> }) {
  const data = timeline.points
  const hasZp = data.some((d) => d.zwiftpower != null)
  return (
    <Box>
      <Box h={`${CHART_HEIGHT}px`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
            <XAxis {...timeAxis(timeline.domain)} />
            <YAxis width={44} tickFormatter={(v) => Number(v).toLocaleString()} {...axis} />
            <Tooltip content={<DarkTooltip />} />
            {hasZp ? <Legend wrapperStyle={{ fontSize: 12, color: CHART_COLORS.axis }} /> : null}
            <Line
              type="linear"
              dataKey="zwift"
              name="Zwift"
              stroke={CHART_COLORS.club}
              strokeWidth={2}
              dot={{ r: 2 }}
              connectNulls
            />
            {hasZp ? (
              <Line
                type="linear"
                dataKey="zwiftpower"
                name="ZwiftPower"
                stroke={CHART_COLORS.zwiftpower}
                strokeWidth={2}
                dot={{ r: 2 }}
                connectNulls
              />
            ) : null}
          </LineChart>
        </ResponsiveContainer>
      </Box>
      <DisplayedRange timeline={timeline} />
    </Box>
  )
}

export function MembersChart({ timeline }: { timeline: ChartTimeline<MemberPoint> }) {
  const data = timeline.points
  const hasClubRole = data.some((d) => d.clubMembers != null)
  return (
    <Box>
      <Box h={`${CHART_HEIGHT}px`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
            <XAxis {...timeAxis(timeline.domain)} />
            <YAxis width={44} tickFormatter={(v) => Number(v).toLocaleString()} {...axis} />
            <Tooltip content={<DarkTooltip />} />
            {hasClubRole ? <Legend wrapperStyle={{ fontSize: 12, color: CHART_COLORS.axis }} /> : null}
            <Line
              type="linear"
              dataKey="members"
              name="Discord"
              stroke={CHART_COLORS.members}
              strokeWidth={2}
              dot={{ r: 2 }}
            />
            {hasClubRole ? (
              <Line
                type="linear"
                dataKey="clubMembers"
                name="Club member role"
                stroke={CHART_COLORS.clubRole}
                strokeWidth={2}
                dot={{ r: 2 }}
                connectNulls
              />
            ) : null}
          </LineChart>
        </ResponsiveContainer>
      </Box>
      <DisplayedRange timeline={timeline} />
    </Box>
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
