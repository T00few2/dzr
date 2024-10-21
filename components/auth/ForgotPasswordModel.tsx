// components/auth/ForgotPasswordModal.tsx

import React from 'react';
import { Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton, ModalBody, ModalFooter, Button, Input, useDisclosure } from '@chakra-ui/react';
import { getAuth, sendPasswordResetEmail } from "firebase/auth"; // Import Firebase functions

const ForgotPasswordModal = () => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [email, setEmail] = React.useState('');

  const handleResetPassword = async () => {
    const auth = getAuth();
    try {
      await sendPasswordResetEmail(auth, email);
      alert('Password reset link sent! Check your email.'); // Notify the user
      onClose(); // Close the modal
    } catch (error) {
      console.error("Error sending password reset email:", error);
      alert('Error sending password reset email.'); // Notify the user of the error
    }
  };

  return (
    <>
      <Button variant='link' onClick={onOpen} color="gray.400">Forgot Password?</Button>
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Reset Password</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)} // Update email state
              mb={4} // Add margin below the input
            />
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="blue" mr={3} onClick={onClose}>
              Close
            </Button>
            <Button variant="ghost" onClick={handleResetPassword}>
              Send Reset Link
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default ForgotPasswordModal; // Ensure this is the default export
