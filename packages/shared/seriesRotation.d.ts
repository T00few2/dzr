export function parseIsoDate(value: unknown): string | null

export function addDays(iso: string, days: number): string

export function weeksBetween(anchor: string, date: string): number

export function routeForDate(
  routes: string[],
  anchorDate: string,
  anchorIndex: number,
  overrides: Record<string, string> | null | undefined,
  date: string
): string

export function listSeriesDates(anchorDate: string, eventDates: string[], count?: number): string[]

export function displayDate(iso: string): string

export function parseSheetDate(value: unknown): string | null

export function courseLength(
  lapsText: unknown,
  kmText: unknown
): { laps: number } | { distanceMeters: number } | null

export function usesLapCount(lapsText: unknown): boolean
