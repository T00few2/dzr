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
import type { DailyActivity, GrowthSeriesPoint, MemberPoint } from './types'

export const CHART_COLORS = {
  club: '#FC8181',
  members: '#63B3ED',
  messages: '#FC8181',
  reactions: '#F6AD55',
  voice: '#68D391',
  interactions: '#B794F4',
  grid: '#2D3748',
  axis: '#A0AEC0',
}

function fmtTick(iso: string) {
  const parts = String(iso || '').split('-')
  if (parts.length !== 3) return iso
  return `${parts[2]}/${parts[1]}`
}

function DarkTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { name?: string; value?: number; color?: string; payload?: Record<string, unknown> }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  const estimated = payload[0]?.payload?.estimated
  return (
    <Box bg="gray.800" borderWidth="1px" borderColor="gray.600" rounded="md" px={3} py={2} fontSize="sm">
      <Text color="gray.300" mb={1}>{label}{estimated ? ' · estimated' : ''}</Text>
      {payload.map((p) => (
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

export function GrowthChart({ data }: { data: GrowthSeriesPoint[] }) {
  return (
    <Box h={`${CHART_HEIGHT}px`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
          <XAxis dataKey="day" tickFormatter={fmtTick} minTickGap={48} {...axis} />
          <YAxis width={44} tickFormatter={(v) => Number(v).toLocaleString()} {...axis} />
          <Tooltip content={<DarkTooltip />} />
          <Area
            type="monotone"
            dataKey="cumulative"
            name="Members"
            stroke={CHART_COLORS.club}
            fill={CHART_COLORS.club}
            fillOpacity={0.25}
            strokeWidth={2}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </Box>
  )
}

export function MembersChart({ data }: { data: MemberPoint[] }) {
  return (
    <Box h={`${CHART_HEIGHT}px`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
          <XAxis dataKey="date" tickFormatter={fmtTick} minTickGap={48} {...axis} />
          <YAxis width={44} tickFormatter={(v) => Number(v).toLocaleString()} {...axis} />
          <Tooltip content={<DarkTooltip />} />
          <Line
            type="monotone"
            dataKey="members"
            name="Members"
            stroke={CHART_COLORS.members}
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </Box>
  )
}

export function ActivityChart({ data }: { data: DailyActivity[] }) {
  return (
    <Box h={`${CHART_HEIGHT}px`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
          <XAxis dataKey="date" tickFormatter={fmtTick} minTickGap={32} {...axis} />
          <YAxis width={36} {...axis} />
          <Tooltip content={<DarkTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12, color: CHART_COLORS.axis }} />
          <Area type="monotone" dataKey="messages" name="Messages" stackId="1" stroke={CHART_COLORS.messages} fill={CHART_COLORS.messages} fillOpacity={0.7} strokeWidth={1} dot={false} />
          <Area type="monotone" dataKey="reactions" name="Reactions" stackId="1" stroke={CHART_COLORS.reactions} fill={CHART_COLORS.reactions} fillOpacity={0.7} strokeWidth={1} dot={false} />
          <Area type="monotone" dataKey="voice" name="Voice" stackId="1" stroke={CHART_COLORS.voice} fill={CHART_COLORS.voice} fillOpacity={0.7} strokeWidth={1} dot={false} />
          <Area type="monotone" dataKey="interactions" name="Commands" stackId="1" stroke={CHART_COLORS.interactions} fill={CHART_COLORS.interactions} fillOpacity={0.7} strokeWidth={1} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
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
