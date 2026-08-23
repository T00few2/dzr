import type { Metadata } from 'next';
import AboutPageContent from '@/components/about/AboutPageContent';
import { JsonLd, sportsClubJsonLd } from '@/components/seo/JsonLd';

export const metadata: Metadata = {
  title: 'Danish Zwift Racers — dansk Zwift-klub og DCU E-Serien',
  description:
    'Danish Zwift Racers er en dansk online cykelklub for e-cykling på Zwift. Medlem af Danmarks Cykle Union. Klubmedlemmer får adgang til DCU E-Serien.',
  alternates: {
    canonical: '/about',
  },
  openGraph: {
    title: 'Danish Zwift Racers — dansk Zwift-klub og DCU E-Serien',
    description:
      'Dansk online cykelklub for e-cykling på Zwift. Medlem af DCU med adgang til DCU E-Serien.',
    url: '/about',
    locale: 'da_DK',
    type: 'website',
  },
};

export default function AboutPage() {
  return (
    <>
      <JsonLd data={sportsClubJsonLd} />
      <AboutPageContent />
    </>
  );
}
