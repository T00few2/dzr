export function copenhagenDay(value: unknown): string

export function hoursAfter(value: unknown, hours: number): Date | null

export function formatWhen(value: unknown): string

export function routePhase(
  now: Date,
  previousStart: unknown,
  nextDate: string
): { phase: "unknown" | "closed" | "before" | "open"; checksFrom: Date | null }

export function routeLine(input: {
  label: string
  route: string
  saved: boolean
  now: Date
  previousStart: unknown
  nextDate: string
}): string

export function sprintLine(input: { set: boolean; publishedAt: unknown; now: Date }): string

export function categoryLine(input: { checked: boolean; start: unknown; now: Date }): string
