'use client'

import { Button } from '@chakra-ui/react'

type Props = {
  href: string
  disabled?: boolean
}

export default function ConnectIntervalsButton({ href, disabled = false }: Props) {
  return (
    <Button
      as="a"
      href={disabled ? undefined : href}
      aria-disabled={disabled}
      isDisabled={disabled}
      bg="#ad1a2d"
      color="white"
      _hover={{ bg: disabled ? '#ad1a2d' : '#8c1524' }}
      width="fit-content"
    >
      Forbind intervals.icu
    </Button>
  )
}
