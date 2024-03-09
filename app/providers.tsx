// app/providers.tsx
'use client'

import { ChakraProvider, extendTheme } from '@chakra-ui/react';

// Define custom theme with desired font
const theme = extendTheme({
  fonts: {
    body: 'Roboto, sans-serif, bold 900',
    heading: 'Roboto, sans-serif, black 900',
    // Add more font styles if needed
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return <ChakraProvider theme={theme}>{children}</ChakraProvider>
}