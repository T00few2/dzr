import { textTemplateRoutes } from '@/app/api/admin/_lib/textTemplates'
import { SITE_ORIGIN, sharedConstants } from '@/app/lib/sharedConstants'
import { MAX_REMINDER_CHARS, REMINDER_STEP_LABELS, defaultReminderTexts } from '@/packages/shared/reminderTexts'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// The bot reads its announcer settings, including these texts, from system_settings/announcer (cached 5 minutes).
const routes = textTemplateRoutes({
  docId: 'announcer',
  prefix: 'dmReminders',
  maxChars: MAX_REMINDER_CHARS,
  defaults: () => defaultReminderTexts({ siteOrigin: SITE_ORIGIN, zwiftIdChannelId: sharedConstants.discord.channels.zwiftId }),
  specs: Object.fromEntries(Object.entries(REMINDER_STEP_LABELS).map(([key, label]) => [key, { label }])),
  enabled: (data) => data.dmReminders?.enabled !== false,
})

export const GET = routes.GET
export const PUT = routes.PUT
