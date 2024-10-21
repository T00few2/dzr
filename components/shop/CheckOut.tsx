import { Heading, UnorderedList, ListItem, Flex, Stack, Box, Button, Text, Input, Checkbox, Modal, ModalOverlay, ModalContent, ModalHeader, ModalFooter, ModalBody, useDisclosure, useToast, Center, Divider } from '@chakra-ui/react';
import { useState, useContext } from 'react';
import { db } from '@/app/utils/firebaseConfig'; // Adjust the import path as necessary
import { collection, addDoc } from 'firebase/firestore'; // Import Firestore functions
import { AuthContext } from '@/components/auth/AuthContext'; // Import your AuthContext

interface Product {
  id: number;
  name: string;
  description: React.ReactNode;
  price: number;
  imageUrl: string;
  availableSizes: string[];
  availableFit: string[];
  weight: number;
}

interface CartItem extends Product {
  size: string;
  fit: string;
  quantity: number;
}

interface CheckoutProps {
  cartItems: CartItem[];
  clearCart: () => void;
  onClose: () => void;
}

const Checkout = ({ cartItems, clearCart, onClose }: CheckoutProps) => {
  
  const toast = useToast();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [postalCode, setPostalCode] = useState(''); // State for postal code
  const [city, setCity] = useState(''); // State for city
  const [phone, setPhone] = useState(''); // State for city
  const [isPickup, setIsPickup] = useState(true); // State for pickup option
  const [isLoading, setIsLoading] = useState(false); // Loading state

  const totalWeight = cartItems.reduce((total, item) => total + item.weight * item.quantity, 0);
  const transportationCost = totalWeight <= 0 
  ? 0 
  : totalWeight < 1 
    ? 45 
    : totalWeight <= 3 
      ? 65 
      : 85;
 
  const totalAmount = cartItems.reduce((total, item) => total + item.price * item.quantity, 0) + (isPickup ? 0 : transportationCost); // Add transportation cost if not picking up

  // Get the current user from context
  const { currentUser } = useContext(AuthContext); // Assuming you have this context


  const handlePlaceOrder = async () => {
    if (!name || (!isPickup && (!address || !postalCode || !city))) {
      toast({
        title: "Missing Information",
        description: "Please fill in your name and address, or select pickup.",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    const orderData = {
      items: cartItems.map(({ description, ...item }) => item), // Exclude description
      totalAmount,
      customerName: name,
      delivery: isPickup,
      transportation: isPickup ? "" : transportationCost,
      customerAddress: isPickup ? "Afhentning på Frederiksberg" : address,
      postalCode: isPickup ? "" : postalCode, // Only include postal code if not picking up
      city: isPickup ? "" : city, // Only include city if not picking up
      phone: isPickup ? "" : phone,
      email: currentUser.email,
      userId: currentUser.uid, // Attach the user ID to the order
      createdAt: new Date(), // Timestamp for the order
    };

    setIsLoading(true); // Set loading state
    try {
      // Save the order to Firestore
      const docRef = await addDoc(collection(db, 'orders'), orderData);

      toast({
        title: "Order Placed",
        description: "Your order has been placed successfully.",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
      clearCart(); // Clear cart after successful order
      setIsPickup(true);
      onClose(); // Close the modal
    } catch (error) {
      console.error('Error placing order:', error);
      toast({
        title: "Order Failed",
        description: "There was a problem placing your order. Please try again.",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false); // Reset loading state
    }
  };

  return (
    <Box>
      <Heading size={'xl'} mt={4} mb={4}>Indtast forsendelsesoplysninger</Heading>
      {/* Modal for entering name and address */}
 
            <Input
              placeholder="Fulde navn"
              value={name}
              onChange={(e) => setName(e.target.value)}
              mb={4}
            />
            <Checkbox 
              isChecked={isPickup} 
              onChange={() => setIsPickup(!isPickup)}
              mb={4}
            >
              Afhent på Frederiksberg
            </Checkbox>
            {/* Conditionally render the address, postal code, and city inputs */}
            {!isPickup && (
              <>
                <Text color="red.500" mb={2}>*Der vil blive tilføjet transportomkostninger på {transportationCost} kr.</Text>
                <Input
                  placeholder="Adresse"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  mb={4}
                />
                <Flex>
                  <Input
                    placeholder="Postkode"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    mb={4}
                    mr={4}
                    width={'100px'}
                  />
                  <Input
                    placeholder="By"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    mb={4}
                    flex='1'
                  />
                </Flex>
                <Input
                    placeholder="Telefon"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    mb={4}
                  />
              </>
            )}
            <Text >Bestilling:</Text>
            <UnorderedList>
              {cartItems.map((item) => (
                <ListItem key={item.id}>{item.name}: {item.price*item.quantity} kr (Størrelse: {item.size}, Fit: {item.fit}, Antal: {item.quantity})</ListItem>
                ))}
              {!isPickup && (<ListItem key={'fragt'}>Fragt: {transportationCost} kr</ListItem>)}
              
              </UnorderedList>
              <Text fontWeight="bold">Total: {totalAmount.toFixed(2)} kr</Text>

            <Button 
              mt={4}
              mb={4}
              colorScheme="blue" 
              onClick={handlePlaceOrder} 
              isLoading={isLoading} // Show loading state
              isDisabled={!name || (!isPickup && (!address || !postalCode || !city || !phone))} // Disable if fields are empty
            >
              Afgiv bestilling
            </Button>
    </Box>
    
  );
};

export default Checkout;
