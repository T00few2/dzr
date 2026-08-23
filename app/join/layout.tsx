import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Bliv klubmedlem af Danish Zwift Racers',
  description:
    'Bliv klubmedlem af DZR — dansk Zwift-klub og DCU-klub. Adgang til DCU E-Serien, ZRL, Club Ladder og DCU e-licens via DZR.',
  alternates: {
    canonical: '/join',
  },
  openGraph: {
    title: 'Bliv klubmedlem af Danish Zwift Racers',
    description:
      'Melder du dig ind i DZR, bliver du medlem af en DCU-klub og kan køre DCU E-Serien.',
    url: '/join',
    locale: 'da_DK',
    type: 'website',
  },
};

export default function JoinLayout({ children }: { children: React.ReactNode }) {
  return children;
}
