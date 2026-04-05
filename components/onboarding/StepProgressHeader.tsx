'use client'

import React from 'react'
import { Box, HStack, Stack, Text } from '@chakra-ui/react'

type StepProgressHeaderProps = {
  currentStep: 1 | 2 | 3 | 4
}

const STEP_LABELS = ['Link Discord', 'Pay Membership', 'Add Zwift ID'] as const
const STEP_HREFS = ['/join/discord', '/join/payment', '/join/zwift-id'] as const

export default function StepProgressHeader({ currentStep }: StepProgressHeaderProps) {
  return (
    <Stack spacing={3}>
      <Text color="gray.300" fontSize="sm">
        {currentStep <= 3 ? `Step ${currentStep} of 3` : 'Completed'}
      </Text>
      <HStack spacing={3} align="stretch">
        {STEP_LABELS.map((label, idx) => {
          const stepNumber = idx + 1
          const isActive = currentStep === stepNumber
          const isDone = currentStep > stepNumber || currentStep === 4
          const href = isDone ? STEP_HREFS[idx] : undefined

          return (
            <Box
              key={label}
              as={href ? 'a' : 'div'}
              href={href}
              flex="1"
              borderWidth="1px"
              borderRadius="md"
              px={3}
              py={2}
              borderColor={isActive || isDone ? 'red.400' : 'gray.700'}
              bg={isActive ? 'red.900' : isDone ? 'green.900' : 'gray.900'}
              cursor={href ? 'pointer' : 'default'}
              _hover={href ? { bg: 'green.800' } : undefined}
              transition="background-color 0.2s ease"
            >
              <Text fontSize="xs" color={isActive || isDone ? 'white' : 'gray.400'}>
                {stepNumber}. {label}
              </Text>
            </Box>
          )
        })}
      </HStack>
    </Stack>
  )
}
