// app/layout.tsx
"use client";

import SidebarWithHeader from "@/components/Sidebar";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { AuthProvider } from "@/components/auth/AuthContext";
import Head from 'next/head';

import Sparkles from 'react-sparkle'
import Snowfall from "react-snowfall";

require("dotenv").config();

import { Providers } from "./providers";


export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <Head>
        <title>DZR - Danish Zwift Racers | Online Cycling Community</title>
        <meta name="description" content="Join Danish Zwift Racers - Denmark's premier online cycling community for Zwift racing events and competitions." />
        
        {/* Improved favicon setup */}
        <link rel="icon" type="image/svg+xml" href="/general/DZR_logo.svg" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        
        {/* Apple touch icon */}
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        
        {/* Theme color matching your brand */}
        <meta name="theme-color" content="#1a365d" />
        <meta name="msapplication-TileColor" content="#1a365d" />
        
        {/* PWA meta tags */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="DZR" />
        
        {/* Viewport and responsive design */}
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0" />
        
        {/* Language and locale */}
        <meta httpEquiv="content-language" content="en,da" />
        
        {/* Additional meta for better SEO */}
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        
        {/* Preload critical resources */}
        <link rel="preload" href="/general/DZR_logo.svg" as="image" type="image/svg+xml" />
      </Head>
      <body>
        <AuthProvider>
          <Providers>
            {/* Background Effects 
            <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", zIndex: -1 }}>
              <Snowfall />
              <Sparkles flicker={false} minSize={7} maxSize={12}/>
            </div>
            */}

            {/* Sidebar and Content */}
            <SidebarWithHeader />
            <div style={{ position: "relative", minHeight: "100vh" }}>{children}</div>

            {/* Analytics and Performance */}
            <Analytics />
            <SpeedInsights />
          </Providers>
        </AuthProvider>
      </body>
    </html>
  );
}
