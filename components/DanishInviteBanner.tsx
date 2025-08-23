"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, AlertIcon, AlertTitle, Box, Button, CloseButton, Flex, Link } from "@chakra-ui/react";

function getBrowserLanguage(): string | null {
  if (typeof navigator === "undefined") return null;
  const langs = (navigator as any).languages as string[] | undefined;
  const primary = (langs && langs.length ? langs[0] : navigator.language) || "";
  return primary || null;
}

function shouldShowForDanish(): boolean {
  const lang = (getBrowserLanguage() || "").toLowerCase();
  // da, da-DK should match
  return lang.startsWith("da");
}

const DISMISS_KEY = "dzr.dk_invite_dismissed_v1";

export default function DanishInviteBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const dismissed = typeof window !== "undefined" ? window.localStorage.getItem(DISMISS_KEY) : "1";
      if (dismissed === "1") {
        setVisible(false);
        return;
      }
    } catch {}
    setVisible(shouldShowForDanish());
  }, []);

  const handleDismiss = () => {
    try { window.localStorage.setItem(DISMISS_KEY, "1"); } catch {}
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <Box
      position="fixed"
      // offset from iOS home indicator using safe-area
      bottom={{ base: 'calc(env(safe-area-inset-bottom, 0px) + 12px)', md: 4 }}
      left={0}
      right={0}
      zIndex={2000}
      px={{ base: 3, md: 6 }}
    >
      <Alert
        status="info"
        variant="subtle"
        bg="rgba(88, 101, 242, 0.95)"
        color="white"
        rounded="md"
        boxShadow="lg"
        p={{ base: 3, md: 4 }}
        pr={{ base: 10, md: 4 }}
        position="relative"
        w={{ base: '100%', md: 'auto' }}
        maxW={{ base: 'unset', md: '800px' }}
        mx="auto"
      >
        <CloseButton
          onClick={handleDismiss}
          color="white"
          position="absolute"
          top={2}
          right={2}
          display={{ base: 'inline-flex', md: 'none' }}
        />
        <AlertIcon color="white" />
        <Flex
          direction={{ base: "column", md: "row" }}
          align={{ base: "flex-start", md: "center" }}
          justify="space-between"
          w="100%"
          gap={3}
        >
          <Box>
            <AlertTitle fontSize={{ base: 'md', md: 'lg' }}>Danish Zwift Racers - DZR</AlertTitle>
            <AlertDescription fontSize={{ base: 'sm', md: 'md' }}>
              Bliv en del af DZR fællesskabet! Tilslut dig vores Discord server, mød andre danske Zwift race entusiaster og kør med på et af vores hold. Lige nu sætter vi hold til Zwift Racing League - holdbaseret Zwift racing når det er bedst og størst!
            </AlertDescription>
          </Box>
          <Flex gap={3} align="center" w={{ base: '100%', md: 'auto' }}>
            <Button
              as={Link}
              href="https://discord.gg/FBtCsddbmU"
              isExternal
              target="_blank"
              rel="noopener noreferrer"
              background='rgba(255,255,255,0.95)'
              color='#111827'
              _hover={{ background: 'white' }}
              w={{ base: '100%', md: 'auto' }}
              size={{ base: 'md', md: 'sm' }}
            >
              Join Discord
            </Button>
            <CloseButton onClick={handleDismiss} color="white" display={{ base: 'none', md: 'inline-flex' }} />
          </Flex>
        </Flex>
      </Alert>
    </Box>
  );
}


