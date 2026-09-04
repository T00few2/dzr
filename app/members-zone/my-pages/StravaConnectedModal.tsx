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
  Text,
} from '@chakra-ui/react'

export default function StravaConnectedModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered>
      <ModalOverlay bg="blackAlpha.700" backdropFilter="blur(2px)" />
      <ModalContent bg="gray.900" color="white" borderWidth="1px" borderColor="gray.700">
        <ModalHeader>Strava er forbundet</ModalHeader>
        <ModalCloseButton _hover={{ bg: 'whiteAlpha.200' }} />
        <ModalBody>
          <Text color="gray.300" mb={4}>
            Gå tilbage til Discord. Botten har sendt dig en DM — spørg om din træning der. Coaching sker aldrig i offentlige kanaler.
          </Text>
          <Text color="gray.300" mb={4}>
            Dine rammer (hvor ofte du kører, skader, mål og skrivestil) sætter du under Coach her på siden. Chat-noter kan du også slå til samme sted, hvis du vil have korte notater fra samtalen.
          </Text>
          <Text fontSize="sm" color="gray.500">
            Du kan afbryde forbindelsen under Coach.
          </Text>
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
