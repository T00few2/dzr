'use client'

import { useCallback, useEffect, useState } from 'react'
import AdminShell from '@/components/admin/AdminShell'
import ChartCard from '@/components/admin/stats/ChartCard'
import KpiCard from '@/components/admin/stats/KpiCard'
import PeriodToggle, { periodLabel, sliceSeries } from '@/components/admin/stats/PeriodToggle'
import RankingTable from '@/components/admin/stats/RankingTable'
import { ActivityChart, BreakdownDonut, GrowthChart, MembersChart, type GrowthChartPoint } from '@/components/admin/stats/charts'
import type { GrowthResponse, PeriodDays, StatsResponse } from '@/components/admin/stats/types'
import { Box, Button, Flex, HStack, SimpleGrid, Text, useToast } from '@chakra-ui/react'

function fmt(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return '—'
  return Number(n).toLocaleString()
}

function fmtDay(iso: string | null | undefined) {
  if (!iso) return '—'
  const d = new Date(`${iso}T00:00:00.000Z`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function mergeGrowthSeries(
  zwift: { day: string; cumulative: number }[],
  zwiftpower: { day: string; cumulative: number }[],
): GrowthChartPoint[] {
  const zpByDay = new Map(zwiftpower.map((p) => [p.day, p.cumulative]))
  const days = [...new Set([...zwift.map((p) => p.day), ...zwiftpower.map((p) => p.day)])].sort()
  const zwiftByDay = new Map(zwift.map((p) => [p.day, p.cumulative]))
  let lastZp: number | null = null
  let lastZwift: number | null = null
  return days.map((day) => {
    if (zwiftByDay.has(day)) lastZwift = zwiftByDay.get(day) ?? null
    if (zpByDay.has(day)) lastZp = zpByDay.get(day) ?? null
    return { day, zwift: lastZwift, zwiftpower: lastZp }
  })
}

export default function StatsAdminPage() {
  const toast = useToast()
  const [growthDays, setGrowthDays] = useState<PeriodDays>('all')
  const [memberDays, setMemberDays] = useState<PeriodDays>('all')
  const [days, setDays] = useState<PeriodDays>(30)
  const [growth, setGrowth] = useState<GrowthResponse | null>(null)
  const [stats, setStats] = useState<StatsResponse | null>(null)
  const [growthError, setGrowthError] = useState<string | null>(null)
  const [statsError, setStatsError] = useState<string | null>(null)
  const [loadingGrowth, setLoadingGrowth] = useState(true)
  const [loadingStats, setLoadingStats] = useState(true)
  const [busy, setBusy] = useState(false)

  const loadGrowth = useCallback(async () => {
    setLoadingGrowth(true)
    setGrowthError(null)
    try {
      const res = await fetch('/api/admin/growth', { cache: 'no-store' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Failed to load club growth')
      setGrowth(body)
    } catch (err: any) {
      setGrowthError(err?.message || 'Failed to load club growth')
    } finally {
      setLoadingGrowth(false)
    }
  }, [])

  const loadStats = useCallback(async (windowDays: PeriodDays) => {
    setLoadingStats(true)
    setStatsError(null)
    try {
      const res = await fetch(`/api/admin/stats?days=${windowDays}`, { cache: 'no-store' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Failed to load Discord stats')
      setStats(body)
    } catch (err: any) {
      setStatsError(err?.message || 'Failed to load Discord stats')
    } finally {
      setLoadingStats(false)
    }
  }, [])

  useEffect(() => { loadGrowth().catch(() => {}) }, [loadGrowth])
  useEffect(() => { loadStats(days).catch(() => {}) }, [days, loadStats])

  async function refresh(kind: 'zwift' | 'zwiftpower') {
    setBusy(true)
    const res = await fetch(`/api/admin/growth?kind=${kind}`, { method: 'POST' })
    const body = await res.json().catch(() => ({}))
    setBusy(false)
    toast({ title: res.ok ? 'Refresh started' : (body.error || 'Failed'), status: res.ok ? 'success' : 'error' })
    if (res.ok) loadGrowth()
  }

  const totals = stats?.totals
  const hasActivity = (totals?.messages || 0) + (totals?.reactions || 0) + (totals?.voice || 0) + (totals?.interactions || 0) > 0
  const memberSeries = sliceSeries(stats?.members?.series || [], (p) => p.date, memberDays)
  const latestMembers = stats?.members?.latest
  const growthChart = sliceSeries(
    mergeGrowthSeries(growth?.series || [], growth?.zwiftpower?.series || []),
    (p) => p.day,
    growthDays,
  )
  const zpTotal = growth?.zwiftpower?.total
  const clubRoleCount = latestMembers?.clubMembers

  return (
    <AdminShell title="Stats">
      {(growthError || statsError) && (
        <Text color="red.300" mb={4} fontSize="sm">
          {[growthError, statsError].filter(Boolean).join(' · ')}
        </Text>
      )}

      <SimpleGrid columns={{ base: 2, lg: 4 }} spacing={4} mb={4}>
        <KpiCard
          label="Club members"
          value={fmt(growth?.total)}
          helper={[
            zpTotal != null ? `ZwiftPower ${fmt(zpTotal)}${growth?.zwiftpower?.estimated ? ' (est.)' : ''}` : null,
            growth?.firstJoinDate ? `First join ${fmtDay(growth.firstJoinDate)}` : null,
          ].filter(Boolean).join(' · ') || 'Companion club roster'}
          loading={loadingGrowth && !growth}
        />
        <KpiCard
          label="Discord members"
          value={fmt(latestMembers?.members)}
          helper={[
            latestMembers?.presence != null ? `${fmt(latestMembers.presence)} online` : null,
            clubRoleCount != null ? `${fmt(clubRoleCount)} club member role` : null,
          ].filter(Boolean).join(' · ') || (latestMembers?.date ? `Snapshot ${fmtDay(latestMembers.date)}` : 'Server member count')}
          loading={loadingStats && !stats}
        />
        <KpiCard
          label="Messages"
          value={fmt(totals?.messages)}
          helper={`${fmt(totals?.avgDailyMessages)} / day · ${periodLabel(days)}`}
          loading={loadingStats && !stats}
        />
        <KpiCard
          label="Active users"
          value={fmt(totals?.uniqueUsers)}
          helper={`${fmt(totals?.uniqueChannels)} channels · ${fmt(totals?.interactions)} commands`}
          loading={loadingStats && !stats}
        />
      </SimpleGrid>

      <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={4} mb={4}>
        <ChartCard
          title="Club growth"
          loading={loadingGrowth && !growth}
          isEmpty={!growthChart.length}
          empty="No companion club members yet. Refresh the Zwift roster to sync."
          actions={(
            <HStack spacing={2} flexWrap="wrap" justify="flex-end">
              <PeriodToggle value={growthDays} onChange={setGrowthDays} />
              <Button size="xs" colorScheme="red" onClick={() => refresh('zwift')} isLoading={busy}>Refresh Zwift</Button>
              <Button
                size="xs"
                colorScheme="red"
                variant="outline"
                borderColor="red.400"
                color="red.200"
                _hover={{ bg: 'whiteAlpha.100', borderColor: 'red.300', color: 'red.100' }}
                onClick={() => refresh('zwiftpower')}
                isLoading={busy}
              >
                Refresh ZwiftPower
              </Button>
            </HStack>
          )}
        >
          <GrowthChart data={growthChart} />
        </ChartCard>
        <ChartCard
          title="Discord members"
          loading={loadingStats && !stats}
          isEmpty={memberSeries.length < 1}
          empty="No member snapshots yet. Open this page again later to start the series."
          actions={<PeriodToggle value={memberDays} onChange={setMemberDays} />}
        >
          <MembersChart data={memberSeries} />
        </ChartCard>
      </SimpleGrid>

      <Flex gap={4} direction={{ base: 'column', lg: 'row' }} mb={4}>
        <Box flex="2">
          <ChartCard
            title="Discord activity"
            loading={loadingStats && !stats}
            isEmpty={!hasActivity}
            empty="No activity in this window"
            actions={<PeriodToggle value={days} onChange={setDays} />}
          >
            <ActivityChart data={stats?.daily || []} />
          </ChartCard>
        </Box>
        <Box flex="1">
          <ChartCard
            title="Breakdown"
            loading={loadingStats && !stats}
            isEmpty={!hasActivity}
            empty="No activity in this window"
            actions={<PeriodToggle value={days} onChange={setDays} />}
          >
            <BreakdownDonut
              messages={totals?.messages || 0}
              reactions={totals?.reactions || 0}
              voice={totals?.voice || 0}
              interactions={totals?.interactions || 0}
            />
          </ChartCard>
        </Box>
      </Flex>

      <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={4}>
        <RankingTable
          title="Top users"
          loading={loadingStats && !stats}
          empty="No active users in this window"
          actions={<PeriodToggle value={days} onChange={setDays} />}
          rows={(stats?.topUsers || []).map((u) => ({
            id: u.user_id,
            name: u.username || u.user_id,
            total: u.total,
            detail: `${fmt(u.messages)} msg · ${fmt(u.reactions)} rxn`,
          }))}
        />
        <RankingTable
          title="Top channels"
          loading={loadingStats && !stats}
          empty="No channel activity in this window"
          actions={<PeriodToggle value={days} onChange={setDays} />}
          rows={(stats?.topChannels || []).map((c) => ({
            id: c.channel_id,
            name: c.channel_name ? `#${c.channel_name}` : c.channel_id,
            total: c.total,
            detail: `${fmt(c.messages)} msg · ${fmt(c.reactions)} rxn`,
          }))}
        />
      </SimpleGrid>
    </AdminShell>
  )
}
