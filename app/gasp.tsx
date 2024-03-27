'use client'
// Import GSAP and TextPlugin
import { gsap } from 'gsap';
import { TextPlugin } from 'gsap/dist/TextPlugin'; // Make sure to import from 'dist' directory
import { useRef, useEffect } from 'react';

import {
    Text,
  } from '@chakra-ui/react'

// Ensure TextPlugin is added to gsap
gsap.registerPlugin(TextPlugin);

// Component
const DZR_slogan = () => {
    // Ref for the text element
    const textRef = useRef(null);
  
    // Animation function
    const animateText = () => {
        gsap.to(textRef.current, {
            duration: 4,
            delay: 0.5,
            color: 'grey',
            text: {
              value: "the pain in the peleton",
              rtl: false,
            },
          });    
    };

    useEffect(() => {
        animateText();
      }, []); 
  
    return (
        <Text ref={textRef} color={'black'} maxW={'3xl'} as='cite' fontSize={{ base: 'l', sm: 'xl', md: '2xl' }}>
            -
        </Text>
    );
};
  
export default DZR_slogan;