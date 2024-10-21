// app/components/ActiveOrders.js

import { useEffect, useState, useContext } from 'react';
import { Center, Box, ListItem, UnorderedList, Text, Flex, Spinner, Stack, Button, useToast, useDisclosure, Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton, ModalBody, ModalFooter } from '@chakra-ui/react';
import { db } from '@/app/utils/firebaseConfig'; // Adjust the import path as necessary
import { collection, query, where, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { AuthContext } from '@/components/auth/AuthContext'; // Import your AuthContext

const ActiveOrders = () => {
  const { currentUser } = useContext(AuthContext); // Get the current user from context
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();

  useEffect(() => {
    if (currentUser) {
      const ordersRef = collection(db, 'orders');
      const q = query(ordersRef, where('userId', '==', currentUser.uid)); // Query for orders for the current user

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const orderData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setOrders(orderData);
        setLoading(false);
      });

      return () => unsubscribe(); // Clean up the listener on unmount
    } else {
      setLoading(false); // If there's no user, stop loading
    }
  }, [currentUser]);

  const handleDeleteOrder = async (orderId) => {
    try {
      await deleteDoc(doc(db, 'orders', orderId)); // Delete the order from Firestore
      const remainingOrders = orders.filter(order => order.id !== orderId);
      setOrders(remainingOrders); // Update the orders list

      toast({
        title: "Order Deleted",
        description: "Your order has been deleted successfully.",
        status: "success",
        duration: 3000,
        isClosable: true,
      });

      // Close the modal if no orders remain
      if (remainingOrders.length === 0) {
        onClose();
      }

    } catch (error) {
      console.error('Error deleting order:', error);
      toast({
        title: "Delete Failed",
        description: "There was a problem deleting your order. Please try again.",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  return (
    <Box>
      {loading ? (
        <Spinner />
    ) : orders.length > 0 ? (
        
        <Stack spacing={4} mt={4} mb={4}>
            
                <Button textAlign={'center'} variant='outline' onClick={onOpen} colorScheme="red">Bemærk: Du har aktive bestillinger</Button>
            
        <Modal isOpen={isOpen} onClose={onClose}>
        <ModalContent>
          <ModalHeader>Dine aktive ordrer</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
          {orders.map(order => (
            <Box key={order.id} p={4} borderWidth={1} borderRadius="md">
              <Text>Navn: {order.customerName}</Text>
              <Text>Email: {order.email}</Text>
              <Text>Adresse: {order.customerAddress}, {order.postalCode} {order.city}</Text>
              <Text>Telefon: {order.phone}</Text>
              <Text>Bestilling:</Text>
              <UnorderedList>
                {order.items.map(item => (
                  <ListItem key={item.id}>{item.name}: {item.price * item.quantity} kr (Størrelse: {item.size}, Fit: {item.fit}, Antal: {item.quantity})</ListItem>
                ))}
                {!order.delivery && (<ListItem key={'fragt'}>Fragt: {order.transportation} kr</ListItem>)}
              </UnorderedList>
              <Text fontWeight={'bold'}>Total: {order.totalAmount.toFixed(2)} kr</Text>
              <Center>
              <Button colorScheme="red" onClick={() => handleDeleteOrder(order.id)} mt={4}>
                Slet bestilling
              </Button>
              </Center>
            </Box>
            ))}
            </ModalBody>
        </ModalContent>
        </Modal>
          
        </Stack>
      ) : (
        <></>
      )}
    </Box>
  );
};

export default ActiveOrders;
