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
    'Du kan få træningsråd i en privat besked fra **DZR Coach** (ikke klub-boten). Sådan virker det:',
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
    'Chatten er privat, og samtalen gemmes ikke. Når chat-noter er slået til, gemmer jeg stille korte, daterede notater (fx at du var syg, eller at du kører et løb en bestemt dag) — uden at spørge dig. Faste rammer (ture om ugen, skader, mål, svartone) retter du selv under Mine sider. Du kan altid se og slette noterne der.',
  ]
  if (includeStartHint) {
    lines.push('', 'Skriv **/coach** på Discord-serveren, når du vil i gang. **DZR Coach** skriver til dig i en privat besked.')
  }
  return lines.join('\n')
}
