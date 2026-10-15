import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

type Streams = { distance: number[]; altitude: number[] }

const loadModule = new Function('href', 'return import(href)') as (href: string) => Promise<Streams>

export async function elevationForSlug(slug: string): Promise<Streams> {
  if (!/^[a-z0-9-]+$/.test(slug)) throw new Error('This route has no elevation profile')
  const file = path.join(process.cwd(), 'node_modules', 'zwift-data', 'lib', 'streams', 'routes', `${slug}.js`)
  if (!fs.existsSync(file)) throw new Error('This route has no elevation profile')
  const mod = await loadModule(pathToFileURL(file).href)
  const distance = Array.isArray(mod.distance) ? mod.distance.map(Number) : []
  const altitude = Array.isArray(mod.altitude) ? mod.altitude.map(Number) : []
  if (distance.length < 2 || altitude.length !== distance.length) {
    throw new Error('This route has no elevation profile')
  }
  return { distance, altitude }
}
