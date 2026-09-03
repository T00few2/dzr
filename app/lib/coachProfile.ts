import { COLLECTIONS } from '@/app/lib/sharedConstants'

export const COACH_PROFILES_COLLECTION = COLLECTIONS.coachProfiles || 'coach_profiles'

export type CoachStyleLength = 'short' | 'normal' | 'detailed'
export type CoachStyleLanguage = 'da' | 'en'
export type CoachStyleTone = 'direct' | 'encouraging' | 'casual'

export type CoachStyle = {
  length: CoachStyleLength | null
  language: CoachStyleLanguage | null
  tone: CoachStyleTone | null
  notes: string
}

export type CoachWeeklySlot = { sport: string; days: string[] }
export type CoachInjury = {
  id: string
  text: string
  started: string | null
  status: 'active' | 'recovered'
  source: 'user' | 'coach'
}

export type CoachProfile = {
  ridesPerWeek: { min?: number; max?: number } | null
  sports: string[]
  weekly: CoachWeeklySlot[]
  injuries: CoachInjury[]
  goals: string[]
  notes: string
  style: CoachStyle
}

const DAY_ALIASES: Record<string, string> = {
  mon: 'mon',
  monday: 'mon',
  mandag: 'mon',
  tue: 'tue',
  tuesday: 'tue',
  tirsdag: 'tue',
  wed: 'wed',
  wednesday: 'wed',
  onsdag: 'wed',
  thu: 'thu',
  thursday: 'thu',
  torsdag: 'thu',
  fri: 'fri',
  friday: 'fri',
  fredag: 'fri',
  sat: 'sat',
  saturday: 'sat',
  lordag: 'sat',
  lørdag: 'sat',
  sun: 'sun',
  sunday: 'sun',
  sondag: 'sun',
  søndag: 'sun',
}

const DAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

const LENGTH_MAP: Record<string, CoachStyleLength> = {
  short: 'short',
  kort: 'short',
  kortfattet: 'short',
  brief: 'short',
  concise: 'short',
  normal: 'normal',
  medium: 'normal',
  standard: 'normal',
  detailed: 'detailed',
  lang: 'detailed',
  long: 'detailed',
  udforlig: 'detailed',
}

const LANGUAGE_MAP: Record<string, CoachStyleLanguage> = {
  da: 'da',
  dk: 'da',
  danish: 'da',
  dansk: 'da',
  en: 'en',
  english: 'en',
  engelsk: 'en',
}

const TONE_MAP: Record<string, CoachStyleTone> = {
  direct: 'direct',
  direkte: 'direct',
  encouraging: 'encouraging',
  opmuntrende: 'encouraging',
  casual: 'casual',
  afslappet: 'casual',
}

function clip(value: unknown, max: number): string {
  return String(value || '').trim().slice(0, max)
}

function uniqueStrings(list: unknown, maxItems = 12, maxLen = 40): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of Array.isArray(list) ? list : []) {
    const value = clip(raw, maxLen).toLowerCase()
    if (!value || seen.has(value)) continue
    seen.add(value)
    out.push(value)
    if (out.length >= maxItems) break
  }
  return out
}

export function emptyStyle(): CoachStyle {
  return { length: null, language: null, tone: null, notes: '' }
}

export function emptyCoachProfile(): CoachProfile {
  return {
    ridesPerWeek: null,
    sports: [],
    weekly: [],
    injuries: [],
    goals: [],
    notes: '',
    style: emptyStyle(),
  }
}

function sanitizeRidesPerWeek(value: unknown): CoachProfile['ridesPerWeek'] {
  if (value == null || value === '') return null
  if (typeof value !== 'object') return null
  const raw = value as { min?: unknown; max?: unknown }
  const min = raw.min == null || raw.min === '' ? null : Number(raw.min)
  const max = raw.max == null || raw.max === '' ? null : Number(raw.max)
  const cleanMin = Number.isFinite(min) ? Math.max(0, Math.min(14, Math.round(min as number))) : null
  const cleanMax = Number.isFinite(max) ? Math.max(0, Math.min(14, Math.round(max as number))) : null
  if (cleanMin == null && cleanMax == null) return null
  if (cleanMin != null && cleanMax != null && cleanMin > cleanMax) return { min: cleanMax, max: cleanMin }
  const out: { min?: number; max?: number } = {}
  if (cleanMin != null) out.min = cleanMin
  if (cleanMax != null) out.max = cleanMax
  return out
}

function sanitizeDays(value: unknown): string[] {
  const seen = new Set<string>()
  for (const raw of Array.isArray(value) ? value : []) {
    const key = String(raw || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
    const day = DAY_ALIASES[key]
    if (!day || seen.has(day)) continue
    seen.add(day)
  }
  return DAY_ORDER.filter((d) => seen.has(d))
}

function sanitizeWeekly(value: unknown): CoachWeeklySlot[] {
  const rows: CoachWeeklySlot[] = []
  const seen = new Set<string>()
  for (const raw of Array.isArray(value) ? value : []) {
    if (!raw || typeof raw !== 'object') continue
    const row = raw as { sport?: unknown; days?: unknown }
    const sport = clip(row.sport, 40).toLowerCase()
    const days = sanitizeDays(row.days)
    if (!sport || !days.length) continue
    const key = `${sport}:${days.join(',')}`
    if (seen.has(key)) continue
    seen.add(key)
    rows.push({ sport, days })
    if (rows.length >= 14) break
  }
  return rows
}

function newInjuryId() {
  return `inj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function sanitizeInjuries(value: unknown, source: 'user' | 'coach'): CoachInjury[] {
  const out: CoachInjury[] = []
  const seen = new Set<string>()
  for (const raw of Array.isArray(value) ? value : []) {
    if (!raw || typeof raw !== 'object') continue
    const row = raw as { id?: unknown; text?: unknown; started?: unknown; status?: unknown; source?: unknown }
    const text = clip(row.text, 240)
    if (!text) continue
    const id = clip(row.id, 64) || newInjuryId()
    const key = id || text.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      id,
      text,
      started: clip(row.started, 40) || null,
      status: String(row.status || 'active').toLowerCase() === 'recovered' ? 'recovered' : 'active',
      source: row.source === 'coach' || row.source === 'user' ? row.source : source,
    })
    if (out.length >= 12) break
  }
  return out
}

function sanitizeGoals(value: unknown): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of Array.isArray(value) ? value : []) {
    const goal = clip(raw, 200)
    if (!goal) continue
    const key = goal.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(goal)
    if (out.length >= 8) break
  }
  return out
}

function sanitizeStyle(value: unknown): CoachStyle {
  if (!value || typeof value !== 'object') return emptyStyle()
  const raw = value as { length?: unknown; language?: unknown; tone?: unknown; notes?: unknown }
  const lengthKey = String(raw.length || '').trim().toLowerCase()
  const languageKey = String(raw.language || '').trim().toLowerCase()
  const toneKey = String(raw.tone || '').trim().toLowerCase()
  return {
    length: LENGTH_MAP[lengthKey] || null,
    language: LANGUAGE_MAP[languageKey] || null,
    tone: TONE_MAP[toneKey] || null,
    notes: clip(raw.notes, 400),
  }
}

export function publicCoachFields(data: unknown, source: 'user' | 'coach' = 'user'): CoachProfile {
  const src = data && typeof data === 'object' ? (data as Record<string, unknown>) : {}
  return {
    ridesPerWeek: sanitizeRidesPerWeek(src.ridesPerWeek),
    sports: uniqueStrings(src.sports, 12, 40),
    weekly: sanitizeWeekly(src.weekly),
    injuries: sanitizeInjuries(src.injuries, source),
    goals: sanitizeGoals(src.goals),
    notes: clip(src.notes, 1000),
    style: sanitizeStyle(src.style),
  }
}

export function toClientCoachProfile(data: unknown, discordId: string) {
  const src = data && typeof data === 'object' ? (data as Record<string, unknown>) : {}
  const fields = publicCoachFields(src, src.updatedBy === 'coach' ? 'coach' : 'user')
  return {
    ...fields,
    discordId,
    updatedAt: src.updatedAt ?? null,
    updatedBy: src.updatedBy === 'user' || src.updatedBy === 'coach' ? src.updatedBy : null,
  }
}
