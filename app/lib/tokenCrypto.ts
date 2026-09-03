import crypto from 'node:crypto'

const PREFIX = 'enc:v1:'

function keyMaterial(): string {
  const explicit = String(process.env.STRAVA_TOKEN_KEY || '').trim()
  if (explicit) return explicit
  const shared = String(process.env.STRAVA_CONNECT_SECRET || '').trim()
  if (shared) return `dzr-strava-tokens:${shared}`
  return ''
}

function getKey(): Buffer | null {
  const material = keyMaterial()
  if (!material) return null
  return crypto.createHash('sha256').update(material, 'utf8').digest()
}

export function canEncryptTokens(): boolean {
  return Boolean(getKey())
}

export function encryptSecret(plaintext: string): string {
  const text = String(plaintext || '')
  if (!text) return ''
  const key = getKey()
  if (!key) return text
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${PREFIX}${iv.toString('base64url')}.${tag.toString('base64url')}.${enc.toString('base64url')}`
}

export function decryptSecret(value: unknown): string {
  const raw = String(value || '')
  if (!raw) return ''
  if (!raw.startsWith(PREFIX)) return raw
  const key = getKey()
  if (!key) {
    throw new Error('Cannot decrypt Strava token: STRAVA_TOKEN_KEY / STRAVA_CONNECT_SECRET is not set')
  }
  const parts = raw.slice(PREFIX.length).split('.')
  if (parts.length !== 3) throw new Error('Invalid encrypted Strava token')
  const [ivB, tagB, dataB] = parts
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagB, 'base64url'))
  return Buffer.concat([
    decipher.update(Buffer.from(dataB, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
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

export const SECRET_DOC_KEYS = [
  'accessToken',
  'refreshToken',
  'accessTokenEnc',
  'refreshTokenEnc',
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
