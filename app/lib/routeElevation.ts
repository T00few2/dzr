import fs from 'node:fs'
import path from 'node:path'

type Streams = { distance: number[]; altitude: number[]; latlng: number[][] }

const segmentLatLngCache = new Map<string, number[][] | null>()

function streamFile(kind: 'routes' | 'segments', slug: string) {
  return path.join(process.cwd(), 'node_modules', 'zwift-data', 'lib', 'streams', kind, `${slug}.js`)
}

function readNumberArray(source: string, name: string): number[] {
  const marker = `export const ${name} = `
  const start = source.indexOf(marker)
  if (start < 0) return []
  const open = source.indexOf('[', start + marker.length)
  if (open < 0) return []
  let depth = 0
  let end = -1
  for (let index = open; index < source.length; index++) {
    const char = source[index]
    if (char === '[') depth += 1
    else if (char === ']') {
      depth -= 1
      if (depth === 0) {
        end = index
        break
      }
    }
  }
  if (end < 0) return []
  return source
    .slice(open + 1, end)
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map(Number)
    .filter((value) => Number.isFinite(value))
}

function readLatLng(source: string): number[][] {
  const marker = 'export const latlng = '
  const start = source.indexOf(marker)
  if (start < 0) return []
  const open = source.indexOf('[', start + marker.length)
  if (open < 0) return []
  let depth = 0
  let end = -1
  for (let index = open; index < source.length; index++) {
    const char = source[index]
    if (char === '[') depth += 1
    else if (char === ']') {
      depth -= 1
      if (depth === 0) {
        end = index
        break
      }
    }
  }
  if (end < 0) return []
  const points: number[][] = []
  const pairs = source.slice(open, end + 1).matchAll(/\[\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\]/g)
  for (const pair of pairs) points.push([Number(pair[1]), Number(pair[2])])
  return points
}

function readStreamFile(kind: 'routes' | 'segments', slug: string) {
  if (!/^[a-z0-9-]+$/.test(slug)) return ''
  const file = streamFile(kind, slug)
  if (!fs.existsSync(file)) return ''
  return fs.readFileSync(file, 'utf8')
}

export async function elevationForSlug(slug: string): Promise<Streams> {
  const source = readStreamFile('routes', slug)
  if (!source) throw new Error('This route has no elevation profile')
  const distance = readNumberArray(source, 'distance')
  const altitude = readNumberArray(source, 'altitude')
  const latlng = readLatLng(source)
  if (distance.length < 2 || altitude.length !== distance.length) {
    throw new Error('This route has no elevation profile')
  }
  return {
    distance,
    altitude,
    latlng: latlng.length === distance.length ? latlng : [],
  }
}

export function segmentLatLng(slug: string): number[][] | null {
  if (segmentLatLngCache.has(slug)) return segmentLatLngCache.get(slug) || null
  const source = readStreamFile('segments', slug)
  const points = source ? readLatLng(source) : []
  const stored = points.length >= 2 ? points : null
  segmentLatLngCache.set(slug, stored)
  return stored
}
