import crypto from 'node:crypto'

const PREFIX = 'enc:v1:'

const COACH_PLAINTEXT_KEYS = [
  'ridesPerWeek',
  'sports',
  'weekly',
  'injuries',
  'goals',
  'notes',
  'style',
  'pendingConfirmation',
] as const

function hashKey(material: string): Buffer {
  return crypto.createHash('sha256').update(material, 'utf8').digest()
}

function tokenKeyMaterial(): string {
  const explicit = String(process.env.STRAVA_TOKEN_KEY || '').trim()
  if (explicit) return explicit
  const shared = String(process.env.STRAVA_CONNECT_SECRET || '').trim()
  if (shared) return `dzr-strava-tokens:${shared}`
  return ''
}

function coachKeyMaterial(): string {
  const explicit = String(process.env.COACH_MEMORY_KEY || '').trim()
  if (explicit) return explicit
  const shared = String(process.env.STRAVA_CONNECT_SECRET || '').trim()
  if (shared) return `dzr-coach-memory:${shared}`
  const tokenKey = String(process.env.STRAVA_TOKEN_KEY || '').trim()
  if (tokenKey) return `dzr-coach-memory:${tokenKey}`
  return ''
}

function getTokenKey(): Buffer | null {
  const material = tokenKeyMaterial()
  if (!material) return null
  return hashKey(material)
}

function getCoachKey(): Buffer | null {
  const material = coachKeyMaterial()
  if (!material) return null
  return hashKey(material)
}

function encryptWithKey(key: Buffer, plaintext: string): string {
  const text = String(plaintext || '')
  if (!text) return ''
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${PREFIX}${iv.toString('base64url')}.${tag.toString('base64url')}.${enc.toString('base64url')}`
}

function decryptWithKey(key: Buffer | null, value: unknown, label: string): string {
  const raw = String(value || '')
  if (!raw) return ''
  if (!raw.startsWith(PREFIX)) return raw
  if (!key) {
    throw new Error(`Cannot decrypt ${label}: encryption key is not set`)
  }
  const parts = raw.slice(PREFIX.length).split('.')
  if (parts.length !== 3) throw new Error(`Invalid encrypted ${label}`)
  const [ivB, tagB, dataB] = parts
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagB, 'base64url'))
  return Buffer.concat([
    decipher.update(Buffer.from(dataB, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}

function toIso(value: unknown): string | null {
  if (value == null || value === '') return null
  if (typeof value === 'string') return value
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString()
  if (typeof value === 'object' && value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
    try {
      return (value as { toDate: () => Date }).toDate().toISOString()
    } catch {
      return null
    }
  }
  if (typeof value === 'object' && value && typeof (value as { seconds?: number }).seconds === 'number') {
    return new Date((value as { seconds: number }).seconds * 1000).toISOString()
  }
  return null
}

export function canEncryptTokens(): boolean {
  return Boolean(getTokenKey())
}

export function canEncryptCoachMemory(): boolean {
  return Boolean(getCoachKey())
}

export function encryptSecret(plaintext: string): string {
  const text = String(plaintext || '')
  if (!text) return ''
  const key = getTokenKey()
  if (!key) return text
  return encryptWithKey(key, text)
}

export function decryptSecret(value: unknown): string {
  return decryptWithKey(getTokenKey(), value, 'Strava token')
}

export function readStravaTokens(data: Record<string, unknown> | null | undefined): {
  accessToken: string
  refreshToken: string
} {
  const src = data || {}
  return {
    accessToken: decryptSecret(src.accessTokenEnc || src.accessToken || ''),
    refreshToken: decryptSecret(src.refreshTokenEnc || src.refreshToken || ''),
  }
}

export function hasStravaRefreshToken(data: Record<string, unknown> | null | undefined): boolean {
  const src = data || {}
  return Boolean(src.refreshTokenEnc || src.refreshToken)
}

export function encryptedTokenFields(accessToken: string, refreshToken: string) {
  return {
    accessTokenEnc: encryptSecret(accessToken),
    refreshTokenEnc: encryptSecret(refreshToken),
    tokenEncVersion: 1,
  }
}

export type CoachMemoryPending = {
  summary?: string
  snapshotBefore?: Record<string, unknown>
  askedAt?: unknown
} | null

export type CoachMemoryPlain = {
  discordId?: string | null
  updatedAt?: unknown
  updatedBy?: unknown
  ridesPerWeek?: unknown
  sports?: unknown
  weekly?: unknown
  injuries?: unknown
  goals?: unknown
  notes?: unknown
  style?: unknown
  pendingConfirmation?: CoachMemoryPending
}

function packPending(pending: unknown): CoachMemoryPending {
  if (!pending || typeof pending !== 'object') return null
  const src = pending as Record<string, unknown>
  const snapshot =
    src.snapshotBefore && typeof src.snapshotBefore === 'object'
      ? (src.snapshotBefore as Record<string, unknown>)
      : {}
  return {
    summary: String(src.summary || '').slice(0, 280),
    snapshotBefore: snapshot,
    askedAt: toIso(src.askedAt),
  }
}

function packCoachMemory(plain: CoachMemoryPlain) {
  return {
    ridesPerWeek: plain.ridesPerWeek ?? null,
    sports: Array.isArray(plain.sports) ? plain.sports : [],
    weekly: Array.isArray(plain.weekly) ? plain.weekly : [],
    injuries: Array.isArray(plain.injuries) ? plain.injuries : [],
    goals: Array.isArray(plain.goals) ? plain.goals : [],
    notes: typeof plain.notes === 'string' ? plain.notes : String(plain.notes || ''),
    style: plain.style && typeof plain.style === 'object' ? plain.style : { length: null, language: null, tone: null, notes: '' },
    pendingConfirmation: packPending(plain.pendingConfirmation),
  }
}

export function unwrapCoachMemoryDoc(data: Record<string, unknown> | null | undefined): CoachMemoryPlain {
  const src = data && typeof data === 'object' ? data : {}
  let packed: ReturnType<typeof packCoachMemory> | null = null
  if (src.memoryEnc) {
    const json = decryptWithKey(getCoachKey(), src.memoryEnc, 'coach memory')
    const parsed = JSON.parse(json || '{}')
    packed = packCoachMemory(parsed && typeof parsed === 'object' ? parsed : {})
  }
  const fromPlain = packed || packCoachMemory(src)
  return {
    ...fromPlain,
    discordId: (src.discordId as string) || null,
    updatedAt: src.updatedAt ?? null,
    updatedBy: src.updatedBy ?? null,
  }
}

export function persistCoachMemoryDoc(plain: CoachMemoryPlain): Record<string, unknown> {
  const packed = packCoachMemory(plain)
  const meta = {
    discordId: plain.discordId || null,
    updatedAt: plain.updatedAt || null,
    updatedBy: plain.updatedBy || null,
  }
  const key = getCoachKey()
  if (!key) {
    return { ...meta, ...packed }
  }
  return {
    ...meta,
    memoryEnc: encryptWithKey(key, JSON.stringify(packed)),
    memoryEncVersion: 1,
  }
}

export function needsCoachMemoryMigration(data: Record<string, unknown> | null | undefined): boolean {
  if (!canEncryptCoachMemory()) return false
  const src = data && typeof data === 'object' ? data : {}
  if (!src.memoryEnc) return true
  return COACH_PLAINTEXT_KEYS.some((key) => Object.prototype.hasOwnProperty.call(src, key))
}

export const SECRET_DOC_KEYS = [
  'accessToken',
  'refreshToken',
  'accessTokenEnc',
  'refreshTokenEnc',
  'memoryEnc',
  'privateKey',
  'idToken',
  'clientSecret',
] as const

export function redactSecrets<T extends Record<string, any>>(data: T): T {
  const out: Record<string, any> = { ...data }
  for (const key of SECRET_DOC_KEYS) {
    if (key in out && out[key]) out[key] = '[redacted]'
  }
  return out as T
}
