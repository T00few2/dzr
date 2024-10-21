// members-zone/shop/page.tsx
'use client';

import { useContext, useEffect, useState } from 'react';
import { AuthContext } from '@/components/auth/AuthContext';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '@/app/utils/firebaseConfig';
import LoadingSpinnerMemb from '@/components/LoadingSpinnerMemb';
import ProductList from '@/components/shop/ProductList';
import { Center, Heading, IconButton, Flex, Box, Grid, GridItem, Text, Badge } from '@chakra-ui/react';
import { FiShoppingCart } from 'react-icons/fi'; // Add icon for basket
import CartCheckoutModal from '@/components/shop/CartCheckoutModal';
import ActiveOrders from '@/components/shop/ActiveOrders';

const Shop = () => {
  const { currentUser, loading } = useContext(AuthContext);
  const router = useRouter();

  // Effect to redirect if not authenticated
  useEffect(() => {
    if (!loading && !currentUser) {
      router.push('/login');
    }
  }, [currentUser, loading, router]);

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

  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false); // State to open/close modal

  const addToCart = (product: Product, quantity: number, size: string, fit: string) => {
    setCartItems((prevItems) => {
      const existingItem = prevItems.find((item) => item.id === product.id && item.size === size && item.fit === fit);
      if (existingItem) {
        return prevItems.map((item) =>
          item.id === product.id && item.size === size && item.fit === fit
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prevItems, { ...product, size, fit, quantity }];
    });
  };

  const removeFromCart = (id: number) => {
    setCartItems((prevItems) => prevItems.filter((item) => item.id !== id));
  };

  const clearCart = () => {
    setCartItems([]);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/login');
    } catch (error: any) {
      console.error('Logout failed:', error.message);
    }
  };

  const handleModalOpen = () => {
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
  };

  const cartItemCount = cartItems.reduce((total, item) => total + item.quantity, 0); // Calculate total items in cart

  if (loading) {
    return <LoadingSpinnerMemb />;
  }

  return (
    <>
      {currentUser ? (
        <Center>
          <Grid
            templateAreas={`"header"
            "main"`}
            gridTemplateRows={'auto auto'}
            gridTemplateColumns={'90vw'}
            gap="5"
            color="blackAlpha.700"
            fontWeight="bold"
          >
            <GridItem area={'header'} position="sticky" top={0}  zIndex={1} bg={'black'}>
              <Flex alignItems="center" justifyContent="space-between" width="full">
                <Box flex="1" textAlign="center">
                  <Heading size={'3xl'} mt={4} mb={4} color="white">
                    DZR tøjbestilling
                  </Heading>
                </Box>
                <Box position="relative">
                  <IconButton
                    aria-label="Open cart"
                    icon={<FiShoppingCart />}
                    colorScheme="red"
                    onClick={handleModalOpen} // Function to open the modal

                  />
                  {cartItemCount > 0 && ( // Only show badge if there are items in the cart
                    <Badge
                      colorScheme="red"
                      borderRadius="full"
                      px={2}
                      position="absolute"
                      bottom="-10px"
                      right = '-10px'
                      fontSize="0.8em"
                    >
                      {cartItemCount}
                    </Badge>
                  )}
                </Box>
              </Flex>
              <ActiveOrders />
            </GridItem>

            <GridItem height={'100%'} area={'main'}>
              <ProductList addToCart={addToCart} />
            </GridItem>
          </Grid>
          <CartCheckoutModal
            isOpen={isModalOpen}
            onClose={handleModalClose}
            cartItems={cartItems}
            removeFromCart={removeFromCart}
            clearCart={clearCart}
          />
        </Center>
      ) : (
        <Text align='center' color='white'>You need to login.</Text>
      )}
    </>
  );
};

export default Shop;
