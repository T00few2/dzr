// app/layout.tsx
"use client";

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import SidebarWithHeader from "@/components/Sidebar";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { AuthProvider } from "@/components/auth/AuthContext";
import SnowfallClient from "@/components/SnowfallClient";

require("dotenv").config();

import { Providers } from "./providers";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <Providers>
            {/* Snowfall effect */}
            <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", zIndex: -1 }}>
              <SnowfallClient />
            </div>
            {/* Sidebar and content */}
            <SidebarWithHeader />
            <div style={{ position: "relative", minHeight: "100vh" }}>
              {children}
            </div>
            <Analytics />
            <SpeedInsights />
          </Providers>
        </AuthProvider>
      </body>
    </html>
  );
}
