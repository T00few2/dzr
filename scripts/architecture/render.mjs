// Generate derived previews; Mermaid fences remain the editable source.
import fs from 'node:fs/promises'
import path from 'node:path'
import http from 'node:http'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { chromium } from 'playwright-core'
const root = fileURLToPath(new URL('../../', import.meta.url))
const docs = path.join(root, 'docs/architecture')
const dist = path.join(root, 'scripts/architecture/node_modules/mermaid/dist')
const server = http.createServer(async (req, res) => {
  try {
    if (req.url === '/') { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><html><body></body></html>'); return }
    const file = path.resolve(dist, decodeURIComponent(req.url.slice(1)))
    if (!file.startsWith(dist + path.sep)) throw new Error('Invalid asset path')
    res.setHeader('Content-Type', 'text/javascript')
    res.end(await fs.readFile(file))
  } catch { res.statusCode = 404; res.end() }
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
let browser
try {
  browser = await chromium.launch({ executablePath: process.env.ARCHITECTURE_CHROMIUM || '/usr/bin/chromium', args: ['--no-sandbox'] })
  const page = await browser.newPage()
  await page.goto(`http://127.0.0.1:${server.address().port}/`)
  await page.evaluate(async () => {
    const { default: mermaid } = await import('/mermaid.esm.min.mjs')
    window.mermaid = mermaid
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'base' })
  })
  await fs.mkdir(path.join(docs, 'generated'), { recursive: true })
  let count = 0
  for (const name of (await fs.readdir(docs)).filter(name => name.endsWith('.md') && !name.startsWith('.')).sort()) {
    const source = await fs.readFile(path.join(docs, name), 'utf8')
    let index = 0
    for (const match of source.matchAll(/```(mermaid|text)\n([\s\S]*?)\n```/g)) {
      if (match[1] === 'text' && !/^sequenceDiagram\s*$/m.test(match[2])) continue
      index++; count++
      const hash = createHash('sha256').update(match[2]).digest('hex')
      const svg = await page.evaluate(async ({ text, id, hash }) => {
        const { svg } = await window.mermaid.render(id, text)
        const container = document.createElement('div')
        container.innerHTML = svg
        const element = container.querySelector('svg')
        const parsed = element.ownerDocument
        const bounds = element.getAttribute('viewBox').split(/\s+/).map(Number)
        const background = parsed.createElementNS('http://www.w3.org/2000/svg', 'rect')
        for (const [key, value] of Object.entries({ x: bounds[0], y: bounds[1], width: bounds[2], height: bounds[3], fill: '#ffffff', 'data-canvas-background': 'white' })) background.setAttribute(key, value)
        element.insertBefore(background, element.firstChild)
        element.setAttribute('data-mermaid-sha256', hash)
        element.style.backgroundColor = '#ffffff'
        document.body.appendChild(container)
        try {
          if (element.getAttribute('aria-roledescription') === 'sequence') {
            const lanes = [...element.querySelectorAll('.actor-line')]
            const labels = [...element.querySelectorAll('.messageText')]
            if (!lanes.length || lanes.some(lane => getComputedStyle(lane).strokeWidth !== '0.5px')) {
              throw new Error(`${id}: sequence lifelines must render at 0.5px`)
            }
            if (!labels.length || labels.some(label => getComputedStyle(label).fontSize !== '12px')) {
              throw new Error(`${id}: sequence connection labels must render at 12px`)
            }
          }
          return new XMLSerializer().serializeToString(element)
        } finally {
          container.remove()
        }
      }, { text: match[2], id: `dzr-${name.slice(0, -3)}-${index}`, hash })
      await fs.writeFile(path.join(docs, 'generated', `${name.slice(0, -3)}-${index}.svg`), svg + '\n')
    }
  }
  console.log(`Generated ${count} opaque white SVG previews.`)
} finally {
  await browser?.close()
  await new Promise(resolve => server.close(resolve))
}
