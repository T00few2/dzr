// app/layout.tsx
"use client";

import SidebarWithHeader from "@/components/Sidebar";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { AuthProvider } from "@/components/auth/AuthContext";

import Sparkles from 'react-sparkle'
import Snowfall from "react-snowfall";

require("dotenv").config();

import { Providers } from "./providers";
import DanishInviteBanner from "@/components/DanishInviteBanner";


export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <AuthProvider>
            {/* Background Effects 
            <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", zIndex: -1 }}>
              <Snowfall />
              <Sparkles flicker={false} minSize={7} maxSize={12}/>
            </div>
            */}

            {/* Sidebar and Content */}
            <SidebarWithHeader />
            <div style={{ position: "relative", minHeight: "100vh" }}>{children}</div>
            <DanishInviteBanner />

            {/* Analytics and Performance */}
            <Analytics />
            <SpeedInsights />
          </AuthProvider>
        </Providers>
      </body>
    </html>
  );
}
