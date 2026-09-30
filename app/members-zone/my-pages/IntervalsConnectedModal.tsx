'use client'

import {
  Button,
  ListItem,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  OrderedList,
  Text,
} from '@chakra-ui/react'
import { INTERVALS_SETUP_STEPS } from '@/app/lib/intervalsCoachLinks'

export default function IntervalsConnectedModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered scrollBehavior="inside">
      <ModalOverlay bg="blackAlpha.700" backdropFilter="blur(2px)" />
      <ModalContent bg="gray.900" color="white" borderWidth="1px" borderColor="gray.700">
        <ModalHeader>intervals.icu er forbundet</ModalHeader>
        <ModalCloseButton _hover={{ bg: 'whiteAlpha.200' }} />
        <ModalBody>
          <Text color="gray.300" mb={3}>
            Gå tilbage til Discord. DZR Coach har sendt dig en DM. Skriv /coach på serveren, hvis du ikke kan se beskeden.
          </Text>
          <Text fontWeight="semibold" mb={2}>
            Tjek at det her er på plads, ellers kan coachen ikke se turene eller sende pas til Zwift
          </Text>
          <OrderedList color="gray.300" spacing={2} pl={2} mb={4}>
            {INTERVALS_SETUP_STEPS.slice(1, 5).map((step) => (
              <ListItem key={step}>{step}</ListItem>
            ))}
          </OrderedList>
          <Text fontSize="sm" color="gray.500">
            Dine rammer sætter du under Coach her på siden. Du kan afbryde forbindelsen samme sted.
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
