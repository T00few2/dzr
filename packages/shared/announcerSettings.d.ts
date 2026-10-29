export type FieldSpec = {
  group: string
  path: string
  label: string
  help?: string
  type: 'boolean' | 'number' | 'channel'
  min?: number
  max?: number
  step?: number
}

export const FIELD_SPECS: FieldSpec[]

export function announcerDefaults(channels: { announcements: string }): Record<string, any>

export function mergeSettings<T extends Record<string, any>>(base: T, override: unknown): T

export function sanitizeSettings(values: Record<string, unknown>): { patch: Record<string, any>; errors: string[] }

export function flattenSettings(settings: Record<string, any>): Record<string, unknown>

export function getPath(object: unknown, path: string): unknown
