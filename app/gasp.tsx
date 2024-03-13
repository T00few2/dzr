'use client'
// Import GSAP and TextPlugin
import { gsap } from 'gsap';
import { TextPlugin } from 'gsap/dist/TextPlugin'; // Make sure to import from 'dist' directory
import { useRef, useEffect } from 'react';

import {
    Box,
    Button,
    Container,
    Flex,
    Heading,
    Icon,
    Stack,
    Text,
    useColorModeValue,
    Link,
    Divider,
    AbsoluteCenter,
    Circle,
    Spacer,
  } from '@chakra-ui/react'

// Ensure TextPlugin is added to gsap
gsap.registerPlugin(TextPlugin);

// Component
const DZR_Header = () => {
    // Ref for the text element
    const textRef = useRef(null);
  
    // Animation function
    const animateText = () => {
        gsap.to(textRef.current, {
            duration: 0.5,
            delay: 1,
            color: 'white',
            text: {
              value: "Danish Zwift Racers",
              rtl: false,
              
            },
          });
          
    };

    useEffect(() => {
        animateText();
      }, []); 
  
    return (
            <Heading ref={textRef}
          
          fontSize={{ base: '3xl', sm: '4xl', md: '6xl' }}
          lineHeight={'110%'}
          textColor='black'>
          <Text>-</Text>
        </Heading>

    );
  };
  
  export default DZR_Header;