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
} from '@chakra-ui/react';
import { AuthContext } from '@/components/auth/AuthContext';
import { updateProfile, deleteUser } from 'firebase/auth'; // Import the deleteUser function
import { auth } from '@/app/utils/firebaseConfig';

const EditProfileModal = ({ isOpen, onClose }) => {
  const { currentUser } = useContext(AuthContext);
  const [displayName, setDisplayName] = useState(currentUser?.displayName || '');
  const toast = useToast();

  const handleUpdateProfile = async () => {
    if (!currentUser) return;

    try {
      await updateProfile(currentUser, { displayName });
      toast({
        title: "Profile updated.",
        description: "Your profile has been updated successfully.",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
      onClose(); // Close the modal after successful update
    } catch (error) {
      console.error("Error updating profile:", error);
      toast({
        title: "Error updating profile.",
        description: "There was an error updating your profile.",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleDeleteProfile = async () => {
    if (!currentUser) return;

    // Confirm deletion with the user
    const confirmDelete = window.confirm("Are you sure you want to delete your profile? This action cannot be undone.");
    if (!confirmDelete) return;

    try {
      await deleteUser(currentUser); // Delete the user
      toast({
        title: "Profile deleted.",
        description: "Your profile has been deleted.",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
      onClose(); // Close the modal after deletion
    } catch (error) {
      console.error("Error deleting profile:", error);
      toast({
        title: "Error deleting profile.",
        description: "There was an error deleting your profile.",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Edit Profile</ModalHeader>
        <ModalBody>
        <Text mb='8px'>Display Name:</Text>
          <Input
            placeholder="Display Name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            mb={3}
          />
        </ModalBody>
        <ModalFooter>
          <Button colorScheme="blue" onClick={handleUpdateProfile}>
            Update
          </Button>
          <Button colorScheme="red" onClick={handleDeleteProfile} ml={3}>
            Delete Profile
          </Button>
          <Button variant="ghost" onClick={onClose} ml={3}>
            Cancel
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default EditProfileModal;
