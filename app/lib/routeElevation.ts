import fs from 'node:fs'
import path from 'node:path'

type Streams = { distance: number[]; altitude: number[] }

function streamFile(slug: string) {
  return path.join(process.cwd(), 'node_modules', 'zwift-data', 'lib', 'streams', 'routes', `${slug}.js`)
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

export async function elevationForSlug(slug: string): Promise<Streams> {
  if (!/^[a-z0-9-]+$/.test(slug)) throw new Error('This route has no elevation profile')
  const file = streamFile(slug)
  if (!fs.existsSync(file)) throw new Error('This route has no elevation profile')
  const source = fs.readFileSync(file, 'utf8')
  const distance = readNumberArray(source, 'distance')
  const altitude = readNumberArray(source, 'altitude')
  if (distance.length < 2 || altitude.length !== distance.length) {
    throw new Error('This route has no elevation profile')
  }
  return { distance, altitude }
}
