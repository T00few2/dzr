'use client'

import React from 'react'
import { Box, HStack, Stack, Text } from '@chakra-ui/react'

type StepProgressHeaderProps = {
  currentStep: 1 | 2 | 3 | 4
}

const STEP_LABELS = ['Log ind med Discord', 'Betal kontingent', 'Tilfoej Zwift ID'] as const
const STEP_HREFS = ['/join/discord', '/join/payment', '/join/zwift-id'] as const

export default function StepProgressHeader({ currentStep }: StepProgressHeaderProps) {
  return (
    <Stack spacing={3}>
      <Text color="gray.300" fontSize="sm">
        {currentStep <= 3 ? `Trin ${currentStep} af 3` : 'Gennemfoert'}
      </Text>
      <HStack spacing={3} align="stretch">
        {STEP_LABELS.map((label, idx) => {
          const stepNumber = idx + 1
          const isActive = currentStep === stepNumber
          const isDone = currentStep > stepNumber || currentStep === 4
          const href = isDone ? STEP_HREFS[idx] : undefined

          if (href) {
            return (
              <Box
                key={label}
                as="a"
                href={href}
                flex="1"
                borderWidth="1px"
                borderRadius="md"
                px={3}
                py={2}
                borderColor={isActive || isDone ? 'red.400' : 'gray.700'}
                bg={isActive ? 'red.900' : isDone ? 'green.900' : 'gray.900'}
                cursor="pointer"
                _hover={{ bg: 'green.800' }}
                transition="background-color 0.2s ease"
              >
                <Text fontSize="xs" color={isActive || isDone ? 'white' : 'gray.400'}>
                  {stepNumber}. {label}
                </Text>
              </Box>
            )
          }

          return (
            <Box
              key={label}
              flex="1"
              borderWidth="1px"
              borderRadius="md"
              px={3}
              py={2}
              borderColor={isActive || isDone ? 'red.400' : 'gray.700'}
              bg={isActive ? 'red.900' : isDone ? 'green.900' : 'gray.900'}
              cursor="default"
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
