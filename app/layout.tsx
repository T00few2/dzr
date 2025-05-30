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
        <title>⚙️ DZR Admin Dashboard</title>
        <meta name="description" content="Danish Zwift Racers - Admin Dashboard and Management Interface" />
        
        {/* Admin-focused favicon */}
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'><defs><linearGradient id='g' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' style='stop-color:%23667eea'/><stop offset='100%' style='stop-color:%23764ba2'/></linearGradient></defs><rect width='32' height='32' rx='6' fill='url(%23g)'/><text x='16' y='14' text-anchor='middle' font-family='Consolas' font-size='8' font-weight='bold' fill='white'>DZR</text><rect x='6' y='16' width='20' height='8' rx='4' fill='%2328a745'/><text x='16' y='21' text-anchor='middle' font-family='Arial' font-size='6' font-weight='bold' fill='white'>ADMIN</text><circle cx='8' cy='26' r='1.5' fill='%2300ff88'/><circle cx='16' cy='26' r='1.5' fill='%2300ff88'/><circle cx='24' cy='26' r='1.5' fill='%2300ff88'/></svg>" />
        
        {/* Apple touch icon */}
        <link rel="apple-touch-icon" href="/admin-favicon.svg" />
        
        {/* Theme color */}
        <meta name="theme-color" content="#667eea" />
        
        {/* PWA meta tags */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="DZR Admin" />
        
        {/* Admin-specific meta */}
        <meta name="robots" content="noindex, nofollow" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
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
