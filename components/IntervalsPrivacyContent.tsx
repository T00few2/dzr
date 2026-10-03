'use client'

import { Heading, Link as ChakraLink, ListItem, Text, UnorderedList, VStack } from '@chakra-ui/react'
import NextLink from 'next/link'
import { DZR_SUPPORT_EMAIL, INTERVALS_CONNECT_PATH, INTERVALS_SETTINGS_URL } from '@/app/lib/intervalsCoachLinks'

export default function IntervalsPrivacyContent({ showBackLink = false }: { showBackLink?: boolean }) {
  return (
    <VStack align="stretch" spacing={5} color="gray.300" fontSize="sm">
      <Text>
        Denne erklæring gælder DZR Coach på Danish Zwift Racers&apos; website og i Discord
        (den separate DZR Coach-bot, ikke klub-boten).
      </Text>

      <Heading size="sm" color="white">
        Dataansvarlig
      </Heading>
      <Text>
        Danish Zwift Racers (DZR). Kontakt:{' '}
        <ChakraLink href={`mailto:${DZR_SUPPORT_EMAIL}`} textDecoration="underline">
          {DZR_SUPPORT_EMAIL}
        </ChakraLink>
        .
      </Text>

      <Heading size="sm" color="white">
        Hvad vi indsamler
      </Heading>
      <UnorderedList spacing={2} pl={2}>
        <ListItem>
          Fra intervals.icu, når du spørger coachen: profil, zoner, wellness (vægt, hvilepuls, HRV,
          søvn, belastning), planlagte pas og aktiviteter. Aktiviteter, som intervals.icu kun har
          via et andet trænings-API, springes over.
        </ListItem>
        <ListItem>
          Et adgangstoken (krypteret) og dit intervals.icu-atlet-id, så vi kan hente data og lægge
          et planlagt pas på din kalender, når du beder om en træningsfil.
        </ListItem>
        <ListItem>
          Coach-rammer, du selv sætter. Chat-noter og et kort resumé af hver samtale kun hvis du slår
          chat-noter til. Noter og resuméer gemmes krypteret.
        </ListItem>
        <ListItem>Din Discord-id, så DZR Coach kan sende private coaching-svar.</ListItem>
        <ListItem>
          Dine 👍/👎 på coachens svar og dit token-forbrug, gemt med din Discord-id til
          kvalitetsforbedring og omkostningsstyring. Med chat-noter slået til gemmes også, hvilke
          slags data coachen slog op til svaret — aldrig selve teksten.
        </ListItem>
      </UnorderedList>

      <Heading size="sm" color="white">
        Beskeder i din DM
      </Heading>
      <Text>
        For at forstå sammenhængen kan coachen læse det seneste døgn af jeres DM igen, fx når du
        svarer på et check-in. Med chat-noter slået til kan den læse op til 14 dage tilbage, når du
        henviser til noget, I har snakket om tidligere. DZR gemmer ikke beskederne.
      </Text>

      <Heading size="sm" color="white">
        Check-in
      </Heading>
      <Text>
        Har du slået check-in til, bruger coachen din kalender, dine mål, dine seneste aktiviteter og
        (med chat-noter slået til) dine noter til at skrive en kort besked om morgenen.
      </Text>

      <Heading size="sm" color="white">
        Garmin
      </Heading>
      <Text>
        Hvis en aktivitet er optaget på en Garmin-enhed, kan tallene stamme derfra. Coachen siger
        det, når den viser de tal.
      </Text>

      <Heading size="sm" color="white">
        OpenAI
      </Heading>
      <Text>
        For at lave svaret sender vi dit spørgsmål, de seneste beskeder fra jeres DM og et kort
        sammendrag af de data, vi netop har hentet, til OpenAI. Hvis du har udfyldt coach-profilen,
        sendes de rammer med. Hvis chat-noter er slået til, kan korte daterede noter også sendes med.
        Vi træner ikke en model på dine data.
      </Text>

      <Heading size="sm" color="white">
        Sletning
      </Heading>
      <Text>
        Afbryd under{' '}
        <ChakraLink as={NextLink} href="/members-zone/my-pages?tab=2" textDecoration="underline">
          Mine sider → Coach
        </ChakraLink>{' '}
        eller under{' '}
        <ChakraLink href={INTERVALS_SETTINGS_URL} isExternal textDecoration="underline">
          intervals.icu → Settings
        </ChakraLink>
        . Så sletter vi token, coach-profil, chat-noter, 👍/👎, forbrugsdata og gemte træningstal og
        sender en bekræftelse i en DM fra DZR Coach. Du kan også skrive til {DZR_SUPPORT_EMAIL}.
      </Text>

      {showBackLink ? (
        <Text color="gray.500">
          <ChakraLink as={NextLink} href={INTERVALS_CONNECT_PATH} textDecoration="underline">
            Tilbage til at forbinde intervals.icu
          </ChakraLink>
        </Text>
      ) : null}
    </VStack>
  )
}
