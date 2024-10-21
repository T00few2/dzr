import type { Metadata } from "next";
import { Inter } from "next/font/google";
import SidebarWithHeader from "@/components/Sidebar";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { AuthProvider } from '@/components/auth/AuthContext';

require('dotenv').config();

// app/layout.tsx
import { Providers } from './providers';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {/* Wrap the app with AuthProvider to enable authentication */}
        <AuthProvider>
          <Providers>
            <SidebarWithHeader />
            {children}
            <Analytics />
            <SpeedInsights />
          </Providers>
        </AuthProvider>
      </body>
    </html>
  );
}