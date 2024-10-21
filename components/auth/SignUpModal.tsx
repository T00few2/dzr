import React, { useState, useContext } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  Button,
  Input,
  useDisclosure,
  Text,
  useToast,
  FormLabel,
} from '@chakra-ui/react';
import { AuthContext } from '@/components/auth/AuthContext';

export default function SignUpModal() {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [dzrSecret, setDzrSecret] = useState(''); // State for DZR secret
  const [displayName, setDisplayName] = useState(''); // State for display name
  const [error, setError] = useState('');
  const { signup } = useContext(AuthContext);
  const toast = useToast();

  // Get the predefined secret from the environment variable
  const predefinedSecret = process.env.NEXT_PUBLIC_MEMBERS_ZONE; // Use NEXT_PUBLIC_ for client-side access

  const handleSignUp = async () => {
    setError('');

    if (dzrSecret !== predefinedSecret) {
      setError('Invalid DZR secret. Please contact the admin for access.');
      return;
    }

    // Check if display name is provided
    if (!displayName) {
      setError('Display name is required.');
      return;
    }

    try {
      await signup(email, password, displayName); // Include display name in signup
      toast({
        title: "Account created.",
        description: "Welcome to DZR!",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
      onClose(); // Close the modal after successful sign-up
    } catch (error) {
      console.error("Error signing up:", error);
      setError("Error creating account. Please try again.");
    }
  };

  return (
    <>
      <Button onClick={onOpen} colorScheme="blue" color={'white'}>Sign Up</Button>

      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Sign Up</ModalHeader>
          <ModalBody>
          <FormLabel >Display Name</FormLabel>
            <Input
              placeholder="Display Name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              mb={3}
            />
          <FormLabel >E-mail</FormLabel>
            <Input
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              mb={3}
            />
          <FormLabel >Password</FormLabel>
            <Input
              placeholder="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              mb={3}
            />
          <FormLabel >DZR Secret</FormLabel>
            <Input
              placeholder="DZR Secret"
              type='password'
              value={dzrSecret}
              onChange={(e) => setDzrSecret(e.target.value)}
              mb={3}
            />
            {error && <Text color="red.500">{error}</Text>}
          </ModalBody>

          <ModalFooter>
            <Button colorScheme="red" onClick={handleSignUp}>
              Sign Up
            </Button>
            <Button variant="ghost" onClick={onClose} ml={3}>Cancel</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
