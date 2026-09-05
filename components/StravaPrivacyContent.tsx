'use client'

import { Heading, Link as ChakraLink, ListItem, Text, UnorderedList, VStack } from '@chakra-ui/react'
import NextLink from 'next/link'
import { DZR_SUPPORT_EMAIL, STRAVA_APPS_URL, STRAVA_CONNECT_PATH } from '@/app/lib/stravaCoachLinks'

export default function StravaPrivacyContent({ showBackLink = false }: { showBackLink?: boolean }) {
  return (
    <VStack align="stretch" spacing={5} color="gray.300" fontSize="sm">
      <Text>
        Denne erklæring gælder DZR Coach på Danish Zwift Racers&apos; website og i Discord
        (den separate DZR Coach-bot, ikke klub-boten).
        Den supplerer Stravas egen privatlivspolitik. Ved konflikt gælder{' '}
        <ChakraLink href="https://www.strava.com/legal/privacy" isExternal textDecoration="underline">
          Stravas privatlivspolitik
        </ChakraLink>{' '}
        for data, Strava behandler.
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
          Fra Strava (read-only, kun når du spørger coachen): din profil, zoner og aktiviteter
          (samt ét pas, hvis du spørger om det). Vi gemmer ikke hele din træningshistorik.
        </ListItem>
        <ListItem>
          Strava-tokens (krypteret) og dit Strava-atlet-id, så vi kan hente data og vise at du er
          forbundet.
        </ListItem>
        <ListItem>
          Coach-rammer, du selv sætter (ture/uge, skader, mål, sprog). Chat-noter kun hvis du slår
          dem til. Noter gemmes krypteret.
        </ListItem>
        <ListItem>Din Discord-id, så DZR Coach kan sende private coaching-svar.</ListItem>
      </UnorderedList>

      <Heading size="sm" color="white">
        Hvordan
      </Heading>
      <Text>
        Du forbinder via Strava OAuth på vores site. Vores server kalder Stravas API direkte, når
        du stiller et spørgsmål til DZR Coach i Discord. Vi bruger ikke en tredjeparts Strava-proxy.
      </Text>

      <Heading size="sm" color="white">
        OpenAI
      </Heading>
      <Text>
        For at lave svaret sender vi dit spørgsmål og et kort sammendrag af de Strava-data, vi
        netop har hentet, til OpenAI. Hvis du har udfyldt coach-profilen, sendes de rammer med.
        Hvis chat-noter er slået til, kan korte daterede noter også sendes med. Vi træner ikke en
        model på dine data.
      </Text>

      <Heading size="sm" color="white">
        Stravas API-brug
      </Heading>
      <Text>
        Strava kan overvåge og indsamle brugsdata om vores API-kald og bruge dem til support,
        overholdelse og forbedring af deres platform.
      </Text>

      <Heading size="sm" color="white">
        Opbevaring
      </Heading>
      <Text>
        Tokens og profil ligger, så længe du er forbundet. Aktiviteter hentes efter behov og
        gemmes ikke som historik. Chat-noter ligger, indtil du sletter dem, slår noter fra, eller
        afbryder Strava (højst 200 noter).
      </Text>

      <Heading size="sm" color="white">
        Sletning og tilbagetrækning
      </Heading>
      <Text>
        Afbryd under{' '}
        <ChakraLink as={NextLink} href="/members-zone/my-pages?tab=2" textDecoration="underline">
          Mine sider → Coach
        </ChakraLink>{' '}
        eller under{' '}
        <ChakraLink href={STRAVA_APPS_URL} isExternal textDecoration="underline">
          Strava → Settings → My Apps
        </ChakraLink>
        . Så sletter vi tokens, coach-profil og noter og sender en bekræftelse i en DM fra DZR Coach. Du
        kan også skrive til {DZR_SUPPORT_EMAIL}.
      </Text>

      <Heading size="sm" color="white">
        Dine rettigheder
      </Heading>
      <Text>
        Du kan få indsigt i, rette eller slette de coach-data, vi har om dig. Skriv til{' '}
        {DZR_SUPPORT_EMAIL}. Aktivitetsdata ser du hos Strava. Vi er selvstændig dataansvarlig for
        det, vi behandler; Strava er dataansvarlig for deres platform.
      </Text>

      <Heading size="sm" color="white">
        Tredjeparter
      </Heading>
      <Text>
        Strava og OpenAI leveres som de er. DZR giver ingen garanti på deres vegne og er ikke
        ansvarlig for deres følgeskader, i det omfang loven tillader det.
      </Text>

      {showBackLink ? (
        <Text color="gray.500">
          <ChakraLink as={NextLink} href={STRAVA_CONNECT_PATH} textDecoration="underline">
            Tilbage til at forbinde Strava
          </ChakraLink>
        </Text>
      ) : null}
    </VStack>
  )
}
