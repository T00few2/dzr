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
    'Jeg bruger dine aktiviteter fra intervals.icu, når du spørger om træning, restitution eller et bestemt pas.',
    '',
    '**Før du forbinder intervals.icu**',
    '1. Opret en konto på intervals.icu.',
    '2. Settings → Connections: forbind Zwift direkte, og slå upload af planlagte workouts til. Garmin sender ikke Zwift-ture videre.',
    '3. Sæt den samme FTP på Zwift og på intervals.icu.',
    '4. Udendørs ture: forbind Garmin, Wahoo, Polar eller Coros direkte.',
    '5. Gamle ture: Download Old Data fra Zwift, eller importér et arkiv med de originale filer.',
    '',
    '**Din profil**',
    'Du har fået et udgangspunkt på profilen (cykling og typisk 3–4 ture om ugen). Du retter selv rammerne under Mine sider → Coach:',
    noEmbedUrl(MY_PAGES_COACH_URL),
    '',
    'Det er der, du sætter hvor ofte du kører, andre sportsgrene, faste træningsdage, skader og hvordan jeg skal svare. Under samme side kan du slå et valgfrit check-in til, så jeg skriver først om morgenen, hvis vi ikke har snakket i et par dage.',
    '',
    '**Chat-noter**',
    'Chatten er privat. Selve samtalen gemmes ikke. For at forstå sammenhængen kan jeg læse det seneste døgn af vores DM igen — med chat-noter slået til op til 14 dage tilbage, når du henviser til noget tidligere. Det bliver ikke gemt. Med chat-noter slået til gemmer jeg et kort resumé, når en samtale slutter, så jeg kan huske tråden næste gang. Jeg gemmer også stille korte notater (fx at du var syg, eller en engangsplan) — uden at spørge dig. Datobundne mål (et løb, tabe vægt inden en dato) sætter du under Mine sider, eller jeg foreslår dem i chatten og gemmer først, når du trykker Ja. Så styrer jeg træningen efter dem. Faste rammer (ture om ugen, skader, svartone) retter du selv under Mine sider. Du kan altid se og slette noterne der.',
  ]
  if (includeStartHint) {
    lines.push('', 'Skriv **/coach** på Discord-serveren, når du vil i gang. **DZR Coach** skriver til dig i en privat besked.')
  }
  return lines.join('\n')
}
