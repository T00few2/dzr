export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export const SITE_URL = 'https://www.dzrracingseries.com';
export const DISCORD_INVITE = 'https://discord.gg/FBtCsddbmU';

export const sportsClubJsonLd: Record<string, unknown> = {
  '@context': 'https://schema.org',
  '@type': ['SportsOrganization', 'SportsClub'],
  name: 'Danish Zwift Racers',
  alternateName: 'DZR',
  url: SITE_URL,
  logo: `${SITE_URL}/general/DZR_logo.svg`,
  foundingDate: '2025-11-17',
  sport: 'E-cycling',
  description:
    'Dansk online cykelklub for e-cykling på Zwift. Medlem af Danmarks Cykle Union med adgang til DCU E-Serien.',
  memberOf: {
    '@type': 'SportsOrganization',
    name: 'Danmarks Cykle Union',
    url: 'https://www.cyklingdanmark.dk/',
  },
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Frederiksberg',
    addressCountry: 'DK',
  },
  sameAs: [DISCORD_INVITE],
};

export const racingPageJsonLd: Record<string, unknown> = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Løb og hold hos Danish Zwift Racers',
  url: `${SITE_URL}/about/racing`,
  description:
    'Organiseret racing i DZR: DCU E-Serien, Zwift Racing League og Club Ladder. Alle medlemmer kan køre ZRL og Club Ladder. DCU E-Serien kræver medlemskab af en DCU-klub.',
  isPartOf: {
    '@type': 'WebSite',
    name: 'Danish Zwift Racers',
    url: SITE_URL,
  },
  about: [
    { '@type': 'Thing', name: 'DCU E-Serien' },
    { '@type': 'Thing', name: 'Zwift Racing League' },
    { '@type': 'Thing', name: 'Club Ladder' },
  ],
};
