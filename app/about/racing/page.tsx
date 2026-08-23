import type { Metadata } from 'next';
import RacingPageContent from '@/components/racing/RacingPageContent';
import { JsonLd, racingPageJsonLd } from '@/components/seo/JsonLd';

export const metadata: Metadata = {
  title: 'Løb og hold hos DZR — DCU E-Serien, ZRL og Club Ladder',
  description:
    'Sådan kører Danish Zwift Racers organiseret racing: DCU E-Serien (DCU-klubmedlemskab, ikke e-licens), Zwift Racing League og Club Ladder. Hold findes i Ryttergården på Discord.',
  alternates: {
    canonical: '/about/racing',
  },
  openGraph: {
    title: 'Løb og hold hos DZR — DCU E-Serien, ZRL og Club Ladder',
    description:
      'DCU E-Serien, Zwift Racing League og Club Ladder hos Danish Zwift Racers. Alle medlemmer kan køre ZRL og Club Ladder.',
    url: '/about/racing',
    locale: 'da_DK',
    type: 'website',
  },
};

export default function AboutRacingPage() {
  return (
    <>
      <JsonLd data={racingPageJsonLd} />
      <RacingPageContent />
    </>
  );
}
