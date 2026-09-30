export const INTERVALS_SETTINGS_URL = 'https://intervals.icu/settings'
export const INTERVALS_PRIVACY_PATH = '/intervals/privacy'
export const INTERVALS_CONNECT_PATH = '/intervals/connect'
export const DZR_SUPPORT_EMAIL = 'dzr@dzrracingseries.com'

export const INTERVALS_DELETION_DM =
  '**intervals.icu er afbrudt**\n\n' +
  'Vi har slettet dine intervals.icu-tokens, coach-profil, chat-noter og gemte træningstal.\n\n' +
  `Hvis appen stadig vises under intervals.icu → Settings, så fjern den der: <${INTERVALS_SETTINGS_URL}>\n\n` +
  `Spørgsmål: ${DZR_SUPPORT_EMAIL}`

/** Danish steps shown when a member connects or finishes joining. */
export const INTERVALS_SETUP_STEPS = [
  'Opret en gratis konto på intervals.icu, hvis du ikke har en.',
  'Under Settings → Connections: forbind Zwift direkte, og slå "upload planned workouts" til. Indendørs ture fra Garmin eller Wahoo kommer ikke med — Zwift skal forbindes direkte.',
  'Sæt den samme FTP på Zwift og på intervals.icu. Træningspas sendes som procent af FTP, så tallene skal matche, ellers bliver watt forkerte i Zwift.',
  'Udendørs ture: forbind Garmin, Wahoo, Polar eller Coros direkte. Aktiviteter, der kun er hentet via Strava, kan coachen ikke læse.',
  'Vil du have gamle ture med, så brug "Download Old Data" fra Zwift, eller hent dit Strava-arkiv og brug Import All Strava Data. Det er de originale filer, ikke Strava-API\'en.',
  'Forbind derefter intervals.icu til DZR Coach. Nye Zwift-ture kommer ind af sig selv. Planlagte pas for cirka den næste uge ligger under Zwift → Workouts → Custom → Intervals.icu. På telefon og TV kan mappen mangle, selv når upload er gået igennem — tjek Windows-appen.',
]
