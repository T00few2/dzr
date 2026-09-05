'use client'

import {
  Button,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  useDisclosure,
} from '@chakra-ui/react'
import type { ReactNode } from 'react'
import StravaPrivacyContent from '@/components/StravaPrivacyContent'

export function StravaPrivacyModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered scrollBehavior="inside" size="lg">
      <ModalOverlay bg="blackAlpha.700" backdropFilter="blur(2px)" />
      <ModalContent bg="gray.900" color="white" borderWidth="1px" borderColor="gray.700" mx={4}>
        <ModalHeader>Privatliv — DZR Coach og Strava</ModalHeader>
        <ModalCloseButton _hover={{ bg: 'whiteAlpha.200' }} />
        <ModalBody pb={4}>
          <StravaPrivacyContent />
        </ModalBody>
        <ModalFooter>
          <Button size="sm" bg="#ad1a2d" color="white" _hover={{ bg: '#8c1524' }} onClick={onClose}>
            Luk
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export function StravaPrivacyLink({
  children = 'Privatliv',
  color = 'gray.500',
}: {
  children?: ReactNode
  color?: string
}) {
  const { isOpen, onOpen, onClose } = useDisclosure()
  return (
    <>
      <Button
        variant="link"
        color={color}
        fontWeight="normal"
        fontSize="inherit"
        textDecoration="underline"
        verticalAlign="baseline"
        height="auto"
        minW="unset"
        p={0}
        onClick={onOpen}
      >
        {children}
      </Button>
      <StravaPrivacyModal isOpen={isOpen} onClose={onClose} />
    </>
  )
}
