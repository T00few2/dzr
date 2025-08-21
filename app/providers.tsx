// app/providers.tsx
'use client'

import { ChakraProvider, extendTheme } from '@chakra-ui/react';
import { SessionProvider } from 'next-auth/react';

// Define custom theme with desired font
const theme = extendTheme({
  fonts: {
    body: 'Roboto, sans-serif, bold 900',
    heading: 'Roboto, sans-serif, black 900',
    // Add more font styles if needed
  },
  styles: {
    global: () => ({
      body: {
        background:'black',
      }
    })
  }
});

export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider><ChakraProvider theme={theme}>{children}</ChakraProvider></SessionProvider>
}