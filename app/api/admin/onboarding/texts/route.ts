import { textTemplateRoutes } from '@/app/api/admin/_lib/textTemplates'
import { SITE_ORIGIN, sharedConstants } from '@/app/lib/sharedConstants'
import { MAX_ONBOARDING_CHARS, ONBOARDING_TEXT_SPECS, defaultOnboardingTexts } from '@/packages/shared/onboardingTexts'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// The bot reads these from system_settings/onboarding_texts (cached 5 minutes).
const routes = textTemplateRoutes({
  docId: 'onboarding_texts',
  maxChars: MAX_ONBOARDING_CHARS,
  defaults: () => defaultOnboardingTexts({ siteOrigin: SITE_ORIGIN, channels: sharedConstants.discord.channels }),
  specs: ONBOARDING_TEXT_SPECS,
})

export const GET = routes.GET
export const PUT = routes.PUT
