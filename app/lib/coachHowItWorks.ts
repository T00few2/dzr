import { SITE_ORIGIN } from '@/app/lib/sharedConstants'

export const MY_PAGES_COACH_URL = `${SITE_ORIGIN}/members-zone/my-pages?tab=2`

export function noEmbedUrl(url: string) {
  const raw = String(url || '').trim()
  if (!raw) return ''
  if (raw.startsWith('<') && raw.endsWith('>')) return raw
  return `<${raw}>`
}

export function coachHowItWorksText({ includeStartHint = true }: { includeStartHint?: boolean } = {}) {
  const lines = [
    '🚴 **DZR Coach**',
    '',
    'Du kan få træningsråd i en privat Discord-besked. Sådan virker det:',
    '',
    '**Din træning**',
    'Jeg bruger dine Strava-aktiviteter, når du spørger om træning, restitution eller et bestemt pas.',
    '',
    '**Din profil**',
    'Du har fået et udgangspunkt på profilen (cykling og typisk 3–4 ture om ugen). Du retter selv rammerne under Mine sider → Coach:',
    noEmbedUrl(MY_PAGES_COACH_URL),
    '',
    'Det er der, du sætter hvor ofte du kører, andre sportsgrene, faste træningsdage, skader, faste mål (fx tabe vægt eller holde formen) og hvordan jeg skal svare.',
    '',
    '**Chat-noter**',
    'Chatten er privat, og samtalen gemmes ikke. Vil du have, at jeg husker tidligere samtaler (fx at du var syg, eller at du kører et løb en bestemt dag), slår du chat-noter til via linket ovenfor. Du kan altid se og slette noterne der.',
  ]
  if (includeStartHint) {
    lines.push('', 'Skriv **/coach** på Discord-serveren, når du vil i gang.')
  }
  return lines.join('\n')
}
