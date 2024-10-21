// components/shop/Cart.tsx

import React from 'react';
import {
  Box,
  Button,
  Heading,
  Stack,
  Text,
  Image,
  Flex,
  Center,
} from '@chakra-ui/react';

// Define the type for a single cart item
interface CartItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
  size: string;
  fit: string;
  imageUrl: string;
}

// Define the props for the Cart component
interface CartProps {
  cartItems: CartItem[]; // Define the type of cartItems as an array of CartItem
  removeFromCart: (id: number) => void; // Function to remove items from the cart
  clearCart: () => void; // Function to clear the cart
}

const Cart: React.FC<CartProps> = ({ cartItems, removeFromCart, clearCart }) => {
  // Calculate the total price of all items in the cart
  const totalPrice = cartItems.reduce((total, item) => total + item.price * item.quantity, 0);

  return (
    <Center>
    <Box width={'90%'}>
      <Heading mb='4' size={'xl'} >Din kurv</Heading>
      {cartItems.length === 0 ? (
        <Text >Din kurv er tom.</Text>
      ) : (
        <Stack spacing={4}>
          {cartItems.map((item) => (
            <Box key={item.id} borderWidth="1px" borderRadius="lg" p={4}>
              <Flex alignItems="center" justifyContent="space-between">
                <Box ml={4}>
                  <Heading size="md">{item.name}</Heading>
                  <Text >Størrelse: {item.size}</Text>
                  <Text >Fit: {item.fit}</Text>
                  <Text >Antal: {item.quantity}</Text>
                  <Text  fontWeight="bold">Pris: {item.price} kr</Text>
                </Box>
                <Image
                  src={item.imageUrl}
                  alt={item.name}
                  width="150px"
                  objectFit="cover"
                  aspectRatio={4 / 3}
                />
                <Button
                  mt='4'
                  ml='4'
                  colorScheme="red"
                  onClick={() => removeFromCart(item.id)}
                  alignContent={'center'}
                >
                Fjern
                </Button>
                </Flex>

              
            </Box>
          ))}
          
          <Button width={'auto'} alignSelf={'center'} colorScheme="red" onClick={clearCart}>
            Ryd kurv
          </Button>
        </Stack>
      )}
    </Box>
    </Center>
  );
};

export default Cart;
