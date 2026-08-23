import type { Metadata } from 'next';
import AppShell from './AppShell';

export const metadata: Metadata = {
  metadataBase: new URL('https://www.dzrracingseries.com'),
  title: 'Danish Zwift Racers',
  description: 'Join the Danish Zwift Racers community for virtual cycling races and training.',
  openGraph: {
    siteName: 'DZR',
    locale: 'en_US',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
