import { Inter } from "next/font/google";
import HeroSection from "@/components/HeroSection";
import Features from "@/components/Features";
import { Metadata } from "next";

const inter = Inter({ subsets: ['latin']})

export const metadata: Metadata = {
  title: 'Danish Zwift Racers',
  description: 'Join the Danish Zwift Racers community for virtual cycling races and training.',

  metadataBase: new URL('https://www.dzrracingseries.com/'),

  openGraph: {
    title: 'Danish Zwift Racers: Race, Train, and Ride Together on Zwift',
    description: 'Join the Danish Zwift Racers community for virtual cycling races and training.',
    url: 'https://www.dzrracingseries.com/',
    siteName: 'DZR',
    images: [
      {
        url: 'https://www.dzrracingseries.com/general/DZR_logo.svg',
      },
    ],
    type: 'website',
    locale: 'en_US',
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


