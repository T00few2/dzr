import { Inter } from "next/font/google";
import HeroSection from "@/components/HeroSection";
import Features from "@/components/Features";
import { Metadata } from "next";

const inter = Inter({ subsets: ['latin']})

export const metadata: Metadata = {
  title: '⚙️ DZR Admin Dashboard - Danish Zwift Racers Management',
  description: 'Admin Dashboard for Danish Zwift Racers - Manage events, users, and racing series.',

  metadataBase: new URL('https://www.dzrracingseries.com/'),

  openGraph: {
    title: 'DZR Admin Dashboard - Racing Management Interface',
    description: 'Administrative interface for managing Danish Zwift Racers community, events, and racing series.',
    url: 'https://www.dzrracingseries.com/',
    siteName: 'DZR Admin',
    images: [
      {
        url: 'https://www.dzrracingseries.com/general/DZR_admin_logo.svg',
      },
    ],
    type: 'website',
    locale: 'en_US',
  },
  
  robots: {
    index: false,
    follow: false,
  }
}

export default function Home() {
  return (
    <>
    <div >
    <HeroSection />
    <Features />
    </div>
    </>
  );
}


