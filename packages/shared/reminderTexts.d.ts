export type ReminderStep = 'link_zwift_id_channel' | 'link_zwift_id_join' | 'connect_intervals' | 'join_companion'

export type ReminderLinks = { siteOrigin: string; zwiftIdChannelId: string }

export const MAX_REMINDER_CHARS: number

export const REMINDER_STEP_LABELS: Record<ReminderStep, string>

export function defaultReminderTexts(links: ReminderLinks): Record<ReminderStep, string>

export function resolveReminderText(
  step: string,
  stored: Record<string, unknown> | null | undefined,
  links: ReminderLinks,
): string | null
