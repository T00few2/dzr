// Documentation-only dependencies live beside this script, outside both app build contexts.
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { JSDOM } from 'jsdom'

const root = fileURLToPath(new URL('../../', import.meta.url))
const ignored = new Set(['.git', 'node_modules', '.next', '.venv', 'venv', '__pycache__'])
const dom = new JSDOM('<!doctype html><html><body></body></html>')
globalThis.window = dom.window
globalThis.document = dom.window.document
// Import after installing the DOM: Mermaid's sanitizer initializes during module loading.
const { default: mermaid } = await import('mermaid')
mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' })

async function markdownFiles(directory) {
  const files = []
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name) || entry.isSymbolicLink()) continue
    const target = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await markdownFiles(target))
    else if (/\.md$/i.test(entry.name)) files.push(target)
  }
  return files.sort()
}

// Return ordinary Markdown and separately indexed Mermaid blocks, ignoring other fenced code.
function extract(source, file) {
  const lines = source.split(/\r?\n/)
  const prose = []
  const diagrams = []
  let fence = null
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    if (!fence) {
      const start = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/)
      if (start) {
        fence = { marker: start[1][0], length: start[1].length, line: index + 1,
          mermaid: start[2].trim() === 'mermaid', language: start[2].trim(), body: [] }
        prose.push('')
      } else prose.push(line)
    } else {
      const end = line.match(/^ {0,3}(`{3,}|~{3,})\s*$/)
      if (end && end[1][0] === fence.marker && end[1].length >= fence.length) {
        const text = fence.body.join('\n')
        // Plain-text sequence sources expose GitHub's code-copy button instead of a second
        // rendered diagram. Validate the same source used for the white-canvas preview.
        if (fence.mermaid || (fence.language === 'text' && /^sequenceDiagram\s*$/m.test(text))) {
          diagrams.push({ line: fence.line, text })
        }
        fence = null
      } else fence.body.push(line)
      prose.push('')
    }
  }
  if (fence) throw new Error(`${file}:${fence.line}: unclosed code fence`)
  return { prose, diagrams }
}

// GitHub's automatic heading IDs, for the ordinary headings used by these guides.
function headingIds(lines) {
  const counts = new Map()
  const ids = new Set()
  for (const line of lines) {
    const match = line.match(/^ {0,3}#{1,6}\s+(.+?)(?:\s+#+)?$/)
    if (!match) continue
    const slug = match[1].toLowerCase().replace(/<[^>]*>/g, '')
      .replace(/[^\p{Letter}\p{Number}\p{Mark}_\-\s]/gu, '').replace(/\s/g, '-')
    const count = counts.get(slug) || 0
    counts.set(slug, count + 1)
    ids.add(count ? `${slug}-${count}` : slug)
  }
  return ids
}

const sources = new Map()
const skillPath = path.join(root, '.agents/skills/mermaid-architecture/SKILL.md')
const skill = await fs.readFile(skillPath, 'utf8')
// Read the canonical vocabulary from the skill instead of maintaining another icon list.
const iconTable = skill.split('## Icon vocabulary')[1].split('## Colors')[0]
const icons = [...iconTable.matchAll(/^\| (\S+) \| .+ \| (?:Human|Machine[^|]*) \|$/gm)]
  .map((match) => match[1])
if (!icons.length) throw new Error('No icons found in the Mermaid architecture skill')
let errors = 0
let diagrams = 0
let links = 0
function fail(file, line, message) {
  console.error(`${path.relative(root, file)}:${line}: ${message}`)
  errors++
}

function checkConventions(diagram, file) {
  if (!path.relative(root, file).startsWith(`docs${path.sep}architecture${path.sep}`)) return
  const body = diagram.text
  // Limit label matching to diagram syntax, excluding front-matter CSS attribute selectors.
  const syntax = body.slice(body.search(/^(?:flowchart|sequenceDiagram|erDiagram|stateDiagram-v2)\b/m))
  const labels = [
    ...[...syntax.matchAll(/\b[A-Za-z_]\w*\[\(?("?)([^"\]\n]+)\1\)?\]/g)].map((match) => match[2]),
    ...[...syntax.matchAll(/^\s*participant \w+ as (.+)$/gm)].map((match) => match[1]),
    ...[...syntax.matchAll(/^\s*state "([^"]+)" as \w+/gm)].map((match) => match[1]),
  ]
  for (const label of labels) {
    if (!icons.some((icon) => label.startsWith(`${icon} `))) {
      fail(file, diagram.line, `entity label needs a skill icon prefix: ${label}`)
    }
  }
  if (/flowchart\s+(?:TB|TD|BT|LR|RL)/.test(body)) {
    if (/<-->|<--|<==>|<==/.test(body)) {
      fail(file, diagram.line, 'use initiator --> recipient or an arrowless association')
    }
    if (!/classDef default .*stroke:#[0-9a-fA-F]{6}/.test(body) ||
        !/linkStyle default stroke:#[0-9a-fA-F]{6}/.test(body)) {
      fail(file, diagram.line, 'flowchart needs the skill outline and connection palette')
    }
  }
  if (body.includes('sequenceDiagram') && /-->>/.test(body)) {
    fail(file, diagram.line, 'put response outcomes in notes; arrows identify initiated messages')
  }
}

try {
  for (const file of await markdownFiles(root)) {
    try {
      sources.set(file, extract(await fs.readFile(file, 'utf8'), path.relative(root, file)))
    } catch (error) {
      fail(file, 1, error.message)
    }
  }
  for (const [file, content] of sources) {
    let previewIndex = 0
    for (const diagram of content.diagrams) {
      diagrams++
      try {
        if (!diagram.text.trim()) throw new Error('empty Mermaid fence')
        await mermaid.parse(diagram.text)
        checkConventions(diagram, file)
        if (path.dirname(file) === path.join(root, 'docs/architecture') && !path.basename(file).startsWith('.')) {
          previewIndex++
          const preview = path.join(root, 'docs/architecture/generated', `${path.basename(file, '.md')}-${previewIndex}.svg`)
          const svg = await fs.readFile(preview, 'utf8')
          const hash = createHash('sha256').update(diagram.text).digest('hex')
          if (!svg.includes(`data-mermaid-sha256="${hash}"`) || !svg.includes('data-canvas-background="white"')) {
            throw new Error('white-canvas preview is stale; run npm run render --prefix scripts/architecture')
          }
        }
      } catch (error) {
        fail(file, diagram.line, `Mermaid: ${error.message}`)
      }
    }
    const relative = path.relative(root, file).split(path.sep).join('/')
    if (!relative.startsWith('docs/architecture/') &&
        !relative.startsWith('.agents/skills/mermaid-architecture/') && ![
      'README.md', 'AGENTS.md', '.github/pull_request_template.md',
    ].includes(relative)) continue

    for (const [index, line] of content.prose.entries()) {
      // Our guides use inline Markdown links. Ignore images and external URLs.
      for (const match of line.matchAll(/(?<!!)\[[^\]\n]*\]\(([^)\n]+)\)/g)) {
        const href = match[1].replace(/^<|>$/g, '')
        if (/^[a-z][a-z\d+.-]*:/i.test(href) || href.startsWith('//')) continue
        links++
        try {
          const hash = href.indexOf('#')
          const pathname = decodeURIComponent(hash < 0 ? href : href.slice(0, hash))
          const fragment = hash < 0 ? '' : decodeURIComponent(href.slice(hash + 1))
          const target = pathname ? path.resolve(path.dirname(file), pathname) : file
          const stat = await fs.stat(target)
          if (fragment && stat.isFile() && /\.md$/i.test(target)) {
            const destination = sources.get(target)
            if (!destination || !headingIds(destination.prose).has(fragment)) {
              throw new Error(`missing heading #${fragment}`)
            }
          }
        } catch (error) {
          fail(file, index + 1, `link ${href}: ${error.message}`)
        }
      }
    }
  }
  if (!diagrams) fail(path.join(root, 'docs/architecture/README.md'), 1, 'no Mermaid diagrams found')
  console.log(`Checked ${diagrams} Mermaid diagrams and ${links} local links; ${errors} error(s).`)
  process.exitCode = errors ? 1 : 0
} finally {
  dom.window.close()
}
