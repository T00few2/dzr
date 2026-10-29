export type OnboardingTextKey =
  | 'join'
  | 'intro'
  | 'link_zwift_id_channel'
  | 'link_zwift_id_join'
  | 'meet_verification'
  | 'become_club_member'
  | 'club_role_pending'
  | 'connect_intervals'
  | 'ask_me'
  | 'dm_closed_fallback'

export type OnboardingLinks = { siteOrigin: string; channels: Record<string, string> }

export const MAX_ONBOARDING_CHARS: number

export const ONBOARDING_TEXT_SPECS: Record<OnboardingTextKey, { label: string; placeholders: Record<string, string> }>

export function defaultOnboardingTexts(links: OnboardingLinks): Record<OnboardingTextKey, string>

export function resolveOnboardingTexts(stored: Record<string, unknown> | null | undefined, links: OnboardingLinks): Record<OnboardingTextKey, string>

export function renderTemplate(template: string, vars?: Record<string, unknown>): string
