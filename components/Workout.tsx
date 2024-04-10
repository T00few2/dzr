'use client'

import {
    Modal,
    ModalOverlay,
    ModalBody,
    ModalHeader,
    ModalFooter,
    ModalContent,
    ModalCloseButton,
    Button,
    Flex,
    Box,
} from '@chakra-ui/react'

import { useDisclosure } from '@chakra-ui/react';

import { WorkoutGraphSVG } from '@/app/in-the-zone-2/workouts/nextWorkout_';

function Workout() {
    const { isOpen, onOpen, onClose } = useDisclosure()
    return (
      <>
        <Button onClick={onOpen} bg='rgba(173, 26, 45, 0.95)' color = 'white' size={'xs'}>In The Zone 2 #1</Button>
  
        <Modal isOpen={isOpen} onClose={onClose} size={{ base: 'xs', sm: 'xl', md: '6xl' }}>
          <ModalOverlay/>
          <ModalContent bg={'white'}>
            
            <ModalHeader color={'black'}>Workout Profile</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <WorkoutGraphSVG/>
            </ModalBody>
  

            
          </ModalContent>
        </Modal>
      </>
    )
  }

export default Workout;