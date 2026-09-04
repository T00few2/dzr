'use client'

import { Box } from '@chakra-ui/react'

type Props = {
  href: string
  disabled?: boolean
}

export default function ConnectWithStravaButton({ href, disabled = false }: Props) {
  const image = (
    <Box
      as="img"
      src="/strava/btn_strava_connectwith_orange.svg"
      alt="Connect with Strava"
      height="48px"
      width="237px"
      maxW="100%"
      display="block"
    />
  )

  if (disabled) {
    return (
      <Box as="span" display="inline-block" opacity={0.45} cursor="not-allowed" aria-disabled="true">
        {image}
      </Box>
    )
  }

  return (
    <Box as="a" href={href} display="inline-block" lineHeight={0} aria-label="Connect with Strava">
      {image}
    </Box>
  )
}
