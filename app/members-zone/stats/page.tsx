'use client'
import React, { useEffect, useMemo, useState } from 'react'
import { Container, Heading, Stack, Flex, Input, Button, Box, Text, Select, Table, Thead, Tr, Th, Tbody, Td, Checkbox } from '@chakra-ui/react'
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts'

type RiderRow = {
  riderId: number
  name: string
  country?: string
  zpCategory?: string
  racingScore?: number
  veloRating?: number
  max30Rating?: number
  max90Rating?: number
  phenotype?: string
  weight?: number
}

export default function StatsPage() {
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState<RiderRow[]>([])
  const [date, setDate] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [limit, setLimit] = useState(100)
  const [total, setTotal] = useState(0)

  const [selected, setSelected] = useState<{ id: string; name: string }[]>([])
  const [range, setRange] = useState('30')
  const [series, setSeries] = useState<Record<string, { date: string; racingScore: number | null; veloRating: number | null }[]>>({})
  const [showVelo, setShowVelo] = useState(true)
  const [showZrs, setShowZrs] = useState(true)
  const [sort, setSort] = useState<{ key: keyof RiderRow; dir: 'asc' | 'desc' }>({ key: 'name', dir: 'asc' })

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const res = await fetch(`/api/stats/riders?search=${encodeURIComponent(query)}&limit=${limit}`)
      const data = await res.json()
      setRows(data?.items || [])
      setDate(data?.date || null)
      setTotal(data?.total || 0)
      setLoading(false)
    }
    load()
  }, [query, limit])

  const options = useMemo(() => rows.map(r => ({ value: String(r.riderId), label: r.name })), [rows])
  const sortedRows = useMemo(() => {
    const stripTeamTag = (n: string) => n.replace(/\s*\[[^\]]+\]\s*$/, '')
    const normalizeName = (n?: string) =>
      stripTeamTag((n || '').trim())
        .toLocaleLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')

    const arr = [...rows]
    arr.sort((a, b) => {
      let cmp = 0
      if (sort.key === 'name') {
        const an = normalizeName(a.name)
        const bn = normalizeName(b.name)
        if (!an && !bn) cmp = 0
        else if (!an) cmp = 1
        else if (!bn) cmp = -1
        else cmp = an.localeCompare(bn, 'en', { sensitivity: 'base' })
        if (cmp === 0) {
          // Tiebreaker by riderId
          cmp = (a.riderId ?? 0) - (b.riderId ?? 0)
        }
      } else if (sort.key === 'zpCategory' || sort.key === 'phenotype') {
        const av = (a[sort.key] || '').toString().toLowerCase()
        const bv = (b[sort.key] || '').toString().toLowerCase()
        cmp = av.localeCompare(bv)
        if (cmp === 0) cmp = (a.riderId ?? 0) - (b.riderId ?? 0)
      } else {
        const avRaw = a[sort.key] as unknown as number | undefined | null
        const bvRaw = b[sort.key] as unknown as number | undefined | null
        const avNull = avRaw === null || avRaw === undefined || Number.isNaN(avRaw as number)
        const bvNull = bvRaw === null || bvRaw === undefined || Number.isNaN(bvRaw as number)
        if (avNull && bvNull) cmp = 0
        else if (avNull) cmp = 1 // nulls last
        else if (bvNull) cmp = -1
        else cmp = (avRaw as number) === (bvRaw as number) ? 0 : (avRaw as number) < (bvRaw as number) ? -1 : 1
        if (cmp === 0) cmp = (a.riderId ?? 0) - (b.riderId ?? 0)
      }
      return sort.dir === 'asc' ? cmp : -cmp
    })
    return arr
  }, [rows, sort])

  const toggleSort = (key: keyof RiderRow) => {
    setSort(prev => ({ key, dir: prev.key === key ? (prev.dir === 'asc' ? 'desc' : 'asc') : 'asc' }))
  }

  const loadCompare = async () => {
    if (selected.length === 0) return
    const res = await fetch(`/api/stats/compare?riderIds=${selected.map(s => s.id).join(',')}&range=${range}`)
    const data = await res.json()
    setSeries(data?.series || {})
  }

  const chartData = useMemo(() => {
    // Build a unified x-axis of dates from the first series
    const firstKey = Object.keys(series)[0]
    const base = firstKey ? series[firstKey] : []
    return base.map((p, idx) => {
      const row: any = { date: p.date }
      Object.entries(series).forEach(([rid, arr]) => {
        const point = arr[idx]
        row[`zrs_${rid}`] = point?.racingScore ?? null
        row[`velo_${rid}`] = point?.veloRating ?? null
      })
      return row
    })
  }, [series])

  return (
    <Container maxW={{base:'95vw', sm:'80vw', md:'70vw'}} py={6}>
      <Stack spacing={4}>
        <Heading color='white'>Club Stats</Heading>
        <Text color='white'>Snapshot date: {date ?? '—'}</Text>

        <Flex gap={3} align='center'>
          <Input value={query} onChange={e => setQuery(e.target.value)} placeholder='Search riders by name' bg='white' color='black' width='xs'/>
        </Flex>

        <Flex justify='space-between' align='center'>
          <Text color='white'>Showing {rows.length} of {total}</Text>
          <Flex gap={2}>
            <Button size='sm' onClick={() => setLimit(prev => prev + 100)} isLoading={loading} variant='outline'>Load more</Button>
            <Button size='sm' onClick={() => setLimit(10000)} isLoading={loading}>Show all</Button>
          </Flex>
        </Flex>

        <Box border='1px solid' borderColor='whiteAlpha.300' rounded='md' overflowX='auto' maxH='420px' overflowY='auto'>
          <Table size='sm' variant='simple' sx={{ 'th, td': { py: 1, fontSize: 'sm' } }}>
            <Thead>
              <Tr>
                <Th color='white' cursor='pointer' onClick={() => toggleSort('name')}>Name {sort.key==='name' ? (sort.dir==='asc'?'▲':'▼') : ''}</Th>
                <Th color='white' cursor='pointer' onClick={() => toggleSort('zpCategory')}>ZP {sort.key==='zpCategory' ? (sort.dir==='asc'?'▲':'▼') : ''}</Th>
                <Th color='white' cursor='pointer' onClick={() => toggleSort('veloRating')}>vELO {sort.key==='veloRating' ? (sort.dir==='asc'?'▲':'▼') : ''}</Th>
                <Th color='white' cursor='pointer' onClick={() => toggleSort('max30Rating')}>max30 {sort.key==='max30Rating' ? (sort.dir==='asc'?'▲':'▼') : ''}</Th>
                <Th color='white' cursor='pointer' onClick={() => toggleSort('max90Rating')}>max90 {sort.key==='max90Rating' ? (sort.dir==='asc'?'▲':'▼') : ''}</Th>
                <Th color='white' cursor='pointer' onClick={() => toggleSort('racingScore')}>ZRS {sort.key==='racingScore' ? (sort.dir==='asc'?'▲':'▼') : ''}</Th>
                <Th color='white' cursor='pointer' onClick={() => toggleSort('phenotype')}>Phenotype {sort.key==='phenotype' ? (sort.dir==='asc'?'▲':'▼') : ''}</Th>
                <Th color='white' cursor='pointer' onClick={() => toggleSort('weight')}>Weight {sort.key==='weight' ? (sort.dir==='asc'?'▲':'▼') : ''}</Th>
                <Th color='white'></Th>
              </Tr>
            </Thead>
            <Tbody>
              {sortedRows.map(r => (
                <Tr key={r.riderId}>
                  <Td color='white'>{r.name}</Td>
                  <Td color='white'>{r.zpCategory ?? '—'}</Td>
                  <Td color='white'>{r.veloRating != null ? Math.round(r.veloRating) : '—'}</Td>
                  <Td color='white'>{r.max30Rating != null ? Math.round(r.max30Rating) : '—'}</Td>
                  <Td color='white'>{r.max90Rating != null ? Math.round(r.max90Rating) : '—'}</Td>
                  <Td color='white'>{r.racingScore != null ? Math.round(r.racingScore) : '—'}</Td>
                  <Td color='white'>{r.phenotype ?? '—'}</Td>
                  <Td color='white'>{r.weight ?? '—'}</Td>
                  <Td>
                    <Button size='xs' onClick={() => setSelected(prev => prev.some(s => s.id === String(r.riderId)) ? prev : [...prev, { id: String(r.riderId), name: r.name }])}>Add</Button>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
        

        <Flex gap={3} align='center' wrap='wrap'>
          <Text color='white'>Selected: {selected.map(s => s.name).join(', ') || 'none'}</Text>
          <Select value={range} onChange={e => setRange(e.target.value)} width='xs' bg='white'>
            <option value='7'>Last 7 days</option>
            <option value='30'>Last 30 days</option>
            <option value='90'>Last 90 days</option>
          </Select>
          <Button onClick={loadCompare} isDisabled={selected.length === 0}>Load compare</Button>
          <Button variant='ghost' onClick={() => { setSelected([]); setSeries({}); }}>Clear</Button>
          <Flex gap={3} align='center'>
            <Checkbox isChecked={showVelo} onChange={(e) => setShowVelo(e.target.checked)} color='white'>vELO</Checkbox>
            <Checkbox isChecked={showZrs} onChange={(e) => setShowZrs(e.target.checked)} color='white'>ZRS</Checkbox>
          </Flex>
        </Flex>

        {Object.keys(series).length > 0 && (
          <Box height='360px' bg='white' p={2} rounded='md'>
            <ResponsiveContainer width='100%' height='100%'>
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid stroke='#eee' strokeDasharray='5 5' />
                <XAxis dataKey='date' tick={{ fontSize: 12 }}/>
                <YAxis yAxisId='left' tick={{ fontSize: 12 }}/>
                <YAxis yAxisId='right' orientation='right' tick={{ fontSize: 12 }}/>
                <Tooltip />
                <Legend />
                {showZrs && selected.map(({ id, name }, idx) => (
                  <Line key={`zrs_${id}`} yAxisId='left' type='monotone' dataKey={`zrs_${id}`} name={`ZRS ${name}`} stroke={['#ad1a2d','#007aff','#10b981','#f59e0b'][idx % 4]} dot={false} />
                ))}
                {showVelo && selected.map(({ id, name }, idx) => (
                  <Line key={`velo_${id}`} yAxisId='right' type='monotone' dataKey={`velo_${id}`} name={`vELO ${name}`} stroke={['#6b7280','#8b5cf6','#ef4444','#22c55e'][idx % 4]} dot={false} strokeDasharray='4 4' />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </Box>
        )}
      </Stack>
    </Container>
  )
}


