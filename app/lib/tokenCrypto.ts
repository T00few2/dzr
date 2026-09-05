import crypto from 'node:crypto'

const PREFIX = 'enc:v1:'

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

export type CoachMemoryPlain = {
  discordId?: string | null
  updatedAt?: unknown
  updatedBy?: unknown
  ridesPerWeek?: unknown
  sports?: unknown
  weekly?: unknown
  injuries?: unknown
  goals?: unknown
  style?: unknown
  notesOptIn?: unknown
  followUpEveryDays?: unknown
  howItWorksSentAt?: unknown
  lastAthleteMessageAt?: unknown
  lastFollowUpAt?: unknown
}

function packCoachMemory(plain: CoachMemoryPlain) {
  return {
    ridesPerWeek: plain.ridesPerWeek ?? null,
    sports: Array.isArray(plain.sports) ? plain.sports : [],
    weekly: Array.isArray(plain.weekly) ? plain.weekly : [],
    injuries: Array.isArray(plain.injuries) ? plain.injuries : [],
    goals: Array.isArray(plain.goals) ? plain.goals : [],
    style: plain.style && typeof plain.style === 'object' ? plain.style : { length: null, language: null, tone: null, notes: '' },
    notesOptIn: plain.notesOptIn === true,
    followUpEveryDays: plain.followUpEveryDays ?? null,
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
    howItWorksSentAt: src.howItWorksSentAt ?? null,
    lastAthleteMessageAt: src.lastAthleteMessageAt ?? null,
    lastFollowUpAt: src.lastFollowUpAt ?? null,
    notesOptIn: fromPlain.notesOptIn === true,
  }
}

export type CoachChatNoteKind = 'feeling' | 'plan' | 'preference_transient' | 'life' | 'race' | 'goal'

export type CoachChatNotePlain = {
  id?: string | null
  discordId?: string | null
  at?: unknown
  text?: unknown
  kind?: unknown
  eventDate?: unknown
  noteEnc?: unknown
}

const CHAT_NOTE_KINDS = new Set<CoachChatNoteKind>([
  'feeling',
  'plan',
  'preference_transient',
  'life',
  'race',
  'goal',
])

function packChatNote(plain: CoachChatNotePlain) {
  const kind = String(plain.kind || '').trim().toLowerCase()
  const eventDate = String(plain.eventDate || '').trim().slice(0, 10)
  return {
    text: String(plain.text || '').slice(0, 280),
    kind: (CHAT_NOTE_KINDS.has(kind as CoachChatNoteKind) ? kind : 'life') as CoachChatNoteKind,
    eventDate: /^\d{4}-\d{2}-\d{2}$/.test(eventDate) ? eventDate : null,
  }
}

export function unwrapChatNoteDoc(data: Record<string, unknown> | null | undefined): {
  id: string | null
  discordId: string | null
  at: string | null
  text: string
  kind: CoachChatNoteKind
  eventDate: string | null
} {
  const src = data && typeof data === 'object' ? data : {}
  let packed: ReturnType<typeof packChatNote> | null = null
  if (src.noteEnc) {
    const json = decryptWithKey(getCoachKey(), src.noteEnc, 'coach chat note')
    const parsed = JSON.parse(json || '{}')
    packed = packChatNote(parsed && typeof parsed === 'object' ? parsed : {})
  }
  const fromPlain = packed || packChatNote(src)
  return {
    id: (src.id as string) || null,
    discordId: (src.discordId as string) || null,
    at: toIso(src.at),
    text: fromPlain.text,
    kind: fromPlain.kind,
    eventDate: fromPlain.eventDate || null,
  }
}

export function persistChatNoteDoc(plain: CoachChatNotePlain): Record<string, unknown> {
  const packed = packChatNote(plain)
  const meta = {
    discordId: plain.discordId || null,
    at: plain.at || new Date(),
  }
  const key = getCoachKey()
  if (!key) {
    return { ...meta, ...packed }
  }
  return {
    ...meta,
    noteEnc: encryptWithKey(key, JSON.stringify(packed)),
    noteEncVersion: 1,
  }
}

export function persistCoachMemoryDoc(plain: CoachMemoryPlain): Record<string, unknown> {
  const packed = packCoachMemory(plain)
  const meta = {
    discordId: plain.discordId || null,
    updatedAt: plain.updatedAt || null,
    updatedBy: plain.updatedBy || null,
    notesOptIn: packed.notesOptIn === true,
    howItWorksSentAt: plain.howItWorksSentAt || null,
    lastAthleteMessageAt: plain.lastAthleteMessageAt || null,
    lastFollowUpAt: plain.lastFollowUpAt || null,
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

export const SECRET_DOC_KEYS = [
  'accessToken',
  'refreshToken',
  'accessTokenEnc',
  'refreshTokenEnc',
  'memoryEnc',
  'noteEnc',
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
