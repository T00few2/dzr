'use client'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Container, Heading, Stack, Flex, Input, Button, Box, Text, Select, Table, Thead, Tr, Th, Tbody, Td, Checkbox } from '@chakra-ui/react'
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, Label } from 'recharts'

type RiderRow = {
  riderId: number
  name: string
  country?: string
  zpCategory?: string
  racingScore?: number
  veloRating?: number
  max30Rating?: number
  max90Rating?: number
  zpFTP?: number
  phenotype?: string
  weight?: number
  w5?: number; w15?: number; w30?: number; w60?: number; w120?: number; w300?: number; w1200?: number
  wkg5?: number; wkg15?: number; wkg30?: number; wkg60?: number; wkg120?: number; wkg300?: number; wkg1200?: number
  cp?: number
  compoundScore?: number
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
  const [showWkg, setShowWkg] = useState(false)
  const powerChartRef = useRef<HTMLDivElement | null>(null)
  const timeSeriesChartRef = useRef<HTMLDivElement | null>(null)
  const [captainRoles, setCaptainRoles] = useState<{ roleId: string; roleName: string; zwiftIds: string[] }[]>([])
  const [selectedRole, setSelectedRole] = useState<string>('')

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

  useEffect(() => {
    const loadCaptainRoles = async () => {
      try {
        const res = await fetch('/api/stats/captain-roles', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        const roles: { roleId: string; roleName?: string; zwiftIds?: string[] }[] = data?.roles || []
        setCaptainRoles(
          roles.map(r => ({ roleId: String(r.roleId), roleName: r.roleName || String(r.roleId), zwiftIds: Array.isArray(r.zwiftIds) ? r.zwiftIds.map(String) : [] }))
        )
      } catch {}
    }
    loadCaptainRoles()
  }, [])

  const options = useMemo(() => rows.map(r => ({ value: String(r.riderId), label: r.name })), [rows])
  const filteredRows = useMemo(() => {
    if (!selectedRole) return rows
    const role = captainRoles.find(r => r.roleId === selectedRole)
    if (!role) return rows
    const idSet = new Set(role.zwiftIds.map(String))
    return rows.filter(r => idSet.has(String(r.riderId)))
  }, [rows, selectedRole, captainRoles])
  const sortedRows = useMemo(() => {
    const stripTeamTag = (n: string) => n.replace(/\s*\[[^\]]+\]\s*$/, '')
    const normalizeName = (n?: string) =>
      stripTeamTag((n || '').trim())
        .toLocaleLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')

    const arr = [...filteredRows]
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
  }, [filteredRows, sort])

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

  const burstChartData = useMemo(() => {
    const seconds = [5, 15, 30, 60, 120, 300, 1200]
    return seconds.map((sec) => {
      const row: any = { sec }
      selected.forEach(({ id }) => {
        const rider = rows.find(r => String(r.riderId) === id)
        const key = showWkg ? (`wkg${sec}` as keyof RiderRow) : (`w${sec}` as keyof RiderRow)
        const value = rider ? (rider[key] as unknown as number | null | undefined) : null
        row[`r_${id}`] = (typeof value === 'number') ? value : null
      })
      return row
    })
  }, [rows, selected, showWkg])

  const copyChartAsImage = async (container: HTMLDivElement | null, filename: string) => {
    try {
      // Wait a frame to ensure latest render
      await new Promise<void>((r) => requestAnimationFrame(() => r()))
      const svgs = Array.from(container?.querySelectorAll('svg.recharts-surface') || []) as SVGSVGElement[]
      const svg = svgs.length ? svgs[svgs.length - 1] : null
      if (!svg) return
      const clone = svg.cloneNode(true) as SVGSVGElement
      if (!clone.getAttribute('xmlns')) {
        clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
      }
      const bounds = svg.getBoundingClientRect()
      const width = Number(svg.getAttribute('width')) || Math.ceil(bounds.width)
      const height = Number(svg.getAttribute('height')) || Math.ceil(bounds.height)
      clone.setAttribute('width', String(width))
      clone.setAttribute('height', String(height))
      clone.setAttribute('viewBox', `0 0 ${width} ${height}`)
      const xml = new XMLSerializer().serializeToString(clone)
      const svgBlob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(svgBlob)
      const img = new Image()
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = reject
        img.src = url
      })
      const canvas = document.createElement('canvas')
      const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1))
      canvas.width = width * dpr
      canvas.height = height * dpr
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.drawImage(img, 0, 0, width, height)
      URL.revokeObjectURL(url)
      await new Promise<void>((resolve, reject) => {
        canvas.toBlob(async (blob) => {
          if (!blob) return reject(new Error('Failed to create image'))
          const type = 'image/png'
          try {
            const ClipboardItemCtor: any = (window as any).ClipboardItem || (globalThis as any).ClipboardItem
            if (navigator.clipboard && 'write' in navigator.clipboard && ClipboardItemCtor) {
              const item = new ClipboardItemCtor({ [type]: blob })
              await navigator.clipboard.write([item])
              resolve()
              return
            }
          } catch {}
          try {
            const file = new File([blob], filename, { type })
            const navAny: any = navigator as any
            if (navAny.share && navAny.canShare && navAny.canShare({ files: [file] })) {
              await navAny.share({ files: [file], title: 'Chart image' })
              resolve()
              return
            }
          } catch {}
          const a = document.createElement('a')
          a.href = URL.createObjectURL(blob)
          a.download = filename
          document.body.appendChild(a)
          a.click()
          a.remove()
          resolve()
        }, 'image/png')
      })
    } catch {
      // noop
    }
  }

  const powerColors = ['#ad1a2d','#007aff','#10b981','#f59e0b','#8b5cf6','#ef4444','#22c55e']
  const zrsColors = ['#ad1a2d','#007aff','#10b981','#f59e0b']
  const veloColors = ['#6b7280','#8b5cf6','#ef4444','#22c55e']

  

  return (
    <Container maxW={{base:'95vw', sm:'80vw', md:'70vw'}} py={6}>
      <Stack spacing={4}>
        <Heading color='white'>Club Stats</Heading>
        <Text color='white'>Snapshot date: {date ?? '—'}</Text>

        <Flex gap={3} align='center'>
          <Input value={query} onChange={e => setQuery(e.target.value)} placeholder='Search riders by name' bg='white' color='black' width='xs'/>
        </Flex>
        <Flex gap={2} align='center'>
          <Text color='white' fontWeight='bold'>Select team</Text>
          <Select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)} width='sm' bg='white'>
            <option value=''>All riders</option>
            {captainRoles.map((r) => (
              <option key={r.roleId} value={r.roleId}>{r.roleName}</option>
            ))}
          </Select>
        </Flex>

        <Flex justify='space-between' align='center'>
          <Text color='white'>Showing {rows.length} of {total}</Text>
          <Flex gap={2}>
            <Button size='sm' onClick={() => setLimit(prev => prev + 100)} isLoading={loading} background='rgba(88, 101, 242, 0.95)' color='white' _hover={{ background: 'rgba(88, 101, 242, 1)' }}>Load more</Button>
            <Button size='sm' onClick={() => setLimit(10000)} isLoading={loading}>Show all</Button>
          </Flex>
        </Flex>

        <Box border='1px solid' borderColor='whiteAlpha.300' rounded='md' overflowX='auto' maxH='420px' overflowY='auto'>
          <Table size='sm' variant='simple' sx={{ 'th, td': { py: 1, fontSize: 'sm' }, 'thead th': { position: 'sticky', top: 0, zIndex: 1, background: 'black' } }}>
            <Thead>
              <Tr>
                <Th color='white'></Th>
                <Th color='white' cursor='pointer' onClick={() => toggleSort('name')}>Name {sort.key==='name' ? (sort.dir==='asc'?'▲':'▼') : ''}</Th>
                <Th color='white' cursor='pointer' onClick={() => toggleSort('phenotype')}>Phenotype {sort.key==='phenotype' ? (sort.dir==='asc'?'▲':'▼') : ''}</Th>
                <Th color='white' cursor='pointer' onClick={() => toggleSort('racingScore')}>ZRS {sort.key==='racingScore' ? (sort.dir==='asc'?'▲':'▼') : ''}</Th>
                <Th color='white' cursor='pointer' onClick={() => toggleSort('zpCategory')}>ZPG {sort.key==='zpCategory' ? (sort.dir==='asc'?'▲':'▼') : ''}</Th>
                <Th color='white' cursor='pointer' onClick={() => toggleSort('veloRating')}>vELO {sort.key==='veloRating' ? (sort.dir==='asc'?'▲':'▼') : ''}</Th>
                <Th color='white' cursor='pointer' onClick={() => toggleSort('max30Rating')}>vELO 30 {sort.key==='max30Rating' ? (sort.dir==='asc'?'▲':'▼') : ''}</Th>
                <Th color='white' cursor='pointer' onClick={() => toggleSort('max90Rating')}>vELO 90 {sort.key==='max90Rating' ? (sort.dir==='asc'?'▲':'▼') : ''}</Th>
                <Th color='white' cursor='pointer' onClick={() => toggleSort('zpFTP')}>zFTP {sort.key==='zpFTP' ? (sort.dir==='asc'?'▲':'▼') : ''}</Th>
                <Th color='white' cursor='pointer' onClick={() => toggleSort('cp')}>CP {sort.key==='cp' ? (sort.dir==='asc'?'▲':'▼') : ''}</Th>
                <Th color='white' cursor='pointer' onClick={() => toggleSort('compoundScore')}>CS {sort.key==='compoundScore' ? (sort.dir==='asc'?'▲':'▼') : ''}</Th>
                <Th color='white' cursor='pointer' onClick={() => toggleSort('w5')}>w5 {sort.key==='w5' ? (sort.dir==='asc'?'▲':'▼') : ''}</Th>
                <Th color='white' cursor='pointer' onClick={() => toggleSort('w15')}>w15 {sort.key==='w15' ? (sort.dir==='asc'?'▲':'▼') : ''}</Th>
                <Th color='white' cursor='pointer' onClick={() => toggleSort('w30')}>w30 {sort.key==='w30' ? (sort.dir==='asc'?'▲':'▼') : ''}</Th>
                <Th color='white' cursor='pointer' onClick={() => toggleSort('w60')}>w60 {sort.key==='w60' ? (sort.dir==='asc'?'▲':'▼') : ''}</Th>
                <Th color='white' cursor='pointer' onClick={() => toggleSort('w120')}>w120 {sort.key==='w120' ? (sort.dir==='asc'?'▲':'▼') : ''}</Th>
                <Th color='white' cursor='pointer' onClick={() => toggleSort('w300')}>w300 {sort.key==='w300' ? (sort.dir==='asc'?'▲':'▼') : ''}</Th>
                <Th color='white' cursor='pointer' onClick={() => toggleSort('w1200')}>w1200 {sort.key==='w1200' ? (sort.dir==='asc'?'▲':'▼') : ''}</Th>
                <Th color='white' cursor='pointer' onClick={() => toggleSort('wkg5')}>WKG5 {sort.key==='wkg5' ? (sort.dir==='asc'?'▲':'▼') : ''}</Th>
                <Th color='white' cursor='pointer' onClick={() => toggleSort('wkg15')}>WKG15 {sort.key==='wkg15' ? (sort.dir==='asc'?'▲':'▼') : ''}</Th>
                <Th color='white' cursor='pointer' onClick={() => toggleSort('wkg30')}>WKG30 {sort.key==='wkg30' ? (sort.dir==='asc'?'▲':'▼') : ''}</Th>
                <Th color='white' cursor='pointer' onClick={() => toggleSort('wkg60')}>WKG60 {sort.key==='wkg60' ? (sort.dir==='asc'?'▲':'▼') : ''}</Th>
                <Th color='white' cursor='pointer' onClick={() => toggleSort('wkg120')}>WKG120 {sort.key==='wkg120' ? (sort.dir==='asc'?'▲':'▼') : ''}</Th>
                <Th color='white' cursor='pointer' onClick={() => toggleSort('wkg300')}>WKG300 {sort.key==='wkg300' ? (sort.dir==='asc'?'▲':'▼') : ''}</Th>
                <Th color='white' cursor='pointer' onClick={() => toggleSort('wkg1200')}>WKG1200 {sort.key==='wkg1200' ? (sort.dir==='asc'?'▲':'▼') : ''}</Th>
                <Th color='white' cursor='pointer' onClick={() => toggleSort('weight')}>Weight {sort.key==='weight' ? (sort.dir==='asc'?'▲':'▼') : ''}</Th>
              </Tr>
            </Thead>
            <Tbody>
              {sortedRows.map(r => (
                <Tr key={r.riderId}>
                  <Td>
                    <Button size='xs' onClick={() => setSelected(prev => prev.some(s => s.id === String(r.riderId)) ? prev : [...prev, { id: String(r.riderId), name: r.name }])}>Add</Button>
                  </Td>
                  <Td color='white'>{r.name}</Td>
                  <Td color='white'>{r.phenotype ?? '—'}</Td>
                  <Td color='white'>{r.racingScore != null ? Math.round(r.racingScore) : '—'}</Td>
                  <Td color='white'>{r.zpCategory ?? '—'}</Td>
                  <Td color='white'>{r.veloRating != null ? Math.round(r.veloRating) : '—'}</Td>
                  <Td color='white'>{r.max30Rating != null ? Math.round(r.max30Rating) : '—'}</Td>
                  <Td color='white'>{r.max90Rating != null ? Math.round(r.max90Rating) : '—'}</Td>
                  <Td color='white'>{r.zpFTP != null ? Math.round(r.zpFTP) : '—'}</Td>
                  <Td color='white'>{r.cp != null ? Math.round(r.cp) : '—'}</Td>
                  <Td color='white'>{r.compoundScore != null ? Math.round(r.compoundScore) : '—'}</Td>
                  <Td color='white'>{r.w5 ?? '—'}</Td>
                  <Td color='white'>{r.w15 ?? '—'}</Td>
                  <Td color='white'>{r.w30 ?? '—'}</Td>
                  <Td color='white'>{r.w60 ?? '—'}</Td>
                  <Td color='white'>{r.w120 ?? '—'}</Td>
                  <Td color='white'>{r.w300 ?? '—'}</Td>
                  <Td color='white'>{r.w1200 ?? '—'}</Td>
                  <Td color='white'>{r.wkg5 != null ? r.wkg5.toFixed(2) : '—'}</Td>
                  <Td color='white'>{r.wkg15 != null ? r.wkg15.toFixed(2) : '—'}</Td>
                  <Td color='white'>{r.wkg30 != null ? r.wkg30.toFixed(2) : '—'}</Td>
                  <Td color='white'>{r.wkg60 != null ? r.wkg60.toFixed(2) : '—'}</Td>
                  <Td color='white'>{r.wkg120 != null ? r.wkg120.toFixed(2) : '—'}</Td>
                  <Td color='white'>{r.wkg300 != null ? r.wkg300.toFixed(2) : '—'}</Td>
                  <Td color='white'>{r.wkg1200 != null ? r.wkg1200.toFixed(2) : '—'}</Td>
                  <Td color='white'>{r.weight ?? '—'}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
        
        <Text color='white'>Selected: {selected.map(s => s.name).join(', ') || 'none'}</Text>
        <Flex>
          <Button size='sm' onClick={() => { setSelected([]); setSeries({}); }} background='rgba(88, 101, 242, 0.95)' color='white' _hover={{ background: 'rgba(88, 101, 242, 1)' }}>Clear</Button>
        </Flex>

        {selected.length > 0 && (
          <Stack spacing={2}>
            <Flex gap={3} align='center'>
              <Text color='white' fontWeight='bold'>Power Graph</Text>
              <Checkbox isChecked={showWkg} onChange={(e) => setShowWkg(e.target.checked)} color='white'>W/kg</Checkbox>
            </Flex>
            <Box ref={powerChartRef} height='300px' bg='white' p={2} rounded='md'>
              <ResponsiveContainer width='100%' height='100%'>
                <LineChart data={burstChartData} margin={{ top: 18, right: 20, left: 0, bottom: 0 }}>
                  <text x='50%' y={12} textAnchor='middle' dominantBaseline='middle' fontSize='12' fill='#374151'>Power Graph</text>
                  <CartesianGrid stroke='#eee' strokeDasharray='5 5' />
                  <XAxis dataKey='sec' tickFormatter={(v) => `${v}s`} tick={{ fontSize: 12 }}>
                    <Label value='Seconds' position='insideBottom' offset={-5} />
                  </XAxis>
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v: number) => showWkg ? v.toFixed(2) : `${v}`}>
                    <Label value={showWkg ? 'W/kg' : 'Watts'} angle={-90} position='insideLeft' />
                  </YAxis>
                  <Tooltip formatter={(val: any) => showWkg ? (typeof val === 'number' ? val.toFixed(2) : val) : val} labelFormatter={(l: any) => `${l}s`} />
                  {selected.map(({ id, name }, idx) => (
                    <Line key={`burst_${id}`} type='monotone' dataKey={`r_${id}`} name={name} stroke={powerColors[idx % powerColors.length]} dot={{ r: 2 }} />
                  ))}
                  {selected.map(({ name }, idx) => (
                    <g key={`burst_legend_${idx}`}>
                      <line x1={8} y1={26 + idx * 14} x2={22} y2={26 + idx * 14} stroke={powerColors[idx % powerColors.length]} strokeWidth={3} />
                      <text x={28} y={26 + idx * 14 + 3} fontSize='12' fill='#374151'>{name}</text>
                    </g>
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </Box>
            <Flex justify='flex-end' gap={2}>
              <Button size='xs' mt={1} onClick={() => copyChartAsImage(powerChartRef.current, 'power-graph.png')} background='rgba(88, 101, 242, 0.95)' color='white' _hover={{ background: 'rgba(88, 101, 242, 1)' }}>Copy image</Button>
            </Flex>
          </Stack>
        )}
        {selected.length === 0 && (
          <Stack spacing={2}>
            <Flex gap={3} align='center'>
              <Text color='white' fontWeight='bold'>Power Graph</Text>
            </Flex>
            <Box height='120px' border='1px dashed' borderColor='whiteAlpha.400' rounded='md' display='flex' alignItems='center' justifyContent='center'>
              <Text color='whiteAlpha.800'>Select riders in the table to see burst power (W/Wkg) across 5–1200s.</Text>
            </Box>
          </Stack>
        )}

        <Stack spacing={2}>
          <Text color='white' fontWeight='bold'>Time Series Graph</Text>
          <Flex gap={3} align='center' wrap='wrap'>
            <Select value={range} onChange={e => setRange(e.target.value)} width='xs' bg='white'>
              <option value='7'>Last 7 days</option>
              <option value='30'>Last 30 days</option>
              <option value='90'>Last 90 days</option>
            </Select>
            <Button onClick={loadCompare} isDisabled={selected.length === 0}>Load time series</Button>
            <Flex gap={3} align='center'>
              <Checkbox isChecked={showVelo} onChange={(e) => setShowVelo(e.target.checked)} color='white'>vELO</Checkbox>
              <Checkbox isChecked={showZrs} onChange={(e) => setShowZrs(e.target.checked)} color='white'>ZRS</Checkbox>
            </Flex>
          </Flex>
          {selected.length === 0 && (
            <Box height='120px' border='1px dashed' borderColor='whiteAlpha.400' rounded='md' display='flex' alignItems='center' justifyContent='center'>
              <Text color='whiteAlpha.800'>Select riders in the table and click Load time series to see ZRS and vELO over time.</Text>
            </Box>
          )}
        </Stack>

        {Object.keys(series).length > 0 && (
          <Box ref={timeSeriesChartRef} height='360px' bg='white' p={2} rounded='md'>
            <ResponsiveContainer width='100%' height='100%'>
              <LineChart data={chartData} margin={{ top: 18, right: 20, left: 0, bottom: 0 }}>
                <text x='50%' y={12} textAnchor='middle' dominantBaseline='middle' fontSize='12' fill='#374151'>Time Series Graph</text>
                <CartesianGrid stroke='#eee' strokeDasharray='5 5' />
                <XAxis dataKey='date' tick={{ fontSize: 12 }}>
                  <Label value='Date' position='insideBottom' offset={-5} />
                </XAxis>
                <YAxis yAxisId='left' tick={{ fontSize: 12 }}>
                  <Label value='ZRS' angle={-90} position='insideLeft' />
                </YAxis>
                <YAxis yAxisId='right' orientation='right' tick={{ fontSize: 12 }}>
                  <Label value='vELO' angle={90} position='insideRight' />
                </YAxis>
                <Tooltip />
                {showZrs && selected.map(({ id, name }, idx) => (
                  <Line key={`zrs_${id}`} yAxisId='left' type='monotone' dataKey={`zrs_${id}`} name={`ZRS ${name}`} stroke={['#ad1a2d','#007aff','#10b981','#f59e0b'][idx % 4]} dot={false} />
                ))}
                {showVelo && selected.map(({ id, name }, idx) => (
                  <Line key={`velo_${id}`} yAxisId='right' type='monotone' dataKey={`velo_${id}`} name={`vELO ${name}`} stroke={['#6b7280','#8b5cf6','#ef4444','#22c55e'][idx % 4]} dot={false} strokeDasharray='4 4' />
                ))}
                {selected.map(({ name }, idx) => (
                  <g key={`ts_legend_${idx}`}>
                    {showZrs && (
                      <>
                        <line x1={8} y1={26 + idx * 16} x2={22} y2={26 + idx * 16} stroke={zrsColors[idx % zrsColors.length]} strokeWidth={3} />
                      </>
                    )}
                    {showVelo && (
                      <>
                        <line x1={24} y1={26 + idx * 16} x2={38} y2={26 + idx * 16} stroke={veloColors[idx % veloColors.length]} strokeWidth={3} strokeDasharray='4 4' />
                      </>
                    )}
                    <text x={showVelo ? 44 : 28} y={26 + idx * 16 + 3} fontSize='12' fill='#374151'>{name}</text>
                  </g>
                ))}
              </LineChart>
            </ResponsiveContainer>
          </Box>
        )}
        {Object.keys(series).length > 0 && (
          <Flex justify='flex-end' gap={2}>
            <Button size='xs' mt={1} onClick={() => copyChartAsImage(timeSeriesChartRef.current, 'time-series-graph.png')} background='rgba(88, 101, 242, 0.95)' color='white' _hover={{ background: 'rgba(88, 101, 242, 1)' }}>Copy image</Button>
          </Flex>
        )}
      </Stack>
    </Container>
  )
}


