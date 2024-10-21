// components/shop/CartCheckoutModal.tsx
import React from 'react';
import { Modal, ModalOverlay, ModalCloseButton, ModalContent, ModalHeader, ModalFooter, ModalBody, Button, useDisclosure, Box, Heading } from '@chakra-ui/react';
import Cart from './Cart';
import Checkout from './CheckOut';
import Head from 'next/head';

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

interface CartCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  removeFromCart: (id: number) => void;
  clearCart: () => void;
}

const CartCheckoutModal: React.FC<CartCheckoutModalProps> = ({ isOpen, onClose, cartItems, removeFromCart, clearCart }) => {
  return (
    <Modal size={'2xl'} isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
      <ModalCloseButton />
        <ModalHeader><Heading size={'2xl'}>Check ud</Heading></ModalHeader>
        <ModalBody>
          <Box>
            <Cart cartItems={cartItems} removeFromCart={removeFromCart} clearCart={clearCart} />
            <Checkout cartItems={cartItems} clearCart={clearCart} onClose={onClose} />
          </Box>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default CartCheckoutModal;
