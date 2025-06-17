import { Inter } from "next/font/google";
import HeroSection from "@/components/HeroSection";
import Features from "@/components/Features";
import { Metadata } from "next";

const inter = Inter({ subsets: ['latin']})

export const metadata: Metadata = {
  title: 'DZR - Danish Zwift Racers | Online Cycling Community & Racing Events',
  description: 'Join Danish Zwift Racers (DZR) - Denmark\'s premier online cycling community. Participate in exciting Zwift racing events, connect with fellow Danish cyclists, and compete in our racing series.',
  
  keywords: 'Danish Zwift Racers, DZR, Zwift racing, Danish cycling, online cycling, virtual cycling, cycling community Denmark, Zwift events, cycling races, Danish cyclists',
  
  authors: [{ name: 'Danish Zwift Racers' }],
  creator: 'Danish Zwift Racers',
  publisher: 'Danish Zwift Racers',

  metadataBase: new URL('https://www.dzrracingseries.com/'),
  
  alternates: {
    canonical: 'https://www.dzrracingseries.com/',
  },

  openGraph: {
    title: 'DZR - Danish Zwift Racers | Online Cycling Community & Racing Events',
    description: 'Join Danish Zwift Racers (DZR) - Denmark\'s premier online cycling community. Participate in exciting Zwift racing events, connect with fellow Danish cyclists, and compete in our racing series.',
    url: 'https://www.dzrracingseries.com/',
    siteName: 'Danish Zwift Racers',
    images: [
      {
        url: 'https://www.dzrracingseries.com/general/DZR_logo.svg',
        width: 1200,
        height: 630,
        alt: 'Danish Zwift Racers Logo',
      },
    ],
    type: 'website',
    locale: 'en_US',
    alternateLocale: 'da_DK',
  },
  
  twitter: {
    card: 'summary_large_image',
    title: 'DZR - Danish Zwift Racers | Online Cycling Community',
    description: 'Join Denmark\'s premier online cycling community. Participate in Zwift racing events and connect with fellow Danish cyclists.',
    images: ['https://www.dzrracingseries.com/general/DZR_logo.svg'],
    creator: '@DZRracingseries', // Add your Twitter handle if you have one
  },
  
  // Remove robots restrictions for public site
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  
  // Add category for better classification
  category: 'Sports & Recreation',
  
  // Add verification for search engines (add your actual verification codes)
  verification: {
    // google: 'your-google-verification-code',
    // bing: 'your-bing-verification-code',
  },
}

// Add structured data for better search engine understanding
const structuredData = {
  "@context": "https://schema.org",
  "@type": "SportsOrganization",
  "name": "Danish Zwift Racers",
  "alternateName": "DZR",
  "description": "Denmark's premier online cycling community for Zwift racing events and competitions",
  "url": "https://www.dzrracingseries.com/",
  "logo": "https://www.dzrracingseries.com/general/DZR_logo.svg",
  "sameAs": [
    // Add your social media URLs here
    // "https://www.facebook.com/DZRracingseries",
    // "https://www.instagram.com/DZRracingseries",
    // "https://discord.gg/your-discord-server"
  ],
  "sport": "Cycling",
  "location": {
    "@type": "Country",
    "name": "Denmark"
  },
  "memberOf": {
    "@type": "Organization",
    "name": "Zwift Racing Community"
  }
};

export default function Home() {
  return (
    <>
      {/* Add structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <div>
        <HeroSection />
        <Features />
      </div>
    </>
  );
}


