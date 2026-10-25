export const MY_PAGES_COACH_URL: string
export const CALENDAR_URL: string
export const SETUP_URL: string
export const EXAMPLE_QUESTIONS: string
export function noEmbedUrl(url: string): string
export function coachHowItWorksText(): string
export function coachSetupPointerText(): string
export function coachSetupNudgeText(): string
export function coachSetupStep(
  profile: {
    notesOptIn?: boolean
    weekly?: unknown[]
    onboardingNotesSkippedAt?: string | null
    onboardingWeeklySkippedAt?: string | null
    onboardingCalendarSkippedAt?: string | null
  } | null | undefined,
  options?: { hasCalendarEntry?: boolean }
): 'notes' | 'days' | 'calendar' | 'done'
export function isCoachSetupOpen(
  profile: {
    notesOptIn?: boolean
    weekly?: unknown[]
    onboardingNotesSkippedAt?: string | null
    onboardingWeeklySkippedAt?: string | null
    onboardingCalendarSkippedAt?: string | null
    onboardingFinishedAt?: string | null
  } | null | undefined,
  options?: { hasCalendarEntry?: boolean }
): boolean
